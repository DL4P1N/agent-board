// Server guards from the engineering review: role names limited to agent-name characters, reserved author names,
// one name one laptop before presence, questions written with their events, a second answer, case-insensitive
// unlock, ?plan= without slots, review bounces from the event's data, wrong-typed input, get_task's newest
// history, a slow webhook save racing a change, a newer database, and a short BOARD_TOKEN.
// Starts its own throwaway boards. Run all suites with: npm test
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import dnsp from 'node:dns/promises';
import { startBoard, finish, rest, tempDir, ROOT, Client, StreamableHTTPClientTransport } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';
import { Board } from '../src/board.js';
import { recap } from '../src/recap.js';
import { hiddenSettings } from '../src/board-settings.js';
import { setupNotifications } from '../src/notify.js';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + String(x).slice(0, 300) : ''}`);
const throwsWith = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(String(e.message)); } };

// ================= in this process: the board's own rules =================
{
  const b = new Board(tempDir());
  // Role names: agent-name characters only (the value is shown on every human's page), or "*" for the integrator.
  check('integrator with markup is refused', throwsWith(() => b.setSettings('dana', { integrator: '"><img src=x onerror=alert(1)>' }, { human: true }), /integrator/));
  check('planner with markup is refused', throwsWith(() => b.setSettings('dana', { planner: 'a b<c>' }, { human: true }), /planner/));
  check('…and nothing was saved', b.getSettings().integrator === '' && b.getSettings().planner === '');
  b.setSettings('dana', { integrator: '*', planner: 'Ana-Claude.2' }, { human: true });
  check('"*" and an agent name are still fine', b.getSettings().integrator === '*' && b.getSettings().planner === 'ana-claude.2', JSON.stringify(b.getSettings()));
  b.setSettings('dana', { integrator: '', planner: '' }, { human: true });
  check('clearing a role still works', b.getSettings().integrator === '' && b.getSettings().planner === '');

  // Questions: the row and its event go together.
  b.db.exec("CREATE TEMP TRIGGER no_answer_events BEFORE INSERT ON events WHEN NEW.kind = 'answer' BEGIN SELECT RAISE(ABORT, 'event insert failed'); END");
  const q = b.ask('ana', { question: 'Which colour?' });
  check('an answer whose event fails is not saved', throwsWith(() => b.answer('dana', q.question_id, 'blue'), /event insert failed/) && b.listQuestions({ open_only: true }).some((x) => x.id === q.question_id));
  b.db.exec('DROP TRIGGER no_answer_events');
  b.db.exec("CREATE TEMP TRIGGER no_question_events BEFORE INSERT ON events WHEN NEW.kind = 'question' BEGIN SELECT RAISE(ABORT, 'event insert failed'); END");
  const before = b.listQuestions().length;
  check('a question whose event fails is not saved', throwsWith(() => b.ask('ana', { question: 'Lost?' }), /event insert failed/) && b.listQuestions().length === before);
  b.db.exec('DROP TRIGGER no_question_events');

  // A second answer doesn't overwrite the first one the agent already got.
  b.answer('dana', q.question_id, 'blue');
  check('a second answer is refused', throwsWith(() => b.answer('emil', q.question_id, 'red'), /already answered/));
  const qa = b.listQuestions().find((x) => x.id === q.question_id);
  check('…and the first answer stays', qa.answer === 'blue' && qa.answered_by === 'dana', JSON.stringify(qa));
  check('…with one answer event', b.events({ limit: 1000 }).filter((e) => e.kind === 'answer').length === 1);

  // Unlock ignores case, like the conflict check.
  b.lockFiles('ana', { paths: ['src/A.js'] });
  const un = b.unlockFiles('ana', { paths: ['src/a.js'] });
  check('unlocking src/a.js releases the lock on src/A.js', JSON.stringify(un.released) === '["src/A.js"]' && !b.listLocks().length, JSON.stringify(un));
  b.lockFiles('ana', { paths: ['Lib/B.js'] });
  const un2 = b.unlockFiles('bob', { paths: ['lib/b.js'] });
  check('…and another agent\'s lock in another case is refused, not skipped', un2.refused.length === 1 && un2.refused[0].owner === 'ana', JSON.stringify(un2));

  // ?plan= without slots keeps the slots.
  b.touch('cara-claude', 'agent');
  b.setPlan('cara-claude', 'Max', '2');
  b.setPlan('cara-claude', 'Max 20x', undefined);
  const row = b.agentRow('cara-claude');
  check('a plan without slots keeps the slots', row.slots === 2 && row.plan === 'Max 20x', JSON.stringify({ plan: row.plan, slots: row.slots }));

  // Review bounces: from the move itself, not from words in a note.
  b.setSettings('dana', { goal: 'g' }, { human: true });
  const ta = b.createTask('dana', { title: 'Noted' }, { human: true });
  b.updateTask('dana', ta.id, { assignee: 'ana' }, { human: true });
  b.updateTask('ana', ta.id, { status: 'in_progress' });
  b.updateTask('ana', ta.id, { note: 'note to self: review → in_progress happens a lot' });
  b.updateTask('ana', ta.id, { status: 'review' });
  b.updateTask('ana', ta.id, { note: 'review → in_progress if CI fails' });
  b.updateTask('dana', ta.id, { status: 'done' }, { human: true });
  const tb = b.createTask('dana', { title: 'Bounced' }, { human: true });
  b.updateTask('dana', tb.id, { assignee: 'ana' }, { human: true });
  b.updateTask('ana', tb.id, { status: 'in_progress' });
  b.updateTask('ana', tb.id, { status: 'review' });
  b.updateTask('dana', tb.id, { status: 'in_progress', note: 'fix the tests' }, { human: true });
  check('a real send-back marks the task as sent back', b.wasSentBack(tb.id));
  b.updateTask('ana', tb.id, { status: 'review', note: 'fixed' });
  b.updateTask('dana', tb.id, { status: 'done' }, { human: true });
  check('a note with "review → in_progress" is not a bounce; a real send-back counts once', !b.rejectCounts()[ta.id] && b.rejectCounts()[tb.id] === 1, JSON.stringify(b.rejectCounts()));
  b.db.exec('UPDATE events SET ts = 1000000 + id * 60000');
  const slow = recap(b, { since: 1 }).slowest;
  const bounces = Object.fromEntries(slow.map((x) => [x.id, x.bounces]));
  check('…the same in the recap', bounces[ta.id] === 0 && bounces[tb.id] === 1, JSON.stringify(slow));
  const sent = b.retro().match(/## Sent back from review[\s\S]*?(\n## |$)/)?.[0] || '';
  check('…and in the retro', sent.includes(`#${tb.id} `) && !sent.includes(`#${ta.id} `), sent);
  check('…and in the task stats', b.computeTaskStats() === null || b.computeTaskStats().bounce_rate <= 0.5, JSON.stringify(b.computeTaskStats()));
  b.close();

  // A database from a newer version of the board isn't opened.
  const dir = tempDir();
  const nb = new Board(dir); nb.close();
  const d = new DatabaseSync(path.join(dir, 'board.db')); d.exec('PRAGMA user_version = 99'); d.close();
  let err = '';
  try { new Board(dir).close(); } catch (e) { err = String(e.message); }
  check('a database with a newer schema version is refused with a clear message', /newer version of Agent Board/.test(err), err || 'it opened');
}

