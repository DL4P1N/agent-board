// Server guards from the engineering review: role names limited to agent-name characters, reserved author names,
// one name one laptop before presence, questions written with their events, a second answer, case-insensitive
// unlock, ?plan= without slots, review bounces from the event's data, wrong-typed input, get_task's newest
// history, a slow webhook save racing a change, a newer database, and a short BOARD_TOKEN.
// Starts its own throwaway boards. Run all suites with: npm test
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import dnsp from 'node:dns/promises';
import { startBoard, finish, rest, tempDir, ROOT, Client, StreamableHTTPClientTransport } from './helpers.mjs';
import { agentTokenFor, writeTokenFile } from '../src/tokens.js';
import { startGithubPolling } from '../src/github.js';
import { Board } from '../src/board.js';
import { recap } from '../src/recap.js';
import { hiddenSettings } from '../src/board-settings.js';
import { setupNotifications } from '../src/notify.js';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + String(x).slice(0, 300) : ''}`);
const throwsWith = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(String(e.message)); } };

// ================= in this process: the board's own rules =================
{
  const b = new Board(tempDir());
  // Role names: agent-name characters only (the value is shown on every human's page), or "*" for the integrator.
  check('integrator with markup is refused', throwsWith(() => b.setSettings('dana', { integrator: '"><img src=x onerror=alert(1)>' }, { human: true }), /integrator/));
  check('planner with markup is refused', throwsWith(() => b.setSettings('dana', { planner: 'a b<c>' }, { human: true }), /planner/));
  check('…and nothing was saved', b.getSettings().integrator === '' && b.getSettings().planner === '');
  b.setSettings('dana', { integrator: '*', planner: 'Ana-Claude.2' }, { human: true });
  check('"*" and an agent name are still fine', b.getSettings().integrator === '*' && b.getSettings().planner === 'ana-claude.2', JSON.stringify(b.getSettings()));
  b.setSettings('dana', { integrator: '', planner: '' }, { human: true });
  check('clearing a role still works', b.getSettings().integrator === '' && b.getSettings().planner === '');

  // Questions: the row and its event go together.
  b.db.exec("CREATE TEMP TRIGGER no_answer_events BEFORE INSERT ON events WHEN NEW.kind = 'answer' BEGIN SELECT RAISE(ABORT, 'event insert failed'); END");
  const q = b.ask('ana', { question: 'Which colour?' });
  check('an answer whose event fails is not saved', throwsWith(() => b.answer('dana', q.question_id, 'blue'), /event insert failed/) && b.listQuestions({ open_only: true }).some((x) => x.id === q.question_id));
  b.db.exec('DROP TRIGGER no_answer_events');
  b.db.exec("CREATE TEMP TRIGGER no_question_events BEFORE INSERT ON events WHEN NEW.kind = 'question' BEGIN SELECT RAISE(ABORT, 'event insert failed'); END");
  const before = b.listQuestions().length;
  check('a question whose event fails is not saved', throwsWith(() => b.ask('ana', { question: 'Lost?' }), /event insert failed/) && b.listQuestions().length === before);
  b.db.exec('DROP TRIGGER no_question_events');

  // A second answer doesn't overwrite the first one the agent already got.
  b.answer('dana', q.question_id, 'blue');
  check('a second answer is refused', throwsWith(() => b.answer('emil', q.question_id, 'red'), /already answered/));
  const qa = b.listQuestions().find((x) => x.id === q.question_id);
  check('…and the first answer stays', qa.answer === 'blue' && qa.answered_by === 'dana', JSON.stringify(qa));
  check('…with one answer event', b.events({ limit: 1000 }).filter((e) => e.kind === 'answer').length === 1);

  // Unlock ignores case, like the conflict check.
  b.lockFiles('ana', { paths: ['src/A.js'] });
  const un = b.unlockFiles('ana', { paths: ['src/a.js'] });
  check('unlocking src/a.js releases the lock on src/A.js', JSON.stringify(un.released) === '["src/A.js"]' && !b.listLocks().length, JSON.stringify(un));
  b.lockFiles('ana', { paths: ['Lib/B.js'] });
  const un2 = b.unlockFiles('bob', { paths: ['lib/b.js'] });
  check('…and another agent\'s lock in another case is refused, not skipped', un2.refused.length === 1 && un2.refused[0].owner === 'ana', JSON.stringify(un2));

  // ?plan= without slots keeps the slots.
  b.touch('cara-claude', 'agent');
  b.setPlan('cara-claude', 'Max', '2');
  b.setPlan('cara-claude', 'Max 20x', undefined);
  const row = b.agentRow('cara-claude');
  check('a plan without slots keeps the slots', row.slots === 2 && row.plan === 'Max 20x', JSON.stringify({ plan: row.plan, slots: row.slots }));

  // Review bounces: from the move itself, not from words in a note.
  b.setSettings('dana', { goal: 'g' }, { human: true });
  const ta = b.createTask('dana', { title: 'Noted' }, { human: true });
  b.updateTask('dana', ta.id, { assignee: 'ana' }, { human: true });
  b.updateTask('ana', ta.id, { status: 'in_progress' });
  b.updateTask('ana', ta.id, { note: 'note to self: review → in_progress happens a lot' });
  b.updateTask('ana', ta.id, { status: 'review' });
  b.updateTask('ana', ta.id, { note: 'review → in_progress if CI fails' });
  b.updateTask('dana', ta.id, { status: 'done' }, { human: true });
  const tb = b.createTask('dana', { title: 'Bounced' }, { human: true });
  b.updateTask('dana', tb.id, { assignee: 'ana' }, { human: true });
  b.updateTask('ana', tb.id, { status: 'in_progress' });
  b.updateTask('ana', tb.id, { status: 'review' });
  b.updateTask('dana', tb.id, { status: 'in_progress', note: 'fix the tests' }, { human: true });
  check('a real send-back marks the task as sent back', b.wasSentBack(tb.id));
  b.updateTask('ana', tb.id, { status: 'review', note: 'fixed' });
  b.updateTask('dana', tb.id, { status: 'done' }, { human: true });
  check('a note with "review → in_progress" is not a bounce; a real send-back counts once', !b.rejectCounts()[ta.id] && b.rejectCounts()[tb.id] === 1, JSON.stringify(b.rejectCounts()));
  b.db.exec('UPDATE events SET ts = 1000000 + id * 60000');
  const slow = recap(b, { since: 1 }).slowest;
  const bounces = Object.fromEntries(slow.map((x) => [x.id, x.bounces]));
  check('…the same in the recap', bounces[ta.id] === 0 && bounces[tb.id] === 1, JSON.stringify(slow));
  const sent = b.retro().match(/## Sent back from review[\s\S]*?(\n## |$)/)?.[0] || '';
  check('…and in the retro', sent.includes(`#${tb.id} `) && !sent.includes(`#${ta.id} `), sent);
  // The stats need three tasks done: a third one, never sent back.
  const tc = b.createTask('dana', { title: 'Straight through' }, { human: true });
  b.updateTask('dana', tc.id, { status: 'done', assignee: 'ana', force: true }, { human: true });
  const stats = b.computeTaskStats();
  check('…and in the task stats (3 done, 1 sent back)', stats?.done === 3 && stats.bounce_rate === 0.33, JSON.stringify(stats));
  b.close();

  // A database from a newer version of the board isn't opened.
  const dir = tempDir();
  const nb = new Board(dir); nb.close();
  const d = new DatabaseSync(path.join(dir, 'board.db')); d.exec('PRAGMA user_version = 99'); d.close();
  let err = '';
  try { new Board(dir).close(); } catch (e) { err = String(e.message); }
  check('a database with a newer schema version is refused with a clear message', /newer version of Agent Board/.test(err), err || 'it opened');
}

