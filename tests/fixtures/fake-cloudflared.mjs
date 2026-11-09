// Stand-in for `cloudflared tunnel --url …` in tests: prints a quick-tunnel banner like the real one
// (on stderr) and stays up until its parent goes away.
//   FAKE_CF_ARGS=file   write the arguments it got to this file
//   FAKE_CF_MODE=fail   print an error and exit 1 instead
import fs from 'node:fs';

const args = process.argv.slice(2);
if (process.env.FAKE_CF_ARGS) fs.writeFileSync(process.env.FAKE_CF_ARGS, JSON.stringify(args));
if (process.env.FAKE_CF_MODE === 'fail') {
  console.error('2026-01-01T00:00:00Z ERR failed to request quick Tunnel: no internet (fake)');
  process.exit(1);
}
setTimeout(() => {
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
