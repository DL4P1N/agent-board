/**
 * Tests for the pure text modules: `npx tsx src/sim/textTests.ts`.
 * Covers sim/intents.ts (chat parsing) and sim/briefs.ts (brief -> plan). Exits non-zero on failure.
 */
import { SKILLS } from '../skills';
import type { AgentState, ChatContext, Difficulty, Intent, Ticket, TicketStatus } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { CHAT_HELP, CHAT_SUGGESTIONS, parseChat } from './intents';
import { planFromBrief, SAMPLE_BRIEFS } from './briefs';

declare const process: { exit(code: number): never };

// ---------------------------------------------------------------- fixture
const zeroUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsd: 0 };
function agent(id: string, name: string, role: AgentState['role'], over: Partial<AgentState> = {}): AgentState {
  return {
    id, name, provider: 'claude', role, owner: 'maya', deskIndex: 0, pos: { x: 0, z: 0 }, heading: 0, pose: 'idle', phase: 'idle', phaseProgress: 0, carrying: null,
    skills: [], waitingOn: null, helping: null, ownerColor: '#fff', ticketId: null,
    config: { model: 'claude-sonnet-5-5', tier: 'sonnet', autocompactBuffer: 20, subagents: 2, effort: 'medium' },
    overridden: false, activeSubagents: 0, contextFill: 0.3, compactions: 0, bubble: null,
    stats: { done: 3, merged: 2, reworks: 0, walkedMeters: 0 }, usage: { ...zeroUsage }, burnUsdPerMin: 0, subagentCostUsd: 0, ...over,
  };
}
const agents: AgentState[] = [
  agent('orch', 'Atlas', 'orchestrator', { phase: 'planning' }),
  agent('integ', 'Warden', 'integrator', { phase: 'reviewing' }),
  agent('a1', 'Pixel', 'worker', { phase: 'working', ticketId: 'T-3', skills: ['react-ui', 'css-pixel'] }),
  agent('a2', 'Marlow', 'worker', { phase: 'blocked', pose: 'blocked', ticketId: 'T-7', waitingOn: 'a1', skills: ['payments'], config: { model: 'claude-opus-5', tier: 'opus', autocompactBuffer: 20, subagents: 4, effort: 'high' } }),
  agent('a3', 'Juniper', 'worker', { phase: 'idle' }),
  agent('a4', 'Bolt', 'worker', { phase: 'working', ticketId: 'T-5', skills: ['api-design'] }),
  agent('a5', 'Sable', 'worker', { phase: 'awaiting_review', ticketId: 'T-6' }),
  agent('a6', 'Quill', 'worker', { phase: 'waiting', ticketId: 'T-8', provider: 'codex' }),
];
function ticket(n: number, title: string, status: TicketStatus, over: Partial<Ticket> = {}): Ticket {
  return {
    id: `T-${n}`, title, difficulty: 3 as Difficulty, status, assignee: null, progress: 0, createdAt: 0, mergedAt: null, reworks: 0, epic: 'Core', description: '', source: 'orchestrator',
    pinnedTo: null, priority: n, milestone: 'mvp', helpRequests: 0, skills: [], estimatedCostUsd: 2.5, usage: { ...zeroUsage }, reviewCostUsd: 0, ...over,
  };
}
const tickets: Ticket[] = [
  ticket(1, 'Repo scaffold + CI', 'merged', { mergedAt: 100 }),
  ticket(2, 'Data model and schema', 'merged', { mergedAt: 200 }),
  ticket(3, 'Core whiteboard canvas', 'in_progress', { assignee: 'a1', progress: 0.5, difficulty: 4 }),
  ticket(4, 'Login page', 'backlog', { difficulty: 2 }),
  ticket(5, 'API skeleton with validation', 'in_progress', { assignee: 'a4', progress: 0.3 }),
  ticket(6, 'Share link generator', 'in_review', { assignee: 'a5', progress: 1 }),
  ticket(7, 'Stripe webhook handler', 'in_progress', { assignee: 'a2', progress: 0.6, difficulty: 4 }),
  ticket(8, 'Realtime sync over websockets', 'in_progress', { assignee: 'a6', progress: 0.2, difficulty: 5 }),
  ticket(9, 'Dark mode', 'backlog', { difficulty: 2, priority: 9 }),
  ticket(10, 'README and setup docs', 'backlog', { difficulty: 1 }),
];
const ctx: ChatContext = {
  time: 600,
  agents,
  tickets,
  skills: SKILLS.map((s) => ({ ...s })),
  metrics: {
    merged: 2, open: 7, inReview: 1, rejected: 1, throughputPerMin: 0.4, avgCycleSec: 180, utilization: 0.6, scopeDone: 0.2, etaMinutes: 22, helpTotal: 3, helpOpen: 1,
    totalCostUsd: 37.5, burnUsdPerMin: 1.2, avgCostPerMergedUsd: 4.1, wasteUsd: 3.2, projectedScopeCostUsd: 120, budgetUsedPct: 25, costByTier: {}, costByProvider: { claude: 30, codex: 7.5 }, orchestrationCostUsd: 4,
  },
  plan: { name: 'Sticky Wall', totalTickets: 10, deadlineMinutes: 40, epics: ['Core'], note: '' },
  hack: {
    active: true, project: 'Sticky Wall', brief: 'whiteboard', stage: 'build', startedAt: 0, endsAt: 2400, milestones: [],
    checklist: [{ id: 'repo', label: 'Repo + CI green', done: true, auto: true }, { id: 'deploy-live', label: 'Live preview deployed', done: false, auto: true }],
    demoReadiness: 0.35, deployUrl: null, deployStatus: 'building', pitch: '', scopeCuts: 0,
  },
  settings: { ...DEFAULT_SETTINGS },
};

