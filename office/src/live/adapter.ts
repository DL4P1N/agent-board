/**
 * Real board -> 3D office. Turns GET /api/state into the SimState the scene draws, with no simulator:
 * one character per online agent at a stable desk, its pose from what it holds on the board, tickets from tasks.
 * Nothing is invented: costs, tokens, models, skills, deploys and readiness stay zero (the scene hides them in live mode).
 */
import { DESKS, STATIONS, findPath, type Place } from '../layout';
import { SKILLS } from '../skills';
import { PROVIDER_IDS, type ProviderId } from '../providers';
import type { AgentState, Flight, FlightKind, Metrics, Phase, Pose, SimState, Ticket, TicketStatus } from '../types';
import { agentRoot, hueOf, limitedNow, personOf, plain, skipName, timeNow, type BoardPresence, type BoardState, type BoardTask } from './board';

/** Which tool runs an agent, from the MCP client name the board recorded ("Claude Code", "codex-mcp-client",
 *  "GitHub Copilot", "Visual Studio Code", "Gemini CLI", "Cursor"), else from the name ("ana-codex"). */
export function providerFromClient(client: string | null | undefined, name = ''): ProviderId {
  const c = String(client || '').toLowerCase();
  if (c.includes('claude')) return 'claude';
  if (c.includes('codex')) return 'codex';
  if (c.includes('copilot') || c.includes('visual studio code') || c.includes('vscode')) return 'copilot';
  if (c.includes('gemini')) return 'gemini';
  if (c.includes('cursor')) return 'cursor';
  if (c) return 'other';
  const m = /-(claude|codex|copilot|gemini|cursor)[\w-]*$/.exec(agentRoot(name));
  return m && (PROVIDER_IDS as readonly string[]).includes(m[1]) ? (m[1] as ProviderId) : 'other';
}

const TICKET_STATUS: Record<string, TicketStatus> = {
  open: 'backlog', claimed: 'assigned', in_progress: 'in_progress', blocked: 'changes_requested', review: 'in_review', done: 'merged',
};
const DIFFICULTY = { S: 2, M: 3, L: 5 } as const;

export interface Look { phase: Phase; pose: Pose; bubble: string | null; ticketId: string | null }


/** What an agent is doing, from the board: out of usage > waiting on a human > stuck > working > reviewing >
 *  picked up > its work in review > idle. The phase names are the scene's ("working", "awaiting_review", "blocked"). */
export function lookFor(p: BoardPresence, b: BoardState, now = Date.now()): Look {
  const name = agentRoot(p.name);
  const mine = (b.tasks || []).filter((t) => t.assignee && agentRoot(t.assignee) === name);
  const has = (s: BoardTask['status']) => mine.filter((t) => t.status === s).sort((x, y) => x.priority - y.priority || x.id - y.id)[0];
  const id = (t: BoardTask) => '#' + t.id;
  if (limitedNow(p, now)) return { phase: 'idle', pose: 'sleep', bubble: 'Out of usage', ticketId: null };
  const q = (b.questions || []).find((x) => !x.answer && agentRoot(x.asker) === name);
  if (q) return { phase: 'asking_help', pose: 'raise_hand', bubble: 'Question', ticketId: q.task_id ? '#' + q.task_id : null };
  const blocked = has('blocked');
  if (blocked) return { phase: 'blocked', pose: 'blocked', bubble: `Blocked on #${blocked.id}`, ticketId: id(blocked) };
  const doing = has('in_progress');
  if (doing) return { phase: 'working', pose: 'type', bubble: null, ticketId: id(doing) };
  const reviewing = (b.tasks || []).find((t) => t.status === 'review' && t.reviewer && agentRoot(t.reviewer) === name);
  if (reviewing) return { phase: 'reviewing', pose: 'review', bubble: null, ticketId: id(reviewing) };
  const claimed = has('claimed');
  if (claimed) return { phase: 'working', pose: 'think', bubble: null, ticketId: id(claimed) };
  const inReview = has('review');
  if (inReview) return { phase: 'awaiting_review', pose: 'wait', bubble: null, ticketId: id(inReview) };
  return { phase: 'idle', pose: 'wait', bubble: null, ticketId: null };
}

