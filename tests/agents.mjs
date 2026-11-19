// Agents helping themselves: reporting their own usage limit (MCP tool, REST for the Stop hook, and
// the hook reading Claude Code's transcript), the pre-review reminder on claim, and planning stats.
// Starts its own throwaway board. Run all suites with: npm test
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { startBoard, finish, rest, ROOT, Client, StreamableHTTPClientTransport, tempDir } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';

const board = await startBoard();
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + String(x).slice(0, 300) : ''}`);
const AGENT_TOKEN = agentTokenFor(board.token);
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);
const state = () => human('/state');
const agentP = async (name) => (await state()).presence.find((p) => p.kind === 'agent' && p.name === name);
const db = (fn) => { const d = new DatabaseSync(path.join(board.dataDir, 'board.db')); try { d.exec('PRAGMA busy_timeout = 5000'); return fn(d); } finally { d.close(); } };
const post = async (p, body, { token = AGENT_TOKEN, as } = {}) => {
  const r = await fetch(`${board.base}/api${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(as ? { 'X-Agent': as } : {}) }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
async function agent(name, client = 'claude-code') {
  const q = new URLSearchParams({ agent: name, token: AGENT_TOKEN });
  const c = new Client({ name: client, version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${board.base}/mcp?${q}`)));
  const call = async (tool, args = {}) => {
    const r = await c.callTool({ name: tool, arguments: args });
    const t = r.content[0].text;
    let body; try { body = JSON.parse(t); } catch { body = t; }
    return r.isError ? { error: t } : body;
  };
  await call('board_status');
  return call;
}
// Clears a usage-limit mark directly, so the next step starts clean.
const unmark = (name) => human(`/agents/${name}`, 'PATCH', { limited: false });

await human('/settings', 'PUT', { goal: 'A small app to test agents helping themselves.' });
const ana = await agent('ana');
const ben = await agent('ben', 'codex-mcp-client');

// ================= 1. usage limits reported by the agent =================
const t1 = await human('/tasks', 'POST', { title: 'Login form', size: 'S' });
await ana('claim_task', { id: t1.id });
const rep = await ana('report_usage_limit', { until: '23:59', note: 'Max 5x weekly limit' });
check('report_usage_limit via MCP marks the agent itself', !rep.error && rep.limited?.by === 'agent' && rep.limited?.note === 'Max 5x weekly limit' && rep.limited?.until > Date.now(), JSON.stringify(rep));
let st = await state();
check('@all message lists its tasks for takeover', st.events.some((e) => /@all ana hit its usage limit/.test(e.text) && new RegExp(`#${t1.id}`).test(e.text)), st.events.at(-1)?.text);
check('presence shows limited.by = "agent"', (await agentP('ana')).limited?.by === 'agent');
const take = await ben('release_task', { id: t1.id, note: 'owner out of usage' });
check('another agent may take its task over', !take.error && take.status === 'open', JSON.stringify(take));
await unmark('ana');

// REST, as the Stop hook calls it: only for yourself with the agent token
let r = await post('/agents/ana/limit', { until: '3pm', note: 'hook' }, { as: 'ana' });
check('REST limit with the agent token, for itself: OK', r.status === 200 && r.body.limited?.by === 'agent', JSON.stringify(r));
await unmark('ana');
r = await post('/agents/ben/limit', {}, { as: 'ana' });
check('REST limit with the agent token, for another agent: 403', r.status === 403 && /own usage limit/.test(r.body.error || ''), JSON.stringify(r));
r = await post('/agents/ben/limit', { note: 'seen on the web board' }, { token: board.token, as: 'dana' });
check('a human may mark any agent (by = human)', r.status === 200 && r.body.limited?.by === 'human', JSON.stringify(r));
await unmark('ben');
r = await post('/agents/ana/limit', { until: 'next tuesday-ish' }, { as: 'ana' });
check('a bad reset time is refused', r.status === 400 && /until must be a time/.test(r.body.error || ''), JSON.stringify(r));

// ================= 2. the Stop hook sees the limit in the transcript =================
const tmp = tempDir('board-hook-');
const line = (o) => JSON.stringify({ timestamp: new Date().toISOString(), ...o });
function runHook(transcript, agentName = 'ana', extra = {}, nodeArgs = []) {
  const tp = path.join(tmp, `t-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  fs.writeFileSync(tp, transcript.join('\n') + '\n');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...nodeArgs, path.join(ROOT, 'hooks', 'board-stop-hook.mjs')], {
      // HOME pointed at an empty folder: the hook must use the env config, not a real ~/.agent-board.json.
      env: { ...process.env, HOME: tmp, USERPROFILE: tmp, TMPDIR: tmp, TEMP: tmp, TMP: tmp, BOARD_URL: board.base, BOARD_TOKEN: AGENT_TOKEN, BOARD_AGENT: agentName, BOARD_HOOK_WAIT: '0', ...extra },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = ''; child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
    child.stdin.end(JSON.stringify({ transcript_path: tp, stop_hook_active: false }));
    child.on('exit', (code) => resolve({ code, out }));
  });
}
const userLine = line({ type: 'user', message: { role: 'user', content: 'continue with the board' } });
let h = await runHook([userLine, line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: "You've hit your usage limit · resets 3pm" }] } })]);
let pa = await agentP('ana');
check('hook: a short assistant limit notice marks the agent (by agent)', h.code === 0 && pa.limited?.by === 'agent' && /reported by its Stop hook/.test(pa.limited?.note || ''), `${h.out} ${JSON.stringify(pa.limited)}`);
check('hook: the reset time "3pm" is parsed', pa.limited?.until && new Date(pa.limited.until).getHours() === 15, JSON.stringify(pa.limited));
check('hook: lets Claude stop (no block decision)', !/"decision"\s*:\s*"block"/.test(h.out), h.out);
const before = (await state()).events.filter((e) => /hit its usage limit/.test(e.text)).length;
await unmark('ana');
h = await runHook([userLine, line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: "You've hit your usage limit · resets 3pm" }] } })]);
check('hook: a different notice (new timestamp) is reported again', (await agentP('ana')).limited?.by === 'agent');
await unmark('ana');

// Claude Code's own API-error line with an epoch reset: "Claude AI usage limit reached|<seconds>"
const reset = Math.floor((Date.now() + 2 * 3600e3) / 1000);
await runHook([userLine, line({ type: 'assistant', isApiErrorMessage: true, message: { role: 'assistant', content: [{ type: 'text', text: `Claude AI usage limit reached|${reset}` }] } })]);
pa = await agentP('ana');
check('hook: "usage limit reached|<epoch>" sets until from the epoch', pa.limited && Math.abs(pa.limited.until - reset * 1000) < 2000, JSON.stringify(pa.limited));
await unmark('ana');

// Not a limit: a long tool result or a long assistant text that merely mentions limits.
const longTool = 'Playbook: **Usage limits:** if you hit a usage or rate limit, call report_usage_limit ... '.repeat(10);
await runHook([userLine,
  line({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: longTool }] } }),
  line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: `I read the playbook. ${longTool}` }] } }),
  line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done with #1, moving on.' }] } })]);
check('hook: tool results and long texts that mention limits do not trigger', !(await agentP('ana')).limited);
// An old notice (over 10 minutes) doesn't count either.
await runHook([line({ type: 'assistant', timestamp: new Date(Date.now() - 20 * 60e3).toISOString(), message: { role: 'assistant', content: [{ type: 'text', text: "You've hit your usage limit · resets 3pm" }] } })].map((l) => l));
check('hook: a notice older than 10 minutes does not trigger', !(await agentP('ana')).limited);
// Missing transcript: no crash, normal behaviour.
h = await runHook([]);
check('hook: an empty transcript is fine', h.code === 0 && !(await agentP('ana')).limited, h.out);
// The very same notice (same line, same time) is reported only once, even if Claude stops again.
const same = [userLine, line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: "You've hit your session limit · resets 4pm" }] } })];
await runHook(same);
const n1 = (await state()).events.filter((e) => /hit its usage limit/.test(e.text)).length;
await unmark('ana');
await runHook(same);
const n2 = (await state()).events.filter((e) => /hit its usage limit/.test(e.text)).length;
check('hook: the same notice is not reported twice', n1 > before && n2 === n1 && !(await agentP('ana')).limited, `${before} → ${n1} → ${n2}`);
// The hook keeps its state in one file per user (~/.agent-board-hook.json, one entry per board + agent),
// not in loose files in the temp folder; entries unused for 30 days are dropped when it saves.
const stateFile = path.join(tmp, '.agent-board-hook.json');
let hookState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const anaKey = Object.keys(hookState).find((k) => k.endsWith('|ana'));
check('hook: its state is one entry per board + agent in ~/.agent-board-hook.json, no files in the temp folder',
  !!anaKey && Number.isFinite(hookState[anaKey].cursor) && !!hookState[anaKey].limit && !fs.readdirSync(tmp).some((f) => /cursor/.test(f)), JSON.stringify(hookState));
hookState['0123456789abcdef|old-agent'] = { cursor: 5, seen: Date.now() - 31 * 24 * 3600e3 };
hookState['0123456789abcdef|recent-agent'] = { cursor: 7, seen: Date.now() - 2 * 24 * 3600e3 };
fs.writeFileSync(stateFile, JSON.stringify(hookState));
await runHook([]);
hookState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
// The board leaves out the agent's own events; the hook also leaves out its own subagents' (ana/<name>).
await ana('post', { text: 'note from my own subagent', as: 'helper' });
await ben('post', { text: 'note from ben' });
h = await runHook([]);
check('hook: its own subagents\' posts don\'t wake it, a teammate\'s does', /note from ben/.test(h.out) && !/note from my own subagent/.test(h.out), h.out);
check('hook: entries unused for 30 days are dropped, newer ones kept', !hookState['0123456789abcdef|old-agent'] && !!hookState['0123456789abcdef|recent-agent'] && !!hookState[anaKey], Object.keys(hookState).join(','));
// More than the last 40 events at once: a mention, a direct message and an answer to its question are never
// left out (the cursor moves past all of them); the rest says how many earlier ones aren't shown.
{
  await runHook([]); // the cursor is now at the newest event
  const q = await ana('ask_human', { question: 'Hook test: which port?' });
  await human('/messages', 'POST', { text: '@ana EARLY MENTION, look at this' });
  await human('/messages', 'POST', { text: 'EARLY DIRECT message for ana', to: 'ana' });
  await human(`/questions/${q.question_id}/answer`, 'POST', { answer: 'EARLY ANSWER 8080' });
  for (let i = 0; i < 50; i++) await ben('post', { text: `chatter ${i}` });
  h = await runHook([]);
  const shownChatter = (h.out.match(/chatter \d+/g) || []).length;
  check('hook: early mentions, direct messages and answers are shown even past the last 40 events', ['EARLY MENTION', 'EARLY DIRECT', 'EARLY ANSWER'].every((s) => h.out.includes(s)) && shownChatter === 37 && /chatter 49/.test(h.out) && !/chatter 12\b/.test(h.out), h.out.slice(0, 300));
  check('hook: …and says how many earlier events it left out', /\(13 earlier events not shown\)/.test(h.out), h.out.slice(0, 300));
}
// An answer reaches its asker even when that name can never be an @mention (one starting with a digit).
{
  const bot = await agent('2bot');
  await runHook([], '2bot');
  const q = await bot('ask_human', { question: 'Hook test: which database?' });
  await human(`/questions/${q.question_id}/answer`, 'POST', { answer: 'DIGIT ANSWER sqlite' });
  for (let i = 0; i < 45; i++) await ben('post', { text: `noise ${i}` });
  h = await runHook([], '2bot');
  check('hook: an answer to an agent whose name starts with a digit is kept past the last 40 events, marked for it',
    /DIGIT ANSWER sqlite[^\n]*\[MENTIONS YOU\]/.test(h.out) && /noise 44/.test(h.out), h.out.slice(0, 300));
}
// Several hooks for one board share ~/.agent-board-hook.json. One that waited while another saved must not undo
// that save: its agent's cursor never goes back, fields it didn't change and other entries are kept.
{
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const readState = () => JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const latest = async () => (await human('/cursor')).cursor;
  await runHook([]); // the cursor is now at the newest event
  const waiting = runHook([], 'ana', { BOARD_HOOK_WAIT: '15' });
  await sleep(2500); // it has read its state and is waiting for events
  const s = readState();
  const ahead = s[anaKey].cursor + 1000;
  s[anaKey] = { ...s[anaKey], cursor: ahead, nudge: 12345 };
  s['0123456789abcdef|other-session'] = { cursor: 3, seen: Date.now() };
  fs.writeFileSync(stateFile, JSON.stringify(s));
  await ben('post', { text: 'wakes the waiting hook' });
  h = await waiting;
  let after = readState();
  check('hook: a save made meanwhile by another hook is merged (cursor never goes back, its fields and entries kept)',
    /wakes the waiting hook/.test(h.out) && after[anaKey].cursor === ahead && after[anaKey].nudge === 12345 && after['0123456789abcdef|other-session']?.cursor === 3,
    `${JSON.stringify(after[anaKey])} ${h.out.slice(0, 200)}`);
  // That cursor is past the board's newest event (as after a fresh board): the next stop still starts over.
  await runHook([]);
  after = readState();
  const now = await latest();
  check('hook: a cursor past the board\'s newest event is still reset', after[anaKey].cursor <= now, `${after[anaKey].cursor} > ${now}`);
  // The short lock around the save: a stale one (left by a crashed hook) is cleared, a held one is waited for briefly, never hung on.
  const lock = `${stateFile}.lock`;
  fs.writeFileSync(lock, '');
  fs.utimesSync(lock, new Date(Date.now() - 60e3), new Date(Date.now() - 60e3));
  await ben('post', { text: 'after a stale lock' });
  h = await runHook([]);
  check('hook: a stale state lock is cleared and the save goes through', /after a stale lock/.test(h.out) && !fs.existsSync(lock) && readState()[anaKey].cursor === await latest(), h.out.slice(0, 200));
  fs.writeFileSync(lock, '');
  const before = readState()[anaKey].cursor;
  await ben('post', { text: 'while the lock is held' });
  const t0 = Date.now();
  h = await runHook([]);
  const took = Date.now() - t0;
  // Saving without the lock could undo another hook's save: it skips the save (the next stop reports the event again).
  check('hook: a held state lock doesn\'t hold it up: it skips the save and leaves the lock to its owner',
    h.code === 0 && /while the lock is held/.test(h.out) && took < 5000 && fs.existsSync(lock) && readState()[anaKey].cursor === before, `${took}ms ${readState()[anaKey].cursor} vs ${before} ${h.out.slice(0, 200)}`);
  fs.rmSync(lock, { force: true });
  h = await runHook([]);
  check('hook: …and the next stop reports it again and saves', /while the lock is held/.test(h.out) && readState()[anaKey].cursor === await latest(), h.out.slice(0, 200));
  // A reset (the board looked fresh to this hook) applies only while the cursor on disk is still the one it read:
  // progress another hook saved meanwhile is kept. The hook below finds a cursor past the board's newest event and
  // waits (ana's own events don't wake it); meanwhile another hook saves a newer cursor.
  for (let i = 0; i < 51; i++) await ana('post', { text: `own ${i}` });
  let s2 = readState(); s2[anaKey] = { ...s2[anaKey], cursor: (await latest()) + 1000 }; fs.writeFileSync(stateFile, JSON.stringify(s2));
  const resetting = runHook([], 'ana', { BOARD_HOOK_WAIT: '15' });
  await sleep(2500);
  const progress = (await latest()) + 3;
  s2 = readState(); s2[anaKey] = { ...s2[anaKey], cursor: progress }; fs.writeFileSync(stateFile, JSON.stringify(s2));
  await ben('post', { text: 'wakes the resetting hook' });
  h = await resetting;
  check('hook: a reset doesn\'t overwrite a newer cursor another hook saved meanwhile', /wakes the resetting hook/.test(h.out) && readState()[anaKey].cursor === progress, `${readState()[anaKey].cursor} vs ${progress} ${h.out.slice(0, 200)}`);
  for (let i = 0; i < 2; i++) await ben('post', { text: `catch up ${i}` });
}
// The transcript is read from its end (a bounded tail), never whole: a transcript too big for one string (simulated
// here: reading it whole throws) still has its usage-limit notice found, after megabytes of earlier entries.
{
  const preload = path.join(tmp, 'no-whole-transcript.mjs');
  fs.writeFileSync(preload, "import fs from 'node:fs'; const o = fs.readFileSync; fs.readFileSync = function (p, ...a) { if (typeof p === 'string' && p.endsWith('.jsonl')) throw new RangeError('Cannot create a string longer than 0x1fffffe8 characters'); return o.call(this, p, ...a); };\n");
  const filler = line({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'é'.repeat(20000) }] } });
  const big = [...Array(300).fill(filler), userLine, line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: "You've hit your usage limit · resets 3pm" }] } })];
  h = await runHook(big, 'ana', {}, ['--import', pathToFileURL(preload).href]);
  pa = await agentP('ana');
  check('hook: a big transcript is read from its end (the notice after ~12 MB is found, the file is never read whole)', h.code === 0 && pa.limited?.by === 'agent', `${h.out.slice(0, 200)} ${JSON.stringify(pa.limited)}`);
  await unmark('ana');
}

// ================= 2b. hook: only Claude Code's own notice, only as the last assistant entry =================
// Review finding: ordinary work text used to match ("rate limit", "resets 3 …", "usage limit banner").
const say = (text, extra = {}) => line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] }, ...extra });
for (const text of ['Done: added rate limiting to the login API.', 'The form resets 3 fields after submit.', 'Implemented the usage limit banner (#7).']) {
  await runHook([userLine, say(text)]);
  check(`hook: work text does not trigger ("${text}")`, !(await agentP('ana')).limited);
}
// Claude Code's real notice (as its transcripts record it): a synthetic assistant entry flagged as an API error.
const real = (text) => say(text, { isApiErrorMessage: true, error: 'rate_limit', message: { role: 'assistant', model: '<synthetic>', content: [{ type: 'text', text }] } });
await runHook([userLine, real("You've hit your session limit · resets 6:50pm (America/Denver)")]);
pa = await agentP('ana');
const denver = pa.limited?.until ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(new Date(pa.limited.until)) : '';
check('hook: the real notice marks the agent, reset worked out in its timezone (18:50 Denver, in the future)', pa.limited?.by === 'agent' && denver === '18:50' && pa.limited.until > Date.now() && pa.limited.until - Date.now() <= 24 * 3600e3, `${denver} ${JSON.stringify(pa.limited)}`);
await unmark('ana');
// A notice the agent continued past (a later normal assistant entry) is not this turn's ending.
await runHook([userLine, real("You've hit your 5-hour limit · resets 5:10am (America/Denver)"), userLine, say('Back again: claimed #4 and pushed the branch.')]);
check('hook: a notice that is not the last assistant entry does not trigger', !(await agentP('ana')).limited);
// A reset time already past: marked, but without an until.
await runHook([userLine, real(`Claude AI usage limit reached|${Math.floor((Date.now() - 3600e3) / 1000)}`)]);
pa = await agentP('ana');
check('hook: a reset time already past is sent as no time', pa.limited?.by === 'agent' && !pa.limited.until, JSON.stringify(pa.limited));
await unmark('ana');

// ================= 3. claiming reminds to run the checks before review =================
const t2 = await human('/tasks', 'POST', { title: 'Vote API', size: 'M' });
const cl = await ana('claim_task', { id: t2.id });
check('claim_task reply carries the before-review reminder', /run the repo's checks locally/.test(cl.before_review || ''), JSON.stringify(cl).slice(0, 300));

// ================= 4. planning stats =================
check('no stats before 3 tasks are done', (await state()).stats === null);
const minutesAgo = (m) => Date.now() - m * 60e3;
// Finish three tasks with a known history: claim → in_progress → review (→ back once for one of them) → done.
async function finishTask(title, size, bounce) {
  const t = await human('/tasks', 'POST', { title, size });
  await ben('claim_task', { id: t.id });
  await ben('update_task', { id: t.id, status: 'in_progress' });
  await ben('update_task', { id: t.id, status: 'review', note: 'ready' });
  if (bounce) { await human(`/tasks/${t.id}`, 'PATCH', { status: 'in_progress', note: 'fix lint' }); await ben('update_task', { id: t.id, status: 'review', note: 'fixed' }); }
  await human(`/tasks/${t.id}`, 'PATCH', { status: 'done' });
  return t;
}
const a = await finishTask('Seed data', 'S', false);
const b = await finishTask('Leaderboard', 'S', true);
const c = await finishTask('Voting page', 'M', false);
// Rewrite the timeline: S tasks took 10 and 20 minutes, review waits of 4 minutes.
db((d) => {
  const set = (id, kind, mins, statusMatch) => d.prepare(`UPDATE events SET ts = ? WHERE task_id = ? AND kind = ? ${statusMatch ? "AND data LIKE ?" : ''}`).run(...[minutesAgo(mins), id, kind, ...(statusMatch ? [`%"status":"${statusMatch}"%`] : [])]);
  for (const [t, total] of [[a, 10], [b, 20], [c, 40]]) {
    set(t.id, 'task_claimed', total + 60);
    set(t.id, 'task_updated', 64, 'review');
    set(t.id, 'task_updated', 60, 'done');
  }
});
st = await state();
check('stats appear after 3 done tasks', st.stats && st.stats.done === 3, JSON.stringify(st.stats));
check('median minutes per size (only sizes with 2+ samples)', st.stats?.minutes?.S === 15 && st.stats?.minutes?.M === undefined, JSON.stringify(st.stats));
check('bounce rate: 1 of 3 came back from review', Math.abs((st.stats?.bounce_rate ?? 0) - 0.33) < 0.01, JSON.stringify(st.stats));
check('median review wait in minutes', st.stats?.review_wait_min === 4, JSON.stringify(st.stats));

// The planner hears about it (with proposals waiting) and create_task's description includes it.
const pl = await agent('pl');
await pl('claim_role', { role: 'planner' });
await ana('create_task', { title: 'A proposal from ana' });
const ns = await pl('board_status');
check('planner guidance includes the stats', /On this board so far \(3 done\): S ≈ 15 min/.test(ns.next_action) && /33% of tasks came back from review/.test(ns.next_action), ns.next_action.slice(0, 400));
const c2 = new Client({ name: 'claude-code', version: '1' });
await c2.connect(new StreamableHTTPClientTransport(new URL(`${board.base}/mcp?${new URLSearchParams({ agent: 'pl', token: AGENT_TOKEN })}`)));
const tools = await c2.listTools();
const ct = tools.tools.find((t) => t.name === 'create_task');
check('create_task description carries the stats', /On this board so far/.test(ct?.description || ''), (ct?.description || '').slice(-200));
check('report_usage_limit is a listed tool', tools.tools.some((t) => t.name === 'report_usage_limit'));

// ================= model reported by the agent =================
check('model is null in presence when never reported', (await agentP('ana')).model === null, JSON.stringify((await agentP('ana')).model));
await ana('board_status', { model: 'Claude Sonnet 5.5' });
check('model passed to board_status appears in presence', (await agentP('ana')).model === 'Claude Sonnet 5.5', (await agentP('ana')).model);
await ben('board_status', { model: '  GPT-5.6\u0007\n\tx' + 'y'.repeat(200) });
const bm = (await agentP('ben')).model;
check('long/garbage model is sanitized (no control chars, max 60, trimmed)', typeof bm === 'string' && bm.length <= 60 && !/[\u0000-\u001f]/.test(bm) && bm.startsWith('GPT-5.6 x'), bm);
await ana('board_status', { model: ' \n ' });
check('blank model keeps the earlier value', (await agentP('ana')).model === 'Claude Sonnet 5.5');
await ana('board_status');
check('calling board_status without model keeps it and works as before', (await agentP('ana')).model === 'Claude Sonnet 5.5');
const pm = await agent('pm');
check('another agent that never reports a model stays null', (await agentP('pm')).model === null);

fs.rmSync(tmp, { recursive: true, force: true });
await finish(R, { board });
