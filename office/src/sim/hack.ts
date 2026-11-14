/** Hackathon mode: plan from a brief, milestones/checklist/deploy, auto scope cuts, submission, auto-restart with the next sample brief. */
import type { HackState, PlannedTicket, Ticket } from '../types';
import { SAMPLE_BRIEFS, planFromBrief } from './briefs';
import { workBaseSeconds } from './difficulty';
import { keyedRng } from './prng';
import type { World } from './world';

/**
 * Pace calibration. The work-duration multiplier for a hackathon is chosen at kickoff so that the whole plan would take about
 * `target` x the window with the current worker count (so a typical run ends with the polish tail cut, not an early finish).
 * Completion time is modelled as scale * k * Σwork / workers + overhead; `k` is measured at scale 1, `overhead` is the ramp-up + review/deploy tail.
 * `fixed` > 0 forces a scale (used by the calibration scripts / tests).
 */
export const HACK_TUNE = { target: 1.12, k: 1.35, overhead: 60, fixed: 0, burnSlope: 0.1 };
/** Fraction of the window the auto scope-cutter keeps free for demo prep. */
const DEMO_RESERVE = 0.06;
/** Seconds before the deadline when the code freeze cuts everything that is not already in review. */
export const FREEZE_S = 30;
/** Seconds after the deadline when anything still open is force-cancelled and the project is submitted. */
export const HARD_GRACE = 25;
/** Seconds between a submission and the next hackathon kickoff. */
export const NEXT_HACK_DELAY = 30;

const STAGE_ORDER: HackState['stage'][] = ['idle', 'kickoff', 'build', 'polish', 'demo', 'submitted'];
const stageIdx = (s: HackState['stage']): number => STAGE_ORDER.indexOf(s);

function terminal(t: Ticket | undefined): boolean { return !t || t.status === 'merged' || t.status === 'cancelled'; }

export function slug(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'project';
}

// ---------------------------------------------------------------- lifecycle
export function beginHackathon(w: World, first: boolean): void {
  const st = w.state, s = w.settings, h = st.hack;
  if (!first) { w.sprintIdx++; w.pruneTerminal(12); }
  w.resetProjectCounters();
  w.planQueue.length = 0; w.msPlanned.clear(); w.msCreated.clear(); w.msAnnounced.clear(); w.msFrac.clear(); w.hackMergedTitles.length = 0;
  w.hackMerged = 0; w.hackIdx = 0; w.hackNextT = 0; w.hackLastCut = -1e9; w.hackSubmitAt = -1; w.hackRestartAt = -1; w.deployDoneAt = -1;
  w.hackFrozen = false; w.submitFx = 0;
  const plan = planFromBrief({ projectName: s.projectName, brief: s.brief, skills: st.skills, seed: s.seed + 977 * w.sprintIdx, maxTickets: 30 });
  for (const p of plan.tickets) { w.planQueue.push(p); w.msPlanned.set(p.milestone, (w.msPlanned.get(p.milestone) ?? 0) + 1); }
  w.hackPlanned = w.planQueue.length;
  w.hackScale = computeScale(w, plan.tickets);
  w.hackBurn = 1 / (1 + HACK_TUNE.burnSlope * Math.max(0, w.hackScale - 1));
  w.hackDoneBase = 0;
  h.milestones.length = 0;
  for (const m of plan.milestones) {
    w.msFrac.set(m.id, m.dueFraction);
    const none = (w.msPlanned.get(m.id) ?? 0) === 0;
    h.milestones.push({ id: m.id, title: m.title, ticketIds: [], done: none, dueMin: m.dueFraction * s.deadlineMinutes });
  }
  h.checklist.length = 0;
  for (const c of plan.checklist) h.checklist.push({ ...c, done: false });
  Object.assign(h, {
    active: true, project: s.projectName, brief: s.brief, stage: 'kickoff', startedAt: st.time, endsAt: st.time + s.deadlineMinutes * 60,
    demoReadiness: 0, deployUrl: null, deployStatus: 'none', pitch: plan.pitch, scopeCuts: 0,
  });
  Object.assign(st.plan, {
    name: `Hackathon: ${s.projectName}`, totalTickets: w.hackPlanned, deadlineMinutes: h.endsAt / 60,
    epics: plan.epics.length ? plan.epics.slice() : ['Core'], note: `Kickoff: breaking the brief into ${w.hackPlanned} tasks`,
  });
  s.totalScope = Math.min(60, Math.max(4, w.hackPlanned));
  w.emit({ type: 'hack_stage', stage: 'kickoff' });
}

