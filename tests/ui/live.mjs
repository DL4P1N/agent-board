// Live updates and keyboard focus: what an event does to the page (drawn from its payload, one load at a time, nothing
// drawn in a hidden tab, feed lines kept), double sends, Undo and Reject, Escape, focus after commands, and a few
// semantics. Starts its own throwaway board. Run all suites with: npm test
import { startBoard, launchBrowser, shotsDir, finish, agent, rest } from '../helpers.mjs';

const board = await startBoard();
const out = shotsDir('live');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = (page, fn, arg, timeout = 5000) => page.waitForFunction(fn, { timeout }, arg).then(() => true).catch(() => false);
const events = async () => (await rest(board, 'dana', '/state')).events;

const alice = await agent(board, 'alice');
const bob = await agent(board, 'bob', 'codex-mcp-client');
await alice('board_status'); await bob('board_status');
await alice('set_goal', { goal: 'A voting app for hackathon projects. Demo: submit, vote, live leaderboard.' });
await alice('claim_role', { role: 'planner' });
const t1 = await alice('create_task', { title: 'Project scaffolding' });
const t2 = await alice('create_task', { title: 'Vote API', depends_on: [t1.id] });
const t3 = await alice('create_task', { title: 'Leaderboard page' });
await alice('claim_task', { id: t3.id }); await alice('update_task', { id: t3.id, status: 'in_progress' });
await alice('post', { text: 'Opened https://github.com/team/vote/pull/49 for review' });

const browser = await launchBrowser({ office: true, headless: true, defaultViewport: { width: 1440, height: 1000 } });
const errors = [];
const watch = (p) => {
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource|ERR_|EventSource/i.test(m.text()) && errors.push('console: ' + m.text()));
  p.on('dialog', (d) => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
};
const signIn = (p, extra = {}) => p.evaluateOnNewDocument((x) => { try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); localStorage.setItem('board-setup', 'closed'); for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v); } catch {} }, extra);

