#!/usr/bin/env node
// Per-machine setup. Paste the command the host's `npm start` (or the web board) prints:
//   npm run join -- --url http://100.x.y.z:4000 --token TOKEN
// It asks for your name, which AI tool(s) you use, and your hackathon repo path, then connects
// those tools to the board and installs a "join the board" shortcut in each.
//
// Supported tools (--tool, comma-separated):
//   claude          Claude Code   → MCP server + /board command + auto-wake Stop hook (in the repo)
//   codex           Codex CLI     → MCP server (tools pre-approved) + $board skill
//   copilot-vscode  Copilot in VS Code (Agent mode) → .vscode/mcp.json + /board prompt file (in the repo, git-ignored locally)
//   copilot-cli     Copilot CLI   → ~/.copilot/mcp-config.json + /board skill
// Other options:
//   --name NAME --repo PATH   skip the questions
//   --wait N     Claude's Stop hook long-polls N seconds for teammate activity before letting Claude stop (default 0)
//   --shared     also append team rules to the repo's CLAUDE.md (optional; one person commits it)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { runDoctor, CONFIG_PATH } from './doctor.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = path.join(ROOT, 'templates');
const MARKER = '<!-- claude-board -->';
const TOOLS = {
  claude: { label: 'Claude Code', bin: 'claude', start: 'type  /board' },
  codex: { label: 'Codex CLI', bin: 'codex', start: 'type  $board' },
  'copilot-vscode': { label: 'GitHub Copilot in VS Code', bin: 'code', start: 'open Copilot Chat in Agent mode and type  /board' },
  'copilot-cli': { label: 'GitHub Copilot CLI', bin: 'copilot', start: 'run  copilot --allow-tool board --autopilot --max-autopilot-continues 50  then type  /board' },
};

const args = parseArgs(process.argv.slice(2));
const url = (args.url || '').replace(/\/$/, '');
const token = args.token;
const wait = Number(args.wait || 0);
if (!url || !token) {
  console.error('usage: npm run join -- --url http://HOST:4000 --token TOKEN [--name NAME] [--tool claude,codex,copilot-vscode,copilot-cli] [--repo PATH] [--wait 0] [--shared]');
  console.error('Copy the exact command shown on the web board (Start here → step 1) or printed by `npm start` on the host.');
  process.exit(1);
}

// ---------- check the board first, so the questions can use what's on it ----------
let boardState = null;
try {
  const r = await fetch(`${url}/api/state`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
  if (r.status === 401) fail('The board rejected the token. Copy the join command from the web board again (the host may have started a fresh board).');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  boardState = await r.json();
  ok(`board reachable at ${url}${boardState.settings?.goal ? ` (goal: ${boardState.settings.goal.slice(0, 60)}${boardState.settings.goal.length > 60 ? '…' : ''})` : ''}`);
} catch (e) {
  bad(`cannot reach board at ${url}: ${e.message}`);
  console.error('  Same wifi? Firewall allowing the port? Using the Tailscale IP? Continuing anyway; run npm run doctor later.');
}

// ---------- questions (only for what wasn't passed) ----------
const interactive = process.stdin.isTTY && !args.yes;
const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
const ask = async (q, def) => {
  if (!rl) return def;
  const a = (await rl.question(`${q}${def ? ` [${def}]` : ''}: `)).trim();
  return a || def;
};

// Names already on this board that this laptop didn't set up before (so re-running join is fine).
const previous = (() => { try { const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); return c.token === token ? c : null; } catch { return null; } })();
const mine = new Set([previous?.agent, ...(previous?.agents || []).map((a) => a.agent)].filter(Boolean));
const taken = (n) => (boardState?.presence || []).find((p) => p.kind === 'agent' && (p.person || p.name) === n && !mine.has(p.name));

let name = '';
for (let attempt = 0; attempt < 5 && !name; attempt++) {
  const n = String(args.name || (await ask('Your name on the board (short, no spaces)', previous?.agent?.replace(/-(claude|codex|copilot|copilotcli)$/, '') || defaultName())) || '').replace(/[^\w.-]/g, '');
  if (!n) fail('A name is required (--name NAME).');
  const t = taken(n);
  if (t && rl && !args.name) {
    console.log(`  "${n}" is already on this board${t.client ? ` (${t.client})` : ''}. If that's not you on another laptop, pick a different name, or you'll share tasks with them.`);
    if (!/^y/i.test(await ask(`  Use "${n}" anyway? (y/N)`, 'N'))) continue;
  } else if (t) {
    console.log(`  • "${n}" is already on this board. If that's someone else, re-run with a different --name.`);
  }
  name = n;
}
if (!name) fail('No name chosen.');