function computeScale(w: World, tickets: PlannedTicket[]): number {
  if (HACK_TUNE.fixed > 0) return HACK_TUNE.fixed;
  const s = w.settings;
  let sum = 0;
  for (const p of tickets) sum += workBaseSeconds(p.difficulty);
  const ideal = HACK_TUNE.k * sum / Math.max(1, s.workerCount);
  return Math.min(14, Math.max(0.5, (HACK_TUNE.target * s.deadlineMinutes * 60 - HACK_TUNE.overhead) / ideal));
}

/**
 * Seconds until the whole remaining scope would be merged, or null before there is anything to measure.
 * Model: remaining Σ base work x scale x k / workers (calibrated at kickoff), switched to the measured rate once 30% of the work is done,
 * and never less than the longest single remaining ticket.
 */
export function hackEtaSec(w: World): number | null {
  const st = w.state, h = st.hack;
  if (!h.active) return null;
  let remBase = 0, partBase = 0, longest = 0;
  for (const p of w.planQueue) remBase += workBaseSeconds(p.difficulty);
  for (const t of st.tickets) {
    if (t.status === 'merged' || t.status === 'cancelled') continue;
    const b = workBaseSeconds(t.difficulty);
    const left = t.status === 'in_review' ? 0.05 : t.status === 'changes_requested' ? 0.4 : t.status === 'in_progress' ? Math.max(0.05, 1 - t.progress) : 1;
    remBase += b * left; partBase += b * (1 - left);
    if (b * left > longest) longest = b * left;
  }
  if (remBase <= 0) return 0;
  const s = w.settings;
  const workers = Math.max(1, s.workerCount);
  const elapsed = Math.max(1, st.time - h.startedAt);
  const done = w.hackDoneBase + partBase;
  let rate = workers / (w.hackScale * HACK_TUNE.k);               // base-seconds of work per second
  if (done / (done + remBase) >= 0.3 && elapsed > 120) rate = done / Math.max(60, elapsed - 40);
  rate *= Math.max(0.25, s.workSpeed);
  return Math.max(remBase / rate, longest * w.hackScale / Math.max(0.25, s.workSpeed)) + 20;
}

/** Next planned ticket for the orchestrator to file (plan order, but demo-prep jumps the queue when time runs short). */
export function takePlanned(w: World): PlannedTicket | null {
  const q = w.planQueue;
  if (q.length === 0) return null;
  const h = w.state.hack;
  const win = w.settings.deadlineMinutes * 60;
  let i = 0;
  if (h.endsAt - w.state.time < 0.3 * win) { const d = q.findIndex((p) => p.milestone === 'demo'); if (d >= 0) i = d; }
  return q.splice(i, 1)[0];
}

/** Unclaimed tickets (filed but nobody holds them): the orchestrator keeps this topped up to workers + 2. */
export function unclaimedCount(w: World): number {
  let n = w.held.length;
  for (const t of w.state.tickets) if (t.status === 'backlog' && !w.held.includes(t)) n++;
  return n;
}

export function openCount(w: World): number {
  let n = 0;
  for (const t of w.state.tickets) if (t.status !== 'merged' && t.status !== 'cancelled') n++;
  return n;
}

/** Called by the integrator after each merge. */
export function hackOnMerged(w: World, t: Ticket): void {
  w.hackMerged++;
  w.hackDoneBase += workBaseSeconds(t.difficulty);
  w.hackMergedTitles.push(t.title.toLowerCase());
  if (w.hackMergedTitles.length > 80) w.hackMergedTitles.shift();
}

// ---------------------------------------------------------------- deploy (mock preview URL)
export function startDeploy(w: World): void {
  const h = w.state.hack;
  if (h.deployStatus === 'building') return;
  h.deployStatus = 'building';
  w.deployDoneAt = w.state.time + 5 + 3 * keyedRng(w.settings.seed, `deployt:${w.sprintIdx}:${w.deployN}`).next();
  w.log('integ', 'merge', 'Preview deploy building...');
}

