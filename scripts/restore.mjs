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
import { parseArgs } from 'node:util';
import { boardEntryProblem } from '../src/boards.js';
import { otherOwner, foreignHint } from '../src/pidfile.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.resolve(process.env.BOARD_DATA || path.join(ROOT, 'data'));
const PORT = Number(process.env.PORT || 4000);

// The boards on this server (data/boards.json); a data folder from before there were several boards
// is the one board "main", in the data folder itself. Read only: restoring never rewrites the registry.
let registry = null;
try { registry = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'boards.json'), 'utf8')); } catch {}
const boardsList = registry?.boards?.length ? registry.boards : [{ slug: 'main', name: 'Main board', dir: '.' }];
const defaultSlug = registry?.default || boardsList[0].slug;

const { values, positionals: positional } = parseArgs({ options: { board: { type: 'string' } }, strict: false, allowPositionals: true });
const boardArg = typeof values.board === 'string' ? values.board.toLowerCase() : '';
if (values.board !== undefined && !boardArg) { console.error('✗ --board needs a board name, e.g. --board kubecon-2026'); process.exit(1); }

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
    const problem = boardEntryProblem(b);
    if (problem) { console.log(`Board ${b.slug}: skipped, ${problem}.`); continue; }
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
// Never act on a folder outside the data folder (a hand-edited boards.json): the same rule as the server's.
const problem = boardEntryProblem(board);
if (problem) fail(`Board "${board.slug}" can't be restored: ${problem}. Fix data/boards.json first.`);
const BOARD_DIR = path.resolve(DATA_DIR, board.dir || '.');
const BACKUPS = backupsOf(board);
const all = listIn(BACKUPS);

const src = arg === 'latest' ? (all.length ? path.join(BACKUPS, all.at(-1)) : null)
  : fs.existsSync(arg) ? path.resolve(arg) : fs.existsSync(path.join(BACKUPS, arg)) ? path.join(BACKUPS, arg) : null;
if (!src) fail(arg === 'latest' ? `Board "${board.slug}" has no backups yet.` : `No backup called ${arg} for board "${board.slug}". Run npm run restore to list them.`);

// A running board would keep writing to the old database (and overwrite the restore).
// The server writes board.pid in the data folder while it runs (one for all boards): that works whatever port it's on.
// Whether it's stale is decided as the server decides it (src/pidfile.js): a live pid that isn't the board (handed
// out again after a crash) doesn't block a restore forever.
const pidFile = path.join(DATA_DIR, 'board.pid');
if (fs.existsSync(pidFile)) {
  const owner = await otherOwner();
  if (owner) fail(`A board is running (process ${owner.pid}${owner.port ? `, port ${owner.port}` : ''}). Stop it first (Ctrl+C in its window), then run this again.${foreignHint(owner)}`);
  let pid = null; try { pid = JSON.parse(fs.readFileSync(pidFile, 'utf8'))?.pid; } catch {}
  console.log(`  (Ignoring a stale ${path.basename(pidFile)}: process ${pid || '?'} isn't the board.)`);
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
// A consistent copy, including anything still in the backup's write-ahead log (a file copy would miss that).
try {
  const from = new DatabaseSync(src, { readOnly: true });
  try { from.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`); } finally { from.close(); }
} catch (e) { try { fs.rmSync(tmp, { force: true }); } catch {} fail(`Can't copy ${path.basename(src)}: ${e.message}`); }
let kept = null;
const moved = []; // [from, to]: the current board's files, put back if the swap fails
try {
  if (fs.existsSync(db)) {
    kept = `${db}.before-restore-${stamp}`;
    for (const ext of ['', '-wal', '-shm']) if (fs.existsSync(db + ext)) { fs.renameSync(db + ext, kept + ext); moved.push([db + ext, kept + ext]); }
  }
  fs.renameSync(tmp, db);
} catch (e) {
  // Put the old board back as it was (its write-ahead log too: it may hold its latest changes), and leave
  // the copy for a manual fix.
  if (!fs.existsSync(db)) for (const [from, to] of moved.reverse()) { try { fs.renameSync(to, from); } catch {} }
  fail(`Restore failed: ${e.message}. The backup copy is at ${tmp}.`);
}
// A note in the restored board's feed, so nobody wonders why tasks or answers from after the backup are gone.
// Written into the restored database itself (the server is stopped), so it shows when the board starts.
try {
  const d = new DatabaseSync(db);
  try {
    const cols = d.prepare('PRAGMA table_info(events)').all().map((c) => c.name);
    if (cols.includes('author') && cols.includes('text')) {
      const text = `@all The board was restored from a backup made ${when(path.basename(src))} UTC: anything done after that is gone. If your agent looks lost, run /board again.`;
      const row = { ts: Date.now(), author: 'board', kind: 'message', channel: 'general', text, data: JSON.stringify({ mentions: ['all'] }) };
      const use = Object.keys(row).filter((k) => cols.includes(k));
      d.prepare(`INSERT INTO events (${use.join(', ')}) VALUES (${use.map(() => '?').join(', ')})`).run(...use.map((k) => row[k]));
    }
  } finally { d.close(); }
} catch (e) { console.log(`  (Couldn't leave a note in the board's feed: ${e.message})`); }
console.log(`✓ Restored board "${board.slug}" from ${path.basename(src)} (${when(path.basename(src))}).`);
if (kept) console.log(`  The previous board is kept as ${path.basename(kept)}.`);
console.log('  Start the board again: npm start (or npm run tunnel). Agents reconnect by themselves.');
