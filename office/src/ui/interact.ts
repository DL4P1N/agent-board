// Shared helpers for the interaction layer (comms, help feed, palette, hackathon).
import { isProvider } from '../providers';
import type { AgentState, BoardCommands, SimState } from '../types';
import type { UICtx } from './ctx';
import { h } from './dom';
import { icon, type IconName } from './icons';

export const EMPTY: readonly never[] = [];

/** The simulation as a BoardCommands implementation. Methods may be missing while the engine is being upgraded. */
export function commands(ctx: UICtx): BoardCommands { return ctx.sim as unknown as BoardCommands; }

/** Call a BoardCommands method defensively: a missing method logs once instead of crashing the HUD. */
export function cmd<K extends keyof BoardCommands>(ctx: UICtx, name: K, ...args: Parameters<BoardCommands[K]>): ReturnType<BoardCommands[K]> | undefined {
  const fn = (ctx.sim as unknown as Record<string, unknown>)[name];
  if (typeof fn !== 'function') { console.warn(`[ui] Simulation.${String(name)} is not available yet`); return undefined; }
  return (fn as (...a: unknown[]) => ReturnType<BoardCommands[K]>).apply(ctx.sim, args);
}

export const ROLE_ICON: Record<string, IconName> = { worker: 'worker', orchestrator: 'orchestrator', integrator: 'integrator' };
export const ROLE_LABEL: Record<string, string> = { worker: 'Worker', orchestrator: 'Orchestrator', integrator: 'Integrator' };

export const agentOf = (state: SimState, id: string | null | undefined): AgentState | undefined => (id ? state.agents.find((a) => a.id === id) : undefined);

/** Display name for a chat / help endpoint id ('you', 'all', 'orch', agent ids). */
export function nameOf(state: SimState, id: string): string {
  if (id === 'you') return 'You';
  if (id === 'all') return 'Everyone';
  const a = agentOf(state, id);
  if (!a) return id === 'orch' ? 'Orchestrator' : id;
  return a.role === 'orchestrator' ? 'Orchestrator' : a.name;
}

/** Small provider-coloured square (owner colour as an outline stripe when given). */
export function dot(provider: string | null | undefined, ownerColor?: string | null): HTMLElement {
  const el = h('i', { class: `pdot ${isProvider(provider) ? provider : ''}`.trim() });
  if (ownerColor) el.style.setProperty('--oc', ownerColor);
  return el;
}

/** "[dot] Name" tag for an agent (or a plain name for 'you' / 'all'). */
export function whoTag(state: SimState, id: string): HTMLElement {
  const a = agentOf(state, id);
  const kids: (Node | string)[] = [];
  if (a) kids.push(dot(a.provider, a.ownerColor));
  else if (id === 'all') kids.push(icon('users'));
  kids.push(h('span', { class: 'wt-name' }, nameOf(state, id)));
  return h('span', { class: 'who-tag', title: a ? `${a.name} (${a.provider}, ${a.role})` : '' }, ...kids);
}

