// The REST API of a board (<board>/api): the checks every call goes through, then the routes for the web
// board, the Stop hook and join. The notification routes are in notify.js, the live stream in routes-stream.js.
import zlib from 'node:zlib';
import QRCode from 'qrcode';
import { timeInfo, normName, callerLaptop } from './board.js';
import { agentFrom, h, laptopParam, internalError, wantsGzip } from './http-util.js';
import { clientIp } from './request-limits.js';

// How long a built /api/state answer may be reused while nothing happens on the board.
const STATE_TTL_MS = 1000;

export function mountApiRoutes(api, { board, slug, registry, tokens, isDefault, prefix, setupInfo, onlineHumans, closeStreams, later, presence, agentLimit, holdSlot }) {
  const { auth, viewerLimits, humanOnly, humanToken, envToken } = tokens;
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
      const laptop = laptopParam(req.get('x-laptop') || req.query.laptop);
      const who = req.get('x-agent') || req.query.agent || req.query.exclude;
      if (laptop && who) board.seenName(String(who), laptop);
    }
    next();
  });

  // Every open page reloads /api/state after each live event, so the answer is built once per change and shared:
  // one per kind of reader (humans get more), rebuilt after any board event (presence nudges included) or any
  // write to the board's database, and at least every STATE_TTL_MS (online states and the deadline move with the
  // clock), and gzipped once for browsers that accept it. The JSON is the same as building it for each request.
  let version = 0;
  board.bus.on('event', () => { version++; });
  const stateKey = () => `${version}|${board.changeCount()}`;
  const stateCache = new Map();
  api.get('/state', (req, res) => {
    const human = req.role === 'human';
    let c = stateCache.get(human);
    try {
      if (!c || c.key !== stateKey() || Date.now() - c.at > STATE_TTL_MS) {
        const at = Date.now();
        const json = Buffer.from(JSON.stringify(stateBody(req, human)));
        // Keyed after the build: what building it wrote (proposals approved on time, expired locks) is in it.
        c = { key: stateKey(), at, json, gz: null };
        stateCache.set(human, c);
      }
    } catch (e) {
      if (!internalError(res, e)) res.status(400).json({ error: String(e?.message || e) });
      return;
    }
    res.set('Vary', 'Accept-Encoding').type('json');
    if (c.json.length > 1024 && wantsGzip(req)) {
      c.gz ||= zlib.gzipSync(c.json);
      return res.set('Content-Encoding', 'gzip').send(c.gz);
    }
    res.send(c.json);
  });
  function stateBody(req, human) {
    const g = board.nextAction(agentFrom(req));
    // Only humans get `setup`: it holds the board token (join commands, web links). Agents and the
    // presenter view must never be able to read it, or every human-only route is one GET away.
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
  }

  // What an agent should do now. The Claude Stop hook calls it (with the agent token) to nudge an idle agent.
  api.get('/next', h((req) => {
    const g = board.nextAction(agentFrom(req));
    return { phase: g.phase, next_action: g.next_action, actionable: g.actionable, reason: g.reason };
  }));

  // Is an agent name taken by another laptop? join asks before any agent connects (GET), then reserves the
  // names it sets up (POST {laptop, person?}). laptop: join's laptop id. Same answer shape for both.
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
    // One name, one laptop: the Stop hook says which laptop it runs on; another laptop's limit isn't the owner's.
    const laptop = req.role === 'human' ? '' : laptopParam(req.get('x-laptop'));
    if (laptop && callerLaptop.run(laptop, () => board.nameClash(name))) { res.status(403); throw new Error(board.clashText(name)); }
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

  // ---------- token rotation (a link with the token leaked) ----------
  api.post('/token/rotate', humanToken, h((req, res) => {
    if (envToken) { res.status(400); return { error: 'The token comes from BOARD_TOKEN; change it there and restart the board.' }; }
    const t = tokens.rotate();
    board.emit({ author: 'board', kind: 'message', channel: 'general', text: '@all The board token was rotated: everyone re-runs the join command from the web board.' });
    // Live streams were authorised with the old token: close them all (open pages reconnect with the new one).
    later(closeStreams, 50);
    return { token: t, setup: { ...setupInfo(), viewer_token: tokens.viewerToken } };
  }));

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
}
