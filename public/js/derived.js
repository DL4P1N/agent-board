// What the page works out from the board's state: each agent's info and capacity, people and the roster, the setup
// steps (setupInfo), which tasks show, the deadline outlook, and the one vocabulary shared by the views and presenters.

import './data.js';
import { ACTIVE, AGENT_ONLINE_MS, ANYONE, HOLDING, me, seenMention, state, store, ui } from './state.js';
import { agentRoot, clock, mentionsMe, plural, root, when } from './helpers.js';
import { settingsText } from './activity.js';
import './office.js';

// ---------- one drawing pass ----------
// render() works each of these out once per pass (a big board has hundreds of tasks and cards that ask about them):
// the agents, the roster, people, the setup steps, the open questions, and who holds which task. Outside a pass (a
// click handler) each is worked out fresh, so a change made just before is always seen.
let pass = null, passDepth = 0;
function inPass(fn) { if (!passDepth++) pass = new Map(); try { return fn(); } finally { if (!--passDepth) pass = null; } }
const once = (k, fn) => { if (!pass) return fn(); if (!pass.has(k)) pass.set(k, fn()); return pass.get(k); };
// Tasks by the agent that holds them (its main agent's name, helpers included) and by exact owner, tasks being merged
// by each agent, and each task's open question (the oldest).
function taskIndex() {
  return once('tidx', () => {
    const byAgent = new Map(), byOwner = new Map(), merging = new Map(), qByTask = new Map();
    const add = (m, k, v) => { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); };
    for (const t of state.tasks) {
      if (t.assignee) { add(byAgent, agentRoot(t.assignee), t); add(byOwner, String(t.assignee).toLowerCase(), t); }
      if (t.status === 'review' && t.reviewer) add(merging, agentRoot(t.reviewer), t);
    }
    for (const q of openQuestions()) if (q.task_id && !qByTask.has(q.task_id)) qByTask.set(q.task_id, q);
    return { byAgent, byOwner, merging, qByTask };
  });
}
const NONE = Object.freeze([]);
const tasksOf = (agent) => taskIndex().byAgent.get(agentRoot(agent)) || NONE;
const tasksOwnedBy = (name) => taskIndex().byOwner.get(String(name || '').toLowerCase()) || NONE;
const mergingBy = (agent) => taskIndex().merging.get(agentRoot(agent)) || NONE;
const questionFor = (taskId) => taskIndex().qByTask.get(taskId) || null;

