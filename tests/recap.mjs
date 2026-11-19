// The session recap (GET /api/recap, src/recap.js): the numbers on a seeded board whose event times are set
// minute by minute, the default span (since the current goal was set), ?since=, and who may read it.
// Run all suites with: npm test
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startBoard, finish, agent, rest, tempDir } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';
import { Board } from '../src/board.js';
import { recap } from '../src/recap.js';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + x : ''}`);
const board = await startBoard();
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);
const get = (p, token = board.token) => fetch(`${board.base}/api${p}`, { headers: { Authorization: `Bearer ${token}` } });

// Every event written since the last mark happened at minute `min` (set in the database at the end).
const marks = [];
const at = async (min) => marks.push([(await human('/cursor')).cursor, min]);
const T0 = Date.now() - 3 * 3600e3;
const M = (min) => T0 + min * 60e3;

try {
  await human('/messages', 'POST', { text: 'Before the session' });
  await at(-60);
  const ana = await agent(board, 'ana-claude');
  const bob = await agent(board, 'bob-claude');
  await ana('board_status'); await bob('board_status');
  await human('/settings', 'PUT', { goal: 'Recap test <b>app</b>', require_approval: true, integrator: '*', planner: 'ana-claude' });
  await at(0);
  const T = [];
  for (const title of ['Login', 'Search', 'Design pass', 'Docs']) T.push(await human('/tasks', 'POST', { title, size: 'S' }));
  await at(1);
  await human('/settings', 'PUT', { plan_approved: true });
  await at(2);
  const prop = await bob('create_task', { title: 'Proposed by bob' });
  await human(`/tasks/${prop.id}/decide`, 'POST', { approve: true });
  await at(3);
  await ana('claim_task', { id: T[0].id }); await ana('update_task', { id: T[0].id, status: 'in_progress' });
  await bob('claim_task', { id: T[1].id }); await bob('update_task', { id: T[1].id, status: 'in_progress' });
  await at(5);
  const q = await bob('ask_human', { question: 'Which API key? <img src=x onerror=alert(1)>', task_id: T[1].id });
  await bob('update_task', { id: T[1].id, status: 'blocked', note: 'need the API key' });
  await at(10);
  await human(`/questions/${q.question_id}/answer`, 'POST', { answer: 'the staging one' });
  await bob('update_task', { id: T[1].id, status: 'in_progress', note: 'got the key' });
  await at(30);
  await ana('update_task', { id: T[0].id, status: 'review', note: 'ready' });
  await at(35);
  await bob('claim_review', { id: T[0].id }); await bob('update_task', { id: T[0].id, status: 'done' });
  await at(40);
  await bob('update_task', { id: T[1].id, status: 'review' });
  await at(45);
  await ana('claim_review', { id: T[1].id }); await ana('update_task', { id: T[1].id, status: 'done' });
  await human('/settings', 'PUT', { goal: 'Recap test <b>app</b>, edited' });
  await at(50);
  await ana('claim_task', { id: T[2].id });
  await at(55);
  await ana('update_task', { id: T[2].id, status: 'blocked', note: 'need the design' });
  await at(60);
  await human('/messages', 'POST', { text: 'Last word' });
  await at(70);

  // Set the times: events, then the questions from their events.
  const db = new DatabaseSync(path.join(board.dataDir, 'board.db'));
  let prev = 0;
  for (const [id, min] of marks) { db.prepare('UPDATE events SET ts = ? WHERE id > ? AND id <= ?').run(M(min), prev, id); prev = id; }
  for (const e of db.prepare("SELECT ts, kind, data FROM events WHERE kind IN ('question', 'answer')").all()) {
    const qid = JSON.parse(e.data).question_id;
    db.prepare(`UPDATE questions SET ${e.kind === 'question' ? 'created_at' : 'answered_at'} = ? WHERE id = ?`).run(e.ts, qid);
  }
  db.close();

  const r = await get('/recap');
  const x = await r.json();
  check('humans can read the recap', r.status === 200, String(r.status));
  check('default span: since the goal was set (not the first event, not the goal edit)', x.since === M(0) && x.default_span === true, `${(x.since - T0) / 60e3}`);
  check('the span ends at the last event', x.until === M(70), `${(x.until - T0) / 60e3}`);
  check('the goal is the current one, as given', x.goal === 'Recap test <b>app</b>, edited', x.goal);
  check('tasks: 2 done of 5 (the approved proposal counts)', x.tasks.done === 2 && x.tasks.total === 5, JSON.stringify(x.tasks));
  check('merges to main: 2', x.merges === 2, String(x.merges));
  check('questions: 1 asked, 1 answered', x.questions.asked === 1 && x.questions.answered === 1, JSON.stringify(x.questions));
  const a = x.agents.find((y) => y.name === 'ana-claude'); const b = x.agents.find((y) => y.name === 'bob-claude');
  const min = (ms) => ms / 60e3;
  check('ana: 1 done, 35m working, 15m waiting (review, then blocked), no questions', a && a.done === 1 && min(a.working_ms) === 35 && min(a.waiting_ms) === 15 && a.questions === 0, JSON.stringify(a));
  check('bob: 1 done, 20m working, 25m waiting (blocked on his question, then review), 1 question', b && b.done === 1 && min(b.working_ms) === 20 && min(b.waiting_ms) === 25 && b.questions === 1, JSON.stringify(b));
  check('only agents in the agents list', x.agents.length === 2 && !x.agents.some((y) => y.name === 'dana'), JSON.stringify(x.agents.map((y) => y.name)));
  const d = x.humans.find((y) => y.name === 'dana');
  check('dana: 1 answered, 2 approvals (the task list, a proposal)', d && d.answered === 1 && d.approvals === 2 && x.humans.length === 1, JSON.stringify(x.humans));
  check('slowest: Search 45m, then Login 35m', x.slowest.length === 2 && x.slowest[0].id === T[1].id && min(x.slowest[0].ms) === 45 && x.slowest[1].id === T[0].id && min(x.slowest[1].ms) === 35 && x.slowest[0].owner === 'bob-claude', JSON.stringify(x.slowest));
  const [b1, b2] = x.blocks;
  check('longest block: Search 20m, unblocked by bob ("got the key") after dana answered', b1 && b1.id === T[1].id && min(b1.ms) === 20 && !b1.still && b1.by === 'bob-claude' && b1.to === 'in_progress' && b1.note === 'got the key' && b1.answered_by === 'dana' && /Which API key/.test(b1.question), JSON.stringify(b1));
  check('then Design pass 10m, still blocked', b2 && b2.id === T[2].id && min(b2.ms) === 10 && b2.still && !b2.by && x.blocks.length === 2, JSON.stringify(b2));
  check('timeline: done at minutes 40 and 50', JSON.stringify(x.done_at) === JSON.stringify([M(40), M(50)]), JSON.stringify(x.done_at.map((t) => (t - T0) / 60e3)));

  // A later start: only what happened after it.
  const y = await (await get(`/recap?since=${M(52)}`)).json();
  check('?since=: tasks finished before it are left out', y.since === M(52) && y.default_span === false && y.tasks.done === 0 && y.tasks.total === 3 && y.merges === 0 && !y.slowest.length, JSON.stringify(y.tasks));
  check('?since=: times are cut at its start (ana 5m working, 10m blocked)', min(y.agents.find((z) => z.name === 'ana-claude')?.working_ms) === 5 && min(y.agents.find((z) => z.name === 'ana-claude')?.waiting_ms) === 10, JSON.stringify(y.agents));
  const iso = await (await get(`/recap?since=${encodeURIComponent(new Date(M(52)).toISOString())}`)).json();
  check('?since= takes an ISO date too', iso.since === M(52), String(iso.since));
  check('a bad since is refused', (await get('/recap?since=soon')).status === 400);

  // Who may read it: humans and the viewer token, not agents.
  const st = await human('/state');
  check('the viewer token reads the recap', (await get('/recap', st.setup.viewer_token)).status === 200);
  check('the agent token does not', (await get('/recap', agentTokenFor(board.token))).status === 403);
  check('no token: refused', (await fetch(`${board.base}/api/recap`)).status === 401);
} catch (e) {
  check('recap suite ran', false, e.stack);
}

// The first claim is the first move to claimed / in progress, whoever made it: a task a human assigned (or moved
// with an owner) counts from then, like one an agent claimed. (In process, on a board of its own.)
const hb = new Board(tempDir());
try {
  const ids = ['assigned by a human', 'moved by a human', 'claimed by an agent'].map((title) => hb.createTask('dana', { title, size: 'S' }, { human: true }).id);
  const marksB = [];
  const mark = (min) => marksB.push([hb.latestEventId(), min]);
  mark(0);
  hb.updateTask('dana', ids[0], { assignee: 'carl' }, { human: true }); mark(10);
  hb.updateTask('dana', ids[1], { status: 'in_progress', assignee: 'carl' }, { human: true }); mark(20);
  hb.claimTask('eve', ids[2]); mark(30);
  for (const id of ids) hb.updateTask('dana', id, { status: 'done' }, { human: true });
  mark(60);
  let prev = 0;
  for (const [id, min] of marksB) { hb.db.prepare('UPDATE events SET ts = ? WHERE id > ? AND id <= ?').run(M(min), prev, id); prev = id; }
  const xs = recap(hb, { since: M(-1) }).slowest;
  const mins = Object.fromEntries(xs.map((s) => [s.id, s.ms / 60e3]));
  check('recap slowest: human-assigned and human-moved tasks count from their first claim', mins[ids[0]] === 50 && mins[ids[1]] === 40 && mins[ids[2]] === 30, JSON.stringify(xs));
  const stats = hb.computeTaskStats();
  check('task stats (S minutes) count every first claim, not only claim_task', stats?.minutes?.S === 40, JSON.stringify(stats));
} catch (e) {
  check('first-claim checks ran', false, e.stack);
} finally { hb.close(); }
await finish(R, { board });
