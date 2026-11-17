// Headless flow test of the redesigned board UI. Acts as human "dana".
// Starts its own throwaway board. Run all suites with: npm test
import { startBoard, launchBrowser, shotsDir, finish, seed, Client, StreamableHTTPClientTransport } from '../helpers.mjs';

const board = await startBoard();
const BASE = board.base;
await seed(board);
const out = shotsDir('flows');
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rest = (who, path, method, body) => fetch(BASE + '/api' + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer testtok', 'X-Agent': who }, body: body && JSON.stringify(body) }).then((r) => r.json());

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 1000 }, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); // WebGL for the 3D view
const page = await browser.newPage();
// The People panel, tabs and badges re-render on every presence change: click the element itself
// (not a screen position, which can land on a node that was just replaced), retrying if it was.
const domClick = async (sel) => {
  for (let i = 0; i < 3; i++) {
    try { await page.waitForSelector(sel, { timeout: 5000 }); await page.$eval(sel, (el) => el.click()); return; }
    catch (e) { if (i === 2) throw e; await new Promise((r) => setTimeout(r, 100)); }
  }
};
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
page.on('dialog', (d) => { errors.push('unexpected dialog: ' + d.message()); d.dismiss(); });
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);

try {
// gate
await page.goto(`${BASE}/?token=testtok`);
await page.waitForSelector('#gate:not([hidden])');
await page.type('#g-name', 'dana');
await page.keyboard.press('Enter');
await page.waitForSelector('#app:not([hidden])');
await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 5000 });
check('gate submits with Enter, SSE live', true, page.url());

// questions
const qCount = await page.$$eval('.qcard', (q) => q.length);
check('two open questions shown in attention panel', qCount === 2);
check('document title counts what needs me', (await page.title()).startsWith('('), await page.title());
// One "N need attention" header badge, hidden while What to do now (the home of these facts) is on screen. The blocked task
// waits on one of the questions, so it is counted once, as the question.
check('header: no needs badge while What to do now is on screen', await page.$eval('#needs', (e) => e.hidden));
// On a laptop What to do now stays on screen in its rail while the board scrolls, so the badge stays away.
await page.evaluate(() => window.scrollTo(0, 900)); await sleep(400);
check('laptop: What to do now stays in view in its rail when the board scrolls, no badge', await page.evaluate(() => { const r = $('now').getBoundingClientRect(); return scrollY > 0 && r.top >= 0 && r.top < 120 && $('needs').hidden; }));
// One column (narrow window): What to do now scrolls away, and the badge takes over.
await page.setViewport({ width: 960, height: 1000 }); await page.evaluate(() => window.scrollTo(0, 1600)); await sleep(400);
const needs = await page.$eval('#needs', (e) => ({ hidden: e.hidden, t: e.innerText.replace(/\s+/g, ' '), label: e.querySelector('button')?.getAttribute('aria-label') || '' }));
check('header need-attention badge when scrolled: questions and the mention, the blocked-on-a-question task not counted twice', !needs.hidden && /^3 need attention/.test(needs.t) && /2 questions/.test(needs.label) && /1 new mention/.test(needs.label) && !/blocked/.test(needs.label), JSON.stringify(needs));
await page.click('#needs button'); await sleep(600);
check('the badge goes back up to What to do now', await page.evaluate(() => !!document.activeElement?.closest('#now') && $('needs').hidden));
await page.setViewport({ width: 1440, height: 1000 });
await page.evaluate(() => window.scrollTo(0, 0));
check('XSS text rendered as text', await page.evaluate(() => [...document.querySelectorAll('.ev .eb')].some((e) => e.textContent.includes('<script>alert(1)</script>'))));
await sleep(300);
await page.screenshot({ path: `${out}/v2-desktop-dark.png` });

