/**
 * Difficulty -> agent configuration: the product's core idea.
 * Harder tickets get a stronger model, more subagents, and an earlier autocompact (bigger free buffer) because
 * long hard tasks produce big tool outputs. In configMode 'manual' every ticket uses settings.manualConfig instead.
 *
 * NOTE: every non-Claude model name below is a PLACEHOLDER ('codex-mini', 'copilot-premium', 'gemini-pro', ...).
 * Copilot and Cursor really let the user pick the underlying model; here each tool just gets a cheap -> strong ladder.
 * Tier labels must be unique across tools (they key the price table).
 */
import type { AgentConfig, Difficulty, Provider } from '../types';

export interface ModelInfo {
  model: string;
  tier: string;
  provider: Provider;
  label: string;
  /** Price ladder position within the provider (0 = cheapest). */
  rank: number;
  /** Raw capability on the 1..5 difficulty scale. */
  capability: number;
  /** Relative speed (>1 = faster). */
  speed: number;
}

export const MODEL_LIST: ModelInfo[] = [
  { model: 'claude-haiku-5-5',  tier: 'haiku',    provider: 'claude', label: 'Haiku 5.5',  rank: 0, capability: 1,   speed: 1.35 },
  { model: 'claude-sonnet-5-5', tier: 'sonnet',   provider: 'claude', label: 'Sonnet 5.5', rank: 1, capability: 2.5, speed: 1.15 },
  { model: 'claude-opus-5-5',   tier: 'opus',     provider: 'claude', label: 'Opus 5.5',   rank: 2, capability: 4,   speed: 1.0 },
  { model: 'claude-fable-5-2',  tier: 'fable',    provider: 'claude', label: 'Fable 5.2',  rank: 3, capability: 5,   speed: 0.95 },
  { model: 'codex-mini',        tier: 'mini',     provider: 'codex',  label: 'Codex Mini', rank: 0, capability: 1.5, speed: 1.3 },
  { model: 'codex',             tier: 'standard', provider: 'codex',  label: 'Codex',      rank: 1, capability: 3.5, speed: 1.05 },
  { model: 'codex-max',         tier: 'max',      provider: 'codex',  label: 'Codex Max',  rank: 2, capability: 5,   speed: 0.95 },
  { model: 'copilot-base',      tier: 'base',     provider: 'copilot', label: 'Copilot base',    rank: 0, capability: 1.5, speed: 1.3 },
  { model: 'copilot-premium',   tier: 'premium',  provider: 'copilot', label: 'Copilot premium', rank: 1, capability: 4,   speed: 1.0 },
  { model: 'gemini-flash',      tier: 'flash',    provider: 'gemini', label: 'Gemini Flash', rank: 0, capability: 1.5, speed: 1.4 },
  { model: 'gemini-pro',        tier: 'pro',      provider: 'gemini', label: 'Gemini Pro',   rank: 1, capability: 3.5, speed: 1.05 },
  { model: 'gemini-deep',       tier: 'deep',     provider: 'gemini', label: 'Gemini Deep',  rank: 2, capability: 4.8, speed: 0.9 },
  { model: 'cursor-auto',       tier: 'auto',     provider: 'cursor', label: 'Cursor Auto',     rank: 0, capability: 2,   speed: 1.25 },
  { model: 'cursor-frontier',   tier: 'frontier', provider: 'cursor', label: 'Cursor frontier', rank: 1, capability: 4.5, speed: 1.0 },
  { model: 'mcp-small',         tier: 'small',    provider: 'other',  label: 'Small model',  rank: 0, capability: 1.5, speed: 1.2 },
  { model: 'mcp-medium',        tier: 'medium',   provider: 'other',  label: 'Medium model', rank: 1, capability: 3,   speed: 1.0 },
  { model: 'mcp-large',         tier: 'large',    provider: 'other',  label: 'Large model',  rank: 2, capability: 4.5, speed: 0.9 },
];

const BY_MODEL = new Map(MODEL_LIST.map((m) => [m.model, m]));
const BY_TIER = new Map(MODEL_LIST.map((m) => [m.tier, m]));

export function modelInfo(modelOrTier: string): ModelInfo | undefined { return BY_MODEL.get(modelOrTier) ?? BY_TIER.get(modelOrTier); }
export function tierInfo(tier: string): ModelInfo { return BY_TIER.get(tier) ?? BY_TIER.get('sonnet')!; }

/** Autocompact buffer (% of context kept free) by difficulty 1..5. */
export const AUTOCOMPACT_BY_DIFFICULTY: Record<Difficulty, number> = { 1: 10, 2: 15, 3: 22, 4: 30, 5: 38 };
export const SUBAGENTS_BY_DIFFICULTY: Record<Difficulty, number> = { 1: 0, 2: 1, 3: 2, 4: 4, 5: 6 };

function mk(m: string, tier: string, d: Difficulty, effort: AgentConfig['effort']): AgentConfig {
  return { model: m, tier, autocompactBuffer: AUTOCOMPACT_BY_DIFFICULTY[d], subagents: SUBAGENTS_BY_DIFFICULTY[d], effort };
}