/** HSL (degrees, 0..1, 0..1) -> '#rrggbb'. */
export function hslHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Desks in the order newcomers take them: a checkerboard first, so name tags of neighbours don't collide. */
const DESK_ORDER = [...DESKS].sort((a, b) => ((a.row + a.col) % 2) - ((b.row + b.col) % 2) || a.index - b.index).map((d) => d.index);
const SEAT: Record<'orchestrator' | 'integrator', Place> = { orchestrator: { station: 'orchSeat' }, integrator: { station: 'integSeat' } };
function standAt(place: Place): { x: number; z: number; heading: number } {
  const p = findPath(place, place)[0];
  if ('station' in place) return { ...p, heading: STATIONS[place.station].heading };
  if ('desk' in place) return { ...p, heading: DESKS[place.desk].heading };
  return { ...p, heading: 0 };
}

function zeroMetrics(): Metrics {
  return {
    merged: 0, open: 0, inReview: 0, rejected: 0, throughputPerMin: 0, avgCycleSec: 0, utilization: 0, scopeDone: 0, etaMinutes: null, helpTotal: 0, helpOpen: 0,
    totalCostUsd: 0, burnUsdPerMin: 0, avgCostPerMergedUsd: 0, wasteUsd: 0, projectedScopeCostUsd: 0, budgetUsedPct: 0, costByTier: {},
    costByProvider: { claude: 0, codex: 0, copilot: 0, gemini: 0, cursor: 0, other: 0 }, orchestrationCostUsd: 0,
  };
}

export function emptyState(): SimState {
  return {
    time: 0, agents: [], tickets: [], log: [], metrics: zeroMetrics(),
    plan: { name: '', totalTickets: 0, deadlineMinutes: 0, epics: [], note: '' },
    depotStacks: 0, inboxStacks: 0, libraryStock: SKILLS.map((s) => s.id), outStacks: 0, mainCommits: 0, deployments: 0,
    skills: [...SKILLS], flights: [], help: [], chat: [],
    hack: { active: false, project: '', brief: '', stage: 'idle', startedAt: 0, endsAt: 0, milestones: [], checklist: [], demoReadiness: 0, deployUrl: null, deployStatus: 'none', pitch: '', scopeCuts: 0 },
  };
}

export interface LiveOptions {
  /** Paper planes and celebrations when tasks move (off for prefers-reduced-motion). */
  motion: boolean;
  /** Day palette: owner colours a little darker, like the board's light theme. */
  light?: boolean;
}

/** Keeps one SimState in step with the board. apply() on every reload, tick() every frame. */
export class LiveWorld {
  readonly state: SimState = emptyState();
  /** Agents online but without a free desk (more than 12 workers). */
  overflow = 0;
  private board: BoardState | null = null;
  private desks = new Map<string, number>();
  private prev: Map<number, BoardTask> | null = null;
  private cheer = new Map<string, number>(); // agent -> sim time the celebration ends
  private flightSeq = 0;
  private wallAt = 0; // Date.now() at the last tick, to place the deadline on the sim clock

  constructor(private opts: LiveOptions) {}

  setOptions(o: Partial<LiveOptions>): void { this.opts = { ...this.opts, ...o }; if (this.board) this.apply(this.board); }

