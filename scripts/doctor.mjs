#!/usr/bin/env node
// `npm run doctor`: checks that this laptop's AI tools can really reach the team board, and says what to fix.
// Also runs at the end of `npm run join`. Uses only Node built-ins.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// What join set up on this laptop: ~/.agent-board.json. Laptops that joined before the rename to Agent Board
// have ~/.claude-board.json; that file keeps being used (read and updated) so nothing has to move.
export const CONFIG_PATH = (() => {
  const file = path.join(os.homedir(), '.agent-board.json');
  const legacy = path.join(os.homedir(), '.claude-board.json');
  return !fs.existsSync(file) && fs.existsSync(legacy) ? legacy : file;
})();
export const START = {
  claude: 'open Claude Code there and type  /board',
  codex: 'open Codex there and type  $board',
  'copilot-vscode': 'open the folder in VS Code, Copilot Chat in Agent mode, type  /board',
  'copilot-cli': 'run  copilot --allow-tool board --autopilot --max-autopilot-continues 50  there, then type  /board',
  gemini: 'open Gemini CLI there and type  /board',
  cursor: 'open the folder in Cursor, Agent chat, type  /board',
  other: 'start your tool there and tell it: "follow the board playbook (call get_playbook)"',
};
const LABEL = { claude: 'Claude Code', codex: 'Codex', 'copilot-vscode': 'Copilot in VS Code', 'copilot-cli': 'Copilot CLI', gemini: 'Gemini CLI', cursor: 'Cursor', other: 'Your MCP tool' };
// Command-line tools: if the command isn't installed yet, the config is ready but the agent can't start.
const BIN = { codex: ['codex', 'npm i -g @openai/codex'], 'copilot-cli': ['copilot', 'npm i -g @github/copilot'], gemini: ['gemini', 'npm i -g @google/gemini-cli'] };
const onPath = (bin) => spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8', windowsHide: true }).status === 0;
const geminiHome = () => process.env.GEMINI_CLI_HOME || path.join(os.homedir(), '.gemini');