// ================= text limits, review waits, lock wording, hidden settings, the token file, board.pid =================
{
  const b = new Board(tempDir());
  b.setSettings('dana', { goal: 'Limits' }, { human: true });
  // Text limits are the board's, not only the MCP tools' (a human's 1.5 MB paste went out in every /api/state).
  const long = 'x'.repeat(10001);
  const t = b.createTask('dana', { title: 'Limits' }, { human: true });
  b.updateTask('dana', t.id, { assignee: 'ana' }, { human: true });
  b.touch('ana', 'agent');
  const q = b.ask('ana', { question: 'Which?' });
  const refused = {
    message: () => b.post('dana', { text: long }, { human: true }),
    direct: () => b.post('dana', { text: long, to: 'ana' }, { human: true }),
    question: () => b.ask('ana', { question: long }),
    answer: () => b.answer('dana', q.question_id, long),
    note: () => b.updateTask('ana', t.id, { note: long }),
    branch: () => b.updateTask('ana', t.id, { branch: 'b'.repeat(201) }),
    goal: () => b.setSettings('dana', { goal: long }, { human: true }),
    channel: () => b.post('dana', { text: 'hi', channel: 'c'.repeat(41) }, { human: true }),
    'reserved_for markup': () => b.createTask('dana', { title: 'r', reserved_for: '<img src=x onerror=alert(1)>' }, { human: true }),
  };
  const passed = Object.entries(refused).filter(([, fn]) => !throwsWith(fn, /too long|reserved_for must be/)).map(([k]) => k);
  check('text over the limits is refused by the board itself (messages, notes, questions, answers, goal, branch, channel, reserved_for)', !passed.length, passed.join(', '));
  check('…text at the limit is fine', b.post('dana', { text: 'y'.repeat(10000) }, { human: true }).text.length === 10000 && b.updateTask('ana', t.id, { note: 'z'.repeat(10000) }).id === t.id);
  check('…and wrong-typed message fields are refused, not passed to SQLite', throwsWith(() => b.post('dana', { text: 'x', channel: {} }, { human: true }), /channel must be/) && throwsWith(() => b.post('dana', { text: 'x', task_id: true }, { human: true }), /task_id must be/) && throwsWith(() => b.updateTask('ana', t.id, { branch: true }), /branch must be text/));
  check('…a task number as text still works', b.post('dana', { text: 'about it', task_id: String(t.id) }, { human: true }).task_id === t.id);

  // The feed's lock message in minutes, as the File locks panel says it.
  b.lockFiles('ana', { paths: ['src/x.js'] });
  const lockText = b.events({ limit: 1000 }).filter((e) => e.kind === 'lock').at(-1)?.text;
  check('a lock says "for 15 min" in the feed, not "for 900s"', lockText === 'locked src/x.js for 15 min', lockText);

  // getSettings reads the board's own settings only: the hidden rows grow with history (one per PR commit and outcome).
  const { putSetting, announced } = hiddenSettings(b);
  b.db.prepare("INSERT INTO settings (key, value) VALUES ('legacy', 'x')").run();
  check('getSettings returns only the known settings', !('legacy' in b.getSettings()) && b.getSettings().goal === 'Limits', JSON.stringify(b.getSettings()));
  // A task done: its PR's "already told" marks go; another PR's stay.
  const pr = 'https://github.com/o/r_x/pull/1';
  for (const k of [`_pr_told_${pr}_abc_fail_null`, `_pr_conflict_${pr}_abc`, `_pr_told_${pr}2_abc_fail_null`, '_notify_url']) putSetting(k, '1');
  const poll = startGithubPolling({ board: b, announced, rawSetting: () => null, putSetting, isClosed: () => false, presence() {}, every() {}, later() {} });
  b.updateTask('ana', t.id, { status: 'in_progress' });
  b.updateTask('ana', t.id, { status: 'review', pr_url: pr });
  b.updateTask('dana', t.id, { status: 'done' }, { human: true });
  poll.stop();
  const hidden = b.db.prepare("SELECT key FROM settings WHERE key LIKE '\\_%' ESCAPE '\\' ORDER BY key").all().map((r) => r.key);
  check('a done task\'s PR marks are pruned, others kept', hidden.join() === ['_notify_url', `_pr_told_${pr}2_abc_fail_null`].join(), hidden.join());
  b.close();

  // review_wait_min: from the move to review, not from a later note while in review.
  const w = new Board(tempDir());
  for (const title of ['w1', 'w2', 'w3']) {
    const x = w.createTask('dana', { title }, { human: true });
    w.updateTask('dana', x.id, { assignee: 'ana' }, { human: true });
    w.updateTask('ana', x.id, { status: 'in_progress' });
    w.updateTask('ana', x.id, { status: 'review' });
    w.updateTask('ana', x.id, { note: 'CI still running' });
    w.updateTask('dana', x.id, { status: 'done' }, { human: true });
  }
  w.db.exec('UPDATE events SET ts = id * 600000'); // 10 minutes apart: review → note → done is 20 minutes
  const ws = w.computeTaskStats();
  check('review_wait_min counts from the move to review', ws?.review_wait_min === 20, JSON.stringify(ws));
  w.close();

  // A token file whose rename fails (here: a folder in the way) leaves no temp copy of the token.
  const td = tempDir();
  const target = path.join(td, 'token');
  fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'x'), '');
  check('writeTokenFile: a failed rename throws and leaves no temp file', throwsWith(() => writeTokenFile(target, 'secret'), /./) && !fs.readdirSync(td).some((f) => f.endsWith('.tmp')), fs.readdirSync(td).join());

  // board.pid with this pid but another server's mark (two containers on one volume are both pid 1): not ours.
  const pidData = tempDir();
  const script = `
    import fs from 'node:fs'; import path from 'node:path';
    const { takePid, dropPid } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, 'src', 'pidfile.js')).href)});
    const pf = path.join(process.env.BOARD_DATA, 'board.pid');
    fs.writeFileSync(pf, JSON.stringify({ pid: process.pid, id: 'other-container', port: 1, started: new Date().toISOString() }));
    const owner = await takePid();
    dropPid();
    const kept = JSON.parse(fs.readFileSync(pf, 'utf8')).id;
    fs.unlinkSync(pf);
    const free = await takePid();
    const mine = JSON.parse(fs.readFileSync(pf, 'utf8'));
    dropPid();
    console.log(JSON.stringify({ owner: owner?.id, kept, free, mine: mine.pid === process.pid && !!mine.id, dropped: !fs.existsSync(pf) }));`;
  const pr1 = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, BOARD_DATA: pidData }, encoding: 'utf8', timeout: 15000 });
  let pidOut = {}; try { pidOut = JSON.parse(pr1.stdout.trim().split('\n').at(-1)); } catch {}
  check('board.pid under our pid with another server\'s id is another owner (not taken, not deleted)', pidOut.owner === 'other-container' && pidOut.kept === 'other-container', pr1.stdout + pr1.stderr);
  check('…our own board.pid carries our id and is removed on stop', pidOut.free === null && pidOut.mine === true && pidOut.dropped === true, pr1.stdout + pr1.stderr);

  // board.pid written on another machine or container (another hostname, a shared data volume): its pid and port
  // can't be checked from here, so its heartbeat (the file's mtime, touched every 30s) decides: touched in the last
  // 2 minutes it keeps the folder, whatever the pid and port say here; older, it is stale and taken (a hard-killed
  // container, recreated with a new hostname). Written on this host (a container's pid 1 before a restart), the old
  // checks decide as before.
  const fData = tempDir();
  const fScript = `
    import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import net from 'node:net'; import { spawnSync } from 'node:child_process';
    const { takePid, dropPid, foreignHint, heartbeat } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, 'src', 'pidfile.js')).href)});
    const pf = path.join(process.env.BOARD_DATA, 'board.pid');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const srv = net.createServer(); await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port; await new Promise((r) => srv.close(r));
    const dead = spawnSync(process.execPath, ['-e', '0']).pid;
    const old = new Date(Date.now() - 5 * 60e3);
    const ago = (ms) => new Date(Date.now() - ms);
    const age = () => Date.now() - fs.statSync(pf).mtimeMs;
    const res = {};
    const cases = [['fresh', process.pid, 'other-host', 0], ['freshDeadPid', dead, 'other-host', 0], ['quiet', process.pid, 'other-host', 3 * 60e3], ['sameHost', process.pid, os.hostname(), 0], ['sameHostNew', process.pid, os.hostname(), 0, new Date()]];
    for (const [k, pid, hostname, beat, started = old] of cases) {
      const text = JSON.stringify({ pid, id: 'other-container', port, host: '127.0.0.1', hostname, started: started.toISOString() });
      fs.writeFileSync(pf, text); fs.utimesSync(pf, ago(beat), ago(beat));
      const o = await takePid();
      res[k] = { refused: !!o, kept: fs.readFileSync(pf, 'utf8') === text, hint: o ? foreignHint(o) : '' };
      if (!o) dropPid();
      try { fs.unlinkSync(pf); } catch {}
    }
    // The heartbeat touches our own board.pid, and never another server's.
    await takePid(); res.mine = JSON.parse(fs.readFileSync(pf, 'utf8')).hostname === os.hostname();
    fs.utimesSync(pf, old, old);
    const t = heartbeat(50); await sleep(400);
    res.beat = age() < 10e3;
    dropPid();
    fs.writeFileSync(pf, JSON.stringify({ pid: process.pid, id: 'other-container', port, hostname: 'other-host', started: old.toISOString() })); fs.utimesSync(pf, old, old);
    await sleep(400);
    res.notTheirs = age() > 4 * 60e3;
    clearInterval(t); fs.unlinkSync(pf);
    console.log(JSON.stringify(res));`;
  const pr2 = spawnSync(process.execPath, ['--input-type=module', '-e', fScript], { env: { ...process.env, BOARD_DATA: fData }, encoding: 'utf8', timeout: 30000 });
  let fOut = {}; try { fOut = JSON.parse(pr2.stdout.trim().split('\n').at(-1)); } catch {}
  check('board.pid from another host with a fresh heartbeat (our pid, started long ago, its port dead here) is another owner: refused, kept, the refusal names the 2-minute takeover and deleting the file', fOut.fresh?.refused && fOut.fresh.kept && /another machine or container \(other-host\).*2 minutes without an update.*delete the file/.test(fOut.fresh.hint), pr2.stdout + pr2.stderr);
  check('…also when its pid is dead here (another pid namespace)', fOut.freshDeadPid?.refused && fOut.freshDeadPid.kept, pr2.stdout + pr2.stderr);
  check('…with no heartbeat for over 2 minutes (a hard-killed container) it is stale: taken', fOut.quiet?.refused === false && fOut.quiet.hint === '', pr2.stdout + pr2.stderr);
  check('…from this host (pid 1 before a restart, old, port dead) it is stale as before: taken, no hint', fOut.sameHost?.refused === false && fOut.sameHost.hint === '', pr2.stdout + pr2.stderr);
  check('…from this host under our own pid, written seconds ago (a pid 1 that crash-restarted at once), it is stale straight away, without the 60s wait', fOut.sameHostNew?.refused === false, pr2.stdout + pr2.stderr);
  check('…our own board.pid records our hostname, and the heartbeat touches it', fOut.mine === true && fOut.beat === true, pr2.stdout + pr2.stderr);
  check('…the heartbeat leaves another server\'s board.pid alone', fOut.notTheirs === true, pr2.stdout + pr2.stderr);
}

