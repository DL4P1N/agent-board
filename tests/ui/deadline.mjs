// Demo deadline + feature freeze, plan approval, desktop notifications and the write-up / backup export.
// Starts its own throwaway board. Run all suites with: npm test
import fs from 'node:fs';
import path from 'node:path';
import { startBoard, launchBrowser, shotsDir, finish, agent, rest, ageTask } from '../helpers.mjs';

const board = await startBoard();
const BASE = board.base;
const out = shotsDir('deadline');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const settings = (body) => rest(board, 'dana', '/settings', 'PUT', body);
const txt = (page, sel) => page.$eval(sel, (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
const scheme = (page, s) => page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: s }]);
const reload = (page) => page.evaluate(() => load());
const until = (page, fn, arg, timeout = 5000) => page.waitForFunction(fn, { timeout }, arg).then(() => true).catch(() => false);
// Clicks a button once it has stopped moving and nothing covers it (Setup slides in, and a redraw can land mid-click).
const clickStill = async (page, sel) => {
  await page.waitForFunction((sel) => new Promise((done) => {
    const at = () => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r && r.width ? `${r.x},${r.y}` : ''; };
    const a = at(); requestAnimationFrame(() => requestAnimationFrame(() => {
      const b = document.querySelector(sel); const r = b?.getBoundingClientRect();
      done(!!a && a === at() && !!r && b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)));
    }));
  }), { timeout: 5000 }, sel).catch(() => {});
  await page.click(sel);
};
const errText = (r) => (typeof r === 'string' ? r : JSON.stringify(r));

// A board mid-way: goal, one agent, a few tasks.
const alice = await agent(board, 'alice');
const bob = await agent(board, 'bob');
await alice('board_status'); await bob('board_status');
await alice('set_goal', { goal: 'A voting app for hackathon projects. Demo: submit, vote, live leaderboard.' });
await alice('claim_role', { role: 'planner' });
const t1 = await alice('create_task', { title: 'Project scaffolding', priority: 1 });
const t2 = await alice('create_task', { title: 'Vote API' });
const t3 = await alice('create_task', { title: 'Leaderboard page' });

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 1000 } });
const errors = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|ERR_CONNECTION|EventSource/i.test(m.text()) && errors.push('console: ' + m.text()));
  page.on('dialog', (d) => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
};
const shots = async (page, name) => {
  await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });
  await scheme(page, 'dark'); await sleep(150); await page.screenshot({ path: `${out}/${name}-desktop-dark.png` });
  await scheme(page, 'light'); await sleep(150); await page.screenshot({ path: `${out}/${name}-desktop-light.png` });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await sleep(300);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(`${name}: no horizontal overflow at 390px`, ov <= 0, ov + 'px');
  await page.screenshot({ path: `${out}/${name}-phone-light.png` });
  await scheme(page, 'dark'); await sleep(150); await page.screenshot({ path: `${out}/${name}-phone-dark.png`, fullPage: true });
  await page.setViewport({ width: 1440, height: 1000 }); await sleep(200);
};