export async function runDoctor({ header = true } = {}) {
  let problems = 0;
  const ok = (m) => console.log(`  ✓ ${m}`);
  const bad = (m, fix) => { problems++; console.log(`  ✗ ${m}${fix ? `\n      → ${fix}` : ''}`); };
  if (header) console.log('\nChecking this laptop\'s connection to the team board…');

  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch {
    bad('This laptop hasn\'t joined a board yet.', 'Copy the join command from the web board (Start here → step 1) and run it in your claude-board folder.');
    return problems;
  }
  // Each agent remembers its own board (a laptop's tools can be on different boards); older configs
  // kept one board for all of them at the top level. URLs keep their path: /b/<board> on multi-board servers.
  // An empty list means join set nothing up: don't guess a tool (it used to fall back to Claude Code).
  const agents = (Array.isArray(cfg.agents) ? cfg.agents : [{ tool: 'claude', agent: cfg.agent, dir: null }])
    .map((a) => ({ ...a, url: String(a.url || cfg.url || '').replace(/\/+$/, ''), token: a.token || cfg.token }));
  if (!agents.length) {
    bad('No AI tool is set up on this laptop yet.', 'Run npm run join again and pick your tool.');
    return problems;
  }
  const notInstalled = []; // e.g. "gemini (npm i -g @google/gemini-cli)"
  const pushChecked = new Set();
  // On more than one board? Then each tool's line says which one.
  const severalBoards = new Set(agents.map((a) => a.url)).size > 1;
  const boards = new Map(); // url|token → { ok, outdated, name }
  const mine = spawnSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout?.trim();

  // 1–2. Each board once: reachable, same code version, token accepted, and its name.
  async function checkBoard(url, token) {
    const key = `${url}|${token}`;
    if (boards.has(key)) return boards.get(key);
    const b = { ok: false, outdated: false, name: null };
    boards.set(key, b);
    let health;
    try {
      // /health is answered once for the whole server, at its root (not under /b/<board>).
      const r = await fetch(`${url.replace(/\/b\/[^/]+$/, '')}/health`, { signal: AbortSignal.timeout(4000) });
      health = await r.json();
    } catch (e) {
      bad(`can't reach the board at ${url} (${e.cause?.code || e.message})`,
        'Is the host\'s `npm start` window still open? Same wifi (or both on Tailscale)? On the host, allow Node through the firewall.');
      return b;
    }
    b.outdated = !health.version;
    if (b.outdated) {
      bad('the board server runs an old version of Agent Board.', 'Host: git pull in the claude-board folder, then close the npm start window (Ctrl+C) and run npm start again.');
    } else if (mine && health.version !== 'unknown' && health.version !== mine) {
      console.log(`  • the board runs Agent Board ${health.version}; this folder has ${mine}. If either side is behind, run git pull there (the board reloads by itself).`);
    }
    const st = await fetch(`${url}/api/state`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (st?.status === 401) {
      bad(`the board at ${url} rejected the token.`, 'The board\'s token changed (the host rotated it or started a new board). Ask the host for the new join command and run it.');
      return b;
    }
    if (st?.status === 409) {
      const m = await st.json().catch(() => ({}));
      bad(`Your tools point at the plain board address, but that board is now at ${url}${m.moved_to || '/b/<name>'}.`, `Re-run join with the new command from the web board (--url ${url}${m.moved_to || '/b/<name>'}).`);
      return b;
    }
    if (st?.status === 410) {
      bad(`the board at ${url} is archived.`, 'Ask the host which board to use now, and run its join command.');
      return b;
    }
    if (st?.status === 404) {
      bad(`there's no board at ${url}.`, 'Check the address with the host (boards live at /b/<name>), and run the join command again.');
      return b;
    }
    try { const s = st?.ok ? await st.json() : null; b.name = s?.board?.name || s?.board?.slug || null; } catch {}
    ok(`board${b.name ? ` "${b.name}"` : ''} reachable at ${url}`);
    b.ok = true;
    return b;
  }

  // 3. Each agent: its board answers as that agent, and the tool's config points at that board
  for (const a of agents) {
    const { url, token } = a;
    const board = await checkBoard(url, token);
    if (!board.ok) continue;
    const outdated = board.outdated;
    console.log(`  ${LABEL[a.tool] || a.tool} (as "${a.agent}")${board.name && severalBoards ? ` on board "${board.name}"` : ''}${a.dir ? ` in ${a.dir}` : ''}`);
    // probe=1: checking must not make this agent look online/started on the board.
    const mcpUrl = `${url}/mcp?agent=${encodeURIComponent(a.agent)}&token=${encodeURIComponent(token)}&probe=1`;
    let tools = [];
    try {
      const r = await fetch(mcpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        signal: AbortSignal.timeout(5000),
      });
      tools = (await r.json()).result?.tools?.map((t) => t.name) || [];
    } catch {}
    if (!tools.length) bad('    the board did not answer as this agent', 'Run npm run join again.');
    else if (!tools.includes('get_playbook')) { if (!outdated) bad('    the board server is outdated (no get_playbook tool)', 'Host: git pull in the claude-board folder; the board reloads by itself (or restart npm start).'); }
    else ok(`    board answers (${tools.length} tools)`);

    if (BIN[a.tool] && !onPath(BIN[a.tool][0])) {
      notInstalled.push(`${BIN[a.tool][0]} (${BIN[a.tool][1]})`);
      console.log(`    • \`${BIN[a.tool][0]}\` isn't installed yet (${BIN[a.tool][1]}). The config is ready for when it is.`);
    }
    const found = toolConfig(a);
    if (a.tool === 'other') {
      // Same address join printed: the config has everything needed to show it again.
      console.log('    • add this MCP server to your tool (keep it private: it contains the agent token):');
      console.log('        name: board');
      console.log('        type: http (streamable HTTP)');
      console.log(`        url:  ${mcpUrlFor(a, cfg)}`);
    } else if (a.tool === 'copilot-vscode' && !a.dir) bad('    Copilot in VS Code is set up per repo, and no repo was given', 'Run npm run join again with --repo <path to your hackathon repo>.');
    else if (found === null) console.log('    • (can\'t inspect this tool\'s config from here)');
    else if (!found) bad(`    ${LABEL[a.tool]} isn't connected to this board`, 'Run npm run join again and pick this tool.');
    // Names are case-insensitive on the board, so a config written as "Dana" still matches "dana".
    // `<board url>/mcp?`, not just the host: on a multi-board server /b/<a>/mcp and /b/<b>/mcp share the host.
    else if (!found.toLowerCase().includes(`agent=${encodeURIComponent(a.agent)}`.toLowerCase()) || !found.includes(`${url.replace(/^https?:\/\//, '')}/mcp?`)) {
      bad(`    ${LABEL[a.tool]} points at a different board or name`, 'Run npm run join again.');
    } else {
      ok(`    ${LABEL[a.tool]} is connected${board.name ? ` to board "${board.name}"` : ''}`);
      // Older joins didn't say whose agent it is: still works, but may show up as a separate person.
      if (!/[?&]person=/.test(found) || !/[?&]laptop=/.test(found)) console.log('    • re-run join to group this laptop\'s agents under your name');
    }

    const shortcut = shortcutPath(a);
    if (shortcut && !fs.existsSync(shortcut)) bad(`    the start shortcut is missing (${shortcut})`, 'Run npm run join again.');

    // Agents branch, commit and push: the folder must be a git repo with somewhere to push to.
    if (a.dir) {
      const git = (...x) => spawnSync('git', ['-C', a.dir, ...x], { encoding: 'utf8' });
      if (!fs.existsSync(a.dir)) bad(`    its folder is gone (${a.dir})`, 'Run npm run join again with the right --repo.');
      else if (git('rev-parse', '--is-inside-work-tree').status !== 0) bad(`    ${a.dir} is not a git repository`, 'Clone the team\'s repo there (or git init and add an origin remote), then run npm run join again.');
      else if (!git('remote', 'get-url', 'origin').stdout.trim()) bad('    the repo has no "origin" remote, so agents can\'t push their branches', 'git remote add origin <the team repo URL>');
      else {
        const origin = git('remote', 'get-url', 'origin').stdout.trim();
        ok(`    git repo with origin ${origin}`);
        // Worktrees of one repo share the origin: check pushing once per repo.
        if (!pushChecked.has(origin)) { pushChecked.add(origin); checkPush(a.dir, origin, ok, bad); }
      }
    }
  }

  if (!problems) {
    // "All good" only when everything was checked: not when a command is missing or "other" still needs the address added.
    const next = [
      notInstalled.length && `Ready once you install ${notInstalled.join(' and ')}.`,
      agents.some((a) => a.tool === 'other') && 'Next: add the server shown above to your tool.',
    ].filter(Boolean);
    console.log(`\n  ${next.length ? next.join(' ') : 'All good.'} To start:`);
    for (const a of agents) console.log(`    ${(LABEL[a.tool] || a.tool).padEnd(20)} ${a.dir ? `in "${a.dir}": ` : 'in your hackathon repo: '}${START[a.tool]}`);
  }
  return problems;
}

