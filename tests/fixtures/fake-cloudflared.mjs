// Stand-in for cloudflared in tests.
//   `tunnel --url …`              prints a quick-tunnel banner like the real one (on stderr), stays up
//   `tunnel run --url … <name>`   prints "Registered tunnel connection" like a named tunnel, stays up
//   `tunnel login|create|route …` (the --setup steps) log their arguments and exit 0
// It stays up until its parent goes away.
//   FAKE_CF_ARGS=file   write the arguments it got to this file (the long-running modes)
//   FAKE_CF_LOG=file    append one JSON line of arguments per call (the setup steps)
//   FAKE_CF_MODE=fail   print an error and exit 1 instead
//   FAKE_CF_ROUTE=exists  `tunnel route dns` fails like the real one when the hostname already has a record
import fs from 'node:fs';

const args = process.argv.slice(2);
const sub = args.filter((a) => !a.startsWith('--'))[1]; // after "tunnel"
if (['login', 'create', 'route'].includes(sub)) {
  if (process.env.FAKE_CF_LOG) fs.appendFileSync(process.env.FAKE_CF_LOG, JSON.stringify(args) + '\n');
  if (sub === 'route' && process.env.FAKE_CF_ROUTE === 'exists') {
    console.error('2026-01-01T00:00:00Z ERR Failed to add route: code: 1003, reason: An A, AAAA, or CNAME record with that host already exists.');
    process.exit(1);
  }
  if (sub === 'create') console.log(`Created tunnel ${args.at(-1)} with id 00000000-fake`);
  process.exit(0);
}
if (process.env.FAKE_CF_ARGS) fs.writeFileSync(process.env.FAKE_CF_ARGS, JSON.stringify(args));
if (process.env.FAKE_CF_MODE === 'fail') {
  console.error('2026-01-01T00:00:00Z ERR failed to request quick Tunnel: no internet (fake)');
  process.exit(1);
}
setTimeout(() => {
  if (sub === 'run') {
    console.error('2026-01-01T00:00:00Z INF Starting tunnel tunnelID=00000000-fake');
    console.error('2026-01-01T00:00:00Z INF Registered tunnel connection connIndex=0 connection=fake event=0 ip=198.41.200.13 location=fake protocol=quic');
    return;
  }
  console.error('2026-01-01T00:00:00Z INF Requesting new quick Tunnel on trycloudflare.com...');
  console.error('2026-01-01T00:00:00Z INF +--------------------------------------------------------------------------------------------+');
  console.error('2026-01-01T00:00:00Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |');
  console.error('2026-01-01T00:00:00Z INF |  https://fake-test-tunnel.trycloudflare.com                                                |');
  console.error('2026-01-01T00:00:00Z INF +--------------------------------------------------------------------------------------------+');
}, 100);
// The parent holds our stdin: when it exits, the pipe closes and so do we.
process.stdin.on('end', () => process.exit(0));
process.stdin.on('error', () => process.exit(0));
process.stdin.resume();
setInterval(() => {}, 1 << 30);