/** The table the UI shows: provider -> difficulty -> config. */
export const MODEL_TABLE: Record<Provider, Record<Difficulty, AgentConfig>> = {
  claude: {
    1: mk('claude-haiku-5-5', 'haiku', 1, 'low'),
    2: mk('claude-sonnet-5-5', 'sonnet', 2, 'medium'),
    3: mk('claude-sonnet-5-5', 'sonnet', 3, 'high'),
    4: mk('claude-opus-5-5', 'opus', 4, 'high'),
    5: mk('claude-fable-5-2', 'fable', 5, 'max'),
  },
  codex: {
    1: mk('codex-mini', 'mini', 1, 'low'),
    2: mk('codex-mini', 'mini', 2, 'medium'),
    3: mk('codex', 'standard', 3, 'medium'),
    4: mk('codex', 'standard', 4, 'high'),
    5: mk('codex-max', 'max', 5, 'max'),
  },
  copilot: {
    1: mk('copilot-base', 'base', 1, 'low'),
    2: mk('copilot-base', 'base', 2, 'medium'),
    3: mk('copilot-premium', 'premium', 3, 'medium'),
    4: mk('copilot-premium', 'premium', 4, 'high'),
    5: mk('copilot-premium', 'premium', 5, 'max'),
  },
  gemini: {
    1: mk('gemini-flash', 'flash', 1, 'low'),
    2: mk('gemini-flash', 'flash', 2, 'medium'),
    3: mk('gemini-pro', 'pro', 3, 'medium'),
    4: mk('gemini-pro', 'pro', 4, 'high'),
    5: mk('gemini-deep', 'deep', 5, 'max'),
  },
  cursor: {
    1: mk('cursor-auto', 'auto', 1, 'low'),
    2: mk('cursor-auto', 'auto', 2, 'medium'),
    3: mk('cursor-auto', 'auto', 3, 'high'),
    4: mk('cursor-frontier', 'frontier', 4, 'high'),
    5: mk('cursor-frontier', 'frontier', 5, 'max'),
  },
  other: {
    1: mk('mcp-small', 'small', 1, 'low'),
    2: mk('mcp-medium', 'medium', 2, 'medium'),
    3: mk('mcp-medium', 'medium', 3, 'high'),
    4: mk('mcp-large', 'large', 4, 'high'),
    5: mk('mcp-large', 'large', 5, 'max'),
  },
};

export function clampDifficulty(d: number): Difficulty {
  const r = Math.round(Number.isFinite(d) ? d : 3);
  return Math.min(5, Math.max(1, r)) as Difficulty;
}

export function configForDifficulty(provider: Provider, difficulty: number): AgentConfig {
  return { ...MODEL_TABLE[provider][clampDifficulty(difficulty)] };
}

/** Short model label for bubbles: 'claude-opus-5-5' -> 'opus', 'codex-max' stays. */
export function shortModel(cfg: AgentConfig): string {
  return cfg.model.replace(/^claude-/, '').replace(/(-\d+)+$/, '');
}

/** Map any config onto the nearest model of `provider` (used for manualConfig on the other provider). */
export function adaptConfig(provider: Provider, cfg: AgentConfig): AgentConfig {
  const mi = modelInfo(cfg.model) ?? modelInfo(cfg.tier);
  if (mi && mi.provider === provider) return { ...cfg };
  const cap = mi ? mi.capability : 2.5;
  let best: ModelInfo | null = null;
  for (const m of MODEL_LIST) if (m.provider === provider && (!best || Math.abs(m.capability - cap) < Math.abs(best.capability - cap))) best = m;
  return { ...cfg, model: best!.model, tier: best!.tier };
}

/** One step down the provider's price ladder, with half the subagents (used when over budget). */
export function downshift(cfg: AgentConfig, provider: Provider): AgentConfig {
  const mi = modelInfo(cfg.model) ?? modelInfo(cfg.tier);
  const ladder = MODEL_LIST.filter((m) => m.provider === provider).sort((a, b) => a.rank - b.rank);
  const idx = mi ? Math.max(0, ladder.findIndex((m) => m.model === mi.model)) : 0;
  const lower = ladder[Math.max(0, idx - 1)];
  return { ...cfg, model: lower.model, tier: lower.tier, subagents: Math.floor(cfg.subagents / 2) };
}

// ---- performance model shared by sim + estimates ----
export const EFFORT_SPEED: Record<AgentConfig['effort'], number> = { low: 1.15, medium: 1, high: 0.92, max: 0.85 };
const EFFORT_CAP: Record<AgentConfig['effort'], number> = { low: 0, medium: 0, high: 0.5, max: 1 };

/** Base implementation time for a ticket, sim seconds (25 at difficulty 1 .. 140 at 5). */
export function workBaseSeconds(d: number): number { return 25 + (Math.min(5, Math.max(1, d)) - 1) * 28.75; }
export function reviewBaseSeconds(d: number): number { return 4 + (Math.min(5, Math.max(1, d)) - 1) * 5; }
/** Context fill added over a whole ticket pass (can exceed 1 => compactions). */
export function fillTotal(d: number): number { return 0.25 + 0.25 * d; }

/** More subagents help more on hard tickets, with diminishing returns. */
export function subagentFactor(n: number, d: number): number {
  return 1 + 0.2 * Math.sqrt(Math.max(0, n)) * (0.3 + 0.7 * (d - 1) / 4);
}

/** How well a config fits a ticket: deficit>0 means under-powered (slower, more rejections). */
export function fitDeficit(cfg: AgentConfig, d: number): number {
  const mi = modelInfo(cfg.model) ?? modelInfo(cfg.tier);
  const cap = (mi ? mi.capability : 2.5) + EFFORT_CAP[cfg.effort];
  return Math.max(0, d - cap);
}
export function speedOf(cfg: AgentConfig, d: number, activeSubs: number): number {
  const mi = modelInfo(cfg.model) ?? modelInfo(cfg.tier);
  return (mi ? mi.speed : 1) * EFFORT_SPEED[cfg.effort] * subagentFactor(activeSubs, d) / (1 + 0.35 * fitDeficit(cfg, d));
}
