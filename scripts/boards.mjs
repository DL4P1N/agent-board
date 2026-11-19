#!/usr/bin/env node
// Manage the boards in the data folder (several can be live on one server at once).
//   npm run boards                         list them
//   npm run boards -- new "<name>" [--slug s]   create a board
//   npm run boards -- import <folder> "<name>" [--slug s]   copy a saved board in (board.db + token)
//   npm run boards -- archive <slug>       stop serving it (kept on disk)
//   npm run boards -- restore <slug>       serve it again
//   npm run boards -- default <slug>       serve it at the root address (/, the old links)
//   npm run boards -- delete <slug>        archived boards only: moved to data/trash/, not erased
//   npm run boards -- token <slug>         its links and join command
// While the server runs, changes go through the web page (/boards) instead: the server owns the files.
// BOARD_DATA picks the data folder (default ./data).
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { Registry, boardToken, checkSlug, slugify } from '../src/boards.js';
import { writeTokenFile } from '../src/tokens.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.resolve(process.env.BOARD_DATA || path.join(ROOT, 'data'));
const PORT = Number(process.env.PORT || 4000);

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const slugFlag = flag('slug');
const [cmd = 'list', ...rest] = argv;

const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const ok = (msg) => console.log(`✓ ${msg}`);

// A running server (data/board.pid with a live process) owns the registry.
function serverRunning() {
  try {
    const { pid, port } = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'board.pid'), 'utf8'));
    process.kill(pid, 0);
    return { pid, port };
  } catch { return null; }
}

let reg;
try { reg = new Registry(DATA_DIR); } catch (e) { fail(e.message); }
// The token a board really uses: BOARD_TOKEN for the board it's bound to, else its token file.
const effectiveToken = (b) => (process.env.BOARD_TOKEN && b.slug === reg.envTokenSlug()
  ? { token: process.env.BOARD_TOKEN, from: 'BOARD_TOKEN' }
  : { token: boardToken(reg.dirOf(b)), from: 'file' });
// The tokens boards already use, read without creating any token file: BOARD_TOKEN, and existing files.
const usedTokens = (except) => reg.list().filter((x) => x.slug !== except && !reg.problem(x.slug)).flatMap((x) => {
  const out = [];
  if (process.env.BOARD_TOKEN && x.slug === reg.envTokenSlug()) out.push({ slug: x.slug, token: process.env.BOARD_TOKEN });
  try { const f = path.join(reg.dirOf(x), 'token'); if (fs.existsSync(f)) out.push({ slug: x.slug, token: fs.readFileSync(f, 'utf8').trim() }); } catch {}
  return out;
});
const running = serverRunning();
if (running && cmd !== 'list' && cmd !== 'token') {
  fail(`The server is running (process ${running.pid}, port ${running.port}). Manage boards on its page instead:\n  http://localhost:${running.port}/boards?admin=<the admin token printed when it started, also in ${path.join(DATA_DIR, 'admin-token')}>\nor stop it (Ctrl+C in its window) and run this again.`);
}

const when = (iso) => (iso ? new Date(iso).toLocaleString() : '');
// Every board's canonical address is /b/<slug>; the plain address is only an alias for the default board.
const urlFor = (b) => `http://localhost:${running?.port || PORT}/b/${b.slug}/`;
function counts(b) {
  const file = path.join(reg.dirOf(b), 'board.db');
  if (!fs.existsSync(file)) return 'new';
  try {
    const db = new DatabaseSync(file, { readOnly: true });
    try { const t = db.prepare("SELECT COUNT(*) AS n, SUM(status = 'done') AS d FROM tasks").get(); return `${Number(t.d) || 0}/${Number(t.n) || 0} tasks done`; }
    finally { db.close(); }
  } catch { return '?'; }
}

