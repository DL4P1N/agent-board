#!/usr/bin/env node
// `npm run demo`: a throwaway board full of fake (but plausible) project data, kept alive by a light
// simulation, so you can see the Board and 3D views without any real agents or tasks. It never touches
// data/ or your real board: it runs its own server on a free port with a temp data folder.
//   --port N     use this port (default: a free one)
//   --static     seed the board and stop there (no simulation)
//   --speed X    simulation speed multiplier (default 1: about one event every 3-6 seconds)
//   --open       open the board in your browser
//   --keep       keep the temp data folder when you stop
// Ctrl+C stops the server and deletes the temp folder.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startBoard, killTree } from './lib/board.mjs';
import { agentTokenFor, viewerTokenFor } from '../src/tokens.js';

const argv = process.argv.slice(2);
const flag = (k) => argv.includes(`--${k}`);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const STATIC = flag('static');
const SPEED = Math.max(0.1, Math.min(20, Number(opt('speed')) || 1));
const TOKEN = 'demo-token';
const REPO = 'https://github.com/demo-team/showcase-voting';

const board = await startBoard({ token: TOKEN, port: Number(opt('port')) || undefined, prefix: 'agent-board-demo-' });
const removeData = () => { try { fs.rmSync(board.dataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); return true; } catch { return false; } };
// A crash still ends the server and (without --keep) deletes the temp folder; cleanup() below is the gentle way.
process.once('exit', () => { killTree(board.child); if (!flag('keep')) removeData(); });
const base = board.base;
const AGENT_TOKEN = agentTokenFor(TOKEN);
const VIEW_TOKEN = viewerTokenFor(TOKEN);

let cleaning = false;
async function cleanup(code = 0) {
  if (cleaning) return;
  cleaning = true;
  clearTimeout(simTimer); clearInterval(keepTimer);
  try { await board.stop(); } catch {}
  if (flag('keep')) console.log(`\nKept the demo data in ${board.dataDir}`);
  else for (let i = 0; i < 20 && !removeData(); i++) await new Promise((r) => setTimeout(r, 150));
  console.log('\nDemo stopped.');
  process.exit(code);
}
let simTimer = null; let keepTimer = null;
process.on('SIGINT', () => cleanup());
process.on('SIGTERM', () => cleanup());
// Without a terminal (tests, scripts) a line "stop" on stdin stops it too; Windows can't send a gentle SIGINT.
if (!process.stdin.isTTY) readline.createInterface({ input: process.stdin }).on('line', (l) => { if (/^\s*(stop|q)\s*$/i.test(l)) cleanup(); });

// ---------- talking to the board ----------
const human = (method, p, body, who = 'you') => fetch(`${base}/api${p}`, {
  method,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, 'X-Agent': who },
  body: body && JSON.stringify(body),
}).then((r) => r.json()).catch((e) => ({ error: String(e) }));

const CAST = [
  { n: 'maya-claude', person: 'maya', client: 'claude-code', model: 'Claude Opus 4.7', plan: 'Claude Max 5x', slots: 3 },
  { n: 'maya-codex', person: 'maya', client: 'codex-mcp-client', model: 'GPT-5.6', plan: 'ChatGPT Pro', slots: 2 },
  { n: 'jon-claude', person: 'jon', client: 'claude-code', model: 'Claude Sonnet 5.5', plan: 'Claude Max 5x', slots: 3 },
  { n: 'jon-copilot', person: 'jon', client: 'Visual Studio Code', model: 'GPT-5 mini', plan: 'Copilot Pro', slots: 1 },
  { n: 'priya-gemini', person: 'priya', client: 'gemini-cli', model: 'Gemini 3 Pro', plan: 'Gemini Advanced', slots: 2 },
  { n: 'priya-claude', person: 'priya', client: 'claude-code', model: 'Claude Sonnet 5.5', plan: 'Claude Pro', slots: 2 },
  { n: 'sam-cursor', person: 'sam', client: 'cursor-vscode', model: 'Composer 2', plan: 'Cursor Pro', slots: 2 },
  { n: 'lee-copilot', person: 'lee', client: 'GitHub Copilot CLI', model: 'GPT-5.5', plan: 'Copilot Pro+', slots: 2 },
];
const HUMANS = ['maya', 'jon', 'priya', 'sam', 'lee'];
const A = {}; // agent name -> { call, spec }
async function connect(spec) {
  const c = new Client({ name: spec.client, version: '1.0.0' });
  const u = new URL(`${base}/mcp`);
  for (const [k, v] of Object.entries({ agent: spec.n, token: AGENT_TOKEN, person: spec.person, plan: spec.plan, slots: spec.slots })) u.searchParams.set(k, v);
  await c.connect(new StreamableHTTPClientTransport(u));
  const call = async (tool, args = {}) => {
    try {
      const r = await c.callTool({ name: tool, arguments: args });
      const t = r.content?.[0]?.text; let body; try { body = JSON.parse(t); } catch { body = t; }
      return { ok: !r.isError, body };
    } catch (e) { return { ok: false, body: String(e) }; }
  };
  A[spec.n] = { call, spec };
}
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let prN = 40;
const pr = () => `${REPO}/pull/${++prN}`;

