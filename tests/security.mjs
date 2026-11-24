// Security checks from the Round 4 review: the repo setting can't carry a git option or shell characters (server
// and join), and the other hardening of the server. Starts its own throwaway boards. Run all suites with: npm test
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startBoard, finish, ROOT, TOKEN, tempDir } from './helpers.mjs';
import { isRepoUrl } from '../src/repo-url.js';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + x : ''}`);
const board = await startBoard();
const api = (p, { method = 'GET', body, token = board.token, who = 'dana', headers = {} } = {}) => fetch(`${board.base}/api${p}`, {
  method, headers: { Authorization: `Bearer ${token}`, ...(who ? { 'X-Agent': who } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

try {
  // ---- H1: the repo setting is a plain git address ----
  {
    const good = ['https://github.com/team/vote-app', 'https://github.com/team/vote-app.git', 'git@github.com:team/app.git', 'ssh://git@host.example:2222/x/y', 'file:///C:/work/app', 'team/app', ''];
    const bad = ['--upload-pack=touch PWNED;', '-c', '--upload-pack=x', 'https://x/$(id)', 'https://x/`id`', 'https://x/a;b', 'https://x/a b', 'https://x/a\nb', "https://x/a'b", 'ext::sh', 'git@-oProxyCommand=x:y', 'git@host:-x', 'https://-x/y', 'https://x/a|b', 'https://x/a&b'];
    check('H1: isRepoUrl accepts git addresses', good.every(isRepoUrl), good.filter((g) => !isRepoUrl(g)).join(' '));
    check('H1: isRepoUrl refuses options, shell characters and control characters', !bad.some(isRepoUrl), bad.filter(isRepoUrl).join(' '));
    const r = await api('/settings', { method: 'PUT', body: { repo: '--upload-pack=touch PWNED;' } });
    const j = await r.json();
    check('H1: the server refuses a repo that is a git option', r.status === 400 && /git address/.test(j.error || ''), `${r.status} ${JSON.stringify(j)}`);
    const r2 = await api('/settings', { method: 'PUT', body: { repo: 'https://x.example/$(touch$IFS/tmp/p)' } });
    check('H1: …and one with shell characters', r2.status === 400, String(r2.status));
    const r3 = await api('/settings', { method: 'PUT', body: { repo: 'https://github.com/team/vote-app' } });
    check('H1: a normal repo address is saved', r3.status === 200 && (await r3.json()).repo === 'https://github.com/team/vote-app', String(r3.status));
  }

  // ---- H1: join never runs git clone on a board's bad repo value (a board from before the fix, or a hostile one) ----
  {
    const name = `ab-sec-h1-${process.pid}`;
    const evil = `--upload-pack=touch ${name}-PWNED;`;
    const fake = http.createServer((req, res) => {
      const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.url.startsWith('/api/state')) return send(200, { board: { name: 'Hack', slug: 'hack' }, settings: { goal: 'ship it', repo: evil }, presence: [], tasks: [], events: [] });
      if (req.url.startsWith('/health')) return send(200, { app: 'agent-board', version: 'x' });
      if (req.url.startsWith('/mcp')) return send(200, { jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'get_playbook' }] } });
      send(404, {});
    });
    await new Promise((r) => fake.listen(0, '127.0.0.1', r));
    const tmp = tempDir('agent-board-sec-');
    const home = path.join(tmp, 'home'); fs.mkdirSync(home);
    const cwd = path.join(tmp, 'cwd'); fs.mkdirSync(cwd);
    const env = { ...process.env, HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home, AGENT_BOARD_JOIN_ASK: '1', GIT_CONFIG_NOSYSTEM: '1' };
    delete env.INIT_CWD;
    const out = await new Promise((resolve) => {
      const j = spawn(process.execPath, [path.join(ROOT, 'scripts', 'join.mjs'), '--url', `http://127.0.0.1:${fake.address().port}`, '--token', TOKEN, '--name', 'victim', '--tool', 'other', '--offline'], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
      let text = '';
      const on = (d) => { const s = String(d); text += s; if (/: $/.test(s)) j.stdin.write('\n'); };
      j.stdout.on('data', on); j.stderr.on('data', on);
      const t = setTimeout(() => j.kill(), 60e3);
      j.on('exit', () => { clearTimeout(t); resolve(text); });
    });
    fake.close();
    const sibling = path.resolve(ROOT, '..', evil);
    const pwned = [cwd, ROOT, path.dirname(ROOT)].some((d) => fs.existsSync(path.join(d, `${name}-PWNED`)));
    for (const d of [ROOT, path.dirname(ROOT)]) { try { fs.rmSync(path.join(d, `${name}-PWNED`), { force: true }); } catch {} }
    check('H1: join skips a repo setting that is a git option, says so, and runs nothing', !pwned && !fs.existsSync(sibling) && /isn't a plain git address/.test(out) && !/git clone failed/.test(out), out.slice(-800));
  }
} catch (e) {
  check('suite ran without throwing', false, e?.stack || String(e));
}

await finish(R, { board });
