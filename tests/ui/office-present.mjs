// Presenter view (public/present.html): the 3D office driven by the live board, with a read-only overlay.
// Built from office/ by `npm run build:present`. Without WebGL it opens the classic page (tests/ui/present.mjs).
// Chrome runs with SwiftShader (software WebGL) so this works on CI runners without a GPU; if WebGL is still
// missing there, the fallback is what gets tested. Run all suites with: npm test
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
const t3 = await ana('create_task', { title: 'Submit form' });
await ana('claim_task', { id: t1.id }); await ana('update_task', { id: t1.id, status: 'review', note: 'done' });
await human(`/tasks/${t1.id}`, 'PATCH', { status: 'done' });
await ana('claim_task', { id: t2.id }); await ana('update_task', { id: t2.id, status: 'in_progress' });
const VIEW = (await human('/state')).setup?.viewer_token;

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1600, height: 900 }, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = shotsDir('office-present');
const errors = [];
const watch = (p, list = errors) => { p.on('pageerror', (e) => list.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') list.push(m.text()); }); return p; };
const S = (page) => page.evaluate(() => window.__officeState);
const until = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, { timeout, polling: 100 }, arg).then(() => true).catch(() => false);
const text = (page) => page.evaluate(() => document.body.innerText);

try {
  const page = watch(await browser.newPage());
  await page.goto(`${board.base}/present.html?token=${encodeURIComponent(VIEW)}`);
  await until(page, () => document.documentElement.dataset.scene || /present-classic/.test(location.pathname), null, 15000);
  const webgl = await page.evaluate(() => document.documentElement.dataset.scene === 'ready' && !/present-classic/.test(location.pathname));
  if (!webgl) {
    // A runner with no WebGL at all: the page must have handed over to the classic presenter, token and all.
    check('no WebGL in this browser: opened the classic presenter instead (office checks skipped)', /present-classic\.html/.test(page.url()) && await until(page, () => /voting app/.test(document.body.innerText)), page.url());
  } else {
    check('the 3D office starts (WebGL canvas in the scene)', await page.$('#scene canvas') !== null);
    await until(page, () => /1 of 3 done/.test(document.body.innerText));
    const txt = await text(page);
    check('token removed from the address bar, kept under the viewer key only', !/token=/.test(page.url()) && await page.evaluate(() => !!localStorage.getItem('board-view-token') && !localStorage.getItem('board-token')), page.url());
    check('goal shown large, as text (no HTML injected)', await page.$eval('#goal', (h) => h.textContent.includes('<b>live</b>') && !h.querySelector('b') && parseFloat(getComputedStyle(h).fontSize) >= 22));
    check('done count: 1 of 3 done, with a progress bar', /1 of 3 done/.test(txt) && await page.$eval('[role=progressbar]', (b) => b.getAttribute('aria-valuenow') === '1' && b.getAttribute('aria-valuemax') === '3'), txt.replace(/\s+/g, ' ').slice(0, 160));
    check('countdown to the demo with the freeze time', /^2h 0\dm$/.test(await page.$eval('#clock', (c) => c.textContent)) && /freeze at/.test(await page.$eval('#clock-sub', (c) => c.textContent)), await page.$eval('#clock', (c) => c.textContent));
    check('nothing waiting on a human yet', /Nothing needs you/.test(txt));
    check('body text is at least 14px', await page.evaluate(() => [...document.querySelectorAll('#top, #bottom')].flatMap((r) => [...r.querySelectorAll('*')]).filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).every((e) => parseFloat(getComputedStyle(e).fontSize) >= 14)));
    const s0 = await S(page);
    const a0 = s0.agents.find((a) => a.id === 'ana-claude');
    check('adapter: one character per online agent, tool from its client', s0.agents.length === 1 && a0?.provider === 'claude' && a0.owner === 'ana', JSON.stringify(s0.agents.map((a) => [a.id, a.provider, a.owner])));
    check('adapter: in_progress task -> working at a desk', a0?.phase === 'working' && a0.ticketId === `#${t2.id}` && a0.role === 'worker', `${a0?.phase} ${a0?.ticketId}`);
    check('adapter: tickets from tasks (done -> merged, in_progress, open -> backlog)', JSON.stringify(s0.tickets.map((t) => [t.id, t.status])) === JSON.stringify([[`#${t1.id}`, 'merged'], [`#${t2.id}`, 'in_progress'], [`#${t3.id}`, 'backlog']]), JSON.stringify(s0.tickets.map((t) => [t.id, t.status])));
    check('adapter: no invented costs or usage', s0.metrics.totalCostUsd === 0 && s0.agents.every((a) => a.usage.costUsd === 0 && a.burnUsdPerMin === 0) && s0.tickets.every((t) => t.usage.costUsd === 0), JSON.stringify(s0.metrics).slice(0, 120));
    check('adapter: the demo countdown on the office TV', s0.hack.active && s0.hack.stage === 'build' && Math.abs(s0.hack.endsAt - s0.time - (2 * 3600 + 5 * 60)) < 120, `${s0.hack.stage} ${Math.round(s0.hack.endsAt - s0.time)}`);
    await page.evaluate(() => { try { window.__officeState.agents.length = 0; window.__officeState = null; } catch {} });
    check('the debug hook is read-only', (await S(page))?.agents?.length === 1);

    // Live: a new task, a blocked agent with another tool, a question, a review and a merge, all without reloading.
    await ana('create_task', { title: 'Share link' });
    check('creating a task updates the overlay (1 of 4 done)', await until(page, () => /1 of 4 done/.test(document.body.innerText)));
    const bob = await agent(board, 'bob-codex', 'codex-mcp-client'); await bob('board_status');
    await bob('claim_task', { id: t3.id }); await bob('update_task', { id: t3.id, status: 'blocked', note: 'needs the API key' });
    const stuck = await until(page, (id) => new RegExp(`Blocked[\\s\\S]*bob[\\s\\S]*#${id} Submit form`, 'i').test(document.getElementById('needs')?.innerText || ''), t3.id);
    check('a blocked task shows under "Needs you" with its person (the board\'s word: Blocked)', stuck, (await page.$eval('#needs', (n) => n.innerText).catch(() => '')).replace(/\s+/g, ' '));
    const s1 = await S(page);
    const b1 = s1.agents.find((a) => a.id === 'bob-codex');
    check('adapter: blocked -> "Blocked on #id" (the board\'s word), Codex agent at its own desk', b1?.provider === 'codex' && b1.phase === 'blocked' && b1.pose === 'blocked' && b1.bubble === `Blocked on #${t3.id}` && b1.deskIndex !== s1.agents.find((a) => a.id === 'ana-claude').deskIndex, JSON.stringify(b1 && [b1.provider, b1.phase, b1.bubble, b1.deskIndex]));
    await ana('ask_human', { question: 'Which login provider?' });
    check('a question shows as waiting for a human', await until(page, () => /1 question waiting[\s\S]*ana/i.test(document.getElementById('needs')?.innerText || '')));
    check('adapter: an agent with an open question raises its hand', (await S(page)).agents.find((a) => a.id === 'ana-claude')?.pose === 'raise_hand');
    // The board's counting rule: a blocked task that waits on an open question is counted once, as the question.
    await bob('ask_human', { question: 'Where is the API key?', task_id: t3.id });
    check('a blocked task with an open question is counted once, as the question (not also as Blocked)', await until(page, () => { const t = document.getElementById('needs')?.innerText || ''; return /2 questions waiting/i.test(t) && !/Blocked/i.test(t); }), (await page.$eval('#needs', (n) => n.innerText).catch(() => '')).replace(/\s+/g, ' '));
    await ana('update_task', { id: t2.id, status: 'review', note: 'pr' });
    check('adapter: a task sent to review flies a paper plane to the inbox', await until(page, () => window.__officeState.flights.some((f) => f.kind === 'pr' && f.to.station === 'inbox')));
    await human(`/tasks/${t2.id}`, 'PATCH', { status: 'done' });
    check('moving a task to done updates the overlay (2 of 4 done)', await until(page, () => /2 of 4 done/.test(document.body.innerText)));
    const s2 = await S(page);
    check('adapter: the done task is merged on the office board', s2.tickets.find((t) => t.id === `#${t2.id}`)?.status === 'merged' && s2.metrics.merged === 2 && s2.mainCommits === 2);
    check('page title carries the count', /^2\/4 done · Board presenter$/.test(await page.title()), await page.title());
    const simple = await page.$eval('a.simple', (a) => a.getAttribute('href'));
    check('"Simple view" link opens the classic page with the viewer token', simple === `present-classic.html?token=${encodeURIComponent(VIEW)}`, simple);

    // Projector sizes: header, office and side column never overlap, nothing scrolls.
    for (const [w, h] of [[1366, 768], [1920, 1080]]) {
      await page.setViewport({ width: w, height: h }); await sleep(500);
      const lay = await page.evaluate(() => {
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const [t, s, b] = [r('top'), r('scene'), r('bottom')];
        return { scroll: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth, overlap: hit(t, s) || hit(t, b) || hit(s, b), sceneShare: (s.width * s.height) / (innerWidth * innerHeight) };
      });
      check(`${w}×${h}: no overlap, no scrolling, the office gets most of the screen`, !lay.scroll && !lay.overlap && lay.sceneShare > 0.45, JSON.stringify(lay));
      await page.screenshot({ path: path.join(out, `office-${w}.png`) });
    }

    // Theme: the board's choice (localStorage board-theme: one of its fifteen themes, or auto; the old 'light' and 'dark'
    // are the Light and Dark themes) wins over the OS. Auto = no data-theme and follows the OS: Dark or Light. The scene palette follows.
    const BG = { dark: 'rgb(6, 6, 7)', light: 'rgb(241, 242, 244)', dusk: 'rgb(27, 21, 48)', day: 'rgb(239, 228, 207)', night: 'rgb(8, 12, 26)', terminal: 'rgb(2, 10, 4)', contrast: 'rgb(0, 0, 0)', synthwave: 'rgb(19, 8, 36)', sticky: 'rgb(255, 224, 102)', coral: 'rgb(255, 211, 194)' };
    const LT = new Set(['light', 'day', 'sticky', 'coral']); // light themes: light colour scheme
    const themed = async (stored, os) => {
      const tp = watch(await browser.newPage());
      await tp.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: os }]);
      await tp.evaluateOnNewDocument((v) => { try { if (v === null) localStorage.removeItem('board-theme'); else localStorage.setItem('board-theme', v); } catch {} }, stored);
      await tp.goto(`${board.base}/present.html`);
      await until(tp, () => document.documentElement.dataset.scene === 'ready');
      const r = await tp.evaluate(() => ({ theme: document.documentElement.dataset.theme ?? null, bg: getComputedStyle(document.body).backgroundColor, palette: window.__officePalette, scheme: getComputedStyle(document.documentElement).colorScheme, meta: document.getElementById('m-scheme').content }));
      return { tp, ...r };
    };
    const cases = ['dark', 'light', 'dusk', 'day', 'night', 'terminal', 'contrast', 'synthwave', 'sticky', 'coral'].map((t) => [t, t, t]);
    for (const [stored, theme, pal] of cases) {
      const r = await themed(stored, LT.has(stored) ? 'dark' : 'light'); // the OS says the opposite: the choice wins
      check(`board-theme ${stored}: data-theme ${theme}, ${pal} background, ${pal} scene palette, ${LT.has(pal) ? 'light' : 'dark'} colour scheme`, r.theme === theme && r.bg === BG[pal] && r.palette === pal && r.scheme === (LT.has(pal) ? 'light' : 'dark') && r.meta === (LT.has(pal) ? 'light' : 'dark'), JSON.stringify(r.theme) + ' ' + r.bg + ' ' + r.palette + ' ' + r.scheme);
      if (stored === 'night' || stored === 'terminal') await r.tp.screenshot({ path: path.join(out, `office-${stored}.png`) });
      if (stored === 'light' || stored === 'sticky') await r.tp.screenshot({ path: path.join(out, `office-${stored}.png`) });
      await r.tp.close();
    }
    for (const [stored, os, pal] of [[null, 'dark', 'dark'], [null, 'light', 'light'], ['auto', 'dark', 'dark'], ['auto', 'light', 'light'], ['purple', 'light', 'light']]) {
      const r = await themed(stored, os);
      check(`board-theme ${stored ?? '(none)'} over a ${os} OS: no data-theme, ${pal} (Auto follows the OS)`, r.theme === null && r.bg === BG[pal] && r.palette === pal && r.meta === 'light dark', JSON.stringify(r.theme) + ' ' + r.bg + ' ' + r.palette);
      await r.tp.close();
    }
    check('the palette hook is read-only', await page.evaluate(() => { try { window.__officePalette = 'night'; } catch {} return typeof window.__officePalette === 'string' && window.__officePalette !== 'night'; }));
    {
      // The board changes the theme in another tab of the same browser: this one follows, without a reload.
      const a = await themed('day', 'dark');
      const b = await browser.newPage(); await b.goto(`${board.base}/health`);
      for (const [v, theme, pal] of [['terminal', 'terminal', 'terminal'], ['dark', 'dark', 'dark'], ['coral', 'coral', 'coral'], ['night', 'night', 'night']]) {
        await b.evaluate((x) => localStorage.setItem('board-theme', x), v);
        const ok = await until(a.tp, ([t, p]) => document.documentElement.dataset.theme === t && window.__officePalette === p, [theme, pal]);
        check(`another tab sets board-theme ${v}: this presenter switches to ${pal} live`, ok);
      }
      await b.evaluate(() => localStorage.removeItem('board-theme'));
      check('another tab clears board-theme: back to Auto (no data-theme)', await until(a.tp, () => !document.documentElement.hasAttribute('data-theme')));
      await b.close(); await a.tp.close();
    }

    // Reduced motion: no paper planes or celebrations.
    const rp = watch(await browser.newPage());
    await rp.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await rp.goto(`${board.base}/present.html`);
    await until(rp, () => /2 of 4 done/.test(document.body.innerText));
    const t5 = await ana('create_task', { title: 'Dark mode' });
    await ana('claim_task', { id: t5.id }); await ana('update_task', { id: t5.id, status: 'review', note: 'pr' });
    await until(rp, (id) => window.__officeState.tickets.some((t) => t.id === `#${id}` && t.status === 'in_review'), t5.id);
    await sleep(300);
    check('reduced motion: tasks move without paper planes', (await S(rp)).flights.length === 0);
    await rp.close();

    // The scene can't start even though the early probe passed (three.js asks for a context with attributes): fall back.
    const fp = watch(await browser.newPage(), []); // three.js logs its failed context as an error: expected here
    await fp.evaluateOnNewDocument(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, o) { return /webgl/.test(k) && o ? null : g.call(this, k, o); }; });
    await fp.goto(`${board.base}/present.html`);
    check('scene fails to start: falls back to the classic page', await until(fp, () => /present-classic/.test(location.pathname) && /2 of 5 done|of 5 done/.test(document.body.innerText), null, 10000), fp.url());
    await fp.close();
  }

  // No WebGL at all: straight to the classic page, carrying the token from the link.
  const np = watch(await browser.newPage());
  await np.evaluateOnNewDocument(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, o) { return /webgl/.test(k) ? null : g.call(this, k, o); }; try { localStorage.clear(); } catch {} });
  await np.goto(`${board.base}/present.html?token=${encodeURIComponent(VIEW)}`);
  check('WebGL unavailable: opens the classic presenter with the same token', await until(np, () => /present-classic/.test(location.pathname) && /voting app/.test(document.body.innerText), null, 10000) && await np.evaluate(() => !!localStorage.getItem('board-view-token')), np.url());
  check('the classic page has no token in its address either', !/token=/.test(np.url()), np.url());
  await np.close();

  // No token, a rejected token: the same messages as the classic page.
  const p2 = watch(await browser.newPage());
  await p2.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch {} });
  await p2.goto(`${board.base}/present.html`);
  check('no token: explains how to open it', await until(p2, () => /Presenter view/.test(document.body.innerText)));
  await p2.close();
  const p3 = watch(await browser.newPage(), []); // the refused token logs its 401: expected here
  await p3.goto(`${board.base}/present.html?token=nope`);
  check('a rejected token: "This presenter link has expired"', await until(p3, () => /presenter link has expired/.test(document.body.innerText)));
  check('never holds the board token', await p3.evaluate((t) => !Object.keys(localStorage).some((k) => localStorage.getItem(k) === t), TOKEN));
  await p3.close();

  // The board's header link still opens this page with the viewer token.
  const mp = await browser.newPage();
  await mp.goto(`${board.base}/?token=${TOKEN}&name=dana`);
  await mp.waitForSelector('#app:not([hidden])', { timeout: 8000 });
  await until(mp, () => !document.getElementById('present-link').hidden);
  const href = await mp.$eval('#present-link', (a) => a.getAttribute('href'));
  check('the board header link opens present.html with the viewer token', /\/present\.html\?token=/.test(href) && href.includes(encodeURIComponent(VIEW)) && !href.includes(TOKEN), href);
  await mp.close();
  check('no console errors', !errors.length, errors.join('; '));
} catch (e) {
  R.push(`CRASH ${e.message}`);
}
await finish(R, { browser, board });