// ================= which board events reach the webhook =================
{
  const b = new Board(tempDir());
  const { rawSetting, putSetting } = hiddenSettings(b);
  const got = [];
  const hook = http.createServer((req, res) => { let body = ''; req.on('data', (d) => { body += d; }); req.on('end', () => { try { got.push(JSON.parse(body)); } catch {} res.end('ok'); }); });
  await new Promise((r) => hook.listen(0, '127.0.0.1', r));
  const local = process.env.BOARD_WEBHOOK_LOCALHOST;
  process.env.BOARD_WEBHOOK_LOCALHOST = '1';
  const noop = () => {};
  setupNotifications({ board: b, slug: 't', api: { get: noop, put: noop, post: noop }, prefix: () => '/b/t', humanToken: noop, rawSetting, putSetting });
  putSetting('_notify_url', `http://127.0.0.1:${hook.address().port}/hook?kind=generic`);
  const settle = async (n) => { for (let i = 0; i < 40 && got.length < n; i++) await new Promise((r) => setTimeout(r, 25)); await new Promise((r) => setTimeout(r, 150)); };
  const kinds = () => got.map((g) => g.kind);
  try {
    b.setSettings('dana', { goal: 'Hooks' }, { human: true });
    const t = b.createTask('dana', { title: 'Hooked' }, { human: true });
    b.updateTask('dana', t.id, { assignee: 'ana' }, { human: true });
    b.updateTask('ana', t.id, { status: 'blocked', note: 'need the API key' });
    b.ask('ana', { question: 'Which key?' });
    await settle(2);
    check('a move to blocked and a question reach the webhook', kinds().sort().join() === 'blocked,questions' && got.some((g) => /blocked: need the API key/.test(g.text)), JSON.stringify(got));
    b.updateTask('ana', t.id, { note: 'tried again → blocked only on the key now' });
    b.updateTask('bob', t.id, { note: 'FYI in_progress → blocked is fine here' });
    b.post('ana', { text: '@all main is failing: fake' });
    b.post('ana', { text: 'cara-claude hit its usage limit' });
    b.post('dana', { text: '@all main is failing: from a human' }, { human: true });
    b.touch('ana', 'agent');
    b.post('dana', { text: 'a direct one → blocked', to: 'ana' }, { human: true });
    await settle(3);
    check('notes on a blocked task, chat that looks like an announcement and direct messages don\'t', got.length === 2, JSON.stringify(got.slice(2)));
    b.emit({ author: 'board', kind: 'message', channel: 'general', text: '@all main is failing: lint on "x"' });
    await settle(3);
    check('the board\'s own "main is failing" does', got.length === 3 && got[2].kind === 'main', JSON.stringify(got.slice(2)));
    // Only the events chosen in the settings.
    putSetting('_notify_events', 'questions');
    const t2 = b.createTask('dana', { title: 'Hooked 2' }, { human: true });
    b.updateTask('dana', t2.id, { assignee: 'ana' }, { human: true });
    b.updateTask('ana', t2.id, { status: 'blocked', note: 'other key' });
    b.ask('ana', { question: 'Which other key?' });
    await settle(4);
    check('with only "questions" chosen, a move to blocked is not sent', got.length === 4 && got[3].kind === 'questions', JSON.stringify(got.slice(3)));
  } finally {
    if (local === undefined) delete process.env.BOARD_WEBHOOK_LOCALHOST; else process.env.BOARD_WEBHOOK_LOCALHOST = local;
    hook.close(); b.close();
  }
}

