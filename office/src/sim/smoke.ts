/**
 * Headless smoke test for the simulation: `npm run test:sim`.
 * Runs a set of scenarios (sprint + hackathon, flights, help, chat, commands), asserts invariants every few steps,
 * prints a summary table and exits non-zero on failure.
 */
import { DESKS, STATIONS } from '../layout';
import { SKILL_SLOTS } from '../skills';
import type { FlightKind, HelpRequest, LogEntry, SimEvent, SimSettings } from '../types';
import { Simulation, SAMPLE_BRIEFS } from './index';

declare const process: { exit(code: number): never };

const failures: string[] = [];
function fail(scenario: string, msg: string): void {
  if (failures.length < 40) failures.push(`[${scenario}] ${msg}`);
}

interface Result {
  name: string; merged: number; thr: number; cycle: number; util: number; cost: number; perMerge: number; maxInbox: number; inboxShare: number;
  rejected: number; compactions: number; ratio: number; burn: number;
}

const DT = 1 / 30;
const FLIGHT_KINDS: FlightKind[] = ['pr', 'merged', 'changes', 'help', 'help_reply', 'assign', 'chat', 'broadcast'];
const HACK_STAGES = ['kickoff', 'build', 'polish', 'demo', 'submitted'];

class Run {
  prev = new Map<string, { x: number; z: number }>();
  maxWalk = 1;
  maxInbox = 0; inboxSteps = 0; steps = 0;
  libMeters = 0; lastWalked = new Map<string, number>();
  events: SimEvent[] = []; evT: number[] = [];
  phases = new Map<string, { t: number; phase: string }[]>();
  poses = new Set<string>();
  maxFlights = 0; maxHelp = 0; maxChat = 0; maxLog = 0;
  allowEmptySkills = false;
  helpReqs: HelpRequest[] = [];
  /** Every log entry ever seen (state.log itself is capped at 200). */
  logs: LogEntry[] = []; private logSeen: LogEntry | null = null;
  constructor(public name: string, public sim: Simulation) {
    sim.on((e) => { this.events.push(e); this.evT.push(sim.state.time); if (e.type === 'help_requested') this.helpReqs.push(e.request); });
    this.maxWalk = sim.settings.walkSpeed;
  }

  ev<T extends SimEvent['type']>(type: T): Extract<SimEvent, { type: T }>[] { return this.events.filter((e) => e.type === type) as Extract<SimEvent, { type: T }>[]; }