  apply(b: BoardState, now = Date.now()): void {
    this.board = b;
    const st = this.state;
    const tasks = (b.tasks || []).filter((t) => t.status !== 'proposed').sort((x, y) => x.id - y.id);
    const presence = b.presence || [];
    const online = presence.filter((p) => p.kind === 'agent' && p.online && !skipName(p.name))
      .sort((x, y) => personOf(x.name, presence).localeCompare(personOf(y.name, presence)) || x.name.localeCompare(y.name));
    const integ = agentRoot(b.settings?.integrator);
    const planner = agentRoot(b.settings?.planner);
    const roleOf = (n: string): AgentState['role'] => (n === integ ? 'integrator' : n === planner ? 'orchestrator' : 'worker');

    // Stable desks: an agent keeps its desk while it is online; newcomers take the lowest free one.
    const names = new Set(online.map((p) => agentRoot(p.name)));
    for (const n of [...this.desks.keys()]) if (!names.has(n) || roleOf(n) !== 'worker') this.desks.delete(n);
    const used = new Set(this.desks.values());
    this.overflow = 0;
    for (const p of online) {
      const n = agentRoot(p.name);
      if (roleOf(n) !== 'worker' || this.desks.has(n)) continue;
      const free = DESK_ORDER.find((d) => !used.has(d)) ?? -1;
      if (free < 0) { this.overflow++; continue; }
      this.desks.set(n, free); used.add(free);
    }

    const prevAgents = new Map(st.agents.map((a) => [a.id, a]));
    const agents: AgentState[] = [];
    for (const p of online) {
      const id = agentRoot(p.name);
      const role = roleOf(id);
      const desk = role === 'worker' ? this.desks.get(id) : 0;
      if (desk === undefined) continue;
      const look = lookFor(p, b, now);
      const where = standAt(role === 'worker' ? { desk } : SEAT[role]);
      const person = personOf(id, presence);
      const ownerColor = hslHex(hueOf(id, presence), this.opts.light ? 0.6 : 0.7, this.opts.light ? 0.42 : 0.66);
      const a: AgentState = prevAgents.get(id) ?? {
        id, name: id, provider: 'other', role, owner: person, deskIndex: desk, pos: { x: where.x, z: where.z }, heading: where.heading,
        pose: 'wait', phase: 'idle', phaseProgress: 0, carrying: null, skills: [], waitingOn: null, helping: null, ownerColor, ticketId: null,
        config: { model: '', tier: '', autocompactBuffer: 0, subagents: 0, effort: 'medium' }, overridden: false, activeSubagents: 0, contextFill: 0, compactions: 0,
        bubble: null, stats: { done: 0, merged: 0, reworks: 0, walkedMeters: 0 }, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsd: 0 }, burnUsdPerMin: 0, subagentCostUsd: 0,
      };
      a.provider = providerFromClient(p.client, p.name);
      a.role = role; a.owner = person; a.ownerColor = ownerColor; a.deskIndex = desk;
      a.pos = { x: where.x, z: where.z }; a.heading = where.heading;
      a.phase = look.phase; a.pose = look.pose; a.bubble = look.bubble; a.ticketId = look.ticketId;
      a.status = b.agentStatus?.[id] ?? null;
      a.phaseProgress = look.phase === 'working' ? 0.5 : 0;
      a.stats.done = tasks.filter((t) => t.status === 'done' && t.assignee && agentRoot(t.assignee) === id).length;
      a.stats.merged = a.stats.done;
      agents.push(a);
    }
    const order = { orchestrator: 0, integrator: 1, worker: 2 };
    agents.sort((x, y) => order[x.role] - order[y.role] || x.deskIndex - y.deskIndex);
    st.agents = agents;