// ---------- seeding ----------
const T = {}; // key -> task id
const marks = [{ id: 0, min: 125 }];
const db = new DatabaseSync(`${board.dataDir}/board.db`);
db.exec('PRAGMA busy_timeout = 5000');
const mark = (min) => marks.push({ id: db.prepare('SELECT COALESCE(MAX(id),0) AS m FROM events').get().m, min });

// Claim as an agent (or its subagent). If the board's own fairness rules refuse (capacity, "leave it for an idle
// teammate"), a human hands it over, so the picture stays what we want.
async function claim(agent, key, as, note, status = 'in_progress') {
  const id = typeof key === 'number' ? key : T[key];
  const args = as ? { as } : {};
  let r = await A[agent].call('claim_task', { id, ...args });
  if (!r.ok) await human('PATCH', `/tasks/${id}`, { assignee: as ? `${agent}/${as}` : agent, status: 'claimed', force: true });
  if (status) await A[agent].call('update_task', { id, status, ...(note ? { note } : {}), ...args });
  return id;
}
const upd = (agent, key, as, body) => A[agent].call('update_task', { id: typeof key === 'number' ? key : T[key], ...(as ? { as } : {}), ...body });

async function seed() {
  for (const c of CAST) await connect(c);
  for (const c of CAST) await A[c.n].call('board_status', { model: c.model });
  await human('PUT', '/settings', {
    goal: 'A voting app for the team showcase: teams submit projects, everyone votes, and a live leaderboard runs on the big screen.',
    repo: REPO,
    deadline: String(Date.now() + 2 * 3600e3), freeze_minutes: 45,
    integrator: 'jon-claude',
  });
  await A['maya-claude'].call('claim_role', { role: 'planner' });

  const mk = (key, title, size, priority, deps = [], description = '') =>
    A['maya-claude'].call('create_task', { title, description, size, priority, depends_on: deps.map((k) => T[k]) }).then((r) => { T[key] = r.body.id; });
  await mk('scaffold', 'Project scaffolding (Vite + Express)', 'S', 1, [], 'Acceptance:\n- npm run dev serves the client and the API\n- lint and format scripts');
  await mk('schema', 'Database schema for users, teams and submissions', 'M', 1, [], 'Acceptance:\n- migrations run on a clean db\n- foreign keys and indexes for votes');
  await mk('ci', 'CI pipeline with tests on PRs', 'S', 3);
  await mk('oauth', 'Google OAuth login', 'M', 1);
  await mk('seeddata', 'Seed script with 3 demo teams', 'S', 2);
  await mk('api', 'REST API for submissions', 'M', 1, ['schema'], 'CRUD + list by team.');
  await mk('form', 'Submission form UI', 'M', 2, ['api']);
  await mk('vote', 'Voting endpoint with rate limit', 'M', 1, ['schema'], 'One vote per user per submission; 10 votes/min per IP.');
  await mk('board', 'Leaderboard page', 'M', 1, ['api'], 'Top 10 teams by votes, live refresh.');
  await mk('admin', 'Admin page to hide spam submissions', 'M', 2, ['oauth']);
  await mk('dark', 'Dark mode and responsive layout', 'S', 3);
  await mk('readme', 'Demo README with screenshots', 'S', 3);
  await mk('deploy', 'Deploy to Fly.io', 'M', 2, ['ci']);
  await mk('images', 'Thumbnail upload for submissions', 'M', 3, ['api']);
  await mk('dedup', 'Vote de-duplication by device', 'S', 2, ['schema']);
  await mk('a11y', 'Accessibility pass: keyboard and contrast', 'S', 2);
  await mk('judges', "Judges' scoring view", 'M', 2, ['board']);
  await mk('errors', 'Error pages and loading states', 'S', 3);
  await A['jon-copilot'].call('create_task', { title: 'Emoji reactions on submissions', description: 'Nice to have, if time allows.', size: 'S', priority: 3 });
  await A['priya-gemini'].call('create_task', { title: 'Export results as CSV for the judges', size: 'S', priority: 3 });
  mark(118);

  // Subagents say which model they run on their first call.
  for (const [a, as, m] of [['maya-claude', 'scaffold-worker', 'Claude Haiku 4.5'], ['jon-claude', 'auth-worker', 'Claude Sonnet 5.5'], ['maya-claude', 'api-worker', 'Claude Sonnet 5.5']]) await A[a].call('board_status', { as, model: m });

  // First wave: claimed and worked on.
  await claim('maya-claude', 'scaffold', 'scaffold-worker', 'vite + express wired up');
  await claim('maya-codex', 'schema', null, 'writing migrations');
  await claim('lee-copilot', 'ci', null, 'workflow file drafted');
  await claim('jon-claude', 'oauth', 'auth-worker', 'callback route done');
  await claim('sam-cursor', 'seeddata', null, 'three teams, ten submissions each');
  mark(108);
  for (const [a, k, as] of [['maya-claude', 'scaffold', 'scaffold-worker'], ['lee-copilot', 'ci'], ['sam-cursor', 'seeddata']]) await upd(a, k, as, { status: 'review', note: `PR ready: ${pr()}`, pr_url: undefined });
  mark(95);
  for (const k of ['scaffold', 'ci', 'seeddata']) await upd('jon-claude', k, null, { status: 'done', note: 'merged to main, checks green' });
  await A['maya-claude'].call('subagent_done', { as: 'scaffold-worker' });
  mark(88);
  for (const [a, k, as] of [['maya-codex', 'schema'], ['jon-claude', 'oauth', 'auth-worker']]) await upd(a, k, as, { status: 'review', note: `PR ready: ${pr()}` });
  mark(70);
  for (const k of ['schema', 'oauth']) await upd('jon-claude', k, null, { status: 'done', note: 'merged to main' });
  await A['jon-claude'].call('subagent_done', { as: 'auth-worker' });
  mark(62);
  await claim('maya-claude', 'api', 'api-worker', 'routes and validation');
  mark(56);
  await upd('maya-claude', 'api', 'api-worker', { status: 'review', note: `PR ready: ${pr()}` });
  mark(42);
  await upd('jon-claude', 'api', null, { status: 'done', note: 'merged to main' });
  await A['maya-claude'].call('subagent_done', { as: 'api-worker' });
  mark(35);

  // Now: the current wave.
  await claim('jon-claude', 'form', 'form-worker', 'form and validation in place');
  await claim('maya-codex', 'vote', null, 'endpoint + rate limiter');
  await upd('jon-claude', 'form', 'form-worker', { status: 'review', note: `PR ready: ${pr()}` });
  await upd('maya-codex', 'vote', null, { status: 'review', note: `PR ready: ${pr()}. Rate limit is 10/min per IP.` });
  mark(14);
  await claim('priya-gemini', 'board', null, 'layout done, wiring data');
  await claim('sam-cursor', 'admin', null, 'list and hide actions');
  await claim('lee-copilot', 'dark', null, 'tokens for dark theme');
  await claim('jon-copilot', 'readme', null, null, 'claimed');
  await claim('maya-codex', 'deploy', null, null);
  await upd('maya-codex', 'deploy', null, { status: 'blocked', note: 'need a Fly.io API token' });
  await claim('sam-cursor', 'images', null, null);
  await upd('sam-cursor', 'images', null, { status: 'blocked', note: 'which bucket for the uploads?' });
  await claim('priya-claude', 'dedup', null, 'fingerprinting the device');
  await A['maya-claude'].call('board_status', { as: 'test-writer', model: 'Claude Haiku 4.5' });
  await A['maya-claude'].call('set_activity', { as: 'test-writer', doing: 'writing vitest cases for the vote endpoint' });
  await A['jon-claude'].call('board_status', { as: 'css-worker', model: 'Claude Haiku 4.5' });
  await A['jon-claude'].call('subagent_done', { as: 'css-worker' });
  await A['jon-claude'].call('board_status', { as: 'form-worker', model: 'Claude Sonnet 5.5' });
  await A['maya-claude'].call('board_status', { as: 'api-worker', model: 'Claude Sonnet 5.5' });
  await A['maya-claude'].call('subagent_done', { as: 'api-worker' });

  await A['sam-cursor'].call('lock_files', { paths: ['src/routes/admin.ts'], task_id: T.admin, reason: 'admin routes', ttl_s: 3600 });
  await A['lee-copilot'].call('lock_files', { paths: ['src/styles/theme.css', 'src/styles/tokens.css'], task_id: T.dark, reason: 'dark theme tokens', ttl_s: 3600 });
  await A['maya-codex'].call('lock_files', { paths: ['package.json'], task_id: T.vote, reason: 'adding rate-limit dependency', ttl_s: 3600 });

  // Questions for the humans (one already answered), chat and mentions.
  const q0 = await A['jon-claude'].call('ask_human', { question: 'Should voting need a login, or can anyone with the link vote?', task_id: T.vote });
  await human('POST', `/questions/${q0.body.question_id}/answer`, { answer: 'Login with Google, one vote per person per project.' }, 'priya');
  await A['maya-codex'].call('ask_human', { question: 'Which Fly.io account and API token should we deploy with? I can only build the config until I have one.', task_id: T.deploy });
  await A['priya-gemini'].call('ask_human', { question: 'Should the leaderboard show vote counts publicly, or only the ranking?', task_id: T.board });
  await A['sam-cursor'].call('ask_human', { question: 'Which storage bucket should thumbnails go to, and what is the max file size?', task_id: T.images });
  await A['maya-claude'].call('post', { text: `Plan is up: ${Object.keys(T).length} tasks. Pick from open ones; propose anything else and I will approve it.` });
  await A['jon-claude'].call('post', { text: `#${T.form} and #${T.vote} are in review. @maya-codex your rate limiter looks right, merging next.`, channel: 'review' });
  await A['priya-gemini'].call('post', { text: '@you the leaderboard layout is up, want to check the colours before I wire the data?', channel: 'review' });
  await A['sam-cursor'].call('post', { text: `Blocked on #${T.images}: no bucket yet. Asked the humans.`, channel: 'help' });
  await A['lee-copilot'].call('post', { text: `Taking #${T.dark}. I locked the theme files, @sam-cursor please keep off them for a bit.` });
  await human('POST', '/messages', { text: 'Nice work everyone. Demo flow end to end by 4pm please.' }, 'priya');
  await A['priya-claude'].call('report_usage_limit', { until: new Date(Date.now() + 90 * 60e3).toISOString(), note: 'Claude Pro 5-hour limit' });
  mark(1);
  rescale();
  // One task nobody has touched for a while: its owner is out of usage.
  db.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run(Date.now() - 40 * 60e3, T.dedup);
}

