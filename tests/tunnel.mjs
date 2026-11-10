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
function runTunnel(env, extra = []) {
  const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'tunnel.mjs'), ...extra], {
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

// ---- named tunnel: a fixed address ----
const HOST = 'board.example.test';
const startNamed = async (env, extra = [], label = 'named') => {
  const port = await freePort();
  const argsFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cf-args-')), 'args.json');
  const r = runTunnel({ CLOUDFLARED: FAKE, FAKE_CF_ARGS: argsFile, PORT: String(port), TUNNEL_NAMED_WAIT_MS: '15000', ...env }, extra);
  const up = await r.waitFor(/Keep this window open/);
  let args = []; try { args = JSON.parse(fs.readFileSync(argsFile, 'utf8')); } catch {}
  return { r, port, up, args };
};
{
  const { r, port, up, args } = await startNamed({ TUNNEL_NAME: 'myboard', TUNNEL_HOSTNAME: HOST });
  check('named tunnel (env): cloudflared runs the named tunnel to the board port', up && args.join(' ') === `tunnel --no-autoupdate run --url http://localhost:${port} myboard`, args.join(' ') || r.out().slice(-400));
  check('named tunnel: banner uses the fixed https address', r.out().includes(`npm run join -- --url https://${HOST} --token ${TOKEN}`) && /fixed address/.test(r.out()), r.out().slice(-600));
  let st = null;
  try { st = await (await fetch(`http://localhost:${port}/api/state`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json(); } catch {}
  check('named tunnel: the board advertises the fixed address', st?.setup?.join_commands?.[0]?.ip === HOST, JSON.stringify(st?.setup?.join_commands?.[0] || null));
  killTree(r.child); await r.exited;
}
{
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-board-test-'));
  const logFile = path.join(data, 'cf-log.jsonl');
  // Not logged in yet: no origin certificate where TUNNEL_ORIGIN_CERT points.
  const s1 = runTunnel({ CLOUDFLARED: FAKE, FAKE_CF_LOG: logFile, BOARD_DATA: data, TUNNEL_ORIGIN_CERT: path.join(data, 'no-cert.pem') }, ['--setup', 'myboard', HOST]);
  const code = await s1.exited;
  const calls = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l).join(' ')) : [];
  check('--setup logs in, creates the tunnel and routes the hostname', code === 0 && calls[0] === 'tunnel login' && calls[1] === 'tunnel create myboard' && calls[2] === `tunnel route dns myboard ${HOST}`, `${code} ${JSON.stringify(calls)} ${s1.out().slice(-300)}`);
  let saved = null; try { saved = JSON.parse(fs.readFileSync(path.join(data, 'tunnel.json'), 'utf8')); } catch {}
  check('--setup saves the tunnel in data/tunnel.json', saved?.name === 'myboard' && saved?.hostname === HOST, JSON.stringify(saved));
  const { r, port, up, args } = await startNamed({ BOARD_DATA: data });
  check('after --setup, plain npm run tunnel uses the saved named tunnel', up && args.join(' ') === `tunnel --no-autoupdate run --url http://localhost:${port} myboard` && r.out().includes(`https://${HOST}`), args.join(' '));
  killTree(r.child); await r.exited;
  const q = await startNamed({ BOARD_DATA: data }, ['--quick']);
  check('--quick still gives a quick tunnel', q.up && q.args.join(' ') === `tunnel --no-autoupdate --url http://localhost:${q.port}` && q.r.out().includes(PUB), q.args.join(' '));
  killTree(q.r.child); await q.r.exited;
  const bad = runTunnel({ CLOUDFLARED: FAKE, BOARD_DATA: data }, ['--setup', 'myboard']);
  check('--setup without a hostname: usage + exit 1', (await bad.exited) === 1 && /usage: npm run tunnel -- --setup/.test(bad.out()), bad.out().slice(0, 200));
}
{
  // Already logged in (a certificate exists): no login step. A hostname that already has a DNS record:
  // setup fails with the --overwrite-dns hint and saves nothing.
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-board-test-'));
  const certFile = path.join(data, 'cert.pem'); fs.writeFileSync(certFile, 'fake');
  const logFile = path.join(data, 'cf-log.jsonl');
  const s2 = runTunnel({ CLOUDFLARED: FAKE, FAKE_CF_LOG: logFile, FAKE_CF_ROUTE: 'exists', BOARD_DATA: data, TUNNEL_ORIGIN_CERT: certFile }, ['--setup', 'myboard', HOST]);
  const code = await s2.exited;
  const calls = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l).join(' ')) : [];
  check('--setup with a certificate already present skips the login', calls[0] === 'tunnel create myboard' && !calls.includes('tunnel login'), JSON.stringify(calls));
  check('--setup: an existing DNS record is a failure, with the --overwrite-dns hint', code === 1 && /--overwrite-dns myboard/.test(s2.out()) && !fs.existsSync(path.join(data, 'tunnel.json')), `${code} ${s2.out().slice(-300)}`);
  const badHost = runTunnel({ CLOUDFLARED: FAKE, BOARD_DATA: data, PORT: String(await freePort()) }, ['--name', 'myboard', '--hostname', 'not a host']);
  check('a run-time --hostname that is not a hostname: exit 1 with an explanation', (await badHost.exited) === 1 && /Not a valid tunnel name and hostname/.test(badHost.out()), badHost.out().slice(0, 200));
}

await finish(R);
