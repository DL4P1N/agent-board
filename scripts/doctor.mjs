#!/usr/bin/env node
// `npm run doctor`: checks that this laptop's AI tools can really reach the team board, and says what to fix.
// Also runs at the end of `npm run join`. Uses only Node built-ins.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_PATH = path.join(os.homedir(), '.claude-board.json');
export const START = {
  claude: 'open Claude Code there and type  /board',
  codex: 'open Codex there and type  $board',
  'copilot-vscode': 'open the folder in VS Code, Copilot Chat in Agent mode, type  /board',
  'copilot-cli': 'run  copilot --allow-tool board --autopilot --max-autopilot-continues 50  there, then type  /board',
};
const LABEL = { claude: 'Claude Code', codex: 'Codex', 'copilot-vscode': 'Copilot in VS Code', 'copilot-cli': 'Copilot CLI' };

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
  const { url, token } = cfg;
  const agents = cfg.agents?.length ? cfg.agents : [{ tool: 'claude', agent: cfg.agent, dir: null }];

  // 1. Reachable + same code version
  let health;
  try {
    health = await (await fetch(`${url}/health`, { signal: AbortSignal.timeout(4000) })).json();
    ok(`board reachable at ${url}`);
  } catch (e) {
    bad(`can't reach the board at ${url} (${e.cause?.code || e.message})`,
      'Is the host\'s `npm start` window still open? Same wifi (or both on Tailscale)? On the host, allow Node through the firewall.');
    return problems;
  }
  const mine = spawnSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout?.trim();
  const outdated = !health.version;
  if (outdated) {
    bad('the board server runs an old version of claude-board.', 'Host: git pull in the claude-board folder, then close the npm start window (Ctrl+C) and run npm start again.');
  } else if (mine && health.version !== 'unknown' && health.version !== mine) {
    console.log(`  • the board runs claude-board ${health.version}; this folder has ${mine}. If either side is behind, run git pull there (the board reloads by itself).`);
  }

  // 2. Token
  const auth = await fetch(`${url}/api/cursor`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (auth?.status === 401) {
    bad('the board rejected the token.', 'The host started a fresh board. Copy the join command from the web board again and re-run it.');
    return problems;
  }

  // 3. Each agent: the board answers as that agent, and the tool's config points at this board
  for (const a of agents) {
    console.log(`  ${LABEL[a.tool] || a.tool} (as "${a.agent}")${a.dir ? ` in ${a.dir}` : ''}`);
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

    const found = toolConfig(a);
    if (found === null) console.log('    • (can\'t inspect this tool\'s config from here)');
    else if (!found) bad(`    ${LABEL[a.tool]} isn't connected to this board`, 'Run npm run join again and pick this tool.');
    // Names are case-insensitive on the board, so a config written as "Dana" still matches "dana".
    else if (!found.toLowerCase().includes(`agent=${encodeURIComponent(a.agent)}`.toLowerCase()) || !found.includes(url.replace(/^https?:\/\//, ''))) {
      bad(`    ${LABEL[a.tool]} points at a different board or name`, 'Run npm run join again.');
    } else {
      ok(`    ${LABEL[a.tool]} is connected`);
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
      else ok(`    git repo with origin ${git('remote', 'get-url', 'origin').stdout.trim()}`);
    }
  }

  if (!problems) {
    console.log('\n  All good. To start:');
    for (const a of agents) console.log(`    ${(LABEL[a.tool] || a.tool).padEnd(20)} ${a.dir ? `in "${a.dir}": ` : 'in your hackathon repo: '}${START[a.tool]}`);
  }
  return problems;
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
  return null;
}

function shortcutPath({ tool, dir }) {
  if (tool === 'claude') return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'commands', 'board.md');
  if (tool === 'codex') return path.join(os.homedir(), '.agents', 'skills', 'board', 'SKILL.md');
  if (tool === 'copilot-cli') return path.join(process.env.COPILOT_HOME || path.join(os.homedir(), '.copilot'), 'skills', 'board', 'SKILL.md');
  if (tool === 'copilot-vscode' && dir) return path.join(dir, '.github', 'prompts', 'board.prompt.md');
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // exitCode, not process.exit(): exiting while fetch sockets are still closing crashes Node on Windows.
  process.exitCode = (await runDoctor()) ? 1 : 0;
}