// ---------- derived ----------
// Every agent we know of, by agent name ("dana-codex"): from presence, plus things only agents do.
// online = its tool talked to the board in the last 10 min; started = someone typed /board (it read the board).
function agentInfo() { return once('agents', agentInfoFresh); }
function agentInfoFresh() {
  const m = new Map(); const now = Date.now();
  const skip = (n) => !n || n === 'board' || n === 'anonymous';
  const get = (n) => { n = String(n).toLowerCase(); if (!m.has(n)) m.set(n, { name: n, client: null, model: null, helpers: [], plan: null, slots: 0, base: 0, override: null, active: 0, online: false, started: false, last: 0, busy: false, doing: null, limited: null, reviewing: [] }); return m.get(n); };
  for (const p of state.presence || []) {
    if (p.kind !== 'agent' || skip(p.name)) continue;
    const a = get(p.name); if (p.client) a.client = String(p.client);
    if (p.model) a.model = String(p.model); if (Array.isArray(p.helpers)) a.helpers = p.helpers;
    // slots from the server include the planner's temporary extra slots: keep those apart.
    a.extra = Number(p.extra_slots) || 0;
    if (p.plan) a.plan = String(p.plan); if (p.slots) a.slots = (Number(p.slots) || 0) - a.extra;
    if (p.base_slots) a.base = Number(p.base_slots) || 0;
    if (p.slots_override != null) a.override = Number(p.slots_override) || null;
    if (p.busy) a.busy = true; if (p.doing) a.doing = String(p.doing);
    // The server's word on whether it needs work (no claimed or in-progress task, no review or other job): what the count goes by.
    if (typeof p.needs_work === 'boolean') a.needsWork = p.needs_work;
    if (p.limited) a.limited = p.limited;
    // Who it belongs to, and where that came from ('human' = set here, 'join', 'guess' = from its name).
    if (p.person) a.person = String(p.person).toLowerCase();
    a.personSource = p.person_source || null;
    a.conflict = p.conflict || null;
    a.online = a.online || !!p.online; a.started = a.started || !!p.started; a.last = Math.max(a.last, p.last_seen || 0);
  }
  for (const e of state.events) {
    const n = agentRoot(e.author); if (skip(n)) continue;
    if (['task_claimed', 'lock', 'question'].includes(e.kind) || String(e.author).includes('/')) {
      const a = get(n); a.started = true; a.last = Math.max(a.last, e.ts); if (now - e.ts < AGENT_ONLINE_MS) a.online = true;
    }
  }
  for (const t of state.tasks) if (t.assignee && !skip(agentRoot(t.assignee))) { const a = get(agentRoot(t.assignee)); a.started = true; if (HOLDING.includes(t.status)) { a.active++; a.busy = true; } }
  for (const t of state.tasks) if (t.status === 'review' && t.reviewer && !skip(agentRoot(t.reviewer))) { const a = get(agentRoot(t.reviewer)); a.started = true; a.busy = true; a.reviewing.push(t.id); if (!a.doing) a.doing = `reviewing #${t.id}`; }
  // No declared plan: Claude Code can run helpers in parallel, the other tools work one task at a time (same rule as the server).
  for (const a of m.values()) { if (!a.base) a.base = a.client === 'Claude Code' ? 2 : 1; if (!a.slots) a.slots = a.override || a.base; }
  return m;
}
// "Claude Max 20x · 2/3" (plan known) or "Codex · 1/1"; the tooltip says it in words.
const capText = (a) => `${a.active}/${a.slots}`;
const capTip = (a) => `${a.name}: ${a.client || 'AI tool not reported yet'}${a.plan ? ` on ${a.plan}` : ''}. Holds ${plural(a.active, 'task')} now; ${a.override ? `limit set here: ${a.slots} at once (its plan allows ${a.base})` : `its plan allows ${a.slots} at once${a.plan ? '' : ' (no plan reported: the default for this tool)'}`}.${a.doing ? ` Doing: ${a.doing}.` : ''}`;
// Marked "hit its usage limit" on this page, and the mark hasn't run out yet.
const isLimited = (a) => !!a?.limited && (!a.limited.until || a.limited.until > Date.now());
const limitText = (a) => `out of usage${a.limited?.until ? ` · back at ${clock(a.limited.until)}` : ''}`;
let infoCache = null; // agentInfo() walks every event: compute it once per state (a chat message added live is a new events list)
const agentInfoNow = () => (infoCache?.s === state && infoCache.e === state.events ? infoCache.m : (infoCache = { s: state, e: state.events, m: agentInfo() }).m);
const agentLimited = (name) => isLimited(agentInfoNow().get(agentRoot(name)));
// Started, online agents: what the team can run at once, what runs now, who has nothing, and how much is ready to claim.
function teamCapacity() { return once('cap', teamCapacityFresh); }
function teamCapacityFresh() {
  // Out-of-usage agents don't count: they can't take work right now.
  const all = [...agentInfo().values()].filter((a) => a.started && agentLive(a) && !isLimited(a));
  // Idle = needs work: no claimed or in-progress task and no review or planning (the server's `needs_work`; a blocked task
  // or a recent board call isn't work). Older servers without it: not `busy`.
  const idle = all.filter((a) => a.needsWork ?? !a.busy);
  const done = new Set(state.tasks.filter((t) => t.status === 'done').map((t) => t.id));
  const ids = new Set(state.tasks.map((t) => t.id));
  const ready = state.tasks.filter((t) => t.status === 'open' && t.depends_on.every((d) => !ids.has(d) || done.has(d)));
  // Work an idle agent could actually take: unreserved, or reserved for one of the idle agents.
  const forIdle = ready.filter((t) => !t.reserved_for || idle.some((a) => a.name === agentRoot(t.reserved_for)));
  return { agents: all, slots: all.reduce((n, a) => n + a.slots, 0), running: state.tasks.filter((t) => HOLDING.includes(t.status)).length, idle, ready: ready.length, forIdle: forIdle.length, short: idle.length > 0 && forIdle.length < idle.length };
}
const agentState = (a) => (isLimited(a) ? 'limited' : !a.online ? 'offline' : a.started ? 'online' : 'waiting');
// What to type to start the board in a given tool.
// Copilot CLI's launch command, from the server's AGENT_TOOLS (one source for step 3 and the invite).
const copilotLaunch = () => state.setup?.agent_tools?.find((t) => t.id === 'copilot-cli')?.launch || 'copilot --allow-tool board --autopilot --max-autopilot-continues 50';
const startCmd = (client) => (/codex/i.test(client || '') ? '$board' : client ? '/board' : '/board ($board in Codex)');
const notStartedText = (a) => `connected · not started — type ${startCmd(a.client)}`;