// Agents push their branches and (on GitHub) open and merge pull requests with gh. Check that this
// laptop can, before the event: at Kubecon, blocked pushes and merges moved the merging job around 6 times.
function checkPush(dir, origin, ok, bad) {
  const run = (cmd, argv) => spawnSync(cmd, argv, { encoding: 'utf8', timeout: 20e3, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } });
  const gh = origin.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (gh) {
    const slug = `${gh[1]}/${gh[2]}`;
    const ver = run('gh', ['--version']);
    if (ver.error || ver.status !== 0) {
      console.log('    • gh (GitHub CLI) isn\'t installed: agents can still push branches, but opening and merging pull requests needs it (https://cli.github.com, then gh auth login)');
    } else if (run('gh', ['auth', 'status']).status !== 0) {
      bad('    gh isn\'t signed in to GitHub, so agents can\'t open or merge pull requests', 'Run  gh auth login  (then  gh auth setup-git  so git pushes use the same login).');
    } else {
      const perm = run('gh', ['repo', 'view', slug, '--json', 'viewerPermission', '-q', '.viewerPermission']);
      const level = (perm.stdout || '').trim();
      if (perm.status !== 0) bad(`    can't see ${slug} on GitHub with your gh login`, `Check the repo URL, or ask the repo owner to add your GitHub account as a collaborator (${slug} → Settings → Collaborators).`);
      else if (!['WRITE', 'MAINTAIN', 'ADMIN'].includes(level)) bad(`    your GitHub account can only read ${slug} (${level || 'no access'}), so your agents can't push`, `Ask the repo owner to add you as a collaborator with write access (${slug} → Settings → Collaborators).`);
      else ok(`    you can push to ${slug} (${level.toLowerCase()})`);
    }
  }
  // A dry run sends nothing: it only checks that git can log in and would be allowed to push.
  // --no-verify: pre-push hooks (husky running the tests, say) would make it slow or fail for other reasons.
  const dry = run('git', ['-C', dir, 'push', '--dry-run', '--no-verify', 'origin', 'HEAD:refs/heads/agent-board-push-check']);
  const msg = `${dry.stderr || ''}${dry.stdout || ''}`;
  if (dry.status === 0) ok('    git can push to origin (dry run)');
  else if (dry.error?.code === 'ETIMEDOUT' || dry.signal) bad('    git push (dry run) didn\'t finish: it may be waiting for a login', gh ? 'Run  gh auth login  and then  gh auth setup-git , or push once by hand to save your login.' : 'Push once by hand to save your login.');
  else if (/auth|denied|permission|403|401|could not read Username|terminal prompts disabled/i.test(msg)) bad('    git can\'t push to origin: not signed in, or no write access', gh ? 'Run  gh auth login  and then  gh auth setup-git ; if that doesn\'t help, ask the repo owner for write access.' : 'Sign in for this remote (push once by hand), or ask the repo owner for write access.');
  else if (/src refspec|does not match any/i.test(msg)) console.log('    • couldn\'t test pushing (no commit checked out yet)');
  else bad(`    git push (dry run) failed: ${msg.trim().split('\n').pop()}`, 'Check the network and the origin URL.');
}

