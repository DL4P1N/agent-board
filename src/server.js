// HTTP server for one or more boards. Each live board has its own data, tokens, agents and timers, and is
// served at /b/<slug>/ (MCP at /b/<slug>/mcp, REST + SSE at /b/<slug>/api, the web board at /b/<slug>/).
// The default board is also served at the root (/, /api, /mcp), so links made before there were several
// boards keep working. The host manages boards at /boards with the admin token (src/boards.js).
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { spawn, spawnSync, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Board, timeInfo, normName, callerLaptop, DIRECT } from './board.js';
import { agentTokenFor, viewerTokenFor } from './tokens.js';
import { Registry, boardToken, adminToken } from './boards.js';
import QRCode from 'qrcode';
import { buildMcpServer } from './mcp.js';
import { checkNotifyUrl, resolveNotifyTarget, sendWebhook } from './webhook.js';
import { RateLimiter, Slots, envLimit } from './limits.js';
import { ROOT, PORT, HOST, DATA_DIR, PUBLIC_URL, PUBLIC_DIR, VERSION } from './config.js';
import { tokenFrom, safeEq, agentFrom, h } from './http-util.js';
import { AGENT_TOOLS, serverAddresses, bestBase } from './network.js';
import { writePid, dropPid } from './pidfile.js';
import { hiddenSettings } from './board-settings.js';
import { startGithubPolling } from './github.js';
import { setupNotifications } from './notify.js';
import { startBackups } from './backup.js';
import { startAnnouncements } from './announce.js';
import { createTimers } from './timers.js';
import { createAuth } from './auth.js';
import { clientIp, createRequestLimits } from './request-limits.js';

fs.mkdirSync(DATA_DIR, { recursive: true });
writePid();
process.once('exit', dropPid);
let registry;
try { registry = new Registry(DATA_DIR); } catch (e) {
  console.error(`\n✗ Can't read the boards list: ${e.message}`);
  dropPid();
  process.exit(1);
}
const ADMIN_TOKEN = adminToken(DATA_DIR);
// BOARD_TOKEN belongs to one fixed board (the original board in the data folder, or the one remembered
// in boards.json), never to "whichever board is the default right now": a default switch plus a restart
// must not hand one board's token to another.
const ENV_TOKEN_SLUG = process.env.BOARD_TOKEN ? registry.envTokenSlug() : null;

// Friendly name for the AI tool behind an MCP connection (from initialize's clientInfo.name).
function clientLabel(info) {
  const n = String(info?.name || '').toLowerCase();
  if (!n) return null;
  if (n.includes('claude')) return 'Claude Code';
  if (n.includes('codex')) return 'Codex';
  if (n.includes('gemini')) return 'Gemini CLI';
  if (n.includes('cursor')) return 'Cursor';
  if (n.includes('visual studio code') || n.includes('vscode')) return 'Copilot (VS Code)';
  if (n.includes('copilot')) return 'Copilot CLI';
  return String(info.name).slice(0, 40);
}


