/**
 * Deterministic, rule-based stand-in for the LLM that parses chat messages for the Orchestrator (or any agent).
 * Pure: no DOM, no three.js, no Math.random, no Date. `parseChat` never throws.
 */
import type { AgentState, ChatContext, Difficulty, Intent, ParsedChat, Ticket, TicketSpec } from '../types';
import type { Skill, SkillCategory } from '../skills';

export const CHAT_HELP: { cmd: string; example: string; blurb: string }[] = [
  { cmd: '/task', example: '/task Login page d3 skills: auth, react-ui for pixel !high', blurb: 'File a task (difficulty, skills, pin to an agent, priority)' },
  { cmd: 'add task', example: 'add a task for the stripe webhook handler, hard, needs payments', blurb: 'Natural language works too; difficulty and skills are inferred' },
  { cmd: 'cancel', example: 'cancel T-4', blurb: 'Drop a task by id or by title' },
  { cmd: 'make harder', example: 'make T-3 harder', blurb: 'Re-rate a task (or "T-3 is easy", "difficulty 4 for T-3")' },
  { cmd: 'prioritize', example: 'prioritize T-5', blurb: 'Bump a task to the front of the queue (or "deprioritize T-5")' },
  { cmd: 'pin', example: 'give T-5 to Pixel', blurb: 'Pin a task to one agent (or "unpin T-5")' },
  { cmd: '/skill add', example: '/skill add Rust (orange, needs key RUST_TOKEN)', blurb: 'Add a skill to the library' },
  { cmd: 'equip', example: 'give Pixel the payments skill', blurb: 'Equip a skill on an agent' },
  { cmd: 'unequip', example: 'take auth away from Marlow', blurb: 'Remove a skill from an agent' },
  { cmd: 'remove skill', example: 'remove skill docs', blurb: 'Delete a skill from the library' },
  { cmd: 'deadline', example: 'deadline 30 min', blurb: 'Set, extend ("extend deadline by 10 minutes") or report time left' },
  { cmd: 'cut scope', example: 'cut scope by 3', blurb: 'Descope the lowest-priority tasks' },
  { cmd: 'speed', example: 'speed 4x', blurb: 'Change sim speed; "pause" and "resume" too' },
  { cmd: '/brief', example: '/brief Foodie Map: a map app where friends rate street food with photos', blurb: 'Start a new project and replan' },
  { cmd: 'tell', example: 'tell Marlow to focus on the API', blurb: 'Relay a message to an agent by paper plane' },
  { cmd: 'ask help', example: 'ask Pixel to help Marlow with auth', blurb: 'Send a help request between two agents' },
  { cmd: 'status', example: 'are we going to make it?', blurb: 'Status, ETA, blockers, cost, what is left, demo readiness' },
];

export const CHAT_SUGGESTIONS: string[] = [
  'status',
  'are we going to make it?',
  'who is blocked?',
  'add a task for dark mode, easy, css',
  'extend deadline by 10 minutes',
  'cut scope by 2',
  'tell Marlow to focus on the API',
  'speed 4x',
];