function people() { return once('people', peopleFresh); }
function peopleFresh() {
  const map = new Map();
  const get = (id) => {
    const r = root(id);
    if (!r || r === 'board' || r === 'anonymous') return null;
    if (!map.has(r)) map.set(r, { name: r, agents: new Map(), last: 0, asks: 0, locks: 0 });
    const p = map.get(r);
    if (!p.agents.has(id)) p.agents.set(id, { id, last: 0, lastText: '', tasks: [] });
    return p.agents.get(id);
  };
  if (me) get(me);
  const ros = roster();
  for (const r of ros) { if (r.agent || r.humanOnline) get(r.name); for (const a of r.agents) get(a.name); }
  for (const e of state.events) { const a = get(e.author); if (a && e.ts >= a.last) { a.last = e.ts; a.lastText = e.kind === 'message' ? `“${e.text}”` : e.kind === 'settings' ? settingsText(e) : e.text; } }
  for (const t of state.tasks) { if (t.assignee && ACTIVE.includes(t.status)) get(t.assignee)?.tasks.push(t); }
  for (const l of state.locks) { if (get(l.owner)) map.get(root(l.owner)).locks++; }
  for (const q of state.questions) { if (!q.answer && get(q.asker)) map.get(root(q.asker)).asks++; }
  for (const p of map.values()) {
    p.last = Math.max(0, ...[...p.agents.values()].map((a) => a.last));
    p.r = ros.find((r) => r.name === p.name) || { agent: false, agentOnline: false, humanOnline: false, agents: [] };
    // Also when its agents last talked to the board, so the row and "last seen" in its detail agree.
    p.last = Math.max(p.last, ...p.r.agents.map((a) => a.last || 0));
  }
  // A name with nothing behind it (no agents, tasks, locks or questions, not watching now; e.g. a name
  // someone typed once on this page) isn't a person on the team: leave it out. Its messages stay in the feed.
  const empty = (p) => p.name !== me && !p.r.agent && !p.r.humanOnline && !p.locks && !p.asks
    && ![...p.agents.values()].some((a) => a.tasks.length || a.id.includes('/'));
  return [...map.values()].filter((p) => !empty(p)).sort((a, b) => (b.name === me) - (a.name === me) || a.name.localeCompare(b.name));
}

