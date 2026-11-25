// Presenter view (public/present.html): the 3D office driven by the live board, with a read-only overlay.
// Built from office/ by `npm run build:present`. Without WebGL it opens the classic page (tests/ui/present.mjs).
// Chrome runs with SwiftShader (software WebGL) so this works on CI runners without a GPU; if WebGL is still
// missing there, the fallback is what gets tested. Run all suites with: npm test
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
const t3 = await ana('create_task', { title: 'Submit form' });
await ana('claim_task', { id: t1.id }); await ana('update_task', { id: t1.id, status: 'review', note: 'done' });
await human(`/tasks/${t1.id}`, 'PATCH', { status: 'done' });
await ana('claim_task', { id: t2.id }); await ana('update_task', { id: t2.id, status: 'in_progress' });
const VIEW = (await human('/state')).setup?.viewer_token;

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1600, height: 900 }, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = shotsDir('office-present');
const errors = [];
const watch = (p, list = errors) => { p.on('pageerror', (e) => list.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') list.push(m.text()); }); return p; };
const S = (page) => page.evaluate(() => window.__officeState);
const until = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, { timeout, polling: 100 }, arg).then(() => true).catch(() => false);
const text = (page) => page.evaluate(() => document.body.innerText);

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

// Every visible name tag (and its bubble) lies inside the room, which clips whatever leaves it.
const tagsInside = () => {
  const room = document.querySelector('.ab-labels').getBoundingClientRect();
  const out = [...document.querySelectorAll('.ab-labels .ab-tag')].filter((t) => t.style.display !== 'none').map((t) => ({ n: t.querySelector('.ab-name').textContent, b: t.querySelector('.ab-tagin').getBoundingClientRect() }))
    .filter(({ b }) => b.left < room.left - 1 || b.top < room.top - 1 || b.right > room.right + 1 || b.bottom > room.bottom + 1);
  return { out: out.map((t) => `${t.n} ${Math.round(t.b.left)},${Math.round(t.b.top)},${Math.round(t.b.right)},${Math.round(t.b.bottom)}`), room: [room.left, room.top, room.right, room.bottom].map(Math.round).join(',') };
};
// No two agents' name tags (with their bubbles) cover each other.
const tagsApart = () => {
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const r = [...document.querySelectorAll('.ab-labels .ab-tag')].filter((t) => t.style.display !== 'none').map((t) => ({ n: t.querySelector('.ab-name').textContent, b: t.querySelector('.ab-tagin').getBoundingClientRect() }));
  const bad = [];
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (hit(r[i].b, r[j].b)) bad.push(`${r[i].n}/${r[j].n}`);
  return { n: r.length, bad };
};

try {
  const page = watch(await browser.newPage());
  await page.goto(`${board.base}/present.html?token=${encodeURIComponent(VIEW)}`);
  await until(page, () => document.documentElement.dataset.scene || /present-classic/.test(location.pathname), null, 15000);
  const webgl = await page.evaluate(() => document.documentElement.dataset.scene === 'ready' && !/present-classic/.test(location.pathname));
  if (!webgl) {
    // A runner with no WebGL at all: the page must have handed over to the classic presenter, token and all.
    check('no WebGL in this browser: opened the classic presenter instead (office checks skipped)', /present-classic\.html/.test(page.url()) && await until(page, () => /voting app/.test(document.body.innerText)), page.url());
  } else {
    check('the 3D office starts (WebGL canvas in the scene)', await page.$('#scene canvas') !== null);
    await until(page, () => /1 of 3 done/.test(document.body.innerText));
    const txt = await text(page);
    check('token removed from the address bar, kept under the viewer key only', !/token=/.test(page.url()) && await page.evaluate(() => !!localStorage.getItem('board-view-token') && !localStorage.getItem('board-token')), page.url());
    check('goal shown large, as text (no HTML injected)', await page.$eval('#goal', (h) => h.textContent.includes('<b>live</b>') && !h.querySelector('b') && parseFloat(getComputedStyle(h).fontSize) >= 22));
    check('done count: 1 of 3 done, with a progress bar', /1 of 3 done/.test(txt) && await page.$eval('[role=progressbar]', (b) => b.getAttribute('aria-valuenow') === '1' && b.getAttribute('aria-valuemax') === '3'), txt.replace(/\s+/g, ' ').slice(0, 160));
    check('countdown to the demo with the freeze time', /^2h 0\dm$/.test(await page.$eval('#clock', (c) => c.textContent)) && /· freeze \d/.test(await page.$eval('#clock-sub', (c) => c.textContent)), await page.$eval('#clock', (c) => c.textContent));
    check('nothing waiting on a human yet', /Nothing needs attention/.test(txt));
    await staleNeeds('present.html', '#bottom .needs');
    check('body text is at least 14px', await page.evaluate(() => [...document.querySelectorAll('#top, #bottom')].flatMap((r) => [...r.querySelectorAll('*')]).filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).every((e) => parseFloat(getComputedStyle(e).fontSize) >= 14)));
    const s0 = await S(page);
    const a0 = s0.agents.find((a) => a.id === 'ana-claude');
    check('adapter: one character per online agent, tool from its client', s0.agents.length === 1 && a0?.provider === 'claude' && a0.owner === 'ana', JSON.stringify(s0.agents.map((a) => [a.id, a.provider, a.owner])));
    check('adapter: in_progress task -> working at a desk', a0?.phase === 'working' && a0.ticketId === `#${t2.id}` && a0.role === 'worker', `${a0?.phase} ${a0?.ticketId}`);
    check('adapter: tickets from tasks (done -> merged, in_progress, open -> backlog)', JSON.stringify(s0.tickets.map((t) => [t.id, t.status])) === JSON.stringify([[`#${t1.id}`, 'merged'], [`#${t2.id}`, 'in_progress'], [`#${t3.id}`, 'backlog']]), JSON.stringify(s0.tickets.map((t) => [t.id, t.status])));
    check('adapter: no invented costs or usage', s0.metrics.totalCostUsd === 0 && s0.agents.every((a) => a.usage.costUsd === 0 && a.burnUsdPerMin === 0) && s0.tickets.every((t) => t.usage.costUsd === 0), JSON.stringify(s0.metrics).slice(0, 120));
    check('adapter: the demo countdown on the office TV', s0.hack.active && s0.hack.stage === 'build' && Math.abs(s0.hack.endsAt - s0.time - (2 * 3600 + 5 * 60)) < 120, `${s0.hack.stage} ${Math.round(s0.hack.endsAt - s0.time)}`);
    await page.evaluate(() => { try { window.__officeState.agents.length = 0; window.__officeState = null; } catch {} });
    check('the debug hook is read-only', (await S(page))?.agents?.length === 1);

    // Live: a new task, a blocked agent with another tool, a question, a review and a merge, all without reloading.
    await ana('create_task', { title: 'Share link' });
    check('creating a task updates the overlay (1 of 4 done)', await until(page, () => /1 of 4 done/.test(document.body.innerText)));
    const bob = await agent(board, 'bob-codex', 'codex-mcp-client'); await bob('board_status');
    await bob('claim_task', { id: t3.id }); await bob('update_task', { id: t3.id, status: 'blocked', note: 'needs the API key' });
    const stuck = await until(page, (id) => new RegExp(`Blocked[\\s\\S]*bob[\\s\\S]*#${id} Submit form`, 'i').test(document.getElementById('needs')?.innerText || ''), t3.id);
    check('a blocked task shows under "Needs attention" with its person (the board\'s word: Blocked)', stuck, (await page.$eval('#needs', (n) => n.innerText).catch(() => '')).replace(/\s+/g, ' '));
    const s1 = await S(page);
    const b1 = s1.agents.find((a) => a.id === 'bob-codex');
    check('adapter: blocked -> "Blocked on #id" (the board\'s word), Codex agent at its own desk', b1?.provider === 'codex' && b1.phase === 'blocked' && b1.pose === 'blocked' && b1.bubble === `Blocked on #${t3.id}` && b1.deskIndex !== s1.agents.find((a) => a.id === 'ana-claude').deskIndex, JSON.stringify(b1 && [b1.provider, b1.phase, b1.bubble, b1.deskIndex]));
    await ana('ask_human', { question: 'Which login provider?' });
    check('a question shows as waiting for a human', await until(page, () => /1 question waiting[\s\S]*ana/i.test(document.getElementById('needs')?.innerText || '')));
    check('adapter: an agent with an open question raises its hand', (await S(page)).agents.find((a) => a.id === 'ana-claude')?.pose === 'raise_hand');
    // The board's counting rule: a blocked task that waits on an open question is counted once, as the question.
    await bob('ask_human', { question: 'Where is the API key?', task_id: t3.id });
    check('a blocked task with an open question is counted once, as the question (not also as Blocked)', await until(page, () => { const t = document.getElementById('needs')?.innerText || ''; return /2 questions waiting/i.test(t) && !/Blocked/i.test(t); }), (await page.$eval('#needs', (n) => n.innerText).catch(() => '')).replace(/\s+/g, ' '));
    // The presenter's room is big: the words stay in speech bubbles over the tags (the board's small docked room folds them into the tags).
    const bubs = () => page.evaluate(() => ({ bub: [...document.querySelectorAll('.ab-labels .ab-bub')].filter((e) => e.offsetWidth).map((e) => e.textContent), folded: [...document.querySelectorAll('.ab-labels .ab-q.say')].filter((e) => e.offsetWidth).length }));
    check('the presenter\'s big room: each agent with a question has a "Question" speech bubble over its tag', await until(page, () => { const b = [...document.querySelectorAll('.ab-labels .ab-bub')].filter((e) => e.offsetWidth); return b.length === 2 && b.every((e) => e.textContent === 'Question') && ![...document.querySelectorAll('.ab-labels .ab-q.say')].some((e) => e.offsetWidth); }), JSON.stringify(await bubs()));
    // A crowded room with questions on a small screen (a 1024 projector, a phone): the tags never cover each other.
    for (const n of ['cara-claude', 'dev-codex', 'eli-gemini', 'fay-claude', 'gus-codex', 'hal-claude']) await (await agent(board, n, n.endsWith('codex') ? 'codex-mcp-client' : n.endsWith('gemini') ? 'gemini-cli' : 'claude-code'))('board_status');
    for (const [w, h] of [[1024, 768], [390, 844]]) {
      await page.setViewport({ width: w, height: h }); await sleep(400);
      await until(page, `(${tagsApart})().n >= 8 && !(${tagsApart})().bad.length`, null, 6000);
      const ap = await page.evaluate(tagsApart);
      check(`${w}×${h}, 8 agents, 2 with a question: no name tag covers another`, ap.n >= 8 && !ap.bad.length, JSON.stringify(ap));
      const inside = await page.evaluate(tagsInside);
      check(`${w}×${h}, 8 agents: every name tag stays inside the room`, !inside.out.length, JSON.stringify(inside));
      await page.screenshot({ path: path.join(out, `office-tags-${w}.png`) });
    }
    await page.setViewport({ width: 1600, height: 900 }); await sleep(300);
    await ana('update_task', { id: t2.id, status: 'review', note: 'pr' });
    check('adapter: a task sent to review flies a paper plane to the inbox', await until(page, () => window.__officeState.flights.some((f) => f.kind === 'pr' && f.to.station === 'inbox')));
    await human(`/tasks/${t2.id}`, 'PATCH', { status: 'done' });
    check('moving a task to done updates the overlay (2 of 4 done)', await until(page, () => /2 of 4 done/.test(document.body.innerText)));
    const s2 = await S(page);
    check('adapter: the done task is merged on the office board', s2.tickets.find((t) => t.id === `#${t2.id}`)?.status === 'merged' && s2.metrics.merged === 2 && s2.mainCommits === 2);
    check('page title carries the count', /^2\/4 done · Board presenter$/.test(await page.title()), await page.title());
    const simple = await page.$eval('a.simple', (a) => a.getAttribute('href'));
    check('"Simple view" link opens the classic page with the viewer token', simple === `present-classic.html?token=${encodeURIComponent(VIEW)}`, simple);

    // Projector sizes: header, office and side column never overlap, nothing scrolls.
    for (const [w, h] of [[1366, 768], [1920, 1080]]) {
      await page.setViewport({ width: w, height: h }); await sleep(500);
      const lay = await page.evaluate(() => {
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const [t, s, b] = [r('top'), r('scene'), r('bottom')];
        return { scroll: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth, overlap: hit(t, s) || hit(t, b) || hit(s, b), sceneShare: (s.width * s.height) / (innerWidth * innerHeight) };
      });
      check(`${w}×${h}: no overlap, no scrolling, the office gets most of the screen`, !lay.scroll && !lay.overlap && lay.sceneShare > 0.45, JSON.stringify(lay));
      await page.screenshot({ path: path.join(out, `office-${w}.png`) });
    }

    // Theme: the board's choice (localStorage board-theme: one of its fifteen themes, or auto; the old 'light' and 'dark'
    // are the Light and Dark themes) wins over the OS. Auto = no data-theme and follows the OS: Dark or Light. The scene palette follows.
    const BG = { dark: 'rgb(6, 6, 7)', light: 'rgb(241, 242, 244)', dusk: 'rgb(27, 21, 48)', day: 'rgb(239, 228, 207)', night: 'rgb(8, 12, 26)', terminal: 'rgb(2, 10, 4)', contrast: 'rgb(0, 0, 0)', synthwave: 'rgb(19, 8, 36)', sticky: 'rgb(255, 224, 102)', coral: 'rgb(255, 211, 194)' };
    const LT = new Set(['light', 'day', 'sticky', 'coral']); // light themes: light colour scheme
    const themed = async (stored, os) => {
      const tp = watch(await browser.newPage());
      await tp.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: os }]);
      await tp.evaluateOnNewDocument((v) => { try { if (v === null) localStorage.removeItem('board-theme'); else localStorage.setItem('board-theme', v); } catch {} }, stored);
      await tp.goto(`${board.base}/present.html`);
      await until(tp, () => document.documentElement.dataset.scene === 'ready');
      const r = await tp.evaluate(() => ({ theme: document.documentElement.dataset.theme ?? null, bg: getComputedStyle(document.body).backgroundColor, palette: window.__officePalette, scheme: getComputedStyle(document.documentElement).colorScheme, meta: document.getElementById('m-scheme').content }));
      return { tp, ...r };
    };
    const cases = ['dark', 'light', 'dusk', 'day', 'night', 'terminal', 'contrast', 'synthwave', 'sticky', 'coral'].map((t) => [t, t, t]);
    for (const [stored, theme, pal] of cases) {
      const r = await themed(stored, LT.has(stored) ? 'dark' : 'light'); // the OS says the opposite: the choice wins
      check(`board-theme ${stored}: data-theme ${theme}, ${pal} background, ${pal} scene palette, ${LT.has(pal) ? 'light' : 'dark'} colour scheme`, r.theme === theme && r.bg === BG[pal] && r.palette === pal && r.scheme === (LT.has(pal) ? 'light' : 'dark') && r.meta === (LT.has(pal) ? 'light' : 'dark'), JSON.stringify(r.theme) + ' ' + r.bg + ' ' + r.palette + ' ' + r.scheme);
      if (stored === 'night' || stored === 'terminal') await r.tp.screenshot({ path: path.join(out, `office-${stored}.png`) });
      if (stored === 'light' || stored === 'sticky') await r.tp.screenshot({ path: path.join(out, `office-${stored}.png`) });
      await r.tp.close();
    }
    for (const [stored, os, pal] of [[null, 'dark', 'dark'], [null, 'light', 'light'], ['auto', 'dark', 'dark'], ['auto', 'light', 'light'], ['purple', 'light', 'light']]) {
      const r = await themed(stored, os);
      check(`board-theme ${stored ?? '(none)'} over a ${os} OS: no data-theme, ${pal} (Auto follows the OS)`, r.theme === null && r.bg === BG[pal] && r.palette === pal && r.meta === 'light dark', JSON.stringify(r.theme) + ' ' + r.bg + ' ' + r.palette);
      await r.tp.close();
    }
    check('the palette hook is read-only', await page.evaluate(() => { try { window.__officePalette = 'night'; } catch {} return typeof window.__officePalette === 'string' && window.__officePalette !== 'night'; }));
    {
      // The board changes the theme in another tab of the same browser: this one follows, without a reload.
      const a = await themed('day', 'dark');
      const b = await browser.newPage(); await b.goto(`${board.base}/health`);
      for (const [v, theme, pal] of [['terminal', 'terminal', 'terminal'], ['dark', 'dark', 'dark'], ['coral', 'coral', 'coral'], ['night', 'night', 'night']]) {
        await b.evaluate((x) => localStorage.setItem('board-theme', x), v);
        const ok = await until(a.tp, ([t, p]) => document.documentElement.dataset.theme === t && window.__officePalette === p, [theme, pal]);
        check(`another tab sets board-theme ${v}: this presenter switches to ${pal} live`, ok);
      }
      await b.evaluate(() => localStorage.removeItem('board-theme'));
      check('another tab clears board-theme: back to Auto (no data-theme)', await until(a.tp, () => !document.documentElement.hasAttribute('data-theme')));
      await b.close(); await a.tp.close();
    }

    // Reduced motion: no paper planes or celebrations.
    const rp = watch(await browser.newPage());
    await rp.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await rp.goto(`${board.base}/present.html`);
    await until(rp, () => /2 of 4 done/.test(document.body.innerText));
    const t5 = await ana('create_task', { title: 'Dark mode' });
    await ana('claim_task', { id: t5.id }); await ana('update_task', { id: t5.id, status: 'review', note: 'pr' });
    await until(rp, (id) => window.__officeState.tickets.some((t) => t.id === `#${id}` && t.status === 'in_review'), t5.id);
    await sleep(300);
    check('reduced motion: tasks move without paper planes', (await S(rp)).flights.length === 0);
    await rp.close();

    // The scene can't start even though the early probe passed (three.js asks for a context with attributes): fall back.
    const fp = watch(await browser.newPage(), []); // three.js logs its failed context as an error: expected here
    await fp.evaluateOnNewDocument(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, o) { return /webgl/.test(k) && o ? null : g.call(this, k, o); }; });
    await fp.goto(`${board.base}/present.html`);
    check('scene fails to start: falls back to the classic page', await until(fp, () => /present-classic/.test(location.pathname) && /2 of 5 done|of 5 done/.test(document.body.innerText), null, 10000), fp.url());
    await fp.close();

    // A short screen and a long list: Needs attention keeps the rows that fit and counts the rest ("and N more"); no
    // row, and never that line, is cut off at the card's edge. Taller again, the rows come back.
    for (let i = 0; i < 6; i++) {
      const f = await human('/tasks', 'POST', { title: `Blocked filler ${i}` });
      await human(`/tasks/${f.id}`, 'PATCH', { assignee: `filler${i}-claude`, status: 'in_progress' }); await human(`/tasks/${f.id}`, 'PATCH', { status: 'blocked', note: 'waiting' });
    }
    await page.setViewport({ width: 1366, height: 600 });
    await until(page, () => (document.getElementById('needs')?.innerText.match(/Blocked filler/g) || []).length + Number(/and (\d+) more/.exec(document.getElementById('needs')?.innerText || '')?.[1] || 0) === 6);
    await sleep(400);
    const fitAt = () => page.evaluate(() => {
      const card = document.querySelector('#bottom .needs'); const c = card.getBoundingClientRect(); const lis = [...card.querySelectorAll('#needs li')]; const more = card.querySelector('li.more');
      return { cut: lis.some((l) => l.getBoundingClientRect().bottom > c.bottom + 1), rows: card.querySelectorAll('li.b, li.s').length, more: Number(/\d+/.exec(more?.textContent || '')?.[0] || 0), last: lis.at(-1)?.className };
    });
    const short = await fitAt();
    check('1366×600, 6 blocked tasks: Needs attention shows the rows that fit, "and N more" counts the rest, nothing cut off', !short.cut && short.rows + short.more === 6 && short.more > 0 && short.last === 'more', JSON.stringify(short));
    // The top row growing takes room from Needs attention without a resize (here the clock card: no demo time, then a
    // countdown with its verdict; the goal is two lines at most, never taller than that card): fitted again, as a fresh
    // fit would, and the rows come back when the top row is short again.
    const topH = () => page.$eval('#top', (t) => t.offsetHeight);
    const settings = async (body) => { await human('/settings', 'PUT', body); await sleep(800); };
    let height = 600;
    const freshFit = async () => { await page.setViewport({ width: 1366, height: height + 1 }); await sleep(300); await page.setViewport({ width: 1366, height }); await sleep(600); return fitAt(); };
    await settings({ deadline: '', goal: 'A voting app for hackathon projects, with live results on the big screen for everyone' });
    // A height that leaves only a few pixels under the last row, so the top row growing must cost a row.
    const room = await page.evaluate(() => {
      const card = document.querySelector('#bottom .needs'); const rows = [...card.querySelectorAll('li.b, li.s')]; const ul = card.querySelector('ul');
      const left = card.getBoundingClientRect().top + card.clientTop + card.clientHeight - parseFloat(getComputedStyle(card).paddingBottom) - ul.getBoundingClientRect().bottom;
      return { left, step: rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top };
    });
    height += Math.ceil(room.step - room.left) + 3;
    const low = await freshFit(); const lowTop = await topH();
    await settings({ deadline: Date.now() + 2 * 3600e3 });
    const high = await fitAt(); const highTop = await topH();
    const highFresh = await freshFit();
    check('1366×600: a taller top row (the demo time set) refits Needs attention (fewer rows, as a fresh fit, nothing cut off)', highTop > lowTop && highFresh.rows < low.rows && !high.cut && high.rows === highFresh.rows && high.rows + high.more === 6, `top ${lowTop}→${highTop} ${JSON.stringify({ low, high, highFresh })}`);
    await settings({ deadline: '' });
    const back = await fitAt();
    check('…and shorter again, the rows it had no room for come back', !back.cut && back.rows === low.rows && back.rows + back.more === 6, JSON.stringify({ low, back }));
    await settings({ goal: 'A voting app for hackathon projects <b>live</b>' });
    await page.setViewport({ width: 1920, height: 1080 }); await sleep(600);
    const tall = await fitAt();
    check('1920×1080: the rows that fit come back (still none cut off)', !tall.cut && tall.rows > short.rows && tall.rows + tall.more === 6, JSON.stringify(tall));
    // The deadline verdict (two finished M tasks give the board a median) shows before the freeze; in the freeze it
    // doesn't, as on the board.
    await human(`/tasks/${t5.id}`, 'PATCH', { status: 'done' });
    await human('/settings', 'PUT', { deadline: Date.now() + 2 * 3600e3, freeze_minutes: 60 });
    check('before the freeze the deadline verdict shows', await until(page, () => !!document.getElementById('verdict')), await page.$eval('#clock-sub', (c) => c.textContent));
    // The feature freeze is amber on the presenter, as on the board (a phase, not an error).
    await human('/settings', 'PUT', { deadline: Date.now() + 30 * 60e3, freeze_minutes: 60 });
    check('in the feature freeze the countdown is amber (warn), not red', await until(page, () => /Feature freeze/.test(document.getElementById('clock-sub')?.textContent || '') && document.getElementById('clock').className === 'clock warn'), await page.$eval('#clock', (c) => c.className));
    check('in the feature freeze no deadline verdict ("On track"), as on the board', !(await page.$('#verdict')), await page.$eval('#verdict', (v) => v.textContent).catch(() => ''));
    await staleCheck('present.html');
    await hangCheck('present.html');
    await verdictCheck('present.html');
    await crunchCheck('present.html', false);
  }

  // No WebGL at all: straight to the classic page, carrying the token from the link.
  const np = watch(await browser.newPage());
  await np.evaluateOnNewDocument(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, o) { return /webgl/.test(k) ? null : g.call(this, k, o); }; try { localStorage.clear(); } catch {} });
  await np.goto(`${board.base}/present.html?token=${encodeURIComponent(VIEW)}`);
  check('WebGL unavailable: opens the classic presenter with the same token', await until(np, () => /present-classic/.test(location.pathname) && /voting app/.test(document.body.innerText), null, 10000) && await np.evaluate(() => !!localStorage.getItem('board-view-token')), np.url());
  check('the classic page has no token in its address either', !/token=/.test(np.url()), np.url());
  await np.close();

  // No token, a rejected token: the same messages as the classic page.
  const p2 = watch(await browser.newPage());
  await p2.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch {} });
  await p2.goto(`${board.base}/present.html`);
  check('no token: explains how to open it', await until(p2, () => /Presenter view/.test(document.body.innerText)));
  await p2.close();
  const p3 = watch(await browser.newPage(), []); // the refused token logs its 401: expected here
  await p3.goto(`${board.base}/present.html?token=nope`);
  check('a rejected token: "This presenter link has expired"', await until(p3, () => /presenter link has expired/.test(document.body.innerText)));
  check('a rejected token: no "Connecting…" in the header next to that message', !/Connecting/.test(await p3.evaluate(() => document.body.innerText)), await p3.$eval('#top', (t) => t.innerText).catch(() => ''));
  check('never holds the board token', await p3.evaluate((t) => !Object.keys(localStorage).some((k) => localStorage.getItem(k) === t), TOKEN));
  await p3.close();
  // M6: a link's key is saved once the board has answered with it. A bad link doesn't replace the key the screen holds.
  const p4 = watch(await browser.newPage(), []);
  await p4.evaluateOnNewDocument((k) => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('board-view-token', k); } } catch {} }, VIEW);
  await p4.goto(`${board.base}/present.html?token=nope`);
  check('M6: a rejected link: the key the screen already held is still saved', await until(p4, () => /presenter link has expired/.test(document.body.innerText)) && await p4.evaluate(() => localStorage.getItem('board-view-token')) === VIEW);
  await p4.close();
  const p5 = watch(await browser.newPage(), []);
  await p5.evaluateOnNewDocument(() => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.clear(); } } catch {} });
  await p5.goto(`${board.base}/present.html?token=${encodeURIComponent(VIEW)}`);
  check('M6: a good link: the key is saved once the board has loaded, and the address bar is clean', await until(p5, () => /voting app/.test(document.body.innerText)) && await p5.evaluate(() => localStorage.getItem('board-view-token')) === VIEW && !/token=/.test(p5.url()));
  await p5.close();

  // The board's header link still opens this page with the viewer token.
  const mp = await browser.newPage();
  await mp.goto(`${board.base}/?token=${TOKEN}&name=dana`);
  await mp.waitForSelector('#app:not([hidden])', { timeout: 8000 });
  await until(mp, () => !document.getElementById('present-link').hidden);
  const href = await mp.$eval('#present-link', (a) => a.getAttribute('href'));
  check('the board header link opens present.html with the viewer token', /\/present\.html\?token=/.test(href) && href.includes(encodeURIComponent(VIEW)) && !href.includes(TOKEN), href);
  await mp.close();
  check('no console errors', !errors.length, errors.join('; '));
} catch (e) {
  R.push(`CRASH ${e.message}`);
}
await finish(R, { browser, board });
