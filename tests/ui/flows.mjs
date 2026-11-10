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

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 1000 } });
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
const needs = await page.$eval('#needs', (e) => e.innerText.replace(/\s+/g, ' '));
check('header needs-badges', /question/.test(needs) && /mention/.test(needs) && /blocked/.test(needs) && /stale/.test(needs), needs);
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
await domClick('#needs .m');
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
await domClick('.person [data-ptoggle="alice"].ptog'); // expand alice's row
await domClick('.person [data-mention="alice/db-worker"]');
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

// locks: release with inline confirm
const lockCount = await page.$$eval('#locks .lock', (l) => l.length);
await page.$eval('[data-unlock="package.json"]', (b) => b.scrollIntoView({ block: 'center' })); await sleep(300); const hit = await page.evaluate(() => { const b = document.querySelector('[data-unlock="package.json"]').getBoundingClientRect(); const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return el.outerHTML.slice(0, 120); }); console.log('debug: element at release button = ' + hit);
await page.click('[data-unlock="package.json"]');
check('release asks inline confirmation (focus on Keep)', await page.evaluate(() => document.activeElement?.dataset.unlockNo !== undefined && !!document.querySelector('[data-unlock-yes="package.json"]')));
await page.click('[data-unlock-yes="package.json"]');
await page.waitForFunction((n) => document.querySelectorAll('#locks .lock').length === n - 1, { timeout: 5000 }, lockCount);
check('force-release removes lock', true);

// person filter
await domClick('.person [data-ptoggle="bob"].ptog'); // expand bob's row
await domClick('.person [data-filter="bob"]');
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
