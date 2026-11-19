// The session recap page (public/recap.html, data from GET /api/recap): it opens from the board's help and the
// command palette with the read-only viewer token, renders every panel with no console errors, shows hostile text
// as text, works in every theme and on a phone, and prints on light paper. The numbers: tests/recap.mjs.
// Starts its own throwaway board. Run all suites with: npm test
import path from 'node:path';
import { startBoard, launchBrowser, shotsDir, finish, agent, rest, TOKEN } from '../helpers.mjs';

const board = await startBoard();
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);
// Calls __xss(n) if it ever runs; must show up as text.
const P = (n) => `<img src=x onerror=__xss(${n})>"><svg onload=__xss(${n + 1})>`;
const MARK = '<img src=x onerror=__xss(';

await human('/settings', 'PUT', { goal: `Ship the recap ${P(10)}`, integrator: '*' });
const evil = await agent(board, 'evil-claude'); await evil('board_status');
const bob = await agent(board, 'bob-claude'); await bob('board_status');
const t1 = await human('/tasks', 'POST', { title: `Title ${P(20)}`, size: 'S' });
const t2 = await human('/tasks', 'POST', { title: `Blocked ${P(30)}`, size: 'S' });
await human('/tasks', 'POST', { title: 'Still open', size: 'S' });
await evil('claim_task', { id: t1.id }); await evil('update_task', { id: t1.id, status: 'in_progress' });
await evil('update_task', { id: t1.id, status: 'review', note: 'ready' });
await bob('claim_review', { id: t1.id }); await bob('update_task', { id: t1.id, status: 'done' });
await bob('claim_task', { id: t2.id });
const q = await bob('ask_human', { question: `Which key? ${P(40)}`, task_id: t2.id });
await bob('update_task', { id: t2.id, status: 'blocked', note: `stuck ${P(50)}` });
await human(`/questions/${q.question_id}/answer`, 'POST', { answer: 'staging' });
await bob('update_task', { id: t2.id, status: 'in_progress', note: `unstuck ${P(60)}` });
const longA = await agent(board, 'a-really-long-agent-name-for-a-narrow-phone-claude'); await longA('board_status');
const t3 = await human('/tasks', 'POST', { title: 'Narrow check', size: 'S' });
await longA('claim_task', { id: t3.id }); await longA('update_task', { id: t3.id, status: 'in_progress' });

const st = await human('/state');
const VIEW = st.setup.viewer_token;
const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1400, height: 900 } });
const out = shotsDir('recap');
async function open(url, { viewport, theme, human: asHuman } = {}) {
  const page = await (await browser.createBrowserContext()).newPage();
  if (viewport) await page.setViewport(viewport);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  page.on('dialog', (d) => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  await page.evaluateOnNewDocument((theme, asHuman) => {
    window.__hits = []; window.__xss = (n) => window.__hits.push(n);
    try { if (theme) localStorage.setItem('board-theme', theme); if (asHuman) { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); localStorage.setItem('board-setup', 'closed'); } } catch {}
  }, theme || '', !!asHuman);
  await page.goto(board.base + url);
  return { page, errs };
}
const ready = (page) => page.waitForFunction(() => document.querySelectorAll('#recap .o-panel').length === 6, { timeout: 8000 }).then(() => true).catch(() => false);

