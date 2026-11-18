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
import { writePid, dropPid } from './pidfile.js';
import { createLiveBoards } from './live-boards.js';
import { createApp } from './app.js';
import { printBanner, offerHostJoin, handleListenErrors } from './startup.js';

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

const live = createLiveBoards({ registry, envTokenSlug: ENV_TOKEN_SLUG });
for (const b of registry.list()) if (b.status === 'live') { try { live.startBoard(b); } catch {} }

const app = createApp({ registry, live, adminToken: ADMIN_TOKEN });

const httpServer = app.listen(PORT, HOST, () => {
  writePid();
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { dropPid(); process.exit(0); });
  printBanner({ registry, live, adminToken: ADMIN_TOKEN });
  offerHostJoin(live);
});

handleListenErrors(httpServer, live);