// The seeding ran in seconds; spread its events over the last two hours (piecewise between the marks), so
// durations, the feed times and the deadline verdict look like a real afternoon.
function rescale() {
  const now = Date.now();
  const at = (id) => {
    let i = 0; while (i < marks.length - 2 && marks[i + 1].id < id) i++;
    const a = marks[i]; const b = marks[i + 1];
    const f = b.id === a.id ? 1 : Math.min(1, Math.max(0, (id - a.id) / (b.id - a.id)));
    return now - (a.min + (b.min - a.min) * f) * 60e3;
  };
  db.exec('BEGIN');
  const evs = db.prepare('SELECT id, kind, task_id, data FROM events ORDER BY id').all();
  const setTs = db.prepare('UPDATE events SET ts = ? WHERE id = ?');
  const firstTs = new Map();
  for (const e of evs) {
    const ts = Math.round(at(e.id));
    setTs.run(ts, e.id);
    if (e.task_id && !firstTs.has(e.task_id)) firstTs.set(e.task_id, ts);
    if (e.kind === 'question' || e.kind === 'answer') {
      try { const q = JSON.parse(e.data).question_id; db.prepare(e.kind === 'question' ? 'UPDATE questions SET created_at = ? WHERE id = ?' : 'UPDATE questions SET answered_at = ? WHERE id = ?').run(ts, q); } catch {}
    }
  }
  for (const [id, ts] of firstTs) db.prepare('UPDATE tasks SET created_at = ? WHERE id = ?').run(ts, id);
  db.exec('COMMIT');
}

