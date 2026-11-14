/** Tiny fake SimState generator for testing the scene without the sim (demo.html?fake=1). */
import { DESKS, STATIONS, findPath, pathLength, sampleAlong, type Place } from '../layout';
import { SKILLS, OWNER_COLORS, type Skill } from '../skills';
import type { AgentState, Flight, FlightKind, HackState, Phase, Pose, SimState, Ticket } from '../types';

interface Seg { place: Place; pose: Pose; phase: Phase; dur: number; heading?: number; carry?: AgentState['carrying']; bubble?: string }

const NAMES = ['Pixel', 'Marlow', 'Juno', 'Kestrel', 'Bolt', 'Nova', 'Quill', 'Rune', 'Sable', 'Tango', 'Vega', 'Wren'];
const OWNERS = ['maya', 'dev', 'sam', 'lee'];

function stationPos(p: Place): { x: number; z: number } {
  const path = findPath(p, p);
  return path[0];
}

interface Rt { a: AgentState; segs: Seg[]; i: number; t: number; path: { x: number; z: number }[]; len: number; from: Place }

const CUSTOM_NAMES: [string, string, string][] = [
  ['GraphQL', 'GQ', '#e879f9'], ['Terraform', 'TF', '#a78bfa'], ['i18n', 'IN', '#2dd4bf'], ['Stripe Hooks', 'SH', '#fbbf24'],
  ['Accessibility', 'A1', '#4ade80'], ['Rust FFI', 'RS', '#fb7185'], ['Kubernetes', 'K8', '#60a5fa'], ['SEO', 'SE', '#f59e0b'],
  ['Redis', 'RD', '#ef4444'], ['Docker', 'DK', '#38bdf8'], ['OAuth', 'OA', '#c084fc'], ['Telemetry', 'TM', '#22d3ee'],
  ['Mobile', 'MO', '#f472b6'], ['Charts', 'CH', '#a3e635'], ['Email', 'EM', '#fdba74'], ['Search', 'SR', '#93c5fd'], ['Queue', 'QU', '#d8b4fe'],
];

export interface FakeOpts { skills?: number; flights?: boolean; hack?: 'off' | 'build' | 'polish' | 'demo' | 'submitted' | 'plan' }