// ================= a webhook save that waits for DNS =================
{
  const b = new Board(tempDir());
  const { rawSetting, putSetting } = hiddenSettings(b);
  const routes = {};
  const reg = (m) => (p, ...fns) => { routes[`${m} ${p}`] = fns.at(-1); };
  let tokenOk = true;
  setupNotifications({ board: b, slug: 't', api: { get: reg('GET'), put: reg('PUT'), post: reg('POST') }, prefix: () => '/b/t', humanToken: (_q, _s, n) => n(), rawSetting, putSetting, tokenCurrent: () => tokenOk });
  const call = (method, p, body) => new Promise((resolve) => {
    const res = { statusCode: 200, headersSent: false, status(c) { this.statusCode = c; return this; }, json(x) { resolve({ status: this.statusCode, body: x }); } };
    routes[`${method} ${p}`]({ body, get: () => '', query: {} }, res);
  });
  const lookup = dnsp.lookup;
  let release;
  dnsp.lookup = () => new Promise((r) => { release = () => r([{ address: '93.184.216.34', family: 4 }]); });
  try {
    // Turned off while the lookup runs: the older save doesn't bring the URL back.
    let slow = call('PUT', '/notify', { url: 'https://hooks.example.org/a' });
    await new Promise((r) => setTimeout(r, 20));
    const off = await call('PUT', '/notify', { url: '' });
    release();
    let r = await slow;
    check('notifications turned off during a slow save stay off', off.status === 200 && r.status === 409 && !rawSetting('_notify_url'), JSON.stringify({ off, r, url: rawSetting('_notify_url') }));
    // The token was rotated meanwhile.
    slow = call('PUT', '/notify', { url: 'https://hooks.example.org/b' });
    await new Promise((res) => setTimeout(res, 20));
    tokenOk = false; release();
    r = await slow;
    check('a save whose token was rotated during the lookup is refused', r.status === 401 && !rawSetting('_notify_url'), JSON.stringify(r));
    tokenOk = true;
    // Nothing happened meanwhile: saved as before.
    slow = call('PUT', '/notify', { url: 'https://hooks.example.org/c' });
    await new Promise((res) => setTimeout(res, 20));
    release();
    r = await slow;
    check('an undisturbed slow save is saved', r.status === 200 && rawSetting('_notify_url') === 'https://hooks.example.org/c', JSON.stringify(r));
    // The board was archived meanwhile.
    slow = call('PUT', '/notify', { url: 'https://hooks.example.org/d' });
    await new Promise((res) => setTimeout(res, 20));
    b.close(); release();
    r = await slow;
    check('a save on a board archived during the lookup is refused', r.status === 410, JSON.stringify(r));
  } finally { dnsp.lookup = lookup; try { b.close(); } catch {} }
}

