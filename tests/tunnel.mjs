// Cloudflare tunnel support: PUBLIC_URL becomes the board's first address, and `npm run tunnel`
// (scripts/tunnel.mjs) opens the tunnel and starts the board with it. Uses a fake cloudflared.
// Starts its own throwaway boards. Run all suites with: npm test
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { startBoard, finish, rest, ROOT, TOKEN } from './helpers.mjs';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const FAKE = path.join(ROOT, 'tests', 'fixtures', 'fake-cloudflared.mjs');
const PUB = 'https://fake-test-tunnel.trycloudflare.com';

// ---- the server with PUBLIC_URL ----
const board = await startBoard({ env: { PUBLIC_URL: `${PUB}/` } });
const setup = (await rest(board, 'dana', '/state')).setup;
const [first, ...others] = setup.join_commands;
check('tunnel address comes first', first.ip === 'fake-test-tunnel.trycloudflare.com' && /^Cloudflare tunnel/.test(first.label), JSON.stringify(first));
check('join command uses the https tunnel URL (trailing slash dropped)', first.command === `npm run join -- --url ${PUB} --token ${TOKEN}`, first.command);
check('web link uses the tunnel URL', first.web_url === `${PUB}/?token=${TOKEN}`, first.web_url);
check('network addresses still listed after it, localhost last', others.length >= 1 && others.at(-1).ip === 'localhost' && others.every((a) => a.command.startsWith('npm run join -- --url http://')), others.map((a) => a.ip).join(','));
await board.stop();

const plain = await startBoard();
const plainFirst = (await rest(plain, 'dana', '/state')).setup.join_commands[0];
check('without PUBLIC_URL nothing mentions a tunnel', !/Cloudflare|trycloudflare/.test(JSON.stringify((await rest(plain, 'dana', '/state')).setup)) && plainFirst.command.startsWith('npm run join -- --url http://'), plainFirst.command);
await plain.stop();

// ---- scripts/tunnel.mjs ----
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const killTree = (child) => {
  if (child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' });
  else child.kill('SIGTERM');
};
function runTunnel(env) {
  const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'tunnel.mjs')], {
    cwd: ROOT,
    env: { ...process.env, BOARD_TOKEN: TOKEN, BOARD_NO_JOIN: '1', BOARD_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'claude-board-test-')), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  const exited = new Promise((r) => child.once('exit', (code) => r(code)));
  const waitFor = async (re, ms = 20000) => {
    for (const t0 = Date.now(); Date.now() - t0 < ms;) { if (re.test(out)) return true; await new Promise((r) => setTimeout(r, 100)); }
    return false;
  };
  return { child, exited, waitFor, out: () => out };
}

{
  const r = runTunnel({ CLOUDFLARED: path.join(ROOT, 'no-such-cloudflared.exe'), PORT: String(await freePort()) });
  const code = await r.exited;
  check('cloudflared missing: exits 1 with install command + npm start fallback', code === 1 && /isn't installed/.test(r.out()) && /(winget|brew) install|downloads/.test(r.out()) && /npm start/.test(r.out()), r.out().slice(0, 200));
}
{
  const r = runTunnel({ CLOUDFLARED: FAKE, FAKE_CF_MODE: 'fail', PORT: String(await freePort()) });
  const code = await r.exited;
  check('tunnel fails to start: exits 1 and shows cloudflared\'s error', code === 1 && /didn't start/.test(r.out()) && /no internet \(fake\)/.test(r.out()), r.out().slice(0, 300));
}
{
  const port = await freePort();
  const argsFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cf-args-')), 'args.json');
  const r = runTunnel({ CLOUDFLARED: FAKE, FAKE_CF_ARGS: argsFile, PORT: String(port) });
  const up = await r.waitFor(new RegExp(`npm run join -- --url ${PUB.replace(/\./g, '\\.')} --token ${TOKEN}`));
  check('banner shows the tunnel join command', up, r.out().slice(-600));
  check('banner shows the tunnel web link', r.out().includes(`${PUB}/?token=${TOKEN}`));
  const args = JSON.parse(fs.readFileSync(argsFile, 'utf8'));
  check('cloudflared asked for a quick tunnel to the board port', args.join(' ') === `tunnel --no-autoupdate --url http://localhost:${port}`, args.join(' '));
  let st = null;
  try { st = await (await fetch(`http://localhost:${port}/api/state`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json(); } catch {}
  check('the board it started is up and advertises the tunnel', st?.setup?.join_commands?.[0]?.ip === 'fake-test-tunnel.trycloudflare.com');
  killTree(r.child);
  await r.exited;
}

await finish(R);
