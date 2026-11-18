#!/usr/bin/env node
// `npm run rehearse`: a short project with REAL headless agents (Claude Code and/or Codex) on a scratch
// project, to check permissions, the playbook and the board end to end before an event.
// It never writes your tool configs: each agent gets the board through per-run flags. It does run with
// your existing ~/.claude and ~/.codex settings (other MCP servers, permission rules, Codex's rules
// file), so it tests your real setup. It doesn't install or exercise the board's Stop hook.
//   --tools claude,codex   which tools to run (default: whichever are installed)
//   --minutes N            how long the agents work (default 8); they're stopped at N + 2
//   --keep                 keep the temp folder (repo, board data, logs, retro)
//   --dry-run              print what would run, start nothing that spends quota (add --keep to keep the temp folder)
// Spends a little of your subscription quota (a real run).
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { agentTokenFor, newBoardToken } from '../src/tokens.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const MINUTES = Math.max(1, Math.min(60, Number(args.minutes) || 8));
const DRY = !!args['dry-run'];
const KEEP = !!args.keep;
const GOAL = 'Add a tiny CLI todo app: add/list/done commands with tests';
const children = new Set();
let tmp = null;
let boardLog = null;

const sh = (cmd, a, opts = {}) => spawnSync(cmd, a, { encoding: 'utf8', windowsHide: true, ...opts });

// How to start a tool without a shell (so arguments need no quoting): an .exe as is; an npm .cmd shim
// on Windows through the Node script it wraps.
function resolveTool(name) {
  if (process.platform !== 'win32') return sh(name, ['--version']).status === 0 ? { cmd: name, pre: [] } : null;
  const where = String(sh('where', [name]).stdout || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const exe = where.find((p) => /\.exe$/i.test(p));
  if (exe) return { cmd: exe, pre: [] };
  const shim = where.find((p) => /\.cmd$/i.test(p));
  if (shim) {
    const m = fs.readFileSync(shim, 'utf8').match(/"%dp0%\\([^"]+\.js)"/);
    if (m) { const js = path.join(path.dirname(shim), m[1]); if (fs.existsSync(js)) return { cmd: process.execPath, pre: [js] }; }
  }
  return null;
}
const log = (...m) => console.log(...m);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    if (['keep', 'dry-run'].includes(k)) out[k] = true;
    else out[k] = argv[++i];
  }
  return out;
}

function cleanup() {
  for (const c of children) killTree(c);
  try { boardLog?.end(); } catch {}
  if (tmp && !KEEP) { try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch {} }
}
function killTree(c) {
  if (!c || c.exitCode !== null) return;
  if (process.platform === 'win32') sh('taskkill', ['/T', '/F', '/PID', String(c.pid)]);
  else { try { process.kill(-c.pid, 'SIGTERM'); } catch { try { c.kill('SIGTERM'); } catch {} } }
}
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('exit', () => { for (const c of children) killTree(c); });

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.unref(); s.on('error', reject);
  s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

