/**
 * SHARED CONTRACT - the single source of truth between sim/, scene/ and ui/.
 * Do not change shapes here without telling the coordinator; additive optional fields are OK.
 *
 * Coordinates: three.js convention. x = east, y = up, z = south. 1 unit ~ 1 metre.
 * Heading: radians, rotation about +y. heading 0 faces -z (north), PI/2 faces -x (west), PI faces +z (south).
 *   i.e. an object whose "front" is -z rotated by `heading` via object.rotation.y = heading.
 */

import type { StationId } from './layout';
import type { Skill } from './skills';

import type { FleetMix, ProviderId } from './providers';
/** Which coding-agent tool runs an agent. The full list (names, colours) lives in providers.ts. */
export type Provider = ProviderId;
export type Role = 'worker' | 'orchestrator' | 'integrator';
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface Vec2 { x: number; z: number }

/** What the character rig should be animating. The sim picks one every tick. */
export type Pose =
  | 'idle'        // standing, breathing, looking around
  | 'walk'        // walking empty-handed
  | 'carry_walk'  // walking holding a stack of papers (arms forward)
  | 'pickup'      // reaching to grab / drop a stack of papers (one-shot-ish, loops while active)
  | 'type'        // seated, typing fast at the keyboard
  | 'think'       // seated, chin-scratch / head tilt, occasional slow keypress
  | 'wait'        // seated or standing, tapping foot / checking watch / yawn; low energy
  | 'blocked'     // frustrated: red "!" energy, head-in-hands or arms up
  | 'review'      // reading papers with a red pen / magnifier (integrator)
  | 'plan'        // standing at the whiteboard, writing / pointing (orchestrator)
  | 'celebrate'   // jump + arms up (merged!)
  | 'sleep'       // desk-slumped, "zzz" (no work, agent offline)
  | 'throw'       // folds a paper airplane and tosses it (sending a PR / help request / reply); ~0.9s one-shot loop
  | 'raise_hand'; // seated or standing, one arm waving high: "I need help" 

/** Logical phase of an agent in the ticket lifecycle. Drives bubbles + UI text; Pose drives animation. */
export type Phase =
  | 'offline'          // desk empty / agent not connected
  | 'idle'             // connected, no ticket
  | 'to_depot'         // walking to paper depot to pick up a ticket
  | 'picking_up'       // at the depot, grabbing the stack
  | 'to_library'       // walking to the Skill Library to fetch skills the ticket needs (after the depot)
  | 'picking_skills'   // at the library shelves, grabbing skill cartridges/books
  | 'to_desk'          // carrying the stack (and skills) back to own desk
  | 'working'          // implementing
  | 'waiting'          // waiting on something (CI, API quota, another agent, review)
  | 'blocked'          // stuck, needs help (e.g. missing secret)
  | 'submitting'       // folding + throwing the PR paper airplane to the integrator inbox
  | 'asking_help'      // raised hand / throwing a help-request paper airplane at a peer
  | 'awaiting_help'    // waiting at desk for the helper's reply plane
  | 'helping'          // writing a reply to a peer's help request (type/think pose), then throws the reply plane
  | 'to_review'        // (legacy, unused) carrying finished PR papers to the integrator inbox
  | 'awaiting_review'  // stood/sat near the integrator desk, or back at own desk, waiting for verdict
  | 'rework_pickup'    // (legacy, unused) walking to integrator desk to collect rejected papers
  | 'reworking'        // back at desk, fixing review feedback
  | 'celebrating'      // PR merged
  | 'planning'         // orchestrator at the board
  | 'delivering'       // orchestrator carrying new ticket papers to depot
  | 'reviewing'        // integrator reading a PR
  | 'merging'          // integrator merges to main / deploys
  | 'returning';       // integrator hands papers back to a worker

export type Model = string; // free string, see sim/difficulty.ts MODEL_TABLE