  step(dt = DT): void {
    const sim = this.sim, st = sim.state;
    const sp = sim.settings.simSpeed;
    this.maxWalk = Math.max(this.maxWalk, sim.settings.walkSpeed);
    sim.step(dt);
    this.steps++;
    const limit = this.maxWalk * 1.6 * Math.min(dt * sp, 0.5) * 1.2 + 0.01;
    const seen = new Set<string>();
    for (const a of st.agents) {
      seen.add(a.id);
      this.poses.add(a.pose);
      if (!Number.isFinite(a.pos.x) || !Number.isFinite(a.pos.z) || !Number.isFinite(a.heading)) fail(this.name, `NaN pos/heading on ${a.id}`);
      const p = this.prev.get(a.id);
      if (p) {
        const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z);
        if (d > limit) fail(this.name, `${a.id} moved ${d.toFixed(3)}m in one step (limit ${limit.toFixed(3)}) at t=${st.time.toFixed(1)} phase=${a.phase}`);
        p.x = a.pos.x; p.z = a.pos.z;
      } else this.prev.set(a.id, { x: a.pos.x, z: a.pos.z });
      const lw = this.lastWalked.get(a.id) ?? a.stats.walkedMeters;
      if (a.phase === 'to_library') this.libMeters += a.stats.walkedMeters - lw;
      this.lastWalked.set(a.id, a.stats.walkedMeters);
      let ph = this.phases.get(a.id);
      if (!ph) { ph = []; this.phases.set(a.id, ph); }
      if (ph.length === 0 || ph[ph.length - 1].phase !== a.phase) ph.push({ t: st.time, phase: a.phase });
    }
    for (const id of [...this.prev.keys()]) if (!seen.has(id)) { this.prev.delete(id); this.lastWalked.delete(id); }
    if (st.inboxStacks > this.maxInbox) this.maxInbox = st.inboxStacks;
    if (st.inboxStacks > 0) this.inboxSteps++;
    this.maxFlights = Math.max(this.maxFlights, st.flights.length); this.maxHelp = Math.max(this.maxHelp, st.help.length);
    this.maxChat = Math.max(this.maxChat, st.chat.length); this.maxLog = Math.max(this.maxLog, st.log.length);
    const lg = st.log;
    let from = 0;
    if (this.logSeen) { const i = lg.lastIndexOf(this.logSeen); from = i >= 0 ? i + 1 : 0; }
    for (let i = from; i < lg.length; i++) this.logs.push(lg[i]);
    if (lg.length) this.logSeen = lg[lg.length - 1];
    if (this.steps % 15 === 0) this.check();
  }

  /** Did `agent` have `phase` at any moment in [t0, t1]? */
  hadPhase(agent: string, phase: string, t0: number, t1: number): boolean {
    const ph = this.phases.get(agent);
    if (!ph) return false;
    for (let i = 0; i < ph.length; i++) {
      const s = ph[i].t, e = i + 1 < ph.length ? ph[i + 1].t : Infinity;
      if (ph[i].phase === phase && s <= t1 && e >= t0) return true;
    }
    return false;
  }

  check(): void {
    const sim = this.sim, st = sim.state, m = st.metrics, n = this.name;
    const byId = new Map(st.agents.map((a) => [a.id, a]));
    const skillIds = new Set(st.skills.map((k) => k.id));
    const holders = new Map<string, string[]>();
    let sumAgents = 0;
    if (st.libraryStock.length !== st.skills.length || st.libraryStock.some((id) => !skillIds.has(id))) fail(n, 'libraryStock does not match skills');
    for (const a of st.agents) {
      sumAgents += a.usage.costUsd;
      if (!(a.usage.costUsd >= 0) || !(a.burnUsdPerMin >= 0) || !(a.subagentCostUsd >= 0) || a.subagentCostUsd > a.usage.costUsd + 1e-9) fail(n, `bad usage on ${a.id}`);
      if (a.skills.length > SKILL_SLOTS) fail(n, `${a.id} has ${a.skills.length} skills`);
      for (const s of a.skills) if (!skillIds.has(s)) fail(n, `${a.id} carries dangling skill ${s}`);
      if (a.waitingOn !== null && !byId.has(a.waitingOn) && a.waitingOn !== 'orch') fail(n, `${a.id} waitingOn ${a.waitingOn}`);
      if (a.helping !== null && !byId.has(a.helping)) fail(n, `${a.id} helping ${a.helping}`);
      if (a.contextFill < 0 || a.contextFill > 1.5 || !Number.isFinite(a.contextFill)) fail(n, `${a.id} contextFill ${a.contextFill}`);
      if (a.activeSubagents > a.config.subagents) fail(n, `${a.id} activeSubagents ${a.activeSubagents} > ${a.config.subagents}`);
      if (a.role === 'worker' && a.ticketId) { const l = holders.get(a.ticketId) ?? []; l.push(a.id); holders.set(a.ticketId, l); }
      if (a.role === 'worker' && (a.phase === 'working' || a.phase === 'reworking' || (a.phase === 'idle' && (a.pose === 'wait' || a.pose === 'sleep')))) {
        const d = DESKS[a.deskIndex];
        if (Math.hypot(a.pos.x - d.seat.x, a.pos.z - d.seat.z) > 1e-6) fail(n, `${a.id} ${a.phase}/${a.pose} but not at its seat`);
      }
      if (a.phase === 'offline' && a.pose !== 'sleep' && a.pose !== 'walk' && a.pose !== 'carry_walk') fail(n, `offline ${a.id} pose ${a.pose}`);
    }
    let sumTickets = 0;
    for (const t of st.tickets) {
      sumTickets += t.usage.costUsd;
      if (!(t.usage.costUsd >= 0) || !(t.reviewCostUsd >= 0) || t.reviewCostUsd > t.usage.costUsd + 1e-9 || !(t.estimatedCostUsd > 0)) fail(n, `bad ticket cost ${t.id}`);
      if (t.status === 'backlog' && t.assignee !== null) fail(n, `${t.id} backlog with assignee`);
      if (t.status === 'merged' && t.assignee === null) fail(n, `${t.id} merged without assignee`);
      if (t.skills.length > 4 || (!this.allowEmptySkills && t.skills.length < 1)) fail(n, `${t.id} has ${t.skills.length} skills`);
      for (const s of t.skills) if (!skillIds.has(s)) fail(n, `${t.id} has dangling skill ${s}`);
      if (t.helpRequests < 0 || !Number.isFinite(t.priority)) fail(n, `${t.id} bad helpRequests/priority`);
      if (t.status === 'assigned' || t.status === 'in_progress' || t.status === 'in_review' || t.status === 'changes_requested') {
        const ag = t.assignee ? byId.get(t.assignee) : undefined;
        if (!ag) { fail(n, `${t.id} (${t.status}) has missing assignee ${t.assignee}`); continue; }
        if (ag.ticketId !== t.id) fail(n, `${t.id} (${t.status}) assignee ${ag.id} holds ${ag.ticketId}`);
        if (t.status === 'in_progress') for (const s of t.skills) if (!ag.skills.includes(s)) fail(n, `${t.id} in_progress but ${ag.id} lacks skill ${s}`);
      }
      if (t.pinnedTo !== null && !byId.has(t.pinnedTo)) fail(n, `${t.id} pinned to missing agent ${t.pinnedTo}`);
    }
    for (const [tid, list] of holders) if (list.length > 1) fail(n, `ticket ${tid} held by ${list.join(',')}`);
    for (const [tid, list] of holders) {
      const t = st.tickets.find((x) => x.id === tid);
      if (!t || t.assignee !== list[0]) fail(n, `agent ${list[0]} holds ${tid} which is assigned to ${t?.assignee}`);
      else if (t.status === 'cancelled' || t.status === 'merged') fail(n, `agent ${list[0]} still holds ${t.status} ticket ${tid}`);
    }
    if (!Number.isFinite(m.totalCostUsd) || m.totalCostUsd < 0) fail(n, 'bad totalCostUsd');
    if (Math.abs(sumAgents + sim.retiredCostUsd - m.totalCostUsd) > 0.01) fail(n, `agent usage ${sumAgents.toFixed(3)} + retired ${sim.retiredCostUsd.toFixed(3)} != total ${m.totalCostUsd.toFixed(3)}`);
    if (sumTickets > m.totalCostUsd + 0.01) fail(n, `ticket usage ${sumTickets.toFixed(3)} > total ${m.totalCostUsd.toFixed(3)}`);
    const tier = Object.values(m.costByTier).reduce((x, y) => x + y, 0);
    const prov = m.costByProvider.claude + m.costByProvider.codex;
    if (Math.abs(tier - m.totalCostUsd) > 0.01 || Math.abs(prov - m.totalCostUsd) > 0.01) fail(n, 'costByTier/Provider do not sum to total');
    for (const k of ['merged', 'open', 'throughputPerMin', 'avgCycleSec', 'utilization', 'scopeDone', 'burnUsdPerMin', 'avgCostPerMergedUsd', 'wasteUsd', 'projectedScopeCostUsd', 'budgetUsedPct', 'orchestrationCostUsd', 'helpTotal', 'helpOpen'] as const) {
      const v = m[k];
      if (!Number.isFinite(v) || v < 0) fail(n, `metric ${k} = ${v}`);
    }
    if (m.scopeDone > 1) fail(n, `scopeDone ${m.scopeDone}`);
    if (m.etaMinutes !== null && (!Number.isFinite(m.etaMinutes) || m.etaMinutes < 0)) fail(n, `eta ${m.etaMinutes}`);
    if (st.depotStacks < 0 || st.inboxStacks < 0) fail(n, 'negative stacks');
    if (st.outStacks !== 0) fail(n, `outStacks ${st.outStacks} (no tray walks any more)`);
    if (st.log.length > 200) fail(n, 'log too long');
    // flights: valid, short-lived, bounded
    const fids = new Set<string>();
    for (const f of st.flights) {
      if (fids.has(f.id)) fail(n, `duplicate flight id ${f.id}`);
      fids.add(f.id);
      if (!FLIGHT_KINDS.includes(f.kind)) fail(n, `flight kind ${f.kind}`);
      if (!(f.dur >= 2 && f.dur <= 4) || !Number.isFinite(f.t0)) fail(n, `flight ${f.id} t0=${f.t0} dur=${f.dur}`);
      if (st.time > f.t0 + f.dur + 1.7) fail(n, `flight ${f.id} not pruned (${(st.time - f.t0 - f.dur).toFixed(2)} s after landing)`);
      for (const e of [f.from, f.to]) {
        if ('station' in e) { if (!(e.station in STATIONS)) fail(n, `flight ${f.id} bad station ${e.station}`); }
        else if (typeof e.agent !== 'string' || ((e.agent === 'orch' || e.agent === 'integ') && !byId.has(e.agent))) fail(n, `flight ${f.id} bad endpoint`);
      }
    }
    if (st.flights.length > 80) fail(n, `${st.flights.length} flights alive`);
    // help
    if (st.help.length > 30) fail(n, `help list grew to ${st.help.length}`);
    let hopen = 0;
    for (const r of st.help) {
      if (r.status === 'open') { hopen++; if (st.time - r.t0 > 60) fail(n, `help ${r.id} open for ${(st.time - r.t0).toFixed(0)} s`); }
      if (r.status === 'answered' && !r.answer) fail(n, `help ${r.id} answered without text`);
    }
    if (m.helpOpen !== hopen && this.steps % 15 === 0 && Math.abs(m.helpOpen - hopen) > 0) { /* metrics are per step; tolerate a one-step lag */ }
    if (st.chat.length > 200) fail(n, `chat grew to ${st.chat.length}`);
    for (const t of st.tickets) if (t.status === 'in_review' || t.status === 'changes_requested') {
      const a = t.assignee ? byId.get(t.assignee) : undefined;
      if (a && a.phase === 'working' && t.status === 'in_review') fail(n, `${t.id} in_review but ${a.id} is working`);
    }
  }

  minutes(min: number, dt = DT): void { const n = Math.round(min * 60 / (dt * this.sim.settings.simSpeed)); for (let i = 0; i < n; i++) this.step(dt); }
  seconds(sec: number, dt = DT): void { const n = Math.max(1, Math.round(sec / (dt * this.sim.settings.simSpeed))); for (let i = 0; i < n; i++) this.step(dt); }

  /** End-of-run semantic checks on flights and help requests. */
  finish(): void {
    this.check();
    const n = this.name, st = this.sim.state, end = st.time;
    const byId = new Map(st.tickets.map((t) => [t.id, t]));
    const agents = new Set(st.agents.map((a) => a.id));
    for (let i = 0; i < this.events.length; i++) {
      const e = this.events[i];
      if (e.type !== 'flight') continue;
      const f = e.flight, lead = f.t0 - this.evT[i], land = f.t0 + f.dur;
      if (lead < 0.4 || lead > 1.3) fail(n, `flight ${f.id} (${f.kind}) leaves ${lead.toFixed(2)} s after it is announced`);
      if (f.dur < 2.49 || f.dur > 3.21) fail(n, `flight ${f.id} (${f.kind}) dur ${f.dur.toFixed(2)}`);
      if (land > end - 18) continue;
      const t = f.ticketId ? byId.get(f.ticketId) : undefined;
      const cancelled = !!t && t.status === 'cancelled';
      const to = 'agent' in f.to ? f.to.agent : '';
      const goneOrAway = (id: string): boolean => !agents.has(id) || this.hadPhase(id, 'offline', land - 25, land + 16);
      if (f.kind === 'pr' && t && !cancelled) {
        const k = this.events.findIndex((x, j) => x.type === 'pr_opened' && x.ticket.id === f.ticketId && this.evT[j] >= land - 0.06 && this.evT[j] <= land + 0.7);
        if (k < 0) fail(n, `pr flight ${f.id} for ${f.ticketId} landed at ${land.toFixed(1)} but no pr_opened followed`);
        const early = this.events.findIndex((x, j) => x.type === 'pr_opened' && x.ticket.id === f.ticketId && this.evT[j] < land - 0.06 && this.evT[j] > this.evT[i]);
        if (early >= 0) fail(n, `pr_opened for ${f.ticketId} fired before its plane landed`);
      } else if (f.kind === 'merged' && !goneOrAway(to)) {
        if (!this.hadPhase(to, 'celebrating', land - 0.01, land + 16)) fail(n, `${to} did not celebrate after the merged plane (${f.ticketId}) landed at ${land.toFixed(1)}`);
      } else if (f.kind === 'changes' && t && !cancelled && !goneOrAway(to)) {
        if (!this.hadPhase(to, 'reworking', land - 0.01, land + 16)) fail(n, `${to} did not start rework after the changes plane (${f.ticketId}) landed at ${land.toFixed(1)}`);
      }
    }
    let open = 0;
    for (const r of st.help) if (r.status === 'open') open++;
    for (const r of this.helpReqs) if (r.status === 'open' && end - r.t0 > 60) fail(n, `help ${r.id} never resolved`);
    if (st.metrics.helpTotal !== this.helpReqs.length) fail(n, `helpTotal ${st.metrics.helpTotal} != ${this.helpReqs.length} help_requested events`);
    if (st.metrics.helpOpen !== open && Math.abs(st.metrics.helpOpen - open) > 2) fail(n, `helpOpen ${st.metrics.helpOpen} vs ${open}`);
    if (this.maxFlights > 80 || this.maxHelp > 30 || this.maxChat > 200 || this.maxLog > 200) fail(n, `unbounded arrays: flights ${this.maxFlights} help ${this.maxHelp} chat ${this.maxChat} log ${this.maxLog}`);
  }

  result(): Result {
    const st = this.sim.state, m = st.metrics;
    let comp = 0;
    for (const a of st.agents) comp += a.compactions;
    const ratios: number[] = [];
    for (const t of st.tickets) if (t.status === 'merged') ratios.push(t.usage.costUsd / t.estimatedCostUsd);
    const ratio = ratios.length ? ratios.reduce((x, y) => x + y, 0) / ratios.length : 0;
    return {
      name: this.name, merged: m.merged, thr: m.throughputPerMin, cycle: m.avgCycleSec, util: m.utilization, cost: m.totalCostUsd,
      perMerge: m.avgCostPerMergedUsd, maxInbox: this.maxInbox, inboxShare: this.inboxSteps / Math.max(1, this.steps), rejected: m.rejected,
      compactions: comp, ratio, burn: m.burnUsdPerMin,
    };
  }
}

