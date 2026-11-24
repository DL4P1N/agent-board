// The REST API of a board (<board>/api): the checks every call goes through, then the routes for the web
// board, the Stop hook and join. The notification routes are in notify.js, the live stream in routes-stream.js.
import zlib from 'node:zlib';
import QRCode from 'qrcode';
import { timeInfo, normName, callerLaptop, callerRole, NAME_RE, RESERVED_NAMES } from './board.js';
import { agentFrom, badRoot, h, laptopParam, internalError, wantsGzip, GZIP_VARY } from './http-util.js';
import { clientIp } from './request-limits.js';
import { recap } from './recap.js';
import { TOKEN_ROTATED } from './auth.js';

// How long a built /api/state answer may be reused while nothing happens on the board.
const STATE_TTL_MS = 1000;

export function mountApiRoutes(api, { board, slug, registry, tokens, isDefault, prefix, setupInfo, onlineHumans, closeStreams, muteStreams, later, presence, agentLimit, holdSlot }) {
  const { auth, viewerLimits, humanOnly, humanToken, envToken } = tokens;
  api.use(auth);
  // Every event a request writes records the role of its token (events.role): 'human', 'agent' (the Stop hook's usage-limit report).
  api.use((req, _res, next) => callerRole.run(req.role, next));
  api.use((req, res, next) => (req.role !== 'agent' || agentLimit(req, res, agentFrom(req), false) ? next() : undefined));
  api.use(viewerLimits);
  api.use(humanOnly);
  // An agent may not speak as the board ("board"), as nobody in particular ("anonymous" is a call without a name),
  // or under a name with nothing before its slash ("/x"). Nor may a human write as "board" or "anonymous" (its
  // posts would read as the board's announcements and fire its webhooks); reading the board still works.
  api.use((req, res, next) => {
    const named = req.get('x-agent') || req.body?.author || req.query.agent;
    if (!named) return next();
    const root = agentFrom(req).split('/')[0];
    if (req.role === 'agent' && badRoot(agentFrom(req))) return res.status(400).json({ error: `"${root || agentFrom(req)}" is not an agent name. Use your own (BOARD_AGENT, or re-run join).` });
    if (req.role === 'human' && req.method !== 'GET' && RESERVED_NAMES.has(root)) return res.status(400).json({ error: `"${root}" is reserved for the board: pick your own name (the name button at the top of the board).` });
    if (req.role === 'human' && req.method !== 'GET') {
      // A person's name as the board keeps it, never cut short: two long names would otherwise become one.
      if (!NAME_RE.test(normName(named))) return res.status(400).json({ error: 'Your name must be 1-64 letters, digits, _ . or -: pick a shorter one (the name button at the top of the board).' });
      // Nor another person's agent's name: what this human writes would read as that agent's.
      const posing = board.roleClash(root, 'human');
      if (posing) return res.status(409).json({ error: posing });
    }
    next();
  });
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
  const stateKey = (dv) => `${version}|${board.changeCount(dv)}`;
  const stateCache = new Map();
  api.get('/state', (req, res) => {
    const human = req.role === 'human';
    let c = stateCache.get(human);
    try {
      if (!c || c.key !== stateKey() || Date.now() - c.at > STATE_TTL_MS) {
        const at = Date.now();
        const outside = board.dataVersion();
        const json = Buffer.from(JSON.stringify(stateBody(req, human)));
        // Keyed after the build: what building it wrote (proposals approved on time, expired locks) is in it. A commit
        // by another process during the build (a script) may have come after some of what it read: then it answers
        // this request but isn't kept, so the next request builds it again.
        // The key uses the very data_version compared here: read again, a commit landing in between would be counted
        // in the key though the build missed it.
        const after = board.dataVersion();
        c = { key: after === outside ? stateKey(after) : null, at, json, gz: null };
        stateCache.set(human, c);
      }
    } catch (e) {
      if (!internalError(res, e)) res.status(400).json({ error: String(e?.message || e) });
      return;
    }
    res.set('Vary', GZIP_VARY).type('json');
    if (c.json.length > 1024 && wantsGzip(req)) {
      c.gz ||= zlib.gzipSync(c.json);
      return res.set('Content-Encoding', 'gzip').send(c.gz);
    }
    res.send(c.json);
  });
  function stateBody(req, human) {
    const phase = board.phase();
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
      phase,
      // Deadline / feature freeze: {deadline, freezeAt, frozen} (ms), so the page can count down.
      time: timeInfo(board.getSettings()),
      presence: board.presence(onlineHumans()),
      // Which board this is (several can run on one server).
      board: { slug, name: registry.get(slug)?.name || slug, default: isDefault(), path: prefix() },
      ...(human ? { setup: { ...setupInfo(), viewer_token: tokens.viewerToken, token_from_env: !!envToken } } : {}),
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
  // Query values are text: a repeated one (?exclude=a&exclude=b) is a list, refused like a non-number cursor.
  const queryText = (req, res, k) => {
    const v = req.query[k];
    if (v !== undefined && typeof v !== 'string') { res.status(400); throw new Error(`${k} must be given once.`); }
    return v;
  };
  const queryCount = (req, res, k) => {
    const v = queryText(req, res, k);
    if (v !== undefined && v !== '' && !/^\d+$/.test(v)) { res.status(400); throw new Error(`${k} must be a whole number (an event id or seconds).`); }
    return Number(v || 0);
  };
  api.get('/events', eventsSlot, h(async (req, res) => {
    for (const k of ['exclude', 'agent', 'laptop']) queryText(req, res, k);
    const since = queryCount(req, res, 'since');
    queryCount(req, res, 'before'); queryCount(req, res, 'wait');
    const before = Math.max(0, Number(req.query.before) || 0) || undefined;
    if (before) return { events: board.events({ before, limit: 200 }) };
    // A cursor past the board's newest event (a restored or fresh board): answered at once with the board's cursor
    // (reset: true), not a wait for events that would never come.
    const latest = board.latestEventId();
    if (since > latest) return { events: [], cursor: latest, reset: true };
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
    // The token was rotated while this waited (that ends every wait): nothing that came after is for it.
    if (wait > 0 && !tokens.current(req)) { res.status(401); return { error: TOKEN_ROTATED, reason: 'token_rotated' }; }
    return { events, cursor: events.length ? events.at(-1).id : Math.max(since, board.latestEventId()) };
  }));
  api.get('/cursor', h(() => ({ cursor: board.latestEventId() })));

  // ---------- token rotation (a link with the token leaked) ----------
  api.post('/token/rotate', humanToken, h((req, res) => {
    if (envToken) { res.status(400); return { error: 'The token comes from BOARD_TOKEN; change it there and restart the board.' }; }
    const t = tokens.rotate();
    // Long polls opened with the old token end now, and answer "the token was changed".
    board.endWaits();
    board.emit({ author: 'board', kind: 'message', channel: 'general', text: '@all The board token was rotated: everyone re-runs the join command from the web board.' });
    // Live streams were authorised with the old token: they get nothing posted from now on, and close in a
    // moment (open pages reconnect with the new one).
    muteStreams();
    later(closeStreams, 50);
    const setup = { ...setupInfo(), viewer_token: tokens.viewerToken, token_from_env: false };
    // The host's window says it too (the web page's toast is the only other place): the new join command to send round.
    console.log(`Token rotated for board "${slug}" at ${new Date().toLocaleTimeString()}: the old links and join commands stop working.\n  New join command: ${setup.join_commands?.[0]?.command || '(see the web board)'}`);
    return { token: t, setup };
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

  // The session recap (src/recap.js), for humans and the viewer token (the recap page on a screen), not agents.
  // since=<ms or ISO date>: the span's start; without it, the current session (since the current goal was set).
  api.get('/recap', h((req, res) => {
    if (req.role === 'agent') { res.status(403); throw new Error('The recap is for humans on the web board (or the viewer link).'); }
    const raw = req.query.since;
    const since = raw === undefined || raw === '' ? 0 : /^\d+$/.test(String(raw)) ? Number(raw) : Date.parse(String(raw));
    if (!Number.isFinite(since) || since < 0) { res.status(400); throw new Error('since must be a time (milliseconds or an ISO date).'); }
    return recap(board, { since });
  }));

  // End-of-day write-up (markdown) and a full JSON backup of the board.
  // Direct messages are in both for humans only.
  api.get('/summary', (req, res) => res.type('text/markdown; charset=utf-8').send(board.summary({ direct: req.role === 'human' })));
  api.get('/export', (req, res) => {
    res.set('Content-Disposition', `attachment; filename="agent-board-${slug}-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(board.exportAll({ direct: req.role === 'human' }));
  });

  // A JSON body's fields are text, numbers or true/false (a list or an object is a malformed request, 400), except `lists`.
  function scalarFields(req, res, lists = []) {
    const b = req.body;
    if (!b || typeof b !== 'object' || Array.isArray(b)) { res.status(400); throw new Error('The request body must be a JSON object.'); }
    for (const [k, v] of Object.entries(b)) {
      if (v !== null && typeof v === 'object' && !(lists.includes(k) && Array.isArray(v))) { res.status(400); throw new Error(`${k} must be text or a number, not ${Array.isArray(v) ? 'a list' : 'an object'}.`); }
    }
    return b;
  }

  // {text, channel} for the shared chat, or {text, to} for a direct message (to: an agent's name, or "planner").
  api.post('/messages', h((req) => board.post(agentFrom(req), req.body || {}, { human: true })));
  api.post('/tasks', h((req, res) => board.createTask(agentFrom(req), scalarFields(req, res, ['depends_on']), { human: true })));
  api.post('/tasks/:id/decide', h((req) => board.decideProposal(agentFrom(req), Number(req.params.id), req.body || {}, { human: true })));
  api.patch('/tasks/:id', h((req, res) => board.updateTask(agentFrom(req), Number(req.params.id), scalarFields(req, res), { human: true })));
  api.post('/tasks/:id/cancel', h((req) => board.cancelTask(agentFrom(req), Number(req.params.id), (req.body || {}).reason, { human: true })));
  api.delete('/tasks/:id', h((req) => board.deleteTask(agentFrom(req), Number(req.params.id))));
  api.post('/questions/:id/answer', h((req) => board.answer(agentFrom(req), Number(req.params.id), req.body.answer)));
  api.post('/locks/release', h((req) => board.unlockFiles(agentFrom(req), { paths: req.body.paths, force: true })));
}
