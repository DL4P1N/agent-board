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
//   --yes        don't ask anything: use the flags and the defaults
//   --offline    set up even when the board can't be reached right now (check later with npm run doctor)
//   --verbose    list exactly which git/gh commands were pre-approved
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
const MARKER = '<!-- agent-board -->';
// Files join installed before the rename to Agent Board carry the old marker; they are still ours.
const OLD_MARKER = '<!-- claude-board -->';
const isOurs = (text) => text.includes(MARKER) || text.includes(OLD_MARKER);
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
const FORCE_NOTE = 'force pushes are discouraged, not prevented: protect main on GitHub (docs/hosting.md: "Protect main")';

const args = parseArgs(process.argv.slice(2));
const gitAllow = !args['no-git-allow'];
// Forgive the usual address mistakes: no http://, or the web board link (…/?token=…) pasted instead.
let pastedToken = '';
const url = (() => {
  let u = String(args.url && args.url !== true ? args.url : '').trim();
  if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = `http://${u}`;
  try {
    const x = new URL(u);
    pastedToken = x.searchParams.get('token') || '';
    x.search = ''; x.hash = '';
    u = x.toString();
  } catch {}
  return u.replace(/\/+$/, '');
})();
const token = args.token && args.token !== true ? args.token : pastedToken;
if (url && url !== String(args.url).trim().replace(/\/+$/, '')) console.log(`  • using the board address ${url}`);
// How long an idle Claude keeps listening to the board before it stops (its Stop hook). 0 turns waiting off.
const wait = args.wait === undefined || args.wait === true ? 120 : Math.max(0, Math.min(600, Number(args.wait) || 0));
if (!url || !token) {
  console.error('usage: npm run join -- --url http://HOST:4000 --token TOKEN [--name NAME] [--tool claude,codex,copilot-vscode,copilot-cli,gemini,cursor,other] [--plan PLAN] [--repo PATH] [--slots N] [--wait 120] [--shared] [--no-git-allow] [--yes] [--offline] [--verbose]');
  console.error('Copy the exact command shown on the web board (Start here → step 1) or printed by `npm start` on the host.');
  process.exit(1);
}

