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
import { tokenFrom, TOKEN_ROTATED, safeEq, agentFrom, h } from './http-util.js';
import { AGENT_TOOLS, serverAddresses, bestBase } from './network.js';
import { writePid, dropPid } from './pidfile.js';
import { hiddenSettings } from './board-settings.js';
import { startGithubPolling } from './github.js';

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

// ---------- limits: one runaway client must not slow the board down for everyone ----------
// Board calls per agent and per network address (token buckets: a minute's worth at once, refilling steadily),
// and how many slow requests (wait_for_events, long-polls, live streams) may be open per agent and in total.
// Generous on purpose: a normal day, the tests and the rehearsal never get near them. 0 turns one off.
const LIMITS = {
  agentPerMinute: envLimit('BOARD_RATE_AGENT', 600),
  ipPerMinute: envLimit('BOARD_RATE_IP', 3000),
  waitsPerAgent: envLimit('BOARD_WAITS_AGENT', 20),
  waitsTotal: envLimit('BOARD_WAITS_TOTAL', 1000),
};
const agentRate = new RateLimiter(LIMITS.agentPerMinute);
const ipRate = new RateLimiter(LIMITS.ipPerMinute);
const slowSlots = new Slots(LIMITS.waitsPerAgent, LIMITS.waitsTotal);
setInterval(() => { agentRate.sweep(); ipRate.sweep(); }, 60e3).unref();
// Who's calling. Behind `npm run tunnel` every request comes from cloudflared on this machine, so Cloudflare's
// header names the real address (trusted only from this machine itself).
function clientIp(req) {
  const peer = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  const cf = String(req.get('cf-connecting-ip') || '').trim();
  if (cf && (peer === '127.0.0.1' || peer === '::1') && net.isIP(cf)) return cf;
  return peer || 'unknown';
}
// 429 with Retry-After and a message the agent can act on. MCP gets a JSON-RPC error (MCP clients show its text).
function tooMany(req, res, retryAfter, error, mcp) {
  res.status(429).set('Retry-After', String(retryAfter));
  if (mcp) return res.json({ jsonrpc: '2.0', error: { code: -32000, message: error, data: { reason: 'rate_limited', retry_after: retryAfter } }, id: req.body?.id ?? null });
  return res.json({ error, reason: 'rate_limited', retry_after: retryAfter });
}
const rateText = (who, r, per) => `Too many board calls from ${who}: the limit is ${per} a minute. Wait ${r.retryAfter} s, then carry on. If you're checking the board in a loop, call wait_for_events instead: it returns as soon as something happens.`;
const slotText = (who, full) => (full.full === 'key'
  ? `${who} already has ${full.open} waits open (wait_for_events, the Stop hook or live pages), the most one agent may have. Let one of them return before starting another: they wake up as soon as something happens.`
  : `The board has ${full.open} waits and live streams open, as many as it allows. Try again in a few seconds.`);

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

