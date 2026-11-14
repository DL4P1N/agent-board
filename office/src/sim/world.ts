/** Shared simulation world: runtime per-agent data (Rt), ticket factory, config selection, cost accounting, flights. */
import { DESKS, STATIONS } from '../layout';
import { OWNER_COLORS, SKILLS, SKILL_SLOTS, type Skill } from '../skills';
import { PROVIDER_IDS, deskRank, perProvider, providerForRank, type FleetMix } from '../providers';
import { DEFAULT_SETTINGS } from '../types';
import type {
  AgentConfig, AgentOverride, AgentState, ChatMessage, Difficulty, Flight, FlightEndpoint, FlightKind, HelpRequest, LogEntry, Phase, PlannedTicket,
  Pose, Provider, SimEvent, SimSettings, SimState, Ticket, TicketSpec, Vec2,
} from '../types';
import { adaptConfig, clampDifficulty, configForDifficulty, downshift, modelInfo, MODEL_LIST } from './difficulty';
import { compactionTokens, costOf, emptyUsage, estimateForDifficulty, priceFor } from './pricing';
import { Rng, keyedRng } from './prng';
import { EPIC_POOL, EXTRA_SKILLS, INTEG_NAME, ORCH_NAME, OWNERS, SPRINT_THEMES, WORKER_NAMES } from './names';
import { updateIntegrator } from './integrator';
import { updateOrchestrator } from './orchestrator';
import { updateWorker } from './worker';
import { turnHeading, walkTo } from './movement';
import { updateMetrics } from './metrics';
import { helpTimeouts, deliverHelp, replyLanded } from './help';
import { chatTick } from './chat';
import { beginHackathon, hackTick } from './hack';

export const SPAWN: Vec2 = { x: 13, z: 10.5 };

export interface HpSave { phase: Phase; pose: Pose; sub: number; t: number; dur: number }

export interface Rt {
  a: AgentState;
  // movement
  path: Vec2[]; plen: number; pd: number; walking: boolean; next: string; endHeading: number; th: number; atDesk: boolean;
  // generic phase timers
  t: number; dur: number; sub: number; bubbleT: number; poseT: number; poseAlt: boolean; compactT: number; throwT: number;
  burnAcc: number;
  /** cosmetic stream (poses, bubbles) - per agent. */ rng: Rng;
  /** per work-pass / review stream, keyed by ticket (timing independent). */ wrng: Rng;
  // worker
  ticket: Ticket | null; lastDiff: number; idleT: number; leaving: boolean; rework: boolean; downshifted: boolean;
  baseDur: number; blockAt: number; waitAt: number; helpAt: number;
  inter: 0 | 1 | 2 | 3; interT: number; interDur: number; blockText: string; blockVault: boolean; blockSecret: boolean;
  waveT: number; subTarget: number; subStepT: number; reason: string; missing: string[];
  // flights / help
  pend: 0 | 1 | 2;            // 1 = rework plane landed, 2 = merged plane landed (processed when seated + awaiting_review)
  helpInbox: string[]; curHelp: string | null; hp: HpSave | null;
  askReq: string | null; askN: number; helpDone: boolean; askTarget: string; helpedAt: number;
  // orchestrator
  planLeft: number; planNext: number; carried: Ticket[]; assignQ: Ticket[]; noteT: number; riskT: number; cutT: number;
  // integrator
  curId: string | null; curReject: boolean;
}

export interface Landing {
  at: number; kind: FlightKind; agent: string; ticketId?: string; reqId?: string; text?: string;
}

export class World {
  rng!: Rng;
  rts = new Map<string, Rt>();
  rtList: Rt[] = [];
  tickets = new Map<string, Ticket>();
  skillMap = new Map<string, Skill>();
  overrides = new Map<string, AgentOverride>();
  depotIds = new Set<string>();
  planeDelivered = new Set<string>();
  finalStatus = new Map<string, 'merged' | 'cancelled'>();
  inboxQueue: string[] = [];
  held: Ticket[] = [];
  passCost = new Map<string, number>();
  listeners: ((e: SimEvent) => void)[] = [];
  titleUse = new Map<string, number>();
  pendingRemove: Rt[] = [];
  landings: Landing[] = [];
  helpById = new Map<string, HelpRequest>();
  chatPending: { at: number; msgId: string; to: string; text: string }[] = [];
  ticketSeq = 0; mergedCount = 0; rejectedCount = 0; cycleSum = 0; recentMerges: number[] = [];
  flightSeq = 0; helpSeq = 0; chatSeq = 0; helpTotal = 0;
  mergeSeq = 0; wasteUsd = 0; retiredUsd = 0; warned = false; overBudget = false; atRisk = false;
  orchBudget = 3; orchSince = 99; cfgSig = ''; spawnSeated = false; lastRiskBubbleT = -1e9; riskSince = 0;
  // sprint / project bookkeeping (metrics.merged / totalCostUsd stay lifetime; scope/ETA/budget are per sprint or hackathon)
  sprintNo = 1; sprintIdx = 0; sprintStartT = 0; sprintCreated = 0; sprintMerged = 0; sprintCostStart = 0; sprintMergedCost = 0; lifeMergedCost = 0;
  // hackathon runtime
  curMode: 'sprint' | 'hackathon' = 'hackathon';
  planQueue: PlannedTicket[] = [];
  hackPlanned = 0; hackIdx = 0; hackNextT = 0; hackLastCut = -1e9; hackSubmitAt = -1; hackRestartAt = -1; deployDoneAt = -1;
  msPlanned = new Map<string, number>(); msCreated = new Map<string, number>(); msAnnounced = new Set<string>();
  hackMerged = 0; hackMergedTitles: string[] = [];
  hackScale = 1; hackBurn = 1; hackDoneBase = 0; submitFx = 0; msFrac = new Map<string, number>(); hackFrozen = false; deployN = 0; projCancelled = 0;

