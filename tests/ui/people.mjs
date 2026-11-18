// The Agents panel: stable person colours, one row per agent by its own name, its state in words, the "Belongs to" list,
// and availability in the Reserve-for and Assign-to lists.
// Starts its own throwaway board. Run all suites with: npm test
import path from 'node:path';
import { startBoard, launchBrowser, shotsDir, finish, rest, Client, StreamableHTTPClientTransport } from '../helpers.mjs';

const board = await startBoard();
const out = shotsDir('people');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const human = (p, method = 'GET', body) => rest(board, 'hostp', p, method, body);

async function agent(name, { client = 'claude-code', plan } = {}) {
  const q = new URLSearchParams({ agent: name, token: board.token, ...(plan ? { plan } : {}) });
  const c = new Client({ name: client, version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${board.base}/mcp?${q}`)));
  const call = async (tool, args = {}) => { const r = await c.callTool({ name: tool, arguments: args }); try { return JSON.parse(r.content[0].text); } catch { return r.content[0].text; } };
  await call('board_status');
  return call;
}
async function setLastSeen(name, minutesAgo) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path.join(board.dataDir, 'board.db'));
  db.prepare("UPDATE presence_v2 SET last_seen=? WHERE name=? AND kind='agent'").run(Date.now() - minutesAgo * 60e3, name);
  db.close();
}

const browser = await launchBrowser({ defaultViewport: { width: 1440, height: 1000 } });
const errors = [];
let page;
const txt = (sel) => page.$eval(sel, (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
const hueOf = (n) => page.$eval(`#people [data-person-row="${n}"]`, (e) => e.style.getPropertyValue('--h').trim()).catch(() => '');
const row = (n) => txt(`#people [data-person-row="${n}"]`);
try {
  page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('board-token', t); localStorage.setItem('board-name', 'hostp'); } catch {} }, board.token);
  await page.goto(board.base + '/');
  await page.waitForSelector('#people'); // hostp has no agent yet, so no row of its own
  await sleep(400);

  // ---- WB-7: a person's colour doesn't change when others join ----
  const before = await page.evaluate(() => String(hue('hostp')));
  check('no colour legend: an agent\'s state is a word in its row (Agents, both views)', !(await page.$('#p-legend')));
  const carol = await agent('carol-codex', { client: 'codex-mcp-client' });
  const dave = await agent('dave', { client: 'omp-agent' });
  await agent('bob-codex', { client: 'codex-mcp-client', plan: 'ChatGPT Plus' });
  await agent('emil-claude');
  await agent('emil-claude2');
  for (const n of ['ana', 'ben', 'cleo', 'aaron']) await agent(n);
  await rest(board, 'ghosty', '/messages', 'POST', { text: 'hello' }); // a name typed once on the page
  await page.waitForFunction(() => new Set([...document.querySelectorAll('#people [data-person-row]')].map((e) => e.dataset.personRow)).size >= 8, { timeout: 8000 });
  await sleep(300);
  const after = await page.evaluate(() => String(hue('hostp')));
  check('hostp keeps its colour when 8 more people join', before !== '' && before === after, `${before} → ${after}`);
  check('the colour comes from the name alone', Number(after) === (await page.evaluate(() => HUES[nameHash('hostp') % HUES.length])), after);
  check('every hue in the palette is at least 20° from the next', await page.evaluate(() => HUES.every((h, i) => i === 0 || h - HUES[i - 1] >= 20)));
  const pv = await browser.newPage();
  await pv.evaluateOnNewDocument((t) => { try { localStorage.setItem('board-token', t); } catch {} }, board.token);
  await pv.goto(board.base + '/present-classic.html');
  await sleep(500);
  const pres = await pv.evaluate(() => (typeof hue === 'function' ? ['hostp', 'emil-claude', 'ana'].map((n) => hue(n)) : null)).catch(() => null);
  const main = await page.evaluate(() => ['hostp', 'emil-claude', 'ana'].map((n) => hue(n)));
  check('presenter view uses the same colours', JSON.stringify(pres) === JSON.stringify(main), `${JSON.stringify(pres)} vs ${JSON.stringify(main)}`);
  await pv.close();

  // ---- WB-8: a second cue besides colour ----
  check('besides its colour, each row names its agent first (Agents: one line per agent)', /^emil-claude/.test(await row('emil')), (await row('emil')).slice(0, 20));
  check('the tool dot is not read out', await page.$eval('#people [data-person-row="emil"] .tdot', (e) => e.getAttribute('aria-hidden') === 'true').catch(() => false));

  // ---- WB-9: an agent grouped under someone else keeps its name in the pill ----
  await human('/agents/dave', 'PATCH', { person: 'carol' });
  await page.waitForFunction(() => !!document.querySelector('#people [data-person-row="carol"] [data-o-agent="dave"]'), { timeout: 5000 }).catch(() => {});
  const carolRow = await row('carol');
  check('carol\'s agents list dave by its own name', await page.evaluate(() => !!document.querySelector('#people [data-person-row="carol"] [data-o-agent="dave"] .o-an')?.textContent.startsWith('dave')), carolRow);

  // ---- WB-10: two agents with the same tool ----
  const emilRow = await row('emil');
  // One row per agent, by its own name (the tool is its dot and the second line).
  check('emil\'s two Claude Code agents are told apart', await page.evaluate(() => [...document.querySelectorAll('#people [data-person-row="emil"] .o-agent')].map((b) => b.dataset.oAgent).join() === 'emil-claude,emil-claude2'), emilRow);

  // ---- WB-12: pill legend ----
  check('every agent row says its state in words', await page.evaluate(() => [...document.querySelectorAll('#people .o-agent')].every((b) => /\w/.test(b.querySelector('.o-st')?.textContent || ''))));

  // ---- WB-11: expanded row copy and the Belongs-to list ----
  await page.click('#people [data-o-agent="dave"]');
  await page.waitForSelector('#o-det');
  const det = await txt('#o-det');
  check('no "@" before agent names in the detail', !/@main agent|@dave/.test(det), det.slice(0, 120));
  check('detail names dave by its own name', /\bdave · omp-agent|\bdave\b/.test(det), det.slice(0, 120));
  check('ghosty is a known name (so the next check means something)', await page.evaluate(() => knownPeople().includes('ghosty')));
  const ppl = await page.$$eval('#pb-dave option', (os) => os.map((o) => o.value));
  check('Belongs to lists People-panel people only, not a name typed once', !ppl.includes('ghosty') && ppl.includes('carol') && ppl.includes('emil'), JSON.stringify(ppl));

  // ---- WB-18: availability in Reserve for / Assign to ----
  await human('/agents/bob-codex', 'PATCH', { limited: true, until: Date.now() + 2 * 3600e3 });
  await setLastSeen('emil-claude2', 30);
  const t = await carol('create_task', { title: 'Availability check' });
  await human('/messages', 'POST', { text: 'refresh' });
  await page.waitForSelector(`.card[data-id="${t.id}"]`);
  await sleep(400);
  await page.click(`.card[data-id="${t.id}"] .ct`);
  await page.waitForSelector('#task-dlg[open]');
  const res = await page.$$eval('#td-res option', (os) => os.map((o) => o.textContent));
  const bobOpt = res.find((o) => o.startsWith('bob-codex')) || '';
  const eOpt = res.find((o) => o.startsWith('emil-claude2')) || '';
  check('reserve list: out-of-usage agent says so, with its time', /out of usage · back at \d/.test(bobOpt), bobOpt);
  check('reserve list: offline agent says offline', / · offline$/.test(eOpt), eOpt);
  const idx = (p) => res.findIndex((o) => o.startsWith(p));
  check('reserve list: available agents first', idx('ana') > 0 && idx('ana') < idx('bob-codex') && idx('dave') < idx('bob-codex') && idx('bob-codex') < idx('emil-claude2'), JSON.stringify(res));
  const asg = await page.$$eval('#td-asg option', (os) => os.map((o) => o.textContent));
  check('assign list: same availability and order', /out of usage/.test(asg.find((o) => o.startsWith('bob-codex')) || '') && asg.findIndex((o) => o.startsWith('ana')) < asg.findIndex((o) => o.startsWith('bob-codex')), JSON.stringify(asg));
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `${out}/people.png`, fullPage: true });
  void dave;
} catch (e) {
  check('suite ran without throwing', false, e.stack || e.message);
}
check('no page/console errors', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
