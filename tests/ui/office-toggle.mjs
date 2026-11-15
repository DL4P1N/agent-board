// The board's view switch (header: Board | 3D office): the 3D office as a view inside the main board, built from
// office/src/live/embed.ts into public/office/embed.js by `npm run build:present`. Board is the default; the office
// (three.js) loads on the first switch only and draws the state the board already loads. Works with or without WebGL:
// Chrome runs with SwiftShader so CI runners without a GPU still get it; without WebGL the board stays, with a note.
// Run all suites with: npm test
import path from 'node:path';
import { startBoard, launchBrowser, shotsDir, finish, agent, rest, TOKEN } from '../helpers.mjs';

const board = await startBoard();
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);

await human('/settings', 'PUT', { goal: 'A voting app for hackathon projects', deadline: Date.now() + 3 * 3600e3, freeze_minutes: 60 });
const ana = await agent(board, 'ana-claude'); await ana('board_status');
const t1 = await ana('create_task', { title: 'Vote API', size: 'S' });
const t2 = await ana('create_task', { title: 'Leaderboard page' });
await ana('claim_task', { id: t1.id }); await ana('update_task', { id: t1.id, status: 'in_progress' });
await ana('ask_human', { question: 'Which login provider?' });
await ana('post', { text: '@dana the vote API is up' }); // a mention badge in the header too

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 900 }, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = shotsDir('office-toggle');
const errors = [];
const until = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, { timeout, polling: 100 }, arg).then(() => true).catch(() => false);
const view = (page) => page.evaluate(() => document.documentElement.dataset.boardView);
const shown = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !!(e.offsetWidth || e.offsetHeight); }, sel);
// Each page in its own browser context: its own localStorage, like a separate browser.
async function open(url = '/', { phone = false, setup, errs = errors } = {}) {
  const page = await (await browser.createBrowserContext()).newPage();
  const reqs = [];
  page.on('request', (r) => reqs.push(r.url()));
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  if (phone) await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); localStorage.setItem('board-setup', 'closed'); } catch {} });
  if (setup) await page.evaluateOnNewDocument(setup);
  await page.goto(board.base + url);
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
  await sleep(200);
  return { page, reqs };
}
const officeReqs = (reqs) => reqs.filter((u) => /\/office\//.test(u));

try {
  // ---- Default: the board, nothing 3D loaded ----
  const { page, reqs } = await open('/');
  const webgl = await page.evaluate(() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; } });
  check('default view is Board', await view(page) === 'board' && await shown(page, '#board') && !(await shown(page, '#office-view')));
  check('the switch sits in the header right after the brand: two pressed buttons, Board pressed', await page.evaluate(() => {
    const g = document.getElementById('vseg'); const r = [...g.querySelectorAll('button')];
    const h1 = document.querySelector('#app > header h1').getBoundingClientRect(); const v = g.getBoundingClientRect();
    return !g.hidden && g.closest('header') && v.left - h1.right < 40 && r.length === 2 && r[0].getAttribute('aria-pressed') === 'true' && r[1].getAttribute('aria-pressed') === 'false' && r[1].getAttribute('aria-label') === '3D office' && r[0].tabIndex === -1 && r[1].tabIndex === 0; // one Tab stop: the view to switch to
  }));
  check('no three.js or office code requested on load', officeReqs(reqs).length === 0 && !(await page.$('canvas')), officeReqs(reqs).join(' '));

  // ---- Header stays on one row with the switch (ONB-9 widths), also scrolled down, where the "need you" badge shows ----
  for (const w of [1366, 1440, 1600, 1920]) {
    await page.setViewport({ width: w, height: 900 }); await sleep(300);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(400);
    const hd = await page.evaluate(() => { const h = document.querySelector('#app > header'); const v = $('vseg').getBoundingClientRect(); const b = $('help-btn').getBoundingClientRect(); const n = $('needs'); return { h: h.offsetHeight, same: Math.abs(v.top - b.top) < 12, vis: v.width > 0, badge: !n.hidden && n.offsetWidth > 0 && /question/.test(n.querySelector('button')?.getAttribute('aria-label') || '') && !$('clock').hidden }; });
    check(`${w}px: header on one row with the view switch, the clock and the need-you badge`, hd.vis && hd.same && hd.h < 70 && hd.badge, JSON.stringify(hd));
  }
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
  check('the need-you badge hides while What to do now is on screen', await page.$eval('#needs', (n) => n.hidden));
  await page.setViewport({ width: 1440, height: 900 }); await sleep(200);

  // ---- Switch to the office ----
  await page.click('#vseg [data-vset="office"]');
  if (!webgl) {
    check('no WebGL in this browser: stays on the board with a note (office checks skipped)', await until(page, () => document.documentElement.dataset.boardView === 'board' && /3D office/.test(document.getElementById('toasts').innerText)));
  } else {
    check('switching shows the office view in place', await view(page) === 'office' && await page.$eval('#vseg [data-vset="office"]', (b) => b.getAttribute('aria-pressed') === 'true'));
    check('the switch is announced politely', await until(page, () => /Showing the 3D office/.test(document.getElementById('announcer').textContent)));
    check('first switch loads the office chunk and draws a canvas', await until(page, () => !!document.querySelector('#office-scene canvas'), null, 20000) && officeReqs(reqs).some((u) => /embed\.js/.test(u)) && officeReqs(reqs).some((u) => /OfficeScene-/.test(u)), officeReqs(reqs).map((u) => u.split('/').pop()).join(' '));
    check('loading note gone once it is ready', await until(page, () => !document.getElementById('office-view').classList.contains('loading')));
    check('the office fills the main area; the task columns are hidden', await page.evaluate(() => { const r = $('office-view').getBoundingClientRect(); return r.height > 350 && r.width > 1000 && !$('board').offsetWidth && document.documentElement.scrollHeight <= innerHeight + 1; }));
    check('What to do now and the questions (with Answer) stay above it', await shown(page, '#now') && await shown(page, '#q-panel textarea') && /Which login provider/.test(await page.$eval('#q-panel', (e) => e.innerText)));

    // The scene draws the state the board loaded, and follows it live.
    const s0 = await page.evaluate(() => window.__officeState);
    const a0 = s0?.agents.find((a) => a.id === 'ana-claude');
    check('the scene gets the board state: ana at a desk with her question', a0?.provider === 'claude' && a0.pose === 'raise_hand' && s0.tickets.length === 2, JSON.stringify(a0 && [a0.provider, a0.pose, s0.tickets.length]));
    const bob = await agent(board, 'bob-codex', 'codex-mcp-client'); await bob('board_status');
    await bob('claim_task', { id: t2.id }); await bob('update_task', { id: t2.id, status: 'blocked', note: 'needs a key' });
    check('state updates reach the scene (a new agent, blocked)', await until(page, () => window.__officeState?.agents.some((a) => a.id === 'bob-codex' && a.phase === 'blocked' && a.provider === 'codex')));
    await page.screenshot({ path: path.join(out, 'office-1440.png') });

    // Answer a question without leaving the office.
    const qid = await page.$eval('#q-panel textarea', (t) => t.id);
    await page.type('#' + qid, 'GitHub, please'); await page.keyboard.press('Enter');
    check('answering from the office view works and stays in the office', await until(page, () => !/Which login provider/.test(document.getElementById('q-panel').innerText) || document.getElementById('q-panel').hidden) && await view(page) === 'office');
    check('the answered question reaches the scene (hand down)', await until(page, () => window.__officeState?.agents.find((a) => a.id === 'ana-claude')?.pose !== 'raise_hand'));

    // Click a character (the scene's pick callback): a small card, then "Show in People" on the board.
    await page.evaluate(() => pickAgent('ana-claude'));
    const card = await page.$eval('#office-card', (c) => ({ shown: !c.hidden, t: c.innerText.replace(/\s+/g, ' ') })).catch(() => ({}));
    check('picking an agent shows a small card with what it holds', card.shown && /ana-claude/.test(card.t) && /Vote API/.test(card.t) && /Show in People/.test(card.t), card.t);
    await page.keyboard.press('Escape');
    check('Esc closes the card', await page.$eval('#office-card', (c) => c.hidden));
    await page.evaluate(() => pickAgent('ana-claude'));
    await page.click('#office-card [data-office-person]');
    check('"Show in People" switches to the board with that person open', await until(page, () => document.documentElement.dataset.boardView === 'board' && document.activeElement?.dataset.fk === 'ptog-ana'), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));

    // Keyboard: the buttons work from the keyboard; the palette has the command.
    await page.focus('#vseg [data-vset="office"]'); await page.keyboard.press('Enter');
    check('the switch works from the keyboard (Enter)', await view(page) === 'office' && await page.$eval('#vseg [data-vset="office"]', (b) => b.getAttribute('aria-pressed') === 'true'));
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    await page.type('#pal-in', 'switch to board'); await sleep(150);
    const pal = await page.$eval('#pal-list', (l) => l.innerText);
    await page.keyboard.press('Enter');
    check('Ctrl+K: "Switch to Board" (and back)', /Switch to Board/.test(pal) && await until(page, () => document.documentElement.dataset.boardView === 'board'), pal.replace(/\s+/g, ' ').slice(0, 80));
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    await page.type('#pal-in', '3d office'); await sleep(150);
    check('the palette offers "Switch to 3D office" on the board', /Switch to 3D office/.test(await page.$eval('#pal-list', (l) => l.innerText)));
    await page.keyboard.press('Enter');
    check('the office comes back without reloading its code', await until(page, () => document.documentElement.dataset.boardView === 'office') && officeReqs(reqs).filter((u) => /embed\.js/.test(u)).length === 1);

    // A What to do now link that leads to the task columns switches back to the board first.
    await page.click('#now [data-go="blocked"]');
    check('a link to the Blocked column (What to do now) opens the board view', await until(page, () => document.documentElement.dataset.boardView === 'board'));

    // Remembered across reloads; ?view= overrides.
    await page.click('#vseg [data-vset="office"]');
    check('the choice is saved in this browser', await page.evaluate(() => localStorage.getItem('board-view-mode') === 'office'));
    await page.reload(); await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
    check('after a reload: still the office', await view(page) === 'office' && await until(page, () => !!document.querySelector('#office-scene canvas'), null, 20000));
    await page.goto(board.base + '/?view=board'); await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
    check('?view=board overrides the saved choice', await view(page) === 'board' && !(await page.$('#office-scene canvas')));
    await page.close();
    const v2 = await open('/?view=office');
    check('?view=office opens the office (nothing saved)', await view(v2.page) === 'office' && await until(v2.page, () => !!document.querySelector('#office-scene canvas'), null, 20000) && await v2.page.evaluate(() => localStorage.getItem('board-view-mode') === null));

    // Theme: the office follows the board's light / dark choice.
    await v2.page.evaluate(() => setTheme('light')); await sleep(300);
    check('a light theme gives the office its Day colours', await v2.page.evaluate(() => sceneTheme() === 'light' && window.__officeState?.agents.length > 0));
    for (const [w, h, theme] of [[1440, 900, 'dark'], [1440, 900, 'light'], [1366, 768, 'dark']]) {
      await v2.page.evaluate((t) => setTheme(t), theme);
      await v2.page.setViewport({ width: w, height: h }); await sleep(800);
      await v2.page.screenshot({ path: path.join(out, `office-${w}-${theme}.png`) });
    }
    await v2.page.close();

    // The office code can't be fetched (offline): a note, and the board stays.
    const off = await open('/', { errs: [] }); // the refused request logs an error: expected here
    await off.page.setRequestInterception(true);
    off.page.on('request', (r) => (/\/office\/embed\.js/.test(r.url()) ? r.abort() : r.continue()));
    await off.page.click('#vseg [data-vset="office"]');
    check('office code fails to load: back on the board with a note', await until(off.page, () => document.documentElement.dataset.boardView === 'board' && /didn't load/.test(document.getElementById('toasts').innerText)));
    await off.page.close();
  }
  if (!page.isClosed()) await page.close().catch(() => {});

  // ---- No WebGL: the board stays, with a message, and the switch goes away ----
  const ng = await open('/', { setup: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, o) { return /webgl/.test(k) ? null : g.call(this, k, o); }; } });
  await ng.page.click('#vseg [data-vset="office"]');
  check('WebGL unavailable: stays on the board with a message', await until(ng.page, () => document.documentElement.dataset.boardView === 'board' && /can't show the 3D office/.test(document.getElementById('toasts').innerText)));
  check('WebGL unavailable: the switch hides, nothing 3D downloaded', await ng.page.$eval('#vseg', (g) => g.hidden) && officeReqs(ng.reqs).length === 0, officeReqs(ng.reqs).join(' '));
  await ng.page.close();
  const ng2 = await open('/?view=office', { setup: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, o) { return /webgl/.test(k) ? null : g.call(this, k, o); }; } });
  check('WebGL unavailable with ?view=office: the board, with the message', await view(ng2.page) === 'board' && await until(ng2.page, () => /can't show the 3D office/.test(document.getElementById('toasts').innerText)));
  await ng2.page.close();

  // ---- Phones: no switch, and ?view=office stays on the board ----
  const ph = await open('/?view=office', { phone: true });
  check('phone: the switch is hidden', !(await shown(ph.page, '#vseg')));
  check('phone: ?view=office stays on the board, nothing 3D loaded', await view(ph.page) === 'board' && officeReqs(ph.reqs).length === 0);
  await ph.page.close();

  // ---- The presenter link moved into the help dialog (one way into the scene from the header) ----
  const pr = await open('/');
  await until(pr.page, () => !document.getElementById('present-link').hidden);
  const ph1 = await pr.page.$eval('#present-link', (a) => a.getAttribute('href'));
  check('#present-link (in the help dialog) opens present.html with the viewer token', /\/present\.html\?token=/.test(ph1) && !ph1.includes(TOKEN) && await pr.page.$eval('#present-link', (a) => !!a.closest('#help-dlg') && !document.querySelector('#app > header #present-link')), ph1);
  await pr.page.close();

  check('no console errors', !errors.length, errors.join('; '));
} catch (e) {
  R.push(`CRASH ${e.stack || e.message}`);
}
await finish(R, { browser, board });
