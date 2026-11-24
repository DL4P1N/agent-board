// Deadline verdict in the clock pill ("On track" / "Tight" / "Behind by ~N tasks") and the extra
// "What to do now" signals: P3 tasks that won't make it, review backlog, tasks sent back twice, agents out of usage.
// Starts its own throwaway board. Run all suites with: npm test
import path from 'node:path';
import { startBoard, launchBrowser, shotsDir, finish, agent, rest } from '../helpers.mjs';

const board = await startBoard();
const BASE = board.base;
const out = shotsDir('verdict');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const human = (p, method, body) => rest(board, 'dana', p, method, body);
const db = async (fn) => { const { DatabaseSync } = await import('node:sqlite'); const d = new DatabaseSync(path.join(board.dataDir, 'board.db')); try { fn(d); } finally { d.close(); } };

// Two Codex agents: one task at a time each, so the team has 2 slots.
const alice = await agent(board, 'alice', 'codex-mcp-client');
const bob = await agent(board, 'bob', 'codex-mcp-client');
await alice('board_status'); await bob('board_status');
await alice('set_goal', { goal: 'A voting app for hackathon projects.' });
await alice('claim_role', { role: 'planner' });
// Demo in 3h, freeze 60 min before: 2h to the freeze.
await human('/settings', 'PUT', { deadline: Date.now() + 3 * 3600e3, freeze_minutes: 60 });

const finished = [];
async function finishOne(title) {
  const t = await alice('create_task', { title });
  await alice('claim_task', { id: t.id });
  // Merged by a human (bob is online, so alice may not mark her own work done).
  await human(`/tasks/${t.id}`, 'PATCH', { status: 'done', note: 'merged' });
  finished.push(t.id);
}
const openTasks = async (n, priority = 2) => { for (let i = 0; i < n; i++) await alice('create_task', { title: `Feature ${priority}-${Math.random().toString(36).slice(2, 7)}`, priority }); };

