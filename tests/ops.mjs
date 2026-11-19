// Operations: webhook notifications (Slack / Discord / ntfy / generic), automatic backups +
// `npm run restore`, and token rotation. Starts its own throwaway boards and a fake webhook server.
// Run all suites with: npm test
import fs from 'node:fs';
import http from 'node:http';
import zlib from 'node:zlib';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { startBoard, finish, agent, ROOT, tempDir, freePort, killTree, exited } from './helpers.mjs';
import { agentTokenFor, newBoardToken } from '../src/tokens.js';
import { internalError } from '../src/http-util.js';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 6000) => { for (const t0 = Date.now(); Date.now() - t0 < ms;) { const v = await fn(); if (v) return v; await sleep(100); } return null; };

// ---- a fake webhook receiver ----
const got = [];
const hook = http.createServer((req, res) => {
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => {
    got.push({ url: req.url, headers: req.headers, body });
    if (req.url.includes('redirect')) { res.writeHead(307, { Location: 'http://127.0.0.1:1/internal' }); return res.end(); }
    res.writeHead(200); res.end('ok');
  });
});
await new Promise((r) => hook.listen(0, '127.0.0.1', r));
const HOOK = `http://localhost:${hook.address().port}`;
const json = (g) => { try { return JSON.parse(g.body); } catch { return null; } };