    const t0 = Math.min(now, ...tasks.map((t) => t.created_at || now));
    st.tickets = tasks.map((t): Ticket => ({
      id: '#' + t.id, title: t.title, difficulty: DIFFICULTY[t.size] ?? 3, status: TICKET_STATUS[t.status] ?? 'backlog',
      assignee: t.assignee ? agentRoot(t.assignee) : null, progress: t.status === 'in_progress' ? 0.5 : t.status === 'done' ? 1 : 0,
      createdAt: Math.max(0, ((t.created_at || now) - t0) / 1000), mergedAt: t.status === 'done' ? Math.max(0, ((t.updated_at || now) - t0) / 1000) : null,
      reworks: 0, epic: '', description: '', source: 'human', pinnedTo: t.reserved_for ? agentRoot(t.reserved_for) : null, priority: 4 - (t.priority || 2),
      milestone: null, helpRequests: 0, skills: [], estimatedCostUsd: 0, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsd: 0 }, reviewCostUsd: 0,
    }));
    const n = (s: BoardTask['status']) => tasks.filter((t) => t.status === s).length;
    const done = n('done');
    const m = st.metrics;
    m.merged = done; m.open = n('open') + n('claimed') + n('in_progress') + n('blocked'); m.inReview = n('review');
    m.scopeDone = tasks.length ? done / tasks.length : 0;
    m.utilization = agents.length ? agents.filter((a) => a.phase === 'working' || a.phase === 'reviewing').length / agents.length : 0;
    m.helpOpen = (b.questions || []).filter((q) => !q.answer).length;
    st.plan = { name: plain(b.settings?.goal) || 'No goal yet', totalTickets: tasks.length, deadlineMinutes: 0, epics: [], note: '' };
    st.depotStacks = Math.min(14, n('open'));
    st.inboxStacks = Math.min(6, n('review'));
    st.outStacks = Math.min(6, n('blocked'));
    st.mainCommits = done;
    this.updateClock(now);

    // Tasks that moved since the last reload: a paper plane, and a short cheer when one is done.
    if (this.prev && this.opts.motion) {
      const here = new Set(agents.map((a) => a.id));
      for (const t of tasks) {
        const was = this.prev.get(t.id);
        if (!was || was.status === t.status) continue;
        const who = t.assignee ? agentRoot(t.assignee) : '';
        if (!here.has(who)) continue;
        if (t.status === 'review') this.fly('pr', { agent: who }, { station: 'inbox' }, '#' + t.id);
        else if (t.status === 'done') {
          const from = agents.find((a) => a.role === 'integrator' && a.id !== who);
          this.fly('merged', from ? { agent: from.id } : { station: 'inbox' }, { agent: who }, '#' + t.id);
          this.cheer.set(who, st.time + 4.5);
        } else if ((t.status === 'claimed' || t.status === 'in_progress') && (was.status === 'open' || !was.assignee)) this.fly('assign', { station: 'depot' }, { agent: who }, '#' + t.id);
      }
    }
    this.prev = new Map(tasks.map((t) => [t.id, t]));
    this.applyCheer();
  }

  /** Advance the scene clock (seconds of real time); expires planes and celebrations, keeps the TV countdown right. */
  tick(dt: number, now = Date.now()): void {
    this.state.time += dt;
    this.state.flights = this.state.flights.filter((f) => this.state.time < f.t0 + f.dur + 1.5);
    this.updateClock(now);
    if (this.cheer.size) this.applyCheer();
  }

  private updateClock(now: number): void {
    this.wallAt = now;
    const b = this.board;
    const h = this.state.hack;
    if (!b) return;
    const t = timeNow(b, now);
    const over = t.deadline && now - t.deadline >= 60 * 60e3;
    h.active = !!t.deadline && !over;
    h.project = this.state.plan.name;
    h.stage = !h.active ? 'idle' : t.past ? 'demo' : t.frozen ? 'polish' : 'build';
    h.endsAt = this.state.time + (t.deadline - now) / 1000;
    h.demoReadiness = this.state.metrics.scopeDone;
  }

  private applyCheer(): void {
    const time = this.state.time;
    for (const [id, until] of this.cheer) {
      const a = this.state.agents.find((x) => x.id === id);
      if (!a || time >= until) {
        this.cheer.delete(id);
        if (a && this.board) { const p = this.board.presence.find((x) => x.kind === 'agent' && agentRoot(x.name) === id); if (p) { const l = lookFor(p, this.board, this.wallAt); a.phase = l.phase; a.pose = l.pose; a.bubble = l.bubble; } }
        continue;
      }
      // Only an agent with nothing more pressing cheers (a new blocker or question wins).
      if (a.phase === 'blocked' || a.phase === 'asking_help' || a.pose === 'sleep') continue;
      a.phase = 'celebrating'; a.pose = 'celebrate';
    }
  }

  private fly(kind: FlightKind, from: Flight['from'], to: Flight['to'], label: string): void {
    this.state.flights.push({ id: 'L' + ++this.flightSeq, kind, from, to, t0: this.state.time + 0.2, dur: 2.6, ticketId: label, label });
  }
}
