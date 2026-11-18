// A running server marks its data folder (board.pid), so `npm run restore` / `npm run boards` won't change
// files under it. Written before the registry loads, so the CLI can't race a starting server; never
// overwrites the file of another server that's still running (that one owns the folder).
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, PORT } from './config.js';

const PID_FILE = path.join(DATA_DIR, 'board.pid');
function otherServerAlive() {
  try { const { pid } = JSON.parse(fs.readFileSync(PID_FILE, 'utf8')); if (pid === process.pid) return false; process.kill(pid, 0); return true; } catch { return false; }
}
export const writePid = () => { if (!otherServerAlive()) try { fs.writeFileSync(PID_FILE, JSON.stringify({ pid: process.pid, port: PORT, started: new Date().toISOString() })); } catch {} };
export const dropPid = () => { try { if (JSON.parse(fs.readFileSync(PID_FILE, 'utf8')).pid === process.pid) fs.unlinkSync(PID_FILE); } catch {} };
