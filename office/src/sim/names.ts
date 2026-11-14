/** Flavour data: agent names, owners, epics (with ticket titles and the skills they relate to), reasons. */

export const WORKER_NAMES = ['Pixel', 'Marlow', 'Juniper', 'Bolt', 'Sable', 'Quill', 'Echo', 'Rune', 'Nova', 'Cinder', 'Tango', 'Wren'];
export const ORCH_NAME = 'Atlas';
export const INTEG_NAME = 'Warden';
/** Human contributors. Order defines OWNER_COLORS index. Orchestrator = first, integrator = second. */
export const OWNERS = ['maya', 'dev', 'sol', 'noor', 'kai'];

export interface TitleDef { t: string; s: string[] }
export interface EpicDef { name: string; items: TitleDef[] }

export const EPIC_POOL: EpicDef[] = [
  { name: 'Billing', items: [
    { t: 'Stripe checkout webhook', s: ['payments', 'api-design'] },
    { t: 'Proration on plan changes', s: ['payments', 'db-migrations'] },
    { t: 'Invoice PDF export', s: ['api-design', 'docs'] },
    { t: 'Retry failed card charges', s: ['payments', 'unit-tests'] },
    { t: 'Refund flow for annual plans', s: ['payments', 'react-ui'] },
    { t: 'Fix VAT rounding on invoices', s: ['unit-tests'] },
  ] },
  { name: 'Auth', items: [
    { t: 'Rotate refresh tokens', s: ['auth', 'security'] },
    { t: 'Passkey login', s: ['auth', 'react-ui'] },
    { t: 'Fix SSO redirect loop', s: ['auth', 'playwright'] },
    { t: 'Rate-limit login attempts', s: ['auth', 'api-design'] },
    { t: 'Audit log for admin roles', s: ['auth', 'db-migrations'] },
    { t: 'Session expiry banner', s: ['react-ui', 'css-pixel'] },
  ] },
  { name: 'Onboarding', items: [
    { t: 'Welcome checklist UI', s: ['react-ui', 'css-pixel'] },
    { t: 'Invite teammates flow', s: ['react-ui', 'api-design'] },
    { t: 'Empty-state illustrations', s: ['css-pixel'] },
    { t: 'Onboarding e2e tests', s: ['playwright', 'unit-tests'] },
    { t: 'Import data from CSV', s: ['api-design', 'db-migrations'] },
    { t: 'Setup guide docs', s: ['docs'] },
  ] },
  { name: 'Search', items: [
    { t: 'Faceted search filters', s: ['react-ui', 'api-design'] },
    { t: 'Index rebuild job', s: ['db-migrations', 'perf'] },
    { t: 'Typeahead latency', s: ['perf', 'react-ui'] },
    { t: 'Relevance tuning', s: ['perf', 'refactor'] },
    { t: 'Search API pagination', s: ['api-design', 'unit-tests'] },
    { t: 'Highlight matched terms', s: ['css-pixel', 'react-ui'] },
  ] },
  { name: 'Platform', items: [
    { t: 'Preview deploys per PR', s: ['ci-cd', 'docs'] },
    { t: 'Rollback automation', s: ['ci-cd', 'security'] },
    { t: 'Dependency audit sweep', s: ['security', 'refactor'] },
    { t: 'Cut cold-start time', s: ['perf', 'ci-cd'] },
    { t: 'Migrate to new ORM', s: ['db-migrations', 'refactor'] },
    { t: 'Flaky test quarantine', s: ['unit-tests', 'ci-cd'] },
  ] },
  { name: 'Mobile', items: [
    { t: 'Responsive nav rewrite', s: ['css-pixel', 'react-ui'] },
    { t: 'Offline mode cache', s: ['perf', 'api-design'] },
    { t: 'Touch gesture polish', s: ['react-ui', 'css-pixel'] },
    { t: 'Mobile e2e suite', s: ['playwright'] },
    { t: 'Push notification prefs', s: ['api-design', 'db-migrations'] },
  ] },
];

export const SPRINT_THEMES = ['revamp', 'overhaul', 'push', 'polish', 'hardening', 'sweep', 'glow-up', 'speedrun'];

export const EXTRA_SKILLS = ['unit-tests', 'security', 'docs', 'refactor', 'perf', 'playwright'];

export interface Reason { text: string; vault: boolean }
export const BLOCK_REASONS: Reason[] = [
  { text: 'flaky CI - rerun needed', vault: false },
  { text: 'need staging creds (vault)', vault: true },
  { text: 'migration lock held', vault: false },
  { text: 'missing API key (vault)', vault: true },
  { text: 'spec is ambiguous', vault: false },
];
export const WAIT_REASONS = ['waiting on CI', 'API quota - backing off', 'rate limited, retrying', 'waiting on review bot', 'tests running...'];
export const REJECT_REASONS = ['missing tests', 'breaks lint', 'unclear naming', 'edge case unhandled', 'diff too large', 'flaky test added', 'leaks a secret'];

export const HELP_QUESTIONS = [
  'How should I wire {skill} for "{title}"?',
  'Any gotchas with {skill} on "{title}"?',
  'Stuck on "{title}" - who has done {skill} before?',
  'What is the cleanest way to test {skill} here?',
  'Can you sanity-check my {skill} approach for "{title}"?',
];
export const HELP_ANSWERS = [
  'Reuse the existing helper in lib/ and add a test.',
  'Mock the client first, then wire the real one.',
  'Split it: types first, UI second.',
  'The fixture in /tests already covers that.',
  'Wrap it in the retry helper; it flakes under load.',
  'Keep state in one place and derive the rest.',
];
export const SECRET_ANSWERS = [
  'grant approved - key is in the vault now',
  'approved: scoped test key added to the vault',
  'secret granted for this task only',
];
