// Task text filter, Columns | Table view, and the Problems / Merges and reviews feed tabs.
import { startBoard, launchBrowser, finish, agent, rest as restOf } from '../helpers.mjs';

const board = await startBoard();
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rest = (who, p, method, body) => restOf(board, who, p, method, body);

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 1000 } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|ERR_CONNECTION|EventSource/i.test(m.text()) && errors.push('console: ' + m.text()));

try {
  const bc = await agent(board, 'bob-claude'); await bc('board_status');
  const a = await rest('dana', '/tasks', 'POST', { title: 'Build login page', priority: 1, size: 'L' });
  const b = await rest('dana', '/tasks', 'POST', { title: 'Write database migration', priority: 3, size: 'S' });
  const c = await rest('dana', '/tasks', 'POST', { title: 'Fix header spacing' });
  await rest('dana', `/tasks/${a.id}`, 'PATCH', { assignee: 'bob-claude' });
  await rest('dana', `/tasks/${b.id}`, 'PATCH', { assignee: 'alice-codex', status: 'in_progress' });
  await rest('dana', `/tasks/${b.id}`, 'PATCH', { status: 'blocked', note: 'need creds' });
  await rest('dana', `/tasks/${a.id}`, 'PATCH', { status: 'in_progress' });
  await rest('dana', `/tasks/${a.id}`, 'PATCH', { status: 'review' });
  await rest('dana', `/tasks/${a.id}`, 'PATCH', { status: 'in_progress', note: 'tests fail' });
  await rest('dana', `/tasks/${c.id}`, 'PATCH', { status: 'done' });
  await rest('dana', '/agents/bob-claude', 'PATCH', { limited: true, note: 'weekly limit' });

  await page.goto(`${board.base}/?token=${board.token}&name=dana`);
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('.card').length >= 2, { timeout: 5000 });

  const cards = () => page.$$eval('.card', (l) => l.map((x) => x.dataset.id));
  check('kanban is the default view', (await page.$eval('#board', (x) => !x.hidden)) && (await page.$eval('#tasktable', (x) => x.hidden)));

  // Search: title, #id, assignee; case-insensitive; typed text survives a re-render.
  await page.type('#tsearch', 'LOGIN');
  check('search by title', (await cards()).join() === String(a.id), (await cards()).join());
  await page.$eval('#tsearch', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('#tsearch', `#${b.id}`);
  check('search by #id', (await cards()).join() === String(b.id), (await cards()).join());
  await page.$eval('#tsearch', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('#tsearch', 'Alice-Codex');
  check('search by assignee', (await cards()).join() === String(b.id), (await cards()).join());
  await page.evaluate(() => { render(); });
  await rest('dana', `/tasks/${c.id}`, 'PATCH', { title: 'Fix header spacing now' });
  await sleep(600);
  check('typed text survives re-renders', (await page.$eval('#tsearch', (e) => e.value)) === 'Alice-Codex');
  check('#filter still there', !!(await page.$('#filter')));

  // Table view.
  await page.$eval('#tsearch', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('[data-view="table"]');
  const rows = () => page.$$eval('#tasktable tbody tr', (l) => l.map((x) => x.dataset.id));
  check('table shows all tasks, board hidden', (await rows()).length === 3 && (await page.$eval('#board', (x) => x.hidden)), (await rows()).join());
  const upd = await page.$$eval('#tasktable tbody tr[data-id] td:last-child', (l) => l.map((td) => { const r = document.createRange(); r.selectNodeContents(td); return { ws: getComputedStyle(td).whiteSpace, lines: new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size }; }));
  check('U9 the Updated column stays on one line ("55m ago" never wraps)', upd.length === 3 && upd.every((u) => u.ws === 'nowrap' && u.lines === 1), JSON.stringify(upd));
  check('toggle aria-pressed', (await page.$eval('[data-view="table"]', (x) => x.getAttribute('aria-pressed'))) === 'true');
  await page.click('[data-tsort="priority"]');
  check('sort by priority ascending', (await rows())[0] === String(a.id) && (await page.$eval('[data-tsort="priority"]', (x) => x.parentElement.getAttribute('aria-sort'))) === 'ascending', (await rows()).join());
  await page.click('[data-tsort="priority"]');
  check('click again reverses', (await rows())[0] === String(b.id) && (await page.$eval('[data-tsort="priority"]', (x) => x.parentElement.getAttribute('aria-sort'))) === 'descending', (await rows()).join());
  await page.click('[data-tsort="size"]');
  check('sort by size (S first)', (await rows())[0] === String(b.id), (await rows()).join());
  await page.type('#tsearch', 'login');
  check('search filters the table too', (await rows()).join() === String(a.id), (await rows()).join());
  await page.$eval('#tsearch', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click(`#tasktable [data-open-task="${a.id}"].link`);
  await page.waitForSelector('#task-dlg[open]');
  check('a row opens the task dialog', true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('task-dlg').open);

  // Choice is saved.
  await page.reload(); await page.waitForSelector('#app:not([hidden])');
  await page.waitForSelector('#tasktable tbody tr');
  check('table choice survives reload', !(await page.$eval('#tasktable', (x) => x.hidden)));

  // The Table view has no cards: a move that needs an owner asks under the task's row, and picking one moves it.
  const cy = await agent(board, 'cy-claude'); await cy('board_status');
  const d = await rest('dana', '/tasks', 'POST', { title: 'Pick an owner in the table' });
  await page.waitForSelector(`#tasktable [data-fk="tt-${d.id}"]`);
  await page.click(`#tasktable [data-fk="tt-${d.id}"]`); await page.waitForSelector('#task-dlg[open]');
  await page.select('#td-status', 'claimed'); await page.click('#td-save');
  const asked = await page.waitForSelector('#tasktable tr.tt-ask [data-ask-to="cy-claude"]', { visible: true, timeout: 5000 }).then(() => true).catch(() => false);
  check('Table view: a move that needs an owner asks under the task\'s row, focus on its first choice', asked && await page.evaluate(() => !!document.activeElement?.closest('#tasktable tr.tt-ask .mvask')));
  await page.click('#tasktable [data-ask-to="cy-claude"]');
  await page.waitForFunction((id) => state.tasks.find((t) => t.id === id)?.assignee === 'cy-claude', { timeout: 5000 }, d.id).catch(() => {});
  const dt = (await rest('dana', '/state', 'GET')).tasks.find((t) => t.id === d.id);
  check('Table view: picking an agent claims it for that agent, focus back on its row', dt.status === 'claimed' && dt.assignee === 'cy-claude' && !(await page.$('#tasktable tr.tt-ask')) && await page.evaluate((id) => document.activeElement?.dataset.fk === `tt-${id}`, d.id), `${dt.status} ${dt.assignee} ${await page.evaluate(() => document.activeElement?.dataset.fk)}`);
  // Needs attention's "in Review" link: the columns are hidden, so it goes to the first row in Review.
  await rest('dana', `/tasks/${d.id}`, 'PATCH', { status: 'in_progress' }); await rest('dana', `/tasks/${d.id}`, 'PATCH', { status: 'review' });
  await page.waitForFunction((id) => state.tasks.find((t) => t.id === id)?.status === 'review' && !!document.querySelector(`#tasktable [data-fk="tt-${id}"]`), { timeout: 5000 }, d.id);
  await page.evaluate(() => { const b = document.createElement('button'); b.dataset.go = 'review'; document.body.append(b); b.click(); b.remove(); });
  check('Table view: the "in Review" link goes to the task\'s row', await page.evaluate((id) => document.activeElement?.dataset.fk === `tt-${id}`, d.id), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  await rest('dana', `/tasks/${d.id}`, 'DELETE');
  await page.waitForFunction((id) => !state.tasks.some((t) => t.id === id), { timeout: 5000 }, d.id);

  // The size labels fit their list in the dialog's three columns (the narrowest is around 600px wide).
  await page.setViewport({ width: 600, height: 900 }); await sleep(200);
  await page.evaluate(() => openTask(null)); await page.waitForSelector('#task-dlg[open]');
  const fits = await page.evaluate(() => {
    const s = document.getElementById('td-size'); const cs = getComputedStyle(s);
    const c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return { room: Math.round(s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)), longest: Math.max(...[...s.options].map((o) => Math.ceil(c.measureText(o.text).width))) };
  });
  check('the task dialog\'s size labels are not cut off at 600px', fits.longest <= fits.room, JSON.stringify(fits));
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('task-dlg').open);
  await page.setViewport({ width: 1440, height: 1000 }); await sleep(200);

  // Phone: no page overflow, the table scrolls inside its container.
  await page.setViewport({ width: 390, height: 800 });
  await sleep(300);
  const ov = await page.evaluate(() => ({ page: document.documentElement.scrollWidth - innerWidth, t: document.getElementById('tasktable').scrollWidth - document.getElementById('tasktable').clientWidth }));
  check('phone: no horizontal page scroll', ov.page <= 1, JSON.stringify(ov));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.click('[data-view="columns"]');
  check('back to columns', (await cards()).length === 2);

  // Header stays one row.
  for (const w of [1366, 1600]) {
    await page.setViewport({ width: w, height: 900 }); await sleep(200);
    const h = await page.$eval('header', (x) => x.getBoundingClientRect().height);
    check(`header one row at ${w}`, h < 80, h + 'px');
  }
  await page.setViewport({ width: 1440, height: 1000 });

  // Activity's filters: All, Chat, @me and Direct (what's blocked and what's merged are Needs attention's and the
  // columns'); a tab saved from before (Problems) shows All.
  check('Activity has All, Chat, @me and Direct only', (await page.$$eval('#tabs button', (l) => l.map((b) => b.dataset.tab))).join() === 'all,chat,me,direct');
  await page.evaluate(() => { localStorage.setItem('board-tab', 'problems'); });
  await page.reload(); await page.waitForSelector('#app:not([hidden])'); await sleep(500);
  check('a saved Problems tab opens All', await page.evaluate(() => ui.tab === 'all' && document.querySelector('[data-tab="all"]').getAttribute('aria-pressed') === 'true' && document.querySelectorAll('#feed .ev').length > 0));
} catch (e) { results.push('CRASH ' + e.stack); }
check('no page/console errors', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
