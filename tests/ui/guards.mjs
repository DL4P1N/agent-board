// Small guards on the board page (review of 2026-11-21): a hostile name in the integrator setting stays text in the
// Merges chip's tooltip; a double-clicked Approve doesn't approve the next proposal saved; a double-clicked Rotate now
// sends one rotation; signing in at the gate while the board is unavailable starts the page's timers once it is back.
// The page's fetch is wrapped (no server change needed): it can add a setting to /api/state, answer it with a 503,
// and stand in for the token rotation (the test board's token comes from BOARD_TOKEN, so it can't rotate).
// Starts its own throwaway board. Run all suites with: npm test
import { startBoard, launchBrowser, finish, agent, rest } from '../helpers.mjs';

const board = await startBoard();
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);

const alice = await agent(board, 'alice');
await alice('board_status');
await alice('set_goal', { goal: 'A voting app for hackathon projects.' });
await alice('claim_role', { role: 'planner' });
const bob = await agent(board, 'bob-codex', 'codex-mcp-client');
await bob('board_status');
const p1 = await bob('create_task', { title: 'Idea: emoji reactions' });
const p2 = await bob('create_task', { title: 'Idea: dark mode' });

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 900 } });
const until = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, { timeout, polling: 100 }, arg).then(() => true).catch(() => false);
// What the page's fetch does differently: window.__integrator is added to /api/state's settings, window.__down makes
// /api/state answer 503, and /api/token/rotate is answered here (counted in window.__rot). setInterval is recorded.
const wrap = () => {
  window.__hits = []; window.__xss = (n) => window.__hits.push(n);
  window.__rot = 0; window.__iv = [];
  const si = window.setInterval; window.setInterval = (fn, ms, ...a) => { window.__iv.push(ms); return si(fn, ms, ...a); };
  const f = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (u, o) => {
    const url = String(u); const isState = /\/api\/state(\?|$)/.test(url);
    if (isState && window.__down) return json({ error: 'test: the board is down' }, 503);
    if (/\/api\/token\/rotate$/.test(url)) { window.__rot++; await new Promise((r) => setTimeout(r, 400)); return json({ token: 'testtok' }); }
    const r = await f(u, o);
    if (isState && r.ok && window.__integrator) { const s = await r.json(); s.settings = { ...s.settings, integrator: window.__integrator }; return json(s); }
    return r;
  };
};
async function open({ signedIn = true, path = '/' } = {}) {
  const page = await (await browser.createBrowserContext()).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', (d) => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  await page.evaluateOnNewDocument(wrap);
  if (signedIn) await page.evaluateOnNewDocument(() => { try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); } catch {} });
  await page.goto(board.base + path);
  return { page, errs };
}

