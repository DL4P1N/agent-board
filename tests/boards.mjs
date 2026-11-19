// Several boards on one server: separate data and tokens, /b/<slug>/ addresses, the default board at the
// root, the admin API (create, list, archive, restore, default, delete), and the `npm run boards` CLI.
// Starts its own throwaway server. Run all suites with: npm test
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { startBoard, finish, agent, rest, ROOT, TOKEN, tempDir } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const ADMIN = 'admin-test-token-123';
const board = await startBoard({ env: { BOARD_ADMIN_TOKEN: ADMIN } });
const admin = (p, method = 'GET', body, token = ADMIN) => fetch(`${board.base}/api/admin${p}`, {
  method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const at = (slug, token) => ({ base: `${board.base}/b/${slug}`, token });

// ---- the default board, as before ----
const st0 = await rest(board, 'dana', '/state');
check('default board still works at the root (/api/state)', Array.isArray(st0.tasks) && st0.board?.slug === 'main' && st0.board?.default === true, JSON.stringify(st0.board));
check('the default board\'s join command uses its canonical /b/main address', st0.setup.join_commands.every((c) => /\/b\/main /.test(c.command)), st0.setup.join_commands[0].command);
check('registry written with the legacy board "main" in the data folder itself', JSON.parse(fs.readFileSync(path.join(board.dataDir, 'boards.json'), 'utf8')).boards[0].dir === '.');

// ---- admin auth ----
check('admin API needs the admin token', (await admin('/boards', 'GET', undefined, null)).status === 401);
check('a board token is not an admin token', (await admin('/boards', 'GET', undefined, TOKEN)).status === 401);
check('?admin= is not accepted by the API (header or Bearer only)', (await fetch(`${board.base}/api/admin/boards?admin=${ADMIN}`)).status === 401);
check('X-Admin-Token header works', (await fetch(`${board.base}/api/admin/boards`, { headers: { 'X-Admin-Token': ADMIN } })).status === 200);
const list0 = (await admin('/boards')).body;
check('list: one live default board', list0.length === 1 && list0[0].slug === 'main' && list0[0].default && list0[0].status === 'live', JSON.stringify(list0));

// ---- create a second board ----
const bad = await admin('/boards', 'POST', { name: 'Bad', slug: 'Not OK!' });
check('slug validation: bad slug refused', bad.status === 400 && /lowercase/.test(bad.body.error), bad.body?.error);
check('slug validation: reserved names refused', (await admin('/boards', 'POST', { name: 'x', slug: 'api' })).status === 400);
const made = await admin('/boards', 'POST', { name: 'KubeCon 2026!' });
check('create: slug from the name, links, token, join command, viewer link', made.status === 200 && made.body.slug === 'kubecon-2026' && made.body.token && /\/b\/kubecon-2026 --token /.test(made.body.join_command) && /\/b\/kubecon-2026\/present\.html\?token=view-/.test(made.body.viewer_url), JSON.stringify(made.body));
check('create: duplicate name refused', (await admin('/boards', 'POST', { name: 'KubeCon 2026' })).status === 400);
check('the new board has its own folder under boards/', fs.existsSync(path.join(board.dataDir, 'boards', 'kubecon-2026', 'board.db')));
const K = at('kubecon-2026', made.body.token);

// ---- two live boards at once, separate ----
const stK = await rest(K, 'dana', '/state');
check('second board serves /b/<slug>/api/state with its own token', Array.isArray(stK.tasks) && stK.board?.slug === 'kubecon-2026' && stK.board?.default === false, JSON.stringify(stK.board));
check('its setup join commands carry /b/<slug>', stK.setup.join_commands.every((c) => /\/b\/kubecon-2026 --token /.test(c.command) && /\/b\/kubecon-2026\/\?token=/.test(c.web_url)), stK.setup.join_commands[0].command);
await rest(K, 'dana', '/tasks', 'POST', { title: 'only on kubecon' });
await rest(board, 'dana', '/tasks', 'POST', { title: 'only on main' });
const tm = (await rest(board, 'dana', '/state')).tasks.map((t) => t.title);
const tk = (await rest(K, 'dana', '/state')).tasks.map((t) => t.title);
check('a task on one board doesn\'t show on the other', tm.includes('only on main') && !tm.includes('only on kubecon') && tk.includes('only on kubecon') && !tk.includes('only on main'), `${tm} | ${tk}`);
const cross1 = await fetch(`${K.base}/api/state`, { headers: { Authorization: `Bearer ${TOKEN}` } });
const cross2 = await fetch(`${board.base}/api/state`, { headers: { Authorization: `Bearer ${made.body.token}` } });
const cross2b = await cross2.json().catch(() => ({}));
check('tokens don\'t cross boards (another board\'s token at the root only gets "moved" and its address)', cross1.status === 401 && cross2.status === 409 && cross2b.moved_to === `/b/${made.body.slug}` && !cross2b.tasks, `${cross1.status} ${cross2.status} ${JSON.stringify(cross2b)}`);
check('the admin token isn\'t a board token', (await fetch(`${K.base}/api/state`, { headers: { Authorization: `Bearer ${ADMIN}` } })).status === 401);
const ka = await agent({ base: K.base, token: agentTokenFor(made.body.token) }, 'kia-claude');
const ks = await ka('board_status');
check('an MCP agent connects at /b/<slug>/mcp and sees that board', typeof ks?.next_action === 'string' && (await rest(K, 'dana', '/state')).presence.some((p) => p.name === 'kia-claude'), JSON.stringify(ks).slice(0, 100));
check('... and doesn\'t show up on the default board', !(await rest(board, 'dana', '/state')).presence.some((p) => p.name === 'kia-claude'));
const page = await fetch(`${K.base}/?token=${made.body.token}`);
check('the web board is served at /b/<slug>/', page.status === 200 && /<html/i.test(await page.text()));
const pres = await fetch(`${K.base}/present.html`);
check('the presenter view is served at /b/<slug>/present.html', pres.status === 200);
check('an unknown board gives 404', (await fetch(`${board.base}/b/nope/api/state`)).status === 404);
const list1 = (await admin('/boards')).body;
const k1 = list1.find((b) => b.slug === 'kubecon-2026');
check('list: counts for live boards', k1 && k1.tasks === 1 && k1.agents_online === 1 && k1.status === 'live' && !k1.default, JSON.stringify(k1));
const open = await admin('/boards/kubecon-2026/open');
check('open: a link with the board token', open.status === 200 && open.body.url.includes(`/b/kubecon-2026/?token=${made.body.token}`), JSON.stringify(open.body));

// ---- archive / restore ----
check('the default board can\'t be archived', (await admin('/boards/main/archive', 'POST')).status === 400);
const arch = await admin('/boards/kubecon-2026/archive', 'POST');
check('archive', arch.status === 200 && arch.body.status === 'archived' && arch.body.tasks === 1, JSON.stringify(arch.body));
const gone = await fetch(`${K.base}/api/state`, { headers: { Authorization: `Bearer ${made.body.token}` } });
check('an archived board\'s API answers 410', gone.status === 410 && /archived/.test((await gone.json()).error));
const goneMcp = await fetch(`${K.base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
check('... and its MCP endpoint too', goneMcp.status === 410);
const gonePage = await fetch(`${K.base}/`);
check('... and its page says it\'s archived', gonePage.status === 410 && /archived/i.test(await gonePage.text()));
check('archived boards are still listed (counts read from the file)', (await admin('/boards')).body.find((b) => b.slug === 'kubecon-2026')?.tasks === 1);
check('a live board can\'t be deleted', (await admin('/boards/main', 'DELETE')).status === 400);
const rest1 = await admin('/boards/kubecon-2026/restore', 'POST');
check('restore: served again, data kept', rest1.status === 200 && (await rest(K, 'dana', '/state')).tasks.some((t) => t.title === 'only on kubecon'));

// ---- default ----
const def = await admin('/boards/kubecon-2026/default', 'POST');
const rootNow = await fetch(`${board.base}/api/state`, { headers: { Authorization: `Bearer ${made.body.token}` } }).then((r) => r.json());
check('default: the new default board is served at the root at once', def.status === 200 && rootNow.board?.slug === 'kubecon-2026' && rootNow.tasks.some((t) => t.title === 'only on kubecon'), JSON.stringify(rootNow.board));
check('... its join commands keep its canonical /b/ address', rootNow.setup.join_commands.every((c) => /\/b\/kubecon-2026 /.test(c.command)));
const oldRoot = await fetch(`${board.base}/api/state`, { headers: { Authorization: `Bearer ${TOKEN}` } });
const oldRootBody = await oldRoot.json().catch(() => ({}));
check('the old default\'s token at the root: 409 "moved" to /b/main', oldRoot.status === 409 && oldRootBody.moved_to === '/b/main', `${oldRoot.status} ${JSON.stringify(oldRootBody)}`);
const mainNow = await fetch(`${board.base}/b/main/api/state`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then((r) => r.json());
check('... and the old default is at /b/main', mainNow.board?.slug === 'main' && mainNow.tasks.some((t) => t.title === 'only on main') && mainNow.setup.join_commands.every((c) => /\/b\/main --token/.test(c.command)));
await admin('/boards/main/default', 'POST');

// ---- delete (archived only, moved to trash) ----
await admin('/boards/kubecon-2026/archive', 'POST');
const del = await admin('/boards/kubecon-2026', 'DELETE');
check('delete an archived board: moved to trash, not erased', del.status === 200 && fs.existsSync(path.join(del.body.moved_to, 'board.db')) && del.body.moved_to.includes(path.join(board.dataDir, 'trash')), JSON.stringify(del.body));
check('... and gone from the list', !(await admin('/boards')).body.some((b) => b.slug === 'kubecon-2026'));

// ---- the CLI, with the server stopped ----
await admin('/boards', 'POST', { name: 'Second' });
await board.stop();
const cli = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'boards.mjs'), ...a], { env: { ...process.env, BOARD_DATA: board.dataDir, PORT: String(board.port) }, encoding: 'utf8' });
const l = cli('list');
check('cli list shows the boards', l.status === 0 && /main \(default\)/.test(l.stdout) && /second/.test(l.stdout), l.stdout + l.stderr);
const n = cli('new', 'Next Event');
check('cli new', n.status === 0 && /next-event/.test(n.stdout) && fs.existsSync(path.join(board.dataDir, 'boards', 'next-event', 'token')), n.stdout + n.stderr);
// A saved board folder (board.db + token) to import, like test-data/kubecon-2026.
const saved = tempDir('agent-board-saved-');
for (const f of ['board.db', 'board.db-wal', 'board.db-shm']) if (fs.existsSync(path.join(board.dataDir, f))) fs.copyFileSync(path.join(board.dataDir, f), path.join(saved, f));
fs.writeFileSync(path.join(saved, 'token'), 'savedtok');
const imp = cli('import', saved, 'Old Event');
check('cli import keeps the data and the token', imp.status === 0 && fs.readFileSync(path.join(board.dataDir, 'boards', 'old-event', 'token'), 'utf8') === 'savedtok', imp.stdout + imp.stderr);
check('cli import refuses a non-database', (() => { const d = tempDir('cb-bad-'); fs.writeFileSync(path.join(d, 'board.db'), 'nope'); return cli('import', d, 'Bad One').status === 1; })());
const a = cli('archive', 'second');
check('cli archive', a.status === 0 && JSON.parse(fs.readFileSync(path.join(board.dataDir, 'boards.json'), 'utf8')).boards.find((b) => b.slug === 'second').status === 'archived', a.stdout + a.stderr);
check('cli refuses to archive the default board', cli('archive', 'main').status === 1);
const tok = cli('token', 'old-event');
check('cli token prints the link and join command', /\/b\/old-event\/\?token=savedtok/.test(tok.stdout) && /join -- --url .*\/b\/old-event --token savedtok/.test(tok.stdout), tok.stdout);

// ---- the server picks up the registry on start ----
await board.relaunch();
const oldSt = await fetch(`${board.base}/b/old-event/api/state`, { headers: { Authorization: 'Bearer savedtok' } }).then((r) => r.json());
const nextStatus = (await fetch(`${board.base}/b/next-event/api/state`)).status;
check('after a restart, imported and new boards are served', oldSt.board?.slug === 'old-event' && oldSt.tasks?.some((t) => t.title === 'only on main') && nextStatus === 401, `${JSON.stringify(oldSt.board)} ${oldSt.tasks?.map((t) => t.title)} next=${nextStatus}`);
check('archived boards stay archived after a restart', (await fetch(`${board.base}/b/second/api/state`)).status === 410);
check('cli refuses changes while the server runs (except list)', (() => { const r = cli('new', 'While Running'); return r.status === 1 && /running/i.test(r.stderr); })());
check('cli list works while the server runs', cli('list').status === 0);

// ================= regressions from the multi-board review =================
// 1. Archiving while a long-poll waits must not crash the server.
await admin('/boards', 'POST', { name: 'Poll' });
const pollTok = (await admin('/boards/poll/open')).body.token;
// The polls must really be waiting on the server when it's archived: one agent may hold WAITS open waits, so
// once WAITS polls are open a further one is refused (429), and that proves they are all registered.
const WAITS = Number(process.env.BOARD_WAITS_AGENT || 20);
const poll = (wait) => fetch(`${board.base}/b/poll/api/events?since=999999&wait=${wait}`, { headers: { Authorization: `Bearer ${pollTok}`, 'X-Agent': 'poller' } });
const polls = Array.from({ length: WAITS }, () => poll(20).then((r) => ({ status: r.status, at: Date.now() })).catch((e) => ({ status: `error ${e.message}`, at: Date.now() })));
let allWaiting = false;
for (const t0 = Date.now(); !allWaiting && Date.now() - t0 < 10e3;) allWaiting = (await poll(1).then((r) => r.status).catch(() => 0)) === 429;
const archivedAt = Date.now();
const archPoll = await admin("/boards/poll/archive", "POST");
const ended = await Promise.all(polls);
const health = await fetch(`${board.base}/health`).then((r) => r.json()).catch(() => null);
check('archiving a board with pending long-polls: they end at once with 410, the server stays up', allWaiting && archPoll.status === 200 && ended.every((p) => p.status === 410 && p.at >= archivedAt && p.at - archivedAt < 5e3) && health?.ok === true, `waiting ${allWaiting}, archive ${archPoll.status}, polls ${[...new Set(ended.map((p) => `${p.status} after ${p.at - archivedAt}ms`))].join(', ')}, health ${JSON.stringify(health)}`);
check('... and the other boards keep working', (await rest(board, 'dana', '/state')).board?.slug === 'main');

// 2. BOARD_TOKEN stays with its board across a default switch + restart.
await admin('/boards/old-event/default', 'POST');
await board.relaunch();
const mainByEnv = (await fetch(`${board.base}/b/main/api/state`, { headers: { Authorization: `Bearer ${TOKEN}` } })).status;
const oldByEnv = (await fetch(`${board.base}/b/old-event/api/state`, { headers: { Authorization: `Bearer ${TOKEN}` } })).status;
const oldByOwn = (await fetch(`${board.base}/b/old-event/api/state`, { headers: { Authorization: 'Bearer savedtok' } })).status;
check('BOARD_TOKEN stays with "main" after another board became the default and the server restarted', mainByEnv === 200 && oldByEnv === 401 && oldByOwn === 200, `main ${mainByEnv}, old-event with BOARD_TOKEN ${oldByEnv}, with its own ${oldByOwn}`);
await admin('/boards/main/default', 'POST');
{
  // Without an original board in the data folder: the first default is remembered, not the current one.
  const { Registry } = await import('../src/boards.js');
  const d = tempDir('cb-reg-');
  fs.writeFileSync(path.join(d, 'boards.json'), JSON.stringify({ default: 'a', boards: [{ slug: 'a', name: 'A', dir: 'boards/a', status: 'live' }, { slug: 'b', name: 'B', dir: 'boards/b', status: 'live' }] }));
  const r1 = new Registry(d); const first = r1.envTokenSlug(); r1.setDefault('b');
  const r2 = new Registry(d);
  check('BOARD_TOKEN\'s board is remembered in boards.json (no original board)', first === 'a' && r2.envTokenSlug() === 'a' && r2.defaultSlug === 'b');
}

// 3. Import never duplicates a token; two boards with one token are refused at start.
await board.stop();
const dupSrc = tempDir('cb-dup-');
fs.copyFileSync(path.join(saved, 'board.db'), path.join(dupSrc, 'board.db'));
fs.writeFileSync(path.join(dupSrc, 'token'), TOKEN); // main's token (BOARD_TOKEN)
// (The CLI sees BOARD_TOKEN like the server does, as in a Docker or shell setup that exports it.)
const dupImp = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'boards.mjs'), 'import', dupSrc, 'Dup Copy'], { env: { ...process.env, BOARD_DATA: board.dataDir, PORT: String(board.port), BOARD_TOKEN: TOKEN }, encoding: 'utf8' });
const dupTok = fs.readFileSync(path.join(board.dataDir, 'boards', 'dup-copy', 'token'), 'utf8').trim();
check('import of a folder whose token another board uses: gets a new token, and says so', dupImp.status === 0 && dupTok !== TOKEN && /new token/.test(dupImp.stdout), dupImp.stdout + dupImp.stderr);
fs.writeFileSync(path.join(board.dataDir, 'boards', 'dup-copy', 'token'), 'savedtok'); // force a clash with old-event
// 5. A corrupt database on one board.
fs.writeFileSync(path.join(board.dataDir, 'boards', 'next-event', 'board.db'), 'this is not a database');
for (const f of ['board.db-wal', 'board.db-shm']) fs.rmSync(path.join(board.dataDir, 'boards', 'next-event', f), { force: true });
await board.relaunch();
const listNow = (await admin('/boards')).body || [];
const corrupt = await fetch(`${board.base}/b/next-event/api/state`, { headers: { Authorization: 'Bearer x' } });
check('a board with a corrupt database: 503, shown as failed, the server and other boards still up', corrupt.status === 503 && listNow.find((b) => b.slug === 'next-event')?.status === 'failed' && (await fetch(`${board.base}/health`)).ok && (await rest(board, 'dana', '/state')).board?.slug === 'main', `${corrupt.status} ${JSON.stringify(listNow.find((b) => b.slug === 'next-event'))}`);
const twinRow = listNow.find((b) => ['dup-copy', 'old-event'].includes(b.slug) && b.status === 'failed');
check('two boards with the same token: only one is served, the other is failed', !!twinRow && /same token/.test(twinRow.error || ''), JSON.stringify(listNow.filter((b) => ['dup-copy', 'old-event'].includes(b.slug))));
const mkDefault = await admin('/boards/next-event/default', 'POST');
check('a failed board can\'t become the default', mkDefault.status >= 400 && JSON.parse(fs.readFileSync(path.join(board.dataDir, 'boards.json'), 'utf8')).default === 'main');
// Restoring an archived board whose database is broken rolls back.
fs.writeFileSync(path.join(board.dataDir, 'boards', 'second', 'board.db'), 'broken too, not a database at all');
for (const f of ['board.db-wal', 'board.db-shm']) fs.rmSync(path.join(board.dataDir, 'boards', 'second', f), { force: true });
const rest2 = await admin('/boards/second/restore', 'POST');
check('restore that fails to open: error, and the board stays archived', rest2.status >= 400 && JSON.parse(fs.readFileSync(path.join(board.dataDir, 'boards.json'), 'utf8')).boards.find((b) => b.slug === 'second').status === 'archived', `${rest2.status} ${JSON.stringify(rest2.body)}`);

// 7. Registry entries are checked; delete reports moved_to only when a folder moved.
await board.stop();
const regFile = path.join(board.dataDir, 'boards.json');
const goodReg = fs.readFileSync(regFile, 'utf8');
const evil = JSON.parse(goodReg); evil.boards.push({ slug: 'evil', name: 'Evil', dir: '../../somewhere', status: 'archived' });
fs.writeFileSync(regFile, JSON.stringify(evil));
const evilList = cli('list');
check('a registry entry pointing outside the data folder is flagged, not used', evilList.status === 0 && /evil.*can't be used/.test(evilList.stdout), evilList.stdout);
check('... and can\'t be deleted (its folder is never touched)', cli('delete', 'evil').status === 1);
fs.writeFileSync(regFile, goodReg);
fs.rmSync(path.join(board.dataDir, 'boards', 'second'), { recursive: true, force: true });
const delGone = cli('delete', 'second');
check('delete of a board whose folder is already gone: no made-up moved_to', delGone.status === 0 && !/files are in /.test(delGone.stdout), delGone.stdout);

// 4. A corrupt boards.json is never replaced.
fs.writeFileSync(regFile, '{ "default": "main", "boards": [ oops');
const corruptCli = cli('list');
check('cli with a corrupt boards.json: a clear error, the file untouched', corruptCli.status === 1 && /not valid JSON/.test(corruptCli.stderr) && fs.readFileSync(regFile, 'utf8').includes('oops'), corruptCli.stderr);
const srv = spawnSync(process.execPath, [path.join(ROOT, 'src', 'server.js')], { env: { ...process.env, BOARD_DATA: board.dataDir, PORT: String(board.port), BOARD_TOKEN: TOKEN, BOARD_NO_JOIN: '1' }, encoding: 'utf8', timeout: 15000 });
check('server with a corrupt boards.json: exits with a clear error, the file untouched', srv.status === 1 && /not valid JSON/.test(srv.stderr) && fs.readFileSync(regFile, 'utf8').includes('oops'), `${srv.status} ${srv.stderr.slice(-200)}`);
check('a backup of the previous registry exists (boards.json.bak)', fs.existsSync(`${regFile}.bak`) && JSON.parse(fs.readFileSync(`${regFile}.bak`, 'utf8')).boards.length > 0);
fs.writeFileSync(regFile, goodReg);
board.child = null;

await finish(R, { board });