// ---------- notifications: helpers shared by all boards ----------
const NOTIFY_EVENTS = ['questions', 'main', 'blocked', 'conflict', 'freeze', 'limit'];
function notifyKind(url) {
  if (!url) return null;
  let u; try { u = new URL(url); } catch { return null; }
  // ?kind=slack|discord|ntfy|generic forces a format (self-hosted relays, tests).
  const forced = u.searchParams.get('kind');
  if (['slack', 'discord', 'ntfy', 'generic'].includes(forced)) return forced;
  if (/(^|\.)hooks\.slack\.com$/i.test(u.hostname)) return 'slack';
  if (/(^|\.)(discord|discordapp)\.com$/i.test(u.hostname) && /\/api\/webhooks\//.test(u.pathname)) return 'discord';
  if (/ntfy/i.test(u.hostname) || u.searchParams.get('ntfy') === '1') return 'ntfy';
  return 'generic';
}
// "https://hooks.slack.com/…/abcd": enough to recognise it, not enough to use it.
function maskUrl(url) {
  if (!url) return null;
  try { const u = new URL(url); const tail = (u.pathname + u.search).replace(/\/+$/, '').slice(-4); return `${u.protocol}//${u.host}/…${tail ? '/' + tail : ''}`; } catch { return null; }
}
// The webhook URL checks, the private-address list and the pinned delivery live in src/webhook.js.
// Slack: escape &, <, > so agent text can't produce <!channel>/<!here> pings or links.
const slackEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const BACKUP_MS = process.env.BOARD_BACKUP_SECONDS ? Number(process.env.BOARD_BACKUP_SECONDS) * 1000 : (process.env.BOARD_BACKUP_MINUTES !== undefined ? Number(process.env.BOARD_BACKUP_MINUTES) : 10) * 60e3;

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
  // `let`: humans can rotate the token from the web board (POST /api/token/rotate).
  let TOKEN = envToken || boardToken(dir);
  // Two keys: the board token (humans, the web board, join) can do everything; the agent token
  // (derived from it, written into each AI tool's config by join) can use MCP and read the API, but
  // can't do human-only things like approving the plan, setting the deadline or deleting tasks.
  let AGENT_TOKEN = agentTokenFor(TOKEN);
  // A third, read-only key for the presenter view: GET /api/state (nothing secret) and the live stream only.
  let VIEW_TOKEN = viewerTokenFor(TOKEN);
  const timers = [];
  const every = (fn, ms) => { const t = setInterval(fn, ms); t.unref?.(); timers.push(t); return t; };
  // A fired timeout leaves the list, so it doesn't grow with every one-off timer.
  const later = (fn, ms) => {
    const t = setTimeout(() => { forget(t); fn(); }, ms);
    t.unref?.(); timers.push(t); return t;
  };
  const forget = (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); };
  const presence = () => board.bus.emit('event', { id: 0, kind: 'presence', text: '' });
  // Tokens retired by a rotation (hashed, kept in the board's folder), so an old link or agent config
  // gets "the token was changed" instead of a bare "bad token". reason: 'token_rotated' is for the web page.
  const retiredFile = path.join(dir, 'retired-tokens');
  const tokenHash = (t) => crypto.createHash('sha256').update(String(t)).digest('base64url');
  let retired = [];
  try { retired = JSON.parse(fs.readFileSync(retiredFile, 'utf8')).filter((x) => typeof x === 'string'); } catch {}

  function auth(req, res, next) {
    const t = tokenFrom(req);
    if (safeEq(t, TOKEN)) req.role = 'human';
    else if (safeEq(t, AGENT_TOKEN)) req.role = 'agent';
    else if (safeEq(t, VIEW_TOKEN)) req.role = 'viewer';
    else if (t && retired.includes(tokenHash(t))) return res.status(401).json({ error: TOKEN_ROTATED, reason: 'token_rotated' });
    else return res.status(401).json({ error: 'bad or missing token' });
    next();
  }
  function viewerLimits(req, res, next) {
    if (req.role !== 'viewer') return next();
    if (req.method === 'GET' && (req.path === '/state' || req.path === '/stream')) return next();
    return res.status(403).json({ error: 'This is the read-only viewer token (presenter view).' });
  }
  function humanOnly(req, res, next) {
    // An agent may report its own usage limit (the Claude Stop hook does, with the agent token).
    if (req.method === 'POST' && req.role === 'agent' && /^\/agents\/[^/]+\/limit$/.test(req.path)) return next();
    // join reserves its agent names (POST /names/:name) with whichever token it was given.
    if (req.method === 'POST' && req.role === 'agent' && /^\/names\/[^/]+$/.test(req.path)) return next();
    if (req.method !== 'GET' && req.role !== 'human') return res.status(403).json({ error: 'This needs the board token (humans on the web board), not an agent token.' });
    next();
  }

  const router = express.Router();
  // Archived (closed) while a request was being routed: nothing to serve any more.
  router.use((req, res, next) => (closed ? res.status(410).json({ error: 'This board is archived.' }) : next()));
  // Board calls per network address (all tokens), and per agent once we know it's one.
  const ipLimit = (mcp) => (req, res, next) => {
    const r = ipRate.take(clientIp(req));
    return r.ok ? next() : tooMany(req, res, r.retryAfter, rateText(`this address (${clientIp(req)})`, r, ipRate.perMinute), mcp);
  };
  router.use('/mcp', ipLimit(true));
  router.use('/api', ipLimit(false));
  const agentKey = (name) => `${slug}|${normName(name).split('/')[0] || 'anonymous'}`;
  const agentLimit = (req, res, name, mcp) => {
    const r = agentRate.take(agentKey(name));
    if (!r.ok) tooMany(req, res, r.retryAfter, rateText(normName(name).split('/')[0] || 'this agent', r, agentRate.perMinute), mcp);
    return r.ok;
  };
  // A slow request (a wait or a live stream) holds a slot until its connection closes. false = refused (429 sent).
  const holdSlot = (req, res, key, who, mcp) => {
    const got = slowSlots.acquire(`${slug}|${key}`);
    if (typeof got !== 'function') { tooMany(req, res, 5, slotText(who, got), mcp); return false; }
    res.on('close', got);
    return true;
  };

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
        command: `npm run join -- --url ${a.base}${p} --token ${TOKEN}`,
        web_url: `${a.base}${p}/?token=${TOKEN}`,
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
      ...(human ? { setup: { ...setupInfo(), viewer_token: VIEW_TOKEN } } : {}),
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

  // Announce the feature freeze (30 min warning, then the freeze itself) so waiting agents wake up.
  // Remembered in the board's data, so a restart (or `--watch` reload) doesn't announce twice;
  // a different freeze time (to the nearest 5 min) is announced again.
  const flagKey = (k, t) => `_announced_${k}_${Math.round(t.freezeAt / 300e3)}`;
  const { rawSetting, putSetting, announced } = hiddenSettings(board);
  const announceTime = () => {
    if (board.closed) return;
    const t = timeInfo(board.getSettings());
    if (!t.deadline) return;
    const key = (k) => flagKey(k, t);
    const now = Date.now();
    if (!t.frozen && t.freezeAt - now <= 30 * 60e3 && !announced.has(key('warn'))) {
      announced.add(key('warn'));
      board.emit({ author: 'board', kind: 'message', channel: 'general', text: `@all Feature freeze in 30 minutes (${t.freezeLabel}); demo at ${t.deadlineLabel}. Don't start big tasks now. Aim to get what you have merged.` });
    }
    // A freeze "0 min before" starts at the deadline itself: still announce it (within a few minutes).
    if (t.frozen && (now < t.deadline || now - t.freezeAt < 5 * 60e3) && !announced.has(key('freeze'))) {
      announced.add(key('freeze'));
      board.emit({ author: 'board', kind: 'message', channel: 'general', text: `@all FEATURE FREEZE. Demo at ${t.deadlineLabel}. Don't claim new tasks. Finish, push and merge what you have; release anything that can't land in time.` });
    }
    // The demo time itself: wake waiting agents so they wrap up (not when the board starts long after it).
    const demoKey = `_announced_demo_${Math.round(t.deadline / 300e3)}`;
    if (t.past && now - t.deadline < 5 * 60e3 && !announced.has(demoKey)) {
      announced.add(demoKey);
      board.emit({ author: 'board', kind: 'message', channel: 'general', text: `@all Demo time (${t.deadlineLabel}). Wrap up: push and merge what's finished, release what isn't with a note, and post a short status in general.` });
    }
  };
  every(announceTime, 20e3);
  // Also check right at the warning, the freeze and the demo time, so nobody waits for the next tick.
  // Rescheduled only when the deadline or freeze time actually changes (other settings edits leave them
  // alone), with one set of handles: the old checks are cleared before new ones are scheduled.
  let announceTimers = [];
  let scheduledFor = null;
  const clearAnnounceTimers = () => {
    for (const t of announceTimers) { clearTimeout(t); forget(t); }
    announceTimers = [];
  };
  board.bus.on('event', (e) => {
    if (e?.kind !== 'settings') return;
    const t = timeInfo(board.getSettings());
    const key = t.deadline ? `${t.deadline}|${t.freezeAt}` : '';
    if (key === scheduledFor) return;
    scheduledFor = key;
    clearAnnounceTimers();
    // A new deadline or freeze time is checked at once: a short freeze could pass between two ticks.
    setImmediate(announceTime);
    if (!t.deadline) return;
    for (const at of [t.freezeAt - 30 * 60e3, t.freezeAt, t.deadline]) {
      const ms = at - Date.now() + 50;
      if (ms > 0 && ms < 2 ** 31 - 1) announceTimers.push(later(announceTime, ms));
    }
  });

  // ---------- notifications to humans away from the laptop (Slack / Discord / ntfy / any webhook) ----------
  // At Kubecon a question waited 31 minutes for a human. Settings `_notify_url` / `_notify_events` are
  // underscore keys, so agents never see them (getSettings hides them).
  const notifyEvents = () => (rawSetting('_notify_events') ?? NOTIFY_EVENTS.join(',')).split(',').map((s) => s.trim()).filter((s) => NOTIFY_EVENTS.includes(s));
  const boardLinkNoToken = () => `${bestBase()}${prefix()}`;
  let notifyFailLogged = 0;
  async function deliver(text, kind = 'info', url = rawSetting('_notify_url')) {
    if (!url) return { ok: false, status: 0, error: 'No webhook set.' };
    const k = notifyKind(url); const link = boardLinkNoToken();
    const full = `${text}\n${link}`;
    let init;
    // Text written by agents goes into these messages: no channel-wide pings from it.
    if (k === 'slack') init = { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: slackEscape(full) }) };
    else if (k === 'discord') init = { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: full.slice(0, 1900), allowed_mentions: { parse: [] } }) };
    else if (k === 'ntfy') init = { headers: { 'Content-Type': 'text/plain; charset=utf-8', Title: 'Agent Board', Tags: kind === 'test' ? 'bell' : kind, Click: link }, body: text };
    // Generic webhook: board stays 'claude-board' (its value before the rename to Agent Board) so receivers that filter on it keep working.
    else init = { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, kind, board: 'claude-board', app: 'agent-board', url: link }) };
    try {
      // Checked again before every delivery (DNS can change after the URL was saved), and sent to the
      // address that was checked. No redirects: a public URL answering 307 to an internal address must not reach it.
      const r = await sendWebhook(url, init);
      if (r.status >= 300 && r.status < 400) throw Object.assign(new Error(`HTTP ${r.status}: the webhook redirects, which isn't allowed`), { status: r.status });
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
      return { ok: true, status: r.status };
    } catch (e) {
      if (Date.now() - notifyFailLogged > 60e3) { notifyFailLogged = Date.now(); console.error(`notify (${slug}): webhook failed (${e.message})`); }
      return { ok: false, status: e.status || 0, error: String(e.message || e) };
    }
  }
  // Identical texts within a minute are sent once, and at most NOTIFY_CAP messages go out per 10 minutes.
  const NOTIFY_CAP = 20;
  const recentNotes = new Map();
  let sentTimes = []; let capLogged = 0;
  function notify(kind, text) {
    if (!rawSetting('_notify_url') || !notifyEvents().includes(kind)) return;
    const now = Date.now();
    for (const [k, t] of recentNotes) if (now - t > 60e3) recentNotes.delete(k);
    if (recentNotes.has(text)) return;
    sentTimes = sentTimes.filter((t) => now - t < 10 * 60e3);
    if (sentTimes.length >= NOTIFY_CAP) {
      if (now - capLogged > 60e3) { capLogged = now; console.error(`notify (${slug}): more than ${NOTIFY_CAP} messages in 10 minutes; dropping the rest for now`); }
      return;
    }
    recentNotes.set(text, now); sentTimes.push(now);
    deliver(text, kind).catch(() => {});
  }
  // Which board events are worth a phone buzz.
  board.bus.on('event', (e) => {
    if (!e || !e.id) return;
    // Direct messages never leave the board.
    if (e.channel === DIRECT) return;
    const t = String(e.text || '');
    if (e.kind === 'question') return notify('questions', `${e.author} asks: ${t}`);
    if (e.kind === 'task_updated' && e.data?.status === 'blocked' && /→ blocked/.test(t)) {
      const note = t.replace(/^#\d+\s*/, '').replace(/^\w+ → blocked(\s+—\s+)?/, '').trim();
      return notify('blocked', `#${e.task_id} blocked${note ? `: ${note}` : ''} (${e.author})`);
    }
    if (e.kind !== 'message') return;
    if (e.author === 'board' && /^@all main is failing/.test(t)) return notify('main', t.replace(/^@all\s+/, ''));
    if (e.author === 'board' && /is being used from \d+ laptops/.test(t)) return notify('conflict', t.replace(/^@all\s+/, ''));
    if (e.author === 'board' && /^@all (FEATURE FREEZE|Feature freeze in 30 minutes|Demo time)/.test(t)) return notify('freeze', t.replace(/^@all\s+/, ''));
    // Only the board's own announcement: an agent writing "hit its usage limit" in chat isn't one.
    if (e.data?.notice === 'limit') return notify('limit', t.replace(/^@all\s+/, ''));
  });
  // Humans only, even for reading: the URL is a secret that lets anyone post to your channel.
  const humanToken = (req, res, next) => (req.role === 'human' ? next() : res.status(403).json({ error: 'This needs the board token (humans on the web board), not an agent token.' }));
  const notifyInfo = () => { const url = rawSetting('_notify_url'); return { url: maskUrl(url), kind: notifyKind(url), events: notifyEvents() }; };
  api.get('/notify', humanToken, h(() => notifyInfo()));
  api.put('/notify', humanToken, h(async (req) => {
    const b = req.body || {};
    if (b.url !== undefined) {
      const url = String(b.url || '').trim();
      if (url) await resolveNotifyTarget(url);
      putSetting('_notify_url', url ? checkNotifyUrl(url) : '');
    }
    if (b.events !== undefined) {
      const list = (Array.isArray(b.events) ? b.events : String(b.events).split(',')).map((s) => String(s).trim()).filter((s) => NOTIFY_EVENTS.includes(s));
      putSetting('_notify_events', [...new Set(list)].join(','));
    }
    return notifyInfo();
  }));
  api.post('/notify/test', humanToken, h(async () => {
    if (!rawSetting('_notify_url')) return { ok: false, status: 0, error: 'Set a webhook URL first.' };
    return deliver('Test from Agent Board: notifications reach this channel.', 'test');
  }));

  // ---------- token rotation (a link with the token leaked) ----------
  const openStreams = new Set();
  const closeStreams = () => { for (const s of openStreams) { try { s.end(); } catch {} } openStreams.clear(); };
  api.post('/token/rotate', humanToken, h((req, res) => {
    if (envToken) { res.status(400); return { error: 'The token comes from BOARD_TOKEN; change it there and restart the board.' }; }
    const t = crypto.randomBytes(12).toString('base64url');
    fs.writeFileSync(path.join(dir, 'token'), t);
    retired = [...retired, ...[TOKEN, AGENT_TOKEN, VIEW_TOKEN].map(tokenHash)].slice(-60);
    try { fs.writeFileSync(retiredFile, JSON.stringify(retired)); } catch {}
    TOKEN = t; AGENT_TOKEN = agentTokenFor(t); VIEW_TOKEN = viewerTokenFor(t);
    board.emit({ author: 'board', kind: 'message', channel: 'general', text: '@all The board token was rotated: everyone re-runs the join command from the web board.' });
    // Live streams were authorised with the old token: close them all (open pages reconnect with the new one).
    later(closeStreams, 50);
    return { token: t, setup: { ...setupInfo(), viewer_token: VIEW_TOKEN } };
  }));

  // ---------- automatic backups (the host laptop can crash or sleep) ----------
  // `VACUUM INTO` a consistent copy every 10 minutes (BOARD_BACKUP_MINUTES; 0 = off), keep the newest 24,
  // skip when nothing happened since the last one. Restore with `npm run restore`.
  const BACKUP_DIR = path.join(dir, 'backups');
  // What the board holds (events, tasks, settings), without presence, which changes all the time. Kept
  // in backups/.last, so a restart doesn't make a new backup when nothing changed.
  function boardFingerprint() {
    const t = board.db.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(updated_at), 0) AS u FROM tasks').get();
    const settings = board.db.prepare('SELECT key, value FROM settings ORDER BY key').all().map((r) => `${r.key}=${r.value}`).join('\n');
    const q = board.db.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(answered_at), 0) AS a FROM questions').get();
    return crypto.createHash('sha256').update(`${board.latestEventId()}|${t.n}|${t.u}|${q.n}|${q.a}|${settings}`).digest('hex').slice(0, 32);
  }
  function backup() {
    const fp = boardFingerprint();
    const lastFile = path.join(BACKUP_DIR, '.last');
    let last = ''; try { last = fs.readFileSync(lastFile, 'utf8').trim(); } catch {}
    if (fp === last) return null;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    // UTC time in the name (same board-YYYYMMDD-HHMMSS shape restore expects): sorting stays right
    // across daylight-saving changes.
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '').replace('T', '-'); // 20261110-153000
    const file = path.join(BACKUP_DIR, `board-${stamp}.db`);
    if (fs.existsSync(file)) return null;
    board.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    fs.writeFileSync(lastFile, fp);
    const all = fs.readdirSync(BACKUP_DIR).filter((f) => /^board-\d{8}-\d{6}\.db$/.test(f)).sort();
    for (const f of all.slice(0, Math.max(0, all.length - 24))) { try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch {} }
    return file;
  }
  if (BACKUP_MS > 0 && Number.isFinite(BACKUP_MS)) {
    const run = () => { try { backup(); } catch (e) { console.error(`backup failed (${slug}): ${e.message}`); } };
    later(run, Math.min(30e3, BACKUP_MS));
    every(run, Math.max(1000, BACKUP_MS));
  }

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
    for (const t of timers) { clearInterval(t); clearTimeout(t); }
    clearAnnounceTimers();
    closeStreams();
    // Settles pending long-polls before the file closes (a timer touching a closed DB would crash the server).
    board.close();
    board.bus.removeAllListeners();
  }

  return {
    slug, dir, board, router, close, setupInfo,
    get token() { return TOKEN; },
    get agentToken() { return AGENT_TOKEN; },
    get viewerToken() { return VIEW_TOKEN; },
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