  constructor(public settings: SimSettings, public state: SimState) { this.init(); }

  // ------------------------------------------------------------------ init / reset (in place)
  init(): void {
    const s = this.state;
    this.rng = new Rng(this.settings.seed);
    this.rts.clear(); this.rtList.length = 0; this.tickets.clear(); this.overrides.clear();
    this.depotIds.clear(); this.planeDelivered.clear(); this.finalStatus.clear(); this.inboxQueue.length = 0; this.held.length = 0;
    this.passCost.clear(); this.titleUse.clear(); this.pendingRemove.length = 0; this.recentMerges.length = 0;
    this.landings.length = 0; this.helpById.clear(); this.chatPending.length = 0; this.planQueue.length = 0;
    this.msPlanned.clear(); this.msCreated.clear(); this.msAnnounced.clear(); this.msFrac.clear(); this.hackMergedTitles.length = 0;
    this.submitFx = 0; this.hackFrozen = false; this.deployN = 0; this.projCancelled = 0; this.hackScale = 1; this.hackBurn = 1; this.hackDoneBase = 0;
    this.ticketSeq = 0; this.mergedCount = 0; this.rejectedCount = 0; this.cycleSum = 0; this.mergeSeq = 0;
    this.flightSeq = 0; this.helpSeq = 0; this.chatSeq = 0; this.helpTotal = 0; this.hackMerged = 0;
    this.hackIdx = 0; this.hackNextT = 0; this.hackLastCut = -1e9; this.hackSubmitAt = -1; this.hackRestartAt = -1; this.deployDoneAt = -1;
    this.wasteUsd = 0; this.retiredUsd = 0; this.warned = false; this.overBudget = false; this.atRisk = false;
    this.orchBudget = 3; this.orchSince = 99; this.cfgSig = ''; this.lastRiskBubbleT = -1e9;
    s.time = 0; s.agents.length = 0; s.tickets.length = 0; s.log.length = 0;
    s.flights.length = 0; s.help.length = 0; s.chat.length = 0;
    s.depotStacks = 0; s.inboxStacks = 0; s.outStacks = 0; s.mainCommits = 0; s.deployments = 0;
    s.skills.length = 0;
    for (const k of SKILLS) s.skills.push({ ...k });
    this.rebuildSkillMap();
    Object.assign(s.metrics, {
      merged: 0, open: 0, inReview: 0, rejected: 0, throughputPerMin: 0, avgCycleSec: 0, utilization: 0, scopeDone: 0, etaMinutes: null,
      helpTotal: 0, helpOpen: 0,
      totalCostUsd: 0, burnUsdPerMin: 0, avgCostPerMergedUsd: 0, wasteUsd: 0, projectedScopeCostUsd: 0, budgetUsedPct: 0,
      costByTier: {}, costByProvider: perProvider(() => 0), orchestrationCostUsd: 0,
    });
    Object.assign(s.hack, {
      active: false, project: '', brief: '', stage: 'idle', startedAt: 0, endsAt: 0, milestones: [], checklist: [], demoReadiness: 0,
      deployUrl: null, deployStatus: 'none', pitch: '', scopeCuts: 0,
    });
    this.sanitize();
    this.curMode = this.settings.mode;
    this.sprintNo = 1 + (this.settings.seed % 9); this.sprintIdx = 0; this.lifeMergedCost = 0;
    // fixed agents
    const orch = this.makeAgent('orch', ORCH_NAME, 'claude', 'orchestrator', OWNERS[0], -1, STATIONS.orchSeat.stand, STATIONS.orchSeat.heading, configForDifficulty('claude', 4), ['docs']);
    const integ = this.makeAgent('integ', INTEG_NAME, 'claude', 'integrator', OWNERS[1], -1, STATIONS.integSeat.stand, STATIONS.integSeat.heading, configForDifficulty('claude', 3), ['security', 'unit-tests']);
    orch.atDesk = true; integ.atDesk = true;
    this.rebuildList();
    if (this.settings.mode === 'hackathon') beginHackathon(this, true); else this.beginSprint(true);
    this.spawnSeated = true;
    this.reconcile();
    this.spawnSeated = false;
    this.cfgSig = this.sigOf();
    this.log(null, 'plan', `${s.plan.name} kicked off - ${s.plan.totalTickets} tasks, ${this.settings.deadlineMinutes} min`);
  }

  rebuildSkillMap(): void {
    this.skillMap.clear();
    for (const k of this.state.skills) this.skillMap.set(k.id, k);
    this.state.libraryStock = this.state.skills.map((k) => k.id);
  }
  skillName(id: string): string { return this.skillMap.get(id)?.name ?? id; }

