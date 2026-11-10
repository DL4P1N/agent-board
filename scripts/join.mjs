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
//   gemini          Gemini CLI    → ~/.gemini/settings.json (trusted) + /board command (~/.gemini/commands/board.toml)
//   cursor          Cursor        → ~/.cursor/mcp.json + /board command and rule in the repo (.cursor/, git-ignored locally)
//   other           any other MCP-capable tool → prints the board's MCP URL to add yourself
//                   ("other:omp" names the agent <you>-omp when you use several tools)
// Other options:
//   --name NAME --repo PATH   skip the questions
//   --plan PLAN  your subscription, e.g. max20, or per tool: claude=max20,codex=edu (sets how many tasks the agent may hold)
//   --slots N    override how many tasks each agent may hold at once
//   --wait N     Claude's Stop hook long-polls N seconds for teammate activity before letting Claude stop (default 120; 0 = don't wait)
//   --shared     also append team rules to the repo's CLAUDE.md (optional; one person commits it)
//   --no-git-allow  don't pre-approve the git/gh commands agents use (Claude Code settings, Codex rules)
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { runDoctor, CONFIG_PATH } from './doctor.mjs';
import { agentTokenFor } from '../src/tokens.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = path.join(ROOT, 'templates');
const MARKER = '<!-- claude-board -->';
const PLANS = {
  claude: [['pro', 'Claude Pro', 1], ['max5', 'Claude Max 5x', 2], ['max20', 'Claude Max 20x', 3], ['team', 'Claude Team / Enterprise / API', 3]],
  codex: [['plus', 'ChatGPT Plus', 1], ['edu', 'ChatGPT Edu', 1], ['business', 'ChatGPT Business / Enterprise', 1], ['pro', 'ChatGPT Pro', 1]],
  'copilot-vscode': [['free', 'Copilot Free', 1], ['pro', 'Copilot Pro', 1], ['proplus', 'Copilot Pro+', 1], ['business', 'Copilot Business / Enterprise', 1]],
};
PLANS['copilot-cli'] = PLANS['copilot-vscode'];
const TOOLS = {
  claude: { label: 'Claude Code', bin: 'claude', start: 'type  /board' },
  codex: { label: 'Codex CLI', bin: 'codex', start: 'type  $board' },
  'copilot-vscode': { label: 'GitHub Copilot in VS Code', bin: 'code', start: 'open Copilot Chat in Agent mode and type  /board' },
  'copilot-cli': { label: 'GitHub Copilot CLI', bin: 'copilot', start: 'run  copilot --allow-tool board --autopilot --max-autopilot-continues 50  then type  /board' },
  gemini: { label: 'Gemini CLI', bin: 'gemini', start: 'type  /board' },
  cursor: { label: 'Cursor', bin: 'cursor', start: 'open the Agent chat and type  /board' },
  other: { label: 'Another MCP tool', bin: null, start: 'tell it: "follow the board playbook (call get_playbook)"' },
};
// Commands the playbook has agents run. Pre-approved so git and gh never stall on a permission prompt
// (at Kubecon the merging job moved between laptops 6 times because pushes and merges were blocked).
const GIT_ALLOW = ['fetch', 'switch', 'checkout', 'add', 'commit', 'push', 'merge', 'pull', 'status', 'diff', 'log', 'worktree', 'branch', 'rev-parse', 'remote'];
const GH_ALLOW = [['pr'], ['run'], ['auth', 'status'], ['repo', 'view']];
// Codex runs allowed commands OUTSIDE its sandbox, so only what needs that: writing .git (add, commit,
// switch/checkout, merge) and the network (fetch, pull, push, gh). Reading (diff, log, status) works inside.
const CODEX_GIT_ALLOW = ['fetch', 'pull', 'push', 'add', 'commit', 'merge', 'switch', 'checkout'];
const CODEX_GH_ALLOW = [['pr'], ['run']];
// Force pushes rewrite teammates' history. These rules only catch the flag right after "push"
// (rules match command prefixes), so they discourage force pushes; branch protection on GitHub prevents them.
const FORCE_PUSH = ['--force', '-f', '--force-with-lease'];
// What older join versions pre-approved for Claude Code: far broader than needed, so removed on re-run.
const LEGACY_ALLOW = ['Bash(git:*)', 'Bash(gh:*)'];
const FORCE_NOTE = 'force pushes are discouraged, not prevented: protect main on GitHub (README: "Protect main")';