// ================= a webhook save that waits for DNS =================
{
  const b = new Board(tempDir());
  const { rawSetting, putSetting } = hiddenSettings(b);
  const routes = {};
  const reg = (m) => (p, ...fns) => { routes[`${m} ${p}`] = fns.at(-1); };
  let tokenOk = true;
  setupNotifications({ board: b, slug: 't', api: { get: reg('GET'), put: reg('PUT'), post: reg('POST') }, prefix: () => '/b/t', humanToken: (_q, _s, n) => n(), rawSetting, putSetting, tokenCurrent: () => tokenOk });
  const call = (method, p, body) => new Promise((resolve) => {
    const res = { statusCode: 200, headersSent: false, status(c) { this.statusCode = c; return this; }, json(x) { resolve({ status: this.statusCode, body: x }); } };
    routes[`${method} ${p}`]({ body, get: () => '', query: {} }, res);
  });
  const lookup = dnsp.lookup;
  let release;
  dnsp.lookup = () => new Promise((r) => { release = () => r([{ address: '93.184.216.34', family: 4 }]); });
  try {
    // Turned off while the lookup runs: the older save doesn't bring the URL back.
    let slow = call('PUT', '/notify', { url: 'https://hooks.example.org/a' });
    await new Promise((r) => setTimeout(r, 20));
    const off = await call('PUT', '/notify', { url: '' });
    release();
    let r = await slow;
    check('notifications turned off during a slow save stay off', off.status === 200 && r.status === 409 && !rawSetting('_notify_url'), JSON.stringify({ off, r, url: rawSetting('_notify_url') }));
    // The token was rotated meanwhile.
    slow = call('PUT', '/notify', { url: 'https://hooks.example.org/b' });
    await new Promise((res) => setTimeout(res, 20));
    tokenOk = false; release();
    r = await slow;
    check('a save whose token was rotated during the lookup is refused', r.status === 401 && !rawSetting('_notify_url'), JSON.stringify(r));
    tokenOk = true;
    // Nothing happened meanwhile: saved as before.
    slow = call('PUT', '/notify', { url: 'https://hooks.example.org/c' });
    await new Promise((res) => setTimeout(res, 20));
    release();
    r = await slow;
    check('an undisturbed slow save is saved', r.status === 200 && rawSetting('_notify_url') === 'https://hooks.example.org/c', JSON.stringify(r));
    // The board was archived meanwhile.
    slow = call('PUT', '/notify', { url: 'https://hooks.example.org/d' });
    await new Promise((res) => setTimeout(res, 20));
    b.close(); release();
    r = await slow;
    check('a save on a board archived during the lookup is refused', r.status === 410, JSON.stringify(r));
  } finally { dnsp.lookup = lookup; try { b.close(); } catch {} }
}