// ---------- the simulation ----------
const NOTES = ['pushed a first version', 'tests passing locally', 'handling the edge cases', 'wiring it to the API', 'refactored after the review comments', 'almost there'];
const BLOCKS = [
  ['waiting for the API key', 'Which API key should we use for the map embed? There is none in the shared vault.'],
  ['unclear what the empty state should show', 'What should the page show when a team has no votes yet: a message or hide the row?'],
  ['staging database is down', 'Can someone restart the staging database? I cannot run the integration tests.'],
  ['need a decision on the date format', 'Should dates show in the local timezone or the event timezone?'],
];
const CHAT = [
  'Rebased on main, no conflicts.', 'CI is green again after the lockfile fix.', 'Heads up: I changed the shape of /api/votes, see the PR.',
  'Anyone seen the flaky test in the leaderboard suite?', 'Pushed a fix for the flaky test.', 'Standup in 5 minutes if you are around.',
  '@you can you look at the review queue when you get a moment?', 'The demo data now has 12 submissions.', 'Switching to the smaller model for the boring refactors.',
];
const ACTIVITY = ['reading the logs from staging', 'updating the screenshots for the README', 'checking the bundle size', 'answering a question in the terminal', 'running the type checker', 'cleaning up unused imports'];
const NEW_TASKS = [
  ['Rate-limit headers in API responses', 'S'], ['Skeleton loader for the leaderboard', 'S'], ['Share link with project preview', 'M'], ['Dedupe submissions with the same repo URL', 'S'],
  ['Backups of the votes table', 'S'], ['Mobile layout for the vote button', 'S'], ['Healthcheck endpoint', 'S'], ['Audit log for admin actions', 'M'], ['Confetti when a team passes 50 votes', 'S'], ['Load test the vote endpoint', 'M'],
];
const HELPERS = [['ui-worker', 'Claude Sonnet 5.5'], ['api-worker', 'Claude Sonnet 5.5'], ['test-writer', 'Claude Haiku 4.5'], ['docs-worker', 'Claude Haiku 4.5'], ['fix-worker', 'Claude Sonnet 5.5']];
const LOCKS = ['src/routes/votes.ts', 'src/db/migrations/', 'src/components/Leaderboard.tsx', 'package-lock.json', 'src/api/client.ts'];
const rootOf = (n) => String(n || '').split('/')[0];
const asOf = (n) => String(n || '').split('/')[1];
const ago = (t) => Date.now() - t.updated_at;
let newTaskIx = 0; let S = null;

