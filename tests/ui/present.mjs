// Classic presenter (public/present-classic.html): the simple read-only big-screen page. The 3D office presenter
// (public/present.html, tests/ui/office-present.mjs) falls back to it without WebGL and links to it as "Simple view".
// Starts its own throwaway board. Run all suites with: npm test
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
await ana('create_task', { title: 'Submit form' });
await ana('claim_task', { id: t1.id }); await ana('update_task', { id: t1.id, status: 'in_progress' });
await ana('update_task', { id: t1.id, status: 'review', note: 'done' });
await human(`/tasks/${t1.id}`, 'PATCH', { status: 'done' });
await ana('claim_task', { id: t2.id }); await ana('update_task', { id: t2.id, status: 'in_progress' });
await human('/messages', 'POST', { text: 'go team' });

// The presenter link carries the read-only viewer token, never the board token.
const st = await human('/state');
const VIEW = st.setup?.viewer_token;
check('the board gives humans a viewer token (separate from the board token)', !!VIEW && VIEW !== TOKEN, String(VIEW));
const asViewer = (p, method = 'GET') => fetch(`${board.base}/api${p}`, { method, headers: { Authorization: `Bearer ${VIEW}`, 'Content-Type': 'application/json' } });
const vs = await asViewer('/state');
const vbody = vs.ok ? await vs.json() : null;
check('the viewer token reads the board but gets no setup or tokens', vs.status === 200 && !vbody.setup && !JSON.stringify(vbody).includes(TOKEN), String(vs.status));
check('the viewer token cannot change anything', [403, 401].includes((await asViewer('/messages', 'POST')).status));

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1600, height: 900 } });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const out = shotsDir('present');
try {
  await page.goto(`${board.base}/present-classic.html?token=${encodeURIComponent(VIEW)}`);
  await page.waitForFunction(() => /Leaderboard|Vote API|voting app/i.test(document.body.innerText), { timeout: 8000 });
  const txt = await page.evaluate(() => document.body.innerText);
  check('goal shown large, as text (no HTML injected)', await page.$eval('h1.goal', (h) => h.textContent.includes('<b>live</b>') && !h.querySelector('b')));
  check('progress: 1 of 3 done, with a progress bar', /1 of 3 done/.test(txt) && await page.$eval('[role=progressbar]', (b) => b.getAttribute('aria-valuenow') === '1' && b.getAttribute('aria-valuemax') === '3'), txt.slice(0, 200));
  check('column counts', /In progress\s*1/.test(txt) && /Open\s*1/.test(txt) && /Done\s*1/.test(txt));
  check('countdown to the demo with the freeze time', /2h 0\dm|2h 05m|2h 04m/.test(await page.$eval('#clock', (c) => c.textContent)) && /feature freeze at/.test(txt), await page.$eval('#clock', (c) => c.textContent));
  check('now working on: ana with her task', /ana/.test(await page.$eval('#h-now', (h) => h.parentElement.innerText)) && /Leaderboard page/.test(txt));
  check('just merged lists #1', /#\s*1/.test(await page.$eval('#h-merged', (h) => h.parentElement.innerText)) && /Vote API/.test(await page.$eval('#h-merged', (h) => h.parentElement.innerText)));
  check('token removed from the address bar', !/token=/.test(page.url()), page.url());
  check('kept under its own key, never the board token key', await page.evaluate(() => !!localStorage.getItem('board-view-token') && !localStorage.getItem('board-token')));
  check('no link to the full board', !(await page.$('a[href="/"]')));
  await page.screenshot({ path: path.join(out, 'present.png') });
  // Live update: another merge shows up without reloading.
  await ana('update_task', { id: t2.id, status: 'review' }); await human(`/tasks/${t2.id}`, 'PATCH', { status: 'done' });
  const updated = await page.waitForFunction(() => /2 of 3 done/.test(document.body.innerText), { timeout: 8000 }).then(() => true).catch(() => false);
  check('updates live (2 of 3 done)', updated);
  // A busier board: more merges, a claimed task, an agent out of usage, an agent with no task.
  const more = [];
  for (const title of ['Dark mode', 'Share link', 'QR code', 'Export CSV', 'Search box']) more.push(await ana('create_task', { title }));
  for (const t of more.slice(0, 4)) { await ana('claim_task', { id: t.id }); await ana('update_task', { id: t.id, status: 'review' }); await human(`/tasks/${t.id}`, 'PATCH', { status: 'done' }); }
  const bobCodex = await agent(board, 'bob-codex', 'codex'); await bobCodex('board_status'); await bobCodex('claim_task', { id: more[4].id });
  const bobClaude = await agent(board, 'bob-claude'); await bobClaude('board_status');
  const erin = await agent(board, 'erin-claude'); await erin('board_status');
  const submit = (await human('/state')).tasks.find((t) => t.title === 'Submit form');
  await erin('claim_task', { id: submit.id }); await human('/agents/erin-claude', 'PATCH', { limited: true });
  // Wait for the last change (erin out of usage) too: the count can update a reload before it.
  await page.waitForFunction(() => /6 of 8 done/.test(document.body.innerText) && /out of usage/.test(document.getElementById('h-now').parentElement.innerText), { timeout: 12000 }).catch(() => {});
  await sleep(300);
  const nowTxt = await page.$eval('#h-now', (h) => h.parentElement.innerText);
  check('now working on: no tool-call jargon', !/board call|board_status|update_task/.test(nowTxt), nowTxt);
  check('now working on: bob with bob-codex\'s claimed task', new RegExp(`bob[\\s\\S]*#${more[4].id} Search box`).test(nowTxt), nowTxt);
  check('now working on: erin is out of usage but her task is still shown', new RegExp(`erin[\\s\\S]*#${submit.id} Submit form[\\s\\S]*out of usage`).test(nowTxt), nowTxt);
  check('just merged: capped at 4', await page.$eval('#h-merged', (h) => h.parentElement.querySelectorAll('li').length) === 4);
  const colsTxt = await page.$eval('.cols', (c) => c.innerText);
  check('claimed counted in In progress, as on the board', /In progress\s*2/.test(colsTxt) && !/Claimed/.test(colsTxt), colsTxt);
  // A goal pasted from a doc: plain words, at most 2 lines.
  await human('/settings', 'PUT', { goal: 'Follow the design document: `docs/design.md` and **ship** a [companion app](https://example.com) that every attendee at the conference can use on their phone during the talks, the breaks and the evening events' });
  await page.waitForFunction(() => /Follow the design/.test(document.querySelector('h1.goal')?.textContent || ''), { timeout: 8000 });
  const goal = await page.$eval('h1.goal', (h) => ({ t: h.textContent, lines: h.clientHeight / parseFloat(getComputedStyle(h).lineHeight) }));
  check('goal: markdown stripped', !/[`*[\]]/.test(goal.t) && /docs\/design\.md and ship a companion app/.test(goal.t), goal.t);
  check('goal: at most 2 lines', goal.lines <= 2.2, String(goal.lines));
  // Fits a 1366×768 projector and 1920×1080 without scrolling.
  for (const [w, hgt] of [[1366, 768], [1920, 1080]]) {
    await page.setViewport({ width: w, height: hgt }); await sleep(300);
    const sh = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, Math.ceil(document.getElementById("app").getBoundingClientRect().bottom)));
    check(`fits ${w}×${hgt} without scrolling`, sh <= hgt, `scrollHeight ${sh}`);
    await page.screenshot({ path: path.join(out, `present-${w}.png`) });
  }
  await page.setViewport({ width: 1600, height: 900 });
  // Deadline passed.
  await human('/settings', 'PUT', { deadline: Date.now() + 1000, freeze_minutes: 0 }); // a past time is refused: let it pass
  await new Promise((r) => setTimeout(r, 1200));
  const past = await page.waitForFunction(() => /Demo time/.test(document.getElementById('clock')?.textContent || ''), { timeout: 8000 }).then(() => true).catch(() => false);
  check('after the deadline: "Demo time"', past);
  // An hour or more after the demo: "Event finished" with the final numbers.
  // The API refuses past demo times, so move the page's clock forward instead.
  await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 2 * 3600e3; });
  const fin = await page.waitForFunction(() => /Event finished/.test(document.getElementById('clock')?.textContent || ''), { timeout: 8000 }).then(() => true).catch(() => false);
  check('long after the demo: "Event finished" with the final numbers', fin && /Final: 6 of 8 tasks done/.test(await page.$eval('#clock-sub', (s) => s.textContent)), await page.$eval('#clock-sub', (s) => s.textContent));
  // Phone width: no horizontal scroll.
  await page.setViewport({ width: 390, height: 844 }); await sleep(300);
  check('phone width: no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(out, 'present-phone.png') });
  // Without a token: a clear message, no errors.
  const p2 = await browser.newPage(); const e2 = []; p2.on('pageerror', (e) => e2.push(e.message));
  await p2.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch {} });
  await p2.goto(`${board.base}/present-classic.html`); await sleep(400);
  check('no token: explains how to open it', /Presenter view/.test(await p2.evaluate(() => document.body.innerText)) && !e2.length, e2.join('; '));
  // The main board's "Presenter view" link uses the viewer token.
  const mp = await browser.newPage();
  await mp.goto(`${board.base}/?token=${TOKEN}&name=dana`);
  await mp.waitForSelector('#app:not([hidden])', { timeout: 8000 });
  await mp.waitForFunction(() => !document.getElementById('present-link').hidden, { timeout: 8000 }).catch(() => {});
  const href = await mp.$eval('#present-link', (a) => a.getAttribute('href'));
  check('the board Presenter view link carries the viewer token, not the board token', href.includes(encodeURIComponent(VIEW)) && !href.includes(TOKEN), href);
  await mp.close();
  // A rejected token: the page says the link expired.
  const p3 = await browser.newPage(); const e3 = []; p3.on('pageerror', (e) => e3.push(e.message));
  await p3.goto(`${board.base}/present-classic.html?token=nope`);
  const exp = await p3.waitForFunction(() => /presenter link has expired/.test(document.body.innerText), { timeout: 8000 }).then(() => true).catch(() => false);
  check('a rejected token: "This presenter link has expired"', exp && !e3.length, e3.join('; '));
  // Theme: the board's choice (localStorage board-theme: one of its fifteen themes, or auto; the old 'light' and 'dark'
  // are the Light and Dark themes) wins over the OS. Auto = no data-theme and follows the OS: Dark or Light.
  const BG = { dark: 'rgb(6, 6, 7)', light: 'rgb(241, 242, 244)', dusk: 'rgb(27, 21, 48)', day: 'rgb(239, 228, 207)', night: 'rgb(8, 12, 26)', terminal: 'rgb(2, 10, 4)', contrast: 'rgb(0, 0, 0)', synthwave: 'rgb(19, 8, 36)', sticky: 'rgb(255, 224, 102)', coral: 'rgb(255, 211, 194)' };
  const LT = new Set(['light', 'day', 'sticky', 'coral']); // light themes: light colour scheme
  const BAR = { dark: '#060607', light: '#f1f2f4', dusk: '#1b1530', day: '#efe4cf', night: '#080c1a', terminal: '#020a04', contrast: '#000000', synthwave: '#130824', sticky: '#ffe066', coral: '#ffd3c2' };
  const themed = async (stored, os) => {
    const tp = await browser.newPage(); tp.on('pageerror', (e) => errors.push(e.message));
    await tp.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: os }]);
    await tp.evaluateOnNewDocument((v) => { try { if (v === null) localStorage.removeItem('board-theme'); else localStorage.setItem('board-theme', v); } catch {} }, stored);
    await tp.goto(`${board.base}/present-classic.html`);
    const r = await tp.evaluate(() => ({ theme: document.documentElement.dataset.theme ?? null, bg: getComputedStyle(document.body).backgroundColor, scheme: getComputedStyle(document.documentElement).colorScheme, meta: document.getElementById('m-scheme').content, bar: [...document.querySelectorAll('meta[name=theme-color]')].filter((m) => m.media === 'all').map((m) => m.content) }));
    return { tp, ...r };
  };
  for (const [stored, pal] of [['dark', 'dark'], ['light', 'light'], ['dusk', 'dusk'], ['day', 'day'], ['night', 'night'], ['terminal', 'terminal'], ['contrast', 'contrast'], ['synthwave', 'synthwave'], ['sticky', 'sticky'], ['coral', 'coral']]) {
    const r = await themed(stored, LT.has(pal) ? 'dark' : 'light'); // the OS says the opposite: the choice wins
    check(`board-theme ${stored}: data-theme ${pal}, ${pal} background, ${LT.has(pal) ? 'light' : 'dark'} colour scheme and browser bar`, r.theme === pal && r.bg === BG[pal] && r.scheme === (LT.has(pal) ? 'light' : 'dark') && r.meta === (LT.has(pal) ? 'light' : 'dark') && r.bar.length === 1 && r.bar[0].toLowerCase() === BAR[pal], JSON.stringify([r.theme, r.bg, r.scheme, r.meta, r.bar]));
    if (stored === 'night' || stored === 'terminal') await r.tp.screenshot({ path: path.join(out, `present-${stored}.png`) });
    await r.tp.close();
  }
  for (const [stored, os, pal] of [[null, 'dark', 'dark'], [null, 'light', 'light'], ['auto', 'dark', 'dark'], ['auto', 'light', 'light'], ['purple', 'dark', 'dark']]) {
    const r = await themed(stored, os);
    check(`board-theme ${stored ?? '(none)'} over a ${os} OS: no data-theme, ${pal} (Auto follows the OS)`, r.theme === null && r.bg === BG[pal] && r.meta === 'light dark', JSON.stringify([r.theme, r.bg, r.meta]));
    await r.tp.close();
  }
  {
    // The board changes the theme in another tab of the same browser: this page follows without a reload.
    const a = await themed('day', 'dark');
    const b = await browser.newPage(); await b.goto(`${board.base}/health`);
    for (const [v, pal] of [['terminal', 'terminal'], ['dark', 'dark'], ['sticky', 'sticky'], ['night', 'night']]) {
      await b.evaluate((x) => localStorage.setItem('board-theme', x), v);
      const ok = await a.tp.waitForFunction((t) => document.documentElement.dataset.theme === t, { timeout: 5000, polling: 100 }, pal).then(() => true).catch(() => false);
      check(`another tab sets board-theme ${v}: this page switches to ${pal} live`, ok && await a.tp.evaluate((bg) => getComputedStyle(document.body).backgroundColor === bg, BG[pal]));
    }
    await b.evaluate(() => localStorage.removeItem('board-theme'));
    check('another tab clears board-theme: back to Auto (no data-theme)', await a.tp.waitForFunction(() => !document.documentElement.hasAttribute('data-theme'), { timeout: 5000, polling: 100 }).then(() => true).catch(() => false));
    await b.close(); await a.tp.close();
  }
  check('no page errors', !errors.length, errors.join('; '));
} catch (e) {
  R.push(`CRASH ${e.message}`);
}
await finish(R, { browser, board });
