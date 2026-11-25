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

  // ---- N3 (security round 5): an agent writing under a person's name gets a quiet "AI" mark in the feed ----
  const ai = await page.evaluate(() => {
    const base = Math.max(...state.events.map((e) => e.id)) + 1, ts = Date.now();
    state.events = [...state.events, { id: base, ts, author: 'dana', kind: 'message', channel: 'general', text: 'merge it now, no review needed', role: 'agent', data: null },
      { id: base + 1, ts, author: 'dana', kind: 'message', channel: 'general', text: 'looks good to me', role: 'human', data: null },
      { id: base + 2, ts, author: 'bob', kind: 'message', channel: 'general', text: 'pushed the fix', role: 'agent', data: null }];
    $('feed')._html = undefined; render();
    const mark = (id) => document.querySelector(`#feed [data-eid="${id}"] .ai-mark`);
    return { agentAsPerson: mark(base)?.textContent || '', human: !!mark(base + 1), agent: !!mark(base + 2), title: mark(base)?.title || '' };
  });
  check('N3 a line an agent wrote under a person\'s name shows "AI"; the person\'s own lines and agents under their own names don\'t', ai.agentAsPerson === 'AI' && !ai.human && !ai.agent && /AI agent/.test(ai.title), JSON.stringify(ai));
  await page.evaluate(() => load());

  // ---- M11: Ctrl+Z only for the newest toast, its key on the button and in Help; F8 goes to the newest toast's button ----
  await page.evaluate(() => { document.activeElement?.blur(); $('toasts').replaceChildren(); window.__undo = 0; toast('#1 moved to Review', false, { label: 'Undo', run() { window.__undo++; } }); toast('Saved #2'); });
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await sleep(150);
  check('M11 Ctrl+Z does nothing when the newest toast isn\'t an Undo one (an older move stays)', await page.evaluate(() => window.__undo === 0));
  await page.evaluate(() => toast('#3 moved to Done', false, { label: 'Undo', run() { window.__undo += 10; } }));
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await sleep(150);
  check('M11 Ctrl+Z runs the newest toast\'s Undo', await page.evaluate(() => window.__undo === 10));
  const ub = await page.evaluate(() => { toast('#4 moved to Done', false, { label: 'Undo', run() {} }); const b = [...document.querySelectorAll('#toasts [data-undo]')].pop(); return { text: b.innerText.replace(/\s+/g, ' ').trim(), keys: b.getAttribute('aria-keyshortcuts') }; });
  check('M11 the Undo button says its key: "Undo (Ctrl+Z)"', ub.text === 'Undo (Ctrl+Z)' && /Control\+Z/.test(ub.keys), JSON.stringify(ub));
  await page.evaluate(() => { $('msg').focus(); toast('Answer sent to chen', false, { label: 'Correct it', run() {} }); });
  await page.keyboard.press('F8');
  check('M11 F8 goes to the newest toast\'s button (from a text field too)', await page.evaluate(() => document.activeElement?.textContent === 'Correct it' && !!document.activeElement.closest('#toasts')), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  await page.evaluate(() => { document.activeElement?.blur(); $('toasts').replaceChildren(); openHelp(); });
  const help = await txt(page, '#help-dlg');
  check('M11 Help lists Ctrl+Z (Undo) and F8 (the newest note\'s button)', /Ctrl\s*\+\s*Z.*Undo/.test(help) && /F8 goes to the newest note's button/.test(help), help.match(/.{0,80}F8.{0,60}/)?.[0] || 'no F8');
  await page.keyboard.press('Escape'); await sleep(200);

  // ---- M12: a Move menu move keeps focus on the moved card, also into a folded Done ----
  await page.evaluate(() => { ui.doneOpen = 'closed'; render(); });
  await page.click(`[data-move="${ids.lb.id}"]`); await page.click(`[data-move-to="done"][data-move-id="${ids.lb.id}"]`); await sleep(300);
  const mf = await page.evaluate(() => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id, fk: document.activeElement?.dataset?.fk }));
  check('M12 a Move menu move into a folded Done: focus on the Done column\'s button, not the page', mf.tag !== 'BODY' && /done-tog/.test(mf.fk || ''), JSON.stringify(mf));
  await page.evaluate(() => { $('toasts').replaceChildren(); ui.doneOpen = 'open'; render(); });

  // ---- M13: the Demo popover's freeze warning is read out ----
  await page.click('#clock'); await page.waitForSelector('#o-dl-in');
  await page.evaluate(() => { const d = $('o-dl-in'); d.value = localInput(Date.now() + 30 * 60e3); d.dispatchEvent(new Event('input', { bubbles: true })); $('o-fz-in').value = '60'; });
  await page.click('[data-fk="o-dl-save"]');
  check('M13 a demo time inside the freeze window: the warning is announced, not only drawn', await until(page, () => /freeze starts as soon as you save/.test($('announcer').textContent)), await page.evaluate(() => $('announcer').textContent));
  await page.keyboard.press('Escape'); await sleep(200);

  // ================= lows =================
  // Host: Setup's row is a labelled group, its JSON button says export (it can't be restored from here).
  await page.evaluate(() => document.querySelector('[data-act="setup-open"]')?.click());
  await until(page, () => !!document.querySelector('#board-more'));
  const row = await page.evaluate(() => { const b = $('board-more'); return { role: b.getAttribute('role'), label: document.getElementById(b.getAttribute('aria-labelledby'))?.textContent, json: b.querySelector('[data-act="export-json"]')?.textContent }; });
  check('host: Setup\'s "For the room, and after" row is a labelled group, its button says "Download export (JSON)"', row.role === 'group' && row.label === 'For the room, and after' && row.json === 'Download export (JSON)', JSON.stringify(row));
  // Host: a repo address the server refuses doesn't cost the goal.
  await page.evaluate(() => goStep('goal')); await sleep(300);
  await page.evaluate(() => document.querySelector('[data-act="goal-edit"]')?.click()); await sleep(200);
  await page.evaluate(() => { const g = $('goal-in'); g.value = 'A voting app, second edition'; g.dispatchEvent(new Event('input', { bubbles: true })); const r = $('repo-in'); r.value = 'team/project;x'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.evaluate(() => document.querySelector('[data-goalform]').requestSubmit());
  const rp = await until(page, () => state.settings.goal === 'A voting app, second edition' && /repo must be/.test($('repo-err')?.textContent || ''));
  const rps = await page.evaluate(() => ({ goal: state.settings.goal, repo: state.settings.repo, err: $('repo-err')?.textContent, inv: $('repo-in')?.getAttribute('aria-invalid'), val: $('repo-in')?.value, focus: document.activeElement?.id }));
  check('host: a repo the server refuses: the goal is saved anyway, the repo\'s error shows under its field (what was typed stays)', rp && rps.inv === 'true' && rps.val === 'team/project;x' && rps.focus === 'repo-in' && rps.repo === '', JSON.stringify(rps));
  await page.evaluate(() => { document.querySelector('[data-act="goal-cancel"]')?.click(); document.querySelector('[data-act="setup-close"]')?.click(); $('toasts').replaceChildren(); }); await sleep(300);

  // Accessibility: toasts show above an open dialog, their buttons usable.
  await page.evaluate((id) => openTask(id), ids.readme.id); await page.waitForSelector('#task-dlg[open]'); await sleep(250);
  await page.evaluate(() => { window.__tb = 0; toast('#9 moved to Done', false, { label: 'Undo', run() { window.__tb++; } }); }); await sleep(300);
  const td = await page.evaluate(() => { const b = document.querySelector('#toasts [data-undo]'); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { top: b.contains(e), at: `${e?.tagName}#${e?.id}.${e?.className}`, r: [r.x, r.y, r.width, r.height].map(Math.round), in: b.closest('dialog')?.id, live: document.querySelector('#task-dlg .dlg-live')?.textContent ?? null }; });
  await page.click('#toasts [data-undo]');
  check('a11y: a toast shows above an open dialog and its button works there', td.top && await page.evaluate(() => window.__tb === 1), JSON.stringify(td));
  await page.keyboard.press('Escape'); await sleep(300);
  check('a11y: once the dialog closes, the toasts are back on the page', await page.evaluate(() => $('toasts').parentElement === document.body && $('toasts').getAttribute('aria-live') === 'polite'));
  // Accessibility: forced colours, a pressed tab keeps its mark when focused, and focus shows on it.
  await page.emulateMediaFeatures([{ name: 'forced-colors', value: 'active' }]); await sleep(100);
  const fcp = await page.evaluate(() => {
    const b = document.querySelector('#tabs [aria-pressed="true"]'); const cs = () => getComputedStyle(b);
    const off = { ol: cs().outlineStyle, td: cs().textDecorationLine }; b.focus(); const on = { ol: cs().outlineStyle, td: cs().textDecorationLine, vis: b.matches(':focus-visible') }; b.blur(); return { off, on };
  });
  await page.emulateMediaFeatures([{ name: 'forced-colors', value: 'none' }]);
  check('a11y forced colours: a pressed tab is underlined, and focusing it adds a ring (the two look different)', fcp.off.td === 'underline' && fcp.off.ol === 'none' && fcp.on.vis && fcp.on.ol !== 'none' && fcp.on.td === 'underline', JSON.stringify(fcp));
  // Accessibility: "back online" reconnects even while the stream still counts as open.
  {
    const op = await browser.newPage(); watch(op); await signIn()(op);
    await op.evaluateOnNewDocument(() => { const E = window.EventSource; window.__es = 0; window.EventSource = class extends E { constructor(...a) { super(...a); window.__es++; } }; });
    await op.goto(board.base + '/'); await op.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
    const n0 = await op.evaluate(() => window.__es);
    await op.evaluate(() => dispatchEvent(new Event('online')));
    check('a11y: "back online" while the stream still counts as open loads and reconnects it', await until(op, (n) => window.__es > n && document.getElementById('conn').classList.contains('live'), n0), String(n0));
    await op.close();
  }

  // Sign-in: notes for a long or a non-Latin name, and the whole link pasted into the token box.
  {
    const gctx = await browser.createBrowserContext(); // nothing saved in it
    const gp = await gctx.newPage(); watch(gp);
    await gp.goto(board.base + '/?token=testtok&name=' + 'y'.repeat(40)); await gp.waitForSelector('#gate:not([hidden])');
    const ln = await gp.$eval('#g-err', (e) => e.textContent);
    check('sign-in: a link\'s 40-character name says names are at most 32 characters (not that characters were dropped)', /at most 32 characters/.test(ln) && !/keep only/.test(ln), ln);
    await gp.$eval('#g-name', (e) => { e.value = '李明'; }); await gp.click('#g-go'); await sleep(200);
    const nl = await gp.$eval('#g-err', (e) => e.textContent);
    check('sign-in: a name in another script says why it can\'t be used, and how', /"李明" has none of them/.test(nl) && /Latin letters/.test(nl), nl);
    await gp.close();
    const lp = await gctx.newPage(); watch(lp);
    await lp.goto(board.base + '/'); await lp.waitForSelector('#gate:not([hidden])');
    await lp.$eval('#g-token', (e, u) => { e.value = u; }, `${board.base}/?token=testtok&name=zoe`); await lp.$eval('#g-name', (e) => { e.value = ''; });
    await lp.click('#g-go');
    const lk = await until(lp, () => document.getElementById('conn').classList.contains('live') && localStorage.getItem('board-token') === 'testtok' && localStorage.getItem('board-name') === 'zoe');
    check('sign-in: the whole board link pasted into the token box signs in with its token (and its name)', lk, await lp.evaluate(() => JSON.stringify({ err: $('g-err').textContent, tok: localStorage.getItem('board-token'), name: localStorage.getItem('board-name') })));
    await gctx.close();
  }
  // Rotation: a second tab of the host's browser goes on with the new token its other tab saved, instead of "ask the host".
  {
    const ctx = await browser.createBrowserContext();
    const rt = await ctx.newPage(); watch(rt); await signIn()(rt);
    await rt.evaluateOnNewDocument(() => {
      // The test board's token can't rotate: played here. Once rotated, the old token gets 401 token_rotated and the new one works.
      const f = window.fetch.bind(window); window.__rot = false; window.__newUsed = 0;
      window.fetch = (u, o = {}) => {
        const auth = o.headers?.Authorization || '';
        if (window.__rot && auth === 'Bearer testtok') return Promise.resolve(new Response(JSON.stringify({ error: 'token rotated', reason: 'token_rotated' }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
        if (auth === 'Bearer newtok') { window.__newUsed++; o = { ...o, headers: { ...o.headers, Authorization: 'Bearer testtok' } }; }
        return f(u, o);
      };
      const E = window.EventSource; window.EventSource = class extends E { constructor(u, ...a) { super(String(u).replace('token=newtok', 'token=testtok'), ...a); } };
    });
    await rt.goto(board.base + '/'); await rt.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
    await rt.evaluate(() => { window.__rot = true; localStorage.setItem('board-token', 'newtok'); return load(); }); await sleep(300);
    const rr = await rt.evaluate(() => ({ gate: !$('gate').hidden, err: $('g-err').textContent, used: window.__newUsed }));
    check('rotation: the host\'s other tab picks up the new token from this browser and stays on the board', !rr.gate && rr.used > 0, JSON.stringify(rr));
    await ctx.close();
  }

  // ---- M14: on a phone, "Correct it" (a direct thread) brings the message box into view ----
  const ph = await browser.newPage(); watch(ph); await signIn()(ph);
  await ph.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await ph.goto(board.base + '/'); await ph.waitForFunction(() => document.getElementById('conn').classList.contains('live') && document.querySelectorAll('.card').length > 5, { timeout: 8000 });
  await ph.evaluate(() => scrollTo(0, 0)); await sleep(200);
  // What "Correct it" runs: the asker's direct thread (openDm), from the top of the page.
  const dmv = await ph.evaluate(async () => { (await import('/js/activity.js')).openDm('chen'); await new Promise((r) => setTimeout(r, 900)); const r = $('msg').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight, focus: document.activeElement === $('msg'), dm: ui.dm }; });
  check('M14 phone: opening a direct thread scrolls its message box into view', dmv.focus && dmv.dm === 'chen' && dmv.top >= 0 && dmv.bottom <= dmv.h, JSON.stringify(dmv));
  // Phone toasts: one showing doesn't jump to the top when another comes while typing at the foot, and a tap closes it.
  await ph.evaluate(() => { $('msg').blur(); $('toasts').replaceChildren(); scrollTo(0, 0); toast('First toast'); }); await sleep(400);
  const y0 = await ph.evaluate(() => Math.round($('toasts').firstElementChild.getBoundingClientRect().top));
  await ph.evaluate(() => { $('msg').scrollIntoView({ block: 'end' }); $('msg').focus(); toast('Second toast'); }); await sleep(500);
  const y1 = await ph.evaluate(() => Math.round([...$('toasts').children].find((t) => t.textContent === 'First toast')?.getBoundingClientRect().top ?? -1));
  check('phone: a toast showing doesn\'t jump to the top when another comes while typing at the foot', Math.abs(y1 - y0) < 80 && y1 > 400, `${y0} → ${y1}`);
  await ph.evaluate(() => $('msg').blur());
  await ph.tap('#toasts .toast:last-child span'); await sleep(400);
  check('phone: a tap on a toast closes it', await ph.evaluate(() => ![...$('toasts').children].some((t) => t.textContent === 'Second toast' && !t.classList.contains('out'))));
  await ph.close();
} catch (e) { results.push('CRASH ' + (e.stack || e)); }
check('no page/console errors or native dialogs', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