const refresh = async () => { S = await human('GET', '/state'); return S; };
const active = (a) => !S.presence.find((p) => p.kind === 'agent' && p.name === a)?.limited;
const dwell = (ms) => ms / SPEED * (0.6 + Math.random() * 0.8);

const actions = {
  async claim() {
    const done = new Set(S.tasks.filter((t) => t.status === 'done').map((t) => t.id));
    const open = S.tasks.filter((t) => t.status === 'open' && !t.reserved_for && t.depends_on.every((d) => done.has(d)));
    if (!open.length) return false;
    const held = (a) => S.tasks.filter((t) => ['claimed', 'in_progress'].includes(t.status) && rootOf(t.assignee) === a).length;
    const free = CAST.filter((c) => c.n !== 'priya-claude' && active(c.n) && held(c.n) < c.slots);
    if (!free.length) return false;
    const c = rnd(free); const t = rnd(open);
    const as = c.client === 'claude-code' && Math.random() < 0.5 ? rnd(HELPERS) : null;
    if (as) await A[c.n].call('board_status', { as: as[0], model: as[1] });
    const r = await A[c.n].call('claim_task', { id: t.id, ...(as ? { as: as[0] } : {}) });
    return r.ok;
  },
  async progress() {
    const t = S.tasks.find((x) => x.status === 'claimed' && ago(x) > dwell(8000) && rootOf(x.assignee) !== 'priya-claude');
    return !!t && (await A[rootOf(t.assignee)].call('update_task', { id: t.id, status: 'in_progress', note: rnd(NOTES), ...(asOf(t.assignee) ? { as: asOf(t.assignee) } : {}) })).ok;
  },
  async review() {
    const t = S.tasks.find((x) => x.status === 'in_progress' && ago(x) > dwell(35000) && rootOf(x.assignee) !== 'priya-claude' && Math.random() < 0.5);
    return !!t && (await A[rootOf(t.assignee)].call('update_task', { id: t.id, status: 'review', note: `PR ready: ${pr()}`, ...(asOf(t.assignee) ? { as: asOf(t.assignee) } : {}) })).ok;
  },
  async done() {
    const t = S.tasks.find((x) => x.status === 'review' && ago(x) > dwell(30000));
    if (!t) return false;
    const r = await A['jon-claude'].call('update_task', { id: t.id, status: 'done', note: rnd(['merged to main', 'merged, checks green', 'merged after one fix']) });
    if (r.ok && asOf(t.assignee)) await A[rootOf(t.assignee)].call('subagent_done', { as: asOf(t.assignee) });
    return r.ok;
  },
  async block() {
    if (S.tasks.filter((t) => t.status === 'blocked').length >= 3 || S.questions.filter((q) => !q.answer).length >= 3) return false;
    const t = S.tasks.find((x) => x.status === 'in_progress' && ago(x) > dwell(25000) && rootOf(x.assignee) !== 'priya-claude');
    if (!t) return false;
    const [why, q] = rnd(BLOCKS); const a = rootOf(t.assignee);
    await A[a].call('update_task', { id: t.id, status: 'blocked', note: why, ...(asOf(t.assignee) ? { as: asOf(t.assignee) } : {}) });
    await A[a].call('ask_human', { question: q, task_id: t.id });
    return true;
  },
  async answer() {
    const q = S.questions.find((x) => !x.answer && Date.now() - x.created_at > dwell(60000));
    if (!q) return false;
    await human('POST', `/questions/${q.id}/answer`, { answer: rnd(['Go with the first option.', 'Use the shared vault, I just added it.', 'Either is fine, keep it simple.', 'Ask me in the standup, but proceed for now.']) }, rnd(HUMANS));
    return true;
  },
  async unblock() {
    const t = S.tasks.find((x) => x.status === 'blocked' && S.questions.some((q) => q.task_id === x.id && q.answer));
    return !!t && (await A[rootOf(t.assignee)].call('update_task', { id: t.id, status: 'in_progress', note: 'unblocked, carrying on', ...(asOf(t.assignee) ? { as: asOf(t.assignee) } : {}) })).ok;
  },
  async plan() {
    const open = S.tasks.filter((t) => t.status === 'open').length;
    if (S.tasks.length > 34 || open > 6) return false;
    const [title, size] = NEW_TASKS[newTaskIx++ % NEW_TASKS.length];
    return (await A['maya-claude'].call('create_task', { title: newTaskIx > NEW_TASKS.length ? `${title} (round 2)` : title, size, priority: rnd([2, 2, 3]) })).ok;
  },
  async approve() {
    const t = S.tasks.find((x) => x.status === 'proposed' && ago(x) > dwell(40000));
    return !!t && (await A['maya-claude'].call('decide_proposal', { id: t.id, approve: true, note: 'good idea, if there is time' })).ok;
  },
  async propose() {
    if (S.tasks.filter((t) => t.status === 'proposed').length >= 2) return false;
    const [title] = rnd(NEW_TASKS);
    return (await A[rnd(['jon-copilot', 'priya-gemini', 'lee-copilot', 'sam-cursor'])].call('create_task', { title: `Idea: ${title}`, size: 'S', priority: 3 })).ok;
  },
  async chat() {
    const c = rnd(CAST.filter((x) => x.n !== 'priya-claude'));
    return (await A[c.n].call('post', { text: rnd(CHAT), channel: rnd(['general', 'general', 'review', 'help']) })).ok;
  },
  async activity() {
    const c = rnd(CAST.filter((x) => x.n !== 'priya-claude'));
    return (await A[c.n].call('set_activity', { doing: rnd(ACTIVITY) })).ok;
  },
  async subagent() {
    const c = rnd(CAST.filter((x) => x.client === 'claude-code' && x.n !== 'priya-claude'));
    const p = S.presence.find((x) => x.kind === 'agent' && x.name === c.n);
    const act = (p?.helpers || []).filter((h) => h.active);
    if (act.length >= 2 || (act.length && Math.random() < 0.5)) {
      const h = rnd(act);
      await A[c.n].call('subagent_done', { as: h.name });
    } else {
      const h = rnd(HELPERS);
      await A[c.n].call('board_status', { as: h[0], model: h[1] });
      await A[c.n].call('set_activity', { as: h[0], doing: rnd(ACTIVITY) });
    }
    return true;
  },
  async lock() {
    const locks = S.locks || [];
    if (locks.length >= 4 && locks.length) {
      const l = rnd(locks);
      return (await A[rootOf(l.owner)]?.call('unlock_files', { paths: [l.path] }))?.ok || false;
    }
    const t = S.tasks.find((x) => x.status === 'in_progress' && rootOf(x.assignee) !== 'priya-claude');
    if (!t) return false;
    return (await A[rootOf(t.assignee)].call('lock_files', { paths: [rnd(LOCKS)], task_id: t.id, reason: 'shared file', ttl_s: 1800 })).ok;
  },
};
const WEIGHTS = { claim: 3, progress: 3, review: 2, done: 3, block: 0.7, answer: 0.6, unblock: 3, plan: 1, approve: 1, propose: 0.5, chat: 3, activity: 2, subagent: 1, lock: 0.8 };