  private makeAgent(id: string, name: string, provider: Provider, role: AgentState['role'], owner: string, deskIndex: number, pos: Vec2, heading: number, config: AgentConfig, skills: string[]): Rt {
    const a: AgentState = {
      id, name, provider, role, owner, deskIndex, pos: { x: pos.x, z: pos.z }, heading, pose: role === 'worker' ? 'walk' : 'wait',
      phase: 'idle', phaseProgress: 0, carrying: null, skills: skills.slice(), waitingOn: null, helping: null,
      ownerColor: OWNER_COLORS[Math.max(0, OWNERS.indexOf(owner)) % OWNER_COLORS.length],
      ticketId: null, config, overridden: false, activeSubagents: 0, contextFill: 0.1, compactions: 0, bubble: null,
      stats: { done: 0, merged: 0, reworks: 0, walkedMeters: 0 }, usage: emptyUsage(), burnUsdPerMin: 0, subagentCostUsd: 0,
    };
    const rt: Rt = {
      a, path: [], plen: 0, pd: 0, walking: false, next: '', endHeading: heading, th: heading, atDesk: false,
      t: 0, dur: 0, sub: 0, bubbleT: 0, poseT: 0, poseAlt: false, compactT: 0, throwT: 0, burnAcc: 0,
      rng: keyedRng(this.settings.seed, 'agent:' + id), wrng: keyedRng(this.settings.seed, 'idle:' + id),
      ticket: null, lastDiff: 3, idleT: 0, leaving: false, rework: false, downshifted: false,
      baseDur: 60, blockAt: -1, waitAt: -1, helpAt: -1, inter: 0, interT: 0, interDur: 0, blockText: '', blockVault: false, blockSecret: false,
      waveT: 0, subTarget: 0, subStepT: 0, reason: '', missing: [],
      pend: 0, helpInbox: [], curHelp: null, hp: null, askReq: null, askN: 0, helpDone: false, askTarget: '', helpedAt: -1e9,
      planLeft: 0, planNext: 0, carried: [], assignQ: [], noteT: 12, riskT: 0, cutT: 0, curId: null, curReject: false,
    };
    this.state.agents.push(a);
    this.rts.set(id, rt);
    return rt;
  }

  rebuildList(): void {
    this.state.agents.sort((x, y) => {
      const rx = x.role === 'orchestrator' ? -2 : x.role === 'integrator' ? -1 : x.deskIndex;
      const ry = y.role === 'orchestrator' ? -2 : y.role === 'integrator' ? -1 : y.deskIndex;
      return rx - ry;
    });
    this.rtList.length = 0;
    for (const a of this.state.agents) this.rtList.push(this.rts.get(a.id)!);
  }

  // ------------------------------------------------------------------ helpers
  emit(e: SimEvent): void {
    if (this.listeners.length === 0) return;
    for (const l of this.listeners.slice()) l(e);
  }
  log(agentId: string | null, kind: LogEntry['kind'], text: string): void {
    const lg = this.state.log;
    lg.push({ t: this.state.time, agentId, kind, text });
    if (lg.length > 200) lg.splice(0, lg.length - 200);
  }
  say(rt: Rt, text: string, dur = 3.5): void {
    rt.a.bubble = text.length > 28 ? text.slice(0, 27) + '.' : text;
    rt.bubbleT = dur + rt.rng.next();
  }
  agentName(id: string): string { return this.rts.get(id)?.a.name ?? id; }
  postChat(from: string, to: string, text: string, kind: ChatMessage['kind']): ChatMessage {
    const m: ChatMessage = { id: `M-${++this.chatSeq}`, t: this.state.time, from, to, text, kind };
    const c = this.state.chat;
    c.push(m);
    if (c.length > 200) c.splice(0, c.length - 200);
    this.emit({ type: 'chat', message: m });
    return m;
  }

  sanitize(): void {
    const s = this.settings;
    const cl = (k: keyof SimSettings, lo: number, hi: number) => {
      const v = s[k] as unknown as number;
      const n = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
      if (n !== v) (s as unknown as Record<string, number>)[k] = n;
    };
    cl('workerCount', 1, 12); s.workerCount = Math.round(s.workerCount);
    cl('simSpeed', 0, 8); cl('ticketsPerMinute', 0, 6); cl('meanDifficulty', 1, 5); cl('difficultySpread', 0, 2);
    cl('workSpeed', 0.25, 4); cl('rejectRate', 0, 0.7); cl('blockRate', 0, 0.5); cl('walkSpeed', 0.5, 3); cl('helpRate', 0, 1);
    cl('totalScope', 4, 60); s.totalScope = Math.round(s.totalScope); cl('deadlineMinutes', 5, 120); cl('budgetUsd', 0, 1e9);
    if (s.mode !== 'sprint' && s.mode !== 'hackathon') s.mode = 'hackathon';
    const mix = { ...DEFAULT_SETTINGS.fleetMix } as FleetMix;
    for (const id of PROVIDER_IDS) { const v = Number(s.fleetMix?.[id]); mix[id] = Number.isFinite(v) ? Math.min(10, Math.max(0, v)) : 0; }
    s.fleetMix = mix;
  }

  sigOf(): string {
    const m = this.settings.manualConfig;
    return `${this.settings.configMode}|${m.model}|${m.tier}|${m.autocompactBuffer}|${m.subagents}|${m.effort}`;
  }

  providerFor(deskIndex: number): Provider {
    const ov = this.overrides.get('a' + (deskIndex + 1));
    if (ov && ov.provider) return ov.provider;
    // stable low-discrepancy rank per desk: moving a slider flips only the nearest agents
    return providerForRank(deskRank(deskIndex), this.settings.fleetMix);
  }