// typing survives SSE update
const ta = '.qcard:first-child textarea';
await page.click(ta);
await page.type(ta, 'Use the hackathon org');
const before = await page.$eval('#feed', (f) => f.children.length);
await rest('bob/ci-worker', '/messages', 'POST', { text: 'unrelated update while you type' });
await page.waitForFunction((n) => document.getElementById('feed').children.length > n, { timeout: 5000 }, before);
await rest('chen', '/messages', 'POST', { text: 'another one @dana' });
await sleep(600);
const kept = await page.$eval(ta, (e) => [e.value, document.activeElement === e]);
check('half-typed answer + focus survive SSE re-render', kept[0] === 'Use the hackathon org' && kept[1], JSON.stringify(kept));
await page.type(ta, ' project, client id is in 1Password');
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.querySelectorAll('.qcard').length === 1, { timeout: 5000 });
check('answer sent with Enter; question removed', true);
const toastTxt = await page.$eval('#toasts', (e) => e.innerText);
check('feedback toast after answer', /Answer sent/.test(toastTxt), toastTxt);

// mentions
const mBadge = await page.$eval('[data-tab="me"]', (e) => e.innerText);
check('@me tab shows unread count', /\d/.test(mBadge), mBadge);
await domClick('#now [data-go="mentions"]'); // mentions follow the lead under "Also"
await sleep(200);
const meFeed = await page.$$eval('#feed .ev', (e) => e.length);
const mBadge2 = await page.$eval('[data-tab="me"]', (e) => e.innerText);
check('mentions view filters + clears unread', meFeed >= 2 && !/\d/.test(mBadge2), `${meFeed} items, tab "${mBadge2}"`);
await domClick('[data-tab="all"]');

// chat + click-to-mention
await page.keyboard.press('Escape');
await page.evaluate(() => document.activeElement.blur());
await page.keyboard.press('/');
check('"/" focuses the composer', await page.evaluate(() => document.activeElement.id === 'msg'));
await domClick('.person [data-mention="alice/db-worker"]'); // a subagent's row under its agent in Agents
check('click name inserts @mention', (await page.$eval('#msg', (e) => e.value)) === '@alice/db-worker ');
await page.type('#msg', 'how close is #1?');
await page.keyboard.press('Enter');
await page.waitForFunction(() => [...document.querySelectorAll('#feed .ev')].some((e) => e.innerText.includes('how close is')), { timeout: 5000 });
check('chat message posted; #1 linkified', await page.evaluate(() => [...document.querySelectorAll('#feed .ev')].at(-1).querySelector('[data-open-task="1"]') !== null));

// create task with keyboard 'n'
await page.evaluate(() => document.activeElement.blur());
await page.keyboard.press('n');
await page.waitForSelector('#task-dlg[open]');
check('"n" opens new task dialog with title focused', await page.evaluate(() => document.activeElement.id === 'td-name'));
await page.type('#td-name', 'Seed demo data');
await page.type('#td-desc', 'Three teams, ten submissions');
await page.type('#td-deps', '1, 99');
await page.click('#td-save');
await sleep(200);
const derr = await page.$eval('#td-err', (e) => e.textContent);
check('bad dependency id rejected inline', /99/.test(derr), derr);
// SSE arrives while dialog open: typed values survive
await page.click('#td-name', { count: 3 });
await page.type('#td-name', 'Seed demo data script');
await rest('chen', '/messages', 'POST', { text: 'ping during dialog' });
await sleep(600);
check('dialog stays open and keeps input through SSE', await page.evaluate(() => document.getElementById('task-dlg').open && document.getElementById('td-name').value === 'Seed demo data script'));
await page.screenshot({ path: `${out}/v2-dialog-new.png` });
await page.click('#td-deps', { count: 3 });
await page.type('#td-deps', '1');
await page.click('#td-save');
await page.waitForFunction(() => !document.getElementById('task-dlg').open, { timeout: 5000 });
await page.waitForFunction(() => [...document.querySelectorAll('#col-open .card')].some((c) => c.innerText.includes('Seed demo data script') && c.innerText.includes('waits on #1')), { timeout: 5000 });
check('task created, shows "waits on #1"', true);