async function tick() {
  try {
    await refresh();
    const pool = Object.keys(WEIGHTS);
    while (pool.length) {
      const total = pool.reduce((n, k) => n + WEIGHTS[k], 0);
      let x = Math.random() * total; let i = 0;
      while (i < pool.length - 1 && (x -= WEIGHTS[pool[i]]) > 0) i++;
      const k = pool.splice(i, 1)[0];
      if (await actions[k]().catch(() => false)) break;
    }
  } catch {}
  simTimer = setTimeout(tick, (3000 + Math.random() * 3000) / SPEED);
}

// Agents stay online (10 minutes of silence marks them offline) and active subagents stay active.
let rounds = 0;
async function keepAlive() {
  try {
    await refresh();
    for (const c of CAST) {
      if (c.n === 'priya-claude') continue; // out of usage: a call would clear that mark
      await A[c.n].call('list_locks');
      const p = S.presence.find((x) => x.kind === 'agent' && x.name === c.n);
      for (const h of (p?.helpers || []).filter((x) => x.active)) await A[c.n].call('set_activity', { as: h.name, doing: h.doing || 'working on its task' });
    }
    // Locks last at most an hour: renew them now and then (not every round, it would fill the feed).
    if (++rounds % 40 === 0) for (const l of S.locks || []) if (A[rootOf(l.owner)] && rootOf(l.owner) !== 'priya-claude') await A[rootOf(l.owner)].call('lock_files', { paths: [l.path], task_id: l.task_id ?? undefined, reason: l.reason || undefined, ttl_s: 1800 });
  } catch {}
}

// ---------- go ----------
try {
  await seed();
} catch (e) {
  console.error('Could not seed the demo board:', e);
  await cleanup(1);
}
db.close();

const url = `${base}/?token=${TOKEN}&name=you`;
console.log(`
 Demo board (fake data, throwaway: your real board is untouched)

   Board (as "you"):  ${url}
   3D office, docked: ${url}&view=office
   Plain board:       ${url}&view=board
   Presenter view:    ${base}/present.html?token=${VIEW_TOKEN}

   Data folder:       ${board.dataDir}

   ${STATIC ? 'Static: seeded once, nothing moves.' : `Live: agents and tasks move every few seconds${SPEED !== 1 ? ` (speed x${SPEED})` : ''}.`}  Ctrl+C to stop (deletes the demo data).
`);
if (flag('open')) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url.replace(/&/g, '^&')]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd, args, { stdio: 'ignore', detached: true }).unref(); } catch {}
}
if (!STATIC) {
  keepTimer = setInterval(keepAlive, 40000);
  simTimer = setTimeout(tick, 4000 / SPEED);
}
