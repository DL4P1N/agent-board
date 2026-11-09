#!/usr/bin/env node
// `npm run tunnel`: like `npm start`, but also opens a Cloudflare quick tunnel, so teammates can
// join from any network (no shared wifi or Tailscale needed). No Cloudflare account required.
// The tunnel runs here, outside the board, so the board can reload after `git pull` and the
// public https address stays the same. A new tunnel (new address) only starts with this command.
//   CLOUDFLARED=/path/to/cloudflared   use that binary instead of the one on PATH
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4000);
const START_TIMEOUT_MS = 45_000;

// The cloudflared command: CLOUDFLARED, else PATH, else where the installers put it.
function findCloudflared() {
  if (process.env.CLOUDFLARED) {
    const c = process.env.CLOUDFLARED;
    // A .mjs/.js stand-in (the tests use one) runs with this Node.
    return /\.m?js$/.test(c) ? { cmd: process.execPath, pre: [c] } : fs.existsSync(c) ? { cmd: c, pre: [] } : null;
  }
  if (spawnSync('cloudflared', ['--version'], { stdio: 'ignore' }).status === 0) return { cmd: 'cloudflared', pre: [] };
  const known = process.platform === 'win32'
    ? [`${process.env['ProgramFiles(x86)'] || ''}\\cloudflared\\cloudflared.exe`, `${process.env.ProgramFiles || ''}\\cloudflared\\cloudflared.exe`]
    : ['/opt/homebrew/bin/cloudflared', '/usr/local/bin/cloudflared', '/usr/bin/cloudflared'];
  const hit = known.find((p) => p && fs.existsSync(p));
  return hit ? { cmd: hit, pre: [] } : null;
}

const cf = findCloudflared();
if (!cf) {
  console.error(`✗ cloudflared isn't installed${process.env.CLOUDFLARED ? ` (CLOUDFLARED=${process.env.CLOUDFLARED} not found)` : ''}. Install it, then run npm run tunnel again:`);
  console.error({
    win32: '    winget install --id Cloudflare.cloudflared',
    darwin: '    brew install cloudflared',
  }[process.platform] || '    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
  console.error('  Or skip the tunnel: npm start (works for teammates on the same wifi or Tailscale).');
  process.exit(1);
}

console.log(`Opening a Cloudflare tunnel to the board on port ${PORT}…`);
const tunnel = spawn(cf.cmd, [...cf.pre, 'tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], { stdio: ['pipe', 'pipe', 'pipe'] });
let board = null;
let stopping = false;
let log = '';

const publicUrl = await new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), START_TIMEOUT_MS);
  const onData = (d) => {
    log = (log + d).slice(-4000);
    const m = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (m) { clearTimeout(timer); resolve(m[0]); }
  };
  tunnel.stdout.on('data', onData);
  tunnel.stderr.on('data', onData);
  tunnel.once('error', (e) => { log += `\n${e.message}`; clearTimeout(timer); resolve(null); });
  tunnel.once('exit', () => { clearTimeout(timer); resolve(null); });
});

if (!publicUrl) {
  tunnel.kill();
  console.error('✗ The Cloudflare tunnel didn\'t start. Its last output:');
  console.error(log.trim().split('\n').slice(-8).map((l) => `    ${l}`).join('\n') || '    (none)');
  console.error('  Check the internet connection and try again, or use npm start (same wifi or Tailscale).');
  process.exit(1);
}
// Keep draining cloudflared's output so it never blocks on a full pipe.
tunnel.stdout.removeAllListeners('data'); tunnel.stderr.removeAllListeners('data');
tunnel.stdout.resume(); tunnel.stderr.resume();
tunnel.on('exit', (code) => {
  if (stopping) return;
  console.error(`\n⚠ The Cloudflare tunnel stopped (exit ${code}). ${publicUrl} no longer works; teammates on the same wifi or Tailscale still can.`);
  console.error('  To get a public address again, stop the board (Ctrl+C) and run npm run tunnel. The address will be new, so everyone re-runs join.');
});

console.log(`✓ Tunnel open: ${publicUrl}  (it can take a few seconds before the address answers)`);
board = spawn(process.execPath, ['--watch-path=src', '--watch-preserve-output', 'src/server.js'], {
  cwd: ROOT, stdio: 'inherit', env: { ...process.env, PUBLIC_URL: publicUrl },
});

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  tunnel.kill();
  board?.kill();
  process.exitCode = code;
}
board.on('exit', (code) => { stop(code ?? 0); });
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => stop(0));
process.on('exit', () => { tunnel.kill(); board?.kill(); });