// ============================================================================ utils
let SEED = 0;
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function pick<T>(arr: T[], salt = 0): T { return arr[(SEED + salt * 7919) % arr.length]; }
function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 3) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const clampD = (n: number): Difficulty => Math.max(1, Math.min(5, Math.round(n))) as Difficulty;
const money = (n: number): string => `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
const num = (n: number): number => (Number.isFinite(n) ? n : 0);
const uniq = <T,>(a: T[]): T[] => a.filter((v, i) => a.indexOf(v) === i);
const short = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1).trimEnd() + '...' : s);
const capFirst = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);
const joinNames = (xs: string[]): string => (xs.length <= 1 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

const STOP = new Set(('the a an and or but if then than so to of in on at by for from with without into onto over under about as is are was were be been being am do does did done have has had having it its this that these those ' +
  'i me my we us our you your he she they them their what whats when where which who whom whose why how can could would should will shall may might must not no yes ok okay please pls plz just also still very really ' +
  'now here there some any all each every more most less much many few one two three out up down off again run able table bold when then team everyone everybody ticket tickets task tasks card cards issue need needs ' +
  'want make get got let lets add create file new open give take put set change tell ask have show list move work working').split(/\s+/));

const TITLE_STOP = new Set(('cancel drop kill scrap abort ditch delete remove prioritize prioritise deprioritize deprioritise bump escalate expedite pin unpin assign unassign give hand route harder easier difficulty ' +
  'first last asap urgent top priority rate rerate re-rate easy medium hard epic trivial ticket tickets task tasks card cards status progress doing going how where what whats').split(/\s+/));

interface Tok { w: string; i: number; e: number }
function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  const re = /@?[\p{L}\p{N}][\p{L}\p{N}_'’-]*/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push({ w: m[0].toLowerCase().replace(/['’]s$/, ''), i: m.index, e: m.index + m[0].length });
  return out;
}

// ============================================================================ context helpers
function workersOf(ctx: ChatContext): AgentState[] { return (ctx.agents ?? []).filter((a) => a.role === 'worker'); }
function orchName(ctx: ChatContext): string { return (ctx.agents ?? []).find((a) => a.role === 'orchestrator')?.name ?? 'Atlas'; }
function workerNames(ctx: ChatContext): string {
  const w = workersOf(ctx);
  return w.length ? w.map((a) => a.name).join(', ') : 'none connected';
}
function ticketOf(ctx: ChatContext, id: string | null): Ticket | undefined { return id ? (ctx.tickets ?? []).find((t) => t.id === id) : undefined; }
function agentById(ctx: ChatContext, id: string | null): AgentState | undefined { return id ? (ctx.agents ?? []).find((a) => a.id === id) : undefined; }
function nameOf(ctx: ChatContext, id: string | null): string { return agentById(ctx, id)?.name ?? (id ?? 'someone'); }
function remainingMinutes(ctx: ChatContext): number {
  const t = num(ctx.time);
  if (ctx.hack?.active) return Math.max(0, (num(ctx.hack.endsAt) - t) / 60);
  return Math.max(0, num(ctx.plan?.deadlineMinutes) - t / 60);
}
function totalScope(ctx: ChatContext): number {
  const p = num(ctx.plan?.totalTickets);
  if (p > 0) return p;
  return (ctx.tickets ?? []).filter((t) => t.status !== 'cancelled').length;
}
function maxPriority(ctx: ChatContext): number { return Math.max(0, ...(ctx.tickets ?? []).map((t) => num(t.priority))); }
function minPriority(ctx: ChatContext): number { return Math.min(0, ...(ctx.tickets ?? []).map((t) => num(t.priority))); }

// ============================================================================ agent resolution
function agentScore(w: string, a: AgentState): number {
  const n = a.name.toLowerCase();
  if (w === n || w === a.id.toLowerCase()) return 4;
  if (w.length >= 3 && !STOP.has(w) && n.startsWith(w)) return 3;
  if (n.length >= 4 && w.length > n.length && w.length <= n.length + 2 && w.startsWith(n)) return 3;
  if (w.length >= 4 && n.length >= 4 && !STOP.has(w)) {
    const d = lev(w, n);
    if (d <= 1 || (d <= 2 && n.length >= 6 && w.length >= 6)) return 2;
  }
  return 0;
}
interface AgentHit { agent: AgentState; i: number; e: number }
function findAgents(text: string, ctx: ChatContext, workersOnly = true): AgentHit[] {
  const pool = workersOnly ? workersOf(ctx) : (ctx.agents ?? []);
  const hits: AgentHit[] = [];
  for (const tk of tokenize(text)) {
    const w = tk.w.replace(/^@/, '');
    if (!w || /^t-?\d+$/.test(w)) continue;
    let best = 0; let bestAgents: AgentState[] = [];
    for (const a of pool) {
      const s = agentScore(w, a);
      if (s > best) { best = s; bestAgents = [a]; } else if (s === best && s > 0) bestAgents.push(a);
    }
    if (best > 0 && bestAgents.length === 1 && !hits.some((h) => h.agent.id === bestAgents[0].id)) hits.push({ agent: bestAgents[0], i: tk.i, e: tk.e });
  }
  return hits;
}
function resolveAgentWord(w: string, ctx: ChatContext): AgentState | undefined { return findAgents(w, ctx, true)[0]?.agent; }

// ============================================================================ ticket resolution
function findTicketRefs(s: string): { nums: number[]; spans: [number, number][] } {
  const nums: number[] = []; const spans: [number, number][] = [];
  const add = (n: number, a: number, b: number): void => { if (!nums.includes(n)) nums.push(n); spans.push([a, b]); };
  const r1 = /\btickets?\s*#?\s*(\d{1,4}(?:\s*(?:,|and|&|\/|\+)\s*#?\d{1,4})*)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = r1.exec(s))) { for (const x of m[1].match(/\d+/g) ?? []) add(Number(x), m.index, m.index + m[0].length); }
  const r2 = /(?:\bt-?|#)(\d{1,4})\b/gi;
  while ((m = r2.exec(s))) {
    const idx = m.index;
    if (spans.some(([a, b]) => idx >= a && idx < b)) continue;
    add(Number(m[1]), idx, idx + m[0].length);
  }
  return { nums, spans };
}
function stripRefs(s: string): string {
  const { spans } = findTicketRefs(s);
  let out = s;
  for (const [a, b] of [...spans].sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + ' REF ' + out.slice(b);
  return out;
}
function titleTokens(s: string): string[] { return (s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((w) => !STOP.has(w)); }
function findTicketByTitle(text: string, ctx: ChatContext, excl: Set<string>): { ticket: Ticket | null; ambiguous: boolean } {
  const toks = tokenize(text).map((t) => t.w).filter((w) => w.length >= 3 && !STOP.has(w) && !TITLE_STOP.has(w) && !excl.has(w) && !/^@?t-?\d+$/.test(w) && w !== 'ref');
  if (!toks.length) return { ticket: null, ambiguous: false };
  let best = 0; let bestLen = 0; let bestT: Ticket[] = [];
  for (const t of ctx.tickets ?? []) {
    if (t.status === 'cancelled') continue;
    const tt = titleTokens(t.title);
    let score = 0; let maxLen = 0;
    for (const w of toks) {
      const hit = tt.some((x) => x === w || (w.length >= 4 && x.length >= 4 && (x.startsWith(w) || w.startsWith(x))) || (w.length >= 5 && x.length >= 5 && lev(w, x) <= 1));
      if (hit) { score++; maxLen = Math.max(maxLen, w.length); }
    }
    if (score > best || (score === best && score > 0 && t.status !== 'merged' && bestT[0]?.status === 'merged')) { best = score; bestLen = maxLen; bestT = [t]; }
    else if (score === best && score > 0) bestT.push(t);
  }
  if (best === 0 || !(best >= 2 || bestLen >= 5)) return { ticket: null, ambiguous: false };
  if (bestT.length > 1) return { ticket: null, ambiguous: true };
  return { ticket: bestT[0], ambiguous: false };
}

// ============================================================================ skill resolution
const SKILL_RULES: [string, RegExp][] = [
  ['react-ui', /\b(ui|ux|react|components?|pages?|screens?|forms?|buttons?|modals?|dashboards?|views?|frontend|front-end|navbar|menus?|sidebar|toggle)\b/i],
  ['css-pixel', /\b(css|styles?|styling|layout|themes?|dark mode|light mode|responsive|pixel|design|animations?|polish|colou?rs?|fonts?)\b/i],
  ['api-design', /\b(api|apis|endpoints?|rest|rpc|graphql|webhooks?|backend|routes?|validation)\b/i],
  ['db-migrations', /\b(database|db|schemas?|migrations?|sql|postgres|tables?|indexes|index|models?)\b/i],
  ['auth', /\b(auth|login|log in|logout|signin|sign in|signup|sign up|sessions?|oauth|sso|passwords?|tokens?|permissions?|2fa|passkeys?)\b/i],
  ['payments', /\b(pay|payments?|checkout|stripe|billing|invoices?|subscriptions?|refunds?|cart)\b/i],
  ['playwright', /\b(e2e|playwright|browser tests?|end-to-end|screenshots?)\b/i],
  ['unit-tests', /\b(tests?|testing|unit|coverage|mocks?|fixtures?)\b/i],
  ['ci-cd', /\b(ci|cd|deploy|deploys|deployment|pipelines?|releases?|rollback|docker|previews?|hosting)\b/i],
  ['security', /\b(security|secure|secrets?|xss|csrf|injection|vuln\w*|audit|encrypt\w*|sanitize)\b/i],
  ['perf', /\b(perf|performance|slow|speed|fast|latency|cache|caching|bundle|lag|optimi[sz]e)\b/i],
  ['refactor', /\b(refactor|cleanup|clean up|restructure|rename|codemod|tech debt)\b/i],
  ['docs', /\b(readme|docs?|documentation|changelog|adr|guide|tutorial)\b/i],
];
function inferSkills(text: string, ctx: ChatContext): string[] {
  const have = new Set((ctx.skills ?? []).map((s) => s.id));
  const scored: { id: string; score: number; idx: number }[] = [];
  const ruleIds = new Set(SKILL_RULES.map((r) => r[0]));
  SKILL_RULES.forEach(([id, re], idx) => {
    if (!have.has(id)) return;
    const m = text.match(new RegExp(re.source, 'gi'));
    if (m) scored.push({ id, score: m.length, idx });
  });
  const lc = text.toLowerCase();
  (ctx.skills ?? []).forEach((s, idx) => {
    if (ruleIds.has(s.id) && !s.custom) return;
    const words = (`${s.name} ${s.id}`.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((w) => !STOP.has(w));
    if (words.some((w) => lc.includes(w)) || lc.includes(norm(s.name))) scored.push({ id: s.id, score: 5, idx: 100 + idx });
  });
  return scored.sort((a, b) => b.score - a.score || a.idx - b.idx).map((x) => x.id).slice(0, 3);
}
function resolveSkill(phrase: string, skills: Skill[], loose = false): Skill | null {
  const n = norm(phrase);
  if (!n) return null;
  for (const s of skills) if (n === norm(s.id) || n === norm(s.name) || n === s.glyph.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')) return s;
  const wordsN = phrase.trim().split(/\s+/).length;
  if (wordsN <= 2) {
    for (const [id, re] of SKILL_RULES) {
      const s = skills.find((x) => x.id === id);
      if (s && new RegExp(`^(?:${re.source})$`, 'i').test(phrase.trim().toLowerCase())) return s;
    }
  }
  if (n.length >= 3) {
    const pre = skills.filter((s) => norm(s.id).startsWith(n) || norm(s.name).startsWith(n) || s.name.toLowerCase().split(/\s+/).some((w) => norm(w).startsWith(n) && n.length >= 4));
    if (pre.length >= 1 && (pre.length === 1 || loose)) return pre[0];
  }
  if (n.length >= (loose ? 4 : 5)) {
    const lim = n.length >= 7 ? 2 : 1;
    let best: Skill | null = null; let bd = 9;
    for (const s of skills) {
      const cands = [norm(s.id), norm(s.name), ...s.name.split(/\s+/).map(norm).filter((w) => w.length >= 4)];
      for (const c of cands) { const d = lev(n, c); if (d <= lim && d < bd) { bd = d; best = s; } }
    }
    if (best) return best;
  }
  return null;
}
interface SkillHit { skill: Skill; i: number; e: number }
function findSkillMentions(text: string, ctx: ChatContext, skip: Set<number> = new Set()): SkillHit[] {
  const toks = tokenize(text).filter((t) => !/^@?t-?\d+$/.test(t.w));
  const out: SkillHit[] = [];
  const used = new Set<number>();
  for (let i = 0; i < toks.length; i++) {
    if (used.has(i) || skip.has(toks[i].i)) continue;
    for (let n = 3; n >= 1; n--) {
      if (i + n > toks.length) continue;
      const slice = toks.slice(i, i + n);
      if (slice.some((t, k) => used.has(i + k) || skip.has(t.i))) continue;
      if (n === 1 && STOP.has(slice[0].w)) continue;
      const phrase = slice.map((t) => t.w).join(' ');
      const s = resolveSkill(phrase, ctx.skills ?? [], false);
      if (s) { out.push({ skill: s, i: slice[0].i, e: slice[n - 1].e }); for (let k = 0; k < n; k++) used.add(i + k); break; }
    }
  }
  return out.filter((h, i, a) => a.findIndex((x) => x.skill.id === h.skill.id) === i);
}
function parseSkillList(text: string, ctx: ChatContext): { ids: string[]; all: boolean } {
  const raw = text.split(/[\s,&+/]+/).map((x) => x.trim()).filter((x) => x && !/^(and|or|plus|the|skill|skills|a|an|also)$/i.test(x));
  const ids: string[] = []; let all = raw.length > 0;
  for (let i = 0; i < raw.length;) {
    let hit: Skill | null = null; let used = 1;
    for (let n = Math.min(3, raw.length - i); n >= 1; n--) {
      const s = resolveSkill(raw.slice(i, i + n).join(' '), ctx.skills ?? [], true);
      if (s) { hit = s; used = n; break; }
    }
    if (hit) { ids.push(hit.id); i += used; } else { all = false; i++; }
  }
  return { ids: uniq(ids), all };
}

// ============================================================================ numbers & time
const NUMW: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60 };
function numWord(s: string): number | null {
  const l = s.toLowerCase();
  if (/^\d+(\.\d+)?$/.test(l)) return Number(l);
  return NUMW[l] ?? null;
}
function parseMinutes(s: string): number | null {
  const l = stripRefs(s).toLowerCase();
  if (/\bhalf an? hour\b/.test(l)) return 30;
  if (/\b(?:an|one) hour and a half\b/.test(l)) return 90;
  const re = /(\d+(?:\.\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|fifty|sixty)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/;
  const m = re.exec(l);
  if (m) {
    const v = numWord(m[1]);
    if (v !== null) return Math.round(/^h/.test(m[2]) ? v * 60 : v);
  }
  const b = /(?<![\w#-])(\d+(?:\.\d+)?)(?![\w.])/.exec(l);
  return b ? Math.round(Number(b[1])) : null;
}

// ============================================================================ result type
type Kind = 'empty' | 'help' | 'greet' | 'thanks' | 'bye' | 'chit' | 'status' | 'create' | 'cancel' | 'difficulty' | 'prioritize' | 'pin' | 'skill_add' | 'skill_remove' | 'equip' | 'unequip' |
  'deadline' | 'cut' | 'speed' | 'brief' | 'message' | 'help_ask' | 'directive' | 'clarify' | 'unknown';
type StatusSub = 'generic' | 'eta' | 'blocked' | 'cost' | 'left' | 'demo' | 'agent' | 'ticket';
interface Res { kind: Kind; intents: Intent[]; reply: string; sub?: StatusSub; agent?: AgentState; ticket?: Ticket; text?: string }
const ORCH_KINDS = new Set<Kind>(['create', 'cancel', 'difficulty', 'prioritize', 'pin', 'skill_add', 'skill_remove', 'equip', 'unequip', 'deadline', 'cut', 'speed', 'brief']);
const clarify = (reply: string): Res => ({ kind: 'clarify', intents: [], reply });

// ============================================================================ ticket creation
const DIFFWORD = /^(?:and\s+)?(?:it'?s\s+|make it\s+|mark(?:ed)?\s+(?:as\s+)?|rated\s+|difficulty\s+)?(easy|medium|med|hard|epic|trivial|tiny|simple|difficult)(?:\s+(?:ticket|task|one))?$/i;
function diffFromWord(w: string): Difficulty {
  switch (w.toLowerCase()) {
    case 'trivial': case 'tiny': return 1;
    case 'easy': case 'simple': return 2;
    case 'medium': case 'med': return 3;
    case 'hard': case 'difficult': return 4;
    case 'epic': return 5;
    default: return 3;
  }
}
function inferDifficulty(title: string, nSkills: number, ctx: ChatContext): Difficulty {
  const l = title.toLowerCase();
  const base = clampD(Math.max(2, Math.min(4, Math.round(num(ctx.settings?.meanDifficulty) || 3))));
  if (/\b(typo|copy ?edit|favicon|label|wording)\b/.test(l)) return 1;
  if (/\b(rewrite|architecture|platform|from scratch|multiplayer|end-to-end|entire|full[- ]stack)\b/.test(l)) return 5;
  if (/\b(payments?|stripe|auth|oauth|sso|realtime|real-time|websockets?|migrations?|ai|llm|sync|encryption|billing|checkout|queue|permissions?|search)\b/.test(l)) return 4;
  if (/\b(readme|docs?|tooltips?|icons?|logo|spacing|padding|colou?rs?|text|rename|button|dark mode|theme)\b/.test(l)) return 2;
  return clampD(base + (nSkills >= 3 ? 1 : 0));
}
function tidyTitle(s: string): string {
  let t = s.replace(/\s+/g, ' ').replace(/^[\s:,\-–—.]+|[\s,;:.\-–—!?]+$/g, '');
  t = t.replace(/^(?:the|a|an|some|new)\s+/i, '').replace(/\s+(?:please|pls|thanks|thx)$/i, '');
  t = t.replace(/^(?:for|about)\s+(?:the\s+)?/i, '').trim().slice(0, 80).trim();
  return capFirst(t);
}
interface ItemRes { spec: TicketSpec; pin?: AgentState; prio?: 'high' | 'low' }
function parseItem(raw: string, preDiff: Difficulty | undefined, ctx: ChatContext): ItemRes | null {
  let s = raw.trim();
  const st: { prio?: 'high' | 'low'; diff?: Difficulty; pin?: AgentState } = { diff: preDiff };
  s = s.replace(/(^|\s)!(high|hi|urgent|top|p0|p1|asap)\b/gi, () => { st.prio = 'high'; return ' '; });
  s = s.replace(/(^|\s)!(low|lo|later|p3|p4)\b/gi, () => { st.prio = 'low'; return ' '; });
  s = s.replace(/\b(asap|urgent(?:ly)?)\b/gi, () => { st.prio = 'high'; return ' '; });
  s = s.replace(/[()[\]]/g, ',');
  s = s.replace(/\b(?:d([1-5])|difficulty\s*[:=]?\s*([1-5]))\b/gi, (_m: string, a?: string, b?: string) => { st.diff = Number(a ?? b) as Difficulty; return ' '; });
  s = s.replace(/(?:^|[\s,])@([\p{L}][\p{L}\p{N}_-]*)/gu, (m: string, w: string) => {
    const a = resolveAgentWord(w, ctx);
    if (a && !st.pin) { st.pin = a; return ' '; }
    return m;
  });
  s = s.replace(/(?:^|[\s,])(?:for|assign(?:ed)?\s+to|give\s+to)\s+([\p{L}][\p{L}\p{N}_-]*)(?=\s*(?:,|;|\.|$)|\s+(?:needs?|requires?|skills?|with|using)\b)/giu, (m: string, w: string) => {
    const a = resolveAgentWord(w, ctx);
    if (a && !st.pin) { st.pin = a; return ' '; }
    return m;
  });
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  const title: string[] = []; const skills: string[] = []; let lastSkills = false;
  for (const p of parts) {
    const dm = DIFFWORD.exec(p);
    if (dm) { if (!st.diff) st.diff = diffFromWord(dm[1]); lastSkills = false; continue; }
    const sm = /^(?:and\s+)?(?:needs?|requires?|skills?|with(?:\s+skills?)?|using|w\/)\s*[:=]?\s*(.+)$/i.exec(p);
    if (sm) { const r = parseSkillList(sm[1], ctx); if (r.ids.length) { skills.push(...r.ids); lastSkills = true; continue; } }
    if (lastSkills) { const r = parseSkillList(p, ctx); if (r.ids.length && r.all) { skills.push(...r.ids); continue; } }
    const im = /\s(skills?|needs?|requires?)\b\s*[:=]?\s*(\S.*)$/i.exec(p);
    if (im && im.index > 0) {
      const r = parseSkillList(im[2], ctx);
      if (r.ids.length) { title.push(p.slice(0, im.index)); skills.push(...r.ids); lastSkills = true; continue; }
    }
    const tm = /^(.*\S)\s+(easy|medium|hard|epic|trivial)$/i.exec(p);
    if (tm && !st.diff && tm[1].split(/\s+/).length >= 2) { st.diff = diffFromWord(tm[2]); title.push(tm[1]); lastSkills = false; continue; }
    title.push(p); lastSkills = false;
  }
  const tt = tidyTitle(title.join(', '));
  if (!tt || !/[\p{L}\p{N}]/u.test(tt)) return null;
  const ids = uniq(skills).slice(0, 4);
  const finalSkills = ids.length ? ids : inferSkills(tt, ctx);
  const spec: TicketSpec = {
    title: tt,
    description: `Requested in chat: ${short(raw.trim().replace(/\s+/g, ' '), 160)}`,
    difficulty: st.diff ?? inferDifficulty(tt, finalSkills.length, ctx),
    skills: finalSkills,
  };
  if (st.pin) spec.pinnedTo = st.pin.id;
  return { spec, pin: st.pin, prio: st.prio };
}
function isModifierPart(p: string, prevSkills: boolean, ctx: ChatContext): boolean {
  const q = p.trim();
  if (DIFFWORD.test(q) || /^(?:and\s+)?(?:needs?|requires?|skills?|with|using)\b/i.test(q) || /^for\s+@?[\p{L}][\p{L}\p{N}_-]*$/iu.test(q) || /^!\w+/.test(q) || /^d[1-5]$/i.test(q)) return true;
  if (prevSkills) { const r = parseSkillList(q, ctx); return r.ids.length > 0 && r.all; }
  return false;
}
function splitItems(body: string, plural: boolean, ctx: ChatContext): string[] {
  let parts = body.split(/\r?\n|;|\s\|\s/).map((x) => x.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean);
  if (parts.length === 1 && plural && parts[0].includes(',')) {
    const groups: string[] = []; let prevSkills = false;
    for (const p of parts[0].split(',').map((x) => x.trim()).filter(Boolean)) {
      if (groups.length && isModifierPart(p, prevSkills, ctx)) groups[groups.length - 1] += ', ' + p;
      else groups.push(p);
      prevSkills = /^(?:and\s+)?(?:needs?|requires?|skills?|with|using)\b/i.test(p) || (prevSkills && isModifierPart(p, true, ctx));
    }
    parts = groups;
  }
  return parts;
}
function handleCreate(body: string, preDiff: Difficulty | undefined, plural: boolean, ctx: ChatContext): Res {
  const raw = splitItems(body.trim(), plural, ctx);
  const capped = raw.length > 8;
  const items = raw.slice(0, 8).map((x) => parseItem(x, preDiff, ctx)).filter((x): x is ItemRes => !!x);
  if (!items.length) return clarify(`What should the task say? Try: ${CHAT_HELP[0].example}`);
  const hi = maxPriority(ctx); const lo = minPriority(ctx);
  const intents: Intent[] = items.map((it) => {
    if (it.prio === 'high') it.spec.priority = hi + 1;
    else if (it.prio === 'low') it.spec.priority = lo - 1;
    return { type: 'create_ticket', spec: it.spec };
  });
  const fmt = (it: ItemRes): string => `"${it.spec.title}" (d${it.spec.difficulty}${it.spec.skills?.length ? ', ' + it.spec.skills.join(' + ') : ''})`;
  let reply: string;
  if (items.length === 1) {
    const it = items[0];
    const tail = (it.prio === 'high' ? ' Bumped to the front of the queue.' : it.prio === 'low' ? ' Parked at the back of the queue.' : '');
    if (it.pin) reply = pick([`Filed ${fmt(it)} and pinned it to ${it.pin.name}.`, `On the board for ${it.pin.name}: ${fmt(it)}.`]) + tail;
    else reply = pick([
      `Filed it: ${fmt(it)}. Next pickup goes to whoever is free.`,
      `On the board: ${fmt(it)}. First free hand grabs it.`,
      `Done - ${fmt(it)} is in the backlog.`,
    ]) + tail;
  } else {
    const list = items.slice(0, 5).map(fmt).join(', ') + (items.length > 5 ? `, +${items.length - 5} more` : '');
    reply = `Filed ${items.length} tasks: ${list}. Free hands pick them up in priority order.${capped ? ' Capped at 8 - send the rest separately.' : ''}`;
  }
  return { kind: 'create', intents, reply };
}

// ============================================================================ ticket edits
function handleEdit(t: string, ctx: ChatContext, self: AgentState | null): Res | null {
  const l = t.toLowerCase();
  if (/^(tell|ask)\b/.test(l)) return null;
  const refs = findTicketRefs(t);
  const l2 = stripRefs(l);
  const hasTicketWord = /\b(tickets?|tasks?|cards?)\b/.test(l);
  const agentHits = findAgents(t, ctx, true);

  const unpin = /\b(unpin|unassign|release|unlock)\b/.test(l2);
  const depri = /\b(deprioriti[sz]e|back[- ]?burner|put (?:it |this |that )?(?:at )?(?:the )?(?:back|bottom)|push (?:it |this |that )?back|lowest priority|move down)\b/.test(l2) || /\bREF\s+last\b/i.test(l2);
  const prio = /\b(prioriti[sz]e|bump|escalate|expedite|top priority|move up|asap|urgent|rush)\b/.test(l2) || /\bREF\s+first\b|\b(?:do|ship|build|start)\b.*\bfirst\b/.test(l2);
  const cancel = /\b(cancel|kill|scrap|abort|ditch|nuke|delete|remove|drop|wontfix)\b/.test(l2) || /\b(?:won'?t|will not) do\b/.test(l2);
  const diffKw = /\b(harder|easier|tougher|simpler|re-?rate|difficulty|diff)\b/.test(l2) || /\b(?:is|are|to|=|as|at)\s+(?:d?[1-5]|easy|medium|hard|epic|trivial)\b/.test(l2) || /\bd[1-5]\b/.test(l2) || /\brate\b/.test(l2);
  const pinKw = /\b(pin|assign|give|hand|route|send|let|have|get|take|grab|own)\b/.test(l2) && (agentHits.length > 0 || (!!self && /\b(take|grab|own|pick up)\b/.test(l2)));
  if (!(unpin || depri || prio || cancel || diffKw || pinKw)) return null;

  // targets
  let targets = refs.nums.map((n) => (ctx.tickets ?? []).find((x) => x.id === `T-${n}`)).filter((x): x is Ticket => !!x);
  const missing = refs.nums.filter((n) => !(ctx.tickets ?? []).some((x) => x.id === `T-${n}`));
  if (!refs.nums.length) {
    const excl = new Set<string>(); for (const h of agentHits) for (const w of tokenize(t.slice(h.i, h.e))) excl.add(w.w.replace(/^@/, ''));
    const f = findTicketByTitle(l2, ctx, excl);
    if (f.ticket) targets = [f.ticket];
    else if (f.ambiguous) return clarify('Which task? That matches more than one - give me an id like T-5.');
    else if (hasTicketWord) return clarify(`Which task? Give me an id like ${(ctx.tickets ?? []).find((x) => x.status !== 'merged' && x.status !== 'cancelled')?.id ?? 'T-5'}.`);
    else return null;
  }
  if (!targets.length) return clarify(`I don't see ${missing.map((n) => `T-${n}`).join(', ')} on the board.`);
  targets = targets.slice(0, 8);
  const ids = targets.map((x) => x.id).join(', ');
  const q = (x: Ticket): string => `${x.id} "${short(x.title, 40)}"`;

  if (unpin) {
    return { kind: 'pin', intents: targets.map((x) => ({ type: 'pin_ticket', id: x.id, agentId: null })), reply: `Unpinned ${ids} - any free agent can take ${targets.length > 1 ? 'them' : 'it'} now.` };
  }
  if (depri) {
    const lo = minPriority(ctx);
    return { kind: 'prioritize', intents: targets.map((x, i) => ({ type: 'prioritize', id: x.id, priority: lo - 1 - i })), reply: `Pushed ${ids} to the back of the queue.` };
  }
  if (prio) {
    const hi = maxPriority(ctx);
    const n = targets.length;
    return { kind: 'prioritize', intents: targets.map((x, i) => ({ type: 'prioritize', id: x.id, priority: hi + n - i })), reply: pick([`${ids} jumps the queue - next free agent takes ${n > 1 ? 'them' : 'it'}.`, `Bumped ${ids} to the top of the backlog.`]) };
  }
  if (cancel && !diffKw) {
    const live = targets.filter((x) => x.status !== 'merged' && x.status !== 'cancelled');
    if (!live.length) return clarify(`${ids} is already ${targets[0].status === 'merged' ? 'merged' : 'cancelled'} - nothing to cancel.`);
    const holder = live.map((x) => agentById(ctx, x.assignee)).find((a) => a);
    return { kind: 'cancel', intents: live.map((x) => ({ type: 'cancel_ticket', id: x.id })), reply: `Cancelled ${live.map(q).join(', ')}.${holder ? ` ${holder.name} is off it.` : ''}` };
  }
  if (diffKw) {
    const dn = /\b(?:difficulty|diff|rate|rating|level|d)\s*[:=]?\s*([1-5])\b/.exec(l2) ?? /\b(?:is|are|to|=|as|at)\s+d?([1-5])\b/.exec(l2);
    const dw = /\b(easy|medium|hard|epic|trivial)\b/.exec(l2);
    const harder = /\b(harder|tougher|bigger)\b/.test(l2); const easier = /\b(easier|simpler|smaller)\b/.test(l2);
    const big = /\b(way|much|lot|far)\b/.test(l2) ? 2 : 1;
    const intents: Intent[] = []; const notes: string[] = [];
    for (const x of targets) {
      let d: Difficulty;
      if (dn) d = clampD(Number(dn[1])); else if (dw) d = diffFromWord(dw[1]);
      else if (harder) d = clampD(x.difficulty + big); else if (easier) d = clampD(x.difficulty - big);
      else return clarify('What difficulty? Say d1-d5 or easy / medium / hard / epic.');
      if (d === x.difficulty) { notes.push(`${x.id} is already d${d}`); continue; }
      intents.push({ type: 'set_difficulty', id: x.id, difficulty: d });
      notes.push(`${x.id} d${x.difficulty} -> d${d}`);
    }
    if (!intents.length) return { kind: 'clarify', intents: [], reply: `${notes.join('; ')} - no change.` };
    return { kind: 'difficulty', intents, reply: `Re-rated: ${notes.join('; ')}. The agent re-configures at its next pickup.` };
  }
  // pin
  const agent = agentHits[0]?.agent ?? self ?? undefined;
  if (!agent) return clarify(`Pin ${ids} to who? Workers: ${workerNames(ctx)}.`);
  return { kind: 'pin', intents: targets.map((x) => ({ type: 'pin_ticket', id: x.id, agentId: agent.id })), reply: `Pinned ${ids} to ${agent.name} - only ${agent.name} can claim ${targets.length > 1 ? 'them' : 'it'}.` };
}

