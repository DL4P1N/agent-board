// Themes (fifteen, or Auto = Dark or Light by the OS, saved per browser), the header's theme chooser (a grid of preview
// tiles), a contrast scan of every visible text in every theme, and the Ctrl+K command palette.
// Starts its own throwaway board. Run all suites with: npm test
import { startBoard, launchBrowser, shotsDir, finish, seed } from '../helpers.mjs';
import { scanText } from '../fixtures/scan-text.mjs';

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
  const ORDER = ['auto', 'light', 'dark', 'contrast', 'day', 'night', 'paper', 'terminal', 'sticky', 'sunset', 'candy', 'synthwave', 'coral', 'ocean', 'dusk', 'forest'];
  const IDS = ['dark', 'light', 'dusk', 'day', 'night', 'terminal', 'contrast', 'paper', 'synthwave', 'ocean', 'sticky', 'coral', 'candy', 'sunset', 'forest'];
  const NAMES = ['Dark', 'Light', 'Dusk', 'Day', 'Night', 'Terminal', 'High Contrast', 'Paper', 'Synthwave', 'Ocean', 'Sticky Note', 'Coral', 'Cotton Candy', 'Sunset', 'Forest'];
  const LIGHT = new Set(['light', 'day', 'paper', 'sticky', 'coral', 'candy']);
  const THEMES = await page.evaluate(() => window.THEMES);
  const rgbOf = (h) => `rgb(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;
  check('fifteen themes, in the agreed order, with their names; the light ones marked light', Object.keys(THEMES).join() === IDS.join() && Object.values(THEMES).map((v) => v[0]).join() === NAMES.join() && IDS.every((t) => !!THEMES[t][2] === LIGHT.has(t)), JSON.stringify(THEMES));
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  check('auto: no data-theme, follows the OS (light): the Light theme', (await attr()) === null && (await bg()) === rgbOf(THEMES.light[1]), await bg());
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  check('auto: follows the OS (dark): the Dark theme', (await attr()) === null && (await bg()) === rgbOf(THEMES.dark[1]), await bg());
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

  // One theme control, in the header in both views: a swatch button that opens the chooser, a grid of preview tiles.
  const radios = () => page.evaluate(() => [...document.querySelectorAll('#theme-pop [role="radio"]')].map((b) => b.dataset.themeSet));
  const pick = async (t) => { if (await page.$eval('#theme-pop', (e) => e.hidden)) await page.click('#theme-btn'); await page.click(`#theme-pop [data-theme-set="${t}"]`); await sleep(100); };
  check('one theme control on the page (in the header), no theme list in the help', await page.evaluate(() => document.querySelectorAll('[data-theme-set]').length === 16 && !!$('theme-btn').closest('header') && !document.querySelector('#help-dlg [data-theme-set], #help-dlg .sw')
    && ![...document.querySelectorAll('#help-dlg dd')].some((d) => /Dusk|Terminal|Sticky/.test(d.textContent))));
  await page.click('#theme-btn');
  check('the theme button opens the chooser: one radio group of 16 tiles (Auto and the basics, then light themes beside their dark partners), focus on the current one', await page.evaluate(() => !$('theme-pop').hidden && $('theme-btn').getAttribute('aria-expanded') === 'true' && $('theme-pop').getAttribute('role') === 'radiogroup'
    && document.activeElement?.dataset.themeSet === 'auto' && document.activeElement.getAttribute('aria-checked') === 'true') && (await radios()).join() === ORDER.join() && [...ORDER.slice(1)].sort().join() === [...IDS].sort().join());
  check('each tile is a tiny board in its own theme with its name (Auto: Dark and Light side by side)', await page.evaluate((names, ids) => {
    const tiles = [...document.querySelectorAll('#theme-pop [role="radio"]')];
    const own = tiles.slice(1).every((b) => b.querySelector('.mini')?.dataset.tp === b.dataset.themeSet && b.textContent.trim() === names[ids.indexOf(b.dataset.themeSet)]
      && getComputedStyle(b.querySelector('.mini')).backgroundColor === getComputedStyle(b.querySelector('.mini')).getPropertyValue('--bg').trim().replace(/^#(..)(..)(..)$/, (m, r, g, bb) => `rgb(${[r, g, bb].map((x) => parseInt(x, 16)).join(', ')})`));
    const auto = tiles[0]; const minis = [...auto.querySelectorAll('.mini[data-tp]')].map((m) => m.dataset.tp);
    return own && minis.join() === 'dark,light' && auto.textContent.trim() === 'Auto';
  }, NAMES, IDS));
  const fit = await page.evaluate(() => { const p = $('theme-pop'), r = p.getBoundingClientRect(); return { cols: getComputedStyle($('tp-grid')).gridTemplateColumns.split(' ').length, fits: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && p.scrollHeight <= p.clientHeight + 1, under: r.top >= $('theme-btn').getBoundingClientRect().bottom }; });
  check('the chooser is a 4-column grid under the button and fits the window without scrolling', fit.cols === 4 && fit.fits && fit.under, JSON.stringify(fit));
  await page.screenshot({ path: `${out}/chooser.png` });
  await page.click('#theme-pop [data-theme-set="dusk"]'); await sleep(100);
  check('a click on Dusk applies it (data-theme=dusk, its tokens, even with an OS in light) and closes the chooser, focus back on the button', (await attr()) === 'dusk' && (await bg()) === 'rgb(27, 21, 48)' && await page.evaluate(() => $('theme-pop').hidden && document.activeElement === $('theme-btn')), `${await attr()} ${await bg()}`);
  check('Dusk is checked, the others are not; the button shows its swatch and name', await page.evaluate(() => [...document.querySelectorAll('#theme-pop [data-theme-set]')].filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.dataset.themeSet).join() === 'dusk' && $('theme-sw').dataset.tp === 'dusk' && /Theme: Dusk/.test($('theme-btn').getAttribute('aria-label'))));

  // A new theme changes every colour in one frame (no colour transitions), and the chooser opens with a short fade.
  const oneFrame = await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const els = ['.col', '#send', '.o-panel', '.tbc', '#theme-btn'].map((q) => document.querySelector(q)).filter(Boolean);
    const css = () => els.map((e) => { const c = getComputedStyle(e); return [c.backgroundColor, c.borderTopColor, c.color].join(); }).join(' | ');
    const a = css(); setTheme('day'); await frame(); const b = css(); await new Promise((r) => setTimeout(r, 400)); const c = css();
    const tx = document.getAnimations().filter((x) => x instanceof CSSTransition).length;
    await frame(); await frame(); await frame();
    $('theme-btn').click(); await frame();
    const fade = $('theme-pop').getAnimations().map((x) => x.transitionProperty).sort().join();
    $('theme-btn').click(); setTheme('dusk');
    return { changed: a !== b, same: b === c, n: els.length, tx, fade };
  });
  check('a new theme changes every colour in one frame (no transitions while it applies); the chooser opens with a short fade and 4px of travel', oneFrame.changed && oneFrame.same && oneFrame.n === 5 && oneFrame.tx === 0 && oneFrame.fade === 'opacity,translate', JSON.stringify(oneFrame));
  // ...and closes the same way back, quicker (--t-fast): still shown while it fades, then gone.
  await sleep(300);
  const popOut = await page.evaluate(async () => {
    $('theme-btn').click(); const t0 = performance.now(); while ((getComputedStyle($('theme-pop')).opacity !== '1' || $('theme-pop').getAnimations().length) && performance.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 50));
    $('theme-btn').click(); const e = $('theme-pop'), cs = getComputedStyle(e);
    const r = { hidden: e.hidden, shown: cs.display !== 'none', fade: e.getAnimations().map((a) => a.transitionProperty).sort().join(), ms: e.getAnimations().map((a) => a.effect.getTiming().duration) };
    await new Promise((res) => setTimeout(res, 400)); r.gone = getComputedStyle(e).display === 'none'; return r;
  });
  check('the chooser closes with a short fade (opacity and 4px of travel, --t-fast), then is gone', popOut.hidden && popOut.shown && popOut.fade === 'display,opacity,translate' && popOut.ms.every((m) => m === 100) && popOut.gone, JSON.stringify(popOut));
  // Keyboard: a 2-D grid. Left/right walk the tiles (wrapping), up/down move a row (staying put at the edges), Home/End;
  // each move applies the theme and keeps the chooser open; one Tab stop.
  await page.click('#theme-btn');
  const at = () => page.evaluate(() => ({ f: document.activeElement?.dataset.themeSet, t: document.documentElement.getAttribute('data-theme') ?? 'auto', open: !$('theme-pop').hidden, stops: [...document.querySelectorAll('#theme-pop [role="radio"]')].filter((b) => b.tabIndex === 0).length }));
  // Rows: Auto, Light, Dark, High Contrast | Day, Night, Paper, Terminal | Sticky Note, Sunset, Cotton Candy, Synthwave | Coral, Ocean, Dusk, Forest.
  const keys = [['ArrowRight', 'forest'], ['ArrowUp', 'synthwave'], ['ArrowLeft', 'candy'], ['ArrowDown', 'dusk'], ['End', 'forest'], ['ArrowDown', 'forest'], ['ArrowRight', 'auto'], ['ArrowUp', 'auto'], ['ArrowLeft', 'forest'], ['ArrowUp', 'synthwave'], ['Home', 'auto'], ['ArrowDown', 'day']];
  const walk = [];
  for (const [k, want] of keys) { await page.keyboard.press(k); await sleep(40); const a = await at(); walk.push(`${k}:${a.f}`); if (a.f !== want || a.t !== want || !a.open || a.stops !== 1) { walk.push(`(want ${want}, got ${JSON.stringify(a)})`); break; } }
  check('arrow keys move through the grid (left/right wrap, up/down by a row), Home/End; each applies and keeps it open, one Tab stop', !walk.some((w) => w.startsWith('(')), walk.join(' '));
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await sleep(80);
  check('Enter keeps the focused theme (Night) and closes the chooser, focus back on the button', (await attr()) === 'night' && await page.evaluate(() => $('theme-pop').hidden && document.activeElement === $('theme-btn')));
  await page.keyboard.press('Enter'); await sleep(80); await page.keyboard.press('ArrowLeft'); await page.keyboard.press(' '); await sleep(80);
  check('the button opens it from the keyboard; Space picks (Day) and closes it', (await attr()) === 'day' && await page.evaluate(() => $('theme-pop').hidden && document.activeElement === $('theme-btn')));
  await page.click('#theme-btn'); await page.keyboard.press('Escape'); await sleep(80);
  check('Esc closes the chooser, focus back on the theme button', await page.evaluate(() => $('theme-pop').hidden && document.activeElement === $('theme-btn') && $('theme-btn').getAttribute('aria-expanded') === 'false'));
  await page.click('#theme-btn'); await page.mouse.click(300, 900); await sleep(80);
  check('a click elsewhere closes the chooser', await page.$eval('#theme-pop', (e) => e.hidden));
  await pick('dusk');
  const m = await metas();
  check('color-scheme and theme-color metas follow the chosen theme', m.scheme === 'dark' && m.dark === 'all' && m.light === 'not all', JSON.stringify(m));
  check('saved in localStorage', await page.evaluate(() => localStorage.getItem('board-theme')) === 'dusk');

  // Every theme: data-theme, its page colour and tokens, color-scheme and the browser bar colour, and every visible
  // text on the page (the board, and the chooser over it) at least 4.5:1 on what it is drawn on.
  const bgs = new Set(), minRatio = {};
  for (const t of IDS) {
    await page.evaluate((x) => setTheme(x), t); await sleep(120);
    const scheme = LIGHT.has(t) ? 'light' : 'dark';
    const v = await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); const tok = ['--raised', '--sunken', '--chip', '--field', '--line', '--accent-soft', '--review', '--mention', '--stale', '--warn-soft', '--bad-soft', '--toast', '--on-fill', '--tool-claude', '--pl']; return { cs: cs.colorScheme, missing: tok.filter((k) => !cs.getPropertyValue(k).trim()), scheme: document.getElementById('m-scheme').content, bar: document.getElementById(document.getElementById('m-tc-dark').media === 'all' ? 'm-tc-dark' : 'm-tc-light').content }; });
    bgs.add(await bg());
    check(`${t}: data-theme, page colour, every token, color-scheme ${scheme} and theme-color`, (await attr()) === t && (await bg()) === rgbOf(THEMES[t][1]) && v.cs === scheme && v.scheme === scheme && v.bar === THEMES[t][1] && !v.missing.length, JSON.stringify({ bg: await bg(), ...v }));
    const scan = await page.evaluate(scanText);
    await page.click('#theme-btn'); await sleep(80);
    const scanPop = await page.evaluate(scanText);
    await page.keyboard.press('Escape');
    minRatio[t] = Math.min(scan.min, scanPop.min).toFixed(2);
    check(`${t}: every visible text >= 4.5:1 on its background (board ${scan.n} texts, and the chooser open)`, !scan.fails.length && !scanPop.fails.length && scan.n > 100, [...scan.fails, ...scanPop.fails].slice(0, 6).join(' | '));
    await page.screenshot({ path: `${out}/${t}-board.png` });
  }
  console.log('lowest text contrast per theme: ' + JSON.stringify(minRatio));
  check('fifteen themes, fifteen page colours', bgs.size === 15, [...bgs].join(' '));
  await pick('dusk');

  await page.reload(); await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
  check('after a reload the theme is still Dusk', (await attr()) === 'dusk' && (await bg()) === 'rgb(27, 21, 48)', `${await attr()} ${await bg()}`);
  const firstPaint = await (async () => { // the attribute is there before the app script runs (inline script in <head>)
    const p2 = await browser.newPage();
    await p2.evaluateOnNewDocument(() => { document.addEventListener('readystatechange', () => { if (!window.__early) window.__early = document.documentElement.getAttribute('data-theme'); }); });
    await p2.goto(board.base + '/'); const v = await p2.evaluate(() => window.__early); await p2.close(); return v;
  })();
  check('data-theme is set before first paint', firstPaint === 'dusk', String(firstPaint));
  // Older saved values: 'light' and 'dark' (from before the palettes) now are the Light and Dark themes; anything unknown = Auto.
  for (const [old, want] of [['light', 'light'], ['dark', 'dark'], ['purple', null]]) {
    const p3 = await browser.newPage();
    await p3.evaluateOnNewDocument((v) => { try { localStorage.setItem('board-theme', v); } catch {} }, old);
    await p3.goto(board.base + '/');
    const got = await p3.evaluate(() => ({ t: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor }));
    check(`an old saved '${old}' reads as ${want ? NAMES[IDS.indexOf(want)] : 'Auto'}`, got.t === want && (!want || got.bg === rgbOf(THEMES[want][1])), JSON.stringify(got));
    await p3.close();
  }
  await page.evaluate(() => localStorage.setItem('board-theme', 'dusk')); // the pages above shared this storage

  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await pick('paper');
  check('a light theme (Paper) wins over an OS in dark', (await attr()) === 'paper' && (await bg()) === rgbOf(THEMES.paper[1]), `${await attr()} ${await bg()}`);
  await page.screenshot({ path: `${out}/light-board.png` });
  await pick('auto');
  check('Auto removes data-theme and follows the OS again (dark: the Dark theme)', (await attr()) === null && (await bg()) === rgbOf(THEMES.dark[1]) && (await metas()).scheme === 'light dark', `${await attr()} ${await bg()}`);
  check('Auto is saved', await page.evaluate(() => localStorage.getItem('board-theme')) === 'auto');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  check('Auto on a light OS: the Light theme', (await attr()) === null && (await bg()) === rgbOf(THEMES.light[1]), await bg());

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
  await sleep(100);
  check('closing a task opened from the palette puts focus on its card', await page.evaluate((id) => document.activeElement?.matches?.(`.card[data-id="${id}"]`), s.schema.id), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));

  // nothing matches
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForSelector('#pal-dlg[open]');
  await page.keyboard.type('zzzqqq');
  check('no match says so', await page.$eval('#pal-empty', (e) => !e.hidden) && (await labels()).length === 0 && await page.$eval('#pal-in', (e) => e.getAttribute('aria-activedescendant') === ''));
  await page.keyboard.press('Enter');
  check('Enter with no match does nothing', !!(await page.$('#pal-dlg[open]')));
  // A dialog's close event (where the board hands focus back) comes a task after `open` goes false: wait for it to have
  // run (this listener goes after the board's) before the next step, then for focus on the card (a little: it may only
  // come back once the fade has finished).
  const closing = (dlg) => page.evaluate((dlg) => { window.__closed = new Promise((r) => document.getElementById(dlg).addEventListener('close', () => r(), { once: true })); }, dlg);
  const closed = () => page.evaluate(() => window.__closed);
  const onCard = (id) => page.waitForFunction((id) => document.activeElement?.dataset?.id === id, { timeout: 2000 }, id).then(() => true, () => false);
  const where = (id) => page.evaluate((id) => `card #${id}, focus on ${document.activeElement?.outerHTML.slice(0, 70)}`, id);
  await closing('pal-dlg'); await page.keyboard.press('Escape'); await closed();
  check('Esc closes the palette and focus returns to where it was (the card)', await onCard(String(s.schema.id)), await where(s.schema.id));

  // Ctrl+K again toggles it shut; from a card, focus comes back to the card
  await page.focus('.card');
  const cardId = await page.evaluate(() => document.activeElement.dataset.id);
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForSelector('#pal-dlg[open]'); await closing('pal-dlg');
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await closed();
  check('Ctrl+K again closes it, focus is back on the card', await onCard(cardId), await where(cardId));
  await page.keyboard.press('?'); await page.waitForSelector('#help-dlg[open]'); await closing('help-dlg');
  await page.keyboard.press('Escape'); await closed();
  check('? opens help; Esc closes it and focus is back on the card', await onCard(cardId), await where(cardId));
  // A live update that redraws the board while the palette or help is open: focus still comes back to that card.
  const redraw = () => page.evaluate(() => { $('board')._html = undefined; render(); });
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForSelector('#pal-dlg[open]'); await redraw(); await closing('pal-dlg');
  await page.keyboard.press('Escape'); await closed();
  check('the board redrawn while Ctrl+K is open: closing it, focus is back on the same card', await onCard(cardId), await where(cardId));
  await page.keyboard.press('?'); await page.waitForSelector('#help-dlg[open]'); await redraw(); await closing('help-dlg');
  await page.keyboard.press('Escape'); await closed();
  check('the board redrawn while help is open: closing it, focus is back on the same card', await onCard(cardId), await where(cardId));
  // Focus moved on between close() and its close event (a quick key or click) stays there: the board doesn't pull it back.
  for (const dlg of ['pal-dlg', 'help-dlg']) {
    if (dlg === 'pal-dlg') { await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control'); } else await page.keyboard.press('?');
    await page.waitForSelector(`#${dlg}[open]`); await closing(dlg);
    const other = await page.evaluate((dlg, id) => { const o = [...document.querySelectorAll('.card')].find((c) => c.dataset.id !== id); document.getElementById(dlg).close(); o.focus(); return o.dataset.id; }, dlg, cardId);
    await closed(); await sleep(400); // and past the fade, when the board tries again
    check(`${dlg === 'pal-dlg' ? 'Ctrl+K' : 'Help'} closed and focus moved to another card before its close event: it stays on that card`, await page.evaluate((id) => document.activeElement?.dataset?.id === id, other), await where(other));
    await page.evaluate((id) => document.querySelector(`.card[data-id="${id}"]`).focus(), cardId);
  }

  // ---- other commands ----
  const run = async (q) => { await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control'); await page.waitForSelector('#pal-dlg[open]'); await page.keyboard.type(q); await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.getElementById('pal-dlg').open); await sleep(250); };
  await run('new task');
  check('"New task" opens the empty task dialog', await page.$eval('#task-dlg', (d) => d.open) && await page.$eval('#td-title', (e) => e.textContent === 'New task'));
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('task-dlg').open);

  await run('answer the oldest');
  const oldest = await page.evaluate(() => [...document.querySelectorAll('textarea[id^="qa-"]')].map((t) => t.id)[0]);
  check('"Answer the oldest question" focuses the first answer box', await page.evaluate(() => document.activeElement.id) === oldest && /^qa-/.test(oldest), oldest);

  await run('go to chen');
  check('"Go to chen" focuses their row in Agents', await page.evaluate(() => !!document.activeElement.closest('[data-person-row="chen"]') && !!document.activeElement.closest('#o-right')), await page.evaluate(() => document.activeElement.outerHTML.slice(0, 80)));

  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control'); await page.waitForSelector('#pal-dlg[open]');
  await page.keyboard.type('theme:');
  l = await labels();
  check('Ctrl+K lists a "Theme: <name>" command for each of the fifteen themes and Auto', [...NAMES, 'Auto'].every((n) => l.some((x) => x.startsWith('Theme: ' + n))) && l.filter((x) => x.startsWith('Theme: ')).length === 16, JSON.stringify(l));
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('pal-dlg').open);
  await run('theme: high contrast');
  check('"Theme: High Contrast" switches the theme', (await attr()) === 'contrast');
  await run('theme: sticky');
  check('"Theme: Sticky Note" switches the theme and saves it', (await attr()) === 'sticky' && await page.evaluate(() => localStorage.getItem('board-theme')) === 'sticky');
  // The palette fades out even when its command changes every colour in one frame (a theme): the command runs once
  // the palette has faded.
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control'); await page.waitForSelector('#pal-dlg[open]');
  await sleep(300); await page.keyboard.type('theme: dusk');
  const palOut = await page.evaluate(async () => {
    const e = $('pal-dlg'), fr = []; $('pal-in').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const t0 = performance.now(); while (performance.now() - t0 < 400) { const cs = getComputedStyle(e); fr.push({ shown: cs.display !== 'none', op: +cs.opacity, dusk: document.documentElement.dataset.theme === 'dusk' }); await new Promise((r) => requestAnimationFrame(r)); }
    return { mid: fr.filter((x) => x.shown && x.op > 0 && x.op < 1).length, duskWhileShown: fr.some((x) => x.shown && x.dusk), end: !fr.at(-1).shown, dusk: fr.at(-1).dusk };
  });
  check('Ctrl+K with a theme command: the palette fades out, then the theme applies', palOut.mid >= 2 && !palOut.duskWhileShown && palOut.end && palOut.dusk, JSON.stringify(palOut));
  await run('theme: auto');
  check('"Theme: Auto" switches it back', (await attr()) === null);

  await run('show tasks for chen');
  check('"Show tasks for chen" sets the person filter', await page.$eval('#filter', (e) => e.value) === 'chen');
  await run('everyone');
  check('"Show tasks for everyone" clears it', await page.$eval('#filter', (e) => e.value) === '');

  await run('demo time');
  check('"Set the demo time" goes where the clock goes (its popover, focus in the time field)', await page.evaluate(() => document.activeElement.id === 'o-dl-in' && !$('o-dl').hidden), await page.evaluate(() => document.activeElement.id || document.activeElement.dataset.fk));
  await page.keyboard.press('Escape');

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
