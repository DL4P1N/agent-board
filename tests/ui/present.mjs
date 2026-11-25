// Classic presenter (public/present-classic.html): the simple read-only big-screen page. The 3D office presenter
// (public/present.html, tests/ui/office-present.mjs) falls back to it without WebGL and links to it as "Simple view".
// Starts its own throwaway board. Run all suites with: npm test
import path from 'node:path';
import { startBoard, launchBrowser, shotsDir, finish, agent, rest, TOKEN } from '../helpers.mjs';

const board = await startBoard();
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);

await human('/settings', 'PUT', { goal: 'A voting app for hackathon projects <b>live</b>', deadline: Date.now() + 2 * 3600e3 + 5 * 60e3, freeze_minutes: 60 });
const ana = await agent(board, 'ana-claude'); await ana('board_status');
const t1 = await ana('create_task', { title: 'Vote API', size: 'S' });
const t2 = await ana('create_task', { title: 'Leaderboard page' });
await ana('create_task', { title: 'Submit form' });
await ana('claim_task', { id: t1.id }); await ana('update_task', { id: t1.id, status: 'in_progress' });
await ana('update_task', { id: t1.id, status: 'review', note: 'done' });
await human(`/tasks/${t1.id}`, 'PATCH', { status: 'done' });
await ana('claim_task', { id: t2.id }); await ana('update_task', { id: t2.id, status: 'in_progress' });
await human('/messages', 'POST', { text: 'go team' });

