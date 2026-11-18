// Direct messages: a human writes to one agent (or to whoever is the planner), the agent answers in the same
// thread. Hidden from other agents (read_events, wait_for_events, /api/events, the stream), every human sees every
// thread, next_action and the Stop hook treat one like a mention, @planner / @merger in the shared chat, and kept
// out of webhooks, the presenter's data and the shared feed. Starts its own throwaway board. Run all suites: npm test
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startBoard, finish, Client, StreamableHTTPClientTransport, ROOT } from './helpers.mjs';
import { agentTokenFor, viewerTokenFor } from '../src/tokens.js';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + String(x).slice(0, 400) : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 5000) => { for (const t0 = Date.now(); Date.now() - t0 < ms;) { const v = await fn(); if (v) return v; await sleep(100); } return null; };

const board = await startBoard();
const AGENT = agentTokenFor(board.token);
const VIEW = viewerTokenFor(board.token);
const call = (p, { method = 'GET', body, token = board.token, as = 'dana' } = {}) => fetch(`${board.base}/api${p}`, {
  method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Agent': as }, body: body && JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const human = (p, body, who = 'dana') => call(p, { method: body ? 'POST' : 'GET', body, as: who }).then((r) => r.body);
const dm = (to, text, who = 'dana') => call('/messages', { method: 'POST', body: { text, to }, as: who });

async function agent(name) {
  const c = new Client({ name: 'claude-code', version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${board.base}/mcp?agent=${encodeURIComponent(name)}&token=${AGENT}`)));
  const fn = async (tool, args = {}) => {
    const r = await c.callTool({ name: tool, arguments: args });
    const t = r.content[0].text;
    let b; try { b = JSON.parse(t); } catch { b = t; }
    return r.isError ? { error: t } : b;
  };
  await fn('board_status');
  return fn;
}

await call('/settings', { method: 'PUT', body: { goal: 'A test app for direct messages.' } });
const maya = await agent('maya-claude');
const emil = await agent('emil-codex');
const cursor0 = (await maya('board_status')).cursor;

// ================= 1. a thread with one agent, hidden from the others =================
const sent = await dm('maya-claude', 'Maya, please keep the login page simple: no social buttons.');
check('a human can message an agent directly (POST /messages with to)', sent.status === 200 && sent.body.channel === 'direct' && sent.body.data?.dm?.thread === 'maya-claude' && sent.body.data?.dm?.from === 'human', JSON.stringify(sent.body));
check('an @name inside a direct message mentions nobody', !(await dm('maya-claude', 'ask @emil-codex later')).body.data?.mentions);
check('messaging an agent the board does not know is refused', /no agent called nobody/.test((await dm('nobody', 'hi')).body?.error || ''));
check('the agent token cannot post a direct message over REST', (await call('/messages', { method: 'POST', body: { text: 'x', to: 'maya-claude' }, token: AGENT, as: 'emil-codex' })).status === 403);

const mine = await maya('read_events', { since: cursor0 });
check('the agent reads its own thread with read_events', mine.events.some((e) => e.id === sent.body.id), JSON.stringify(mine.events.map((e) => e.id)));
const other = await emil('read_events', { since: 0, limit: 500 });
check('another agent cannot read it through read_events', !other.events.some((e) => e.channel === 'direct'), JSON.stringify(other.events.filter((e) => e.channel === 'direct')));
check('not even with channel "direct"', !(await emil('read_events', { since: 0, channel: 'direct' })).events.length);
const restOther = await call(`/events?since=0&exclude=emil-codex`, { token: AGENT, as: 'emil-codex' });
check('nor through /api/events with the agent token (the Stop hook\'s way)', restOther.status === 200 && !restOther.body.events.some((e) => e.channel === 'direct'), JSON.stringify(restOther.body).slice(0, 300));
const restMine = await call(`/events?since=0&exclude=maya-claude`, { token: AGENT, as: 'maya-claude' });
check('the recipient gets it through /api/events', restMine.body.events.some((e) => e.id === sent.body.id));
check('board_status\'s recent activity has no direct messages', !(await emil('board_status')).recent.some((e) => e.channel === 'direct'));
const agentState = await call('/state', { token: AGENT, as: 'emil-codex' });
check('/api/state with the agent token has no threads and no direct messages in events', !('direct' in agentState.body) && !agentState.body.events.some((e) => e.channel === 'direct'));
const viewState = await call('/state', { token: VIEW, as: 'x' });
check('the presenter (viewer token) gets no direct messages', viewState.status === 200 && !('direct' in viewState.body) && !viewState.body.events.some((e) => e.channel === 'direct'));
const humanState = await human('/state');
check('humans get every thread in /api/state (direct), not in the shared feed', humanState.direct?.some((e) => e.id === sent.body.id) && !humanState.events.some((e) => e.channel === 'direct'), JSON.stringify(humanState.direct));
check('another human sees the same thread', (await human('/state', undefined, 'lee')).direct?.some((e) => e.id === sent.body.id));
check('the web feed\'s "load earlier" page has none either', !(await human(`/events?before=${sent.body.id + 10}`)).events.some((e) => e.channel === 'direct'));

// wait_for_events: woken by its own direct message, not by someone else's.
{
  const c = (await emil('board_status')).cursor;
  const w = emil('wait_for_events', { since: c, timeout_s: 2 });
  await sleep(200);
  await dm('maya-claude', 'another one for maya only');
  const r = await w;
  check('wait_for_events does not return another agent\'s direct message', !r.events.some((e) => e.channel === 'direct'), JSON.stringify(r.events));
  const c2 = (await maya('board_status')).cursor;
  const w2 = maya('wait_for_events', { since: c2, timeout_s: 5 });
  await sleep(200);
  const s2 = await dm('maya-claude', 'are you there?', 'lee');
  const r2 = await w2;
  check('wait_for_events wakes the recipient with it', r2.events.some((e) => e.id === s2.body.id), JSON.stringify(r2));
}

// The live stream: humans get it; the presenter and other agents don't.
{
  const listen = (token, as) => {
    const ctl = new AbortController(); const seen = [];
    fetch(`${board.base}/api/stream?token=${token}`, { headers: { 'X-Agent': as }, signal: ctl.signal }).then(async (r) => {
      const rd = r.body.getReader(); const dec = new TextDecoder();
      for (;;) { const { value, done } = await rd.read(); if (done) break; seen.push(dec.decode(value)); }
    }).catch(() => {});
    return { text: () => seen.join(''), stop: () => ctl.abort() };
  };
  const hs = listen(board.token, 'dana'); const vs = listen(VIEW, 'x'); const as = listen(AGENT, 'emil-codex'); const ms = listen(AGENT, 'maya-claude');
  await sleep(400);
  await dm('maya-claude', 'stream-secret-123');
  await until(() => hs.text().includes('stream-secret-123'), 2000);
  await sleep(300);
  check('the live stream sends a direct message to humans', hs.text().includes('stream-secret-123'));
  check('…and to the recipient agent', ms.text().includes('stream-secret-123'));
  check('…but not to the presenter or another agent', !vs.text().includes('stream-secret-123') && !as.text().includes('stream-secret-123'));
  for (const s of [hs, vs, as, ms]) s.stop();
}

// ================= 2. next_action, replies, the Stop hook =================
let na = await maya('board_status');
check('next_action points the agent at the direct message', na.actionable && /messaged you directly/.test(na.next_action) && /no social buttons/.test(na.next_action) && /post\(to: "dana", text: "…"\) \(lee wrote too/.test(na.next_action), na.next_action);
check('…as a reason the Stop hook nudges for', /direct message/.test(na.reason), na.reason);
check('…and tells it to keep the team in the loop', /create_task\) or post a one-line note in general/.test(na.next_action));
check('board_status lists the unanswered direct messages', na.direct_messages.length >= 3 && na.direct_messages.every((m) => m.thread === 'maya-claude'), JSON.stringify(na.direct_messages));
check('another agent\'s next_action says nothing about it', !/messaged you directly/.test((await emil('board_status')).next_action));
const restNext = await call('/next?agent=maya-claude', { token: AGENT, as: 'maya-claude' });
check('/api/next (the Stop hook) is actionable for it', restNext.body.actionable && /messaged you directly/.test(restNext.body.next_action), JSON.stringify(restNext.body));

// The Stop hook marks it like a mention.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'board-dm-hook-'));
  const runHook = (agentName) => new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'hooks', 'board-stop-hook.mjs')], {
      env: { ...process.env, HOME: tmp, USERPROFILE: tmp, TMPDIR: tmp, TEMP: tmp, TMP: tmp, BOARD_URL: board.base, BOARD_TOKEN: AGENT, BOARD_AGENT: agentName, BOARD_HOOK_WAIT: '0' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = ''; child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
    child.stdin.end(JSON.stringify({ stop_hook_active: false }));
    child.on('exit', () => resolve(out));
  });
  const out = await runHook('maya-claude');
  let reason = ''; try { reason = JSON.parse(out).reason; } catch {}
  check('the Stop hook lists the direct message with [MENTIONS YOU]', /no social buttons.*\[MENTIONS YOU\]/.test(reason) && /reply with post\(to: "dana"\)/.test(reason), out.slice(0, 600));
  const outE = await runHook('emil-codex');
  check('another agent\'s Stop hook never shows it', !/no social buttons|stream-secret|are you there/.test(outE), outE.slice(0, 600));
}

let r = await maya('post', { to: 'dana', text: 'Got it: no social buttons. I will add a task for the plain form.' });
check('the agent replies in the thread with post(to)', r.channel === 'direct' && r.data?.dm?.thread === 'maya-claude' && r.data?.dm?.to === 'dana' && r.data?.dm?.from === 'agent', JSON.stringify(r));
check('the reply is hidden from the other agent too', !(await emil('read_events', { since: 0, limit: 500 })).events.some((e) => e.id === r.id));
check('a helper of the agent may reply too, in the same thread', (await maya('post', { to: 'lee', text: 'here', as: 'ui' })).data?.dm?.thread === 'maya-claude');
check('once answered, next_action no longer points at it', !/messaged you directly/.test((await maya('board_status')).next_action));
check('replying to a human who never wrote is refused (says who did)', /eve hasn't messaged you directly.*dana, lee/.test((await maya('post', { to: 'eve', text: 'hi' })).error || ''), (await maya('post', { to: 'eve', text: 'hi' })).error);
check('an agent cannot start a thread', /No human has messaged you directly. Only humans start direct messages/.test((await emil('post', { to: 'dana', text: 'psst' })).error || ''));

// ================= 3. the planner thread =================
const held = await dm('planner', 'Planner: the demo must show the leaderboard first.');
check('with nobody planning, a message to the planner is held (no recipient yet)', held.status === 200 && held.body.data?.dm?.thread === 'planner' && held.body.data?.dm?.to === null, JSON.stringify(held.body));
check('no agent reads the held message', !(await maya('read_events', { since: 0, channel: 'direct', limit: 500 })).events.some((e) => e.id === held.body.id) && !(await emil('read_events', { since: 0, channel: 'direct' })).events.length);
check('nobody\'s next_action mentions it yet', !/planner thread/.test((await maya('board_status')).next_action + (await emil('board_status')).next_action));
const ec = (await emil('board_status')).cursor;
check('emil becomes the planner', !(await emil('claim_role', { role: 'planner' })).error);
na = await emil('board_status');
check('the first planner gets the held message in next_action, with the planner\'s instructions', na.actionable && /In the planner thread/.test(na.next_action) && /leaderboard first/.test(na.next_action) && /treat it as input to the plan/.test(na.next_action) && /create_task, re-prioritise or reserve/.test(na.next_action) && /cancel_task/.test(na.next_action) && /ask_human only if something is unclear/.test(na.next_action) && /Never just acknowledge/.test(na.next_action), na.next_action);
const pe = await emil('read_events', { since: ec, channel: 'direct' });
check('the board says in the thread that the messages went to the new planner (it wakes the planner)', pe.events.some((e) => e.author === 'board' && /emil-codex is the planner now and has 1 message waiting/.test(e.text)), JSON.stringify(pe.events));
check('the planner can read the held message', (await emil('read_events', { since: 0, channel: 'direct' })).events.some((e) => e.id === held.body.id));
check('maya (not the planner) still can\'t', !(await maya('read_events', { since: 0, channel: 'direct', limit: 500 })).events.some((e) => e.thread === 'planner' || e.data?.dm?.thread === 'planner'));
r = await emil('post', { to: 'dana', text: 'Leaderboard first: I moved it to priority 1.' });
check('the planner replies in the planner thread', r.data?.dm?.thread === 'planner' && r.data?.dm?.to === 'dana', JSON.stringify(r));
check('answered: no longer in next_action', !/In the planner thread/.test((await emil('board_status')).next_action));
const live = await dm('planner', 'Also: dark mode can wait.');
check('with a planner, a message to the planner goes to it', live.body.data?.dm?.to === 'emil-codex');
// The planner changes: the unanswered message follows the role.
await call('/settings', { method: 'PUT', body: { planner: 'maya-claude' } });
check('after a change of planner, the new one gets the unanswered message', /In the planner thread.*dark mode can wait/.test((await maya('board_status')).next_action) && !/In the planner thread/.test((await emil('board_status')).next_action));
check('the new planner can read the whole thread', (await maya('read_events', { since: 0, channel: 'direct', limit: 500 })).events.some((e) => e.id === held.body.id));

// ================= 4. @planner and @merger in the shared chat =================
await human('/messages', { text: 'hey @planner, can we add a search box?' });
let st = await human('/state');
let ev = st.events.find((e) => /search box/.test(e.text));
check('@planner is shown with the real name: "@planner (maya-claude)"', ev?.text === 'hey @planner (maya-claude), can we add a search box?', ev?.text);
check('…and stored under the real agent\'s name', ev?.data?.mentions?.includes('maya-claude') && !ev.data.mentions.includes('planner'), JSON.stringify(ev?.data));
await call('/settings', { method: 'PUT', body: { planner: 'emil-codex' } });
await human('/messages', { text: '@planner: what about the footer?' });
st = await human('/state');
ev = st.events.find((e) => /footer/.test(e.text));
check('@planner follows a change of planner', ev?.text === '@planner (emil-codex): what about the footer?' && ev.data.mentions.includes('emil-codex'), JSON.stringify(ev));
const em = await emil('read_events', { since: 0, limit: 500 });
check('the planner sees the alias as a mention of itself (read_events)', em.events.some((e) => /footer/.test(e.text) && e.data?.mentions?.includes('emil-codex')));
await call('/settings', { method: 'PUT', body: { integrator: 'maya-claude' } });
const mg = await emil('post', { text: '#3 is ready, @merger.' });
check('@merger reaches the agent that merges', mg.text === '#3 is ready, @merger (maya-claude).' && mg.data?.mentions?.includes('maya-claude'), JSON.stringify(mg));
await call('/settings', { method: 'PUT', body: { planner: '', integrator: '*' } });
const none = await emil('post', { text: 'is there a @planner yet? @merger?' });
check('with nobody in the role, @planner and @merger stay as typed', none.text === 'is there a @planner yet? @merger?', none.text);
check('the alias is not applied inside words or to other names', (await emil('post', { text: 'see @planners and @planner-bot' })).text === 'see @planners and @planner-bot');

// ================= 5. summary and export =================
const sum = await fetch(`${board.base}/api/summary`, { headers: { Authorization: `Bearer ${board.token}` } }).then((x) => x.text());
check('the summary has a Direct messages section with one section per thread', /## Direct messages/.test(sum) && /### Planner thread/.test(sum) && /### maya-claude/.test(sum) && /dana → maya-claude: Maya, please keep the login page simple/.test(sum) && /maya-claude → dana: Got it/.test(sum), sum.slice(-1500));
check('the planner thread comes first and says when nobody was planning', sum.indexOf('### Planner thread') < sum.indexOf('### maya-claude') && /dana → the planner \(none yet\): Planner: the demo must show/.test(sum));
const sumAgent = await fetch(`${board.base}/api/summary`, { headers: { Authorization: `Bearer ${AGENT}` } }).then((x) => x.text());
check('with the agent token, the summary has no direct messages', !/Direct messages|no social buttons/.test(sumAgent));
const exp = await human('/export');
check('the backup lists each thread on its own', Array.isArray(exp.direct_messages?.planner) && Array.isArray(exp.direct_messages?.['maya-claude']) && !exp.events.some((e) => e.channel === 'direct'), Object.keys(exp.direct_messages || {}).join(','));
const expAgent = await call('/export', { token: AGENT, as: 'emil-codex' });
check('with the agent token, the backup has none', !('direct_messages' in expAgent.body) && !expAgent.body.events.some((e) => e.channel === 'direct'));

// ================= 6. never sent to webhooks =================
{
  const got = [];
  const srv = http.createServer((req, res) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { got.push(b); res.end('ok'); }); });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  await call('/notify', { method: 'PUT', body: { url: `http://localhost:${srv.address().port}/hook`, events: ['questions', 'blocked', 'main', 'conflict', 'freeze', 'limit'] } });
  await dm('maya-claude', 'webhook-secret-456');
  await maya('post', { to: 'dana', text: 'webhook-secret-789' });
  await maya('ask_human', { question: 'Webhook control question?' });
  await until(() => got.some((b) => /Webhook control question/.test(b)), 4000);
  await sleep(300);
  check('webhooks get the question (control) but never a direct message', got.some((b) => /Webhook control question/.test(b)) && !got.some((b) => /webhook-secret/.test(b)), JSON.stringify(got));
  srv.close();
}

await finish(R, { board });
