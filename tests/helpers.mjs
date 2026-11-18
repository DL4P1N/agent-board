// Shared test helpers: start a throwaway board, find a local Chrome/Edge, seed realistic data, report results.
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TOKEN = 'testtok';
export { Client } from '@modelcontextprotocol/sdk/client/index.js';
export { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Temp folders made by a suite are deleted when it ends (finish(), or on exit as a fallback), so test runs don't leave
// a data folder behind in the system temp folder each time.
const temps = new Set();
const children = new Set();
const browsers = new Set();
export function tempDir(prefix = 'agent-board-test-') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temps.add(d);
  return d;
}
export function removeTemp(d) {
  try { fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }); temps.delete(d); } catch {}
}
export function cleanTemps() { for (const d of [...temps]) removeTemp(d); }

// Ends a child process at once and synchronously. On Windows with everything it started (taskkill /T /F: a plain kill()
// there returns before the child is gone, so it can still hold its database open while its folder is being deleted).
// On POSIX SIGKILL ends only the child itself, unless it was started with `detached: true` (its own process group) and
// group is true: then the whole group goes (process.kill(-pid)), as tests/run.mjs does with a suite that timed out.
export function killTree(c, { group = false } = {}) {
  if (!c || c.exitCode !== null || c.signalCode !== null) return;
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore', timeout: 5000 });
    else if (group) process.kill(-c.pid, 'SIGKILL');
    else c.kill('SIGKILL');
  } catch {}
}
// Waits (up to ms) for a child to exit; true at once if it already has.
export const exited = (c, ms = 5000) => new Promise((r) => {
  if (!c || c.exitCode !== null || c.signalCode !== null) return r(true);
  const t = setTimeout(() => r(false), ms);
  c.once('exit', () => { clearTimeout(t); r(true); });
});
// Stops every browser and board this suite started: politely first, then the whole process tree.
async function stopAll() {
  await Promise.all([...browsers].map((b) => Promise.race([b.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))])));
  await Promise.all([...children].map(async (c) => { try { c.kill(); } catch {} if (!(await exited(c, 3000))) { killTree(c); await exited(c, 2000); } }));
}
// A suite that throws (or leaves a promise rejected) still stops its boards and browsers and deletes its temp folders,
// and says CRASH so the runner counts it as failed. (With these handlers Node would otherwise exit 0.)
let crashed = false;
async function crash(e) {
  process.exitCode = 1;
  if (crashed) return;
  crashed = true;
  console.log(`CRASH ${e?.stack || e}`);
  await stopAll().catch(() => {});
  cleanTemps();
  process.exit(1);
}
process.on('uncaughtException', crash);
process.on('unhandledRejection', crash);
// process.exit() from a suite: nothing async runs any more, so end the children's trees synchronously, then delete.
// Browsers first, so puppeteer's own exit handler (which runs after this one) can delete their profiles.
process.once('exit', () => { for (const b of browsers) killTree(b.process()); for (const c of children) killTree(c); cleanTemps(); });

export const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.unref();
  s.on('error', reject);
  s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

