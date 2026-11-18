// One board, running: everything that belongs to it (its data, tokens, people, timers and routes), wired
// together from the modules next to this file. close() stops it.
import express from 'express';
import { Board } from './board.js';
import { publicFiles } from './static.js';
import { hiddenSettings } from './board-settings.js';
import { startGithubPolling } from './github.js';
import { setupNotifications } from './notify.js';
import { startBackups } from './backup.js';
import { startAnnouncements } from './announce.js';
import { createTimers } from './timers.js';
import { createAuth } from './auth.js';
import { createRequestLimits } from './request-limits.js';
import { makeSetupInfo } from './network.js';
import { mountMcp } from './routes-mcp.js';
import { mountApiRoutes } from './routes-api.js';
import { createStreams } from './routes-stream.js';

// `registry` is the boards list; `envTokenSlug` is the board that BOARD_TOKEN belongs to (or null).
export function createBoardRuntime(slug, dir, { registry, envTokenSlug }) {
  const board = new Board(dir);
  const isDefault = () => registry.defaultSlug === slug;
  // This board's canonical address: always /b/<slug>, also for the default board. The root (/, /api, /mcp)
  // stays an alias for whichever board is the default, so links and joins from before keep working,
  // but everything handed out uses the canonical address, so a default switch doesn't break it.
  const prefix = () => `/b/${slug}`;
  const envToken = slug === envTokenSlug && process.env.BOARD_TOKEN ? process.env.BOARD_TOKEN : null;
  const { every, later, forget, clearAll } = createTimers();
  const { rawSetting, putSetting, announced } = hiddenSettings(board);
  const presence = () => board.presenceChanged();
  const tokens = createAuth({ dir, envToken });
  const setupInfo = makeSetupInfo({ slug, registry, isDefault, prefix, tokens });
  let closed = false;
  const isClosed = () => closed;

  const router = express.Router();
  // Archived (closed) while a request was being routed: nothing to serve any more.
  router.use((req, res, next) => (closed ? res.status(410).json({ error: 'This board is archived.' }) : next()));
  // Board calls per network address (all tokens), and per agent once we know it's one.
  const { ipLimit, agentLimit, holdSlot } = createRequestLimits(slug);
  router.use('/mcp', ipLimit(true));
  router.use('/api', ipLimit(false));

  // ---------- MCP (stateless streamable HTTP) ----------
  mountMcp(router, { board, auth: tokens.auth, agentLimit, holdSlot, presence });

  // ---------- REST API ----------
  const api = express.Router();
  const streams = createStreams({ board, holdSlot, presence, isClosed });
  mountApiRoutes(api, { board, slug, registry, tokens, isDefault, prefix, setupInfo, onlineHumans: streams.onlineHumans, closeStreams: streams.closeStreams, later, presence, agentLimit, holdSlot });

  const announcements = startAnnouncements({ board, announced, every, later, forget });
  setupNotifications({ board, slug, api, prefix, humanToken: tokens.humanToken, rawSetting, putSetting });
  startBackups({ board, dir, slug, every, later });
  startGithubPolling({ board, announced, rawSetting, putSetting, isClosed, presence, every, later });
  // Proposals waiting on a planner who went offline become open tasks.
  every(() => { try { board.sweepProposals(); } catch {} }, 30e3);

  // Live updates for the web UI.
  streams.mount(api);

  router.use('/api', api);
  // The web board and presenter view. Pages use addresses relative to where they're served
  // (/b/<slug>/ or /), so the same files work for every board.
  router.use(publicFiles);

  // Stop serving: timers, live streams, listeners, and the database file.
  function close() {
    if (closed) return;
    closed = true;
    clearAll();
    announcements.clear();
    streams.closeStreams();
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
    onlineHumans: streams.onlineHumans,
  };
}