// ---------- check the board first, so the questions can use what's on it ----------
let boardState = null;
try {
  const r = await fetch(`${url}/api/state`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
  if (r.status === 401) fail('The board rejected the token: the token changed (the host rotated it, or started a fresh board). Ask the host for the new join command (web board → Start here → step 1) and run it.');
  // 409: this is the plain address, and the board behind the token moved to its own /b/<name> address.
  if (r.status === 409) { const m = await r.json().catch(() => ({})); fail(`This join command uses the plain board address, but that board is now at ${url}${m.moved_to || '/b/<name>'}. Copy the new join command from the web board (or use --url ${url}${m.moved_to || '/b/<name>'}).`); }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  boardState = await r.json();
  ok(`board${boardState.board?.name ? ` "${boardState.board.name}"` : ''} reachable at ${url}${boardState.settings?.goal ? ` (goal: ${boardState.settings.goal.slice(0, 60)}${boardState.settings.goal.length > 60 ? '…' : ''})` : ''}`);
} catch (e) {
  // https against an http board fails the TLS handshake with "wrong version number".
  const why = `${e.cause?.code || ''} ${e.cause?.message || ''} ${e.message}`;
  const httpOnly = url.startsWith('https://') && /WRONG_VERSION_NUMBER|wrong version number|EPROTO/i.test(why);
  if (httpOnly) bad(`This board uses http, not https. Try:  --url ${url.replace(/^https:/, 'http:')}`);
  else bad(`Can't reach the board at ${url} (${e.cause?.code || e.message}).`);
  if (!args.offline) {
    if (!httpOnly) console.error('  Check the address. Is the host\'s npm start window still open? Same wifi (or Tailscale)? Then run this again.');
    console.error('  Nothing was set up. To set up anyway, add --offline.');
    process.exit(1);
  }
  console.error('  Setting up anyway (--offline). Run npm run doctor once the board is up.');
}

// ---------- questions (only for what wasn't passed) ----------
// AGENT_BOARD_JOIN_ASK=1 (or the older CLAUDE_BOARD_JOIN_ASK=1) asks even without a terminal (the tests answer through a pipe).
const interactive = (process.stdin.isTTY || process.env.AGENT_BOARD_JOIN_ASK === '1' || process.env.CLAUDE_BOARD_JOIN_ASK === '1') && !args.yes;
const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
const ask = async (q, def) => {
  if (!rl) return def;
  const a = (await rl.question(`${q}${def ? ` [${def}]` : ''}: `)).trim();
  return a || def;
};

// Names already on this board that this laptop didn't set up before (so re-running join is fine).
const agentToken = agentTokenFor(token);
// This board's name (multi-board servers say it; older ones don't): shown when a tool switches boards.
const boardName = boardState?.board?.name || boardState?.board?.slug || url;
// What this laptop set up before, on any board. Each agent entry remembers its own board (url + token);
// older configs kept one board for all of them at the top level.
const prior = (() => { try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return null; } })();
const priorAgents = (prior?.agents || []).map((a) => ({ ...a, url: a.url || prior.url, token: a.token || prior.token, board: a.board || prior.board || a.url || prior.url }));
const sameBoard = (a) => a.url === url && (a.token === token || a.token === agentToken);
const previous = prior && (prior.token === token || prior.token === agentToken) && (!prior.url || prior.url === url) ? prior : null;
// This laptop's id: made once and kept across boards. The board uses it to spot one agent name
// used from two laptops at once. Not a secret, just a label.
const laptopId = (() => {
  try { const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); if (/^[a-z0-9]{8,16}$/.test(c.laptop_id || '')) return c.laptop_id; } catch {}
  return crypto.randomBytes(6).toString('hex');
})();
// Names are case-insensitive on the board (it stores them lowercase).
const mine = new Set([previous?.agent, ...priorAgents.filter(sameBoard).map((a) => a.agent), ...(previous || priorAgents.some(sameBoard) ? [prior?.person] : [])].filter(Boolean).map((n) => n.toLowerCase()));
// Is the name already used on the board by someone else? Not only connected agents: also people on
// the web board, task owners and authors, so a clash shows before anyone has typed /board.
const taken = (n) => {
  const lc = (x) => String(x || '').toLowerCase();
  const isN = (x) => lc(x) === n || new RegExp(`^${n.replace(/\./g, '\\.')}-(claude|codex|copilot|copilotcli|gemini|cursor|other)$`).test(lc(x));
  const theirs = (x) => isN(x) && !mine.has(lc(x));
  const p = (boardState?.presence || []).find((p) => (p.kind === 'agent' ? lc(p.person || p.name) === n || isN(p.name) : lc(p.name) === n) && !mine.has(lc(p.name)));
  if (p) return { where: p.kind === 'agent' ? p.client || 'an agent' : 'on the web board' };
  if ((boardState?.tasks || []).some((t) => theirs(t.assignee) || theirs(t.created_by))) return { where: 'on a task' };
  if ((boardState?.events || []).some((ev) => ev.author !== 'board' && theirs(ev.author))) return { where: 'in the feed' };
  return null;
};
// The board's own answer (GET /api/names/<name>): it also knows names other laptops reserved with join
// before their agent connected. Older boards answer 404: then the check above is all there is.
const nameApi = (n, method = 'GET', body) => fetch(`${url}/api/names/${encodeURIComponent(n)}${method === 'GET' ? `?laptop=${laptopId}` : ''}`, {
  method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(4000),
}).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const takenOnBoard = async (n) => {
  const j = boardState ? await nameApi(n) : null;
  // The endpoint knows agents and reservations; tasks and posts by that name only show in the state.
  if (!j || !j.taken) return taken(n);
  const h = (j.holders || [])[0] || {};
  return { where: h.connected === false ? 'reserved by another laptop; its agent hasn\'t started yet' : h.client || 'an agent' };
};