  /** Effective config for a ticket of `diff` for this agent (auto/manual + budget downshift + per-agent override). */
  configFor(rt: Rt, diff: number, applyDownshift: boolean): AgentConfig {
    const a = rt.a;
    let cfg = this.settings.configMode === 'manual' ? adaptConfig(a.provider, this.settings.manualConfig) : configForDifficulty(a.provider, diff);
    rt.downshifted = false;
    if (applyDownshift && this.overBudget) { cfg = downshift(cfg, a.provider); rt.downshifted = true; }
    const ov = this.overrides.get(a.id);
    if (ov) {
      if (ov.model !== undefined) { cfg.model = ov.model; const mi = modelInfo(ov.model); if (mi && ov.tier === undefined) cfg.tier = mi.tier; }
      if (ov.tier !== undefined) {
        cfg.tier = ov.tier;
        if (ov.model === undefined) { const mi = MODEL_LIST.find((m) => m.provider === a.provider && m.tier === ov.tier); if (mi) cfg.model = mi.model; }
      }
      if (ov.autocompactBuffer !== undefined) cfg.autocompactBuffer = ov.autocompactBuffer;
      if (ov.subagents !== undefined) cfg.subagents = ov.subagents;
      if (ov.effort !== undefined) cfg.effort = ov.effort;
    }
    return cfg;
  }
  hasConfigOverride(id: string): boolean {
    const ov = this.overrides.get(id);
    return !!ov && (ov.model !== undefined || ov.tier !== undefined || ov.autocompactBuffer !== undefined || ov.subagents !== undefined || ov.effort !== undefined);
  }
  applyConfig(rt: Rt, applyDownshift: boolean): void {
    const diff = rt.ticket ? rt.ticket.difficulty : rt.lastDiff;
    rt.a.config = this.configFor(rt, diff, applyDownshift && !rt.ticket);
    rt.a.overridden = this.hasConfigOverride(rt.a.id);
    if (rt.a.activeSubagents > rt.a.config.subagents) rt.a.activeSubagents = rt.a.config.subagents;
  }

  // ------------------------------------------------------------------ cost accounting
  charge(rt: Rt, inp: number, out: number, cache: number, ticket: Ticket | null, sub: boolean, review: boolean): number {
    const a = rt.a;
    const cost = costOf(priceFor(a.config.model), inp, out, cache);
    if (!(cost > 0)) return 0;
    const u = a.usage;
    u.inputTokens += inp; u.outputTokens += out; u.cacheReadTokens += cache; u.costUsd += cost;
    if (sub) a.subagentCostUsd += cost;
    rt.burnAcc += cost;
    const m = this.state.metrics;
    m.totalCostUsd += cost;
    m.costByTier[a.config.tier] = (m.costByTier[a.config.tier] ?? 0) + cost;
    m.costByProvider[a.provider] += cost;
    if (a.role !== 'worker') m.orchestrationCostUsd += cost;
    if (ticket) {
      const tu = ticket.usage;
      tu.inputTokens += inp; tu.outputTokens += out; tu.cacheReadTokens += cache; tu.costUsd += cost;
      if (review) ticket.reviewCostUsd += cost;
      this.passCost.set(ticket.id, (this.passCost.get(ticket.id) ?? 0) + cost);
    }
    return cost;
  }

  /** Raise context fill; fires a compaction when the autocompact buffer is eaten. */
  bumpFill(rt: Rt, amount: number): void {
    const a = rt.a;
    a.contextFill += amount;
    const thr = Math.max(0.45, 1 - a.config.autocompactBuffer / 100);
    if (a.contextFill >= thr) this.compact(rt);
  }
  compact(rt: Rt): void {
    const a = rt.a;
    const ct = compactionTokens(Math.min(1, a.contextFill));
    this.charge(rt, ct.input, ct.output, ct.cacheRead, rt.ticket && a.role === 'worker' ? rt.ticket : null, false, false);
    a.contextFill = 0.35;
    a.compactions++;
    rt.compactT = 2.5;
    this.say(rt, 'compacting context...');
    this.log(a.id, 'compact', `${a.name} compacted context (#${a.compactions}${rt.ticket ? ' on ' + rt.ticket.id : ''})`);
    this.emit({ type: 'compaction', agentId: a.id });
  }

  // ------------------------------------------------------------------ flights (paper airplanes)
  /**
   * Launch a plane. t0 = now + delay (the sender's throw pose runs just before). The landing effect is applied by
   * processLandings() at t0 + dur. `key` makes the flight duration deterministic and timing independent.
   */
  sendPlane(kind: FlightKind, from: FlightEndpoint, to: FlightEndpoint, key: string, land: { agent: string; ticketId?: string; reqId?: string; text?: string } | null,
    label?: string, ticketId?: string, delay = 0.5): Flight {
    const dur = 2.5 + 0.7 * keyedRng(this.settings.seed, 'fl:' + kind + ':' + key).next();
    const f: Flight = { id: `F-${++this.flightSeq}`, kind, from, to, t0: this.state.time + delay, dur };
    if (label !== undefined) f.label = label;
    if (ticketId !== undefined) f.ticketId = ticketId;
    this.state.flights.push(f);
    if (land) this.landings.push({ at: f.t0 + dur, kind, agent: land.agent, ticketId: land.ticketId, reqId: land.reqId, text: land.text });
    this.emit({ type: 'flight', flight: f });
    return f;
  }

