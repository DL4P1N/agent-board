// Backups and restore, the parts a live board can't easily show: old backups are pruned to the newest 24 (and
// nothing else in backups/ is touched), and a restore whose swap fails part-way puts the current board.db, its
// write-ahead log and shared-memory file back as they were. No board needed. Run all suites with: npm test
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { finish, ROOT, tempDir, freePort } from './helpers.mjs';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BACKUP = /^board-\d{8}-\d{6}\.db$/;

try {
  // ================= backup pruning =================
  // startBackups takes its timers as arguments, so the backup runs when the test says. The interval is read
  // when the module loads: 10 minutes here, then 0 (off) through a second copy of the module.
  delete process.env.BOARD_BACKUP_SECONDS;
  process.env.BOARD_BACKUP_MINUTES = '10';
  const { startBackups } = await import('../src/backup.js');
  const dir = tempDir('backups-');
  const db = new DatabaseSync(path.join(dir, 'board.db'));
  db.exec('CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT, updated_at INTEGER); CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT); CREATE TABLE questions (id INTEGER PRIMARY KEY, answered_at INTEGER);');
  db.exec("INSERT INTO tasks (title, updated_at) VALUES ('Login form', 1)");
  const board = { db, latestEventId: () => 7 };
  const bdir = path.join(dir, 'backups');
  fs.mkdirSync(bdir);
  // 30 older backups (oldest first by name), and files that only look a bit like one: those are never deleted.
  const old = Array.from({ length: 30 }, (_, i) => `board-20200101-0000${String(i).padStart(2, '0')}.db`);
  for (const f of old) fs.writeFileSync(path.join(bdir, f), 'old');
  const others = ['board.db.before-restore-x', 'notes.txt', 'board-2020.db', 'board-20200101-000000.db.bak'];
  for (const f of others) fs.writeFileSync(path.join(bdir, f), 'keep');
  const timers = [];
  startBackups({ board, dir, slug: 'main', every: (fn, ms) => timers.push({ kind: 'every', fn, ms }), later: (fn, ms) => timers.push({ kind: 'later', fn, ms }) });
  check('backups are scheduled: the first within 30 s, then every 10 minutes', timers.length === 2 && timers.find((t) => t.kind === 'later')?.ms === 30e3 && timers.find((t) => t.kind === 'every')?.ms === 600e3, JSON.stringify(timers.map((t) => [t.kind, t.ms])));
  const run = timers[0].fn;
  const backups = () => fs.readdirSync(bdir).filter((f) => BACKUP.test(f)).sort();
  run();
  let now = backups();
  const first = now.find((f) => !old.includes(f));
  check('a backup run keeps the newest 24 backups: the 7 oldest are deleted', now.length === 24 && !!first && now.at(-1) === first && old.slice(0, 7).every((f) => !now.includes(f)) && old.slice(7).every((f) => now.includes(f)), now.join(' '));
  const gone = others.filter((f) => { try { return fs.readFileSync(path.join(bdir, f), 'utf8') !== 'keep'; } catch { return true; } });
  check('…and nothing else in backups/ is touched', !gone.length, gone.join(' '));
  let n = -1;
  try { const x = new DatabaseSync(path.join(bdir, first), { readOnly: true }); n = x.prepare('SELECT COUNT(*) AS n FROM tasks').get().n; x.close(); } catch {}
  check('the new backup opens and has the board\'s tasks', n === 1, String(n));
  await sleep(1100); // the next backup would get a new name (one per second)
  run();
  check('nothing changed: no new backup, nothing more pruned', backups().join() === now.join(), backups().join(' '));
  db.exec("UPDATE tasks SET updated_at = 2"); await sleep(50);
  run();
  const after = backups();
  check('a change makes a new backup and prunes the next oldest, still 24', after.length === 24 && after.includes(first) && !after.includes(old[7]) && after.includes(old[8]) && after.filter((f) => !old.includes(f)).length === 2, after.join(' '));
  // A VACUUM INTO that fails part-way (a full disk) leaves no partial board-*.db behind.
  await sleep(1100);
  db.exec('UPDATE tasks SET updated_at = 3');
  const realExec = db.exec.bind(db);
  db.exec = (sql) => {
    const m = /^VACUUM INTO '(.+)'$/.exec(sql);
    if (!m) return realExec(sql);
    fs.writeFileSync(m[1].replace(/''/g, "'"), 'partial');
    throw new Error('database or disk is full');
  };
  const log = console.error; let logged = '';
  console.error = (...a) => { logged += a.join(' '); };
  try { run(); } finally { console.error = log; db.exec = realExec; }
  const leftovers = fs.readdirSync(bdir).filter((f) => !after.includes(f) && !others.includes(f) && f !== '.last');
  check('a failed backup leaves no partial file (none counted among the 24, no temp file)', /disk is full/.test(logged) && backups().join() === after.join() && !leftovers.length, leftovers.join(' ') || logged);
  run();
  const retried = backups().filter((f) => !after.includes(f));
  check('…and the next run makes it', retried.length === 1 && backups().length === 24, backups().join(' '));
  process.env.BOARD_BACKUP_MINUTES = '0';
  const off = await import('../src/backup.js?off');
  const none = [];
  off.startBackups({ board, dir, slug: 'main', every: () => none.push('every'), later: () => none.push('later') });
  check('BOARD_BACKUP_MINUTES=0 turns backups off', none.length === 0, none.join());
  db.close();

  // ================= restore rollback =================
  // The restore runs with renameSync made to fail on one file, as Windows does when another program holds it.
  const work = tempDir('restore-rollback-');
  const preload = path.join(work, 'fail-rename.mjs');
  fs.writeFileSync(preload, [
    "import fs from 'node:fs';",
    'const real = fs.renameSync; const re = new RegExp(process.env.FAIL_RENAME_FROM);',
    "fs.renameSync = (from, to) => { if (re.test(String(from))) { const e = new Error(`EPERM: operation not permitted (injected), rename '${from}'`); e.code = 'EPERM'; throw e; } return real(from, to); };",
  ].join('\n'));
  const backupFile = path.join(work, 'board-20260101-000000.db');
  const b = new DatabaseSync(backupFile); b.exec("CREATE TABLE t (x); INSERT INTO t VALUES ('from the backup');"); b.close();
  const port = await freePort();
  const FILES = { 'board.db': 'current board', 'board.db-wal': 'its latest changes', 'board.db-shm': 'its shared memory' };
  for (const [label, failOn] of [['the last step (copy into place)', 'restoring-'], ['moving the write-ahead log aside', 'board\\.db-wal$'], ['moving the shared-memory file aside', 'board\\.db-shm$']]) {
    const data = tempDir('restore-rollback-data-');
    for (const [f, text] of Object.entries(FILES)) fs.writeFileSync(path.join(data, f), text);
    const rs = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, path.join(ROOT, 'scripts', 'restore.mjs'), backupFile], {
      encoding: 'utf8', env: { ...process.env, BOARD_DATA: data, PORT: String(port), FAIL_RENAME_FROM: failOn },
    });
    const left = fs.readdirSync(data).sort();
    const same = Object.entries(FILES).every(([f, text]) => { try { return fs.readFileSync(path.join(data, f), 'utf8') === text; } catch { return false; } });
    const copy = left.find((f) => /^board\.db\.restoring-/.test(f));
    check(`a restore that fails at ${label} says so (exit 1)`, rs.status === 1 && /Restore failed: EPERM/.test(rs.stderr), `${rs.status} ${rs.stdout}${rs.stderr}`);
    check(`…and board.db, its WAL and SHM are back, unchanged (failed at ${label})`, same && !left.some((f) => /before-restore/.test(f)), left.join(' '));
    check(`…and the backup copy is left for a manual fix, where the message says (failed at ${label})`, !!copy && rs.stderr.includes(copy), `${left.join(' ')} | ${rs.stderr}`);
  }
} catch (e) {
  R.push(`CRASH ${e.stack || e}`);
}
await finish(R);