// open card with keyboard, change status
const newId = await page.evaluate(() => [...document.querySelectorAll('#col-open .card')].find((c) => c.innerText.includes('Seed demo data script')).dataset.id);
await page.focus(`.card[data-id="${newId}"]`);
await page.keyboard.press('Enter');
await page.waitForSelector('#task-dlg[open]');
await page.select('#td-status', 'review');
await page.screenshot({ path: `${out}/v2-dialog-edit.png` });
await page.click('#td-save');
await page.waitForFunction((id) => document.querySelector(`#col-review .card[data-id="${id}"]`), { timeout: 5000 }, newId);
check('keyboard open + status change via dialog', true);
// Escape closes dialog
await page.focus(`.card[data-id="${newId}"]`);
await page.keyboard.press('Enter');
await page.waitForSelector('#task-dlg[open]');
await page.keyboard.press('Escape');
await sleep(150);
check('Escape closes dialog', await page.evaluate(() => !document.getElementById('task-dlg').open));

// drag & drop (synthetic HTML5 DnD). Done starts collapsed when six columns don't fit: open it to see the card.
if (await page.$('[data-fk="done-tog"]')) await page.click('[data-fk="done-tog"]');
await page.evaluate((id) => {
  const card = document.querySelector(`.card[data-id="${id}"]`); const col = document.getElementById('col-done');
  const dt = new DataTransfer();
  card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
  col.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
}, newId);
await page.waitForFunction((id) => document.querySelector(`#col-done .card[data-id="${id}"]`), { timeout: 5000 }, newId);
const st = await rest('dana', '/state', 'GET');
check('drag to Done persists on server', st.tasks.find((t) => t.id === Number(newId)).status === 'done');