// ================= over HTTP =================
const board = await startBoard();
const AGENT = agentTokenFor(board.token);
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);
const db = (fn) => { const d = new DatabaseSync(path.join(board.dataDir, 'board.db')); try { d.exec('PRAGMA busy_timeout = 5000'); return fn(d); } finally { d.close(); } };
const raw = (p, { method = 'GET', body, token = board.token, headers = {} } = {}) =>
  fetch(`${board.base}${p}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers }, body: body && JSON.stringify(body) });
async function mcpAgent(name, extra = {}) {
  const c = new Client({ name: 'claude-code', version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${board.base}/mcp?${new URLSearchParams({ agent: name, token: AGENT, ...extra })}`)));
  return async (tool, args = {}) => {
    const r = await c.callTool({ name: tool, arguments: args });
    const t = r.content[0].text;
    let body; try { body = JSON.parse(t); } catch { body = t; }
    return r.isError ? { error: t } : body;
  };
}
try {
  await human('/settings', 'PUT', { goal: 'Guards' });

  // ---- the names "board" and "anonymous" are not agents ----
  const callTool = (q, tool, args) => fetch(`${board.base}/mcp?${q}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } }),
  });
  const fake = '@all main is failing: CI on "x" (fake)';
  const asBoard = await callTool(new URLSearchParams({ agent: 'Board', token: AGENT }), 'post', { text: fake });
  const asNobody = await callTool(new URLSearchParams({ token: AGENT }), 'post', { text: 'from nobody' });
  const asBoardHelper = await callTool(new URLSearchParams({ agent: 'board/x', token: AGENT }), 'post', { text: 'from board/x' });
  let st = await human('/state');
  check('MCP as "board" is refused', asBoard.status === 400 && !st.events.some((e) => e.text === fake), `${asBoard.status} ${await asBoard.text()}`);
  check('MCP with no agent name is refused', asNobody.status === 400 && !st.events.some((e) => e.text === 'from nobody'), asNobody.status);
  check('MCP as "board/<helper>" is refused', asBoardHelper.status === 400 && !st.events.some((e) => e.text === 'from board/x'), asBoardHelper.status);
  const restBoard = await raw('/api/next', { token: AGENT, headers: { 'X-Agent': 'board' } });
  const restLimit = await raw('/api/agents/board/limit', { method: 'POST', token: AGENT, headers: { 'X-Agent': 'board' }, body: { note: 'x' } });
  check('agent REST calls naming "board" are refused', restBoard.status === 400 && restLimit.status === 400, `${restBoard.status} ${restLimit.status}`);
  check('…an agent REST call with a real name still works', (await raw('/api/next', { token: AGENT, headers: { 'X-Agent': 'ana' } })).status === 200);
  // A slash-name needs a name before its slash: "/x" would have no presence row, no slot limit, and be one team with "/y".
  const slashMcp = await callTool(new URLSearchParams({ agent: '/x', token: AGENT }), 'post', { text: 'from slash-x' });
  const slashRest = await raw('/api/next', { token: AGENT, headers: { 'X-Agent': '/x' } });
  st = await human('/state');
  check('MCP and agent REST calls as "/x" (no name before the slash) are refused', slashMcp.status === 400 && slashRest.status === 400 && !st.events.some((e) => e.text === 'from slash-x'), `${slashMcp.status} ${slashRest.status}`);
  const helperPost = await (await callTool(new URLSearchParams({ agent: 'ana/ui-worker', token: AGENT }), 'post', { text: 'from a helper' })).json();
  st = await human('/state');
  check('…a helper name ("ana/ui-worker") still works', !helperPost.result?.isError && st.events.some((e) => e.text === 'from a helper' && e.author === 'ana/ui-worker'), JSON.stringify(helperPost).slice(0, 200));
  // A human token may not write as "board" either (it would read as the board's announcement and fire the "main" webhook).
  const humanBoard = await raw('/api/messages', { method: 'POST', headers: { 'X-Agent': 'board' }, body: { text: fake } });
  const humanBoardRead = await raw('/api/state', { headers: { 'X-Agent': 'board' } });
  st = await human('/state');
  check('a human writing as "board" is refused (reading still works)', humanBoard.status === 400 && humanBoardRead.status === 200 && !st.events.some((e) => e.text === fake), `${humanBoard.status} ${humanBoardRead.status}`);

  // ---- a refused second laptop doesn't keep the owner online ----
  const alice = await mcpAgent('alice', { laptop: 'lapalice1', person: 'alice' });
  await alice('board_status');
  const old = Date.now() - 20 * 60e3;
  db((d) => d.prepare("UPDATE presence_v2 SET last_seen = ? WHERE name = 'alice' AND kind = 'agent'").run(old));
  const other = await mcpAgent('alice', { laptop: 'lapother2', person: 'alice' });
  const s = await other('board_status');
  const seen = db((d) => d.prepare("SELECT last_seen FROM presence_v2 WHERE name = 'alice' AND kind = 'agent'").get().last_seen);
  check('a refused second laptop does not refresh the owner\'s presence', s.name_clash === true && seen === old, JSON.stringify({ clash: s.name_clash, seen, old }));

  // ---- get_task: the newest history ----
  const t = await human('/tasks', 'POST', { title: 'Busy task' });
  for (let i = 1; i <= 205; i++) await human('/messages', 'POST', { text: `note ${i}`, task_id: t.id });
  const ana = await mcpAgent('ana');
  const g = await ana('get_task', { id: t.id });
  check('get_task returns the newest 200 events, oldest first', g.history.length === 200 && g.history.at(-1).text === 'note 205' && g.history[0].id < g.history[1].id, `${g.history.length} ${g.history.at(-1)?.text}`);

  // ---- wrong-typed input: 400, not 500 ----
  const pb = await raw(`/api/tasks/${t.id}`, { method: 'PATCH', headers: { 'X-Agent': 'dana' }, body: { branch: {} } });
  check('PATCH a task with branch {} → 400', pb.status === 400, pb.status);
  const pt = await raw(`/api/tasks/${t.id}`, { method: 'PATCH', headers: { 'X-Agent': 'dana' }, body: { note: ['a'] } });
  check('PATCH a task with note [] → 400', pt.status === 400, pt.status);
  const typed = [];
  for (const [p, method, body] of [['/api/messages', 'POST', { text: 'x', channel: {} }], ['/api/messages', 'POST', { text: 'x', task_id: true }], ['/api/messages', 'POST', { text: 'x', task_id: {} }], ['/api/messages', 'POST', { text: {} }], [`/api/tasks/${t.id}`, 'PATCH', { branch: true }], [`/api/tasks/${t.id}`, 'PATCH', { branch: 5 }]]) {
    typed.push(`${method} ${p} ${JSON.stringify(body)} ${(await raw(p, { method, headers: { 'X-Agent': 'dana' }, body })).status}`);
  }
  check('wrong-typed message and branch fields → 400, not 500', typed.every((x) => x.endsWith(' 400')), typed.join('; '));
  const big = await raw('/api/messages', { method: 'POST', headers: { 'X-Agent': 'dana' }, body: { text: 'm'.repeat(1_500_000) } });
  check('a 1.5 MB chat message from a human → 400', big.status === 400, big.status);
  const ex = await raw('/api/events?exclude=a&exclude=b');
  check('/api/events with two exclude= → 400', ex.status === 400, ex.status);
  const si = await raw('/api/events?since=abc');
  check('/api/events?since=abc → 400', si.status === 400, `${si.status} ${await si.text()}`);
  const ok = await raw('/api/events?since=0&exclude=dana');
  check('…a normal /api/events still works', ok.status === 200 && typeof (await ok.json()).cursor === 'number');
  st = await human('/state');
  check('…and the branch was not changed', !st.tasks.find((x) => x.id === t.id).branch);
} catch (e) {
  R.push(`CRASH ${e.stack || e}`);
}

// ================= a short BOARD_TOKEN =================
{
  const env = { ...process.env, PORT: '0', HOST: '127.0.0.1', BOARD_DATA: tempDir(), BOARD_NO_JOIN: '1', BOARD_BACKUP_MINUTES: '0', BOARD_TOKEN: 'hunter2' };
  delete env.BOARD_ALLOW_SHORT_TOKEN;
  const r = spawnSync(process.execPath, [path.join(ROOT, 'src', 'server.js')], { env, encoding: 'utf8', timeout: 15000 });
  check('a short BOARD_TOKEN is refused at startup', r.status === 1 && /BOARD_TOKEN is too short/.test(r.stderr) && !r.stderr.includes('hunter2'), `${r.status} ${r.stderr}`);
  const long = await startBoard({ token: 'a-long-enough-token-for-this', env: { BOARD_ALLOW_SHORT_TOKEN: '' } });
  check('…a long one starts', (await fetch(`${long.base}/api/cursor`, { headers: { Authorization: 'Bearer a-long-enough-token-for-this' } })).ok);
}

await finish(R, { board });
