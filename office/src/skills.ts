/**
 * Shared skill catalog (sim, scene and ui all import this). A "skill" is a packaged set of instructions/tools
 * an agent loads for a ticket (Claude Code skills / Codex AGENTS.md snippets in the real system).
 * They live on the shelves of the Skill Library (STATIONS.library); agents walk there, pick up the skill "cartridges
 * / books" a ticket needs and carry them to their desk. Colours are used for the cartridges, chips and spines.
 */
export type SkillCategory = 'frontend' | 'backend' | 'testing' | 'devops' | 'security' | 'data' | 'docs' | 'quality';

export interface Skill {
  id: string;
  name: string;           // short display name
  blurb: string;          // one line description
  category: SkillCategory;
  color: string;          // hex used for cartridge/spine/chip
  glyph: string;          // 1-2 char pixel-icon label for chips ('UI', 'DB', '</>' ...)
  /** If set, using this skill needs a vault secret/capability (ties into 'blocked: missing key' flow). */
  needsSecret?: string;
  /** True for skills a human added at runtime. */
  custom?: boolean;
  /** Rough one-time input-token cost of loading the skill into context. */
  loadTokens: number;
}

export const SKILLS: Skill[] = [
  { id: 'react-ui',      name: 'React UI',        blurb: 'Components, state, accessibility',        category: 'frontend', color: '#38bdf8', glyph: 'UI', loadTokens: 3200 },
  { id: 'css-pixel',     name: 'Pixel CSS',       blurb: 'Layout, theming, responsive polish',      category: 'frontend', color: '#818cf8', glyph: 'CS', loadTokens: 1800 },
  { id: 'api-design',    name: 'API Design',      blurb: 'REST/RPC contracts, validation',          category: 'backend',  color: '#34d399', glyph: 'AP', loadTokens: 2600 },
  { id: 'db-migrations', name: 'DB Migrations',   blurb: 'Schemas, migrations, indexes',            category: 'data',     color: '#a3e635', glyph: 'DB', loadTokens: 2400 },
  { id: 'auth',          name: 'Auth & Sessions', blurb: 'Login, tokens, permissions',              category: 'security', color: '#f472b6', glyph: 'AU', loadTokens: 3000 },
  { id: 'payments',      name: 'Payments',        blurb: 'Checkout, webhooks, refunds',             category: 'backend',  color: '#fbbf24', glyph: '$$', needsSecret: 'STRIPE_TEST_KEY', loadTokens: 3600 },
  { id: 'playwright',    name: 'Browser Testing', blurb: 'Playwright flows, screenshots, a11y',     category: 'testing',  color: '#fb923c', glyph: 'PW', loadTokens: 2800 },
  { id: 'unit-tests',    name: 'Unit Tests',      blurb: 'Fast tests, fixtures, mocks',             category: 'testing',  color: '#facc15', glyph: 'UT', loadTokens: 1500 },
  { id: 'ci-cd',         name: 'CI / Deploy',     blurb: 'Pipelines, previews, rollbacks',          category: 'devops',   color: '#94a3b8', glyph: 'CI', needsSecret: 'DEPLOY_TOKEN', loadTokens: 2200 },
  { id: 'security',      name: 'Security Review', blurb: 'Secrets, injection, dependency risk',     category: 'security', color: '#ef4444', glyph: 'SC', loadTokens: 2900 },
  { id: 'perf',          name: 'Perf Profiling',  blurb: 'Profiles, caching, bundle size',          category: 'quality',  color: '#22d3ee', glyph: 'PF', loadTokens: 2000 },
  { id: 'refactor',      name: 'Refactoring',     blurb: 'Safe restructuring, codemods',            category: 'quality',  color: '#c084fc', glyph: 'RF', loadTokens: 1700 },
  { id: 'docs',          name: 'Docs Writer',     blurb: 'READMEs, ADRs, changelogs',               category: 'docs',     color: '#e2e8f0', glyph: 'DC', loadTokens: 1200 },
];

export const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

/** Max skills an agent keeps equipped at once (least-recently-used is swapped out at the library). */
export const SKILL_SLOTS = 4;

/** Distinct, readable colours per owner (humans who contributed agents). Index by owner order. */
export const OWNER_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#e879f9', '#eab308', '#14b8a6', '#f43f5e', '#a78bfa'];
