// join + doctor for Gemini CLI and Cursor, in a sandboxed home folder (never the real one):
// the MCP config each tool reads, the /board shortcuts, backups, re-running join, and doctor's checks.
// Starts its own throwaway board. Run all suites with: npm test
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { startBoard, finish, ROOT, TOKEN } from './helpers.mjs';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const board = await startBoard();

// A fake home, a hackathon repo with an origin (a local bare repo, so doctor's dry-run push works).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-board-jt-'));
const home = path.join(tmp, 'home'); fs.mkdirSync(home);
const bare = path.join(tmp, 'origin.git');
const repo = path.join(tmp, 'hack');
const git = (...a) => spawnSync('git', a, { encoding: 'utf8' });
git('init', '--bare', '-q', bare);
git('init', '-q', repo);
git('-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
git('-C', repo, 'remote', 'add', 'origin', bare);

// Settings a user already had: join must keep them and back up the originals.
fs.mkdirSync(path.join(home, '.gemini'), { recursive: true });
fs.writeFileSync(path.join(home, '.gemini', 'settings.json'), JSON.stringify({ theme: 'Dracula', mcpServers: { mine: { command: 'x' } } }, null, 2));
fs.mkdirSync(path.join(home, '.cursor'), { recursive: true });
fs.writeFileSync(path.join(home, '.cursor', 'mcp.json'), JSON.stringify({ mcpServers: { other: { url: 'https://example.com/mcp' } } }, null, 2));

const env = { ...process.env, HOME: home, USERPROFILE: home, APPDATA: path.join(home, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(home, 'AppData', 'Local'), XDG_CONFIG_HOME: path.join(home, '.config'), GEMINI_CLI_HOME: '', CODEX_HOME: '', COPILOT_HOME: '', CLAUDE_CONFIG_DIR: '' };
for (const k of ['GEMINI_CLI_HOME', 'CODEX_HOME', 'COPILOT_HOME', 'CLAUDE_CONFIG_DIR']) delete env[k];
const join = (...extra) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'join.mjs'), '--url', board.base, '--token', TOKEN, '--tool', 'gemini,cursor', '--name', 'Tess', '--repo', repo, '--wait', '0', ...extra],
  { cwd: ROOT, env, encoding: 'utf8', input: '', timeout: 90e3 });
const readJ = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const r1 = join();
const out1 = `${r1.stdout}${r1.stderr}`;
check('join exits cleanly', r1.status === 0, out1.slice(-600));
if (!fs.existsSync(path.join(home, '.gemini', 'commands', 'board.toml'))) console.log(`join output:\n${out1}`);