const board = await startBoard({ env: { BOARD_BACKUP_SECONDS: '1', BOARD_WEBHOOK_LOCALHOST: '1' } });
const call = (p, method = 'GET', body, token = board.token) => fetch(`${board.base}/api${p}`, {
  method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Agent': 'dana' }, body: body && JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const AGENT = agentTokenFor(board.token);

// ================= notifications =================
let r = await call('/notify');
check('GET /api/notify: nothing set yet, default events', r.status === 200 && r.body.url === null && r.body.kind === null && ['questions', 'main', 'blocked', 'conflict', 'freeze', 'limit'].every((e) => r.body.events.includes(e)), JSON.stringify(r));
check('agent token can\'t read the webhook (GET 403)', (await call('/notify', 'GET', undefined, AGENT)).status === 403);
check('agent token can\'t set the webhook (PUT 403)', (await call('/notify', 'PUT', { url: `${HOOK}/x` }, AGENT)).status === 403);
r = await call('/notify', 'PUT', { url: 'http://hooks.example.com/abc' });
check('plain http (not localhost) is refused', r.status === 400 && /https/.test(r.body.error), JSON.stringify(r));
r = await call('/notify', 'PUT', { url: 'not a url' });
check('a non-URL is refused', r.status === 400, JSON.stringify(r));
r = await call('/notify/test', 'POST');
check('test without a webhook says to set one', r.status === 200 && r.body.ok === false && /Set a webhook/.test(r.body.error), JSON.stringify(r));

const shapes = async (kind) => {
  await call('/notify', 'PUT', { url: `${HOOK}/hook/secretpart-${kind}?kind=${kind}` });
  const n = got.length;
  const t = await call('/notify/test', 'POST');
  const g = await until(() => got.length > n && got.at(-1));
  return { t, g };
};
let s = await shapes('slack');
check('Slack: {text} with the board link', s.t.body.ok && /Test from Agent Board/.test(json(s.g)?.text) && /\nhttps?:\/\/\S+:\d+\/b\/main$/.test(json(s.g)?.text), JSON.stringify(s));
check('Slack: no token in the link', !String(s.g?.body).includes(board.token));
r = await call('/notify');
check('GET shows the kind and a masked URL', r.body.kind === 'slack' && /^http:\/\/localhost:\d+\/…/.test(r.body.url) && !r.body.url.includes('secretpart'), JSON.stringify(r.body));
s = await shapes('discord');
check('Discord: {content}', s.t.body.ok && /Test from Agent Board/.test(json(s.g)?.content) && json(s.g)?.text === undefined, s.g?.body);
s = await shapes('ntfy');
check('ntfy: plain text body with Title + Tags headers', s.t.body.ok && /^Test from Agent Board/.test(s.g?.body) && s.g?.headers.title === 'Agent Board' && !!s.g?.headers.tags, JSON.stringify(s.g?.headers));
s = await shapes('generic');
check('generic: {text, kind, board, url}', s.t.body.ok && json(s.g)?.board === 'claude-board' && json(s.g)?.kind === 'test' && /Test from/.test(json(s.g)?.text) && /^https?:\/\//.test(json(s.g)?.url), s.g?.body);
r = await call('/notify/test', 'POST');
await call('/notify', 'PUT', { url: 'http://localhost:1/dead?kind=generic' });
r = await call('/notify/test', 'POST');
check('a failing webhook reports ok:false with an error', r.status === 200 && r.body.ok === false && !!r.body.error, JSON.stringify(r.body));

// Triggers (generic format).
await call('/notify', 'PUT', { url: `${HOOK}/events?kind=generic` });
const since = () => got.length;
const texts = (from) => got.slice(from).map((g) => json(g)?.text || '');
const ana = await agent(board, 'ana-claude');
await ana('board_status');
let n0 = since();
await ana('ask_human', { question: 'Which colour for the logo?' });
check('a question to humans is sent ("<agent> asks: …")', !!(await until(() => texts(n0).some((t) => /ana-claude asks: Which colour for the logo\?/.test(t)))), JSON.stringify(texts(n0)));
n0 = since();
await ana('ask_human', { question: 'Which colour for the logo?' });
await sleep(800);
check('the same text within a minute is sent once (debounce)', !texts(n0).some((t) => /Which colour/.test(t)), JSON.stringify(texts(n0)));
await call('/settings', 'PUT', { goal: 'A test app.' });
const t1 = await call('/tasks', 'POST', { title: 'Login form' });
await ana('claim_task', { id: t1.body.id });
n0 = since();
await ana('update_task', { id: t1.body.id, status: 'blocked', note: 'need the OAuth client id' });
check('a blocked task is sent with its note', !!(await until(() => texts(n0).some((t) => new RegExp(`#${t1.body.id} blocked: need the OAuth client id`).test(t)))), JSON.stringify(texts(n0)));
n0 = since();
await call('/agents/ana-claude', 'PATCH', { limited: true, note: 'weekly cap' });
check('an agent marked out of usage is sent', !!(await until(() => texts(n0).some((t) => /ana-claude hit its usage limit/.test(t)))), JSON.stringify(texts(n0)));
await call('/agents/ana-claude', 'PATCH', { limited: false });
// Only the chosen events.
r = await call('/notify', 'PUT', { events: ['questions'] });
check('events can be narrowed', JSON.stringify(r.body.events) === '["questions"]', JSON.stringify(r.body));
n0 = since();
await ana('update_task', { id: t1.body.id, status: 'in_progress' });
await ana('update_task', { id: t1.body.id, status: 'blocked', note: 'still waiting on the id' });
await sleep(800);
check('an event that\'s turned off isn\'t sent', !texts(n0).some((t) => /blocked/.test(t)), JSON.stringify(texts(n0)));
r = await call('/notify', 'PUT', { url: '' });
check('clearing the URL turns notifications off', r.body.url === null && r.body.kind === null);
check('settings never show the webhook to agents', !JSON.stringify((await call('/state', 'GET', undefined, AGENT)).body.settings).includes('notify'));

// ================= backups + restore =================
const bdir = path.join(board.dataDir, 'backups');
const file = await until(() => fs.existsSync(bdir) && fs.readdirSync(bdir).filter((f) => /^board-\d{8}-\d{6}\.db$/.test(f)).sort().at(-1), 8000);
check('a backup appears in data/backups', !!file, String(file));
if (file) {
  const db = new DatabaseSync(path.join(bdir, file), { readOnly: true });
  const n = db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n; db.close();
  check('the backup opens and has the tasks', n >= 1, String(n));
}
await sleep(2500);
const count1 = fs.readdirSync(bdir).length; await sleep(2200);
check('no new backup while nothing changes', fs.readdirSync(bdir).length === count1, `${count1} → ${fs.readdirSync(bdir).length}`);
const restore = (arg) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'restore.mjs'), ...(arg ? [arg] : [])], { encoding: 'utf8', env: { ...process.env, BOARD_DATA: board.dataDir, PORT: String(board.port) } });
let rs = restore();
check('npm run restore lists the backups', rs.status === 0 && /Backups in/.test(rs.stdout) && rs.stdout.includes(file || '?'), rs.stdout + rs.stderr);
rs = restore('latest');
check('restore refuses while the board runs', rs.status === 1 && /is running|running on port/.test(rs.stderr), rs.stdout + rs.stderr);
// Something after the backup that the restore should roll back: pick the backup first, then add a task.
const latestBackup = fs.readdirSync(bdir).filter((f) => /^board-\d{8}-\d{6}\.db$/.test(f)).sort().at(-1);
const later = await call('/tasks', 'POST', { title: 'Made after the last backup' });
await board.stop();
rs = restore(latestBackup);
check('restore works with the board stopped and keeps the old db', rs.status === 0 && /Restored/.test(rs.stdout) && fs.readdirSync(board.dataDir).some((f) => /^board\.db\.before-restore-/.test(f)), rs.stdout + rs.stderr);
rs = restore('nope.db');
check('an unknown backup name is refused', rs.status === 1 && /No backup called/.test(rs.stderr), rs.stderr);
// ---- restore safety (board.pid, SQLite check) ----
{
  const pidFile = path.join(board.dataDir, 'board.pid');
  // A live process (this test itself) in board.pid: refused, whatever the port.
  fs.writeFileSync(pidFile, JSON.stringify({ pid: process.pid, port: 1, started: Date.now() }));
  rs = restore(latestBackup);
  check('restore refuses while board.pid names a live process', rs.status === 1 && /is running \(process/.test(rs.stderr), rs.stdout + rs.stderr);
  // A dead pid: a stale file from a crash, ignored with a note.
  const dead = spawnSync(process.execPath, ['-e', 'process.exit(0)']).pid;
  fs.writeFileSync(pidFile, JSON.stringify({ pid: dead, port: 1, started: Date.now() }));
  rs = restore(latestBackup);
  check('a stale board.pid (dead process) is ignored with a note', rs.status === 0 && /stale/.test(rs.stdout) && /Restored/.test(rs.stdout), rs.stdout + rs.stderr);
  fs.rmSync(pidFile, { force: true });
  // Not a SQLite file: refused, and the current board stays in place.
  const junk = path.join(board.dataDir, 'not-a-backup.db'); fs.writeFileSync(junk, 'hello, this is not sqlite');
  const before = fs.statSync(path.join(board.dataDir, 'board.db')).size;
  rs = restore(junk);
  check('a non-SQLite file is refused and the board is untouched', rs.status === 1 && /isn't a SQLite database/.test(rs.stderr) && fs.statSync(path.join(board.dataDir, 'board.db')).size === before, rs.stdout + rs.stderr);
  check('no half-done restore files are left behind', !fs.readdirSync(board.dataDir).some((f) => /restoring-/.test(f)));
  // A boards.json entry whose folder isn't boards/<slug> (hand-edited "../../x"): refused, like the server does.
  const d = tempDir('restore-dir-');
  fs.writeFileSync(path.join(d, 'boards.json'), JSON.stringify({ default: 'main', boards: [{ slug: 'main', name: 'Main', dir: '.', status: 'live' }, { slug: 'away', name: 'Away', dir: '../../elsewhere', status: 'live' }] }));
  const bad = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'restore.mjs'), path.join(bdir, latestBackup), '--board', 'away'], { encoding: 'utf8', env: { ...process.env, BOARD_DATA: d, PORT: String(board.port) } });
  // An explicit backup file whose latest rows are still in its write-ahead log: the restore has them too.
  const w = tempDir('restore-wal-');
  const live = new DatabaseSync(path.join(w, 'src.db'));
  live.exec('PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0; CREATE TABLE t (x); INSERT INTO t VALUES (1), (2), (3);');
  fs.copyFileSync(path.join(w, 'src.db'), path.join(w, 'wal-backup.db')); fs.copyFileSync(path.join(w, 'src.db-wal'), path.join(w, 'wal-backup.db-wal'));
  live.close();
  const wd = tempDir('restore-wal-data-');
  const rw = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'restore.mjs'), path.join(w, 'wal-backup.db')], { encoding: 'utf8', env: { ...process.env, BOARD_DATA: wd, PORT: String(board.port) } });
  let walRows = -1;
  try { const x = new DatabaseSync(path.join(wd, 'board.db'), { readOnly: true }); walRows = x.prepare('SELECT COUNT(*) AS n FROM t').get().n; x.close(); } catch {}
  check('restoring a backup with rows still in its write-ahead log keeps them', rw.status === 0 && walRows === 3, `${walRows} ${rw.stdout}${rw.stderr}`);
  check('restore refuses a board whose folder is outside boards/<slug>', bad.status === 1 && /can't be restored: its folder "\.\.\/\.\.\/elsewhere"/.test(bad.stderr) && !fs.existsSync(path.resolve(d, '../../elsewhere')), bad.stdout + bad.stderr);
}
await board.relaunch();
const after = await call('/state');
check('the restored board starts and has the backed-up tasks', after.status === 200 && after.body.tasks.some((t) => t.title === 'Login form'), JSON.stringify(after.body?.tasks?.map((t) => t.title)));
check('…without what came after the backup', !after.body.tasks.some((t) => t.id === later.body.id), latestBackup);

