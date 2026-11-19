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
import { takePid, writePid, dropPid } from './pidfile.js';
import { createLiveBoards } from './live-boards.js';
import { createApp } from './app.js';
import { printBanner, offerHostJoin, handleListenErrors } from './startup.js';

fs.mkdirSync(DATA_DIR, { recursive: true });
// One server per data folder: a second one would open the same databases and write over the first one's data.
// (`npm start`'s reload after a change stops the old process before it starts the new one.)
const owner = await takePid();
if (owner?.error) {
  console.error(`\n✗ Can't mark the data folder ${DATA_DIR} as in use (${owner.error}), so the board doesn't start: a second server could then open the same databases. Check that the folder is writable.`);
  process.exit(1);
}
if (owner) {
  console.error(`\n✗ Another board server (process ${owner.pid}, port ${owner.port}) is already using the data folder ${DATA_DIR}.`);
  console.error(`  Use that one, or stop it first (Ctrl+C in its window). To run a second, separate server, give it its own folder:  BOARD_DATA=<folder> PORT=<port> npm start`);
  process.exit(1);
}
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
