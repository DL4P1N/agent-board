// Security checks from the Round 4 review: the repo setting can't carry a git option or shell characters (server
// and join), and the other hardening of the server. Starts its own throwaway boards. Run all suites with: npm test
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { startBoard, finish, ROOT, TOKEN, tempDir, agent } from './helpers.mjs';
import { isRepoUrl } from '../src/repo-url.js';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + x : ''}`);
const ADMIN = 'admin-' + 'x'.repeat(24);
const board = await startBoard({ env: { BOARD_ADMIN_TOKEN: ADMIN } });
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

  // ---- M1: gh is only asked about PR links on github.com or the project repo's host ----
  {
    const { pollablePr, startGithubPolling } = await import('../src/github.js');
    const repo = 'https://ghe.example.com/team/app';
    const ok = ['https://github.com/o/r/pull/7', 'https://www.github.com/o/r/pull/7/', 'https://ghe.example.com/team/app/pull/3'];
    const no = ['https://127.0.0.1:4443/o/r/pull/1', 'https://evil.example/o/r/pull/1', 'http://github.com/o/r/pull/1', 'https://github.com.evil.example/o/r/pull/1',
      'https://user@github.com/o/r/pull/1', 'https://github.com:8443/o/r/pull/1', 'https://gitlab.com/o/r/-/merge_requests/1', 'https://github.com/o/r/pull/1/../../../x', 'not a url'];
    check('M1: PR links on github.com or the repo\'s host are polled', ok.every((u) => pollablePr(u, repo)), ok.filter((u) => !pollablePr(u, repo)).join(' '));
    check('M1: PR links on any other host, port, user or scheme are not', !no.some((u) => pollablePr(u, repo)), no.filter((u) => pollablePr(u, repo)).join(' '));
    check('M1: without a repo setting only github.com counts', !pollablePr('https://ghe.example.com/team/app/pull/3', '') && pollablePr('https://github.com/o/r/pull/7', ''));

    // One PR poll in this process, with a fake gh first on PATH that logs what it was asked.
    const bin = tempDir('agent-board-fakegh-');
    fs.copyFileSync(path.join(ROOT, 'tests', 'fixtures', 'fake-gh.cjs'), path.join(bin, 'fake-gh.cjs'));
    const st = path.join(bin, 'state.json'); const log = path.join(bin, 'calls.log');
    fs.writeFileSync(st, JSON.stringify({ auth: true, prs: {} }));
    const saved = { ...process.env };
    const pathKey = Object.keys(process.env).find((k) => k.toLowerCase() === 'path') || 'PATH';
    if (process.platform === 'win32') {
      const exe = path.join(bin, 'gh.exe');
      try { fs.linkSync(process.execPath, exe); } catch { fs.copyFileSync(process.execPath, exe); }
      process.env.NODE_OPTIONS = `--require "${path.join(bin, 'fake-gh.cjs').split(path.sep).join('/')}"`;
    } else {
      fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\nexec "${process.execPath}" "${path.join(bin, 'fake-gh.cjs')}" "$@"\n`, { mode: 0o755 });
    }
    Object.assign(process.env, { FAKE_GH_STATE: st, FAKE_GH_LOG: log, [pathKey]: bin + path.delimiter + (saved[pathKey] || '') });
    const urls = [...no, 'https://github.com/o/r/pull/7'];
    let tick = null;
    const fakeBoard = { listTasks: () => urls.map((u, i) => ({ id: i + 1, pr_url: u, status: 'review', assignee: 'ana' })), prStatus: new Map(), mainCi: null, emit() {}, getSettings: () => ({ repo: '' }) };
    const poll = startGithubPolling({ board: fakeBoard, announced: { has: () => true, add() {} }, rawSetting: () => null, putSetting() {}, isClosed: () => false, presence() {}, every() {}, later: (fn) => { tick ??= fn; } });
    await tick?.();
    poll.stop();
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    let asked = []; try { asked = fs.readFileSync(log, 'utf8').split('\n').filter((l) => l.startsWith('["pr","view"')).map((l) => JSON.parse(l)[2]); } catch {}
    check('M1: the PR poll asks gh about the github.com link only', asked.length === 1 && asked[0] === 'https://github.com/o/r/pull/7', JSON.stringify(asked));
  }

  // ---- M5: a request without a valid token is refused before its body is read ----
  {
    const big = '{"x":"' + 'a'.repeat(1.5e6) + '"';  // not even valid JSON: reading it would say so (400)
    const post = (p, token) => fetch(`${board.base}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: big });
    const a = await post('/api/messages'); const b = await post('/mcp?agent=x'); const c = await post('/api/messages', 'wrong-token');
    check('M5: a tokenless or wrong-token POST is refused (401) without its body being parsed', [a, b, c].every((r) => r.status === 401), [a, b, c].map((r) => r.status).join());
    const d = await post('/api/messages', board.token);
    check('M5: with the token the body is still read (and bad JSON is a 400)', d.status === 400, String(d.status));
  }

  // ---- L1: the admin API slows down guesses; a short BOARD_ADMIN_TOKEN is refused ----
  {
    const adm = (token, ip) => fetch(`${board.base}/api/admin/boards`, { headers: { 'X-Admin-Token': token, 'CF-Connecting-IP': ip } });
    const st = [];
    for (let i = 0; i < 12; i++) st.push((await adm(`wrong-${i}`, '198.51.100.70')).status);
    check('L1: wrong admin tokens from one address: 10 a minute, then 429', st.slice(0, 10).every((x) => x === 401) && st.slice(10).every((x) => x === 429), st.join());
    check('L1: …which then has to wait even with the right token', (await adm(ADMIN, '198.51.100.70')).status === 429);
    check('L1: another address with the right token is served', (await adm(ADMIN, '198.51.100.71')).status === 200);
    const env = { ...process.env, BOARD_ADMIN_TOKEN: 'short', BOARD_DATA: path.join(tempDir('agent-board-sec-'), 'data'), PORT: '0', BOARD_NO_JOIN: '1' };
    delete env.BOARD_ALLOW_SHORT_TOKEN; delete env.BOARD_TOKEN;
    const r = spawnSync(process.execPath, [path.join(ROOT, 'src', 'server.js')], { env, encoding: 'utf8', timeout: 20e3 });
    check('L1: a server with a short BOARD_ADMIN_TOKEN refuses to start, saying why', r.status === 1 && /BOARD_ADMIN_TOKEN is too short/.test(r.stderr), `${r.status} ${r.stderr}`.slice(0, 300));
  }

  // ---- L2: lock and unlock calls are bounded, and so is the text of their events ----
  {
    const ag = await agent(board, 'locker');
    const many = Array.from({ length: 200 }, (_, i) => `src/${'d'.repeat(450)}/f${i}.js`);
    const locked = await ag('lock_files', { paths: many, reason: 'big refactor' });
    const events = await (await api('/events?since=0')).json();
    const ev = events.events.filter((e) => e.kind === 'lock').at(-1);
    check('L2: locking 200 long paths works, and its event names 10 of them and how many more', locked?.ok === true && ev && ev.text.length < 6000 && / and 190 more for /.test(ev.text), `${JSON.stringify(locked).slice(0, 200)} ${ev?.text.length}`);
    const tooMany = await ag('unlock_files', { paths: Array.from({ length: 5000 }, (_, i) => `x${i}`) });
    check('L2: unlocking more than 200 paths at once is refused', /at most 200 paths/.test(JSON.stringify(tooMany)), JSON.stringify(tooMany).slice(0, 200));
    const unlocked = await ag('unlock_files', { paths: many });
    const uev = (await (await api('/events?since=0')).json()).events.filter((e) => e.kind === 'unlock').at(-1);
    check('L2: unlocking them: the event text is short too', unlocked?.released?.length === 200 && uev && uev.text.length < 6000 && / and 190 more$/.test(uev.text), `${uev?.text.length}`);
  }

  // ---- L3: board answers are never cached ----
  {
    const st = await api('/state'); await st.arrayBuffer();
    const ex = await api('/export'); await ex.arrayBuffer();
    const bad = await fetch(`${board.base}/api/state`); await bad.arrayBuffer();
    const m = await fetch(`${board.base}/mcp?agent=cachecheck&token=${TOKEN}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }); await m.arrayBuffer();
    check('L3: /api and /mcp answers say Cache-Control: no-store (also a 401)', [st, ex, bad, m].every((r) => r.headers.get('cache-control') === 'no-store'), [st, ex, bad, m].map((r) => `${r.status}:${r.headers.get('cache-control')}`).join(' '));
  }
} catch (e) {
  check('suite ran without throwing', false, e?.stack || String(e));
}

await finish(R, { board });
