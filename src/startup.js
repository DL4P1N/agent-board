// What the server prints and asks when it starts: the banner with the links, the offer to connect the
// host's own AI tool, and the message when the port is already taken.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, PORT, PUBLIC_URL, VERSION } from './config.js';
import { serverAddresses, bestBase } from './network.js';

export function printBanner({ registry, live, adminToken }) {
  const { runtimes, failures, defaultRuntime } = live;
  const addrs = serverAddresses();
  const best = bestBase();
  const rt = defaultRuntime();
  const line = '─'.repeat(64);
  console.log(`\n${line}\n Agent Board is running  (version ${VERSION}, port ${PORT})\n${line}`);
  if (rt) {
    const name = registry.get(rt.slug)?.name || rt.slug;
    console.log(`\n 1. Open the web board${runtimes.size > 1 ? ` "${name}"` : ''}. It walks everyone through setup:`);
    console.log(`      ${best}/b/${rt.slug}/?token=${rt.token}`);
    if (!addrs.length) {
      console.log('\n    ⚠ No network address found, so teammates can\'t reach this laptop. Join the wifi, start Tailscale, or use  npm run tunnel');
    }
    console.log('\n 2. Teammates connect their laptop. First time only, get the tool:');
    console.log('      git clone https://github.com/DL4P1N/agent-board && cd agent-board');
    console.log('    (already have an agent-board folder, or an older claude-board one? run git pull in it instead)');
    console.log('    Then, in the agent-board folder (it asks the rest):');
    console.log(`      npm run join -- --url ${best}/b/${rt.slug} --token ${rt.token}`);
    for (const a of addrs.slice(1)) console.log(`      (or ${a.base}/b/${rt.slug} if that doesn't connect: ${a.label})`);
    console.log('\n The token in these links is the board\'s password: share it only with your team.');
    if (!PUBLIC_URL) console.log(' Teammates on another network? Stop this (Ctrl+C) and run  npm run tunnel  instead.');
    console.log(' A teammate can\'t connect? They run  npm run doctor  in their agent-board folder.');
  } else {
    console.log('\n No board is live. Create one or restore one on the boards page below.');
  }
  for (const [slug, why] of failures) console.log(`\n ✗ Board "${slug}" failed to open: ${why}`);
  const others = [...runtimes.values()].filter((r) => r !== rt);
  if (others.length) {
    console.log('\n Other live boards on this server:');
    for (const o of others) console.log(`      ${registry.get(o.slug)?.name || o.slug}:  ${best}/b/${o.slug}/?token=${o.token}`);
  }
  console.log(`\n Manage boards (create, switch, archive):  ${best}/boards?admin=${adminToken}`);
  console.log(`\n Keep this window open. After a \`git pull\` the board reloads by itself; if the pull changed package.json,`);
  console.log(` stop it (Ctrl+C) and run  npm start  again, so new dependencies get installed.`);
  console.log(`${line}\n`);
}

export function handleListenErrors(httpServer, live) {
  httpServer.on('error', async (e) => {
    // No IPv6 on this machine: IPv4 only.
    if (!process.env.HOST && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(e.code)) return httpServer.listen(PORT, '0.0.0.0');
    if (e.code !== 'EADDRINUSE') throw e;
    let other = null;
    try { other = await (await fetch(`http://localhost:${PORT}/health`, { signal: AbortSignal.timeout(2000) })).json(); } catch {}
    if (other?.app === 'claude-board' || other?.app === 'agent-board') {
      console.error(`\n✗ A board is already running on port ${PORT} (version ${other.version}).`);
      console.error(other.version !== VERSION
        ? `  It's running different code than this folder (${VERSION}). Close its window (Ctrl+C there) and run npm start again.`
        : `  Use that one (its window shows the links), or close it first with Ctrl+C in its window.`);
    } else {
      console.error(`\n✗ Port ${PORT} is already used by another program. Start the board on another port, e.g.:  PORT=4001 npm start`);
    }
    process.exit(1);
  });
}

// The host usually runs an AI agent too: offer to connect it right here instead of a second terminal.
export function offerHostJoin(live) {
  const { defaultRuntime } = live;
  const rt = defaultRuntime();
  if (!rt || !process.stdin.isTTY || process.env.BOARD_NO_JOIN) return;
  const TOKEN = rt.token;
  const declined = path.join(rt.dir, '.host-join-declined');
  const joinCmd = `npm run join -- --url http://localhost:${PORT}/b/${rt.slug} --token ${TOKEN}`;
  if (fs.existsSync(declined)) {
    console.log(` To connect this laptop's AI tool, run any time:  ${joinCmd}\n`);
    return;
  }
  let cfg = null;
  // ~/.agent-board.json, or ~/.claude-board.json on laptops that joined before the rename to Agent Board.
  for (const f of ['.agent-board.json', '.claude-board.json']) {
    try { cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), f), 'utf8')); break; } catch {}
  }
  const ours = (t) => t === TOKEN || t === rt.agentToken;
  if (ours(cfg?.token)) {
    console.log(` This laptop is connected as "${cfg.agent}". (Re-run setup any time: npm run join -- --url http://localhost:${PORT}/b/${rt.slug} --token ${TOKEN})\n`);
    return;
  }
  // Already connected to another board: Enter keeps that (switching is a deliberate "y").
  const otherBoard = !!cfg?.token && !(cfg.agents || []).some((a) => ours(a?.token));
  process.stdout.write(otherBoard
    ? ` This laptop is connected to another board${cfg.agent ? ` as "${cfg.agent}"` : ''}. Connect its AI tool to this board? [y/N] `
    : ' Connect this laptop\'s AI tool to the board now? [Y/n] ');
  process.stdin.setEncoding('utf8');
  process.stdin.once('data', (answer) => {
    process.stdin.pause();
    if (otherBoard && !/^\s*y/i.test(answer)) {
      console.log(` Kept the other board. To connect to this one later:\n   ${joinCmd}\n`);
      return;
    }
    if (/^\s*n/i.test(answer)) {
      fs.writeFileSync(declined, '');
      console.log(` Skipped. To connect later, run in another terminal:\n   npm run join -- --url http://localhost:${PORT}/b/${rt.slug} --token ${TOKEN}\n`);
      return;
    }
    // The token goes in the environment, not on the command line (other users of the computer can list those).
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'join.mjs'), '--url', `http://localhost:${PORT}/b/${rt.slug}`], { stdio: 'inherit', env: { ...process.env, AGENT_BOARD_JOIN_TOKEN: TOKEN } });
    child.on('exit', () => {
      // Join's output pushed the banner off screen: repeat what the host needs next.
      const best = bestBase();
      console.log(`\n The board keeps running here. Keep this window open.`);
      console.log(` Web board:       ${best}/b/${rt.slug}/?token=${TOKEN}`);
      console.log(` Teammates join:  npm run join -- --url ${best}/b/${rt.slug} --token ${TOKEN}\n`);
    });
  });
}