export interface AgentConfig {
  /** Model name chosen for the current ticket (changes with difficulty unless overridden). */
  model: Model;
  /** Provider-specific tier label, e.g. 'haiku' | 'sonnet' | 'opus' | 'fable' | 'mini' | 'standard' | 'max'. */
  tier: string;
  /** Autocompact buffer: % of the context window kept free before auto-compaction fires (e.g. 10..45). */
  autocompactBuffer: number;
  /** Max parallel subagents this agent may spawn (0..8). */
  subagents: number;
  /** Reasoning effort label. */
  effort: 'low' | 'medium' | 'high' | 'max';
}

/** Token usage + estimated spend. All costs are ESTIMATES from an illustrative price table (see sim/pricing.ts). */
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;   // cheap re-reads of cached context
  costUsd: number;
}

export interface AgentState {
  id: string;                 // 'a1', 'orch', 'integ'
  name: string;               // 'Pixel', 'Marlow'...
  provider: Provider;
  role: Role;
  /** Owner (human who contributed this agent), purely cosmetic. */
  owner: string;
  /** Index into DESKS (workers) - orchestrator/integrator use their own station but still have one. */
  deskIndex: number;
  pos: Vec2;
  heading: number;
  pose: Pose;
  phase: Phase;
  /** 0..1 progress through the current phase (walking = path progress, working = ticket progress). */
  phaseProgress: number;
  carrying: null | { kind: 'tickets' | 'pr' | 'rejected' | 'skills'; count: number };
  /** Skill ids currently equipped (<= SKILL_SLOTS, see skills.ts). Scene shows them as coloured cartridges on the agent. */
  skills: string[];
  /** Agent id this agent is waiting on for help (asked, no reply yet), or null. */
  waitingOn: string | null;
  /** Agent id this agent is currently helping, or null. */
  helping: string | null;
  /** Hex colour of this agent's human owner (OWNER_COLORS) - worn as a cap band/lanyard + name-tag stripe. */
  ownerColor: string;
  ticketId: string | null;
  config: AgentConfig;
  /** True when the user pinned model/subagents via the UI instead of auto-by-difficulty. */
  overridden: boolean;
  /** Number of subagents currently alive (<= config.subagents). */
  activeSubagents: number;
  /** Context window fill 0..1; when it crosses (1 - autocompactBuffer/100) a compaction flash plays. */
  contextFill: number;
  /** Increments each time a compaction happens (scene can flash on change). */
  compactions: number;
  /** Short speech-bubble text or null. */
  bubble: string | null;
  stats: { done: number; merged: number; reworks: number; walkedMeters: number };
  /** Cumulative usage by this agent since it joined (includes rework, compaction summaries, subagents). */
  usage: Usage;
  /** Spend rate right now in USD per sim-minute (0 when idle/walking). */
  burnUsdPerMin: number;
  /** Portion of usage.costUsd that came from subagents (so the UI can show the subagent premium). */
  subagentCostUsd: number;
}

export type TicketStatus = 'backlog' | 'assigned' | 'in_progress' | 'in_review' | 'changes_requested' | 'merged' | 'cancelled';

export interface Ticket {
  id: string;                 // 'T-12'
  title: string;
  difficulty: Difficulty;
  status: TicketStatus;
  assignee: string | null;    // agent id
  progress: number;           // 0..1 (implementation progress)
  createdAt: number;          // sim seconds
  mergedAt: number | null;
  reworks: number;
  epic: string;               // grouping label from the orchestrator's plan
  /** Longer spec text (acceptance criteria). */
  description: string;
  /** Who filed it. */
  source: 'orchestrator' | 'human';
  /** If set, only this agent id may claim it (human pin or orchestrator assignment). */
  pinnedTo: string | null;
  /** Higher = picked up first (default 0). Humans can bump it. */
  priority: number;
  /** Hackathon milestone id this ticket belongs to ('mvp' | 'features' | 'polish' | 'demo' | custom), or null. */
  milestone: string | null;
  /** Number of help requests raised while working on it. */
  helpRequests: number;
  /** Skill ids (skills.ts) the orchestrator tagged this ticket with; the assignee fetches missing ones from the library. */
  skills: string[];
  /** Orchestrator's up-front cost estimate (from difficulty + chosen config), set at creation. */
  estimatedCostUsd: number;
  /** Actual accumulated usage across all attempts (first pass + reworks + reviewer time). */
  usage: Usage;
  /** Cost of the integrator's review passes on this ticket (included in usage.costUsd). */
  reviewCostUsd: number;
}

