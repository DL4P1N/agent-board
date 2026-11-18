// One agent name on two laptops (AG-6), and join's name check before any agent has connected (JOIN-4).
// The laptop id is join's ?laptop= on the MCP URL. Starts its own throwaway board. Run all suites with: npm test
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startBoard, finish, rest, Client, StreamableHTTPClientTransport } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';

const board = await startBoard();
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + String(x).slice(0, 300) : ''}`);
const AGENT_TOKEN = agentTokenFor(board.token);
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);
const db = (fn) => { const d = new DatabaseSync(path.join(board.dataDir, 'board.db')); try { d.exec('PRAGMA busy_timeout = 5000'); return fn(d); } finally { d.close(); } };
const api = async (p, { method = 'GET', body, token = AGENT_TOKEN } = {}) => {
  const r = await fetch(`${board.base}/api${p}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body && JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
async function agent(name, extra = {}) {
  const q = new URLSearchParams({ agent: name, token: AGENT_TOKEN, ...extra });
  const c = new Client({ name: 'claude-code', version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${board.base}/mcp?${q}`)));
  return async (tool, args = {}) => {
    const r = await c.callTool({ name: tool, arguments: args });
    const t = r.content[0].text;
    let body; try { body = JSON.parse(t); } catch { body = t; }
    return r.isError ? { error: t } : body;
  };
}

await human('/settings', 'PUT', { goal: 'Test one name on two laptops.' });
const t1 = await human('/tasks', 'POST', { title: 'First task', size: 'S' });
const t2 = await human('/tasks', 'POST', { title: 'Second task', size: 'S' });

// ================= AG-6: the second laptop is told to stop and can't take the work =================
const benA = await agent('ben-claude', { laptop: 'lapa1111', person: 'ben' });
let s = await benA('board_status');
const c1 = await benA('claim_task', { id: t1.id });
check('the first laptop claims as usual', !c1.error && c1.status === 'claimed', JSON.stringify(c1).slice(0, 200));

const benB = await agent('Ben-Claude', { laptop: 'lapb2222', person: 'ben' });
s = await benB('board_status');
check('second laptop: next_action leads with the warning', /^Another laptop is already using the name ben-claude\. Stop/.test(s.next_action || ''), s.next_action);
check('second laptop: no "You have active tasks" from the first laptop', !/active tasks/i.test(s.next_action || ''), s.next_action);
check('second laptop: name_clash true, not actionable', s.name_clash === true && s.actionable === false, JSON.stringify({ c: s.name_clash, a: s.actionable }));
let r = await benB('claim_task', { id: t2.id });
check('second laptop: claim refused', /Another laptop is already using the name ben-claude/.test(r.error || ''), JSON.stringify(r));
r = await benB('update_task', { id: t1.id, status: 'in_progress' });
check('second laptop: status change refused', /Another laptop is already using the name/.test(r.error || ''), JSON.stringify(r));
r = await benB('release_task', { id: t1.id });
check('second laptop: release refused', /Another laptop/.test(r.error || ''), JSON.stringify(r));
r = await benB('claim_role', { role: 'planner' });
check('second laptop: role claim refused', /Another laptop/.test(r.error || ''), JSON.stringify(r));
// Every tool that acts is refused, not only claims and task changes (the owner is the planner here, so
// cancel_task and decide_proposal would otherwise go through).
await human('/settings', 'PUT', { planner: 'ben-claude' });
const t3 = await human('/tasks', 'POST', { title: 'Third task', size: 'S' });
for (const [tool, args] of [['cancel_task', { id: t3.id, reason: 'duplicate' }], ['create_task', { title: 'From the second laptop' }], ['lock_files', { paths: ['package.json'] }],
  ['report_usage_limit', { note: 'not mine' }], ['set_activity', { doing: 'something' }], ['post', { text: 'hello' }], ['release_role', { role: 'planner' }],
  ['decide_proposal', { id: t3.id, approve: false }], ['claim_task', { id: t3.id, as: 'helper' }]]) {
  r = await benB(tool, args);
  check(`second laptop: ${tool}${args.as ? ' (as a subagent)' : ''} refused`, /Another laptop is already using the name ben-claude/.test(r.error || ''), JSON.stringify(r));
}
await benB('board_status', { model: 'Fake Model 1' });
const st = await human('/state');
const benRow = st.presence.find((p) => p.kind === 'agent' && p.name === 'ben-claude');
check('second laptop changed nothing: task kept, no lock, owner not out of usage, model untouched, planner kept',
  st.tasks.some((t) => t.id === t3.id && t.status === 'open') && !st.locks.length && !benRow?.limited && benRow?.model !== 'Fake Model 1' && st.settings.planner === 'ben-claude', JSON.stringify(benRow));
r = await fetch(`${board.base}/api/agents/ben-claude/limit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AGENT_TOKEN}`, 'X-Agent': 'ben-claude', 'X-Laptop': 'lapb2222' }, body: '{}' });
check('Stop hook usage-limit report from the second laptop (X-Laptop): 403', r.status === 403, r.status);
r = await benA('lock_files', { paths: ['shared/'], as: 'helper' });
check('the owner\'s subagents (ben-claude/helper) still work', r.ok === true, JSON.stringify(r));
await benA('unlock_files', { paths: ['shared/'], as: 'helper' });
await human(`/tasks/${t3.id}`, 'DELETE');
await human('/settings', 'PUT', { planner: '' });
const t1now = (await human('/state')).tasks.find((t) => t.id === t1.id);
check('the first laptop\'s task is untouched', t1now?.status === 'claimed' && t1now?.assignee === 'ben-claude', JSON.stringify(t1now).slice(0, 200));

s = await benA('board_status');
check('the first laptop still gets normal guidance', !s.name_clash && /#\d+/.test(s.next_action || ''), s.next_action);
r = await benA('update_task', { id: t1.id, status: 'in_progress' });
check('the first laptop may still change its task', !r.error && r.status === 'in_progress', JSON.stringify(r).slice(0, 200));

// Humans on the web board are not affected (no laptop on REST).
r = await api(`/tasks/${t2.id}`, { method: 'PATCH', body: { note: 'human note' }, token: board.token });
check('a human can still edit tasks over REST', r.status === 200, JSON.stringify(r));

// The first laptop's agent codes quietly for 10+ min (no board calls) while its task is in progress:
// it keeps the name, and the second laptop stays blocked (AG-6 lockout).
const quiet = (min) => db((d) => d.prepare("UPDATE name_owners SET seen_at = ? WHERE name = 'ben-claude'").run(Date.now() - min * 60e3));
quiet(11);
s = await benB('board_status');
check('owner silent 11 min with a task in progress: the second laptop is still told to stop', s.name_clash === true && /^Another laptop/.test(s.next_action || ''), s.next_action);
r = await benB('claim_task', { id: t2.id });
check('…and still can\'t claim', /Another laptop is already using the name ben-claude/.test(r.error || ''), JSON.stringify(r));
quiet(45);
s = await benB('board_status');
check('owner silent 45 min with a task in progress: still keeps the name', s.name_clash === true, s.next_action);
r = await benB('update_task', { id: t1.id, status: 'review' });
check('…and the second laptop still can\'t change the owner\'s task', /Another laptop/.test(r.error || ''), JSON.stringify(r));
s = await benA('board_status');
check('the quiet owner is not refused on its own task', !s.name_clash, s.next_action);
r = await benA('update_task', { id: t1.id, status: 'review', note: 'ready' });
check('…it moves its task to review', !r.error && r.status === 'review', JSON.stringify(r).slice(0, 200));
quiet(45);
r = await benB('claim_task', { id: t2.id });
check('a task in review also keeps the name', /Another laptop/.test(r.error || ''), JSON.stringify(r));

// A Stop-hook poll from the owner laptop (X-Laptop) refreshes its hold; one from another laptop doesn't.
await human(`/tasks/${t1.id}`, 'PATCH', { status: 'done' });
quiet(25);
await fetch(`${board.base}/api/next?agent=ben-claude`, { headers: { Authorization: `Bearer ${AGENT_TOKEN}`, 'X-Laptop': 'lapb2222' } });
let seenAt = db((d) => d.prepare("SELECT seen_at FROM name_owners WHERE name = 'ben-claude'").get().seen_at);
check('a poll from another laptop doesn\'t refresh the owner\'s hold', Date.now() - seenAt > 20 * 60e3, seenAt);
await fetch(`${board.base}/api/next?agent=ben-claude`, { headers: { Authorization: `Bearer ${AGENT_TOKEN}`, 'X-Laptop': 'lapa1111' } });
seenAt = db((d) => d.prepare("SELECT seen_at FROM name_owners WHERE name = 'ben-claude'").get().seen_at);
check('a Stop-hook poll from the owner laptop refreshes its hold', Date.now() - seenAt < 60e3, seenAt);

// No active tasks: the name is held for 30 min since the owner was last seen.
quiet(20);
s = await benB('board_status');
check('owner silent 20 min, no active tasks: still holds the name (30 min lease)', s.name_clash === true, s.next_action);

// The first laptop goes away for 30+ min with nothing active: the other laptop may take the name over (someone switched laptops).
quiet(31);
s = await benB('board_status');
check('owner gone 30+ min with no active tasks: the second laptop takes the name over', !s.name_clash && !/Another laptop/.test(s.next_action || ''), s.next_action);
s = await benA('board_status');
check('…and now the first laptop is the one told to stop', s.name_clash === true, s.next_action);

// Without ?laptop= (older setups) nothing changes.
const old1 = await agent('olduser');
const oc = await old1('claim_task', { id: t2.id });
check('no laptop id: claims work as before', !oc.error && oc.status === 'claimed', JSON.stringify(oc).slice(0, 200));

// ================= JOIN-4: join's name check before anyone has connected =================
r = await api('/names/alice?laptop=homealice1');
check('GET /names/:name: a new name is free', r.status === 200 && r.body.taken === false && r.body.name === 'alice' && Array.isArray(r.body.holders), JSON.stringify(r));
r = await api('/names/alice', { method: 'POST', body: { laptop: 'homealice1', person: 'alice' } });
check('POST /names/:name reserves it', r.status === 200 && r.body.reserved === true && r.body.taken === false, JSON.stringify(r));
r = await api('/names/Alice?laptop=otherlap22');
const h0 = r.body.holders?.[0];
check('another laptop sees it taken before any agent connected', r.body.taken === true && h0?.agent === 'alice' && h0?.connected === false && h0?.online === false, JSON.stringify(r.body));
r = await api('/names/alice?laptop=homealice1');
check('the reserving laptop does not see its own name as taken', r.body.taken === false, JSON.stringify(r.body));
r = await api('/names/alice', { method: 'POST', body: { laptop: 'homealice1', person: 'alice' }, token: board.token });
check('reserving works with the board token too', r.status === 200 && r.body.reserved === true, JSON.stringify(r));
r = await api('/names/alice', { method: 'POST', body: {} });
check('reserving without a laptop id: 400', r.status === 400 && /laptop is required/.test(r.body.error || ''), JSON.stringify(r));
// Names and person are 1-64 of letters, digits, _ . - (strings only).
for (const bad of ['a b', 'x'.repeat(65), 'bad%2Fslash', 'semi%3Bcolon', '%C3%A9t%C3%A9']) {
  r = await api(`/names/${bad}?laptop=homealice1`);
  check(`GET /names/${bad.slice(0, 20)}: 400`, r.status === 400 && /1-64 letters/.test(r.body.error || ''), JSON.stringify(r));
  r = await api(`/names/${bad}`, { method: 'POST', body: { laptop: 'homealice1' } });
  check(`POST /names/${bad.slice(0, 20)}: 400`, r.status === 400, JSON.stringify(r));
}
for (const person of [42, ['alice'], { x: 1 }, 'has space', '', 'y'.repeat(65)]) {
  r = await api('/names/valid-name', { method: 'POST', body: { laptop: 'homealice1', person } });
  check(`POST /names: person ${JSON.stringify(person).slice(0, 20)} is 400`, r.status === 400 && /person must be/.test(r.body.error || ''), JSON.stringify(r));
}
r = await api(`/names/${'z'.repeat(64)}`, { method: 'POST', body: { laptop: 'homealice1', person: 'some.one_1-x' } });
check('a 64-character name and a person with . _ - are fine', r.status === 200 && r.body.reserved === true, JSON.stringify(r));

// Multi-tool join reserves "carol-claude" with person "carol": the person name is taken too.
await api('/names/carol-claude', { method: 'POST', body: { laptop: 'lapcarol1', person: 'carol' } });
r = await api('/names/carol?laptop=lapzzz999');
check('a person name is taken when one of its agent names is reserved', r.body.taken === true && r.body.holders[0]?.agent === 'carol-claude' && r.body.holders[0]?.person === 'carol', JSON.stringify(r.body));

// Once an agent is online under the name, another laptop can't take the reservation.
await agent('ben-claude', { laptop: 'lapb2222', person: 'ben' }).then((c) => c('board_status'));
r = await api('/names/ben-claude', { method: 'POST', body: { laptop: 'lapnew333', person: 'ben' } });
check('reserving a name another laptop\'s agent is online under: reserved false, taken', r.status === 200 && r.body.reserved === false && r.body.taken === true && r.body.holders[0]?.online === true && r.body.holders[0]?.connected === true, JSON.stringify(r.body));
r = await api('/names/ben?laptop=lapnew333');
check('…and its person name is taken too', r.body.taken === true, JSON.stringify(r.body));

// A reservation never blocks an agent: the first one to connect owns the name.
const al = await agent('alice', { laptop: 'otherlap22', person: 'alice' });
s = await al('board_status');
check('an agent connecting under a name another laptop only reserved is not blocked', !s.name_clash, s.next_action);
r = await api('/names/alice?laptop=homealice1');
check('then the reserving laptop sees it taken by a connected agent', r.body.taken === true && r.body.holders[0]?.connected === true, JSON.stringify(r.body));

// Agents from before laptop ids are reported as taken.
r = await api('/names/olduser?laptop=anylap123');
check('an agent with no laptop id counts as taken', r.body.taken === true && r.body.holders[0]?.agent === 'olduser', JSON.stringify(r.body));

// The viewer token can't use it.
const { viewerTokenFor } = await import('../src/tokens.js');
r = await api('/names/alice?laptop=x', { token: viewerTokenFor(board.token) });
check('viewer token: 403', r.status === 403, JSON.stringify(r));

await finish(R, { board });
