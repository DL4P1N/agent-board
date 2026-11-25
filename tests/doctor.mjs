// npm run doctor (and the doctor run at the end of join), in a sandboxed home folder (never the real one):
// it checks the tool the user picked, re-shows the "other" address, says "All good" only when it means it,
// and explains a rotated token. Starts its own throwaway board. Run all suites with: npm test
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { startBoard, finish, ROOT, TOKEN, tempDir } from './helpers.mjs';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const board = await startBoard();

const tmp = tempDir('agent-board-doc-');
const home = path.join(tmp, 'home'); fs.mkdirSync(home);
const env = { ...process.env, HOME: home, USERPROFILE: home, APPDATA: path.join(home, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(home, 'AppData', 'Local'), XDG_CONFIG_HOME: path.join(home, '.config') };
for (const k of ['GEMINI_CLI_HOME', 'CODEX_HOME', 'COPILOT_HOME', 'CLAUDE_CONFIG_DIR']) delete env[k];
const cfgPath = path.join(home, '.agent-board.json');
const join = (...extra) => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'join.mjs'), '--url', board.base, '--token', TOKEN, '--name', 'Vera', '--wait', '0', ...extra], { cwd: ROOT, env, encoding: 'utf8', input: '', timeout: 90e3 });
  return { ...r, out: `${r.stdout}${r.stderr}` };
};
const doctor = () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.mjs')], { cwd: ROOT, env, encoding: 'utf8', timeout: 60e3 });
  return { ...r, out: `${r.stdout}${r.stderr}` };
};
const onPath = (bin) => spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' }).status === 0;

// ---- JOIN-3: Copilot in VS Code without a repo: doctor checks Copilot, not Claude Code ----
const j1 = join('--tool', 'copilot-vscode');
const cfg1 = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
check('JOIN-3: a tool whose setup failed stays in the config', cfg1.agents?.map((a) => a.tool).join(',') === 'copilot-vscode', JSON.stringify(cfg1.agents));
check('JOIN-3: doctor checks Copilot in VS Code and says it needs a repo', /Copilot in VS Code \(as "vera"\)/.test(j1.out) && /set up per repo, and no repo was given/.test(j1.out) && /--repo/.test(j1.out), j1.out.slice(j1.out.indexOf('Checking')));
check('JOIN-3: doctor doesn\'t mention Claude Code', !/Claude Code/.test(j1.out.slice(j1.out.indexOf('Checking'))) && !/\.claude[\\/]commands/.test(j1.out), j1.out.slice(j1.out.indexOf('Checking')));
check('JOIN-3: doctor reports the problem (exit 1)', doctor().status === 1);

// An empty agents list (nothing set up): no guessed tool.
fs.writeFileSync(cfgPath, JSON.stringify({ ...cfg1, agents: [] }));
const d0 = doctor();
check('JOIN-3: empty agents list → "No AI tool is set up", not Claude Code', d0.status === 1 && /No AI tool is set up on this laptop yet/.test(d0.out) && !/Claude Code/.test(d0.out), d0.out);

// ---- JOIN-9 + JOIN-8: "other" ----
fs.rmSync(cfgPath); // each case on its own: a fresh laptop
const j2 = join('--tool', 'other');
const d2 = doctor();
const other = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).agents.find((a) => a.tool === 'other');
const joinUrl = j2.out.match(/url: {2}(\S+)/)?.[1] || '';
check('JOIN-9: doctor shows the "other" tool\'s MCP server again (name, type, url)', /name: board/.test(d2.out) && /type: http/.test(d2.out) && d2.out.includes(`url:  ${board.base}/mcp?agent=vera&token=${other?.token}`), d2.out);
check('JOIN-9: same address join printed', joinUrl && d2.out.includes(`url:  ${joinUrl}`), `${joinUrl}\n${d2.out}`);
check('JOIN-8: "other" ends with "Next: add the server…", not "All good"', d2.status === 0 && /Next: add the server shown above to your tool\./.test(d2.out) && !/All good/.test(d2.out), d2.out.slice(-400));