await finishOne('Scaffolding'); await finishOne('Schema');
await openTasks(2);

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 900 } });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|ERR_CONNECTION|EventSource/i.test(m.text()) && errors.push('console: ' + m.text()));
  page.on('dialog', (d) => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); localStorage.setItem('board-setup', 'closed'); } catch {} });
  const txt = (sel) => page.$eval(sel, (e) => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
  const reload = async () => { await page.evaluate(() => load()); await sleep(250); };
  const pill = () => page.$eval('#clock', (e) => ({ t: e.querySelector('.o-x').textContent.replace(/\s+/g, ' ').trim(), tip: e.title, label: e.getAttribute('aria-label'), vd: e.querySelector('.vd')?.className || '' }));
  // The verdict word as shown: on screen (not hidden by the width rules) and not cut.
  const shownWord = () => page.$eval('#clock', (e) => { const v = e.querySelector('.vd'), r = e.querySelector('.rest'); return { shown: !!v?.getClientRects().length, cut: !!r && r.scrollWidth > r.clientWidth + 1, w: innerWidth }; });
  await page.goto(BASE + '/');
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 5000 });
  await sleep(300);

  // ---- no stats yet (2 done): the countdown as before, the reason in the tooltip ----
  let c = await pill();
  check('fewer than 3 done: pill keeps the plain countdown', /^in 2h 5\dm · freeze (?:\w{3} )?\d\d?:\d\d(?: ?[AP]M)?$|^in 3h 0m · freeze/.test(c.t) && !c.vd, c.t);
  check('fewer than 3 done: tooltip says there is not enough to estimate', /Not enough finished tasks to estimate yet/.test(c.tip), c.tip);

  // ---- 3 done, each took 30 min from claim to done: median M = 30 ----
  await finishOne('Login');
  await db((d) => d.prepare(`UPDATE events SET ts = ts - ? WHERE kind = 'task_claimed' AND task_id IN (${finished.join(',')})`).run(30 * 60e3));
  await human('/messages', 'POST', { text: 'pace check' }); // a new event, so the server recomputes its stats
  const st = await human('/state');
  check('server stats: median M = 30 min', st.stats?.minutes?.M === 30, JSON.stringify(st.stats));
  await reload();
  check('two Codex agents online = 2 slots', await page.evaluate(() => teamCapacity().slots) === 2, String(await page.evaluate(() => teamCapacity().slots)));

  // 2 open M tasks = 60 min over 2 slots = 30 min, against 120 min to the freeze.
  c = await pill();
  check('2 tasks left: "on track" follows the time in the pill', /^in (?:2h 5\dm|3h 0m)(?: · freeze .+)? · on track$/.test(c.t) && /\bok\b/.test(c.vd), c.t);
  check('verdict tooltip explains the estimate', /About 30m of work left \(2 tasks .*2 agent slots online\) and (?:1h 5\dm|2h 0m) to the freeze/.test(c.tip), c.tip);
  check('aria-label carries the verdict', /^Demo in .* · On track\. /.test(c.label), c.label);
  // 1101-1699px: "on track" is the time's colour (the word is the tooltip); tight and behind keep their word (U3).
  const ow = await shownWord();
  check('1440px: "on track" is the time\'s colour (the word is in the tooltip)', !ow.shown && await page.$eval('#clock .tm', (t) => getComputedStyle(t).color !== getComputedStyle(t.closest('.tbc')).color), JSON.stringify(ow));

  // UM6: 5 tasks waiting on each other in a row are 150 min whatever the number of agents; with the 2 open tasks, 7 M tasks
  // over 2 slots would be 105 min and fit the ~120 min to the freeze, the chain doesn't.
  const chainIds = []; let prev = null;
  for (let i = 0; i < 5; i++) { const t = await alice('create_task', { title: `Chain ${i + 1}`, ...(prev ? { depends_on: [prev] } : {}) }); chainIds.push(t.id); prev = t.id; }
  await reload();
  c = await pill();
  check('UM6: a chain of 5 dependent tasks (150 min) is behind, though 7 tasks over 2 slots would fit', /· behind by ~\d+$/.test(c.t) && /5 tasks wait on each other in a row/.test(c.tip), c.t + ' | ' + c.tip);
  for (const id of chainIds) await human(`/tasks/${id}`, 'DELETE');
  // An L with no L sample counts twice an M (60 min), not as an M: 3 L and 2 M are 240 min over 2 slots, tight.
  const bigIds = [];
  for (const size of ['L', 'L', 'L']) bigIds.push((await alice('create_task', { title: `Big ${bigIds.length}`, size })).id);
  await reload();
  c = await pill();
  check('UM6: 3 L tasks with no L sample count twice an M (tight, not on track)', /· tight$/.test(c.t), c.t);
  for (const id of bigIds) await human(`/tasks/${id}`, 'DELETE');
  await reload();

  // 8 tasks = 240 min / 2 = 120 min against ~120: tight.
  await openTasks(6); await reload();
  c = await pill();
  check('8 tasks left: "Tight"', /^in .* · tight$/.test(c.t) && /tight/.test(c.vd), c.t);
  const tw = await shownWord();
  check('U3 1440px: "tight" is shown as a word, not only amber', tw.shown && !tw.cut, JSON.stringify(tw));
  check('tight: no "won\'t make it" item yet', !/won't make it/.test(await txt('#now')), await txt('#now'));

  // 16 tasks = 240 min of team time against 120: behind by ~8; 5 of them are unstarted P3s.
  await openTasks(3); await openTasks(5, 3); await reload();
  c = await pill();
  check('16 tasks left: "Behind by ~8 tasks"', /^in .* · behind by ~8$/.test(c.t) && /Behind by ~8 tasks/.test(c.tip) && /behind/.test(c.vd), c.t);
  let now = await txt('#now');
  check('behind: What to do now names the P3s that won\'t make it', /5 P3 tasks probably won't make it/.test(now), now);
  // One header row with the verdict, at the widths people use.
  for (const w of [1280, 1366, 1600]) {
    await page.setViewport({ width: w, height: 900 }); await sleep(250);
    const hd = await page.evaluate(() => { const h = document.querySelector('#app > header'); const c = $('clock').getBoundingClientRect(); const g = $('goal-btn').getBoundingClientRect(); const s = $('topbar').querySelector('[data-fk="s-open"]').getBoundingClientRect(); return { h: h.offsetHeight, tb: $('topbar').offsetHeight, same: Math.abs(c.top - g.top) < 4 && Math.abs(c.bottom - s.bottom) < 12 }; });
    const vw = await shownWord();
    check(`${w}px: the header and the top bar each stay one row, with the verdict word ("behind by ~8") in the Demo chip, not cut (U3)`, hd.same && hd.h < 70 && hd.tb < 56 && vw.shown && !vw.cut, JSON.stringify({ ...hd, ...vw }));
    await page.screenshot({ path: `${out}/behind-header-${w}.png`, clip: { x: 0, y: 0, width: w, height: 200 } });
  }
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await sleep(300);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check('390px: no horizontal overflow with the verdict', ov <= 0, ov + 'px');
  await page.screenshot({ path: `${out}/behind-phone.png` });
  await page.setViewport({ width: 1440, height: 900 }); await sleep(250);

  // The item opens the list; each entry opens the task. Nothing is cut by itself.
  await page.click('#now [data-go="cut"]'); await sleep(250);
  const list = await page.$$eval('#cut-list [data-open-task]', (b) => b.map((x) => x.textContent));
  check('clicking it lists the 5 P3 tasks, focus on the first', list.length === 5 && list.every((x) => /Feature 3-/.test(x)) && await page.evaluate(() => document.activeElement?.closest('#cut-list') != null), JSON.stringify(list));
  await page.click('#cut-list [data-open-task]'); await sleep(300);
  check('an entry opens that task in the editor', await page.evaluate(() => $('task-dlg').open));
  await page.keyboard.press('Escape'); await sleep(200);
  const st2 = await human('/state');
  check('no task was moved or deleted', st2.tasks.filter((t) => t.status === 'open').length === 16, String(st2.tasks.filter((t) => t.status === 'open').length));

  // 24 left, 13 P3: behind by ~16, but never more than half of what's left (12) is suggested.
  await openTasks(8, 3); await reload();
  now = await txt('#now');
  check('cap: at most half of what\'s left (12 of 24)', /12 P3 tasks probably won't make it/.test(now) && /· behind by ~16$/.test((await pill()).t), now);
  await page.screenshot({ path: `${out}/behind-now.png`, clip: { x: 0, y: 0, width: 1440, height: 260 } });

  // No demo time: no verdict, no pill.
  await human('/settings', 'PUT', { deadline: '' }); await reload();
  check('no deadline: no countdown, no verdict', await page.evaluate(() => $('clock').classList.contains('unset') && !$('clock').querySelector('.vd') && outlook() === null && !/won't make it/.test($('now').innerText)));

  // ================= more "needs attention" signals =================
  const st3 = await human('/state');
  const p3 = st3.tasks.filter((t) => t.status === 'open' && t.priority === 3).map((t) => t.id);
  for (const id of p3) await human(`/tasks/${id}`, 'DELETE');
  // A task sent back from review twice.
  const bounce = await alice('create_task', { title: 'Vote API with rate limit' });
  await alice('claim_task', { id: bounce.id });
  for (let i = 0; i < 2; i++) {
    await alice('update_task', { id: bounce.id, status: 'review', note: 'PR ready' });
    await human(`/tasks/${bounce.id}`, 'PATCH', { status: 'in_progress', note: 'tests fail' });
  }
  const st4 = await human('/state');
  check('state.rejects counts the bounces', st4.rejects?.[bounce.id] === 2, JSON.stringify(st4.rejects));
  await reload();
  now = await txt('#now');
  check('a task back from review twice leads What to do now', new RegExp(`#${bounce.id} Vote API with rate limit came back from review 2 times`).test(now), now);
  await page.click('#now [data-go="rejected"]'); await sleep(300);
  check('clicking it opens that task', await page.evaluate((id) => $('task-dlg').open && $('td-title').textContent === `Task #${id}`, bounce.id), String(bounce.id));
  await page.keyboard.press('Escape'); await sleep(200);

  // Review backlog: 4 in review with a merger picked.
  await human('/settings', 'PUT', { integrator: 'bob' });
  const st5 = await human('/state');
  const four = st5.tasks.filter((t) => t.status === 'open').slice(0, 4).map((t) => t.id);
  for (const id of four) { await bob('claim_task', { id }); await bob('update_task', { id, status: 'review', note: 'PR ready' }); }
  // Usage limit: alice is out.
  await human('/agents/alice', 'PATCH', { limited: true });
  await reload();
  now = await txt('#nyou');
  check('review backlog of 4 is listed', /4 tasks waiting in Review/.test(now), now);
  check('an agent out of usage is not a to-do (Agents and its cards show it)', !/out of usage/.test(now), now);
  await page.click('#nyou [data-go="review"]'); await sleep(400);
  check('the review item jumps to the Review column', await page.evaluate(() => !!document.activeElement?.closest('#col-review')));
  await page.screenshot({ path: `${out}/signals-now.png`, clip: { x: 0, y: 0, width: 1440, height: 260 } });

  // Only one item left: the limit leads with its own words.
  for (const id of four) await human(`/tasks/${id}`, 'PATCH', { status: 'done' });
  await human(`/tasks/${bounce.id}`, 'PATCH', { status: 'done' });
  await reload();
  now = await txt('#now');
  check('alone, the limit is not a to-do either (Agents shows it)', !/usage limit/.test(now), now);
  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  results.push(`CRASH ${e.stack}`);
}
await finish(results, { browser, board });