let name = '';
for (let attempt = 0; attempt < 5 && !name; attempt++) {
  const def = previous?.agent?.toLowerCase().replace(/-(claude|codex|copilot|copilotcli|gemini|cursor)$/, '') || prior?.person || defaultName();
  const raw = String(args.name || (await ask(`Your name on the board (short, no spaces${def ? '' : ', e.g. alex'})`, def)) || '').trim();
  const n = raw.toLowerCase().replace(/[^\w.-]/g, '');
  if (!n && rl && !args.name) { console.log('  A name is needed: letters, digits, dots, dashes or underscores.'); continue; }
  if (!n) fail('A name is required (--name NAME).');
  // Say so when spaces or symbols were dropped, so people recognise their own @mentions.
  if (n !== raw.toLowerCase()) console.log(`  • You'll appear as "${n}" (names keep only letters, digits, dots, dashes and underscores).`);
  const t = await takenOnBoard(n);
  if (t && rl && !args.name) {
    console.log(`  "${n}" is already on this board (${t.where}). If that's not you on another laptop, pick a different name, or you'll share tasks with them.`);
    if (!/^y/i.test(await ask(`  Use "${n}" anyway? (y/N)`, ''))) continue;
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
// "other" or "other:<label>": a tool join doesn't know; the label names its agent (<you>-<label>).
let otherLabel = 'other';
let tools = [];
// A typo asks again (when asking), with the closest tool as a hint.
for (let attempt = 0; attempt < 5; attempt++) {
  const toolAnswer = String((attempt === 0 && args.tool) || (await ask('Tool(s), comma-separated', previous?.agents?.map((a) => a.tool).join(',') || installed[0] || 'claude')) || '');
  tools = [...new Set(toolAnswer.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean).map((t) => {
    const m = t.match(/^other(?::([a-z0-9][\w.-]{0,19}))?$/);
    if (!m) return t;
    if (m[1]) otherLabel = m[1];
    return 'other';
  }))];
  const unknown = tools.filter((t) => !TOOLS[t]);
  if (!unknown.length && tools.length) break;
  const hint = unknown.map(closestTool).filter(Boolean);
  const msg = `Unknown tool(s): ${unknown.join(', ') || '(none)'}.${hint.length ? ` Did you mean ${hint.join(', ')}?` : ''} Pick from: ${Object.keys(TOOLS).join(', ')}`;
  if (!rl || attempt === 4) fail(msg);
  console.log(`  ${msg}`);
}

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
  // Only ask when the answer matters: every Codex and Copilot plan means 1 task at a time.
  const allSame = new Set(opts.map((o) => o[2])).size === 1;
  if (!id && allSame && rl) id = prevPlan || '';
  else if (!id && rl) {
    console.log(`\nWhich plan is ${TOOLS[t].label} on? (sets how many tasks its agent works on at once)`);
    for (const [pid, label, n] of opts) console.log(`  ${pid.padEnd(9)} ${label}  → ${n} task${n > 1 ? 's' : ''} at a time`);
    // The smallest plan by default: pressing Enter must not promise more than the plan allows.
    id = String(await ask('Plan', prevPlan || opts[0][0])).trim().toLowerCase();
  }
  const hit = opts.find(([pid]) => pid === id);
  if (id && !hit) console.log(`  • unknown plan "${id}" for ${TOOLS[t].label}; using the default (${t === 'claude' ? 2 : 1} at a time)`);
  planFor[t] = hit ? { plan_id: hit[0], plan: hit[1], slots: hit[2] } : {};
  if (args.slots) planFor[t].slots = Math.max(1, Math.min(5, Number(args.slots) || 1));
}

