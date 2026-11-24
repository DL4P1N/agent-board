// HTTP server for one or more boards. Each live board has its own data, tokens, agents and timers, and is
// served at /b/<slug>/ (MCP at /b/<slug>/mcp, REST + SSE at /b/<slug>/api, the web board at /b/<slug>/).
// The default board is also served at the root (/, /api, /mcp), so links made before there were several
// boards keep working. The host manages boards at /boards with the admin token (src/boards.js).
//
// This file is the entry point: it reads the settings, opens the boards list and the boards, builds the app
// and starts listening. The parts (one board, its routes, auth, GitHub, notifications, backups, the admin
// API, the startup output) are in the modules it imports; docs/architecture.md has the map.
import fs from 'node:fs';
import { Registry, adminToken } from './boards.js';
import { PORT, HOST, DATA_DIR } from './config.js';
import { takePid, writePid, dropPid, foreignHint, heartbeat } from './pidfile.js';
import { createLiveBoards } from './live-boards.js';
import { createApp } from './app.js';
import { keepPrivate } from './tokens.js';
import { printBanner, offerHostJoin, handleListenErrors } from './startup.js';

// The agent and viewer tokens are derived from the board token (src/tokens.js), so anyone with the viewer link
// could try short board tokens offline until one matches. A token the board makes is 16 random characters;
// BOARD_TOKEN must be at least as long. BOARD_ALLOW_SHORT_TOKEN=1: a throwaway board (the tests, the demo).
const MIN_TOKEN = 16;
if (process.env.BOARD_TOKEN && process.env.BOARD_TOKEN.length < MIN_TOKEN && process.env.BOARD_ALLOW_SHORT_TOKEN !== '1') {
  console.error(`\n✗ BOARD_TOKEN is too short (${process.env.BOARD_TOKEN.length} characters; it needs at least ${MIN_TOKEN}): the agent and viewer links are derived from it, so anyone with the viewer link could guess a short one.`);
  console.error('  Use a long random one, or leave BOARD_TOKEN unset and the board makes one. (For a throwaway test board only: BOARD_ALLOW_SHORT_TOKEN=1.)');
  process.exit(1);
}
// The admin token manages every board (create, archive, delete): as long as a board token at least.
if (process.env.BOARD_ADMIN_TOKEN && process.env.BOARD_ADMIN_TOKEN.length < MIN_TOKEN && process.env.BOARD_ALLOW_SHORT_TOKEN !== '1') {
  console.error(`\n✗ BOARD_ADMIN_TOKEN is too short (${process.env.BOARD_ADMIN_TOKEN.length} characters; it needs at least ${MIN_TOKEN}): it manages every board on this server.`);
  console.error('  Use a long random one, or leave BOARD_ADMIN_TOKEN unset and the server makes one (data/admin-token). (For a throwaway test server only: BOARD_ALLOW_SHORT_TOKEN=1.)');
  process.exit(1);
}
fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
keepPrivate(DATA_DIR);
// One server per data folder: a second one would open the same databases and write over the first one's data.
// (`npm start`'s reload after a change stops the old process before it starts the new one.)
const owner = await takePid();
if (owner?.error) {
  console.error(`\n✗ Can't mark the data folder ${DATA_DIR} as in use (${owner.error}), so the board doesn't start: a second server could then open the same databases. Check that the folder is writable.`);
  process.exit(1);
}
if (owner) {
  console.error(`\n✗ Another board server (process ${owner.pid}, port ${owner.port}) is already using the data folder ${DATA_DIR}.${foreignHint(owner)}`);
  console.error(`  Use that one, or stop it first (Ctrl+C in its window). To run a second, separate server, give it its own folder:  BOARD_DATA=<folder> PORT=<port> npm start`);
  process.exit(1);
}
process.once('exit', dropPid);
heartbeat();
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

const live = createLiveBoards({ registry, envTokenSlug: ENV_TOKEN_SLUG });
for (const b of registry.list()) if (b.status === 'live') { try { live.startBoard(b); } catch {} }

const app = createApp({ registry, live, adminToken: ADMIN_TOKEN });

const httpServer = app.listen(PORT, HOST, () => {
  writePid(httpServer.address()?.port ?? PORT);
  // Ctrl+C or a stop: close every board's database (its last writes are flushed), then exit.
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => {
    for (const rt of live.runtimes.values()) try { rt.close(); } catch {}
    dropPid();
    process.exit(0);
  });
  printBanner({ registry, live, adminToken: ADMIN_TOKEN });
  offerHostJoin(live);
});

handleListenErrors(httpServer, live);