// Who is connected, per person: their agents (one per AI tool, see agentInfo) and whether they have this page open.
function roster() { return once('roster', rosterFresh); }
function rosterFresh() {
  const map = new Map();
  const get = (n) => { if (!map.has(n)) map.set(n, { name: n, agent: false, agentOnline: false, started: false, working: false, waiting: false, human: false, humanOnline: false, last: 0, client: null, clients: [], agents: [] }); return map.get(n); };
  for (const a of agentInfo().values()) {
    const r = get(root(a.name)); r.agent = true; r.agents.push(a); r.last = Math.max(r.last, a.last);
    if (a.online) r.agentOnline = true;
    if (a.started) r.started = true;
    if (a.online && a.started) r.working = true;
    if (a.online && !a.started) r.waiting = true;
    if (a.client && !r.clients.includes(a.client)) r.clients.push(a.client);
  }
  for (const p of state.presence || []) {
    if (p.kind !== 'human') continue;
    const n = p.person || root(p.name); if (!n || n === 'board' || n === 'anonymous') continue;
    const r = get(n); r.human = true; r.last = Math.max(r.last, p.last_seen || 0); if (p.online) r.humanOnline = true;
  }
  if (me) { const r = get(me); r.human = true; r.humanOnline = true; }
  for (const r of map.values()) { r.client = r.clients.join(', ') || null; r.agents.sort((a, b) => a.name.localeCompare(b.name)); }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
// Which AI tool a laptop's agent uses ("Codex", "Claude Code", …), or null until it reports it.
const clientOf = (name) => { const a = agentRoot(name); const pr = state.presence || []; const p = pr.find((x) => x.name === a && x.kind === 'agent') || pr.find((x) => x.kind === 'agent' && root(x.name) === root(a) && x.client); return p?.client ? String(p.client) : null; };
// "alice-codex (Codex)": the agent's name and its tool (the name is the agent's own, not its person's: no "'s agent")
const agentOf = (name) => { const c = clientOf(name); return `${name}${c ? ` (${c})` : ''}`; };

// The five setup steps, driven by live state.
function setupInfo() { return once('setup', setupInfoFresh); }
function setupInfoFresh() {
  const S = state.settings; const ros = roster();
  const agents = ros.filter((r) => r.agent);
  const all = ros.flatMap((r) => r.agents);
  const startedA = all.filter((a) => a.started);
  const workingA = all.filter((a) => a.online && a.started);
  const waitingA = all.filter((a) => a.online && !a.started);
  const watchers = ros.filter((r) => r.humanOnline);
  // The online count: started agents the server sees now, minus those out of usage.
  const onlineA = startedA.filter((a) => agentLive(a) && !isLimited(a));
  const limitedA = startedA.filter((a) => isLimited(a));
  const offlineA = startedA.filter((a) => !agentLive(a) && !isLimited(a));
  const n = state.tasks.length;
  // The same count as the top bar's DONE chip: tasks, not counting proposals (named apart).
  const nProp = state.tasks.filter((t) => t.status === 'proposed').length; const nReal = n - nProp;
  const steps = [
    // Step 1 ticks with the first laptop; it still offers to invite more.
    { key: 'invite', title: 'Connect everyone\'s laptop to this board', done: agents.length > 0, left: 'connect a laptop',
      sum: agents.length ? `${plural(agents.length, 'laptop')} connected · invite more` : 'nobody connected yet' },
    { key: 'goal', title: 'Say what you\'re building', done: !!S.goal, left: 'set the goal', sum: (S.goal ? 'set' : 'not set') + (Number(S.deadline) ? ` · demo ${when(Number(S.deadline))}` : S.goal && !dlSkipped() ? ' · no demo time yet' : '') },
    { key: 'start', title: 'Start the agent on every laptop', done: startedA.length > 0, left: 'start an agent',
      sum: startedA.length ? `${plural(startedA.length, 'agent')} started${waitingA.length ? ` · ${waitingA.length} connected, not started` : ''}`
        : waitingA.length ? `${plural(waitingA.length, 'agent')} connected, not started yet` : 'no agent started yet' },
    { key: 'backlog', title: 'Get a task list', done: n > 0 && !approvalWait(), left: approvalWait() ? 'approve the plan' : 'get tasks',
      sum: n ? `${plural(nReal, 'task')}${nProp ? ` · ${nProp} proposed` : ''}${S.planner ? ` · planned by ${S.planner}` : ''}${approvalWait() ? ' · waiting for your approval' : ''}` : (S.planner ? `${S.planner} is planning…` : 'no tasks yet') + (S.require_approval ? ' · you approve it first' : '') },
    { key: 'integrator', title: 'Pick who merges to main', done: !!S.integrator, left: 'pick merger', sum: S.integrator === ANYONE ? 'whoever is free' : S.integrator ? S.integrator : 'optional · not picked' },
  ];
  const cur = (steps.find((s) => !s.done) || {}).key || null;
  const complete = !!S.goal && agents.length > 0 && n > 0;
  const plannerOn = !!S.planner && workingA.some((a) => a.name === S.planner);
  return { steps, cur, complete, agents, startedA, workingA, plannerOn, waitingA, onlineA, limitedA, offlineA, watchers, ros, doneCount: steps.filter((s) => s.done).length };
}
// Online as the server sees it (its presence row) when there is one; recent board events otherwise.
const agentLive = (a) => { const p = (state.presence || []).find((x) => x.kind === 'agent' && String(x.name).toLowerCase() === a.name); return p ? !!p.online : a.online; };
// The humans chose "No demo time" (a board setting, so a teammate's goal save doesn't put a suggested time back).
const dlSkipped = () => state.settings.no_deadline === '1';
// Open until it's done, unless closed (remembered); opened again for this visit only (ui.forceSetup).
function setupOpen(complete) { if (ui.forceSetup) return true; return !complete && store.get('board-setup') !== 'closed'; }
// Setup is a panel above the board on the Board view and a popover under the top bar in the 3D view, open or closed
// the same in both: open until it's done, remembered (a "step" link opens it for this visit). The Setup chip toggles it.
function setupShown(si = setupInfo()) { return setupOpen(si.complete); }
function stepOpen(key, cur) { return key in ui.steps ? ui.steps[key] : key === cur; }
function filterRoot() { return ui.filter === 'me' ? root(me) : ui.filter; }
function taskVisible(t) {
  const r = filterRoot(); if (!r) return true;
  return t.assignee ? root(t.assignee) === r : root(t.created_by) === r;
}
const openQuestions = () => once('questions', () => state.questions.filter((q) => !q.answer).sort((a, b) => a.id - b.id));
const unreadMentions = () => state.events.filter((e) => mentionsMe(e) && e.id > seenMention);

// Demo deadline / feature freeze, computed locally so the countdown moves between server refreshes.
const WARN_MS = 30 * 60e3;
function timeNow() {
  const S = state.settings; const deadline = Number(S.deadline) || 0;
  if (!deadline) return { deadline: 0, frozen: false, warn: false, past: false };
  const fm = Number(S.freeze_minutes) || 0; const freezeAt = deadline - fm * 60e3; const now = Date.now();
  const frozen = now >= freezeAt;
  return { deadline, freezeAt, fm, frozen, past: now >= deadline, warn: !frozen && freezeAt - now <= WARN_MS };
}
// "3h 12m", "45m", "2d 4h"
function dur(ms) {
  const m = Math.max(1, Math.ceil(ms / 60e3)); const h = Math.floor(m / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}
const approvalWait = () => state.phase === 'awaiting_approval';
// What the server's freezeAllows lets an agent claim during the feature freeze (src/board.js): a priority-1 fix that
// isn't large, or a task someone already started (it has a branch, and was in progress or further, or has a PR) and
// that was released. After the demo time nothing is claimed.
const STARTED = ['in_progress', 'blocked', 'review', 'done'];
function wasStarted(t) {
  if (!t?.branch) return false;
  if (t.pr_url || t.pr?.url || ['in_progress', 'blocked', 'review'].includes(t.status)) return true;
  return state.events.some((e) => e.task_id === t.id && e.kind === 'task_updated' && STARTED.includes(e.data?.status));
}
const freezeAllows = (t) => (t.priority === 1 && t.size !== 'L') || wasStarted(t);
// Can an agent claim (or take over) this task right now, as far as the demo time goes: '' if so, else why not, short
// ('demo time passed', 'feature freeze').
function claimHold(t, tm = timeNow()) {
  if (tm.past) return 'demo time passed';
  if (tm.frozen && !freezeAllows(t)) return 'feature freeze';
  return '';
}
// Keep in sync with outlook() in office/src/live/board.ts (the 3D presenter; a separate bundle) and public/present-classic.html.
// Will the work left fit before the freeze (or the demo, once frozen)? Work left = every task not done or proposed,
// at this board's median minutes for its size (state.stats, null until 3 are done), shared over the slots of the
// agents online now, but never less than the longest chain of tasks that wait on each other (more agents can't shorten
// that). A size with too few finished samples is scaled from the sizes that have some (S half, L twice an M), not
// counted as M. Same thresholds as the office demo: up to 0.9 of the time is on track, up to 1.1 tight.
// null: no demo time, it has passed, or nothing is left. {verdict: 'unknown', why} when it can't be estimated yet.
const LEFT_ST = ['open', 'claimed', 'in_progress', 'review', 'blocked'];
const SIZE_W = { S: 0.5, M: 1, L: 2 };
function sizeMinutes(m) {
  const known = Object.keys(SIZE_W).filter((k) => m[k] > 0);
  const unit = known.reduce((a, k) => a + m[k] / SIZE_W[k], 0) / (known.length || 1);
  const est = { S: m.S ?? unit * SIZE_W.S, M: m.M ?? unit * SIZE_W.M, L: m.L ?? unit * SIZE_W.L };
  if (m.M == null) est.M = Math.max(est.M, est.S);
  if (m.L == null) est.L = Math.max(est.L, est.M);
  return est;
}
// The longest run of left tasks that each wait on the one before: its minutes, and how many tasks it has.
function longestChain(left, mins) {
  const by = new Map(left.map((x) => [x.id, x])); const memo = new Map();
  const walk = (x, path) => {
    if (memo.has(x.id)) return memo.get(x.id);
    let best = { min: 0, n: 0 };
    for (const d of x.depends_on || []) {
      const dep = by.get(d); if (!dep || path.has(d)) continue; // done, proposed or a loop: not a wait
      path.add(d); const c = walk(dep, path); path.delete(d);
      if (c.min > best.min) best = c;
    }
    const r = { min: best.min + (mins[x.size] ?? mins.M), n: best.n + 1 };
    memo.set(x.id, r); return r;
  };
  return left.reduce((b, x) => { const c = walk(x, new Set([x.id])); return c.min > b.min ? c : b; }, { min: 0, n: 0 });
}
function outlook(t = timeNow()) {
  if (!t.deadline || t.past) return null;
  const left = state.tasks.filter((x) => LEFT_ST.includes(x.status));
  if (!left.length) return null;
  const m = state.stats?.minutes || {}; const known = Object.values(m);
  if (!known.length) return { verdict: 'unknown', why: 'Not enough finished tasks to estimate yet' };
  const slots = teamCapacity().slots;
  if (!slots) return { verdict: 'unknown', why: 'No agent is online to estimate with' };
  const est = sizeMinutes(m);
  const work = left.reduce((n, x) => n + (est[x.size] ?? est.M), 0); const chain = longestChain(left, est);
  const to = t.frozen ? t.deadline : t.freezeAt;
  const mins = Math.max(1, (to - Date.now()) / 60e3); const chained = chain.n > 1 && chain.min > work / slots; const eta = Math.max(work / slots, chain.min); const ratio = eta / mins;
  const shortBy = ratio > 1 ? Math.max(1, Math.round(left.length * (1 - mins / eta))) : 0;
  const verdict = ratio <= 0.9 ? 'ok' : ratio <= 1.1 ? 'tight' : 'behind';
  const label = verdict === 'ok' ? 'On track' : verdict === 'tight' ? 'Tight' : `Behind by ~${plural(shortBy, 'task')}`;
  const to_ = `${dur(mins * 60e3)} to the ${t.frozen ? 'demo' : 'freeze'}`;
  const why = chained
    ? `About ${dur(eta * 60e3)} left: ${plural(chain.n, 'task')} wait on each other in a row, and more agents can't speed that up (${plural(left.length, 'task')} in all, at this board's median time per size) and ${to_}`
    : `About ${dur(eta * 60e3)} of work left (${plural(left.length, 'task')} at this board's median time per size, over ${plural(slots, 'agent slot')} online) and ${to_}`;
  return { verdict, label, why, shortBy, left };
}

// ---------- one vocabulary and one counting rule: the Board view, the 3D view and both presenters ----------
// Status names: LABEL. A task's column: colOf() (proposals sit, and count, in Open; claimed tasks in In progress). Blocked: blockedSplit() (a blocked task
// that waits on an open question counts once, as the question). Agents: agentsLine() (online = started, seen in the last
// 10 min and not out of usage). The presenters' copies: office/src/live/board.ts (LABEL, columnCounts, needsOf) and
// public/present-classic.html (columnCounts, needsOf).
const colOf = (t) => (t.status === 'proposed' ? 'open' : t.status === 'claimed' ? 'in_progress' : t.status);
// What to do now's links that stay in the 3D view (what they lead to is in its panels or the Setup popover); the rest
// open the Board view (the task columns), and say so there.
const STAYS = ['cut', 'rejected', 'now', 'questions', 'blocked', 'conflict', 'compose', 'mentions', 'idle', 'demo', 'dl-clear'];
// Setup steps stay too: Setup opens as a popover in the 3D view.
const stays = (g) => STAYS.includes(g) || String(g).startsWith('step-');
// "7 agents online · 1 out of usage" (board) / "7 online · 1 out of usage" (the 3D Agents dock): the same numbers.
function agentsLine(si, short = false) {
  return [`${short ? si.onlineA.length : plural(si.onlineA.length, 'agent')} online`, si.waitingA.length && `${si.waitingA.length} not started`,
    si.limitedA.length && `${si.limitedA.length} out of usage`, si.offlineA.length && `${si.offlineA.length} offline`].filter(Boolean).join(' · ');
}
// Blocked tasks with an open question are waiting on that question: count them once, as the question.
function blockedSplit(qOpen = openQuestions()) {
  const asked = new Set(qOpen.map((q) => q.task_id).filter(Boolean));
  const all = state.tasks.filter((t) => t.status === 'blocked');
  return { asked: all.filter((t) => asked.has(t.id)), alone: all.filter((t) => !asked.has(t.id)) };
}

// Tasks in Review that nobody has taken to review for 10+ minutes (no reviewer since they arrived there), oldest first.
const UNREVIEWED_MS = 10 * 60e3;
function reviewSince(t) {
  for (let i = state.events.length - 1; i >= 0; i--) { const e = state.events[i]; if (e.task_id === t.id && e.kind === 'task_updated' && e.data?.status === 'review') return e.ts; }
  return t.updated_at || 0;
}
const unreviewedTasks = () => state.tasks.filter((t) => t.status === 'review' && !t.reviewer)
  .map((t) => ({ t, since: reviewSince(t) })).filter((x) => Date.now() - x.since > UNREVIEWED_MS).sort((a, b) => a.since - b.since);
// Not-done tasks sent back from review twice or more (state.rejects: {id: times}), most bounced first.
const bouncedTasks = () => state.tasks.filter((t) => t.status !== 'done' && (state.rejects?.[t.id] || 0) >= 2)
  .map((t) => ({ id: t.id, title: t.title, n: state.rejects[t.id] })).sort((a, b) => b.n - a.n || a.id - b.id);
// Behind the deadline: up to shortBy unstarted P3 tasks (newest first), capped at half of what's left. null when not behind.
function cutTasks(tm = timeNow()) {
  const ol = outlook(tm); if (ol?.verdict !== 'behind') return null;
  const n = Math.min(ol.shortBy, Math.ceil(ol.left.length / 2));
  const list = state.tasks.filter((t) => t.status === 'open' && t.priority === 3).sort((a, b) => b.id - a.id).slice(0, n);
  return { label: ol.label, list };
}

export { agentInfo, agentInfoNow, agentLimited, agentOf, agentsLine, agentState, approvalWait, blockedSplit,
  bouncedTasks, capText, capTip, claimHold, clientOf, colOf, copilotLaunch, cutTasks, dlSkipped, dur, filterRoot, inPass,
  isLimited, limitText, mergingBy, notStartedText, openQuestions, outlook, people, questionFor, roster, setupInfo,
  setupOpen, setupShown, startCmd, stays, stepOpen, taskVisible, tasksOf, tasksOwnedBy, teamCapacity, timeNow,
  unreadMentions, unreviewedTasks };