function finishDeploy(w: World): void {
  const h = w.state.hack;
  const n = ++w.deployN;
  const fail = keyedRng(w.settings.seed, `deployf:${w.sprintIdx}:${n}`).next() < 0.12 && h.deployUrl === null && n < 3;
  if (fail) {
    h.deployStatus = 'failed';
    w.deployDoneAt = w.state.time + 4;       // retried automatically
    w.log('integ', 'block', 'Preview deploy failed - retrying');
    return;
  }
  h.deployStatus = 'live';
  if (h.deployUrl === null) {
    h.deployUrl = `https://${slug(h.project)}.agentboard.dev`;
    w.log('integ', 'merge', `Preview is live at ${h.deployUrl}`);
    const ig = w.rts.get('integ');
    if (ig) w.say(ig, 'Preview is live!', 4);
  } else w.log('integ', 'merge', 'Preview redeployed');
}

// ---------------------------------------------------------------- scope cuts
/** Cancel a ticket and shrink the hackathon scope with it. */
export function descope(w: World, id: string): boolean {
  const ok = w.cancelTicket(id);
  const h = w.state.hack;
  if (ok && w.curMode === 'hackathon' && h.active) { w.hackPlanned = Math.max(0, w.hackPlanned - 1); h.scopeCuts++; }
  return ok;
}

interface Cand { rank: number; pri: number; ord: number; qi: number; ticket: Ticket | null; title: string; ms: string | null }

function msRank(ms: string | null): number {
  switch (ms) { case 'polish': return 0; case 'features': return 1; case 'mvp': return 2.5; case 'demo': return 3; default: return 1.5; }
}

/**
 * Cut up to `count` of the least valuable tickets (polish first, then features, then everything else).
 * 'auto' only touches unclaimed work and never MVP/demo; 'human' may also cut started work (last); 'freeze' cuts everything not in review.
 * Returns the titles cut. Throws a volley of 'broadcast' planes at a few workers.
 */
export function cutScope(w: World, count: number, who: 'auto' | 'human' | 'freeze'): string[] {
  const h = w.state.hack;
  if (count <= 0) return [];
  if (w.curMode === 'hackathon') { if (!h.active || h.stage === 'submitted') return []; }
  else if (who !== 'human') return [];
  const cands: Cand[] = [];
  w.planQueue.forEach((p, i) => cands.push({ rank: msRank(p.milestone), pri: p.priority, ord: i, qi: i, ticket: null, title: p.title, ms: p.milestone }));
  let ord = 1000;
  for (const t of w.state.tickets) {
    if (t.status === 'merged' || t.status === 'cancelled' || t.status === 'in_review') continue;
    const started = t.status !== 'backlog';
    if (started && who === 'auto') continue;
    cands.push({ rank: msRank(t.milestone) + (started ? 10 : 0), pri: t.priority, ord: ord++, qi: -1, ticket: t, title: t.title, ms: t.milestone });
  }
  const pool = who === 'auto' ? cands.filter((c) => c.rank < 2.5) : cands;
  pool.sort((a, b) => a.rank - b.rank || a.pri - b.pri || b.ord - a.ord);
  const picked = pool.slice(0, count);
  const cutTitles: string[] = [];
  // queue entries first (remove from the back so indices stay valid), then live tickets
  const qs = picked.filter((c) => c.qi >= 0).sort((a, b) => b.qi - a.qi);
  for (const c of qs) {
    w.planQueue.splice(c.qi, 1);
    w.hackPlanned = Math.max(0, w.hackPlanned - 1); h.scopeCuts++;
    if (c.ms) w.msPlanned.set(c.ms, Math.max(0, (w.msPlanned.get(c.ms) ?? 0) - 1));
    cutTitles.push(c.title);
  }
  for (const c of picked) if (c.ticket && descope(w, c.ticket.id)) cutTitles.push(c.title);
  if (cutTitles.length === 0) return [];
  w.hackLastCut = w.state.time;
  const more = cutTitles.length > 1 ? ` (+${cutTitles.length - 1} more)` : '';
  w.log('orch', 'plan', `Scope cut${who === 'freeze' ? ' (code freeze)' : who === 'auto' ? ' to protect the demo' : ''}: ${cutTitles.join(', ')}`);
  w.postChat('orch', 'you', `Cut ${cutTitles.length} task${cutTitles.length > 1 ? 's' : ''}: ${cutTitles.slice(0, 3).join(', ')}${cutTitles.length > 3 ? '...' : ''}`, 'action');
  const orch = w.rts.get('orch');
  if (orch) { w.say(orch, `Cutting ${cutTitles[0]}${more}`, 4.5); orch.throwT = 0.9; }
  broadcast(w, 'scope trimmed', 'cut');
  if (w.curMode === 'hackathon') w.state.plan.totalTickets = w.hackPlanned;
  w.emit({ type: 'plan_updated', plan: w.state.plan });
  return cutTitles;
}

