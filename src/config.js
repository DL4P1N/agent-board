// Settings read from the environment once, shared by the server's modules.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PORT = Number(process.env.PORT || 4000);
// '::' listens on IPv6 and IPv4. Windows resolves `localhost` to ::1 first, and some MCP clients
// (Claude Code) don't fall back to 127.0.0.1, so an IPv4-only board looks down to them.
export const HOST = process.env.HOST || '::';
export const DATA_DIR = path.resolve(process.env.BOARD_DATA || path.join(ROOT, 'data'));
// A public https address for this server, e.g. the Cloudflare tunnel that `npm run tunnel` opens.
export const PUBLIC_URL = (process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
export const PUBLIC_DIR = path.join(ROOT, 'public');

// Which Agent Board code this server runs (git commit), so join/doctor can spot an outdated board.
export const VERSION = (() => {
  const r = spawnSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'unknown';
})();

