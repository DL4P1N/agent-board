// HTTP server: MCP endpoint (/mcp), REST + SSE API for the web board and hooks (/api), static UI (/).
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Board } from './board.js';
import { buildMcpServer } from './mcp.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.resolve(process.env.BOARD_DATA || path.join(ROOT, 'data'));

const board = new Board(DATA_DIR);
const TOKEN = loadToken();
// Which claude-board code this server runs (git commit), so join/doctor can spot an outdated board.
const VERSION = (() => {
  const r = spawnSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'unknown';
})();

const app = express();
app.use(express.json({ limit: '2mb' }));

// ---------- auth ----------
function tokenFrom(req) {
  const h = req.get('authorization') || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  return req.get('x-board-token') || req.query.token || '';
}
function safeEq(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function auth(req, res, next) {
  if (!safeEq(tokenFrom(req), TOKEN)) return res.status(401).json({ error: 'bad or missing token' });
  next();
}
function agentFrom(req) {
  const a = (req.get('x-agent') || req.body?.author || req.query.agent || '').toString().trim();
  return a.replace(/[^\w.\-/]/g, '').slice(0, 64) || 'anonymous';
}

// ---------- MCP (stateless streamable HTTP) ----------
app.post('/mcp', auth, async (req, res) => {
  // A Claude that just came online: nudge web boards to refresh (SSE {kind:'presence'}).
  const cameOnline = board.touch(agentFrom(req), 'agent');
  const clientChanged = req.body?.method === 'initialize' && board.setClient(agentFrom(req), clientLabel(req.body.params?.clientInfo));
  if (cameOnline || clientChanged) board.bus.emit('event', { id: 0, kind: 'presence', text: '' });
  const server = buildMcpServer(board, agentFrom(req));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error('mcp error', e);
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'internal error' }, id: null });
  }
});
const methodNotAllowed = (_req, res) =>
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed (stateless server)' }, id: null });
app.get('/mcp', methodNotAllowed);
app.delete('/mcp', methodNotAllowed);

// ---------- REST API ----------
const api = express.Router();
api.use(auth);
// The web board sends X-Agent with the human's name; the Stop hook doesn't send it.
api.use((req, _res, next) => {
  if (req.method !== 'GET' && req.get('x-agent')) board.touch(agentFrom(req), 'human');
  next();
});
const h = (fn) => async (req, res) => {
  try { res.json(await fn(req, res)); } catch (e) { res.status(400).json({ error: String(e?.message || e) }); }
};

// Humans with the web board open (by name -> open SSE connection count).
const humansOnline = new Map();
const onlineHumans = () => new Set([...humansOnline].filter(([, n]) => n > 0).map(([k]) => k));

api.get('/state', h((req) => {
  const g = board.nextAction(agentFrom(req));
  return {
    tasks: board.listTasks(),
    locks: board.listLocks(),
    questions: board.listQuestions(),
    events: board.recentEvents(200),
    cursor: board.latestEventId(),
    settings: board.getSettings(),
    phase: g.phase,
    presence: board.presence(onlineHumans()),
    setup: setupInfo(),
  };
}));

// Humans edit goal/roles from the web board.
api.put('/settings', h((req) => board.setSettings(agentFrom(req), req.body || {}, { human: true })));

// Used by the Stop hook. wait>0 long-polls.
api.get('/events', h(async (req) => {
  const since = Number(req.query.since || 0);
  const exclude_author = req.query.exclude || undefined;
  const wait = Math.min(Number(req.query.wait || 0), 600);
  const filter = { since, exclude_author, limit: 200 };
  const ac = new AbortController();
  req.on('close', () => ac.abort());
  const events = wait > 0 ? await board.waitForEvents(filter, wait * 1000, ac.signal) : board.events(filter);
  return { events, cursor: events.length ? events.at(-1).id : Math.max(since, board.latestEventId()) };
}));
api.get('/cursor', h(() => ({ cursor: board.latestEventId() })));