// ---------- one board ----------
// Everything that belongs to one board: its data, tokens, people, timers and routes. close() stops it.
function createBoardRuntime(slug, dir) {
  const board = new Board(dir);
  const isDefault = () => registry.defaultSlug === slug;
  // This board's canonical address: always /b/<slug>, also for the default board. The root (/, /api, /mcp)
  // stays an alias for whichever board is the default, so links and joins from before keep working,
  // but everything handed out uses the canonical address, so a default switch doesn't break it.
  const prefix = () => `/b/${slug}`;
  const envToken = slug === ENV_TOKEN_SLUG && process.env.BOARD_TOKEN ? process.env.BOARD_TOKEN : null;
  const { every, later, forget, clearAll } = createTimers();
  const { rawSetting, putSetting, announced } = hiddenSettings(board);
  const presence = () => board.bus.emit('event', { id: 0, kind: 'presence', text: '' });
  const tokens = createAuth({ dir, envToken });
  const { auth, viewerLimits, humanOnly, humanToken } = tokens;

  const router = express.Router();
  // Archived (closed) while a request was being routed: nothing to serve any more.
  router.use((req, res, next) => (closed ? res.status(410).json({ error: 'This board is archived.' }) : next()));
  // Board calls per network address (all tokens), and per agent once we know it's one.
  const { ipLimit, agentLimit, holdSlot } = createRequestLimits(slug);
  router.use('/mcp', ipLimit(true));
  router.use('/api', ipLimit(false));

  // ---------- MCP (stateless streamable HTTP) ----------
  router.post('/mcp', auth, async (req, res) => {
    if (req.role === 'viewer') return res.status(403).json({ jsonrpc: '2.0', error: { code: -32001, message: 'The viewer token is read-only.' }, id: null });
    if (!agentLimit(req, res, agentFrom(req), true)) return;
    if (req.body?.method === 'tools/call' && req.body?.params?.name === 'wait_for_events') {
      const who = agentFrom(req).split('/')[0];
      if (!holdSlot(req, res, `wait:${who}`, who, true)) return;
    }
    // An agent that just came online: nudge web boards to refresh (SSE {kind:'presence'}).
    // ?probe=1: a connection check (join/doctor), not a running agent, so it doesn't count as presence.
    const probe = req.query.probe === '1';
    const cameOnline = !probe && board.touch(agentFrom(req), 'agent');
    const clientChanged = !probe && req.body?.method === 'initialize' && board.setClient(agentFrom(req), clientLabel(req.body.params?.clientInfo));
    // The agent's subscription (join puts ?plan=…&slots=N in the URL): how many tasks it may hold at once.
    const planChanged = !probe && (req.query.plan || req.query.slots) && board.setPlan(agentFrom(req), req.query.plan, req.query.slots);
    // Which person this agent belongs to (join sends ?person=), and which laptop it runs on (?laptop=, from
    // join; older setups: the network address), to group a laptop's tools and spot one name on two laptops.
    const personChanged = !probe && req.query.person && board.setPerson(agentFrom(req), req.query.person, 'join');
    const laptop = String(req.query.laptop || '').replace(/[^\w-]/g, '').slice(0, 32)
      || `ip:${String(req.get('cf-connecting-ip') || req.socket.remoteAddress || '').slice(0, 64)}`;
    const laptopChanged = !probe && board.noteLaptop(agentFrom(req), laptop);
    // One name, one laptop: the first laptop whose agent is online under a name owns it; the second one is
    // told to stop and may not claim or change tasks (needs join's ?laptop=; network addresses vary).
    const laptopId = laptop.startsWith('ip:') ? null : laptop;
    if (!probe && laptopId) board.claimName(agentFrom(req), laptopId, req.query.person || null);
    if (cameOnline || clientChanged || planChanged || personChanged || laptopChanged) presence();
    const server = buildMcpServer(board, agentFrom(req));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    try {
      await callerLaptop.run(laptopId, async () => {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      });
    } catch (e) {
      console.error('mcp error', e);
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'internal error' }, id: null });
    }
  });
  const methodNotAllowed = (_req, res) =>
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed (stateless server)' }, id: null });
  router.get('/mcp', methodNotAllowed);
  router.delete('/mcp', methodNotAllowed);

  // ---------- REST API ----------
  const api = express.Router();
  api.use(auth);
  api.use((req, res, next) => (req.role !== 'agent' || agentLimit(req, res, agentFrom(req), false) ? next() : undefined));
  api.use(viewerLimits);
  api.use(humanOnly);
  // The web board sends X-Agent with the human's name. Agents (the Stop hook) send X-Agent too, with the
  // agent token: those must not show up as a human.
  api.use((req, _res, next) => {
    if (req.role === 'human' && req.method !== 'GET' && req.get('x-agent')) board.touch(agentFrom(req), 'human');
    // A Stop-hook poll that says which laptop it runs on (X-Laptop or ?laptop=) keeps that laptop's hold on the
    // agent name while the agent works without board calls (one name, one laptop).
    if (req.role === 'agent' && req.method === 'GET' && (req.path === '/next' || req.path === '/events')) {
      const laptop = String(req.get('x-laptop') || req.query.laptop || '').replace(/[^\w-]/g, '').slice(0, 32);
      const who = req.get('x-agent') || req.query.agent || req.query.exclude;
      if (laptop && who) board.seenName(String(who), laptop);
    }
    next();
  });

  // Humans with the web board open (by name -> open SSE connection count).
  const humansOnline = new Map();
  const onlineHumans = () => new Set([...humansOnline].filter(([, n]) => n > 0).map(([k]) => k));

  // Copy-paste join commands + web links, for the web board's "invite teammates" step. They carry the
  // board's canonical /b/<slug> path, so they keep working when another board becomes the default.
  function setupInfo() {
    const p = prefix();
    const list = [...serverAddresses(), { ip: 'localhost', base: `http://localhost:${PORT}`, label: 'this machine only' }];
    return {
      port: PORT,
      version: VERSION,
      board: { slug, name: registry.get(slug)?.name || slug, default: isDefault(), path: p },
      agent_tools: AGENT_TOOLS,
      clone_command: 'git clone https://github.com/DL4P1N/agent-board && cd agent-board',
      join_commands: list.map((a) => ({
        label: a.label,
        ip: a.ip,
        command: `npm run join -- --url ${a.base}${p} --token ${tokens.token}`,
        web_url: `${a.base}${p}/?token=${tokens.token}`,
      })),
    };
  }

  api.get('/state', h((req) => {
    const g = board.nextAction(agentFrom(req));
    // Only humans get `setup`: it holds the board token (join commands, web links). Agents and the
    // presenter view must never be able to read it, or every human-only route is one GET away.
    const human = req.role === 'human';
    return {
      tasks: board.listTasks(),
      locks: board.listLocks(),
      questions: board.listQuestions(),
      events: board.recentEvents(200),
      // Direct-message threads, for humans only: every human sees every thread; agents and the presenter never get them.
      ...(human ? { direct: board.directMessages() } : {}),
      cursor: board.latestEventId(),
      settings: board.getSettings(),
      phase: g.phase,
      // Deadline / feature freeze: {deadline, freezeAt, frozen} (ms), so the page can count down.
      time: timeInfo(board.getSettings()),
      presence: board.presence(onlineHumans()),
      // Which board this is (several can run on one server).
      board: { slug, name: registry.get(slug)?.name || slug, default: isDefault(), path: prefix() },
      ...(human ? { setup: { ...setupInfo(), viewer_token: tokens.viewerToken } } : {}),
      // CI on the project's main branch (GitHub Actions via gh), or null.
      main_ci: board.mainCi || null,
      // How long tasks take on this board so far (null until 3 are done): for the planner and the retro.
      stats: board.taskStats(),
      // Times each task was sent back from review, {id: n}: the page flags tasks that keep bouncing.
      rejects: board.rejectCounts(),
    };
  }));

  // What an agent should do now. The Claude Stop hook calls it (with the agent token) to nudge an idle agent.
  api.get('/next', h((req) => {
    const g = board.nextAction(agentFrom(req));
    return { phase: g.phase, next_action: g.next_action, actionable: g.actionable, reason: g.reason };
  }));

  // Is an agent name taken by another laptop? join asks before any agent connects (GET), then reserves the
  // names it sets up (POST {laptop, person?}). laptop: join's laptop id. Same answer shape for both.
  const laptopParam = (v) => String(v || '').replace(/[^\w-]/g, '').slice(0, 32);
  // Names are 1-64 letters, digits, _ . or -; anything else is refused before it reaches the board.
  const NAME_RE = /^[\w.-]{1,64}$/;
  const badName = (res, what) => { res.status(400); throw new Error(`${what} must be 1-64 letters, digits, _ . or -.`); };
  api.get('/names/:name', h((req, res) => {
    if (!NAME_RE.test(req.params.name)) badName(res, 'The name');
    return board.checkName(req.params.name, laptopParam(req.query.laptop) || null);
  }));
  api.post('/names/:name', h((req, res) => {
    if (!NAME_RE.test(req.params.name)) badName(res, 'The name');
    const person = req.body?.person ?? null;
    if (person !== null && (typeof person !== 'string' || !NAME_RE.test(person))) badName(res, 'person');
    const laptop = laptopParam(req.body?.laptop);
    if (!laptop) { res.status(400); throw new Error('laptop is required (join\'s laptop id).'); }
    return board.reserveName(req.params.name, laptop, person);
  }));

  // An agent reports that it hit its usage limit ({until?, note?}). Humans may mark any agent; with the
  // agent token, only the name in X-Agent — the Claude Stop hook calls this when it sees the limit. This is
  // trust-based: every agent shares the agent token and X-Agent is self-declared, like all agent identity.
  api.post('/agents/:name/limit', h((req, res) => {
    const name = normName(req.params.name).split('/')[0];
    if (req.role !== 'human' && agentFrom(req).split('/')[0] !== name) { res.status(403); throw new Error('An agent can only report its own usage limit.'); }
    const r = board.reportUsageLimit(name, req.body || {}, { by: req.role === 'human' ? 'human' : 'agent' });
    presence();
    return r;
  }));

  // Humans on the web board: an agent's task limit ({slots: n | null}) or its usage-limit mark ({limited, until, note}).
  api.patch('/agents/:name', h((req) => {
    const r = board.setAgent(agentFrom(req), req.params.name, req.body || {});
    presence();
    return r;
  }));

  // Humans edit goal/roles from the web board.
  api.put('/settings', h((req) => board.setSettings(agentFrom(req), req.body || {}, { human: true })));

  // Used by the Stop hook. wait>0 long-polls. before=<id>: the 200 events before that id (the web feed's "load earlier").
  // A long-poll holds a slot while it waits. The Stop hook names its agent in X-Agent (or ?exclude=); a wait
  // from nobody in particular counts per address.
  const eventsSlot = (req, res, next) => {
    if (!(Number(req.query.wait) > 0) || Number(req.query.before) > 0) return next();
    const who = normName(req.get('x-agent') || req.query.agent || req.query.exclude || '').split('/')[0];
    if (holdSlot(req, res, who ? `wait:${who}` : `ip:${clientIp(req)}`, who || 'this address', false)) next();
  };
  api.get('/events', eventsSlot, h(async (req) => {
    const since = Number(req.query.since || 0);
    const before = Math.max(0, Number(req.query.before) || 0) || undefined;
    if (before) return { events: board.events({ before, limit: 200 }) };
    const exclude_author = req.query.exclude || undefined;
    const wait = Math.min(Number(req.query.wait || 0), 600);
    // An agent (the Stop hook) gets the direct messages it may read; the web feed gets none (they come with /state).
    const direct = req.role === 'agent' || exclude_author ? normName(req.get('x-agent') || exclude_author || '') : undefined;
    const filter = { since, exclude_author, limit: 200, direct };
    const ac = new AbortController();
    req.on('close', () => ac.abort());
    const events = wait > 0 ? await board.waitForEvents(filter, wait * 1000, ac.signal) : board.events(filter);
    // Archived while waiting: the database is closed now.
    if (board.closed) { const e = new Error('This board is archived.'); e.status = 410; throw e; }
    return { events, cursor: events.length ? events.at(-1).id : Math.max(since, board.latestEventId()) };
  }));
  api.get('/cursor', h(() => ({ cursor: board.latestEventId() })));

  const announcements = startAnnouncements({ board, announced, every, later, forget });

  setupNotifications({ board, slug, api, prefix, humanToken, rawSetting, putSetting });

  // ---------- token rotation (a link with the token leaked) ----------
  const openStreams = new Set();
  const closeStreams = () => { for (const s of openStreams) { try { s.end(); } catch {} } openStreams.clear(); };
  api.post('/token/rotate', humanToken, h((req, res) => {
    if (envToken) { res.status(400); return { error: 'The token comes from BOARD_TOKEN; change it there and restart the board.' }; }
    const t = tokens.rotate();
    board.emit({ author: 'board', kind: 'message', channel: 'general', text: '@all The board token was rotated: everyone re-runs the join command from the web board.' });
    // Live streams were authorised with the old token: close them all (open pages reconnect with the new one).
    later(closeStreams, 50);
    return { token: t, setup: { ...setupInfo(), viewer_token: tokens.viewerToken } };
  }));

  startBackups({ board, dir, slug, every, later });

  startGithubPolling({ board, announced, rawSetting, putSetting, isClosed: () => closed, presence, every, later });
  // Proposals waiting on a planner who went offline become open tasks.
  every(() => { try { board.sweepProposals(); } catch {} }, 30e3);

  // A QR code (SVG) for any text, e.g. the join command or the board link, to scan from a phone.
  api.get('/qr.svg', async (req, res) => {
    const text = String(req.query.text ?? '');
    if (!text || text.length > 1000) return res.status(400).json({ error: 'text is required (at most 1000 characters)' });
    try { res.type('image/svg+xml').send(await QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })); }
    catch (e) { res.status(400).json({ error: String(e?.message || e) }); }
  });

  // After the event: what slowed the team down (time per task, review bounces, blocked time, …).
  api.get('/retro', (_req, res) => res.type('text/markdown; charset=utf-8').send(board.retro()));

  // End-of-day write-up (markdown) and a full JSON backup of the board.
  // Direct messages are in both for humans only.
  api.get('/summary', (req, res) => res.type('text/markdown; charset=utf-8').send(board.summary({ direct: req.role === 'human' })));
  api.get('/export', (req, res) => {
    res.set('Content-Disposition', `attachment; filename="agent-board-${slug}-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(board.exportAll({ direct: req.role === 'human' }));
  });

  // {text, channel} for the shared chat, or {text, to} for a direct message (to: an agent's name, or "planner").
  api.post('/messages', h((req) => board.post(agentFrom(req), req.body || {}, { human: true })));
  api.post('/tasks', h((req) => board.createTask(agentFrom(req), req.body || {}, { human: true })));
  api.post('/tasks/:id/decide', h((req) => board.decideProposal(agentFrom(req), Number(req.params.id), req.body || {}, { human: true })));
  api.patch('/tasks/:id', h((req) => board.updateTask(agentFrom(req), Number(req.params.id), req.body, { human: true })));
  api.post('/tasks/:id/cancel', h((req) => board.cancelTask(agentFrom(req), Number(req.params.id), (req.body || {}).reason, { human: true })));
  api.delete('/tasks/:id', h((req) => board.deleteTask(agentFrom(req), Number(req.params.id))));
  api.post('/questions/:id/answer', h((req) => board.answer(agentFrom(req), Number(req.params.id), req.body.answer)));
  api.post('/locks/release', h((req) => board.unlockFiles(agentFrom(req), { paths: req.body.paths, force: true })));

  // Live updates for the web UI. Open streams are tracked so a token rotation (or archiving) can close them.
  api.get('/stream', (req, res) => {
    // Live pages count toward the open-slot limits too: per person (or per address for the presenter view).
    const viewer = req.role === 'human' ? normName(req.query.name).replace(/[^\w.-]/g, '').slice(0, 64) : '';
    if (!holdSlot(req, res, viewer ? `stream:${viewer}` : `stream:${req.role}:${clientIp(req)}`, viewer || 'this address', false)) return;
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    openStreams.add(res);
    // Direct messages go to humans only (an agent's stream: its own threads; the presenter's: none).
    const send = (ev) => {
      if (ev?.channel === DIRECT && req.role !== 'human' && !(req.role === 'agent' && board.canSee(ev, agentFrom(req)))) return;
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
    };
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    board.bus.on('event', send);
    // ?name=<human> marks that person as watching the board.
    // Only the human token marks someone as watching (the viewer token is a projector, not a person).
    const human = req.role === 'human' ? normName(req.query.name).replace(/[^\w.-]/g, '').slice(0, 64) : '';
    if (human) {
      humansOnline.set(human, (humansOnline.get(human) || 0) + 1);
      board.touch(human, 'human');
      presence();
    }
    req.on('close', () => {
      openStreams.delete(res);
      clearInterval(ping);
      board.bus.off('event', send);
      if (human && !closed) {
        humansOnline.set(human, Math.max(0, (humansOnline.get(human) || 1) - 1));
        board.touch(human, 'human');
        presence();
      }
    });
  });

  router.use('/api', api);
  // The web board and presenter view. Pages use addresses relative to where they're served
  // (/b/<slug>/ or /), so the same files work for every board.
  router.use(express.static(PUBLIC_DIR));

  let closed = false;
  // Stop serving: timers, live streams, listeners, and the database file.
  function close() {
    if (closed) return;
    closed = true;
    clearAll();
    announcements.clear();
    closeStreams();
    // Settles pending long-polls before the file closes (a timer touching a closed DB would crash the server).
    board.close();
    board.bus.removeAllListeners();
  }

  return {
    slug, dir, board, router, close, setupInfo,
    get token() { return tokens.token; },
    get agentToken() { return tokens.agentToken; },
    get viewerToken() { return tokens.viewerToken; },
    get closed() { return closed; },
    onlineHumans,
  };
}

// ---------- all boards ----------
const runtimes = new Map(); // slug -> runtime (live boards only)
// Live boards that couldn't be opened (corrupt database, bad registry entry, a token another board uses):
// slug -> reason. They answer 503 and show as "failed" on the boards page; the other boards keep running.
const failures = new Map();
function startBoard(b) {
  if (runtimes.has(b.slug)) return runtimes.get(b.slug);
  failures.delete(b.slug);
  let rt;
  try {
    rt = createBoardRuntime(b.slug, registry.dirOf(b));
    // Two boards with the same token would let one board's links and agents act on the other.
    const twin = [...runtimes.values()].find((o) => safeEq(o.token, rt.token));
    if (twin) { rt.close(); throw new Error(`it uses the same token as "${twin.slug}". Give it its own token (delete ${path.join(registry.dirOf(b), 'token')} while the server is stopped) and restore it.`); }
  } catch (e) {
    const reason = String(e?.message || e);
    failures.set(b.slug, reason);
    console.error(`✗ Board "${b.slug}" failed to open: ${reason}`);
    throw Object.assign(new Error(`This board failed to open: ${reason}`), { status: 503 });
  }
  runtimes.set(b.slug, rt);
  return rt;
}
function stopBoard(slug) {
  failures.delete(slug);
  const rt = runtimes.get(slug);
  if (!rt) return;
  rt.close();
  runtimes.delete(slug);
}
for (const b of registry.list()) if (b.status === 'live') { try { startBoard(b); } catch {} }
const defaultRuntime = () => runtimes.get(registry.defaultSlug);

// Numbers for the boards page: live boards from their runtime, archived ones by reading the file.
function boardSummary(b) {
  const live = runtimes.get(b.slug);
  const out = {
    slug: b.slug, name: b.name, status: failures.has(b.slug) || registry.problem(b.slug) ? 'failed' : b.status, default: b.slug === registry.defaultSlug,
    created: b.created || null, archived_at: b.archived_at || null,
    error: failures.get(b.slug) || registry.problem(b.slug) || null,
    url: `${bestBase()}/b/${b.slug}/`,
    tasks: 0, done: 0, agents_online: 0, last_activity: null,
  };
  try {
    if (live) {
      // Proposed tasks aren't counted, as on the board and the presenter ("4 of 19 done").
      const tasks = live.board.listTasks().filter((t) => t.status !== 'proposed');
      out.tasks = tasks.length; out.done = tasks.filter((t) => t.status === 'done').length;
      out.agents_online = live.board.presence().filter((p) => p.kind === 'agent' && p.online).length;
      out.last_activity = live.board.db.prepare('SELECT MAX(ts) AS t FROM events').get().t || null;
    } else if (!registry.problem(b.slug)) {
      const file = path.join(registry.dirOf(b), 'board.db');
      if (fs.existsSync(file)) {
        const db = new DatabaseSync(file, { readOnly: true });
        try {
          const t = db.prepare("SELECT COUNT(*) AS n, SUM(status = 'done') AS d FROM tasks WHERE status != 'proposed'").get();
          out.tasks = Number(t.n) || 0; out.done = Number(t.d) || 0;
          out.last_activity = db.prepare('SELECT MAX(ts) AS t FROM events').get().t || null;
        } finally { db.close(); }
      }
    }
  } catch {}
  return out;
}
// Links that open a board as a human (the board's token in the URL), plus how teammates join it.
function boardLinks(slug) {
  const rt = runtimes.get(slug);
  if (!rt) throw new Error(`"${slug}" isn't live: restore it first.`);
  const info = rt.setupInfo();
  const best = info.join_commands[0];
  return {
    slug, name: registry.get(slug)?.name || slug,
    url: best.web_url, token: rt.token,
    join_command: best.command,
    viewer_url: `${best.web_url.replace(/\?token=.*$/, '')}present.html?token=${rt.viewerToken}`,
  };
}

const app = express();
// Security headers on every answer. The CSP blocks plugins, <base> tricks, framing (clickjacking), form posts
// and connections to anywhere but this server. No script-src: the pages use inline scripts (a strict one would
// need hashes or nonces); the escaping of untrusted text is what keeps scripts out (tests/ui/hostile.mjs).
const CSP = "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self'; form-action 'self'";
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({ 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
  next();
});
app.use(express.json({ limit: '2mb' }));

// app stays 'claude-board' (the name before the rename to Agent Board): older join/doctor/start scripts and
// people's monitoring check it. name is the display name.
app.get('/health', (_req, res) => res.json({ ok: true, app: 'claude-board', name: 'Agent Board', version: VERSION, boards: runtimes.size }));

// ---------- managing boards (the host, with the admin token) ----------
// The admin token only manages boards; it never works as a board token, and board tokens never work here.
function adminAuth(req, res, next) {
  const h2 = req.get('authorization') || '';
  // Header or Bearer only: ?admin= in API URLs would end up in logs and history. (The /boards page takes
  // ?admin= once as a handoff and removes it from the address bar.)
  const t = h2.toLowerCase().startsWith('bearer ') ? h2.slice(7).trim() : String(req.get('x-admin-token') || '');
  if (!t || !safeEq(t, ADMIN_TOKEN)) return res.status(401).json({ error: 'This needs the admin token (printed when the server starts, and in data/admin-token).' });
  next();
}
const admin = express.Router();
admin.use(adminAuth);
admin.get('/boards', h(() => registry.list().map(boardSummary)));
admin.post('/boards', h((req) => {
  const b = registry.create(req.body?.name, req.body?.slug);
  try { startBoard(b); } catch (e) {
    // Don't leave a "live" board that nothing serves.
    registry.data.boards = registry.data.boards.filter((x) => x.slug !== b.slug); registry.save();
    failures.delete(b.slug);
    throw e;
  }
  return boardLinks(b.slug);
}));
admin.get('/boards/:slug/open', h((req) => boardLinks(registry.must(req.params.slug).slug)));
admin.post('/boards/:slug/archive', h((req) => {
  const b = registry.archive(req.params.slug);
  stopBoard(b.slug);
  return boardSummary(registry.get(b.slug));
}));
admin.post('/boards/:slug/restore', h((req) => {
  const before = registry.must(req.params.slug);
  const prev = { status: before.status, archived_at: before.archived_at };
  const b = registry.restore(req.params.slug);
  try { startBoard(b); } catch (e) {
    const x = registry.get(b.slug); x.status = prev.status; if (prev.archived_at) x.archived_at = prev.archived_at; registry.save();
    failures.delete(b.slug);
    throw e;
  }
  return boardSummary(registry.get(b.slug));
}));
admin.post('/boards/:slug/default', h((req) => {
  const slug = registry.must(req.params.slug).slug;
  if (!runtimes.has(slug)) throw new Error(`"${slug}" isn't being served${failures.has(slug) ? ` (it failed to open: ${failures.get(slug)})` : ''}: it can't be the default.`);
  registry.setDefault(slug);
  return boardSummary(registry.get(slug));
}));
admin.delete('/boards/:slug', h((req) => {
  if (runtimes.has(req.params.slug)) throw new Error(`Archive "${req.params.slug}" first; only archived boards can be deleted.`);
  return registry.remove(req.params.slug);
}));
app.use('/api/admin', admin);

// The boards page (the host's overview). The page itself holds no secrets; it asks for the admin token.
app.get(['/boards', '/boards/'], (_req, res) => {
  const page = path.join(PUBLIC_DIR, 'boards.html');
  if (fs.existsSync(page)) return res.sendFile(page);
  res.type('text/plain').send('The boards page is not installed. Manage boards with:  npm run boards');
});

// ---------- a board at /b/<slug>/ ----------
app.use('/b/:slug', (req, res, next) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const rt = runtimes.get(slug);
  if (rt) return rt.router(req, res, next);
  const b = registry.get(slug);
  const isData = /^\/(api|mcp)(\/|$)/.test(req.path);
  const failed = failures.get(slug) || (b && registry.problem(slug));
  if (b && b.status === 'live' && failed) {
    if (isData) return res.status(503).json({ error: `This board failed to open: ${failed}` });
    return res.status(503).type('text/plain').send(`This board failed to open: ${failed}\nAsk the host to check the server's window.`);
  }
  if (b && b.status === 'archived') {
    if (isData) return res.status(410).json({ error: 'This board is archived.' });
    return res.status(410).type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Board archived</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem;color:#222"><h1 style="font-size:1.4rem">This board is archived</h1><p>"${String(b.name).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}" isn't being served any more. Ask the host to restore it, or to send you the link to the current board.</p></body>`);
  }
  if (isData) return res.status(404).json({ error: `No board called "${slug}".` });
  return res.status(404).type('text/plain').send(`No board called "${slug}".`);
});

// ---------- the default board at the root (/, /api, /mcp) ----------
app.use((req, res, next) => {
  const rt = defaultRuntime();
  const isData = /^\/(api|mcp)(\/|$)/.test(req.path);
  // A token that isn't the default board's but belongs to another live board: that board used to be the
  // default (served here) and moved. Say where, instead of a bare 401.
  const t = isData ? tokenFrom(req) : '';
  if (t && !(rt && [rt.token, rt.agentToken, rt.viewerToken].some((x) => safeEq(t, x)))) {
    const moved = [...runtimes.values()].find((o) => [o.token, o.agentToken, o.viewerToken].some((x) => safeEq(t, x)));
    if (moved) return res.status(409).json({ error: 'This board moved', moved_to: `/b/${moved.slug}` });
  }
  if (!rt) {
    const f = failures.get(registry.defaultSlug);
    return res.status(503).json({ error: f ? `The default board failed to open: ${f}` : 'No board is live. Restore one or create one at /boards.' });
  }
  return rt.router(req, res, next);
});

// Malformed JSON and other request errors: a JSON answer instead of Express's HTML page.
app.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(err.status || err.statusCode || 400).json({ error: err.type === 'entity.parse.failed' ? 'Request body is not valid JSON.' : String(err.message || err) });
});

