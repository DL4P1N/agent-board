// A running server marks its data folder (board.pid), so `npm run restore` / `npm run boards` won't change
// files under it, and a second server started on the same folder (another port, another window) refuses to
// start instead of opening the same databases (src/server.js). Taken before the registry loads, so the CLI
// can't race a starting server.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, PORT, HOST } from './config.js';

const PID_FILE = path.join(DATA_DIR, 'board.pid');
// Held (a folder: mkdir is atomic) while a starting server removes a stale board.pid.
const RECLAIM_LOCK = `${PID_FILE}.reclaim`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readText = () => { try { return fs.readFileSync(PID_FILE, 'utf8'); } catch { return null; } };
const read = () => { try { return JSON.parse(readText()); } catch { return null; } };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const mine = (port = PORT) => JSON.stringify({ pid: process.pid, port, host: HOST, started: new Date().toISOString() });
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
export async function otherOwner() {
  const o = read();
  if (!o || !Number.isInteger(o.pid) || o.pid === process.pid || !alive(o.pid)) return null;
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
export const dropPid = () => { if (read()?.pid === process.pid) try { fs.unlinkSync(PID_FILE); } catch {} };
