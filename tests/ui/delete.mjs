// Deleting a task from the task dialog (two-click confirm), and what happens to tasks that depended on it.
// Starts its own throwaway board. Run all suites with: npm test
import { startBoard, launchBrowser, shotsDir, finish, agent, rest } from '../helpers.mjs';

const board = await startBoard();
const out = shotsDir('delete');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const alice = await agent(board, 'alice');
await alice('board_status');
await alice('set_goal', { goal: 'A voting app for hackathon projects.' });
const a = await alice('create_task', { title: 'Task to delete' });
const b = await alice('create_task', { title: 'Depends on it', depends_on: [a.id] });

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
  check('delete button visible for an existing task', await page.$eval('#td-delete', (e) => !e.hidden));
  await page.click('#td-delete');
  check('first click only asks to confirm', /Click again/.test(await page.$eval('#td-delete', (e) => e.textContent)) && !!(await page.$('#task-dlg[open]')));
  check('task still exists after one click', (await rest(board, 'dana', '/state')).tasks.some((t) => t.id === a.id));
  await page.screenshot({ path: `${out}/confirm.png` });
  await page.click('#td-delete');
  await page.waitForFunction(() => !document.querySelector('#task-dlg[open]'), { timeout: 5000 });
  await sleep(500);
  const st = await rest(board, 'dana', '/state');
  check('task deleted on the server', !st.tasks.some((t) => t.id === a.id));
  check('dependent task no longer waits on it', st.tasks.find((t) => t.id === b.id)?.depends_on.length === 0);
  check('card removed from the board', !(await page.$(`.card[data-id="${a.id}"]`)));
  check('deletion shows in the feed', st.events.some((e) => e.kind === 'task_deleted' && e.task_id === a.id));
  check('agent can now claim the formerly dependent task', (await alice('claim_task', { id: b.id })).status === 'claimed');

  await page.click(`.card[data-id="${b.id}"]`);
  await page.waitForSelector('#task-dlg[open]');
  await page.click('#td-delete');
  await sleep(5500);
  check('confirm resets after 5 s', (await page.$eval('#td-delete', (e) => e.textContent)) === 'Delete task');
  await page.keyboard.press('Escape');

  await page.click('#new-task-btn').catch(() => page.keyboard.press('n'));
  await page.waitForSelector('#task-dlg[open]');
  check('no delete button on a new task', await page.$eval('#td-delete', (e) => e.hidden));
} catch (e) { results.push('CRASH ' + e.stack); }
check('no page/console errors or native dialogs', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