const args = parseArgs(process.argv.slice(2));
const gitAllow = !args['no-git-allow'];
const url = (args.url || '').replace(/\/$/, '');
const token = args.token;
// How long an idle Claude keeps listening to the board before it stops (its Stop hook). 0 turns waiting off.
const wait = args.wait === undefined || args.wait === true ? 120 : Math.max(0, Math.min(600, Number(args.wait) || 0));
if (!url || !token) {
  console.error('usage: npm run join -- --url http://HOST:4000 --token TOKEN [--name NAME] [--tool claude,codex,copilot-vscode,copilot-cli,gemini,cursor,other] [--repo PATH] [--wait 120] [--shared] [--no-git-allow]');
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
const agentToken = agentTokenFor(token);
const previous = (() => { try { const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); return c.token === token || c.token === agentToken ? c : null; } catch { return null; } })();
// This laptop's id: made once and kept across boards. The board uses it to spot one agent name
// used from two laptops at once. Not a secret, just a label.
const laptopId = (() => {
  try { const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); if (/^[a-z0-9]{8,16}$/.test(c.laptop_id || '')) return c.laptop_id; } catch {}
  return crypto.randomBytes(6).toString('hex');
})();
// Names are case-insensitive on the board (it stores them lowercase).
const mine = new Set([previous?.agent, ...(previous?.agents || []).map((a) => a.agent)].filter(Boolean).map((n) => n.toLowerCase()));
const taken = (n) => (boardState?.presence || []).find((p) => p.kind === 'agent' && String(p.person || p.name).toLowerCase() === n && !mine.has(String(p.name).toLowerCase()));

let name = '';
for (let attempt = 0; attempt < 5 && !name; attempt++) {
  const n = String(args.name || (await ask('Your name on the board (short, no spaces)', previous?.agent?.toLowerCase().replace(/-(claude|codex|copilot|copilotcli|gemini|cursor)$/, '') || defaultName())) || '').toLowerCase().replace(/[^\w.-]/g, '');
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

const installed = Object.keys(TOOLS).filter((t) => TOOLS[t].bin && onPath(TOOLS[t].bin));
if (!args.tool && rl) {
  console.log('\nWhich AI tool(s) will you use on this laptop?');
  for (const [id, t] of Object.entries(TOOLS)) console.log(`  ${id.padEnd(15)} ${t.label}${installed.includes(id) ? '  (installed)' : ''}${id === 'other' ? ' (any MCP-capable agent; other:<label> to name it, e.g. other:omp)' : ''}`);
}
const toolAnswer = String(args.tool || (await ask('Tool(s), comma-separated', previous?.agents?.map((a) => a.tool).join(',') || installed[0] || 'claude')) || '');
// "other" or "other:<label>": a tool join doesn't know; the label names its agent (<you>-<label>).
let otherLabel = 'other';
const tools = [...new Set(toolAnswer.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean).map((t) => {
  const m = t.match(/^other(?::([a-z0-9][\w.-]{0,19}))?$/);
  if (!m) return t;
  if (m[1]) otherLabel = m[1];
  return 'other';
}))];
const unknown = tools.filter((t) => !TOOLS[t]);
if (unknown.length || !tools.length) fail(`Unknown tool(s): ${unknown.join(', ') || '(none)'}. Pick from: ${Object.keys(TOOLS).join(', ')}`);

const multi = tools.length > 1;