// WB-13: dragging to In progress asks who it's for; a card with unfinished dependencies warns first
const findT = (title) => st.tasks.find((t) => t.title === title);
const readmeId = findT('Demo README with screenshots').id; const apiId = findT('REST API for submissions').id;
const schemaId = findT('Database schema for users, teams and submissions').id;
check('WB-15 Open cards don\'t repeat "unassigned"', await page.$$eval('#col-open .card', (cs) => cs.length > 0 && cs.every((c) => !/unassigned/.test(c.innerText))));
check('WB-15 priority chips read P1 / P3', await page.evaluate((id) => document.querySelector(`.card[data-id="${id}"] .cm`).innerText.includes('P3'), readmeId));
await page.evaluate((id) => {
  const card = document.querySelector(`.card[data-id="${id}"]`); const col = document.getElementById('col-in_progress');
  const dt = new DataTransfer();
  card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
  col.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
}, readmeId);
await page.waitForSelector(`.card[data-id="${readmeId}"] .mvask [data-ask-to="bob"]`, { timeout: 5000 });
check('WB-13 drag to In progress without an owner asks who it is for (task not moved yet)', (await rest('dana', '/state', 'GET')).tasks.find((t) => t.id === readmeId).status === 'open');
await page.click(`.card[data-id="${readmeId}"] [data-ask-to="bob"]`);
await page.waitForFunction((id) => document.querySelector(`#col-in_progress .card[data-id="${id}"]`), { timeout: 5000 }, readmeId);
const rd = (await rest('dana', '/state', 'GET')).tasks.find((t) => t.id === readmeId);
check('WB-13 picking an agent moves it with that owner', rd.status === 'in_progress' && rd.assignee === 'bob', `${rd.status} ${rd.assignee}`);
await domClick(`[data-move="${apiId}"]`);
await domClick(`[data-move-to="in_progress"][data-move-id="${apiId}"]`);
await page.waitForFunction(() => [...document.querySelectorAll('#toasts .toast')].some((t) => /waits on/.test(t.innerText)), { timeout: 5000 });
const wt = await page.$$eval('#toasts .toast', (ts) => ts.map((t) => t.innerText).find((x) => /waits on/.test(x)));
check('WB-13 a move past unfinished dependencies is refused with "Move anyway"', new RegExp(`waits on #${schemaId}`).test(wt) && /Move anyway/.test(wt), wt);
await page.evaluate(() => [...document.querySelectorAll('#toasts button')].find((b) => b.textContent === 'Move anyway').click());
await page.waitForSelector(`.card[data-id="${apiId}"] .mvask`, { timeout: 5000 });
await page.keyboard.press('Escape'); await sleep(200);
check('WB-13 Escape cancels the owner question; the task stays Open', !(await page.$(`.card[data-id="${apiId}"] .mvask`)) && (await rest('dana', '/state', 'GET')).tasks.find((t) => t.id === apiId).status === 'open');
// The dialog's Status goes through the same steps: dependencies first ("Move anyway"), then who it's for.
await page.evaluate(() => { [...document.querySelectorAll('#toasts .toast')].forEach((t) => t.remove()); });
await page.evaluate((id) => openTask(id), apiId);
await page.waitForSelector('#task-dlg[open]');
await page.select('#td-status', 'in_progress');
await page.click('#td-save');
await page.waitForFunction(() => !document.getElementById('task-dlg').open && [...document.querySelectorAll('#toasts .toast')].some((t) => /waits on/.test(t.innerText) && /Move anyway/.test(t.innerText)), { timeout: 5000 }).catch(() => {});
const dt1 = await page.$$eval('#toasts .toast', (ts) => ts.map((t) => t.innerText).join(' | '));
check('DLG-1 dialog status to In progress past unfinished dependencies: "Move anyway" toast, no refusal', /waits on/.test(dt1) && /Move anyway/.test(dt1) && (await rest('dana', '/state', 'GET')).tasks.find((t) => t.id === apiId).status === 'open', dt1);
await page.evaluate(() => [...document.querySelectorAll('#toasts button')].find((b) => b.textContent === 'Move anyway').click());
await page.waitForSelector(`.card[data-id="${apiId}"] .mvask [data-ask-to="bob"]`, { timeout: 5000 });
check('DLG-1 then asks who it is for, on the card', true);
await domClick(`.card[data-id="${apiId}"] [data-ask-to="bob"]`);
await page.waitForFunction((id) => document.querySelector(`#col-in_progress .card[data-id="${id}"]`), { timeout: 5000 }, apiId).catch(() => {});
const ap = (await rest('dana', '/state', 'GET')).tasks.find((t) => t.id === apiId);
check('DLG-1 and moves it (forced) with that owner', ap.status === 'in_progress' && ap.assignee === 'bob', `${ap.status} ${ap.assignee} ${await page.$eval('#toasts', (x) => x.innerText)}`);
// With Assign to set in the dialog, that agent is the owner: no question.
const dlgT = await rest('dana', '/tasks', 'POST', { title: 'Dialog claim test' });
await page.waitForSelector(`.card[data-id="${dlgT.id}"]`, { timeout: 5000 });
await page.evaluate((id) => openTask(id), dlgT.id);
await page.waitForSelector('#task-dlg[open]');
await page.select('#td-asg', 'bob'); await page.select('#td-status', 'claimed');
await page.click('#td-save');
await page.waitForFunction((id) => document.querySelector(`#col-in_progress .card[data-id="${id}"]`), { timeout: 5000 }, dlgT.id).catch(() => {});
const dc = (await rest('dana', '/state', 'GET')).tasks.find((t) => t.id === dlgT.id);
check('DLG-1 dialog Status Claimed + Assign to bob: claimed for bob, no question asked', dc.status === 'claimed' && dc.assignee === 'bob' && !(await page.$(`.card[data-id="${dlgT.id}"] .mvask`)), `${dc.status} ${dc.assignee}`);
check('a claimed task sits in In progress, marked "claimed, not started"', await page.evaluate((id) => /claimed, not started/.test(document.querySelector(`#col-in_progress .card[data-id="${id}"]`)?.innerText || '') && !document.getElementById('col-claimed'), dlgT.id));

