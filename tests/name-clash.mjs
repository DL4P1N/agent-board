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
const t1now = (await human('/state')).tasks.find((t) => t.id === t1.id);
check('the first laptop\'s task is untouched', t1now?.status === 'claimed' && t1now?.assignee === 'ben-claude', JSON.stringify(t1now).slice(0, 200));

s = await benA('board_status');
check('the first laptop still gets normal guidance', !s.name_clash && /#\d+/.test(s.next_action || ''), s.next_action);
r = await benA('update_task', { id: t1.id, status: 'in_progress' });
check('the first laptop may still change its task', !r.error && r.status === 'in_progress', JSON.stringify(r).slice(0, 200));

// Humans on the web board are not affected (no laptop on REST).
r = await api(`/tasks/${t2.id}`, { method: 'PATCH', body: { note: 'human note' }, token: board.token });
check('a human can still edit tasks over REST', r.status === 200, JSON.stringify(r));

// The first laptop goes away for 10+ min: the other laptop may take the name over (someone switched laptops).
db((d) => d.prepare("UPDATE name_owners SET seen_at = ? WHERE name = 'ben-claude'").run(Date.now() - 11 * 60e3));
s = await benB('board_status');
check('owner gone 10+ min: the second laptop takes the name over', !s.name_clash && !/Another laptop/.test(s.next_action || ''), s.next_action);
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
