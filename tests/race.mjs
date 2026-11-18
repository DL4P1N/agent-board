// Concurrency evidence: many agents race for the same thing at the same moment, over real MCP connections.
// One task, N agents: exactly one claim wins, the rest are told who has it, and the board shows one holder.
// A pool of tasks, N agents each trying several: no task gets two holders and nobody holds more than allowed.
// Also the planner role and a file lock. Run all suites with: npm test
import { startBoard, finish, rest, Client, StreamableHTTPClientTransport } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';

const N = 24; // agents racing
const ROUNDS = 8; // single-task races
const board = await startBoard();
const AG = agentTokenFor(board.token);
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + x : ''}`);
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);

// An MCP client per agent, each on its own connection. call() returns {ok, body}; refusals are expected here.
async function connect(name) {
  // A plain MCP client, so each racer may hold 1 task (Claude Code without a plan may hold 2: it runs helpers).
  const c = new Client({ name: 'race-client', version: '1.0.0' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${board.base}/mcp?agent=${name}&token=${AG}&laptop=lap-${name}`)));
  return async (tool, args = {}) => {
    const r = await c.callTool({ name: tool, arguments: args });
    const t = r.content[0].text;
    let body; try { body = JSON.parse(t); } catch { body = t; }
    return { ok: !r.isError, body, name };
  };
}
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

try {
  await human('/settings', 'PUT', { goal: 'A race track: many agents, one board, nobody steps on anybody' });
  const names = Array.from({ length: N }, (_, i) => `racer${String(i).padStart(2, '0')}-claude`);
  const agents = await Promise.all(names.map(connect));
  await Promise.all(agents.map((a) => a('board_status')));

  // ---- one task, N claims at once, several rounds ----
  const bad = [];
  for (let round = 0; round < ROUNDS; round++) {
    const t = (await human('/tasks', 'POST', { title: `Race task ${round}`, priority: 1 }));
    const res = await Promise.all(shuffle(agents).map((a) => a('claim_task', { id: t.id })));
    const wins = res.filter((r) => r.ok);
    const state = await human('/state');
    const task = state.tasks.find((x) => x.id === t.id);
    const claims = state.events.filter((e) => e.task_id === t.id && e.kind === 'task_claimed');
    const told = res.filter((r) => !r.ok).every((r) => wins[0] && String(r.body).includes(wins[0].name));
    if (wins.length !== 1 || task.assignee !== wins[0]?.name || task.status !== 'claimed' || claims.length !== 1 || !told) {
      bad.push(`round ${round}: ${wins.length} wins (${wins.map((w) => w.name)}), board says ${task.assignee}/${task.status}, ${claims.length} claim events, losers told: ${told}; e.g. ${res.find((r) => !r.ok)?.body}`);
    }
    // Free the winner for the next round.
    await human(`/tasks/${t.id}`, 'PATCH', { status: 'done', force: true });
  }
  check(`${N} agents claim one task at the same moment, ${ROUNDS} times: exactly one wins each time, the board shows that one, the others are told who has it`, !bad.length, bad.join(' | '));

  // ---- a pool of tasks: every agent tries them all, in its own random order, all at once ----
  const pool = [];
  for (let i = 0; i < 10; i++) pool.push((await human('/tasks', 'POST', { title: `Pool task ${i}` })).id);
  const results = await Promise.all(agents.map(async (a) => {
    const mine = [];
    for (const id of shuffle(pool)) { const r = await a('claim_task', { id }); if (r.ok) mine.push(id); }
    return { mine };
  }));
  const winsPerTask = new Map();
  results.forEach((r, i) => r.mine.forEach((id) => winsPerTask.set(id, [...(winsPerTask.get(id) || []), names[i]])));
  const st = await human('/state');
  const doubled = [...winsPerTask].filter(([, w]) => w.length > 1);
  const over = results.map((r, i) => [names[i], r.mine.length]).filter(([, n]) => n > 1);
  const mismatch = pool.filter((id) => { const t = st.tasks.find((x) => x.id === id); const w = winsPerTask.get(id); return w ? t.assignee !== w[0] : !!t.assignee; });
  check('a pool of 10 tasks raced by 24 agents: no task has two holders', !doubled.length, JSON.stringify(doubled));
  check('nobody holds more tasks than its limit (1 without a plan)', !over.length, JSON.stringify(over));
  check('every task is claimed (24 agents, 10 tasks) and the board agrees with the winners', winsPerTask.size === pool.length && !mismatch.length, `${winsPerTask.size} claimed; mismatched: ${mismatch}`);

  // ---- the planner role: everyone grabs it at once ----
  const roles = await Promise.all(shuffle(agents).map((a) => a('claim_role', { role: 'planner' })));
  const planners = roles.filter((r) => r.ok && !r.body.already);
  const planner = (await human('/state')).settings.planner;
  const already = roles.filter((r) => r.ok && r.body.already).length;
  // The board may already have picked a planner (the first agent to see the goal): then it keeps it.
  check('the planner role raced by 24 agents: one holder, everyone else told to carry on', planners.length + already <= 1 && roles.filter((r) => !r.ok).every((r) => /already the planner/.test(String(r.body))) && names.includes(planner), `${planners.length} took it, ${already} already had it, settings: ${planner}`);

  // ---- one file lock, everyone at once ----
  const locks = await Promise.all(shuffle(agents).map((a) => a('lock_files', { paths: ['src/shared/config.ts'], reason: 'race' })));
  const holders = locks.filter((r) => r.ok && r.body.ok);
  const listed = (await human('/state')).locks.filter((l) => l.path === 'src/shared/config.ts');
  check('one file locked by 24 agents at once: one holder, the rest get the conflict', holders.length === 1 && listed.length === 1 && listed[0].owner === holders[0].name
    && locks.filter((r) => r !== holders[0]).every((r) => r.body.ok === false && r.body.conflicts?.[0]?.path === 'src/shared/config.ts'), `${holders.length} holders; listed ${JSON.stringify(listed)}`);
} catch (e) {
  R.push(`CRASH ${e.stack || e}`);
}
await finish(R, { board });
