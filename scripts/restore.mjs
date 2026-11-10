#!/usr/bin/env node
// Restore a board from an automatic backup (each board makes one every 10 minutes in its backups/ folder).
//   npm run restore                              list every board's backups, newest last
//   npm run restore -- latest                    restore the default board's newest backup
//   npm run restore -- <file>                    restore that one (a name from the list, or a path)
//   npm run restore -- latest --board <name>     the same for another board (see npm run boards -- list)
// The board server must be stopped first. The current board.db is kept as board.db.before-restore-<time>.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.resolve(process.env.BOARD_DATA || path.join(ROOT, 'data'));
const PORT = Number(process.env.PORT || 4000);

// The boards on this server (data/boards.json); a data folder from before there were several boards
// is the one board "main", in the data folder itself. Read only: restoring never rewrites the registry.
let registry = null;
try { registry = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'boards.json'), 'utf8')); } catch {}
const boardsList = registry?.boards?.length ? registry.boards : [{ slug: 'main', name: 'Main board', dir: '.' }];
const defaultSlug = registry?.default || boardsList[0].slug;

const argv = process.argv.slice(2);
const bi = argv.indexOf('--board');
const boardArg = bi >= 0 ? String(argv[bi + 1] || '').toLowerCase() : '';
if (bi >= 0 && !boardArg) { console.error('✗ --board needs a board name, e.g. --board kubecon-2026'); process.exit(1); }
const positional = bi < 0 ? argv : argv.filter((_, i) => i !== bi && i !== bi + 1);

const backupsOf = (b) => path.join(path.resolve(DATA_DIR, b.dir || '.'), 'backups');
const listIn = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^board-\d{8}-\d{6}\.db$/.test(f)).sort() : []);
const when = (f) => { const m = f.match(/^board-(\d{4})(\d\d)(\d\d)-(\d\d)(\d\d)(\d\d)\.db$/); return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` : f; };
const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

const arg = positional[0];
if (!arg) {
  // Every board's backups (or just the one asked for with --board).
  const shown = boardArg ? boardsList.filter((b) => b.slug === boardArg) : boardsList;
  if (boardArg && !shown.length) fail(`No board called "${boardArg}". Boards: ${boardsList.map((b) => b.slug).join(', ')}.`);
  for (const b of shown) {
    const dir = backupsOf(b); const files = listIn(dir);
    const label = `${b.slug}${b.slug === defaultSlug ? ' (default)' : ''}${b.status === 'archived' ? ' (archived)' : ''}`;
    if (!files.length) { console.log(`Board ${label}. No backups yet in ${dir}. A board makes one every 10 minutes while it runs.`); continue; }
    console.log(`Board ${label}. Backups in ${dir} (newest last):`);
    for (const f of files) console.log(`  ${f}   ${when(f)}   ${Math.round(fs.statSync(path.join(dir, f)).size / 1024)} KB`);
  }
  console.log(`\nRestore one (stop the board server first):  npm run restore -- latest${boardsList.length > 1 ? ' --board <name>' : ''}   or   npm run restore -- <file>${boardsList.length > 1 ? ' --board <name>' : ''}`);
  if (boardsList.length > 1) console.log(`Without --board it restores the default board ("${defaultSlug}").`);
  process.exit(0);
}

const board = boardsList.find((b) => b.slug === (boardArg || defaultSlug));
if (!board) fail(`No board called "${boardArg}". Boards: ${boardsList.map((b) => b.slug).join(', ')}.`);
const BOARD_DIR = path.resolve(DATA_DIR, board.dir || '.');
const BACKUPS = backupsOf(board);
const all = listIn(BACKUPS);

const src = arg === 'latest' ? (all.length ? path.join(BACKUPS, all.at(-1)) : null)
  : fs.existsSync(arg) ? path.resolve(arg) : fs.existsSync(path.join(BACKUPS, arg)) ? path.join(BACKUPS, arg) : null;
if (!src) fail(arg === 'latest' ? `Board "${board.slug}" has no backups yet.` : `No backup called ${arg} for board "${board.slug}". Run npm run restore to list them.`);

// A running board would keep writing to the old database (and overwrite the restore).
// The server writes board.pid in the data folder while it runs (one for all boards): that works whatever port it's on.
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
fs.mkdirSync(BOARD_DIR, { recursive: true });
const db = path.join(BOARD_DIR, 'board.db');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const tmp = path.join(BOARD_DIR, `board.db.restoring-${stamp}`);
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
console.log(`✓ Restored board "${board.slug}" from ${path.basename(src)} (${when(path.basename(src))}).`);
if (kept) console.log(`  The previous board is kept as ${path.basename(kept)}.`);
console.log('  Start the board again: npm start (or npm run tunnel). Agents reconnect by themselves.');