// ============================================================================ skills
const COLORS: Record<string, string> = { red: '#ef4444', orange: '#fb923c', yellow: '#facc15', green: '#34d399', lime: '#a3e635', teal: '#14b8a6', cyan: '#22d3ee', blue: '#38bdf8', indigo: '#818cf8', purple: '#c084fc', violet: '#a78bfa', pink: '#f472b6', magenta: '#e879f9', gray: '#94a3b8', grey: '#94a3b8', white: '#e2e8f0', brown: '#b45309' };
const CATEGORIES: SkillCategory[] = ['frontend', 'backend', 'testing', 'devops', 'security', 'data', 'docs', 'quality'];
function handleAddSkill(rest: string, ctx: ChatContext): Res {
  let s = rest.trim();
  if (!s) return clarify('Which skill? e.g. /skill add Rust (orange, needs key RUST_TOKEN)');
  let opts = '';
  s = s.replace(/\(([^)]*)\)/g, (_m: string, g: string) => { opts += ' ' + g; return ' '; });
  let needs: string | undefined;
  const nm = /\bneeds?\s+(?:an?\s+)?(?:(?:vault\s+)?(?:key|secret|token)\s*:?\s*)?([A-Z][A-Z0-9_]{2,})\b/.exec(rest);
  if (nm) needs = nm[1];
  s = s.replace(/[,;]?\s*\bneeds?\s+(?:an?\s+)?(?:(?:vault\s+)?(?:key|secret|token)\s*:?\s*)?(?:[A-Z][A-Z0-9_]{2,})?\b/g, ' ');
  if (!needs && /\bneeds?\s+(?:an?\s+)?(?:api\s+)?(?:key|secret|token)\b/i.test(rest + ' ' + opts)) needs = 'API_KEY';
  const all = `${opts} ${rest}`;
  let color: string | undefined;
  const hex = /#[0-9a-f]{6}\b/i.exec(all);
  if (hex) color = hex[0].toLowerCase();
  else { for (const w of tokenize(opts)) if (COLORS[w.w]) { color = COLORS[w.w]; break; } }
  let glyph: string | undefined;
  const gm = /\bglyph\s*[:=]?\s*([^\s,;)]{1,3})/i.exec(all);
  if (gm) glyph = gm[1].toUpperCase();
  let category: SkillCategory | undefined;
  for (const w of tokenize(opts)) if ((CATEGORIES as string[]).includes(w.w)) { category = w.w as SkillCategory; break; }
  if (!category) { const cm = /\bcategory\s*[:=]?\s*(\w+)/i.exec(all); if (cm && (CATEGORIES as string[]).includes(cm[1].toLowerCase())) category = cm[1].toLowerCase() as SkillCategory; }
  s = s.replace(/\b(?:glyph|category)\s*[:=]?\s*\S+/gi, ' ').replace(/\s+/g, ' ').trim();
  let blurb: string | undefined;
  const bm = /^(.*?)\s*(?:\s[-–—]\s|:\s)\s*(.+)$/.exec(s);
  if (bm) { s = bm[1]; blurb = short(bm[2].trim(), 80); }
  const name = s.replace(/^(?:an?|the|new|custom)\s+/i, '').replace(/\s+skill$/i, '').replace(/[,;.\s]+$/g, '').slice(0, 24).trim();
  if (!name || !/[\p{L}\p{N}]/u.test(name)) return clarify('Which skill? e.g. /skill add Rust (orange, needs key RUST_TOKEN)');
  const exist = (ctx.skills ?? []).find((k) => norm(k.name) === norm(name) || norm(k.id) === norm(name));
  if (exist) return clarify(`${exist.name} is already on the shelves. Equip it with "give Pixel the ${exist.name} skill".`);
  const skill: Partial<Skill> & { name: string } = { name: name[0].toUpperCase() + name.slice(1) };
  if (color) skill.color = color;
  if (glyph) skill.glyph = glyph;
  if (needs) skill.needsSecret = needs;
  if (category) skill.category = category;
  if (blurb) skill.blurb = blurb;
  const bits = [color ? Object.entries(COLORS).find(([, v]) => v === color)?.[0] ?? color : '', category ?? '', needs ? `needs ${needs}` : ''].filter(Boolean);
  return { kind: 'skill_add', intents: [{ type: 'add_skill', skill }], reply: `Added skill "${skill.name}" to the library${bits.length ? ` (${bits.join(', ')})` : ''}. Agents fetch it from the shelves when a task needs it.` };
}
function handleRemoveSkill(t: string, ctx: ChatContext): Res {
  const cleaned = t.replace(/\b(remove|delete|drop|retire|kill|ditch|get rid of|scrap)\b/gi, ' ').replace(/\b(the|skill|skills|library|from|please)\b/gi, ' ');
  const hit = findSkillMentions(cleaned, ctx)[0]?.skill ?? resolveSkill(cleaned.trim(), ctx.skills ?? [], true);
  if (!hit) return clarify(`No skill matching that. On the shelves: ${(ctx.skills ?? []).map((s) => s.id).join(', ')}.`);
  return { kind: 'skill_remove', intents: [{ type: 'remove_skill', id: hit.id }], reply: `Removing ${hit.name} (${hit.id}) from the library - stripped from tasks and agents.` };
}
function handleEquip(t: string, ctx: ChatContext, self: AgentState | null, un: boolean): Res | null {
  const agentHits = findAgents(t, ctx, true);
  const skip = new Set<number>(agentHits.map((h) => h.i));
  const skills = findSkillMentions(t, ctx, skip);
  if (!skills.length) return null;
  const agents = agentHits.length ? agentHits.map((h) => h.agent) : self ? [self] : [];
  if (!agents.length) return clarify(`${un ? 'Take it away from' : 'Give it to'} who? Workers: ${workerNames(ctx)}.`);
  const intents: Intent[] = [];
  for (const a of agents.slice(0, 4)) for (const s of skills.slice(0, 4)) intents.push(un ? { type: 'unequip_skill', agentId: a.id, skillId: s.skill.id } : { type: 'equip_skill', agentId: a.id, skillId: s.skill.id });
  const sn = joinNames(skills.slice(0, 4).map((s) => s.skill.name)); const an = joinNames(agents.slice(0, 4).map((a) => a.name));
  return { kind: un ? 'unequip' : 'equip', intents, reply: un ? `Pulled ${sn} off ${an}.` : pick([`${an} gets ${sn} - equipped straight from the shelf.`, `Equipping ${an} with ${sn}.`]) };
}

