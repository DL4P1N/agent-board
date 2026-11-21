// join and the files that hold the agent token, in a sandboxed home folder (never the real one): it never writes
// the token into a file git tracks, keeps an existing untracked one out of git, reads VS Code-style JSON (BOM,
// comments, trailing commas) instead of overwriting it, refuses a config it can't parse, writes configs readable
// by this user only, and doctor survives a broken config. Starts its own throwaway board. Run all suites with: npm test
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { startBoard, finish, ROOT, TOKEN, tempDir } from './helpers.mjs';
import { parseJsonc } from '../scripts/lib/jsonc.mjs';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);

// ---- the JSONC reader ----
const j = parseJsonc('﻿{\n // a comment\n "url": "https://a.example//b/*c*/", /* block */ "q": "say \\"hi\\" // not a comment",\n "list": [1, 2,],\n "s": ",]",\n}\n');
check('JSONC: BOM, comments and trailing commas read; strings kept exactly', j.url === 'https://a.example//b/*c*/' && j.q === 'say "hi" // not a comment' && j.list.join() === '1,2' && j.s === ',]', JSON.stringify(j));
let threw = false; try { parseJsonc('{ "a": 1 /* never closed'); } catch { threw = true; }
check('JSONC: not valid even then → throws', threw);

const board = await startBoard();
const tmp = tempDir('agent-board-js-');
const home = path.join(tmp, 'home'); fs.mkdirSync(home);
const env = { ...process.env, HOME: home, USERPROFILE: home, APPDATA: path.join(home, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(home, 'AppData', 'Local'), XDG_CONFIG_HOME: path.join(home, '.config'), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(tmp, 'gitconfig') };
fs.writeFileSync(env.GIT_CONFIG_GLOBAL, '[user]\n\tname = t\n\temail = t@t\n');
for (const k of ['GEMINI_CLI_HOME', 'CODEX_HOME', 'COPILOT_HOME', 'CLAUDE_CONFIG_DIR']) delete env[k];
const git = (...a) => spawnSync('git', a, { encoding: 'utf8', env });
const join = (tool, repo) => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'join.mjs'), '--url', board.base, '--token', TOKEN, '--name', 'Ida', '--tool', tool, '--wait', '0', ...(repo ? ['--repo', repo] : [])], { cwd: ROOT, env, encoding: 'utf8', input: '', timeout: 90e3 });
  return { ...r, out: `${r.stdout}${r.stderr}` };
};
const doctor = () => { const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.mjs')], { cwd: ROOT, env, encoding: 'utf8', timeout: 60e3 }); return { ...r, out: `${r.stdout}${r.stderr}` }; };
const newRepo = (name, files = {}, commit = []) => {
  const dir = path.join(tmp, name);
  git('init', '-q', dir);
  for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
  if (commit.length) git('-C', dir, 'add', '--', ...commit);
  git('-C', dir, 'commit', '-q', '--allow-empty', '-m', 'init');
  return dir;
};
const agentToken = () => parse(path.join(home, '.agent-board.json'))?.agents?.[0]?.token || 'none';
// null when it can't be read (a failed run shows as FAIL lines, not a crash).
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const parse = (p) => { try { return JSON.parse(read(p)); } catch { return null; } };
const mine = { servers: { mine: { type: 'stdio', command: 'my-server' } } };

// ---- a tracked .vscode/mcp.json never gets the token ----
const trackedText = JSON.stringify(mine, null, 2);
const a = newRepo('tracked', { '.vscode/mcp.json': trackedText }, ['.vscode/mcp.json']);
const ja = join('copilot-vscode', a);
const aNow = read(path.join(a, '.vscode', 'mcp.json'));
check('tracked mcp.json: left as it was (no token), join says why and fails', aNow === trackedText && !aNow.includes(agentToken()) && /mcp\.json is tracked by git, so the board's address/.test(ja.out) && ja.status === 1, ja.out.slice(-600));

// ---- an existing untracked one with a BOM, comments and a trailing comma: read, kept out of git ----
const jsonc = '﻿{\n  // my servers\n  "servers": {\n    "mine": { "type": "stdio", "command": "my-server" }, /* keep */\n  },\n}\n';
const b = newRepo('untracked', { '.vscode/mcp.json': jsonc });
const jb = join('copilot-vscode', b);
const bCfg = parse(path.join(b, '.vscode', 'mcp.json'));
check('VS Code-style mcp.json: the user\'s server kept, the board added', bCfg?.servers?.mine?.command === 'my-server' && bCfg?.servers?.board?.url?.includes(`agent=ida`), jb.out.slice(-600));
check('VS Code-style mcp.json: the original (with comments) saved aside, and join says so', read(path.join(b, '.vscode', 'mcp.json.bak-agent-board')) === jsonc && /has comments, which can't be kept/.test(jb.out), jb.out.slice(-600));
check('an existing untracked mcp.json now holding the token is kept out of git', git('-C', b, 'check-ignore', '-q', '.vscode/mcp.json').status === 0 && !git('-C', b, 'status', '--porcelain').stdout.includes('mcp.json'), git('-C', b, 'status', '--porcelain').stdout);
check('no temp file left next to it', !fs.readdirSync(path.join(b, '.vscode')).some((f) => f.endsWith('.tmp')), fs.readdirSync(path.join(b, '.vscode')).join(','));

// ---- one that isn't JSON even with comments allowed: refused, never overwritten ----
const broken = '{ "servers": { "mine": ';
const c = newRepo('broken', { '.vscode/mcp.json': broken });
const jc = join('copilot-vscode', c);
check('unparseable mcp.json: left alone, join says so', read(path.join(c, '.vscode', 'mcp.json')) === broken && /mcp\.json isn't valid JSON, so it was left alone/.test(jc.out) && jc.status === 1, jc.out.slice(-600));

// ---- Copilot CLI: same for ~/.copilot/mcp-config.json; doctor survives it ----
const cliCfg = path.join(home, '.copilot', 'mcp-config.json');
fs.mkdirSync(path.dirname(cliCfg), { recursive: true });
fs.writeFileSync(cliCfg, broken);
const jd = join('copilot-cli');
check('unparseable Copilot CLI config: left alone, join says so', read(cliCfg) === broken && /mcp-config\.json isn't valid JSON, so it was left alone/.test(jd.out), jd.out.slice(-600));
const d = doctor();
check('doctor with an unparseable Copilot CLI config: reports it, doesn\'t crash', d.status === 1 && /Copilot CLI isn't connected to this board/.test(d.out) && !/SyntaxError|at JSON\.parse/.test(d.out), d.out.slice(-600));
fs.rmSync(cliCfg);
const je = join('copilot-cli');
check('Copilot CLI config written once it can be', parse(cliCfg)?.mcpServers?.board?.url?.includes('agent=ida'), je.out.slice(-400));
if (process.platform !== 'win32') {
  const mode = (p) => (fs.statSync(p).mode & 0o777).toString(8);
  check('token configs are readable by this user only (0600)', mode(cliCfg) === '600' && mode(path.join(home, '.agent-board.json')) === '600' && mode(path.join(b, '.vscode', 'mcp.json')) === '600', `${mode(cliCfg)} ${mode(path.join(home, '.agent-board.json'))}`);
}

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
await finish(R, { board });