// ---- Gemini CLI ----
const gs = readJ(path.join(home, '.gemini', 'settings.json'));
const gUrl = gs.mcpServers?.board?.httpUrl || '';
check('Gemini: board in settings.json as httpUrl, trusted', gUrl.startsWith(`${board.base}/mcp?`) && gs.mcpServers.board.trust === true, JSON.stringify(gs.mcpServers?.board));
check('Gemini: URL carries agent tess-gemini, person, laptop, agent token (not the board token)', /agent=tess-gemini/.test(gUrl) && /person=tess/.test(gUrl) && /laptop=[a-z0-9]+/.test(gUrl) && !gUrl.includes(`token=${TOKEN}&`) && !gUrl.endsWith(`token=${TOKEN}`), gUrl);
check('Gemini: the user\'s own settings are kept', gs.theme === 'Dracula' && gs.mcpServers.mine?.command === 'x');
check('Gemini: original settings.json backed up', fs.existsSync(path.join(home, '.gemini', 'settings.json.bak-claude-board')) && !readJ(path.join(home, '.gemini', 'settings.json.bak-claude-board')).mcpServers.board);
const toml = fs.readFileSync(path.join(home, '.gemini', 'commands', 'board.toml'), 'utf8');
check('Gemini: /board command (TOML: description + prompt that calls get_playbook, takes {{args}})', /^description = "/m.test(toml) && /^prompt = '''$/m.test(toml) && /get_playbook/.test(toml) && /\{\{args\}\}/.test(toml) && /You are Gemini CLI/.test(toml), toml.slice(0, 200));
check('Gemini: TOML literal string is closed once (no stray quotes)', (toml.match(/'''/g) || []).length === 2);

// ---- Cursor ----
const cm = readJ(path.join(home, '.cursor', 'mcp.json'));
const cUrl = cm.mcpServers?.board?.url || '';
check('Cursor: board in ~/.cursor/mcp.json as url', cUrl.startsWith(`${board.base}/mcp?`) && /agent=tess-cursor/.test(cUrl) && /person=tess/.test(cUrl), JSON.stringify(cm.mcpServers?.board));
check('Cursor: the user\'s other MCP server is kept, original backed up', cm.mcpServers.other?.url === 'https://example.com/mcp' && fs.existsSync(path.join(home, '.cursor', 'mcp.json.bak-claude-board')));
// Two tools on one laptop: each gets its own worktree; Cursor's is the second one.
const cDir = `${repo}-cursor`;
const cmd = path.join(cDir, '.cursor', 'commands', 'board.md');
const rule = path.join(cDir, '.cursor', 'rules', 'board.mdc');
check('Cursor: its own worktree next to the repo', fs.existsSync(path.join(cDir, '.git')), cDir);
check('Cursor: /board command in the repo', fs.existsSync(cmd) && /get_playbook/.test(fs.readFileSync(cmd, 'utf8')) && /You are Cursor/.test(fs.readFileSync(cmd, 'utf8')));
const mdc = fs.existsSync(rule) ? fs.readFileSync(rule, 'utf8') : '';
check('Cursor: rule .mdc with frontmatter (description, alwaysApply: false)', /^---\ndescription: .+\nalwaysApply: false\n---\n/.test(mdc) && /\/board/.test(mdc), mdc.slice(0, 160));
const excl = fs.readFileSync(path.join(bare.replace(/origin\.git$/, 'hack'), '.git', 'info', 'exclude'), 'utf8');
check('Cursor: its files are kept out of git (.git/info/exclude)', excl.includes('.cursor/commands/board.md') && excl.includes('.cursor/rules/board.mdc'), excl);
check('Cursor: git status stays clean in its worktree', git('-C', cDir, 'status', '--porcelain').stdout.trim() === '', git('-C', cDir, 'status', '--porcelain').stdout);

// ---- join's record + doctor ----
const cfg = readJ(path.join(home, '.claude-board.json'));
check('~/.claude-board.json records both agents (lowercase person)', cfg.person === 'tess' && cfg.agents.map((a) => `${a.tool}:${a.agent}`).join(',') === 'gemini:tess-gemini,cursor:tess-cursor', JSON.stringify(cfg.agents));
check('doctor (run by join): Gemini CLI and Cursor connected, shortcuts present', /Gemini CLI \(as "tess-gemini"\)/.test(out1) && /Gemini CLI is connected/.test(out1) && /Cursor \(as "tess-cursor"\)/.test(out1) && /Cursor is connected/.test(out1) && !/start shortcut is missing/.test(out1), out1.slice(out1.indexOf('Checking'), out1.indexOf('Checking') + 900));
check('doctor: how to start each tool', /Gemini CLI\s+in ".*hack": open Gemini CLI there and type {2}\/board/.test(out1) && /Cursor\s+in ".*hack-cursor": open the folder in Cursor, Agent chat, type {2}\/board/.test(out1));
check('join says the tools aren\'t installed yet (config ready)', /`gemini` is not installed yet/.test(out1));

// ---- re-run: idempotent ----
const before = { g: fs.readFileSync(path.join(home, '.gemini', 'settings.json'), 'utf8'), c: fs.readFileSync(path.join(home, '.cursor', 'mcp.json'), 'utf8'), t: toml, m: mdc, x: excl };
const r2 = join();
check('re-run exits cleanly', r2.status === 0, `${r2.stdout}${r2.stderr}`.slice(-400));
check('re-run: same configs (no duplicates), same shortcut files', fs.readFileSync(path.join(home, '.gemini', 'settings.json'), 'utf8') === before.g && fs.readFileSync(path.join(home, '.cursor', 'mcp.json'), 'utf8') === before.c && fs.readFileSync(path.join(home, '.gemini', 'commands', 'board.toml'), 'utf8') === before.t && fs.readFileSync(rule, 'utf8') === before.m);
check('re-run: backups still hold the user\'s originals', !readJ(path.join(home, '.gemini', 'settings.json.bak-claude-board')).mcpServers.board && !readJ(path.join(home, '.cursor', 'mcp.json.bak-claude-board')).mcpServers.board);
check('re-run: exclude lines not duplicated', fs.readFileSync(path.join(repo, '.git', 'info', 'exclude'), 'utf8') === before.x);

// ---- doctor on its own ----
const d = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.mjs')], { cwd: ROOT, env, encoding: 'utf8', timeout: 60e3 });
const dout = `${d.stdout}${d.stderr}`;
check('npm run doctor: all good', d.status === 0 && /All good/.test(dout), dout.slice(-500));
// Point Cursor at another board: doctor notices.
const cm2 = readJ(path.join(home, '.cursor', 'mcp.json')); cm2.mcpServers.board.url = cm2.mcpServers.board.url.replace('agent=tess-cursor', 'agent=someone-else'); fs.writeFileSync(path.join(home, '.cursor', 'mcp.json'), JSON.stringify(cm2));
const d2 = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.mjs')], { cwd: ROOT, env, encoding: 'utf8', timeout: 60e3 });
check('doctor: Cursor pointing at another name is reported', d2.status !== 0 && /Cursor points at a different board or name/.test(`${d2.stdout}`), `${d2.stdout}`.slice(-400));
// A settings.json that isn't JSON: join leaves it alone and says so.
fs.writeFileSync(path.join(home, '.gemini', 'settings.json'), '{ not json');
const r3 = join();
check('broken Gemini settings.json is left alone with a clear message', fs.readFileSync(path.join(home, '.gemini', 'settings.json'), 'utf8') === '{ not json' && /isn't valid JSON, so it was left alone/.test(`${r3.stdout}${r3.stderr}`));

// Clean up the worktree registration before removing the temp folder.
git('-C', repo, 'worktree', 'remove', '--force', cDir);
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
// AG-10 / ONB-5: the playbook every tool reads names Gemini CLI and Cursor, has a "First time" step
// before the loop, and no event-specific lore.
const pb = fs.readFileSync(path.join(ROOT, 'templates', 'playbook.md'), 'utf8');
check('playbook intro lists Gemini CLI and Cursor', /Claude Code, Codex, GitHub Copilot, Gemini CLI or Cursor/.test(pb.slice(0, pb.indexOf('## '))));
check('playbook: "First time" setup comes before the loop', pb.indexOf('## First time') > 0 && pb.indexOf('## First time') < pb.indexOf('## The loop') && /git fetch/.test(pb.slice(pb.indexOf('## First time'), pb.indexOf('## The loop'))));
check('playbook: a note for Gemini CLI and Cursor', /\*\*Gemini CLI, Cursor:\*\*/.test(pb));
check('playbook: no event-specific lore', !/Kubecon|Gitar/i.test(pb));
check('playbook: keeps the heading the /board shortcuts point to', pb.includes('Codex, GitHub Copilot, or any agent without background subagents'));
await finish(R, { board });