  processLandings(): void {
    const now = this.state.time;
    if (this.landings.length) {
      // landings are few; process due ones in time order
      this.landings.sort((x, y) => x.at - y.at);
      while (this.landings.length && this.landings[0].at <= now) this.land(this.landings.shift()!);
    }
    const fl = this.state.flights;
    if (fl.length) {
      let j = 0;
      for (let i = 0; i < fl.length; i++) if (now <= fl[i].t0 + fl[i].dur + 1.5) fl[j++] = fl[i];
      fl.length = j;
    }
  }

  private land(l: Landing): void {
    const t = l.ticketId ? this.tickets.get(l.ticketId) : undefined;
    switch (l.kind) {
      case 'pr': {
        if (!t || t.status !== 'in_review') return;
        this.state.inboxStacks++;
        this.inboxQueue.push(t.id);
        this.log(t.assignee, 'review', `PR for ${t.id} landed in the inbox`);
        this.emit({ type: 'pr_opened', ticket: t, agentId: t.assignee ?? '' });
        return;
      }
      case 'merged': {
        const rt = this.rts.get(l.agent);
        if (rt && rt.a.phase !== 'offline') rt.pend = 2;
        return;
      }
      case 'changes': {
        if (!t || t.status !== 'changes_requested') return;
        const rt = this.rts.get(l.agent);
        if (rt && rt.ticket === t && rt.a.phase !== 'offline' && !rt.leaving) { rt.pend = 1; return; }
        // author vanished while the plane was in the air: ticket goes back to the shelf
        this.returnToDepot(t);
        if (rt && rt.ticket === t) { rt.ticket = null; rt.a.ticketId = null; }
        return;
      }
      case 'help': {
        const req = l.reqId ? this.helpById.get(l.reqId) : undefined;
        if (req) deliverHelp(this, req);
        return;
      }
      case 'help_reply': {
        const req = l.reqId ? this.helpById.get(l.reqId) : undefined;
        if (req) replyLanded(this, req);
        return;
      }
      case 'assign': {
        if (!t || t.status !== 'backlog') return;
        this.planeDelivered.add(t.id); this.depotIds.add(t.id);
        return;
      }
      case 'chat': case 'broadcast': {
        const rt = this.rts.get(l.agent);
        if (rt && l.text) this.say(rt, l.text, 3);
        return;
      }
    }
  }

  // ------------------------------------------------------------------ skills
  skillsFor(text: string, n: number, r: Rng): string[] {
    const lower = text.toLowerCase();
    const scored: { id: string; s: number }[] = [];
    for (const k of this.state.skills) {
      let s = 0;
      const words = (k.id.replace(/-/g, ' ') + ' ' + k.name + ' ' + k.category).toLowerCase().split(/[^a-z0-9$]+/).filter((x) => x.length >= 3);
      for (const wd of words) if (lower.includes(wd)) s++;
      if (s > 0) scored.push({ id: k.id, s });
    }
    scored.sort((a, b) => b.s - a.s);
    const out = scored.slice(0, n).map((x) => x.id);
    let guard = 0;
    while (out.length < n && guard++ < 30) {
      const pool = EXTRA_SKILLS.filter((x) => this.skillMap.has(x));
      const cand = pool.length ? r.pick(pool) : this.state.skills.length ? r.pick(this.state.skills).id : null;
      if (cand && !out.includes(cand)) out.push(cand);
      if (!cand) break;
    }
    return out;
  }

  // ------------------------------------------------------------------ tickets
  sampleDifficulty(r: Rng): Difficulty {
    const s = this.settings;
    return clampDifficulty(s.meanDifficulty + r.gauss() * s.difficultySpread);
  }

  /** Create a ticket (goes to `held`: the orchestrator carries it to the depot or flies it to its pin). */
  newTicket(spec: TicketSpec, source: 'orchestrator' | 'human'): Ticket {
    const seq = ++this.ticketSeq;
    const r = keyedRng(this.settings.seed, 'ticketx:' + seq);
    const plan = this.state.plan;
    const d = spec.difficulty !== undefined ? clampDifficulty(spec.difficulty) : this.sampleDifficulty(r);
    const n = Math.min(3, Math.max(1, Math.round(0.6 + 0.5 * d + (r.next() - 0.5) * 1.2)));
    const title = spec.title;
    const description = spec.description ?? `Acceptance: ${title}. Ship it with tests and a short note in the PR.`;
    const skills = (spec.skills ? spec.skills.filter((x) => this.skillMap.has(x)) : this.skillsFor(title + ' ' + description, n, r)).slice(0, 4);
    const epic = spec.epic ?? (plan.epics.length ? r.pick(plan.epics) : 'General');
    // hackathon pace stretches work time (and so cost); fixed costs (review, skill loads, compaction) do not stretch with it
    const pace = this.curMode === 'hackathon' ? 1 + 0.42 * (this.hackScale * this.hackBurn - 1) : 1;
    const est = estimateForDifficulty(d, this.settings.fleetMix, this.settings.rejectRate) * (0.9 + 0.2 * r.next()) * pace;
    const pin = spec.pinnedTo && this.rts.get(spec.pinnedTo)?.a.role === 'worker' ? spec.pinnedTo : null;
    const t: Ticket = {
      id: `T-${seq}`, title, difficulty: d, status: 'backlog', assignee: null, progress: 0, createdAt: this.state.time,
      mergedAt: null, reworks: 0, epic, description, source, pinnedTo: pin, priority: spec.priority ?? 0,
      milestone: spec.milestone ?? null, helpRequests: 0, skills, estimatedCostUsd: est, usage: emptyUsage(), reviewCostUsd: 0,
    };
    this.state.tickets.push(t);
    this.tickets.set(t.id, t);
    this.sprintCreated++;
    this.held.push(t);
    if (t.milestone) {
      const ms = this.state.hack.milestones.find((m) => m.id === t.milestone);
      if (ms) ms.ticketIds.push(t.id);
      this.msCreated.set(t.milestone, (this.msCreated.get(t.milestone) ?? 0) + 1);
    }
    this.log('orch', 'ticket', `${source === 'human' ? 'Human added' : 'Created'} ${t.id} "${t.title}" (d${d}, est $${est.toFixed(2)})`);
    this.emit({ type: 'ticket_created', ticket: t });
    return t;
  }