if (cmd === 'list') {
  const all = reg.list();
  console.log(`Boards in ${DATA_DIR}${running ? `  (server running on port ${running.port})` : ''}:\n`);
  for (const b of all) {
    const tag = b.slug === reg.defaultSlug ? ' (default)' : '';
    const bad = reg.problem(b.slug);
    if (bad) { console.log(`  ✗ ${b.slug}  "${b.name}"  can't be used: ${bad}`); continue; }
    console.log(`  ${b.status === 'live' ? '●' : '○'} ${b.slug}${tag}  "${b.name}"  ${b.status}  ${counts(b)}`);
    console.log(`      ${b.status === 'live' ? urlFor(b) : `archived ${when(b.archived_at)}`}`);
  }
  console.log(`\nnpm run boards -- new "<name>" | import <folder> "<name>" | archive <slug> | restore <slug> | default <slug> | delete <slug> | token <slug>`);
} else if (cmd === 'new') {
  const name = rest.join(' ').trim();
  if (!name) fail('Give the board a name:  npm run boards -- new "KubeCon 2026"');
  let b;
  try { b = reg.create(name, slugFlag); } catch (e) { fail(e.message); }
  boardToken(reg.dirOf(b));
  ok(`Created "${b.name}" (${b.slug}) in ${reg.dirOf(b)}. It's served at ${urlFor(b)} when the server starts.`);
  console.log(`  Links and join command:  npm run boards -- token ${b.slug}`);
} else if (cmd === 'import') {
  const [folder, ...nameParts] = rest;
  const name = nameParts.join(' ').trim();
  if (!folder || !name) fail('Usage:  npm run boards -- import <folder with board.db> "<name>"');
  const src = path.resolve(folder);
  const srcDb = path.join(src, 'board.db');
  if (!fs.existsSync(srcDb)) fail(`${srcDb} doesn't exist. Point at a folder holding a board.db (and its token).`);
  const head = Buffer.alloc(16); const fd = fs.openSync(srcDb, 'r'); fs.readSync(fd, head, 0, 16, 0); fs.closeSync(fd);
  if (head.toString('latin1') !== 'SQLite format 3\0') fail(`${srcDb} isn't a SQLite database.`);
  let b;
  try { b = reg.create(name, slugFlag || slugify(name)); } catch (e) { fail(e.message); }
  const dest = path.join(reg.dirOf(b), 'board.db');
  try {
    // A consistent copy, including anything still in the source's write-ahead log.
    const db = new DatabaseSync(srcDb);
    try { db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`); } finally { db.close(); }
    const check = new DatabaseSync(dest, { readOnly: true });
    try { if (check.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('the copy failed its integrity check'); } finally { check.close(); }
  } catch (e) {
    reg.data.boards = reg.data.boards.filter((x) => x.slug !== b.slug); reg.save();
    try { fs.rmSync(reg.dirOf(b), { recursive: true, force: true }); } catch {}
    fail(`Couldn't import: ${e.message}`);
  }
  const srcToken = path.join(src, 'token');
  // Two boards must never share a token: one board's links and agents could act on the other.
  const old = fs.existsSync(srcToken) ? fs.readFileSync(srcToken, 'utf8').trim() : '';
  const twin = old && usedTokens(b.slug).find((x) => x.token === old);
  if (old && !twin) writeTokenFile(path.join(reg.dirOf(b), 'token'), old); // readable by this user only
  else boardToken(reg.dirOf(b));
  ok(`Imported ${src} as "${b.name}" (${b.slug}). It's served at ${urlFor(b)} when the server starts.`);
  if (twin) console.log(`  The imported board gets a new token; the old one stays with "${twin.slug}".`);
  else if (old) console.log('  It keeps its old token, so links and joins from back then still work.');
} else if (cmd === 'archive' || cmd === 'restore' || cmd === 'default' || cmd === 'delete') {
  const slug = rest[0];
  if (!slug) fail(`Usage:  npm run boards -- ${cmd} <slug>   (see: npm run boards)`);
  try {
    if (cmd === 'archive') { reg.archive(slug); ok(`Archived "${slug}". It stays on disk; restore it with:  npm run boards -- restore ${slug}`); }
    if (cmd === 'restore') { reg.restore(slug); ok(`"${slug}" is live again; it's served when the server starts.`); }
    if (cmd === 'default') { reg.setDefault(slug); ok(`"${slug}" is now the default board, served at the root address (/).`); }
    if (cmd === 'delete') { const r = reg.remove(slug); ok(`Deleted "${slug}" from the list.${r.moved_to ? ` Its files are in ${r.moved_to} if you need them back.` : ' Its folder was already gone.'}`); }
  } catch (e) { fail(e.message); }
} else if (cmd === 'token') {
  const slug = rest[0];
  if (!slug) fail('Usage:  npm run boards -- token <slug>');
  let b; try { b = reg.must(checkSlug(slug)); } catch (e) { fail(e.message); }
  let eff; try { eff = effectiveToken(b); } catch (e) { fail(e.message); }
  const t = eff.token;
  const base = urlFor(b).replace(/\/$/, '');
  console.log(`"${b.name}" (${b.slug})${b.status === 'archived' ? '  — archived: restore it to use these' : ''}${eff.from === 'BOARD_TOKEN' ? '  — token from BOARD_TOKEN' : ''}`);
  console.log(`  Web board:   ${base}/?token=${t}`);
  console.log(`  Teammates:   npm run join -- --url ${base} --token ${t}`);
  console.log('  (On a network or tunnel, swap localhost for the address the server prints.)');
} else {
  fail(`Unknown command "${cmd}". Try: npm run boards`);
}
