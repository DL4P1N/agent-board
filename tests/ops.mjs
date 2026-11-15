// Operations: webhook notifications (Slack / Discord / ntfy / generic), automatic backups +
// `npm run restore`, and token rotation. Starts its own throwaway boards and a fake webhook server.
// Run all suites with: npm test
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { startBoard, finish, agent, ROOT } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';

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

const board = await startBoard({ env: { BOARD_BACKUP_SECONDS: '1' } });
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

const b2 = await startBoard({ env: { BOARD_TOKEN: '', BOARD_BACKUP_MINUTES: '0' } });
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
  const streamEnded = await new Promise((resolve) => {
    const rq = http.get(`${b2.base}/api/stream?token=${encodeURIComponent(tok)}`, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(true));
      setTimeout(() => { c2('/token/rotate', 'POST', undefined, tok).catch(() => {}); }, 300);
      setTimeout(() => resolve(false), 4000);
    });
    rq.on('error', () => resolve(false));
  });
  check('rotating the token closes open live streams', streamEnded);
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