  /** Sprint-mode random ticket from the epic pool. */
  createSprintTicket(): Ticket {
    const plan = this.state.plan;
    const seq = this.ticketSeq + 1;
    const r = keyedRng(this.settings.seed, 'task:' + seq);
    const epic = r.pick(plan.epics);
    const def = r.pick(EPIC_POOL.find((e) => e.name === epic)!.items);
    const d = this.sampleDifficulty(r);
    const n = Math.min(3, Math.max(1, Math.round(0.6 + 0.5 * d + (r.next() - 0.5) * 1.2)));
    const skills: string[] = r.shuffle(def.s.filter((x) => this.skillMap.has(x))).slice(0, n);
    let guard = 0;
    const pool = EXTRA_SKILLS.filter((x) => this.skillMap.has(x));
    while (skills.length < n && pool.length && guard++ < 20) { const x = r.pick(pool); if (!skills.includes(x)) skills.push(x); }
    const used = this.titleUse.get(def.t) ?? 0;
    this.titleUse.set(def.t, used + 1);
    const title = used === 0 ? def.t : `${def.t} (part ${used + 1})`;
    return this.newTicket({ title, difficulty: d, skills, epic }, 'orchestrator');
  }

  /** Oldest-ish claim among tickets at the depot: pinned-to-me, then priority, then hardest of the 4 oldest. */
  claim(rt: Rt): Ticket | null {
    if (this.depotIds.size === 0) return null;
    let best: Ticket | null = null, bestScore = -Infinity, idx = 0;
    for (const t of this.state.tickets) {
      if (t.status !== 'backlog' || t.assignee !== null || !this.depotIds.has(t.id)) continue;
      if (t.pinnedTo !== null && t.pinnedTo !== rt.a.id) continue;
      const score = (t.pinnedTo === rt.a.id ? 1e6 : 0) + t.priority * 1000 + (idx < 4 ? t.difficulty * 10 : 0) - idx * 0.001;
      if (score > bestScore) { bestScore = score; best = t; }
      idx++;
    }
    if (!best) return null;
    best.status = 'assigned'; best.assignee = rt.a.id;
    rt.ticket = best; rt.a.ticketId = best.id;
    return best;
  }

  /** Put a ticket back on the shelf (no holder). */
  returnToDepot(t: Ticket): void {
    if (!this.depotIds.has(t.id)) {
      this.depotIds.add(t.id);
      if (!this.planeDelivered.has(t.id)) this.state.depotStacks++;
    }
    this.wasteUsd += this.passCost.get(t.id) ?? 0;
    this.passCost.set(t.id, 0);
    t.status = 'backlog'; t.assignee = null; t.progress = 0;
  }

  /** Put the worker's ticket back on the depot shelf (offline / removed). In-review PRs stay where they are. */
  releaseTicket(rt: Rt): void {
    const t = rt.ticket;
    if (!t || t.status === 'in_review') return;
    if (t.status === 'merged' || t.status === 'cancelled') { rt.ticket = null; rt.a.ticketId = null; return; }
    this.returnToDepot(t);
    this.log(rt.a.id, 'ticket', `${rt.a.name} handed ${t.id} back to the depot`);
    rt.ticket = null; rt.a.ticketId = null; rt.a.carrying = null; rt.inter = 0; rt.askReq = null; rt.a.waitingOn = null;
  }

  /** Remove a ticket from the board (human cancel / scope cut). Frees whoever holds it. */
  cancelTicket(id: string): boolean {
    const t = this.tickets.get(id);
    if (!t || t.status === 'merged' || t.status === 'cancelled') return false;
    // physical papers
    const hi = this.held.indexOf(t);
    if (hi >= 0) this.held.splice(hi, 1);
    const orch = this.rts.get('orch');
    if (orch) {
      const ci = orch.carried.indexOf(t);
      if (ci >= 0) { orch.carried.splice(ci, 1); orch.a.carrying = orch.carried.length ? { kind: 'tickets', count: orch.carried.length } : null; }
      const ai = orch.assignQ.indexOf(t);
      if (ai >= 0) orch.assignQ.splice(ai, 1);
    }
    if (this.depotIds.has(id)) {
      this.depotIds.delete(id);
      if (!this.planeDelivered.has(id)) this.state.depotStacks = Math.max(0, this.state.depotStacks - 1);
    }
    this.planeDelivered.delete(id);
    const qi = this.inboxQueue.indexOf(id);
    if (qi >= 0) { this.inboxQueue.splice(qi, 1); this.state.inboxStacks = Math.max(0, this.state.inboxStacks - 1); }
    const ig = this.rts.get('integ');
    if (ig && ig.curId === id) {
      ig.curId = null; ig.a.ticketId = null; ig.a.carrying = null; ig.a.activeSubagents = 0; ig.walking = false; ig.sub = 0;
      ig.a.phase = 'idle'; ig.a.pose = 'wait';
      const st = STATIONS.integSeat.stand;
      if (Math.hypot(ig.a.pos.x - st.x, ig.a.pos.z - st.z) > 0.05) { ig.sub = 4; ig.atDesk = false; walkTo(ig, { station: 'integSeat' }, 'home_i'); }
    }
    // the holder
    const holder = t.assignee ? this.rts.get(t.assignee) : undefined;
    if (holder && holder.ticket === t) {
      const a = holder.a;
      this.abortHelpState(holder);
      a.ticketId = null; holder.ticket = null; a.carrying = null; holder.inter = 0; a.activeSubagents = 0; holder.pend = 0; holder.missing = [];
      if (a.phase !== 'offline') {
        holder.walking = false; a.phase = 'idle'; a.pose = holder.atDesk ? 'wait' : 'idle'; holder.idleT = 0;
      }
      this.say(holder, `${t.id} cancelled`, 3);
    }
    this.wasteUsd += this.passCost.get(id) ?? 0;
    this.passCost.set(id, 0);
    this.projCancelled++;
    t.status = 'cancelled';
    this.finalStatus.set(id, 'cancelled');
    this.log(null, 'ticket', `Cancelled ${t.id} "${t.title}"`);
    return true;
  }

