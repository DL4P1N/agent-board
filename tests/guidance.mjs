// next_action and refusal texts: who gets the planner brief, blocked tasks and slots, reviews for the
// author, the planner's slot count, a self-reported usage limit, task sizes, claim refusal reasons.
// Starts its own throwaway board. Run all suites with: npm test
import { startBoard, finish, rest, Client, StreamableHTTPClientTransport } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';

const board = await startBoard();
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + String(x).slice(0, 400) : ''}`);
const AGENT_TOKEN = agentTokenFor(board.token);
const err = (r) => (r && r.error) || '';
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);
const clients = {};

async function agent(name, { client = 'claude-code', plan, slots } = {}) {
  const q = new URLSearchParams({ agent: name, token: AGENT_TOKEN, ...(plan ? { plan } : {}), ...(slots ? { slots: String(slots) } : {}) });
  const c = new Client({ name: client, version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${board.base}/mcp?${q}`)));
  clients[name] = c;
  const call = async (tool, args = {}) => {
    const r = await c.callTool({ name: tool, arguments: args });
    const t = r.content[0].text;
    let body; try { body = JSON.parse(t); } catch { body = t; }
    return r.isError ? { error: t } : body;
  };
  await call('board_status');
  return call;
}
const next = async (call) => (await call('board_status')).next_action || '';
const newTask = (title, extra = {}) => human('/tasks', 'POST', { title, size: 'S', ...extra });

// ================= AG-2: only the planner gets the planner's brief =================
await human('/settings', 'PUT', { goal: 'A test app for guidance texts.' });
const ana = await agent('ana', { plan: 'Claude Max 20x', slots: 3 });
const ben = await agent('ben', { client: 'codex-mcp-client', plan: 'ChatGPT Edu', slots: 1 });
const cy = await agent('cy', { client: 'codex-mcp-client', plan: 'ChatGPT Edu', slots: 1 });
const dee = await agent('dee', { client: 'codex-mcp-client' }); // no plan reported
let n = await next(ben);
check('AG-2: no planner yet: told to claim the role', /claim_role\("planner"\)/.test(n), n);
check('AG-2: no planner yet: no planner brief', !/As planner/.test(n), n);
await ana('claim_role', { role: 'planner' });
n = await next(ana);
check('AG-2: the planner gets the brief', /As planner/.test(n) && /total capacity 6 tasks at once/.test(n), n);
check('AG-2: no "(s)" plurals in the brief', !/\(s\)/.test(n), n);
n = await next(ben);
check('AG-2: a non-planner waits, no brief', /ana is writing the backlog/.test(n) && !/As planner/.test(n), n);

// ================= AG-11: every refusal reason, "no plan given" =================
const T1 = await newTask('first');
const T2 = await newTask('second', { depends_on: [T1.id] });
const T3 = await newTask('third');
const T4 = await newTask('fourth');
const T5 = await newTask('fifth');
await newTask('sixth');
check('dee claims one', !err(await dee('claim_task', { id: T1.id })));
let e = err(await dee('claim_task', { id: T2.id }));
check('AG-11: capacity refusal also names the dependency', /may hold 1 at once/.test(e) && new RegExp(`waits on #${T1.id}`).test(e), e);
check('AG-11: "no plan given", not "(default)"', /no plan given/.test(e) && !/default/.test(e) && !/\(s\)/.test(e), e);

// ================= AG-1: a blocked task doesn't stop claiming =================
await dee('update_task', { id: T1.id, status: 'blocked', note: 'waiting on an API key' });
n = await next(dee);
check('AG-1: blocked task listed as waiting', new RegExp(`Waiting on something[^\\n]*#${T1.id}`).test(n), n);
check('AG-1: no "keep them moving before claiming more" for a blocked task', !/before claiming more/.test(n) && !/You have active tasks/.test(n), n);
check('AG-1: told it can claim other work, and offered some', /Meanwhile you can claim other work/.test(n) && /Claimable now/.test(n), n);

// ================= AG-3: the author isn't asked to merge its own work =================
await ben('claim_task', { id: T3.id });
await ben('update_task', { id: T3.id, status: 'review', branch: 'task/3-third' });
n = await next(ben);
check('AG-3: author of the only review is not told to claim integrator', !/waiting in review and nobody owns main/.test(n), n);
n = await next(cy);
check('AG-3: others are told, with a plural-free count', /1 task is waiting in review and nobody owns main/.test(n), n);

// ================= AG-5: a self-reported usage limit =================
await cy('claim_task', { id: T4.id });
await cy('report_usage_limit', { until: new Date(Date.now() + 2 * 3600e3).toISOString(), note: '5h cap' });
n = await next(cy);
check('AG-5: self-reported limit is described as the agent\'s own', /You reported a usage limit until/.test(n) && !/A human marked/.test(n), n);
check('AG-5: told to release its tasks and stop', new RegExp(`Release your tasks \\(#${T4.id}\\)[^\\n]*stop`).test(n) && !/Claimable now/.test(n), n);
const cyP = (await human('/state')).presence.find((p) => p.name === 'cy');
check('AG-5: the mark is still there (by agent)', cyP.limited?.by === 'agent', JSON.stringify(cyP.limited));
await human('/agents/ben', 'PATCH', { limited: true });
n = await next(ben);
check('AG-5: a human mark still says a human did it', /A human marked you as out of usage/.test(n) && !/this call clears the mark/.test(n), n);
await human('/agents/ben', 'PATCH', { limited: false });

// ================= AG-9: one definition of task sizes =================
const pb = String(await ana('get_playbook'));
check('AG-9: playbook sizes match the web board', /under 30 min/.test(pb) && /about an hour/.test(pb) && !/< 20 min/.test(pb), pb.match(/`size`[^\n]*/)?.[0]);
const tools = await clients.ana.listTools();
const sizeDesc = tools.tools.find((t) => t.name === 'create_task').inputSchema.properties.size.description;
check('AG-9: create_task schema sizes match', /under 30 min/.test(sizeDesc) && /about an hour/.test(sizeDesc), sizeDesc);

// ================= AG-4: the planner's slot count matches the web board =================
await board.restart();
await human('/settings', 'PUT', { goal: 'A test app for planner extra slots.' });
const pp = await agent('pp', { plan: 'Claude Pro', slots: 1 });
const ww = await agent('ww', { client: 'codex-mcp-client', plan: 'ChatGPT Edu', slots: 1 });
await pp('claim_role', { role: 'planner' });
const E = [await newTask('w'), await newTask('s1'), await newTask('s2'), await newTask('s3')];
await ww('claim_task', { id: E[0].id });
await pp('claim_task', { id: E[1].id });
n = await next(pp);
check('AG-4: planner told its plan slots with the extra separate', /you can hold 1 at once \(\+2 extra as planner while others are busy\)/.test(n) && !/hold 3 at once/.test(n), n);
const ppP = (await human('/state')).presence.find((p) => p.name === 'pp');
check('AG-4: web board base matches the 1 in the text', ppP.slots - ppP.extra_slots === 1, JSON.stringify(ppP));

await finish(R, { board });
