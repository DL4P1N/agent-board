// A running server marks its data folder (board.pid), so `npm run restore` / `npm run boards` won't change
// files under it, and a second server started on the same folder (another port, another window) refuses to
// start instead of opening the same databases (src/server.js). Taken before the registry loads, so the CLI
// can't race a starting server.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { DATA_DIR, PORT, HOST } from './config.js';

const PID_FILE = path.join(DATA_DIR, 'board.pid');
// Held (a folder: mkdir is atomic) while a starting server removes a stale board.pid.
const RECLAIM_LOCK = `${PID_FILE}.reclaim`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readText = () => { try { return fs.readFileSync(PID_FILE, 'utf8'); } catch { return null; } };
const read = () => { try { return JSON.parse(readText()); } catch { return null; } };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
// This server's own mark in board.pid: two containers sharing one data volume both run as pid 1, so the pid alone
// doesn't say the file is ours.
const INSTANCE = crypto.randomBytes(8).toString('hex');
const ours = (o) => o?.pid === process.pid && o?.id === INSTANCE;
// The machine or container it runs on: another one's pids and ports can't be checked from here.
const HOSTNAME = os.hostname();
const foreign = (o) => typeof o?.hostname === 'string' && !!o.hostname && o.hostname !== HOSTNAME;
const mine = (port = PORT) => JSON.stringify({ pid: process.pid, id: INSTANCE, port, host: HOST, hostname: HOSTNAME, started: new Date().toISOString() });
// A running server touches its board.pid every 30s (heartbeat). Another machine's or container's file whose last touch
// is older than 2 minutes is stale: that server stopped without removing it (a hard kill, a recreated container).
export const BEAT_MS = 30e3;
export const BEAT_STALE_MS = 2 * 60e3;
const beatAge = () => { try { return Date.now() - fs.statSync(PID_FILE).mtimeMs; } catch { return Infinity; } };
// For the refusal: what to do when the owner is on another machine or container ('' when it is on this one).
export const foreignHint = (o) => (foreign(o)
  ? ` It runs on another machine or container (${o.hostname}), which can't be checked from here: it keeps the folder while it updates ${PID_FILE} (every ${BEAT_MS / 1000}s), and a server started here takes the folder over by itself once that file has gone ${BEAT_STALE_MS / 60e3} minutes without an update. To take it over sooner, when that server has stopped, delete the file and start again.`
  : '');
// Where that server answers: the address it listens on (localhost when that is every address); IPv6 in brackets.
const probeHost = (h) => (!h || h === '0.0.0.0' || h === '::' ? 'localhost' : h.includes(':') ? `[${h}]` : h);
// Nothing listens on that port (every address tried refused the connection).
const refused = (e) => { const c = e?.cause; const codes = c?.errors?.length ? c.errors.map((x) => x?.code) : [c?.code]; return codes.every((x) => x === 'ECONNREFUSED'); };

// The other server that owns the data folder ({ pid, port, started }), or null when there is none. A live
// process under the recorded pid keeps it unless there is proof that it isn't that server: started over a
// minute ago (it has been listening for a while by then) and its port refuses connections, or something else
// answers /health there (another pid, or not a board). Then the pid was taken by an unrelated process after a
// crash or a hard stop (Windows hands pids out again quickly), and the file is stale. A /health that doesn't
// answer in time proves nothing (a busy or suspended server): it keeps the folder.
// A file written on another machine or container (another hostname: a second container on a shared data volume)
// can't be checked that way (its pid and port aren't this one's to probe; a local port that refuses says nothing):
// its heartbeat decides. Touched within the last 2 minutes, it keeps the folder; older, it is stale.
export async function otherOwner() {
  const o = read();
  if (o && Number.isInteger(o.pid) && !ours(o) && foreign(o)) return beatAge() < BEAT_STALE_MS ? o : null;
  // Our pid but not our mark: another container's pid 1 (or this container's before a restart), so the process
  // check proves nothing: the checks below decide.
  if (!o || !Number.isInteger(o.pid) || ours(o) || (o.pid !== process.pid && !alive(o.pid))) return null;
  if (Date.now() - Date.parse(o.started) < 60e3) return o;
  // A server writes the port it really got once it listens: still none after a minute, it never did.
  if (!Number.isInteger(o.port) || o.port <= 0) return null;
  let h;
  try { h = await (await fetch(`http://${probeHost(o.host ?? HOST)}:${o.port}/health`, { signal: AbortSignal.timeout(2000) })).json(); }
  catch (e) { return e instanceof SyntaxError || refused(e) ? null : o; }
  return h?.pid === o.pid ? o : null;
}

// Removes board.pid if it still holds `stale` (the text found to be stale), under RECLAIM_LOCK: two servers
// reclaiming at once can't both see the stale text, and then one delete the file the other just created.
// false: another one holds the lock (try again shortly).
function dropStale(stale) {
  try { fs.mkdirSync(RECLAIM_LOCK); } catch (e) {
    // Only ever held for a moment: an old one was left by a server that died holding it.
    try { if (e.code === 'EEXIST' && Date.now() - fs.statSync(RECLAIM_LOCK).mtimeMs > 10e3) fs.rmdirSync(RECLAIM_LOCK); } catch {}
    return false;
  }
  try { if (readText() === stale) fs.unlinkSync(PID_FILE); } catch {} finally { try { fs.rmdirSync(RECLAIM_LOCK); } catch {} }
  return true;
}

// Takes the data folder for this server: creates board.pid only when there is none, so of two servers starting
// at once exactly one gets it. An existing file is replaced only once it's known to be stale. Returns the other
// owner when there is one (this server must not start), { error } when board.pid can't be made (it doesn't start
// unguarded either), else null.
export async function takePid() {
  let error = null;
  for (let i = 0; i < 10; i++) {
    try {
      const fd = fs.openSync(PID_FILE, 'wx');
      try { fs.writeSync(fd, mine()); } finally { fs.closeSync(fd); }
      return null;
    } catch (e) {
      // Can't create it (no access, or on Windows a file still being deleted): try again shortly.
      if (e.code !== 'EEXIST') { error = e; await sleep(200); continue; }
    }
    const before = readText();
    if (before === null) continue; // removed meanwhile: try again
    // Just created by a server starting this moment (not written yet): give it a moment.
    if (!before.trim()) {
      let age = Infinity; try { age = Date.now() - fs.statSync(PID_FILE).mtimeMs; } catch {}
      if (age < 5e3) { await sleep(200); continue; }
    }
    const o = await otherOwner();
    if (o) return o;
    // Stale: remove it (unless another server replaced it meanwhile), then try again.
    if (!dropStale(before)) await sleep(50);
  }
  if (error && !fs.existsSync(PID_FILE)) return { error: error.message };
  return read() || { pid: '?', port: '?' };
}

// Once listening: the port it really got (PORT=0 picks one).
export const writePid = (port) => { try { fs.writeFileSync(PID_FILE, mine(port)); } catch {} };
export const dropPid = () => { if (ours(read())) try { fs.unlinkSync(PID_FILE); } catch {} };
// While it runs: touches board.pid (only while it is still ours) so a server on another machine or container sharing
// the folder sees it alive. Unref'd: it never keeps the process up. Returns the interval (clearInterval stops it).
export function heartbeat(ms = BEAT_MS) {
  const t = setInterval(() => { try { if (ours(read())) { const now = new Date(); fs.utimesSync(PID_FILE, now, now); } } catch {} }, ms);
  t.unref?.();
  return t;
}
