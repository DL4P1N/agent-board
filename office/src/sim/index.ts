/**
 * Agent Board simulation engine. Deterministic (seeded) discrete-time sim of an office of coding agents.
 * Public surface: the Simulation class + difficulty/pricing helpers. `sim.state` / `sim.settings` are stable objects
 * mutated in place (never replaced), so the UI/scene can hold references.
 */
import type { Skill } from '../skills';
import { DEFAULT_SETTINGS, type AgentOverride, type BoardCommands, type SimEvent, type SimSettings, type SimState, type Ticket, type TicketSpec } from '../types';
import { say as chatSay } from './chat';
import * as cmd from './commands';
import { World } from './world';

export * from './difficulty';
export { PRICE_TABLE, priceFor, costOf, estimateTicketCost, estimateForDifficulty, tokenRates, COST_SCALE, CONTEXT_WINDOW } from './pricing';
export type { Price } from './pricing';
export { SAMPLE_BRIEFS, planFromBrief } from './briefs';
export { CHAT_HELP, CHAT_SUGGESTIONS, parseChat } from './intents';

const MAX_SUBSTEPS = 10;
const SUBSTEP = 0.05;

function initialState(): SimState {
  return {
    time: 0, agents: [], tickets: [], log: [],
    metrics: {
      merged: 0, open: 0, inReview: 0, rejected: 0, throughputPerMin: 0, avgCycleSec: 0, utilization: 0, scopeDone: 0, etaMinutes: null,
      helpTotal: 0, helpOpen: 0,
      totalCostUsd: 0, burnUsdPerMin: 0, avgCostPerMergedUsd: 0, wasteUsd: 0, projectedScopeCostUsd: 0, budgetUsedPct: 0,
      costByTier: {}, costByProvider: { claude: 0, codex: 0 }, orchestrationCostUsd: 0,
    },
    plan: { name: '', totalTickets: 0, deadlineMinutes: 0, epics: [], note: '' },
    depotStacks: 0, inboxStacks: 0, libraryStock: [], outStacks: 0, mainCommits: 0, deployments: 0,
    skills: [], flights: [], help: [], chat: [],
    hack: {
      active: false, project: '', brief: '', stage: 'idle', startedAt: 0, endsAt: 0, milestones: [], checklist: [], demoReadiness: 0,
      deployUrl: null, deployStatus: 'none', pitch: '', scopeCuts: 0,
    },
  };
}

function cleanPatch<T extends object>(p: T): Partial<T> {
  const o: Partial<T> = {};
  for (const k of Object.keys(p) as (keyof T)[]) if (p[k] !== undefined) o[k] = p[k];
  return o;
}

export class Simulation implements BoardCommands {
  settings: SimSettings;
  state: SimState;
  private w: World;

  constructor(settings: Partial<SimSettings> = {}) {
    this.settings = { ...DEFAULT_SETTINGS, manualConfig: { ...DEFAULT_SETTINGS.manualConfig } };
    this.applySettings(settings);
    this.state = initialState();
    this.w = new World(this.settings, this.state);
  }

  private applySettings(patch: Partial<SimSettings>): void {
    const p = cleanPatch(patch);
    if (p.manualConfig) p.manualConfig = { ...p.manualConfig };
    Object.assign(this.settings, p);
  }

  /** Advance by real seconds (scaled by settings.simSpeed). Paused (simSpeed 0) freezes everything. */
  step(dtRealSeconds: number): void {
    const sp = this.settings.simSpeed;
    if (!(dtRealSeconds > 0)) return;
    if (!(sp > 0)) { this.w.stepPaused(dtRealSeconds); return; }
    const total = Math.min(dtRealSeconds * sp, MAX_SUBSTEPS * SUBSTEP);
    const n = Math.max(1, Math.ceil(total / SUBSTEP - 1e-9));
    const h = total / n;
    this.w.reconcile();
    for (let i = 0; i < n; i++) this.w.tick(h);
    this.w.endStep();
  }

  /** Live slider changes; safe at any moment. Extra workers walk in from the SE corner, removed ones walk home and sign off. */
  setSettings(patch: Partial<SimSettings>): void {
    this.applySettings(patch);
    this.w.reconcile();
  }

  /** Pin model/subagents/etc for one agent (null clears). `offline: true` sends a worker home and marks it offline. */
  setAgentOverride(agentId: string, patch: AgentOverride | null): void {
    const w = this.w;
    const rt = w.rts.get(agentId);
    if (!rt) return;
    if (patch === null) w.overrides.delete(agentId);
    else {
      const merged: AgentOverride = { ...(w.overrides.get(agentId) ?? {}), ...cleanPatch(patch) };
      if (rt.a.role !== 'worker') { delete merged.offline; delete merged.provider; }
      w.overrides.set(agentId, merged);
    }
    w.reconcile();
    w.applyConfig(rt, false);
  }

  /** Human-injected ticket with a generated title (legacy "+ ticket" button): carried to the depot by the orchestrator on its next trip. */
  addTicket(difficulty?: number): void { cmd.addRandomTicket(this.w, difficulty); }

  // ---- BoardCommands
  createTicket(spec: TicketSpec): Ticket { return cmd.createTicket(this.w, spec); }
  updateTicket(id: string, patch: Partial<TicketSpec>): void { cmd.updateTicket(this.w, id, patch); }
  cancelTicket(id: string): void { cmd.cancelTicket(this.w, id); }
  addSkill(skill: Partial<Skill> & { name: string }): Skill { return cmd.addSkill(this.w, skill); }
  removeSkill(id: string): void { cmd.removeSkill(this.w, id); }
  equipSkill(agentId: string, skillId: string): void { cmd.equipSkill(this.w, agentId, skillId); }
  unequipSkill(agentId: string, skillId: string): void { cmd.unequipSkill(this.w, agentId, skillId); }
  /** Human -> 'orch' | agent id | 'all'. The ChatMessage from 'you' is pushed now; the reply lands 1..3 sim-seconds later. */
  say(to: string, text: string): void { chatSay(this.w, to, text); }
  requestHelp(fromAgentId: string, toAgentId: string, question?: string): void { cmd.requestHelp(this.w, fromAgentId, toAgentId, question); }
  setBrief(projectName: string, brief: string): void { cmd.setBrief(this.w, projectName, brief); }
  setDeadline(minutesFromNow: number): void { cmd.setDeadline(this.w, minutesFromNow); }

  reset(settings?: Partial<SimSettings>): void {
    if (settings) this.applySettings(settings);
    this.w.init();
  }

  on(cb: (e: SimEvent) => void): () => void {
    this.w.listeners.push(cb);
    return () => { this.w.listeners = this.w.listeners.filter((l) => l !== cb); };
  }

  /** Spend of agents that already left the room (per-agent usage + this == metrics.totalCostUsd). */
  get retiredCostUsd(): number { return this.w.retiredUsd; }
}