  /** Drop any help bookkeeping an agent holds (asker waiting / helper mid-reply). Open requests simply time out. */
  abortHelpState(rt: Rt): void {
    const a = rt.a;
    if (rt.askReq) { const r = this.helpById.get(rt.askReq); if (r && r.status === 'open' && r.byHuman === false) { /* leave to time out */ } }
    rt.askReq = null; a.waitingOn = null; rt.helpDone = false;
    if (rt.hp) { rt.hp = null; }
    rt.curHelp = null; a.helping = null;
  }

  // ------------------------------------------------------------------ sprints
  /** Start a new plan: fresh name/epics, deadline window from now, fresh scope + budget counters. */
  beginSprint(first: boolean): void {
    const st = this.state;
    if (!first) { this.sprintNo++; this.sprintIdx++; }
    const prevEpic = st.plan.epics[0];
    const epics = this.rng.shuffle(EPIC_POOL.map((e) => e.name));
    if (!first && epics[0] === prevEpic) { const t = epics[0]; epics[0] = epics[1]; epics[1] = t; }
    epics.length = 4;
    this.resetProjectCounters();
    Object.assign(st.hack, { active: false, stage: 'idle', milestones: [], checklist: [], demoReadiness: 0, deployStatus: 'none', deployUrl: null, scopeCuts: 0 });
    this.planQueue.length = 0;
    Object.assign(st.plan, {
      name: `Sprint ${this.sprintNo}: ${epics[0]} ${SPRINT_THEMES[this.sprintIdx % SPRINT_THEMES.length]}`,
      totalTickets: this.settings.totalScope, deadlineMinutes: st.time / 60 + this.settings.deadlineMinutes, epics,
      note: first ? `Planning ${epics[0]} epic` : `Kicking off ${epics[0]}`,
    });
    if (!first) { this.pruneTerminal(12); this.emit({ type: 'plan_updated', plan: st.plan }); }
  }

  resetProjectCounters(): void {
    const st = this.state;
    this.sprintStartT = st.time; this.sprintCreated = 0; this.sprintMerged = 0; this.sprintMergedCost = 0;
    this.sprintCostStart = st.metrics.totalCostUsd;
    this.warned = false; this.overBudget = false; this.atRisk = false; this.riskSince = 0;
    this.orchBudget = 3; this.orchSince = 99;
    this.projCancelled = 0; this.submitFx = 0; this.hackFrozen = false;
  }

  /** Keep only the newest `keep` finished (merged/cancelled) tickets in state.tickets (counters are kept separately). */
  pruneTerminal(keep: number): void {
    const done = this.state.tickets.filter((t) => t.status === 'merged' || t.status === 'cancelled');
    if (done.length <= keep) return;
    done.sort((x, y) => (x.mergedAt ?? x.createdAt) - (y.mergedAt ?? y.createdAt));
    const old = new Set<string>();
    for (let i = 0; i < done.length - keep; i++) old.add(done[i].id);
    const arr = this.state.tickets;
    let j = 0;
    for (let i = 0; i < arr.length; i++) if (!old.has(arr[i].id)) arr[j++] = arr[i];
    arr.length = j;
    for (const id of old) { this.tickets.delete(id); this.passCost.delete(id); }
  }

  get sprintCostUsd(): number { return this.state.metrics.totalCostUsd - this.sprintCostStart; }

  /** Cancel every open ticket and start a fresh project (mode change / new brief). */
  restartProject(): void {
    for (const t of [...this.state.tickets]) if (t.status !== 'merged' && t.status !== 'cancelled') this.cancelTicket(t.id);
    this.held.length = 0;
    for (const o of this.rtList) { o.pend = 0; o.helpInbox.length = 0; }
    for (const r of this.state.help) if (r.status === 'open') r.status = 'timeout';
    this.curMode = this.settings.mode;
    if (this.settings.mode === 'hackathon') beginHackathon(this, false);
    else { this.beginSprint(false); }
    const orch = this.rts.get('orch');
    if (orch) this.say(orch, 'New project - planning...', 4);
    this.log('orch', 'plan', `${this.state.plan.name} kicked off - ${this.state.plan.totalTickets} tasks, ${this.settings.deadlineMinutes} min`);
    this.emit({ type: 'plan_updated', plan: this.state.plan });
  }