try {
  const page = await browser.newPage(); watch(page);
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); } catch {} });
  await scheme(page, 'dark');
  await page.goto(BASE + '/');
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 5000 });
  await sleep(300);

  // ================= deadline from the UI =================
  check('no countdown before a deadline is set: the top bar\'s Demo chip says "not set"', await page.$eval('#clock', (e) => e.classList.contains('unset') && /^not set$/.test(e.querySelector('.o-x').textContent.replace(/\s+/g, ' ').trim()) && !e.querySelector('.vd')));
  await page.evaluate(() => goStep('goal', 'dl')); await sleep(300);
  check('step 2 has a labelled demo-time input (datetime-local) and freeze minutes (default 60)', await page.evaluate(() => {
    const d = $('dl-in'); const f = $('fz-in');
    return d?.type === 'datetime-local' && !!document.querySelector('label[for="dl-in"]') && !!document.querySelector('label[for="fz-in"]') && f?.value === '60' && d.value.slice(0, 10) === localInput(defaultDeadline()).slice(0, 10);
  }));
  // Past time is refused inline.
  // Typed like a person (an input event), so a live redraw before the click keeps it as the field's draft.
  await page.evaluate(() => { const d = $('dl-in'); d.value = localInput(Date.now() - 3600e3); d.dispatchEvent(new Event('input', { bubbles: true })); });
  await clickStill(page, '[data-fk="goal-save"]');
  const pastErr = () => $('dl-in').getAttribute('aria-invalid') === 'true' && /already passed/.test($('dl-err').textContent);
  await page.waitForFunction(pastErr, { timeout: 3000 }).catch(() => {});
  check('past demo time: inline error + aria-invalid', await page.evaluate(pastErr), await page.evaluate(() => JSON.stringify({ v: $('dl-in')?.value, inv: $('dl-in')?.getAttribute('aria-invalid'), err: $('dl-err')?.textContent, gerr: $('goal-err')?.textContent, rerr: $('repo-err')?.textContent, goal: $('goal-in')?.value, act: document.activeElement?.id, toasts: [...document.querySelectorAll('#toasts > *')].map((t) => t.textContent), now: new Date().toString() })));
  const target = Date.now() + (3 * 60 + 12.5) * 60e3;
  await page.evaluate((ts) => { $('dl-in').value = localInput(ts); $('fz-in').value = '60'; }, target);
  await page.click('[data-fk="goal-save"]');
  await until(page, () => !document.getElementById('clock').classList.contains('unset'));
  const clock1 = await page.$eval('#clock', (e) => e.querySelector('.o-x').textContent.replace(/\s+/g, ' ').trim());
  check('countdown in the top bar\'s Demo chip: "in 3h 1Xm · freeze HH:MM"', /^in 3h 1[123]m · freeze (?:\w{3} )?\d\d?:\d\d(?: ?[AP]M)?$/.test(clock1), clock1);
  const s1 = await rest(board, 'dana', '/state');
  check('deadline saved on the server', Math.abs(Number(s1.settings.deadline) - Math.floor(target / 60e3) * 60e3) < 60e3 && s1.settings.freeze_minutes === '60' && s1.time.deadline > 0, JSON.stringify(s1.settings));
  const dlEv = (s1.events || []).find((e) => /set the demo deadline to/.test(e.text || ''))?.text || '';
  check('ONB-10 feed: deadline time has no seconds or full numeric date', !!dlEv && !/\d:\d\d:\d\d/.test(dlEv) && !/\d\/\d+\/\d{4}/.test(dlEv), dlEv);
  check('step 2 shows the demo time and one Edit button', /Demo: (?:\w{3} )?\d\d?:\d\d(?: ?[AP]M)? · feature freeze (?:\w{3} )?\d\d?:\d\d(?: ?[AP]M)? \(60 min before\)/.test(await txt(page, '#step-goal')) && (await page.$$('#step-goal [data-act="goal-edit"]')).length === 1, await txt(page, '#step-goal'));
  check('clock is not warning-coloured 2h before the freeze', await page.$eval('#clock', (e) => !e.classList.contains('warn') && !e.classList.contains('frozen')));
  // Typing elsewhere survives the 30s tick re-render.
  await page.click('#msg'); await page.type('#msg', 'half-typed');
  await page.evaluate(() => { timeKey = 'force'; tickTime(); });
  check('typing survives a countdown tick', await page.evaluate(() => document.activeElement === $('msg') && $('msg').value === 'half-typed'));
  await page.evaluate(() => { $('msg').value = ''; });
  await page.evaluate(() => { localStorage.setItem('board-setup', 'closed'); ui.forceSetup = false; render(); }); await sleep(150);
  await shots(page, 'countdown');

  // Within 30 min of the freeze: warning colour.
  await settings({ deadline: Date.now() + 80 * 60e3, freeze_minutes: 60 });
  await reload(page); await sleep(200);
  const w = await page.$eval('#clock', (e) => ({ c: e.className, t: e.querySelector('.o-x').textContent.replace(/\s+/g, ' ').trim() }));
  check('within 30 min of the freeze: warning colour + "freeze in Xm"', /warn/.test(w.c) && /freeze in (19|20|21)m/.test(w.t), JSON.stringify(w));

  // ================= frozen =================
  await settings({ deadline: Date.now() + 30 * 60e3, freeze_minutes: 60 });
  await reload(page); await sleep(300);
  const fz = await page.$eval('#clock', (e) => ({ c: e.className, t: e.querySelector('.o-x').textContent.replace(/\s+/g, ' ').trim() }));
  check('frozen: the Demo chip says "in 30m · feature freeze — finish & merge"', /frozen/.test(fz.c) && /^in (29|30)m · feature freeze — finish & merge$/.test(fz.t), JSON.stringify(fz));
  const nowF = await txt(page, '#now');
  check('frozen: What to do now mentions the freeze, merge and test', /Feature freeze: agents won't start new tasks\. Help merge and test/.test(nowF) && /Write-up for your submission/.test(nowF), nowF);
  // The freeze has no banner above the board any more (M3/M7 of the 2026-11-14 review): What to do now explains it, the
  // Open column says what can still start and dims the rest, and the write-up link opens the export buttons in the help.
  check('frozen: no banner; the Open column dims what won\'t start', await page.evaluate(() => $('board-note').hidden && document.querySelectorAll('#col-open .card.held').length >= 1 && !document.querySelector(`#col-open .card.held[data-id="${state.tasks.find((t) => t.priority === 1)?.id}"]`)));
  // t1 is priority 1 (bug fixes stay claimable during the freeze), so try a normal-priority task.
  const refused = await alice('claim_task', { id: t2.id });
  check('frozen: an agent claim is refused', /Feature freeze/.test(errText(refused)), errText(refused).slice(0, 120));
  check('frozen: the Open column says priority-1 fixes of size S or M, and work already started, can still be claimed', /Priority-1 fixes of size S or M, and work someone already started, can still be claimed/.test(await txt(page, '#col-open .cd')), await txt(page, '#col-open .cd'));
  await page.click('#now [data-go="wrapup"]'); await sleep(400);
  check('"Write-up for your submission" jumps to the export buttons', await page.evaluate(() => document.activeElement?.dataset.act === 'export-md'));
  await page.keyboard.press('Escape'); await sleep(200); // before the demo they are in the help dialog
  await shots(page, 'frozen');

  // ================= plan approval =================
  await settings({ deadline: '' });
  await reload(page); await sleep(200);
  check('deadline cleared: no countdown (the Demo chip says not set), no freeze banner', await page.evaluate(() => $('clock').classList.contains('unset') && $('board-note').hidden));
  await page.evaluate(() => goStep('backlog')); await sleep(300);
  check('step 4 has the approval toggle (labelled checkbox, off)', await page.evaluate(() => { const c = $('appr-on'); return c?.type === 'checkbox' && !c.checked && /Review the task list before agents start/.test(c.closest('label').innerText); }));
  await page.click('#appr-on');
  const appr = await until(page, () => state.phase === 'awaiting_approval');
  check('toggle turns on require_approval → phase awaiting_approval', appr && (await rest(board, 'dana', '/state')).settings.require_approval === '1');
  await sleep(200);
  const nowA = await txt(page, '#now');
  check('awaiting: What to do now = review the task list, then approve', /Review the task list \(3 tasks\), then approve it/.test(nowA), nowA);
  check('awaiting: prominent Approve plan & start button', await page.$eval('#now .appr', (b) => b.textContent === 'Approve plan & start' && getComputedStyle(b).fontWeight >= 600).catch(() => false));
  check('awaiting: phase track shows "Review plan" as current', await page.$eval('.phases .cur', (e) => e.textContent) === 'Review plan' && /Write tasks/.test(await page.$eval('.phases', (e) => [...e.querySelectorAll('.past')].map((x) => x.textContent).join(','))));
  check('awaiting: board banner says agents are waiting for approval', await page.evaluate(() => { const n = $('board-note'); return !n.hidden && n.classList.contains('k-appr') && /Agents are waiting for your approval/.test(n.innerText); }));
  const waitClaim = await alice('claim_task', { id: t1.id });
  check('awaiting: an agent claim is refused', /not approved/.test(errText(waitClaim)), errText(waitClaim).slice(0, 120));
  // Humans can still add and edit tasks before approving.
  await page.click('#new-task-btn'); await page.type('#td-name', 'Seed demo data'); await page.click('#td-save');
  check('awaiting: humans can still add tasks', await until(page, () => state.tasks.some((t) => t.title === 'Seed demo data')));
  await page.evaluate((id) => openTask(id), t3.id); await sleep(150);
  await page.click('#td-name', { count: 3 }); await page.type('#td-name', 'Live leaderboard page'); await page.click('#td-save');
  check('awaiting: humans can still edit tasks', await until(page, (id) => state.tasks.find((t) => t.id === id)?.title === 'Live leaderboard page', t3.id));
  await page.evaluate(() => { localStorage.setItem('board-setup', 'closed'); ui.forceSetup = false; ui.steps = {}; render(); }); await sleep(150);
  await shots(page, 'approval');
  await page.click('#now .appr');
  check('Approve → phase building', await until(page, () => state.phase === 'building'));
  check('after approving: banner gone, track moves on to Build', await page.evaluate(() => $('board-note').hidden && document.querySelector('.phases .cur').textContent === 'Build'));
  const claimed = await alice('claim_task', { id: t1.id });
  check('after approving: agents can claim', claimed?.status === 'claimed', errText(claimed).slice(0, 120));

  // ================= desktop notifications =================
  const np = await browser.newPage(); watch(np);
  await np.evaluateOnNewDocument(() => {
    try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); } catch {}
    window.__hidden = false; window.__notes = [];
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window.__hidden ? 'hidden' : 'visible') });
    class N {
      constructor(title, opts = {}) { this.title = title; this.body = opts.body; this.tag = opts.tag; window.__notes.push(this); }
      close() { this.closed = true; }
      static requestPermission() { N.permission = window.__perm || 'granted'; return Promise.resolve(N.permission); }
    }
    N.permission = 'default';
    window.Notification = N;
  });
  await np.goto(BASE + '/');
  await np.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 5000 });
  check('bell is off by default (aria-pressed=false, labelled)', await np.$eval('#notify-btn', (b) => b.getAttribute('aria-pressed') === 'false' && b.getAttribute('aria-label') === 'Desktop notifications'));
  await np.$eval('#notify-btn', (b) => b.click());
  check('bell on after permission granted; preference stored', await until(np, () => $('notify-btn').getAttribute('aria-pressed') === 'true' && localStorage.getItem('board-notify') === 'on'));
  const hide = (h) => np.evaluate((v) => { window.__hidden = v; document.dispatchEvent(new Event('visibilitychange')); }, h);
  const notes = () => np.evaluate(() => window.__notes.map((n) => n.title));

  // Visible tab: nothing.
  await bob('post', { text: '@dana quick look at the vote API?' });
  await until(np, () => /quick look at the vote API/.test(document.getElementById('feed').innerText)); await sleep(200);
  check('visible tab: no notification', (await notes()).length === 0, JSON.stringify(await notes()));

  await hide(true);
  const q = await alice('ask_human', { question: 'Should votes be anonymous?', task_id: t2.id });
  check('hidden tab: a new question notifies', await until(np, () => window.__notes.some((n) => /^Question from alice/.test(n.title) && /anonymous/.test(n.body))), JSON.stringify(await notes()));
  await bob('post', { text: '@dana can you check the colours on #3?' });
  check('hidden tab: a direct @mention notifies', await until(np, () => window.__notes.some((n) => n.title === 'bob mentioned you')), JSON.stringify(await notes()));
  await alice('update_task', { id: t1.id, status: 'blocked', note: 'need the API key' });
  check('hidden tab: a task becoming blocked notifies', await until(np, (id) => window.__notes.some((n) => n.title === `#${id} is blocked` && /need the API key/.test(n.body)), t1.id), JSON.stringify(await notes()));

  // Own actions never notify: my message, my @all, my own block.
  const before = (await notes()).length;
  await np.evaluate(() => { $('msg').value = '@dana @all note to self'; $('composer').requestSubmit(); });
  const t4 = await alice('create_task', { title: 'Docs' });
  await until(np, (id) => !!taskById(id), t4.id);
  await np.evaluate((id) => moveTask(taskById(id), 'blocked'), t4.id);
  // Both have come back from the server and been drawn (then a moment for anything that would notify).
  await until(np, (id) => taskById(id)?.status === 'blocked' && state.events.some((e) => /note to self/.test(e.text)), t4.id); await sleep(300);
  check('own actions (my message, my move to Blocked) do not notify', (await notes()).length === before, JSON.stringify((await notes()).slice(before)));

  // Clicking a notification jumps to the item.
  await hide(false);
  await np.evaluate(() => window.__notes.find((n) => /^Question from/.test(n.title)).onclick());
  await sleep(500);
  check('clicking the question notification focuses its answer box', await np.evaluate((id) => document.activeElement?.id === 'qa-' + id, q.id ?? q.question_id ?? 0) || await np.evaluate(() => /^qa-/.test(document.activeElement?.id || '')));

  // The board's feature-freeze announcement notifies (the server checks every 20 s).
  await hide(true);
  await settings({ deadline: Date.now() + 40 * 60e3, freeze_minutes: 60 });
  check('hidden tab: the feature-freeze announcement notifies', await until(np, () => window.__notes.some((n) => n.title === 'Feature freeze' && /FEATURE FREEZE/.test(n.body)), null, 30000), JSON.stringify(await notes()));
  await hide(false);
  await settings({ deadline: '' });

  // Turning it off, and a browser that refuses permission. Clicks go to the element itself, not a screen
  // position: the header badges next to the bell re-render with live events and can shift it mid-click.
  await np.$eval('#notify-btn', (b) => b.click()); await sleep(150);
  check('bell toggles off; stored', await np.evaluate(() => $('notify-btn').getAttribute('aria-pressed') === 'false' && localStorage.getItem('board-notify') === 'off'));
  await np.evaluate(() => { window.__perm = 'denied'; Notification.permission = 'default'; });
  await np.$eval('#notify-btn', (b) => b.click());
  // The explanation shows as a toast and on the bell itself; toasts can be pushed out by others (max 3), so accept either.
  check('permission denied: stays off and explains how to allow it', await until(np, () => $('notify-btn').getAttribute('aria-pressed') === 'false' && (/blocked for this page/.test($('toasts').innerText) || /blocked for this page/.test($('notify-btn').title))));
  await np.close();

  // ================= UM9: the suggested demo time saved with the goal =================
  await settings({ deadline: '', no_deadline: '' });
  await page.evaluate(() => { document.querySelectorAll('#toasts > *').forEach((t) => t.remove()); });
  await reload(page);
  await page.evaluate(() => goStep('goal', 'dl')); await sleep(400);
  await clickStill(page, '[data-fk="goal-save"]');
  const sugT = await until(page, () => [...document.querySelectorAll('#toasts .toast')].some((t) => /suggested demo time was saved too/.test(t.textContent) && /No demo time/.test(t.querySelector('button')?.textContent || '')));
  const sugS = await rest(board, 'dana', '/state');
  check('UM9 saving the goal with the suggested demo time untouched says so, with a No demo time button', sugT && Number(sugS.settings.deadline) > 0, await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).join(' | ')));
  await page.evaluate(() => [...document.querySelectorAll('#toasts .toast button')].find((b) => /No demo time/.test(b.textContent))?.click());
  await until(page, () => document.getElementById('clock').classList.contains('unset'));
  const unS = await rest(board, 'dana', '/state');
  check('UM9 and that button takes the demo time back (no countdown), and stops suggesting one', !Number(unS.settings.deadline) && unS.settings.no_deadline === '1', JSON.stringify([unS.settings.deadline, unS.settings.no_deadline]));
  // M10 (round 5b): "No demo time" is the board's, not this browser's: a teammate's page doesn't suggest a time, and
  // their goal save doesn't put one back.
  {
    const tp = await browser.newPage(); watch(tp);
    await tp.evaluateOnNewDocument(() => { try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'erin'); } catch {} });
    await tp.goto(BASE + '/'); await tp.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 5000 });
    await tp.evaluate(() => goStep('goal', 'dl')); await sleep(400);
    const tf = await tp.evaluate(() => ({ dl: $('dl-in')?.value, skip: !!document.querySelector('[data-act="dl-skip"]'), sum: document.querySelector('#step-goal .step-s')?.textContent }));
    await clickStill(tp, '[data-fk="goal-save"]'); await sleep(500);
    const ts = await rest(board, 'dana', '/state');
    check('M10 a teammate\'s step 2 suggests no demo time after "No demo time", and their goal save keeps it unset', tf.dl === '' && !tf.skip && !Number(ts.settings.deadline), JSON.stringify({ ...tf, deadline: ts.settings.deadline }));
    await tp.close();
  }
  await settings({ no_deadline: '' });

  // ================= the Demo popover: a time inside the freeze window =================
  await page.evaluate(() => { localStorage.setItem('board-setup', 'closed'); ui.forceSetup = false; render(); }); await sleep(150);
  await page.click('#clock'); await page.waitForSelector('#o-dl-in');
  await page.evaluate(() => { const d = $('o-dl-in'); d.value = localInput(Date.now() + 30 * 60e3); d.dispatchEvent(new Event('input', { bubbles: true })); const f = $('o-fz-in'); f.value = '60'; f.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('[data-fk="o-dl-save"]'); await sleep(300);
  const fw = await page.evaluate(() => ({ open: !$('o-dl').hidden, hint: $('o-dl-hint')?.textContent || '', focus: document.activeElement?.dataset.fk }));
  const fwS = await rest(board, 'dana', '/state');
  check('Demo popover: a time inside the freeze window first says the freeze starts at once, and saves nothing yet', fw.open && /freeze starts as soon as you save/.test(fw.hint) && fw.focus === 'o-dl-save' && !Number(fwS.settings.deadline), JSON.stringify({ ...fw, dl: fwS.settings.deadline }));
  await page.click('[data-fk="o-dl-save"]');
  check('and Save again saves it, the toast saying the freeze is from now', await until(page, () => $('o-dl').hidden && $('clock').classList.contains('frozen') && /feature freeze from now/.test($('toasts').textContent)));
  await settings({ deadline: '' }); await reload(page);

  // ================= export =================
  const md = await page.evaluate(() => fetchExport('md'));
  check('summary export returns markdown', /^# Team board summary/.test(md) && /Vote API/.test(md), md.slice(0, 80));
  const js = JSON.parse(await page.evaluate(() => fetchExport('json')));
  check('backup export returns JSON with tasks and events', Array.isArray(js.tasks) && js.tasks.length >= 4 && Array.isArray(js.events), Object.keys(js).join(','));
  const r1 = await fetch(`${BASE}/api/summary?token=testtok`); const r2 = await fetch(`${BASE}/api/export?token=testtok`);
  check('REST: summary is text/markdown, export is a JSON attachment', /text\/markdown/.test(r1.headers.get('content-type')) && /attachment/.test(r2.headers.get('content-disposition') || ''));
  // Not only in Help or Ctrl+K: Setup (its chip is always in the top bar) offers them too, the pages with the viewer token.
  await page.evaluate(() => document.querySelector('[data-act="setup-open"]')?.click());
  const more = await until(page, () => !!document.querySelector('#board-more'));
  const mr = await page.evaluate(() => { const b = document.querySelector('#board-more'); const vt = state.setup.viewer_token; return { md: !!b?.querySelector('[data-act="export-md"]'), js: !!b?.querySelector('[data-act="export-json"]'), present: b?.querySelector('a[href*="present.html"]')?.getAttribute('href') || '', recap: b?.querySelector('a[href*="recap.html"]')?.getAttribute('href') || '', vt }; });
  check('Setup offers the presenter view and recap (viewer token), the summary and the backup', more && mr.md && mr.js && mr.present.endsWith('/present.html?token=' + encodeURIComponent(mr.vt)) && mr.recap.endsWith('/recap.html?token=' + encodeURIComponent(mr.vt)) && !mr.present.includes('testtok'), JSON.stringify(mr));
  await page.evaluate(() => document.querySelector('[data-act="setup-close"]')?.click()); await sleep(300);
  const dl = path.join(out, 'downloads'); fs.rmSync(dl, { recursive: true, force: true }); fs.mkdirSync(dl, { recursive: true });
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  await page.evaluate(() => openHelp()); await sleep(150);
  check('help panel offers summary + export', await page.evaluate(() => !!$('help-dlg').querySelector('[data-act="export-md"]') && !!$('help-dlg').querySelector('[data-act="export-json"]')));
  await page.click('#help-dlg [data-act="export-md"]'); await sleep(800);
  await page.click('#help-dlg [data-act="export-json"]'); await sleep(800);
  const files = fs.readdirSync(dl);
  const mdf = files.find((f) => /^agent-board-summary-.*\.md$/.test(f)); const jsf = files.find((f) => /^agent-board-export-.*\.json$/.test(f));
  check('download buttons save the .md and .json files', !!mdf && !!jsf && /^# Team board summary/.test(fs.readFileSync(path.join(dl, mdf), 'utf8')) && !!JSON.parse(fs.readFileSync(path.join(dl, jsf), 'utf8')).tasks, files.join(','));
  await page.keyboard.press('Escape');

  // ================= round 5b: what the freeze still allows (M1), and after the demo time (H1) =================
  await page.evaluate(() => { localStorage.setItem('board-setup', 'closed'); ui.forceSetup = false; render(); });
  // A task that will be stale, its owner offline, once the demo time has passed (claimed now, while claims are open).
  const zed = await agent(board, 'zed'); await zed('board_status');
  const zt = await rest(board, 'dana', '/tasks', 'POST', { title: 'Share buttons' });
  const zc = await zed('claim_task', { id: zt.id });
  check('round 5b setup: zed holds a task', zc?.status === 'claimed', errText(zc).slice(0, 120));
  await settings({ deadline: Date.now() + 30 * 60e3, freeze_minutes: 60 });
  await reload(page); await sleep(200);
  const bigP1 = await rest(board, 'dana', '/tasks', 'POST', { title: 'Big P1 rewrite', priority: 1, size: 'L' });
  await until(page, (id) => !!document.querySelector(`.card[data-id="${id}"]`), bigP1.id);
  check('M1 frozen: a P1 task of size L is dimmed too (the freeze allows only S or M)', await page.evaluate((id) => document.querySelector(`.card[data-id="${id}"]`).classList.contains('held'), bigP1.id));
  const prop = await bob('create_task', { title: 'Confetti on every vote' });
  check('round 5b setup: a proposal from bob', prop?.status === 'proposed', errText(prop).slice(0, 120));
  await until(page, (id) => !!document.querySelector(`[data-approve="${id}"]`), prop.id);
  await page.evaluate(() => document.getElementById('toasts').replaceChildren());
  await clickStill(page, `[data-approve="${prop.id}"]`);
  const apOk = await until(page, () => /Approved #\d+\. Feature freeze/.test($('toasts').textContent));
  check('M1 frozen: approving a proposal says nobody can claim it before the demo (the server\'s freeze_note), not "agents can claim it now"', apOk && await page.evaluate(() => !/can claim it now/.test($('toasts').textContent)), await page.evaluate(() => $('toasts').textContent));
  check('M12 approving from the card: focus lands on the approved card', await until(page, (id) => document.activeElement?.dataset?.id === String(id), prop.id), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  await page.evaluate(() => { document.activeElement?.blur(); document.getElementById('toasts').replaceChildren(); });
  await page.click('#new-task-btn'); await page.waitForSelector('#task-dlg[open]');
  await page.type('#td-name', 'Polish the footer'); await page.focus('#td-desc');
  await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.up('Control');
  const crOk = await until(page, () => /Created #\d+ Polish the footer\. Feature freeze/.test($('toasts').textContent));
  check('M1 frozen: creating a task says nobody can claim it before the demo (freeze_note)', crOk, await page.evaluate(() => $('toasts').textContent));
  check('M12 Ctrl+Enter create: focus lands on the new card', await until(page, () => { const t = state.tasks.find((x) => x.title === 'Polish the footer'); return !!t && document.activeElement?.dataset?.id === String(t.id); }), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  await page.evaluate(() => openTask(state.tasks.find((x) => x.title === 'Polish the footer').id)); await sleep(150);
  check('M1 the task dialog of a held task says it is on hold for the feature freeze', /on hold for the feature freeze/.test(await txt(page, '#td-meta')), await txt(page, '#td-meta'));
  await page.keyboard.press('Escape'); await sleep(200);

  // H1: the demo time passes while agents are still on the board (nothing else waiting on a human, so it leads).
  for (const oq of (await rest(board, 'dana', '/state')).questions.filter((x) => !x.answer)) await rest(board, 'dana', `/questions/${oq.id}/answer`, 'POST', { answer: 'yes' });
  for (const bt of (await rest(board, 'dana', '/state')).tasks.filter((x) => x.status === 'blocked')) await rest(board, 'dana', `/tasks/${bt.id}`, 'PATCH', { status: 'in_progress' });
  await ageTask(board, zt.id, 40);
  { const { DatabaseSync } = await import('node:sqlite'); const db = new DatabaseSync(path.join(board.dataDir, 'board.db')); db.prepare("UPDATE presence_v2 SET last_seen = ? WHERE name = 'zed' AND kind = 'agent'").run(Date.now() - 120 * 60e3); db.close(); }
  await settings({ deadline: Date.now() + 1200, freeze_minutes: 60 }); await sleep(1600);
  await reload(page); await sleep(300);
  const bn = await page.evaluate(() => ({ text: $('board-note').innerText.replace(/\s+/g, ' '), move: !!$('board-note').querySelector('[data-act="clock"]'), rm: !!$('board-note').querySelector('[data-act="dl-clear"]') }));
  check('H1 after the demo time: the banner says agents take no new tasks until the demo time is moved or removed, with Move and Remove', /take no new tasks until you move or remove the demo time/.test(bn.text) && bn.move && bn.rm, JSON.stringify(bn));
  const nowP = await txt(page, '#now');
  check('H1 after the demo time (agents still on): Needs attention says so, not "All good", with a way to remove it', /has passed: agents take no new tasks until you move it or remove it/.test(nowP) && /Remove the demo time/.test(nowP) && !/All good/.test(nowP), nowP);
  check('H1 after the demo time: the Open column says nothing starts, and open cards are dimmed', /demo time has passed/.test(await txt(page, '#col-open .cd')) && await page.evaluate((id) => !!document.querySelector(`.card[data-id="${id}"]`)?.classList.contains('held'), bigP1.id), await txt(page, '#col-open .cd'));
  const own = await page.evaluate((id) => document.querySelector(`.card[data-id="${id}"] .own`)?.textContent || '', zt.id);
  check('H1 after the demo time: a stale card with its owner offline doesn\'t offer a takeover', /owner offline/.test(own) && !/may take it over/.test(own) && /nobody can take it over/.test(own), own);
  await page.click('#now [data-go="demo"]');
  check('H1 "Move it" opens the Demo popover', await until(page, () => !$('o-dl').hidden && !!$('o-dl-in')));
  await page.keyboard.press('Escape'); await sleep(150);
  await page.click('#now [data-go="dl-clear"]');
  check('H1 "Remove the demo time" removes it: the banner and the line go', await until(page, () => $('clock').classList.contains('unset') && $('board-note').hidden && !/has passed/.test($('now').innerText)));
  await settings({ deadline: '' }); await reload(page);

  // All done: the write-up is offered prominently.
  for (const oq of (await rest(board, 'dana', '/state')).questions.filter((x) => !x.answer)) await rest(board, 'dana', `/questions/${oq.id}/answer`, 'POST', { answer: 'yes' });
  for (const t of (await rest(board, 'dana', '/state')).tasks) await rest(board, 'dana', `/tasks/${t.id}`, 'PATCH', { status: 'done' });
  await reload(page); await sleep(300);
  check('all done: banner offers the write-up for the submission', await page.evaluate(() => !$('board-note').hidden && /Every task is merged/.test($('board-note').innerText) && !!$('board-note').querySelector('[data-act="export-md"]')) && /Write-up for your submission/.test(await txt(page, '#now')), await txt(page, '#now'));

  check('no page/console errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  results.push('CRASH ' + (e.stack || e));
}
await finish(results, { browser, board });
