// Hostile text: an agent puts HTML, script tags, attribute breakouts and javascript: links into every field it
// controls (task title, description and notes, branch, PR link, chat and its channel, questions, activity, its
// tool and model, subagent names, lock paths and reasons, usage-limit notes, cancel reasons, the goal). Nothing
// may run and nothing may render as HTML: in the Board view (cards, task dialog, table), the 3D office view
// (with an agent card open), the classic presenter and the 3D presenter. Also checks the security headers.
// Run all suites with: npm test
import path from 'node:path';
import { startBoard, launchBrowser, shotsDir, finish, agent, rest } from '../helpers.mjs';

const board = await startBoard();
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);

// Every payload calls __xss(n) if it ever runs; the page defines __xss to record it.
const P = (n) => `<img src=x onerror=__xss(${n})></script><script>__xss(${n + 1})</script>"><svg onload=__xss(${n + 2})>' x-pwn='${n}" x-pwn="${n} javascript:__xss(${n + 3})`;
const SHORT = (n) => `<img src=x onerror=__xss(${n})>" x-pwn="${n}`; // fits 40-60 character fields
const MARK = '<img src=x onerror=__xss('; // must show up as text

const evil = await agent(board, 'evil-claude', SHORT(900)); // the MCP client name becomes its tool label
await evil('board_status', { model: SHORT(910) });
await evil('set_goal', { goal: `Build it ${P(10)}` });
await evil('claim_role', { role: 'planner' });
// Each agent may hold one task at a time without a plan, so a few agents share the work.
const evil2 = await agent(board, 'evil2-codex', 'codex-mcp-client'); await evil2('board_status');
const evil3 = await agent(board, 'evil3-codex', 'codex-mcp-client'); await evil3('board_status');
const t1 = await evil('create_task', { title: `Title ${P(20)}`, description: `Desc ${P(30)}\n[click](javascript:__xss(39)) https://example.com/"onmouseover="__xss(38)` });
const t2 = await evil('create_task', { title: `Second ${P(40)}` });
const t3 = await evil('create_task', { title: `Third ${P(50)}` });
const t4 = await evil('create_task', { title: `Fourth ${P(60)}` });
await evil('claim_task', { id: t1.id, as: SHORT(70) });
await evil('update_task', { id: t1.id, status: 'in_progress', note: `Note ${P(80)}`, branch: `task/${P(90)}`, as: SHORT(70) });
await evil('set_activity', { doing: `Doing ${P(100)}`, as: SHORT(70) });
await evil('lock_files', { paths: [`src/${SHORT(110)}.js`], task_id: t1.id, reason: `Reason ${P(120)}`, as: SHORT(70) });
await evil2('claim_task', { id: t2.id });
await evil2('update_task', { id: t2.id, status: 'review', note: `Review ${P(130)}`, pr_url: `https://github.com/o/r/pull/1"><img src=x onerror=__xss(140)>` });
await evil3('claim_task', { id: t3.id });
await evil3('update_task', { id: t3.id, status: 'blocked', note: `Blocked ${P(150)}` });
await evil('cancel_task', { id: t4.id, reason: `Cancel ${P(160)}` });
await evil('post', { text: `Chat ${P(170)} @dana`, channel: `general"><img src=x onerror=__xss(180)>` });
await evil('post', { text: `General ${P(190)}` });
await evil('ask_human', { question: `Question ${P(200)}`, task_id: t1.id });
const other = await agent(board, 'ivy-codex', 'codex-mcp-client');
await other('board_status');
await other('create_task', { title: `Proposal ${P(210)}`, description: P(220) });
await other('report_usage_limit', { note: `Limit ${P(230)}`, until: '23:59' });
await human('/messages', 'POST', { text: `Human ${P(240)}` });
await evil('release_role', { role: 'planner', note: `Release ${P(250)}` });
const VIEW = (await human('/state')).setup?.viewer_token;

