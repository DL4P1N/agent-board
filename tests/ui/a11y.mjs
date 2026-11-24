// Accessibility and phone checks: live announcements, one Tab stop per column, phase-track list,
// 12px minimum text, badges that wrap, a jump-to-chat button and 32px touch targets.
// Starts its own throwaway board. Run all suites with: npm test
import { startBoard, launchBrowser, shotsDir, finish, seed, rest } from '../helpers.mjs';

const board = await startBoard();
const out = shotsDir('a11y');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = (page, fn, arg, timeout = 5000) => page.waitForFunction(fn, { timeout, polling: 100 }, arg).then(() => true).catch(() => false);
const errors = [];
const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 1000 } });

try {
  const ids = await seed(board);
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|ERR_CONNECTION|EventSource/i.test(m.text()) && errors.push('console: ' + m.text()));
  page.on('dialog', (d) => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); } catch {} });
  await page.goto(board.base + '/');
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live') && document.querySelectorAll('.card').length > 5, { timeout: 8000 });
  await sleep(300);
  // Every suite runs with a mouse, as on CI, also on a touch-screen laptop and after setViewport (launchBrowser).
  await page.setViewport({ width: 1400, height: 1000 });
  const mouse = await page.evaluate(() => matchMedia('(pointer: fine) and (hover: hover)').matches && !matchMedia('(any-pointer: coarse)').matches);
  await page.setViewport({ width: 1440, height: 1000 });
  check('the browser has a mouse ((pointer: fine), hover), also after setViewport', mouse && await page.evaluate(() => matchMedia('(pointer: fine) and (hover: hover)').matches));

  // ---- A11Y-4: phase track is a labelled list ----
  const ph = await page.evaluate(() => {
    const ol = document.querySelector('.phases ol');
    return ol && { label: ol.getAttribute('aria-label'), lis: ol.querySelectorAll(':scope > li').length, cur: ol.querySelector('li [aria-current="step"]')?.textContent, labelHidden: document.querySelector('.phases .ph-l')?.getAttribute('aria-hidden') };
  });
  check('A11Y-4 phase track is an <ol> with "Phase: X, step n of m"', !!ph && /^Phase: .+, step \d+ of \d+$/.test(ph.label) && ph.lis >= 5 && ph.label.includes(ph.cur) && ph.labelHidden === 'true', JSON.stringify(ph));

  // ---- A11Y-3: nothing under 12px in pills and feed times ----
  const fs = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.pill, .ev time, .card .mv')].map((e) => parseFloat(getComputedStyle(e).fontSize))));
  check('A11Y-3 pills, feed times and Move… are at least 12px', fs >= 12, fs + 'px');

  // ---- A11Y-2: one Tab stop per column ----
  const stops = await page.evaluate(() => {
    const cols = [...document.querySelectorAll('#board .col')].filter((c) => c.querySelector('.card'));
    return { cols: cols.length, perCol: cols.map((c) => c.querySelectorAll('.card[tabindex="0"]').length), stray: [...document.querySelectorAll('#board .card[tabindex="-1"]')].filter((c) => [...c.querySelectorAll('button, a[href]')].some((b) => b.tabIndex >= 0)).length };
  });
  check('A11Y-2 exactly one card per column is a Tab stop', stops.perCol.every((n) => n === 1), JSON.stringify(stops));
  check('A11Y-2 other cards\' buttons and links are out of the Tab order', stops.stray === 0, stops.stray);
  const openCol = await page.evaluate(() => [...document.querySelectorAll('#col-open .card')].map((c) => c.dataset.id));
  await page.focus(`.card[data-id="${openCol[0]}"]`);
  await page.keyboard.press('ArrowDown');
  const after = await page.evaluate(() => ({ id: document.activeElement?.dataset.id, ti: document.activeElement?.tabIndex }));
  check('A11Y-2 ArrowDown moves to the next card, which becomes the Tab stop', after.id === openCol[1] && after.ti === 0 && await page.$eval(`.card[data-id="${openCol[0]}"]`, (c) => c.tabIndex === -1), JSON.stringify(after));
  await page.keyboard.press('Tab');
  check('A11Y-2 Tab from the current card reaches its own Move…', await page.evaluate((id) => document.activeElement?.dataset.move === id, openCol[1]));
  await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  await page.keyboard.press('ArrowRight');
  check('A11Y-2 ArrowRight moves to the next column', await page.evaluate(() => document.activeElement?.closest('.col')?.id !== 'col-open' && document.activeElement?.classList.contains('card')));
  await page.keyboard.press('Enter'); await sleep(250);
  check('A11Y-2 Enter on a card opens its dialog', await page.evaluate(() => $('task-dlg').open));
  await page.keyboard.press('Escape'); await sleep(200);
  // The current card survives a live re-render.
  await page.focus(`.card[data-id="${openCol[1]}"]`);
  await rest(board, 'bob', '/messages', 'POST', { text: 're-render please' });
  await until(page, () => /re-render please/.test(document.getElementById('feed').innerText));
  check('A11Y-2 current card stays the Tab stop after a live update', await page.$eval(`.card[data-id="${openCol[1]}"]`, (c) => c.tabIndex === 0));
  // Tab walk through the board: one stop per column plus the current card's controls, far fewer than before.
  const walk = await page.evaluate(() => [...document.querySelectorAll('#board [tabindex], #board button, #board a[href]')].filter((e) => e.tabIndex >= 0 && e.offsetParent).length);
  const cardsN = await page.evaluate(() => document.querySelectorAll('#board .card').length);
  check('A11Y-2 board Tab stops fewer than the number of cards plus their buttons', walk < cardsN * 2, `${walk} stops for ${cardsN} cards`);

  // ---- A11Y-1: mentions and blocked tasks are announced, politely and throttled ----
  check('A11Y-1 activity region is polite', await page.$eval('#activity-live', (a) => a.getAttribute('aria-live') === 'polite'));
  check('A11Y-1 history on load is not read out', (await page.$eval('#activity-live', (a) => a.textContent)) === '');
  await page.evaluate(() => { ACT_GAP = 3000; });
  await rest(board, 'chen', '/messages', 'POST', { text: '@dana the colours are ready' });
  await until(page, () => /chen mentioned you/.test(document.getElementById('activity-live').textContent));
  const a1 = await page.$eval('#activity-live', (a) => a.textContent);
  check('A11Y-1 a mention of me is announced', /chen mentioned you: @dana the colours are ready/.test(a1), a1);
  await rest(board, 'chen', `/tasks/${ids.lb.id}`, 'PATCH', { status: 'blocked' });
  await rest(board, 'bob', '/messages', 'POST', { text: '@dana one more thing' });
  await until(page, (id) => /one more thing/.test(document.getElementById('feed').innerText) && !!document.querySelector(`#col-blocked .card[data-id="${id}"]`), ids.lb.id);
  check('A11Y-1 throttled: nothing new within the gap', (await page.$eval('#activity-live', (a) => a.textContent)) === a1);
  await until(page, () => /^2 updates\./.test(document.getElementById('activity-live').textContent), undefined, 6000);
  const a2 = await page.$eval('#activity-live', (a) => a.textContent);
  check('A11Y-1 after the gap, the queued updates are announced together', /^2 updates\./.test(a2) && new RegExp(`#${ids.lb.id} is blocked`).test(a2) && /bob mentioned you/.test(a2), a2);

  // ---- U8: the message box comes before the feed's links in the Tab order (a PR link in the feed is a Tab stop) ----
  await rest(board, 'chen', '/messages', 'POST', { text: 'Opened https://github.com/team/vote/pull/49 and https://github.com/team/vote/pull/50 for review' });
  await until(page, () => document.querySelectorAll('#feed a[href*="/pull/"]').length >= 2);
  await page.evaluate(() => document.querySelector('#tabs [data-tab="direct"]').focus());
  await page.keyboard.press('Tab');
  check('U8 Tab from Activity\'s filters goes to the message box, before the feed and its links', await page.evaluate(() => document.activeElement === $('msg')), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  const order = await page.evaluate(() => { const r = $('feed').getBoundingClientRect(), m = $('msg').getBoundingClientRect(); return { feedAbove: r.bottom <= m.top + 1 }; });
  check('U8 the feed is still drawn above the message box', order.feedAbove, JSON.stringify(order));

  await page.screenshot({ path: `${out}/desktop.png` });
  check('U13 with a mouse, the chat hint names the keys', /Shift\+Enter/.test(await page.$eval('#chat-hint', (e) => e.innerText)));
  check('MO-2 no Chat button on desktop', await page.$eval('#tochat', (b) => getComputedStyle(b).display === 'none'));

  // ---- Phone: badges, chat button, touch targets ----
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(400);
  const hdr = await page.evaluate(() => ({ ov: document.documentElement.scrollWidth - innerWidth, clipped: [...document.querySelectorAll('#needs button')].filter((b) => b.offsetWidth && b.getBoundingClientRect().right > innerWidth).map((b) => b.textContent), hidden: $('needs').hidden }));
  // One "need attention" badge, hidden while What to do now is on screen: no third header row on a phone.
  check('MO-1 phone: no badge row in the header while What to do now is on screen, nothing cut off', hdr.hidden && !hdr.clipped.length, JSON.stringify(hdr));
  check('phone: no horizontal overflow at 390px', hdr.ov <= 0, hdr.ov + 'px');
  await page.screenshot({ path: `${out}/phone-top.png` });
  // Chat is a header icon on a phone (no floating button over the questions or the cards), named "Chat".
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
  check('MO-2 phone: Chat is an icon button in the header, named "Chat"', await page.$eval('#tochat', (b) => b.closest('header') && getComputedStyle(b).display !== 'none' && getComputedStyle(b).position !== 'fixed' && b.getBoundingClientRect().top >= 0 && b.getBoundingClientRect().bottom <= 80 && b.getAttribute('aria-label') === 'Chat'), await page.$eval('#tochat', (b) => JSON.stringify([!!b.closest('header'), getComputedStyle(b).display, getComputedStyle(b).position, b.getBoundingClientRect().top, b.getBoundingClientRect().bottom])));
  await page.click('#tochat'); await sleep(1500);
  const chat = await page.evaluate(() => { const r = $('msg').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight, focus: document.activeElement === $('msg') }; });
  check('MO-2 phone: Chat jumps to the message box', chat.focus && chat.top >= 0 && chat.bottom <= chat.h, JSON.stringify(chat));

  await page.screenshot({ path: `${out}/phone-chat.png` });
  const small = await page.evaluate(() => [...document.querySelectorAll('#app button, #app a[href], #app select')]
    .filter((e) => e.offsetParent && !e.closest('.vh') && !e.classList.contains('skip'))
    .map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.height < 32)
    .map(({ e, r }) => `${e.className || e.tagName} "${e.textContent.trim().slice(0, 16)}" ${Math.round(r.width)}x${Math.round(r.height)}`));
  check('MO-3 phone: every visible control is at least 32px tall (a PR link in the feed too)', !small.length && await page.$$eval('#feed a[href*="/pull/"]', (l) => l.length >= 2), small.slice(0, 8).join(' | '));
  const hints = await page.evaluate(() => ({ chat: $('chat-hint').innerText, foot: $('cols-hint').innerText }));
  check('U13 phone: no keyboard-only or drag hints (Enter, Shift+Enter, "/", drag); the foot says Move… and tap', !/Enter|press \/|Drag/.test(hints.chat + hints.foot) && /Move… button/.test(hints.foot) && /Tap a card/.test(hints.foot), JSON.stringify(hints));

  // ---- A desktop-sized touch screen (a tablet in landscape, a touch laptop): the touch sizes, not the phone layout ----
  // The other suites run with a mouse; this is the touch pass at a desktop width.
  await page.setViewport({ width: 1440, height: 900, hasTouch: true }); // puppeteer reloads the page for touch
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live') && document.querySelectorAll('.card').length > 5, { timeout: 8000 });
  const tp = await page.evaluate(() => ({ coarse: matchMedia('(hover: none) and (pointer: coarse)').matches, ctl: getComputedStyle(document.documentElement).getPropertyValue('--ctl').trim(), w: innerWidth }));
  check('touch at 1440px: the touch rules apply (pointer coarse, no hover; --ctl 2.5rem)', tp.coarse && tp.ctl === '2.5rem' && tp.w === 1440, JSON.stringify(tp));
  const smallT = await page.evaluate(() => [...document.querySelectorAll('#app button, #app a[href], #app select, #app input:not([type="hidden"])')]
    .filter((e) => e.offsetParent && !e.closest('.vh') && !e.classList.contains('skip'))
    .map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.width && r.height < 31.5) // sub-pixel layout: 31.99 is 32
    .map(({ e, r }) => `${e.id || e.dataset.fk || e.className || e.tagName} "${e.textContent.trim().slice(0, 16)}" ${Math.round(r.width)}x${Math.round(r.height)}`));
  check('touch at 1440px: every visible control is at least 32px tall', !smallT.length, smallT.slice(0, 8).join(' | '));
  await page.screenshot({ path: `${out}/touch-1440.png` });
} catch (e) { results.push('CRASH ' + e.stack); }
check('no page/console errors or native dialogs', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
