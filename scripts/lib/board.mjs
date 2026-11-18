// Starting a throwaway board server (src/server.js) in a temp data folder, as a child process.
// Used by `npm run demo`; tests/helpers.mjs builds its startBoard on it (and tracks the children and folders it makes).
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Ends a child process at once and synchronously. On Windows with everything it started (taskkill /T /F: a plain kill()
// there returns before the child is gone, so it can still hold its database open while its folder is being deleted).
// On POSIX SIGKILL ends only the child itself, unless it was started with `detached: true` (its own process group) and
// group is true: then the whole group goes (process.kill(-pid)), as tests/run.mjs does with a suite that timed out.
export function killTree(c, { group = false } = {}) {
  if (!c || c.exitCode !== null || c.signalCode !== null) return;
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore', timeout: 5000 });
    else if (group) process.kill(-c.pid, 'SIGKILL');
    else c.kill('SIGKILL');
  } catch {}
}
// Waits (up to ms) for a child to exit; true at once if it already has.
export const exited = (c, ms = 5000) => new Promise((r) => {
  if (!c || c.exitCode !== null || c.signalCode !== null) return r(true);
  const t = setTimeout(() => r(false), ms);
  c.once('exit', () => { clearTimeout(t); r(true); });
});

export const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.unref();
  s.on('error', reject);
  s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

// Starts `node src/server.js` on a free port with an empty data folder; board.stop() ends it (the folder stays).
// restart() replaces it with a fresh, empty board on the same port; relaunch() keeps the data folder (like a reload).
// env: extra environment for the server, e.g. { PUBLIC_URL }. port: default a free one.
// newDataDir() makes each data folder (default: a temp folder named prefix…); dropDataDir(dir) is called for the old
// one on restart(); onChild(child) sees every server process started.
// The port is free when it's picked, but another program can take it before the board binds it: then this board exits
// (EADDRINUSE) while /health may answer from someone else's board. So a board counts as started only once /health comes
// from this child (its pid); if the child exits first, the first start tries again on another free port.
export async function startBoard({ env = {}, port: wantPort, token, prefix = 'agent-board-', newDataDir, dropDataDir = () => {}, onChild = () => {} } = {}) {
  const makeDir = newDataDir || (() => fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  const board = { port: 0, base: '', token, dataDir: '', child: null };
  const setPort = (p) => { board.port = p; board.base = `http://localhost:${p}`; };
  setPort(wantPort || await freePort());
  let started = false;
  // Returns at once if the board already exited; ends its process tree if it hasn't exited within 5s.
  const kill = async () => {
    const c = board.child;
    if (!c) return;
    try { c.kill(); } catch {}
    if (!(await exited(c, 5000))) { killTree(c); await exited(c, 2000); }
    board.child = null;
  };
  let why = '';
  const once = async () => {
    const child = board.child = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], {
      env: { ...process.env, PORT: String(board.port), BOARD_TOKEN: token, BOARD_DATA: board.dataDir, BOARD_NO_JOIN: '1', ...env },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    child.stderr.on('data', (d) => { err = (err + d).slice(-600); });
    onChild(child);
    for (let i = 0; i < 150 && child.exitCode === null && child.signalCode === null; i++) {
      try { if ((await (await fetch(`${board.base}/health`, { signal: AbortSignal.timeout(2000) })).json()).pid === child.pid) return true; } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    why = child.exitCode !== null ? `it exited (${child.exitCode}): ${err.trim().split('\n').filter(Boolean).slice(-2).join(' / ')}` : 'no answer from it';
    await kill();
    return false;
  };
  const launch = async (keepData = false) => {
    if (!keepData) {
      if (board.dataDir) dropDataDir(board.dataDir); // restart(): the old board's folder goes
      board.dataDir = makeDir();
    }
    for (let attempt = 1; !(await once()); attempt++) {
      if (wantPort || attempt >= 5) throw new Error(`board did not start on port ${board.port}: ${why}`);
      // The first start moves to another free port. A restart keeps its port (agents and pages hold the address): the
      // port can be briefly taken (on Windows, by another program's outgoing connection), so it tries again shortly.
      if (!started) setPort(await freePort());
      else await new Promise((r) => setTimeout(r, 500 * attempt));
    }
    started = true;
  };
  board.stop = kill;
  board.restart = async () => { await kill(); await launch(); };
  board.relaunch = async () => { await kill(); await launch(true); };
  await launch();
  return board;
}