export interface LogEntry {
  t: number;                  // sim seconds
  agentId: string | null;
  kind: 'info' | 'help' | 'chat' | 'skill' | 'ticket' | 'review' | 'merge' | 'reject' | 'plan' | 'block' | 'compact' | 'cost';
  text: string;
}

export interface Metrics {
  merged: number;
  open: number;
  inReview: number;
  rejected: number;
  throughputPerMin: number;   // merges per sim-minute over a trailing window
  avgCycleSec: number;        // created -> merged
  utilization: number;        // 0..1 share of workers currently working
  scopeDone: number;          // merged tickets / total scoped tickets in the plan
  etaMinutes: number | null;  // orchestrator's estimate to finish scope
  helpTotal: number;          // help requests raised (lifetime)
  helpOpen: number;           // currently unanswered
  totalCostUsd: number;       // all agents, incl. orchestrator + integrator overhead
  burnUsdPerMin: number;      // current total spend rate
  avgCostPerMergedUsd: number;// total ticket cost / merged tickets (0 if none)
  wasteUsd: number;           // spend on attempts that got rejected (rework cost)
  projectedScopeCostUsd: number; // orchestrator's forecast to finish all scope
  budgetUsedPct: number;      // PERCENT 0..100+: 100 * totalCostUsd / settings.budgetUsd (0 when budget is 0 = unlimited)
  costByTier: Record<string, number>; // tier label -> USD ('haiku', 'opus', 'mini'...)
  costByProvider: Record<Provider, number>;
  orchestrationCostUsd: number; // orchestrator + integrator overhead
}

export interface ScopePlan {
  name: string;               // 'Sprint 1: Billing revamp'
  totalTickets: number;
  deadlineMinutes: number;    // sim minutes from start
  epics: string[];
  note: string;               // orchestrator's current one-liner
}

export interface SimState {
  time: number;               // sim seconds since start
  agents: AgentState[];       // orchestrator first, integrator second, then workers by deskIndex
  tickets: Ticket[];
  log: LogEntry[];            // newest last, capped (~200)
  metrics: Metrics;
  plan: ScopePlan;
  /** Paper stacks currently sitting on the depot shelf (visual). */
  depotStacks: number;
  /** PRs waiting in the integrator inbox tray (visual). */
  inboxStacks: number;
  /** Skill ids currently present on the library shelves (all by default; a skill 'checked out' may be empty briefly - optional). */
  libraryStock: string[];
  /** Rejected stacks waiting for pickup on the integrator's out tray (visual). */
  outStacks: number;
  /** Merges to main so far; the "main" server rack blinks on change. */
  mainCommits: number;
  deployments: number;
  /** Runtime skill catalog (starts as SKILLS from skills.ts; humans can add/remove). ALWAYS use this, never the static SKILLS, for lookups. */
  skills: Skill[];
  /** Paper airplanes in flight or just landed (kept ~1.5 sim-s after landing). The scene animates them. */
  flights: Flight[];
  /** Recent help requests between agents (newest last, cap ~30). */
  help: HelpRequest[];
  /** Chat transcript: human <-> orchestrator/agents (newest last, cap ~200). */
  chat: ChatMessage[];
  /** Hackathon state (active when settings.mode === 'hackathon'). */
  hack: HackState;
}

