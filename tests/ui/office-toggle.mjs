// The board's view switch (header: Board | 3D office): the 3D office as a view inside the main board, built from
// office/src/live/embed.ts into public/office/embed.js by `npm run build:present`. Board is the default; the office
// (three.js) loads on the first switch only and draws the state the board already loads. Laid out like the office demo:
// the room fills the window, with a Needs you dock (left), an Agents dock (right), a Tasks window (bottom; folded into
// the Progress chip by default on screens up to 900px tall), Goal / demo time / theme chips on top (each opens a popover
// in place) and Progress / Activity chips along the bottom. The room is framed in the space the panels leave free. Works with or without WebGL:
// Chrome runs with SwiftShader so CI runners without a GPU still get it; without WebGL the board stays, with a note.
// Run all suites with: npm test
import path from 'node:path';
import { startBoard, launchBrowser, shotsDir, finish, agent, rest, TOKEN } from '../helpers.mjs';

const board = await startBoard();
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);

await human('/settings', 'PUT', { goal: 'A voting app for hackathon projects', deadline: Date.now() + 3 * 3600e3, freeze_minutes: 60 });
const ana = await agent(board, 'ana-claude'); await ana('board_status');
const t1 = await ana('create_task', { title: 'Vote API', size: 'S' });
const t2 = await ana('create_task', { title: 'Leaderboard page' });
await ana('claim_task', { id: t1.id }); await ana('update_task', { id: t1.id, status: 'in_progress' });
await ana('ask_human', { question: 'Which login provider?' });
await ana('post', { text: '@dana the vote API is up' }); // a mention badge in the header too

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 900 }, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = shotsDir('office-toggle');
const errors = [];
const until = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, { timeout, polling: 100 }, arg).then(() => true).catch(() => false);
const view = (page) => page.evaluate(() => document.documentElement.dataset.boardView);
const shown = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !!(e.offsetWidth || e.offsetHeight); }, sel);
// Each page in its own browser context: its own localStorage, like a separate browser.
async function open(url = '/', { phone = false, setup, errs = errors } = {}) {
  const page = await (await browser.createBrowserContext()).newPage();
  const reqs = [];
  page.on('request', (r) => reqs.push(r.url()));
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  if (phone) await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); localStorage.setItem('board-setup', 'closed'); } catch {} });
  if (setup) await page.evaluateOnNewDocument(setup);
  await page.goto(board.base + url);
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
  await sleep(200);
  return { page, reqs };
}
const officeReqs = (reqs) => reqs.filter((u) => /\/office\//.test(u));

try {
  // ---- Default: the board, nothing 3D loaded ----
  const { page, reqs } = await open('/');
  const webgl = await page.evaluate(() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; } });
  check('default view is Board', await view(page) === 'board' && await shown(page, '#board') && !(await shown(page, '#office-view')));
  check('the switch sits in the header right after the brand: two pressed buttons, Board pressed', await page.evaluate(() => {
    const g = document.getElementById('vseg'); const r = [...g.querySelectorAll('button')];
    const h1 = document.querySelector('#app > header h1').getBoundingClientRect(); const v = g.getBoundingClientRect();
    return !g.hidden && g.closest('header') && v.left - h1.right < 40 && r.length === 2 && r[0].getAttribute('aria-pressed') === 'true' && r[1].getAttribute('aria-pressed') === 'false' && r[1].getAttribute('aria-label') === '3D office' && r[0].tabIndex === -1 && r[1].tabIndex === 0; // one Tab stop: the view to switch to
  }));
  check('no three.js or office code requested on load', officeReqs(reqs).length === 0 && !(await page.$('canvas')), officeReqs(reqs).join(' '));

  // ---- Header stays on one row with the switch and the theme button (ONB-9 widths), also with the "need you" badge ----
  // On a laptop What to do now stays in view in its rail, so the badge only shows once it's scrolled out of view (a
  // long rail, or one column): show it here as it is then.
  for (const w of [1366, 1440, 1600, 1920]) {
    await page.setViewport({ width: w, height: 900 }); await sleep(300);
    await page.evaluate(() => { nowSeen = false; syncNeeds(); }); await sleep(100);
    const hd = await page.evaluate(() => { const h = document.querySelector('#app > header'); const v = $('vseg').getBoundingClientRect(); const b = $('help-btn').getBoundingClientRect(); const n = $('needs'); return { h: h.offsetHeight, same: Math.abs(v.top - b.top) < 12, vis: v.width > 0, badge: !n.hidden && n.offsetWidth > 0 && /question/.test(n.querySelector('button')?.getAttribute('aria-label') || '') && !$('clock').hidden && Math.abs($('theme-btn').getBoundingClientRect().top - b.top) < 2 }; });
    check(`${w}px: header on one row with the view switch, the clock, the theme button and the need-you badge`, hd.vis && hd.same && hd.h < 70 && hd.badge, JSON.stringify(hd));
  }
  await page.reload(); await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 }); await sleep(300);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
  check('the need-you badge hides while What to do now is on screen (in its rail, also with the board scrolled)', await page.$eval('#needs', (n) => n.hidden));
  await page.setViewport({ width: 1440, height: 900 }); await sleep(200);

  // ---- Switch to the office ----
  await page.click('#vseg [data-vset="office"]');
  if (!webgl) {
    check('no WebGL in this browser: stays on the board with a note (office checks skipped)', await until(page, () => document.documentElement.dataset.boardView === 'board' && /3D office/.test(document.getElementById('toasts').innerText)));
  } else {
    check('switching shows the office view in place', await view(page) === 'office' && await page.$eval('#vseg [data-vset="office"]', (b) => b.getAttribute('aria-pressed') === 'true'));
    check('the switch is announced politely', await until(page, () => /Showing the 3D office/.test(document.getElementById('announcer').textContent)));
    check('first switch loads the office chunk and draws a canvas', await until(page, () => !!document.querySelector('#office-scene canvas'), null, 20000) && officeReqs(reqs).some((u) => /embed\.js/.test(u)) && officeReqs(reqs).some((u) => /OfficeScene-/.test(u)), officeReqs(reqs).map((u) => u.split('/').pop()).join(' '));
    check('loading note gone once it is ready', await until(page, () => !document.getElementById('office-view').classList.contains('loading')));
    check('the Tasks window starts folded into the Progress chip on a 900px-tall screen (the room needs the height)', await page.evaluate(() => $('o-tasks').hidden && $('o-prog-chip').getAttribute('aria-expanded') === 'false'));
    const share = await page.evaluate(() => {
      const v = $('office-view').getBoundingClientRect(); let n = 0, hit = 0;
      for (let x = 0.02; x < 1; x += 0.04) for (let y = 0.02; y < 1; y += 0.04) { n++; if (document.elementFromPoint(v.left + v.width * x, v.top + v.height * y)?.closest('#office-scene')) hit++; }
      return hit / n;
    });
    check('the room gets at least half of the 3D view by default (was 38%)', share >= 0.5, share.toFixed(2));
    await page.click('#o-prog-chip');
    check('the Progress chip opens the Tasks window', await page.evaluate(() => !$('o-tasks').hidden && $('o-prog-chip').getAttribute('aria-expanded') === 'true'));
    check('the room fills the window under the header; the task columns are hidden; no scrolling', await page.evaluate(() => { const r = $('office-view').getBoundingClientRect(); const h = document.querySelector('#app > header').getBoundingClientRect(); return Math.abs(r.top - h.bottom) < 3 && Math.abs(r.bottom - innerHeight) < 2 && r.width === innerWidth && !$('board').offsetWidth && document.documentElement.scrollHeight <= innerHeight + 1; }));
    const lay = await page.evaluate(() => {
      const R = (id) => { const e = document.getElementById(id); return e && !e.hidden && e.offsetWidth ? e.getBoundingClientRect() : null; };
      const hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const [l, r, t, top, bot] = [R('o-left'), R('o-right'), R('o-tasks'), document.querySelector('.o-top').getBoundingClientRect(), document.querySelector('.o-bot').getBoundingClientRect()];
      const v = $('office-view').getBoundingClientRect();
      // The middle of the room is clear: nothing but the scene at the centre, and a third of the width around it.
      const mid = [[0.5, 0.42], [0.4, 0.42], [0.6, 0.42], [0.5, 0.3]].every(([x, y]) => !!document.elementFromPoint(v.left + v.width * x, v.top + v.height * y)?.closest('#office-scene'));
      return { docks: !!(l && r && t), apart: !hit(l, t) && !hit(r, t) && !hit(l, r) && !hit(l, bot) && !hit(r, bot) && !hit(t, bot) && !hit(top, l) && !hit(top, r), mid, inside: [l, r, t].every((x) => x && x.left >= v.left && x.right <= v.right && x.top >= v.top && x.bottom <= v.bottom) };
    });
    check('docks and the Tasks window are there, apart from each other and the chips, inside the room, the middle clear', lay.docks && lay.apart && lay.mid && lay.inside, JSON.stringify(lay));
    check('Needs you (left dock) holds What to do now and the questions, with Answer', await page.evaluate(() => !!$('o-left').contains($('now')) && $('o-left').contains($('q-panel'))) && await shown(page, '#now') && await shown(page, '#q-panel textarea') && /Which login provider/.test(await page.$eval('#q-panel', (e) => e.innerText)));
    const dock = await page.evaluate(() => { const f = $('questions').querySelector('form'); const ta = f.querySelector('textarea').getBoundingClientRect(); const b = f.querySelector('button').getBoundingClientRect(); return { sub: $('o-left-sub').textContent, badge: $('needs').querySelector('button')?.title, phases: !!$('o-left').querySelector('.phases')?.offsetWidth, row: Math.abs(ta.top - b.top) < 12 && b.left > ta.right - 2 }; });
    check('Needs you: its counts in the title bar (the same words and count as the need-you badge of the Board view), no phase track, the answer box and Answer on one row', /1 question/.test(dock.sub) && dock.sub === dock.badge && !dock.phases && dock.row, JSON.stringify(dock));
    check('Agents (right dock): people, then their agents with tool dot, state and current task', await until(page, () => { const b = document.querySelector('[data-o-agent="ana-claude"]'); return b && $('o-right').contains(b) && !!b.querySelector('.tdot') && /asked you a question|#\d+ Vote API/.test(b.innerText) && /\bana\b/.test($('o-agents').innerText); }), await page.$eval('#o-agents', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => ''));
    // The row and the room say the same thing: a question is "Question" in both, boxed; working is a plain word.
    const st = await page.evaluate(() => { const s = document.querySelector('[data-o-agent="ana-claude"] .o-st'); return { word: s.textContent, boxed: s.classList.contains('bx'), bubble: window.__officeState?.agents.find((a) => a.id === 'ana-claude')?.bubble, badges: [...document.querySelectorAll('#o-agents .o-st.bx')].map((x) => x.textContent) }; });
    check('an agent waiting on an answer: "Question" badge in its row, the same word as its bubble in the room', st.word === 'Question' && st.boxed && st.bubble === 'Question', JSON.stringify(st));
    check('only Question / Blocked / Out of usage get a badge', st.badges.every((w) => ['Question', 'Blocked', 'Out of usage'].includes(w)), JSON.stringify(st.badges));
    check('the Agents count uses the board\'s rule and words ("N online", out of usage apart)', await page.evaluate(() => $('o-right-sub').textContent === agentsLine(setupInfo(), true) && /^\d+ online/.test($('o-right-sub').textContent)), await page.$eval('#o-right-sub', (e) => e.textContent));
    check('Tasks window: the board\'s six columns, names and counts', await page.evaluate(() => {
      const c = [...document.querySelectorAll('#o-cols .o-col')];
      return c.length === 6 && c.map((x) => x.querySelector('h3 span').textContent).join() === 'Open,Claimed,In progress,Blocked,Review,Done' && /Vote API/.test(c[2].innerText) && /Leaderboard page/.test(c[0].innerText)
        && c.every((x) => x.querySelector('.o-c').textContent === (document.getElementById('col-' + x.dataset.s)?.getAttribute('aria-label') || '').match(/(\d+) tasks?$/)?.[1]);
    }), await page.evaluate(() => [...document.querySelectorAll('#o-cols .o-col')].map((x) => `${x.querySelector('h3 span').textContent}=${x.querySelector('.o-c')?.textContent}/${document.getElementById('col-' + x.dataset.s)?.getAttribute('aria-label')}`).join(' ')));
    check('Tasks: one Tab stop per column (the board\'s model)', await page.evaluate(() => [...document.querySelectorAll('#o-cols .o-col')].every((c) => { const k = [...c.querySelectorAll('.o-card')]; return !k.length || k.filter((x) => x.tabIndex === 0).length === 1; })));
    check('top chips: Goal and demo time (with the verdict / countdown), the header clock and need-you badge hide', await page.evaluate(() => /voting app/i.test($('o-goal-chip').innerText) && /Demo in/.test($('o-dl-chip').innerText) && !$('clock').offsetWidth && !$('needs').offsetWidth));
    await page.click('#o-dl-chip');
    check('the Demo chip opens the demo time in place (still the 3D view), focus in its time field', await view(page) === 'office' && await page.evaluate(() => !$('o-dl').hidden && document.activeElement === $('o-dl-in') && $('o-dl-chip').getAttribute('aria-expanded') === 'true'));
    await page.$eval('#o-fz-in', (i) => { i.value = '45'; });
    await page.click('[data-fk="o-dl-save"]');
    check('saving it closes the popover, back on the chip, still in 3D; the board has the new freeze', await until(page, () => document.getElementById('o-dl').hidden && document.activeElement?.id === 'o-dl-chip' && String(state.settings.freeze_minutes) === '45') && await view(page) === 'office');
    await page.click('#o-dl-chip'); await page.keyboard.press('Escape');
    check('Esc closes the demo time popover, focus back on its chip', await page.evaluate(() => $('o-dl').hidden && document.activeElement === $('o-dl-chip')));
    check('bottom chips: Progress (x of y done, bar) and Activity (the latest event); chat lives in Activity, no separate Chat chip', await page.evaluate(() => /0 of 2 done/.test($('o-prog-chip').innerText) && !!$('o-prog-bar') && $('o-act-x').textContent.length > 3 && !$('o-chat-chip')));
    const small = await page.evaluate(() => {
      const out = [];
      for (const b of $('office-view').querySelectorAll('button, textarea, select')) { const r = b.getBoundingClientRect(); if (r.width && r.height && (r.height < 24 || r.width < 24) && !b.matches('.link, .o-card')) out.push(`${b.id || b.dataset.fk || b.className || b.textContent} ${Math.round(r.width)}x${Math.round(r.height)}`); }
      const walk = document.createTreeWalker($('office-view'), NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode());) { const e = n.parentElement; if (!n.textContent.trim() || !e.offsetWidth || e.closest('#office-scene')) continue; const f = parseFloat(getComputedStyle(e).fontSize); if (f < 12) out.push(`font ${f}px: ${n.textContent.trim().slice(0, 20)}`); }
      return out;
    });
    check('every control in the office at least 24px, every text at least 12px', !small.length, small.slice(0, 6).join(' | '));

    // The scene draws the state the board loaded, and follows it live.
    const s0 = await page.evaluate(() => window.__officeState);
    const a0 = s0?.agents.find((a) => a.id === 'ana-claude');
    check('the scene gets the board state: ana at a desk with her question', a0?.provider === 'claude' && a0.pose === 'raise_hand' && s0.tickets.length === 2, JSON.stringify(a0 && [a0.provider, a0.pose, s0.tickets.length]));
    const bob = await agent(board, 'bob-codex', 'codex-mcp-client'); await bob('board_status');
    await bob('claim_task', { id: t2.id }); await bob('update_task', { id: t2.id, status: 'blocked', note: 'needs a key' });
    check('state updates reach the scene (a new agent, blocked)', await until(page, () => window.__officeState?.agents.some((a) => a.id === 'bob-codex' && a.phase === 'blocked' && a.provider === 'codex')));
    await page.screenshot({ path: path.join(out, 'office-1440.png') });

    // Answer a question without leaving the office.
    const qid = await page.$eval('#q-panel textarea', (t) => t.id);
    await page.type('#' + qid, 'GitHub, please'); await page.keyboard.press('Enter');
    check('answering from the office view works and stays in the office', await until(page, () => !/Which login provider/.test(document.getElementById('q-panel').innerText) || document.getElementById('q-panel').hidden) && await view(page) === 'office');
    check('the answered question reaches the scene (hand down)', await until(page, () => window.__officeState?.agents.find((a) => a.id === 'ana-claude')?.pose !== 'raise_hand'));

    // A pick in the room (the scene's pick callback) selects the agent's row, with what it holds; a row selects the agent in the room.
    await page.evaluate(() => pickAgent('ana-claude'));
    const sel = await page.evaluate(() => ({ row: document.querySelector('[data-o-agent="ana-claude"]').getAttribute('aria-pressed'), scene: office.mod.selected, t: $('o-det')?.innerText.replace(/\s+/g, ' ') || '' }));
    check('a pick in the room selects the row (pressed) and shows what the agent holds', sel.row === 'true' && sel.scene === 'ana-claude' && /Vote API/.test(sel.t) && /Show in People/.test(sel.t), JSON.stringify(sel));
    await page.click('[data-o-agent="bob-codex"]');
    check('clicking a row selects that agent in the room (and only that row)', await page.evaluate(() => office.mod.selected === 'bob-codex' && document.querySelectorAll('.o-agent[aria-pressed="true"]').length === 1 && document.activeElement?.dataset.oAgent === 'bob-codex'));
    check('a blocked agent says so, with its reason in Needs you', await page.evaluate(() => /blocked/i.test(document.querySelector('[data-o-agent="bob-codex"] .o-st').textContent) && /bob-codex/.test($('o-blocked').innerText) && /needs a key/.test($('o-blocked').innerText)));
    await page.click('[data-o-agent="bob-codex"]');
    check('clicking it again unselects it', await page.evaluate(() => office.mod.selected === null && !document.querySelector('.o-agent[aria-pressed="true"]')));
    await page.evaluate(() => pickAgent('ana-claude')); await page.focus('[data-o-agent="ana-claude"]');
    await page.keyboard.press('Escape');
    check('Esc unselects the agent', await page.evaluate(() => office.mod.selected === null));

    // A task card opens the board's task dialog.
    await page.click(`#o-cols [data-open-task="${t2.id}"]`);
    check('a task card opens the task dialog', await until(page, () => document.getElementById('task-dlg').open && document.getElementById('td-name').value === 'Leaderboard page'));
    await page.keyboard.press('Escape'); await until(page, () => !document.getElementById('task-dlg').open);
    check('closing the dialog leaves the office as it was', await view(page) === 'office');

    // Folding: docks fold to chips, Tasks into the Progress chip, maximise; remembered; Esc restores the maximised window.
    await page.click('#o-left [data-o-fold]');
    check('Needs you folds to a chip, focus on the chip', await page.evaluate(() => $('o-left').hidden && !$('o-left-pill').hidden && document.activeElement === $('o-left-pill') && $('o-left-pill').getAttribute('aria-expanded') === 'false'));
    await page.click('#o-right [data-o-fold]');
    await page.click('#o-prog-chip');
    check('Agents folds; the Progress chip folds the Tasks window', await page.evaluate(() => $('o-right').hidden && !$('o-right-pill').hidden && $('o-tasks').hidden && $('o-prog-chip').getAttribute('aria-expanded') === 'false'));
    await page.reload(); await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 }); await sleep(300);
    check('folded panels stay folded after a reload', await page.evaluate(() => $('o-left').hidden && $('o-right').hidden && $('o-tasks').hidden && !$('o-left-pill').hidden));
    await page.click('#o-left-pill'); await page.click('#o-right-pill'); await page.click('#o-prog-chip');
    check('the chips open them again', await page.evaluate(() => !$('o-left').hidden && !$('o-right').hidden && !$('o-tasks').hidden && $('o-left-pill').hidden));
    await page.click('#o-tasks-max');
    check('maximise: the Tasks window covers the room', await page.evaluate(() => { const r = $('o-tasks').getBoundingClientRect(); const v = $('office-view').getBoundingClientRect(); return $('o-tasks').classList.contains('max') && r.height > v.height * 0.8 && $('o-tasks-max').getAttribute('aria-pressed') === 'true'; }));
    await page.keyboard.press('Escape');
    check('Esc restores it', await page.evaluate(() => !$('o-tasks').classList.contains('max')));

    // Activity: the board's own feed (with its filters) and chat, in a window; Esc closes it.
    await page.click('#o-act-chip');
    check('the Activity chip opens the feed with its filters', await page.evaluate(() => !$('o-act').hidden && $('o-act').contains($('feed')) && $('o-act').contains($('tabs')) && $('feed').offsetHeight > 150 && /vote API is up/.test($('feed').innerText)));
    // Its filters are clickable: the feed doesn't cover them, and the room's name tags never paint over the window.
    const corners = await page.evaluate(() => { const r = $('o-act').getBoundingClientRect(); return [[r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4], [r.left + r.width / 2, r.top + r.height / 2]].filter(([x, y]) => !$('o-act').contains(document.elementFromPoint(x, y))).length; });
    check('nothing from the room covers the Activity window (its corners and middle are its own)', corners === 0, String(corners));
    check('the room\'s name tags sit under every panel (the scene is its own stacking layer)', await page.evaluate(() => { const s = getComputedStyle($('office-scene')); return s.zIndex === '0' && s.isolation === 'isolate'; }));
    for (const tab of ['chat', 'me', 'problems', 'merges', 'all']) {
      const pos = await page.$eval(`#tabs [data-tab="${tab}"]`, (b) => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { x: r.left + r.width / 2, y: r.top + r.height / 2, own: e === b || b.contains(e) }; });
      await page.mouse.click(pos.x, pos.y); await sleep(120);
      const r = await page.evaluate((t) => ({ pressed: document.querySelector(`#tabs [data-tab="${t}"]`).getAttribute('aria-pressed'), dlg: document.getElementById('task-dlg').open, focusOk: !document.activeElement?.matches?.('textarea[id^="tdqa"]') }), tab);
      check(`3D Activity: a click on the "${tab}" filter selects it (and opens nothing else)`, pos.own && r.pressed === 'true' && !r.dlg && r.focusOk, JSON.stringify({ ...pos, ...r }));
    }
    await page.keyboard.press('Escape');
    check('Esc closes it, focus back on the chip', await page.evaluate(() => $('o-act').hidden && document.activeElement === $('o-act-chip')));
    await page.click('#o-act-chip');
    check('the Activity window has the chat composer', await page.evaluate(() => !$('o-act').hidden && $('o-act').contains($('msg'))));
    await page.focus('#msg');
    await page.type('#msg', 'hello from the office'); await page.keyboard.press('Enter');
    check('sending a message works from the office', await until(page, () => /hello from the office/.test(document.getElementById('feed').innerText)));
    await page.keyboard.press('Escape');
    check('Esc in the composer closes the window', await page.evaluate(() => $('o-act').hidden));

    // The theme: the header's swatch button, the same control as on the Board view (no theme chip in the room).
    check('one theme control: the header button, also in 3D', await page.evaluate(() => !document.querySelector('#o-theme-chip, #o-theme') && !!$('theme-btn').offsetWidth && document.querySelectorAll('[data-theme-set]').length === 5));
    await page.click('#theme-btn');
    check('the theme button opens the picker over the room, focus on the current palette (a radio group)', await page.evaluate(() => { const r = $('theme-pop').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !$('theme-pop').hidden && $('theme-pop').contains(e) && $('theme-pop').getAttribute('role') === 'radiogroup' && document.activeElement?.getAttribute('aria-checked') === 'true' && $('theme-pop').querySelectorAll('[role="radio"][tabindex="0"]').length === 1; }));
    await page.click('#theme-pop [data-theme-set="night"]');
    check('a palette in the picker switches the theme and the room (Night), and the picker closes', await until(page, () => document.documentElement.dataset.theme === 'night' && office.mod.palette === 'night' && document.querySelector('#theme-pop [data-theme-set="night"]').getAttribute('aria-checked') === 'true' && document.getElementById('theme-pop').hidden));
    await page.screenshot({ path: path.join(out, 'office-night-1440.png') });
    await page.click('#theme-btn'); await page.keyboard.press('ArrowRight');
    check('arrow keys move through the palettes (Night -> Terminal)', await until(page, () => document.documentElement.dataset.theme === 'terminal' && office.mod.palette === 'terminal' && document.activeElement?.dataset.themeSet === 'terminal'));
    await page.keyboard.press('Escape');
    check('Esc closes the picker, focus back on the theme button (still in 3D)', await page.evaluate(() => $('theme-pop').hidden && document.activeElement === $('theme-btn')) && await view(page) === 'office');
    await page.evaluate(() => setTheme('auto'));

    // "Show in People" (selected agent) opens that person on the board; the moved blocks go home.
    await page.evaluate(() => pickAgent('ana-claude'));
    await page.click('#o-det [data-office-person]');
    check('"Show in People" switches to the board with that person open', await until(page, () => document.documentElement.dataset.boardView === 'board' && document.activeElement?.dataset.fk === 'ptog-ana'), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
    check('back on the board, What to do now and Activity are back in place (left and right rails)', await page.evaluate(() => $('nyou').parentElement.id === 'rail-l' && $('f-h').closest('.panel').parentElement.id === 'rail-r' && !!$('f-h').closest('.panel').nextElementSibling?.classList.contains('locksp') && $('feed').offsetHeight > 50));

    // Keyboard: the buttons work from the keyboard; the palette has the command.
    await page.focus('#vseg [data-vset="office"]'); await page.keyboard.press('Enter');
    check('the switch works from the keyboard (Enter)', await view(page) === 'office' && await page.$eval('#vseg [data-vset="office"]', (b) => b.getAttribute('aria-pressed') === 'true'));
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    await page.type('#pal-in', 'switch to board'); await sleep(150);
    const pal = await page.$eval('#pal-list', (l) => l.innerText);
    await page.keyboard.press('Enter');
    check('Ctrl+K: "Switch to Board" (and back)', /Switch to Board/.test(pal) && await until(page, () => document.documentElement.dataset.boardView === 'board'), pal.replace(/\s+/g, ' ').slice(0, 80));
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    await page.type('#pal-in', '3d office'); await sleep(150);
    const embeds = officeReqs(reqs).filter((u) => /embed\.js/.test(u)).length;
    check('the palette offers "Switch to 3D office" on the board', /Switch to 3D office/.test(await page.$eval('#pal-list', (l) => l.innerText)));
    await page.keyboard.press('Enter');
    check('the office comes back without reloading its code', await until(page, () => document.documentElement.dataset.boardView === 'office') && officeReqs(reqs).filter((u) => /embed\.js/.test(u)).length === embeds);

    // What to do now's links: blocked tasks are listed in the dock (stay); a link to Start here opens the board view.
    await page.click('#now [data-go="blocked"]');
    check('"blocked" in What to do now stays in the office, on the Blocked list', await view(page) === 'office' && await page.evaluate(() => $('o-blocked').contains(document.activeElement)));
    await page.click('#o-goal-chip');
    check('the Goal chip shows the full goal', await page.evaluate(() => !$('o-goal').hidden && /voting app for hackathon projects/.test($('o-goal').innerText)));
    await page.click('#o-goal [data-act="o-goal-edit"]');
    check('"Edit the goal" edits it in place (still the 3D view), focus in the text', await view(page) === 'office' && await page.evaluate(() => document.activeElement === $('o-goal-in')));
    await page.evaluate(() => { $('o-goal-in').value = ''; }); await page.type('#o-goal-in', 'A voting app for hackathon projects, with a live leaderboard'); await page.keyboard.press('Enter');
    check('Enter saves the goal from the popover, focus back on Edit the goal', await until(page, () => /live leaderboard/.test(state.settings.goal) && document.activeElement?.dataset.fk === 'o-goal-edit' && /live leaderboard/.test(document.getElementById('o-goal-chip').innerText)) && await view(page) === 'office');
    await page.keyboard.press('Escape');

    // Ctrl+K: "Edit the demo time" opens the popover in 3D, and focus lands in it (the command runs after the palette closes).
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    await page.type('#pal-in', 'demo time'); await sleep(150); await page.keyboard.press('Enter');
    check('Ctrl+K "Edit the demo time" in 3D: the popover, focus in its time field', await until(page, () => !document.getElementById('o-dl').hidden && document.activeElement?.id === 'o-dl-in') && await view(page) === 'office', await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName));
    await page.keyboard.press('Escape');

    // The skip link stays in 3D: "Skip to what needs you" lands in the Needs you dock.
    await page.focus('#o-goal-chip'); await page.evaluate(() => document.activeElement.blur());
    check('3D: "Skip to what needs you" is still there (the other skip links go to Board-only parts)', await page.evaluate(() => getComputedStyle(document.querySelector('.skip[data-skip="now"]')).display !== 'none' && getComputedStyle(document.querySelector('.skip[data-skip="tasks"]')).display === 'none'));
    await page.focus('.skip[data-skip="now"]'); await page.keyboard.press('Enter');
    check('the skip link focuses What to do now in the dock', await until(page, () => document.getElementById('now').contains(document.activeElement)) && await view(page) === 'office');

    // Remembered across reloads; ?view= overrides.
    await page.click('#vseg [data-vset="board"]');
    await page.click('#vseg [data-vset="office"]');
    check('the choice is saved in this browser', await page.evaluate(() => localStorage.getItem('board-view-mode') === 'office'));
    await page.reload(); await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
    check('after a reload: still the office', await view(page) === 'office' && await until(page, () => !!document.querySelector('#office-scene canvas'), null, 20000));
    await page.goto(board.base + '/?view=board'); await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
    check('?view=board overrides the saved choice', await view(page) === 'board' && !(await page.$('#office-scene canvas')));
    await page.close();
    const v2 = await open('/?view=office');
    check('?view=office opens the office (nothing saved)', await view(v2.page) === 'office' && await until(v2.page, () => !!document.querySelector('#office-scene canvas'), null, 20000) && await v2.page.evaluate(() => localStorage.getItem('board-view-mode') === null));

    // Theme: the office follows the board's light / dark choice.
    // Theme: the room is drawn in the board's palette (each of the four), and Auto follows the OS.
    for (const t of ['day', 'night', 'terminal', 'dusk']) {
      await v2.page.evaluate((x) => setTheme(x), t); await sleep(150);
      check(`theme ${t}: the office draws the ${t} palette`, await v2.page.evaluate((x) => office.mod?.palette === x && scenePalette() === x && window.__officeState?.agents.length > 0, t));
    }
    await v2.page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await v2.page.evaluate(() => setTheme('auto'));
    check('Auto on a light OS: the Day room', await until(v2.page, () => office.mod?.palette === 'day'));
    await v2.page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    // Chrome fires media-query 'change' events on a rendering frame, which a headless test tab doesn't reliably get.
    // The page must see the dark OS; if the browser hasn't delivered the event yet, fire it on the page's own listener.
    check('Auto: the page sees the OS switch to dark', await until(v2.page, () => darkMq.matches && scenePalette() === 'dusk'));
    if (!(await until(v2.page, () => office.mod?.palette === 'dusk', null, 2000))) await v2.page.evaluate(() => darkMq.dispatchEvent(new Event('change')));
    check('Auto follows the OS switching to dark: the Dusk room', await until(v2.page, () => office.mod?.palette === 'dusk'));
    // A column with more cards than fit says how many more; a helper shows under its agent with its own state; a person
    // whose only agent has their name is one row.
    for (let i = 0; i < 7; i++) await ana('create_task', { title: `Extra task ${i + 1}`, size: 'S' });
    const helperTask = await ana('create_task', { title: 'Helper task' });
    await ana('claim_task', { id: helperTask.id, as: 'ui-worker' }); await ana('update_task', { id: helperTask.id, status: 'in_progress', as: 'ui-worker' });
    const carol = await agent(board, 'carol'); await carol('board_status');
    await v2.page.setViewport({ width: 1366, height: 768 });
    await v2.page.evaluate(() => { if (document.getElementById('o-tasks').hidden) document.getElementById('o-prog-chip').click(); });
    check('an overflowing Tasks column says "+N more" (N = the cards out of view)', await until(v2.page, () => { const c = document.querySelector('#o-cols .o-col[data-s="open"]'); const m = c?.querySelector('.o-more'); if (!m || m.hidden) return false; const ul = c.querySelector('ul').getBoundingClientRect(); const out = [...c.querySelectorAll('.o-card')].filter((x) => x.getBoundingClientRect().bottom > ul.bottom + 1).length; return out > 0 && m.textContent === `+${out} more`; }), await v2.page.evaluate(() => document.querySelector('#o-cols .o-col[data-s="open"] .o-more')?.textContent));
    check('a helper shows under its agent, with its own state and task', await until(v2.page, () => { const h = document.querySelector('[data-o-agent="ana-claude"]')?.closest('li')?.querySelector('.o-helpers'); return !!h && /ui-worker/.test(h.innerText) && /working/.test(h.innerText) && /Helper task/.test(h.innerText); }));
    check('a person whose one agent has their name is a single row (no heading)', await until(v2.page, () => !!document.querySelector('[data-o-agent="carol"]') && ![...document.querySelectorAll('#o-agents .o-pn')].some((p) => /carol/.test(p.textContent))));
    for (const [w, h, theme] of [[1440, 900, 'dusk'], [1440, 900, 'day'], [1366, 768, 'dusk']]) {
      await v2.page.evaluate((t) => setTheme(t), theme);
      await v2.page.setViewport({ width: w, height: h }); await sleep(800);
      await v2.page.screenshot({ path: path.join(out, `office-${w}-${theme}.png`) });
    }
    await v2.page.close();

    // The office code can't be fetched (offline): a note, and the board stays.
    const off = await open('/', { errs: [] }); // the refused request logs an error: expected here
    await off.page.setRequestInterception(true);
    off.page.on('request', (r) => (/\/office\/embed\.js/.test(r.url()) ? r.abort() : r.continue()));
    await off.page.click('#vseg [data-vset="office"]');
    check('office code fails to load: back on the board with a note', await until(off.page, () => document.documentElement.dataset.boardView === 'board' && /didn't load/.test(document.getElementById('toasts').innerText)));
    await off.page.close();
  }
  if (!page.isClosed()) await page.close().catch(() => {});

  // ---- No WebGL: the board stays, with a message, and the switch goes away ----
  const ng = await open('/', { setup: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, o) { return /webgl/.test(k) ? null : g.call(this, k, o); }; } });
  await ng.page.click('#vseg [data-vset="office"]');
  check('WebGL unavailable: stays on the board with a message', await until(ng.page, () => document.documentElement.dataset.boardView === 'board' && /can't show the 3D office/.test(document.getElementById('toasts').innerText)));
  check('WebGL unavailable: the switch hides, nothing 3D downloaded', await ng.page.$eval('#vseg', (g) => g.hidden) && officeReqs(ng.reqs).length === 0, officeReqs(ng.reqs).join(' '));
  await ng.page.close();
  const ng2 = await open('/?view=office', { setup: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, o) { return /webgl/.test(k) ? null : g.call(this, k, o); }; } });
  check('WebGL unavailable with ?view=office: the board, with the message', await view(ng2.page) === 'board' && await until(ng2.page, () => /can't show the 3D office/.test(document.getElementById('toasts').innerText)));
  await ng2.page.close();

  // ---- Phones: no switch, and ?view=office stays on the board ----
  const ph = await open('/?view=office', { phone: true });
  check('phone: the switch is hidden', !(await shown(ph.page, '#vseg')));
  check('phone: ?view=office stays on the board, nothing 3D loaded', await view(ph.page) === 'board' && officeReqs(ph.reqs).length === 0);
  await ph.page.close();

  // ---- The presenter link moved into the help dialog (one way into the scene from the header) ----
  const pr = await open('/');
  await until(pr.page, () => !document.getElementById('present-link').hidden);
  const ph1 = await pr.page.$eval('#present-link', (a) => a.getAttribute('href'));
  check('#present-link (in the help dialog) opens present.html with the viewer token', /\/present\.html\?token=/.test(ph1) && !ph1.includes(TOKEN) && await pr.page.$eval('#present-link', (a) => !!a.closest('#help-dlg') && !document.querySelector('#app > header #present-link')), ph1);
  await pr.page.close();

  check('no console errors', !errors.length, errors.join('; '));
} catch (e) {
  R.push(`CRASH ${e.stack || e.message}`);
}
await finish(R, { browser, board });
