#!/usr/bin/env node
// Restore the board from an automatic backup (the board makes one every 10 minutes in data/backups).
//   npm run restore                 list the backups, newest last
//   npm run restore -- latest       restore the newest one
//   npm run restore -- <file>       restore that one (a name from the list, or a path)
// The board must be stopped first. The current board.db is kept as board.db.before-restore-<time>.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.resolve(process.env.BOARD_DATA || path.join(ROOT, 'data'));
const BACKUPS = path.join(DATA_DIR, 'backups');
const PORT = Number(process.env.PORT || 4000);

const list = () => (fs.existsSync(BACKUPS) ? fs.readdirSync(BACKUPS).filter((f) => /^board-\d{8}-\d{6}\.db$/.test(f)).sort() : []);
const when = (f) => { const m = f.match(/^board-(\d{4})(\d\d)(\d\d)-(\d\d)(\d\d)(\d\d)\.db$/); return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` : f; };
const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

const arg = process.argv[2];
const all = list();
if (!arg) {
  if (!all.length) { console.log(`No backups yet in ${BACKUPS}. The board makes one every 10 minutes while it runs.`); process.exit(0); }
  console.log(`Backups in ${BACKUPS} (newest last):`);
  for (const f of all) console.log(`  ${f}   ${when(f)}   ${Math.round(fs.statSync(path.join(BACKUPS, f)).size / 1024)} KB`);
  console.log('\nRestore one (stop the board first):  npm run restore -- latest   or   npm run restore -- <file>');
  process.exit(0);
}

const src = arg === 'latest' ? (all.length ? path.join(BACKUPS, all.at(-1)) : null)
  : fs.existsSync(arg) ? path.resolve(arg) : fs.existsSync(path.join(BACKUPS, arg)) ? path.join(BACKUPS, arg) : null;
if (!src) fail(arg === 'latest' ? 'There are no backups yet.' : `No backup called ${arg}. Run npm run restore to list them.`);

// A running board would keep writing to the old database (and overwrite the restore).
// The board writes data/board.pid while it runs: that works whatever port it's on.
const pidFile = path.join(DATA_DIR, 'board.pid');
if (fs.existsSync(pidFile)) {
  let info = null;
  try { info = JSON.parse(fs.readFileSync(pidFile, 'utf8')); } catch {}
  const pid = Number(info?.pid);
  let alive = false;
  if (pid > 0) { try { process.kill(pid, 0); alive = true; } catch (e) { alive = e.code === 'EPERM'; } }
  if (alive) fail(`A board is running (process ${pid}${info?.port ? `, port ${info.port}` : ''}). Stop it first (Ctrl+C in its window), then run this again.`);
  console.log(`  (Ignoring a stale ${path.basename(pidFile)}: process ${pid || '?'} isn't running.)`);
}
let running = false;
try { running = !!(await (await fetch(`http://localhost:${PORT}/health`, { signal: AbortSignal.timeout(1500) })).json())?.app; } catch {}
if (running) fail(`A board is running on port ${PORT}. Stop it first (Ctrl+C in its window), then run this again.`);

// Only a healthy SQLite database: a wrong or damaged file would leave the board unable to start.
try {
  const fd = fs.openSync(src, 'r'); const head = Buffer.alloc(16); fs.readSync(fd, head, 0, 16, 0); fs.closeSync(fd);
  if (head.toString('latin1') !== 'SQLite format 3\0') fail(`${path.basename(src)} isn't a SQLite database, so it can't be a board backup.`);
  const check = new DatabaseSync(src, { readOnly: true });
  let ok;
  try { ok = check.prepare('PRAGMA integrity_check').get(); } finally { check.close(); }
  if (Object.values(ok || {})[0] !== 'ok') fail(`${path.basename(src)} is damaged (integrity check failed). Pick another backup.`);
} catch (e) { fail(`Can't read ${path.basename(src)}: ${e.message}`); }

// Copy first, then swap: a failure part-way never leaves the board without a database.
const db = path.join(DATA_DIR, 'board.db');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const tmp = path.join(DATA_DIR, `board.db.restoring-${stamp}`);
fs.copyFileSync(src, tmp);
let kept = null;
try {
  if (fs.existsSync(db)) {
    kept = `${db}.before-restore-${stamp}`;
    fs.renameSync(db, kept);
    for (const ext of ['-wal', '-shm']) if (fs.existsSync(db + ext)) fs.renameSync(db + ext, kept + ext);
  }
  fs.renameSync(tmp, db);
} catch (e) {
  // Put the old board back if it was moved, and leave the copy for a manual fix.
  if (kept && !fs.existsSync(db)) { try { fs.renameSync(kept, db); } catch {} }
  fail(`Restore failed: ${e.message}. The backup copy is at ${tmp}.`);
}
console.log(`✓ Restored the board from ${path.basename(src)} (${when(path.basename(src))}).`);
if (kept) console.log(`  The previous board is kept as ${path.basename(kept)}.`);
console.log('  Start the board again: npm start (or npm run tunnel). Agents reconnect by themselves.');
