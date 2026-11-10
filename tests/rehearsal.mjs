// Dress rehearsal: a whole hackathon day, compressed, modelled on the real Kubecon board.
// Five agents (two Claude Code with helpers, two Codex, one tool join doesn't know), a planner,
// proposals, "whoever is free" merging with review bounces, an agent going offline, one running
// out of usage, role hand-overs, questions, a feature freeze and the deadline passing.
// After every phase it checks the board's invariants (who holds what, slots, reviews, guidance,
// mentions, response times). Time is faked by ageing timestamps in the board's database.
// Starts its own throwaway board. Run all suites with: npm test
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startBoard, finish, rest, Client, StreamableHTTPClientTransport } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';

const board = await startBoard();
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + String(x).slice(0, 300) : ''}`);
const AGENT_TOKEN = agentTokenFor(board.token);
const err = (r) => (r && r.error) || '';
const human = (p, method = 'GET', body, who = 'dana') => rest(board, who, p, method, body);
const state = () => human('/state');
// A second connection to the live WAL database: wait for the server's writes instead of failing with SQLITE_BUSY.
const db = (fn) => { const d = new DatabaseSync(path.join(board.dataDir, 'board.db')); try { d.exec('PRAGMA busy_timeout = 5000'); return fn(d); } finally { d.close(); } };
const ageAgent = (name, mins = 20) => db((d) => d.prepare("UPDATE presence_v2 SET last_seen = ?, last_active = NULL WHERE kind = 'agent' AND name = ?").run(Date.now() - mins * 60e3, name));
const ageTask = (id, mins = 20) => db((d) => d.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run(Date.now() - mins * 60e3, id));
const root = (n) => String(n || '').split('/')[0];

// An agent connected the way join sets it up: agent token, plan/slots, person and laptop in the URL.
async function agent(name, { client = 'claude-code', plan, slots, person, laptop } = {}) {
  const q = new URLSearchParams({ agent: name, token: AGENT_TOKEN, ...(plan ? { plan } : {}), ...(slots ? { slots: String(slots) } : {}), ...(person ? { person } : {}), ...(laptop ? { laptop } : {}) });
  const c = new Client({ name: client, version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${board.base}/mcp?${q}`)));
  const call = async (tool, args = {}) => {
    const r = await c.callTool({ name: tool, arguments: args });
    const t = r.content[0].text;
    let body; try { body = JSON.parse(t); } catch { body = t; }
    return r.isError ? { error: t } : body;
  };
  await call('board_status'); // someone typed /board
  return call;
}
// A step that must succeed: records a FAIL with the board's reason otherwise.
async function must(label, p) {
  const r = await p;
  if (err(r) || r?.error) check(label, false, err(r) || r.error);
  return r;
}
const timed = async (fn) => { const t0 = Date.now(); const r = await fn(); return [r, Date.now() - t0]; };
const next = (name) => fetch(`${board.base}/api/next?agent=${encodeURIComponent(name)}`, { headers: { Authorization: `Bearer ${AGENT_TOKEN}` } }).then((r) => r.json());