export class FakeSim {
  state: SimState;
  private opts: Required<FakeOpts>;
  private nextFlight = 1.2;
  private flightSeq = 0;
  private kindSeq = 0;
  private hackBase = 0;
  private rts: Rt[] = [];
  private clock = 0;
  private lastCommit = 0;
  private lastDeploy = 0;
  constructor(workers = 8, public speed = 1, opts: FakeOpts = {}) {
    this.opts = { skills: opts.skills ?? 18, flights: opts.flights ?? true, hack: opts.hack ?? 'build' };
    const catalog: Skill[] = [...SKILLS];
    for (let i = 0; catalog.length < this.opts.skills && i < CUSTOM_NAMES.length; i++) {
      const [name, glyph, color] = CUSTOM_NAMES[i];
      catalog.push({ id: 'custom-' + i, name, blurb: 'Custom skill', category: 'quality', color, glyph, custom: true, loadTokens: 1500 });
    }
    catalog.length = Math.min(catalog.length, Math.max(0, this.opts.skills));
    const agents: AgentState[] = [];
    const mk = (id: string, name: string, role: AgentState['role'], provider: AgentState['provider'], desk: number, i: number): AgentState => ({
      id, name, provider, role, owner: OWNERS[i % OWNERS.length], deskIndex: desk, pos: { x: 0, z: 0 }, heading: 0, pose: 'idle', phase: 'idle', phaseProgress: 0,
      carrying: null, waitingOn: null, helping: null, skills: catalog.slice(i % 8, (i % 8) + 1 + (i % 4)).map((s) => s.id), ownerColor: OWNER_COLORS[i % OWNER_COLORS.length], ticketId: null,
      config: { model: provider === 'claude' ? ['claude-haiku-4-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5'][i % 4] : ['gpt-5.5-mini', 'gpt-5.5-codex', 'gpt-5.5-max'][i % 3], tier: provider === 'claude' ? ['haiku', 'sonnet', 'opus', 'fable'][i % 4] : ['mini', 'standard', 'max'][i % 3], autocompactBuffer: 20, subagents: i % 4, effort: 'medium' },
      overridden: false, activeSubagents: i % 3, contextFill: 0.3 + (i % 5) * 0.12, compactions: 0, bubble: null,
      stats: { done: 0, merged: 0, reworks: 0, walkedMeters: 0 }, usage: { inputTokens: 1000 * i, outputTokens: 200 * i, cacheReadTokens: 5000, costUsd: 0.3 + i * 0.37 }, burnUsdPerMin: 0.1 * (i % 5), subagentCostUsd: 0,
    });
    agents.push(mk('orch', 'Atlas', 'orchestrator', 'claude', 0, 0), mk('integ', 'Gatekeeper', 'integrator', 'codex', 0, 1));
    for (let i = 0; i < workers; i++) agents.push(mk('a' + (i + 1), NAMES[i % NAMES.length], 'worker', i % 3 === 2 ? 'codex' : 'claude', i, i + 2));
    const tickets: Ticket[] = [];
    const sts: Ticket['status'][] = ['backlog', 'backlog', 'assigned', 'in_progress', 'in_progress', 'in_review', 'changes_requested', 'merged', 'merged', 'merged'];
    for (let i = 0; i < 26; i++) tickets.push({ id: 'T-' + (i + 1), title: 'Ticket ' + i, difficulty: ((i % 5) + 1) as Ticket['difficulty'], status: sts[i % sts.length], assignee: null, progress: (i % 7) / 7, createdAt: i * 10, mergedAt: null, reworks: 0, epic: 'x', description: '', source: 'orchestrator', pinnedTo: null, priority: 0, milestone: null, helpRequests: 0, skills: catalog.slice(i % 9, (i % 9) + 1 + (i % 3)).map((s) => s.id), estimatedCostUsd: 1, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsd: 0.2 + (i % 9) * 0.55 }, reviewCostUsd: 0 });
    this.state = {
      time: 0, agents, tickets, log: [],
      metrics: { merged: 3, open: 10, inReview: 2, rejected: 1, throughputPerMin: 1, avgCycleSec: 90, utilization: 0.7, scopeDone: 0.2, etaMinutes: 20, helpTotal: 4, helpOpen: 1, totalCostUsd: 42.3, burnUsdPerMin: 1.2, avgCostPerMergedUsd: 3, wasteUsd: 2, projectedScopeCostUsd: 120, budgetUsedPct: 28, costByTier: {}, costByProvider: { claude: 30, codex: 12, copilot: 0, gemini: 0, cursor: 0, other: 0 }, orchestrationCostUsd: 5 },
      plan: { name: 'Sprint 1: Billing revamp', totalTickets: 26, deadlineMinutes: 40, epics: ['a'], note: 'Depot stocked, two PRs in review, watch the Stripe key in the vault.' },
      depotStacks: 9, inboxStacks: 3, libraryStock: catalog.map((s) => s.id), outStacks: 2, mainCommits: 0, deployments: 0,
      skills: catalog, flights: [], help: [], chat: [], hack: this.makeHack(),
    };
    for (const a of agents) this.rts.push(this.build(a));
  }

  private makeHack(): HackState {
    const mode = this.opts.hack;
    const submitted = mode === 'submitted';
    return {
      active: mode !== 'off' && mode !== 'plan', project: 'PIXEL PLANNER', brief: 'A pixel-art planner app', stage: submitted ? 'submitted' : mode === 'polish' ? 'polish' : mode === 'demo' ? 'demo' : 'build',
      startedAt: 0, endsAt: mode === 'demo' ? 280 : mode === 'polish' ? 700 : 3300, milestones: [], checklist: [],
      demoReadiness: submitted ? 1 : mode === 'demo' ? 0.82 : mode === 'polish' ? 0.55 : 0.18, deployUrl: null, deployStatus: mode === 'build' ? 'building' : 'live', pitch: 'Plan like a pixel.', scopeCuts: mode === 'build' ? 0 : 2,
    };
  }

  private spawnFlights(): void {
    const st = this.state, ws = st.agents.filter((a) => a.role === 'worker');
    if (!ws.length) return;
    const pick = (): string => ws[Math.floor(Math.random() * ws.length)].id;
    const kinds: FlightKind[] = ['pr', 'merged', 'changes', 'help', 'help_reply', 'assign', 'chat', 'broadcast'];
    const kind = kinds[this.kindSeq++ % kinds.length];
    const mk = (from: Flight['from'], to: Flight['to'], extra: Partial<Flight> = {}): void => {
      st.flights.push({ id: 'F' + (++this.flightSeq) + '-' + Math.floor(st.time), kind, from, to, t0: st.time + 0.3, dur: 2 + Math.random() * 2, ...extra });
    };
    const a = pick();
    let b = pick(); if (b === a && ws.length > 1) b = ws.find((w) => w.id !== a)!.id;
    switch (kind) {
      case 'pr': mk({ agent: a }, { station: 'inbox' }, { ticketId: 'T-' + (7 + (this.flightSeq % 20)) }); break;
      case 'merged': case 'changes': mk({ agent: 'integ' }, { agent: a }, { ticketId: 'T-' + (7 + (this.flightSeq % 20)) }); break;
      case 'help': mk({ agent: a }, Math.random() < 0.3 ? { agent: 'orch' } : { agent: b }); break;
      case 'help_reply': mk({ agent: b }, { agent: a }); break;
      case 'assign': case 'chat': mk({ agent: 'orch' }, { agent: a }); break;
      case 'broadcast': for (const w of ws.slice(0, 4)) mk({ agent: 'orch' }, { agent: w.id }, { label: 'plan' }); break;
    }
    // occasional station-to-station planes (scene must resolve station endpoints too)
    if (this.flightSeq % 5 === 0) st.flights.push({ id: 'FS' + this.flightSeq, kind: 'merged', from: { station: 'inbox' }, to: { station: 'mainRack' }, t0: st.time + 0.3, dur: 3, label: 'ship' });
  }

  private build(a: AgentState): Rt {
    const d = a.role === 'worker' ? a.deskIndex : 0;
    const desk: Place = { desk: d };
    let segs: Seg[];
    const off = a.id.length * 3.7 + a.deskIndex * 2.3;
    if (a.role === 'orchestrator') {
      segs = [
        { place: { station: 'orchSeat' }, pose: 'type', phase: 'planning', dur: 5 },
        { place: { station: 'board' }, pose: 'plan', phase: 'planning', dur: 6, bubble: 'Re-slicing the backlog' },
        { place: { station: 'depot' }, pose: 'pickup', phase: 'delivering', dur: 3, carry: { kind: 'tickets', count: 3 } },
        { place: { station: 'orchSeat' }, pose: 'think', phase: 'planning', dur: 5 },
      ];
    } else if (a.role === 'integrator') {
      segs = [
        { place: { station: 'integSeat' }, pose: 'review', phase: 'reviewing', dur: 7, bubble: 'Needs more tests' },
        { place: { station: 'integSeat' }, pose: 'type', phase: 'merging', dur: 4 },
        { place: { station: 'outTray' }, pose: 'pickup', phase: 'returning', dur: 3, carry: { kind: 'rejected', count: 1 } },
        { place: { station: 'inbox' }, pose: 'idle', phase: 'idle', dur: 2 },
      ];
    } else {
      segs = [
        { place: desk, pose: 'type', phase: 'working', dur: 6 + (off % 4) },
        { place: desk, pose: 'think', phase: 'working', dur: 3 },
        { place: desk, pose: 'wait', phase: 'waiting', dur: 3 },
        { place: desk, pose: 'raise_hand', phase: 'asking_help', dur: 3, bubble: 'Anyone know this API?' },
        { place: desk, pose: 'throw', phase: 'asking_help', dur: 1.2 },
        { place: desk, pose: 'wait', phase: 'awaiting_help', dur: 4, bubble: 'Waiting for a reply' },
        { place: { station: 'depot' }, pose: 'pickup', phase: 'picking_up', dur: 3 },
        { place: { station: 'library' }, pose: 'pickup', phase: 'picking_skills', dur: 3, bubble: 'Loading skills' },
        { place: desk, pose: 'blocked', phase: 'blocked', dur: 3 + (off % 3), bubble: 'Need STRIPE_TEST_KEY!' },
        { place: { station: 'inbox' }, pose: 'pickup', phase: 'to_review', dur: 2, carry: { kind: 'pr', count: 1 } },
        { place: desk, pose: 'type', phase: 'reworking', dur: 5 },
        { place: desk, pose: 'celebrate', phase: 'celebrating', dur: 2.5 },
      ];
    }
    const rt: Rt = { a, segs, i: Math.floor(off) % segs.length, t: 0, path: [], len: 0, from: segs[(Math.floor(off) + segs.length - 1) % segs.length].place };
    const p0 = stationPos(rt.from);
    a.pos = { ...p0 };
    this.startSeg(rt);
    return rt;
  }

  private startSeg(rt: Rt): void {
    const seg = rt.segs[rt.i];
    rt.path = findPath(rt.from, seg.place);
    rt.len = pathLength(rt.path);
    rt.t = 0;
  }

  step(dt: number): void {
    dt *= this.speed;
    this.clock += dt;
    this.state.time += dt;
    const walkSpeed = 2.2;
    for (const rt of this.rts) {
      const seg = rt.segs[rt.i];
      const a = rt.a;
      const walkTime = rt.len / walkSpeed;
      rt.t += dt;
      if (rt.t < walkTime) {
        const s = sampleAlong(rt.path, rt.t * walkSpeed);
        a.pos = s.pos; a.heading = s.heading;
        a.pose = seg.carry || a.carrying ? 'carry_walk' : 'walk';
        a.phase = (seg.phase === 'working' || seg.phase === 'blocked' || seg.phase === 'celebrating' || seg.phase === 'waiting' || seg.phase === 'reworking') ? 'to_desk' : seg.phase === 'picking_up' ? 'to_depot' : seg.phase === 'picking_skills' ? 'to_library' : seg.phase;
        a.bubble = null;
      } else {
        const last = rt.path[rt.path.length - 1];
        a.pos = { ...last };
        const stn = Object.values(STATIONS).find((s) => s.stand.x === last.x && s.stand.z === last.z);
        if (stn) a.heading = stn.heading;
        else if (a.role === 'worker') a.heading = DESKS[a.deskIndex].heading;
        a.pose = seg.pose; a.phase = seg.phase;
        a.carrying = seg.carry ?? null;
        a.bubble = seg.bubble ?? null;
        a.ticketId = a.role === 'worker' ? 'T-' + (a.deskIndex + 4) : null;
        a.phaseProgress = Math.min(1, (rt.t - walkTime) / seg.dur);
        if (rt.t - walkTime > seg.dur) {
          rt.from = seg.place; rt.i = (rt.i + 1) % rt.segs.length; this.startSeg(rt);
        }
      }
      a.contextFill = (a.contextFill + dt * 0.01) % 1;
      a.usage.costUsd += a.burnUsdPerMin * dt / 60;
    }
    this.state.metrics.totalCostUsd += 0.02 * dt;
    if (this.clock - this.lastCommit > 9) { this.lastCommit = this.clock; this.state.mainCommits++; this.state.depotStacks = (this.state.depotStacks + 5) % 15; this.state.inboxStacks = (this.state.inboxStacks + 1) % 7; this.state.outStacks = (this.state.outStacks + 2) % 7; }
    if (this.clock - this.lastDeploy > 28) { this.lastDeploy = this.clock; this.state.deployments++; }
    // stock flicker
    const cat = this.state.skills;
    const idx = Math.floor(this.clock / 4) % (cat.length + 3);
    this.state.libraryStock = cat.filter((_, i) => i !== idx).map((s) => s.id);
    // flights + hack clock
    const st = this.state;
    if (this.opts.flights) {
      st.flights = st.flights.filter((f) => st.time < f.t0 + f.dur + 1.5);
      if (st.time >= this.nextFlight) { this.spawnFlights(); this.nextFlight = st.time + 1.4 + Math.random() * 1.2; }
    }
    if (st.hack.active && st.hack.stage !== 'submitted') st.hack.demoReadiness = Math.min(0.97, st.hack.demoReadiness + dt * 0.0006);
  }
}