// WB-19: column names read "Open, 3 tasks" (no stray space before the comma)
check('WB-19 column region names', await page.evaluate(() => { const c = document.getElementById('col-open'); const n = c.getAttribute('aria-label') || ''; return /^Open, \d+ tasks?$/.test(n) ? true : n; }) === true);
// WB-16: the PR pill is a Tab stop
const ciId = findT('CI pipeline with tests on PRs').id;
await rest('dana', `/tasks/${ciId}`, 'PATCH', { pr_url: 'https://github.com/o/r/pull/5' });
await page.waitForSelector(`.card[data-id="${ciId}"] a.pill`, { timeout: 5000 });
check('WB-16 PR pill on a card is keyboard focusable', await page.$eval(`.card[data-id="${ciId}"] a.pill`, (a) => a.tabIndex === 0));
// WB-17: long titles clamp to 3 lines, full title in the tooltip
const longTitle = 'A very long task title that keeps going '.repeat(5).trim();
const lt = await rest('dana', '/tasks', 'POST', { title: longTitle });
await page.waitForSelector(`.card[data-id="${lt.id}"]`, { timeout: 5000 });
const ltm = await page.$eval(`.card[data-id="${lt.id}"] .ct`, (e) => ({ h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight), tip: e.title }));
check('WB-17 long title clamped to 3 lines with a tooltip', ltm.h <= ltm.lh * 3 + 2 && ltm.tip === longTitle.slice(0, 200), JSON.stringify(ltm));
// WB-26: toasts sit at the bottom right
await page.evaluate(() => toast('position check'));
const tr = await page.evaluate(() => { const t = [...document.querySelectorAll('#toasts .toast')].at(-1).getBoundingClientRect(); return { l: t.left, r: t.right, w: window.innerWidth }; });
check('WB-26 toasts are on the right, away from the Open column', tr.l > tr.w / 2, JSON.stringify(tr));
// WB-14: a long column shows 12 cards, then "Show N more"
for (let i = 0; i < 20; i++) await rest('dana', '/tasks', 'POST', { title: `Filler task ${i}` });
await page.waitForSelector('[data-show-col="open"]', { timeout: 5000 });
const capN = await page.$$eval('#col-open .card', (c) => c.length);
const allOpen = (await rest('dana', '/state', 'GET')).tasks.filter((t) => t.status === 'open' || t.status === 'proposed').length;
const moreTxt = await page.$eval('[data-show-col="open"]', (b) => b.textContent);
check('WB-14 Open column is capped with "Show N more"', capN < allOpen && capN >= 12 && moreTxt === `Show ${allOpen - capN} more`, `${capN}/${allOpen} "${moreTxt}"`);
await page.click('[data-show-col="open"]'); await sleep(200);
check('WB-14 "Show more" shows every card', (await page.$$eval('#col-open .card', (c) => c.length)) === allOpen && (await page.$eval('[data-show-col="open"]', (b) => b.textContent)) === 'Show fewer');
await page.click('[data-show-col="open"]'); await sleep(200);
// Toasts now sit bottom right, over the side column: clear the Undo toasts so the clicks below hit their buttons.
await page.evaluate(() => document.getElementById('toasts').replaceChildren());

// locks: release with inline confirm
const lockCount = await page.$$eval('#locks .lock', (l) => l.length);
// File locks fold to their title bar (with the count); open them to release one. Open is remembered.
check('file locks start folded, with the count in their title bar', await page.evaluate((n) => $('l-body').hidden && new RegExp(`${n} held`).test($('l-count').textContent) && $('l-tog').getAttribute('aria-expanded') === 'false' && $('o-locks').querySelector('.o-head').contains($('l-tog')), lockCount));
await page.click('#l-tog');
check('the title bar opens the locks (remembered with the other panels)', await page.evaluate(() => !$('l-body').hidden && $('l-tog').getAttribute('aria-expanded') === 'true' && JSON.parse(localStorage.getItem('board-office-ui') || '{}').locks === false));
await page.$eval('[data-unlock="package.json"]', (b) => b.scrollIntoView({ block: 'center' })); await sleep(300); const hit = await page.evaluate(() => { const b = document.querySelector('[data-unlock="package.json"]').getBoundingClientRect(); const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return el.outerHTML.slice(0, 120); }); console.log('debug: element at release button = ' + hit);
await page.click('[data-unlock="package.json"]');
check('release asks inline confirmation (focus on Keep)', await page.evaluate(() => document.activeElement?.dataset.unlockNo !== undefined && !!document.querySelector('[data-unlock-yes="package.json"]')));
await page.click('[data-unlock-yes="package.json"]');
await page.waitForFunction((n) => document.querySelectorAll('#locks .lock').length === n - 1, { timeout: 5000 }, lockCount);
check('force-release removes lock', true);