// The team's project repo (if the host set it on the board): suggest an existing copy next to this folder, or offer to clone it.
const projectUrl = boardState?.settings?.repo || '';
const projectName = projectUrl ? path.basename(projectUrl.replace(/\.git$/, '').replace(/[\\/]+$/, '')) : '';
const sibling = projectName ? path.resolve(ROOT, '..', projectName) : '';
if (!args.repo) {
  const why = multi
    ? 'required: each tool gets its own git worktree of it'
      : tools.includes('copilot-vscode') ? 'required for Copilot in VS Code'
    : tools.includes('cursor') ? 'installs the /board command there; blank to skip'
    : tools.includes('claude') ? `installs the auto-wake hook${gitAllow ? ' and pre-approves git/gh' : ''} there, so agents don't stall on permission prompts; blank to skip` :'so join can tell you where to start your agent; blank to skip';
  const def = previous?.agents?.[0]?.dir || hereRepo() || (sibling && fs.existsSync(sibling) ? sibling : '');
  if (projectUrl && !def && rl) console.log(`\nThe team's project is ${projectUrl}. Leave the next answer blank to clone it into ${sibling}.`);
  let r = await ask(`Path to your copy of the hackathon repo (${why})`, def);
  // Required here (and blank won't clone it): ask again rather than fail later.
  for (let i = 0; i < 3 && !r && rl && /^required/.test(why) && !(projectUrl && !fs.existsSync(sibling)); i++) r = await ask(`A repo path is ${why}. Path to your copy of the hackathon repo`, def);
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
// Each tool connects to one board at a time (one MCP server named "board"). Joining a board replaces
// the previous board for the tools picked now; the laptop's other tools stay on the board they had.
const keep = priorAgents.filter((a) => !tools.includes(a.tool));
for (const a of priorAgents.filter((x) => tools.includes(x.tool) && !sameBoard(x))) {
  console.log(`  • This laptop's ${TOOLS[a.tool]?.label || a.tool} now points at board "${boardName}"; it no longer gets "${a.board}".`);
}
for (const a of keep.filter((x) => !sameBoard(x))) console.log(`  • ${TOOLS[a.tool]?.label || a.tool} stays on board "${a.board}" (join again with --tool ${a.tool} to move it here too).`);
const entry = ({ tool, agent, dir, plan_id, plan: planLabel, slots }) => ({ tool, agent, dir, plan_id, plan: planLabel, slots, url, token: agentToken, board: boardName });
const saveConfig = (agents) => {
  const all = [...keep.map(({ tool, agent, dir, plan_id, plan: planLabel, slots, url: u, token: t, board: b }) => ({ tool, agent, dir, plan_id, plan: planLabel, slots, url: u, token: t, board: b })), ...agents.map(entry)];
  // The top level is what the Claude Stop hook reads: the board Claude Code is on (else this one).
  const claude = all.find((a) => a.tool === 'claude');
  const top = claude ? { url: claude.url, token: claude.token, agent: claude.agent, board: claude.board } : { url, token: agentToken, agent: name, board: boardName };
  writeJson(CONFIG_PATH, { ...top, person: name, laptop_id: laptopId, hook_wait: wait, agents: all });
};
saveConfig(plan);
// Reserve each agent name for this laptop, so a teammate who joins with the same name is warned
// even before anyone types /board. Older boards don't have this; that's fine.
if (boardState) for (const p of plan) await nameApi(p.agent, 'POST', { laptop: laptopId, person: name });

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
// Every tool picked stays in the config, even if its setup failed: doctor then checks (and explains) that tool.
saveConfig(plan);
const problems = await runDoctor();
console.log(`
────────────────────────────────────────────────────────────
 ${problems ? `⚠ ${problems === 1 ? '1 problem' : `${problems} problems`} above. Fix ${problems === 1 ? 'it' : 'them'}, then check again with:  npm run doctor` :`You're in as "${name}"${multi ? ` (agents: ${done.map((p) => p.agent).join(', ')})` : ''}.`}
 Web board:  ${webLink}
 The board tells everyone (people and agents) what to do next.
────────────────────────────────────────────────────────────`);
// Scripts (and people) can tell a join that didn't fully work from one that did.
if (problems) process.exitCode = 1;

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
  if (gitAllow) {
    ok('git and gh commands pre-approved (no prompts when agents push or merge). Skip with --no-git-allow');
    if (args.verbose) console.log(`    git ${GIT_ALLOW.join(', ')}; gh ${GH_ALLOW.map((c) => c.join(' ')).join(', ')}. ${FORCE_NOTE[0].toUpperCase()}${FORCE_NOTE.slice(1)}.`);
  }

  if (args.shared) {
    const mdPath = path.join(dir, 'CLAUDE.md');
    const existing = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
    if (!isOurs(existing)) {
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
    fs.appendFileSync(rulesPath, `${cur && !cur.endsWith('\n') ? '\n' : ''}# agent-board: git/gh commands the board playbook uses; they run outside Codex's sandbox\n${want.join('\n')}\n`);
  }
  ok('git and gh commands pre-approved for Codex (they run outside its sandbox, so push and gh reach the network). Skip with --no-git-allow');
  if (args.verbose) console.log(`    git ${CODEX_GIT_ALLOW.join(', ')}; gh ${CODEX_GH_ALLOW.map((c) => c.join(' ')).join(', ')} (in ${rulesPath}). ${FORCE_NOTE[0].toUpperCase()}${FORCE_NOTE.slice(1)}.`);
}

