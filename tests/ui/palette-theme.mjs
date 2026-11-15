// Theme switch (Auto / Light / Dark, saved per browser) and the Ctrl+K command palette.
// Starts its own throwaway board. Run all suites with: npm test
import { startBoard, launchBrowser, shotsDir, finish, seed } from '../helpers.mjs';

const board = await startBoard();
const out = shotsDir('palette-theme');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const s = await seed(board);

const browser = await launchBrowser({ defaultViewport: { width: 1440, height: 1000 } });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  page.on('dialog', (d) => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
  await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('board-token', t); localStorage.setItem('board-name', 'dana'); } catch {} }, board.token);
  await page.goto(board.base + '/');
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
  await sleep(300);
  const attr = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const metas = () => page.evaluate(() => ({ scheme: document.getElementById('m-scheme').content, light: document.getElementById('m-tc-light').media, dark: document.getElementById('m-tc-dark').media }));

  // ---- theme ----
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  check('auto: no data-theme, follows the OS (light)', (await attr()) === null && (await bg()) === 'rgb(245, 245, 242)', await bg());
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  check('auto: follows the OS (dark)', (await attr()) === null && (await bg()) === 'rgb(20, 20, 19)', await bg());
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

  await page.click('#help-btn'); await page.waitForSelector('#help-dlg[open]');
  await page.click('[data-theme-set="dark"]'); await sleep(100);
  check('Dark button sets data-theme=dark and the dark tokens, even with an OS in light', (await attr()) === 'dark' && (await bg()) === 'rgb(20, 20, 19)', `${await attr()} ${await bg()}`);
  check('Dark button is pressed, the others are not', await page.evaluate(() => [...document.querySelectorAll('[data-theme-set]')].map((b) => b.getAttribute('aria-pressed')).join()) === 'false,false,true');
  const m = await metas();
  check('color-scheme and theme-color metas follow the forced theme', m.scheme === 'dark' && m.dark === 'all' && m.light === 'not all', JSON.stringify(m));
  check('saved in localStorage', await page.evaluate(() => localStorage.getItem('board-theme')) === 'dark');
  await page.screenshot({ path: `${out}/dark-help.png` });
  await page.keyboard.press('Escape');

  await page.reload(); await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
  check('after a reload the theme is still dark', (await attr()) === 'dark' && (await bg()) === 'rgb(20, 20, 19)', `${await attr()} ${await bg()}`);
  const firstPaint = await (async () => { // the attribute is there before the app script runs (inline script in <head>)
    const p2 = await browser.newPage();
    await p2.evaluateOnNewDocument(() => { document.addEventListener('readystatechange', () => { if (!window.__early) window.__early = document.documentElement.getAttribute('data-theme'); }); });
    await p2.goto(board.base + '/'); const v = await p2.evaluate(() => window.__early); await p2.close(); return v;
  })();
  check('data-theme is set before first paint', firstPaint === 'dark', String(firstPaint));

  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.click('#help-btn'); await page.waitForSelector('#help-dlg[open]');
  await page.click('[data-theme-set="light"]'); await sleep(100);
  check('Light wins over an OS in dark', (await attr()) === 'light' && (await bg()) === 'rgb(245, 245, 242)', `${await attr()} ${await bg()}`);
  await page.screenshot({ path: `${out}/light-help.png` });
  await page.click('[data-theme-set="auto"]'); await sleep(100);
  check('Auto removes data-theme and follows the OS again', (await attr()) === null && (await bg()) === 'rgb(20, 20, 19)' && (await metas()).scheme === 'light dark', `${await attr()} ${await bg()}`);
  check('Auto is saved', await page.evaluate(() => localStorage.getItem('board-theme')) === 'auto');
  await page.keyboard.press('Escape');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

  // ---- palette: opens from the task list, and from inside an input ----
  await page.focus('#msg');
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForSelector('#pal-dlg[open]');
  check('Ctrl+K opens the palette while typing in chat', await page.evaluate(() => document.activeElement.id === 'pal-in'));
  const roles = await page.evaluate(() => { const i = document.getElementById('pal-in'); return { role: i.getAttribute('role'), ctl: i.getAttribute('aria-controls'), lb: document.getElementById('pal-list').getAttribute('role'), act: i.getAttribute('aria-activedescendant'), opts: document.querySelectorAll('#pal-list [role=option]').length }; });
  check('combobox + listbox wiring, first option active', roles.role === 'combobox' && roles.ctl === 'pal-list' && roles.lb === 'listbox' && roles.act === 'pal-o-0' && roles.opts > 3, JSON.stringify(roles));
  await page.screenshot({ path: `${out}/palette-empty.png` });

  await page.keyboard.press('ArrowDown');
  check('ArrowDown moves the active option', await page.evaluate(() => { const a = document.getElementById('pal-in').getAttribute('aria-activedescendant'); return a === 'pal-o-1' && document.getElementById(a).getAttribute('aria-selected') === 'true'; }));
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  check('ArrowUp wraps to the last option', await page.evaluate(() => { const n = document.querySelectorAll('#pal-list [role=option]').length; return document.getElementById('pal-in').getAttribute('aria-activedescendant') === 'pal-o-' + (n - 1); }));

  await page.keyboard.type('leader');
  const labels = () => page.$$eval('#pal-list li .pl', (a) => a.map((x) => x.textContent));
  let l = await labels();
  check('typing filters by substring', l.length >= 1 && l.every((x) => /leader/i.test(x)) && l.some((x) => /Leaderboard page/.test(x)), JSON.stringify(l));
  await page.keyboard.press('Enter');
  await page.waitForSelector('#task-dlg[open]');
  check('Enter on a task opens its dialog', await page.$eval('#td-name', (e) => e.value) === 'Leaderboard page' && !(await page.$('#pal-dlg[open]')));
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('task-dlg').open);

  // by id
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForSelector('#pal-dlg[open]');
  await page.keyboard.type('#' + s.schema.id);
  l = await labels();
  check('#id puts that task first', l[0]?.startsWith(`#${s.schema.id} `), JSON.stringify(l.slice(0, 3)));
  await page.keyboard.press('Enter'); await page.waitForSelector('#task-dlg[open]');
  check('Enter opens the task by id', /Task #/.test(await page.$eval('#td-title', (e) => e.textContent)) && (await page.$eval('#td-name', (e) => e.value)).startsWith('Database schema'));
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('task-dlg').open);

  // nothing matches
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForSelector('#pal-dlg[open]');
  await page.keyboard.type('zzzqqq');
  check('no match says so', await page.$eval('#pal-empty', (e) => !e.hidden) && (await labels()).length === 0 && await page.$eval('#pal-in', (e) => e.getAttribute('aria-activedescendant') === ''));
  await page.keyboard.press('Enter');
  check('Enter with no match does nothing', !!(await page.$('#pal-dlg[open]')));
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('pal-dlg').open);
  check('Esc closes the palette and focus returns to the chat box', await page.evaluate(() => document.activeElement.id === 'msg'));

  // Ctrl+K again toggles it shut; from a card, focus comes back to the card
  await page.focus('.card');
  const cardId = await page.evaluate(() => document.activeElement.dataset.id);
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForSelector('#pal-dlg[open]');
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForFunction(() => !document.getElementById('pal-dlg').open);
  check('Ctrl+K again closes it, focus is back on the card', await page.evaluate((id) => document.activeElement.dataset?.id === id, cardId));

  // ---- other commands ----
  const run = async (q) => { await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control'); await page.waitForSelector('#pal-dlg[open]'); await page.keyboard.type(q); await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.getElementById('pal-dlg').open); await sleep(250); };
  await run('new task');
  check('"New task" opens the empty task dialog', await page.$eval('#task-dlg', (d) => d.open) && await page.$eval('#td-title', (e) => e.textContent === 'New task'));
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('task-dlg').open);

  await run('answer the oldest');
  const oldest = await page.evaluate(() => [...document.querySelectorAll('textarea[id^="qa-"]')].map((t) => t.id)[0]);
  check('"Answer the oldest question" focuses the first answer box', await page.evaluate(() => document.activeElement.id) === oldest && /^qa-/.test(oldest), oldest);

  await run('go to chen');
  check('"Go to chen" focuses their People row', await page.evaluate(() => document.activeElement.dataset.fk === 'ptog-chen' && !!document.activeElement.closest('#people')));

  await run('theme: dark');
  check('"Theme: Dark" switches the theme', (await attr()) === 'dark');
  await run('theme: auto');
  check('"Theme: Auto" switches it back', (await attr()) === null);

  await run('show tasks for chen');
  check('"Show tasks for chen" sets the person filter', await page.$eval('#filter', (e) => e.value) === 'chen');
  await run('everyone');
  check('"Show tasks for everyone" clears it', await page.$eval('#filter', (e) => e.value) === '');

  await run('demo time');
  check('"Set the demo time" goes where the clock goes', await page.evaluate(() => /^(dl-in|dl-edit)$/.test(document.activeElement.id) || document.activeElement.dataset.fk === 'dl-edit'), await page.evaluate(() => document.activeElement.id || document.activeElement.dataset.fk));

  await run('write a message');
  check('"Write a message" focuses chat', await page.evaluate(() => document.activeElement.id) === 'msg');
  await run('open help');
  check('"Open help" opens the help dialog', await page.$eval('#help-dlg', (d) => d.open));
  check('help mentions Ctrl+K', /Ctrl\+K/.test(await page.$eval('#help-dlg', (d) => d.innerText.replace(/\s+/g, ''))));
  await page.keyboard.press('Escape');

  // existing single-key shortcut still works, and Ctrl+K is not blocked by the "single-key shortcuts off" switch
  await page.evaluate(() => { document.activeElement.blur(); });
  await page.keyboard.press('n'); await page.waitForSelector('#task-dlg[open]');
  check('n still opens a new task', true);
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control'); await sleep(200);
  check('Ctrl+K does nothing while the task dialog is open (no lost edits)', !(await page.$('#pal-dlg[open]')));
  await page.keyboard.press('Escape');
} catch (e) { results.push('CRASH ' + e.stack); }
check('no page errors, console errors or native dialogs', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
