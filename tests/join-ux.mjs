// join's questions and mistakes, in a sandboxed home folder (never the real one): an unreachable board,
// address typos, names that clash or get changed, tool typos, the plan and repo questions, exit codes.
// Starts its own throwaway board. Run all suites with: npm test
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { startBoard, finish, ROOT, TOKEN, tempDir } from './helpers.mjs';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const board = await startBoard();
const port = board.port;

const tmp = tempDir('agent-board-ju-');
const repo = path.join(tmp, 'hack');
const git = (...a) => spawnSync('git', a, { encoding: 'utf8' });
git('init', '-q', repo);
git('-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
const gitCfg = path.join(tmp, 'gitconfig');
fs.writeFileSync(gitCfg, '[user]\n\tname = Zed Quill\n\temail = z@q\n');

// Each "laptop" is its own home folder.
const envFor = (name, extra = {}) => {
  const home = path.join(tmp, name); fs.mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home, APPDATA: path.join(home, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(home, 'AppData', 'Local'), XDG_CONFIG_HOME: path.join(home, '.config'), GIT_CONFIG_GLOBAL: gitCfg, GIT_CONFIG_NOSYSTEM: '1', INIT_CWD: ROOT, ...extra };
  for (const k of ['GEMINI_CLI_HOME', 'CODEX_HOME', 'COPILOT_HOME', 'CLAUDE_CONFIG_DIR', 'AGENT_BOARD_JOIN_ASK', 'CLAUDE_BOARD_JOIN_ASK']) if (!(k in extra)) delete env[k];
  return { home, env };
};
const JOIN = path.join(ROOT, 'scripts', 'join.mjs');
const run = (env, args) => { const r = spawnSync(process.execPath, [JOIN, ...args], { cwd: ROOT, env, encoding: 'utf8', input: '', timeout: 90e3 }); return { ...r, out: `${r.stdout}${r.stderr}` }; };
const base = ['--tool', 'other', '--wait', '0'];

// ---- JOIN-1: an unreachable board stops join, unless --offline ----
const l1 = envFor('down');
const down = run(l1.env, ['--url', 'http://localhost:1', '--token', TOKEN, '--name', 'ann', ...base]);
check('unreachable board: exit 1, says so, nothing set up', down.status === 1 && /Can't reach the board at http:\/\/localhost:1/.test(down.out) && /Nothing was set up\. To set up anyway, add --offline/.test(down.out) && !fs.existsSync(path.join(l1.home, '.agent-board.json')), down.out.slice(-500));
const off = run(l1.env, ['--url', 'http://localhost:1', '--token', TOKEN, '--name', 'ann', '--offline', ...base]);
check('--offline sets up anyway, and exits 1 because doctor finds problems', off.status === 1 && /Setting up anyway \(--offline\)/.test(off.out) && fs.existsSync(path.join(l1.home, '.agent-board.json')), off.out.slice(-500));
check('summary: "1 problem" / "N problems", never "problem(s)"', /⚠ \d+ problems? above\./.test(off.out) && !/problem\(s\)/.test(off.out), (off.out.match(/⚠.*$/m) || [''])[0]);

// ---- the input ending at a question (Ctrl+D, a closed pipe): a plain message, not a Node warning with a stack ----
const lEof = envFor('eof');
const eof = spawnSync(process.execPath, [JOIN, '--url', board.base, '--token', TOKEN, '--wait', '0'], { cwd: ROOT, env: { ...lEof.env, AGENT_BOARD_JOIN_ASK: '1' }, encoding: 'utf8', input: '', timeout: 60e3 });
check('EOF at a question: says the input ended and nothing was set up, exit 1, no stack or Node warning', eof.status === 1 && /The input ended before every question was answered\. Nothing was set up/.test(eof.stderr) && !/unsettled|top-level await|\n\s+at /.test(eof.stderr) && !fs.existsSync(path.join(lEof.home, '.agent-board.json')), `${eof.status} ${eof.stderr.slice(-400)}`);

// ---- JOIN-2: address typos ----
const l2 = envFor('typos');
const noScheme = run(l2.env, ['--url', `localhost:${port}`, '--token', TOKEN, '--name', 'bea', ...base]);
check('no http://: added, and join works', noScheme.status === 0 && noScheme.out.includes(`using the board address http://localhost:${port}`) && noScheme.out.includes(`Web board:  http://localhost:${port}/?token=`), noScheme.out.slice(-400));
const pasted = run(l2.env, ['--url', `http://localhost:${port}/?token=${TOKEN}&name=bea`, '--name', 'bea', ...base]);
check('web board link pasted as --url (no --token): address and token taken from it', pasted.status === 0 && /board .*reachable at http:\/\/localhost:\d+\s/.test(pasted.out) && pasted.out.includes(`using the board address http://localhost:${port}`), pasted.out.slice(-400));
const https = run(l2.env, ['--url', `https://localhost:${port}`, '--token', TOKEN, '--name', 'bea', ...base]);
check('https on an http board: "This board uses http, not https" with the right address', https.status === 1 && https.out.includes(`This board uses http, not https. Try:  --url http://localhost:${port}`), https.out.slice(-400));

// ---- JOIN-14: a wrong token is explained as a changed token ----
const badTok = run(l2.env, ['--url', board.base, '--token', 'not-the-token', '--name', 'bea', ...base]);
check('wrong token: "the token changed", ask the host for the new join command', badTok.status === 1 && /the token changed \(the host rotated it, or started a fresh board\)\. Ask the host for the new join command/.test(badTok.out), badTok.out.slice(-300));

// ---- JOIN-4:a name already used on the board, even with no agent connected ----
// "vera" created a task from the web board; no agent called vera has connected.
await fetch(`${board.base}/api/tasks`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'X-Agent': 'vera', 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Seed task' }) });
const st = await (await fetch(`${board.base}/api/state`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
check('(setup) no agent called vera is connected', !st.presence.some((p) => p.kind === 'agent' && p.name === 'vera'), JSON.stringify(st.presence));
const l4 = envFor('clash');
const clash = run(l4.env, ['--url', board.base, '--token', TOKEN, '--name', 'Vera', ...base]);
check('join --name vera warns: already on this board', /"vera" is already on this board\. If that's someone else, re-run with a different --name/.test(clash.out), clash.out.slice(0, 600));
const again = run(l4.env, ['--url', board.base, '--token', TOKEN, '--name', 'vera', ...base]);
check('re-running join on the laptop that already joined as vera does not warn (its own name)', again.status === 0 && !/already on this board/.test(again.out), again.out.slice(0, 300));
const l4b = envFor('clean');
const free = run(l4b.env, ['--url', board.base, '--token', TOKEN, '--name', 'wendy', ...base]);
check('an unused name gets no warning', free.status === 0 && !/already on this board/.test(free.out), free.out.slice(0, 300));

// The board's names API (GET/POST /api/names/<name>), on a stub board: a name another laptop reserved
// (its agent not connected yet) is reported, and join reserves its own agent name with its laptop id.
const http = await import('node:http');
const seen = [];
const stub = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body });
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.url === '/api/state') return send(200, { presence: [], tasks: [], events: [], settings: {}, board: { name: 'Stub' } });
    const m = req.url.match(/^\/api\/names\/([^?]+)/);
    if (m && req.method === 'GET') return send(200, m[1] === 'vera' ? { name: 'vera', taken: true, holders: [{ agent: 'vera', person: 'vera', connected: false, online: false }] } : { name: m[1], taken: false, holders: [] });
    if (m && req.method === 'POST') return send(200, { name: m[1], taken: false, holders: [], reserved: true });
    send(404, { error: 'not found' });
  });
});
await new Promise((r) => stub.listen(0, r));
const stubUrl = `http://localhost:${stub.address().port}`;
const runAsync = (env, args) => new Promise((resolve) => {
  const p = spawn(process.execPath, [JOIN, ...args], { cwd: ROOT, env }); let out = '';
  p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
  p.stdin.end(); p.on('exit', (code) => resolve({ status: code, out }));
});
const ls = envFor('stub-a');
const viaApi = await runAsync(ls.env, ['--url', stubUrl, '--token', TOKEN, '--name', 'vera', ...base]);
check('names API: a name reserved by another laptop is reported', /"vera" is already on this board/.test(viaApi.out) && seen.some((s) => s.method === 'GET' && /^\/api\/names\/vera\?laptop=[a-z0-9]+$/.test(s.url)), viaApi.out.slice(0, 400));
const ls2 = envFor('stub-b');
seen.length = 0;
const reserve = await runAsync(ls2.env, ['--url', stubUrl, '--token', TOKEN, '--name', 'yuri', ...base]);
const post = seen.find((s) => s.method === 'POST' && s.url === '/api/names/yuri');
const pb = post ? JSON.parse(post.body) : {};
check('names API: join reserves its agent name with laptop and person', !!post && /^[a-z0-9]{8,16}$/.test(pb.laptop || '') && pb.person === 'yuri' && post.auth === `Bearer ${TOKEN}` && !/already on this board/.test(reserve.out), JSON.stringify(seen.map((s) => `${s.method} ${s.url} ${s.body}`)));
stub.close();
check('names API missing (this board answers 404): join still works, no warning for a free name', free.status === 0);

