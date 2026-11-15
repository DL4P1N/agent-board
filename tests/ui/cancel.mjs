// Cancelling a task from the task dialog (human-only), and the tool colour dots on agent chips.
// Starts its own throwaway board. Run all suites with: npm test
import { agentTokenFor } from '../../src/tokens.js';
import { startBoard, launchBrowser, shotsDir, finish, agent, rest } from '../helpers.mjs';

const board = await startBoard();
const out = shotsDir('cancel');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const alice = await agent(board, 'alice');
await alice('board_status');
await alice('set_goal', { goal: 'A voting app for hackathon projects.' });
const a = await alice('create_task', { title: 'Duplicate task' });
const b = await alice('create_task', { title: 'Task kept' });
await agent(board, 'bob-codex', 'codex-mcp-client').then((bob) => bob('board_status'));

// The endpoint is human-only.
const agentTok = await fetch(`${board.base}/api/tasks/${b.id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agentTokenFor(board.token)}`, 'X-Agent': 'alice' }, body: '{}' });
check('agent/bad token cannot cancel via REST', agentTok.status === 403 || agentTok.status === 401, String(agentTok.status));
const noAuth = await fetch(`${board.base}/api/tasks/${b.id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
check('no auth cannot cancel via REST', noAuth.status === 401 || noAuth.status === 403, String(noAuth.status));
check('task still exists after rejected calls', (await rest(board, 'dana', '/state')).tasks.some((t) => t.id === b.id));

const browser = await launchBrowser({ defaultViewport: { width: 1440, height: 1000 } });
const errors = [];
let page;
try {
  page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  page.on('dialog', (d) => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
  await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('board-token', t); localStorage.setItem('board-name', 'dana'); } catch {} }, board.token);
  await page.goto(board.base + '/');
  await page.waitForSelector(`.card[data-id="${a.id}"]`);

  await page.click(`.card[data-id="${a.id}"]`);
  await page.waitForSelector('#task-dlg[open]');
  check('cancel button visible for an existing task', await page.$eval('#td-cancel', (e) => !e.hidden));
  await page.click('#td-cancel');
  check('first click only asks to confirm', /Click again/.test(await page.$eval('#td-cancel', (e) => e.textContent)) && !!(await page.$('#task-dlg[open]')));
  check('task still exists after one click', (await rest(board, 'dana', '/state')).tasks.some((t) => t.id === a.id));
  await page.type('#td-cancel-reason', 'duplicate of another one');
  await page.screenshot({ path: `${out}/confirm.png` });
  await page.click('#td-cancel');
  await page.waitForFunction(() => !document.querySelector('#task-dlg[open]'), { timeout: 5000 });
  await sleep(500);
  const st = await rest(board, 'dana', '/state');
  check('task cancelled on the server', !st.tasks.some((t) => t.id === a.id));
  const ev = st.events.find((e) => e.kind === 'task_deleted' && e.task_id === a.id);
  check('cancellation with reason recorded in activity', !!ev && /cancelled/.test(ev.text) && /duplicate of another one/.test(ev.text), ev?.text);
  check('card removed from the board', !(await page.$(`.card[data-id="${a.id}"]`)));

  // Tool colour dots.
  await page.waitForSelector('.tdot');
  const dots = await page.$$eval('.tdot', (els) => els.map((e) => ({ tool: e.dataset.tool, bg: getComputedStyle(e).backgroundColor, hidden: e.getAttribute('aria-hidden') })));
  const claude = dots.find((d) => d.tool === 'claude'); const codex = dots.find((d) => d.tool === 'codex');
  check('claude and codex dots present, aria-hidden', !!claude && !!codex && claude.hidden === 'true' && codex.hidden === 'true', JSON.stringify(dots));
  check('the two dots have different colours', !!claude && !!codex && claude.bg !== codex.bg && claude.bg !== 'rgba(0, 0, 0, 0)', `${claude?.bg} vs ${codex?.bg}`);
} catch (e) { results.push('CRASH ' + e.stack); }
check('no page/console errors or native dialogs', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
