/**
 * ILLUSTRATIVE price table - PLACEHOLDER ESTIMATES, not real prices. Edit freely.
 * USD per million tokens. Real pricing differs by plan/date; this only has to make the relative trade-offs visible
 * (haiku < sonnet < opus < fable; codex-mini < codex < codex-max; and so on for each tool's ladder).
 */
import type { AgentConfig, Usage } from '../types';
import { fillTotal, modelInfo, reviewBaseSeconds, speedOf, subagentFactor, tierInfo, workBaseSeconds, EFFORT_SPEED } from './difficulty';
import { configForDifficulty } from './difficulty';
import { PROVIDER_IDS, mixShares, type FleetMix } from '../providers';

export interface Price { input: number; output: number; cacheRead: number }

export const PRICE_TABLE: Record<string, Price> = {
  // by tier label
  haiku:    { input: 1,    output: 5,   cacheRead: 0.1 },
  sonnet:   { input: 3,    output: 15,  cacheRead: 0.3 },
  opus:     { input: 5,    output: 25,  cacheRead: 0.5 },
  fable:    { input: 12,   output: 60,  cacheRead: 1.2 },
  mini:     { input: 0.4,  output: 1.6, cacheRead: 0.04 },
  standard: { input: 2,    output: 10,  cacheRead: 0.2 },
  max:      { input: 10,   output: 40,  cacheRead: 1 },
  // GitHub Copilot, Gemini CLI, Cursor and other MCP tools: placeholder ladders too
  base:     { input: 0.5,  output: 2,   cacheRead: 0.05 },
  premium:  { input: 3,    output: 15,  cacheRead: 0.3 },
  flash:    { input: 0.3,  output: 2.5, cacheRead: 0.03 },
  pro:      { input: 2.5,  output: 15,  cacheRead: 0.25 },
  deep:     { input: 8,    output: 40,  cacheRead: 0.8 },
  auto:     { input: 1,    output: 5,   cacheRead: 0.1 },
  frontier: { input: 5,    output: 25,  cacheRead: 0.5 },
  small:    { input: 0.5,  output: 2,   cacheRead: 0.05 },
  medium:   { input: 2,    output: 10,  cacheRead: 0.2 },
  large:    { input: 6,    output: 30,  cacheRead: 0.6 },
};
const FALLBACK: Price = PRICE_TABLE.sonnet;

/** Price for a model id or a tier label. */
export function priceFor(modelOrTier: string): Price {
  const mi = modelInfo(modelOrTier);
  return PRICE_TABLE[mi ? mi.tier : modelOrTier] ?? FALLBACK;
}

export function costOf(p: Price, input: number, output: number, cacheRead: number): number {
  return (input * p.input + output * p.output + cacheRead * p.cacheRead) / 1e6;
}

export function emptyUsage(): Usage { return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsd: 0 }; }

// ---- token model (per sim-second while an agent is actively working) ----
/** Global knob: scales all token rates (tuned so the default seed's 24-ticket scope costs ~100 USD; per-sprint cost across seeds ~40-115, mean ~75). */
export const COST_SCALE = 0.9;
export const CONTEXT_WINDOW = 200_000;
const EFFORT_OUT: Record<AgentConfig['effort'], number> = { low: 0.6, medium: 1, high: 1.5, max: 2.2 };

export interface Rates { input: number; output: number; cacheRead: number }
const _r: Rates = { input: 0, output: 0, cacheRead: 0 };
/** Tokens per sim-second. Returns a shared scratch object (copy if you keep it). */
export function tokenRates(effort: AgentConfig['effort'], fill: number, subagent = false): Rates {
  const f = subagent ? 0.3 : fill;
  const k = (subagent ? 0.7 : 1) * COST_SCALE;
  _r.output = 45 * EFFORT_OUT[effort] * k;
  _r.input = 150 * (0.4 + f) * k;
  _r.cacheRead = (CONTEXT_WINDOW * f / 3) * k;   // the whole context is re-read from cache every ~3 s
  return _r;
}

/** Cost of one compaction (summarisation burst) at the given fill. */
export function compactionTokens(fill: number): { input: number; output: number; cacheRead: number } {
  return { input: 0, output: 3500, cacheRead: CONTEXT_WINDOW * fill };
}

/**
 * Orchestrator's up-front estimate for a ticket: expected tokens for the pass the config would run, plus expected
 * rework, review and skill loading. Actuals usually land within about -30%..+60% of this.
 */
export function estimateTicketCost(difficulty: number, cfg: AgentConfig, rejectRate = 0.25): number {
  const d = Math.min(5, Math.max(1, difficulty));
  const price = priceFor(cfg.model);
  const dur = workBaseSeconds(d) / speedOf(cfg, d, cfg.subagents * 0.6);
  const thr = Math.max(0.45, 1 - cfg.autocompactBuffer / 100);
  const ft = fillTotal(d);
  const avgFill = Math.min(0.85, (0.1 + Math.min(thr, 0.1 + ft)) / 2 + (ft > thr ? 0.1 : 0));
  const r = tokenRates(cfg.effort, avgFill);
  const main = dur * costOf(price, r.input, r.output, r.cacheRead);
  const s = tokenRates(cfg.effort, 0.3, true);
  const subs = dur * cfg.subagents * 0.6 * costOf(price, s.input, s.output, s.cacheRead);
  const nComp = ft > thr - 0.05 ? Math.max(0, (ft - (thr - 0.05)) / Math.max(0.1, thr - 0.35)) : 0;
  const ct = compactionTokens(thr);
  const comp = nComp * costOf(price, ct.input, ct.output, ct.cacheRead);
  const skill = costOf(price, 2 * 2500, 0, 0);
  const iprice = priceFor('claude-sonnet-5-5');
  const ir = tokenRates('high', 0.4);
  const review = reviewBaseSeconds(d) * 1.5 * costOf(iprice, ir.input, ir.output, ir.cacheRead);
  const rej = Math.min(0.9, rejectRate * (0.6 + 0.2 * (d - 1)));
  return 1.2 * ((main + subs + comp) * (1 + rej * 0.55) + skill + review * (1 + rej));   // 1.2 = calibration (jitter, waits, spawn ramps)
}

/** Blended estimate over the fleet mix (the orchestrator doesn't know which tool will pick the ticket up). */
export function estimateForDifficulty(difficulty: number, mix: Partial<FleetMix>, rejectRate: number): number {
  const shares = mixShares(mix);
  let sum = 0;
  for (const id of PROVIDER_IDS) if (shares[id] > 0) sum += shares[id] * estimateTicketCost(difficulty, configForDifficulty(id, difficulty), rejectRate);
  return sum;
}

export { tierInfo, subagentFactor, EFFORT_SPEED };