const httpServer = app.listen(PORT, HOST, () => {
  writePid();
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { dropPid(); process.exit(0); });
  const addrs = serverAddresses();
  const best = bestBase();
  const rt = defaultRuntime();
  const line = '─'.repeat(64);
  console.log(`\n${line}\n Agent Board is running  (version ${VERSION}, port ${PORT})\n${line}`);
  if (rt) {
    const name = registry.get(rt.slug)?.name || rt.slug;
    console.log(`\n 1. Open the web board${runtimes.size > 1 ? ` "${name}"` : ''}. It walks everyone through setup:`);
    console.log(`      ${best}/b/${rt.slug}/?token=${rt.token}`);
    if (!addrs.length) {
      console.log('\n    ⚠ No network address found, so teammates can\'t reach this laptop. Join the wifi, start Tailscale, or use  npm run tunnel');
    }
    console.log('\n 2. Teammates connect their laptop. First time only, get the tool:');
    console.log('      git clone https://github.com/DL4P1N/agent-board && cd agent-board');
    console.log('    (already have an agent-board folder, or an older claude-board one? run git pull in it instead)');
    console.log('    Then, in the agent-board folder (it asks the rest):');
    console.log(`      npm run join -- --url ${best}/b/${rt.slug} --token ${rt.token}`);
    for (const a of addrs.slice(1)) console.log(`      (or ${a.base}/b/${rt.slug} if that doesn't connect: ${a.label})`);
    console.log('\n The token in these links is the board\'s password: share it only with your team.');
    if (!PUBLIC_URL) console.log(' Teammates on another network? Stop this (Ctrl+C) and run  npm run tunnel  instead.');
    console.log(' A teammate can\'t connect? They run  npm run doctor  in their agent-board folder.');
  } else {
    console.log('\n No board is live. Create one or restore one on the boards page below.');
  }
  for (const [slug, why] of failures) console.log(`\n ✗ Board "${slug}" failed to open: ${why}`);
  const others = [...runtimes.values()].filter((r) => r !== rt);
  if (others.length) {
    console.log('\n Other live boards on this server:');
    for (const o of others) console.log(`      ${registry.get(o.slug)?.name || o.slug}:  ${best}/b/${o.slug}/?token=${o.token}`);
  }
  console.log(`\n Manage boards (create, switch, archive):  ${best}/boards?admin=${ADMIN_TOKEN}`);
  console.log(`\n Keep this window open. After a \`git pull\` the board reloads by itself.`);
  console.log(`${line}\n`);
  offerHostJoin();
});

