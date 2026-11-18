// Token rotation errors (MCP and REST say why), the demo time (no past times; passing it wakes waiting
// agents), the startup banner and the host-join prompt. Starts its own throwaway servers. Run all suites with: npm test
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startBoard, finish, agent, ROOT, tempDir } from './helpers.mjs';
import { agentTokenFor, viewerTokenFor } from '../src/tokens.js';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// No BOARD_TOKEN: the token comes from data/token, so it can be rotated.
const board = await startBoard({ env: { BOARD_TOKEN: '', BOARD_BACKUP_MINUTES: '0' } });
board.token = fs.readFileSync(path.join(board.dataDir, 'token'), 'utf8').trim();
const call = (p, method = 'GET', body, token = board.token) => fetch(`${board.base}/api${p}`, {
  method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Agent': 'dana' }, body: body && JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

// ================= ER-4: no demo time in the past =================
const past = await call('/settings', 'PUT', { deadline: Date.now() - 10 * 60e3 });
check('a demo time in the past is refused with 400', past.status === 400 && /already passed/.test(past.body?.error), JSON.stringify(past));
check('the refused time isn\'t saved', !(await call('/state')).body.settings.deadline);
const soon = await call('/settings', 'PUT', { deadline: Date.now() + 2 * 60e3, freeze_minutes: 0 });
check('a future demo time is accepted', soon.status === 200 && Number(soon.body.deadline) > Date.now(), JSON.stringify(soon));
check('clearing the demo time still works', (await call('/settings', 'PUT', { deadline: '' })).status === 200);

// ================= AG-8: the demo time passing wakes waiting agents =================
const { cursor } = (await call('/cursor')).body;
const due = Date.now() + 1500;
await call('/settings', 'PUT', { deadline: due, freeze_minutes: 0 });
const t0 = Date.now();
let demo = null;
for (let since = cursor; !demo && Date.now() - t0 < 15e3;) {
  const r = (await call(`/events?since=${since}&wait=10`)).body;
  demo = r.events.find((e) => e.author === 'board' && /^@all Demo time/.test(e.text));
  since = r.cursor;
}
check('a waiting agent is woken at the demo time (no 20 s tick needed)', !!demo && Date.now() >= due && Date.now() - due < 8e3, demo ? `${Date.now() - due} ms after` : 'no "Demo time" event');
check('the demo-time message says to wrap up', /Wrap up/.test(demo?.text || ''), demo?.text);
await sleep(300);
const demos = (await call('/state')).body.events?.filter?.((e) => /^@all Demo time/.test(e.text)) ?? [];
check('the demo time is announced once', demos.length <= 1, String(demos.length));
await call('/settings', 'PUT', { deadline: '' });

// ================= AG-7 / ER-2: a rotated token says why =================
const old = { human: board.token, agent: agentTokenFor(board.token), view: viewerTokenFor(board.token) };
const rot = await call('/token/rotate', 'POST', {});
check('rotate works', rot.status === 200 && rot.body.token && rot.body.token !== old.human, JSON.stringify(rot.body).slice(0, 80));
for (const [who, tok] of Object.entries(old)) {
  const r = await call('/state', 'GET', undefined, tok);
  check(`REST with the old ${who} token: 401, reason token_rotated, says re-run join`, r.status === 401 && r.body?.reason === 'token_rotated' && /token was changed/.test(r.body.error) && /join/.test(r.body.error), JSON.stringify(r));
}
const mcp = await fetch(`${board.base}/mcp?agent=ann-claude&token=${old.agent}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'x', version: '1' } } }),
});
const mb = await mcp.json().catch(() => null);
check('MCP with the old agent token: 401 that says the token changed', mcp.status === 401 && mb?.reason === 'token_rotated' && /Ask the host/.test(mb.error), `${mcp.status} ${JSON.stringify(mb)}`);
const unknown = await call('/state', 'GET', undefined, 'never-a-token');
check('a token that never worked still gets the plain error (no reason)', unknown.status === 401 && unknown.body?.error === 'bad or missing token' && !unknown.body.reason, JSON.stringify(unknown.body));
board.token = rot.body.token;
check('the new token works', (await call('/state')).status === 200);
const na = await agent({ base: board.base, token: agentTokenFor(board.token) }, 'ann-claude');
check('an agent with the new agent token connects', typeof (await na('board_status'))?.next_action === 'string');
// Remembered across a restart (or a --watch reload).
await board.relaunch();
const after = await call('/state', 'GET', undefined, old.human);
check('after a restart the old token still gets reason token_rotated', after.status === 401 && after.body?.reason === 'token_rotated', JSON.stringify(after));
await board.stop();

// ================= ONB-1 / ONB-11: banner and the host-join prompt =================
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
// Runs the server as if in a terminal (stdin.isTTY), with its own home folder; answers the prompt with `answer`.
async function host({ dataDir, home, answer }) {
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'data:text/javascript,Object.defineProperty(process.stdin,"isTTY",{value:true})', path.join(ROOT, 'src', 'server.js')], {
    env: { ...process.env, PORT: String(port), BOARD_DATA: dataDir, BOARD_TOKEN: '', BOARD_NO_JOIN: '', BOARD_BACKUP_MINUTES: '0', PUBLIC_URL: '', HOME: home, USERPROFILE: home },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  const until = async (re, ms = 10e3) => { const t = Date.now(); while (!re.test(out) && Date.now() - t < ms) await sleep(50); return re.test(out); };
  await until(/Keep this window open/);
  await until(/\[(Y\/n|y\/N)\]|run any time|connected as/, 3000);
  if (answer !== undefined && /\[(Y\/n|y\/N)\]/.test(out)) { child.stdin.write(answer); await until(/Skipped|Kept the other board|Which/, 4000); }
  await sleep(200);
  const done = new Promise((r) => child.once('exit', r));
  child.kill(); await done;
  return out;
}
const tmp = () => tempDir('agent-board-test-');
const home1 = tmp(); const data1 = tmp();
const first = await host({ dataDir: data1, home: home1, answer: 'n\n' });
check('banner: the token is the board\'s password', /The token in these links is the board's password: share it only with your team\./.test(first), first.slice(0, 200));
check('banner: npm run tunnel for another network', /another network\? .*npm run tunnel/.test(first));
check('banner: npm run doctor when a teammate can\'t connect', /npm run doctor/.test(first));
check('host-join: a new laptop is asked [Y/n]', /\[Y\/n\]/.test(first));
check('host-join: "n" skips and is remembered', /Skipped/.test(first) && fs.existsSync(path.join(data1, '.host-join-declined')));
const second = await host({ dataDir: data1, home: home1 });
check('host-join: after "n", no prompt but the join command is printed', !/\[(Y\/n|y\/N)\]/.test(second) && /run any time:\s+npm run join -- --url http:\/\/localhost:\d+\/b\/main --token \S+/.test(second), second.split('\n').filter((l) => /join/.test(l)).join(' | '));
const home2 = tmp(); const data2 = tmp();
// ~/.claude-board.json: a laptop that joined before the rename to Agent Board. The host still reads it.
fs.writeFileSync(path.join(home2, '.claude-board.json'), JSON.stringify({ url: 'http://elsewhere:4000/b/other', token: 'some-other-board', agent: 'dee-claude', agents: [{ tool: 'claude', agent: 'dee-claude', token: 'some-other-board' }] }));
const third = await host({ dataDir: data2, home: home2, answer: '\n' });
check('host-join: already on another board, the prompt defaults to No', /connected to another board as "dee-claude"\. .*\[y\/N\]/.test(third), third.split('\n').filter((l) => /\[/.test(l)).join(' | '));
check('host-join: Enter keeps the other board, prints the command, and isn\'t remembered', /Kept the other board/.test(third) && /npm run join -- --url/.test(third) && !fs.existsSync(path.join(data2, '.host-join-declined')));

await finish(R);