try {
  // ---- the integrator's name in the Merges chip's tooltip (an unknown name is "away") ----
  {
    const { page, errs } = await open();
    await until(page, () => document.getElementById('conn')?.classList.contains('live'));
    const evil = 'x"><img src=x onerror=__xss(1)> x-pwn="1';
    await page.evaluate((v) => { window.__integrator = v; return load(); }, evil);
    await until(page, () => /is away/.test(document.getElementById('merge-btn')?.title || ''));
    const r = await page.evaluate(() => {
      const b = document.getElementById('merge-btn');
      return { title: b?.title || '', img: !!document.querySelector('#tb-b img'), pwn: !!document.querySelector('[x-pwn]'), ran: window.__hits.length };
    });
    check('a hostile integrator name shows as text in the Merges tooltip', r.title.includes(`(${evil} is away`), r.title);
    check('and nothing of it became HTML or ran', !r.img && !r.pwn && !r.ran, JSON.stringify(r));
    check('integrator page: no page errors', !errs.length, errs.join(' | '));
    await page.close();
  }

  // ---- Approve clicked twice, then Save changes on another proposal ----
  {
    const { page, errs } = await open();
    await until(page, (id) => !!document.querySelector(`.card[data-id="${id}"]`), p1.id);
    await page.evaluate((id) => openTask(id), p1.id);
    await page.waitForSelector('#task-dlg[open]');
    await page.evaluate(() => { const b = document.getElementById('td-approve'); b.click(); b.click(); });
    await until(page, () => !document.querySelector('#task-dlg[open]'));
    await sleep(300);
    await page.evaluate((id) => openTask(id), p2.id);
    await page.waitForSelector('#task-dlg[open]');
    await page.type('#td-name', ' (later)');
    await page.click('#td-save');
    await until(page, () => !document.querySelector('#task-dlg[open]'));
    await sleep(400);
    const T = (await human('/state')).tasks;
    const a = T.find((t) => t.id === p1.id); const b = T.find((t) => t.id === p2.id);
    check('Approve clicked twice approves that proposal', a?.status === 'open', a?.status);
    check('Save changes on the next proposal saves it and leaves it a proposal', b?.status === 'proposed' && b.title === 'Idea: dark mode (later)', JSON.stringify(b && [b.status, b.title]));
    check('approve page: no page errors', !errs.length, errs.join(' | '));
    await page.close();
  }

  // ---- Rotate now clicked twice ----
  {
    const { page, errs } = await open();
    await until(page, () => document.getElementById('conn')?.classList.contains('live'));
    // Board security is in Setup: open it, then arm the rotation.
    await page.evaluate(() => document.querySelector('[data-act="setup-open"]')?.click());
    await page.evaluate(() => { ui.rotateArm = true; render(); });
    await page.waitForSelector('[data-fk="rot-yes"]');
    await page.evaluate(() => { const b = document.querySelector('[data-fk="rot-yes"]'); b.click(); b.click(); });
    await sleep(1200);
    const r = await page.evaluate(() => ({ n: window.__rot, gate: !document.getElementById('gate').hidden }));
    check('Rotate now clicked twice sends one rotation, and the page stays signed in', r.n === 1 && !r.gate, JSON.stringify(r));
    check('rotate page: no page errors', !errs.length, errs.join(' | '));
    await page.close();
  }

  // ---- signing in at the gate while the board is unavailable ----
  {
    const { page, errs } = await open({ signedIn: false });
    await page.waitForSelector('#gate:not([hidden])');
    await page.evaluate(() => { window.__down = true; });
    await page.$eval('#g-token', (e) => { e.value = 'testtok'; });
    await page.$eval('#g-name', (e) => { e.value = 'dana'; });
    await page.click('#g-go');
    check('signing in while the board is unavailable shows that', await until(page, () => !document.getElementById('failed').hidden && document.getElementById('app').hidden));
    await page.evaluate(() => { window.__down = false; });
    check('the page comes back by itself once the board is', await until(page, () => document.getElementById('failed').hidden && !document.getElementById('app').hidden && document.getElementById('conn').classList.contains('live'), null, 12000));
    const r = await page.evaluate(() => ({ iv: window.__iv, tok: localStorage.getItem('board-token') === 'testtok' }));
    check('and its timers run (the 20 s refresh and the 30 s clock), the sign-in kept', r.iv.includes(20000) && r.iv.includes(30000) && r.tok, JSON.stringify(r));
    check('gate page: no page errors', !errs.length, errs.join(' | '));
    await page.close();
  }

  // ---- a link's ?token= and ?name= (review round 4, M6): held until the board accepts them ----
  {
    const viewer = (await human('/state')).setup.viewer_token;
    const saved = (page) => page.evaluate(() => ({ tok: localStorage.getItem('board-token'), name: localStorage.getItem('board-name'), pend: sessionStorage.getItem('board-pending-token'), gate: !document.getElementById('gate').hidden, app: !document.getElementById('app').hidden }));
    for (const [what, t] of [['a wrong token', 'not-the-token'], ["the presenter's (viewer) token", viewer]]) {
      const { page, errs } = await open({ path: '/?token=' + encodeURIComponent(t) });
      const ok = await until(page, () => document.getElementById('conn')?.classList.contains('live') && /kept your saved one/.test(document.getElementById('toasts')?.textContent || ''));
      const r = await saved(page);
      check(`M6 a link with ${what} doesn't replace the saved token: the board goes on with it, and says so`, ok && r.tok === 'testtok' && !r.pend && r.app, JSON.stringify(r));
      check(`M6 ${what}: no page errors`, !errs.length, errs.join(' | '));
      await page.close();
    }
    {
      const { page, errs } = await open({ signedIn: false, path: '/?token=' + encodeURIComponent(viewer) + '&name=vic' });
      await page.waitForSelector('#gate:not([hidden])');
      await page.click('#g-go');
      const err = await until(page, () => /presenter's or the agents' token/.test(document.getElementById('g-err').textContent));
      const r = await saved(page);
      check('M6 signing in with the viewer token is refused at the form, nothing saved', err && r.gate && !r.tok && !r.name, JSON.stringify(r));
      check('M6 viewer at the form: no page errors', !errs.length, errs.join(' | '));
      await page.close();
    }
    {
      const { page, errs } = await open({ path: '/?name=eve' });
      await page.waitForSelector('#gate:not([hidden])');
      const r = { ...(await saved(page)), field: await page.$eval('#g-name', (e) => e.value) };
      const note = await page.$eval('#g-err', (e) => e.textContent);
      // M9 (round 5b): a forwarded link carries someone else's name: the saved one is offered first, the link's named.
      check("M9 a link's ?name= for someone else shows the sign-in form with the saved name first, the link's name in the note", r.gate && r.field === 'dana' && r.name === 'dana' && /made for "eve"/.test(note) && !/name=/.test(page.url()), JSON.stringify({ ...r, note }));
      await page.$eval('#g-name', (e) => { e.value = 'eve'; });
      await page.click('#g-go');
      await until(page, () => document.getElementById('conn')?.classList.contains('live'));
      const r2 = await saved(page);
      check('M6 and entering the link name there signs in as that name', r2.app && r2.name === 'eve', JSON.stringify(r2));
      check('M6 name link: no page errors', !errs.length, errs.join(' | '));
      await page.close();
    }
    {
      const { page, errs } = await open({ path: '/?token=testtok&name=dana' });
      const ok = await until(page, () => document.getElementById('conn')?.classList.contains('live'));
      check('M6 a link with your own token and name opens the board as before', ok && (await saved(page)).app);
      check('M6 own link: no page errors', !errs.length, errs.join(' | '));
      await page.close();
    }
    // A first-time link (nothing saved): one step, as before; saved once the board accepts the token.
    {
      const { page, errs } = await open({ signedIn: false, path: '/?token=testtok&name=newbie' });
      const ok = await until(page, () => document.getElementById('conn')?.classList.contains('live'));
      const r = await saved(page);
      check('M6 a first-time link (nothing saved) signs straight in, and keeps the token and name once accepted', ok && r.app && !r.gate && r.tok === 'testtok' && r.name === 'newbie' && !r.pend, JSON.stringify(r));
      // M9 (round 5b): it may be a forwarded link: a toast says whose name is in use, with a way to change it.
      const nt = await until(page, () => [...document.querySelectorAll('#toasts .toast')].some((t) => /You're on the board as newbie \(from the link\)\. Not you\?/.test(t.textContent) && t.querySelector('button')?.textContent === 'Change name'));
      await page.evaluate(() => [...document.querySelectorAll('#toasts .toast button')].find((b) => b.textContent === 'Change name')?.click());
      const cg = await until(page, () => !document.getElementById('gate').hidden && !document.getElementById('g-back').hidden && document.getElementById('g-name').value === 'newbie');
      check('M9 a first-time named link says "You are on the board as newbie (from the link). Not you?", and Change name opens the sign-in form (with a way back)', nt && cg);
      check('M6 first-time link: no page errors', !errs.length, errs.join(' | '));
      await page.close();
    }
    {
      const { page, errs } = await open({ signedIn: false, path: '/?token=not-the-token&name=newbie' });
      await page.waitForSelector('#gate:not([hidden])');
      await sleep(300);
      const r = await saved(page);
      check('M6 a first-time link with a wrong token shows the form, nothing saved', r.gate && !r.tok && !r.name && /rejected/.test(await page.$eval('#g-err', (e) => e.textContent)), JSON.stringify(r));
      check('M6 first-time wrong token: no page errors', !errs.length, errs.join(' | '));
      await page.close();
    }
    {
      const { page, errs } = await open({ signedIn: false, path: '/?token=testtok&name=' + encodeURIComponent('Renée') });
      await page.waitForSelector('#gate:not([hidden])');
      const r = { ...(await saved(page)), field: await page.$eval('#g-name', (e) => e.value), err: await page.$eval('#g-err', (e) => e.textContent) };
      check('UM12 a first-time link whose name the rule changes shows the form with the result ("rene") first', r.gate && r.field === 'rene' && /"rene"/.test(r.err) && !r.name, JSON.stringify(r));
      await page.click('#g-go');
      const ok = await until(page, () => document.getElementById('conn')?.classList.contains('live'));
      check('UM12 and one Enter signs in as it', ok && (await saved(page)).name === 'rene');
      check('UM12 link: no page errors', !errs.length, errs.join(' | '));
      await page.close();
    }
    // UM12: a name the server would strip is shown as it becomes before it is used; 70 characters are too long.
    {
      const { page, errs } = await open({ signedIn: false, path: '/?token=testtok' });
      await page.waitForSelector('#gate:not([hidden])');
      await page.type('#g-name', 'Renée');
      await page.click('#g-go'); await sleep(300);
      const r = { ...(await saved(page)), field: await page.$eval('#g-name', (e) => e.value), err: await page.$eval('#g-err', (e) => e.textContent) };
      check("UM12 a name with letters the server drops shows what it becomes first, and doesn't sign in yet", r.gate && r.field === 'rene' && /would be "rene"/.test(r.err) && !r.name, JSON.stringify(r));
      await page.$eval('#g-name', (e) => { e.value = 'x'.repeat(70); });
      await page.click('#g-go'); await sleep(300);
      const r2 = { ...(await saved(page)), err: await page.$eval('#g-err', (e) => e.textContent), max: await page.$eval('#g-name', (e) => e.maxLength) };
      check('a 70-character name is refused (32 at most), and the field stops at 32', r2.gate && /32 characters/.test(r2.err) && r2.max === 32 && !r2.name, JSON.stringify(r2));
      await page.$eval('#g-name', (e) => { e.value = 'rene'; });
      await page.click('#g-go');
      const ok = await until(page, () => document.getElementById('conn')?.classList.contains('live'));
      check('UM12 entering again signs in as the name shown', ok && (await saved(page)).name === 'rene');
      check('UM12 page: no page errors', !errs.length, errs.join(' | '));
      await page.close();
    }
  }
} catch (e) { R.push('CRASH ' + (e.stack || e)); }
await finish(R, { browser, board });
