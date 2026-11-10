// Board features from live use: case-insensitive names, planner reservations, task proposals,
// integrator modes (specific / whoever is free), busy vs idle, per-agent task limits, usage-limit
// marks, planner extra slots, PR links, and /api/next for the Stop hook.
// Starts its own throwaway boards. Run all suites with: npm test
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startBoard, finish, rest, Client, StreamableHTTPClientTransport } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';

const board = await startBoard();
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + String(x).slice(0, 300) : ''}`);
const AGENT_TOKEN = agentTokenFor(board.token);
const err = (r) => (r && r.error) || '';
const human = (p, method = 'GET', body, who = 'dana') => rest(board, who, p, method, body);
const state = () => human('/state');
const agentP = async (name) => (await state()).presence.find((p) => p.kind === 'agent' && p.name === name);
const db = (fn) => { const d = new DatabaseSync(path.join(board.dataDir, 'board.db')); try { return fn(d); } finally { d.close(); } };
const http = async (p, method, body, token = board.token) => {
  const r = await fetch(`${board.base}/api${p}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Agent': 'dana' }, body: body && JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

// An agent connecting the way join configures it: agent token + plan + slots in the URL.
async function agent(name, { client = 'claude-code', plan, slots } = {}) {
  const q = new URLSearchParams({ agent: name, token: AGENT_TOKEN, ...(plan ? { plan } : {}), ...(slots ? { slots: String(slots) } : {}) });
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
const codex = (name) => agent(name, { client: 'codex-mcp-client', plan: 'ChatGPT Edu', slots: 1 });
const newTask = (title, extra = {}) => human('/tasks', 'POST', { title, size: 'S', ...extra });

// ================= 1. names are case-insensitive =================
await agent('Dana-claude');
await human('/messages', 'POST', { text: 'hi @Emil-Codex and @Dana-claude.' }, 'Dana');
let st = await state();
check('agent name from the URL is stored lowercase', st.presence.some((p) => p.kind === 'agent' && p.name === 'dana-claude') && !st.presence.some((p) => p.name === 'Dana-claude'), st.presence.map((p) => p.name).join(','));
check('human name from X-Agent is stored lowercase', st.presence.some((p) => p.kind === 'human' && p.name === 'dana') && !st.presence.some((p) => p.name === 'Dana'));
const hi = st.events.find((e) => /hi @Emil-Codex/.test(e.text));
check('message author and mentions are lowercase', hi?.author === 'dana' && JSON.stringify(hi?.data?.mentions) === JSON.stringify(['emil-codex', 'dana-claude']), JSON.stringify(hi));
// An older board with mixed-case rows gets merged once.
await board.stop();
db((d) => {
  d.prepare("INSERT INTO presence_v2 (name, kind, last_seen) VALUES ('Dana', 'human', ?)").run(Date.now());
  d.prepare("INSERT INTO tasks (title, status, assignee, created_by, created_at, updated_at) VALUES ('old task', 'claimed', 'Dana-claude', 'Dana', ?, ?)").run(Date.now(), Date.now());
  d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('planner', 'Dana-claude')").run();
  d.prepare("DELETE FROM settings WHERE key = '_names_lowercase'").run();
});
await board.relaunch();
st = await state();
const humans = st.presence.filter((p) => p.kind === 'human' && p.name.toLowerCase() === 'dana');
check('migration merges "Dana" and "dana" into one person', humans.length === 1 && humans[0].name === 'dana', JSON.stringify(humans));
const old = st.tasks.find((t) => t.title === 'old task');
check('migration lowercases task assignee and creator', old?.assignee === 'dana-claude' && old?.created_by === 'dana', JSON.stringify(old));
check('migration lowercases the planner setting', st.settings.planner === 'dana-claude', st.settings.planner);

// ================= 2. planner reservations =================
await board.restart();
await human('/settings', 'PUT', { goal: 'A test app for planner reservations.' });
let pl = await agent('pl');
let w1 = await codex('w1');
let w2 = await codex('w2');
check('pl becomes planner', !err(await pl('claim_role', { role: 'planner' })));
const r1 = await pl('create_task', { title: 'reserved for w2', size: 'S', reserved_for: 'W2' });
check('planner can create a task reserved for an agent (name lowercased)', r1.reserved_for === 'w2' && r1.status === 'open', JSON.stringify(r1));
check('reserved task refused for others', /reserved for w2/.test(err(await w1('claim_task', { id: r1.id }))));
check('non-planner cannot reserve on create', /Only the planner and humans/.test(err(await w1('create_task', { title: 'x', reserved_for: 'w1' }))));
const r2 = await pl('create_task', { title: 'later reserved', size: 'S' });
const r2u = await pl('update_task', { id: r2.id, reserved_for: 'w1' });
check('planner can reserve an open task with update_task', r2u.reserved_for === 'w1', JSON.stringify(r2u).slice(0, 200));
check('non-planner cannot reserve with update_task', /Only the planner and humans/.test(err(await w2('update_task', { id: r2.id, reserved_for: 'w2' }))));
check('reserved agent sees its task first', /Claimable now[^\n]*: #\d+ [^\n]*reserved for you/.test((await w2('board_status')).next_action));
check('reserved agent can claim it', !err(await w2('claim_task', { id: r1.id })));

// ================= 3. proposals =================
const p1 = await w1('create_task', { title: 'proposed idea', size: 'M' });
check('non-planner task becomes a proposal while the planner is online', p1.status === 'proposed', JSON.stringify(p1).slice(0, 200));
st = await state();
const pev = st.events.find((e) => e.task_id === p1.id && e.kind === 'task_created');
check('proposal event @mentions the planner', /@pl/.test(pev?.text || '') && (pev?.data?.mentions || []).includes('pl'), pev?.text);
check('proposed task cannot be claimed', /only proposed/.test(err(await w1('claim_task', { id: p1.id }))));
check('non-planner cannot decide a proposal', /Only the planner/.test(err(await w2('decide_proposal', { id: p1.id, approve: true }))));
const ap = await pl('decide_proposal', { id: p1.id, approve: true, size: 'S', note: 'good one' });
check('planner approves: open, size changed', ap.status === 'open' && ap.size === 'S', JSON.stringify(ap).slice(0, 200));
const p2 = await w1('create_task', { title: 'duplicate idea' });
const rj = await pl('decide_proposal', { id: p2.id, approve: false, note: 'duplicate of #1' });
check('planner rejects: task deleted', rj.rejected === p2.id && /not found/.test(err(await pl('get_task', { id: p2.id }))), JSON.stringify(rj));
st = await state();
const rev = st.events.find((e) => e.task_id === p2.id && e.kind === 'task_deleted');
check('rejection @mentions the proposer with the reason', /@w1/.test(rev?.text || '') && /duplicate of #1/.test(rev?.text || ''), rev?.text);
const p3 = await w2('create_task', { title: 'human approves this' });
const hd = await human(`/tasks/${p3.id}/decide`, 'POST', { approve: true });
check('human can approve a proposal on the web board', hd.status === 'open', JSON.stringify(hd).slice(0, 200));
check('human-created tasks are never proposals', (await newTask('human task')).status === 'open');
await human('/settings', 'PUT', { planner: 'ghost' });
check('planner offline (never connected): tasks are created open', (await w1('create_task', { title: 'no planner around' })).status === 'open');
await human('/settings', 'PUT', { planner: 'pl' });
check('planner may create tasks directly', (await pl('create_task', { title: 'planner task' })).status === 'open');

// ================= 4. integrator modes =================
await board.restart();
await human('/settings', 'PUT', { goal: 'A test app for integrator modes.' });
let a = await agent('a');
let b = await agent('b');
let c = await agent('c');
const t1 = await newTask('first feature');
const t2 = await newTask('second feature');
await a('claim_task', { id: t1.id });
await a('update_task', { id: t1.id, status: 'review', note: 'ready' });
await human('/settings', 'PUT', { integrator: '*' });
check('integrator "*" stored', (await state()).settings.integrator === '*');
check('claim_role integrator refused when merging is shared', /claim_review/.test(err(await a('claim_role', { role: 'integrator' }))));
check('next_action offers the review to free agents', /Reviews waiting[^\n]*claim_review/.test((await b('board_status')).next_action));
check('author cannot review its own work while others are online', /your own work/.test(err(await a('claim_review', { id: t1.id }))));
const cr = await b('claim_review', { id: t1.id });
check('another agent takes the review', cr.reviewer === 'b', JSON.stringify(cr).slice(0, 200));
check('a third agent is refused: already reviewing', /already reviewing/.test(err(await c('claim_review', { id: t1.id }))));
check('non-reviewer cannot move it out of review', !!err(await c('update_task', { id: t1.id, status: 'done' })));
await a('claim_task', { id: t2.id });
await a('update_task', { id: t2.id, status: 'review' });
check('one review at a time', /Finish your review of #/.test(err(await b('claim_review', { id: t2.id }))));
const back = await b('update_task', { id: t1.id, status: 'in_progress', note: 'tests fail on CI' });
check('reviewer can send it back to in_progress', back.status === 'in_progress' && !back.reviewer, JSON.stringify(back).slice(0, 200));
st = await state();
const bev = [...st.events].reverse().find((e) => e.task_id === t1.id && e.kind === 'task_updated');
check('sending back @mentions the author', /@a\b/.test(bev?.text || '') && (bev?.data?.mentions || []).includes('a'), bev?.text);
check('author\'s next_action says it was sent back', /Sent back from review/.test((await a('board_status')).next_action));
await a('update_task', { id: t1.id, status: 'review', note: 'fixed' });
check('reviewer takes it again', (await b('claim_review', { id: t1.id })).reviewer === 'b');
check('reviewer can mark it done', (await b('update_task', { id: t1.id, status: 'done', note: 'merged' })).status === 'done');
await human('/settings', 'PUT', { integrator: 'c' });
check('specific integrator: others cannot claim_review', /c is the integrator/.test(err(await b('claim_review', { id: t2.id }))));
check('specific integrator may move review → done', (await c('update_task', { id: t2.id, status: 'done' })).status === 'done');

// ================= 5. busy vs idle =================
await board.restart();
await human('/settings', 'PUT', { goal: 'A test app for busy detection.' });
let x = await agent('x');
let y = await agent('y');
let z = await agent('z');
await y('wait_for_events', { timeout_s: 1 });
let py = await agentP('y');
check('agent that only reads/waits is idle', py && py.busy === false && py.doing === null, JSON.stringify(py));
await z('set_activity', { doing: 'fixing CI config for Dana' });
let pz = await agentP('z');
check('set_activity makes it busy with that text', pz.busy === true && pz.doing === 'fixing CI config for Dana' && pz.activity === 'fixing CI config for Dana', JSON.stringify(pz));
await z('set_activity', { doing: '' });
pz = await agentP('z');
check('set_activity("") clears it (idle again)', pz.busy === false && pz.activity === null, JSON.stringify(pz));
await y('post', { text: 'just chatting' });
check('chatting alone does not make it busy', (await agentP('y')).busy === false);
await y('lock_files', { paths: ['README.md'], reason: 'editing the README' });
py = await agentP('y');
check('a real board call makes it busy for a while', py.busy === true && /working/.test(py.doing || '') && py.last_tool === 'lock_files', JSON.stringify(py));
await x('claim_role', { role: 'planner' });
check('planner with no tasks yet is "planning the task list"', (await agentP('x')).doing === 'planning the task list');
const bt = await newTask('busy feature');
await y('claim_task', { id: bt.id });
check('agent holding a task shows it', (await agentP('y')).doing === `#${bt.id} busy feature`);
await y('update_task', { id: bt.id, status: 'review' });
await human('/settings', 'PUT', { integrator: '*' });
await z('claim_review', { id: bt.id });
check('reviewer shows "reviewing #N"', (await agentP('z')).doing === `reviewing #${bt.id} to merge`, (await agentP('z')).doing);

// ================= 6. per-agent task limit =================
await board.restart();
await human('/settings', 'PUT', { goal: 'A test app for task limits.' });
let p = await codex('p');
const L = [await newTask('lim 1'), await newTask('lim 2'), await newTask('lim 3')];
check('one-slot agent claims one', !err(await p('claim_task', { id: L[0].id })));
check('…and is refused a second', /may hold 1 at once/.test(err(await p('claim_task', { id: L[1].id }))));
const set3 = await http('/agents/p', 'PATCH', { slots: 3 });
check('human sets the limit to 3', set3.status === 200 && set3.body.slots === 3 && set3.body.slots_override === 3 && set3.body.base_slots === 1, JSON.stringify(set3));
check('now a second and third claim work', !err(await p('claim_task', { id: L[1].id })) && !err(await p('claim_task', { id: L[2].id })));
check('next_action mentions the web board limit', /3 of 3[^\n]*set on the web board/.test((await p('board_status')).next_action));
const clr = await http('/agents/P', 'PATCH', { slots: null });
check('slots: null restores the plan default (name case-insensitive)', clr.status === 200 && clr.body.slots === 1 && clr.body.slots_override === null, JSON.stringify(clr));
check('slots: 0 is rejected with 400', (await http('/agents/p', 'PATCH', { slots: 0 })).status === 400);
check('unknown agent is rejected', (await http('/agents/nobody', 'PATCH', { slots: 2 })).status === 400);
check('agent token cannot set limits', (await http('/agents/p', 'PATCH', { slots: 5 }, AGENT_TOKEN)).status === 403);

// ================= 7. usage-limit mark =================
await board.restart();
await human('/settings', 'PUT', { goal: 'A test app for usage limits.' });
let u = await codex('u');
let v = await agent('v');
const U1 = await newTask('u task'); const U2 = await newTask('spare task');
await u('claim_task', { id: U1.id });
const until = Date.now() + 3600e3;
const lim = await http('/agents/u', 'PATCH', { limited: true, until, note: '5h cap' });
check('human marks u as out of usage', lim.status === 200 && lim.body.limited?.until === until && lim.body.limited?.note === '5h cap', JSON.stringify(lim));
st = await state();
const lev = [...st.events].reverse().find((e) => /hit its usage limit/.test(e.text));
check('@all message lists its held tasks', /@all u hit its usage limit/.test(lev?.text || '') && lev.text.includes(`#${U1.id}`), lev?.text);
check('others\' next_action lists its tasks for takeover', new RegExp(`usage limit: #${U1.id}`).test((await v('board_status')).next_action));
const rel = await v('release_task', { id: U1.id, note: 'owner out of usage' });
check('another agent may release the limited agent\'s task', rel.status === 'open', JSON.stringify(rel).slice(0, 200));
check('…and claim it', !err(await v('claim_task', { id: U1.id })));
// u is idle now but out of usage, so it doesn't count as an idle teammate: v may take the last task.
check('limited agent is not counted as idle (v may take the last task)', !err(await v('claim_task', { id: U2.id })), err(await v('board_status')));
const nb = await fetch(`${board.base}/api/next?agent=u`, { headers: { Authorization: `Bearer ${AGENT_TOKEN}` } }).then((r) => r.json());
check('limited agent is told about the mark', /out of usage/.test(nb.next_action || ''), nb.next_action);
// A call well after the mark means it's back.
db((d) => d.prepare("UPDATE presence_v2 SET limited_at = ? WHERE name = 'u'").run(Date.now() - 120e3));
await u('post', { text: 'back again' });
check('a board call 60s+ after the mark clears it', (await agentP('u')).limited === null);
st = await state();
check('the board says it is back', st.events.some((e) => /u is back/.test(e.text)));
await http('/agents/u', 'PATCH', { limited: true });
check('mark without a time', (await agentP('u')).limited?.until === null);
await http('/agents/u', 'PATCH', { limited: false });
check('limited: false clears it', (await agentP('u')).limited === null);

// ================= 8. planner extra slots =================
await board.restart();
await human('/settings', 'PUT', { goal: 'A test app for planner extra slots.' });
let pp = await agent('pp', { plan: 'Claude Pro', slots: 1 });
let ww = await codex('ww');
await pp('claim_role', { role: 'planner' });
const E = { w: await newTask('ww task'), s1: await newTask('s1'), s2: await newTask('s2'), s3: await newTask('s3'), big: await newTask('big one', { size: 'L' }) };
await ww('claim_task', { id: E.w.id });
check('planner claims its normal slot', !err(await pp('claim_task', { id: E.s1.id })));
const pst = await pp('board_status');
check('next_action offers extra helper slots', /extra helper/.test(pst.next_action), pst.next_action.slice(0, 300));
check('planner may take an extra S task when nobody else is free', !err(await pp('claim_task', { id: E.s2.id })), err(await pp('claim_task', { id: E.s2.id })));
check('extra slots never take L tasks', /S\/M tasks only/.test(err(await pp('claim_task', { id: E.big.id }))));
check('a second extra (planner_extra = 2) is allowed', !err(await pp('claim_task', { id: E.s3.id })), err(await pp('claim_task', { id: E.s3.id })));
// Only an L task is left: the extras in use must stay counted (no "3 of 1 at once").
const ppP = await agentP('pp');
check('presence keeps the extra slots in use counted', ppP.extra_slots === 2 && ppP.slots === 3 && ppP.base_slots === 1 && ppP.slots >= 3, JSON.stringify(ppP));
const E4 = await newTask('s4');
await pp('release_task', { id: E.s3.id });
await human('/settings', 'PUT', { planner_extra: 0 });
check('planner_extra 0: no extra claims', /may hold/.test(err(await pp('claim_task', { id: E4.id }))));

// ================= 9. pull requests =================
await board.restart();
await human('/settings', 'PUT', { goal: 'A test app for PR links.' });
let pa = await agent('pa');
const P1 = await newTask('pr one'); const P2 = await newTask('pr two');
await pa('claim_task', { id: P1.id });
const up1 = await pa('update_task', { id: P1.id, status: 'review', note: 'done, see https://github.com/x/y/pull/7 for details' });
check('PR URL in the note is stored as pr_url', up1.pr_url === 'https://github.com/x/y/pull/7', up1.pr_url);
await pa('claim_task', { id: P2.id });
const up2 = await pa('update_task', { id: P2.id, status: 'review', pr_url: 'https://github.com/x/y/pull/8' });
check('explicit pr_url is stored', up2.pr_url === 'https://github.com/x/y/pull/8');
check('a non-http pr_url is rejected', /pr_url/.test(err(await pa('update_task', { id: P2.id, pr_url: 'javascript:alert(1)' }))));
st = await state();
const sp = st.tasks.find((t) => t.id === P1.id);
check('state has pr_url and pr: null (no gh in tests)', sp.pr_url === 'https://github.com/x/y/pull/7' && sp.pr === null, JSON.stringify(sp));

// ================= 10. /api/next for the Stop hook =================
await board.restart();
await human('/settings', 'PUT', { goal: 'A test app for the hook endpoint.' });
let n1 = await codex('n1');
const N1 = await newTask('next one'); await newTask('next two');
const next = (name) => fetch(`${board.base}/api/next?agent=${name}`, { headers: { Authorization: `Bearer ${AGENT_TOKEN}` } }).then((r) => r.json());
const na = await next('n1');
check('/api/next with the agent token: actionable when work is claimable', na.actionable === true && /claimable/.test(na.reason) && /Claimable now/.test(na.next_action), JSON.stringify(na).slice(0, 300));
await n1('claim_task', { id: N1.id });
await n1('update_task', { id: N1.id, status: 'blocked', note: 'need a key' });
const nb2 = await next('n1');
check('/api/next: not actionable at capacity with only a blocked task', nb2.actionable === false && typeof nb2.reason === 'string', JSON.stringify(nb2).slice(0, 300));
check('/api/next has phase and next_action', nb2.phase === 'building' && typeof nb2.next_action === 'string');

// ================= 11. regressions from the code review =================
// /api/next: holding a task in progress is not by itself a reason to nudge.
let n2 = await codex('n2');
const N2 = (await state()).tasks.find((t) => t.title === 'next two');
await n2('claim_task', { id: N2.id });
await n2('update_task', { id: N2.id, status: 'in_progress' });
const nn = await next('n2');
check('/api/next: an in-progress task alone is not actionable', nn.actionable === false, JSON.stringify(nn).slice(0, 300));

// --- PR link protection and merging your own work ---
await board.restart();
await human('/settings', 'PUT', { goal: 'A test app for PR link protection.', integrator: '*' });
const o1 = await agent('o1'); const rv = await agent('rv'); const by = await agent('by');
const PT = await newTask('protected pr');
await o1('claim_task', { id: PT.id });
let pt = await o1('update_task', { id: PT.id, status: 'review', note: 'ready https://github.com/o/r/pull/1' });
check('owner note sets pr_url when none is set', pt.pr_url === 'https://github.com/o/r/pull/1', pt.pr_url);
check('a bystander cannot set pr_url on someone else\'s task', /PR link/.test(err(await by('update_task', { id: PT.id, pr_url: 'https://github.com/o/r/pull/999' }))));
check('owner cannot merge its own review while another agent is online (whoever is free)', /waiting for review/.test(err(await o1('update_task', { id: PT.id, status: 'done' }))));
await rv('claim_review', { id: PT.id });
await rv('update_task', { id: PT.id, note: 'same bug as https://github.com/o/r/pull/12' });
check('a reviewer note mentioning another PR does not replace pr_url', (await state()).tasks.find((t) => t.id === PT.id).pr_url === 'https://github.com/o/r/pull/1');
await o1('update_task', { id: PT.id, note: 'also see https://github.com/o/r/pull/2' });
check('owner note does not replace an existing pr_url', (await state()).tasks.find((t) => t.id === PT.id).pr_url === 'https://github.com/o/r/pull/1');
pt = await rv('update_task', { id: PT.id, pr_url: 'https://github.com/o/r/pull/3' });
check('the reviewer may set pr_url explicitly', pt.pr_url === 'https://github.com/o/r/pull/3', JSON.stringify(pt).slice(0, 200));
pt = await rv('update_task', { id: PT.id, status: 'blocked', note: "can't run the tests: missing DB" });
check('the merger may set review → blocked', pt.status === 'blocked', JSON.stringify(pt).slice(0, 200));
// A specific integrator: the owner can't mark its own reviewed task done; the integrator can.
await human('/settings', 'PUT', { integrator: 'by' });
const PT2 = await newTask('integrator merges');
await o1('claim_task', { id: PT2.id });
await o1('update_task', { id: PT2.id, status: 'review' });
check('owner cannot mark its own review done when a specific integrator is set', /waiting for by/.test(err(await o1('update_task', { id: PT2.id, status: 'done' }))));
check('the integrator can mark it done', (await by('update_task', { id: PT2.id, status: 'done' })).status === 'done');

// --- claim_review: needs an integrator mode, and a free slot in "whoever is free" mode ---
await board.restart();
await human('/settings', 'PUT', { goal: 'A test app for review capacity.' });
const c1 = await codex('c1'); const c2 = await codex('c2'); const c3 = await codex('c3');
const RV1 = await newTask('to review'); const X1 = await newTask('x1'); const X2 = await newTask('x2'); const X3 = await newTask('x3');
await c1('claim_task', { id: RV1.id }); await c1('update_task', { id: RV1.id, status: 'review' });
check('claim_review refused when nobody merges yet (hint claim_role)', /claim_role\("integrator"\)/.test(err(await c2('claim_review', { id: RV1.id }))));
await human('/settings', 'PUT', { integrator: '*' });
await c2('claim_task', { id: X1.id });
check('at capacity: claim_review refused while another agent has a free slot', /no free slot/.test(err(await c2('claim_review', { id: RV1.id }))));
await c3('claim_task', { id: X2.id }); await c1('claim_task', { id: X3.id });
const crv = await c2('claim_review', { id: RV1.id });
check('at capacity: claim_review allowed when nobody else has room', !err(crv) && crv.reviewer === 'c2', JSON.stringify(crv).slice(0, 200));

// --- proposals: planning phase, rejection cleanup, mentions, absent planner ---
await board.restart();
await human('/settings', 'PUT', { goal: 'A test app for proposal regressions.' });
const plr = await agent('pl'); const wk = await codex('wk');
await plr('claim_role', { role: 'planner' });
const early = await wk('create_task', { title: 'early idea' });
check('an early proposal is proposed', early.status === 'proposed', JSON.stringify(early).slice(0, 200));
const pls = await plr('board_status');
check('an early proposal does not skip planning (phase needs_plan, role planner)', pls.phase === 'needs_plan' && pls.your_role === 'planner', `${pls.phase} ${pls.your_role}`);
check('planner is still "planning the task list"', (await agentP('pl')).doing === 'planning the task list', (await agentP('pl')).doing);
const dep = await newTask('depends on the idea', { depends_on: [early.id] });
await plr('decide_proposal', { id: early.id, approve: false, note: 'out of scope' });
st = await state();
check('rejecting a proposal removes it from other tasks\' depends_on', JSON.stringify(st.tasks.find((t) => t.id === dep.id).depends_on) === '[]', JSON.stringify(st.tasks.find((t) => t.id === dep.id)?.depends_on));
const rej = st.events.find((e) => /rejected proposal #/.test(e.text) && e.task_id === early.id);
check('rejection @mentions the proposer', (rej?.data?.mentions || []).includes('wk'), JSON.stringify(rej));
const good = await wk('create_task', { title: 'good idea' });
await plr('decide_proposal', { id: good.id, approve: true });
const appr = (await state()).events.find((e) => e.task_id === good.id && /approved/.test(e.text));
check('approval @mentions the proposer', (appr?.data?.mentions || []).includes('wk'), JSON.stringify(appr));
const waiting = await wk('create_task', { title: 'waiting idea' });
check('a later proposal waits for the planner', waiting.status === 'proposed');
await http('/agents/pl', 'PATCH', { limited: true });
await wk('board_status');
st = await state();
check('planner out of usage: waiting proposals become open', st.tasks.find((t) => t.id === waiting.id)?.status === 'open', st.tasks.find((t) => t.id === waiting.id)?.status);
const auto = st.events.find((e) => e.task_id === waiting.id && /approved automatically/.test(e.text));
check('automatic approval is announced and @mentions the proposer', !!auto && (auto.data?.mentions || []).includes('wk'), JSON.stringify(auto));

await finish(R, { board });
