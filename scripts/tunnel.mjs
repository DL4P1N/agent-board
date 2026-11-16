#!/usr/bin/env node
// `npm run tunnel`: like `npm start`, but also opens a Cloudflare tunnel, so teammates can join from
// any network (no shared wifi or Tailscale needed). The tunnel runs here, outside the board, so the
// board can reload after `git pull` and the public https address stays the same while this runs.
//
// Two kinds of tunnel:
//   quick (default)  no Cloudflare account; a new https://….trycloudflare.com address each time it starts,
//                    so after a restart everyone re-runs join.
//   named            a fixed address on your own domain (in Cloudflare), the same after every restart.
//                    One-time setup on the host:  npm run tunnel -- --setup <tunnel-name> <hostname>
//                    e.g.  npm run tunnel -- --setup team-board board.example.com
//                    That logs in to Cloudflare (browser), creates the tunnel, points the hostname at it
//                    and saves both in data/tunnel.json; from then on `npm run tunnel` uses it.
//
// Options:
//   --name <tunnel> --hostname <host>   use this named tunnel (or TUNNEL_NAME / TUNNEL_HOSTNAME)
//   --quick                             a quick tunnel even if a named one is saved
//   CLOUDFLARED=/path/to/cloudflared    use that binary instead of the one on PATH
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4000);
const DATA_DIR = path.resolve(process.env.BOARD_DATA || path.join(ROOT, 'data'));
const SAVED = path.join(DATA_DIR, 'tunnel.json');
const START_TIMEOUT_MS = 45_000;
const NAMED_WAIT_MS = Number(process.env.TUNNEL_NAMED_WAIT_MS || 20_000);

const argv = process.argv.slice(2);
const flag = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };

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
const cfRun = (args, opts = {}) => spawnSync(cf.cmd, [...cf.pre, ...args], { encoding: 'utf8', ...opts });

function isHostname(h) {
  return /^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/i.test(h || '');
}

// ---------- one-time setup of a named tunnel ----------
if (argv.includes('--setup')) {
  const i = argv.indexOf('--setup');
  const name = argv[i + 1]; const hostname = argv[i + 2];
  const validName = /^[\w-]{1,64}$/.test(name || '');
  const validHost = isHostname(hostname);
  if (!validName || !validHost) {
    console.error('usage: npm run tunnel -- --setup <tunnel-name> <hostname>');
    console.error('  e.g. npm run tunnel -- --setup team-board board.example.com');
    console.error('  The hostname must be on a domain you manage in Cloudflare.');
    process.exit(1);
  }
  // Logged in already when cloudflared's origin certificate exists (TUNNEL_ORIGIN_CERT, else the default).
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const cert = process.env.TUNNEL_ORIGIN_CERT || path.join(home, '.cloudflared', 'cert.pem');
  if (!fs.existsSync(cert)) {
    console.log('1/3 Logging in to Cloudflare: a browser window opens; pick the domain for the board.');
    if (cfRun(['tunnel', 'login'], { stdio: 'inherit' }).status !== 0) { console.error('✗ cloudflared tunnel login failed.'); process.exit(1); }
  } else console.log('1/3 Already logged in to Cloudflare.');
  console.log(`2/3 Creating the tunnel "${name}"…`);
  const c = cfRun(['tunnel', 'create', name]);
  if (c.status !== 0 && !/already exists/i.test(`${c.stdout}${c.stderr}`)) { console.error(`✗ cloudflared tunnel create failed:\n${(c.stderr || c.stdout || '').trim()}`); process.exit(1); }
  console.log(`3/3 Pointing ${hostname} at it…`);
  const r = cfRun(['tunnel', 'route', 'dns', name, hostname]);
  const rOut = `${r.stdout || ''}${r.stderr || ''}`;
  // A record that already exists may point somewhere else (an older tunnel): that's not success.
  if (r.status !== 0 || /already exists/i.test(rOut)) {
    console.error(`✗ cloudflared tunnel route dns failed:\n${rOut.trim()}`);
    if (/already exists/i.test(rOut)) console.error(`  ${hostname} already has a DNS record. To point it at this tunnel instead, run:\n    cloudflared tunnel route dns --overwrite-dns ${name} ${hostname}\n  then run this setup again.`);
    process.exit(1);
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SAVED, JSON.stringify({ name, hostname }, null, 2) + '\n');
  console.log(`✓ Done. From now on, npm run tunnel serves the board at https://${hostname} (saved in ${SAVED}).`);
  process.exit(0);
}

