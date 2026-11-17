// Header, connection state, "What to do now", Start here and the online count (UX review 2026-11-10:
// WB-1, WB-3, WB-4, WB-5, WB-6, ONB-2, ONB-3, ONB-4, ONB-9, ER-1, ER-2, ER-3).
// Starts its own throwaway board. Run all suites with: npm test
import path from 'node:path';
import { startBoard, launchBrowser, shotsDir, finish, rest as restB, Client, StreamableHTTPClientTransport } from '../helpers.mjs';

const board = await startBoard();
const BASE = board.base;
const out = shotsDir('header');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rest = (who, p, method, body) => restB(board, who, p, method, body);
// An agent; extra adds query parameters (laptop=… to fake a second laptop).
async function agent(name, extra = {}) {
  const q = new URLSearchParams({ agent: name, token: 'testtok', ...extra });
  const c = new Client({ name: 'claude-code', version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp?${q}`)));
  return async (tool, args = {}) => { const r = await c.callTool({ name: tool, arguments: args }); const t = r.content[0].text; try { return JSON.parse(t); } catch { return t; } };
}
const db = async (fn) => { const { DatabaseSync } = await import('node:sqlite'); const d = new DatabaseSync(path.join(board.dataDir, 'board.db')); try { fn(d); } finally { d.close(); } };
const ageAgent = (name, min) => db((d) => d.prepare("UPDATE presence_v2 SET last_seen = ? WHERE name = ? AND kind = 'agent'").run(Date.now() - min * 60e3, name));

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 900 } });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('dialog', (d) => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
  const txt = (sel) => page.$eval(sel, (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  const reload = async () => { await page.evaluate(() => load()); await sleep(250); };
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); } catch {} });
  await page.goto(BASE + '/');
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 5000 });
  await sleep(300);

  // ---- ONB-4: on first load the goal step is in view, and the strip says it can be set meanwhile ----
  const goalTop = await page.$eval('#step-goal', (e) => e.getBoundingClientRect().top);
  check('ONB-4 first load at 1440×900: step 2 is above the fold', goalTop < 900 - 40, Math.round(goalTop));
  check('ONB-4 the strip offers the goal meanwhile (one link, no "Also:"), and no lead while Setup shows step 1', /^Write the goal \(step 2\)$/.test(await txt('#now .also')) && !(await page.$('#now .na')), await txt('#now'));
  await page.screenshot({ path: `${out}/h-first-load.png` });

  // ---- ONB-3: Rotate token… is out of step 1, under Board security; step 1 links to it ----
  check('ONB-3 no rotate button inside step 1', !(await page.$('#step-invite [data-fk="rot"]')));
  check('ONB-3 rotate button under Board security', !!(await page.$('#board-sec [data-fk="rot"]')) && /Board security/.test(await txt('#board-sec')));
  check('ONB-3 step 1 says nothing about laptops while none is connected, and has no "Link leaked?" line', !/Laptops connected|None yet|Link leaked/.test(await txt('#step-invite')), await txt('#step-invite'));


  // ---- ONB-2: after the goal is saved, step 2 stays open on the demo time ----
  await page.click('#now .also [data-go="step-goal"]'); await sleep(300);
  await page.type('#goal-in', 'A voting app. Demo: submit, vote, leaderboard.');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /Goal saved/.test(document.getElementById('toasts').innerText), { timeout: 5000 });
  await sleep(300);
  check('ONB-2 step 2 stays open with the demo time form', !!(await page.$('#step-goal #dl-in')) && /no demo time yet/.test(await txt('#step-goal .step-s')), await txt('#step-goal .step-s'));
  check('ONB-2 the strip asks for the demo time', /Set the demo time so agents stop on time/.test(await txt('#now .also')), await txt('#now'));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#now .also [data-act="clock"]'); await sleep(400);
  check('ONB-2 the hint opens the demo time under the Demo chip, focus in its field', await page.evaluate(() => document.activeElement?.id === 'o-dl-in' && !$('o-dl').hidden));
  await page.keyboard.press('Escape');
  await page.click('[data-fk="dl-skip"]'); await sleep(300);
  check('ONB-2 "No demo time" removes the hint and the "no demo time yet" note', !/Set the demo time/.test(await txt('#now')) && !/no demo time yet/.test(await txt('#step-goal .step-s')), await txt('#now'));

  // ---- WB-6: the online count leaves out agents that are out of usage or offline ----
  const ann = await agent('ann'); const bea = await agent('bea'); const cid = await agent('cid');
  for (const a of [ann, bea, cid]) await a('board_status');
  const t1 = await ann('create_task', { title: 'Scaffold' });
  const t2 = await ann('create_task', { title: 'API' });
  await cid('claim_task', { id: t2.id }); // a recent claim event: used to count cid online by itself
  await rest('dana', '/agents/bea', 'PATCH', { limited: true });
  await ageAgent('cid', 25);
  await page.evaluate(() => { localStorage.setItem('board-setup', 'closed'); }); await reload();
  const oc = await txt('#o-right-sub'); const ocTip = await page.$eval('#o-right-sub', (e) => e.title);
  check('WB-6 Agents title bar: "1 online", its tooltip "1 online · 1 out of usage · 1 offline"', /^1 online$/.test(oc.trim()) && ocTip.startsWith('1 online · 1 out of usage · 1 offline.'), oc + ' | ' + ocTip);
  await rest('dana', '/agents/bea', 'PATCH', { limited: false });

  // ---- WB-3: plan approval outranks a question; the question follows under "Also" ----
  await rest('dana', '/settings', 'PUT', { require_approval: true });
  await ann('ask_human', { question: 'Which colour?', task_id: t1.id });
  await reload();
  check('WB-3 approval leads the strip', /^Review the task list \(2 tasks\), then approve it/.test(await txt('#now .na')), await txt('#now'));
  check('WB-3 the question is the next line', /Answer 1 question/.test(await txt('#now .also')), await txt('#now .also'));
  check('WB-3 at most three lines', await page.$$eval('#now .also button', (b) => b.length) <= 2);
  await page.screenshot({ path: `${out}/h-ranked.png` });
  await rest('dana', '/settings', 'PUT', { plan_approved: true });

  // ---- WB-5: the same name on two laptops leads the strip ----
  await agent('dup', { laptop: 'aaa' }).then((a) => a('board_status'));
  await agent('dup', { laptop: 'bbb' }).then((a) => a('board_status'));
  await reload();
  check('WB-5 name clash leads the strip', /^dup is running on 2 laptops/.test(await txt('#now .na')) && await page.$eval('#now', (e) => e.classList.contains('k-urgent')), await txt('#now'));
  check('WB-5 the question still shows under Also', /Answer 1 question/.test(await txt('#now .also')), await txt('#now .also'));
  await page.click('#now [data-go="conflict"]'); await sleep(400);
  check('WB-5 the line opens the person with the clash', await page.evaluate(() => !!document.activeElement?.closest('#people')));

  // ---- ONB-9: with a demo time set the header stays on one row (1440 and 1366) ----
  await rest('dana', '/settings', 'PUT', { deadline: Date.now() + 3 * 3600e3, freeze_minutes: 60 });
  await reload();
  for (const w of [1440, 1366]) {
    await page.setViewport({ width: w, height: 900 }); await sleep(300);
    const hd = await page.evaluate(() => { const h = document.querySelector('#app > header'); const c = $('clock').getBoundingClientRect(); const g = $('goal-btn').getBoundingClientRect(); const r = $('roles-btn').getBoundingClientRect(); const tr = $('topbar').getBoundingClientRect(); return { h: h.offsetHeight, tb: $('topbar').offsetHeight, same: Math.abs(c.top - g.top) < 4 && Math.abs(r.top - g.top) < 4 && r.width > 0, inside: [...$('topbar').querySelectorAll('.tbc')].every((x) => x.getBoundingClientRect().right <= tr.right + 0.5), clock: /Demo in/.test($('clock').textContent), noHeaderClock: !document.querySelector('#app > header #clock') }; });
    check(`ONB-9 ${w}px: one header row, and the top bar's chips (goal, demo time, Roles, Setup) on one row, nothing past its edge`, hd.clock && hd.same && hd.inside && hd.noHeaderClock && hd.h < 70 && hd.tb < 56, JSON.stringify(hd));
    await page.screenshot({ path: `${out}/h-header-${w}.png`, clip: { x: 0, y: 0, width: w, height: 120 } });
  }
  await page.setViewport({ width: 1440, height: 900 }); await sleep(200);

  // ---- ER-3: a slow save says so ----
  await page.setRequestInterception(true);
  page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/tasks$/.test(r.url())) setTimeout(() => r.continue().catch(() => {}), 1600); else r.continue().catch(() => {}); });
  await page.evaluate(() => document.activeElement?.blur());
  await page.click('#new-task-btn'); await sleep(300);
  await page.type('#td-name', 'Slow network task');
  await page.click('#td-save'); await sleep(1000);
  const busy = await page.evaluate(() => ({ btn: $('td-save').textContent, saving: $('conn').hasAttribute('data-saving'), after: getComputedStyle($('conn'), '::after').content }));
  check('ER-3 the button says Creating… while it waits', busy.btn === 'Creating…', busy.btn);
  check('ER-3 the header says Saving… after a moment', busy.saving && /Saving/.test(busy.after), JSON.stringify(busy));
  await page.waitForFunction(() => !$('task-dlg').open, { timeout: 5000 }).catch(() => {});
  await sleep(200);
  check('ER-3 done: label and header back to normal', await page.evaluate(() => $('td-save').textContent === 'Create task' && !$('conn').hasAttribute('data-saving')));
  await page.setRequestInterception(false); page.removeAllListeners('request');

  // ---- WB-1 / ER-1: losing the server shows under the header even when scrolled ----
  // One column (a narrow window), so the page itself scrolls: on a laptop the board scrolls beside the rails.
  await page.setViewport({ width: 960, height: 700 }); await sleep(200);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(200);
  await board.stop();
  await page.waitForFunction(() => !$('downbar').hidden, { timeout: 15000 }).catch(() => {});
  const down = await page.evaluate(() => { const h = document.querySelector('#app > header').getBoundingClientRect(); const b = $('downbar').getBoundingClientRect(); return { shown: !$('downbar').hidden, hb: Math.round(h.bottom), bt: Math.round(b.top), scrolled: scrollY > 100, tint: document.querySelector('#app > header').classList.contains('down') }; });
  check('WB-1 scrolled: the red bar sits right under the header', down.shown && down.scrolled && Math.abs(down.bt - down.hb) <= 2, JSON.stringify(down));
  check('WB-1 the header turns red too', down.tint);
  await page.screenshot({ path: `${out}/h-down-scrolled.png` });
  await board.relaunch();
  await page.waitForFunction(() => $('conn').classList.contains('live'), { timeout: 20000 }).catch(() => {});
  check('WB-1 back: bar hidden, header normal', await page.evaluate(() => $('downbar').hidden && !document.querySelector('#app > header').classList.contains('down')));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewport({ width: 1440, height: 900 });

  // ---- WB-4: after the demo, with nobody on the board, the page says the event is over ----
  // The API refuses a past demo time: set one a second ahead and let it pass.
  await rest('dana', '/settings', 'PUT', { deadline: Date.now() + 1000 });
  await new Promise((r) => setTimeout(r, 1500));
  for (const n of ['ann', 'bea', 'cid', 'dup']) await ageAgent(n, 120);
  await reload();
  check('WB-4 "The event is over"', /^The event is over\. Download the summary and retro/.test(await txt('#now .na')) && await page.$eval('#now', (e) => e.classList.contains('k-done')), await txt('#now'));
  check('WB-4 needs badges are muted', await page.$eval('#needs', (e) => e.classList.contains('quiet')));
  await page.screenshot({ path: `${out}/h-event-over.png` });

  // ---- ER-2: a token rotation sends open pages to the sign-in with the reason ----
  // The test board's token comes from BOARD_TOKEN (can't rotate), so the server's 401s are played here:
  // with the reason the server sends after a rotation, and as a plain 401 from an older server.
  await page.setRequestInterception(true);
  let reason = '';
  page.on('request', (r) => { if (/\/api\//.test(r.url()) && /Bearer (testtok|oldtok)$/.test(r.headers().authorization || '')) r.respond({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'bad or missing token', ...(reason ? { reason } : {}) }) }); else r.continue().catch(() => {}); });
  const CHANGED = 'The board\'s link changed. Ask the host for the new link.';
  const REJECTED = 'That token was rejected. Ask the host for the board link.';
  reason = 'token_rotated';
  await page.evaluate(() => load()).catch(() => {});
  await page.waitForFunction(() => !$('gate').hidden, { timeout: 8000 }).catch(() => {});
  check('ER-2 open page, 401 with reason token_rotated: "The board\'s link changed…"', await page.evaluate((m) => !$('gate').hidden && $('g-err').textContent === m, CHANGED), await txt('#g-err'));
  reason = '';
  await page.evaluate(() => { $('gate').hidden = true; $('app').hidden = false; $('g-err').textContent = ''; return load(); }).catch(() => {});
  await page.waitForFunction(() => !$('gate').hidden, { timeout: 8000 }).catch(() => {});
  check('ER-2 open page, plain 401: "That token was rejected. Ask the host for the board link."', await page.evaluate((m) => !$('gate').hidden && $('g-err').textContent === m, REJECTED), await txt('#g-err'));
  await page.evaluate(() => { $('g-err').textContent = ''; return fetchExport('json'); }).catch(() => {});
  check('ER-2 export download, plain 401: says the token was rejected', await page.$eval('#g-err', (e) => e.textContent) === REJECTED, await txt('#g-err'));
  reason = 'token_rotated';
  await page.evaluate(() => { $('g-err').textContent = ''; return fetchExport('json'); }).catch(() => {});
  check('ER-2 export download, rotated 401: says the link changed', await page.$eval('#g-err', (e) => e.textContent) === CHANGED, await txt('#g-err'));
  reason = 'token_rotated';
  await page.$eval('#g-token', (e) => { e.value = 'oldtok'; }); await page.click('#g-go'); await sleep(400);
  check('ER-2 sign-in with a rotated token says the link changed', await page.$eval('#g-err', (e) => e.textContent) === 'The board\'s link changed. Ask the host for the new link.', await txt('#g-err'));
  reason = '';
  await page.click('#g-go'); await sleep(400);
  check('ER-2 sign-in with a wrong token: "That token was rejected. Ask the host…"', await page.$eval('#g-err', (e) => e.textContent) === REJECTED, await txt('#g-err'));
} catch (e) { results.push('CRASH ' + e.stack); }
check('no page errors or native dialogs', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