httpServer.on('error', async (e) => {
  // No IPv6 on this machine: IPv4 only.
  if (!process.env.HOST && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(e.code)) return httpServer.listen(PORT, '0.0.0.0');
  if (e.code !== 'EADDRINUSE') throw e;
  let other = null;
  try { other = await (await fetch(`http://localhost:${PORT}/health`, { signal: AbortSignal.timeout(2000) })).json(); } catch {}
  if (other?.app === 'claude-board' || other?.app === 'agent-board') {
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
  const rt = defaultRuntime();
  if (!rt || !process.stdin.isTTY || process.env.BOARD_NO_JOIN) return;
  const TOKEN = rt.token;
  const declined = path.join(rt.dir, '.host-join-declined');
  const joinCmd = `npm run join -- --url http://localhost:${PORT}/b/${rt.slug} --token ${TOKEN}`;
  if (fs.existsSync(declined)) {
    console.log(` To connect this laptop's AI tool, run any time:  ${joinCmd}\n`);
    return;
  }
  let cfg = null;
  // ~/.agent-board.json, or ~/.claude-board.json on laptops that joined before the rename to Agent Board.
  for (const f of ['.agent-board.json', '.claude-board.json']) {
    try { cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), f), 'utf8')); break; } catch {}
  }
  const ours = (t) => t === TOKEN || t === rt.agentToken;
  if (ours(cfg?.token)) {
    console.log(` This laptop is connected as "${cfg.agent}". (Re-run setup any time: npm run join -- --url http://localhost:${PORT}/b/${rt.slug} --token ${TOKEN})\n`);
    return;
  }
  // Already connected to another board: Enter keeps that (switching is a deliberate "y").
  const otherBoard = !!cfg?.token && !(cfg.agents || []).some((a) => ours(a?.token));
  process.stdout.write(otherBoard
    ? ` This laptop is connected to another board${cfg.agent ? ` as "${cfg.agent}"` : ''}. Connect its AI tool to this board? [y/N] `
    : ' Connect this laptop\'s AI tool to the board now? [Y/n] ');
  process.stdin.setEncoding('utf8');
  process.stdin.once('data', (answer) => {
    process.stdin.pause();
    if (otherBoard && !/^\s*y/i.test(answer)) {
      console.log(` Kept the other board. To connect to this one later:\n   ${joinCmd}\n`);
      return;
    }
    if (/^\s*n/i.test(answer)) {
      fs.writeFileSync(declined, '');
      console.log(` Skipped. To connect later, run in another terminal:\n   npm run join -- --url http://localhost:${PORT}/b/${rt.slug} --token ${TOKEN}\n`);
      return;
    }
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'join.mjs'), '--url', `http://localhost:${PORT}/b/${rt.slug}`, '--token', TOKEN], { stdio: 'inherit' });
    child.on('exit', () => {
      // Join's output pushed the banner off screen: repeat what the host needs next.
      const best = bestBase();
      console.log(`\n The board keeps running here. Keep this window open.`);
      console.log(` Web board:       ${best}/b/${rt.slug}/?token=${TOKEN}`);
      console.log(` Teammates join:  npm run join -- --url ${best}/b/${rt.slug} --token ${TOKEN}\n`);
    });
  });
}
