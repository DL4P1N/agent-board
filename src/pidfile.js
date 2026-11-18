// A running server marks its data folder (board.pid), so `npm run restore` / `npm run boards` won't change
// files under it, and a second server started on the same folder (another port, another window) refuses to
// start instead of opening the same databases (src/server.js). Written before the registry loads, so the CLI
// can't race a starting server.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, PORT } from './config.js';

const PID_FILE = path.join(DATA_DIR, 'board.pid');
const read = () => { try { return JSON.parse(fs.readFileSync(PID_FILE, 'utf8')); } catch { return null; } };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

// The other server that owns the data folder ({ pid, port, started }), or null when there is none. A live
// process under the recorded pid counts when that server answers its /health with the same pid, or when it
// started less than a minute ago (it may not be listening yet). Otherwise the pid was taken by an unrelated
// process after a crash or a hard stop (Windows hands pids out again quickly), and the file is stale.
export async function otherOwner() {
  const o = read();
  if (!o || !Number.isInteger(o.pid) || o.pid === process.pid || !alive(o.pid)) return null;
  if (Date.now() - Date.parse(o.started) < 60e3) return o;
  try {
    const h = await (await fetch(`http://localhost:${o.port}/health`, { signal: AbortSignal.timeout(2000) })).json();
    if (h?.pid === o.pid) return o;
  } catch {}
  return null;
}
export const writePid = () => { try { fs.writeFileSync(PID_FILE, JSON.stringify({ pid: process.pid, port: PORT, started: new Date().toISOString() })); } catch {} };
export const dropPid = () => { if (read()?.pid === process.pid) try { fs.unlinkSync(PID_FILE); } catch {} };