// ---------- scratch project ----------
function makeProject(dir) {
  const origin = path.join(dir, 'origin.git');
  const seed = path.join(dir, 'seed');
  const git = (cwd, ...a) => { const r = sh('git', a, { cwd }); if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`); return r.stdout; };
  fs.mkdirSync(seed, { recursive: true });
  git(dir, 'init', '--bare', '-b', 'main', origin);
  git(seed, 'init', '-b', 'main');
  git(seed, 'config', 'user.email', 'rehearsal@example.com'); git(seed, 'config', 'user.name', 'rehearsal');
  fs.writeFileSync(path.join(seed, 'package.json'), JSON.stringify({ name: 'rehearsal-todo', version: '0.0.0', type: 'module', private: true, scripts: { test: 'node --test' } }, null, 2) + '\n');
  fs.writeFileSync(path.join(seed, 'README.md'), `# Rehearsal project\n\nGoal: ${GOAL}.\n\nRun the tests with \`npm test\`.\n`);
  fs.mkdirSync(path.join(seed, 'lib'));
  fs.writeFileSync(path.join(seed, 'lib', 'store.js'), "// In-memory list of todos. The CLI should build on this.\nexport function createStore() {\n  const items = [];\n  return { all: () => items.slice() };\n}\n");
  fs.writeFileSync(path.join(seed, 'store.test.js'), "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { createStore } from './lib/store.js';\n\ntest('starts empty', () => { assert.deepEqual(createStore().all(), []); });\n");
  git(seed, 'add', '-A'); git(seed, 'commit', '-q', '-m', 'Scratch project for the rehearsal');
  git(seed, 'remote', 'add', 'origin', origin); git(seed, 'push', '-q', '-u', 'origin', 'main');
  return { origin, clone: (name) => { const d = path.join(dir, name); git(dir, 'clone', '-q', origin, d); git(d, 'config', 'user.email', `${name}@rehearsal.local`); git(d, 'config', 'user.name', name); return d; } };
}

// ---------- board ----------
async function startBoard(dir, port, token) {
  const data = path.join(dir, 'board-data');
  const c = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], {
    cwd: ROOT, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BOARD_TOKEN: token, BOARD_DATA: data, BOARD_NO_JOIN: '1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  children.add(c);
  const out = boardLog = fs.createWriteStream(path.join(dir, 'board.log'));
  c.stdout.pipe(out); c.stderr.pipe(out);
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/health`)).ok) return { base, child: c }; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('the board did not start (see board.log in the temp folder)');
}
const api = (b, token, p, method = 'GET', body) => fetch(`${b}/api${p}`, {
  method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Agent': 'rehearsal' }, body: body && JSON.stringify(body),
}).then(async (r) => (/json/.test(r.headers.get('content-type') || '') ? r.json() : r.text()));

// ---------- agents ----------
const kickoff = (minutes) => `You are a rehearsal agent. Join the team board: call get_playbook and follow it until the board says everything is done or you've worked ${minutes} minutes. Work only in this folder.`;

function claudeCommand({ mcpUrl, dir, cfgFile }) {
  fs.writeFileSync(cfgFile, JSON.stringify({ mcpServers: { board: { type: 'http', url: mcpUrl } } }, null, 2));
  return {
    cmd: 'claude',
    args: ['-p', kickoff(MINUTES), '--mcp-config', cfgFile, '--strict-mcp-config', '--permission-mode', 'acceptEdits',
      // On Windows Claude Code runs shell commands through its PowerShell tool, so Bash(...) rules alone
      // don't cover git there (found by the first real rehearsal): allow both.
      '--allowedTools', 'mcp__board', 'Read', 'Edit', 'Write', 'Glob', 'Grep',
      ...['git', 'npm', 'node'].flatMap((c) => [`Bash(${c}:*)`, `PowerShell(${c}:*)`]),
      '--output-format', 'stream-json', '--verbose'],
    cwd: dir,
  };
}
function codexCommand({ mcpUrl, dir }) {
  // -c overrides config values for this run only; nothing is written to ~/.codex.
  return {
    cmd: 'codex',
    args: ['exec', '--skip-git-repo-check', '-C', dir, '-s', 'workspace-write',
      '-c', 'sandbox_workspace_write.network_access=true',
      '-c', `mcp_servers.board.url=${JSON.stringify(mcpUrl)}`,
      kickoff(MINUTES)],
    cwd: dir,
  };
}

// One short line per agent message, from Claude's stream-json or Codex's plain output.
function tidy(line) {
  const s = line.trim(); if (!s) return null;
  if (s[0] === '{') {
    try {
      const j = JSON.parse(s);
      if (j.type === 'assistant') {
        const parts = (j.message?.content || []).map((c) => (c.type === 'text' ? c.text : c.type === 'tool_use' ? `→ ${c.name}${c.input?.command ? ` ${String(c.input.command).slice(0, 80)}` : ''}` : '')).filter(Boolean);
        return parts.join(' | ').replace(/\s+/g, ' ').slice(0, 160) || null;
      }
      if (j.type === 'result') return `result: ${j.subtype || ''} ${String(j.result || '').replace(/\s+/g, ' ').slice(0, 120)}`;
      return null;
    } catch { /* not JSON */ }
  }
  return s.replace(/\s+/g, ' ').slice(0, 160);
}

function runAgent(name, spec, logFile) {
  return new Promise((resolve) => {
    const c = spawn(spec.exec.cmd, [...spec.exec.pre, ...spec.args], { cwd: spec.cwd, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(c);
    const out = fs.createWriteStream(logFile);
    let buf = '';
    const onData = (d) => {
      out.write(d); buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { const t = tidy(buf.slice(0, i)); buf = buf.slice(i + 1); if (t) log(`  [${name}] ${t}`); }
    };
    c.stdout.on('data', onData); c.stderr.on('data', onData);
    const timer = setTimeout(() => { log(`  [${name}] time is up (${MINUTES + 2} min): stopping it`); killTree(c); }, (MINUTES + 2) * 60e3);
    c.on('exit', (code) => { clearTimeout(timer); children.delete(c); out.end(); resolve({ name, code }); });
    c.on('error', (e) => { clearTimeout(timer); children.delete(c); log(`  [${name}] could not start: ${e.message}`); resolve({ name, code: -1 }); });
  });
}

// ---------- main ----------
async function main() {
  const bin = { claude: resolveTool('claude'), codex: resolveTool('codex') };
  const installed = { claude: !!bin.claude, codex: !!bin.codex };
  const wanted = String(args.tools || Object.keys(installed).filter((t) => installed[t]).join(',')).split(',').map((t) => t.trim()).filter(Boolean);
  const tools = wanted.filter((t) => ['claude', 'codex'].includes(t));
  for (const t of tools) if (!installed[t]) log(`! ${t} isn't installed: skipping it.`);
  const run = tools.filter((t) => installed[t]);
  if (!run.length) { log('✗ No agent tool to run (install Claude Code or Codex, or pass --tools).'); return 1; }

  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-board-rehearsal-'));
  log(`Rehearsal: ${run.join(' + ')} for ${MINUTES} min${DRY ? ' (dry run: nothing is started that spends quota)' : ''}`);
  log(`  temp folder: ${tmp}`);
  log("  uses your existing ~/.claude and ~/.codex settings (nothing is written to them); the board's Stop hook isn't installed, so it isn't tested here");
  const proj = makeProject(tmp);
  const port = await freePort();
  const token = newBoardToken();
  const agentToken = agentTokenFor(token);
  const board = await startBoard(tmp, port, token);
  // Tokens are only shown on a real run (a throwaway board on 127.0.0.1, but dry-run output gets pasted around).
  const mask = (t) => (DRY ? `${String(t).slice(0, 6)}…` : t);
  log(`  ${DRY ? 'the board would run at' : 'board'}: ${board.base}/?token=${mask(token)}`);
  await api(board.base, token, '/settings', 'PUT', { goal: GOAL, repo: proj.origin, integrator: '*', deadline: Date.now() + MINUTES * 60e3, freeze_minutes: 0 });

  const laptop = crypto.randomBytes(4).toString('hex');
  const specs = run.map((tool) => {
    const name = `rehearsal-${tool}`;
    const dir = proj.clone(name);
    const mcpUrl = `${board.base}/mcp?${new URLSearchParams({ agent: name, token: agentToken, person: 'rehearsal', laptop: `${laptop}-${tool}` })}`;
    const spec = tool === 'claude' ? claudeCommand({ mcpUrl, dir, cfgFile: path.join(tmp, `${name}.mcp.json`) }) : codexCommand({ mcpUrl, dir });
    spec.exec = bin[tool];
    return { name, tool, spec };
  });
  const hide = (a) => (DRY ? String(a).split(agentToken).join(mask(agentToken)) : a);
  for (const s of specs) log(`  ${s.name}: (in ${s.spec.cwd})\n    ${s.spec.cmd} ${s.spec.args.map((a) => hide(/\s|"/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
  if (DRY) { log(`\nDry run: stopping here. ${KEEP ? `The temp folder is kept: ${tmp}` : 'The temp folder is deleted (use --keep to keep it).'}`); killTree(board.child); return 0; }

  // Answer agents' questions so nobody blocks on a human.
  const answered = new Set();
  const answerer = setInterval(async () => {
    try {
      const st = await api(board.base, token, '/state');
      for (const q of (st.questions || []).filter((x) => !x.answer && !answered.has(x.id))) {
        answered.add(q.id);
        await api(board.base, token, `/questions/${q.id}/answer`, 'POST', { answer: 'Use your judgement; keep it minimal.' });
        log(`  [board] answered a question from ${q.asker}: "${String(q.question).slice(0, 80)}"`);
      }
    } catch {}
  }, 5e3);

  log('');
  const results = await Promise.all(specs.map((s) => runAgent(s.name, s.spec, path.join(tmp, `${s.name}.log`))));
  clearInterval(answerer);

  // ---------- report ----------
  const st = await api(board.base, token, '/state');
  const events = st.events || [];
  const tasks = st.tasks || [];
  const done = tasks.filter((t) => t.status === 'done');
  const retro = await api(board.base, token, '/retro');
  const retroFile = path.join(tmp, 'retro.md');
  fs.writeFileSync(retroFile, typeof retro === 'string' ? retro : JSON.stringify(retro, null, 2));
  const bounces = events.filter((e) => /review → in_progress/.test(e.text)).length;
  const trouble = events.filter((e) => /refus|can['’]t|cannot|permission|approv|denied|failed|error|not allowed|blocked/i.test(e.text));
  const L = [];
  L.push('', '──────── Rehearsal report ────────');
  L.push(`Tasks: ${done.length} done of ${tasks.length}${tasks.length ? ` (${tasks.filter((t) => t.status !== 'done').map((t) => `#${t.id} ${t.status}`).join(', ') || 'all done'})` : ''}`);
  for (const r of results) {
    const mine = events.filter((e) => String(e.author).split('/')[0] === r.name);
    const kinds = {};
    for (const e of mine) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
    L.push(`${r.name}: exit ${r.code}; ${mine.length} board events (${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ') || 'none — it never used the board'})`);
  }
  L.push(`Review bounces: ${bounces}`);
  L.push(`Questions answered automatically: ${answered.size}`);
  if (trouble.length) { L.push('Problems mentioned on the board:'); for (const e of trouble.slice(-10)) L.push(`  - ${e.author}: ${String(e.text).replace(/\s+/g, ' ').slice(0, 160)}`); }
  else L.push('Problems mentioned on the board: none');
  L.push(`Retro: ${retroFile}${KEEP ? '' : ' (deleted with the temp folder; use --keep)'}`);
  L.push(`Logs: ${path.join(tmp, '<agent>.log')}, ${path.join(tmp, 'board.log')}${KEEP ? '' : ' (deleted; use --keep)'}`);
  log(L.join('\n'));
  killTree(board.child);
  return done.length ? 0 : 1;
}

let code = 1;
try { code = await main(); }
catch (e) { console.error(`✗ ${e.message}`); code = 1; }
finally { cleanup(); }
process.exitCode = code;
setTimeout(() => process.exit(code), 1500).unref();
