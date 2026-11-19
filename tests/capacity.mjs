// Agent-side rules: plan capacity, fair sharing, reservations, sizes, stale takeover, freeze exceptions,
// ownership, input validation, lock coverage, agent-token limits, persistent freeze announcements.
// Starts its own throwaway board. Run all suites with: npm test
import { startBoard, finish, rest, ageTask, Client, StreamableHTTPClientTransport } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';

const board = await startBoard();
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const AGENT_TOKEN = agentTokenFor(board.token);

// An agent connecting the way join configures it: agent token + plan + slots in the URL.
async function agent(name, { client = 'claude-code', plan, slots, token = AGENT_TOKEN } = {}) {
  const q = new URLSearchParams({ agent: name, token, ...(plan ? { plan } : {}), ...(slots ? { slots: String(slots) } : {}) });
  const c = new Client({ name: client, version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${board.base}/mcp?${q}`)));
  const call = async (tool, args = {}) => {
    const r = await c.callTool({ name: tool, arguments: args });
    const t = r.content[0].text;
    let body; try { body = JSON.parse(t); } catch { body = t; }
    return r.isError ? { error: t } : body;
  };
  await call('board_status'); // started (someone typed /board)
  return call;
}
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);
const err = (r) => (r && r.error) || '';

// ---- team: one big Claude plan, one small Claude plan, two one-slot Codex agents ----
const max = await agent('ana', { plan: 'Claude Max 20x', slots: 3 });
const pro = await agent('ben', { plan: 'Claude Pro', slots: 1 });
const cx1 = await agent('cy', { client: 'codex-mcp-client', plan: 'ChatGPT Edu', slots: 1 });
const cx2 = await agent('dee', { client: 'codex-mcp-client', plan: 'ChatGPT Edu', slots: 1 });
await max('set_goal', { goal: 'A small test app for capacity rules.' });
const pres = (await human('/state')).presence.filter((p) => p.kind === 'agent');
check('plan + slots recorded from the agent URL', pres.find((p) => p.name === 'ana')?.slots === 3 && pres.find((p) => p.name === 'ana')?.plan === 'Claude Max 20x' && pres.find((p) => p.name === 'cy')?.slots === 1);

await max('claim_role', { role: 'planner' });
const st0 = await max('board_status');
check('planner told the team capacity and how many tasks to write', /total capacity 6/.test(st0.next_action) && /at least 12 tasks/.test(st0.next_action) && /ask_human/.test(st0.next_action), st0.next_action.slice(0, 200));

// ---- input validation ----
check('depends_on must be existing ids', /unknown task id/.test(err(await max('create_task', { title: 'x', depends_on: [999] }))));
check('priority out of range refused', !!err(await max('create_task', { title: 'x', priority: 7 })));
const badRest = await fetch(`${board.base}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${board.token}` }, body: JSON.stringify({ title: 'csv deps', depends_on: '1,2' }) }).then((r) => r.json());
check('REST depends_on as a string is validated, board keeps working', /unknown task id/.test(badRest.error || '') && (await max('board_status')).phase === 'needs_plan', JSON.stringify(badRest));
const malformed = await fetch(`${board.base}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${board.token}` }, body: '{oops' });
check('malformed JSON gets a JSON error', malformed.status === 400 && /not valid JSON/.test((await malformed.json()).error));

// ---- tasks of different sizes ----
const T = {};
for (const [k, size, pri] of [['big', 'L', 2], ['mid', 'M', 2], ['small', 'S', 2], ['small2', 'S', 2], ['bug', 'S', 1]]) T[k] = await max('create_task', { title: `${k} task`, size, priority: pri });
check('size stored', T.big.size === 'L' && T.small.size === 'S');
const order = (st) => (st.next_action.match(/Claimable now[^:]*: ([^\n]*)/) || [])[1] || '';
const maxList = order(await max('board_status'));
const cxList = order(await cx1('board_status'));
check('big-plan agent sees L before S (after priority)', maxList.indexOf('big task') < maxList.indexOf('small task'), maxList);
check('one-slot agent sees S before L', cxList.indexOf('small task') < cxList.indexOf('big task'), cxList);

// ---- capacity + fairness ----
check('ben (Pro, 1 slot) claims one', !err(await pro('claim_task', { id: T.mid.id })));
check('ben cannot hold a second (capacity)', /may hold 1 at once/.test(err(await pro('claim_task', { id: T.small.id }))));
check('ana claims her first', !err(await max('claim_task', { id: T.big.id })));
// open: small, small2, bug = 3; idle started agents: cy, dee = 2 → ana may take a second (3 > 2)
check('ana may take a second while there is enough for idle agents', !err(await max('claim_task', { id: T.bug.id })));
// open: small, small2 = 2; idle: cy, dee = 2 → fairness blocks ana
check('fairness: ana must leave the last tasks for idle cy/dee', /idle teammate/.test(err(await max('claim_task', { id: T.small.id }))));
check('next_action tells ana to leave work for idle agents', /have no task yet/.test((await max('board_status')).next_action));
check('cy (idle) can claim', !err(await cx1('claim_task', { id: T.small.id })));

// ---- reservations (humans only) ----
const agentReserve = await fetch(`${board.base}/api/tasks/${T.small2.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AGENT_TOKEN}` }, body: JSON.stringify({ reserved_for: 'ana' }) });
check('agent token cannot reserve tasks', agentReserve.status === 403);
await human(`/tasks/${T.small2.id}`, 'PATCH', { reserved_for: 'dee' });
check('reserved task refused for others', /reserved for dee/.test(err(await pro('claim_task', { id: T.small2.id }))));
check('reserved task listed for its agent', /reserved for you/.test((await cx2('board_status')).next_action));
check('reserved agent claims it', !err(await cx2('claim_task', { id: T.small2.id })));

// ---- ownership ----
const free = await max('create_task', { title: 'unclaimed', size: 'S' });
check('cannot mark an unclaimed task done', /Claim it first/.test(err(await pro('update_task', { id: free.id, status: 'done' }))));
check('cannot move someone else\'s task', /assigned to/.test(err(await pro('update_task', { id: T.small.id, status: 'review' }))));
check('cannot rewrite someone else\'s branch', /assigned to/.test(err(await pro('update_task', { id: T.small.id, branch: 'hijack' }))));
const asName = (await max('post', { text: 'helper says hi', as: 'ui/../../bob' }));
check('helper names are sanitised (no impersonation)', asName.author === 'ana/bob' || !String(asName.author).includes('..'), asName.author);

// ---- stale takeover ----
await ageTask(board, T.small.id, 20); // cy's task, cy online → only a ping
check('stale but owner online: release refused', /still online/.test(err(await pro('release_task', { id: T.small.id }))));
const offline = (await import('node:sqlite')).DatabaseSync;
{ const db = new offline(board.dataDir + '/board.db'); db.prepare("UPDATE presence_v2 SET last_seen = ? WHERE name = 'cy'").run(Date.now() - 30 * 60e3); db.close(); }
check('next_action lists the orphaned task', /owner went offline[^\n]*#/.test((await max('board_status')).next_action));
check('stale + owner offline: anyone may release it', (await pro('release_task', { id: T.small.id, note: 'owner offline' })).status === 'open');

// ---- locks cover folders, case and leading slash ----
check('lock a folder', (await max('lock_files', { paths: ['src/db/'] })).ok === true);
const c1 = await pro('lock_files', { paths: ['src/db/schema.sql'] });
check('file inside a locked folder conflicts', c1.ok === false);
await max('lock_files', { paths: ['package.json'] });
check('/Package.json conflicts with package.json', (await pro('lock_files', { paths: ['/Package.json'] })).ok === false);

// ---- a task in review holds no slot, so taking it back needs a free one (like unblocking) ----
{
  const eve = await agent('eve', { plan: 'Claude Pro', slots: 1 });
  const r1 = await human('/tasks', 'POST', { title: 'review then back', size: 'S' });
  const r2 = await human('/tasks', 'POST', { title: 'next while in review', size: 'S' });
  await eve('claim_task', { id: r1.id }); await eve('update_task', { id: r1.id, status: 'in_progress' });
  await eve('update_task', { id: r1.id, status: 'review' });
  const c2 = await eve('claim_task', { id: r2.id });
  check('with its task in review, a 1-slot agent can claim another', c2.assignee === 'eve', err(c2));
  const back = await eve('update_task', { id: r1.id, status: 'in_progress' });
  const active = (await human('/state')).tasks.filter((t) => t.assignee === 'eve' && ['claimed', 'in_progress'].includes(t.status)).map((t) => t.id);
  check('…but can\'t take the reviewed one back to in progress past its slots', /finish or release one before taking back/.test(err(back)) && active.join() === String(r2.id), `${err(back)} ${active}`);
  // The merger sending it back for fixes is not the owner taking a slot.
  await human('/settings', 'PUT', { integrator: 'ana' });
  const sent = await max('update_task', { id: r1.id, status: 'in_progress', note: 'tests fail' });
  check('the merger can still send it back for fixes', sent.status === 'in_progress', err(sent));
  await human('/settings', 'PUT', { integrator: '' });
  for (const t of [r1, r2]) await human(`/tasks/${t.id}`, 'DELETE');
}

// ---- freeze: priority-1 still claimable ----
const p1 = await max('create_task', { title: 'fix crash', priority: 1, size: 'S' });
const feat = await max('create_task', { title: 'new feature', priority: 2, size: 'S' });
await human('/settings', 'PUT', { deadline: new Date(Date.now() + 20 * 60e3).toISOString(), freeze_minutes: 60 });
check('freeze blocks a normal task', /Feature freeze/.test(err(await cx1('claim_task', { id: feat.id }))));
check('freeze allows a priority-1 bug fix', !err(await cx1('claim_task', { id: p1.id })));

// ---- agent token can't do human things ----
const asAgent = (p, method, body) => fetch(`${board.base}/api${p}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AGENT_TOKEN}` }, body: body && JSON.stringify(body) });
check('agent token: approve plan refused', (await asAgent('/settings', 'PUT', { plan_approved: true })).status === 403);
check('agent token: delete task refused', (await asAgent(`/tasks/${feat.id}`, 'DELETE')).status === 403);
check('agent token: reading state allowed', (await asAgent('/state', 'GET')).status === 200);
check('board token: still allowed', (await human(`/tasks/${feat.id}`, 'DELETE')).deleted === feat.id);

// ---- questions ----
const q = await pro('ask_human', { question: 'Which colour?' });
check('empty answer refused cleanly', /answer first/.test((await human(`/questions/${q.question_id}/answer`, 'POST', { answer: '  ' })).error || ''));

// ---- freeze announcements survive a restart ----
const count = async () => (await human('/state')).events.filter((e) => e.author === 'board' && /FEATURE FREEZE/.test(e.text)).length;
await new Promise((r) => setTimeout(r, 21000)); // announcer runs every 20 s
const before = await count();
await board.relaunch(); // same data, like a restart or --watch reload
await new Promise((r) => setTimeout(r, 21000));
const after = await count();
check('freeze announced once, not again after a restart', before === 1 && after === 1, `${before} → ${after}`);

await finish(R, { board });