export function snippet(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}...` : t;
}

/** Sim seconds -> m:ss (minutes may exceed 59). */
export function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------------------------
// Fuzzy match (subsequence with word-start / run bonuses). Returns -1 when the query does not match.

function wordStart(t: string, i: number): boolean { return i === 0 || /[\s\-_/.:]/.test(t[i - 1]); }
function fuzzyOne(q: string, t: string, strict: boolean): number {
  const idx = t.indexOf(q);
  if (idx >= 0) return 100 + (idx === 0 ? 40 : 0) + (wordStart(t, idx) ? 20 : 0) - idx * 0.5 - t.length * 0.05;
  if (strict) return -1;
  let ti = 0, score = 0, prev = -2;
  for (const ch of q) {
    const f = t.indexOf(ch, ti);
    if (f < 0) return -1;
    score += 1 + (f === prev + 1 ? 3 : 0) + (wordStart(t, f) ? 4 : 0);
    prev = f; ti = f + 1;
  }
  return score;
}
export function fuzzy(query: string, text: string): number {
  const toks = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!toks.length) return 0;
  const t = text.toLowerCase();
  let total = 0;
  const strict = toks.length >= 4; // whole sentences must match literally (so they fall through to 'send to orchestrator')
  for (const tok of toks) { const s = fuzzyOne(tok, t, strict); if (s < 0) return -1; total += s; }
  return total;
}

// ---------------------------------------------------------------------------------------------
// Sim-owned content with local fallbacks (sim/intents.ts and sim/briefs.ts are being written in parallel).

export interface ChatHelpEntry { cmd: string; example: string; blurb: string }
export interface SampleBrief { project: string; brief: string }

export const FALLBACK_CHAT_HELP: ChatHelpEntry[] = [
  { cmd: 'status', example: 'status', blurb: 'Orchestrator summarises progress, ETA and risks.' },
  { cmd: 'add task', example: 'add a task: password reset email (hard)', blurb: 'File a task; add a difficulty word to rate it.' },
  { cmd: 'cancel task', example: 'cancel T-12', blurb: 'Drop a task from the plan.' },
  { cmd: 'set difficulty', example: 'make T-12 epic', blurb: 'Re-rate a task (trivial..epic).' },
  { cmd: 'prioritize', example: 'prioritize T-12', blurb: 'Bump a task to the front of the queue.' },
  { cmd: 'assign', example: 'give T-12 to Pixel', blurb: 'Pin a task to one agent.' },
  { cmd: 'tell agent', example: 'tell Pixel to write the README', blurb: 'Orchestrator relays by paper plane.' },
  { cmd: 'ask for help', example: 'ask Marlow to help Pixel', blurb: 'Send a help request between two agents.' },
  { cmd: 'add skill', example: 'add skill Stripe Webhooks', blurb: 'Create a custom skill in the library.' },
  { cmd: 'equip skill', example: 'equip Playwright on Pixel', blurb: 'Hand a skill to an agent.' },
  { cmd: 'cut scope', example: 'cut scope by 2', blurb: 'Descope the lowest-value tasks.' },
  { cmd: 'deadline', example: 'extend deadline by 10 minutes', blurb: 'Move the submission deadline.' },
  { cmd: 'speed', example: 'speed 4x', blurb: 'Change the simulation speed.' },
  { cmd: 'kick off', example: 'kick off: Sticky Wall - a realtime whiteboard with share links', blurb: 'Replan from a new project brief.' },
];
export const FALLBACK_CHAT_SUGGESTIONS: string[] = ['status', 'cut scope by 2', 'who is blocked?', 'extend deadline by 10 minutes', 'prioritize the deploy task'];
export const FALLBACK_BRIEFS: SampleBrief[] = [
  { project: 'Sticky Wall', brief: 'A realtime collaborative whiteboard with AI-generated sticky notes, login, and a public share link. Deploy a live demo.' },
  { project: 'Standup Bot', brief: 'A Slack-style standup collector that summarises the team update each morning, with a web dashboard and a one-click deploy.' },
  { project: 'Recipe Radar', brief: 'Paste a fridge photo description, get recipes ranked by what you already have, with a shareable shopping list.' },
];

// sim/intents.ts owns the real command help + suggestions. import.meta.glob resolves to {} when the module is absent,
// so the HUD works (with the local fallbacks above) whichever order the files land in.
const intentMods = import.meta.glob('../sim/intents.ts', { eager: true }) as Record<string, { CHAT_HELP?: ChatHelpEntry[]; CHAT_SUGGESTIONS?: string[] } | undefined>;
const intents = Object.values(intentMods)[0];
export const CHAT_HELP: ChatHelpEntry[] = intents?.CHAT_HELP?.length ? intents.CHAT_HELP : FALLBACK_CHAT_HELP;
export const CHAT_SUGGESTIONS: string[] = intents?.CHAT_SUGGESTIONS?.length ? intents.CHAT_SUGGESTIONS : FALLBACK_CHAT_SUGGESTIONS;

/** "<b>Name</b> text" for activity rows, without doubling the name when the text already starts with it. */
export function whoAndText(a: { name: string; provider: string } | undefined, text: string): (HTMLElement | string)[] {
  if (!a) return [text];
  const rest = text.startsWith(a.name + ' ') ? text.slice(a.name.length + 1) : text;
  return [h('b', { class: `who ${a.provider}` }, a.name), ' ', rest];
}