try {
  // ---- from the board: help and the command palette, with the viewer token ----
  {
    const { page, errs } = await open('/', { human: true });
    await page.waitForFunction(() => window.state?.tasks?.length || document.querySelector('.card'), { timeout: 10000 }).catch(() => {});
    await page.waitForFunction(() => !document.getElementById('recap-row').hidden, { timeout: 8000 }).catch(() => {});
    const href = await page.$eval('#recap-link', (a) => a.getAttribute('href'));
    check('the help links to the recap with the viewer token, never the board token', href.endsWith(`/recap.html?token=${encodeURIComponent(VIEW)}`) && !href.includes(TOKEN) && VIEW !== TOKEN, href);
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    await page.waitForSelector('#pal-dlg[open]', { timeout: 4000 }).catch(() => {});
    await page.type('#pal-in', 'recap'); await sleep(300);
    check('the command palette offers the recap', /Open the session recap/.test(await page.$eval('#pal-list', (l) => l.innerText)));
    check('board: no console errors', !errs.length, errs.join(' | '));
    await page.close();
  }

  // ---- the page, as the viewer ----
  const { page, errs } = await open(`/recap.html?token=${encodeURIComponent(VIEW)}`);
  check('renders all six panels for the viewer token', await ready(page));
  const txt = await page.$eval('#recap', (m) => m.innerText);
  check('session facts: 1 of 4 tasks done, 1 merged, 1 of 1 questions answered', /1 of 4\s*tasks done/.test(txt) && /1\s*merged to main/.test(txt) && /1 of 1\s*questions answered/.test(txt), txt.slice(0, 300));
  check('agents: evil-claude and bob-claude', /evil-claude/.test(txt) && /bob-claude/.test(txt));
  check('humans: dana answered 1', await page.evaluate(() => [...document.querySelectorAll('#recap tr')].some((r) => /dana/.test(r.innerText) && /\b1\b/.test(r.cells[1]?.innerText))));
  check('the longest block says who unblocked it and the answer before it', /unblocked by bob-claude/.test(txt) && /after dana answered/.test(txt), txt);
  check('timeline: an SVG step line', await page.$eval('.rc-chart path.ln', (p) => /H[\d.]+ V[\d.]+/.test(p.getAttribute('d'))));
  check('hostile text shows as text', txt.includes(MARK) && (await page.$eval('.rc-goal', (g, m) => g.textContent.includes(m) && !g.querySelector('img, svg'), MARK)));
  check('no payload ran and none became HTML', await page.evaluate(() => !window.__hits.length && !document.querySelector('#recap img, #recap [onerror], #recap [onload], #recap svg:not(.rc-chart)')));
  check('the token is taken out of the address bar and kept under the viewer key', !/token=/.test(page.url()) && await page.evaluate(() => !!localStorage.getItem('board-view-token') && !localStorage.getItem('board-token')), page.url());
  check('recap page: no console errors', !errs.length, errs.join(' | '));
  await page.screenshot({ path: path.join(out, 'recap.png'), fullPage: true });

  // Print: light paper, no Print button, no shadows.
  await page.emulateMediaType('print');
  const pr = await page.evaluate(() => ({ btn: getComputedStyle(document.getElementById('print')).display, bg: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color, sh: getComputedStyle(document.querySelector('.o-panel')).boxShadow }));
  check('print: white paper, dark ink, no button, no shadows', pr.btn === 'none' && pr.bg === 'rgb(255, 255, 255)' && pr.ink === 'rgb(17, 17, 17)' && pr.sh === 'none', JSON.stringify(pr));
  check('print: the goal is not clamped', await page.evaluate(() => { const g = document.querySelector('.rc-goal'); const s = getComputedStyle(g); return s.overflow === 'visible' && (s.webkitLineClamp === 'none' || s.webkitLineClamp === '') ; }));
  await page.emulateMediaType('screen');
  check('the live region is a small status line, not the whole page', await page.evaluate(() => !document.querySelector('[aria-live]') && document.getElementById('rc-status').getAttribute('role') === 'status' && document.getElementById('rc-status').hidden));
  // The server out of reach: the recap stays, the status line says it may be behind, and a later reload clears it.
  await page.setOfflineMode(true); await page.evaluate(() => load());
  const off = await page.evaluate(() => ({ st: !document.getElementById('rc-status').hidden && /retrying/.test(document.getElementById('rc-status').textContent), panels: document.querySelectorAll('#recap .o-panel').length }));
  check('server out of reach: the recap stays, the status line says it is retrying', off.st && off.panels === 6, JSON.stringify(off));
  await page.setOfflineMode(false); await page.evaluate(() => load());
  check('back in reach: the status line goes', await page.evaluate(() => document.getElementById('rc-status').hidden && document.querySelectorAll('#recap .o-panel').length === 6));
  await page.close();

  // ---- every theme, and a phone ----
  const themes = ['dark', 'light', 'terminal', 'contrast', 'sticky', 'night'];
  const themeErrs = [];
  for (const theme of themes) {
    const r = await open(`/recap.html?token=${encodeURIComponent(VIEW)}`, { theme });
    if (!(await ready(r.page))) themeErrs.push(`${theme}: did not render`);
    const c = await r.page.evaluate(() => ({ t: document.documentElement.dataset.theme, ink: getComputedStyle(document.body).color, bg: getComputedStyle(document.body).backgroundColor }));
    if (c.t !== theme || c.ink === c.bg) themeErrs.push(`${theme}: ${JSON.stringify(c)}`);
    themeErrs.push(...r.errs.map((e) => `${theme}: ${e}`));
    if (theme === 'terminal') await r.page.screenshot({ path: path.join(out, 'recap-terminal.png'), fullPage: true });
    await r.page.close();
  }
  check('renders in each theme sampled', !themeErrs.length, themeErrs.join(' | '));
  {
    const { page: ph, errs: pe } = await open(`/recap.html?token=${encodeURIComponent(VIEW)}`, { viewport: { width: 375, height: 740, isMobile: true, hasTouch: true } });
    check('phone: renders', await ready(ph));
    const w = await ph.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: innerWidth, cols: getComputedStyle(document.getElementById('recap')).gridTemplateColumns.split(' ').length }));
    check('phone: one column, no sideways scroll', w.doc <= w.win && w.cols === 1, JSON.stringify(w));
    check('phone: no console errors', !pe.length, pe.join(' | '));
    await ph.screenshot({ path: path.join(out, 'recap-phone.png'), fullPage: true });
    await ph.close();
  }
  {
    const { page: sm } = await open(`/recap.html?token=${encodeURIComponent(VIEW)}`, { viewport: { width: 360, height: 740, isMobile: true, hasTouch: true } });
    check('360px: renders', await ready(sm));
    const w = await sm.evaluate(() => { const t = document.querySelector('.tw'); return { doc: document.documentElement.scrollWidth, win: innerWidth, ox: getComputedStyle(t).overflowX, long: /a-really-long-agent-name/.test(t.innerText), clipped: t.scrollWidth > t.clientWidth }; });
    check('360px: a long agent name and the numbers beside it stay reachable (the table scrolls in its panel), the page does not scroll sideways', w.long && w.doc <= w.win && (!w.clipped || w.ox === 'auto'), JSON.stringify(w));
    await sm.close();
  }

  // ---- without a token, and with a wrong one ----
  {
    const { page: np } = await open('/recap.html');
    await np.waitForFunction(() => /Open this from the board/.test(document.body.innerText), { timeout: 5000 }).catch(() => {});
    check('no token: says where to open it', /Open this from the board/.test(await np.evaluate(() => document.body.innerText)));
    await np.goto(`${board.base}/recap.html?token=wrong`);
    await np.waitForFunction(() => /expired/.test(document.body.innerText), { timeout: 5000 }).catch(() => {});
    check('a wrong token: the link has expired', /expired/.test(await np.evaluate(() => document.body.innerText)));
    await np.close();
  }
} catch (e) {
  check('recap UI suite ran', false, e.stack);
}
await finish(R, { browser, board });