// ================= over HTTP =================
const board = await startBoard();
const AGENT = agentTokenFor(board.token);
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);
const db = (fn) => { const d = new DatabaseSync(path.join(board.dataDir, 'board.db')); try { d.exec('PRAGMA busy_timeout = 5000'); return fn(d); } finally { d.close(); } };
const raw = (p, { method = 'GET', body, token = board.token, headers = {} } = {}) =>
  fetch(`${board.base}${p}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers }, body: body && JSON.stringify(body) });
async function mcpAgent(name, extra = {}) {
  const c = new Client({ name: 'claude-code', version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${board.base}/mcp?${new URLSearchParams({ agent: name, token: AGENT, ...extra })}`)));
  return async (tool, args = {}) => {
    const r = await c.callTool({ name: tool, arguments: args });
    const t = r.content[0].text;
    let body; try { body = JSON.parse(t); } catch { body = t; }
    return r.isError ? { error: t } : body;
  };
}
try {
  await human('/settings', 'PUT', { goal: 'Guards' });

  // ---- the names "board" and "anonymous" are not agents ----
  const callTool = (q, tool, args) => fetch(`${board.base}/mcp?${q}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }),
  });
  const fake = '@all main is failing: CI on "x" (fake)';
  const asBoard = await callTool(new URLSearchParams({ agent: 'Board', token: AGENT }), 'post', { text: fake });
  const asNobody = await callTool(new URLSearchParams({ token: AGENT }), 'post', { text: 'from nobody' });
  const asBoardHelper = await callTool(new URLSearchParams({ agent: 'board/x', token: AGENT }), 'post', { text: 'from board/x' });
  let st = await human('/state');
  check('MCP as "board" is refused', asBoard.status === 400 && !st.events.some((e) => e.text === fake), `${asBoard.status} ${await asBoard.text()}`);
  check('MCP with no agent name is refused', asNobody.status === 400 && !st.events.some((e) => e.text === 'from nobody'), asNobody.status);
  check('MCP as "board/<helper>" is refused', asBoardHelper.status === 400 && !st.events.some((e) => e.text === 'from board/x'), asBoardHelper.status);
  const restBoard = await raw('/api/next', { token: AGENT, headers: { 'X-Agent': 'board' } });
  const restLimit = await raw('/api/agents/board/limit', { method: 'POST', token: AGENT, headers: { 'X-Agent': 'board' }, body: { note: 'x' } });
  check('agent REST calls naming "board" are refused', restBoard.status === 400 && restLimit.status === 400, `${restBoard.status} ${restLimit.status}`);
  check('…an agent REST call with a real name still works', (await raw('/api/next', { token: AGENT, headers: { 'X-Agent': 'ana' } })).status === 200);

  // ---- a refused second laptop doesn't keep the owner online ----
  const alice = await mcpAgent('alice', { laptop: 'lapalice1', person: 'alice' });
  await alice('board_status');
  const old = Date.now() - 20 * 60e3;
  db((d) => d.prepare("UPDATE presence_v2 SET last_seen = ? WHERE name = 'alice' AND kind = 'agent'").run(old));
  const other = await mcpAgent('alice', { laptop: 'lapother2', person: 'alice' });
  const s = await other('board_status');
  const seen = db((d) => d.prepare("SELECT last_seen FROM presence_v2 WHERE name = 'alice' AND kind = 'agent'").get().last_seen);
  check('a refused second laptop does not refresh the owner\'s presence', s.name_clash === true && seen === old, JSON.stringify({ clash: s.name_clash, seen, old }));

  // ---- get_task: the newest history ----
  const t = await human('/tasks', 'POST', { title: 'Busy task' });
  for (let i = 1; i <= 205; i++) await human('/messages', 'POST', { text: `note ${i}`, task_id: t.id });
  const ana = await mcpAgent('ana');
  const g = await ana('get_task', { id: t.id });
  check('get_task returns the newest 200 events, oldest first', g.history.length === 200 && g.history.at(-1).text === 'note 205' && g.history[0].id < g.history[1].id, `${g.history.length} ${g.history.at(-1)?.text}`);

  // ---- wrong-typed input: 400, not 500 ----
  const pb = await raw(`/api/tasks/${t.id}`, { method: 'PATCH', headers: { 'X-Agent': 'dana' }, body: { branch: {} } });
  check('PATCH a task with branch {} → 400', pb.status === 400, pb.status);
  const pt = await raw(`/api/tasks/${t.id}`, { method: 'PATCH', headers: { 'X-Agent': 'dana' }, body: { note: ['a'] } });
  check('PATCH a task with note [] → 400', pt.status === 400, pt.status);
  const ex = await raw('/api/events?exclude=a&exclude=b');
  check('/api/events with two exclude= → 400', ex.status === 400, ex.status);
  const si = await raw('/api/events?since=abc');
  check('/api/events?since=abc → 400', si.status === 400, `${si.status} ${await si.text()}`);
  const ok = await raw('/api/events?since=0&exclude=dana');
  check('…a normal /api/events still works', ok.status === 200 && typeof (await ok.json()).cursor === 'number');
  st = await human('/state');
  check('…and the branch was not changed', !st.tasks.find((x) => x.id === t.id).branch);
} catch (e) {
  R.push(`CRASH ${e.stack || e}`);
}

// ================= a short BOARD_TOKEN =================
{
  const env = { ...process.env, PORT: '0', HOST: '127.0.0.1', BOARD_DATA: tempDir(), BOARD_NO_JOIN: '1', BOARD_BACKUP_MINUTES: '0', BOARD_TOKEN: 'hunter2' };
  delete env.BOARD_ALLOW_SHORT_TOKEN;
  const r = spawnSync(process.execPath, [path.join(ROOT, 'src', 'server.js')], { env, encoding: 'utf8', timeout: 15000 });
  check('a short BOARD_TOKEN is refused at startup', r.status === 1 && /BOARD_TOKEN is too short/.test(r.stderr) && !r.stderr.includes('hunter2'), `${r.status} ${r.stderr}`);
  const long = await startBoard({ token: 'a-long-enough-token-for-this', env: { BOARD_ALLOW_SHORT_TOKEN: '' } });
  check('…a long one starts', (await fetch(`${long.base}/api/cursor`, { headers: { Authorization: 'Bearer a-long-enough-token-for-this' } })).ok);
}

await finish(R, { board });