// ---------- paper airplanes (messages) ----------
export type FlightKind =
  | 'pr'          // worker -> integrator inbox (white/blue plane, label = ticket id)
  | 'merged'      // integrator -> author (green plane)
  | 'changes'     // integrator -> author (red plane): review comments, ticket returns to author
  | 'help'        // worker -> peer or orchestrator (yellow plane with '?')
  | 'help_reply'  // helper -> asker (teal plane)
  | 'assign'      // orchestrator -> agent: pinned ticket / directive (purple plane)
  | 'chat'        // orchestrator or agent -> agent, in response to a human message (orange plane)
  | 'broadcast';  // orchestrator -> everyone (several planes) e.g. plan update, scope cut

export type FlightEndpoint = { agent: string } | { station: StationId };

export interface Flight {
  id: string;
  kind: FlightKind;
  from: FlightEndpoint;
  to: FlightEndpoint;
  /** Sim time (seconds) at which the plane leaves the sender's hand. Sim sets pose 'throw' just before t0. */
  t0: number;
  /** Flight duration in sim seconds (2..4). Progress = (state.time - t0) / dur. Scene resolves endpoints each frame (agents move). */
  dur: number;
  label?: string;
  ticketId?: string;
}

export interface HelpRequest {
  id: string;
  fromAgent: string;
  toAgent: string;            // peer id, or 'orch'
  ticketId: string | null;
  question: string;
  answer: string | null;
  t0: number;
  status: 'open' | 'answered' | 'timeout';
  /** True if a human asked for it via the UI. */
  byHuman: boolean;
}

// ---------- chat with the orchestrator / agents ----------
export interface ChatMessage {
  id: string;
  t: number;                  // sim seconds
  from: string;               // 'you' | agent id
  to: string;                 // 'you' | agent id | 'all'
  text: string;
  /** 'say' normal message; 'action' = something the orchestrator DID because of a message (e.g. 'Created T-31'); 'system' = notices. */
  kind: 'say' | 'action' | 'system';
}

/** Human-facing commands. Simulation implements this; a future RemoteSimulation maps each to a board-server call. */
export interface TicketSpec {
  title: string;
  description?: string;
  difficulty?: Difficulty;
  skills?: string[];
  epic?: string;
  milestone?: string | null;
  pinnedTo?: string | null;
  priority?: number;
}

export interface BoardCommands {
  createTicket(spec: TicketSpec): Ticket;
  updateTicket(id: string, patch: Partial<TicketSpec>): void;     // difficulty/skills/pin/priority/title edits (re-rating re-configures the agent at its next pickup)
  cancelTicket(id: string): void;                                  // returns a held ticket to nobody; assignee walks back idle
  addSkill(skill: Partial<Skill> & { name: string }): Skill;       // id derived from name; colour/glyph auto if missing; custom: true
  removeSkill(id: string): void;                                   // strips from tickets + agents
  equipSkill(agentId: string, skillId: string): void;              // instantly equips (LRU-evicting beyond SKILL_SLOTS)
  unequipSkill(agentId: string, skillId: string): void;
  say(to: string, text: string): void;                             // human -> 'orch' | agent id | 'all'; replies arrive asynchronously in state.chat (+ planes/actions)
  requestHelp(fromAgentId: string, toAgentId: string, question?: string): void;  // human-triggered help request
  setBrief(projectName: string, brief: string): void;              // hackathon: replan from a brief (orchestrator files tickets over time)
  setDeadline(minutesFromNow: number): void;
}

// ---------- hackathon mode ----------
export interface Milestone {
  id: string;                 // 'mvp' | 'features' | 'polish' | 'demo'
  title: string;
  ticketIds: string[];
  done: boolean;
  /** Sim minute (since hack start) the orchestrator wants this milestone finished by. */
  dueMin: number;
}
export interface ChecklistItem { id: string; label: string; done: boolean; auto: boolean }

