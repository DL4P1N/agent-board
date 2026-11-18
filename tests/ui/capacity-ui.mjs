// Capacity-aware delegation on the web board: agents' plans and slots, team capacity, task size,
// reservations, stale tasks whose owner went offline, and server validation errors shown inline.
// Starts its own throwaway board. Run all suites with: npm test
import path from 'node:path';
import { startBoard, launchBrowser, shotsDir, finish, rest, ageTask, Client, StreamableHTTPClientTransport } from '../helpers.mjs';

const board = await startBoard();
const out = shotsDir('capacity-ui');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);

// An agent connecting the way join configures it: plan + slots in the MCP URL. board_status marks it started.
async function agent(name, { client = 'claude-code', plan, slots } = {}) {
  const q = new URLSearchParams({ agent: name, token: board.token, ...(plan ? { plan } : {}), ...(slots ? { slots: String(slots) } : {}) });
  const c = new Client({ name: client, version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${board.base}/mcp?${q}`)));
  const call = async (tool, args = {}) => {
    const r = await c.callTool({ name: tool, arguments: args });
    const t = r.content[0].text;
    let body; try { body = JSON.parse(t); } catch { body = t; }
    return r.isError ? { error: t } : body;
  };
  await call('board_status');
  return call;
}
async function setLastSeen(name, minutesAgo) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path.join(board.dataDir, 'board.db'));
  db.prepare("UPDATE presence_v2 SET last_seen=? WHERE name=? AND kind='agent'").run(Date.now() - minutesAgo * 60e3, name);
  db.close();
}

// Team: a big Claude plan (3 at once), a one-slot Codex, Claude Code without a plan (default 2), Copilot without a plan (default 1).
const ana = await agent('ana', { plan: 'Claude Max 20x', slots: 3 });
const cy = await agent('cy', { client: 'codex-mcp-client', plan: 'ChatGPT Edu', slots: 1 });
const eve = await agent('eve');
await agent('fay', { client: 'Visual Studio Code' });
await ana('set_goal', { goal: 'A voting app for hackathon projects.' });
await ana('claim_role', { role: 'planner' });
const T = [];
for (let i = 1; i <= 6; i++) T.push(await ana('create_task', { title: `Task ${i}` }));
await ana('claim_task', { id: T[0].id });
await ana('claim_task', { id: T[1].id });
await cy('claim_task', { id: T[2].id });

const browser = await launchBrowser({ defaultViewport: { width: 1440, height: 1000 } });
const errors = [];
let page;
const until = (fn, arg, timeout = 5000) => page.waitForFunction(fn, { timeout, polling: 100 }, arg).then(() => true).catch(() => false);
const txt = (sel) => page.$eval(sel, (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
const cardTxt = (id) => txt(`.card[data-id="${id}"]`);
async function openCard(id) {
  // Click inside the page (atomic with the DOM): a coordinate click can land on a neighbouring card when a
  // state reload re-lays the board out between puppeteer measuring and clicking.
  await page.$eval(`.card[data-id="${id}"] .ct`, (e) => e.click());
  await page.waitForSelector('#task-dlg[open]');
  await page.waitForFunction((t) => document.getElementById('td-title').textContent === `Task #${t}`, { timeout: 5000 }, id);
}
async function save() {
  await page.click('#td-save');
  await page.waitForFunction(() => !document.querySelector('#task-dlg[open]'), { timeout: 5000 });
}
try {
  page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  // A 400 from the validation check below is expected; the browser logs it as a failed resource.
  page.on('console', (m) => m.type() === 'error' && !/status of 400/.test(m.text()) && errors.push('console: ' + m.text()));
  page.on('dialog', (d) => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('board-token', t); localStorage.setItem('board-name', 'dana'); } catch {} }, board.token);
  await page.goto(board.base + '/');
  await page.waitForSelector(`.card[data-id="${T[0].id}"]`);
  await sleep(400);

  // ---- 1. plan + x/slots per agent ----
  // Agents: one line per agent (its tool's dot, name, role, task, state). Its tool, plan and x/slots are in its
  // screen-reader text and tooltip, and spelled out when it is selected (checked below).
  const people = await txt('#people');
  const arow = (n) => page.$eval(`#people [data-o-agent="${n}"]`, (e) => ({ sr: e.querySelector('.vh')?.textContent || '', title: e.title, vis: e.querySelector('.o-tk')?.innerText || '' })).catch(() => ({}));
  const pAna = await arow('ana'), pCy = await arow('cy');
  check('ana: plan and 2/3 (screen reader and tooltip)', /Claude Max 20x: 2\/3/.test(pAna.sr) && /Claude Max 20x/.test(pAna.title), JSON.stringify(pAna));
  check('one-slot Codex agent: plan and 1/1', /ChatGPT Edu: 1\/1/.test(pCy.sr) && /ChatGPT Edu/.test(pCy.title), JSON.stringify(pCy));
  check('no plan: tool name + 0/2 (Claude Code default)', /Claude Code: 0\/2/.test(people), people);
  check('no plan: Copilot default 0/1', /Copilot \(VS Code\): 0\/1/.test(people), people);
  check('rows stay compact: no plan names on screen in the rows', !/Claude Max 20x|ChatGPT Edu/.test(await page.evaluate(() => [...document.querySelectorAll('#people .o-agent .o-tk, #people .o-agent .o-st')].map((e) => e.innerText).join(' '))), people);
  check('an agent row explains its capacity in its tooltip', /allows \d at once/.test(pAna.title), pAna.title);

  // ---- 5. team capacity: the Agents title bar ("3 of 7 running"), in full in its tooltip ----
  const capSub = () => page.$eval('#o-right-sub', (e) => ({ t: e.textContent, tip: e.title, low: e.classList.contains('low') }));
  const sum = await capSub();
  check('Agents title bar: team capacity and running', sum.t === '3 of 7 running' && /^Team can run 7 tasks at once · 3 running/.test(sum.tip), JSON.stringify(sum));

  // ---- 2. size: dialog select saves, card badge shows ----
  await openCard(T[3].id);
  check('size select defaults to M', (await page.$eval('#td-size', (e) => e.value)) === 'M');
  await page.select('#td-size', 'L');
  await save();
  await page.waitForFunction((id) => /\bL\b/.test(document.querySelector(`.card[data-id="${id}"] .pill.size`)?.textContent || ''), { timeout: 5000 }, T[3].id);
  check('size saved on the server', (await human('/state')).tasks.find((t) => t.id === T[3].id).size === 'L');
  check('M tasks show no size badge', !(await page.$(`.card[data-id="${T[5].id}"] .pill.size`)));

  // ---- 3. reserve via the dialog ----
  await openCard(T[4].id);
  const resOpts = await page.$$eval('#td-res option', (os) => os.map((o) => o.textContent));
  check('reserve list: Anyone + started agents with tool/plan', /Anyone/.test(resOpts[0]) && resOpts.some((o) => /^cy · Codex, ChatGPT Edu/.test(o)) && resOpts.some((o) => /^eve · Claude Code/.test(o)), JSON.stringify(resOpts));
  check('reserve hint explains it', /Only that agent can claim it; it's listed first for them/.test(await txt('#td-res-hint')));
  await page.select('#td-res', 'eve');
  await save();
  await page.waitForFunction((id) => /reserved for eve/.test(document.querySelector(`.card[data-id="${id}"]`)?.innerText || ''), { timeout: 5000 }, T[4].id);
  check('card shows reserved badge', /reserved for eve/.test(await cardTxt(T[4].id)));
  const refused = await ana('claim_task', { id: T[4].id });
  check("another agent's claim is refused", /reserved for eve/.test(refused.error || ''), JSON.stringify(refused).slice(0, 160));
  const ok = await eve('claim_task', { id: T[4].id });
  check("the reserved agent's claim works", ok.status === 'claimed' && ok.assignee === 'eve', JSON.stringify(ok).slice(0, 160));
  await page.waitForFunction((id) => document.querySelector(`#col-in_progress .card[data-id="${id}"]`), { timeout: 5000 }, T[4].id);
  check('reserved badge hidden once the reserved agent holds it', !/reserved for/.test(await cardTxt(T[4].id)));
  check('team capacity updates: 4 running', await until(() => document.getElementById('o-right-sub').textContent === '4 of 7 running'), JSON.stringify(await capSub()));

  // ---- create with size + reservation ----
  await page.click('#new-task-btn');
  await page.waitForSelector('#task-dlg[open]');
  await page.type('#td-name', 'Fix login redirect bug');
  await page.select('#td-size', 'S');
  await page.select('#td-res', 'cy');
  await save();
  await sleep(600);
  const created = (await human('/state')).tasks.find((t) => t.title === 'Fix login redirect bug');
  check('new task created with size S and reserved for cy', created?.size === 'S' && created?.reserved_for === 'cy', JSON.stringify(created));
  await page.waitForSelector(`.card[data-id="${created?.id}"]`);
  const ct = await cardTxt(created.id);
  check('new card: S badge and reserved badge', /\bS\b/.test(ct) && /reserved for cy/.test(ct), ct);

  // ---- 7. server validation error shown inline in the dialog ----
  await page.click('#new-task-btn');
  await page.waitForSelector('#task-dlg[open]');
  await page.type('#td-name', 'Depends on a deleted task');
  await page.type('#td-deps', '999');
  // The page thinks #999 exists (as if it was deleted a moment ago), so only the server catches it.
  await page.evaluate(() => { state.tasks.push({ ...state.tasks[0], id: 999, status: 'open' }); });
  await page.click('#td-save');
  await page.waitForFunction(() => document.getElementById('td-err').textContent.length > 0, { timeout: 5000 });
  const vErr = await txt('#td-err');
  check('server 400 shown inline, naming the bad id', /#999/.test(vErr) && /no task/.test(vErr), vErr);
  check('Depends on field marked invalid and focused', await page.evaluate(() => document.getElementById('td-deps').getAttribute('aria-invalid') === 'true' && document.activeElement.id === 'td-deps'));
  check('dialog stays open with the input kept', !!(await page.$('#task-dlg[open]')) && (await page.$eval('#td-name', (e) => e.value)) === 'Depends on a deleted task');
  await page.screenshot({ path: `${out}/validation-dark.png` });
  await page.click('#td-drop').catch(() => {});
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const d = document.getElementById('task-dlg'); if (d.open) d.close(); });
  check('invalid task was not created', !(await human('/state')).tasks.some((t) => t.title === 'Depends on a deleted task'));

  // ---- 5b. idle agents, nothing to claim: What to do now suggests more tasks ----
  for (const id of [T[3].id, T[5].id, created.id]) await human(`/tasks/${id}`, 'PATCH', { status: 'done' });
  await page.waitForFunction(() => /idle/.test(document.getElementById('now').innerText), { timeout: 5000 }).catch(() => {});
  const now = await txt('#now');
  check('What to do now: agents idle, add tasks or ask the planner', /1 agent is idle: add tasks or ask the planner for more/.test(now), now);
  check('team capacity flags the idle agent (amber, said in its tooltip)', await until(() => /1 agent idle, 0 ready to claim/.test(document.getElementById('o-right-sub').title) && document.getElementById('o-right-sub').classList.contains('low')), JSON.stringify(await capSub()));
  await page.click('#now [data-go="idle"]');
  const draft = await page.$eval('#msg', (e) => e.value);
  check('suggestion drafts a message to the planner (not sent)', /^@ana .*idle.*add more tasks/.test(draft) && !(await human('/state')).events.some((e) => /add more tasks/.test(e.text)), draft);
  await page.$eval('#msg', (e) => { e.value = ''; });

  // ---- 4. stale at 15+ min; owner offline vs online ----
  await ageTask(board, T[2].id, 20); // cy's task
  await ageTask(board, T[0].id, 20); // ana's task
  await setLastSeen('cy', 30);
  await human('/messages', 'POST', { text: 'checking on stale tasks' }); // nudges the page to reload
  await page.waitForSelector(`[data-release="${T[2].id}"]`, { timeout: 5000 });
  const off = await cardTxt(T[2].id);
  check('stale (20 min) card shows Release + owner offline', /Release to Open/.test(off) && /owner offline — agents may take it over/.test(off), off);
  const on = await cardTxt(T[0].id);
  check('stale card of an online owner says ping first', /Release to Open/.test(on) && /still online: ping it first/.test(on) && !/owner offline/.test(on), on);
  // Stale tasks live on their cards (one home per fact), no longer in the header.
  check('both stale tasks flagged on the board', await page.$$eval('#board .card.stale', (c) => c.length) === 2);
  await openCard(T[2].id);
  check('dialog meta: stale + owner offline', /owner offline/.test(await txt('#td-meta')), await txt('#td-meta'));
  await page.keyboard.press('Escape');
  await sleep(200);

  // ---- 6. freeze mentions priority-1 bug fixes ----
  await human('/settings', 'PUT', { deadline: Date.now() + 30 * 60e3, freeze_minutes: 60 });
  // No freeze banner any more: the Open column says what can still start, and dims the rest.
  await page.waitForFunction(() => /Feature freeze/.test(document.querySelector('#col-open .cd')?.textContent || ''), { timeout: 5000 });
  check('freeze: the Open column says priority-1 bug fixes can still be claimed', /Priority-1 tasks \(bug fixes\) can still be claimed/.test(await txt('#col-open .cd')), await txt('#col-open .cd'));
  check('freeze: no banner above the board', await page.$eval('#board-note', (n) => n.hidden));
  check('freeze What to do now mentions P1', /P1 bug fixes can still be claimed/.test(await txt('#now')), await txt('#now'));

  // ---- empty answer: inline error, nothing sent ----
  await ana('ask_human', { question: 'Should votes be anonymous?' });
  await page.waitForSelector('#questions textarea');
  const qid = await page.$eval('#questions form', (f) => f.dataset.qform);
  await page.type(`#qa-${qid}`, '   ');
  await page.click(`[data-fk="qb-${qid}"]`);
  await until((id) => /Type an answer first/.test(document.getElementById(`qe-${id}`)?.innerText || ''), qid);
  check('empty answer: inline error under the question', /Type an answer first/.test(await txt(`#qe-${qid}`)) && await page.$eval(`#qa-${qid}`, (e) => e.getAttribute('aria-invalid') === 'true'));
  check('empty answer not sent', !(await human('/state')).questions.find((q) => q.id === Number(qid)).answer);
  await page.type(`#qa-${qid}`, 'Yes');
  check('typing clears the inline error', !(await txt(`#qe-${qid}`)));

  // ---- screenshots: desktop dark + light, 390px; expanded rows show capacity per agent ----
  await human('/settings', 'PUT', { deadline: '' });
  await page.click('#people [data-o-agent="cy"]');
  await until(() => /1 of 1 at once/.test(document.getElementById('o-det')?.innerText || ''));
  check('selected agent: tool, plan and "x of y at once"', /Codex · ChatGPT Edu · 1 of 1 at once/.test(await txt('#o-det')), await txt('#people'));
  await page.screenshot({ path: `${out}/desktop-dark.png`, fullPage: true });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await sleep(200);
  await page.screenshot({ path: `${out}/desktop-light.png`, fullPage: true });
  await openCard(T[1].id);
  await page.screenshot({ path: `${out}/dialog-light.png` });
  await page.keyboard.press('Escape');
  await page.setViewport({ width: 390, height: 844 });
  await sleep(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('390px: no horizontal overflow', overflow <= 0, overflow + 'px');
  await page.screenshot({ path: `${out}/mobile-light.png`, fullPage: true });
  await openCard(T[1].id);
  const dlgFit = await page.evaluate(() => { const r = document.getElementById('task-dlg').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
  check('390px: task dialog fits', dlgFit);
  await page.screenshot({ path: `${out}/mobile-dialog.png` });
  await page.keyboard.press('Escape');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await sleep(200);
  await page.screenshot({ path: `${out}/mobile-dark.png`, fullPage: true });
} catch (e) { results.push('CRASH ' + e.stack); }
check('no page/console errors or native dialogs', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