const results: Result[] = [];
const mk = (name: string, s: Partial<SimSettings> = {}): Run => new Run(name, new Simulation({ simSpeed: 2, mode: 'sprint', ...s }));
const mkHack = (name: string, s: Partial<SimSettings> = {}): Run => new Run(name, new Simulation({ simSpeed: 1, mode: 'hackathon', ...s }));
const HDT = 0.2;   // coarse step for the long hackathon runs

// 1. default sprint mode (also covers the paper-plane flows)
{
  const r = mk('default');
  r.minutes(10);
  const m10 = r.sim.state.metrics.merged;
  r.minutes(10);
  r.finish();
  const res = r.result(); results.push(res);
  if (m10 < 5) fail('default', `only ${m10} merges in 10 sim minutes`);
  if (r.sim.state.metrics.merged < m10 + 3) fail('default', 'merges stalled in the second 10 minutes');
  if (r.libMeters <= 0) fail('default', 'no library walking recorded in walkedMeters');
  if (!r.events.some((e) => e.type === 'skills_loaded')) fail('default', 'no skills_loaded event');
  if (!r.events.some((e) => e.type === 'compaction')) fail('default', 'no compaction event');
  if (!r.events.some((e) => e.type === 'pr_rejected')) fail('default', 'no rejection at rejectRate 0.25');
  if (!r.events.some((e) => e.type === 'pr_merged')) fail('default', 'no merge');
  if (res.ratio < 0.6 || res.ratio > 1.8) fail('default', `actual/estimate cost ratio ${res.ratio.toFixed(2)} out of range`);
  const kinds = new Set(r.ev('flight').map((e) => e.flight.kind));
  for (const k of ['pr', 'merged', 'changes', 'help', 'help_reply'] as FlightKind[]) if (!kinds.has(k)) fail('default', `no '${k}' flight in 20 min`);
  if (r.ev('flight').filter((e) => e.flight.kind === 'pr').length < 8) fail('default', 'too few pr flights');
  if (!r.poses.has('throw')) fail('default', `no 'throw' pose seen`);
  if (![...r.phases.values()].some((l) => l.some((x) => x.phase === 'submitting'))) fail('default', `no 'submitting' phase seen`);
  if (![...r.phases.values()].some((l) => l.some((x) => x.phase === 'helping'))) fail('default', `no 'helping' phase seen`);
  if (![...r.phases.values()].some((l) => l.some((x) => x.phase === 'awaiting_help'))) fail('default', `no 'awaiting_help' phase seen`);
  if (!r.poses.has('raise_hand')) fail('default', `no 'raise_hand' pose seen`);
  const answered = r.helpReqs.filter((q) => q.status === 'answered').length;
  if (r.helpReqs.length < 5) fail('default', `only ${r.helpReqs.length} help requests in 20 min`);
  if (answered < 2) fail('default', `only ${answered} help requests answered`);
  if (r.sim.state.tickets.some((t) => t.helpRequests > 0) === false) fail('default', 'ticket.helpRequests never incremented');
  if (!r.sim.state.log.some((l) => l.kind === 'help') && !r.events.some((e) => e.type === 'help_answered')) fail('default', 'no help log/event');
  console.log(`  default: merges at 10 min = ${m10}, help ${r.helpReqs.length} (${answered} answered), flights ${r.ev('flight').length}`);
}
// 2. busy office
results.push((() => { const r = mk('12 workers, 5/min', { workerCount: 12, ticketsPerMinute: 5, totalScope: 60 }); r.minutes(20); r.finish(); return r.result(); })());
// 3. harsh reviewer
results.push((() => { const r = mk('rejectRate 0.7', { rejectRate: 0.7 }); r.minutes(20); r.finish(); const x = r.result(); if (x.rejected < 3) fail('rejectRate 0.7', 'too few rejections'); return x; })());
// 4. one worker
results.push((() => { const r = mk('1 worker', { workerCount: 1 }); r.minutes(20); r.finish(); const x = r.result(); if (x.merged < 1) fail('1 worker', 'no merges'); return x; })());
// 5. settings churn mid-run
{
  const r = mk('settings churn', { totalScope: 12 });
  r.minutes(3);
  r.sim.setSettings({ workerCount: 12, ticketsPerMinute: 4, codexShare: 0.8 });
  r.minutes(3);
  r.sim.setSettings({ workerCount: 2, codexShare: 0, blockRate: 0.5, rejectRate: 0.6 });
  r.minutes(2);
  r.sim.setSettings({ workerCount: 8, configMode: 'manual', walkSpeed: 2.5, totalScope: 30 });
  r.minutes(2);
  r.sim.setAgentOverride('a2', { offline: true });
  r.sim.setAgentOverride('a3', { model: 'claude-opus-5-5', subagents: 6 });
  r.sim.addTicket(5); r.sim.addTicket(1);
  r.minutes(2);
  r.sim.setAgentOverride('a2', null); r.sim.setAgentOverride('a3', null);
  r.sim.setSettings({ configMode: 'auto', workerCount: 1, workSpeed: 3, simSpeed: 4 });
  r.minutes(3);
  r.sim.setSettings({ workerCount: 12, simSpeed: 1, budgetUsd: 0, walkSpeed: 1 });
  r.minutes(3);
  r.finish();
  results.push(r.result());
  const a3 = r.sim.state.agents.find((a) => a.id === 'a3');
  if (a3 && a3.overridden) fail('settings churn', 'override not cleared');
}
// 6. lowering workerCount never loses tickets: tiny scope must fully merge with 1 worker left
{
  const r = mk('shrink to 2', { workerCount: 10, totalScope: 8, ticketsPerMinute: 4, rejectRate: 0.4 });
  r.minutes(2.5);
  r.sim.setSettings({ workerCount: 2 });
  r.minutes(22);
  r.finish();
  const st = r.sim.state;
  // sprint 1 (T-1..T-8) must be fully merged; later sprints may already be underway (old merged tickets get pruned)
  const mergedIds = new Set(r.events.filter((e) => e.type === 'pr_merged').map((e) => (e as { ticket: { id: string } }).ticket.id));
  for (let i = 1; i <= 8; i++) if (!mergedIds.has('T-' + i)) fail('shrink to 2', `T-${i} never merged (lost?)`);
  if (!r.events.some((e) => e.type === 'ticket_created')) fail('shrink to 2', 'no tickets');
  const lost = st.tickets.filter((t) => t.status !== 'merged' && t.status !== 'cancelled' && t.status !== 'backlog' && !st.agents.some((a) => a.ticketId === t.id));
  if (lost.length) fail('shrink to 2', `orphaned tickets: ${lost.map((t) => t.id).join(',')}`);
  if (st.agents.filter((a) => a.role === 'worker').length !== 2) fail('shrink to 2', 'removed workers still listed');
  results.push(r.result());
}
// 7. budget warning with a tiny budget, and downshift
{
  const r = mk('tiny budget', { budgetUsd: 5 });
  r.minutes(10);
  r.finish();
  if (!r.events.some((e) => e.type === 'budget_warning')) fail('tiny budget', 'no budget_warning event');
  if (!r.sim.state.log.some((l) => l.kind === 'cost')) fail('tiny budget', 'no cost log line');
  if (r.sim.state.metrics.budgetUsedPct < 100) fail('tiny budget', 'budget not exceeded?');
  results.push(r.result());
}
// 7b. endless sprint demo: new sprints keep starting, agents stay busy, ticket array stays bounded
{
  const r = mk('90 min / sprints');
  const names = new Set<string>();
  let busyLast10 = 0, maxTickets = 0, lastPct = 0, maxPct = 0;
  const total = Math.round(90 * 60 / (DT * r.sim.settings.simSpeed));
  for (let i = 0; i < total; i++) {
    r.step();
    const st = r.sim.state;
    names.add(st.plan.name);
    maxTickets = Math.max(maxTickets, st.tickets.length);
    maxPct = Math.max(maxPct, st.metrics.budgetUsedPct); lastPct = st.metrics.budgetUsedPct;
    if (st.time > 80 * 60 && st.agents.some((a) => a.phase === 'working' || a.phase === 'reworking')) busyLast10++;
  }
  r.finish();
  const st = r.sim.state;
  const shipped = r.logs.filter((l) => l.text.includes('shipped:')).length;
  if (names.size < 3) fail('90 min', `only ${names.size} distinct sprint plans: ${[...names].join(' | ')}`);
  if (shipped < 1) fail('90 min', `no 'shipped' log lines seen`);
  if (busyLast10 < 50) fail('90 min', `agents barely worked in the last 10 minutes (${busyLast10} steps)`);
  if (maxTickets >= 150) fail('90 min', `state.tickets grew to ${maxTickets}`);
  if (st.metrics.scopeDone > 1 || st.metrics.merged < 30) fail('90 min', `merged ${st.metrics.merged}`);
  if (maxPct > 250) fail('90 min', `budgetUsedPct ran away to ${maxPct.toFixed(0)}% (should refill per sprint)`);
  console.log(`  90 min: ${names.size} sprints, max tickets ${maxTickets}, budget gauge now ${lastPct.toFixed(0)}% (max ${maxPct.toFixed(0)}%), lifetime merged ${st.metrics.merged}, $${st.metrics.totalCostUsd.toFixed(0)}`);
  results.push(r.result());
}
// 8. hackathon mode on several seeds: the plan ships (polish partly cut), submits inside the window, then the next hackathon starts
{
  let totalCuts = 0;
  for (const seed of [1, 2, 3]) {
    const name = `hackathon s${seed}`;
    const r = mkHack(name, { seed });
    const st = r.sim.state, h = st.hack;
    const planned = st.plan.totalTickets;
    const window = r.sim.settings.deadlineMinutes * 60;
    if (h.stage !== 'kickoff' || !h.active || h.milestones.length < 3 || h.checklist.length < 4) fail(name, `bad kickoff state: ${h.stage} ms=${h.milestones.length} ck=${h.checklist.length}`);
    if (planned < 10) fail(name, `plan has only ${planned} tickets`);
    const project0 = h.project, plan0 = st.plan.name;
    let submitT = -1;
    for (let i = 0; i < Math.round((window + 120) / HDT); i++) { r.step(HDT); if (h.stage === 'submitted') { submitT = st.time; break; } }
    const stages = r.ev('hack_stage').map((e) => e.stage);
    if (submitT < 0) { fail(name, `not submitted within the window + margin (stage ${h.stage}, merged ${st.metrics.merged})`); continue; }
    if (submitT > h.endsAt + 60) fail(name, `submitted ${(submitT - h.endsAt).toFixed(0)} s after the deadline`);
    if (stages.some((s, i) => i > 0 && HACK_STAGES.indexOf(s) < HACK_STAGES.indexOf(stages[i - 1]))) fail(name, `stage went backwards: ${stages.join('>')}`);
    if (stages[stages.length - 1] !== 'submitted' || !stages.includes('build')) fail(name, `stage events: ${stages.join('>')}`);
    const done = (id: string): boolean => h.milestones.find((m) => m.id === id)?.done === true;
    if (!done('mvp') || !done('features')) fail(name, `MVP/features not done at submit (${h.milestones.map((m) => m.id + ':' + m.done).join(' ')})`);
    if (!h.checklist.find((c) => c.id === 'submitted')?.done) fail(name, 'submitted checklist item not ticked');
    if (!h.deployUrl || h.deployStatus !== 'live') fail(name, `no live deploy (${h.deployStatus})`);
    if (h.demoReadiness < 0.6 || h.demoReadiness > 1) fail(name, `demoReadiness ${h.demoReadiness.toFixed(2)}`);
    const mergedNow = st.tickets.filter((t) => t.status === 'merged').length + 0;
    if (r.sim.state.metrics.merged < 0.6 * planned) fail(name, `only ${r.sim.state.metrics.merged}/${planned} merged`);
    if (st.metrics.totalCostUsd > 150) fail(name, `cost $${st.metrics.totalCostUsd.toFixed(0)} over the $150 budget`);
    if (st.metrics.budgetUsedPct > 100) fail(name, `budget gauge ${st.metrics.budgetUsedPct.toFixed(0)}%`);
    if (r.helpReqs.length < 15) fail(name, `only ${r.helpReqs.length} help requests`);
    if (st.metrics.rejected < 1) fail(name, 'no rejections');
    if (r.ev('milestone_done').length < 2) fail(name, 'fewer than 2 milestone_done events');
    if (st.tickets.some((t) => t.status !== 'merged' && t.status !== 'cancelled')) fail(name, 'open tickets after submission');
    if (!st.log.some((l) => l.text.startsWith('Submitted'))) fail(name, 'no submission log line');
    if (!st.chat.some((c) => c.kind === 'action' && c.text.startsWith('Submitted'))) fail(name, 'no submission chat action');
    totalCuts += h.scopeCuts;
    const cutsAtSubmit = h.scopeCuts, mergedAtSubmit = st.metrics.merged;
    const ratioN = st.tickets.filter((t) => t.status === 'merged'), ratio = ratioN.length ? ratioN.reduce((x, t) => x + t.usage.costUsd / t.estimatedCostUsd, 0) / ratioN.length : 0;
    if (ratio < 0.5 || ratio > 2) fail(name, `actual/estimate cost ratio ${ratio.toFixed(2)}`);
    void mergedNow;
    // submission party, then the next project kicks off
    r.seconds(1.5, HDT);
    const party = st.agents.filter((a) => a.phase === 'celebrating').length;
    if (party < 3) fail(name, `only ${party} agents celebrated the submission`);
    r.seconds(52, HDT);
    if (h.project === project0 || st.plan.name === plan0 || !(h.stage === 'kickoff' || h.stage === 'build')) fail(name, `no restart: project ${h.project}, stage ${h.stage}`);
    if (h.scopeCuts !== 0 || h.deployUrl !== null || h.milestones.some((m) => m.done && m.ticketIds.length > 0)) fail(name, 'restart did not reset hack state');
    if (!SAMPLE_BRIEFS.some((b) => b.project === h.project)) fail(name, `restarted with an unknown project ${h.project}`);
    r.seconds(60, HDT);
    if (st.tickets.filter((t) => t.status !== 'merged' && t.status !== 'cancelled').length === 0) fail(name, 'new hackathon filed no tickets');
    r.finish();
    results.push(r.result());
    console.log(`  ${name}: submitted at ${(submitT / 60).toFixed(1)} of ${(window / 60).toFixed(0)} min, ${mergedAtSubmit}/${planned} merged, ${cutsAtSubmit} cut, est ratio ${ratio.toFixed(2)}, $${st.metrics.totalCostUsd.toFixed(0)}, ${r.helpReqs.length} help planes`);
  }
  if (totalCuts < 2) fail('hackathon', `auto scope cuts never fired across seeds (${totalCuts})`);
}
// 9. endless hackathons for 90 min: restarts, bounded arrays, many chat messages
{
  const r = mkHack('90 min / hackathons', { seed: 5 });
  const projects = new Set<string>();
  let maxTickets = 0;
  const total = Math.round(90 * 60 / HDT);
  for (let i = 0; i < total; i++) {
    r.step(HDT);
    const st = r.sim.state;
    projects.add(st.hack.project);
    maxTickets = Math.max(maxTickets, st.tickets.length);
    if (i % 25 === 0) r.sim.say(i % 3 === 0 ? 'orch' : 'a2', 'status?');
  }
  r.finish();
  if (projects.size < 2) fail('90 min hack', `only ${projects.size} projects in 90 min`);
  if (maxTickets >= 120) fail('90 min hack', `state.tickets grew to ${maxTickets}`);
  if (r.sim.state.chat.length !== 200) fail('90 min hack', `chat transcript is ${r.sim.state.chat.length}, expected the 200 cap`);
  results.push(r.result());
  console.log(`  90 min hack: ${projects.size} projects (${[...projects].join(', ')}), max tickets ${maxTickets}`);
}
// 10. board commands: pinned assign plane, update, cancel, skills
{
  const r = mk('commands', { ticketsPerMinute: 3, totalScope: 40 });
  r.allowEmptySkills = true;
  const sim = r.sim, st = sim.state;
  r.minutes(3);
  // pinned ticket flies to its agent
  const pinned = sim.createTicket({ title: 'Pinned: wire up billing page', difficulty: 2, pinnedTo: 'a3', priority: 5, skills: ['payments'] });
  if (pinned.source !== 'human' || pinned.pinnedTo !== 'a3' || pinned.priority !== 5 || pinned.description === '' || pinned.helpRequests !== 0) fail('commands', 'createTicket fields');
  sim.updateTicket(pinned.id, { title: 'Pinned: billing page v2', priority: 8 });
  if (pinned.title !== 'Pinned: billing page v2' || pinned.priority !== 8) fail('commands', 'updateTicket did not apply');
  let claimed = false;
  for (let i = 0; i < 4 * 60 / DT / 2; i++) { r.step(); if (pinned.assignee !== null) { claimed = true; break; } }
  if (!claimed) fail('commands', 'pinned ticket never claimed');
  else if (pinned.assignee !== 'a3') fail('commands', `pinned to a3 but claimed by ${pinned.assignee}`);
  const af = r.ev('flight').find((e) => e.flight.kind === 'assign' && e.flight.ticketId === pinned.id);
  if (!af) fail('commands', 'no assign flight for the pinned ticket');
  else if (!('agent' in af.flight.from) || af.flight.from.agent !== 'orch' || !('agent' in af.flight.to) || af.flight.to.agent !== 'a3') fail('commands', 'assign flight endpoints');
  // cancel an agent's ticket: it is freed at once and the ticket never merges
  let victim = st.agents.find((a) => a.role === 'worker' && a.phase === 'working' && a.ticketId);
  for (let i = 0; i < 600 && !victim; i++) { r.step(); victim = st.agents.find((a) => a.role === 'worker' && a.phase === 'working' && a.ticketId); }
  if (!victim) fail('commands', 'nobody working to cancel');
  else {
    const tid = victim.ticketId!, vid = victim.id;
    sim.cancelTicket(tid);
    const t = st.tickets.find((x) => x.id === tid);
    if (!t || t.status !== 'cancelled') fail('commands', `cancelled ticket status ${t?.status}`);
    if (victim.ticketId === tid || victim.phase === 'working') fail('commands', `cancelTicket did not free ${vid} (phase ${victim.phase})`);
    r.minutes(2);
    const t2 = st.tickets.find((x) => x.id === tid);
    if (t2 && t2.status !== 'cancelled') fail('commands', `cancelled ticket came back as ${t2.status}`);
    if (!victim.ticketId || victim.ticketId === tid) { /* may be between tickets */ }
    if (st.agents.some((a) => a.ticketId === tid)) fail('commands', 'cancelled ticket still held');
  }
  // cancel a ticket waiting at the depot or in the integrator's queue
  let inRev = st.tickets.find((x) => x.status === 'in_review');
  for (let i = 0; i < 1800 && !inRev; i++) { r.step(); inRev = st.tickets.find((x) => x.status === 'in_review'); }
  if (inRev) {
    const id = inRev.id;
    sim.cancelTicket(id);
    r.seconds(40);
    const t = st.tickets.find((x) => x.id === id);
    if (t && t.status !== 'cancelled') fail('commands', `in-review ticket cancel -> ${t.status}`);
    if (st.agents.find((a) => a.id === 'integ')!.ticketId === id) fail('commands', 'integrator still holding the cancelled PR');
    if (r.ev('pr_merged').some((e) => e.ticket.id === id)) fail('commands', 'cancelled PR was merged');
  }
  const depotT = st.tickets.find((x) => x.status === 'backlog');
  if (depotT) {
    sim.cancelTicket(depotT.id);
    r.minutes(1.5);
    if (depotT.status !== 'cancelled' || depotT.assignee !== null) fail('commands', 'backlog cancel did not stick');
  }
  // skills
  const n0 = st.skills.length;
  const sk = sim.addSkill({ name: 'Rust Embedded', blurb: 'no_std firmware' });
  if (sk.id !== 'rust-embedded' || !sk.custom || st.skills.length !== n0 + 1 || !st.libraryStock.includes(sk.id) || !sk.color || !sk.glyph) fail('commands', `addSkill result ${JSON.stringify(sk)}`);
  const sk2 = sim.addSkill({ name: 'Rust Embedded' });
  if (sk2.id === sk.id) fail('commands', 'duplicate skill ids');
  const tk = sim.createTicket({ title: 'Flash the firmware', difficulty: 2, skills: [sk.id] });
  let loaded = false;
  for (let i = 0; i < 6 * 60 / DT / 2 && !loaded; i++) { r.step(); loaded = r.ev('skills_loaded').some((e) => e.skills.includes(sk.id)); }
  if (!loaded) fail('commands', `nobody fetched the new skill for ${tk.id} (status ${tk.status})`);
  sim.equipSkill('a1', 'docs'); sim.equipSkill('a1', 'perf'); sim.equipSkill('a1', 'refactor'); sim.equipSkill('a1', 'security'); sim.equipSkill('a1', 'auth');
  const a1 = st.agents.find((a) => a.id === 'a1')!;
  if (a1.skills.length > SKILL_SLOTS || !a1.skills.includes('auth')) fail('commands', `equipSkill LRU: ${a1.skills.join(',')}`);
  sim.unequipSkill('a1', 'auth');
  if (a1.skills.includes('auth')) fail('commands', 'unequipSkill did nothing');
  sim.removeSkill(sk.id); sim.removeSkill('docs');
  r.check();
  if (st.skills.some((k) => k.id === sk.id || k.id === 'docs')) fail('commands', 'removeSkill left the skill in the catalog');
  r.minutes(3);     // the dangling-skill checks in check() keep running
  r.finish();
  results.push(r.result());
}
// 11. chat: a reply per addressee within ~6 s, intents applied, planes thrown, costs tokens, transcript capped
{
  const r = mkHack('chat', { seed: 11 });
  const sim = r.sim, st = sim.state;
  r.seconds(20, HDT);
  const ask = (to: string, text: string): { reply: typeof st.chat[number] | undefined; t0: number } => {
    const t0 = st.time, n0 = st.chat.length;
    sim.say(to, text);
    if (st.chat.length !== n0 + 1 || st.chat[n0].from !== 'you' || st.chat[n0].to !== to) fail('chat', `say(${to}) did not log the human message first`);
    r.seconds(6, 0.1);
    const who = to === 'all' ? 'orch' : to;
    return { reply: st.chat.slice(n0 + 1).find((m) => m.from === who && m.to === 'you' && m.kind === 'say'), t0 };
  };
  for (const [to, text] of [['orch', 'status'], ['a2', 'how is it going?'], ['all', 'great job everyone'], ['a4', 'status']] as const) {
    const orchCost = st.agents[0].usage.costUsd;
    const { reply, t0 } = ask(to, text);
    if (!reply) { fail('chat', `no reply from ${to} within 6 s`); continue; }
    const d = reply.t - t0;
    if (d < 0.9 || d > 3.7) fail('chat', `reply from ${to} took ${d.toFixed(2)} s`);
    if (to === 'orch' && st.agents[0].usage.costUsd <= orchCost) fail('chat', 'chat did not cost the orchestrator tokens');
  }
  const nT = st.tickets.length;
  ask('orch', 'add a ticket for dark mode, easy, css');
  if (!st.tickets.some((t) => t.source === 'human' && t.title.toLowerCase().includes('dark mode')) || st.tickets.length <= nT) fail('chat', 'create_ticket intent did not file a human ticket');
  if (!st.chat.some((m) => m.kind === 'action' && m.text.startsWith('Created'))) fail('chat', 'no action message for the created ticket');
  const f0 = r.ev('flight').length;
  ask('orch', 'tell Pixel to focus on the API');
  const chatFlight = r.ev('flight').slice(f0).find((e) => e.flight.kind === 'chat');
  if (!chatFlight || !('agent' in chatFlight.flight.to) || chatFlight.flight.to.agent !== 'a1' || !('agent' in chatFlight.flight.from) || chatFlight.flight.from.agent !== 'orch') fail('chat', 'message_agent did not throw a chat plane at a1');
  const cuts0 = st.hack.scopeCuts, f1 = r.ev('flight').length;
  ask('orch', 'cut scope by 2');
  if (st.hack.scopeCuts < cuts0 + 1) fail('chat', `cut_scope cut nothing (${cuts0} -> ${st.hack.scopeCuts})`);
  if (r.ev('flight').slice(f1).filter((e) => e.flight.kind === 'broadcast').length < 1) fail('chat', 'cut_scope threw no broadcast planes');
  ask('orch', 'speed 4x');
  if (sim.settings.simSpeed !== 4) fail('chat', `set_speed -> ${sim.settings.simSpeed}`);
  sim.setSettings({ simSpeed: 1 });
  const dl0 = sim.settings.deadlineMinutes;
  ask('orch', 'extend deadline by 10 minutes');
  if (!(sim.settings.deadlineMinutes > dl0 + 5)) fail('chat', `deadline ${dl0} -> ${sim.settings.deadlineMinutes}`);
  // pause / resume through the chat while the sim is frozen
  sim.say('orch', 'pause');
  for (let i = 0; i < 60; i++) sim.step(0.1);
  if (sim.settings.simSpeed !== 0) fail('chat', `'pause' left simSpeed at ${sim.settings.simSpeed}`);
  const tp = st.time;
  sim.say('orch', 'resume');
  for (let i = 0; i < 60; i++) sim.step(0.1);
  if (!(sim.settings.simSpeed > 0)) fail('chat', `'resume' did not unpause while paused (simSpeed ${sim.settings.simSpeed})`);
  if (st.time < tp) fail('chat', 'time went backwards');
  sim.setSettings({ simSpeed: 1 });
  for (let i = 0; i < 120; i++) sim.say('orch', 'status');
  r.seconds(5, 0.1);
  if (st.chat.length > 200) fail('chat', `transcript grew to ${st.chat.length}`);
  r.finish();
  results.push(r.result());
}
// 12. setBrief replans; mode switches restart cleanly
{
  const r = mkHack('setBrief', { seed: 21 });
  const sim = r.sim, st = sim.state;
  r.minutes(3, HDT);
  const oldIds = st.tickets.map((t) => t.id);
  const t0 = st.time;
  sim.setBrief('Nova Notes', 'A shared notebook app with markdown, tags and a public share link. Deploy a live demo.');
  if (st.hack.project !== 'Nova Notes' || !st.plan.name.includes('Nova Notes')) fail('setBrief', `project/plan not replaced: ${st.hack.project} / ${st.plan.name}`);
  if (st.hack.stage !== 'kickoff' || st.hack.scopeCuts !== 0 || st.hack.milestones.some((m) => m.ticketIds.length > 0)) fail('setBrief', 'hack state not reset');
  for (const id of oldIds) { const t = st.tickets.find((x) => x.id === id); if (t && t.status !== 'merged' && t.status !== 'cancelled') fail('setBrief', `${id} survived the replan (${t.status})`); }
  if (st.agents.some((a) => a.role === 'worker' && a.ticketId && oldIds.includes(a.ticketId))) fail('setBrief', 'a worker still holds an old ticket');
  r.minutes(1.5, HDT);
  const fresh = st.tickets.filter((t) => t.createdAt >= t0 && t.status !== 'cancelled');
  if (fresh.length < 3) fail('setBrief', `only ${fresh.length} tickets filed after the replan`);
  sim.setSettings({ mode: 'sprint' });
  r.seconds(2, HDT);
  if (!st.plan.name.startsWith('Sprint') || st.hack.active) fail('setBrief', `switch to sprint: ${st.plan.name}`);
  sim.setSettings({ mode: 'hackathon' });
  r.seconds(2, HDT);
  if (!st.plan.name.startsWith('Hackathon') || !st.hack.active) fail('setBrief', `switch back to hackathon: ${st.plan.name}`);
  sim.setDeadline(25);
  r.seconds(1, HDT);
  const left = (st.hack.endsAt - st.time) / 60;
  if (Math.abs(left - 25) > 0.6) fail('setBrief', `setDeadline(25) leaves ${left.toFixed(1)} min`);
  r.minutes(3, HDT);
  r.finish();
  results.push(r.result());
}
// 13. step-size independence: same defaults at 16 ms / 100 ms / 500 ms steps must agree (sprint and hackathon)
for (const mode of ['sprint', 'hackathon'] as const) {
  const out: { dt: number; merged: number; cost: number; help: number }[] = [];
  for (const dt of [0.016, 0.1, 0.5]) {
    const s = new Simulation({ mode });
    let help = 0;
    s.on((e) => { if (e.type === 'help_requested') help++; });
    const n = Math.round((mode === 'sprint' ? 20 : 18) * 60 / dt);
    for (let i = 0; i < n; i++) s.step(dt);
    out.push({ dt, merged: s.state.metrics.merged, cost: s.state.metrics.totalCostUsd, help });
  }
  const spread = (v: number[]): number => (Math.max(...v) - Math.min(...v)) / Math.max(1e-9, v.reduce((x, y) => x + y, 0) / v.length);
  const sm = spread(out.map((o) => o.merged)), sc = spread(out.map((o) => o.cost));
  console.log(`  step-size check (${mode}): ` + out.map((o) => `dt=${o.dt}: ${o.merged} merged, $${o.cost.toFixed(1)}, ${o.help} help`).join(' | '));
  if (sm > 0.15) fail('step size ' + mode, `merged count differs by ${(sm * 100).toFixed(0)}% across step sizes`);
  if (sc > 0.15) fail('step size ' + mode, `total cost differs by ${(sc * 100).toFixed(0)}% across step sizes`);
}
// 14. pause freezes state
{
  const r = mk('pause');
  r.minutes(1);
  r.sim.setSettings({ simSpeed: 0 });
  const a = JSON.stringify(r.sim.state);
  for (let i = 0; i < 100; i++) r.sim.step(DT);
  if (JSON.stringify(r.sim.state) !== a) fail('pause', 'state changed while paused');
}
// 15. determinism + reset (default = hackathon)
{
  const run = (): string => { const s = new Simulation({ seed: 42 }); for (let i = 0; i < 6000; i++) s.step(DT * 3); return JSON.stringify(s.state); };
  if (run() !== run()) fail('determinism', 'same seed produced different state');
  const runChat = (): string => { const s = new Simulation({ seed: 43 }); for (let i = 0; i < 3000; i++) { if (i === 200) s.say('orch', 'add a ticket for logging'); if (i === 400) s.setBrief('X App', 'A tiny app'); s.step(DT * 3); } return JSON.stringify(s.state); };
  if (runChat() !== runChat()) fail('determinism', 'same seed + same commands produced different state');
  const s = new Simulation({ seed: 5 });
  for (let i = 0; i < 3000; i++) s.step(DT * 2);
  const first = JSON.stringify(s.state);
  s.reset();
  for (let i = 0; i < 3000; i++) s.step(DT * 2);
  if (JSON.stringify(s.state) !== first) fail('determinism', 'reset() did not reproduce the same run');
  const ref = s.state;
  s.reset({ seed: 6 });
  if (s.state !== ref) fail('determinism', 'reset() replaced the state object');
  if (s.state.flights.length || s.state.help.length || s.state.chat.length) fail('determinism', 'reset() left flights/help/chat behind');
}

// ---- summary
const pad = (v: string | number, n: number): string => String(v).padEnd(n);
console.log('\n' + pad('scenario', 22) + pad('merged', 8) + pad('thr/min', 9) + pad('cycle s', 9) + pad('util', 7) + pad('cost $', 9) + pad('$/merge', 9) + pad('maxInbox', 10) + pad('inbox%', 8) + pad('rejects', 9) + pad('compact', 9) + 'act/est');
for (const r of results) {
  console.log(pad(r.name, 22) + pad(r.merged, 8) + pad(r.thr.toFixed(2), 9) + pad(r.cycle.toFixed(0), 9) + pad(r.util.toFixed(2), 7) + pad(r.cost.toFixed(1), 9) + pad(r.perMerge.toFixed(2), 9) + pad(r.maxInbox, 10) + pad((r.inboxShare * 100).toFixed(0), 8) + pad(r.rejected, 9) + pad(r.compactions, 9) + r.ratio.toFixed(2));
}
if (failures.length) {
  console.log(`\nFAILED (${failures.length}${failures.length >= 40 ? '+' : ''}):`);
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log('\nOK - all invariants held');