api.post('/messages', h((req) => board.post(agentFrom(req), req.body)));
api.post('/tasks', h((req) => board.createTask(agentFrom(req), req.body)));
api.patch('/tasks/:id', h((req) => board.updateTask(agentFrom(req), Number(req.params.id), req.body, { human: true })));
api.post('/questions/:id/answer', h((req) => board.answer(agentFrom(req), Number(req.params.id), req.body.answer)));
api.post('/locks/release', h((req) => board.unlockFiles(agentFrom(req), { paths: req.body.paths, force: true })));

// Live updates for the web UI.
api.get('/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const send = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  board.bus.on('event', send);
  // ?name=<human> marks that person as watching the board.
  const human = String(req.query.name || '').replace(/[^\w.-]/g, '').slice(0, 64);
  const presenceChanged = () => board.bus.emit('event', { id: 0, kind: 'presence', text: '' });
  if (human) {
    humansOnline.set(human, (humansOnline.get(human) || 0) + 1);
    board.touch(human, 'human');
    presenceChanged();
  }
  req.on('close', () => {
    clearInterval(ping);
    board.bus.off('event', send);
    if (human) {
      humansOnline.set(human, Math.max(0, (humansOnline.get(human) || 1) - 1));
      board.touch(human, 'human');
      presenceChanged();
    }
  });
});

app.use('/api', api);
app.get('/health', (_req, res) => res.json({ ok: true, app: 'claude-board', version: VERSION }));
app.use(express.static(path.join(ROOT, 'public')));

const httpServer = app.listen(PORT, HOST, () => {
  const addrs = reachableAddresses();
  const best = addrs[0]?.ip || 'localhost';
  const line = '─'.repeat(64);
  console.log(`\n${line}\n Claude Board is running  (version ${VERSION}, port ${PORT})\n${line}`);
  console.log('\n 1. Open the web board. It walks everyone through setup:');
  console.log(`      http://${best}:${PORT}/?token=${TOKEN}`);
  if (!addrs.length) {
    console.log('\n    ⚠ No network address found, so teammates can\'t reach this laptop. Join the wifi or start Tailscale.');
  }
  console.log('\n 2. Teammates run this in their claude-board folder (it asks the rest):');
  console.log(`      npm run join -- --url http://${best}:${PORT} --token ${TOKEN}`);
  for (const a of addrs.slice(1)) console.log(`      (or ${a.ip} if that doesn't connect: ${a.label})`);
  console.log(`\n Keep this window open. After a \`git pull\` the board reloads by itself.`);
  console.log(` Data: ${DATA_DIR}\n${line}\n`);
  offerHostJoin();
});

httpServer.on('error', async (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  let other = null;
  try { other = await (await fetch(`http://localhost:${PORT}/health`, { signal: AbortSignal.timeout(2000) })).json(); } catch {}
  if (other?.app === 'claude-board') {
    console.error(`\n✗ A board is already running on port ${PORT} (version ${other.version}).`);
    console.error(other.version !== VERSION
      ? `  It's running different code than this folder (${VERSION}). Close its window (Ctrl+C there) and run npm start again.`
      : `  Use that one (its window shows the links), or close it first with Ctrl+C in its window.`);
  } else {
    console.error(`\n✗ Port ${PORT} is already used by another program. Start the board on another port, e.g.:  PORT=4001 npm start`);
  }
  process.exit(1);
});

