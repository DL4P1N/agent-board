// The web board fixes of the round 5b real-use review: a review nobody takes, a forwarded named link, the Undo
// shortcut and the toasts' keys, focus after moves, announcements, the phone's direct thread, the agent mark in the
// feed, and the host's, sign-in, rotation and accessibility lows.
// Starts its own throwaway board. Run all suites with: npm test
import path from 'node:path';
import { startBoard, launchBrowser, shotsDir, finish, seed, rest, agent } from '../helpers.mjs';

const board = await startBoard();
const out = shotsDir('realuse');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = (page, fn, arg, timeout = 5000) => page.waitForFunction(fn, { timeout, polling: 100 }, arg).then(() => true).catch(() => false);
const txt = (page, sel) => page.$eval(sel, (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
const db = async (fn) => { const { DatabaseSync } = await import('node:sqlite'); const d = new DatabaseSync(path.join(board.dataDir, 'board.db')); try { return fn(d); } finally { d.close(); } };
const errors = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|ERR_CONNECTION|EventSource/i.test(m.text()) && errors.push('console: ' + m.text()));
  page.on('dialog', (d) => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
};
const signIn = (name = 'dana') => (page) => page.evaluateOnNewDocument((n) => { try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', n); localStorage.setItem('board-setup', 'closed'); } catch {} }, name);
const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 1000 } });