/** A volley of 'broadcast' planes from the orchestrator to (up to 3) online workers. */
export function broadcast(w: World, text: string, tag: string, max = 3): void {
  const online = w.rtList.filter((r) => r.a.role === 'worker' && r.a.phase !== 'offline' && !r.leaving);
  if (online.length === 0) return;
  const off = w.flightSeq % online.length;
  for (let i = 0; i < Math.min(max, online.length); i++) {
    const r = online[(off + i) % online.length];
    w.sendPlane('broadcast', { agent: 'orch' }, { agent: r.a.id }, `${tag}:${w.flightSeq}:${r.a.id}`, { agent: r.a.id, text }, 'plan', undefined, 0.5 + 0.35 * i);
  }
}

// ---------------------------------------------------------------- per-tick logic (evaluated about once per sim-second)
export function hackTick(w: World): void {
  const st = w.state, h = st.hack, s = w.settings;
  if (s.mode !== 'hackathon' || !h.active) return;
  const now = st.time;
  if (h.deployStatus === 'building' && now >= w.deployDoneAt) finishDeploy(w);
  else if (h.deployStatus === 'failed' && now >= w.deployDoneAt) startDeploy(w);
  if (h.stage === 'submitted') {
    if (w.hackRestartAt >= 0 && now >= w.hackRestartAt) nextHackathon(w);
    return;
  }
  if (now < w.hackNextT) return;
  w.hackNextT = now + 1;

  evalMilestones(w);
  evalChecklist(w);
  advanceStage(w);
  if (stageIdx(h.stage) >= stageIdx('polish') && h.deployStatus === 'none') startDeploy(w);
  if (h.stage === 'demo' && h.deployStatus === 'none') startDeploy(w);

  const win = s.deadlineMinutes * 60;
  const remain = h.endsAt - now;

  // auto scope cuts when the projected finish blows the window (keep a demo reserve)
  if (stageIdx(h.stage) >= stageIdx('build') && now - w.hackLastCut > 20 && remain > FREEZE_S) {
    const eta = hackEtaSec(w);
    if (now - h.startedAt > 0.2 * win && eta !== null && eta > remain - DEMO_RESERVE * win) cutScope(w, 1, 'auto');
  }
  // code freeze
  if (!w.hackFrozen && remain <= FREEZE_S) {
    w.hackFrozen = true;
    cutScope(w, 1e9, 'freeze');
  }
  // submission
  const open = openCount(w);
  const clear = w.planQueue.length === 0 && open === 0;
  const hard = now >= h.endsAt + HARD_GRACE;
  if (hard && !clear) {
    for (const t of [...st.tickets]) if (t.status !== 'merged' && t.status !== 'cancelled') descope(w, t.id);
    w.planQueue.length = 0;
  }
  if (clear || hard) {
    if (h.deployStatus === 'none') startDeploy(w);
    if (h.deployStatus === 'live' || now >= h.endsAt + HARD_GRACE + 15) {
      evalMilestones(w); evalChecklist(w);
      submitHack(w);
    }
  }
}

function evalMilestones(w: World): void {
  const h = w.state.hack;
  for (const ms of h.milestones) {
    if (ms.done) continue;
    const planned = w.msPlanned.get(ms.id) ?? 0, created = w.msCreated.get(ms.id) ?? 0;
    if (created < planned) continue;
    if (!ms.ticketIds.every((id) => terminal(w.tickets.get(id)))) continue;
    ms.done = true;
    if (ms.ticketIds.length > 0 && !w.msAnnounced.has(ms.id)) {
      w.msAnnounced.add(ms.id);
      w.log('orch', 'plan', `Milestone done: ${ms.title}`);
      const orch = w.rts.get('orch');
      if (orch) w.say(orch, `${ms.title} done!`, 4);
      w.emit({ type: 'milestone_done', milestoneId: ms.id });
    }
  }
}

