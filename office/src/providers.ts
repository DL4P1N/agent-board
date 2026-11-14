/**
 * PROVIDER REGISTRY - every coding-agent tool the room knows about, in one place.
 * Matches the tools the real board supports (Claude Code, Codex, GitHub Copilot, Gemini CLI, Cursor, any MCP tool).
 * The sim, the UI (colours, labels, model pickers, cost breakdowns) and the 3D scene all read from here, so adding
 * a tool means adding one entry here plus its models in sim/difficulty.ts and prices in sim/pricing.ts.
 * Colours are just distinct accents for this UI, not anyone's branding.
 */

export const PROVIDER_IDS = ['claude', 'codex', 'copilot', 'gemini', 'cursor', 'other'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export interface ProviderInfo {
  id: ProviderId;
  /** Full tool name, e.g. 'Claude Code'. */
  name: string;
  /** Short label for tight spots, e.g. 'Claude'. */
  short: string;
  /** UI accent (CSS). */
  color: string;
  /** 3D accents: main / dark / light / glow (hex ints). */
  accent: { main: number; dark: number; light: number; glow: number };
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  claude: { id: 'claude', name: 'Claude Code', short: 'Claude', color: '#d97757', accent: { main: 0xd97757, dark: 0xa4522f, light: 0xf6d2c0, glow: 0xff9d78 } },
  codex: { id: 'codex', name: 'Codex', short: 'Codex', color: '#2dd4bf', accent: { main: 0x2dd4bf, dark: 0x16897b, light: 0xc0f6ee, glow: 0x7dfff0 } },
  copilot: { id: 'copilot', name: 'GitHub Copilot', short: 'Copilot', color: '#a78bfa', accent: { main: 0xa78bfa, dark: 0x6d4fc7, light: 0xe2d8ff, glow: 0xc9b6ff } },
  gemini: { id: 'gemini', name: 'Gemini CLI', short: 'Gemini', color: '#60a5fa', accent: { main: 0x60a5fa, dark: 0x2f6bc4, light: 0xd3e6ff, glow: 0x9cc8ff } },
  cursor: { id: 'cursor', name: 'Cursor', short: 'Cursor', color: '#facc15', accent: { main: 0xfacc15, dark: 0xb08a06, light: 0xfff1b0, glow: 0xffe36b } },
  other: { id: 'other', name: 'Other MCP tool', short: 'Other', color: '#94a3b8', accent: { main: 0x94a3b8, dark: 0x5b6577, light: 0xe2e8f0, glow: 0xcbd5e1 } },
};

export const isProvider = (v: unknown): v is ProviderId => typeof v === 'string' && (PROVIDER_IDS as readonly string[]).includes(v);
export const providerInfo = (id: string | null | undefined): ProviderInfo => (isProvider(id) ? PROVIDERS[id] : PROVIDERS.other);
export const providerName = (id: string | null | undefined): string => providerInfo(id).name;
/** A Record with a value for every provider. */
export function perProvider<T>(fill: (id: ProviderId) => T): Record<ProviderId, T> {
  return Object.fromEntries(PROVIDER_IDS.map((id) => [id, fill(id)])) as Record<ProviderId, T>;
}

/** Fleet mix: relative weight per tool (0 = none). Normalised when agents are assigned. */
export type FleetMix = Record<ProviderId, number>;
export const DEFAULT_MIX: FleetMix = { claude: 3, codex: 2, copilot: 0, gemini: 0, cursor: 0, other: 0 };

/** Weights -> shares that sum to 1 (all-zero falls back to Claude Code only). */
export function mixShares(mix: Partial<FleetMix>): Record<ProviderId, number> {
  const total = PROVIDER_IDS.reduce((s, id) => s + Math.max(0, mix[id] ?? 0), 0);
  return perProvider((id) => (total > 0 ? Math.max(0, mix[id] ?? 0) / total : id === 'claude' ? 1 : 0));
}

/** Which tool sits at a cubicle. Stable per desk: changing one weight only flips the nearest agents. */
export function providerForRank(rank: number, mix: Partial<FleetMix>): ProviderId {
  const shares = mixShares(mix);
  let acc = 0;
  for (const id of PROVIDER_IDS) { acc += shares[id]; if (rank < acc - 1e-9) return id; }
  return [...PROVIDER_IDS].reverse().find((id) => shares[id] > 0) ?? 'claude';
}
/** The desk rank used by providerForRank (golden-ratio spacing). */
export const deskRank = (deskIndex: number): number => ((deskIndex + 1) * 0.6180339887498949) % 1;

/** How many of `n` agents each tool gets with this mix (same rule the sim uses). */
export function fleetCounts(n: number, mix: Partial<FleetMix>): Record<ProviderId, number> {
  const out = perProvider(() => 0);
  for (let i = 0; i < n; i++) out[providerForRank(deskRank(i), mix)]++;
  return out;
}

/** Injects .pdot/.tier/.prov/.who/.cm.agent colour rules for every provider, so CSS never lists tools by hand. */
export function installProviderCss(): void {
  if (typeof document === 'undefined' || document.getElementById('provider-css')) return;
  const rules = PROVIDER_IDS.map((id) => {
    const c = `var(--p-${id})`;
    return `.pdot.${id}{background:${c}}.tier.${id}{border-color:${c};color:${c}}.prov.${id}{color:${c}}.who.${id}{color:${c}}.cm.agent.${id}{--prov:${c}}`;
  }).join('\n');
  const vars = `:root{${PROVIDER_IDS.map((id) => `--p-${id}:${PROVIDERS[id].color}`).join(';')}}`;
  const el = document.createElement('style');
  el.id = 'provider-css';
  el.textContent = `${vars}\n${rules}`;
  document.head.appendChild(el);
}