// Which plan each tool is on → how many tasks its agent may hold at once (the board enforces it).
const planArg = String(args.plan || '');
const planFor = {};
for (const t of tools) {
  const opts = PLANS[t];
  if (!opts) { planFor[t] = args.slots ? { slots: Math.max(1, Math.min(5, Number(args.slots) || 1)) } : {}; continue; }
  const fromArg = planArg.includes('=') ? (planArg.split(',').find((x) => x.split('=')[0].trim() === t) || '').split('=')[1] : tools.length === 1 ? planArg : '';
  const prevPlan = previous?.agents?.find((a) => a.tool === t)?.plan_id;
  let id = String(fromArg || '').trim().toLowerCase();
  if (!id && rl) {
    console.log(`\nWhich plan is ${TOOLS[t].label} on? (sets how many tasks its agent works on at once)`);
    for (const [pid, label, n] of opts) console.log(`  ${pid.padEnd(9)} ${label}  → ${n} task${n > 1 ? 's' : ''} at a time`);
    id = String(await ask('Plan', prevPlan || (t === 'claude' ? 'max5' : opts[0][0]))).trim().toLowerCase();
  }
  const hit = opts.find(([pid]) => pid === id);
  if (id && !hit) console.log(`  • unknown plan "${id}" for ${TOOLS[t].label}; using the default (${t === 'claude' ? 2 : 1} at a time)`);
  planFor[t] = hit ? { plan_id: hit[0], plan: hit[1], slots: hit[2] } : {};
  if (args.slots) planFor[t].slots = Math.max(1, Math.min(5, Number(args.slots) || 1));
}