function evalChecklist(w: World): void {
  const st = w.state, h = st.hack;
  const titles = w.hackMergedTitles;
  const has = (re: RegExp): boolean => titles.some((t) => re.test(t));
  const demoMs = h.milestones.find((m) => m.id === 'demo');
  const demoDone = !!demoMs && demoMs.done && demoMs.ticketIds.length > 0;
  for (const c of h.checklist) {
    if (c.done || !c.auto || c.id === 'submitted') continue;
    let ok = false;
    switch (c.id) {
      case 'repo': ok = st.mainCommits > 0; break;
      case 'deploy-live': ok = h.deployStatus === 'live'; break;
      case 'readme': ok = has(/readme/) || demoDone; break;
      case 'demo-script': ok = has(/demo|script/) || demoDone; break;
      case 'pitch': ok = has(/pitch|deck|slides/) || demoDone; break;
      default: {
        const words = c.label.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length >= 4);
        ok = words.length > 0 && titles.some((t) => words.some((x) => t.includes(x)));
      }
    }
    if (ok) c.done = true;
  }
  let ck = 0, ckN = 0;
  for (const c of h.checklist) { ckN++; if (c.done) ck++; }
  let mf = 0;
  for (const m of h.milestones) if (m.done) mf++;
  const msF = h.milestones.length ? mf / h.milestones.length : 0;
  const merged = w.sprintMerged;
  const mergedF = Math.min(1, merged / Math.max(1, w.hackPlanned + 0.5 * h.scopeCuts));
  const r = 0.5 * mergedF + 0.2 * msF + 0.3 * (ckN ? ck / ckN : 0);
  h.demoReadiness = Math.max(0, Math.min(1, h.stage === 'submitted' ? Math.max(r, h.demoReadiness) : r));
}

function advanceStage(w: World): void {
  const h = w.state.hack;
  const done = (id: string): boolean => { const m = h.milestones.find((x) => x.id === id); return !m || m.done; };
  let want: HackState['stage'] = 'kickoff';
  if (w.ticketSeq > 0) want = 'build';
  if (w.sprintMerged > 0 && done('mvp') && done('features')) want = 'polish';
  if (want === 'polish' && done('polish')) want = 'demo';
  if (stageIdx(want) > stageIdx(h.stage)) {
    h.stage = want;
    w.log('orch', 'plan', `Stage: ${want}`);
    w.emit({ type: 'hack_stage', stage: want });
  }
}

function submitHack(w: World): void {
  const st = w.state, h = st.hack;
  h.stage = 'submitted';
  for (const c of h.checklist) if (c.id === 'submitted') c.done = true;
  h.demoReadiness = Math.max(h.demoReadiness, 0);
  w.hackSubmitAt = st.time; w.hackRestartAt = st.time + NEXT_HACK_DELAY;
  w.submitFx = 3;
  const mins = (st.time - h.startedAt) / 60;
  st.plan.note = `Submitted! ${w.sprintMerged} shipped, ${h.scopeCuts} cut`;
  w.log('orch', 'plan', `Submitted ${h.project}: ${w.sprintMerged} tasks shipped, ${h.scopeCuts} cut, ${mins.toFixed(0)}m, $${w.sprintCostUsd.toFixed(0)}${h.deployUrl ? ', live at ' + h.deployUrl : ''}`);
  w.postChat('orch', 'you', `Submitted ${h.project}! ${w.sprintMerged} tasks shipped, ${h.scopeCuts} cut${h.deployUrl ? ' - ' + h.deployUrl : ''}`, 'action');
  const orch = w.rts.get('orch');
  if (orch) w.say(orch, 'Submitted!', 5);
  // everyone who is free cheers
  for (const rt of w.rtList) {
    const a = rt.a;
    if (a.role !== 'worker' || a.phase !== 'idle' || rt.walking || rt.ticket) continue;
    a.phase = 'celebrating'; a.pose = 'celebrate'; rt.t = 0; rt.dur = 3 + 1.5 * rt.rng.next();
    w.say(rt, 'We shipped it!', 3.5);
  }
  w.emit({ type: 'hack_stage', stage: 'submitted' });
  w.emit({ type: 'plan_updated', plan: st.plan });
}

/** Roll into the next hackathon: the next sample brief (cycling), a fresh deadline window, fresh counters. */
function nextHackathon(w: World): void {
  const s = w.settings;
  const n = SAMPLE_BRIEFS.length;
  if (n > 0) {
    const cur = SAMPLE_BRIEFS.findIndex((b) => b.project === s.projectName);
    const nx = SAMPLE_BRIEFS[(cur >= 0 ? cur + 1 : w.sprintIdx + 1) % n];
    s.projectName = nx.project; s.brief = nx.brief;
  }
  w.log('orch', 'plan', `Next hackathon: ${s.projectName}`);
  w.restartProject();
}