const installed = Object.keys(TOOLS).filter((t) => onPath(TOOLS[t].bin));
if (!args.tool && rl) {
  console.log('\nWhich AI tool(s) will you use on this laptop?');
  for (const [id, t] of Object.entries(TOOLS)) console.log(`  ${id.padEnd(15)} ${t.label}${installed.includes(id) ? '  (installed)' : ''}`);
}
const toolAnswer = String(args.tool || (await ask('Tool(s), comma-separated', previous?.agents?.map((a) => a.tool).join(',') || installed[0] || 'claude')) || '');
const tools = [...new Set(toolAnswer.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
const unknown = tools.filter((t) => !TOOLS[t]);
if (unknown.length || !tools.length) fail(`Unknown tool(s): ${unknown.join(', ') || '(none)'}. Pick from: ${Object.keys(TOOLS).join(', ')}`);

const multi = tools.length > 1;
// The team's project repo (if the host set it on the board): suggest an existing copy next to claude-board, or offer to clone it.
const projectUrl = boardState?.settings?.repo || '';
const projectName = projectUrl ? path.basename(projectUrl.replace(/\.git$/, '').replace(/[\\/]+$/, '')) : '';
const sibling = projectName ? path.resolve(ROOT, '..', projectName) : '';
if (!args.repo) {
  const why = multi
    ? 'required: each tool gets its own git worktree of it'
    : tools.includes('copilot-vscode') ? 'required for Copilot in VS Code'
    : tools.includes('claude') ? 'installs the auto-wake hook there; blank to skip' : 'so join can tell you where to start your agent; blank to skip';
  const def = previous?.agents?.[0]?.dir || (sibling && fs.existsSync(sibling) ? sibling : '');
  if (projectUrl && !def && rl) console.log(`\nThe team's project is ${projectUrl}. Leave the next answer blank to clone it into ${sibling}.`);
  const r = await ask(`Path to your copy of the hackathon repo (${why})`, def);
  if (r) args.repo = r.replace(/^["']|["']$/g, '');
  else if (projectUrl && rl && !fs.existsSync(sibling)) {
    const c = sh(`git clone ${q(projectUrl)} ${q(sibling)}`);
    if (c.status === 0) { ok(`cloned ${projectUrl} → ${sibling}`); args.repo = sibling; }
    else bad(`git clone failed: ${(c.stderr || '').trim().split('\n').pop()}`);
  }
}
rl?.close();
const repo = args.repo ? path.resolve(args.repo) : null;
if (repo && !fs.existsSync(repo)) fail(`repo path not found: ${repo}`);
if (multi && !repo) fail('Using more than one tool needs --repo: each tool gets its own git worktree so they never edit the same folder.');

// One agent per tool. With several tools on this laptop, each gets its own board name
// (dana-claude, dana-codex, …) and its own git worktree, so they never share a working folder.
const SHORT = { claude: 'claude', codex: 'codex', 'copilot-vscode': 'copilot', 'copilot-cli': 'copilotcli' };
const plan = tools.map((t, i) => ({
  tool: t,
  agent: multi ? `${name}-${SHORT[t]}` : name,
  dir: !repo ? null : i === 0 ? repo : `${repo}-${SHORT[t]}`,
}));

// Identity + token travel in the URL, so the same URL works in every tool (no custom headers needed).
const urlFor = (agent) => `${url}/mcp?agent=${encodeURIComponent(agent)}&token=${encodeURIComponent(token)}`;
// The Claude Stop hook reads `agent`; `npm run doctor` reads `agents`.
const claudeAgent = plan.find((p) => p.tool === 'claude')?.agent || name;
const saveConfig = (agents) => writeJson(CONFIG_PATH, { url, token, agent: claudeAgent, hook_wait: wait, agents: agents.map(({ tool, agent, dir }) => ({ tool, agent, dir })) });
saveConfig(plan);

const done = [];
for (const p of plan) {
  console.log(`\n${TOOLS[p.tool].label}${multi ? ` (as "${p.agent}")` : ''}:`);
  try {
    if (p.dir && p.dir !== repo) ensureWorktree(p.dir);
    const ctx = { agent: p.agent, dir: p.dir, mcpUrl: urlFor(p.agent) };
    if (p.tool === 'claude') setupClaude(ctx);
    if (p.tool === 'codex') setupCodex(ctx);
    if (p.tool === 'copilot-vscode') setupCopilotVSCode(ctx);
    if (p.tool === 'copilot-cli') setupCopilotCli(ctx);
    done.push(p);
  } catch (e) {
    bad(e.message);
  }
}

// ---------- verify + summary ----------
saveConfig(done);
const problems = await runDoctor();
console.log(`
────────────────────────────────────────────────────────────
 ${problems ? `⚠ ${problems} problem(s) above. Fix them, then check again with:  npm run doctor` : `You're in as "${name}"${multi ? ` (agents: ${done.map((p) => p.agent).join(', ')})` : ''}.`}
 Web board:  ${url}/?token=${token}
 The board tells everyone (people and agents) what to do next.
────────────────────────────────────────────────────────────`);

// ======================================================================
// A separate checkout of the same repo, so two tools on one laptop never edit the same folder.
function ensureWorktree(dir) {
  if (fs.existsSync(dir)) {
    const top = sh(`git -C ${q(dir)} rev-parse --show-toplevel`, true);
    if (top.status === 0 && path.resolve(top.stdout.trim()) === path.resolve(dir)) {
      ok(`using existing worktree ${dir}`);
      return;
    }
    throw new Error(`${dir} already exists and isn't a git checkout. Move it away and re-run join.`);
  }
  if (sh(`git -C ${q(repo)} rev-parse --is-inside-work-tree`, true).status !== 0) {
    throw new Error(`${repo} is not a git repo, so a separate worktree can't be created.`);
  }
  // Detached: the agent creates its task branches from origin/main itself; main can only be checked out once.
  const r = sh(`git -C ${q(repo)} worktree add --detach ${q(dir)}`, true);
  if (r.status !== 0) throw new Error(`git worktree add failed: ${(r.stderr || '').trim()}`);
  ok(`created its own worktree ${dir}`);
}

function setupClaude({ mcpUrl, dir }) {
  if (!onPath('claude')) throw new Error('`claude` not found on PATH. Install Claude Code, then re-run join.');
  sh('claude mcp remove board -s user', true);
  const r = sh(`claude mcp add --transport http -s user board ${q(mcpUrl)}`);
  if (r.status !== 0) throw new Error(`claude mcp add failed. Run manually:\n  claude mcp add --transport http -s user board ${q(mcpUrl)}`);
  ok('connected Claude Code to the board (MCP server "board", all projects)');

  const cmdDir = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'commands');
  installOurFile(path.join(TEMPLATES, 'commands', 'board.md'), path.join(cmdDir, 'board.md'), 'the /board command');

  if (!dir) {
    console.log('  • no repo given, so the auto-wake hook was skipped (re-run with --repo to add it)');
    return;
  }
  const settingsPath = path.join(dir, '.claude', 'settings.local.json');
  const settingsCreated = !fs.existsSync(settingsPath);
  const settings = readJson(settingsPath, {});
  const hookPath = path.join(ROOT, 'hooks', 'board-stop-hook.mjs').replace(/\\/g, '/');
  settings.hooks ??= {};
  settings.hooks.Stop = (settings.hooks.Stop || []).filter((g) => !JSON.stringify(g).includes('board-stop-hook'));
  settings.hooks.Stop.push({ hooks: [{ type: 'command', command: `node "${hookPath}"`, timeout: wait + 30 }] });
  // Don't ask before every board call in this repo.
  settings.permissions ??= {};
  settings.permissions.allow = [...new Set([...(settings.permissions.allow || []), 'mcp__board'])];
  writeJson(settingsPath, settings);
  keepOutOfGit(settingsPath, settingsCreated, dir);
  // Claude Code puts its helper agents' git worktrees in .claude/worktrees/; keep them out of `git status`.
  keepOutOfGit(path.join(dir, '.claude', 'worktrees'), true, dir);
  ok(`auto-wake hook installed and board tools pre-approved (${settingsPath})`);

  if (args.shared) {
    const mdPath = path.join(dir, 'CLAUDE.md');
    const existing = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
    if (!existing.includes(MARKER)) {
      const snippet = fs.readFileSync(path.join(TEMPLATES, 'CLAUDE.board.md'), 'utf8');
      fs.writeFileSync(mdPath, existing + (existing && !existing.endsWith('\n') ? '\n' : '') + (existing ? '\n' : '') + snippet);
      ok(`appended team rules to ${mdPath}. Commit it so teammates get them`);
    }
  }
}

function setupCodex({ mcpUrl }) {
  if (!onPath('codex')) throw new Error('`codex` not found on PATH. Install the Codex CLI (npm i -g @openai/codex), then re-run join.');
  sh('codex mcp remove board', true);
  const r = sh(`codex mcp add board --url ${q(mcpUrl)}`);
  if (r.status !== 0) throw new Error(`codex mcp add failed. Run manually:\n  codex mcp add board --url ${q(mcpUrl)}`);
  // Pre-approve the board's tools so Codex doesn't stop to ask before every board call.
  const cfg = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'config.toml');
  let toml = fs.readFileSync(cfg, 'utf8');
  const header = /^\[mcp_servers\.board\]\s*$/m;
  if (header.test(toml) && !/\[mcp_servers\.board\][^[]*default_tools_approval_mode/.test(toml)) {
    toml = toml.replace(header, (h) => `${h}\ndefault_tools_approval_mode = "approve"`);
    fs.writeFileSync(cfg, toml);
  }
  ok('connected Codex to the board (MCP server "board", tools pre-approved)');
  installOurFile(path.join(TEMPLATES, 'codex-skill', 'SKILL.md'), path.join(os.homedir(), '.agents', 'skills', 'board', 'SKILL.md'), 'the $board skill');
  console.log('  • Codex\'s sandbox keeps .git read-only, so it asks before each git commit/push. Answer "don\'t ask again" for git,');
  console.log('    or start it with `codex --sandbox danger-full-access` if you trust it on this laptop.');
}

function setupCopilotVSCode({ mcpUrl, dir }) {
  if (!dir) throw new Error('Copilot in VS Code is configured per repo: re-run with --repo <path-to-hackathon-repo>.');
  const mcpPath = path.join(dir, '.vscode', 'mcp.json');
  const created = !fs.existsSync(mcpPath);
  const cfg = readJson(mcpPath, {});
  cfg.servers ??= {};
  cfg.servers.board = { type: 'http', url: mcpUrl };
  writeJson(mcpPath, cfg);
  ok(`connected VS Code to the board (${mcpPath})`);
  keepOutOfGit(mcpPath, created, dir);

  const promptPath = path.join(dir, '.github', 'prompts', 'board.prompt.md');
  const promptCreated = !fs.existsSync(promptPath);
  installOurFile(path.join(TEMPLATES, 'copilot', 'board.prompt.md'), promptPath, 'the /board prompt');
  keepOutOfGit(promptPath, promptCreated, dir);
  console.log('  • In VS Code, Copilot asks before using the board\'s tools: choose "Always allow" for the board server.');
}

function setupCopilotCli({ mcpUrl }) {
  const cfgPath = path.join(process.env.COPILOT_HOME || path.join(os.homedir(), '.copilot'), 'mcp-config.json');
  const cfg = readJson(cfgPath, {});
  cfg.mcpServers ??= {};
  cfg.mcpServers.board = { type: 'http', url: mcpUrl, tools: ['*'] };
  writeJson(cfgPath, cfg);
  ok(`connected Copilot CLI to the board (${cfgPath})`);
  installOurFile(path.join(TEMPLATES, 'copilot-cli-skill', 'SKILL.md'), path.join(path.dirname(cfgPath), 'skills', 'board', 'SKILL.md'), 'the /board skill');
  if (!onPath('copilot')) console.log('  • `copilot` is not installed yet. The config is ready for when it is.');
}

// ---------- helpers ----------
// Copy a template unless the destination exists and isn't one of ours.
function installOurFile(src, dest, what) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest) && !fs.readFileSync(dest, 'utf8').includes(MARKER)) {
    bad(`${dest} already exists and isn't ours, so it was left alone (${what} not installed)`);
    return;
  }
  fs.copyFileSync(src, dest);
  ok(`installed ${what} (${dest})`);
}

