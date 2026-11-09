// HTTP server: MCP endpoint (/mcp), REST + SSE API for the web board and hooks (/api), static UI (/).
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
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
const h = (fn) => async (req, res) => {
  try { res.json(await fn(req, res)); } catch (e) { res.status(400).json({ error: String(e?.message || e) }); }
};

api.get('/state', h(() => ({
  tasks: board.listTasks(),
  locks: board.listLocks(),
  questions: board.listQuestions(),
  events: board.recentEvents(200),
  cursor: board.latestEventId(),
})));

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
  req.on('close', () => {
    clearInterval(ping);
    board.bus.off('event', send);
  });
});

app.use('/api', api);
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use(express.static(path.join(ROOT, 'public')));

app.listen(PORT, HOST, () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`\nClaude Board running on port ${PORT}`);
  console.log(`  Web board:  http://localhost:${PORT}/?token=${TOKEN}`);
  for (const ip of ips) console.log(`  LAN:        http://${ip}:${PORT}   (MCP: http://${ip}:${PORT}/mcp)`);
  console.log(`  Token:      ${TOKEN}`);
  console.log(`  Data:       ${DATA_DIR}\n`);
  console.log('Teammates join with:');
  console.log(`  npm run join -- --url http://<this-ip>:${PORT} --token ${TOKEN} --name <their-name> --repo <path-to-hackathon-repo>\n`);
});

function loadToken() {
  if (process.env.BOARD_TOKEN) return process.env.BOARD_TOKEN;
  const f = path.join(DATA_DIR, 'token');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  const t = crypto.randomBytes(12).toString('base64url');
  fs.writeFileSync(f, t);
  return t;
}