// ---- headers: a CSP that blocks plugins, base-tag tricks, framing and stray connections ----
const res = await fetch(`${board.base}/`);
const csp = res.headers.get('content-security-policy') || '';
check('the web board is sent with a Content-Security-Policy', ["object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "connect-src 'self'", "form-action 'self'"].every((d) => csp.includes(d)) && !/script-src/.test(csp), csp);
check('and nosniff, no framing, no referrer leaking the token', res.headers.get('x-content-type-options') === 'nosniff' && res.headers.get('x-frame-options') === 'DENY' && res.headers.get('referrer-policy') === 'no-referrer', JSON.stringify([...res.headers]));
const apiRes = await fetch(`${board.base}/api/state`, { headers: { Authorization: `Bearer ${board.token}` } });
check('API answers carry the headers too', /frame-ancestors 'none'/.test(apiRes.headers.get('content-security-policy') || '') && apiRes.headers.get('x-content-type-options') === 'nosniff');

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 900 }, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = shotsDir('hostile');
const until = (page, fn, arg, timeout = 10000) => page.waitForFunction(fn, { timeout, polling: 100 }, arg).then(() => true).catch(() => false);

// Anything that ran, and anything in the page that came from a payload as HTML rather than text.
const scan = (page) => page.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    for (const a of el.attributes) {
      if (a.name === 'x-pwn') bad.push(`${tag}[x-pwn]`);
      else if (a.name.startsWith('on') && a.value.includes('__xss')) bad.push(`${tag}[${a.name}]`);
      else if (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(a.name) && /^\s*javascript:/i.test(a.value)) bad.push(`${tag}[${a.name}=javascript:]`);
      else if (a.name === 'src' && a.value === 'x') bad.push(`${tag}[src=x]`);
    }
    if (['script', 'style', 'iframe', 'svg'].includes(tag) && el.textContent.includes('__xss')) bad.push(`<${tag}> with payload`);
  }
  return { ran: window.__hits || [], bad: [...new Set(bad)] };
});
async function open(url, opts = {}) {
  const page = await (await browser.createBrowserContext()).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  page.on('dialog', (d) => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  await page.evaluateOnNewDocument((human) => {
    window.__hits = [];
    window.__xss = (n) => window.__hits.push(n);
    if (human) try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); localStorage.setItem('board-setup', 'closed'); } catch {}
  }, !!opts.human);
  await page.goto(board.base + url);
  return { page, errs };
}
const verdict = (name, r, errs) => {
  check(`${name}: no payload ran`, !r.ran.length, JSON.stringify(r.ran));
  check(`${name}: no payload became HTML (tags, attributes, javascript: links)`, !r.bad.length, r.bad.join(', '));
  const csp = errs.filter((e) => /Content Security Policy|Refused to/.test(e));
  check(`${name}: nothing blocked by the CSP`, !csp.length, csp.join(' | '));
};

