#!/usr/bin/env node
// Per-machine setup. Run on every teammate's computer:
//   npm run join -- --url http://100.x.y.z:4000 --token TOKEN --name alice --repo ../hackathon-app
// Options:
//   --wait N     Stop hook long-polls N seconds for teammate activity before letting Claude stop (default 0)
//   --shared     ALSO install the shared files (/board command, CLAUDE.md rules) into the repo.
//                Only ONE person should do this and commit them, so the others don't get untracked-file conflicts.
//   --no-mcp     skip `claude mcp add`
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const url = (args.url || '').replace(/\/$/, '');
const token = args.token;
const wait = Number(args.wait || 0);
if (!url || !token) {
  console.error('usage: npm run join -- --url http://HOST:4000 --token TOKEN [--name YOURNAME] [--repo PATH] [--wait 0] [--shared] [--no-mcp]');
  console.error('Copy the exact command printed by `npm start` on the host machine.');
  process.exit(1);
}

// Ask for anything per-person that wasn't passed, so the host's printed command can be pasted as-is.
const interactive = process.stdin.isTTY && !args.yes;
const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
const ask = async (q, def) => {
  if (!rl) return def;
  const a = (await rl.question(`${q}${def ? ` [${def}]` : ''}: `)).trim();
  return a || def;
};

const name = String(args.name || (await ask('Your name on the board (short, no spaces)', defaultName())) || '').replace(/[^\w.-]/g, '');
if (!name) {
  console.error('A name is required (--name YOURNAME).');
  process.exit(1);
}
if (!args.repo) {
  const r = await ask('Path to the hackathon repo (installs the Stop hook there; blank to skip)', '');
  if (r) args.repo = r.replace(/^["']|["']$/g, '');
}
rl?.close();
if (args.repo && !fs.existsSync(path.resolve(args.repo))) {
  console.error(`✗ repo path not found: ${path.resolve(args.repo)}`);
  process.exit(1);
}

// 0. Check the server is reachable.
try {
  const r = await fetch(`${url}/api/cursor`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} (wrong token?)`);
  console.log(`✓ board reachable at ${url}`);
} catch (e) {
  console.error(`✗ cannot reach board at ${url}: ${e.message}`);
  console.error('  Same wifi? Firewall allowing the port? Using the Tailscale IP? Continuing anyway.');
}

// 1. Config for the Stop hook.
const cfgPath = path.join(os.homedir(), '.claude-board.json');
fs.writeFileSync(cfgPath, JSON.stringify({ url, token, agent: name, hook_wait: wait }, null, 2));
console.log(`✓ wrote ${cfgPath}`);

// 2. Register the MCP server for this user (all projects).
if (!args['no-mcp']) {
  const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
  spawnSync('claude mcp remove board -s user', { shell: true, stdio: 'ignore' });
  // Name and URL must come BEFORE --header: it's variadic and would swallow them.
  const cmd = [
    'claude mcp add --transport http -s user',
    'board', q(`${url}/mcp`),
    '--header', q(`Authorization: Bearer ${token}`),
    '--header', q(`X-Agent: ${name}`),
  ].join(' ');
  const r = spawnSync(cmd, { shell: true, stdio: 'inherit' });
  if (r.status === 0) console.log('✓ added MCP server "board" (user scope)');
  else console.error(`✗ claude mcp add failed. Run manually:\n  ${cmd}`);
}

// 3. Repo-local wiring.
if (args.repo) {
  const repo = path.resolve(args.repo);
  const claudeDir = path.join(repo, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });

  // 3a. Stop hook in settings.local.json (per-machine, not committed).
  const settingsPath = path.join(claudeDir, 'settings.local.json');
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
  const hookPath = path.join(ROOT, 'hooks', 'board-stop-hook.mjs').replace(/\\/g, '/');
  settings.hooks ??= {};
  settings.hooks.Stop = (settings.hooks.Stop || []).filter((g) => !JSON.stringify(g).includes('board-stop-hook'));
  settings.hooks.Stop.push({ hooks: [{ type: 'command', command: `node "${hookPath}"`, timeout: wait + 30 }] });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log(`✓ Stop hook installed in ${settingsPath}`);

  // 3b. Shared, committed files — only with --shared.
  if (args.shared) {
    const cmdDir = path.join(claudeDir, 'commands');
    fs.mkdirSync(cmdDir, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'templates', 'commands', 'board.md'), path.join(cmdDir, 'board.md'));
    console.log(`✓ installed /board command → ${path.join(cmdDir, 'board.md')}`);

    const mdPath = path.join(repo, 'CLAUDE.md');
    const snippet = fs.readFileSync(path.join(ROOT, 'templates', 'CLAUDE.board.md'), 'utf8');
    const existing = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
    if (!existing.includes('<!-- claude-board -->')) {
      fs.writeFileSync(mdPath, existing + (existing && !existing.endsWith('\n') ? '\n' : '') + (existing ? '\n' : '') + snippet);
      console.log(`✓ appended team rules to ${mdPath}`);
    } else {
      console.log(`• ${mdPath} already has team rules`);
    }
    console.log('  → commit .claude/commands/board.md and CLAUDE.md so teammates get them.');
  }
}

if (!args.repo) {
  console.log('\n• No repo given, so the Stop hook was NOT installed. Re-run with --repo <path-to-hackathon-repo> to add it.');
}
console.log(`\nDone. Restart Claude Code in the repo, run /mcp to confirm "board" is connected, then type /board to start orchestrating as "${name}".`);
console.log(`Web board: ${url}/?token=${token}`);

function defaultName() {
  const r = spawnSync('git config user.name', { shell: true, encoding: 'utf8' });
  const raw = (r.stdout || '').trim().split(/\s+/)[0] || os.userInfo().username || '';
  return raw.toLowerCase().replace(/[^\w.-]/g, '');
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) out[k] = true;
    else { out[k] = v; i++; }
  }
  return out;
}