// A copy of a config file before join first changes it: <file>.bak-agent-board. A <file>.bak-claude-board
// (made before the rename to Agent Board) already holds the original, so no second copy is made.
function backupOnce(file) {
  const bak = `${file}.bak-agent-board`;
  if (fs.existsSync(file) && !fs.existsSync(bak) && !fs.existsSync(`${file}.bak-claude-board`)) fs.copyFileSync(file, bak);
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

If the \`board\` MCP tools (get_playbook, board_status, …) are not available to you, do not improvise: no raw HTTP calls, no reading token files. Tell the human: "This tool isn't connected to the team board yet. Run \`npm run doctor\` in your agent-board folder; it says what to fix." Then stop.`;
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
  installOurText(`---\ndescription: Joining the team board (Agent Board). Use when the user types /board or asks to join or work on the board.\nalwaysApply: false\n---\n${MARKER}\n\nWhen the user types "/board" or asks you to join or work on the team board:\n\n${KICKOFF('Cursor')}\n`,
    rulePath, 'the board rule');
  keepOutOfGit(rulePath, ruleCreated, dir);
  console.log('  • In Cursor, enable the "board" MCP server (Settings → MCP) if it asks, and allow its tools.');
}

// ---------- helpers ----------
// Write generated text unless the destination exists and isn't one of ours.
function installOurText(text, dest, what) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest) && !isOurs(fs.readFileSync(dest, 'utf8'))) {
    bad(`${dest} already exists and isn't ours, so it was left alone (${what} not installed)`);
    return;
  }
  fs.writeFileSync(dest, text);
  ok(`installed ${what} (${dest})`);
}

// Copy a template unless the destination exists and isn't one of ours.
function installOurFile(src, dest, what) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest) && !isOurs(fs.readFileSync(dest, 'utf8'))) {
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

// Your git name's first word, else nothing (the OS user name is often a shared or made-up account).
function defaultName() {
  const r = sh('git config user.name', true);
  const raw = (r.stdout || '').trim().split(/\s+/)[0] || '';
  return raw.toLowerCase().replace(/[^\w.-]/g, '');
}

// The git repo of the folder join was started from (npm sets INIT_CWD), unless that is this board tool's own folder.
function hereRepo() {
  const r = sh(`git -C ${q(process.env.INIT_CWD || process.cwd())} rev-parse --show-toplevel`, true);
  if (r.status !== 0 || !r.stdout.trim()) return '';
  const top = path.resolve(r.stdout.trim());
  const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const inside = (a, b) => norm(a) === norm(b) || norm(a).startsWith(norm(b) + path.sep);
  return inside(top, ROOT) || inside(ROOT, top) ? '' : top;
}

// The known tool nearest to a typo ("claud" → claude), or '' when nothing is close.
function closestTool(word) {
  const dist = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  };
  const [best] = Object.keys(TOOLS).map((t) => [t, t.startsWith(word) || word.startsWith(t) ? 0 : dist(word, t)]).sort((x, y) => x[1] - y[1]);
  return best && best[1] <= 3 ? best[0] : '';
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