// ---------------------------------------------------------------- harness
let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) passed++;
  else failures.push(`FAIL ${name}${detail !== undefined ? ' :: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
}
function chat(text: string, to = 'orch') { return parseChat(text, to, ctx); }
function one(text: string, to = 'orch'): Intent | undefined { return chat(text, to).intents[0]; }
function expectIntent(text: string, pred: (i: Intent) => boolean, to = 'orch'): void {
  const r = chat(text, to);
  check(`"${text}"`, r.intents.length > 0 && pred(r.intents[0]), { intents: r.intents, reply: r.reply });
}
const create = (i?: Intent) => (i && i.type === 'create_ticket' ? i.spec : null);

// ---------------------------------------------------------------- ticket creation
{
  const s = create(one('add a ticket for the login page, hard, needs auth and react ui'));
  check('create: login hard', !!s && /login page/i.test(s.title) && s.difficulty === 4 && !!s.skills?.includes('auth') && !!s.skills.includes('react-ui'), s);
  const r = chat('add a ticket for the login page, hard, needs auth and react ui');
  check('create: reply no ids', !/T-\d/.test(r.reply) && /Login page/.test(r.reply), r.reply);
  const s2 = create(one('create ticket: stripe webhook handler (d4) skills payments api-design'));
  check('create: stripe d4', !!s2 && /stripe webhook handler/i.test(s2.title) && s2.difficulty === 4 && s2.skills?.join() === 'payments,api-design', s2);
  const s3 = create(one('we need dark mode'));
  check('create: dark mode', !!s3 && /dark mode/i.test(s3.title) && !!s3.skills?.includes('css-pixel'), s3);
  const s4 = create(one('/ticket Login page d3 skills: auth, react-ui for pixel !high'));
  check('create: slash full', !!s4 && s4.title === 'Login page' && s4.difficulty === 3 && s4.skills?.join() === 'auth,react-ui' && s4.pinnedTo === 'a1' && (s4.priority ?? 0) > 10, s4);
  const s5 = create(one('/ticket fix flaky tests easy @marlow !low'));
  check('create: slash @ + low + easy', !!s5 && s5.difficulty === 2 && s5.pinnedTo === 'a2' && (s5.priority ?? 0) < 0 && !!s5.skills?.includes('unit-tests'), s5);
  const multi = chat('add tickets: login page; signup flow, hard; password reset d2');
  check('create: multi semicolon', multi.intents.length === 3 && multi.intents.every((i) => i.type === 'create_ticket'), multi.intents);
  const bullets = chat('create tickets:\n- landing page\n- stripe checkout\n- email receipts');
  check('create: multi bullets', bullets.intents.length === 3, bullets.intents);
  const many = chat('add tickets: ' + Array.from({ length: 12 }, (_, i) => `thing ${i}`).join('; '));
  check('create: cap 8', many.intents.length === 8, many.intents.length);
  const s6 = create(one('add ticket database schema for payments'));
  check('create: infer db', !!s6 && !!s6.skills?.includes('db-migrations'), s6);
  const s7 = create(one('add a hard ticket for ci deploy pipeline'));
  check('create: prefix difficulty', !!s7 && s7.difficulty === 4 && !!s7.skills?.includes('ci-cd'), s7);
  const s8 = create(one('add a ticket for GraphQL gateway needs api'));
  check('create: sloppy', !!s8, s8);
}

// ---------------------------------------------------------------- edits
expectIntent('cancel T-4', (i) => i.type === 'cancel_ticket' && i.id === 'T-4');
expectIntent('kill t9', (i) => i.type === 'cancel_ticket' && i.id === 'T-9');
expectIntent('drop the login ticket', (i) => i.type === 'cancel_ticket' && i.id === 'T-4');
expectIntent('make T-3 harder', (i) => i.type === 'set_difficulty' && i.id === 'T-3' && i.difficulty === 5);
expectIntent('T-4 is hard', (i) => i.type === 'set_difficulty' && i.id === 'T-4' && i.difficulty === 4);
expectIntent('difficulty 4 for T-9', (i) => i.type === 'set_difficulty' && i.id === 'T-9' && i.difficulty === 4);
expectIntent('make ticket 4 easier', (i) => i.type === 'set_difficulty' && i.id === 'T-4' && i.difficulty === 1);
expectIntent('prioritize T-5', (i) => i.type === 'prioritize' && i.id === 'T-5' && i.priority === 11);
expectIntent('T-5 first', (i) => i.type === 'prioritize' && i.id === 'T-5');
expectIntent('bump T-9', (i) => i.type === 'prioritize' && i.id === 'T-9' && i.priority === 11);
expectIntent('deprioritize T-5', (i) => i.type === 'prioritize' && i.id === 'T-5' && i.priority < 1);
expectIntent('give T-5 to Pixel', (i) => i.type === 'pin_ticket' && i.id === 'T-5' && i.agentId === 'a1');
expectIntent('pin T-5 to marlow', (i) => i.type === 'pin_ticket' && i.agentId === 'a2');
expectIntent('pin T-5 to Marlo', (i) => i.type === 'pin_ticket' && i.agentId === 'a2');
expectIntent('unpin T-5', (i) => i.type === 'pin_ticket' && i.id === 'T-5' && i.agentId === null);
expectIntent('take T-4', (i) => i.type === 'pin_ticket' && i.id === 'T-4' && i.agentId === 'a3', 'a3');

// ---------------------------------------------------------------- skills
expectIntent('add skill GraphQL', (i) => i.type === 'add_skill' && i.skill.name === 'GraphQL');
{
  const i = one('/skill add Rust (orange, needs key RUST_TOKEN)');
  check('skill add: full', !!i && i.type === 'add_skill' && i.skill.name === 'Rust' && i.skill.needsSecret === 'RUST_TOKEN' && i.skill.color === '#fb923c', i);
}
expectIntent('remove skill docs', (i) => i.type === 'remove_skill' && i.id === 'docs');
expectIntent('delete the perf skill', (i) => i.type === 'remove_skill' && i.id === 'perf');
expectIntent('give Pixel the payments skill', (i) => i.type === 'equip_skill' && i.agentId === 'a1' && i.skillId === 'payments');
expectIntent('take auth away from Marlow', (i) => i.type === 'unequip_skill' && i.agentId === 'a2' && i.skillId === 'auth');
expectIntent('equip bolt with playwrght', (i) => i.type === 'equip_skill' && i.agentId === 'a4' && i.skillId === 'playwright');

// ---------------------------------------------------------------- time, scope, speed, project
expectIntent('deadline 30 min', (i) => i.type === 'set_deadline' && i.minutes === 30);
expectIntent('we have 25 minutes left', (i) => i.type === 'set_deadline' && i.minutes === 25);
expectIntent('extend deadline by 10 minutes', (i) => i.type === 'set_deadline' && i.minutes === 40 + 10 - 10);
expectIntent('cut scope by 3', (i) => i.type === 'cut_scope' && i.count === 3);
expectIntent('drop 2 tickets', (i) => i.type === 'cut_scope' && i.count === 2);
expectIntent('cut polish', (i) => i.type === 'cut_scope' && i.count === 2);
expectIntent('speed 4x', (i) => i.type === 'set_speed' && i.value === 4);
expectIntent('pause', (i) => i.type === 'set_speed' && i.value === 0);
expectIntent('resume', (i) => i.type === 'set_speed' && i.value === 1);
{
  const i = one('new project: Foodie Map - a map app that lets friends rate street food with photos');
  check('brief NL', !!i && i.type === 'set_brief' && i.project === 'Foodie Map' && /street food/.test(i.brief), i);
  const j = one('/brief Pocket Tutor: flashcards with spaced repetition');
  check('brief slash', !!j && j.type === 'set_brief' && j.project === 'Pocket Tutor', j);
}

// ---------------------------------------------------------------- agents
expectIntent('tell Marlow to focus on the API', (i) => i.type === 'message_agent' && i.agentId === 'a2' && /focus on the API/i.test(i.text));
expectIntent('tell marlo to focus on tests', (i) => i.type === 'message_agent' && i.agentId === 'a2');
expectIntent('ask Pixel to help Marlow with auth', (i) => i.type === 'ask_help' && i.fromAgentId === 'a2' && i.toAgentId === 'a1' && /auth/.test(i.question));
{
  const r = chat('tell Zed to ship it');
  check('unknown agent asks', r.intents.length === 0 && /Which agent/.test(r.reply) && /Pixel/.test(r.reply), r.reply);
  const all = chat('wrap up what you are doing in five', 'all');
  check('broadcast', all.intents.length > 0 && all.intents.length <= 6 && all.intents.every((i) => i.type === 'message_agent') && /Relaying to the team/.test(all.reply), all);
}

// ---------------------------------------------------------------- status
{
  for (const q of ['status', 'how are we doing', 'eta?', 'are we going to make it', 'who is blocked', 'cost so far', 'what is left', 'is the demo ready', "what is Pixel working on", 'how is T-7 doing']) {
    const r = chat(q);
    check(`status: "${q}"`, r.intents.length === 1 && r.intents[0].type === 'status' && /\d/.test(r.reply), r);
  }
  const g = chat('status').reply;
  check('status numbers', /2\/10/.test(g) && /22 min/.test(g) && /\$37\.50/.test(g) && /Marlow/.test(g), g);
  const b = chat('who is blocked?').reply;
  check('blocked names waitingOn', /Marlow/.test(b) && /Pixel/.test(b), b);
  const w = chat('what are you working on?', 'a2');
  check('worker voice', w.intents.length === 0 && /T-7/.test(w.reply) && /opus/.test(w.reply) && /Pixel/.test(w.reply) && /\b60%/.test(w.reply), w.reply);
  const redir = chat('add a ticket for dark mode', 'a1');
  check('worker redirect', redir.intents.length === 1 && /orchestrator/.test(redir.reply), redir);
  const dir = chat('focus on tests', 'a1');
  check('worker directive', dir.intents.length === 0 && /focus on tests/i.test(dir.reply), dir.reply);
}

// ---------------------------------------------------------------- chit-chat, empty, hints
{
  check('greeting', chat('hey').intents.length === 0 && chat('hey').reply.length > 0);
  check('thanks', chat('thanks!').intents.length === 0 && chat('thanks!').reply.length > 0);
  const e = chat('   ');
  check('empty', e.intents.length === 0 && /\?|What/.test(e.reply), e.reply);
  const u = chat('flibbertigibbet quantum banana');
  check('unknown hint', u.intents.length === 0 && /Try:/.test(u.reply) && (u.reply.match(/"/g) ?? []).length >= 6, u.reply);
  check('help exports', CHAT_HELP.length >= 12 && CHAT_SUGGESTIONS.length >= 6 && CHAT_SUGGESTIONS.length <= 8 && CHAT_HELP.every((h) => h.cmd && h.example && h.blurb));
  // every help example parses to something other than the unknown hint
  for (const h of CHAT_HELP) {
    const r = chat(h.example);
    check(`help example: ${h.example}`, !/Didn't catch/.test(r.reply) && r.reply.length > 0, r.reply);
  }
  for (const s of CHAT_SUGGESTIONS) check(`suggestion: ${s}`, !/Didn't catch/.test(chat(s).reply), chat(s).reply);
}

// ---------------------------------------------------------------- fuzz + determinism
{
  const fuzz = ['', ' ', '\n\n\n', '/', '//', '/ticket', '/skill', '/skill add', '/brief', '/deadline', '/cut', '/speed', '@', '#', 'T-', 'T-99999999', 'ticket', 'tickets:', ';;;;', 'add ticket:', 'add skill', 'remove skill', 'tell', 'ask', 'tell Pixel', 'ask Pixel to help', 'give', 'take away', 'deadline', 'extend deadline', 'speed', 'x'.repeat(5000), 'a '.repeat(3000),
    '\u0000\u0001', '😀😀', '‮', 'tell ééé to 中文', '((((', '))))', '!!!', '$$$', '1e999 min', 'deadline -5', 'deadline 0', 'cut scope by 9999999999', 'speed 99999x', 'speed NaN', 'prioritize', 'cancel', 'T-0', 'pin T-5 to', '/ticket !high !low d9 d0', 'add ticket: ,,,,', 'new project:', '/brief :', 'new project: - -', 'add skill ()', '/skill add (red)'];
  for (let i = 0; i < 200; i++) fuzz.push(String.fromCharCode(...Array.from({ length: 1 + (i % 40) }, (_, k) => 32 + ((i * 31 + k * 17) % 95))));
  let threw = 0;
  for (const f of fuzz) {
    for (const to of ['orch', 'a1', 'all', 'zzz']) {
      try {
        const r = parseChat(f, to, ctx);
        if (typeof r.reply !== 'string' || !Array.isArray(r.intents) || r.intents.length > 40) threw++;
        for (const it of r.intents) if (it.type === 'set_deadline' && !(it.minutes >= 1)) threw++;
      } catch { threw++; }
    }
  }
  check('fuzz: no throws / sane output', threw === 0, threw);
  const phrases = ['status', 'add a ticket for the login page, hard', 'tell Pixel to focus', 'cut scope by 2', 'hello'];
  let same = true;
  for (const p of phrases) if (JSON.stringify(parseChat(p, 'orch', ctx)) !== JSON.stringify(parseChat(p, 'orch', ctx))) same = false;
  check('determinism', same);
}

// ---------------------------------------------------------------- briefs
{
  const skillIds = new Set(SKILLS.map((s) => s.id));
  const withCustom = [...SKILLS, { id: 'graphql', name: 'GraphQL', blurb: 'Schemas and resolvers', category: 'backend' as const, color: '#f0f', glyph: 'GQ', custom: true, loadTokens: 1000 }];
  for (const b of SAMPLE_BRIEFS) {
    const plan = planFromBrief({ projectName: b.project, brief: b.brief, skills: SKILLS, seed: 7 });
    const n = plan.tickets.length;
    check(`brief ${b.project}: 18-30 tickets`, n >= 18 && n <= 30, n);
    check(`brief ${b.project}: valid skills`, plan.tickets.every((t) => t.skills.length >= 1 && t.skills.length <= 3 && t.skills.every((s) => skillIds.has(s))));
    check(`brief ${b.project}: unique titles`, new Set(plan.tickets.map((t) => t.title)).size === n);
    const firstNonMvp = plan.tickets.findIndex((t) => t.milestone !== 'mvp');
    check(`brief ${b.project}: mvp first`, plan.tickets[0].milestone === 'mvp' && firstNonMvp > 2 && plan.tickets.slice(firstNonMvp).every((t) => t.milestone !== 'mvp'), plan.tickets.map((t) => t.milestone).join());
    check(`brief ${b.project}: priority sorted`, plan.tickets.every((t, i) => i === 0 || plan.tickets[i - 1].priority >= t.priority));
    check(`brief ${b.project}: milestones covered`, (['mvp', 'features', 'polish', 'demo'] as const).every((m) => plan.tickets.some((t) => t.milestone === m)));
    check(`brief ${b.project}: epics 4-6`, plan.epics.length >= 4 && plan.epics.length <= 6 && plan.tickets.every((t) => plan.epics.includes(t.epic)), plan.epics);
    check(`brief ${b.project}: desc + diff`, plan.tickets.every((t) => t.description.split('\n').length >= 2 && t.difficulty >= 1 && t.difficulty <= 5));
    check(`brief ${b.project}: checklist/pitch`, plan.checklist.map((c) => c.id).join() === 'repo,deploy-live,readme,demo-script,pitch,submitted' && plan.checklist.every((c) => !c.done && c.auto) && plan.pitch.startsWith(b.project + ':'), plan.pitch);
    const again = planFromBrief({ projectName: b.project, brief: b.brief, skills: SKILLS, seed: 7 });
    check(`brief ${b.project}: deterministic`, JSON.stringify(plan) === JSON.stringify(again));
  }
  const sticky = planFromBrief({ projectName: 'Sticky Wall', brief: SAMPLE_BRIEFS[0].brief, skills: SKILLS, seed: 1 });
  check('sticky pitch', sticky.pitch === 'Sticky Wall: realtime whiteboards where AI writes the first draft.', sticky.pitch);
  check('sticky realtime title', sticky.tickets.some((t) => t.title === 'Sticky Wall: realtime sync over websockets'), sticky.tickets.map((t) => t.title));
  check('milestone table', sticky.milestones.map((m) => `${m.id}:${m.dueFraction}`).join() === 'mvp:0.45,features:0.72,polish:0.9,demo:1');
  const s1 = planFromBrief({ projectName: 'X', brief: SAMPLE_BRIEFS[1].brief, skills: SKILLS, seed: 1 });
  const s2 = planFromBrief({ projectName: 'X', brief: SAMPLE_BRIEFS[1].brief, skills: SKILLS, seed: 99 });
  check('seed changes order somewhere or equal', s1.tickets.length === s2.tickets.length);
  const empty = planFromBrief({ projectName: '', brief: '', skills: SKILLS, seed: 3 });
  check('empty brief generic plan', empty.tickets.length >= 14 && empty.tickets.every((t) => t.skills.every((s) => skillIds.has(s))), empty.tickets.length);
  const capped = planFromBrief({ projectName: 'Cap', brief: SAMPLE_BRIEFS[0].brief, skills: SKILLS, seed: 3, maxTickets: 12 });
  check('maxTickets respected (essentials kept)', capped.tickets.length <= 14 && capped.tickets.length >= 8, capped.tickets.length);
  const cust = planFromBrief({ projectName: 'GQ', brief: 'A GraphQL-powered recipe browser with search', skills: withCustom, seed: 5 });
  check('custom skill used', cust.tickets.some((t) => t.skills.includes('graphql')) && cust.tickets.every((t) => t.skills.every((s) => withCustom.some((x) => x.id === s))));
  const noSkills = planFromBrief({ projectName: 'N', brief: 'x', skills: [], seed: 1 });
  check('no skills catalog ok', noSkills.tickets.every((t) => t.skills.length === 0));
  let threw = 0;
  for (const b of ['', ' ', '\u0000', 'x'.repeat(9000), '😀', 'a'.repeat(50) + ' ' + 'game '.repeat(500)]) {
    try { planFromBrief({ projectName: b, brief: b, skills: SKILLS, seed: NaN }); } catch { threw++; }
  }
  check('briefs fuzz no throws', threw === 0, threw);
}

// ---------------------------------------------------------------- summary
if (failures.length) {
  console.log(failures.join('\n'));
  console.log(`\n${failures.length} FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`textTests OK: ${passed} checks passed`);
