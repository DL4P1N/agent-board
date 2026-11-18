// Several boards on one server: the host's Boards page (/boards), a board under /b/<slug>/ (state, live
// updates, posting, presenter link), archive (410) / restore / make default / delete, and the root board
// keeping its own saved sign-in. Starts its own server. Run all suites with: npm test
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, launchBrowser, shotsDir, finish, tempDir } from '../helpers.mjs';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Waits poll on a timer, not animation frames: tabs in the background don't paint, so frame-based polling never fires there.
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

const PORT = await freePort();
const BASE = `http://localhost:${PORT}`;
const ADMIN = 'adm';
const dataDir = tempDir('agent-board-boards-');
let child = null;
// Starts the server (again, on the same port and data) and fails loudly if it doesn't come up.
async function startServer() {
  child = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], {
    cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, PORT: String(PORT), BOARD_DATA: dataDir, BOARD_TOKEN: 'testtok', BOARD_ADMIN_TOKEN: ADMIN, BOARD_NO_JOIN: '1', BOARD_BACKUP_MINUTES: '0' },
  });
  let errText = ''; child.stderr.on('data', (d) => { errText = (errText + d).slice(-2000); });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) return; } catch {}
    if (child.exitCode !== null) break;
    await sleep(100);
  }
  throw new Error(`the board server didn't start on port ${PORT} within 10 s${child.exitCode !== null ? ` (it exited with code ${child.exitCode})` : ''}. ${errText.trim().split('\n').slice(-3).join(' | ')}`);
}
const stopServer = async () => { if (child && child.exitCode === null) { const done = new Promise((r) => child.once('exit', r)); child.kill(); await done; } };
const board = { stop: stopServer };
await startServer();

const adminApi = (p, method = 'GET', body) => fetch(`${BASE}/api/admin${p}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN}` }, body: body && JSON.stringify(body) });

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1280, height: 900 } });
const out = shotsDir('boards');
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => { errors.push('browser dialog: ' + d.message()); d.dismiss(); });
const txt = (sel) => page.$eval(sel, (e) => e.innerText).catch(() => '');
const until = (fn, arg, timeout = 5000) => page.waitForFunction(fn, { timeout, polling: 250 }, arg).then(() => true).catch(() => false);

