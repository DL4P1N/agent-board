// Full newcomer journey from an EMPTY board.
// Starts its own throwaway board. Run all suites with: npm test
import { startBoard, launchBrowser, shotsDir, finish, seed, Client, StreamableHTTPClientTransport } from '../helpers.mjs';
const board = await startBoard();
const BASE = board.base;
const out = shotsDir('journey');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function agent(name) {
  const c = new Client({ name: 'claude-code', version: '1.0.0' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), { requestInit: { headers: { Authorization: 'Bearer testtok', 'X-Agent': name } } }));
  return async (tool, args = {}) => { const r = await c.callTool({ name: tool, arguments: args }); const t = r.content[0].text; if (r.isError) console.log('ERR', name, tool, t); try { return JSON.parse(t); } catch { return t; } };
}
const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 1000 } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
page.on('dialog', (d) => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
const now = () => page.$eval('#now', (e) => e.innerText.replace(/\s+/g, ' '));
// Waits (up to 5s) until the page shows what a live update brings, instead of a fixed sleep.
const until = (fn, arg) => page.waitForFunction(fn, { timeout: 5000, polling: 100 }, arg).then(() => true).catch(() => false);
const nowSays = (re) => until((src) => new RegExp(src).test(document.getElementById('now').innerText.replace(/\s+/g, ' ')), re.source);
const reload = () => page.evaluate(() => load());
async function shots(name, { light = true, mobile = false } = {}) {
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(250);
  await page.screenshot({ path: `${out}/j-${name}-dark.png` });
  if (light) { await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]); await sleep(150); await page.screenshot({ path: `${out}/j-${name}-light.png` }); }
  if (mobile) {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await sleep(300);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${name} mobile: no horizontal overflow`, ov <= 0, ov + 'px');
    await page.screenshot({ path: `${out}/j-${name}-mobile.png`, fullPage: true });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]); await sleep(150);
    await page.screenshot({ path: `${out}/j-${name}-mobile-dark.png`, fullPage: true });
    await page.setViewport({ width: 1440, height: 1000 }); await sleep(200);
  }
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
}

try {
  await page.goto(`${BASE}/`); await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/?token=testtok`);
  await page.waitForSelector('#gate:not([hidden])');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.screenshot({ path: `${out}/j-0-gate.png` });
  await page.type('#g-name', 'dana'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 5000 });
  await sleep(400);
  check('U6 empty: while Setup shows step 1, Needs attention adds nothing of its own (no lead, no "Write the goal")', !/Connect your first laptop/.test(await now()) && !/Write the goal/.test(await now()) && /Setup shows what's next/.test(await now()), await now());
  check('empty: setup guide expanded with join cmd', await page.evaluate(() => /npm run join -- --url/.test(document.getElementById('setup').innerText)));
  check('empty: board banner', await page.$eval('#board-empty', (e) => !e.hidden && /No tasks yet/.test(e.innerText)));
  // Nobody connected yet: the phase track leads with Connect, matching the what-to-do line.
  check('phase = Connect', await page.$eval('.phases .cur', (e) => e.textContent) === 'Connect');
  await shots('1-empty', { mobile: true });

  // copy button (http localhost is secure context; just check toast)
  await page.click('[data-fk="cp-join"]'); await sleep(200);
  check('copy gives feedback', /Copied|copy/.test(await page.$eval('#toasts', (e) => e.innerText)));

  // agent connects (no event) -> reload
  const alice = await agent('alice');
  await alice('board_status');
  await reload(); await sleep(200);
  check('alice shows as connected agent', await page.evaluate(() => /1 laptop connected/.test(document.getElementById('step-invite').innerText) && /1 agent started/.test(document.getElementById('step-start').innerText)));
  check('next: write goal (in Setup, step 2, which is open; Needs attention has no lead)', /Setup shows what's next/.test(await now()) && await page.evaluate(() => !!document.getElementById('goal-in')?.offsetWidth), await now());
  await page.click('#goal-in'); await sleep(200);
  check('the goal box takes focus', await page.evaluate(() => document.activeElement?.id === 'goal-in'));

  await page.type('#goal-in', 'A voting app for hackathon projects. Demo: submit, vote, live leaderboard.');
  // SSE mid-typing must not wipe it
  await alice('post', { text: 'hello from alice' });
  await until(() => /hello from alice/.test(document.getElementById('feed').innerText));
  check('goal typing survives SSE', await page.evaluate(() => document.getElementById('goal-in')?.value.startsWith('A voting app') && document.activeElement?.id === 'goal-in'));
  await shots('2-goal-typing', { light: false });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('.phases .past')].some((e) => /Set the goal/.test(e.textContent)), { timeout: 5000 });
  check('goal saved; phase Write tasks', await page.$eval('.phases .cur', (e) => e.textContent) === 'Write tasks');

  // planner claims
  await alice('claim_role', { role: 'planner' });
  await nowSays(/alice \(Claude Code\) is writing/);
  check('board banner names planner (its agent name, not "alice\'s agent")', /alice \(Claude Code\), the planner/.test(await page.$eval('#board-empty', (e) => e.innerText)));
  check('do-now: nothing to do, alice writing', /alice \(Claude Code\) is writing/.test(await now()), await now());
  await shots('3-planning', { mobile: true });

  // tasks created
  const t1 = await alice('create_task', { title: 'Project scaffolding', priority: 1 });
  const t2 = await alice('create_task', { title: 'Voting API', depends_on: [t1.id] });
  const t3 = await alice('create_task', { title: 'Leaderboard page' });
  const t4 = await alice('create_task', { title: 'Submission form' });
  await until((id) => !!document.querySelector(`.card[data-id="${id}"]`) && document.getElementById('setup').hidden, t4.id);
  check('setup collapsed: the guide hides, the top bar stays', await page.evaluate(() => $('setup').hidden && /Goal/i.test($('goal-btn')?.innerText) && !!$('topbar').querySelector('[data-act="setup-open"]')));
  check('phase Build', await page.$eval('.phases .cur', (e) => e.textContent) === 'Build');
  check('column descriptions', await page.$eval('#col-review .cd', (e) => /merged into main/.test(e.textContent)));
  await shots('4-tasks', { light: false });

  // building: bob joins, work happens
  const bob = await agent('bob');
  await alice('claim_task', { id: t1.id, as: 'setup' }); await alice('update_task', { id: t1.id, status: 'review', note: 'pushed', as: 'setup' });
  await bob('claim_task', { id: t3.id, as: 'ui-worker' }); await bob('update_task', { id: t3.id, status: 'blocked', note: 'need design decision: dark theme?', as: 'ui-worker' });
  await bob('claim_task', { id: t4.id }); await bob('update_task', { id: t4.id, status: 'in_progress' });
  await bob('ask_human', { question: 'Should votes be anonymous?', task_id: t3.id, as: 'ui-worker' });
  await nowSays(/Answer 1 question/);
  // Ranked by how many agents each blocks (WB-3): picking who merges leads, the question follows under "Also".
  check('do-now: pick integrator leads, answer question under Also', /^Pick who merges/.test(await page.$eval('#now .na', (e) => e.textContent)) && /Answer 1 question/.test(await page.$eval('#nyou .also', (e) => e.textContent)), await now());
  await shots('5-building', { mobile: true });
  await page.click('#nyou .also [data-go="questions"]'); await sleep(300);
  check('do-now jumps to answer box', await page.evaluate(() => document.activeElement?.matches('.qcard textarea')));
  await page.keyboard.type('Yes, anonymous'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !/Answer 1 question/.test(document.getElementById('nyou').innerText), { timeout: 5000 });
  check('do-now: pick integrator', /Pick who merges/.test(await now()), await now());
  await sleep(800); await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
  await page.click('#now [data-go]'); await sleep(400);
  check('integrator step opened, select focused', await page.evaluate(() => document.activeElement?.id === 'integ-sel'));
  await shots('6-pick-integrator', { light: false });
  await page.select('#integ-sel', 'alice');
  await page.waitForFunction(() => !/Pick who merges/.test(document.getElementById('now').innerText), { timeout: 5000 });
  check('integrator saved; do-now shows blocked', /blocked/.test(await page.$eval('#now .na', (e) => e.textContent)), await now());
  check('the planner and who merges are tags on their agent rows', await page.evaluate(() => { const t = [...document.querySelectorAll('#people .o-agent .o-rl')].map((e) => e.textContent); return t.includes('planner') && t.includes('merges'); }));
  await bob('update_task', { id: t3.id, status: 'in_progress', as: 'ui-worker' }); await nowSays(/All good/);
  check('all good message', /All good/.test(await now()), await now());
  // help dialog via ?
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('?'); await sleep(200);
  check('? opens glossary', await page.evaluate(() => document.getElementById('help-dlg').open));
  await page.screenshot({ path: `${out}/j-7-help.png` });
  await page.keyboard.press('Escape'); await sleep(150);
  // reopen setup from summary
  await page.click('[data-act="setup-close"]'); await sleep(200);
  check('Hide collapses to the top bar', await page.evaluate(() => $('setup').hidden && !!$('topbar').querySelector('[data-act="setup-open"]')));
  await page.click('[data-act="setup-open"]'); await sleep(200);
  check('Setup button reopens guide', await page.evaluate(() => !!document.querySelector('#setup .steps')));
  await shots('7-all-good-setup-open', { light: false });
  await page.click('[data-act="setup-close"]'); await sleep(200);

  // all done
  for (const t of [t1, t2, t3, t4]) await fetch(`${BASE}/api/tasks/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer testtok', 'X-Agent': 'alice' }, body: JSON.stringify({ status: 'done' }) });
  await nowSays(/Every task is done/);
  check('phase Done', await page.$eval('.phases .cur', (e) => e.textContent) === 'Done', await page.$eval('.phases .cur', (e) => e.textContent));
  check('do-now: every task done', /Every task is done/.test(await now()), await now());
  await shots('8-done', { light: true });
} catch (e) { results.push('CRASH ' + e.stack); }
check('no page/console errors or native dialogs', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