// The MCP address join gives a tool (same parameters, same order), rebuilt from ~/.agent-board.json.
function mcpUrlFor(a, cfg) {
  const p = { agent: a.agent, token: a.token, ...(cfg.person ? { person: cfg.person } : {}), ...(cfg.laptop_id ? { laptop: cfg.laptop_id } : {}), ...(a.plan ? { plan: a.plan } : {}), ...(a.slots ? { slots: String(a.slots) } : {}) };
  return `${a.url}/mcp?${new URLSearchParams(p)}`;
}

// The board URL as the tool has it configured, or '' if not configured, or null if we can't tell.
function toolConfig({ tool, dir }) {
  const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
  if (tool === 'claude') {
    const r = spawnSync('claude mcp get board', { shell: true, encoding: 'utf8' });
    if (r.error || (r.status !== 0 && /not recognized|not found/i.test(r.stderr || ''))) return null;
    return r.status === 0 ? r.stdout : '';
  }
  if (tool === 'codex') return read(path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'config.toml')).match(/\[mcp_servers\.board\][^[]*/)?.[0] || '';
  if (tool === 'copilot-cli') return JSON.stringify(JSON.parse(read(path.join(process.env.COPILOT_HOME || path.join(os.homedir(), '.copilot'), 'mcp-config.json')) || '{}').mcpServers?.board || '') || '';
  if (tool === 'copilot-vscode') return dir ? JSON.stringify(JSON.parse(read(path.join(dir, '.vscode', 'mcp.json')) || '{}').servers?.board || '') : '';
  const board = (p) => { try { return JSON.stringify(JSON.parse(read(p) || '{}').mcpServers?.board || '') || ''; } catch { return ''; } };
  if (tool === 'gemini') return board(path.join(geminiHome(), 'settings.json'));
  if (tool === 'cursor') return board(path.join(os.homedir(), '.cursor', 'mcp.json'));
  return null;
}

function shortcutPath({ tool, dir }) {
  if (tool === 'claude') return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'commands', 'board.md');
  if (tool === 'codex') return path.join(os.homedir(), '.agents', 'skills', 'board', 'SKILL.md');
  if (tool === 'copilot-cli') return path.join(process.env.COPILOT_HOME || path.join(os.homedir(), '.copilot'), 'skills', 'board', 'SKILL.md');
  if (tool === 'copilot-vscode' && dir) return path.join(dir, '.github', 'prompts', 'board.prompt.md');
  if (tool === 'gemini') return path.join(geminiHome(), 'commands', 'board.toml');
  if (tool === 'cursor' && dir) return path.join(dir, '.cursor', 'commands', 'board.md');
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // exitCode, not process.exit(): exiting while fetch sockets are still closing crashes Node on Windows.
  process.exitCode = (await runDoctor()) ? 1 : 0;
}