  // ------------------------------------------------------------------ settings reconciliation
  reconcile(): void {
    this.sanitize();
    const s = this.settings, st = this.state;
    if (s.mode !== this.curMode || (s.mode === 'hackathon' && (s.brief !== st.hack.brief || s.projectName !== st.hack.project))) {
      this.restartProject();
    }
    if (s.mode === 'hackathon') {
      s.totalScope = Math.min(60, Math.max(4, this.hackPlanned));
      if (st.hack.stage !== 'submitted') st.hack.endsAt = st.hack.startedAt + s.deadlineMinutes * 60;
      st.plan.deadlineMinutes = st.hack.endsAt / 60;
    } else {
      st.plan.deadlineMinutes = this.sprintStartT / 60 + s.deadlineMinutes;
    }
    st.plan.totalTickets = s.mode === 'hackathon' ? this.hackPlanned : s.totalScope;
    if (s.mode === 'hackathon') for (const ms of st.hack.milestones) { const f = this.msFrac.get(ms.id); if (f !== undefined) ms.dueMin = f * s.deadlineMinutes; }
    const sig = this.sigOf();
    const sigChanged = sig !== this.cfgSig; this.cfgSig = sig;
    const present: (Rt | undefined)[] = [];
    for (const rt of this.rtList) {
      const a = rt.a;
      if (a.role !== 'worker') continue;
      present[a.deskIndex] = rt;
      rt.leaving = a.deskIndex >= s.workerCount;
      const p = this.providerFor(a.deskIndex);
      let refresh = sigChanged && rt.ticket === null;
      if (p !== a.provider) { a.provider = p; refresh = true; }
      if (refresh) this.applyConfig(rt, false);
    }
    let added = false;
    for (let i = 0; i < s.workerCount; i++) if (!present[i]) { this.spawnWorker(i); added = true; }
    if (added) this.rebuildList();
  }

  private spawnWorker(i: number): void {
    const provider = this.providerFor(i);
    const owner = OWNERS[i % OWNERS.length];
    const starter = keyedRng(this.settings.seed, 'spawn:' + i).pick(this.state.skills.length ? this.state.skills : SKILLS).id;
    const cfg = this.settings.configMode === 'manual' ? adaptConfig(provider, this.settings.manualConfig) : configForDifficulty(provider, 3);
    const rt = this.makeAgent('a' + (i + 1), WORKER_NAMES[i % WORKER_NAMES.length], provider, 'worker', owner, i, SPAWN, Math.PI, cfg, [starter]);
    rt.a.phase = 'to_desk';
    rt.a.contextFill = 0.05;
    rt.a.skills.length = Math.min(rt.a.skills.length, SKILL_SLOTS);
    if (this.spawnSeated) {
      const d = DESKS[i];
      rt.a.pos.x = d.seat.x; rt.a.pos.z = d.seat.z; rt.a.heading = d.heading; rt.th = d.heading; rt.atDesk = true;
      rt.a.phase = 'idle'; rt.a.pose = 'wait';
    } else {
      walkTo(rt, { desk: i }, 'desk_idle');
    }
  }

  removePending(): void {
    for (const rt of this.pendingRemove) {
      const a = rt.a;
      if (!this.rts.has(a.id)) continue;
      this.retiredUsd += a.usage.costUsd;
      this.rts.delete(a.id);
      this.overrides.delete(a.id);
      const idx = this.state.agents.indexOf(a);
      if (idx >= 0) this.state.agents.splice(idx, 1);
      // tickets pinned to the departed agent become ordinary again
      for (const t of this.state.tickets) {
        if (t.pinnedTo === a.id) {
          t.pinnedTo = null;
          if (this.planeDelivered.has(t.id)) { this.planeDelivered.delete(t.id); this.state.depotStacks++; }
        }
      }
    }
    this.pendingRemove.length = 0;
    this.rebuildList();
  }

  // ------------------------------------------------------------------ tick
  tick(h: number): void {
    this.state.time += h;
    const list = this.rtList;
    for (let i = 0; i < list.length; i++) {
      const rt = list[i];
      if (rt.compactT > 0) rt.compactT -= h;
      const role = rt.a.role;
      if (role === 'worker') updateWorker(this, rt, h);
      else if (role === 'orchestrator') updateOrchestrator(this, rt, h);
      else updateIntegrator(this, rt, h);
      const a = rt.a;
      if (rt.throwT > 0) { rt.throwT -= h; if (!rt.walking && a.phase !== 'offline') a.pose = 'throw'; }
      turnHeading(a, rt.th, h);
      const inst = rt.burnAcc / h * 60;
      rt.burnAcc = 0;
      a.burnUsdPerMin += (inst - a.burnUsdPerMin) * Math.min(1, h / 1.5);
      if (a.burnUsdPerMin < 0.002 && inst === 0) a.burnUsdPerMin = 0;
    }
    if (this.pendingRemove.length) this.removePending();
    this.processLandings();
    chatTick(this);
    helpTimeouts(this);
    hackTick(this);
  }

  endStep(): void { updateMetrics(this); }

  /** While the sim is paused only chat keeps ticking (on real time), so "resume" typed into the chat still gets through. */
  stepPaused(dtReal: number): void {
    if (this.chatPending.length === 0) return;
    for (const p of this.chatPending) p.at -= dtReal;
    chatTick(this);
  }
}
