// Helpers (subagents that pass `as`): recorded on their first call, their own model, finishing with
// subagent_done, going idle, and the shape in /api/state (presence[].helpers). Starts its own throwaway board
// with a short helper idle window (BOARD_HELPER_IDLE_MS). Run all suites with: npm test
import { startBoard, finish, rest, agent } from './helpers.mjs';

const IDLE_MS = 2500;
const board = await startBoard({ env: { BOARD_HELPER_IDLE_MS: String(IDLE_MS) } });
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + String(x).slice(0, 300) : ''}`);
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);
const parent = async (name = 'ana') => (await human('/state')).presence.find((p) => p.kind === 'agent' && p.name === name);
const helper = async (h, name = 'ana') => (await parent(name))?.helpers.find((x) => x.name === h);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Count presence events on the live stream, so we know the web board is told to reload.
let presenceEvents = 0;
const ac = new AbortController();
fetch(`${board.base}/api/stream`, { headers: { Authorization: `Bearer ${board.token}` }, signal: ac.signal }).then(async (r) => {
  const dec = new TextDecoder();
  for await (const chunk of r.body) presenceEvents += (dec.decode(chunk).match(/"kind":"presence"/g) || []).length;
}).catch(() => {});
await sleep(300);

await human('/settings', 'PUT', { goal: 'A small app to test helpers.' });
const ana = await agent(board, 'ana');
await ana('board_status', { model: 'Claude Opus 4.7' });
check('a new agent has an empty helpers list', Array.isArray((await parent()).helpers) && (await parent()).helpers.length === 0, JSON.stringify((await parent()).helpers));

// ---- first call with `as` creates the helper ----
const before = presenceEvents;
const t1 = await ana('create_task', { title: 'Login form', size: 'S' });
await ana('claim_task', { id: t1.id, as: 'Auth Worker' });
const h1 = await helper('auth-worker');
check('helper appears on its first call with `as` (name cleaned, lowercase)', !!h1, JSON.stringify((await parent()).helpers));
check('new helper: active, model unknown (never guessed), not done, has times', h1?.active === true && h1.model === null && h1.done_at === null && h1.started_at > 0 && h1.last_seen >= h1.started_at, JSON.stringify(h1));
check('current task is derived from what the helper claimed', h1?.task_id === t1.id, JSON.stringify(h1));
await sleep(200);
check('a new helper sends a presence event', presenceEvents > before, `${before} -> ${presenceEvents}`);
check('claims are attributed <agent>/<as>', (await human('/state')).tasks.find((t) => t.id === t1.id)?.assignee === 'ana/auth-worker');

// ---- model ----
const ev1 = presenceEvents;
await ana('board_status', { as: 'auth-worker', model: '  Claude Haiku 4.5\u0007\n' + 'x'.repeat(200) });
const m1 = (await helper('auth-worker'))?.model;
check('board_status with as + model sets the helper model, sanitized (no control chars, max 60, trimmed)', typeof m1 === 'string' && m1.startsWith('Claude Haiku 4.5 x') && m1.length <= 60 && !/[\u0000-\u001f]/.test(m1), m1);
check("the parent's own model is unaffected", (await parent()).model === 'Claude Opus 4.7', (await parent()).model);
await sleep(200);
check('a model change sends a presence event', presenceEvents > ev1, `${ev1} -> ${presenceEvents}`);
await ana('board_status', { as: 'auth-worker', model: ' \n ' });
check('a blank model keeps the earlier one', (await helper('auth-worker')).model === m1);
await ana('board_status', { as: 'auth-worker' });
check('board_status with as but no model keeps it', (await helper('auth-worker')).model === m1);

// ---- a second helper is independent ----
await ana('board_status', { as: 'ui-worker', model: 'GPT-5.6' });
const hs = (await parent()).helpers;
check('a second helper is listed next to the first', hs.length === 2 && hs.every((h) => h.active), JSON.stringify(hs.map((h) => h.name)));
check('each helper keeps its own model', (await helper('ui-worker')).model === 'GPT-5.6' && (await helper('auth-worker')).model === m1);
check('the second helper has no task', (await helper('ui-worker')).task_id === null);
await ana('set_activity', { doing: 'styling the form', as: 'ui-worker' });
check("set_activity with as records the helper's note, not the parent's", (await helper('ui-worker')).doing === 'styling the form' && !(await parent()).activity, JSON.stringify(await helper('ui-worker')));
check('a call without as does not create a helper or change models', (await parent()).helpers.length === 2 && (await parent()).model === 'Claude Opus 4.7');
await ana('board_status', { as: 'ana' });
check('as equal to the agent itself is not a helper', (await parent()).helpers.length === 2);
await ana('board_status', { as: 'evil/ben' });
check('as with a slash cannot pose as another agent (kept as a helper of ana)', !!(await helper('ben')) && !(await human('/state')).presence.some((p) => p.name === 'ben'));

// ---- done ----
const ev2 = presenceEvents;
const d = await ana('subagent_done', { as: 'auth-worker' });
const hd = await helper('auth-worker');
check('subagent_done marks the helper inactive with done_at', d.done === true && hd.active === false && hd.done_at > 0, JSON.stringify(hd));
check('the other helper stays active', (await helper('ui-worker')).active === true);
await sleep(200);
check('finishing sends a presence event', presenceEvents > ev2, `${ev2} -> ${presenceEvents}`);
const noAs = await ana('subagent_done').catch((e) => String(e));
check('subagent_done without as is refused', typeof noAs === 'string' || noAs.done !== true, JSON.stringify(noAs));
await ana('board_status', { as: 'auth-worker' });
const back = await helper('auth-worker');
check('a later call with the same as starts the helper again', back.active === true && back.done_at === null, JSON.stringify(back));
await ana('subagent_done', { as: 'auth-worker' });

// ---- idle window ----
await sleep(IDLE_MS + 400);
const idle = await helper('ui-worker');
check('a helper with no call for the idle window is inactive (without done_at)', idle.active === false && idle.done_at === null, JSON.stringify(idle));
check('the parent is still online (only helpers use the short window)', (await parent()).online === true);
await ana('board_status', { as: 'ui-worker' });
check('a call after going idle brings the helper back', (await helper('ui-worker')).active === true);

// ---- state shape ----
const st = await human('/state');
const h = st.presence.find((p) => p.name === 'ana').helpers[0];
check('/api/state helper has exactly name, model, active, started_at, last_seen, done_at, task_id, doing', JSON.stringify(Object.keys(h).sort()) === JSON.stringify(['active', 'doing', 'done_at', 'last_seen', 'model', 'name', 'started_at', 'task_id']), Object.keys(h).join(','));
check('active helpers are listed before finished ones', (() => { const l = st.presence.find((p) => p.name === 'ana').helpers; return l.findIndex((x) => !x.active) === -1 || l.slice(l.findIndex((x) => !x.active)).every((x) => !x.active); })());

// ---- survives a restart (SQLite) ----
await board.relaunch();
const after = (await human('/state')).presence.find((p) => p.name === 'ana');
check('helpers and their models survive a server restart', after?.helpers.some((x) => x.name === 'ui-worker' && x.model === 'GPT-5.6') && after.helpers.some((x) => x.name === 'auth-worker' && x.done_at), JSON.stringify(after?.helpers));

ac.abort();
await finish(R, { board });