// ================= token rotation =================
r = await call('/token/rotate', 'POST');
check('rotation refused when the token comes from BOARD_TOKEN', r.status === 400 && /BOARD_TOKEN/.test(r.body.error), JSON.stringify(r));
check('agents can\'t rotate the token', (await call('/token/rotate', 'POST', undefined, AGENT)).status === 403);
await board.stop();

const b2 = await startBoard({ env: { BOARD_TOKEN: '', BOARD_BACKUP_MINUTES: '0', BOARD_WEBHOOK_LOCALHOST: '1' } });
const oldTok = fs.readFileSync(path.join(b2.dataDir, 'token'), 'utf8').trim();
const c2 = (p, method = 'GET', body, token) => fetch(`${b2.base}/api${p}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Agent': 'dana' }, body: body && JSON.stringify(body) }).then(async (x) => ({ status: x.status, body: await x.json().catch(() => null) }));
r = await c2('/token/rotate', 'POST', undefined, oldTok);
const newTok = r.body?.token;
check('rotate returns a new token and the join commands', r.status === 200 && newTok && newTok !== oldTok && r.body.setup?.join_commands?.[0]?.command.includes(newTok), JSON.stringify(r).slice(0, 200));
check('the old token stops working', (await c2('/state', 'GET', undefined, oldTok)).status === 401);
check('the old agent token stops working', (await c2('/state', 'GET', undefined, agentTokenFor(oldTok))).status === 401);
const st2 = await c2('/state', 'GET', undefined, newTok);
check('the new token works, and data/token has it', st2.status === 200 && fs.readFileSync(path.join(b2.dataDir, 'token'), 'utf8').trim() === newTok);
check('everyone is told to re-run join', st2.body.events.some((e) => /token was rotated/.test(e.text) && (e.data?.mentions || []).includes('all')));
// ================= security fixes from the code review (server side) =================
{
  const tok = newTok; const AG = agentTokenFor(tok);
  const mcpCall = (agentName, id, method, params) => fetch(`${b2.base}/mcp?agent=${agentName}&token=${AG}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  const ask = (q, id) => mcpCall('yan-claude', id, 'tools/call', { name: 'ask_human', arguments: { question: q } });
  const human = await c2('/state', 'GET', undefined, tok);
  const viewer = human.body?.setup?.viewer_token;
  check('humans get setup with a viewer token', !!viewer && /^view-/.test(viewer) && !!human.body.setup.join_commands?.length);
  const asAgent = await fetch(`${b2.base}/api/state`, { headers: { Authorization: `Bearer ${AG}`, 'X-Agent': 'ana' } }).then((x) => x.text());
  check("the agent token's /api/state has no setup and never contains the board token", !asAgent.includes(tok) && !/"setup"/.test(asAgent), asAgent.slice(0, 120));
  const asViewer = await fetch(`${b2.base}/api/state`, { headers: { Authorization: `Bearer ${viewer}` } });
  const vText = await asViewer.text();
  check('the viewer token reads /api/state without setup or tokens', asViewer.status === 200 && !vText.includes(tok) && !vText.includes(AG) && !/"setup"/.test(vText));
  const vs = (p, method = 'GET') => fetch(`${b2.base}/api${p}`, { method, headers: { Authorization: `Bearer ${viewer}`, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : '{}' }).then((x) => x.status);
  check("the viewer token can't do anything else", (await vs('/next')) === 403 && (await vs('/tasks', 'POST')) === 403 && (await vs('/qr.svg?text=x')) === 403 && (await vs('/token/rotate', 'POST')) === 403 && (await vs('/notify')) === 403);
  const vm = await fetch(`${b2.base}/mcp?agent=x&token=${viewer}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
  check("the viewer token can't use MCP", vm.status === 403);
  // An agent reporting its limit (the Stop hook sends X-Agent) doesn't become a "human".
  await mcpCall('zed-claude', 1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'claude-code', version: '1' } });
  const secs = Math.floor((Date.now() + 3600e3) / 1000);
  const lim = await fetch(`${b2.base}/api/agents/zed-claude/limit`, { method: 'POST', headers: { Authorization: `Bearer ${AG}`, 'X-Agent': 'zed-claude', 'Content-Type': 'application/json' }, body: JSON.stringify({ until: String(secs), note: 'cap' }) });
  const limBody = await lim.json();
  check('an epoch-seconds reset time is read as seconds', lim.status === 200 && Math.abs((limBody.limited?.until || 0) - secs * 1000) < 5000, JSON.stringify(limBody).slice(0, 200));
  const pres = (await c2('/state', 'GET', undefined, tok)).body.presence;
  check("an agent's REST call doesn't add a human with its name", !pres.some((p) => p.kind === 'human' && p.name === 'zed-claude'));
  const past = await fetch(`${b2.base}/api/agents/zed-claude/limit`, { method: 'POST', headers: { Authorization: `Bearer ${AG}`, 'X-Agent': 'zed-claude', 'Content-Type': 'application/json' }, body: JSON.stringify({ until: new Date(Date.now() - 3600e3).toISOString() }) });
  check('a reset time in the past is refused', past.status === 400 && /already passed/.test((await past.json()).error));
  // Webhooks: no private targets, no redirects, no channel-wide pings, a cap.
  r = await c2('/notify', 'PUT', { url: 'https://10.0.0.5/hook' }, tok);
  check('a private-network webhook address is refused', r.status === 400 && /private/.test(r.body.error), JSON.stringify(r.body));
  r = await c2('/notify', 'PUT', { url: 'https://169.254.169.254/latest' }, tok);
  check('a link-local (cloud metadata) address is refused', r.status === 400);
  await c2('/notify', 'PUT', { url: `${HOOK}/redirect?kind=generic` }, tok);
  r = await c2('/notify/test', 'POST', undefined, tok);
  check('a webhook that redirects is treated as a failure', r.body.ok === false && /redirect/.test(r.body.error), JSON.stringify(r.body));
  await c2('/notify', 'PUT', { url: `${HOOK}/disc?kind=discord` }, tok);
  let n1 = got.length;
  await c2('/notify/test', 'POST', undefined, tok);
  const dg = await until(() => got.length > n1 && got.at(-1));
  check('Discord payloads turn mentions off (allowed_mentions)', JSON.stringify(json(dg)?.allowed_mentions) === '{"parse":[]}', dg?.body);
  await c2('/notify', 'PUT', { url: `${HOOK}/slk?kind=slack` }, tok);
  await mcpCall('yan-claude', 1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'claude-code', version: '1' } });
  n1 = got.length;
  await ask('Ping <!channel> please?', 2);
  const sg = await until(() => got.slice(n1).find((g) => /Ping/.test(json(g)?.text || '')));
  check('Slack text is escaped (no <!channel> ping)', !!sg && !json(sg).text.includes('<!channel>') && json(sg).text.includes('&lt;!channel&gt;'), sg?.body);
  await c2('/notify', 'PUT', { url: `${HOOK}/gen?kind=generic` }, tok);
  n1 = got.length;
  await c2('/messages', 'POST', { text: 'fyi ana hit its usage limit lol' }, tok);
  await sleep(600);
  check('"hit its usage limit" written by someone else is not a limit notification', !got.slice(n1).some((g) => /usage limit/.test(json(g)?.text || '')));
  n1 = got.length;
  for (let i = 0; i < 25; i++) await ask(`Question number ${i}?`, 10 + i);
  await sleep(1500);
  const sent = got.slice(n1).filter((g) => /Question number/.test(json(g)?.text || '')).length;
  check('at most 20 notifications per 10 minutes', sent <= 20 && sent >= 15, String(sent));
  check('a running board writes data/board.pid', fs.existsSync(path.join(b2.dataDir, 'board.pid')));
  // Rotating closes open live streams (they were authorised with the old token).
  // What is posted right after the rotation (before the stream closes) never reaches it.
  let streamText = '';
  const streamEnded = await new Promise((resolve) => {
    const rq = http.get(`${b2.base}/api/stream?token=${encodeURIComponent(tok)}`, (res) => {
      res.on('data', (d) => { streamText += d; });
      res.on('end', () => resolve(true));
      setTimeout(async () => {
        const rot = await c2('/token/rotate', 'POST', undefined, tok).catch(() => null);
        if (rot?.body?.token) c2('/messages', 'POST', { text: 'posted right after the rotation' }, rot.body.token).catch(() => {});
      }, 300);
      setTimeout(() => resolve(false), 4000);
    });
    rq.on('error', () => resolve(false));
  });
  check('rotating the token closes open live streams', streamEnded);
  check('…which get the rotation notice but nothing posted after it', /token was rotated/.test(streamText) && !streamText.includes('right after the rotation'), streamText.slice(-300));
  // Rotating also ends pending long polls opened with the old token (the Stop hook's REST wait, an agent's
  // wait_for_events): they answer "the token was changed" and never get what is posted after the rotation.
  {
    const cur = fs.readFileSync(path.join(b2.dataDir, 'token'), 'utf8').trim();
    const AGo = agentTokenFor(cur);
    const bob = await agent({ base: b2.base, token: AGo }, 'bob-rot');
    await bob('board_status');
    const cursor = (await c2('/cursor', 'GET', undefined, cur)).body.cursor;
    const t0 = Date.now();
    const restWait = fetch(`${b2.base}/api/events?since=${cursor}&exclude=bob-rot&wait=20`, { headers: { Authorization: `Bearer ${AGo}`, 'X-Agent': 'bob-rot' } })
      .then(async (x) => ({ status: x.status, body: await x.json().catch(() => null), ms: Date.now() - t0 }));
    const mcpWait = bob('wait_for_events', { since: cursor, timeout_s: 20, channel: 'direct' }).then((x) => ({ x, ms: Date.now() - t0 }));
    await sleep(600); // both are waiting
    const rot = await c2('/token/rotate', 'POST', undefined, cur);
    const dm = await c2('/messages', 'POST', { text: 'posted after the rotation', to: 'bob-rot' }, rot.body?.token);
    const [rw, mw] = await Promise.all([restWait, mcpWait]);
    check('rotating ends a pending REST long poll of the old token: 401 token_rotated, not what came after', rot.status === 200 && dm.status === 200 && rw.status === 401 && rw.body?.reason === 'token_rotated' && rw.ms < 10e3 && !JSON.stringify(rw.body).includes('after the rotation'), JSON.stringify(rw).slice(0, 300));
    check('…and a pending MCP wait_for_events: "the token was changed", not the later direct message', typeof mw.x === 'string' && /token was changed/.test(mw.x) && mw.ms < 10e3, JSON.stringify(mw).slice(0, 300));
  }
}
// ================= tokens, compression and caching =================
// An empty token file gets a new token: an empty one used to let in any request that sent no token.
fs.writeFileSync(path.join(b2.dataDir, 'token'), '');
await b2.relaunch();
const tok3 = fs.readFileSync(path.join(b2.dataDir, 'token'), 'utf8').trim();
check('an empty token file gets a new token, and no token is refused', tok3.length >= 16 && (await fetch(`${b2.base}/api/state`)).status === 401 && (await fetch(`${b2.base}/api/state?token=`)).status === 401, tok3);
check('new board tokens never start with "-" or "_" (they would read as an option on a command line)', Array.from({ length: 4000 }, newBoardToken).every((t) => /^[A-Za-z0-9]/.test(t)));
// fetch decompresses by itself, so these use plain http.
const raw = (p, headers = {}) => new Promise((resolve, reject) => {
  http.get(`${b2.base}${p}`, { headers }, (res) => {
    const parts = []; res.on('data', (d) => parts.push(d));
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts) }));
  }).on('error', reject);
});
const auth3 = { Authorization: `Bearer ${tok3}`, 'X-Agent': 'dana' };
const sz = await raw('/api/state', { ...auth3, 'Accept-Encoding': 'gzip', 'User-Agent': 'Mozilla/5.0' });
const sp = await raw('/api/state', auth3);
check('/api/state is gzipped when the browser accepts it, the same JSON as without', sz.headers['content-encoding'] === 'gzip' && zlib.gunzipSync(sz.body).equals(sp.body) && !sp.headers['content-encoding'] && Array.isArray(JSON.parse(sp.body).tasks) && /json/.test(sp.headers['content-type']), JSON.stringify(sz.headers));
// Node's fetch accepts gzip too, but a script that exits right after a gzipped answer can crash on Windows.
check('a script (gzip accepted, not a browser) gets it uncompressed', !(await raw('/api/state', { ...auth3, 'Accept-Encoding': 'gzip, deflate' })).headers['content-encoding'] && !(await raw('/', { 'Accept-Encoding': 'gzip, deflate' })).headers['content-encoding']);
await c2('/messages', 'POST', { text: 'cache check' }, tok3);
check('a new event is in the next /api/state at once (the shared answer is rebuilt)', JSON.parse((await raw('/api/state', auth3)).body).events.some((e) => e.text === 'cache check'));
const viewerTok = JSON.parse(sp.body).setup?.viewer_token;
const vst = JSON.parse((await raw('/api/state', { Authorization: `Bearer ${viewerTok}` })).body);
check('the presenter view still gets no setup and no direct messages (one shared answer per kind of reader)', !!viewerTok && !vst.setup && !vst.direct && Array.isArray(vst.tasks));
const page = await raw('/', { 'Accept-Encoding': 'gzip', 'User-Agent': 'Mozilla/5.0' });
const pagePlain = await raw('/');
check('the web board page is gzipped when asked, revalidated on each load', page.headers['content-encoding'] === 'gzip' && zlib.gunzipSync(page.body).equals(pagePlain.body) && /max-age=0/.test(page.headers['cache-control']) && /Accept-Encoding/i.test(page.headers.vary || ''), JSON.stringify(page.headers));
// Gzipped or not depends on the User-Agent too (browsers only), so a cache in between must key on it as well.
check('gzip-eligible answers vary on User-Agent as well as Accept-Encoding', [page, pagePlain, sz, sp].every((x) => /Accept-Encoding/i.test(x.headers.vary || '') && /User-Agent/i.test(x.headers.vary || '')), [page, pagePlain, sz, sp].map((x) => x.headers.vary).join(' | '));
check('an unchanged page answers 304', (await raw('/', { 'Accept-Encoding': 'gzip', 'User-Agent': 'Mozilla/5.0', 'If-None-Match': page.headers.etag })).status === 304);
const chunk = fs.readdirSync(path.join(ROOT, 'public', 'office')).find((f) => /^OfficeScene-[\w-]{8}\.js$/.test(f));
const cz = await raw(`/office/${chunk}`, { 'Accept-Encoding': 'gzip', 'User-Agent': 'Mozilla/5.0' });
const cp = await raw(`/office/${chunk}`);
check('the 3D office\'s hashed chunks are cached for a year, gzipped or not', cz.status === 200 && cz.headers['content-encoding'] === 'gzip' && /immutable/.test(cz.headers['cache-control']) && /immutable/.test(cp.headers['cache-control'] || ''), `${chunk} ${cz.headers['cache-control']} ${cp.headers['cache-control']}`);
check('office/embed.js (no hash in its name) is revalidated', /max-age=0/.test((await raw('/office/embed.js', { 'Accept-Encoding': 'gzip', 'User-Agent': 'Mozilla/5.0' })).headers['cache-control']));
const slashless = await raw('/b/main', { 'Accept-Encoding': 'gzip', 'User-Agent': 'Mozilla/5.0' });
check('/b/<board> without its slash still redirects to /b/<board>/', slashless.status >= 300 && slashless.status < 400 && /\/b\/main\/$/.test(slashless.headers.location || ''), `${slashless.status} ${slashless.headers.location}`);
check('hidden files and paths outside public/ are not served', (await raw('/../package.json', { 'Accept-Encoding': 'gzip', 'User-Agent': 'Mozilla/5.0' })).status === 404 && (await raw('/%2e%2e/package.json', { 'Accept-Encoding': 'gzip', 'User-Agent': 'Mozilla/5.0' })).status !== 200);
// A JSON-RPC batch would get several wait_for_events past the open-waits limit in one request.
const wait = (id) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'wait_for_events', arguments: { timeout_s: 1 } } });
const batch = await fetch(`${b2.base}/mcp?agent=batcher&token=${agentTokenFor(tok3)}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify([wait(1), wait(2), wait(3)]) });
check('MCP refuses JSON-RPC batches (400)', batch.status === 400 && /Batched requests/.test((await batch.json().catch(() => ({})))?.error?.message || ''), batch.status);
// A malformed request gets a plain answer, not the server's internals (here: "Cannot read properties of undefined").
r = await c2('/locks/release', 'POST', {}, tok3);
check('a malformed request: 400 without internal details', r.status === 400 && /missing a field/.test(r.body?.error || '') && !/properties of undefined/.test(r.body?.error || ''), JSON.stringify(r));
// Bodies are read only where they're used: one sent to a board that doesn't exist, or to the admin API without
// its token, is never parsed (a broken one would answer 400 "not valid JSON" if it were). On a board it still is.
{
  const post = (p, headers = {}) => fetch(`${b2.base}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{broken' }).then(async (x) => ({ status: x.status, body: await x.json().catch(() => null) }));
  const nowhere = await post('/b/no-such-board/api/tasks');
  const admin = await post('/api/admin/boards');
  const onBoard = await post('/api/tasks', { Authorization: `Bearer ${tok3}` });
  check('a body sent to a board that doesn\'t exist, or to the admin API without its token, isn\'t parsed', nowhere.status === 404 && admin.status === 401, `${nowhere.status} ${admin.status}`);
  check('…and on a board a broken body still gets the JSON error', onBoard.status === 400 && /not valid JSON/.test(onBoard.body?.error || ''), JSON.stringify(onBoard));
}
{
  // Only a TypeError from reading the request is the caller's fault; another TypeError is a bug on the server: 500.
  const statusFor = (e) => { let s = 0; const res = { status: (n) => { s = n; return res; }, json: () => res }; const log = console.error; console.error = () => {}; try { internalError(res, e); } finally { console.error = log; } return s; };
  const input = [() => undefined.x, () => { for (const _ of 5); }, () => (5).trim()].map((f) => { try { f(); } catch (e) { return statusFor(e); } });
  const bugs = [() => { const k = 1; k = 2; }, () => Object.keys(null), () => JSON.stringify({ n: 1n }), () => { undefined.x = 1; }].map((f) => { try { f(); } catch (e) { return statusFor(e); } });
  check('internalError: input TypeErrors are 400, other TypeErrors (bugs) 500', input.every((s) => s === 400) && bugs.every((s) => s === 500), JSON.stringify({ input, bugs }));
}
// A second server on the same data folder (another port) refuses to start: it would open the same databases.
{
  const pf = path.join(b2.dataDir, 'board.pid');
  const before = fs.readFileSync(pf, 'utf8');
  const s2 = spawnSync(process.execPath, [path.join(ROOT, 'src', 'server.js')], {
    env: { ...process.env, PORT: '0', BOARD_TOKEN: tok3, BOARD_DATA: b2.dataDir, BOARD_NO_JOIN: '1' }, encoding: 'utf8', timeout: 15000,
  });
  check('a second server on the same data folder refuses to start (exit 1, says which process has it)', s2.status === 1 && /already using the data folder/.test(s2.stderr) && s2.stderr.includes(String(b2.child.pid)) && fs.readFileSync(pf, 'utf8') === before, `${s2.status} ${s2.stdout} ${s2.stderr}`);
  check('the first board still answers after that', (await fetch(`${b2.base}/health`)).ok);
  // A board.pid naming a live process that isn't a board (a pid taken again after a crash) doesn't block a start.
  fs.writeFileSync(pf, JSON.stringify({ pid: process.pid, port: await freePort(), started: new Date(Date.now() - 5 * 60e3).toISOString() }));
  await b2.relaunch();
  check('a stale board.pid whose pid now belongs to another program is replaced', JSON.parse(fs.readFileSync(pf, 'utf8')).pid === b2.child.pid);
}
// board.pid of a live process whose port takes the connection but doesn't answer /health in time (a busy or
// suspended server): no proof it isn't the board, so it keeps the folder. Something else answering /health there
// (another pid) is proof: the file is replaced.
{
  const data = tempDir('pidbusy-');
  const pf = path.join(data, 'board.pid');
  const held = new Set();
  const slow = http.createServer((req) => { held.add(req.socket); }); // takes the request, never answers
  const other = http.createServer((_req, res) => res.end(JSON.stringify({ ok: true, app: 'claude-board', pid: 1 })));
  await Promise.all([slow, other].map((s) => new Promise((r) => s.listen(0, '127.0.0.1', r))));
  const start = (port) => new Promise((resolve) => {
    fs.writeFileSync(pf, JSON.stringify({ pid: process.pid, port, host: '127.0.0.1', started: new Date(Date.now() - 5 * 60e3).toISOString() }));
    const c = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], { env: { ...process.env, PORT: '0', HOST: '127.0.0.1', BOARD_TOKEN: 'pidtok', BOARD_DATA: data, BOARD_NO_JOIN: '1', BOARD_BACKUP_MINUTES: '0' }, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; c.stderr.on('data', (d) => { err += d; });
    // Still running after a while: it took the folder. (Its exit code after the kill doesn't count.)
    const t = setTimeout(async () => { const pid = JSON.parse(fs.readFileSync(pf, 'utf8')).pid; resolve({ code: 'running', pid: pid === c.pid ? 'child' : pid, err }); killTree(c); await exited(c, 3000); }, 10e3);
    c.on('exit', (code) => { clearTimeout(t); resolve({ code, err }); });
  });
  const busy = await start(slow.address().port);
  check('a live board.pid owner whose /health times out keeps the data folder (a second server refuses)', busy.code === 1 && /already using the data folder/.test(busy.err) && JSON.parse(fs.readFileSync(pf, 'utf8')).pid === process.pid, JSON.stringify(busy));
  const taken = await start(other.address().port);
  check('…but another pid answering /health on its port is proof it is stale: the file is replaced', taken.code === 'running' && taken.pid === 'child', JSON.stringify(taken));
  for (const s of held) s.destroy();
  slow.close(); other.close();
}
// board.pid can't be created (here: the data folder's path runs through a file): the server doesn't start unguarded.
{
  const file = path.join(tempDir('pidfail-'), 'not-a-folder');
  fs.writeFileSync(file, '');
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import { takePid } from ${JSON.stringify(new URL('../src/pidfile.js', import.meta.url).href)}; console.log(JSON.stringify(await takePid()));`],
    { env: { ...process.env, BOARD_DATA: path.join(file, 'data') }, encoding: 'utf8', timeout: 20e3 });
  const out = (() => { try { return JSON.parse(r.stdout); } catch { return r.stdout; } })();
  check('takePid fails closed when board.pid can\'t be created (an error, not "go ahead")', !!out?.error, `${r.stdout} ${r.stderr}`);
}
// Several servers reclaiming the same stale board.pid at once: exactly one gets the folder (the stale file is
// removed under a lock, so one can't delete the file another just created).
{
  const data = tempDir('pidrace-');
  const pf = path.join(data, 'board.pid');
  const code = `import { takePid } from ${JSON.stringify(new URL('../src/pidfile.js', import.meta.url).href)}; const o = await takePid(); console.log(o ? 'refused' : 'took'); setTimeout(() => {}, 4000);`;
  const deadPort = await freePort();
  let good = 0; const seen = [];
  for (let round = 0; round < 4; round++) {
    fs.writeFileSync(pf, JSON.stringify({ pid: process.pid, port: deadPort, host: '127.0.0.1', started: new Date(Date.now() - 5 * 60e3).toISOString() }));
    const kids = Array.from({ length: 6 }, () => spawn(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, BOARD_DATA: data }, stdio: ['ignore', 'pipe', 'ignore'] }));
    const said = await Promise.all(kids.map((k) => new Promise((r) => { let o = ''; k.stdout.on('data', (d) => { o += d; if (/took|refused/.test(o)) r(o.trim()); }); k.on('exit', () => r(o.trim() || 'exit')); })));
    const owner = JSON.parse(fs.readFileSync(pf, 'utf8')).pid;
    const winner = kids[said.indexOf('took')];
    seen.push(said.join('/'));
    if (said.filter((s) => s === 'took').length === 1 && winner?.pid === owner) good++;
    for (const k of kids) killTree(k);
  }
  check('several servers reclaiming one stale board.pid at once: exactly one takes it, every time', good === 4, seen.join('; '));
}
// Two servers started at the same moment on one data folder: exactly one gets it (board.pid is created only
// when there is none), the other refuses and exits.
{
  const data = tempDir('race-');
  const up = (p) => fetch(`http://localhost:${p}/health`, { signal: AbortSignal.timeout(1500) }).then((x) => x.ok).catch(() => false);
  let good = 0; const seen = [];
  for (let round = 0; round < 3; round++) {
    fs.rmSync(path.join(data, 'board.pid'), { force: true });
    const ports = [await freePort(), await freePort()];
    const kids = ports.map((p) => spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], { env: { ...process.env, PORT: String(p), BOARD_DATA: data, BOARD_NO_JOIN: '1', BOARD_TOKEN: 'racetok', BOARD_BACKUP_MINUTES: '0' }, stdio: 'ignore' }));
    const codes = [null, null];
    kids.forEach((k, i) => k.on('exit', (c) => { codes[i] = c; }));
    await until(async () => codes.some((c) => c !== null) && (await Promise.all(ports.map(up))).some(Boolean), 20e3);
    await sleep(500);
    const ups = await Promise.all(ports.map(up));
    seen.push(`${ups.join('/')} exit ${codes.join('/')}`);
    if (ups.filter(Boolean).length === 1 && codes.filter((c) => c === 1).length === 1) good++;
    for (const k of kids) { try { k.kill(); } catch {} if (!(await exited(k, 3000))) killTree(k); }
  }
  check('two servers started at once on one data folder: exactly one stays up, every time', good === 3, seen.join('; '));
}
await b2.stop();
// A clean stop removes board.pid. On Windows the test's stop kills the process outright (no exit
// handlers), which leaves a stale file naming a dead process; restore ignores those.
{
  const pf = path.join(b2.dataDir, 'board.pid');
  let stale = false;
  if (fs.existsSync(pf)) { try { process.kill(JSON.parse(fs.readFileSync(pf, 'utf8')).pid, 0); } catch { stale = true; } }
  check('a stopped board leaves no live board.pid', !fs.existsSync(pf) || (process.platform === 'win32' && stale));
}

hook.close();
await finish(R);