// The host usually runs an AI agent too: offer to connect it right here instead of a second terminal.
function offerHostJoin() {
  if (!process.stdin.isTTY || process.env.BOARD_NO_JOIN) return;
  const declined = path.join(DATA_DIR, '.host-join-declined');
  if (fs.existsSync(declined)) return;
  let cfg = null;
  try { cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude-board.json'), 'utf8')); } catch {}
  if (cfg?.token === TOKEN) {
    console.log(` This laptop is connected as "${cfg.agent}". (Re-run setup any time: npm run join -- --url http://localhost:${PORT} --token ${TOKEN})\n`);
    return;
  }
  process.stdout.write(' Connect this laptop\'s AI tool to the board now? [Y/n] ');
  process.stdin.setEncoding('utf8');
  process.stdin.once('data', (answer) => {
    process.stdin.pause();
    if (/^\s*n/i.test(answer)) {
      fs.writeFileSync(declined, '');
      console.log(` Skipped. To connect later, run in another terminal:\n   npm run join -- --url http://localhost:${PORT} --token ${TOKEN}\n`);
      return;
    }
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'join.mjs'), '--url', `http://localhost:${PORT}`, '--token', TOKEN], { stdio: 'inherit' });
    child.on('exit', () => console.log(`\n The board keeps running here. Keep this window open.\n`));
  });
}

// Friendly name for the AI tool behind an MCP connection (from initialize's clientInfo.name).
function clientLabel(info) {
  const n = String(info?.name || '').toLowerCase();
  if (!n) return null;
  if (n.includes('claude')) return 'Claude Code';
  if (n.includes('codex')) return 'Codex';
  if (n.includes('visual studio code') || n.includes('vscode')) return 'Copilot (VS Code)';
  if (n.includes('copilot')) return 'Copilot CLI';
  return String(info.name).slice(0, 40);
}

// How to start the orchestrator in each supported tool (shown on the web board).
const AGENT_TOOLS = [
  { id: 'claude', name: 'Claude Code', start: '/board', where: 'Type it in Claude Code, opened in the hackathon repo.' },
  { id: 'codex', name: 'Codex (ChatGPT)', start: '$board', where: 'Type it in the Codex CLI, opened in the hackathon repo.' },
  { id: 'copilot-vscode', name: 'GitHub Copilot in VS Code', start: '/board', where: 'Open the hackathon repo in VS Code, switch Copilot Chat to Agent mode, then type it.' },
  { id: 'copilot-cli', name: 'GitHub Copilot CLI', start: '/board', where: 'Start it with  copilot --allow-tool board  in the hackathon repo, then type it.' },
];

// Copy-paste join commands + web links, for the web board's "invite teammates" step.
function setupInfo() {
  const addrs = reachableAddresses();
  const list = [...addrs, { ip: 'localhost', label: 'this machine only', rank: 9 }];
  return {
    port: PORT,
    version: VERSION,
    agent_tools: AGENT_TOOLS,
    clone_command: 'git clone https://github.com/DL4P1N/claude-board && cd claude-board',
    join_commands: list.map((a) => ({
      label: a.label,
      ip: a.ip,
      command: `npm run join -- --url http://${a.ip}:${PORT} --token ${TOKEN}`,
      web_url: `http://${a.ip}:${PORT}/?token=${TOKEN}`,
    })),
  };
}

// Non-internal IPv4 addresses, most useful first: Tailscale, then private LAN, then anything else.
function reachableAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family !== 'IPv4' || i.internal || i.address.startsWith('169.254.')) continue;
      const tailscale = /tailscale/i.test(name) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(i.address);
      const lan = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address);
      const virtual = /vEthernet|WSL|VirtualBox|VMware|Hyper-V|docker|br-/i.test(name);
      const rank = tailscale ? 0 : virtual ? 3 : lan ? 1 : 2;
      const label = tailscale ? `Tailscale (works across networks) — ${name}` : virtual ? `virtual adapter, probably NOT reachable — ${name}` : `same wifi/LAN — ${name}`;
      out.push({ ip: i.address, label, rank });
    }
  }
  return out.sort((a, b) => a.rank - b.rank);
}

function loadToken() {
  if (process.env.BOARD_TOKEN) return process.env.BOARD_TOKEN;
  const f = path.join(DATA_DIR, 'token');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  const t = crypto.randomBytes(12).toString('base64url');
  fs.writeFileSync(f, t);
  return t;
}