try {
  const page = await browser.newPage(); watch(page);
  // U14: the last session's open DM thread (as an older page stored it) isn't reopened.
  await signIn(page, { 'board-tab': 'direct', 'board-dm': 'alice' });
  const stateReqs = [];
  page.on('request', (r) => { if (r.url().includes('/api/state')) stateReqs.push(Date.now()); });
  await page.goto(board.base + '/');
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
  await sleep(800);
  check('U14 a reload doesn\'t reopen the last DM thread', await page.evaluate(() => !ui.dm));
  await page.evaluate(() => document.querySelector('#tabs [data-tab="all"]')?.click()); await sleep(200);

  // ---- U11 / A3: the feed's words and links ----
  const feed = await page.evaluate(() => ({ t: $('feed').innerText, pr: [...document.querySelectorAll('#feed a[href*="/pull/49"]')].map((a) => ({ text: a.textContent, title: a.title, ti: a.getAttribute('tabindex') })) }));
  check('U11 status changes in the feed use the board\'s words ("In progress"), not ids', /In progress/.test(feed.t) && !/in_progress/.test(feed.t), feed.t.slice(0, 300));
  check('U11 a pull request link reads "PR #49" (the address in its tooltip)', feed.pr.length === 1 && feed.pr[0].text === 'PR #49' && /github\.com\/team\/vote\/pull\/49/.test(feed.pr[0].title), JSON.stringify(feed.pr));
  check('A3 a link in a message is a Tab stop', feed.pr.length === 1 && feed.pr[0].ti !== '-1', JSON.stringify(feed.pr));

  // ---- P1 / J3: plain messages are drawn from the event (no /api/state), the feed's lines stay ----
  await page.evaluate(() => { document.querySelector('#feed .ev').__keep = 1; });
  stateReqs.length = 0;
  for (let i = 1; i <= 5; i++) { await bob('post', { text: `live line ${i}` }); await sleep(80); }
  const drawn = await until(page, () => /live line 5/.test(document.getElementById('feed').innerText));
  await sleep(500);
  check('P1 five chat messages are drawn from the stream, without fetching the whole board', drawn && stateReqs.length === 0, `${stateReqs.length} /api/state fetches`);
  check('J3 a new line is added to the feed: the lines already there stay (not redrawn)', await page.evaluate(() => [...document.querySelectorAll('#feed .ev')].some((e) => e.__keep === 1)));
  check('J3 "Xm ago" is a <time> updated in place', await page.evaluate(() => !!document.querySelector('#feed time[data-ts]')));
  // A change that isn't a plain message (a task moved) still loads the board.
  stateReqs.length = 0;
  await alice('update_task', { id: t3.id, status: 'in_progress', note: 'halfway' }); await sleep(800);
  check('P1 a task event still loads the board (once)', stateReqs.length >= 1 && stateReqs.length <= 2, `${stateReqs.length}`);

  // ---- J7: a hidden tab keeps the events but draws nothing until it's shown ----
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await bob('post', { text: 'said while hidden' }); await alice('update_task', { id: t3.id, status: 'in_progress', note: 'still going' }); await sleep(900);
  const hid = await page.evaluate(() => ({ kept: state.events.some((e) => e.text === 'said while hidden'), drawn: /said while hidden/.test($('feed').innerText) }));
  check('J7 hidden tab: the events are kept, not drawn', hid.kept && !hid.drawn, JSON.stringify(hid));
  await page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
  check('J7 shown again: drawn at once', await until(page, () => /said while hidden/.test(document.getElementById('feed').innerText), undefined, 1500));

  // ---- J1: Enter twice sends once; typing during the send is kept ----
  await page.click('#msg'); await page.type('#msg', 'double enter check');
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await sleep(900);
  const dbl = (await events()).filter((e) => e.text === 'double enter check').length;
  check('J1 chat: Enter twice while sending posts one message', dbl === 1, `${dbl} posted`);

  // ---- J2 (and J1's typing): request interception: a late /api/state and a slow post ----
  await page.setRequestInterception(true);
  let lateState = 0, slowPost = 0;
  const onReq = async (req) => {
    try {
      if (lateState && req.url().includes('/api/state')) {
        const ms = lateState; lateState = 0;
        const h = Object.fromEntries(Object.entries(req.headers()).filter(([k]) => /^(authorization|x-)/i.test(k)));
        const body = await (await fetch(req.url(), { headers: h })).text(); // the board as it is now...
        await sleep(ms); return req.respond({ status: 200, contentType: 'application/json', body }); // ...arriving late
      }
      if (slowPost && req.method() === 'POST' && /\/api\/messages/.test(req.url())) { const ms = slowPost; slowPost = 0; await sleep(ms); }
      return req.continue();
    } catch { try { req.continue(); } catch {} }
  };
  page.on('request', onReq);
  lateState = 900;
  await page.evaluate(() => { load(); });
  await sleep(150);
  await bob('post', { text: 'stale-load check' }); await alice('update_task', { id: t3.id, status: 'in_progress', note: 'newer' });
  await sleep(1800);
  check('J2 a slow, older /api/state answer doesn\'t overwrite a newer one (the message stays)', await page.evaluate(() => state.events.some((e) => e.text === 'stale-load check') && /stale-load check/.test($('feed').innerText)));
  slowPost = 700;
  await page.click('#msg'); await page.type('#msg', 'first part');
  await page.keyboard.press('Enter'); await page.type('#msg', 'second part'); await sleep(1300);
  check('J1 chat: what is typed while a message is sending is kept', await page.evaluate(() => $('msg').value === 'second part'), await page.evaluate(() => $('msg').value));
  page.off('request', onReq); await page.setRequestInterception(false);
  await page.evaluate(() => { $('msg').value = ''; });

  // ---- J1: a new task saved with Ctrl+Enter twice ----
  await page.click('#new-task-btn'); await page.waitForSelector('#task-dlg[open]');
  await page.type('#td-name', 'Saved twice?'); await page.click('#td-desc');
  await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.up('Control');
  await sleep(900);
  const twice = (await rest(board, 'dana', '/state')).tasks.filter((t) => t.title === 'Saved twice?').length;
  check('J1 new task: Ctrl+Enter twice creates one task', twice === 1, `${twice} created`);
  await page.evaluate(() => { const d = $('task-dlg'); if (d.open) d.close(); });

  // ---- J5 / A11: the task dialog keeps unsaved edits ----
  await page.evaluate((id) => openTask(id), t2.id); await page.waitForSelector('#task-dlg[open]');
  await page.click('#td-name', { count: 3 }); await page.type('#td-name', 'Vote API v2');
  await page.click(`#task-dlg [data-open-task="${t1.id}"]`); await sleep(200);
  check('J5 a #ref in the dialog asks before dropping unsaved edits', await page.evaluate(() => !$('td-discard').hidden && $('td-name').value === 'Vote API v2'));
  await page.keyboard.press('Escape'); await sleep(200);
  check('A11 Escape on "Discard them?" keeps editing (the dialog stays, with the edits)', await page.evaluate(() => $('task-dlg').open && $('td-discard').hidden && $('td-name').value === 'Vote API v2' && document.activeElement === $('td-name')));
  await page.keyboard.press('Escape'); await sleep(150);
  check('A11 Escape again asks again', await page.evaluate(() => $('task-dlg').open && !$('td-discard').hidden));
  await page.click(`#task-dlg [data-open-task="${t1.id}"]`); await sleep(150);
  await page.click('#td-drop'); await sleep(300);
  check('J5 "Discard" then opens the #ref\'s task', await page.evaluate((title) => $('task-dlg').open && $('td-name').value === title, t1.title));
  await page.evaluate(() => $('task-dlg').close()); await sleep(200);

  // ---- J10 / M9 / A4: Undo after a move ----
  const undo = (how) => page.evaluate((h) => [...document.querySelectorAll('#toasts button')].find((b) => b.textContent === 'Undo')?.[h](), how);
  await page.click(`[data-move="${t3.id}"]`); await page.click(`[data-move-to="open"]`);
  await until(page, () => [...document.querySelectorAll('#toasts button')].some((b) => b.textContent === 'Undo'));
  await undo('focus'); await undo('click'); // from the keyboard: focus was on the toast's button
  await until(page, (id) => taskById(id)?.status === 'in_progress', t3.id);
  await sleep(300);
  check('M9 after Undo, focus is on the card it moved back', await page.evaluate((id) => document.activeElement?.closest?.('.card')?.dataset.id === String(id), t3.id), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  await sleep(600);
  await page.click(`[data-move="${t3.id}"]`); await page.click(`[data-move-to="open"]`);
  await until(page, () => [...document.querySelectorAll('#toasts button')].some((b) => b.textContent === 'Undo'));
  await undo('focus');
  await sleep(9000);
  check('A4 an Undo toast stays while it has focus (past its 8 seconds)', !!(await page.evaluate(() => [...document.querySelectorAll('#toasts button')].some((b) => b.textContent === 'Undo'))));
  await bob('claim_task', { id: t3.id });
  await until(page, (id) => taskById(id)?.assignee === 'bob', t3.id);
  await undo('click'); await sleep(900);
  const after = (await rest(board, 'dana', '/state')).tasks.find((t) => t.id === t3.id);
  check('J10 Undo after an agent claimed the task meanwhile leaves it with that agent, and says so', after.assignee === 'bob' && after.status === 'claimed' && /changed since you moved it/.test(await page.$eval('#toasts', (t) => t.innerText)), JSON.stringify({ a: after.assignee, s: after.status }));

  // ---- A11 / M9: Reject on a proposed card ----
  const p1 = await bob('create_task', { title: 'Confetti on vote' });
  const p2 = await bob('create_task', { title: 'Dark mode toggle' });
  await page.waitForSelector(`[data-reject="${p2.id}"]`);
  await page.evaluate((id) => document.querySelector(`[data-reject="${id}"]`).click(), p1.id); await page.waitForSelector(`#rj-${p1.id}`);
  await page.keyboard.press('Escape'); await sleep(200);
  check('A11 Escape in a card\'s Reject reason closes it, focus back on Reject', await page.evaluate((id) => !$(`rj-${id}`) && document.activeElement?.dataset.reject === String(id), p1.id));
  await page.evaluate((id) => document.querySelector(`[data-reject="${id}"]`).click(), p1.id); await page.waitForSelector(`#rj-${p1.id}`);
  await page.type(`#rj-${p1.id}`, 'out of scope'); await page.keyboard.press('Enter');
  await until(page, (id) => !document.querySelector(`.card[data-id="${id}"]`), p1.id); await sleep(400);
  check('M9 after Reject, focus is on a card (not lost to the page)', await page.evaluate(() => !!document.activeElement?.closest?.('.card')), await page.evaluate(() => document.activeElement?.tagName));

  // ---- A12 / A13: semantics ----
  const sem = await page.evaluate(() => ({
    nowH: document.querySelector('#now .nl')?.tagName, qH: $('q-h')?.tagName, msgRole: $('msg').getAttribute('role'),
    tabs: $('tabs').getAttribute('role') === 'group' && !!$('tabs').getAttribute('aria-label'),
    regions: document.querySelectorAll('#board .col[role="region"]').length, colH: document.querySelector('#col-open h3')?.textContent.replace(/\s+/g, ' ').trim(),
    down: $('downbar')?.getAttribute('role') || '',
  }));
  check('A12 headings: What to do now and the questions are h3 under Needs attention', sem.nowH === 'H3' && sem.qH === 'H3', JSON.stringify(sem));
  check('A12 the message box is a plain textbox; the Activity filters are a labelled group; columns aren\'t regions', !sem.msgRole && sem.tabs && sem.regions === 0, JSON.stringify(sem));
  check('A12 a column heading reads "Open, N tasks" (not "Open5")', /^Open, \d+ tasks?/.test(sem.colH), sem.colH);
  check('A13 a lost connection is announced once (the down bar isn\'t an alert too)', sem.down !== 'alert', sem.down);

  // ---- U17: help mentions direct messages ----
  check('U17 help: direct messages are explained', await page.evaluate(() => /For one agent only, use Direct in Activity/.test($('help-dlg').textContent.replace(/\s+/g, ' '))));

  // ---- U13: Setup step 4 names the planner and points to where it's chosen ----
  await page.evaluate(() => { ui.forceSetup = true; goStep('backlog'); }); await sleep(300);
  check('U13 Setup step 4: "Planner: …" with Change…, no second planner chooser', await page.evaluate(() => !$('plan-sel') && !!document.querySelector('#step-backlog [data-act="pick-planner"]') && /Planner: alice/.test($('step-backlog').innerText)), await page.$eval('#step-backlog', (e) => e.innerText.slice(0, 200)).catch(() => ''));
  await page.click('#step-backlog [data-act="pick-planner"]'); await sleep(300);
  check('U13 Change… opens the planner choice in the top bar', await page.evaluate(() => !$('o-roles').hidden || !$('o-plan').hidden));
  await page.keyboard.press('Escape');
  await page.evaluate(() => { ui.forceSetup = false; localStorage.setItem('board-setup', 'closed'); render(); }); await sleep(200);

  // ---- A5 / A7: Ctrl+K ----
  await page.evaluate((id) => document.querySelector(`.card[data-id="${id}"]`).focus(), t1.id);
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForSelector('#pal-dlg[open]'); await page.type('#pal-in', 'show'); await sleep(500);
  check('A5 Ctrl+K: the result count is announced inside the dialog', await page.evaluate(() => { const c = $('pal-count'); return !!c && $('pal-dlg').contains(c) && c.getAttribute('role') === 'status' && /\d+ results?/.test(c.textContent); }));
  await page.click('#pal-in', { count: 3 }); await page.type('#pal-in', 'Show Table'); await sleep(200); await page.keyboard.press('Enter'); await sleep(500);
  check('A7 Show Table from a focused card: focus lands on a control, not the page', await page.evaluate(() => !$('tasktable').hidden && document.activeElement && document.activeElement !== document.body && !!document.activeElement.offsetParent), await page.evaluate(() => document.activeElement?.tagName));

  // ---- A6: Skip to tasks in the Table view ----
  await page.evaluate(() => document.activeElement?.blur());
  await page.evaluate(() => document.querySelector('[data-skip="tasks"]').click()); await sleep(300);
  check('A6 Skip to tasks in the Table view focuses the table', await page.evaluate(() => $('tasktable').contains(document.activeElement)), await page.evaluate(() => document.activeElement?.tagName));
  await page.evaluate(() => $('viewtog').querySelector('[data-view="columns"]').click()); await sleep(300);

  // ---- J11 / M9: a second tab follows the panels' fold state; a folded title bar's click focuses its fold button ----
  const page2 = await browser.newPage(); watch(page2); await signIn(page2);
  await page2.goto(board.base + '/'); await page2.waitForSelector('#o-act'); await sleep(600);
  await page.bringToFront(); await page.click('[data-o-fold="act"]'); await sleep(500);
  check('J11 folding Activity in one tab folds it in the other too', await page2.evaluate(() => $('o-act').classList.contains('folded')));
  await page.click('#o-act > .o-head h2'); await sleep(400);
  check('M9 a click on a folded title bar opens it, focus on its fold button', await page.evaluate(() => !$('o-act').classList.contains('folded') && document.activeElement?.dataset.oFold === 'act'), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  await page2.close();

  // ---- U4: with questions leading, the Blocked list isn't repeated under "Also" ----
  await bob('update_task', { id: t3.id, status: 'blocked', note: 'need a design' });
  await alice('ask_human', { question: 'Should votes be anonymous?' });
  await until(page, () => !!document.querySelector('#questions .qcard') && !!document.querySelector('#o-blocked li, #o-blocked .blk, #o-blocked button'));
  await sleep(300);
  check('U4 the blocked task is listed once (in Blocked), not also under "Also"', await page.evaluate(() => !/blocked/i.test(document.querySelector('#nyou .also')?.textContent || '')), await page.$eval('#nyou', (e) => e.innerText.replace(/\s+/g, ' ')));
  await page.screenshot({ path: `${out}/live-board.png` });

  // ---- 3D: A1 (Setup closes when focus leaves it) and A2 (focus kept when 3D turns off) ----
  const p3 = await browser.newPage(); watch(p3); await signIn(p3);
  await p3.goto(board.base + '/?view=office');
  const office = await until(p3, () => document.documentElement.dataset.boardView === 'office', undefined, 8000);
  if (office) {
    await sleep(800);
    await p3.evaluate(() => document.querySelector('[data-act="setup-open"]').click()); await sleep(400);
    await p3.evaluate(() => $('setup').querySelector('button, a[href], input, select, textarea').focus());
    await p3.evaluate(() => $('tsearch').focus()); await sleep(400);
    check('A1 3D: focus leaving Setup (Tab past it) closes it', await p3.evaluate(() => $('setup').hidden || !$('setup').offsetWidth));
    await p3.evaluate((id) => document.querySelector(`#o-tasks .card[data-id="${id}"]`).focus(), t1.id);
    await p3.keyboard.down('Control'); await p3.keyboard.press('k'); await p3.keyboard.up('Control');
    await p3.waitForSelector('#pal-dlg[open]'); await p3.type('#pal-in', '3d office'); await sleep(200); await p3.keyboard.press('Enter');
    await until(p3, () => document.documentElement.dataset.boardView !== 'office'); await sleep(800);
    check('A2 turning 3D off keeps focus on the card it was on', await p3.evaluate((id) => document.activeElement?.closest?.('.card')?.dataset.id === String(id), t1.id), await p3.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  } else check('3D view available for the A1/A2 checks', false);
  await p3.close();
} catch (e) { results.push('CRASH ' + e.stack); }
check('no page/console errors or native dialogs', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
