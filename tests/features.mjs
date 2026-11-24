// Board features from live use: case-insensitive names, planner reservations, task proposals,
// integrator modes (specific / whoever is free), busy vs idle, per-agent task limits, usage-limit
// marks, planner extra slots, PR links, /api/next for the Stop hook, and schema upgrades of older boards.
// Starts its own throwaway boards. Run all suites with: npm test
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startBoard, finish, rest, tempDir, Client, StreamableHTTPClientTransport } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';
import { Board } from '../src/board.js';
import { createBoardRuntime } from '../src/runtime.js';

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
await agent('Dana-claude'); await agent('Emil-Codex');
await human('/messages', 'POST', { text: 'hi @Emil-Codex and @Dana-claude. ping hit@3, see @fastify/rate-limit and @nobody' }, 'Dana');
let st = await state();
check('agent name from the URL is stored lowercase', st.presence.some((p) => p.kind === 'agent' && p.name === 'dana-claude') && !st.presence.some((p) => p.name === 'Dana-claude'), st.presence.map((p) => p.name).join(','));
check('human name from X-Agent is stored lowercase', st.presence.some((p) => p.kind === 'human' && p.name === 'dana') && !st.presence.some((p) => p.name === 'Dana'));
const hi = st.events.find((e) => /hi @Emil-Codex/.test(e.text));
check('message author and mentions are lowercase', hi?.author === 'dana' && ['emil-codex', 'dana-claude'].every((m) => (hi?.data?.mentions || []).includes(m)) && !(hi?.data?.mentions || []).some((m) => m !== m.toLowerCase()), JSON.stringify(hi));
check('no mentions from "hit@3" or npm scopes; a not-yet-joined @name still counts', !(hi?.data?.mentions || []).some((m) => ['3', 'fastify/rate-limit'].includes(m)) && (hi?.data?.mentions || []).includes('nobody'), JSON.stringify(hi?.data));
// An older board with mixed-case rows gets merged once.
await board.stop();
db((d) => {
  d.prepare("INSERT INTO presence_v2 (name, kind, last_seen) VALUES ('Dana', 'human', ?)").run(Date.now());
  d.prepare("INSERT INTO tasks (title, status, assignee, created_by, created_at, updated_at) VALUES ('old task', 'claimed', 'Dana-claude', 'Dana', ?, ?)").run(Date.now(), Date.now());
  d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('planner', 'Dana-claude')").run();
  d.exec('PRAGMA user_version = 1'); // as if from before the lowercase step
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
// A rejection's reason goes out in the feed: capped like a task note (10000), over REST and MCP, the proposal kept.
const p4 = await w1('create_task', { title: 'long reason' });
const longRest = await http(`/tasks/${p4.id}/decide`, 'POST', { approve: false, note: 'x'.repeat(10001) });
check('REST: a rejection note over 10000 characters is refused (400, says the limit), the proposal kept', longRest.status === 400 && /note is too long \(max 10000 characters\)/.test(longRest.body.error || '') && (await state()).tasks.some((t) => t.id === p4.id && t.status === 'proposed'), JSON.stringify(longRest).slice(0, 200));
check('MCP: a rejection note over 10000 characters is refused', /10000|too_big|too long/i.test(err(await pl('decide_proposal', { id: p4.id, approve: false, note: 'x'.repeat(10001) }))) && (await state()).tasks.some((t) => t.id === p4.id));
const atCap = await http(`/tasks/${p4.id}/decide`, 'POST', { approve: false, note: 'y'.repeat(10000) });
check('…a rejection note at the limit is fine', atCap.status === 200 && atCap.body.rejected === p4.id, JSON.stringify(atCap).slice(0, 200));
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
check('a real board call makes it busy for a while, shown as "working" (no tool names on the page)', py.busy === true && py.doing === 'working' && py.last_tool === 'lock_files', JSON.stringify(py));
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
check('/api/next: a blocked task frees the slot, so other work is actionable', nb2.actionable === true && /claimable/.test(nb2.reason), JSON.stringify(nb2).slice(0, 300));
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
// Done means merged: the owner can't skip review, nor finish a task the merger sent back to it.
const PT3 = await newTask('no shortcut to done');
await o1('claim_task', { id: PT3.id });
await o1('update_task', { id: PT3.id, status: 'in_progress' });
check('owner cannot move its in-progress task straight to done while someone could review it', /Move #\d+ to review first/.test(err(await o1('update_task', { id: PT3.id, status: 'done' }))));
await o1('update_task', { id: PT3.id, status: 'review' });
await by('update_task', { id: PT3.id, status: 'in_progress', note: 'fix the tests' });
check('…nor right after the merger sent it back from review', /review first/.test(err(await o1('update_task', { id: PT3.id, status: 'done' }))));
// Reopening a done task has to fit in the agent's slots, like unblocking one.
await human('/agents/o1', 'PATCH', { slots: 1 });
check('reopening its done task while at capacity is refused', /before reopening/.test(err(await o1('update_task', { id: PT2.id, status: 'in_progress' }))));
await human('/agents/o1', 'PATCH', { slots: null });
// No integrator chosen, but another agent is online: it reviews (claiming the role), not the owner.
await human('/settings', 'PUT', { integrator: '' });
check('with no integrator chosen the owner still cannot mark its task done while another agent is online', /review first[^]*claim_role\("integrator"\)/.test(err(await o1('update_task', { id: PT3.id, status: 'done' }))));

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

// ================= 12. people: grouping and one name on two laptops =================
// Like agent(), plus extra URL params (join adds person= and laptop=).
async function agentQ(name, extra = {}, client = 'claude-code') {
  const q = new URLSearchParams({ agent: name, token: AGENT_TOKEN, ...extra });
  const c = new Client({ name: client, version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${board.base}/mcp?${q}`)));
  const call = async (tool, args = {}) => {
    const r = await c.callTool({ name: tool, arguments: args });
    const t = r.content[0].text;
    let body; try { body = JSON.parse(t); } catch { body = t; }
    return r.isError ? { error: t } : body;
  };
  await call('board_status');
  return call;
}
await agentQ('bluefox417', { person: 'Emil', laptop: 'lap1' });
let pp12 = await agentP('bluefox417');
check('?person= groups an oddly named agent under that person (source join)', pp12?.person === 'emil' && pp12?.person_source === 'join', JSON.stringify(pp12));
check('?person= is lowercased', pp12?.person === 'emil');
await agentQ('emil-claude2', { laptop: 'lap1' });
check('guess: "emil-claude2" belongs to emil', (await agentP('emil-claude2'))?.person === 'emil' && (await agentP('emil-claude2'))?.person_source === 'guess');
await agentQ('x-copilot-vscode', { laptop: 'lapx' });
check('guess: "x-copilot-vscode" belongs to x', (await agentP('x-copilot-vscode'))?.person === 'x');
await agentQ('finn0-omp', { laptop: 'lape' }, 'omp-coding-agent');
check('guess: "finn0-omp" stays itself while nobody is called finn0', (await agentP('finn0-omp'))?.person === 'finn0-omp', (await agentP('finn0-omp'))?.person);
await human('/messages', 'POST', { text: 'hello from finn0' }, 'finn0');
check('guess: "finn0-omp" belongs to finn0 once a human finn0 exists', (await agentP('finn0-omp'))?.person === 'finn0', (await agentP('finn0-omp'))?.person);
await agentQ('zed-tool', { laptop: 'lapz' });
await agentQ('zedbot', { person: 'zed', laptop: 'lapz2' });
check('guess: "zed-tool" belongs to zed when another agent belongs to zed', (await agentP('zed-tool'))?.person === 'zed', (await agentP('zed-tool'))?.person);

// A human's choice wins over join, and can be cleared.
let ph12 = await http('/agents/bluefox417', 'PATCH', { person: 'Milo' });
check('human sets "belongs to" → milo, source human', ph12.status === 200 && ph12.body.person === 'milo' && ph12.body.person_source === 'human', JSON.stringify(ph12.body));
await agentQ('bluefox417', { person: 'other', laptop: 'lap1' });
pp12 = await agentP('bluefox417');
check('a later join connection does not override the human\'s choice', pp12?.person === 'milo' && pp12?.person_source === 'human', JSON.stringify(pp12));
st = await state();
check('the change is announced', st.events.some((e) => /bluefox417 now shows under milo/.test(e.text)));
ph12 = await http('/agents/bluefox417', 'PATCH', { person: '' });
pp12 = await agentP('bluefox417');
check('clearing it goes back to automatic (guess until join sends a person)', ph12.status === 200 && pp12?.person_source !== 'human' && pp12?.person === 'bluefox417', JSON.stringify(pp12));
await agentQ('bluefox417', { person: 'emil', laptop: 'lap1' });
pp12 = await agentP('bluefox417');
check('after clearing, join\'s person applies again', pp12?.person === 'emil' && pp12?.person_source === 'join', JSON.stringify(pp12));
st = await state();
check('clearing is announced', st.events.some((e) => /bluefox417 is grouped automatically again/.test(e.text)));

// Helpers group under the orchestrator's person in the summary.
const ht12 = await newTask('helper built this');
await human(`/tasks/${ht12.id}`, 'PATCH', { assignee: 'bluefox417/worker', status: 'done' });
const sum12 = await fetch(`${board.base}/api/summary`, { headers: { Authorization: `Bearer ${board.token}` } }).then((r) => r.text());
const emilSec12 = (sum12.split(/\n### /).find((x) => x.startsWith('emil ')) || '');
check('summary lists a helper\'s task under the orchestrator\'s person', /helper built this/.test(emilSec12), sum12.slice(0, 400));

// One name on two laptops.
await agentQ('dup-claude', { laptop: 'aaa' });
await agentQ('dup-claude', { laptop: 'aaa' });
check('one laptop never conflicts', (await agentP('dup-claude'))?.conflict === null);
await agentQ('dup-claude', { laptop: 'bbb' });
let pd12 = await agentP('dup-claude');
check('same name from a second laptop → conflict {laptops: 2}', pd12?.conflict?.laptops === 2 && pd12.conflict.since > 0, JSON.stringify(pd12?.conflict));
await agentQ('dup-claude', { laptop: 'aaa' });
await agentQ('dup-claude', { laptop: 'bbb' });
st = await state();
const warns12 = st.events.filter((e) => /The name dup-claude is being used from/.test(e.text));
check('one @all warning, not repeated', warns12.length === 1 && (warns12[0].data?.mentions || []).includes('all'), warns12.length);
await agentQ('noid-claude');
await agentQ('noid-claude');
check('no ?laptop= from the same address: no conflict', (await agentP('noid-claude'))?.conflict === null, JSON.stringify((await agentP('noid-claude'))?.conflict));

// ================= 13. fixes from the Kubecon data =================
{
// Everyone from earlier sections goes offline, so only this section's agents count.
const ageAgent = (name, mins = 20) => db((d) => d.prepare("UPDATE presence_v2 SET last_seen = ? WHERE kind = 'agent' AND name = ?").run(Date.now() - mins * 60e3, name));
db((d) => d.prepare("UPDATE presence_v2 SET last_seen = ? WHERE kind = 'agent'").run(Date.now() - 20 * 60e3));
await human('/settings', 'PUT', { planner: '', integrator: '', deadline: '', require_approval: '' });
const lastEv = async (re) => [...(await state()).events].reverse().find((e) => re.test(e.text));
const k1 = await agent('k1');
const k2 = await agent('k2');
const k3 = await codex('k3');

// release_role
await k1('claim_role', { role: 'planner' });
check('release_role by a non-holder is refused', /aren't the planner/.test(err(await k2('release_role', { role: 'planner' }))));
const rr = await k1('release_role', { role: 'planner', note: 'testing' });
st = await state();
check('release_role clears the planner', rr.released === true && st.settings.planner === '', JSON.stringify(rr) + ' ' + st.settings.planner);
const rrev = await lastEv(/I gave up the planner role/);
check('release_role tells everyone (@all, with the note)', rrev?.author === 'k1' && /: testing/.test(rrev.text) && (rrev.data?.mentions || []).includes('all'), JSON.stringify(rrev));
await k1('claim_role', { role: 'integrator' });
await k1('release_role', { role: 'integrator' });
check('release_role clears the integrator', (await state()).settings.integrator === '');
await human('/settings', 'PUT', { integrator: '*' });
check('release_role with integrator "whoever is free" is refused', /no integrator role/.test(err(await k1('release_role', { role: 'integrator' }))));
await human('/settings', 'PUT', { integrator: '' });

// claim_role takeover from a holder who isn't around
await k1('claim_role', { role: 'planner' });
check('claim_role refused while the holder is online', /already the planner/.test(err(await k2('claim_role', { role: 'planner' }))));
ageAgent('k1');
const to1 = await k2('claim_role', { role: 'planner' });
check('claim_role takes over from an offline holder', to1.took_over_from === 'k1' && (await state()).settings.planner === 'k2', JSON.stringify(to1));
check('the takeover is announced', !!(await lastEv(/k2 took over as planner: k1 isn't around/)));
await http('/agents/k2', 'PATCH', { limited: true });
const to2 = await k3('claim_role', { role: 'planner' });
check('claim_role takes over from a holder out of usage', to2.took_over_from === 'k2' && (await state()).settings.planner === 'k3', JSON.stringify(to2));
await http('/agents/k2', 'PATCH', { limited: false });

// cancel_task
await k1('board_status'); // online again
await human('/settings', 'PUT', { planner: 'k1' });
const dup13 = await newTask('duplicate thing');
const dep13 = await newTask('needs the duplicate', { depends_on: [dup13.id] });
check('cancel_task by a non-planner is refused', /Only the planner/.test(err(await k2('cancel_task', { id: dup13.id, reason: 'nope' }))));
const cx = await k1('cancel_task', { id: dup13.id, reason: 'duplicate of #1' });
st = await state();
check('planner cancels an open task: it is gone', cx.cancelled === dup13.id && !st.tasks.some((t) => t.id === dup13.id), JSON.stringify(cx));
const cev = st.events.find((e) => e.task_id === dup13.id && e.kind === 'task_deleted');
check('cancel event names the task and the reason', new RegExp(`cancelled #${dup13.id} duplicate thing: duplicate of #1`).test(cev?.text || ''), cev?.text);
check('dependents lose the cancelled task', !st.tasks.find((t) => t.id === dep13.id).depends_on.includes(dup13.id));
const wk = await newTask('k2 is working on this');
await k2('claim_task', { id: wk.id }); await k2('update_task', { id: wk.id, status: 'in_progress' });
check('planner can\'t cancel a task someone else is working on', /being worked on by k2/.test(err(await k1('cancel_task', { id: wk.id, reason: 'x' }))), err(await k1('cancel_task', { id: wk.id, reason: 'x' })));
const dn = await newTask('already finished');
await human(`/tasks/${dn.id}`, 'PATCH', { status: 'done' });
check('cancelling a done task is refused', /already done/.test(err(await k1('cancel_task', { id: dn.id, reason: 'x' }))));

// a reservation for an agent that isn't around doesn't lock everyone out
const k4 = await agent('k4');
const k5 = await codex('k5');
const rsv = await newTask('for k4');
await human(`/tasks/${rsv.id}`, 'PATCH', { reserved_for: 'k4' });
check('reserved for an online agent: others can\'t claim', /reserved for k4/.test(err(await k5('claim_task', { id: rsv.id }))));
ageAgent('k4');
const k5st = await k5('board_status');
check('reserved for an offline agent: listed as claimable for others', new RegExp(`#${rsv.id} `).test(k5st.next_action), k5st.next_action.slice(0, 300));
const k5c = await k5('claim_task', { id: rsv.id });
check('…and another agent can claim it', !err(k5c) && k5c.assignee === 'k5', err(k5c));

// a human assigns an open task
const asg = await newTask('assign me');
await human(`/tasks/${asg.id}`, 'PATCH', { assignee: 'K2' });
st = await state();
const asgT = st.tasks.find((t) => t.id === asg.id);
check('human assigning an open task claims it for that agent', asgT?.status === 'claimed' && asgT.assignee === 'k2' && new RegExp(`^task/${asg.id}-`).test(asgT.branch || ''), JSON.stringify(asgT));
const aev = [...st.events].reverse().find((e) => e.task_id === asg.id && e.kind === 'task_updated');
check('the assigned agent is told (@mention in the event)', (aev?.data?.mentions || []).includes('k2'), aev?.text);

// a human move to claimed / in progress needs an owner, and finished dependencies (unless force)
const mv1 = await newTask('move me'); const mv2 = await newTask('after move me', { depends_on: [mv1.id] });
let mvr = await http(`/tasks/${mv1.id}`, 'PATCH', { status: 'in_progress' });
check('moving to in progress without an owner is refused', mvr.status === 400 && /^Pick who #\d+ is for first\.$/.test(err(mvr.body)) && !/force/.test(err(mvr.body)), JSON.stringify(mvr.body));
mvr = await http(`/tasks/${mv1.id}`, 'PATCH', { status: 'claimed' });
check('moving to claimed without an owner is refused', mvr.status === 400, JSON.stringify(mvr.body));
mvr = await http(`/tasks/${mv2.id}`, 'PATCH', { status: 'in_progress', assignee: 'k2' });
check('moving a task whose dependency isn\'t done is refused', mvr.status === 400 && new RegExp(`waits on #${mv1.id}, which isn't done yet`).test(err(mvr.body)) && !/force/.test(err(mvr.body)), JSON.stringify(mvr.body));
mvr = await http(`/tasks/${mv1.id}`, 'PATCH', { status: 'in_progress', assignee: 'k2' });
check('moving with an assignee works and gets a branch', mvr.status === 200 && mvr.body.assignee === 'k2' && mvr.body.status === 'in_progress' && /^task\//.test(mvr.body.branch || ''), JSON.stringify(mvr.body));
// force ("Move anyway") skips the dependency check only: an active task always needs an owner.
mvr = await http(`/tasks/${mv2.id}`, 'PATCH', { status: 'claimed', force: true });
check('force: true without an owner is still refused', mvr.status === 400 && /^Pick who #\d+ is for first\.$/.test(err(mvr.body)) && (await state()).tasks.find((t) => t.id === mv2.id)?.status === 'open', JSON.stringify(mvr.body));
mvr = await http(`/tasks/${mv2.id}`, 'PATCH', { status: 'claimed', assignee: 'k2', force: true });
check('force: true with an owner moves it anyway', mvr.status === 200 && mvr.body.status === 'claimed' && mvr.body.assignee === 'k2', JSON.stringify(mvr.body));
mvr = await http(`/tasks/${mv2.id}`, 'PATCH', { status: 'open' });
check('moving back to open needs no owner', mvr.status === 200 && mvr.body.status === 'open', JSON.stringify(mvr.body));
// Assigning an open task claims it, so it goes through the same checks as a move to claimed.
mvr = await http(`/tasks/${mv2.id}`, 'PATCH', { assignee: 'k2' });
check('assigning (only) an open task whose dependency isn\'t done is refused like the move', mvr.status === 400 && new RegExp(`waits on #${mv1.id}, which isn't done yet`).test(err(mvr.body)) && (await state()).tasks.find((t) => t.id === mv2.id)?.status === 'open', JSON.stringify(mvr.body));
mvr = await http(`/tasks/${mv2.id}`, 'PATCH', { assignee: 'k2', force: true });
check('…and force: true assigns it anyway (claimed, with a branch)', mvr.status === 200 && mvr.body.status === 'claimed' && mvr.body.assignee === 'k2' && /^task\//.test(mvr.body.branch || ''), JSON.stringify(mvr.body));
// Taking the owner off an active task puts it back to open and frees its locks: no "claimed by nobody".
await k2('lock_files', { paths: ['src/unassign-me.js'], task_id: mv2.id });
mvr = await http(`/tasks/${mv2.id}`, 'PATCH', { assignee: '' });
check('clearing the assignee of a claimed task moves it to open and frees its locks', mvr.status === 200 && mvr.body.status === 'open' && !mvr.body.assignee && !(await state()).locks.some((l) => l.path === 'src/unassign-me.js'), JSON.stringify(mvr.body));
// The resulting (status, owner) pair is checked on every change: clearing the owner while sending the same status
// "claimed" is refused, and a blank owner ("   ") is nobody.
{
  const pt = await newTask('owner pair');
  await http(`/tasks/${pt.id}`, 'PATCH', { assignee: 'k2' });
  mvr = await http(`/tasks/${pt.id}`, 'PATCH', { status: 'claimed', assignee: null });
  let ptT = (await state()).tasks.find((t) => t.id === pt.id);
  check('a claimed task can\'t lose its owner by sending status "claimed" with assignee null', mvr.status === 400 && /^Pick who #\d+ is for first\.$/.test(err(mvr.body)) && ptT.status === 'claimed' && ptT.assignee === 'k2', `${JSON.stringify(mvr.body)} ${ptT.status}/${ptT.assignee}`);
  await http(`/tasks/${pt.id}`, 'PATCH', { status: 'open' });
  mvr = await http(`/tasks/${pt.id}`, 'PATCH', { status: 'in_progress', assignee: '   ' });
  ptT = (await state()).tasks.find((t) => t.id === pt.id);
  check('a blank assignee is nobody: moving to in progress with "   " is refused', mvr.status === 400 && /^Pick who/.test(err(mvr.body)) && ptT.status === 'open' && !ptT.assignee, `${JSON.stringify(mvr.body)} ${ptT.status}/${JSON.stringify(ptT.assignee)}`);
  await http(`/tasks/${pt.id}`, 'DELETE');
}

// Settings are saved whole or not at all: a bad deadline next to a good goal saves neither.
const goalBefore = (await state()).settings.goal;
const nSettings = (await state()).events.filter((e) => e.kind === 'settings').length;
mvr = await http('/settings', 'PUT', { goal: 'A goal that must not be saved', deadline: 'not a date' });
st = await state();
check('PUT /settings with one invalid field saves nothing (no partial goal, no settings event)', mvr.status === 400 && st.settings.goal === goalBefore && st.events.filter((e) => e.kind === 'settings').length === nSettings, `${mvr.status} ${st.settings.goal}`);

// list_tasks' assignee filter is literal: "a_b" doesn't match "axb" (LIKE wildcards are escaped).
const lk1 = await newTask('for axb'); await http(`/tasks/${lk1.id}`, 'PATCH', { assignee: 'axb/helper', force: true });
const lk2 = await newTask('for a_b'); await http(`/tasks/${lk2.id}`, 'PATCH', { assignee: 'a_b', force: true });
const byAb = await k1('list_tasks', { assignee: 'a_b' });
check('the assignee filter matches the name literally (a_b, not axb/helper)', Array.isArray(byAb) && byAb.map((t) => t.id).join() === String(lk2.id), JSON.stringify(byAb).slice(0, 200));
for (const t of [lk1, lk2]) await http(`/tasks/${t.id}`, 'PATCH', { status: 'open' });

// Lock paths are one spelling: src/./x and src/sub/../x are src/x; a path outside the repo is refused.
const lp = await k1('lock_files', { paths: ['src/norm/config.js'] });
const lpDot = await k2('lock_files', { paths: ['src/norm/./config.js'] });
const lpUp = await k2('lock_files', { paths: ['src/norm/sub/../config.js'] });
check('lock paths are normalised (. and .. parts): the same file conflicts', lp.ok === true && lpDot.ok === false && lpUp.ok === false && lpUp.conflicts?.[0]?.path === 'src/norm/config.js', JSON.stringify([lpDot, lpUp]).slice(0, 300));
check('a lock path outside the repo is refused', /outside it/.test(err(await k2('lock_files', { paths: ['../other-repo/x.js'] }))) && /outside it/.test(err(await k2('lock_files', { paths: ['src/../../x.js'] }))));
await k1('unlock_files', { paths: ['src/norm/config.js'] });

// a blocked task doesn't hold a slot
const k7 = await codex('k7');
const bl1 = await newTask('blocked one'); const bl2 = await newTask('next while blocked');
await k7('claim_task', { id: bl1.id }); await k7('update_task', { id: bl1.id, status: 'blocked', note: 'need a key' });
const bc = await k7('claim_task', { id: bl2.id });
check('a 1-slot agent with a blocked task can claim another', !err(bc) && bc.assignee === 'k7', err(bc));

// locks are at most an hour
const lk = await k1('lock_files', { paths: ['src/long.js'], ttl_s: 3600, reason: 'big refactor' });
check('lock_files with 3600 s works and stays within an hour', lk.ok === true && lk.expires_in_s <= 3600, JSON.stringify(lk));
check('lock_files with 7200 s is refused by the tool schema', !!err(await k1('lock_files', { paths: ['src/longer.js'], ttl_s: 7200 })));
const lks = (await state()).locks.find((l) => l.path === 'src/long.js');
check('the stored lock expires within an hour', lks && lks.expires_in_s <= 3600, JSON.stringify(lks));

// a named integrator who isn't around: whoever is free merges meanwhile
const k8 = await agent('k8');
const k9 = await agent('k9');
const k10 = await agent('k10');
await human('/settings', 'PUT', { integrator: 'k8' });
const rv = await newTask('needs review');
await k9('claim_task', { id: rv.id }); await k9('update_task', { id: rv.id, status: 'in_progress' }); await k9('update_task', { id: rv.id, status: 'review' });
check('integrator online: others can\'t take the review', /k8 is the integrator/.test(err(await k10('claim_review', { id: rv.id }))));
ageAgent('k8');
const k10st = await k10('board_status');
check('integrator away: others are told and offered the review', /k8 \(the integrator\) isn't around/.test(k10st.next_action) && new RegExp(`claim_review|#${rv.id}`).test(k10st.next_action), k10st.next_action.slice(0, 400));
const k10r = await k10('claim_review', { id: rv.id });
check('integrator away: claim_review succeeds', !err(k10r) && k10r.reviewer === 'k10', err(k10r));
await human('/settings', 'PUT', { integrator: '' });

// the demo time has passed (freeze "0 min before" = at the deadline)
await human('/settings', 'PUT', { deadline: Date.now() + 1000, freeze_minutes: 0 }); // a past time is refused: let it pass
await new Promise((r) => setTimeout(r, 1200));
st = await state();
check('time.past after the deadline', st.time.past === true && st.time.frozen === true, JSON.stringify(st.time));
const k1past = await k1('board_status');
check('next_action says the demo time has passed', /has passed/.test(k1past.next_action) && !/FEATURE FREEZE \(since/.test(k1past.next_action), k1past.next_action.slice(0, 300));
let frz = null;
for (let i = 0; i < 28 && !frz; i++) { await new Promise((r) => setTimeout(r, 1000)); frz = await lastEv(/@all FEATURE FREEZE/); }
check('the freeze is announced even when it starts at the deadline (within the 20 s announcer tick)', !!frz, frz ? '' : 'no FEATURE FREEZE event within 28 s');
await human('/settings', 'PUT', { deadline: '' });

// PR links backfilled once for tasks from before PR links existed
const bf = await newTask('old reviewed task');
await k1('claim_task', { id: bf.id }); await k1('update_task', { id: bf.id, status: 'in_progress' });
await human(`/tasks/${bf.id}`, 'PATCH', { status: 'done' });
await board.stop();
db((d) => {
  d.prepare('UPDATE tasks SET pr_url = NULL WHERE id = ?').run(bf.id);
  d.prepare("INSERT INTO events (ts, author, kind, channel, task_id, text) VALUES (?, 'board', 'message', 'general', ?, 'see https://github.com/o/r/pull/99')").run(Date.now() - 2000, bf.id);
  d.prepare("INSERT INTO events (ts, author, kind, channel, task_id, text) VALUES (?, 'k1', 'task_updated', 'tasks', ?, ?)").run(Date.now() - 1000, bf.id, `#${bf.id} in_progress → review — done https://github.com/o/r/pull/12`);
  d.exec('PRAGMA user_version = 2'); // as if from before the PR link backfill
});
await board.relaunch();
const bfT = (await state()).tasks.find((t) => t.id === bf.id);
check('PR link backfilled from the owner\'s earlier event', bfT?.pr_url === 'https://github.com/o/r/pull/12', JSON.stringify(bfT?.pr_url));

}

// ================= 14. schema versions: boards from older releases upgrade =================
{
  const open = (dir, fn) => { const d = new DatabaseSync(path.join(dir, 'board.db')); try { return fn(d); } finally { d.close(); } };
  const shape = (d) => Object.fromEntries(d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .map((t) => [t.name, d.prepare(`PRAGMA table_info(${t.name})`).all().map((c) => `${c.name} ${c.type} ${c.notnull} ${c.dflt_value} ${c.pk}`).sort().join(', ')]));
  const version = (d) => d.prepare('PRAGMA user_version').get().user_version;
  const reopen = (dir) => new Board(dir).close();
  const fresh = tempDir();
  reopen(fresh);
  const want = open(fresh, shape);
  const latest = open(fresh, version);
  check('a new board is at the latest schema version', latest > 0, latest);
  const pr = 'https://github.com/o/r/pull/7';
  const now = Date.now();

  // The first release's tables (no settings, no presence), with a mixed-case task in review and its owner's PR event.
  const first = tempDir();
  open(first, (d) => {
    d.exec(`
      CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, author TEXT NOT NULL, kind TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'general', task_id INTEGER, text TEXT NOT NULL DEFAULT '', data TEXT);
      CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', priority INTEGER NOT NULL DEFAULT 2, assignee TEXT, branch TEXT, depends_on TEXT NOT NULL DEFAULT '[]', created_by TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE locks (path TEXT PRIMARY KEY, owner TEXT NOT NULL, task_id INTEGER, reason TEXT NOT NULL DEFAULT '', expires_at INTEGER NOT NULL);
      CREATE TABLE questions (id INTEGER PRIMARY KEY AUTOINCREMENT, asker TEXT NOT NULL, question TEXT NOT NULL, task_id INTEGER, answer TEXT, answered_by TEXT, created_at INTEGER NOT NULL, answered_at INTEGER);
    `);
    d.prepare("INSERT INTO tasks (title, status, assignee, branch, created_by, created_at, updated_at) VALUES ('first-release task', 'review', 'Ola', 'task/1-x', 'Ola', ?, ?)").run(now, now);
    d.prepare("INSERT INTO events (ts, author, kind, channel, task_id, text) VALUES (?, 'Ola', 'task_updated', 'tasks', 1, ?)").run(now, `#1 in_progress → review — ${pr}`);
    d.prepare("INSERT INTO locks (path, owner, task_id, expires_at) VALUES ('src/a.js', 'Ola', 1, ?)").run(now + 60e3);
  });
  reopen(first);
  const up = open(first, (d) => ({ shape: shape(d), v: version(d), task: d.prepare('SELECT * FROM tasks').get(), lock: d.prepare('SELECT * FROM locks').get(), events: d.prepare('SELECT COUNT(*) n FROM events').get().n }));
  check('first-release board: tables and columns match a new board', JSON.stringify(up.shape) === JSON.stringify(want), JSON.stringify(up.shape));
  check('first-release board: at the latest version', up.v === latest, up.v);
  check('first-release board: its task kept, names lowercased, new columns at their defaults, PR link backfilled',
    up.task.title === 'first-release task' && up.task.status === 'review' && up.task.branch === 'task/1-x' && up.task.assignee === 'ola' && up.task.created_by === 'ola' && up.task.size === 'M' && up.task.reserved_for === null && up.task.pr_url === pr, JSON.stringify(up.task));
  check('first-release board: its lock and events kept', up.lock?.owner === 'ola' && up.events === 1, JSON.stringify(up.lock));

  // From before versioning and already past the old one-off steps (their marks are set): those don't run again.
  const marked = tempDir();
  open(marked, (d) => {
    d.exec(`
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
      CREATE TABLE presence_v2 (name TEXT NOT NULL, kind TEXT NOT NULL, last_seen INTEGER NOT NULL, PRIMARY KEY (name, kind));
      CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', priority INTEGER NOT NULL DEFAULT 2, assignee TEXT, branch TEXT, depends_on TEXT NOT NULL DEFAULT '[]', created_by TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, pr_url TEXT);
      CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, author TEXT NOT NULL, kind TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'general', task_id INTEGER, text TEXT NOT NULL DEFAULT '', data TEXT);
      INSERT INTO settings (key, value) VALUES ('_names_lowercase', '1'), ('_pr_backfill', '1'), ('goal', 'Ship it');
    `);
    d.prepare("INSERT INTO presence_v2 (name, kind, last_seen) VALUES ('Pia', 'human', ?)").run(now);
    d.prepare("INSERT INTO tasks (title, status, assignee, created_by, created_at, updated_at) VALUES ('marked task', 'done', 'Pia', 'Pia', ?, ?)").run(now, now);
    d.prepare("INSERT INTO events (ts, author, kind, channel, task_id, text) VALUES (?, 'Pia', 'task_updated', 'tasks', 1, ?)").run(now, `#1 review → done ${pr}`);
  });
  reopen(marked);
  const mk = open(marked, (d) => ({ shape: shape(d), v: version(d), task: d.prepare('SELECT * FROM tasks').get(), who: d.prepare('SELECT name FROM presence_v2').all().map((r) => r.name), goal: d.prepare("SELECT value FROM settings WHERE key = 'goal'").get()?.value }));
  check('pre-versioning board: tables and columns match a new board', JSON.stringify(mk.shape) === JSON.stringify(want), JSON.stringify(mk.shape));
  check('pre-versioning board: at the latest version, its settings kept', mk.v === latest && mk.goal === 'Ship it', `${mk.v} ${mk.goal}`);
  check('pre-versioning board: steps it already had are not run again', mk.task.assignee === 'Pia' && mk.who.join() === 'Pia' && mk.task.pr_url === null, JSON.stringify(mk));

  // Reopening an up-to-date board changes nothing (the lowercase step would rename Quinn, the backfill refill the link).
  open(first, (d) => d.exec("UPDATE tasks SET pr_url = NULL; INSERT INTO presence_v2 (name, kind, last_seen) VALUES ('Quinn', 'human', 0)"));
  reopen(first);
  const again = open(first, (d) => ({ shape: shape(d), v: version(d), pr: d.prepare('SELECT pr_url FROM tasks').get().pr_url, who: d.prepare("SELECT name FROM presence_v2 WHERE kind = 'human'").get()?.name }));
  check('reopening an up-to-date board is a no-op', JSON.stringify(again.shape) === JSON.stringify(want) && again.v === latest && again.pr === null && again.who === 'Quinn', JSON.stringify(again));

  // Locks from before lock paths were normalised get the one spelling; two that name one file keep the longest.
  const locks = tempDir();
  reopen(locks);
  open(locks, (d) => {
    const ins = d.prepare('INSERT INTO locks (path, owner, task_id, reason, expires_at) VALUES (?, ?, NULL, ?, ?)');
    ins.run('src/sub/../config.js', 'ola', 'raw spelling', now + 600e3);
    ins.run('src/config.js', 'pia', 'canonical, shorter', now + 60e3);
    ins.run('./README.md', 'ola', '', now + 60e3);
    ins.run('src\\win\\path.js', 'pia', '', now + 60e3);
    ins.run('../outside.js', 'ola', '', now + 60e3);
    d.exec('PRAGMA user_version = 3'); // as if from before the lock path step
  });
  const lb = new Board(locks);
  const lrows = lb.db.prepare('SELECT path, owner, reason FROM locks ORDER BY path').all().map((l) => `${l.path}:${l.owner}`);
  const conflict = lb.lockFiles('quinn', { paths: ['src/config.js'] });
  const unlocked = lb.unlockFiles('ola', { paths: ['src/config.js'] });
  lb.close();
  check('older lock paths are normalised once (duplicates merged, the longest kept; outside-repo paths dropped)', lrows.join() === 'README.md:ola,src/config.js:ola,src/win/path.js:pia' && open(locks, version) === latest, lrows.join());
  check('…so an older src/sub/../config.js lock conflicts with and unlocks as src/config.js', conflict.ok === false && conflict.conflicts?.[0]?.owner === 'ola' && unlocked.released.join() === 'src/config.js', JSON.stringify([conflict, unlocked]));

  // Version 5: events are read by channel (direct-message threads): an index, on new boards and upgraded ones.
  const indexes = (d) => d.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'events'").all().map((r) => r.name);
  const v4 = tempDir();
  reopen(v4);
  open(v4, (d) => d.exec('DROP INDEX IF EXISTS events_channel; PRAGMA user_version = 4'));
  reopen(v4);
  const plan = open(v4, (d) => d.prepare("EXPLAIN QUERY PLAN SELECT * FROM events WHERE channel = 'direct' ORDER BY id DESC LIMIT 5").all().map((r) => r.detail).join(' '));
  check('events(channel) index: on a new board, and added to a schema-4 board', open(fresh, indexes).includes('events_channel') && open(v4, indexes).includes('events_channel') && open(v4, version) === latest && /events_channel/.test(plan), `${open(v4, indexes)} ${plan}`);
}

// ================= 15. board internals: one transaction per write, the stats cache, files closed on failure =================
{
  const open = (dir, fn) => { const d = new DatabaseSync(path.join(dir, 'board.db')); try { return fn(d); } finally { d.close(); } };
  const dir = tempDir();
  const b = new Board(dir);
  const mk = (title) => b.createTask('dana', { title, size: 'S' }, { human: true });
  // A cancel whose event can't be written leaves the task where it was (removal and event are one transaction).
  const ct = mk('cancel me');
  const emit = b.emit;
  b.emit = () => { throw new Error('event write failed'); };
  let threw = false;
  try { b.cancelTask('dana', ct.id, 'dup', { human: true }); } catch { threw = true; }
  b.emit = emit;
  check('cancelTask: when its event fails, the task isn\'t removed either', threw && !!b.getTask(ct.id), String(!!b.getTask(ct.id)));

  // The task stats are computed again after task changes only, not after every chat message.
  for (const t of [mk('s1'), mk('s2'), mk('s3')]) b.updateTask('dana', t.id, { status: 'done', assignee: 'ola', force: true }, { human: true });
  let computed = 0;
  const compute = b.computeTaskStats.bind(b);
  b.computeTaskStats = () => { computed++; return compute(); };
  const s0 = b.taskStats();
  b.post('dana', { text: 'just chatting' }, { human: true });
  b.taskStats();
  const afterChat = computed;
  b.updateTask('dana', mk('resize me').id, { size: 'L' }, { human: true });
  b.taskStats();
  check('task stats aren\'t recomputed after a chat message, but are after a task change', s0?.done === 3 && afterChat === 1 && computed === 2, `${afterChat} ${computed}`);
  b.close();

  // A board whose upgrade fails doesn't keep its database open (Windows can't replace an open file).
  const broken = tempDir();
  new Board(broken).close();
  open(broken, (d) => d.exec('DROP TABLE tasks; PRAGMA user_version = 1')); // the lowercase step updates tasks: it fails
  let failed = false;
  try { new Board(broken); } catch { failed = true; }
  let freed = true;
  try { fs.renameSync(path.join(broken, 'board.db'), path.join(broken, 'moved.db')); } catch { freed = false; }
  check('a board whose migration fails closes its database file again', failed && freed, `${failed} ${freed}`);

  // A board whose token file can't be read: the runtime closes the database it opened.
  const badTok = tempDir();
  fs.mkdirSync(path.join(badTok, 'token'));
  let rtFailed = false;
  try { createBoardRuntime('badtok', badTok, { registry: { defaultSlug: 'other', get: () => null }, envTokenSlug: null }); } catch { rtFailed = true; }
  let rtFreed = true;
  try { fs.renameSync(path.join(badTok, 'board.db'), path.join(badTok, 'moved.db')); } catch { rtFreed = false; }
  check('a board runtime whose tokens fail to load closes its database file again', rtFailed && rtFreed, `${rtFailed} ${rtFreed}`);
}

await finish(R, { board });