// The team's project repo (if the host set it on the board): suggest an existing copy next to claude-board, or offer to clone it.
const projectUrl = boardState?.settings?.repo || '';
const projectName = projectUrl ? path.basename(projectUrl.replace(/\.git$/, '').replace(/[\\/]+$/, '')) : '';
const sibling = projectName ? path.resolve(ROOT, '..', projectName) : '';
if (!args.repo) {
  const why = multi
    ? 'required: each tool gets its own git worktree of it'
      : tools.includes('copilot-vscode') ? 'required for Copilot in VS Code'
    : tools.includes('cursor') ? 'installs the /board command there; blank to skip'
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
const expandHome = (p) => String(p).replace(/^~(?=$|[\\/])/, os.homedir());
const repo = args.repo ? path.resolve(expandHome(args.repo)) : null;
if (repo && !fs.existsSync(repo)) fail(`repo path not found: ${repo}`);
if (repo && sh(`git -C ${q(repo)} rev-parse --is-inside-work-tree`, true).status !== 0) {
  bad(`${repo} is not a git repository. Agents branch, commit and push with git: clone the team's repo (or run git init and add an origin remote) first.`);
  if (multi) fail('Several tools on one laptop need a git repo (each gets its own worktree).');
}
if (multi && !repo) fail('Using more than one tool needs --repo: each tool gets its own git worktree so they never edit the same folder.');

// One agent per tool. With several tools on this laptop, each gets its own board name
// (dana-claude, dana-codex, …) and its own git worktree, so they never share a working folder.
const SHORT = { claude: 'claude', codex: 'codex', 'copilot-vscode': 'copilot', 'copilot-cli': 'copilotcli', gemini: 'gemini', cursor: 'cursor', other: otherLabel };
const plan = tools.map((t, i) => ({
  tool: t,
  agent: multi ? `${name}-${SHORT[t]}` : name,
  dir: !repo ? null : i === 0 ? repo : `${repo}-${SHORT[t]}`,
  ...planFor[t],
}));

// Identity + token travel in the URL, so the same URL works in every tool (no custom headers needed).
// Agents get the agent token: enough for MCP and reading the board, not for human-only actions.
// person: who the agent belongs to, so all of this laptop's tools show under one person on the web board.
const urlFor = (p) => `${url}/mcp?${new URLSearchParams({ agent: p.agent, token: agentToken, person: name, laptop: laptopId, ...(p.plan ? { plan: p.plan } : {}), ...(p.slots ? { slots: String(p.slots) } : {}) })}`;
// The web board link signs the human in under the same name as their agents.
const webLink = `${url}/?token=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}`;
// The Claude Stop hook reads `agent`; `npm run doctor` reads `agents`.
const claudeAgent = plan.find((p) => p.tool === 'claude')?.agent || name;
// Re-running join for some tools keeps the others this laptop set up earlier for the same board.
const keep = (previous?.agents || []).filter((a) => !tools.includes(a.tool));
const saveConfig = (agents) => writeJson(CONFIG_PATH, {
  url, token: agentToken, agent: plan.find((p) => p.tool === 'claude')?.agent || previous?.agent?.toLowerCase() || name, person: name, laptop_id: laptopId, hook_wait: wait,
  agents: [...keep, ...agents].map(({ tool, agent, dir, plan_id, plan: planLabel, slots }) => ({ tool, agent, dir, plan_id, plan: planLabel, slots })),
});
saveConfig(plan);

const done = [];
for (const p of plan) {
  console.log(`\n${TOOLS[p.tool].label}${multi ? ` (as "${p.agent}")` : ''}:`);
  try {
    if (p.dir && p.dir !== repo) ensureWorktree(p.dir);
    const ctx = { agent: p.agent, dir: p.dir, mcpUrl: urlFor(p) };
    if (p.tool === 'claude') setupClaude(ctx);
    if (p.tool === 'codex') setupCodex(ctx);
    if (p.tool === 'copilot-vscode') setupCopilotVSCode(ctx);
    if (p.tool === 'copilot-cli') setupCopilotCli(ctx);
    if (p.tool === 'gemini') setupGemini(ctx);
    if (p.tool === 'cursor') setupCursor(ctx);
    if (p.tool === 'other') setupOther(ctx);
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
 Web board:  ${webLink}
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
  // Background helper agents can't show permission prompts, so pre-approve what a task needs: the board,
  // npm/node, and the git/gh commands the playbook uses (unless --no-git-allow). User entries are kept.
  // On Windows Claude Code runs commands through its PowerShell tool, so every rule is also given in a
  // PowerShell(...) form there (a rehearsal showed Bash(...) rules alone left git prompting).
  // Only on Windows, where that tool exists; elsewhere Bash(...) alone.
  const both = (cmd) => (process.platform === 'win32' ? [`Bash(${cmd})`, `PowerShell(${cmd})`] : [`Bash(${cmd})`]);
  const ourGit = [...GIT_ALLOW.flatMap((c) => both(`git ${c}:*`)), ...GH_ALLOW.flatMap((c) => both(`gh ${c.join(' ')}:*`))];
  // Older versions' broad "Bash(git:*)"/"Bash(gh:*)" go; with --no-git-allow, so do the git/gh rules join adds.
  const drop = new Set([...LEGACY_ALLOW, ...(gitAllow ? [] : ourGit)]);
  settings.permissions.allow = [...new Set([...(settings.permissions.allow || []).filter((r) => !drop.has(r)), 'mcp__board', ...both('npm:*'), ...both('npx:*'), ...both('node:*'), ...(gitAllow ? ourGit : [])])];
  // Deny wins over allow in Claude Code. It only catches the flag right after "push" (prefix rules).
  settings.permissions.deny = [...new Set([...(settings.permissions.deny || []), ...FORCE_PUSH.flatMap((f) => both(`git push ${f}:*`))])];
  writeJson(settingsPath, settings);
  keepOutOfGit(settingsPath, settingsCreated, dir);
  // Claude Code puts its helper agents' git worktrees in .claude/worktrees/; keep them out of `git status`.
  keepOutOfGit(path.join(dir, '.claude', 'worktrees'), true, dir);
  ok(`auto-wake hook installed and board tools pre-approved (${settingsPath})`);
  if (gitAllow) ok(`pre-approved git (${GIT_ALLOW.join(', ')}) and gh (${GH_ALLOW.map((c) => c.join(' ')).join(', ')}); ${FORCE_NOTE}. Skip with --no-git-allow`);

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

function setupCodex({ mcpUrl, dir }) {
  if (!onPath('codex')) throw new Error('`codex` not found on PATH. Install the Codex CLI (npm i -g @openai/codex), then re-run join.');
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const cfg = path.join(codexHome, 'config.toml');
  const rulesPath = path.join(codexHome, 'rules', 'default.rules');
  // Back up both files once, before anything (including `codex mcp add`) changes them.
  backupOnce(cfg);
  if (gitAllow) backupOnce(rulesPath);
  sh('codex mcp remove board', true);
  const r = sh(`codex mcp add board --url ${q(mcpUrl)}`);
  if (r.status !== 0) throw new Error(`codex mcp add failed. Run manually:\n  codex mcp add board --url ${q(mcpUrl)}`);
  // Pre-approve the board's tools so Codex doesn't stop to ask before every board call. (Only the
  // [mcp_servers.board] table Codex just wrote is touched; project trust is left to Codex's own prompt.)
  let toml = fs.readFileSync(cfg, 'utf8');
  const before = toml;
  const header = /^\[mcp_servers\.board\]\s*$/m;
  if (header.test(toml) && !/\[mcp_servers\.board\][^[]*default_tools_approval_mode/.test(toml)) {
    toml = toml.replace(header, (h) => `${h}\ndefault_tools_approval_mode = "approve"`);
  }
  if (toml !== before) fs.writeFileSync(cfg, toml);
  ok('connected Codex to the board (MCP server "board", tools pre-approved)');
  installOurFile(path.join(TEMPLATES, 'codex-skill', 'SKILL.md'), path.join(os.homedir(), '.agents', 'skills', 'board', 'SKILL.md'), 'the $board skill');
  // Codex's sandbox keeps .git read-only and blocks the network, so git push and gh fail inside it.
  // Its execpolicy rules ("don't ask again" writes the same file) let these commands run outside the sandbox.
  if (!gitAllow) {
    console.log('  • Codex\'s sandbox keeps .git read-only and blocks the network, so it asks before git push/commit and gh. Answer "don\'t ask again" for them.');
    return;
  }
  const cur = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf8') : '';
  const rule = (words, decision) => `prefix_rule(pattern=${JSON.stringify(words).replace(/","/g, '", "')}, decision="${decision}")`;
  const want = [
    ...CODEX_GIT_ALLOW.map((c) => rule(['git', c], 'allow')),
    ...CODEX_GH_ALLOW.map((c) => rule(['gh', ...c], 'allow')),
    ...FORCE_PUSH.map((f) => rule(['git', 'push', f], 'forbidden')),
  ].filter((r) => !cur.includes(r));
  if (want.length) {
    fs.mkdirSync(path.dirname(rulesPath), { recursive: true });
    fs.appendFileSync(rulesPath, `${cur && !cur.endsWith('\n') ? '\n' : ''}# claude-board: git/gh commands the board playbook uses; they run outside Codex's sandbox\n${want.join('\n')}\n`);
  }
  ok(`pre-approved git (${CODEX_GIT_ALLOW.join(', ')}) and gh (${CODEX_GH_ALLOW.map((c) => c.join(' ')).join(', ')}) for Codex in ${rulesPath}`);
  console.log(`  • these commands run outside Codex's sandbox (that's how push and gh reach the network); ${FORCE_NOTE}. Skip with --no-git-allow`);
}

// A copy of a config file before join first changes it: <file>.bak-claude-board.
function backupOnce(file) {
  const bak = `${file}.bak-claude-board`;
  if (fs.existsSync(file) && !fs.existsSync(bak)) fs.copyFileSync(file, bak);
}

// A tool join can't configure: print what to add, so any MCP-capable agent can join.
function setupOther({ mcpUrl, agent }) {
  console.log('  Add an MCP server to your tool with these settings:');
  console.log('    name: board');
  console.log('    type: http (streamable HTTP)');
  console.log(`    url:  ${mcpUrl}`);
  console.log(`  Then start it in the hackathon repo and tell it: "follow the board playbook (call get_playbook)". It joins as "${agent}".`);
  ok('board address printed for your tool (keep it private: it contains the agent token)');
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

// What every tool's /board shortcut says: join through the playbook, one task at a time (no background subagents).
function KICKOFF(tool) {
  return `Join the team board: call the \`board\` MCP server's \`get_playbook\` tool and follow that playbook exactly. You are ${tool}, so use the "Codex, GitHub Copilot, or any agent without background subagents" notes in it: do one task at a time yourself.

Keep looping (board_status → work → wait_for_events) until the playbook says there is nothing left. Don't stop after a single step.

If the \`board\` MCP tools (get_playbook, board_status, …) are not available to you, do not improvise: no raw HTTP calls, no reading token files. Tell the human: "This tool isn't connected to the team board yet. Run \`npm run doctor\` in your claude-board folder; it says what to fix." Then stop.`;
}

// Gemini CLI: the board in ~/.gemini/settings.json (trusted, so its tools run without a prompt each time)
// and a /board custom command in ~/.gemini/commands/board.toml.
function setupGemini({ mcpUrl }) {
  const home = process.env.GEMINI_CLI_HOME || path.join(os.homedir(), '.gemini');
  const settingsPath = path.join(home, 'settings.json');
  if (fs.existsSync(settingsPath) && readJson(settingsPath, null) === null) {
    throw new Error(`${settingsPath} isn't valid JSON, so it was left alone. Fix it (or move it away) and re-run join.`);
  }
  backupOnce(settingsPath);
  const cfg = readJson(settingsPath, {});
  cfg.mcpServers ??= {};
  cfg.mcpServers.board = { httpUrl: mcpUrl, trust: true };
  writeJson(settingsPath, cfg);
  ok(`connected Gemini CLI to the board (${settingsPath}; its tools trusted)`);
  const prompt = `${KICKOFF('Gemini CLI')}\n\nNote from your human (may be empty): {{args}}`;
  installOurText(`# ${MARKER}\ndescription = "Join the team board as this laptop's orchestrator. The board tells you what to do next."\nprompt = '''\n${prompt.replace(/'''/g, "''")}\n'''\n`,
    path.join(home, 'commands', 'board.toml'), 'the /board command');
  if (!onPath('gemini')) console.log('  • `gemini` is not installed yet (npm i -g @google/gemini-cli). The config is ready for when it is.');
}

// Cursor: the board in ~/.cursor/mcp.json, plus a /board command and a rule in the repo's .cursor/ folder
// (kept out of git like the Copilot files).
function setupCursor({ mcpUrl, dir }) {
  const mcpPath = path.join(os.homedir(), '.cursor', 'mcp.json');
  if (fs.existsSync(mcpPath) && readJson(mcpPath, null) === null) {
    throw new Error(`${mcpPath} isn't valid JSON, so it was left alone. Fix it (or move it away) and re-run join.`);
  }
  backupOnce(mcpPath);
  const cfg = readJson(mcpPath, {});
  cfg.mcpServers ??= {};
  cfg.mcpServers.board = { url: mcpUrl };
  writeJson(mcpPath, cfg);
  ok(`connected Cursor to the board (${mcpPath})`);
  if (!dir) {
    console.log('  • no repo given, so the /board command was skipped (re-run with --repo to add it). You can also just tell Cursor\'s agent: "follow the board playbook (call get_playbook)".');
    return;
  }
  const cmdPath = path.join(dir, '.cursor', 'commands', 'board.md');
  const cmdCreated = !fs.existsSync(cmdPath);
  installOurText(`${MARKER}\n\n${KICKOFF('Cursor')}\n`, cmdPath, 'the /board command');
  keepOutOfGit(cmdPath, cmdCreated, dir);
  const rulePath = path.join(dir, '.cursor', 'rules', 'board.mdc');
  const ruleCreated = !fs.existsSync(rulePath);
  installOurText(`---\ndescription: Joining the team board (claude-board). Use when the user types /board or asks to join or work on the board.\nalwaysApply: false\n---\n${MARKER}\n\nWhen the user types "/board" or asks you to join or work on the team board:\n\n${KICKOFF('Cursor')}\n`,
    rulePath, 'the board rule');
  keepOutOfGit(rulePath, ruleCreated, dir);
  console.log('  • In Cursor, enable the "board" MCP server (Settings → MCP) if it asks, and allow its tools.');
}

// ---------- helpers ----------
// Write generated text unless the destination exists and isn't one of ours.
function installOurText(text, dest, what) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest) && !fs.readFileSync(dest, 'utf8').includes(MARKER)) {
    bad(`${dest} already exists and isn't ours, so it was left alone (${what} not installed)`);
    return;
  }
  fs.writeFileSync(dest, text);
  ok(`installed ${what} (${dest})`);
}

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