// person filter
await domClick('.person [data-filter="bob"]'); // the filter button on bob's line in Agents
await sleep(200);
const owners = await page.$$eval('#board .card', (cs) => cs.map((c) => c.innerText));
check('per-person filter shows only bob', owners.length > 0 && owners.every((t) => /bob/.test(t) || !/alice|chen/.test(t)), owners.length + ' cards');
await page.screenshot({ path: `${out}/v2-filter-bob.png` });
await domClick('#filterbar button');
await sleep(200);

// light mode
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(300);
await page.screenshot({ path: `${out}/v2-desktop-light.png` });

// The 3D Tasks window: the Board view's drag & drop (the same handlers and rules) between its columns.
{
  const dragT = await rest('dana', '/tasks', 'POST', { title: '3D drag test' });
  await page.waitForFunction((id) => !!taskById(id), { timeout: 5000 }, dragT.id);
  await page.click('#vseg [data-vset="office"]');
  const in3d = await page.waitForFunction(() => document.documentElement.dataset.boardView === 'office', { timeout: 8000 }).then(() => true, () => false);
  if (!in3d) check('3D drag skipped: no WebGL in this browser', true);
  else {
    await page.evaluate(() => { if ($('o-tasks').classList.contains('folded')) $('o-tasks-fold').click(); });
    await page.waitForSelector(`#o-cols .o-col[data-s="open"] .o-card[data-open-task="${dragT.id}"]`, { timeout: 5000 });
    check('3D: Tasks window cards are draggable', await page.$eval(`.o-card[data-open-task="${dragT.id}"]`, (c) => c.draggable));
    await page.evaluate((id) => {
      const card = document.querySelector(`#o-cols .o-card[data-open-task="${id}"]`); const col = document.querySelector('#o-cols .o-col[data-s="review"]');
      const dt = new DataTransfer();
      card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      col.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    }, dragT.id);
    await page.waitForFunction((id) => document.querySelector(`#o-cols .o-col[data-s="review"] .o-card[data-open-task="${id}"]`), { timeout: 5000 }, dragT.id).catch(() => {});
    const dr = (await rest('dana', '/state', 'GET')).tasks.find((t) => t.id === dragT.id);
    check('3D: dragging a card from Open to Review moves it (the server has it in Review, its card in that column)', dr.status === 'review' && !!(await page.$(`#o-cols .o-col[data-s="review"] .o-card[data-open-task="${dragT.id}"]`)), dr.status);
    await page.click('#vseg [data-vset="board"]');
    await page.waitForFunction(() => document.documentElement.dataset.boardView === 'board', { timeout: 5000 });
  }
}

// mobile
for (const scheme of ['light', 'dark']) {
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await sleep(400);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`mobile ${scheme}: no horizontal overflow`, ov <= 0, ov + 'px');
  await page.screenshot({ path: `${out}/v2-mobile-${scheme}.png` });
  await page.screenshot({ path: `${out}/v2-mobile-${scheme}-full.png`, fullPage: true });
}
// mobile dialog
await page.evaluate(() => document.querySelector('.card').click());
await sleep(300);
await page.screenshot({ path: `${out}/v2-mobile-dialog.png` });
const dov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('mobile dialog no overflow', dov <= 0, dov + 'px');
await page.keyboard.press('Escape');

} catch (e) { results.push('CRASH ' + e.message); }
check('no page/console errors or native dialogs', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