// The presenter link carries the read-only viewer token, never the board token.
const st = await human('/state');
const VIEW = st.setup?.viewer_token;
check('the board gives humans a viewer token (separate from the board token)', !!VIEW && VIEW !== TOKEN, String(VIEW));
const asViewer = (p, method = 'GET') => fetch(`${board.base}/api${p}`, { method, headers: { Authorization: `Bearer ${VIEW}`, 'Content-Type': 'application/json' } });
const vs = await asViewer('/state');
const vbody = vs.ok ? await vs.json() : null;
check('the viewer token reads the board but gets no setup or tokens', vs.status === 200 && !vbody.setup && !JSON.stringify(vbody).includes(TOKEN), String(vs.status));
check('the viewer token cannot change anything', [403, 401].includes((await asViewer('/messages', 'POST')).status));

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1600, height: 900 } });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const out = shotsDir('present');
// A slow answer can't put an older board back: one /api/state is held 2.5 s and then answered with the board as it was,
// while a newer change asks for another. The task total on screen (sampled) never goes back down.
async function staleCheck(file) {
  const sp = await browser.newPage();
  await sp.evaluateOnNewDocument(() => {
    const f = window.fetch.bind(window);
    window.fetch = async (u, o) => {
      if (!window.__hold || !/\/api\/state(\?|$)/.test(String(u))) return f(u, o);
      const b = window.__hold; window.__hold = null;
      await new Promise((r) => setTimeout(r, 2500));
      return new Response(b, { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
  });
  await sp.goto(`${board.base}/${file}?token=${encodeURIComponent(VIEW)}`);
  await sp.waitForFunction(() => /\d+ of \d+ done/.test(document.body.innerText), { timeout: 10000, polling: 100 });
  await sleep(800);
  await sp.evaluate(() => { window.__seen = []; setInterval(() => { const m = /\d+ of (\d+) done/.exec(document.body.innerText); if (m && +m[1] !== window.__seen.at(-1)) window.__seen.push(+m[1]); }, 30); });
  const old = await (await fetch(`${board.base}/api/state`, { headers: { Authorization: `Bearer ${VIEW}` } })).text();
  await sp.evaluate((b) => { window.__hold = b; }, old);
  await human('/tasks', 'POST', { title: 'Race A' }); // its reload is held, then answered with the board before it
  await sleep(800);
  await human('/tasks', 'POST', { title: 'Race B' }); // a newer reload, answered at once
  await sleep(4000);
  const seen = await sp.evaluate(() => window.__seen);
  const n0 = JSON.parse(old).tasks.filter((t) => t.status !== 'proposed').length;
  check(`${file}: a slow, older answer never replaces a newer board (the task total only goes up, ending with both new tasks)`, seen.every((v, i) => !i || v >= seen[i - 1]) && seen.at(-1) === n0 + 2, JSON.stringify({ n0, seen }));
  await sp.close();
}


// The presenter showing the real board with its /api/state rewritten by `patch` (a function body: s is the state, now the
// time), for what a throwaway board can't easily be: stats with minutes, agents online, a demo time hours away.
async function synthPage(file, patch, init = '') {
  const sp = await browser.newPage();
  await sp.evaluateOnNewDocument((src, pre) => {
    // eslint-disable-next-line no-new-func
    const fn = new Function('s', 'now', src); const f = window.fetch.bind(window);
    if (pre) new Function(pre)();
    window.fetch = async (u, o) => {
      if (window.__down && /\/api\//.test(String(u))) throw new TypeError('Failed to fetch');
      const r = await f(u, o);
      if (!/\/api\/state(\?|$)/.test(String(u))) return r;
      const s = await r.json(); fn(s, Date.now());
      return new Response(JSON.stringify(s), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
  }, patch, init);
  await sp.goto(`${board.base}/${file}?token=${encodeURIComponent(VIEW)}`);
  return sp;
}
// Two Codex agents online (2 slots), a median of 30 min for M, a demo in 3 h with the freeze an hour before (2 h of room), and these tasks.
const SYNTH_BASE = `
  const T = (id, size, deps, status) => ({ id, title: 'Task ' + id, status: status || 'open', priority: 2, size, assignee: null, depends_on: deps || [], created_at: now, updated_at: now });
  s.stats = { minutes: { M: 30 } };
  s.presence = ['a1', 'a2'].map((name) => ({ name, kind: 'agent', online: true, started: true, client: 'codex', slots: 1, base_slots: 1 }));
  s.events = []; s.questions = [];
  s.settings = { ...s.settings, deadline: now + 3 * 3600e3, freeze_minutes: 60 };
  s.time = { deadline: now + 3 * 3600e3, freezeAt: now + 2 * 3600e3, past: false };`;
// UM6: "On track" counts the longest chain of tasks waiting on each other, and an L the board has no sample for takes longer than an M.
async function verdictCheck(file) {
  const verdictOf = async (patch) => {
    const sp = await synthPage(file, SYNTH_BASE + patch);
    const ok = await sp.waitForSelector('#verdict', { timeout: 10000 }).then(() => true).catch(() => false);
    const v = ok ? await sp.$eval('#verdict', (e) => ({ t: e.textContent, why: e.title })) : { t: '', why: '' };
    await sp.close(); return v;
  };
  // 5 tasks in a row (150 min), 2 more: 210 min of work over 2 slots is 105, which fits the 120 min to the freeze, the chain doesn't.
  const chain = await verdictOf(`s.tasks = [T(1, 'M'), T(2, 'M', [1]), T(3, 'M', [2]), T(4, 'M', [3]), T(5, 'M', [4]), T(6, 'M'), T(7, 'M')];`);
  check(`${file}: a chain of 5 dependent tasks (150 min) is behind with 2 h to the freeze, though 7 tasks over 2 slots would fit`, /^Behind/.test(chain.t) && /5 tasks wait on each other in a row/.test(chain.why), JSON.stringify(chain));
  const free = await verdictOf(`s.tasks = [T(1, 'M'), T(2, 'M'), T(3, 'M'), T(4, 'M'), T(5, 'M'), T(6, 'M'), T(7, 'M')];`);
  check(`${file}: the same 7 tasks with nothing waiting on anything are on track`, free.t === 'On track' && !/wait on each other/.test(free.why), JSON.stringify(free));
  const done = await verdictOf(`s.tasks = [T(1, 'M', [], 'done'), T(2, 'M', [1]), T(3, 'M', [2]), T(4, 'M')];`);
  check(`${file}: a finished task in a chain no longer waits`, done.t === 'On track', JSON.stringify(done));
  // 3 L (no L sample: twice an M, 60 min each) and 2 M: 240 min over 2 slots is 120 of 120, tight; counted as M it was 75 min, on track.
  const big = await verdictOf(`s.tasks = [T(1, 'L'), T(2, 'L'), T(3, 'L'), T(4, 'M'), T(5, 'M')];`);
  check(`${file}: 3 L tasks with no L sample count twice an M, not as M`, big.t === 'Tight', JSON.stringify(big));
}

// The crunch: what the legend counts, who is "working", what the freeze leaves behind, and a board that can't be reached.
const TRACK_ES = `const ES = window.EventSource; window.__es = []; window.EventSource = function (u) { const e = new ES(u); window.__es.push(e); return e; }; window.EventSource.prototype = ES.prototype;`;
async function crunchCheck(file, classic) {
  const flat = (sp) => sp.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  const loaded = (sp) => sp.waitForFunction(() => /\d+ of \d+ done/.test(document.body.innerText), { timeout: 10000, polling: 100 });
  // The legend: "x of y done" leaves proposals out, and so does Open; they are an entry of their own, so the entries add up to y.
  let sp = await synthPage(file, SYNTH_BASE + `s.tasks = [T(1, 'M', [], 'done'), T(2, 'M'), T(3, 'M'), Object.assign(T(4, 'M'), { status: 'proposed' })];`);
  await loaded(sp); let t = await flat(sp);
  check(`${file}: the legend leaves the proposal out of Open and lists it itself (1 of 3 done: Open 2, Proposed 1)`, /1 of 3 done/.test(t) && /Done 1/.test(t) && /Open 2/.test(t) && /Proposed 1/.test(t), t.slice(0, 400));
  check(`${file}: before the freeze no "won't land" line`, !(await sp.$('#freeze-note')));
  await sp.close();
  sp = await synthPage(file, SYNTH_BASE + `s.tasks = [T(1, 'M', [], 'done'), T(2, 'M')];`);
  await loaded(sp); t = await flat(sp);
  check(`${file}: with no proposals there is no Proposed entry`, !/Proposed/.test(t), t.slice(0, 300));
  await sp.close();
  // The freeze: open tasks (not the P1 fixes that may still start) and proposals won't land.
  sp = await synthPage(file, SYNTH_BASE + `s.settings.deadline = now + 30 * 60e3; s.settings.freeze_minutes = 60; s.time = { deadline: now + 30 * 60e3, freezeAt: now - 30 * 60e3, past: false };
    s.tasks = [T(1, 'M', [], 'done'), T(2, 'M'), T(3, 'M'), T(4, 'M'), Object.assign(T(5, 'M'), { priority: 1 }), Object.assign(T(6, 'M'), { status: 'proposed' }), Object.assign(T(7, 'M', [], 'in_progress'), { assignee: 'a1' }), Object.assign(T(8, 'L'), { priority: 1 })];`);
  const note = await sp.waitForSelector('#freeze-note', { timeout: 10000 }).then(() => sp.$eval('#freeze-note', (e) => e.textContent)).catch(() => '');
  check(`${file}: in the freeze it says how much won't land (4 open tasks and 1 proposal; a P1 fix of size M and the started task can, a P1 L can't)`, /^4 open tasks and 1 proposal won't land/.test(note), note);
  await sp.close();
  // A board that can't be reached: a calm, clear band (what it shows is as of the last answer), the clock card dimmed; gone when it is back.
  sp = await synthPage(file, SYNTH_BASE + `s.tasks = [T(1, 'M', [], 'done'), T(2, 'M')];`, TRACK_ES);
  await loaded(sp); await sleep(600);
  check(`${file}: while the board answers there is no offline band`, !(await sp.$('#offline')));
  await sp.evaluate(() => { window.__down = true; for (const e of window.__es) { e.close(); e.onerror?.(new Event('error')); } });
  const down = await sp.waitForFunction(() => !!document.getElementById('offline'), { timeout: 15000, polling: 100 }).then(() => true).catch(() => false);
  const band = down ? await sp.evaluate(() => ({ t: document.getElementById('offline').innerText.replace(/\s+/g, ' '), op: getComputedStyle(document.getElementById('clock')).opacity, rows: document.getElementById('offline').getBoundingClientRect().height })) : null;
  check(`${file}: the board can't be reached: a band says so and since when, and the clock is dimmed`, !!band && /^Can't reach the board\. Showing it as of .*\d/.test(band.t) && Number(band.op) < 1 && band.rows > 20, JSON.stringify(band));
  await sp.evaluate(() => { window.__down = false; });
  check(`${file}: the band goes when the board is back`, await sp.waitForFunction(() => !document.getElementById('offline'), { timeout: 15000, polling: 100 }).then(() => true).catch(() => false));
  await sp.close();
  if (classic) {
    // An agent holding only a blocked task isn't working: it isn't under "Now working on" (the blocked count says it); a mixed holder is.
    sp = await synthPage(file, SYNTH_BASE + `s.tasks = [Object.assign(T(1, 'M', [], 'in_progress'), { assignee: 'a2' }), Object.assign(T(2, 'M', [], 'blocked'), { assignee: 'a1' }), Object.assign(T(3, 'M', [], 'blocked'), { assignee: 'a2' })];`);
    await loaded(sp); await sleep(300);
    const now = await sp.$eval('#h-now', (h) => h.parentElement.innerText.replace(/\s+/g, ' '));
    check(`${file}: Now working on: an agent with only a blocked task isn't listed, one that also works is`, /a2/.test(now) && /#1 Task 1/.test(now) && !/a1/.test(now) && !/#2 Task 2/.test(now), now);
    check(`${file}: ...and the blocked tasks are still counted`, /Blocked 2/.test(await flat(sp)));
    await sp.close();
    // The board's own rule (presence needs_work: online, started, no claimed or in-progress task, no other job): an agent that
    // holds only a blocked task, or only made a recent board call, is idle and isn't listed; one on a review is.
    sp = await synthPage(file, SYNTH_BASE + `s.tasks = [Object.assign(T(1, 'M', [], 'in_progress'), { assignee: 'a2' }), Object.assign(T(2, 'M', [], 'blocked'), { assignee: 'a1' }), Object.assign(T(3, 'M', [], 'review'), { reviewer: 'a4' })];
      const P = (name, doing, needs_work) => ({ name, kind: 'agent', online: true, started: true, client: 'codex', slots: 1, base_slots: 1, doing, needs_work });
      s.presence = [P('a1', '#2 Task 2', true), P('a2', '#1 Task 1', false), P('a3', 'working', true), P('a4', 'reviewing #3 to merge', false)];`);
    await loaded(sp); await sleep(300);
    const idle = await sp.$eval('#h-now', (h) => h.parentElement.innerText.replace(/\s+/g, ' '));
    check(`${file}: Now working on follows needs_work: blocked-only and recently-active agents are left out, a reviewer and a holder are in`, /a2/.test(idle) && /a4/.test(idle) && /reviewing #3/.test(idle) && !/a1/.test(idle) && !/a3/.test(idle) && !/#2 Task 2/.test(idle), idle);
    await sp.close();
  }
}

// A stalled /api/state never freezes the page: one answer never comes, and the page gives up on it after 15 s, so the
// newer change it was asked for in the meantime still shows.
async function hangCheck(file) {
  const hp = await browser.newPage();
  await hp.evaluateOnNewDocument(() => {
    const f = window.fetch.bind(window);
    window.fetch = (u, o) => {
      if (!window.__hang || !/\/api\/state(\?|$)/.test(String(u))) return f(u, o);
      window.__hang = false; window.__hung = true;
      return new Promise((_, no) => o?.signal?.addEventListener('abort', () => no(o.signal.reason))); // only the page's own timeout ends it
    };
  });
  const goal0 = (await human('/state')).settings.goal;
  await hp.goto(`${board.base}/${file}?token=${encodeURIComponent(VIEW)}`);
  await hp.waitForFunction(() => /\d+ of \d+ done/.test(document.body.innerText), { timeout: 10000, polling: 100 });
  await hp.evaluate(() => { window.__hang = true; });
  await human('/settings', 'PUT', { goal: 'Hang A' }); // its reload never gets an answer
  await hp.waitForFunction(() => window.__hung, { timeout: 8000, polling: 100 }).catch(() => {});
  await human('/settings', 'PUT', { goal: 'Hang B' }); // asked for while that one hangs
  const ok = await hp.waitForFunction(() => /Hang B/.test(document.querySelector('h1.goal')?.textContent || ''), { timeout: 25000, polling: 200 }).then(() => true, () => false);
  check(`${file}: a stalled /api/state is given up after 15 s, and the newer board still shows`, ok, await hp.$eval('h1.goal', (h) => h.textContent).catch(() => ''));
  await hp.close();
  await human('/settings', 'PUT', { goal: goal0 });
}

// Needs attention follows the board's rule: it doesn't list stale tasks (the board flags those on their cards only).
// Here the page sees every claimed or in-progress task as stale.
async function staleNeeds(file, sel) {
  const sp = await browser.newPage();
  await sp.evaluateOnNewDocument(() => {
    const f = window.fetch.bind(window); window.__staleN = 0;
    window.fetch = async (u, o) => {
      const r = await f(u, o);
      if (!/\/api\/state(\?|$)/.test(String(u)) || !r.ok) return r;
      const s = await r.json();
      for (const t of s.tasks || []) if (t.status === 'claimed' || t.status === 'in_progress') { t.stale = true; window.__staleN++; }
      return new Response(JSON.stringify(s), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
  });
  await sp.goto(`${board.base}/${file}?token=${encodeURIComponent(VIEW)}`);
  await sp.waitForFunction(() => /\d+ of \d+ done/.test(document.body.innerText), { timeout: 10000, polling: 100 });
  await sleep(500);
  const r = await sp.evaluate((q) => ({ n: window.__staleN, needs: document.querySelector(q)?.innerText || '' }), sel);
  check(`${file}: a stale task isn't listed under Needs attention (as on the board)`, r.n > 0 && !/stale/i.test(r.needs), JSON.stringify(r));
  await sp.close();
}

try {
  await page.goto(`${board.base}/present-classic.html?token=${encodeURIComponent(VIEW)}`);
  await page.waitForFunction(() => /Leaderboard|Vote API|voting app/i.test(document.body.innerText), { timeout: 8000 });
  const txt = await page.evaluate(() => document.body.innerText);
  check('goal shown large, as text (no HTML injected)', await page.$eval('h1.goal', (h) => h.textContent.includes('<b>live</b>') && !h.querySelector('b')));
  check('progress: 1 of 3 done, with a progress bar', /1 of 3 done/.test(txt) && await page.$eval('[role=progressbar]', (b) => b.getAttribute('aria-valuenow') === '1' && b.getAttribute('aria-valuemax') === '3'), txt.slice(0, 200));
  check('column counts', /In progress\s*1/.test(txt) && /Open\s*1/.test(txt) && /Done\s*1/.test(txt));
  check('countdown to the demo with the freeze time', /2h 0\dm|2h 05m|2h 04m/.test(await page.$eval('#clock', (c) => c.textContent)) && /· freeze \d/.test(txt), await page.$eval('#clock', (c) => c.textContent));
  check('now working on: ana with her task', /ana/.test(await page.$eval('#h-now', (h) => h.parentElement.innerText)) && /Leaderboard page/.test(txt));
  check('just merged lists #1', /#\s*1/.test(await page.$eval('#h-merged', (h) => h.parentElement.innerText)) && /Vote API/.test(await page.$eval('#h-merged', (h) => h.parentElement.innerText)));
  check('token removed from the address bar', !/token=/.test(page.url()), page.url());
  check('kept under its own key, never the board token key', await page.evaluate(() => !!localStorage.getItem('board-view-token') && !localStorage.getItem('board-token')));
  check('no link to the full board', !(await page.$('a[href="/"]')));
  await page.screenshot({ path: path.join(out, 'present.png') });
  // Live update: another merge shows up without reloading.
  await ana('update_task', { id: t2.id, status: 'review' }); await human(`/tasks/${t2.id}`, 'PATCH', { status: 'done' });
  const updated = await page.waitForFunction(() => /2 of 3 done/.test(document.body.innerText), { timeout: 8000 }).then(() => true).catch(() => false);
  check('updates live (2 of 3 done)', updated);
  // A busier board: more merges, a claimed task, an agent out of usage, an agent with no task.
  const more = [];
  for (const title of ['Dark mode', 'Share link', 'QR code', 'Export CSV', 'Search box']) more.push(await ana('create_task', { title }));
  for (const t of more.slice(0, 4)) { await ana('claim_task', { id: t.id }); await ana('update_task', { id: t.id, status: 'review' }); await human(`/tasks/${t.id}`, 'PATCH', { status: 'done' }); }
  const bobCodex = await agent(board, 'bob-codex', 'codex'); await bobCodex('board_status'); await bobCodex('claim_task', { id: more[4].id });
  const bobClaude = await agent(board, 'bob-claude'); await bobClaude('board_status');
  const erin = await agent(board, 'erin-claude'); await erin('board_status');
  const submit = (await human('/state')).tasks.find((t) => t.title === 'Submit form');
  await erin('claim_task', { id: submit.id }); await human('/agents/erin-claude', 'PATCH', { limited: true });
  // Wait for the last change (erin out of usage) too: the count can update a reload before it.
  await page.waitForFunction(() => /6 of 8 done/.test(document.body.innerText) && /out of usage/.test(document.getElementById('h-now').parentElement.innerText), { timeout: 12000 }).catch(() => {});
  await sleep(300);
  const nowTxt = await page.$eval('#h-now', (h) => h.parentElement.innerText);
  check('now working on: no tool-call jargon', !/board call|board_status|update_task/.test(nowTxt), nowTxt);
  check('now working on: bob with bob-codex\'s claimed task', new RegExp(`bob[\\s\\S]*#${more[4].id} Search box`).test(nowTxt), nowTxt);
  check('now working on: erin is out of usage but her task is still shown', new RegExp(`erin[\\s\\S]*#${submit.id} Submit form[\\s\\S]*out of usage`).test(nowTxt), nowTxt);
  check('just merged: capped at 4', await page.$eval('#h-merged', (h) => h.parentElement.querySelectorAll('li').length) === 4);
  const colsTxt = await page.$eval('.cols', (c) => c.innerText);
  check('claimed counted in In progress, as on the board', /In progress\s*2/.test(colsTxt) && !/Claimed/.test(colsTxt), colsTxt);
  await staleNeeds('present-classic.html', 'header');
  check('before the freeze the deadline verdict shows', !!(await page.$('#verdict')));
  // A goal pasted from a doc: plain words, at most 2 lines.
  await human('/settings', 'PUT', { goal: 'Follow the design document: `docs/design.md` and **ship** a [companion app](https://example.com) that every attendee at the conference can use on their phone during the talks, the breaks and the evening events' });
  await page.waitForFunction(() => /Follow the design/.test(document.querySelector('h1.goal')?.textContent || ''), { timeout: 8000 });
  const goal = await page.$eval('h1.goal', (h) => ({ t: h.textContent, lines: h.clientHeight / parseFloat(getComputedStyle(h).lineHeight) }));
  check('goal: markdown stripped', !/[`*[\]]/.test(goal.t) && /docs\/design\.md and ship a companion app/.test(goal.t), goal.t);
  check('goal: at most 2 lines', goal.lines <= 2.2, String(goal.lines));
  // Fits a 1366×768 projector and 1920×1080 without scrolling.
  for (const [w, hgt] of [[1366, 768], [1920, 1080]]) {
    await page.setViewport({ width: w, height: hgt }); await sleep(300);
    const sh = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, Math.ceil(document.getElementById("app").getBoundingClientRect().bottom)));
    check(`fits ${w}×${hgt} without scrolling`, sh <= hgt, `scrollHeight ${sh}`);
    await page.screenshot({ path: path.join(out, `present-${w}.png`) });
  }
  await page.setViewport({ width: 1600, height: 900 });
  // The feature freeze is amber, as on the board (a phase, not an error).
  await human('/settings', 'PUT', { deadline: Date.now() + 30 * 60e3, freeze_minutes: 60 });
  const fz = await page.waitForFunction(() => /Feature freeze/.test(document.getElementById('clock-sub')?.textContent || '') && document.getElementById('clock').className === 'clock warn', { timeout: 8000 }).then(() => true).catch(() => false);
  check('in the feature freeze the countdown is amber (warn), not red', fz, await page.$eval('#clock', (c) => c.className));
  check('in the feature freeze no deadline verdict ("On track"), as on the board', !(await page.$('#verdict')), await page.$eval('#verdict', (v) => v.textContent).catch(() => ''));
  // Deadline passed.
  await human('/settings', 'PUT', { deadline: Date.now() + 1000, freeze_minutes: 0 }); // a past time is refused: let it pass
  await new Promise((r) => setTimeout(r, 1200));
  const past = await page.waitForFunction(() => /Demo time/.test(document.getElementById('clock')?.textContent || ''), { timeout: 8000 }).then(() => true).catch(() => false);
  check('after the deadline: "Demo time"', past);
  // An hour or more after the demo: "Event finished" with the final numbers.
  // The API refuses past demo times, so move the page's clock forward instead.
  await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 2 * 3600e3; });
  const fin = await page.waitForFunction(() => /Event finished/.test(document.getElementById('clock')?.textContent || ''), { timeout: 8000 }).then(() => true).catch(() => false);
  check('long after the demo: "Event finished" with the final numbers', fin && /Final: 6 of 8 tasks done/.test(await page.$eval('#clock-sub', (s) => s.textContent)), await page.$eval('#clock-sub', (s) => s.textContent));
  // Phone width: no horizontal scroll.
  await page.setViewport({ width: 390, height: 844 }); await sleep(300);
  check('phone width: no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(out, 'present-phone.png') });
  // Without a token: a clear message, no errors.
  const p2 = await browser.newPage(); const e2 = []; p2.on('pageerror', (e) => e2.push(e.message));
  await p2.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch {} });
  await p2.goto(`${board.base}/present-classic.html`); await sleep(400);
  check('no token: explains how to open it', /Presenter view/.test(await p2.evaluate(() => document.body.innerText)) && !e2.length, e2.join('; '));
  // The main board's "Presenter view" link uses the viewer token.
  const mp = await browser.newPage();
  await mp.goto(`${board.base}/?token=${TOKEN}&name=dana`);
  await mp.waitForSelector('#app:not([hidden])', { timeout: 8000 });
  await mp.waitForFunction(() => !document.getElementById('present-link').hidden, { timeout: 8000 }).catch(() => {});
  const href = await mp.$eval('#present-link', (a) => a.getAttribute('href'));
  check('the board Presenter view link carries the viewer token, not the board token', href.includes(encodeURIComponent(VIEW)) && !href.includes(TOKEN), href);
  await mp.close();
  // A rejected token: the page says the link expired.
  const p3 = await browser.newPage(); const e3 = []; p3.on('pageerror', (e) => e3.push(e.message));
  await p3.goto(`${board.base}/present-classic.html?token=nope`);
  const exp = await p3.waitForFunction(() => /presenter link has expired/.test(document.body.innerText), { timeout: 8000 }).then(() => true).catch(() => false);
  check('a rejected token: "This presenter link has expired"', exp && !e3.length, e3.join('; '));
  // Theme: the board's choice (localStorage board-theme: one of its fifteen themes, or auto; the old 'light' and 'dark'
  // are the Light and Dark themes) wins over the OS. Auto = no data-theme and follows the OS: Dark or Light.
  const BG = { dark: 'rgb(6, 6, 7)', light: 'rgb(241, 242, 244)', dusk: 'rgb(27, 21, 48)', day: 'rgb(239, 228, 207)', night: 'rgb(8, 12, 26)', terminal: 'rgb(2, 10, 4)', contrast: 'rgb(0, 0, 0)', synthwave: 'rgb(19, 8, 36)', sticky: 'rgb(255, 224, 102)', coral: 'rgb(255, 211, 194)' };
  const LT = new Set(['light', 'day', 'sticky', 'coral']); // light themes: light colour scheme
  const BAR = { dark: '#060607', light: '#f1f2f4', dusk: '#1b1530', day: '#efe4cf', night: '#080c1a', terminal: '#020a04', contrast: '#000000', synthwave: '#130824', sticky: '#ffe066', coral: '#ffd3c2' };
  const themed = async (stored, os) => {
    const tp = await browser.newPage(); tp.on('pageerror', (e) => errors.push(e.message));
    await tp.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: os }]);
    await tp.evaluateOnNewDocument((v) => { try { if (v === null) localStorage.removeItem('board-theme'); else localStorage.setItem('board-theme', v); } catch {} }, stored);
    await tp.goto(`${board.base}/present-classic.html`);
    const r = await tp.evaluate(() => ({ theme: document.documentElement.dataset.theme ?? null, bg: getComputedStyle(document.body).backgroundColor, scheme: getComputedStyle(document.documentElement).colorScheme, meta: document.getElementById('m-scheme').content, bar: [...document.querySelectorAll('meta[name=theme-color]')].filter((m) => m.media === 'all').map((m) => m.content) }));
    return { tp, ...r };
  };
  for (const [stored, pal] of [['dark', 'dark'], ['light', 'light'], ['dusk', 'dusk'], ['day', 'day'], ['night', 'night'], ['terminal', 'terminal'], ['contrast', 'contrast'], ['synthwave', 'synthwave'], ['sticky', 'sticky'], ['coral', 'coral']]) {
    const r = await themed(stored, LT.has(pal) ? 'dark' : 'light'); // the OS says the opposite: the choice wins
    check(`board-theme ${stored}: data-theme ${pal}, ${pal} background, ${LT.has(pal) ? 'light' : 'dark'} colour scheme and browser bar`, r.theme === pal && r.bg === BG[pal] && r.scheme === (LT.has(pal) ? 'light' : 'dark') && r.meta === (LT.has(pal) ? 'light' : 'dark') && r.bar.length === 1 && r.bar[0].toLowerCase() === BAR[pal], JSON.stringify([r.theme, r.bg, r.scheme, r.meta, r.bar]));
    if (stored === 'night' || stored === 'terminal') await r.tp.screenshot({ path: path.join(out, `present-${stored}.png`) });
    await r.tp.close();
  }
  for (const [stored, os, pal] of [[null, 'dark', 'dark'], [null, 'light', 'light'], ['auto', 'dark', 'dark'], ['auto', 'light', 'light'], ['purple', 'dark', 'dark']]) {
    const r = await themed(stored, os);
    check(`board-theme ${stored ?? '(none)'} over a ${os} OS: no data-theme, ${pal} (Auto follows the OS)`, r.theme === null && r.bg === BG[pal] && r.meta === 'light dark', JSON.stringify([r.theme, r.bg, r.meta]));
    await r.tp.close();
  }
  {
    // The board changes the theme in another tab of the same browser: this page follows without a reload.
    const a = await themed('day', 'dark');
    const b = await browser.newPage(); await b.goto(`${board.base}/health`);
    for (const [v, pal] of [['terminal', 'terminal'], ['dark', 'dark'], ['sticky', 'sticky'], ['night', 'night']]) {
      await b.evaluate((x) => localStorage.setItem('board-theme', x), v);
      const ok = await a.tp.waitForFunction((t) => document.documentElement.dataset.theme === t, { timeout: 5000, polling: 100 }, pal).then(() => true).catch(() => false);
      check(`another tab sets board-theme ${v}: this page switches to ${pal} live`, ok && await a.tp.evaluate((bg) => getComputedStyle(document.body).backgroundColor === bg, BG[pal]));
    }
    await b.evaluate(() => localStorage.removeItem('board-theme'));
    check('another tab clears board-theme: back to Auto (no data-theme)', await a.tp.waitForFunction(() => !document.documentElement.hasAttribute('data-theme'), { timeout: 5000, polling: 100 }).then(() => true).catch(() => false));
    await b.close(); await a.tp.close();
  }
  await staleCheck('present-classic.html');
  await hangCheck('present-classic.html');
  await verdictCheck('present-classic.html');
  await crunchCheck('present-classic.html', true);
  check('no page errors', !errors.length, errors.join('; '));
} catch (e) {
  R.push(`CRASH ${e.message}`);
}
await finish(R, { browser, board });