// ---- the board's invariants, checked after every phase ----
const PHASES = ['needs_goal', 'needs_plan', 'awaiting_approval', 'building', 'all_done'];
async function invariants(phase, { expectPhase } = {}) {
  const [st, tState] = await timed(state);
  const [, tSummary] = await timed(() => fetch(`${board.base}/api/summary`, { headers: { Authorization: `Bearer ${board.token}` } }).then((r) => r.text()));
  const agents = st.presence.filter((p) => p.kind === 'agent');
  const nexts = {}; let tNext = 0;
  for (const a of agents) { const [n, t] = await timed(() => next(a.name)); nexts[a.name] = n; tNext = Math.max(tNext, t); }
  const bad = [];
  // Slow machines and CI runners vary: only a really slow response fails; a slowish one is a note.
  const times = `state ${tState} ms, summary ${tSummary} ms, next ${tNext} ms`;
  if (tState > 2000 || tSummary > 2000 || tNext > 2000) bad.push(`slow: ${times}`);
  else if (tState > 500 || tSummary > 500 || tNext > 500) console.log(`note: slow (${phase}): ${times}`);
  if (!PHASES.includes(st.phase)) bad.push(`odd phase ${st.phase}`);
  if (expectPhase && st.phase !== expectPhase) bad.push(`phase ${st.phase}, expected ${expectPhase}`);
  // Slots: claimed + in_progress per agent never above what the board says it may hold.
  for (const a of agents) {
    const held = st.tasks.filter((t) => ['claimed', 'in_progress'].includes(t.status) && root(t.assignee) === a.name).length;
    if (held > a.slots) bad.push(`${a.name} holds ${held} but may hold ${a.slots}`);
  }
  // Nobody reviews their own work.
  for (const t of st.tasks.filter((x) => x.status === 'review' && x.reviewer)) if (root(t.reviewer) === root(t.assignee)) bad.push(`#${t.id} reviewed by its own author ${t.reviewer}`);
  // Every agent gets guidance; none treats an away role holder as present.
  const away = new Set(agents.filter((a) => !a.online || a.limited).map((a) => a.name));
  for (const [name, n] of Object.entries(nexts)) {
    if (!n.next_action || !String(n.next_action).trim()) bad.push(`${name}: empty next_action`);
    for (const h of away) {
      if (h === name) continue;
      if (new RegExp(`${h} is writing the backlog|waiting for ${h} to review|${h} is the integrator and merges`).test(n.next_action)) bad.push(`${name} is told to wait on ${h}, who is away`);
    }
  }
  // A task in review without a reviewer is offered to someone who's around (unless everyone is busy reviewing).
  if (st.settings.integrator === '*' && st.phase === 'building') {
    for (const t of st.tasks.filter((x) => x.status === 'review' && !x.reviewer)) {
      const candidates = agents.filter((a) => a.online && !a.limited && root(t.assignee) !== a.name && !st.tasks.some((x) => x.status === 'review' && root(x.reviewer) === a.name));
      if (candidates.length && !candidates.some((a) => new RegExp(`#${t.id}\\b`).test(nexts[a.name].next_action))) bad.push(`#${t.id} sits in review and no free agent is offered it`);
    }
  }
  // Mentions are real names: no numbers/versions, no npm scopes.
  for (const e of st.events) for (const m of e.data?.mentions || []) if (/^\d/.test(m) || /^(fastify|opentelemetry)\//.test(m)) bad.push(`event ${e.id} mentions "${m}"`);
  check(`invariants after: ${phase}`, !bad.length, bad.join('; '));
  return { st, nexts };
}

// ================= morning: set-up =================
await human('/messages', 'POST', { text: 'hi all, eve here' }, 'eve'); // eve watches the board
const ana = await agent('ana-claude', { plan: 'Claude Max 20x', slots: 3, person: 'ana', laptop: 'lap-ana' });
const ben = await agent('ben-claude', { plan: 'Claude Max 5x', slots: 2, person: 'ben', laptop: 'lap-ben' });
const cy = await agent('cy-codex', { client: 'codex-mcp-client', plan: 'ChatGPT Edu', slots: 1, person: 'cy', laptop: 'lap-cy' });
const dee = await agent('dee-codex', { client: 'codex-mcp-client', plan: 'ChatGPT Edu', slots: 1, person: 'dee', laptop: 'lap-dee' });
const eve = await agent('eve-omp', { client: 'omp-coding-agent', slots: 1, laptop: 'lap-eve' }); // set up by hand: no person
await invariants('agents connected, no goal', { expectPhase: 'needs_goal' });
await human('/settings', 'PUT', { goal: 'Conference companion: schedule, talk search, live Q&A. Demo: register, search, ask a question.', repo: 'https://github.com/team/conf-companion' });
let st = await state();
const person = (n) => st.presence.find((p) => p.kind === 'agent' && p.name === n)?.person;
check('people grouped: join-recorded and guessed (eve-omp → eve)', person('ana-claude') === 'ana' && person('cy-codex') === 'cy' && person('eve-omp') === 'eve', st.presence.map((p) => `${p.name}:${p.person}`).join(','));
await invariants('goal set', { expectPhase: 'needs_plan' });

// ================= planning =================
check('ana takes the planner role', !err(await ana('claim_role', { role: 'planner' })));
check('ben can\'t take it too', /already the planner/.test(err(await ben('claim_role', { role: 'planner' }))));
const q1 = await must('ana asks the humans', ana('ask_human', { question: 'Live Q&A: moderated or open?' }));
// An early proposal doesn't end the planning phase.
const early = await dee('create_task', { title: 'Add dark mode' });
check('an early non-planner task is a proposal', early.status === 'proposed', JSON.stringify(early));
await invariants('early proposal during planning', { expectPhase: 'needs_plan' });
const T = {};
const plan = [
  ['scaffold', 'Scaffold monorepo: api + web', 'M', 1, []],
  ['gitar', 'Review bot rules + CI', 'S', 1, []],
  ['es', 'Search index + manifests', 'M', 1, []],
  ['otel', 'OTel collector with attribute allowlist', 'M', 1, []],
  ['seed', 'Talk catalog seed + mappings', 'M', 1, ['scaffold']],
  ['deploy', 'Deploy api + web', 'M', 1, ['scaffold']],
  ['reg', 'Registration API', 'M', 2, ['seed']],
  ['search', 'Hybrid search API', 'L', 1, ['seed']],
  ['regui', 'Web: registration screens', 'M', 2, ['scaffold']],
  ['sched', 'Web: personal schedule page', 'M', 2, ['scaffold']],
  ['qa', 'Live Q&A websocket', 'M', 2, []],
  ['slo', 'Latency SLO + health checks', 'S', 2, ['otel']],
  ['a11y', 'Accessibility pass', 'S', 3, []],
  ['demo', 'Demo script + seed data', 'S', 2, []],
];
for (const [k, title, size, priority, deps] of plan) {
  T[k] = await must(`planner creates "${title}"`, ana('create_task', { title, size, priority, depends_on: deps.map((d) => T[d].id), description: `Acceptance: ${title} works and has a test.` }));
}
await must('planner reserves an S task for a one-slot agent', ana('update_task', { id: T.demo.id, reserved_for: 'cy-codex' }));
T.dup = await must('planner (by mistake) writes a duplicate', ana('create_task', { title: 'Web: my schedule page', size: 'M' }));
await human(`/questions/${q1.question_id}/answer`, 'POST', { answer: 'Moderated: a human approves each question.' });
await must('planner approves the early proposal', ana('decide_proposal', { id: early.id, approve: true, size: 'S', priority: 3 }));
const prop = await ben('create_task', { title: 'Speaker bios page', size: 'S' });
check('ben\'s new task is a proposal for the planner', prop.status === 'proposed');
check('a proposal can\'t be claimed', /only proposed/.test(err(await cy('claim_task', { id: prop.id }))));
await must('planner approves ben\'s proposal', ana('decide_proposal', { id: prop.id, approve: true }));
check('the planner cancels the duplicate with a reason', !err(await ana('cancel_task', { id: T.dup.id, reason: `duplicate of #${T.sched.id}` })));
await human('/settings', 'PUT', { integrator: '*' });
await invariants('plan written', { expectPhase: 'building' });

// ================= building =================
await must('ana (helper) claims the scaffold', ana('claim_task', { id: T.scaffold.id, as: 'scaffold-worker' }));
await must('ben claims the review bot task', ben('claim_task', { id: T.gitar.id }));
await must('cy claims its reserved task', cy('claim_task', { id: T.demo.id }));
await must('dee claims the search index', dee('claim_task', { id: T.es.id }));
await must('eve-omp claims the OTel collector', eve('claim_task', { id: T.otel.id }));
check('a one-slot agent can\'t take a second task', /may hold 1 at once/.test(err(await cy('claim_task', { id: T.qa.id }))));
check('a task waiting on a dependency can\'t be claimed', /depends on unfinished/.test(err(await ben('claim_task', { id: T.seed.id }))));
for (const [who, t, as] of [[ana, T.scaffold, 'scaffold-worker'], [ben, T.gitar], [cy, T.demo], [dee, T.es], [eve, T.otel]]) await must(`#${t.id} in progress`, who('update_task', { id: t.id, status: 'in_progress', ...(as ? { as } : {}) }));
await must('dee locks a shared file', dee('lock_files', { paths: ['package.json'], task_id: T.es.id, reason: 'adding the ES client', ttl_s: 900 }));
const lockClash = await eve('lock_files', { paths: ['./Package.json'] });
check('another agent\'s lock on the same file (different spelling) is a conflict', lockClash.ok === false && lockClash.conflicts?.[0]?.owner === 'dee-codex', JSON.stringify(lockClash));
await human('/messages', 'POST', { text: '@ben-claude can you check #2? ana opened PR #1, also fixed hit@3 and bumped @fastify/rate-limit to @2.0.2' });
await invariants('everyone working');

// Reviews: "whoever is free". The scaffold first.
await must('scaffold to review with a PR', ana('update_task', { id: T.scaffold.id, status: 'review', note: 'scaffold done, tests pass https://github.com/team/conf-companion/pull/1', as: 'scaffold-worker' }));
check('the author can\'t take its own review while others are around', /your own work/.test(err(await ana('claim_review', { id: T.scaffold.id }))));
check('the author can\'t mark its own reviewed task done', /waiting for review/.test(err(await ana('update_task', { id: T.scaffold.id, status: 'done', as: 'scaffold-worker' }))));
await invariants('scaffold in review');
await must('ben (has a free slot) takes the review', ben('claim_review', { id: T.scaffold.id }));
check('a second reviewer can\'t take it', /already reviewing/.test(err(await ana('claim_review', { id: T.scaffold.id }))) || /your own work/.test(err(await ana('claim_review', { id: T.scaffold.id }))));
await must('ben merges the scaffold', ben('update_task', { id: T.scaffold.id, status: 'done', note: 'merged, tests green on main' }));
st = await state();
check('the PR link came from the author\'s note', st.tasks.find((t) => t.id === T.scaffold.id)?.pr_url === 'https://github.com/team/conf-companion/pull/1');

// The review-bot loop: cy's task bounces twice before it lands.
await must('cy to review', cy('update_task', { id: T.demo.id, status: 'review', note: 'demo script ready https://github.com/team/conf-companion/pull/2' }));
for (let round = 1; round <= 2; round++) {
  await must(`round ${round}: ana takes cy's review`, ana('claim_review', { id: T.demo.id }));
  await must(`round ${round}: ana sends it back`, ana('update_task', { id: T.demo.id, status: 'in_progress', note: `Gitar: changes requested (round ${round}); see also https://github.com/team/conf-companion/pull/9` }));
  const n = await next('cy-codex');
  check(`round ${round}: cy is told to fix it first`, /Sent back from review/.test(n.next_action) && n.actionable === true, n.next_action);
  await must(`round ${round}: cy fixes and resubmits`, cy('update_task', { id: T.demo.id, status: 'review', note: `fixed round ${round}` }));
}
st = await state();
check('a reviewer\'s note about another PR didn\'t replace the link', st.tasks.find((t) => t.id === T.demo.id)?.pr_url === 'https://github.com/team/conf-companion/pull/2');
await must('third time: ana takes it', ana('claim_review', { id: T.demo.id }));
await must('…and merges it', ana('update_task', { id: T.demo.id, status: 'done' }));

// Blocked, then unblocked: a blocked task frees the slot meanwhile.
await must('dee is blocked', dee('update_task', { id: T.es.id, status: 'blocked', note: 'need the cluster credentials' }));
await must('dee releases its lock while blocked', dee('unlock_files', { paths: ['package.json'] }));
await must('blocked, dee takes other work', dee('claim_task', { id: T.qa.id }));
const unblockAtCap = await dee('update_task', { id: T.es.id, status: 'in_progress' });
st = await state();
const deeHeld = st.tasks.filter((t) => ['claimed', 'in_progress'].includes(t.status) && root(t.assignee) === 'dee-codex').length;
check('unblocking while at capacity doesn\'t push an agent over its slots', !!err(unblockAtCap) || deeHeld <= 1, `dee holds ${deeHeld} with 1 slot after unblocking: ${err(unblockAtCap) || 'allowed'}`);
if (!err(unblockAtCap)) await must('(dee puts the search index back to blocked)', dee('update_task', { id: T.es.id, status: 'blocked', note: 'still waiting' }));
await must('helper claims the seed task', ana('claim_task', { id: T.seed.id, as: 'seed-worker' }));
await must('ben takes the deploy task', ben('claim_task', { id: T.deploy.id }));
await invariants('after reviews and bounces');

// ================= trouble =================
// eve-omp goes quiet mid-task: offline + stale, cy takes it over.
ageAgent('eve-omp', 20); ageTask(T.otel.id, 20);
let n = await next('cy-codex');
check('cy is told about the task whose owner went offline', new RegExp(`#${T.otel.id}\\b`).test(n.next_action) && /offline/.test(n.next_action), n.next_action);
await must('cy releases it ("owner offline")', cy('release_task', { id: T.otel.id, note: 'owner offline' }));
await must('cy claims it', cy('claim_task', { id: T.otel.id }));
// ben hits its usage limit; a human marks it, dee takes its task over.
await must('a human marks ben as out of usage', human('/agents/ben-claude', 'PATCH', { limited: true, until: Date.now() + 90 * 60e3, note: 'weekly cap' }));
st = await state();
check('ben shows as out of usage, not counted as free', !!st.presence.find((p) => p.name === 'ben-claude')?.limited);
await must('dee finishes its Q&A task first', dee('update_task', { id: T.qa.id, status: 'review', note: 'ws done https://github.com/team/conf-companion/pull/3' }));
await must('dee releases ben\'s deploy task ("owner out of usage")', dee('release_task', { id: T.deploy.id, note: 'owner out of usage' }));
await must('dee claims it', dee('claim_task', { id: T.deploy.id }));
await invariants('agents offline / out of usage');
// The planner goes away: someone takes the role over; later the new holder hands it back.
ageAgent('ana-claude', 20);
const took = await must('cy takes over the planner role', cy('claim_role', { role: 'planner' }));
check('took over from ana', took.took_over_from === 'ana-claude', JSON.stringify(took));
await must('cy gives the role up again (can\'t plan from a one-slot laptop)', cy('release_role', { role: 'planner', note: 'one slot, too busy' }));
check('dee takes the planner role', !err(await dee('claim_role', { role: 'planner' })));
// ana's work while it's away: the seed task (held by its helper) — reviewed by dee? No: it's ana's, in progress.
// A human assigns a task directly to cy.
await must('cy finishes the OTel task', cy('update_task', { id: T.otel.id, status: 'review', note: 'https://github.com/team/conf-companion/pull/4' }));
await must('a human assigns the SLO task to cy', human(`/tasks/${T.slo.id}`, 'PATCH', { assignee: 'cy-codex' }));
st = await state();
check('assigned task is claimed for cy and cy is @mentioned', st.tasks.find((t) => t.id === T.slo.id)?.status === 'claimed' && st.events.some((e) => e.task_id === T.slo.id && (e.data?.mentions || []).includes('cy-codex')));
await invariants('role hand-overs and assignment');

// Reviews keep flowing while ana is away: dee merges cy's OTel, cy merges dee's Q&A.
await must('dee reviews the OTel task', dee('claim_review', { id: T.otel.id }));
await must('dee merges it', dee('update_task', { id: T.otel.id, status: 'done' }));
await must('cy reviews dee\'s Q&A', cy('claim_review', { id: T.qa.id }));
await must('cy merges it', cy('update_task', { id: T.qa.id, status: 'done' }));

// ================= feature freeze =================
await human('/settings', 'PUT', { deadline: Date.now() + 5 * 60e3, freeze_minutes: 10 });
st = await state();
check('freeze is on', st.time.frozen === true && st.time.past === false);
const bug = await human('/tasks', 'POST', { title: 'Fix: search crashes on empty query', priority: 1, size: 'S' });
check('during the freeze a normal task can\'t be claimed', /Feature freeze/.test(err(await ben('claim_task', { id: T.a11y.id }))));
// ben calling the board clears its out-of-usage mark only after a minute; a P1 bug is still claimable — by eve (back online).
await must('eve-omp is back and takes the P1 bug', eve('claim_task', { id: bug.id }));
await invariants('feature freeze');

// ================= the deadline passes: wrap up =================
await human('/settings', 'PUT', { deadline: Date.now() + 1000, freeze_minutes: 0 }); // a past time is refused: let it pass
await new Promise((r) => setTimeout(r, 1200));
n = await next('cy-codex');
check('after the deadline agents are told to wrap up', /has passed/.test(n.next_action), n.next_action);
// Finish what can land, release the rest, the planner cancels what won't happen.
const ana2 = await agent('ana-claude', { plan: 'Claude Max 20x', slots: 3, person: 'ana', laptop: 'lap-ana' }); // ana's laptop is back
// Like agents do: whoever the board lets take the review (a free slot, or nobody else has one) merges it.
const finishTask = async (owner, id, reviewers, as) => {
  await must(`#${id} to review`, owner('update_task', { id, status: 'review', note: `done https://github.com/team/conf-companion/pull/${100 + id}`, ...(as ? { as } : {}) }));
  const why = [];
  for (const r of reviewers) {
    const c = await r('claim_review', { id });
    if (err(c)) { why.push(err(c)); continue; }
    await must(`#${id} merged`, r('update_task', { id, status: 'done' }));
    return;
  }
  check(`#${id}: some agent could take the review`, false, why.join(' | '));
};
await finishTask(eve, bug.id, [cy, dee, ana2]);
await must('cy picks up the assigned SLO task', cy('update_task', { id: T.slo.id, status: 'in_progress' }));
await finishTask(cy, T.slo.id, [dee, eve, ana2]);
await finishTask(dee, T.deploy.id, [eve, cy, ana2]);
await finishTask(ana2, T.seed.id, [cy, dee, eve], 'seed-worker');
await must('dee releases the still-blocked search index', dee('release_task', { id: T.es.id, note: 'no credentials in time' }));
await must('ben gives back the review bot task (out of usage)', human(`/tasks/${T.gitar.id}`, 'PATCH', { status: 'open' }));
st = await state();
for (const t of st.tasks.filter((x) => x.status !== 'done')) {
  const r = await dee('cancel_task', { id: t.id, reason: 'not landing before the demo' });
  if (err(r)) await human(`/tasks/${t.id}`, 'DELETE');
}
st = await state();
check('end of day: every task is done or was cancelled', st.tasks.every((t) => t.status === 'done'), st.tasks.filter((t) => t.status !== 'done').map((t) => `#${t.id} ${t.status}`).join(', '));
check('…and nothing is still in review or held', !st.tasks.some((t) => ['review', 'claimed', 'in_progress', 'blocked', 'proposed'].includes(t.status)));
await invariants('end of day', { expectPhase: 'all_done' });

// ================= the write-ups =================
const summary = await fetch(`${board.base}/api/summary`, { headers: { Authorization: `Bearer ${board.token}` } }).then((r) => r.text());
check('summary lists done work per person (not per tool)', /### ana/.test(summary) && /### cy/.test(summary) && /### dee/.test(summary) && /### eve/.test(summary) && !/### ana-claude/.test(summary), summary.slice(0, 400));
check('summary records the human decision', /Moderated/.test(summary));
const retro = await fetch(`${board.base}/api/retro`, { headers: { Authorization: `Bearer ${board.token}` } });
const md = await retro.text();
check('retro is markdown', retro.status === 200 && /markdown/.test(retro.headers.get('content-type') || '') && /^# /.test(md.trim()), md.slice(0, 200));
const sentBack = md.match(/## Sent back from review\n([\s\S]*?)(?:\n## |$)/)?.[1] || '';
check("retro counts the demo task's two bounces", new RegExp(`^- #${T.demo.id} [^\\n]*: 2×$`, 'm').test(sentBack), sentBack.slice(0, 300));

await finish(R, { board });
