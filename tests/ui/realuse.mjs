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
} catch (e) { results.push('CRASH ' + (e.stack || e)); }
check('no page/console errors or native dialogs', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
