// The Activity panel's Direct tab, in the Board view and the 3D view: the thread list (the planner's thread pinned
// first), an agent's Message button opening its thread, sending, the agent's reply with an unread count, drafts kept
// apart from the shared chat, the planner thread before and after there is a planner, and every theme's contrast.
// Acts as human "dana". Starts its own throwaway board. Run all suites with: npm test
import { startBoard, launchBrowser, shotsDir, finish, agent, rest as restOf, openLink } from '../helpers.mjs';
import { scanText } from '../fixtures/scan-text.mjs';

const board = await startBoard();
const out = shotsDir('direct');
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra && !ok ? ' — ' + String(extra).slice(0, 300) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rest = (who, p, method, body) => restOf(board, who, p, method, body);

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 900 }, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && !/WebGL|GPU stall|swiftshader/i.test(m.text()) && errors.push('console: ' + m.text()));
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const until = (fn, arg, timeout = 6000) => page.waitForFunction(fn, { timeout, polling: 100 }, arg).then(() => true).catch(() => false);
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });

try {
  await rest('dana', '/settings', 'PUT', { goal: 'A voting app for the team showcase.' });
  const maya = await agent(board, 'maya-claude'); await maya('board_status');
  const emil = await agent(board, 'emil-codex', 'codex-mcp-client'); await emil('board_status');
  await rest('dana', '/messages', 'POST', { text: 'Morning all, shared chat here.' });

  await openLink(page, `${board.base}/?token=${board.token}&name=dana`);
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });

  // ---- the tab and the thread list ----
  const tabs = await page.$$eval('#tabs button', (l) => l.map((b) => b.dataset.tab));
  check('Activity has a Direct tab after the others', tabs.join() === 'all,chat,me,direct', tabs.join());
  // A draft in the shared chat stays there.
  await page.click('#msg'); await page.type('#msg', 'chat draft');
  await page.click('[data-tab="direct"]');
  await until(() => !!document.querySelector('#feed .dmlist'));
  const list = await page.$$eval('#feed .dmrow', (l) => l.map((b) => b.dataset.dm));
  check('the list: the planner thread pinned first, then every agent', list[0] === 'planner' && list.includes('maya-claude') && list.includes('emil-codex'), list.join());
  check('with nobody planning, the planner row says so', /no planner yet/.test(await page.$eval('#feed [data-dm="planner"]', (b) => b.innerText)));
  check('the list has no message box (pick a thread first)', await page.evaluate(() => $('composer').hidden && $('dmbar').hidden));
  await shot('1-list');

  // ---- an agent's Message button opens its thread ----
  await page.click('[data-tab="all"]');
  check('back in the shared chat, its draft is still there', (await page.$eval('#msg', (m) => m.value)) === 'chat draft');
  await page.click('[data-o-agent="maya-claude"]');
  await until(() => !!document.querySelector('.o-det [data-dm="maya-claude"]'));
  await page.click('.o-det [data-dm="maya-claude"]');
  check('Message maya-claude opens its thread, focus in the message box', await until(() => ui.tab === 'direct' && ui.dm === 'maya-claude' && document.activeElement === $('msg') && !$('dmbar').hidden));
  check('the thread\'s message box is empty (the chat draft didn\'t follow) and says who it goes to', await page.evaluate(() => $('msg').value === '' && $('msg').placeholder === 'Message maya-claude' && /Goes to maya-claude only\. Other agents don't see it; everyone on this page does/.test($('dm-hint').textContent) && $('chat-hint').hidden && $('chan').offsetParent === null));
  check('the bar above says only people on this board and the agent see it', /maya-claude\s*only people on this board and maya-claude see this/.test(await page.$eval('#dmbar', (b) => b.innerText)));
  await page.type('#msg', 'Keep the login page simple, please.');
  await page.keyboard.press('Enter');
  check('sending puts it in the thread', await until(() => [...document.querySelectorAll('#feed .ev')].some((e) => /Keep the login page simple/.test(e.innerText))));
  let st = await rest('dana', '/state');
  const sent = (st.direct || []).find((e) => /Keep the login page simple/.test(e.text));
  check('…as a direct message to maya-claude, not in the shared feed', sent?.data?.dm?.thread === 'maya-claude' && sent.data.dm.from === 'human' && !st.events.some((e) => /Keep the login page simple/.test(e.text)), JSON.stringify(sent));
  const na = await maya('board_status');
  check('the agent\'s next_action points at it', /messaged you directly.*Keep the login page simple/.test(na.next_action), na.next_action);
  check('the other agent never sees it', !(await emil('read_events', { since: 0, limit: 500 })).events.some((e) => e.channel === 'direct'));
  await page.click('[data-tab="all"]');
  check('the All tab doesn\'t show it', await until(() => ui.tab === 'all' && ![...document.querySelectorAll('#feed .ev')].some((e) => /Keep the login page simple/.test(e.innerText)) && $('msg').value === 'chat draft'));

  // ---- the reply, unread, read ----
  await maya('post', { to: 'dana', text: 'Will do: one form, no social buttons.' });
  check('a reply shows an unread count on the Direct tab', await until(() => $('tabs').querySelector('[data-tab="direct"]').getAttribute('aria-label') === 'Direct, 1 unread' && /Direct\s*1/.test($('tabs').querySelector('[data-tab="direct"]').innerText)));
  await page.click('[data-tab="direct"]');
  await until(() => !!document.querySelector('#feed .dmlist'));
  const row = await page.$eval('#feed [data-dm="maya-claude"]', (b) => ({ t: b.innerText, cls: b.className, label: b.getAttribute('aria-label') }));
  check('maya\'s row: the latest message, its unread count, first after the planner', /maya-claude: Will do: one form/.test(row.t) && /unread/.test(row.cls) && /1 unread/.test(row.label) && (await page.$$eval('#feed .dmrow', (l) => l.map((b) => b.dataset.dm)))[1] === 'maya-claude', JSON.stringify(row));
  await shot('2-unread');
  await page.click('#feed [data-dm="maya-claude"]');
  check('opening the thread shows both messages, oldest first', await until(() => { const t = [...document.querySelectorAll('#feed .ev')].map((e) => e.innerText).join('|'); return /Keep the login page simple.*\|.*Will do: one form/s.test(t); }));
  check('…and clears the unread count', await until(() => $('tabs').querySelector('[data-tab="direct"]').getAttribute('aria-label') === 'Direct'));
  await shot('3-thread');
  await page.click('[data-dm-back]');
  check('← Threads goes back to the list, focus on that thread\'s row', await until(() => !!document.querySelector('#feed .dmlist') && document.activeElement?.dataset.dm === 'maya-claude' && !ui.dm));

  // ---- the planner thread ----
  await page.click('#feed [data-dm="planner"]');
  check('the planner thread with nobody planning: messages wait for one', await until(() => /waits for a planner/.test($('dmbar').innerText) && /Waits for the first agent that becomes planner/.test($('dm-hint').textContent)));
  await page.type('#msg', 'Show the leaderboard first in the demo.');
  await page.keyboard.press('Enter');
  await until(() => [...document.querySelectorAll('#feed .ev')].some((e) => /leaderboard first/.test(e.innerText)));
  await emil('claim_role', { role: 'planner' });
  check('when an agent becomes planner, the thread says so and goes to it', await until(() => /to emil-codex/.test($('dmbar').innerText) && [...document.querySelectorAll('#feed .ev.sys')].some((e) => /emil-codex is the planner now and has 1 message waiting/.test(e.innerText))));
  check('the new planner\'s next_action has it', /In the planner thread.*leaderboard first/.test((await emil('board_status')).next_action));
  await emil('post', { to: 'dana', text: 'Leaderboard first: moved it to priority 1.' });
  check('the planner\'s reply lands in the planner thread', await until(() => [...document.querySelectorAll('#feed .ev')].some((e) => /moved it to priority 1/.test(e.innerText))));
  await shot('4-planner');

  // ---- a reply while Activity is folded stays unread until the thread is on screen ----
  check('(the planner thread is open and read)', await until(() => ui.dm === 'planner' && $('tabs').querySelector('[data-tab="direct"]').getAttribute('aria-label') === 'Direct'));
  await page.click('[data-o-fold="act"]');
  await until(() => !$('feed').getBoundingClientRect().height);
  await emil('post', { to: 'dana', text: 'A reply while Activity is folded.' });
  check('a reply in the open thread while Activity is folded counts as unread', await until(() => $('tabs').querySelector('[data-tab="direct"]').getAttribute('aria-label') === 'Direct, 1 unread'));
  await sleep(800);
  check('…and stays unread (nothing on screen shows it)', await page.evaluate(() => $('tabs').querySelector('[data-tab="direct"]').getAttribute('aria-label') === 'Direct, 1 unread'));
  await page.click('[data-o-fold="act"]');
  check('unfolded, the thread is on screen and the reply is read', await until(() => $('tabs').querySelector('[data-tab="direct"]').getAttribute('aria-label') === 'Direct'));

  // ---- the ways to the chat ("/", the phone's chat icon) open the shared chat, not the thread ----
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('/');
  check('"/" from an open thread opens the shared chat\'s message box (its draft there)', await until(() => ui.tab === 'all' && !$('composer').hidden && document.activeElement === $('msg') && $('msg').placeholder === 'Message, @ to mention' && $('msg').value === 'chat draft'));
  await page.click('[data-tab="direct"]'); await until(() => !!document.querySelector('#feed .dmlist'));
  await page.evaluate(() => $('tochat').click());
  check('the chat icon from the thread list opens the shared chat too', await until(() => ui.tab === 'all' && !$('composer').hidden && document.activeElement === $('msg')));
  await page.click('[data-tab="direct"]'); await until(() => !!document.querySelector('#feed .dmlist'));
  await page.click('#feed [data-dm="planner"]'); await until(() => ui.dm === 'planner' && [...document.querySelectorAll('#feed .ev')].some((e) => /moved it to priority 1/.test(e.innerText)));

  // ---- names in the feed still @mention in the shared chat ----
  await page.$eval('#feed .ev.chat [data-mention="emil-codex"]', (b) => b.click());
  check('clicking a name in a thread @mentions it in the shared chat (never in the thread)', await until(() => ui.tab === 'all' && /@emil-codex/.test($('msg').value)));
  await page.$eval('#msg', (m) => { m.value = ''; });

  // ---- every theme: contrast of the list and of a thread ----
  const themes = await page.evaluate(() => Object.keys(window.THEMES));
  await page.click('[data-tab="direct"]'); await until(() => !!document.querySelector('#feed .dmlist'));
  const bad = [];
  for (const t of themes) {
    await page.evaluate((x) => setTheme(x), t); await sleep(120);
    await page.evaluate(() => { ui.dm = null; $('feed')._html = undefined; render(); }); await sleep(60);
    const a = await page.evaluate(scanText);
    await page.evaluate(() => { ui.dm = 'maya-claude'; $('feed')._html = undefined; render(); }); await sleep(60);
    const b = await page.evaluate(scanText);
    if (a.fails.length || b.fails.length) bad.push(`${t}: ${[...a.fails, ...b.fails].slice(0, 3).join(' | ')}`);
  }
  check(`every theme (${themes.length}): the thread list and a thread pass 4.5:1`, !bad.length, bad.join(' || '));
  await page.evaluate(() => setTheme('auto'));

  // ---- the 3D view: the same panel ----
  await page.click('#o3d');
  const office = await until(() => document.documentElement.dataset.boardView === 'office', null, 10000);
  if (!office) {
    // CI has software WebGL (SwiftShader): there the 3D view must open, so a broken office bundle fails instead of skipping.
    check('no 3D view in this browser (no WebGL): its checks are skipped', !process.env.CI, 'CI must run them');
    console.log('NOTE direct: the 3D view did not open (no WebGL?), so its checks were skipped');
  } else {
    check('3D view: the Direct tab and the open thread are still there', await until(() => ui.tab === 'direct' && $('o-act').contains($('dmbar')) && !$('dmbar').hidden && $('dmbar').offsetParent !== null));
    await page.click('[data-dm-back]');
    await until(() => !!document.querySelector('#feed .dmlist'));
    await page.click('[data-o-agent="emil-codex"]');
    await until(() => !!document.querySelector('.o-det [data-dm="emil-codex"]'));
    await page.click('.o-det [data-dm="emil-codex"]');
    check('3D view: an agent\'s Message button opens its thread', await until(() => ui.dm === 'emil-codex' && document.activeElement === $('msg') && document.documentElement.dataset.boardView === 'office'));
    await page.type('#msg', 'Hello from the 3D view.');
    await page.keyboard.press('Enter');
    check('3D view: sending works', await until(() => [...document.querySelectorAll('#feed .ev')].some((e) => /Hello from the 3D view/.test(e.innerText))));
    st = await rest('dana', '/state');
    check('…to emil-codex\'s thread', (st.direct || []).some((e) => /Hello from the 3D view/.test(e.text) && e.data?.dm?.thread === 'emil-codex'));
    await shot('5-office');
  }
  check('no page errors', !errors.length, errors.join(' | '));
} catch (e) {
  results.push('CRASH ' + (e.stack || e.message));
  try { await shot('crash'); } catch {}
}
await finish(results, { browser, board });