// Files that contain the board token: keep them out of git without touching the repo's .gitignore.
function keepOutOfGit(file, createdByUs, dir) {
  const rel = path.relative(dir, file).replace(/\\/g, '/');
  const tracked = sh(`git -C ${q(dir)} ls-files --error-unmatch ${q(rel)}`, true).status === 0;
  if (tracked) {
    console.log(`  • ${rel} is tracked by git and now contains the board token. Don't commit that change.`);
    return;
  }
  // Worktrees share the main repo's info/exclude (it lives in the common git dir).
  const gitDir = sh(`git -C ${q(dir)} rev-parse --git-common-dir`, true);
  if (gitDir.status !== 0 || !createdByUs) return;
  const exclude = path.resolve(dir, gitDir.stdout.trim(), 'info', 'exclude');
  const cur = fs.existsSync(exclude) ? fs.readFileSync(exclude, 'utf8') : '';
  if (!cur.split(/\r?\n/).includes(rel)) {
    fs.mkdirSync(path.dirname(exclude), { recursive: true });
    fs.appendFileSync(exclude, `${cur && !cur.endsWith('\n') ? '\n' : ''}${rel}\n`);
  }
}

function sh(cmd, quiet = false) {
  return spawnSync(cmd, { shell: true, encoding: 'utf8', stdio: quiet ? 'pipe' : ['ignore', 'pipe', 'pipe'] });
}
function onPath(bin) {
  return sh(process.platform === 'win32' ? `where ${bin}` : `command -v ${bin}`, true).status === 0;
}
function q(s) {
  return `"${String(s).replace(/"/g, '\\"')}"`;
}
function readJson(p, def) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; }
}
function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}
function ok(msg) { console.log(`  ✓ ${msg}`); }
function bad(msg) { console.error(`  ✗ ${msg}`); }
function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }

function defaultName() {
  const r = sh('git config user.name', true);
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