// Starts `node src/server.js` on a free port with an empty data folder.
// restart() replaces it with a fresh, empty board on the same port.
// env: extra environment for the server, e.g. { PUBLIC_URL }.
// Optional: port (default: a free one), token (default 'testtok'), prefix (temp folder name; the demo uses its own),
// cleanup (default true: the data folder is deleted when the suite ends; the demo passes false and deletes its own).
// The port is free when it's picked, but another test run can take it before the board binds it: then this board exits
// (EADDRINUSE) while /health answers from the other run's board. So a board counts as started only once /health comes
// from this child (its pid); if the child exits first, the first start tries again on another free port.
export async function startBoard({ env = {}, port: wantPort, token = TOKEN, prefix = 'agent-board-test-', cleanup = true } = {}) {
  const board = { port: 0, base: '', token, dataDir: '', child: null };
  const setPort = (p) => { board.port = p; board.base = `http://localhost:${p}`; };
  setPort(wantPort || await freePort());
  let started = false;
  // Returns at once if the board already exited; ends its process tree if it hasn't exited within 5s.
  const kill = async () => {
    const c = board.child;
    if (!c) return;
    try { c.kill(); } catch {}
    if (!(await exited(c, 5000))) { killTree(c); await exited(c, 2000); }
    board.child = null;
  };
  let why = '';
  const once = async () => {
    const child = board.child = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], {
      env: { ...process.env, PORT: String(board.port), BOARD_TOKEN: token, BOARD_DATA: board.dataDir, BOARD_NO_JOIN: '1', ...env },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    child.stderr.on('data', (d) => { err = (err + d).slice(-600); });
    children.add(child);
    child.once('exit', () => children.delete(child));
    for (let i = 0; i < 150 && child.exitCode === null && child.signalCode === null; i++) {
      try { if ((await (await fetch(`${board.base}/health`, { signal: AbortSignal.timeout(2000) })).json()).pid === child.pid) return true; } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    why = child.exitCode !== null ? `it exited (${child.exitCode}): ${err.trim().split('\n').filter(Boolean).slice(-2).join(' / ')}` : 'no answer from it';
    await kill();
    return false;
  };
  const launch = async (keepData = false) => {
    if (!keepData) {
      if (board.dataDir && cleanup) removeTemp(board.dataDir); // restart(): the old board's folder goes
      board.dataDir = cleanup ? tempDir(prefix) : fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    }
    for (let attempt = 1; !(await once()); attempt++) {
      if (wantPort || attempt >= 5) throw new Error(`test board did not start on port ${board.port}: ${why}`);
      // The first start moves to another free port. A restart keeps its port (agents and pages hold the address): the
      // port can be briefly taken (on Windows, by another program's outgoing connection), so it tries again shortly.
      if (!started) setPort(await freePort());
      else await new Promise((r) => setTimeout(r, 500 * attempt));
    }
    started = true;
  };
  board.stop = kill;
  board.restart = async () => { await kill(); await launch(); };
  // Same data folder, like a server restart or a `--watch` reload.
  board.relaunch = async () => { await kill(); await launch(true); };
  await launch();
  return board;
}

// A local Chrome or Edge for puppeteer-core. Override with BROWSER_PATH=/path/to/chrome.
export function findBrowser() {
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;
  const env = (k) => process.env[k] || '';
  const candidates = {
    win32: [
      `${env('ProgramFiles')}\\Google\\Chrome\\Application\\chrome.exe`,
      `${env('ProgramFiles(x86)')}\\Google\\Chrome\\Application\\chrome.exe`,
      `${env('LOCALAPPDATA')}\\Google\\Chrome\\Application\\chrome.exe`,
      `${env('ProgramFiles(x86)')}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${env('ProgramFiles')}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
  }[process.platform] || [];
  for (const c of candidates) if (c && fs.existsSync(c)) return c;
  for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    const r = spawnSync('command', ['-v', bin], { shell: true, encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  throw new Error('No Chrome or Edge found for the UI tests. Install one, or set BROWSER_PATH=/path/to/chrome.');
}

// A mouse, as on CI: (pointer: fine) and (hover: hover) on any machine. Chrome otherwise reports this machine's own
// pointer (coarse on a laptop with a touch screen), and puppeteer's setViewport() turns touch emulation off on every
// call, which puts the machine's pointer back even over --blink-settings. So that "off" is only sent when touch was on
// (setViewport with hasTouch, then without: puppeteer reloads the page for that, which re-applies the mouse settings).
// A touch pass: setViewport({ ..., hasTouch: true }).
const MOUSE = '--blink-settings=primaryPointerType=4,availablePointerTypes=4,primaryHoverType=2,availableHoverTypes=2';
function pinMouse(page) {
  const client = page._client?.();
  if (!client) return page;
  let touch = false;
  const send = client.send.bind(client);
  client.send = (method, params, ...rest) => {
    if (method === 'Emulation.setTouchEmulationEnabled') {
      if (!params?.enabled && !touch) return Promise.resolve({});
      touch = !!params?.enabled;
    }
    return send(method, params, ...rest);
  };
  return page;
}

export async function launchBrowser({ office = false, ...opts } = {}) {
  const { default: puppeteer } = await import('puppeteer-core');
  // CI containers (GitHub Actions) need --no-sandbox for Chrome.
  const args = [MOUSE, ...(opts.args || []), ...(process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : [])];
  const browser = await puppeteer.launch({ headless: true, ...opts, args, executablePath: findBrowser() });
  browsers.add(browser);
  browser.once('disconnected', () => browsers.delete(browser));
  const mouse = (target) => { const np = target.newPage.bind(target); target.newPage = async (...a) => pinMouse(await np(...a)); return target; };
  mouse(browser);
  const cbc0 = browser.createBrowserContext.bind(browser);
  browser.createBrowserContext = async (...a) => mouse(await cbc0(...a));
  // The board turns the live 3D office on by default (wherever WebGL runs, software WebGL included). Most suites test
  // the board itself, so their pages start with 3D off, as if the switch had been turned off; a suite that tests the
  // office passes { office: true } (or sets 'agent-board-3d' itself).
  if (!office) {
    const off = (page) => page.evaluateOnNewDocument(() => { try { if (localStorage.getItem('agent-board-3d') === null) localStorage.setItem('agent-board-3d', 'off'); } catch {} }).then(() => page);
    const wrap = (target) => { const np = target.newPage.bind(target); target.newPage = async (...a) => off(await np(...a)); return target; };
    wrap(browser);
    const cbc = browser.createBrowserContext.bind(browser);
    browser.createBrowserContext = async (...a) => wrap(await cbc(...a));
  }
  return browser;
}

// Screenshots go to tests/ui/shots/<suite>/ (git-ignored).
export function shotsDir(suite) {
  const dir = path.join(ROOT, 'tests', 'ui', 'shots', suite);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Prints the results, stops the board, and exits non-zero if anything failed.
export async function finish(results, { browser, board } = {}) {
  console.log(results.join('\n'));
  const failed = results.filter((r) => !r.startsWith('PASS'));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  try { await browser?.close(); } catch {}
  try { await board?.stop(); } catch {}
  // Any other board the suite started stops too, then every temp folder it made is deleted.
  await stopAll();
  cleanTemps();
  process.exitCode = failed.length ? 1 : 0;
  // Lingering keep-alive sockets can hold the process open; exit shortly after if so.
  setTimeout(() => process.exit(), 1000).unref();
}

// An MCP client acting as an agent. `client` sets the tool label (claude-code, codex-mcp-client, Visual Studio Code, GitHub Copilot CLI).
export async function agent(board, name, client = 'claude-code') {
  const c = new Client({ name: client, version: '1.0.0' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${board.base}/mcp?agent=${encodeURIComponent(name)}&token=${board.token}`)));
  return async (tool, args = {}) => {
    const r = await c.callTool({ name: tool, arguments: args });
    const t = r.content[0].text;
    if (r.isError) console.log('ERR', name, tool, t);
    try { return JSON.parse(t); } catch { return t; }
  };
}