// ============================================================================ time & scope
function handleDeadline(t: string, ctx: ChatContext): Res {
  const l = t.toLowerCase();
  const n = parseMinutes(l);
  if (n === null || n <= 0) return clarify('How many minutes? Try "deadline 30 min" or "extend deadline by 10 minutes".');
  const rem = remainingMinutes(ctx);
  const extend = /\b(extend|extra|push (?:the )?(?:deadline )?(?:out|back)|add|more|another|bump|give us)\b/.test(l);
  const shorten = !extend && /\b(shorten|reduce|pull in|move up|sooner|earlier|cut (?:the )?deadline|less|tighten)\b/.test(l);
  const minutes = Math.max(1, Math.min(600, Math.round(extend ? rem + n : shorten ? rem - n : n)));
  const reply = extend ? `Deadline extended by ${n} min: ${minutes} min from now (was ${Math.round(rem)}). Replanning scope to fit.`
    : shorten ? `Deadline pulled in by ${n} min: ${minutes} min from now (was ${Math.round(rem)}). I'll flag scope that no longer fits.`
    : `Deadline set: ${minutes} min from now (was ${Math.round(rem)}). ${minutes < rem ? 'Tight - say the word and I cut scope.' : 'Replanning around it.'}`;
  return { kind: 'deadline', intents: [{ type: 'set_deadline', minutes }], reply };
}
function handleCut(t: string, ctx: ChatContext): Res | null {
  const l = t.toLowerCase();
  let count: number | null = null;
  let m = /\b(?:cut|drop|descope|de-scope|trim|ditch|shave)\s+(?:the\s+)?(?:scope|polish|nice[- ]to[- ]haves?|stretch|extras?|fluff|features?)\b(?:\s+by\s+(\d+|a|one|two|three|four|five))?/.exec(l);
  if (m) count = m[1] ? numWord(m[1]) ?? 2 : 2;
  if (!m) {
    m = /\b(?:cut|drop|descope|ditch|trim|shave|kill)\s+(?:(?:off|another|at least)\s+)?(\d+|a|one|two|three|four|five|six)\s+(?:more\s+|low[- ]priority\s+|extra\s+)?(?:tickets?|items?|tasks?|cards?)\b/.exec(l);
    if (m) count = numWord(m[1]) ?? 2;
  }
  if (!m && /\b(?:descope|de-scope|reduce scope|shrink (?:the )?scope|cut scope)\b/.test(l)) { const b = /\bby\s+(\d+|one|two|three|four|five)\b/.exec(l); count = b ? numWord(b[1]) ?? 2 : 2; m = [''] as unknown as RegExpExecArray; }
  if (!m || count === null) return null;
  const c = Math.max(1, Math.min(20, Math.round(count)));
  const left = Math.max(0, totalScope(ctx) - c);
  return { kind: 'cut', intents: [{ type: 'cut_scope', count: c }], reply: pick([`Cutting ${c} from the bottom of the backlog, lowest priority first. Scope drops to ${left} tasks.`, `Descoping ${c} task${c > 1 ? 's' : ''} - lowest priority goes first. New scope: ${left}.`]) };
}
function handleSpeed(t: string): Res | null {
  const l = t.toLowerCase().trim();
  if (/^\/?(?:pause|freeze|halt)\b/.test(l) || /\b(?:pause (?:the )?(?:sim|simulation|clock|everything|it)|freeze (?:the )?(?:sim|clock)|stop the clock|hold everything)\b/.test(l)) return { kind: 'speed', intents: [{ type: 'set_speed', value: 0 }], reply: 'Pausing the clock. Say "resume" when ready.' };
  if (/^\/?(?:resume|unpause|unfreeze|play)\b/.test(l) || /\b(?:resume (?:the )?(?:sim|simulation|clock)?|unpause)\b/.test(l)) return { kind: 'speed', intents: [{ type: 'set_speed', value: 1 }], reply: 'Back to 1x. Clock is running.' };
  let v: number | null = null;
  let m = /\bspeed(?:\s*up)?(?:\s*to)?\s*(?:x\s*)?(\d+(?:\.\d+)?)\s*x?\b/.exec(l);
  if (m) v = Number(m[1]);
  if (v === null) { m = /\b(\d+(?:\.\d+)?)\s*x\b/.exec(l); if (m && /\b(speed|sim|run|go|play|clock|fast)\b|^\d/.test(l)) v = Number(m[1]); }
  if (v === null && /\b(fast[- ]forward|ff)\b/.test(l)) v = 4;
  if (v === null && /\b(max speed|turbo|full speed|as fast as)\b/.test(l)) v = 8;
  if (v === null && /\bspeed (?:it )?up\b/.test(l)) v = 2;
  if (v === null && /\bslow(?:\s+it)?\s+down\b/.test(l)) v = 0.5;
  if (v === null && /\b(?:normal|real[- ]?time) speed\b|\bback to normal\b/.test(l)) v = 1;
  if (v === null) return null;
  const value = Math.max(0, Math.min(8, v));
  return { kind: 'speed', intents: [{ type: 'set_speed', value }], reply: value === 0 ? 'Pausing the clock.' : `Sim speed ${value}x.` };
}
const GENERIC_NAME_WORDS = new Set(['a', 'an', 'the', 'realtime', 'real-time', 'simple', 'new', 'little', 'small', 'cool', 'fun']);
function handleBrief(rest: string, ctx: ChatContext): Res {
  const s = rest.trim().replace(/^[:\-–—\s]+/, '');
  if (!s) return clarify('What are we building? Try: /brief Foodie Map: a map app where friends rate street food with photos');
  let project = ''; let brief = '';
  const m = /^(.{1,40}?)\s*(?::|\s[-–—]\s)\s*(.+)$/s.exec(s);
  if (m && m[1].trim().split(/\s+/).length <= 5) { project = m[1].trim(); brief = m[2].trim(); }
  else {
    brief = s;
    const words = s.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter((w) => w && !GENERIC_NAME_WORDS.has(w.toLowerCase()) && !STOP.has(w.toLowerCase()));
    project = words.slice(0, 2).map(capFirst).join(' ') || 'New Project';
  }
  project = project.replace(/^["']|["']$/g, '').slice(0, 40);
  void ctx;
  return { kind: 'brief', intents: [{ type: 'set_brief', project, brief: brief.slice(0, 600) }], reply: `New project: "${project}". Replanning the board - tasks land over the next minute, scope sized to the deadline.` };
}

// ============================================================================ agents
function pickHelper(needy: AgentState, ctx: ChatContext): AgentState | undefined {
  const nt = ticketOf(ctx, needy.ticketId);
  let best: AgentState | undefined; let bs = -1;
  for (const a of workersOf(ctx)) {
    if (a.id === needy.id || a.phase === 'offline' || a.phase === 'blocked') continue;
    let s = 0;
    if (a.phase === 'idle') s += 4;
    if (a.phase === 'waiting' || a.phase === 'awaiting_review') s += 2;
    if (nt) s += 2 * (a.skills ?? []).filter((x) => nt.skills.includes(x)).length;
    if (s > bs) { bs = s; best = a; }
  }
  return best;
}
function handleMessage(t: string, ctx: ChatContext, self: AgentState | null): Res | null {
  const l = t.toLowerCase();
  const workers = workersOf(ctx);
  const needHelp = /\b(?:needs?|wants?|could use)\s+(?:a\s+|some\s+)?(?:hand|help)\b|\b(?:is|looks|seems)\s+stuck\b|^\s*unblock\b/.test(l);
  const helpVerb = /\b(help|assist|pair|unblock|support|back up|jump in)\b/.test(l);
  const verbM = /^(?:please\s+)?(tell|ask|have|get|let|message|ping|notify|dm|remind|warn|nudge)\b\s*(.*)$/is.exec(t);
  const hits = findAgents(t, ctx, true);

  // ask_help
  if (verbM && helpVerb && hits.length >= 1 && /^(ask|tell|have|get)$/i.test(verbM[1])) {
    let helper: AgentState | undefined; let needy: AgentState | undefined;
    if (hits.length >= 2) {
      if (/\bto\s+ask\b/i.test(l)) { needy = hits[0].agent; helper = hits[1].agent; } else { helper = hits[0].agent; needy = hits[1].agent; }
    } else if (self && self.id !== hits[0].agent.id) { helper = hits[0].agent; needy = self; }
    if (!helper || !needy) return clarify(`Help whom? Name both: "ask Pixel to help Marlow with auth". Workers: ${workerNames(ctx)}.`);
    const tm = /\b(?:with|on|about|for)\s+(.+?)\s*[.!?]*$/i.exec(t.slice(hits[hits.length - 1].e));
    const nt = ticketOf(ctx, needy.ticketId);
    const topic = tm ? tm[1] : nt ? nt.title : '';
    const question = topic ? `Need a hand with ${short(topic, 60)}` : 'Need a hand - can you pair on this?';
    return { kind: 'help_ask', intents: [{ type: 'ask_help', fromAgentId: needy.id, toAgentId: helper.id, question }], reply: `Asking ${helper.name} to help ${needy.name}${topic ? ` with ${short(topic, 50)}` : ''} - help plane on the way.` };
  }
  if (needHelp && hits.length >= 1) {
    const needy = hits[0].agent;
    const helper = hits.length > 1 ? hits[1].agent : pickHelper(needy, ctx);
    if (!helper) return clarify(`Nobody is free to help ${needy.name} right now.`);
    const nt = ticketOf(ctx, needy.ticketId);
    const tm = /\b(?:with|on)\s+(.+?)\s*[.!?]*$/i.exec(t);
    const topic = tm ? tm[1] : nt ? nt.title : '';
    return { kind: 'help_ask', intents: [{ type: 'ask_help', fromAgentId: needy.id, toAgentId: helper.id, question: topic ? `Need a hand with ${short(topic, 60)}` : 'Need a hand - can you pair on this?' }], reply: `Sending ${helper.name} to help ${needy.name}${topic ? ` with ${short(topic, 50)}` : ''}.` };
  }

  // message_agent
  let targets: AgentState[] = []; let body = '';
  if (verbM && !/^(?:me|us|him|her|them)\b/i.test(verbM[2])) {
    const toks = tokenize(verbM[2]);
    const everyone = /^(everyone|everybody|all|team|the team|folks|y'all|guys)\b/i.test(verbM[2].trim());
    if (everyone) {
      targets = workers.filter((a) => a.phase !== 'offline').slice(0, 6);
      body = verbM[2].replace(/^(?:everyone|everybody|all|the team|team|folks|y'all|guys)\b\s*/i, '');
    } else {
      let k = 0; let endIdx = 0;
      while (k < toks.length) {
        const w = toks[k].w.replace(/^@/, '');
        if (w === 'and' || w === '&') { k++; continue; }
        const h = findAgents(w, ctx, true)[0];
        if (!h) break;
        if (!targets.some((x) => x.id === h.agent.id)) targets.push(h.agent);
        endIdx = toks[k].e; k++;
      }
      if (!targets.length) {
        const first = toks[0]?.w.replace(/^@/, '') ?? '';
        const cand = (toks[0] && !STOP.has(first) && first !== 'atlas' && /^@/.test(toks[0].w) ? first : '') || (toks[0] && !STOP.has(first) && first.length >= 3 && toks.length >= 3 && /^(ask|tell|message|ping|dm|notify|nudge)$/i.test(verbM[1]) ? first : '');
        if (cand) return clarify(`Which agent? I don't see "${cand}". Workers: ${workerNames(ctx)}.`);
        return null;
      }
      body = verbM[2].slice(endIdx);
    }
  } else {
    const lead = /^\s*@?([\p{L}][\p{L}\p{N}_-]*)\s*[:,]\s*(.+)$/su.exec(t);
    if (lead) {
      const a = (/^@/.test(t.trim()) || true) ? resolveAgentWord(lead[1], ctx) : undefined;
      if (a && a.id !== self?.id) { targets = [a]; body = lead[2]; }
    }
    const at = /^\s*@([\p{L}][\p{L}\p{N}_-]*)\s+(.+)$/su.exec(t);
    if (!targets.length && at) { const a = resolveAgentWord(at[1], ctx); if (a && a.id !== self?.id) { targets = [a]; body = at[2]; } }
  }
  if (!targets.length) return null;
  body = body.replace(/^[\s:,\-]+/, '').replace(/^(?:to|that)\s+/i, '').trim();
  if (!body) return clarify(`What should I tell ${joinNames(targets.map((a) => a.name))}?`);
  const isAsk = verbM && /^ask$/i.test(verbM[1]);
  let text = capFirst(short(body.replace(/\s+/g, ' '), 140));
  if (isAsk && !/[?.!]$/.test(text)) text += '?'; else if (!/[?.!]$/.test(text)) text += '.';
  return { kind: 'message', intents: targets.map((a) => ({ type: 'message_agent', agentId: a.id, text })), reply: `Relaying to ${joinNames(targets.map((a) => a.name))}: "${short(text, 70)}" Paper plane on the way.` };
}

// ============================================================================ status
const PHASE_TEXT: Partial<Record<AgentState['phase'], string>> = {
  working: 'working on', reworking: 'reworking', waiting: 'parked on', blocked: 'blocked on', awaiting_review: 'waiting on review for', submitting: 'submitting',
  asking_help: 'stuck on', awaiting_help: 'stuck on', helping: 'working on', celebrating: 'just merged', to_desk: 'carrying', to_depot: 'fetching a task for', picking_up: 'picking up', to_library: 'fetching skills for', picking_skills: 'fetching skills for',
};
function agentStatus(a: AgentState, ctx: ChatContext, self: boolean): string {
  const t = ticketOf(ctx, a.ticketId);
  const subj = self ? 'I' : a.name;
  const be = self ? "I'm" : `${a.name} is`;
  if (a.phase === 'offline') return self ? "I'm offline right now." : `${a.name} is offline.`;
  const parts: string[] = [];
  if (!t) {
    parts.push(self ? `Idle at my desk - no task on me, ${a.stats?.merged ?? 0} merged so far.` : `${a.name} is idle with no task (${a.stats?.merged ?? 0} merged so far).`);
  } else {
    const verb = PHASE_TEXT[a.phase] ?? 'on';
    const pct = Math.round(num(t.progress) * 100);
    const cfg = a.config ? `${a.config.tier}, ${a.config.subagents} subagent${a.config.subagents === 1 ? '' : 's'}` : '';
    const head = self ? (a.phase === 'working' ? 'Still on' : capFirst(verb)) : `${a.name} is ${verb}`;
    parts.push(`${head} ${t.id} "${short(t.title, 40)}", about ${pct}%${cfg ? ` - ${cfg}` : ''}.`);
  }
  if (a.waitingOn) parts.push(self ? `Waiting on ${nameOf(ctx, a.waitingOn)} - sent a help request.` : `Waiting on ${nameOf(ctx, a.waitingOn)} for help.`);
  if (a.helping) parts.push(self ? `Also helping ${nameOf(ctx, a.helping)} right now.` : `Also helping ${nameOf(ctx, a.helping)}.`);
  if (a.phase === 'blocked' && !a.waitingOn) parts.push(self ? 'I need a hand - missing a key or a decision.' : `${be} stuck and could use a hand.`);
  if (num(a.contextFill) > 0.8) parts.push(`${subj === 'I' ? 'My' : a.name + "'s"} context is ${Math.round(a.contextFill * 100)}% full.`);
  return parts.join(' ');
}
function verdict(ctx: ChatContext): { eta: number | null; rem: number; over: number; label: string; cutN: number } {
  const rem = remainingMinutes(ctx);
  const eta = ctx.metrics?.etaMinutes ?? null;
  if (eta === null || !Number.isFinite(eta)) return { eta: null, rem, over: 0, label: '', cutN: 0 };
  const over = eta - rem;
  const open = Math.max(1, num(ctx.metrics?.open) + num(ctx.metrics?.inReview));
  const per = Math.max(0.1, eta / open);
  const label = over <= 0 ? 'on track' : over <= rem * 0.15 ? 'tight' : 'behind';
  return { eta, rem, over, label, cutN: over > 0 ? Math.max(1, Math.min(open, Math.ceil(over / per))) : 0 };
}
function blockedList(ctx: ChatContext): string[] {
  return workersOf(ctx).filter((a) => a.phase === 'blocked' || a.pose === 'blocked' || a.waitingOn).map((a) => {
    const t = a.ticketId ? ` on ${a.ticketId}` : '';
    const w = a.waitingOn ? `, waiting on ${nameOf(ctx, a.waitingOn)}` : '';
    return `${a.name}${a.phase === 'blocked' || a.pose === 'blocked' ? ' is blocked' : ' is waiting'}${t}${w}`;
  });
}
function statusReply(sub: StatusSub, ctx: ChatContext, agent?: AgentState, ticket?: Ticket): string {
  const m = ctx.metrics; const total = totalScope(ctx); const merged = num(m?.merged);
  const pct = total ? Math.round((merged / total) * 100) : 0;
  const v = verdict(ctx);
  const budget = num(ctx.settings?.budgetUsd);
  const spend = `${money(num(m?.totalCostUsd))}${budget > 0 ? ` of ${money(budget)} (${Math.round(num(m?.budgetUsedPct))}%)` : ' (no budget cap)'}`;
  const etaLine = v.eta === null ? `No ETA yet - throughput is still warming up, ${Math.round(v.rem)} min left.`
    : v.over <= 0 ? `ETA ${Math.round(v.eta)} min vs ${Math.round(v.rem)} left - on track.`
    : `ETA ${Math.round(v.eta)} min vs ${Math.round(v.rem)} left - ${v.label}, ${Math.round(v.over)} min over; cut about ${v.cutN} or extend.`;
  switch (sub) {
    case 'agent': return agent ? agentStatus(agent, ctx, false) : 'Which agent? ' + workerNames(ctx);
    case 'ticket': {
      if (!ticket) return 'Which task?';
      const who = ticket.assignee ? ` with ${nameOf(ctx, ticket.assignee)}` : ticket.pinnedTo ? ` pinned to ${nameOf(ctx, ticket.pinnedTo)}` : '';
      return `${ticket.id} "${short(ticket.title, 45)}" is ${ticket.status.replace('_', ' ')}${who}, ${Math.round(num(ticket.progress) * 100)}% done, d${ticket.difficulty}, ${ticket.reworks} rework${ticket.reworks === 1 ? '' : 's'}, est ${money(num(ticket.estimatedCostUsd))}.`;
    }
    case 'eta': return `${merged}/${total} merged with ${Math.round(v.rem)} min left. ${etaLine}${v.over > 0 ? ` Say "cut scope by ${v.cutN}" to get slack.` : ''}`;
    case 'blocked': {
      const b = blockedList(ctx);
      const busy = workersOf(ctx).filter((a) => a.phase === 'working' || a.phase === 'reworking').length;
      return b.length ? `${b.join('; ')}. ${num(m?.helpOpen)} help request${num(m?.helpOpen) === 1 ? '' : 's'} open.` : `Nobody is blocked right now - ${busy} of ${workersOf(ctx).length} workers heads-down.`;
    }
    case 'cost': return `Spend so far ${spend}, burning ${money(num(m?.burnUsdPerMin))}/min. ${merged ? `${money(num(m?.avgCostPerMergedUsd))} per merged task, ` : ''}${money(num(m?.wasteUsd))} wasted on rejects; forecast to finish scope ${money(num(m?.projectedScopeCostUsd))}.`;
    case 'left': {
      const next = (ctx.tickets ?? []).filter((t) => t.status === 'backlog').sort((a, b) => num(b.priority) - num(a.priority)).slice(0, 3).map((t) => `${t.id} "${short(t.title, 28)}"`);
      return `${merged}/${total} merged, ${num(m?.open)} open, ${num(m?.inReview)} in review.${next.length ? ` Next up: ${next.join(', ')}.` : ''} ${Math.round(v.rem)} min on the clock.`;
    }
    case 'demo': {
      const h = ctx.hack;
      if (!h?.active) return `Not in hackathon mode - ${merged}/${total} merged, ${Math.round(v.rem)} min left.`;
      const missing = (h.checklist ?? []).filter((c) => !c.done).map((c) => c.label);
      return `Demo readiness ${Math.round(num(h.demoReadiness) * 100)}% (${merged}/${total} merged). Deploy: ${h.deployStatus}${h.deployUrl ? ` at ${h.deployUrl}` : ''}. Checklist ${(h.checklist ?? []).length - missing.length}/${(h.checklist ?? []).length}${missing.length ? `, missing: ${missing.slice(0, 3).join(', ')}` : ''}.`;
    }
    default: {
      const b = blockedList(ctx);
      const open = pick(['Status:', 'Sitrep:', "Here's where we are:", 'Quick check:']);
      return `${open} ${merged}/${total} merged (${pct}%), ${num(m?.open)} open, ${num(m?.inReview)} in review. ${etaLine} ${b.length ? b.slice(0, 2).join('; ') + '.' : 'Nobody blocked.'} Spend ${spend}${ctx.hack?.active ? `; demo readiness ${Math.round(num(ctx.hack.demoReadiness) * 100)}%, deploy ${ctx.hack.deployStatus}` : ''}.`;
    }
  }
}
function detectStatus(t: string, ctx: ChatContext, self: AgentState | null): Res | null {
  const l = t.toLowerCase().trim();
  const q = /\?\s*$/.test(l);
  const refs = findTicketRefs(t);
  const mk = (sub: StatusSub, agent?: AgentState, ticket?: Ticket): Res => ({ kind: 'status', sub, agent, ticket, intents: [{ type: 'status' }], reply: statusReply(sub, ctx, agent, ticket) });
  if (refs.nums.length && /\b(status|how|where|progress|who|what|doing|going|eta|state)\b/.test(l)) {
    const tk = (ctx.tickets ?? []).find((x) => x.id === `T-${refs.nums[0]}`);
    return tk ? mk('ticket', undefined, tk) : clarify(`I don't see T-${refs.nums[0]} on the board.`);
  }
  // agent focused
  const agentPats: RegExp[] = [/\bwhat(?:'s|s| is| are)?\s+(.+?)\s+(?:working on|doing|up to|on)\b/, /\bhow(?:'s| is)\s+(.+?)\s+(?:doing|going|holding up|getting on)\b/, /\bwhere(?:'s| is)\s+(.+?)\s+at\b/, /\bstatus\s+(?:of|for|on)\s+(.+)/, /^(.+?)\s+status\??$/, /\bis\s+(.+?)\s+(?:blocked|stuck|free|idle|busy)\b/];
  for (const re of agentPats) {
    const m = re.exec(l);
    if (!m) continue;
    const h = findAgents(m[1], ctx, true)[0];
    if (h) return mk('agent', h.agent);
  }
  if (self && /\b(?:you|u)\b/.test(l) && /\b(working on|doing|up to|status|blocked|stuck|busy|free|idle|how'?s it going|how are you doing|progress|need help)\b/.test(l)) return mk('agent', self);
  if (/\b(who|anyone|anybody|any one|what)\b.*\b(blocked|stuck|waiting|blockers?)\b|\bblockers?\b|^blocked\??$/.test(l)) return mk('blocked');
  if (/\b(cost|costs|spend|spent|budget|burn|burning|money|dollars|how much)\b/.test(l) && !/\b(set|change|raise|lower|increase)\b/.test(l)) return mk('cost');
  if (/\bdemo\b.*\b(ready|readiness|status|go|looking)\b|\bready to demo\b|\bdeploy(?:ed|ment)?\b.*\b(status|live|up|ok|done)\b|\bis it (?:live|deployed|up)\b|\blive url\b|\bsubmission\b|\bchecklist\b|\bsubmitted\b\?/.test(l)) return mk('demo');
  if (/\beta\b|\b(?:will|can|are|do|did)\s+(?:we|you)\b.*\b(make|finish|ship|hit|get there|done|on track|behind|ahead)\b|\bon track\b|\bgoing to make it\b|\bgonna make it\b|\bbehind schedule\b|\btime left\b|\bhow (?:long|much time)\b|\bwhen (?:are we|will we|do we) (?:done|finish|ship)|\b(?:when|what)(?:'s| is)? (?:the )?deadline\b|\bare we (?:ahead|behind)\b/.test(l)) return mk('eta');
  if (/\bwhat(?:'?s| is| are)?\s+(?:left|remaining|next|still open|on the board)\b|\bhow many\b.*\b(left|remaining|open|tickets|merged|done)\b|\bremaining\b|\bwhat remains\b|\bleft to do\b|\bto go\b/.test(l)) return mk('left');
  if (/^(?:status|sitrep|stand-?up|update|progress|report|summary|rundown|catch me up|state of play)\b/.test(l) || /\b(?:status|sitrep|how are we(?: doing)?|how we doing|how'?s it going|how is it going|where are we(?: at)?|how are things|give me (?:an |the )?(?:update|status|rundown)|update me|what'?s (?:the )?(?:status|situation|plan))\b/.test(l) || (q && /\b(progress|status)\b/.test(l))) return mk('generic', self ?? undefined);
  return null;
}

// ============================================================================ social bits
const DIRECTIVE = /^(focus|concentrate|hurry|push|prioriti[sz]e|make sure|remember|keep|stop|don'?t|do not|be careful|try|use|switch|work on|start on|finish|wrap up|skip|ignore|avoid|check|take a look|look at|pair|sync|review|slow down|speed up|double-?check|cover|handle|go with|stick to)\b/i;
function handleSocial(t: string, ctx: ChatContext): Res | null {
  const l = t.toLowerCase().trim();
  const m = ctx.metrics; const total = totalScope(ctx);
  if (/^(hi|hey|hello|yo|sup|howdy|hola|gm|good (morning|afternoon|evening)|morning|evening)\b[\s!.,]*(atlas|team|everyone|all|there|boss|chief|folks|orchestrator)?[\s!.,]*$/.test(l)) {
    return { kind: 'greet', intents: [], reply: pick([`Morning. Board is live - ${num(m?.merged)}/${total} merged, ${num(m?.open)} open. What do you need?`, `Hey. ${num(m?.open)} open tasks, ${Math.round(remainingMinutes(ctx))} min on the clock. What's the call?`, `Here. Team is heads-down; ${num(m?.merged)}/${total} merged so far. What next?`]) };
  }
  if (/^how are you\b|^how'?s it going with you\b|^you good\b/.test(l)) return { kind: 'chit', intents: [], reply: `Running hot, in a good way. ${num(m?.merged)}/${total} merged.` };
  if (l.split(/\s+/).length <= 8 && /\b(thanks|thank you|thx|ty|cheers|appreciate it|nice|great (?:job|work)|good (?:job|work)|well done|awesome|love it|perfect|lgtm|sweet|legend)\b/.test(l)) return { kind: 'thanks', intents: [], reply: pick(['Anytime. Back to shipping.', 'Appreciate it - team is on it.', 'Noted. Keeping the pace up.']) };
  if (/^(bye|cya|see you|later|gtg|good night|goodnight|brb)\b/.test(l)) return { kind: 'bye', intents: [], reply: 'Holding the fort. Ping me when you need anything.' };
  if (/^(ok|okay|k|cool|got it|sounds good|alright|yep|yes|sure|roger|ack|noted|lol|haha)[\s!.]*$/.test(l)) return { kind: 'chit', intents: [], reply: pick(['Noted.', 'Copy that.', 'On it.']) };
  return null;
}
function helpReply(): string {
  return `Commands: ${CHAT_HELP.slice(0, 7).map((h) => h.cmd).join(', ')} ... Try "${CHAT_HELP[0].example}" or "${CHAT_HELP[12].example}" or just ask "status".`;
}
function unknownReply(): string {
  const idx = [0, 7, 11, 14, 16, 10, 2];
  const start = SEED % idx.length;
  const ex = [0, 1, 2].map((k) => CHAT_HELP[idx[(start + k * 2) % idx.length]].example);
  return `Didn't catch that. Try: "${ex[0]}", "${ex[1]}" or "${ex[2]}".`;
}

// ============================================================================ create detection
const STRONG_CREATE = /^(?:(?:add|create|file|open|log|raise|new|write up|put in|queue|make(?=\s+(?:a|an|another|some|new|\d+|two|three|four|five)\s))\s+(?:(?:a|an|another|some|new|\d+|two|three|four|five|me|us|the)\s+)*(?:(?:easy|medium|hard|epic|trivial|urgent|quick|small|big)\s+)*(?:tickets?|tasks?|issues?|cards?|stor(?:y|ies))\b|(?:tickets?|tasks?)\s*:|todo\s*:|bug\s*:)/i;
const WEAK_CREATE = /^(?:we (?:really )?(?:need|want|should (?:add|build|have|get|do|make))|i (?:want|need)|let'?s (?:add|build|get|do|make|ship)|can we (?:get|add|have|build|do|make)|could we (?:get|add|have|build)|(?:add|build|implement|ship|support)\b|fix\b)\s*/i;

function createFromStrong(t: string, ctx: ChatContext): Res {
  const m = STRONG_CREATE.exec(t);
  const prefix = m ? m[0] : '';
  const dm = /\b(easy|medium|hard|epic|trivial)\b/i.exec(prefix);
  const plural = /\b(tickets|tasks|issues|cards|stories)\b/i.test(prefix);
  let body = t.slice(prefix.length).replace(/^\s*(?:for|to|about|on|called|titled|named|:|-|—|,)\s*:?\s*/i, '');
  body = body.replace(/^\s*(?:for|to|about|on)\s+/i, '');
  return handleCreate(body, dm ? diffFromWord(dm[1]) : undefined, plural, ctx);
}

// ============================================================================ analyze
function analyze(text: string, ctx: ChatContext, self: AgentState | null): Res {
  const t0 = text.trim();
  if (!t0) return { kind: 'empty', intents: [], reply: 'What do you need? Try "status", "/task Login page d3" or "extend deadline by 10 minutes".' };

  // slash commands
  const sl = /^\/([\p{L}-]+)\s*(.*)$/su.exec(t0);
  if (sl) {
    const cmd = sl[1].toLowerCase(); const rest = sl[2].trim();
    switch (cmd) {
      case 'task': case 'tasks': case 'ticket': case 'tickets': case 't': case 'new': case 'add': case 'file': {
        const dm = /^(easy|medium|hard|epic|trivial)\s+/i.exec(rest);
        return handleCreate(dm ? rest.slice(dm[0].length) : rest, dm ? diffFromWord(dm[1]) : undefined, cmd === 'tickets' || cmd === 'tasks', ctx);
      }
      case 'skill': case 'skills': {
        const sub = /^(add|new|create|install|remove|rm|delete|del|equip|give|unequip|take)\b\s*(.*)$/is.exec(rest);
        if (!sub) return handleAddSkill(rest, ctx);
        const sv = sub[1].toLowerCase();
        if (/^(add|new|create|install)$/.test(sv)) return handleAddSkill(sub[2], ctx);
        if (/^(remove|rm|delete|del)$/.test(sv)) return handleRemoveSkill(sub[2], ctx);
        return handleEquip(sub[2], ctx, self, /^(unequip|take)$/.test(sv)) ?? clarify('Which skill and which agent? e.g. /skill equip payments pixel');
      }
      case 'brief': case 'project': case 'newproject': return handleBrief(rest, ctx);
      case 'deadline': return /\d|hour|half/i.test(rest) ? handleDeadline('deadline ' + rest, ctx) : clarify('How many minutes? e.g. /deadline 30');
      case 'extend': return handleDeadline('extend deadline by ' + rest, ctx);
      case 'cut': case 'descope': return handleCut(cmd === 'cut' && !/scope|polish|ticket/i.test(rest) ? `cut scope by ${rest || 2}` : `cut ${rest}`, ctx) ?? handleCut(`cut scope by ${parseMinutes(rest) ?? 2}`, ctx) ?? clarify('Cut how many? e.g. /cut 3');
      case 'speed': return handleSpeed(/^\d/.test(rest) ? `speed ${rest}` : rest || 'speed 1') ?? clarify('Speed 0-8, e.g. /speed 4');
      case 'pause': return handleSpeed('pause')!;
      case 'resume': case 'play': case 'unpause': return handleSpeed('resume')!;
      case 'status': case 's': case 'standup': case 'eta': return detectStatus('status ' + rest, ctx, self) ?? { kind: 'status', sub: 'generic', intents: [{ type: 'status' }], reply: statusReply('generic', ctx) };
      case 'cancel': case 'kill': case 'drop': return handleEdit('cancel ' + rest, ctx, self) ?? clarify('Cancel which task? e.g. /cancel T-4');
      case 'prio': case 'prioritize': case 'prioritise': case 'bump': return handleEdit('prioritize ' + rest, ctx, self) ?? clarify('Prioritize which task? e.g. /prio T-5');
      case 'deprio': case 'deprioritize': return handleEdit('deprioritize ' + rest, ctx, self) ?? clarify('Deprioritize which task?');
      case 'pin': case 'assign': return handleEdit('pin ' + rest, ctx, self) ?? clarify('Pin which task to whom? e.g. /pin T-5 pixel');
      case 'unpin': return handleEdit('unpin ' + rest, ctx, self) ?? clarify('Unpin which task?');
      case 'difficulty': case 'rate': case 'd': return handleEdit('difficulty ' + rest, ctx, self) ?? clarify('e.g. /difficulty 4 for T-3');
      case 'tell': case 'msg': case 'say': case 'dm': return handleMessage('tell ' + rest, ctx, self) ?? clarify(`Tell who what? e.g. /tell marlow focus on the API. Workers: ${workerNames(ctx)}.`);
      case 'ask': return handleMessage('ask ' + rest, ctx, self) ?? clarify('e.g. /ask pixel to help marlow with auth');
      case 'help': case 'commands': case 'h': return { kind: 'help', intents: [], reply: helpReply() };
      default: return { kind: 'unknown', intents: [], reply: `Unknown command /${cmd}. ${unknownReply()}` };
    }
  }

  // natural language
  const t = t0.replace(/^(?:(?:hey|hi|hello|yo|ok|okay|so|please|pls|plz|atlas|orchestrator|boss|team)[,!:\s]+|(?:can|could|would) you (?:please )?|let'?s\s+(?=add|create|file|build|make|cut|extend|pause|resume|speed|drop|cancel)|we should\s+(?=add|create|file|cut|extend|cancel|drop)|i want you to |go ahead and )+/i, '').trim() || t0;
  const l = t.toLowerCase();

  if (/^(?:help|\?+|commands?|what can you do|what do i type|how do (?:i|you) (?:use|work)|how does this work)[\s?!.]*$/.test(l)) return { kind: 'help', intents: [], reply: helpReply() };
  const social0 = handleSocial(t, ctx);
  if (social0 && social0.kind === 'greet') return social0;
  if (/^(?:new|next|another)\s+(?:project|brief|idea)\b|^(?:start(?:ing)?(?: a)? new project|pivot to|we(?:'re| are) (?:now )?building)\b/.test(l)) {
    return handleBrief(t.replace(/^(?:new|next|another)\s+(?:project|brief|idea)\b\s*[:\-–—]?\s*|^(?:start(?:ing)?(?: a)? new project|pivot to|we(?:'re| are) (?:now )?building)\b\s*[:\-–—]?\s*/i, ''), ctx);
  }
  if (STRONG_CREATE.test(t)) return createFromStrong(t, ctx);
  const sp = handleSpeed(t);
  if (sp) return sp;

  // skills
  const addSk = /\b(?:add|create|new|install|register|make)\s+(?:an?\s+|the\s+|new\s+|custom\s+)*skill\b\s*:?\s*(.*)$/is.exec(t);
  if (addSk && !/\bskills?\s+(?:to|for|on)\s/i.test(addSk[0])) return handleAddSkill(addSk[1], ctx);
  const addSk2 = /^(?:add|create|install)\s+(.+?)\s+skill\s*$/i.exec(t);
  if (addSk2) return handleAddSkill(addSk2[1], ctx);
  const agentsInText = findAgents(t, ctx, true);
  if (!/^(tell|ask)\b/.test(l) && (/\b(take|strip|remove|drop|unequip|unload|pull|revoke|rip|yank)\b/.test(l) && /\b(from|off|away)\b/.test(l) || /\bunequip\b/.test(l)) && (agentsInText.length || self)) {
    const r = handleEquip(t, ctx, self, true); if (r) return r;
  }
  if (!/^(tell|ask)\b/.test(l) && /\b(give|equip|load|hand|issue|teach|arm|install|let)\b/.test(l) && (agentsInText.length || (self && /\bskill\b/.test(l))) && findTicketRefs(t).nums.length === 0) {
    const r = handleEquip(t, ctx, self, false); if (r) return r;
  }
  if (/\bskill\b/.test(l) && /\b(remove|delete|drop|retire|kill|ditch|get rid of|scrap)\b/.test(l)) return handleRemoveSkill(t, ctx);

  // time & scope
  const durQ = /\b(?:when|what)(?:'s| is)?\s+(?:the\s+)?deadline\b/.test(l) && parseMinutes(l) === null;
  if (!durQ && (/\bdeadline\b/.test(l) || /\b(\d+|an?|half an?)\s*(?:min|minutes|mins|hours?|hrs?|h)\b.*\b(left|remaining|to go|from now)\b/.test(l) || /\bwe(?: only)? have\b.*\b(?:min|minutes|hours?)\b/.test(l) || /\b(extend|push|add|give us|more time)\b.*\b(?:min|minutes|hours?)\b/.test(l) || /\bshorten\b/.test(l)) && !/\b(?:tickets?|skill)\b/.test(l.replace(/\bticket\s+\d/, ''))) {
    if (!/\?\s*$/.test(l) || parseMinutes(l) !== null) return handleDeadline(t, ctx);
  }
  const cut = handleCut(t, ctx);
  if (cut) return cut;

  // ticket edits
  const edit = handleEdit(t, ctx, self);
  if (edit) return edit;

  // messages / help
  const msg = handleMessage(t, ctx, self);
  if (msg) return msg;

  // status
  const st = detectStatus(t, ctx, self);
  if (st) return st;

  // weak create
  const wc = WEAK_CREATE.exec(t);
  if (wc && !/\?\s*$/.test(t.replace(/\b(can|could) we\b.*\?$/i, ''))) {
    const body = t.slice(wc[0].length);
    const keepVerb = /^fix\b/i.test(wc[0]);
    if (body.trim().split(/\s+/).filter(Boolean).length >= 1 || keepVerb) return handleCreate(keepVerb ? t : body, undefined, false, ctx);
  } else if (wc && /^(?:can|could) we\b/i.test(t)) {
    return handleCreate(t.slice(wc[0].length).replace(/\?+\s*$/, ''), undefined, false, ctx);
  }

  const social = handleSocial(t, ctx);
  if (social) return social;
  if (DIRECTIVE.test(t)) return { kind: 'directive', intents: [], reply: pick(['Noted - steering the plan that way. If it needs tracking, file it: /task ...', 'Got it. I will weigh that on the next pickups; /task makes it official.']), text: t };
  return { kind: 'unknown', intents: [], reply: unknownReply() };
}

// ============================================================================ voice
function workerVoice(res: Res, a: AgentState, ctx: ChatContext, text: string): ParsedChat {
  const redirect = "That's the orchestrator's call - I'll pass it on.";
  if (a.phase === 'offline' && res.kind !== 'status') return { intents: ORCH_KINDS.has(res.kind) ? res.intents : [], reply: `${a.name} is offline right now. ${ORCH_KINDS.has(res.kind) ? 'Passing your request to the orchestrator.' : ''}`.trim() };
  if (res.kind === 'status') {
    const sub = res.sub ?? 'generic';
    if (sub === 'generic' || (sub === 'agent' && res.agent?.id === a.id)) return { intents: [], reply: agentStatus(a, ctx, true) };
    if (sub === 'agent') return { intents: [], reply: agentStatus(res.agent ?? a, ctx, false) };
    if (sub === 'blocked') {
      const mine = a.phase === 'blocked' || a.waitingOn;
      const others = blockedList(ctx).filter((x) => !x.startsWith(a.name));
      return { intents: [], reply: `${mine ? agentStatus(a, ctx, true) : 'Not me.'} ${others.length ? others.join('; ') + '.' : 'Nobody else either.'}` };
    }
    return { intents: [], reply: `Atlas has the full picture, but here are the numbers: ${statusReply(sub, ctx, res.agent, res.ticket)}` };
  }
  if (ORCH_KINDS.has(res.kind)) return { intents: res.intents, reply: `${redirect} ${res.reply}` };
  if (res.kind === 'message' || res.kind === 'help_ask') return { intents: res.intents, reply: res.reply };
  if (res.kind === 'greet') return { intents: [], reply: `Hey - ${a.name} here. ${a.ticketId ? `Heads down on ${a.ticketId}.` : 'Free for a task.'} What's up?` };
  if (res.kind === 'thanks' || res.kind === 'chit') return { intents: [], reply: pick(['Anytime.', 'Back to it.', 'Happy to help.']) };
  if (res.kind === 'bye') return { intents: [], reply: 'See you.' };
  if (res.kind === 'directive') {
    const d = short(text.replace(/\s+/g, ' ').replace(/[.!]+$/, ''), 70);
    const tk = ticketOf(ctx, a.ticketId);
    return { intents: [], reply: `${pick(['Got it', 'On it', 'Understood'])}: ${d.charAt(0).toLowerCase() + d.slice(1)}.${tk ? ` I'll fold it into ${tk.id}.` : ' I will apply it on my next task.'}` };
  }
  if (res.kind === 'help') return { intents: [], reply: `I can report status, take a directive like "focus on tests", or pass orchestration commands (tasks, skills, deadline) to the orchestrator.` };
  if (res.kind === 'unknown') return { intents: [], reply: 'Not sure what you mean. Ask me for status, give me a directive like "focus on tests", or send tasks and deadlines via the orchestrator.' };
  return { intents: res.intents, reply: res.reply };
}

function broadcast(res: Res, ctx: ChatContext, text: string): ParsedChat {
  if (ORCH_KINDS.has(res.kind) || res.kind === 'status' || res.kind === 'help' || res.kind === 'clarify' || res.kind === 'empty' || res.kind === 'message' || res.kind === 'help_ask') return { intents: res.intents, reply: res.reply };
  const workers = workersOf(ctx).filter((a) => a.phase !== 'offline');
  const pool = workers.length ? workers : workersOf(ctx);
  if (!pool.length) return { intents: [], reply: 'No workers connected - nobody to relay to.' };
  const msg = capFirst(short(text.replace(/\s+/g, ' ').trim(), 140));
  return { intents: pool.slice(0, 6).map((a) => ({ type: 'message_agent', agentId: a.id, text: msg })), reply: `Relaying to the team: "${short(msg, 80)}"` };
}

// ============================================================================ public API
export function parseChat(text: string, to: string, ctx: ChatContext): ParsedChat {
  try {
    const raw = typeof text === 'string' ? text.slice(0, 2000) : '';
    SEED = hash32(raw + '|' + Math.floor(num(ctx?.time) / 10));
    const target = to === 'orch' || to === 'all' ? null : (ctx.agents ?? []).find((a) => a.id === to) ?? null;
    const self = target && target.role !== 'orchestrator' ? target : null;
    const res = analyze(raw, ctx, self);
    if (to === 'all') return broadcast(res, ctx, raw);
    if (self) return workerVoice(res, self, ctx, raw);
    return { intents: res.intents, reply: res.reply };
  } catch {
    return { intents: [], reply: 'I tripped on that one - try rephrasing, or type "help".' };
  }
}