try {
  // ---- Board view ----
  {
    const { page, errs } = await open('/', { human: true });
    await until(page, () => document.getElementById('conn')?.classList.contains('live'));
    await until(page, (m) => document.body.innerText.includes(m), MARK);
    const txt = await page.evaluate(() => document.body.innerText);
    check('Board: hostile titles, chat and questions show as plain text', txt.includes(`Title ${MARK}20)>`) && txt.includes(`Chat ${MARK}170)>`) && txt.includes('Question <img'), txt.slice(0, 300));
    verdict('Board', await scan(page), errs);
    // Every task's dialog: description, notes, branch, PR link, history.
    for (const t of [t1, t2, t3, t4]) {
      await page.evaluate((id) => openTask(id), t.id);
      await until(page, () => document.getElementById('task-dlg').open);
      await sleep(150);
      const r = await scan(page);
      if (r.ran.length || r.bad.length) { verdict(`Task dialog #${t.id}`, r, errs); break; }
      await page.keyboard.press('Escape');
      await sleep(100);
    }
    await page.evaluate((id) => openTask(id), t1.id);
    await until(page, () => document.getElementById('task-dlg').open);
    const dlg = await page.$eval('#task-dlg', (d) => [d.innerText, ...[...d.querySelectorAll('textarea, input')].map((x) => x.value)].join(' '));
    check('Task dialog: description, note and branch show as text', dlg.includes(`Desc ${MARK}30)>`) && dlg.includes('javascript:__xss(39)') && dlg.includes(`Note ${MARK}80)>`) && /task\/.*img/.test(dlg), dlg.slice(0, 600));
    await page.screenshot({ path: path.join(out, '01-board-dialog.png') });
    verdict('Task dialogs', await scan(page), errs);
    await page.keyboard.press('Escape');
    // The table view and the feed's other tabs render the same text differently.
    await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (/^Table$/.test(b.textContent.trim())) { b.click(); break; } });
    await sleep(200);
    for (const tab of ['Problems', 'Merges']) {
      await page.evaluate((t) => { for (const b of document.querySelectorAll('button, [role=tab]')) if (b.textContent.trim().startsWith(t)) { b.click(); break; } }, tab);
      await sleep(150);
    }
    await page.screenshot({ path: path.join(out, '02-board-table.png') });
    verdict('Table view and feed tabs', await scan(page), errs);
    check('Board: no page errors', !errs.filter((e) => !/Refused to/.test(e)).length, errs.join(' | '));
  }

  // ---- 3D office view ----
  {
    const { page, errs } = await open('/?view=office', { human: true });
    await until(page, () => document.getElementById('conn')?.classList.contains('live'));
    await until(page, () => { const v = document.getElementById('office-view'); return v && !v.classList.contains('loading') && v.querySelector('canvas'); }, null, 15000);
    const scene = await page.evaluate(() => (document.querySelector('#office-view canvas') ? 'WebGL' : 'no WebGL'));
    await sleep(600);
    await page.evaluate(() => document.querySelector('.o-agent')?.click());
    // Unfold the Tasks window, so its cards are drawn too.
    await page.evaluate(() => { for (const b of document.querySelectorAll('#office-view button, #office-view [role=button]')) if (/^Tasks\b/i.test(b.textContent.trim()) && b.getAttribute('aria-expanded') === 'false') { b.click(); break; } });
    await sleep(800);
    check('3D view: the Tasks window shows the hostile titles as text', await page.evaluate((m) => [...document.querySelectorAll('.o-card')].some((c) => c.textContent.includes(m)), MARK));
    await page.screenshot({ path: path.join(out, '03-office.png') });
    const txt = await page.evaluate(() => document.body.innerText);
    check(`3D view (scene: ${scene}): hostile text shows as text`, txt.includes(MARK), txt.slice(0, 200));
    verdict('3D view', await scan(page), errs);
    await page.evaluate((id) => openTask(id), t1.id);
    await sleep(300);
    verdict('3D view task dialog', await scan(page), errs);
  }

  // ---- presenters (viewer token) ----
  {
    const { page, errs } = await open(`/present-classic.html?token=${encodeURIComponent(VIEW)}`);
    await until(page, (m) => document.body.innerText.includes(m), MARK);
    await page.screenshot({ path: path.join(out, '04-present-classic.png') });
    check('Classic presenter: hostile text shows as text', (await page.evaluate(() => document.body.innerText)).includes(MARK));
    verdict('Classic presenter', await scan(page), errs);
  }
  {
    const { page, errs } = await open(`/present.html?token=${encodeURIComponent(VIEW)}`);
    await until(page, () => document.documentElement.dataset.scene || /present-classic/.test(location.pathname), null, 15000);
    await until(page, (m) => document.body.innerText.includes(m), MARK);
    await sleep(600);
    await page.screenshot({ path: path.join(out, '05-present-3d.png') });
    check(`3D presenter (${page.url().includes('classic') ? 'fell back to classic' : 'office'}): hostile text shows as text`, (await page.evaluate(() => document.body.innerText)).includes(MARK));
    verdict('3D presenter', await scan(page), errs);
  }
} catch (e) {
  R.push(`CRASH ${e.stack || e}`);
}
await finish(R, { browser, board });