export interface HackState {
  active: boolean;
  project: string;
  brief: string;
  stage: 'idle' | 'kickoff' | 'build' | 'polish' | 'demo' | 'submitted';
  startedAt: number;          // sim seconds
  endsAt: number;             // sim seconds (submission deadline)
  milestones: Milestone[];
  checklist: ChecklistItem[]; // 'repo', 'deploy-live', 'readme', 'demo-script', 'pitch', 'submitted'
  demoReadiness: number;      // 0..1 blend of merged scope, milestones, checklist
  deployUrl: string | null;   // mock preview url once the first deploy happens
  deployStatus: 'none' | 'building' | 'live' | 'failed';
  pitch: string;              // one-liner pitch the orchestrator maintains
  scopeCuts: number;          // tickets descoped so far
}

// ---------- chat intents + brief planning (pure modules in sim/intents.ts and sim/briefs.ts) ----------
export type Intent =
  | { type: 'create_ticket'; spec: TicketSpec }
  | { type: 'cancel_ticket'; id: string }
  | { type: 'set_difficulty'; id: string; difficulty: Difficulty }
  | { type: 'prioritize'; id: string; priority: number }
  | { type: 'pin_ticket'; id: string; agentId: string | null }
  | { type: 'add_skill'; skill: Partial<Skill> & { name: string } }
  | { type: 'remove_skill'; id: string }
  | { type: 'equip_skill'; agentId: string; skillId: string }
  | { type: 'unequip_skill'; agentId: string; skillId: string }
  | { type: 'set_deadline'; minutes: number }
  | { type: 'cut_scope'; count: number }
  | { type: 'set_brief'; project: string; brief: string }
  | { type: 'message_agent'; agentId: string; text: string }   // orchestrator relays by paper plane
  | { type: 'ask_help'; fromAgentId: string; toAgentId: string; question: string }
  | { type: 'set_speed'; value: number }
  | { type: 'status' };

export interface ChatContext {
  time: number;
  agents: AgentState[];
  tickets: Ticket[];
  skills: Skill[];
  metrics: Metrics;
  plan: ScopePlan;
  hack: HackState;
  settings: SimSettings;
}
export interface ParsedChat { intents: Intent[]; reply: string }

export interface PlannedTicket {
  title: string; description: string; difficulty: Difficulty; skills: string[]; epic: string;
  milestone: 'mvp' | 'features' | 'polish' | 'demo'; priority: number;
}
export interface BriefPlan {
  epics: string[];
  milestones: { id: Milestone['id']; title: string; dueFraction: number }[]; // dueFraction of total hack time
  tickets: PlannedTicket[];   // ordered: scaffolding first
  checklist: ChecklistItem[];
  pitch: string;
}

/** The sliders. Everything the demo UI can tweak at runtime. */
export interface SimSettings {
  seed: number;
  workerCount: number;        // 1..12 connected workers (rest of desks stay empty/dark)
  /** Relative weight per tool (Claude Code, Codex, Copilot, Gemini CLI, Cursor, other). 0 = none of that tool. */
  fleetMix: FleetMix;
  simSpeed: number;           // 0..8 time multiplier (0 = paused)
  ticketsPerMinute: number;   // orchestrator ticket creation rate 0..6
  meanDifficulty: number;     // 1..5 average difficulty of new tickets
  difficultySpread: number;   // 0..2 std-dev-ish spread
  workSpeed: number;          // 0.25..4 agent productivity multiplier
  rejectRate: number;         // 0..0.7 chance integrator sends a PR back
  blockRate: number;          // 0..0.5 chance a ticket hits a blocker (missing secret, flaky CI)
  walkSpeed: number;          // 0.5..3 metres per sim-second multiplier
  totalScope: number;         // 4..60 tickets in the plan
  deadlineMinutes: number;    // 5..120
  mode: 'sprint' | 'hackathon'; // hackathon: finite scope derived from `brief`, milestones, demo deadline; sprint: endless rolling sprints
  projectName: string;
  brief: string;              // what are we building (hackathon mode)
  helpRate: number;           // 0..1 how often stuck agents ask a peer for help (paper airplane)
  budgetUsd: number;          // 0 = unlimited; otherwise a soft cap: orchestrator warns at 80%, downshifts models above 100%
  /** 'auto' picks model/subagents/autocompact from ticket difficulty; 'manual' uses manualConfig for all. */
  configMode: 'auto' | 'manual';
  manualConfig: AgentConfig;
}