try {
  // ---- server supports several boards? ----
  const list0 = await adminApi('/boards');
  check('admin API lists boards (server supports several boards)', list0.ok, String(list0.status));
  check('admin API rejects a wrong admin token', (await fetch(`${BASE}/api/admin/boards`, { headers: { Authorization: 'Bearer nope' } })).status === 401);

  // ---- Boards page: sign in with ?admin= ----
  await page.goto(`${BASE}/boards?admin=${ADMIN}`);
  await page.waitForSelector('#app:not([hidden])', { timeout: 5000 });
  check('?admin= signs in, is kept in this tab only (sessionStorage), and is removed from the address bar', await page.evaluate(() => sessionStorage.getItem('board-admin-token') === 'adm' && !location.search));
  check('the admin token is not in localStorage; only a non-secret host flag is', await page.evaluate(() => !Object.keys(localStorage).some((k) => localStorage.getItem(k) === 'adm') && localStorage.getItem('board-is-host') === '1'));
  await until(() => document.querySelectorAll('#live .card').length >= 1);
  check('lists the default board as live + default', /default/.test(await txt('#live')) && /live/.test(await txt('#live')), await txt('#live'));
  await page.screenshot({ path: path.join(out, 'boards-list.png'), fullPage: true });

  // ---- validation ----
  await page.click('#nb-go');
  check('empty name is refused inline', /Give the board a name/.test(await txt('#nb-err')) && await page.$eval('#nb-name', (e) => e.getAttribute('aria-invalid') === 'true'));
  await page.type('#nb-name', 'Spring Hackathon');
  check('address preview follows the name', (await txt('#nb-preview')) === '/b/spring-hackathon/', await txt('#nb-preview'));
  await page.type('#nb-slug', 'Bad Slug!');
  await page.click('#nb-go');
  check('invalid address is refused inline', /lowercase letters/.test(await txt('#nb-err')));
  await page.click('#nb-slug', { count: 3 }); await page.keyboard.press('Backspace');

  // ---- create ----
  await page.click('#nb-go');
  const created = await until(() => !document.getElementById('created').hidden);
  const createdText = await txt('#created');
  check('new board created: shows its link and join command', created && /\/b\/spring-hackathon\//.test(createdText) && /npm run join -- --url/.test(createdText), createdText.slice(0, 200));
  await until(() => [...document.querySelectorAll('#live .card')].some((c) => c.dataset.board === 'spring-hackathon'));
  check('new board appears in the live list', await page.$('[data-board="spring-hackathon"]') !== null);
  await page.screenshot({ path: path.join(out, 'boards-created.png'), fullPage: true });

  const open = await (await adminApi('/boards/spring-hackathon/open')).json();
  check('open gives the board URL and token', /\/b\/spring-hackathon\/?$/.test(new URL(open.url, BASE).pathname) && !!open.token, JSON.stringify(open).slice(0, 120));

  // ---- the new board works under its prefix ----
  const bp = await browser.newPage();
  bp.on('pageerror', (e) => errors.push(e.message));
  const btxt = (sel) => bp.$eval(sel, (e) => e.innerText).catch(() => '');
  await bp.goto(`${BASE}/b/spring-hackathon/?token=${encodeURIComponent(open.token)}&name=dana`);
  await bp.waitForSelector('#app:not([hidden])', { timeout: 5000 });
  check('board page under /b/<slug>/ loads its state', await bp.waitForFunction(() => typeof state !== 'undefined' && Array.isArray(state.tasks) && !!state.setup, { timeout: 5000, polling: 250 }).then(() => true).catch(() => false));
  // The header and title use the board's name from /api/state (board.name).
  check('header and title show the board name', await bp.waitForFunction(() => document.getElementById('bname').textContent === 'Spring Hackathon' && /Spring Hackathon/.test(document.title), { timeout: 5000, polling: 250 }).then(() => true).catch(() => false), `${await btxt('#bname')} | ${await bp.title()}`);
  check('live updates connect under the prefix', await bp.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 5000, polling: 250 }).then(() => true).catch(() => false));
  check('token saved per board, not in the root board\'s key', await bp.evaluate((t) => localStorage.getItem('board-token@/b/spring-hackathon') === t && localStorage.getItem('board-token') !== t, open.token));
  await bp.type('#msg', 'hello from the spring board'); await bp.keyboard.press('Enter');
  const posted = await bp.waitForFunction(() => [...document.querySelectorAll('#feed .ev')].some((e) => e.innerText.includes('hello from the spring board')), { timeout: 5000, polling: 250 }).then(() => true).catch(() => false);
  check('posting a message works on the prefixed board', posted);
  const rootState = await (await fetch(`${BASE}/api/state`, { headers: { Authorization: 'Bearer testtok' } })).json();
  check('the message stayed on its own board (not on the root board)', !rootState.events.some((e) => /hello from the spring board/.test(e.text)));
  const plink = await bp.waitForFunction(() => { const a = document.getElementById('present-link'); return a && !a.hidden && a.getAttribute('href'); }, { timeout: 5000, polling: 250 }).then((h) => h.jsonValue()).catch(() => '');
  check('presenter link uses the board prefix', /^\/b\/spring-hackathon\/present\.html\?token=/.test(plink), plink);
  check('Boards link shows for the host (host flag set by the Boards page)', await bp.$eval('#boards-link', (a) => !a.hidden && a.getAttribute('href') === '/boards'));
  await bp.screenshot({ path: path.join(out, 'board-prefixed.png') });

  // ---- presenter under the prefix ----
  const pp = await browser.newPage();
  pp.on('pageerror', (e) => errors.push(e.message));
  await pp.goto(new URL(plink, BASE).href);
  check('presenter view loads under the prefix', await pp.waitForFunction(() => /Board presenter/.test(document.title) && /spring-hackathon/.test(document.title), { timeout: 5000, polling: 250 }).then(() => true).catch(() => false), await pp.title());
  check('presenter keeps its viewer token per board', await pp.evaluate(() => !!localStorage.getItem('board-view-token@/b/spring-hackathon')));
  await pp.close();

  // ---- archive ----
  await page.bringToFront();
  await page.click('[data-board="spring-hackathon"] [data-act="archive"]');
  check('archive asks inline first (focus on keep)', await page.evaluate(() => document.activeElement?.id === 'keep-spring-hackathon'));
  await page.click('[data-board="spring-hackathon"] [data-act="archive-yes"]');
  await until(() => !document.getElementById('arch-wrap').hidden && !!document.querySelector('#arch [data-board="spring-hackathon"]'));
  check('archived board moves to the Archived list', await page.$('#arch [data-board="spring-hackathon"]') !== null);
  check('archived board answers 410', (await fetch(`${BASE}/b/spring-hackathon/api/state`, { headers: { Authorization: `Bearer ${open.token}` } })).status === 410);
  // The board page that was open the whole time (no reload) notices and says so.
  check('an open tab of the archived board shows #archived by itself (no reload)', await bp.waitForFunction(() => !document.getElementById('archived').hidden && document.getElementById('app').hidden, { timeout: 8000, polling: 250 }).then(() => true).catch(() => false), (await btxt('body')).slice(0, 160));

  // ---- default board can't be archived ----
  const defInfo = await page.evaluate(() => { const c = [...document.querySelectorAll('#live .card')].find((x) => x.querySelector('.pill.def')); return c ? { archive: !!c.querySelector('[data-act="archive"]'), why: c.innerText } : null; });
  check('default board offers no Archive and says why', !!defInfo && !defInfo.archive && /make another board the default first/.test(defInfo.why), JSON.stringify(defInfo).slice(0, 160));
  const defSlug = (await (await adminApi('/boards')).json()).find((b) => b.default).slug;
  check('server refuses to archive the default board', (await adminApi(`/boards/${defSlug}/archive`, 'POST')).status === 400);

  // ---- restore, make default ----
  await page.click('#arch [data-board="spring-hackathon"] [data-act="restore"]');
  await until(() => !!document.querySelector('#live [data-board="spring-hackathon"]'));
  check('restore brings it back to live', await page.$('#live [data-board="spring-hackathon"]') !== null);
  check('restored board answers again', (await fetch(`${BASE}/b/spring-hackathon/api/state`, { headers: { Authorization: `Bearer ${open.token}` } })).ok);
  await bp.bringToFront(); // background tabs get their timers throttled; the user would be looking at it
  check('the open tab comes back by itself after the restore (board shown, live again)', await bp.waitForFunction(() => document.getElementById('archived').hidden && !document.getElementById('app').hidden && document.getElementById('conn').classList.contains('live'), { timeout: 12000, polling: 250 }).then(() => true).catch(() => false), (await btxt('body')).slice(0, 160));

  // A tab on the root address, signed in to the current default board (in its own browser profile).
  const rootCtx = await browser.createBrowserContext();
  const mp = await rootCtx.newPage();
  mp.on('pageerror', (e) => errors.push(e.message));
  await mp.goto(`${BASE}/?token=testtok&name=dana`);
  await mp.waitForSelector('#app:not([hidden])', { timeout: 5000 });
  const oldDefault = (await (await adminApi('/boards')).json()).find((b) => b.default)?.slug;
  await page.bringToFront(); // clicks on a background tab can stall in headless Chrome
  await page.click('#live [data-board="spring-hackathon"] [data-act="default"]');
  // The card gets the "default" badge, and the old default gets its Archive button back.
  await until(() => !!document.querySelector('#live [data-board="spring-hackathon"] .pill.def'));
  const list1 = await (await adminApi('/boards')).json();
  check('make default: the new board is the default', list1.find((b) => b.slug === 'spring-hackathon')?.default === true && list1.filter((b) => b.default).length === 1);
  // The open root tab now belongs to a board that moved to its own address: it says so and links there.
  await mp.bringToFront();
  const movedOk = await mp.waitForFunction(() => !document.getElementById('moved').hidden, { timeout: 25000, polling: 250 }).then(() => true).catch(() => false);
  const movedHref = await mp.$eval('#moved-open', (a) => a.getAttribute('href')).catch(() => '');
  check('a root tab whose board stopped being the default shows "This board moved" with its new address', movedOk && new URL(movedHref, BASE).pathname === `/b/${oldDefault}/` && new URL(movedHref, BASE).searchParams.get('token') === 'testtok', `${movedOk} ${movedHref}`);
  await mp.screenshot({ path: path.join(out, 'board-moved.png') });
  await rootCtx.close(); await page.bringToFront();

  // ---- the old default can now be archived ----
  const other = list1.find((b) => b.slug !== 'spring-hackathon');
  if (other) {
    await page.click(`#live [data-board="${other.slug}"] [data-act="archive"]`);
    await page.click(`#live [data-board="${other.slug}"] [data-act="archive-yes"]`);
    check('once it is no longer the default, the old default can be archived', await until((s) => !!document.querySelector(`#arch [data-board="${s}"]`), other.slug));
  }

  // ---- delete: a board made for it (the original board lives in the data folder and stays) ----
  await adminApi('/boards', 'POST', { name: 'Throwaway', slug: 'throwaway' });
  await adminApi('/boards/throwaway/archive', 'POST');
  await page.reload(); await page.waitForSelector('#arch [data-board="throwaway"]', { timeout: 5000 });
  await page.click('#arch [data-board="throwaway"] [data-act="delete"]');
  check('delete asks inline first and says it goes to the trash', /trash/.test(await txt('#arch [data-board="throwaway"]')));
  await page.click('#arch [data-board="throwaway"] [data-act="delete-yes"]');
  check('deleted board is gone from the list', await until(() => !document.querySelector('[data-board="throwaway"]')));
  check('the server moved it to the trash folder', fs.existsSync(path.join(dataDir, 'trash')) && fs.readdirSync(path.join(dataDir, 'trash')).some((d) => d.startsWith('throwaway')));
  if (other) {
    await page.click(`#arch [data-board="${other.slug}"] [data-act="delete"]`);
    await page.click(`#arch [data-board="${other.slug}"] [data-act="delete-yes"]`);
    check('deleting the original board shows the server\'s reason and keeps it', await until(() => [...document.querySelectorAll('.toast.bad')].some((t) => /can't be moved to the trash/.test(t.textContent))) && !!(await page.$(`[data-board="${other.slug}"]`)));
  }

  await page.bringToFront();
  // ---- root board: separate sign-in ----
  const rp = await browser.newPage();
  rp.on('pageerror', (e) => errors.push(e.message));
  await rp.goto(`${BASE}/`);
  await rp.waitForSelector('#gate:not([hidden]), #app:not([hidden])', { timeout: 5000 });
  check('root board doesn\'t reuse the prefixed board\'s saved token', await rp.evaluate(() => localStorage.getItem('board-token') === null));
  await rp.close();

  // ---- wrong admin token ----
  await page.evaluate(() => sessionStorage.setItem('board-admin-token', 'wrong'));
  await page.reload();
  check('a rejected admin token shows the sign-in with a message', await until(() => !document.getElementById('gate').hidden && /rejected/.test(document.getElementById('gate-err').textContent)));

  // ---- phone width ----
  await page.evaluate(() => sessionStorage.setItem('board-admin-token', 'adm'));
  await page.setViewport({ width: 390, height: 800 }); await page.reload();
  await page.waitForSelector('#app:not([hidden])');
  check('phone width: no horizontal scroll', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(out, 'boards-phone.png'), fullPage: true });

  // ---- a board whose data can't be opened ----
  const br = await (await adminApi('/boards', 'POST', { name: 'Broken', slug: 'brokenb' })).json();
  await stopServer();
  const bdir = path.join(dataDir, 'boards', 'brokenb');
  if (fs.existsSync(bdir)) {
    for (const f of ['board.db-wal', 'board.db-shm']) fs.rmSync(path.join(bdir, f), { force: true });
    fs.writeFileSync(path.join(bdir, 'board.db'), 'this is not a sqlite database'.repeat(200));
  }
  await startServer();
  await page.bringToFront(); await page.setViewport({ width: 1280, height: 900 }); await page.reload();
  const failedCard = await page.waitForFunction(() => { const c = document.querySelector('[data-board="brokenb"]'); return c && /failed to open/.test(c.innerText) && /open this board/.test(c.innerText) ? c.innerText : false; }, { timeout: 6000, polling: 250 }).then((h) => h.jsonValue()).catch(() => '');
  check('Boards page shows a board that failed to open, with its error and no Open button', !!failedCard && !(await page.$('[data-board="brokenb"] [data-act="open"]')), String(failedCard).slice(0, 200));
  await page.screenshot({ path: path.join(out, 'boards-failed.png'), fullPage: true });
  const fp = await browser.newPage();
  fp.on('pageerror', (e) => errors.push(e.message));
  const fres = await fp.goto(`${BASE}/b/brokenb/?token=${encodeURIComponent(br.token || 'x')}&name=dana`);
  check('the failed board’s address answers 503 and says it failed to open', fres.status() === 503 && /failed to open/.test(await fp.$eval('body', (e) => e.innerText).catch(() => '')), String(fres.status()));
  // An already-open tab whose API starts answering 503 shows the board page's own "couldn't open" panel.
  await bp.bringToFront();
  await bp.evaluate(() => unavailableStatus(503, { error: 'This board failed to open: file is not a database' }));
  check('the board page shows "This board couldn’t open" with the reason (once, without the prefix twice)', await bp.$eval('#failed', (e) => !e.hidden).catch(() => false) && (await bp.$eval('#failed-msg', (e) => e.textContent).catch(() => '')) === 'file is not a database');
  await fp.close();

  // Theme: the board's choice (localStorage board-theme: one of its fifteen themes, or auto; the old 'light' and 'dark'
  // are the Light and Dark themes) wins over the OS. Auto = no data-theme and follows the OS: Dark or Light.
  const BG = { dark: 'rgb(6, 6, 7)', light: 'rgb(241, 242, 244)', dusk: 'rgb(27, 21, 48)', day: 'rgb(239, 228, 207)', night: 'rgb(8, 12, 26)', terminal: 'rgb(2, 10, 4)', contrast: 'rgb(0, 0, 0)', synthwave: 'rgb(19, 8, 36)', sticky: 'rgb(255, 224, 102)', coral: 'rgb(255, 211, 194)' };
  const LT = new Set(['light', 'day', 'sticky', 'coral']); // light themes: light colour scheme
  const themed = async (stored, os) => {
    const tp = await browser.newPage(); tp.on('pageerror', (e) => errors.push(e.message));
    await tp.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: os }]);
    await tp.evaluateOnNewDocument((v) => { try { if (v === null) localStorage.removeItem('board-theme'); else localStorage.setItem('board-theme', v); } catch {} }, stored);
    await tp.goto(`${BASE}/boards?admin=${ADMIN}`);
    const r = await tp.evaluate(() => ({ theme: document.documentElement.dataset.theme ?? null, bg: getComputedStyle(document.body).backgroundColor, scheme: getComputedStyle(document.documentElement).colorScheme, meta: document.getElementById('m-scheme').content }));
    return { tp, ...r };
  };
  for (const [stored, pal] of [['dark', 'dark'], ['light', 'light'], ['dusk', 'dusk'], ['day', 'day'], ['night', 'night'], ['terminal', 'terminal'], ['contrast', 'contrast'], ['synthwave', 'synthwave'], ['sticky', 'sticky'], ['coral', 'coral']]) {
    const r = await themed(stored, LT.has(pal) ? 'dark' : 'light'); // the OS says the opposite: the choice wins
    check(`Boards page, board-theme ${stored}: data-theme ${pal}, ${pal} background, ${LT.has(pal) ? 'light' : 'dark'} colour scheme`, r.theme === pal && r.bg === BG[pal] && r.scheme === (LT.has(pal) ? 'light' : 'dark'), JSON.stringify([r.theme, r.bg, r.scheme]));
    if (stored === 'night' || stored === 'terminal') { await r.tp.waitForSelector('#app:not([hidden])', { timeout: 8000 }).catch(() => {}); await r.tp.screenshot({ path: path.join(out, `boards-${stored}.png`), fullPage: true }); }
    await r.tp.close();
  }
  for (const [stored, os, pal] of [[null, 'dark', 'dark'], [null, 'light', 'light'], ['auto', 'dark', 'dark'], ['auto', 'light', 'light'], ['purple', 'light', 'light']]) {
    const r = await themed(stored, os);
    check(`Boards page, board-theme ${stored ?? '(none)'} over a ${os} OS: no data-theme, ${pal} (Auto follows the OS)`, r.theme === null && r.bg === BG[pal] && r.meta === 'light dark', JSON.stringify([r.theme, r.bg, r.meta]));
    await r.tp.close();
  }

  check('no page errors or browser dialogs', !errors.length, errors.join(' | ').slice(0, 300));
} catch (e) {
  R.push(`CRASH ${e.message}`);
}
await finish(R, { browser, board });
