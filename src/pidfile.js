// A running server marks its data folder (board.pid), so `npm run restore` / `npm run boards` won't change
// files under it, and a second server started on the same folder (another port, another window) refuses to
// start instead of opening the same databases (src/server.js). Taken before the registry loads, so the CLI
// can't race a starting server.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, PORT, HOST } from './config.js';

const PID_FILE = path.join(DATA_DIR, 'board.pid');
const readText = () => { try { return fs.readFileSync(PID_FILE, 'utf8'); } catch { return null; } };
const read = () => { try { return JSON.parse(readText()); } catch { return null; } };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const mine = (port = PORT) => JSON.stringify({ pid: process.pid, port, host: HOST, started: new Date().toISOString() });
// Where that server answers: the address it listens on (localhost when that is every address); IPv6 in brackets.
const probeHost = (h) => (!h || h === '0.0.0.0' || h === '::' ? 'localhost' : h.includes(':') ? `[${h}]` : h);

// The other server that owns the data folder ({ pid, port, started }), or null when there is none. A live
// process under the recorded pid counts when that server answers its /health with the same pid, or when it
// started less than a minute ago (it may not be listening yet). Otherwise the pid was taken by an unrelated
// process after a crash or a hard stop (Windows hands pids out again quickly), and the file is stale.
export async function otherOwner() {
  const o = read();
  if (!o || !Number.isInteger(o.pid) || o.pid === process.pid || !alive(o.pid)) return null;
  if (Date.now() - Date.parse(o.started) < 60e3) return o;
  try {
    const h = await (await fetch(`http://${probeHost(o.host ?? HOST)}:${o.port}/health`, { signal: AbortSignal.timeout(2000) })).json();
    if (h?.pid === o.pid) return o;
  } catch {}
  return null;
}

// Takes the data folder for this server: creates board.pid only when there is none, so of two servers starting
// at once exactly one gets it. An existing file is replaced only once it's known to be stale. Returns the other
// owner when there is one (this server must not start), else null.
export async function takePid() {
  for (let i = 0; i < 10; i++) {
    try {
      const fd = fs.openSync(PID_FILE, 'wx');
      try { fs.writeSync(fd, mine()); } finally { fs.closeSync(fd); }
      return null;
    } catch (e) {
      if (e.code !== 'EEXIST') return null; // can't write in the folder: nothing to guard it with
    }
    const before = readText();
    if (before === null) continue; // removed meanwhile: try again
    // Just created by a server starting this moment (not written yet): give it a moment.
    if (!before.trim()) {
      let age = Infinity; try { age = Date.now() - fs.statSync(PID_FILE).mtimeMs; } catch {}
      if (age < 5e3) { await new Promise((r) => setTimeout(r, 200)); continue; }
    }
    const o = await otherOwner();
    if (o) return o;
    // Stale: remove it (unless another server replaced it meanwhile), then try again.
    if (readText() === before) try { fs.unlinkSync(PID_FILE); } catch {}
  }
  return read() || { pid: '?', port: '?' };
}

// Once listening: the port it really got (PORT=0 picks one).
export const writePid = (port) => { try { fs.writeFileSync(PID_FILE, mine(port)); } catch {} };
export const dropPid = () => { if (read()?.pid === process.pid) try { fs.unlinkSync(PID_FILE); } catch {} };