// ---- ONB-8:a changed name is announced ----
const l8 = envFor('rename');
const renamed = run(l8.env, ['--url', board.base, '--token', TOKEN, '--name', 'Host Person', ...base]);
check('"Host Person" → told: You\'ll appear as "hostperson"', /You'll appear as "hostperson"/.test(renamed.out) && /You're in as "hostperson"/.test(renamed.out), renamed.out.slice(0, 400));
const plain = run(l8.env, ['--url', board.base, '--token', TOKEN, '--name', 'Hostperson', ...base]);
check('only a change of case: no notice', !/You'll appear as/.test(plain.out));

// ---- answering the questions (piped answers; AGENT_BOARD_JOIN_ASK makes join ask without a terminal) ----
// steps: [prompt regex, answer]. Stops (kills join) after the last step when stopAfter is set.
function converse(env, args, steps, { stopAfter = false } = {}) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [JOIN, ...args], { cwd: ROOT, env: { ...env, AGENT_BOARD_JOIN_ASK: '1' } });
    let out = ''; let seen = 0; let i = 0;
    const timer = setTimeout(() => p.kill(), 60e3);
    const onData = (d) => {
      out += d;
      while (i < steps.length) {
        const m = out.slice(seen).match(steps[i][0]);
        if (!m) break;
        seen += m.index + m[0].length;
        const answer = steps[i][1];
        i++;
        if (answer === null) { p.kill(); return; }
        p.stdin.write(`${answer}\n`);
      }
      if (stopAfter && i >= steps.length) p.kill();
    };
    p.stdout.on('data', onData); p.stderr.on('data', onData);
    p.on('exit', (code) => { clearTimeout(timer); resolve({ code, out, answered: i }); });
  });
}
const l5 = envFor('ask');
// Clash prompt, the (y/N) default, a tool typo, no plan question for Copilot CLI.
const a1 = await converse(l5.env, ['--url', board.base, '--token', TOKEN, '--wait', '0'], [
  [/Your name on the board \(short, no spaces\) \[zed\]: /, 'vera'],
  [/Use "vera" anyway\? \(y\/N\): /, ''],
  [/Your name on the board[^\n]*: /, 'uma'],
  [/Tool\(s\), comma-separated[^\n]*: /, 'copilt-cli'],
  [/Tool\(s\), comma-separated[^\n]*: /, 'copilot-cli'],
  [/Path to your copy of the project repo[^\n]*: /, ''],
]);
check('name default is the git user name\'s first word ([zed])', /\[zed\]: /.test(a1.out), a1.out.slice(0, 200));
check('clash found in the interactive flow too, with where it was seen', /"vera" is already on this board \((on the web board|on a task|in the feed|reserved by another laptop[^)]*)\)/.test(a1.out), a1.out.slice(0, 500));
check('the y/N question shows its default once', /Use "vera" anyway\? \(y\/N\): /.test(a1.out) && !/\(y\/N\) \[N\]/.test(a1.out));
check('a tool typo asks again, suggesting the closest tool', /Did you mean copilot-cli\?/.test(a1.out) && (a1.out.match(/Tool\(s\), comma-separated/g) || []).length === 2, a1.out.slice(-1200));
check('no plan question for Copilot CLI (every plan is 1 task)', !/Which plan is/.test(a1.out));
check('the interactive join finishes as uma', /You're in as "uma"/.test(a1.out), `${a1.answered} answered\n${a1.out.slice(-600)}`);

// Claude Code: the plan defaults to Pro, the repo prompt says what a blank skips, the repo defaults to
// the folder join was started from. Stopped at the repo question, so nothing is set up for Claude.
const l6 = envFor('ask2', { INIT_CWD: repo });
const a2 = await converse(l6.env, ['--url', board.base, '--token', TOKEN, '--wait', '0', '--name', 'carl'], [
  [/Tool\(s\), comma-separated[^\n]*: /, 'claude'],
  [/Which plan is Claude Code on\?/, ''],
  [/Plan \[pro\]: /, ''],
  [/Path to your copy of the project repo[^\n]*: /, null],
]);
check('Claude plan question defaults to pro', /Plan \[pro\]: /.test(a2.out), a2.out.slice(-600));
check('Claude repo prompt: mentions pre-approving git/gh, defaults to the current folder\'s repo', /installs the auto-wake hook and pre-approves git\/gh there, so agents don't stall on permission prompts; blank to skip\) \[[^\]]*hack\]: /.test(a2.out), (a2.out.match(/Path to your copy.*$/m) || [''])[0]);

// ---- JOIN-10: the git/gh pre-approval line is short; --verbose lists the commands ----
// A fake `claude` first on PATH, so join's Claude Code setup runs without touching a real install.
const bin = path.join(tmp, 'bin'); fs.mkdirSync(bin);
fs.writeFileSync(path.join(bin, 'claude.cmd'), '@exit /b 0\r\n');
fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
const l10 = envFor('gitallow');
l10.env.PATH = `${bin}${path.delimiter}${l10.env.PATH || l10.env.Path || ''}`; delete l10.env.Path;
const short = run(l10.env, ['--url', board.base, '--token', TOKEN, '--name', 'gus', '--tool', 'claude', '--plan', 'pro', '--repo', repo, '--wait', '0']);
const settings = JSON.parse(fs.readFileSync(path.join(repo, '.claude', 'settings.local.json'), 'utf8'));
check('Claude: one plain line about git/gh, no command list', /✓ git and gh commands pre-approved \(no prompts when agents push or merge\)\. Skip with --no-git-allow/.test(short.out) && !/rev-parse/.test(short.out), (short.out.match(/.*pre-approved.*$/m) || [''])[0]);
check('Claude: the git rules are still written', settings.permissions.allow.includes('Bash(git push:*)'), JSON.stringify(settings.permissions.allow).slice(0, 200));
const verbose = run(l10.env, ['--url', board.base, '--token', TOKEN, '--name', 'gus', '--tool', 'claude', '--plan', 'pro', '--repo', repo, '--wait', '0', '--verbose']);
check('--verbose lists the git/gh commands and the force-push note', /git fetch, switch, .*rev-parse, remote; gh pr, run, auth status, repo view\. Force pushes are discouraged, not prevented/.test(verbose.out), (verbose.out.match(/^ {4}git .*$/m) || [''])[0]);

// ---- the command line: values that look like options, --key=value, agent and viewer tokens, odd paths ----
// About 1 board token in 4000 used to start with "--" (base64url), and join read it as the next option.
const dash = await startBoard({ token: '--dash-tok-1234567' });
const l11 = envFor('dashes');
const dashed = run(l11.env, ['--url', dash.base, '--token', '--dash-tok-1234567', '--name', 'hal', ...base]);
check('a token that starts with "--" is taken as the token', dashed.status === 0 && /You're in as "hal"/.test(dashed.out), dashed.out.slice(-400));
const eqs = run(l11.env, [`--url=${dash.base}`, '--token=--dash-tok-1234567', '--name=hal', '--tool=other', '--wait=0']);
check('--key=value works for every option', eqs.status === 0 && /You're in as "hal"/.test(eqs.out), eqs.out.slice(-400));
const agentTok = JSON.parse(fs.readFileSync(path.join(l11.home, '.agent-board.json'), 'utf8')).token;
const l12 = envFor('agenttok');
const withAgent = run(l12.env, ['--url', dash.base, '--token', agentTok, '--name', 'ivy', ...base]);
const ivyCfg = JSON.parse(fs.readFileSync(path.join(l12.home, '.agent-board.json'), 'utf8'));
check('an agent token is used as it is (not derived again): the agents connect', withAgent.status === 0 && /^agent-/.test(agentTok) && ivyCfg.token === agentTok && ivyCfg.agents.every((a) => a.token === agentTok) && /ask the host for the link/.test(withAgent.out), withAgent.out.slice(-400));
const viewTok = (await (await fetch(`${dash.base}/api/state`, { headers: { Authorization: `Bearer ${dash.token}` } })).json()).setup.viewer_token;
const withView = run(envFor('viewtok').env, ['--url', dash.base, '--token', viewTok, '--name', 'jo', ...base]);
check('the presenter view\'s token is refused with a clear message', withView.status === 1 && /read-only token: it can't connect agents/.test(withView.out), withView.out.slice(-300));
await dash.stop();
// Commands run without a shell: a repo path with spaces, & and $(…) is just a path.
const oddRepo = path.join(tmp, 'odd $(touch PWNED) & dir');
git('init', '-q', oddRepo);
git('-C', oddRepo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
const odd = run(envFor('oddpath', { PATH: l10.env.PATH }).env, ['--url', board.base, '--token', TOKEN, '--name', 'kit', '--tool', 'claude,other', '--plan', 'claude=pro', '--repo', oddRepo, '--wait', '0']);
check('a repo path with spaces, & and $(…) works and runs nothing', /connected Claude Code to the board/.test(odd.out) && /created its own worktree/.test(odd.out) && fs.existsSync(`${oddRepo}-other`) && !fs.existsSync(path.join(ROOT, 'PWNED')) && !fs.existsSync(path.join(tmp, 'PWNED')) && !fs.existsSync(path.join(oddRepo, 'PWNED')), odd.out.slice(-500));

// The sibling folder for a second tool: its own checkout of the same repo is reused, but an unrelated git repo that
// happens to have that name is not (it would get this agent's token and hooks).
const sameAgain = run(envFor('oddagain', { PATH: l10.env.PATH }).env, ['--url', board.base, '--token', TOKEN, '--name', 'kit', '--tool', 'claude,other', '--plan', 'claude=pro', '--repo', oddRepo, '--wait', '0']);
check('join: the generated sibling folder that is a checkout of the same repo is reused', /using existing worktree/.test(sameAgain.out) && !/different git repo/.test(sameAgain.out), sameAgain.out.slice(-400));
const twinRepo = path.join(tmp, 'twin');
git('init', '-q', twinRepo);
git('-C', twinRepo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
const strangerRepo = `${twinRepo}-other`;
git('init', '-q', strangerRepo);
git('-C', strangerRepo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'other project');
const siblingClash = run(envFor('twin', { PATH: l10.env.PATH }).env, ['--url', board.base, '--token', TOKEN, '--name', 'lou', '--tool', 'claude,other', '--plan', 'claude=pro', '--repo', twinRepo, '--wait', '0']);
check('join: a sibling folder that is an unrelated git repo is refused, not adopted', /already exists but is a checkout of a different git repo/.test(siblingClash.out) && !/using existing worktree/.test(siblingClash.out) && siblingClash.status === 1, siblingClash.out.slice(-500));

// Windows: a .cmd that isn't an npm shim runs through cmd.exe, which replaces %NAME% even inside quotes. An argument
// that would pick up a variable is refused; a URL's %C3%A9 (no such variable) still passes. Elsewhere nothing is parsed.
const cmdBin = path.join(tmp, 'cmdbin'); fs.mkdirSync(cmdBin);
fs.writeFileSync(path.join(cmdBin, 'fakecli.cmd'), '@echo %*\r\n');
const viaRun = (arg) => spawnSync(process.execPath, ['--input-type=module', '-e',
  `import { runSync } from ${JSON.stringify(new URL('../scripts/lib/run.mjs', import.meta.url).href)};\ntry { const r = runSync('fakecli', [process.env.ARG]); process.stdout.write('RAN:' + r.stdout); } catch (e) { process.stdout.write('ERR:' + e.message); }`],
  { env: { ...process.env, PATH: `${cmdBin}${path.delimiter}${process.env.PATH || process.env.Path || ''}`, ARG: arg, SECRET_VALUE_X: 'leaked' }, encoding: 'utf8', windowsHide: true });
if (process.platform === 'win32') {
  const expand = viaRun('http://h/%SECRET_VALUE_X%/mcp').stdout;
  const plain = viaRun('http://h/?name=Jos%C3%A9&p=%25').stdout;
  check('a .cmd tool run through cmd.exe: an argument that would expand %NAME% is refused, not expanded', /^ERR:.*%SECRET_VALUE_X%/.test(expand) && !/leaked/.test(expand), expand);
  check('a .cmd tool run through cmd.exe: a URL with %C3%A9 and %25 still goes through unchanged', /^RAN:.*Jos%C3%A9&p=%25/.test(plain), plain);
  // cmd's dynamic variables aren't in the environment but expand all the same (any case).
  const dynamic = ['%CD%', '%date%', '%Time%', '%RANDOM%', '%ERRORLEVEL%', '%CMDEXTVERSION%', '%CMDCMDLINE%', '%HIGHESTNUMANODENUMBER%', '%__CD__%', '%__appdir__%', '%random:~0,2%']
    .map((v) => [v, viaRun(`http://h/${v}/mcp`).stdout]).filter(([v, out]) => !(out.startsWith('ERR:') && out.includes(v.split(':')[0].replace(/%$/, '') + '%')));
  check('a .cmd tool run through cmd.exe: the dynamic variables (%CD%, %DATE%, %RANDOM%, %__APPDIR__%…) are refused too', !dynamic.length, JSON.stringify(dynamic));
}

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
await finish(R, { board });