// ---------- which tunnel ----------
let saved = null;
try { saved = JSON.parse(fs.readFileSync(SAVED, 'utf8')); } catch {}
const named = argv.includes('--quick') ? null : (() => {
  const name = flag('name') || process.env.TUNNEL_NAME || saved?.name;
  const hostname = String(flag('hostname') || process.env.TUNNEL_HOSTNAME || saved?.hostname || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!name || !hostname) return null;
  if (!/^[\w-]{1,64}$/.test(name) || !isHostname(hostname)) {
    console.error(`✗ Not a valid tunnel name and hostname: "${name}" "${hostname}". Expected e.g. --name team-board --hostname board.example.com`);
    process.exit(1);
  }
  return { name, hostname };
})();

let board = null;
let stopping = false;
let log = '';
let tunnel;
let publicUrl;
const watchOutput = (resolve, test, timeoutMs, onTimeout) => {
  const timer = setTimeout(() => resolve(onTimeout()), timeoutMs);
  const onData = (d) => {
    log = (log + d).slice(-4000);
    const hit = test(log);
    if (hit) { clearTimeout(timer); resolve(hit); }
  };
  tunnel.stdout.on('data', onData);
  tunnel.stderr.on('data', onData);
  tunnel.once('error', (e) => { log += `\n${e.message}`; clearTimeout(timer); resolve(null); });
  tunnel.once('exit', () => { clearTimeout(timer); resolve(null); });
};

if (named) {
  console.log(`Starting the Cloudflare tunnel "${named.name}" (https://${named.hostname}) to the board on port ${PORT}…`);
  tunnel = spawn(cf.cmd, [...cf.pre, 'tunnel', '--no-autoupdate', 'run', '--url', `http://localhost:${PORT}`, named.name], { stdio: ['pipe', 'pipe', 'pipe'] });
  // A named tunnel's address is known up front; wait until cloudflared has connected (or give it a moment).
  publicUrl = await new Promise((resolve) => watchOutput(resolve,
    (l) => (/Registered tunnel connection/i.test(l) ? `https://${named.hostname}` : null),
    NAMED_WAIT_MS, () => (tunnel.exitCode === null ? `https://${named.hostname}` : null)));
} else {
  console.log(`Opening a Cloudflare tunnel to the board on port ${PORT}…`);
  tunnel = spawn(cf.cmd, [...cf.pre, 'tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], { stdio: ['pipe', 'pipe', 'pipe'] });
  publicUrl = await new Promise((resolve) => watchOutput(resolve,
    (l) => l.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)?.[0] || null,
    START_TIMEOUT_MS, () => null));
}

if (!publicUrl) {
  tunnel.kill();
  console.error('✗ The Cloudflare tunnel didn\'t start. Its last output:');
  console.error(log.trim().split('\n').slice(-8).map((l) => `    ${l}`).join('\n') || '    (none)');
  console.error(named
    ? `  Check that the tunnel "${named.name}" exists (cloudflared tunnel list) and this laptop is logged in, or run a quick tunnel: npm run tunnel -- --quick`
    : '  Check the internet connection and try again, or use npm start (same wifi or Tailscale).');
  process.exit(1);
}
// Keep draining cloudflared's output so it never blocks on a full pipe.
tunnel.stdout.removeAllListeners('data'); tunnel.stderr.removeAllListeners('data');
tunnel.stdout.resume(); tunnel.stderr.resume();
tunnel.on('exit', (code) => {
  if (stopping) return;
  console.error(`\n⚠ The Cloudflare tunnel stopped (exit ${code}). ${publicUrl} no longer works; teammates on the same wifi or Tailscale still can.`);
  console.error(named
    ? '  Stop the board (Ctrl+C) and run npm run tunnel again: the address stays the same, so nobody needs to re-join.'
    : '  To get a public address again, stop the board (Ctrl+C) and run npm run tunnel. The address will be new, so everyone re-runs join.');
});

console.log(named
  ? `✓ Tunnel running: ${publicUrl}  (a fixed address: restarting keeps it, so nobody re-joins)`
  : `✓ Tunnel open: ${publicUrl}  (it can take a few seconds before the address answers)`);
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