export const DEFAULT_SETTINGS: SimSettings = {
  seed: 7,
  workerCount: 6,
  fleetMix: { claude: 3, codex: 2, copilot: 0, gemini: 0, cursor: 0, other: 0 },
  simSpeed: 1,
  ticketsPerMinute: 2,
  meanDifficulty: 3,
  difficultySpread: 1,
  workSpeed: 1,
  rejectRate: 0.25,
  blockRate: 0.1,
  walkSpeed: 1,
  totalScope: 24,
  deadlineMinutes: 40,
  mode: 'hackathon',
  projectName: 'Sticky Wall',
  brief: 'A realtime collaborative whiteboard with AI-generated sticky notes, login, and a public share link. Deploy a live demo.',
  helpRate: 0.5,
  budgetUsd: 150,
  configMode: 'auto',
  manualConfig: { model: 'claude-sonnet-5-5', tier: 'sonnet', autocompactBuffer: 20, subagents: 2, effort: 'medium' },
};

/** Per-agent UI override (applied via Simulation.setAgentOverride). */
export type AgentOverride = Partial<Pick<AgentConfig, 'model' | 'tier' | 'autocompactBuffer' | 'subagents' | 'effort'>> & {
  provider?: Provider;
  offline?: boolean;
};

/** Visual-only settings (never touch the sim). */
export interface VisualSettings {
  pixelSize: number;          // 1..8 render pixel size in screen px (low-res upscaled with nearest)
  dither: number;             // 0..1 Bayer dither strength
  palette: 'dusk' | 'day' | 'night' | 'terminal';
  autoOrbit: boolean;
  orbitSpeed: number;         // 0..2
  showLabels: boolean;        // floating name tags
  showBubbles: boolean;       // speech bubbles
  showPaths: boolean;         // debug: draw walking paths
  quality: 'low' | 'high';    // shadows on/off etc
  /** 0..1 camera framing. 0 = whole office, 1 = close on the selected agent (if any). */
  focus: number;
}

export const DEFAULT_VISUAL: VisualSettings = {
  pixelSize: 3,
  dither: 0.35,
  palette: 'dusk',
  autoOrbit: false,
  orbitSpeed: 0.4,
  showLabels: true,
  showBubbles: true,
  showPaths: false,
  quality: 'high',
  focus: 0,
};

export type SimEvent =
  | { type: 'ticket_created'; ticket: Ticket }
  | { type: 'ticket_assigned'; ticket: Ticket; agentId: string }
  | { type: 'pr_opened'; ticket: Ticket; agentId: string }
  | { type: 'pr_merged'; ticket: Ticket; agentId: string }
  | { type: 'pr_rejected'; ticket: Ticket; agentId: string }
  | { type: 'compaction'; agentId: string }
  | { type: 'skills_loaded'; agentId: string; skills: string[] }
  | { type: 'plan_updated'; plan: ScopePlan }
  | { type: 'budget_warning'; usedPct: number }
  | { type: 'flight'; flight: Flight }
  | { type: 'help_requested'; request: HelpRequest }
  | { type: 'help_answered'; request: HelpRequest }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'milestone_done'; milestoneId: string }
  | { type: 'hack_stage'; stage: HackState['stage'] };