export const rest = (board, who, p, method = 'GET', body) =>
  fetch(`${board.base}/api${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${board.token}`, 'X-Agent': who },
    body: body && JSON.stringify(body),
  }).then((r) => r.json());

// Make a task look untouched for `minutes` (to test "stale").
export async function ageTask(board, taskId, minutes) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path.join(board.dataDir, 'board.db'));
  db.prepare('UPDATE tasks SET updated_at=? WHERE id=?').run(Date.now() - minutes * 60e3, taskId);
  db.close();
}

// A realistic mid-project board: 3 people with helper agents, tasks in every status, locks, questions, mentions.
export async function seed(board) {
  const alice = await agent(board, 'alice');
  const bob = await agent(board, 'bob');
  const chen = await agent(board, 'chen');
  // Real agents start with board_status (someone typed /board), which marks them as started.
  for (const a of [alice, bob, chen]) await a('board_status');

  const schema = await alice('create_task', { title: 'Database schema for users, teams and submissions', description: 'Acceptance:\n- migrations run on a clean db\n- seed script creates 3 demo teams', priority: 1 });
  const api = await alice('create_task', { title: 'REST API for submissions', description: 'CRUD + list by team', depends_on: [schema.id] });
  const ui = await alice('create_task', { title: 'Submission form UI', depends_on: [api.id] });
  const auth = await alice('create_task', { title: 'Google OAuth login', priority: 1 });
  const ci = await bob('create_task', { title: 'CI pipeline with tests on PRs', priority: 3 });
  const readme = await bob('create_task', { title: 'Demo README with screenshots', priority: 3 });
  const lb = await chen('create_task', { title: 'Leaderboard page', description: 'Top 10 teams by votes, live refresh' });
  const vote = await chen('create_task', { title: 'Voting endpoint with rate limit' });
  const scaffold = await alice('create_task', { title: 'Project scaffolding (Vite + Express)', priority: 1 });

  await alice('claim_task', { id: scaffold.id, as: 'setup' });
  await alice('update_task', { id: scaffold.id, status: 'done', note: 'merged', as: 'setup' });
  await alice('claim_task', { id: schema.id, as: 'db-worker' });
  await alice('update_task', { id: schema.id, status: 'in_progress', note: 'writing migrations', as: 'db-worker' });
  await alice('lock_files', { paths: ['db/schema.sql', 'db/migrations/001_init.sql'], task_id: schema.id, reason: 'schema changes', as: 'db-worker' });
  await alice('claim_task', { id: auth.id, as: 'auth-worker' });
  await alice('update_task', { id: auth.id, status: 'blocked', note: 'need OAuth client id', as: 'auth-worker' });
  await bob('claim_task', { id: ci.id, as: 'ci-worker' });
  await bob('update_task', { id: ci.id, status: 'review', note: 'PR ready on task branch', as: 'ci-worker' });
  await bob('lock_files', { paths: ['package.json'], ttl_s: 600, reason: 'adding test deps', as: 'ci-worker' });
  await chen('claim_task', { id: lb.id });
  await chen('update_task', { id: lb.id, status: 'in_progress', note: 'layout done, wiring data' });
  await chen('claim_task', { id: vote.id, as: 'api-worker' }); // made stale below

  await alice('post', { text: `Starting on schema now. @bob please hold off on db/ until #${schema.id} lands.` });
  await bob('post', { text: `ack — CI is in review, @chen can you look at #${ci.id}?`, as: 'ci-worker' });
  await chen('post', { text: 'Leaderboard layout is up, @dana want to check the colours?', channel: 'review' });
  await alice('post', { text: `Blocked on OAuth client id for #${auth.id}, asked the humans.`, as: 'auth-worker', channel: 'help' });
  await alice('ask_human', { question: 'Which Google OAuth client id should we use? Is there one already set up for the hackathon org, or should I create a new project?', task_id: auth.id, as: 'auth-worker' });
  await chen('ask_human', { question: 'Should the leaderboard show vote counts publicly, or only ranks?', task_id: lb.id });
  await rest(board, 'dana', '/messages', 'POST', { text: 'Morning all. Priority is the demo flow end-to-end by 3pm. <script>alert(1)</script>' });

  await ageTask(board, vote.id, 40);
  return { schema, api, ui, auth, ci, readme, lb, vote, scaffold };
}