try {
  const ids = await seed(board);
  // Whoever is free merges, and nobody has taken the CI task in Review for 25 minutes.
  await rest(board, 'dana', '/settings', 'PUT', { integrator: '*' });
  await db((d) => { const at = Date.now() - 25 * 60e3; d.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run(at, ids.ci.id); d.prepare("UPDATE events SET ts = ? WHERE task_id = ? AND kind = 'task_updated'").run(at, ids.ci.id); });
  const page = await browser.newPage(); watch(page); await signIn()(page);
  await page.goto(board.base + '/');
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live') && document.querySelectorAll('.card').length > 5, { timeout: 8000 });
  for (const q of (await rest(board, 'dana', '/state')).questions.filter((x) => !x.answer)) await rest(board, 'dana', `/questions/${q.id}/answer`, 'POST', { answer: 'ok' });
  await rest(board, 'dana', `/tasks/${ids.auth.id}`, 'PATCH', { status: 'in_progress' });
  await page.evaluate(() => load()); await sleep(300);

  // ---- M2: a task in Review that nobody reviews ----
  const na = await txt(page, '#nyou');
  check('M2 Needs attention names a task waiting in Review with nobody reviewing it (10+ min), not "All good"', new RegExp(`#${ids.ci.id} .*has waited in Review .* nobody is reviewing it`).test(na) && !/All good/.test(na), na);
  await page.click('#now [data-go="unreviewed"]'); await sleep(400);
  check('M2 its link goes to that card', await page.evaluate((id) => document.activeElement?.dataset?.id === String(id), ids.ci.id), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));

  // ---- M11: Ctrl+Z only for the newest toast, its key on the button and in Help; F8 goes to the newest toast's button ----
  await page.evaluate(() => { document.activeElement?.blur(); $('toasts').replaceChildren(); window.__undo = 0; toast('#1 moved to Review', false, { label: 'Undo', run() { window.__undo++; } }); toast('Saved #2'); });
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await sleep(150);
  check('M11 Ctrl+Z does nothing when the newest toast isn\'t an Undo one (an older move stays)', await page.evaluate(() => window.__undo === 0));
  await page.evaluate(() => toast('#3 moved to Done', false, { label: 'Undo', run() { window.__undo += 10; } }));
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await sleep(150);
  check('M11 Ctrl+Z runs the newest toast\'s Undo', await page.evaluate(() => window.__undo === 10));
  const ub = await page.evaluate(() => { toast('#4 moved to Done', false, { label: 'Undo', run() {} }); const b = [...document.querySelectorAll('#toasts [data-undo]')].pop(); return { text: b.innerText.replace(/\s+/g, ' ').trim(), keys: b.getAttribute('aria-keyshortcuts') }; });
  check('M11 the Undo button says its key: "Undo (Ctrl+Z)"', ub.text === 'Undo (Ctrl+Z)' && /Control\+Z/.test(ub.keys), JSON.stringify(ub));
  await page.evaluate(() => { $('msg').focus(); toast('Answer sent to chen', false, { label: 'Correct it', run() {} }); });
  await page.keyboard.press('F8');
  check('M11 F8 goes to the newest toast\'s button (from a text field too)', await page.evaluate(() => document.activeElement?.textContent === 'Correct it' && !!document.activeElement.closest('#toasts')), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  await page.evaluate(() => { document.activeElement?.blur(); $('toasts').replaceChildren(); openHelp(); });
  const help = await txt(page, '#help-dlg');
  check('M11 Help lists Ctrl+Z (Undo) and F8 (the newest note\'s button)', /Ctrl\s*\+\s*Z.*Undo/.test(help) && /F8 goes to the newest note's button/.test(help), help.match(/.{0,80}F8.{0,60}/)?.[0] || 'no F8');
  await page.keyboard.press('Escape'); await sleep(200);

  // ---- M12: a Move menu move keeps focus on the moved card, also into a folded Done ----
  await page.evaluate(() => { ui.doneOpen = 'closed'; render(); });
  await page.click(`[data-move="${ids.lb.id}"]`); await page.click(`[data-move-to="done"][data-move-id="${ids.lb.id}"]`); await sleep(300);
  const mf = await page.evaluate(() => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id, fk: document.activeElement?.dataset?.fk }));
  check('M12 a Move menu move into a folded Done: focus on the Done column\'s button, not the page', mf.tag !== 'BODY' && /done-tog/.test(mf.fk || ''), JSON.stringify(mf));
  await page.evaluate(() => { $('toasts').replaceChildren(); ui.doneOpen = 'open'; render(); });

  // ---- M13: the Demo popover's freeze warning is read out ----
  await page.click('#clock'); await page.waitForSelector('#o-dl-in');
  await page.evaluate(() => { const d = $('o-dl-in'); d.value = localInput(Date.now() + 30 * 60e3); d.dispatchEvent(new Event('input', { bubbles: true })); $('o-fz-in').value = '60'; });
  await page.click('[data-fk="o-dl-save"]');
  check('M13 a demo time inside the freeze window: the warning is announced, not only drawn', await until(page, () => /freeze starts as soon as you save/.test($('announcer').textContent)), await page.evaluate(() => $('announcer').textContent));
  await page.keyboard.press('Escape'); await sleep(200);

  // ---- M14: on a phone, "Correct it" (a direct thread) brings the message box into view ----
  const ph = await browser.newPage(); watch(ph); await signIn()(ph);
  await ph.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await ph.goto(board.base + '/'); await ph.waitForFunction(() => document.getElementById('conn').classList.contains('live') && document.querySelectorAll('.card').length > 5, { timeout: 8000 });
  await ph.evaluate(() => scrollTo(0, 0)); await sleep(200);
  // What "Correct it" runs: the asker's direct thread (openDm), from the top of the page.
  const dmv = await ph.evaluate(async () => { (await import('/js/activity.js')).openDm('chen'); await new Promise((r) => setTimeout(r, 900)); const r = $('msg').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight, focus: document.activeElement === $('msg'), dm: ui.dm }; });
  check('M14 phone: opening a direct thread scrolls its message box into view', dmv.focus && dmv.dm === 'chen' && dmv.top >= 0 && dmv.bottom <= dmv.h, JSON.stringify(dmv));
  await ph.close();
} catch (e) { results.push('CRASH ' + (e.stack || e)); }
check('no page/console errors or native dialogs', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