// Doctor's connection check sends this laptop's id (laptop=) and its person, as the agent itself does, so the board's
// one-name-one-laptop rule applies to the check too: seen by a stub board that records what doctor asks for.
{
  const cfgL = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const seen = [];
  // /health and /api/state answer like a board, so doctor goes on to its connection check (the /mcp request).
  const stub = http.createServer((req, res) => {
    seen.push(req.url);
    const ok = req.url === '/health' ? { ok: true, version: 'unknown' } : req.url === '/api/state' ? { board: { slug: 'main', name: 'Main' } } : null;
    res.writeHead(ok ? 200 : 401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(ok || { error: 'stub' }));
  });
  await new Promise((r) => stub.listen(0, '127.0.0.1', r));
  const stubUrl = `http://127.0.0.1:${stub.address().port}`;
  fs.writeFileSync(cfgPath, JSON.stringify({ ...cfgL, url: stubUrl, agents: cfgL.agents.map((a) => ({ ...a, url: stubUrl })) }));
  await new Promise((r) => { const c = spawn(process.execPath, [path.join(ROOT, 'scripts', 'doctor.mjs')], { cwd: ROOT, env, stdio: 'ignore' }); c.on('exit', r); setTimeout(() => { c.kill(); r(); }, 60e3); });
  await new Promise((r) => stub.close(r));
  fs.writeFileSync(cfgPath, JSON.stringify(cfgL));
  const probe = seen.find((u) => u.startsWith('/mcp?')) || '';
  const q = new URLSearchParams(probe.split('?')[1] || '');
  check('doctor\'s connection check sends this laptop\'s id and person (laptop=, person=), with probe=1', /^[a-z0-9]{8,16}$/.test(cfgL.laptop_id || '') && q.get('laptop') === cfgL.laptop_id && q.get('person') === cfgL.person && q.get('probe') === '1', `${cfgL.laptop_id} ${cfgL.person} ${JSON.stringify(seen)}`);
}

// ---- JOIN-8: a command-line tool that isn't installed ----
fs.rmSync(cfgPath);
const j3 = join('--tool', 'gemini');
const d3 = doctor();
if (onPath('gemini')) check('JOIN-8: gemini installed → All good', /All good/.test(d3.out), d3.out.slice(-400));
else check('JOIN-8: gemini not installed → "Ready once you install gemini", not "All good"', d3.status === 0 && /`gemini` isn't installed yet/.test(d3.out) && /Ready once you install gemini \(npm i -g @google\/gemini-cli\)\./.test(d3.out) && !/All good/.test(d3.out), d3.out.slice(-500));
check('JOIN-8: the start line is still shown', /Gemini CLI\s+in your project repo: open Gemini CLI there/.test(d3.out), j3.out.slice(-300));

// ---- JOIN-14: a rotated token ----
const cfg4 = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
for (const a of cfg4.agents) a.token = 'rotated-away';
fs.writeFileSync(cfgPath, JSON.stringify(cfg4));
const d4 = doctor();
check('JOIN-14: a rejected token says it changed (rotated or a new board) and to ask the host', d4.status === 1 && /The board's token changed \(the host rotated it or started a new board\)\. Ask the host for the new join command and run it\./.test(d4.out) && !/started a fresh board/.test(d4.out), d4.out);

// ---- a board whose /health answers but /api/state fails (a 500): not "reachable" ----
{
  const health = await (await fetch(`${board.base}/health`)).text();
  const fake = http.createServer((req, res) => {
    if (req.url === '/health') { res.setHeader('Content-Type', 'application/json'); res.end(health); return; }
    res.statusCode = 500; res.end('{"error":"boom"}');
  });
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  const fakeUrl = `http://127.0.0.1:${fake.address().port}`;
  const cfg5 = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  cfg5.url = fakeUrl; for (const a of cfg5.agents) { a.url = fakeUrl; a.token = TOKEN; }
  fs.writeFileSync(cfgPath, JSON.stringify(cfg5));
  // Not spawnSync: the fake board answers from this process.
  const d5 = await new Promise((resolve) => {
    const c = spawn(process.execPath, [path.join(ROOT, 'scripts', 'doctor.mjs')], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; });
    c.on('close', (status) => resolve({ status, out }));
  });
  fake.close();
  check('a board whose /api/state fails is not reported reachable', d5.status === 1 && !/reachable at/.test(d5.out) && /500/.test(d5.out), `${d5.status} ${d5.out}`);
}

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
await finish(R, { board });
