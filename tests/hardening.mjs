// More security checks (the Round 5 review): what the board says in its own voice about GitHub, join's printing of
// board text, settings text, reserved names, the laptop-conflict alerts, the waits kept for people, and the Boards
// page's admin handoff. Starts its own throwaway boards (and a fake board for join). Run all suites with: npm test
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startBoard, finish, ROOT, TOKEN, tempDir } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + String(x).slice(0, 600) : ''}`);
const ADMIN = 'admin-' + 'h'.repeat(24);
const board = await startBoard({ env: { BOARD_ADMIN_TOKEN: ADMIN } });
const admin = (p, method = 'GET', body) => fetch(`${board.base}/api/admin${p}`, { method, headers: { 'X-Admin-Token': ADMIN, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body && JSON.stringify(body) });
const api = (p, { method = 'GET', body, token = board.token, who = 'dana', headers = {} } = {}) => fetch(`${board.base}/api${p}`, {
  method, headers: { Authorization: `Bearer ${token}`, ...(who ? { 'X-Agent': who } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});
// Control characters a terminal acts on: ESC (colours, clearing the screen, OSC 8 links), BEL, a carriage return.
const CTRL = /[\0-\x08\x0b-\x1f\x7f-\x9f]/;
// Where the first one is in a program's output (line breaks aside), for the failure message; '' when there is none.
const ctrlAt = (s) => { const t = s.replace(/\r?\n/g, ''); const i = t.search(CTRL); return i < 0 ? '' : JSON.stringify(t.slice(Math.max(0, i - 120), i + 20)); };

// Runs join against a fake board in a sandboxed home (never the real tool configs), answering every question with Enter.
async function joinAgainst(handler) {
  const fake = http.createServer(handler);
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  const tmp = tempDir('agent-board-hard-');
  const home = path.join(tmp, 'home'); fs.mkdirSync(home);
  const cwd = path.join(tmp, 'cwd'); fs.mkdirSync(cwd);
  const env = { ...process.env, HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home, AGENT_BOARD_JOIN_ASK: '1', GIT_CONFIG_NOSYSTEM: '1' };
  delete env.INIT_CWD;
  const out = await new Promise((resolve) => {
    const j = spawn(process.execPath, [path.join(ROOT, 'scripts', 'join.mjs'), '--url', `http://127.0.0.1:${fake.address().port}`, '--token', TOKEN, '--name', 'victim', '--tool', 'other', '--offline'], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let text = '';
    const on = (d) => { const s = String(d); text += s; if (/: $/.test(s)) j.stdin.write('\n'); };
    j.stdout.on('data', on); j.stderr.on('data', on);
    const t = setTimeout(() => j.kill(), 60e3);
    j.on('exit', () => { clearTimeout(t); resolve(text); });
  });
  fake.close();
  return out;
}
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

try {
  // ---- N9: join prints the board's text without control characters; settings text is stored without them ----
  {
    const esc = '\x1b]8;;https://evil.example\x07click\x1b]8;;\x07\x1b[2J\r';
    const out = await joinAgainst((req, res) => {
      if (req.url.startsWith('/api/state')) return send(res, 200, { board: { name: `Hack${esc}`, slug: 'hack' }, settings: { goal: `ship it${esc}` }, presence: [{ kind: 'agent', name: 'victim', client: `codex${esc}` }], tasks: [], events: [] });
      if (req.url.startsWith('/api/names/')) return send(res, 200, { taken: true, holders: [{ connected: true, client: `claude-code${esc}` }] });
      if (req.url.startsWith('/health')) return send(res, 200, { app: 'agent-board', version: 'x' });
      if (req.url.startsWith('/mcp')) return send(res, 200, { jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'get_playbook' }] } });
      send(res, 404, {});
    });
    check('N9: join prints the board name, goal and client labels without control characters', /board "Hack/.test(out) && /goal: ship it/.test(out) && !ctrlAt(out), ctrlAt(out) || out.slice(0, 600));
    const moved = await joinAgainst((req, res) => {
      if (req.url.startsWith('/api/state')) return send(res, 409, { error: 'moved', moved_to: `/b/x${esc}` });
      send(res, 404, {});
    });
    check('N9: …and the moved_to address of a moved board', /now at http:\/\/127\.0\.0\.1:\d+\/b\/x/.test(moved) && !CTRL.test(moved.replace(/\r?\n/g, '')), JSON.stringify(moved.slice(0, 400)));

    const r = await api('/settings', { method: 'PUT', body: { goal: `Ship the vote app\x1b[31m red\x07\r\nline two\ttab` } });
    const s = await r.json();
    check('N9: a goal is stored without control characters (a line break and a tab stay)', r.status === 200 && s.goal === 'Ship the vote app[31m red\nline two\ttab', JSON.stringify(s.goal));
    const nb = await admin('/boards', 'POST', { name: 'Kube\x1b[2Jcon\x07', slug: 'kube' });
    const listed = (await (await admin('/boards')).json()).find((b) => b.slug === 'kube');
    check("N9: a new board's name is stored without control characters", nb.status === 200 && listed?.name === 'Kube [2Jcon', JSON.stringify(listed?.name));
  }

  // ---- N10: look-alikes of "board" and "anonymous" are reserved too, for agents and people ----
  {
    const AG = agentTokenFor(board.token);
    const post = (who, token) => api('/messages', { method: 'POST', token, who, body: { text: 'hello', channel: 'general' } }).then((r) => r.status);
    const mcp = (name) => fetch(`${board.base}/mcp?agent=${encodeURIComponent(name)}&token=${AG}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'x', version: '1' } } }) }).then((r) => r.status);
    const looks = ['board.', 'board_', 'board-', 'Board..', '_board', 'anonymous-', '.anonymous.', 'board_/ui'];
    const agentSt = []; const humanSt = []; const mcpSt = [];
    const asAgent = (who) => api('/state', { token: AG, who }).then((r) => r.status);
    for (const n of looks) { mcpSt.push(await mcp(n)); agentSt.push(await asAgent(n)); }
    for (const n of looks) humanSt.push(await post(n, board.token));
    check('N10: an agent may not use a look-alike of board or anonymous', agentSt.every((s) => s === 400), agentSt.join());
    check('N10: …nor a person', humanSt.every((s) => s === 400), humanSt.join());
    check('N10: …nor connect over MCP as one', mcpSt.every((s) => s === 400), mcpSt.join());
    check('N10: names that only start with those words still work', (await asAgent('boardwalk')) === 200 && (await post('board-ana', board.token)) === 200 && (await mcp('anonymous-fan')) === 200);
  }
} finally {
  await finish(R, { board });
}
