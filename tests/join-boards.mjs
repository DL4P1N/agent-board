// join, doctor, the Stop hook and restore with several boards on one server (/b/<board>), in a
// sandboxed home folder (never the real one). A laptop's tools can be on different boards: joining a
// board moves only the tools picked now. Starts its own throwaway server. Run all suites with: npm test
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { startBoard, finish, ROOT, TOKEN, tempDir } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const ADMIN = 'adm-join-boards';
const board = await startBoard({ env: { BOARD_ADMIN_TOKEN: ADMIN } });
const A = board.base; // the default board, at the root

// A second board, made the way the Boards page does it.
const created = await (await fetch(`${A}/api/admin/boards`, { method: 'POST', headers: { Authorization: `Bearer ${ADMIN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Team B' }) })).json();
const slug = created.slug;
const B = `${A}/b/${slug}`;
const tokenB = created.token;
check('second board created', !!slug && !!tokenB && /\/b\//.test(created.join_command || ''), JSON.stringify(created).slice(0, 200));

// A fake home and a project repo with an origin (a local bare repo, so doctor's dry-run push works).
const tmp = tempDir('agent-board-jb-');
const home = path.join(tmp, 'home'); fs.mkdirSync(home);
const bare = path.join(tmp, 'origin.git');
const repo = path.join(tmp, 'hack');
const git = (...a) => spawnSync('git', a, { encoding: 'utf8' });
git('init', '--bare', '-q', bare);
git('init', '-q', repo);
git('-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
git('-C', repo, 'remote', 'add', 'origin', bare);

const env = { ...process.env, HOME: home, USERPROFILE: home, APPDATA: path.join(home, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(home, 'AppData', 'Local'), XDG_CONFIG_HOME: path.join(home, '.config') };
for (const k of ['GEMINI_CLI_HOME', 'CODEX_HOME', 'COPILOT_HOME', 'CLAUDE_CONFIG_DIR', 'BOARD_URL', 'BOARD_TOKEN', 'BOARD_AGENT']) delete env[k];
const join = (url, token, tools, extra = []) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'join.mjs'), '--url', url, '--token', token, '--tool', tools, '--name', 'tess', '--repo', repo, '--wait', '0', ...extra],
  { cwd: ROOT, env, encoding: 'utf8', input: '', timeout: 90e3 });
const readJ = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const gemini = () => readJ(path.join(home, '.gemini', 'settings.json')).mcpServers?.board?.httpUrl || '';
const cursor = () => readJ(path.join(home, '.cursor', 'mcp.json')).mcpServers?.board?.url || '';
const cfg = () => readJ(path.join(home, '.agent-board.json'));

// ---- 1. join board A (root) with two tools ----
const r1 = join(A, TOKEN, 'gemini,cursor');
const o1 = `${r1.stdout}${r1.stderr}`;
check('join board A exits cleanly', r1.status === 0, o1.slice(-500));
check('board A: tools point at the root /mcp', gemini().startsWith(`${A}/mcp?`) && cursor().startsWith(`${A}/mcp?`), `${gemini()} | ${cursor()}`);

// ---- 2. join board B with one of them: it moves, the other stays ----
const r2 = join(B, tokenB, 'gemini');
const o2 = `${r2.stdout}${r2.stderr}`;
check('join board B exits cleanly', r2.status === 0, o2.slice(-600));
check('join says board B by name', /board "Team B" reachable at .*\/b\//.test(o2), o2.slice(0, 300));
check('join: Gemini now points at board B (says which board it left)', /This laptop's Gemini CLI now points at board "Team B"; it no longer gets "Main board"\./.test(o2), o2.slice(0, 700));
check('join: Cursor stays on board A (and how to move it)', /Cursor stays on board "Main board" \(join again with --tool cursor to move it here too\)/.test(o2));
check('Gemini MCP URL keeps the board path /b/<board>/mcp', gemini().startsWith(`${B}/mcp?`) && gemini().includes(`token=${encodeURIComponent(agentTokenFor(tokenB))}`), gemini());
check('Cursor still on board A', cursor().startsWith(`${A}/mcp?`), cursor());
const c2 = cfg();
const g2 = c2.agents.find((a) => a.tool === 'gemini'); const cu2 = c2.agents.find((a) => a.tool === 'cursor');
check('~/.agent-board.json: each agent remembers its own board', g2?.url === B && g2?.board === 'Team B' && cu2?.url === A && cu2?.board === 'Main board' && g2.token === agentTokenFor(tokenB) && cu2.token === agentTokenFor(TOKEN), JSON.stringify(c2.agents));
check('the web link join prints keeps the board path and signs in as tess', o2.includes(`Web board:  ${B}/?token=${encodeURIComponent(tokenB)}&name=tess`), (o2.match(/Web board:.*$/m) || [''])[0]);
check('doctor (run by join): each tool connected to its own board', /Gemini CLI is connected to board "Team B"/.test(o2) && /Cursor is connected to board "Main board"/.test(o2) && !/points at a different board/.test(o2), o2.slice(o2.indexOf('Checking'), o2.indexOf('Checking') + 1200));

// ---- 3. doctor on its own ----
// A board's token at the plain (root) address, when that board isn't the one served there: join says where it moved.
const moved = join(A, tokenB, 'gemini');
const movedOut = `${moved.stdout}${moved.stderr}`;
check('join with another board\'s token at the plain address: says the board is at /b/<slug>', moved.status !== 0 && new RegExp(`now at ${A.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/b/${slug}`).test(movedOut), movedOut.slice(-300));
check('... and join setup info hands out the canonical /b/main address for the default board', (await (await fetch(`${A}/api/state`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json()).setup.join_commands[0].command.includes(`${'/b/main'} --token`));

const d = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.mjs')], { cwd: ROOT, env, encoding: 'utf8', timeout: 60e3 });
const dout = `${d.stdout}${d.stderr}`;
check('npm run doctor: both boards reachable by name, all good', d.status === 0 && /board "Team B" reachable at .*\/b\//.test(dout) && /board "Main board" reachable/.test(dout) && /All good|Ready once you install gemini/.test(dout), dout.slice(-700));
check('doctor names the board per tool when a laptop is on two boards', /Gemini CLI \(as "tess"\) on board "Team B"/.test(dout) && /Cursor \(as "tess-cursor"\) on board "Main board"/.test(dout), dout.slice(0, 900));
// Point Cursor's config at board B's address without re-joining: doctor must notice (same host, other board).
const cm = readJ(path.join(home, '.cursor', 'mcp.json')); const cursorUrl = cm.mcpServers.board.url;
cm.mcpServers.board.url = cursorUrl.replace(`${A}/mcp?`, `${B}/mcp?`); fs.writeFileSync(path.join(home, '.cursor', 'mcp.json'), JSON.stringify(cm));
const d2 = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.mjs')], { cwd: ROOT, env, encoding: 'utf8', timeout: 60e3 });
check('doctor: a tool pointing at another board on the same host is caught', /Cursor points at a different board or name/.test(`${d2.stdout}`), `${d2.stdout}`.slice(0, 900));
cm.mcpServers.board.url = cursorUrl; fs.writeFileSync(path.join(home, '.cursor', 'mcp.json'), JSON.stringify(cm));

// ---- 4. "other" tool on board B: the printed address keeps the path ----
const r3 = join(B, tokenB, 'other:omp');
const o3 = `${r3.stdout}${r3.stderr}`;
check('join --tool other on board B: prints the /b/<board>/mcp address', r3.status === 0 && o3.includes(`${B}/mcp?`) && /agent=tess/.test(o3), o3.slice(0, 800));

// ---- 5. Stop hook: reads the board it's pointed at, one cursor per board ----
const post = (base, token, text) => fetch(`${base}/api/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Agent': 'dana', 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
await post(A, TOKEN, 'news only on board A');
await post(B, tokenB, '@tess news only on board B');
const hook = (url, token) => spawnSync(process.execPath, [path.join(ROOT, 'hooks', 'board-stop-hook.mjs')],
  { cwd: ROOT, env: { ...env, BOARD_URL: url, BOARD_TOKEN: agentTokenFor(token), BOARD_AGENT: 'tess', BOARD_HOOK_WAIT: '0', TEMP: tmp, TMP: tmp, TMPDIR: tmp }, input: '{}', encoding: 'utf8', timeout: 30e3 });
const hB = hook(B, tokenB);
check('Stop hook on board B: sees board B\'s message, not board A\'s', /news only on board B/.test(hB.stdout) && !/news only on board A/.test(hB.stdout) && /MENTIONS YOU/.test(hB.stdout), (hB.stdout + hB.stderr).slice(0, 400));
const hA = hook(A, TOKEN);
check('Stop hook on board A: its own cursor (not board B\'s), sees board A\'s message', /news only on board A/.test(hA.stdout) && !/news only on board B/.test(hA.stdout), (hA.stdout + hA.stderr).slice(0, 400));
const hB2 = hook(B, tokenB);
check('Stop hook on board B again: nothing new (its cursor moved on)', !/news only on board B/.test(hB2.stdout), hB2.stdout.slice(0, 300));

// ---- 6. restore --board, with the server stopped ----
const root = board.dataDir;
const dirB = path.join(root, 'boards', slug);
await board.stop();
// A backup of board B as it is now (with its message), then a change that the restore must undo.
fs.mkdirSync(path.join(dirB, 'backups'), { recursive: true });
const bak = path.join(dirB, 'backups', 'board-20260101-000000.db');
{ const db = new DatabaseSync(path.join(dirB, 'board.db')); db.exec(`VACUUM INTO '${bak.replace(/'/g, "''")}'`); db.exec("INSERT INTO events (ts, author, kind, channel, text) VALUES (1, 'x', 'message', 'general', 'after the backup')"); db.close(); }
const rootDbBefore = fs.statSync(path.join(root, 'board.db')).mtimeMs;
const restore = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'restore.mjs'), ...a], { encoding: 'utf8', env: { ...process.env, BOARD_DATA: root, PORT: String(board.port) } });
const ls = restore();
check('npm run restore lists every board\'s backups', ls.status === 0 && /Board main \(default\)/.test(ls.stdout) && new RegExp(`Board ${slug}\\. Backups in`).test(ls.stdout) && ls.stdout.includes('board-20260101-000000.db') && /--board <name>/.test(ls.stdout), ls.stdout + ls.stderr);
const bad = restore('latest', '--board', 'nope');
check('restore --board with an unknown board is refused, naming the boards', bad.status !== 0 && /No board called "nope"\. Boards: main, /.test(bad.stderr), bad.stderr);
const rs = restore('latest', '--board', slug);
check('restore --board <slug> restores that board', rs.status === 0 && new RegExp(`Restored board "${slug}"`).test(rs.stdout), rs.stdout + rs.stderr);
const kept = fs.readdirSync(dirB).filter((f) => f.startsWith('board.db.before-restore-') && !/-(wal|shm)$/.test(f));
check('the previous board B database is kept next to it', kept.length === 1, fs.readdirSync(dirB).join(', '));
const after = new DatabaseSync(path.join(dirB, 'board.db'), { readOnly: true });
const texts = after.prepare('SELECT text FROM events').all().map((r) => r.text); after.close();
check('board B is back to the backup (its message kept, the later change gone)', texts.some((t) => /news only on board B/.test(t)) && !texts.includes('after the backup'), texts.slice(-3).join(' | '));
check('board A (the default) was not touched', fs.statSync(path.join(root, 'board.db')).mtimeMs === rootDbBefore);

fs.rmSync(tmp, { recursive: true, force: true });
await finish(R);
