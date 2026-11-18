// The live 3D office behind the board, and the header's 3D switch (on / off), built from office/src/live/embed.ts
// into public/office/embed.js by `npm run build:present`. 3D is on by default: the office draws the state the board
// already loads, always live behind the page, with the panels floating over it as glass where the Board view has
// them: Needs attention (left) and Agents with Activity and File locks (right) from the top to the foot, the top bar
// at the top between them, and the task board under the top bar. The task board is docked as a window with the room
// below it (the default, and how turning 3D on opens), expanded down to the foot over the room (its bottom edge
// sliding between the two), or folded to its title bar. The 3D switch moves nothing. 3D off is the plain board (no
// office code), also on windows up to 1100px wide. The header (clock, theme) stays above every panel. The room is
// framed in the space the panels leave free. Works with or without WebGL:
// Chrome runs with SwiftShader so CI runners without a GPU still get it; without WebGL it's the plain board, with a note.
// Pages here open with 3D off (the test helper's default) unless a check says otherwise.
// Run all suites with: npm test
import path from 'node:path';
import { startBoard, launchBrowser, shotsDir, finish, agent, rest, TOKEN } from '../helpers.mjs';

const board = await startBoard();
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const human = (p, method = 'GET', body) => rest(board, 'dana', p, method, body);

await human('/settings', 'PUT', { goal: 'A voting app for hackathon projects: teams submit, everyone votes, and a live leaderboard runs on the big screen', deadline: Date.now() + 3 * 3600e3, freeze_minutes: 60 });
const ana = await agent(board, 'ana-claude'); await ana('board_status');
const t1 = await ana('create_task', { title: 'Vote API', size: 'S' });
const t2 = await ana('create_task', { title: 'Leaderboard page' });
await ana('claim_task', { id: t1.id }); await ana('update_task', { id: t1.id, status: 'in_progress' });
await ana('ask_human', { question: 'Which login provider?' });
await ana('post', { text: '@dana the vote API is up' }); // a mention badge in the header too
await ana('lock_files', { paths: ['package.json'], reason: 'adding deps' }); // a file lock for the File locks panel

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 900 }, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = shotsDir('office-toggle');
const errors = [];
const until = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, { timeout, polling: 100 }, arg).then(() => true).catch(() => false);
const view = (page) => page.evaluate(() => document.documentElement.dataset.boardView);
const shown = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !!(e.offsetWidth || e.offsetHeight); }, sel);
// Each page in its own browser context: its own localStorage, like a separate browser.
async function open(url = '/', { phone = false, vp, setup, errs = errors } = {}) {
  const page = await (await browser.createBrowserContext()).newPage();
  const reqs = [];
  page.on('request', (r) => reqs.push(r.url()));
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  if (phone) await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  if (vp) await page.setViewport(vp);
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); localStorage.setItem('board-setup', 'closed'); } catch {} });
  if (setup) await page.evaluateOnNewDocument(setup);
  await page.goto(board.base + url);
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
  await sleep(200);
  return { page, reqs };
}
const officeReqs = (reqs) => reqs.filter((u) => /\/office\//.test(u));
// Click something that folds or opens a panel and follow the panels' heights every frame while they move: the motion
// runs (an animation mid-way, heights strictly between start and end), lands on the final size, and nothing changes
// after it lands (no snap at the end).
const foldRun = (page, sel, ids) => page.evaluate(async (sel, ids) => {
  const hs = () => ids.map((i) => Math.round(document.getElementById(i).getBoundingClientRect().height));
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const h0 = hs();
  const el = document.querySelector(sel); if (el.matches('button')) el.focus(); el.click(); // as a real click: a button takes focus
  const anims = document.getAnimations().filter((a) => a.id === 'glide').length;
  const seen = []; const t0 = performance.now();
  while (document.getAnimations().some((a) => a.id === 'glide') && performance.now() - t0 < 3000) { seen.push(hs()); await frame(); }
  const end = hs(); await frame(); await frame();
  const later = hs();
  const between = seen.some((h) => h.some((x, i) => (x - h0[i]) * (x - end[i]) < -4)); // a frame part-way for some panel
  return { anims, frames: seen.length, ms: Math.round(performance.now() - t0), between, h0, end, later, snap: end.some((x, i) => Math.abs(x - later[i]) > 1) };
}, sel, ids);

try {
  // ---- Default (nothing saved in this browser): 3D on, the board docked over the live room ----
  const d0 = await open('/', { setup: () => { try { localStorage.removeItem('agent-board-3d'); } catch {} } });
  const webgl = await d0.page.evaluate(() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; } });
  if (webgl) {
    check('by default 3D is on: the office loads with the page and draws behind it', await view(d0.page) === 'office' && await until(d0.page, () => !!document.querySelector('#office-scene canvas') && !document.getElementById('office-view').classList.contains('loading'), null, 20000) && officeReqs(d0.reqs).some((u) => /embed\.js/.test(u)) && await d0.page.$eval('#o3d', (b) => b.getAttribute('aria-pressed') === 'true'));
    const ex = await d0.page.evaluate(() => { const t = $('o-tasks').getBoundingClientRect(), tb = $('topbar').getBoundingClientRect(), l = $('o-left').getBoundingClientRect(), r = $('o-rcol').getBoundingClientRect(), v = $('office-view').getBoundingClientRect(); return { max: $('o-tasks').classList.contains('max'), folded: $('o-tasks').classList.contains('folded'), inWin: $('o-tasks-b').contains($('board')), under: t.top - tb.bottom, room: v.bottom - t.bottom, between: t.left >= l.right && t.right <= r.left, glass: getComputedStyle($('o-tasks')).backgroundColor, fps: office.fps }; });
    check('the board starts docked: the Tasks window under the top bar, between the side columns, as glass, the room in view below it and drawing at its full rate', !ex.max && !ex.folded && ex.inWin && ex.under >= 0 && ex.under < 16 && ex.room > 250 && ex.between && /(,|\/)\s*0?\.\d+\)$/.test(ex.glass) && ex.fps === 30, JSON.stringify(ex));
    const geo = await d0.page.evaluate(() => { const tb = $('topbar').getBoundingClientRect(), l = $('o-left').getBoundingClientRect(), r = $('o-rcol').getBoundingClientRect(), v = $('office-view').getBoundingClientRect(), tk = (n) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)), edge = tk('--edge'), gut = tk('--gutter');
      return { between: Math.abs(tb.left - l.right - gut) < 1 && Math.abs(r.left - tb.right - gut) < 1, top: [l.top, r.top, tb.top].every((b) => Math.abs(b - (v.top + edge)) < 1), foot: Math.abs(r.bottom - (v.bottom - edge)) < 1, sides: Math.abs(l.left - edge) < 1 && Math.abs(innerWidth - r.right - edge) < 1 }; });
    check('the top bar sits at the top between the side columns (as with 3D off), --gutter from each; the side columns run from the top to the foot, --edge from the window edges', geo.between && geo.top && geo.foot && geo.sides, JSON.stringify(geo));
  }
  await d0.page.close();

  // ---- 3D off (the plain board), as the test pages open ----
  const { page, reqs } = await open('/');
  check('3D off: the plain board, nothing 3D loaded', await view(page) === 'board' && await shown(page, '#board') && !(await shown(page, '#office-view')) && officeReqs(reqs).length === 0);
  check('the 3D switch sits in the header right after the brand: one button, off (not pressed)', await page.evaluate(() => {
    const b = document.getElementById('o3d');
    const h1 = document.querySelector('#app > header h1').getBoundingClientRect(); const v = b.getBoundingClientRect();
    return !b.hidden && b.closest('header') && v.left - h1.right < 40 && b.getAttribute('aria-pressed') === 'false' && b.getAttribute('aria-label') === '3D office' && !document.getElementById('vseg');
  }));

  // ---- Header stays on one row with the switch and the theme button (ONB-9 widths), also with the "need attention" badge ----
  // On a laptop What to do now stays in view in its rail, so the badge only shows once it's scrolled out of view (a
  // long rail, or one column): show it here as it is then.
  for (const w of [1366, 1440, 1600, 1920]) {
    await page.setViewport({ width: w, height: 900 }); await sleep(300);
    await page.evaluate(() => { nowSeen = false; syncNeeds(); }); await sleep(100);
    const hd = await page.evaluate(() => { const h = document.querySelector('#app > header'); const v = $('o3d').getBoundingClientRect(); const b = $('help-btn').getBoundingClientRect(); const n = $('needs'); return { h: h.offsetHeight, same: Math.abs(v.top - b.top) < 12, vis: v.width > 0, badge: !n.hidden && n.offsetWidth > 0 && /question/.test(n.querySelector('button')?.getAttribute('aria-label') || '') && !document.querySelector('#app > header #clock') && Math.abs($('theme-btn').getBoundingClientRect().top - b.top) < 2 }; });
    check(`${w}px: header on one row with the view switch, the theme button and the need-you badge (the demo time is a top bar chip)`, hd.vis && hd.same && hd.h < 70 && hd.badge, JSON.stringify(hd));
  }
  await page.reload(); await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 }); await sleep(300);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
  check('the need-you badge hides while What to do now is on screen (in its rail, also with the board scrolled)', await page.$eval('#needs', (n) => n.hidden));
  await page.setViewport({ width: 1440, height: 900 }); await sleep(200);

  // ---- PLANNER and MERGES: two top bar chips from 1600px, one ROLES chip below it; each choice made in place ----
  // The top bar's chips, as the eye sees them: label, width, and whether any of them runs past the bar's right edge.
  const topbar = () => page.evaluate(() => {
    const tb = $('topbar').getBoundingClientRect(); const g = $('goal-btn').getBoundingClientRect(); const gx = $('goal-btn').querySelector('.o-x');
    const vis = [...$('topbar').querySelectorAll('.tbc')].filter((c) => c.offsetWidth);
    return { h: $('topbar').offsetHeight, row: vis.every((c) => Math.abs(c.getBoundingClientRect().top - g.top) < 4), over: vis.filter((c) => c.getBoundingClientRect().right > Math.min(tb.right, innerWidth) + 0.5).map((c) => c.className),
      chips: vis.map((c) => c.querySelector('.tbl')?.textContent || 'Setup').join(), goalPx: Math.round(gx.getBoundingClientRect().width), goalCut: gx.scrollWidth > gx.clientWidth + 1, sw: document.documentElement.scrollWidth <= innerWidth };
  });
  for (const w of [1280, 1440, 1920]) {
    await page.setViewport({ width: w, height: 900 }); await sleep(250);
    const tb = await topbar();
    const want = w < 1600 ? 'Goal,Demo,Done,Roles,Setup' : 'Goal,Demo,Done,Planner,Merges,Setup';
    // About 20 characters of the goal at least (16ch of this font is ~115px); a goal that fits isn't cut at all.
    check(`${w}px: the top bar is one row, nothing past its right edge, the goal readable (${w < 1600 ? 'one Roles chip' : 'Planner and Merges chips'})`, tb.h < 56 && tb.row && !tb.over.length && tb.sw && tb.chips === want && (tb.goalPx >= 115 || !tb.goalCut), JSON.stringify(tb));
  }
  await page.setViewport({ width: 1600, height: 900 }); await sleep(200);
  check('Board view, 1600px: a Planner chip right before the Merges chip, no Roles chip', await page.evaluate(() => { const p = $('plan-btn'); return !!p?.offsetWidth && p.nextElementSibling === $('merge-btn') && p.querySelector('.tbl').textContent === 'Planner' && p.getAttribute('aria-expanded') === 'false' && p.getAttribute('aria-controls') === 'o-plan' && !$('roles-btn').offsetWidth; }));
  await page.click('#plan-btn');
  check('the Planner chip opens the planner in place, focus on the choice', await page.evaluate(() => !$('o-plan').hidden && document.activeElement === $('o-plan-sel') && $('plan-btn').getAttribute('aria-expanded') === 'true' && !!$('o-pex-sel') && $('o-plan-h').textContent === 'Planner'));
  const pick = await page.evaluate(() => [...$('o-plan-sel').options].map((o) => o.value).find((v) => v && v !== state.settings.planner));
  await page.select('#o-plan-sel', pick || '');
  check('choosing there saves it (S.planner) and the chip says the name', await until(page, (n) => state.settings.planner === n && document.getElementById('plan-btn').textContent.includes(n || 'first agent'), pick || ''), pick);
  await page.focus('#o-plan-sel'); await page.keyboard.press('Escape');
  check('Esc closes the Planner popover, focus back on the chip', await until(page, () => document.getElementById('o-plan').hidden && document.activeElement?.id === 'plan-btn' && document.getElementById('plan-btn').getAttribute('aria-expanded') === 'false'));
  await page.click('#plan-btn'); await page.click('#merge-btn');
  check('one top bar popover at a time: opening Merges closes Planner', await page.evaluate(() => $('o-plan').hidden && !$('o-merge').hidden));
  await page.keyboard.press('Escape'); await page.click('#plan-btn'); await page.mouse.click(4, 30);
  check('a click elsewhere closes the Planner popover', await page.evaluate(() => $('o-plan').hidden && $('plan-btn').getAttribute('aria-expanded') === 'false'));
  // ROLES (below 1600px): the planner's and the merger's names in one chip, both choices in one popover.
  await page.setViewport({ width: 1440, height: 900 }); await sleep(250);
  check('1440px: one Roles chip (the planner and who merges, full names in its tooltip and label) where Planner and Merges were', await page.evaluate(() => { const r = $('roles-btn'); return !!r.offsetWidth && !$('plan-btn').offsetWidth && !$('merge-btn').offsetWidth && r.nextElementSibling === $('plan-btn') && r.querySelector('.tbl').textContent === 'Roles' && r.querySelectorAll('.rn').length === 2 && r.textContent.includes(state.settings.planner || 'first agent') && r.title.includes('Planner: ') && r.title.includes('Merges to main: ') && /^Roles\. Planner: .+\. Merges to main: .+\. Choose the planner and who merges$/.test(r.getAttribute('aria-label')) && r.getAttribute('aria-expanded') === 'false' && r.getAttribute('aria-controls') === 'o-roles'; }), await page.$eval('#roles-btn', (r) => r.getAttribute('aria-label')));
  await page.$eval('#roles-btn', (b) => b.click());
  check('the Roles chip opens one popover with both choices (planner + extra tasks, who merges), focus on the planner', await page.evaluate(() => !$('o-roles').hidden && $('o-roles-h').textContent === 'Roles' && document.activeElement === $('r-plan-sel') && !!$('r-pex-sel') && !!$('r-integ-sel') && $('roles-btn').getAttribute('aria-expanded') === 'true' && $('o-plan').hidden && $('o-merge').hidden));
  const rPick = await page.evaluate(() => [...$('r-plan-sel').options].map((o) => o.value).find((v) => v !== state.settings.planner));
  await page.select('#r-plan-sel', rPick);
  check('choosing the planner there saves it, the Roles chip says the name, the popover stays open', await until(page, (n) => state.settings.planner === n && document.getElementById('roles-btn').textContent.includes(n || 'first agent') && !document.getElementById('o-roles').hidden, rPick), rPick);
  await page.select('#r-pex-sel', '3');
  check('the planner\'s extra tasks are saved from there too', await until(page, () => Number(state.settings.planner_extra) === 3));
  await page.select('#r-integ-sel', 'ana-claude');
  check('choosing who merges there saves it; the Roles chip says the name', await until(page, () => state.settings.integrator === 'ana-claude' && document.querySelectorAll('#roles-btn .rn')[1]?.textContent.includes('ana-claude') && /Merges to main: ana-claude/.test(document.getElementById('roles-btn').getAttribute('aria-label'))));
  await page.focus('#r-integ-sel'); await page.keyboard.press('Escape');
  check('Esc closes the Roles popover, focus back on the Roles chip', await until(page, () => document.getElementById('o-roles').hidden && document.activeElement?.id === 'roles-btn' && document.getElementById('roles-btn').getAttribute('aria-expanded') === 'false'));
  await page.$eval('#roles-btn', (b) => b.click()); await page.click('[data-o-close="roles"]');
  check('its × closes it, focus back on the chip', await page.evaluate(() => $('o-roles').hidden && document.activeElement === $('roles-btn')));
  await page.$eval('#roles-btn', (b) => b.click()); await page.click('#clock');
  check('one top bar popover at a time: opening the demo time closes Roles', await page.evaluate(() => $('o-roles').hidden && !$('o-dl').hidden && $('roles-btn').getAttribute('aria-expanded') === 'false'));
  await page.keyboard.press('Escape'); await page.$eval('#roles-btn', (b) => b.click()); await page.mouse.click(4, 30);
  check('a click elsewhere closes the Roles popover', await page.evaluate(() => $('o-roles').hidden && $('roles-btn').getAttribute('aria-expanded') === 'false'));

  // ---- Turn 3D on: the top bar, the side panels and the task board stay where they are ----
  const places = () => page.evaluate(() => {
    const R = (e) => { if (!e || !e.offsetWidth) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(Math.round); };
    return { topbar: R($('topbar')), left: R($('o-left')), right: R($('o-right')), act: R($('o-act')), locks: R($('o-locks')), board: R($('board')), tasks: R($('o-tasks')) };
  });
  // One edge and one gutter, in both views: the panels --edge from the window's sides, under the header and at the
  // foot, --gutter apart (columns and the right column's stack); a full Needs attention ends where the right column does.
  const layout = () => page.evaluate(async () => {
    const tk = (n) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)), edge = tk('--edge'), gut = tk('--gutter');
    const R = (e) => e.getBoundingClientRect(), near = (a, b) => Math.abs(a - b) < 1;
    const hdr = R(document.querySelector('#app > header')).bottom, tb = R($('topbar'));
    const rs = [...$('o-rcol').children].filter((e) => e.offsetWidth).map(R);
    const tall = document.createElement('div'); tall.style.height = '3000px'; $('o-blocked').append(tall);
    await new Promise((r) => requestAnimationFrame(r)); const l = R($('o-left')); tall.remove();
    return { edge: near(l.left, edge) && rs.every((r) => near(innerWidth - r.right, edge)) && [l.top, tb.top, rs[0].top].every((t) => near(t - hdr, edge)) && near(innerHeight - rs.at(-1).bottom, edge),
      gutter: near(tb.left - l.right, gut) && near(rs[0].left - tb.right, gut) && rs.slice(1).every((r, i) => near(r.top - rs[i].bottom, gut)),
      ends: near(l.bottom, rs.at(-1).bottom), edgeGut: [edge, gut], l: [l.left, l.top, l.right, l.bottom].map(Math.round), r: rs.map((r) => [r.left, r.top, r.right, r.bottom].map(Math.round)), tb: [tb.left, tb.top, tb.right].map(Math.round) };
  });
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(100);
  const lay0 = await layout();
  check('3D off: panels --edge from the window\'s sides, the header and the foot; --gutter between the columns and between Agents, Activity and File locks', lay0.edge && lay0.gutter, JSON.stringify(lay0));
  check('3D off: a full Needs attention ends at the same height as the right column', lay0.ends, JSON.stringify(lay0));
  // Setup is a panel like the others: the same title bar (height, label, rule, x where the fold buttons are).
  const headOf = (sel) => page.evaluate((s) => { const p = document.querySelector(s), h = p.querySelector(':scope > .o-head'), t = h.querySelector('h2'), b = h.querySelector('.o-ib:last-of-type'), cs = getComputedStyle(h), ts = getComputedStyle(t);
    return { h: h.offsetHeight, font: ts.font, ls: ts.letterSpacing, tt: ts.textTransform, color: ts.color, rule: cs.borderBottomWidth + ' ' + cs.borderBottomStyle + ' ' + cs.borderBottomColor, x: Math.round(p.getBoundingClientRect().right - b.getBoundingClientRect().right), shadow: getComputedStyle(p).boxShadow }; }, sel);
  await page.click('[data-fk="s-open"]'); await until(page, () => !$('setup').hidden);
  const [sh, ah] = [await headOf('#setup'), await headOf('#o-act')];
  check('Setup\'s title bar is the panels\' own: height, label, rule, its x where their buttons are, the same shadow', JSON.stringify(sh) === JSON.stringify(ah), JSON.stringify({ sh, ah }));
  await page.keyboard.press('Escape'); await until(page, () => $('setup').hidden);
  // Columns and Table are both Tab stops (like Activity's tabs); "/" opens Activity when it's folded.
  check('Columns and Table are both in the Tab order', await page.evaluate(() => [...$('viewtog').querySelectorAll('button')].every((b) => b.tabIndex === 0)));
  await page.click('#o-act-fold'); await until(page, () => $('o-act').classList.contains('folded'));
  await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('/');
  check('"/" with Activity folded: Activity opens, focus in the message box', await until(page, () => !$('o-act').classList.contains('folded') && document.activeElement === $('msg')));
  await page.evaluate(() => document.activeElement?.blur());
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(100);
  const before = await places();
  await page.click('#o3d');
  if (!webgl) {
    check('no WebGL in this browser: stays on the board with a note (office checks skipped)', await until(page, () => document.documentElement.dataset.boardView === 'board' && /3D office/.test(document.getElementById('toasts').innerText)));
  } else {
    check('the switch turns 3D on in place (pressed)', await view(page) === 'office' && await page.$eval('#o3d', (b) => b.getAttribute('aria-pressed') === 'true'));
    check('the switch is announced politely', await until(page, () => /3D office on/.test(document.getElementById('announcer').textContent)));
    check('turning it on loads the office chunk and draws a canvas', await until(page, () => !!document.querySelector('#office-scene canvas'), null, 20000) && officeReqs(reqs).some((u) => /embed\.js/.test(u)) && officeReqs(reqs).some((u) => /OfficeScene-/.test(u)), officeReqs(reqs).map((u) => u.split('/').pop()).join(' '));
    check('loading note gone once it is ready', await until(page, () => !document.getElementById('office-view').classList.contains('loading')));
    check('turning 3D on opens with the board docked (the room in view), its task bar as the window\'s title bar', await page.evaluate(() => !$('o-tasks').classList.contains('max') && !$('o-tasks').classList.contains('folded') && $('board').offsetHeight > 150 && $('o-tasks-max').getAttribute('aria-pressed') === 'false' && $('o-tasks-head').contains($('b-h')) && !!$('b-h').offsetWidth && office.fps === 30));
    // The switch moves nothing: the top bar and the side panels exactly where they were; the task board's window where
    // its columns were (its frame, title bar and padding hold the columns a few pixels in).
    const after = await places();
    const near = (a, b, d = 2) => !!a && !!b && a.every((x, i) => Math.abs(x - b[i]) <= d);
    check('the 3D switch moves nothing: the top bar, Needs attention, Agents, Activity and File locks in the same places; the Tasks window where the board was', near(after.topbar, before.topbar) && near(after.left, before.left) && near(after.right, before.right) && near(after.act, before.act) && near(after.locks, before.locks)
      && Math.abs(after.tasks[0] - before.board[0]) <= 2 && Math.abs(after.tasks[2] - before.board[2]) <= 2 && Math.abs(after.board[1] - before.board[1]) <= 8, JSON.stringify({ before, after }));
    const share = await page.evaluate(() => {
      const v = $('office-view').getBoundingClientRect(); let n = 0, hit = 0;
      for (let x = 0.02; x < 1; x += 0.04) for (let y = 0.02; y < 1; y += 0.04) { n++; if (document.elementFromPoint(v.left + v.width * x, v.top + v.height * y)?.closest('#office-scene')) hit++; }
      return hit / n;
    });
    check('docked, the room gets close to half of the 3D view', share >= 0.44, share.toFixed(3));
    const lay1 = await layout();
    check('3D: the same --edge and --gutter as 3D off; a full Needs attention ends where the right column does', lay1.edge && lay1.gutter && lay1.ends && JSON.stringify([lay1.l, lay1.r, lay1.tb]) === JSON.stringify([lay0.l, lay0.r, lay0.tb]), JSON.stringify({ lay0, lay1 }));
    // Focus rings inside the Tasks window's scrolling lists and Activity's filter row aren't cut by their edges.
    const ring = (sel) => page.evaluate((s) => { const e = document.querySelector(s); e.focus(); const cs = getComputedStyle(e), o = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth), r = e.getBoundingClientRect();
      let ok = e.matches(':focus-visible') && cs.outlineStyle !== 'none';
      for (let p = e.parentElement; p; p = p.parentElement) { const ps = getComputedStyle(p); if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue; const q = p.getBoundingClientRect(); ok &&= r.left - o >= q.left - 0.5 && r.right + o <= q.right + 0.5 && r.top - o >= q.top - 0.5; }
      e.blur(); return ok; }, sel);
    await page.keyboard.press('Shift');
    check('3D: focus rings on a card in the Tasks window and on Activity\'s first filter are whole (not cut by their scrolling lists)', await ring('#o-tasks .card') && await ring('#tabs button'));
    // The board's own button expands it down over the room and back: its top stays under the top bar, only its bottom
    // edge moves (one animation on the window itself, no copy of the board), and the room draws at its full rate.
    const slideTo = (dir) => page.evaluate(async (dir) => {
      const tw = $('o-tasks'), top0 = tw.getBoundingClientRect().top, ys = [];
      $('o-tasks-max').click();
      const anims = tw.getAnimations().length, copies = document.querySelectorAll('#board').length;
      const t0 = performance.now();
      while (tw.getAnimations().length && performance.now() - t0 < 3000) { ys.push(Math.round(tw.getBoundingClientRect().bottom)); await new Promise((r) => requestAnimationFrame(r)); }
      const steady = ys.every((t, i) => !i || (dir === 'down' ? t >= ys[i - 1] - 1 : t <= ys[i - 1] + 1));
      return { anims, copies, frames: ys.length, ms: Math.round(performance.now() - t0), steady, first: ys[0], end: Math.round(tw.getBoundingClientRect().bottom), topKept: Math.abs(tw.getBoundingClientRect().top - top0) < 1, max: tw.classList.contains('max'), fps: office.fps, label: $('o-tasks-max').getAttribute('aria-label') };
    }, dir);
    const down = await slideTo('down');
    check('the board\'s button expands it: one animation of its bottom edge, steadily down to the foot, its top kept, about a quarter of a second, no second board; the room at its full rate', down.anims === 1 && down.copies === 1 && down.steady && down.frames >= 3 && down.ms < 1500 && down.end > down.first + 100 && down.topKept && down.max && down.fps === 30 && down.label === 'Dock Tasks to show the room', JSON.stringify(down));
    const up = await slideTo('up');
    check('and docks it again: its bottom edge steadily up, the room back in view', up.anims === 1 && up.steady && up.frames >= 3 && up.end < up.first - 100 && up.topKept && !up.max && up.fps === 30 && up.label === 'Expand Tasks over the room', JSON.stringify(up));
    check('no Progress toggle: no bottom chips at all', await page.evaluate(() => !document.querySelector('.o-bot, #o-prog-chip, #o-act-chip, #o-chat-chip')));
    check('no copy of the board anywhere (one board, moved, never two at once)', await page.evaluate(() => !document.querySelector('.vt-ghost') && document.querySelectorAll('#board').length === 1 && getComputedStyle($('o-tasks')).visibility === 'visible'));
    await page.click('#o-tasks-fold');
    check('the fold button in the Tasks title bar folds it to its title bar under the top bar', await until(page, () => { const t = $('o-tasks').getBoundingClientRect(), tb = $('topbar').getBoundingClientRect(); return $('o-tasks').classList.contains('folded') && !$('board').offsetHeight && $('o-tasks-fold').getAttribute('aria-expanded') === 'false' && t.top - tb.bottom >= 0 && t.top - tb.bottom < 16 && t.height < 70; }));
    await page.click('#o-tasks-fold'); await until(page, () => !document.getAnimations().some((a) => a.id === 'glide'));
    check('the button in the Tasks title bar opens the window (docked, as it was)', await page.evaluate(() => !$('o-tasks').classList.contains('folded') && $('o-tasks-b').contains($('board')) && $('board').offsetHeight > 50 && $('o-tasks-fold').getAttribute('aria-expanded') === 'true'));
    check('the room fills the window under the header; the Board view centre is hidden (its tasks are in the Tasks window); no scrolling', await page.evaluate(() => { const r = $('office-view').getBoundingClientRect(); const h = document.querySelector('#app > header').getBoundingClientRect(); return Math.abs(r.top - h.bottom) < 3 && Math.abs(r.bottom - innerHeight) < 2 && r.width === innerWidth && !$('boardwrap').offsetWidth && $('o-tasks-b').contains($('board')) && document.documentElement.scrollHeight <= innerHeight + 1; }));
    const lay = await page.evaluate(() => {
      const R = (id) => { const e = document.getElementById(id); return e && !e.hidden && e.offsetWidth ? e.getBoundingClientRect() : null; };
      const hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const [l, r, a, t, top, k] = [R('o-left'), R('o-right'), R('o-act'), R('o-tasks'), $('topbar').getBoundingClientRect(), R('o-locks')];
      const v = $('office-view').getBoundingClientRect();
      // The middle of the room is clear: nothing but the scene at the centre, and a third of the width around it.
      const mid = [[0.5, 0.62], [0.4, 0.62], [0.6, 0.62], [0.5, 0.72]].every(([x, y]) => !!document.elementFromPoint(v.left + v.width * x, v.top + v.height * y)?.closest('#office-scene'));
      // Activity sits in the right column under Agents: same width, below it.
      const col = r && a && k && Math.abs(r.left - a.left) < 2 && Math.abs(r.right - a.right) < 2 && a.top >= r.bottom && Math.abs(k.left - a.left) < 2 && k.top >= a.bottom;
      return { docks: !!(l && r && a && t && k), col, apart: !hit(l, t) && !hit(r, t) && !hit(a, t) && !hit(k, t) && !hit(l, r) && !hit(l, a) && !hit(r, a) && !hit(top, l) && !hit(top, r) && !hit(top, t), mid, inside: [l, r, a, t, k].every((x) => x && x.left >= v.left && x.right <= v.right && x.top >= v.top && x.bottom <= v.bottom) };
    });
    check('docks, Activity and File locks under Agents, the top bar and the Tasks window are there, apart from each other, inside the room, the middle clear', lay.docks && lay.col && lay.apart && lay.mid && lay.inside, JSON.stringify(lay));
    check('Needs attention (left dock) holds What to do now and the questions, with Answer', await page.evaluate(() => !!$('o-left').contains($('now')) && $('o-left').contains($('q-panel'))) && await shown(page, '#q-panel textarea') && /Which login provider/.test(await page.$eval('#q-panel', (e) => e.innerText)));
    const dock = await page.evaluate(() => { const f = $('questions').querySelector('form'); const ta = f.querySelector('textarea').getBoundingClientRect(); const b = f.querySelector('button').getBoundingClientRect(); return { sub: $('o-left-n').title, badge: $('needs').querySelector('button')?.title, phases: !$('o-left').querySelector('.phases'), row: Math.abs(ta.top - b.top) < 12 && b.left > ta.right - 2 }; });
    check('Needs attention: its counts (the same words and count as the need-you badge, its folded title bar\'s tooltip), no phase track (the Demo popover has it), the answer box and Answer on one row', /1 question/.test(dock.sub) && dock.sub === dock.badge && dock.phases && dock.row, JSON.stringify(dock));
    check('Agents (right dock): people, then their agents with tool dot, state and current task', await until(page, () => { const b = document.querySelector('[data-o-agent="ana-claude"]'); return b && $('o-right').contains(b) && !!b.querySelector('.tdot') && /asked you a question|#\d+ Vote API/.test(b.innerText) && /\bana\b/.test($('o-agents').innerText); }), await page.$eval('#o-agents', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => ''));
    // The row and the room say the same thing: a question is "Question" in both, boxed; working is a plain word.
    const st = await page.evaluate(() => { const s = document.querySelector('[data-o-agent="ana-claude"] .o-st'); return { word: s.textContent, boxed: s.classList.contains('bx'), bubble: window.__officeState?.agents.find((a) => a.id === 'ana-claude')?.bubble, badges: [...document.querySelectorAll('#o-agents .o-st.bx')].map((x) => x.textContent) }; });
    check('an agent waiting on an answer: "Question" badge in its row, the same word as its bubble in the room', st.word === 'Question' && st.boxed && st.bubble === 'Question', JSON.stringify(st));
    check('only Question / Blocked / Out of usage get a badge', st.badges.every((w) => ['Question', 'Blocked', 'Out of usage'].includes(w)), JSON.stringify(st.badges));
    check('the Agents count uses the board\'s rule and words ("N online", out of usage apart)', await page.evaluate(() => $('o-right-sub').textContent === `${setupInfo().onlineA.length} online` && $('o-right-sub').title.startsWith(agentsLine(setupInfo(), true))), await page.$eval('#o-right-sub', (e) => e.textContent));
    check('Tasks window: the board itself (one board, moved in), its five columns and their cards', await page.evaluate(() => {
      const c = [...document.querySelectorAll('#o-tasks-b #board > .col')];
      return !!$('o-tasks-b').querySelector('#board') && !document.getElementById('o-cols') && c.length === 5 && c.map((x) => x.dataset.status).join() === 'open,in_progress,blocked,review,done' && /Vote API/.test(c[1].innerText) && /Leaderboard page/.test(c[0].innerText);
    }), await page.evaluate(() => [...document.querySelectorAll('#o-tasks-b .col')].map((x) => x.dataset.status).join(' ')));
    check('Tasks: one Tab stop per column (the board\'s model)', await page.evaluate(() => [...document.querySelectorAll('#o-tasks-b .col')].every((c) => { const k = [...c.querySelectorAll('.card')]; return !k.length || k.filter((x) => x.tabIndex === 0).length === 1; })));
    check('Tasks: a long column scrolls inside the window (the window keeps its size)', await page.evaluate(() => { const w = $('o-tasks').getBoundingClientRect(); return [...document.querySelectorAll('#o-tasks-b .col')].every((c) => c.getBoundingClientRect().bottom <= w.bottom + 1); }));
    const tb = await page.evaluate(() => ({ t: $('topbar').innerText.replace(/\s+/g, ' '), roles: !!$('topbar').querySelector('.tb-roles')?.offsetWidth, inv: !$('topbar').querySelector('[data-act="invite"]'), setup: !!$('topbar').querySelector('[data-fk="s-open"]')?.offsetWidth, actChips: [...$('topbar').querySelectorAll('.acts button')].every((b) => b.classList.contains('tbc') && b.offsetHeight === $('goal-btn').offsetHeight), clock: !!$('clock').offsetWidth && $('topbar').contains($('clock')) && /Demo in/.test($('clock').textContent), rows: $('topbar').offsetHeight < 56,
      chips: [...$('topbar').querySelectorAll('.tbc:not(.tb-act)')].filter((c) => c.offsetWidth).map((c) => getComputedStyle(c.querySelector('.tbl')).color === getComputedStyle(document.documentElement).getPropertyValue('--muted').trim().replace(/^#(..)(..)(..)$/, (m, r, g, b) => `rgb(${[r, g, b].map((x) => parseInt(x, 16)).join(', ')})`) ? c.querySelector('.tbl').textContent : '!').join() }));
    check('the top bar is the Board view\'s: chips GOAL, DEMO, DONE, ROLES at 1440px (labels muted), then Setup as a chip (one row)', /GOAL A voting app/.test(tb.t) && /DONE 0 of 2/.test(tb.t) && /ROLES/.test(tb.t) && !/PLANNER|MERGES/.test(tb.t) && tb.chips === 'Goal,Demo,Done,Roles' && tb.roles && tb.inv && tb.setup && tb.actChips && tb.clock && tb.rows, JSON.stringify(tb));
    await page.click('#clock');
    check('the Demo chip opens the demo time in place (still the 3D view), focus in its time field', await view(page) === 'office' && await page.evaluate(() => !$('o-dl').hidden && document.activeElement === $('o-dl-in') && $('clock').getAttribute('aria-expanded') === 'true'));
    await page.$eval('#o-fz-in', (i) => { i.value = '45'; });
    await page.click('[data-fk="o-dl-save"]');
    check('saving it closes the popover, back on the clock, still in 3D; the board has the new freeze', await until(page, () => document.getElementById('o-dl').hidden && document.activeElement?.id === 'clock' && String(state.settings.freeze_minutes) === '45') && await view(page) === 'office');
    await page.click('#clock'); await page.keyboard.press('Escape');
    check('Esc closes the demo time popover, focus back on the Demo chip', await page.evaluate(() => $('o-dl').hidden && document.activeElement === $('clock')));
    // The top bar in 3D: one row, nothing past its edge, Roles below 1600px, Planner and Merges from there.
    for (const w of [1280, 1440, 1920]) {
      await page.setViewport({ width: w, height: 900 }); await sleep(300);
      const t3 = await topbar();
      check(`3D, ${w}px: the top bar is one row, nothing past its right edge, the goal readable`, t3.h < 56 && t3.row && !t3.over.length && t3.sw && t3.chips === (w < 1600 ? 'Goal,Demo,Done,Roles,Setup' : 'Goal,Demo,Done,Planner,Merges,Setup') && (t3.goalPx >= 115 || !t3.goalCut), JSON.stringify(t3));
    }
    // ROLES: both choices in one popover, the same in the 3D view.
    await page.setViewport({ width: 1280, height: 900 }); await sleep(300);
    await page.$eval('#roles-btn', (b) => b.click());
    check('3D: the Roles chip opens the planner and who merges in place, focus on the planner', await view(page) === 'office' && await page.evaluate(() => !$('o-roles').hidden && document.activeElement === $('r-plan-sel') && !!$('r-integ-sel') && $('roles-btn').getAttribute('aria-expanded') === 'true'));
    await page.select('#r-integ-sel', '');
    check('3D: choosing there saves it; the Roles chip says not picked', await until(page, () => state.settings.integrator === '' && /not picked/.test(document.querySelectorAll('#roles-btn .rn')[1]?.textContent || '')));
    await page.focus('#r-integ-sel'); await page.keyboard.press('Escape');
    check('3D: Esc closes it, focus back on the Roles chip', await until(page, () => document.getElementById('o-roles').hidden && document.activeElement?.id === 'roles-btn') && await view(page) === 'office');
    await page.setViewport({ width: 1600, height: 900 }); await sleep(300);
    // MERGES (from 1600px): who merges to main (and main's CI), chosen in place under the chip.
    await page.click('#merge-btn');
    check('the Merges chip opens who merges to main in place (still 3D), focus on the choice', await view(page) === 'office' && await page.evaluate(() => !$('o-merge').hidden && document.activeElement === $('o-integ-sel') && $('merge-btn').getAttribute('aria-expanded') === 'true'));
    await page.select('#o-integ-sel', '*');
    check('choosing there saves it; the chip says whoever is free', await until(page, () => state.settings.integrator === '*' && /whoever is free/.test(document.getElementById('merge-btn').textContent)));
    await page.focus('#o-integ-sel'); await page.keyboard.press('Escape');
    check('Esc closes it, focus back on the Merges chip', await until(page, () => document.getElementById('o-merge').hidden && document.activeElement?.id === 'merge-btn'));
    // PLANNER: the same in the 3D view.
    await page.click('#plan-btn');
    check('3D: the Planner chip (before Merges) opens the planner in place, focus on the choice', await view(page) === 'office' && await page.evaluate(() => $('plan-btn').nextElementSibling === $('merge-btn') && !$('o-plan').hidden && document.activeElement === $('o-plan-sel') && $('plan-btn').getAttribute('aria-expanded') === 'true'));
    await page.select('#o-plan-sel', '');
    check('3D: choosing "the first agent that starts" saves it; the chip says first agent', await until(page, () => state.settings.planner === '' && /first agent/.test(document.getElementById('plan-btn').textContent)));
    await page.focus('#o-plan-sel'); await page.keyboard.press('Escape');
    check('3D: Esc closes it, focus back on the Planner chip', await until(page, () => document.getElementById('o-plan').hidden && document.activeElement?.id === 'plan-btn') && await view(page) === 'office');
    await page.setViewport({ width: 1440, height: 900 }); await sleep(300);
    check('progress (x of y done, bar) in the top bar; chat lives in Activity, no separate Chat chip', await page.evaluate(() => $('topbar').contains($('done-count')) && !!$('done-count').querySelector('.mbar') && !$('o-chat-chip')));
    // File locks: the Board view's panel, folded to its title bar with the count, at the foot of the right column.
    check('3D: File locks under Activity, folded, with the count; opening it lists the lock with Release', await page.evaluate(() => $('o-rcol').contains($('o-locks')) && !!$('o-locks').offsetWidth && /1 held/.test($('l-count').textContent) && $('o-locks').classList.contains('folded') && !$('l-body').offsetHeight));
    const agentsH = await page.evaluate(() => $('o-right').getBoundingClientRect().height);
    await page.click('#l-tog');
    check('3D: the File locks title bar opens the list (package.json, Release)', await page.evaluate(() => !$('o-locks').classList.contains('folded') && $('l-body').offsetHeight > 0 && /package\.json/.test($('locks').innerText) && !!$('locks').querySelector('[data-unlock]')?.offsetWidth));
    check('3D: opening File locks takes its room from Activity, not Agents (Agents keeps its height while Activity has room to give)', await page.evaluate((h) => Math.abs($('o-right').getBoundingClientRect().height - h) < 2 && $('o-act').getBoundingClientRect().height >= 200, agentsH), agentsH);
    await page.click('#l-tog');
    const small = await page.evaluate(() => {
      const out = [];
      for (const b of $('main').querySelectorAll('button, textarea, select')) { const r = b.getBoundingClientRect(); if (r.width && r.height && (r.height < 24 || r.width < 24) && !b.matches('.link')) out.push(`${b.id || b.dataset.fk || b.className || b.textContent} ${Math.round(r.width)}x${Math.round(r.height)}`); }
      const walk = document.createTreeWalker($('main'), NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode());) { const e = n.parentElement; if (!n.textContent.trim() || !e.offsetWidth || e.closest('#office-scene')) continue; const f = parseFloat(getComputedStyle(e).fontSize); if (f < 12) out.push(`font ${f}px: ${n.textContent.trim().slice(0, 20)}`); }
      return out;
    });
    check('every control in the 3D view at least 24px, every text at least 12px', !small.length, small.slice(0, 6).join(' | '));

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
    check('a pick in the room selects the row (pressed) and shows what the agent holds, Message and its controls', sel.row === 'true' && sel.scene === 'ana-claude' && /Vote API/.test(sel.t) && /Message ana-claude/.test(sel.t) && /Task limit/.test(sel.t), JSON.stringify(sel));
    // The rows re-render as bob's updates arrive: click the element itself (as flows.mjs does).
    // A click can land on a row that is replaced a moment later; click the current row again until the pick sticks.
    const clickRow = (want) => until(page, (w) => { const b = document.querySelector('[data-o-agent="bob-codex"]'); if ((office.mod.selected === 'bob-codex') !== w && b) { b.focus(); b.click(); } return (office.mod.selected === 'bob-codex') === w; }, want);
    await clickRow(true);
    check('clicking a row selects that agent in the room (and only that row)', await until(page, () => office.mod.selected === 'bob-codex' && document.querySelectorAll('.o-agent[aria-pressed="true"]').length === 1 && document.activeElement?.dataset.oAgent === 'bob-codex'));
    check('a blocked agent says so, with its reason in Needs attention', await page.evaluate(() => /blocked/i.test(document.querySelector('[data-o-agent="bob-codex"] .o-st').textContent) && /bob-codex/.test($('o-blocked').innerText) && /needs a key/.test($('o-blocked').innerText)));
    await sleep(300); await clickRow(false); // the row re-renders as bob's updates arrive
    check('clicking it again unselects it', await until(page, () => office.mod.selected === null && !document.querySelector('.o-agent[aria-pressed="true"]')));
    await page.evaluate(() => pickAgent('ana-claude')); await page.focus('[data-o-agent="ana-claude"]');
    await page.keyboard.press('Escape');
    check('Esc unselects the agent', await page.evaluate(() => office.mod.selected === null));

    // A task card opens the board's task dialog.
    await page.click(`#o-tasks-b .card[data-id="${t2.id}"] .ct`);
    check('a task card opens the task dialog', await until(page, () => document.getElementById('task-dlg').open && document.getElementById('td-name').value === 'Leaderboard page'));
    await page.keyboard.press('Escape'); await until(page, () => !document.getElementById('task-dlg').open);
    check('closing the dialog leaves the office as it was', await view(page) === 'office');

    // Folding: every panel folds to its title bar (the Tasks window too) and moves there, the others in its column
    // taking its room in step; remembered; a click anywhere on a folded title bar opens it again.
    const fl = await foldRun(page, '#o-left [data-o-fold]', ['o-left']);
    check('Needs attention folds to its title bar: it rolls up (an animation part-way), lands on its title bar, no snap at the end', fl.anims >= 1 && fl.between && !fl.snap && fl.end[0] < 60 && fl.h0[0] > 100, JSON.stringify(fl));
    check('folded, its title bar counts what needs you (amber), its button says Open Needs attention, focus stays on it', await page.evaluate(() => $('o-left').classList.contains('folded') && /^\d+$/.test($('o-left-n').textContent) && getComputedStyle($('o-left-n')).color === (() => { const t = document.createElement('i'); t.style.color = 'var(--warn)'; document.body.append(t); const c = getComputedStyle(t).color; t.remove(); return c; })() && document.activeElement === $('o-left').querySelector('[data-o-fold]') && $('o-left').querySelector('[data-o-fold]').getAttribute('aria-label') === 'Open Needs attention' && $('o-left').querySelector('[data-o-fold]').title === 'Open Needs attention'));
    const fr = await foldRun(page, '#o-right [data-o-fold]', ['o-right', 'o-act', 'o-locks']);
    check('Agents folds the same way while Activity grows into its room in step (the column\'s total height kept every frame), no snap', fr.anims >= 2 && fr.between && !fr.snap && fr.end[0] < 60 && fr.end[1] > fr.h0[1] + 100, JSON.stringify(fr));
    const ft = await foldRun(page, '#o-tasks-fold', ['o-tasks']);
    check('the Tasks window folds the same way, to its title bar under the top bar, no snap; the room held still meanwhile, back at its full rate after', ft.anims >= 1 && ft.between && !ft.snap && ft.end[0] < 60 && await until(page, () => office.fps === 30), JSON.stringify(ft));
    check('Agents folded (Activity takes the column); the Tasks window folded, focus stays on its button', await page.evaluate(() => $('o-right').classList.contains('folded') && $('o-right-sub').textContent.length > 0 && $('o-tasks').classList.contains('folded') && document.activeElement === $('o-tasks-fold') && $('o-act').getBoundingClientRect().height > $('office-view').getBoundingClientRect().height * 0.6));
    check('the folded title bars are as tall as the open ones\' title bars (the panel\'s bottom border in place of the rule)', await page.evaluate(() => { const open = $('o-act').querySelector('.o-head').getBoundingClientRect(), p = $('o-act').getBoundingClientRect(); return ['o-left', 'o-right', 'o-tasks'].every((i) => Math.abs($(i).getBoundingClientRect().height - (open.bottom - p.top)) < 1.5); }));
    await page.click('#o-act-fold'); await until(page, () => !document.getAnimations().some((a) => a.id === 'glide'));
    check('Activity folds to its title bar under Agents (the column stacks to the top, File locks right under it), with the latest event in it', await page.evaluate(() => $('o-act').classList.contains('folded') && !$('feed').offsetHeight && $('o-act-fold').getAttribute('aria-expanded') === 'false' && $('o-act-x').textContent.length > 3 && $('o-locks').getBoundingClientRect().top - $('o-act').getBoundingClientRect().bottom < 16 && $('o-act').getBoundingClientRect().top - $('o-right').getBoundingClientRect().bottom < 16), await page.evaluate(() => JSON.stringify({ act: $('o-act').getBoundingClientRect(), locks: $('o-locks').getBoundingClientRect(), v: $('office-view').getBoundingClientRect(), x: $('o-act-x').textContent, cls: $('o-act').className })));
    check('everything folded: a row along the top, lined up (the left title bar, the top bar, the right column\'s first title bar), the task board\'s title bar under the top bar', await page.evaluate(() => { const v = $('office-view').getBoundingClientRect(), y = v.top + 10; const bs = [$('o-left'), $('topbar'), $('o-right')].map((e) => e.getBoundingClientRect()); const t = $('o-tasks').getBoundingClientRect(); return bs.every((b) => Math.abs(b.top - y) < 3 && b.height < 70) && bs[0].right <= bs[1].left && bs[1].right <= bs[2].left && t.top >= bs[1].bottom && t.top - bs[1].bottom < 16 && t.height < 70 && Math.abs(t.left - bs[1].left) < 2 && Math.abs(t.right - bs[1].right) < 2; }), await page.evaluate(() => JSON.stringify([$('o-left'), $('topbar'), $('o-tasks'), $('o-right')].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), Math.round(b.top), Math.round(b.bottom)]; }))));
    await page.reload(); await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 }); await sleep(300);
    check('folded panels stay folded after a reload', await page.evaluate(() => ['o-left', 'o-right', 'o-tasks', 'o-act'].every((i) => $(i).classList.contains('folded'))));
    // A click on the title (not only the arrow) opens a folded panel.
    for (const sel of ['#o-left-h', '#o-right-h', '#o-tasks .o-head h2', '#f-h']) { await page.click(sel); await until(page, () => !document.getAnimations().some((a) => a.id === 'glide')); }
    check('a click on a folded title bar\'s title opens the panel, every one of them (a pointer over the bar)', await page.evaluate(() => ['o-left', 'o-right', 'o-tasks', 'o-act'].every((i) => !$(i).classList.contains('folded')) && $('feed').offsetHeight > 50 && getComputedStyle($('o-locks').querySelector('.o-head')).cursor === 'pointer'));
    await page.click('#o-tasks-max');
    check('expand: the Tasks window slides down and covers the room from under the top bar to the foot, the room at its full rate behind it', await until(page, () => { const r = $('o-tasks').getBoundingClientRect(); const v = $('office-view').getBoundingClientRect(); return $('o-tasks').classList.contains('max') && r.height > v.height * 0.75 && $('o-tasks-max').getAttribute('aria-pressed') === 'true' && office.fps === 30; }), await page.evaluate(() => JSON.stringify({ cls: $('o-tasks').className, h: $('o-tasks').getBoundingClientRect().height, v: $('office-view').getBoundingClientRect().height, fps: office.fps })));
    // The header and every popover stay above the maximised window: the theme picker, the goal, the demo time; the
    // command palette and the task dialog are top-layer dialogs.
    const above = (sel) => page.evaluate((s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20)); return r.width > 0 && e.contains(at); }, sel);
    await page.click('#theme-btn');
    check('maximised Tasks: the theme chooser opens above it, whole', await above('#theme-pop') && await page.evaluate(() => { const r = $('theme-pop').getBoundingClientRect(); return [[r.left + 8, r.top + 8], [r.right - 8, r.bottom - 8], [r.left + 8, r.bottom - 8]].every(([x, y]) => $('theme-pop').contains(document.elementFromPoint(x, y))); }));
    await page.keyboard.press('Escape');
    await page.click('#goal-btn');
    check('maximised Tasks: the goal popover opens above it', await above('#o-goal'));
    await page.click('#goal-btn');
    await page.click('#clock');
    check('maximised Tasks: the demo time popover opens above it', await above('#o-dl'));
    await page.keyboard.press('Escape');
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    check('maximised Tasks: Ctrl+K opens above it', await until(page, () => document.getElementById('pal-dlg').open) && await above('#pal-dlg'));
    await page.keyboard.press('Escape');
    await page.click('#help-btn');
    check('maximised Tasks: help opens above it', await until(page, () => document.getElementById('help-dlg').open) && await above('#help-dlg'));
    await page.keyboard.press('Escape');
    check('maximised Tasks: the header stays above it', await above('#app > header h1'));
    await page.click(`#o-tasks-b .card[data-id="${t1.id}"] .ct`);
    check('maximised Tasks: the task dialog opens above it', await until(page, () => document.getElementById('task-dlg').open) && await above('#task-dlg'));
    await page.keyboard.press('Escape'); await until(page, () => !document.getElementById('task-dlg').open);
    await page.focus('#o-tasks-max');
    await page.keyboard.press('Escape');
    check('Esc (in the board) docks it again (slides up), focus on its button', await page.evaluate(() => !$('o-tasks').classList.contains('max') && document.activeElement === $('o-tasks-max')));
    await page.click('#o-tasks-max');
    await page.focus('#goal-btn'); await page.keyboard.press('Escape');
    check('Esc elsewhere (the top bar) leaves the expanded board alone', await page.evaluate(() => $('o-tasks').classList.contains('max')));
    await page.click('#o-tasks-max');

    // Tasks: the Board view's task bar in the window's title bar. Search and Show filter the 3D columns as they filter
    // the board; Columns / Table is the board's saved choice, with the table in the window.
    check('3D Tasks title bar: the Board view\'s search, Show filter and Columns / Table', await page.evaluate(() => ['tsearch', 'filter', 'viewtog'].every((id) => $('o-tasks-head').contains($(id)) && !!$(id).offsetWidth)));
    await page.type('#tsearch', 'leaderboard');
    check('3D: search filters the Tasks window (and the board, the same box)', await until(page, () => { const t = $('board').innerText; return $('o-tasks-b').contains($('board')) && /Leaderboard page/.test(t) && !/Vote API/.test(t) && document.querySelectorAll('#o-tasks-b .card').length === 1; }));
    await page.$eval('#tsearch', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.select('#filter', 'ana');
    check('3D: Show filters the Tasks window by person', await until(page, () => document.querySelectorAll('#o-tasks-b .card').length >= 1 && [...document.querySelectorAll('#o-tasks-b .card')].every((c) => /ana/.test(c.innerText) || /Leaderboard/.test(c.innerText))) && await page.evaluate(() => [...document.querySelectorAll('#o-tasks-b .card')].length < state.tasks.length || state.tasks.every((t) => !t.assignee || /ana/.test(t.assignee))));
    await page.select('#filter', '');
    await page.click('#viewtog [data-view="table"]');
    check('3D: Table shows the board\'s table inside the Tasks window (columns hidden), saved as the board\'s choice', await until(page, () => $('o-tasks-b').contains($('tasktable')) && !$('tasktable').hidden && $('tasktable').offsetHeight > 40 && !$('board').offsetHeight && localStorage.getItem('board-view') === 'table' && /Leaderboard page/.test($('tasktable').innerText)));
    await page.click('#o-tasks-max');
    check('3D: the table is usable maximised (rows open the task)', await page.evaluate(() => $('tasktable').offsetHeight > 200));
    await page.click(`#tasktable [data-fk="tt-${t2.id}"]`);
    check('3D: a table row opens the task dialog', await until(page, () => document.getElementById('task-dlg').open && document.getElementById('td-name').value === 'Leaderboard page'));
    await page.keyboard.press('Escape'); await until(page, () => !document.getElementById('task-dlg').open);
    await page.click('#o-tasks-max');
    await page.click('#viewtog [data-view="columns"]');
    check('3D: back to Columns', await until(page, () => $('tasktable').hidden && $('board').offsetHeight > 40 && localStorage.getItem('board-view') === 'columns'));

    // Activity: the board's own feed (with its filters) and chat, in the right column under Agents.
    check('Activity, under Agents, has the feed with its filters', await page.evaluate(() => $('o-rcol').contains($('o-act')) && $('o-act').contains($('feed')) && $('o-act').contains($('tabs')) && $('feed').offsetHeight > 150 && /vote API is up/.test($('feed').innerText)), await page.evaluate(() => $('feed').offsetHeight));
    // Its filters are clickable: the feed doesn't cover them, and the room's name tags never paint over the window.
    const corners = await page.evaluate(() => { const r = $('o-act').getBoundingClientRect(); return [[r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4], [r.left + r.width / 2, r.top + r.height / 2]].filter(([x, y]) => !$('o-act').contains(document.elementFromPoint(x, y))).length; });
    check('nothing from the room covers Activity (its corners and middle are its own)', corners === 0, String(corners));
    check('the room\'s name tags sit under every panel (the scene is its own stacking layer)', await page.evaluate(() => { const s = getComputedStyle($('office-scene')); return s.zIndex === '0' && s.isolation === 'isolate'; }));
    for (const tab of ['chat', 'me', 'problems', 'merges', 'all']) {
      const pos = await page.$eval(`#tabs [data-tab="${tab}"]`, (b) => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { x: r.left + r.width / 2, y: r.top + r.height / 2, own: e === b || b.contains(e) }; });
      await page.mouse.click(pos.x, pos.y); await sleep(120);
      const r = await page.evaluate((t) => ({ pressed: document.querySelector(`#tabs [data-tab="${t}"]`).getAttribute('aria-pressed'), dlg: document.getElementById('task-dlg').open, focusOk: !document.activeElement?.matches?.('textarea[id^="tdqa"]') }), tab);
      check(`3D Activity: a click on the "${tab}" filter selects it (and opens nothing else)`, pos.own && r.pressed === 'true' && !r.dlg && r.focusOk, JSON.stringify({ ...pos, ...r }));
    }
    check('Activity has the chat composer', await page.evaluate(() => $('o-act').contains($('msg')) && $('msg').offsetHeight > 0));
    await page.focus('#msg');
    await page.type('#msg', 'hello from the office'); await page.keyboard.press('Enter');
    check('sending a message works from the office', await until(page, () => /hello from the office/.test(document.getElementById('feed').innerText)));

    // The theme: the header's swatch button, the same control as on the Board view (no theme chip in the room).
    check('one theme control: the header button, also in 3D', await page.evaluate(() => !document.querySelector('#o-theme-chip, #o-theme') && !!$('theme-btn').offsetWidth && document.querySelectorAll('[data-theme-set]').length === 16));
    await page.click('#theme-btn');
    check('the theme button opens the chooser over the room, focus on the current theme (a radio group of tiles)', await page.evaluate(() => { const r = $('theme-pop').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !$('theme-pop').hidden && $('theme-pop').contains(e) && $('theme-pop').getAttribute('role') === 'radiogroup' && document.activeElement?.getAttribute('aria-checked') === 'true' && $('theme-pop').querySelectorAll('[role="radio"][tabindex="0"]').length === 1; }));
    await page.click('#theme-pop [data-theme-set="night"]');
    check('a tile in the chooser switches the theme and the room (Night), and the chooser closes', await until(page, () => document.documentElement.dataset.theme === 'night' && office.mod.palette === 'night' && document.querySelector('#theme-pop [data-theme-set="night"]').getAttribute('aria-checked') === 'true' && document.getElementById('theme-pop').hidden));
    await page.screenshot({ path: path.join(out, 'office-night-1440.png') });
    await page.click('#theme-btn'); await page.keyboard.press('ArrowRight');
    check('arrow keys move through the grid (Night -> Paper), the room follows', await until(page, () => document.documentElement.dataset.theme === 'paper' && office.mod.palette === 'paper' && document.activeElement?.dataset.themeSet === 'paper'));
    await page.keyboard.press('ArrowDown');
    check('down a row (Paper -> Cotton Candy), the room follows', await until(page, () => document.documentElement.dataset.theme === 'candy' && office.mod.palette === 'candy' && document.activeElement?.dataset.themeSet === 'candy'));
    await page.keyboard.press('Escape');
    check('Esc closes the picker, focus back on the theme button (still in 3D)', await page.evaluate(() => $('theme-pop').hidden && document.activeElement === $('theme-btn')) && await view(page) === 'office');
    await page.evaluate(() => setTheme('auto'));

    // The selected agent stays selected on the Board view: the same panels, in the same places, around the board.
    await page.evaluate(() => pickAgent('ana-claude'));
    await page.click('#o3d');
    check('3D off: the same panels sit in the same places: Needs attention left, the top bar over the board, Agents / Activity / File locks right; the task bar is back over the board', await until(page, () => { const b = $('board').getBoundingClientRect(); return document.documentElement.dataset.boardView === 'board' && $('o-left').getBoundingClientRect().right <= b.left && $('o-rcol').getBoundingClientRect().left >= b.right && $('topbar').getBoundingClientRect().bottom <= b.top && $('boardwrap').contains($('taskbar')) && $('boardwrap').contains($('tasktable')) && $('feed').offsetHeight > 50 && !!$('o-locks').offsetWidth; }));
    check('the selected agent is still selected, with its details; the office is gone (nothing left on the GPU)', await page.evaluate(() => ui.picked === 'ana-claude' && /Message ana-claude/.test($('o-det')?.innerText || '') && !office.mod && !document.querySelector('#office-scene canvas')));
    // Folding is the same on both views, and remembered once: Needs attention folds to its title bar on the Board view
    // too, and stays folded in 3D. The column keeps its width (the title bar across it, not on its side): nothing shifts.
    const w0 = await page.evaluate(() => [$('board').getBoundingClientRect().left, $('board').getBoundingClientRect().width, $('o-left').getBoundingClientRect().width]);
    const bf = await foldRun(page, '#o-left [data-o-fold]', ['o-left']);
    check('Board view: Needs attention folds the same way (an animation part-way, its title bar at the end, no snap)', bf.anims >= 1 && bf.between && !bf.snap && bf.end[0] < 60, JSON.stringify(bf));
    check('Board view: Needs attention folds to its title bar across the column (as wide as the panel, not turned), the board stays put, focus on its button', await until(page, ([l, w, pw]) => { const p = $('o-left').getBoundingClientRect(), b = $('board').getBoundingClientRect(); return $('o-left').classList.contains('folded') && Math.abs(p.width - pw) < 3 && p.height < 60 && Math.abs(b.left - l) < 2 && Math.abs(b.width - w) < 2 && document.activeElement === $('o-left').querySelector('[data-o-fold]'); }, w0));
    const br = await foldRun(page, '#o-right [data-o-fold]', ['o-right', 'o-act']);
    check('Board view: Agents folds while Activity takes its room in step, no snap', br.anims >= 2 && br.between && !br.snap && br.end[0] < 60 && br.end[1] > br.h0[1] + 100, JSON.stringify(br));
    const bo = await foldRun(page, '#o-right .o-head', ['o-right', 'o-act']);
    check('Board view: a click on the folded title bar opens it again, the same motion back', bo.anims >= 2 && bo.between && !bo.snap && !(await page.evaluate(() => $('o-right').classList.contains('folded'))) && Math.abs(bo.end[0] - br.h0[0]) < 3, JSON.stringify(bo));
    const quick = await page.evaluate(async () => {
      const idle = async () => { while (document.getAnimations().some((a) => a.id === 'glide')) await new Promise((r) => requestAnimationFrame(r)); };
      $('o-right').querySelector('[data-o-fold]').click(); $('o-act').querySelector('[data-o-fold]').click(); await idle();
      const h = ['o-right', 'o-act'].map((i) => Math.round($(i).getBoundingClientRect().height));
      $('o-right').querySelector('[data-o-fold]').click(); $('o-act').querySelector('[data-o-fold]').click(); await idle();
      return { h, open: ['o-right', 'o-act'].every((i) => !$(i).classList.contains('folded') && $(i).getBoundingClientRect().height > 100), moving: document.querySelectorAll('.o-moving').length };
    });
    check('Board view: two panels of a column folded one right after the other both land folded, and open again the same way', quick.h.every((x) => x < 60) && quick.open && !quick.moving, JSON.stringify(quick));
    // The 3D switch: the new look in one frame (no colour transitions), then the panels fade in where they are.
    const sw = await page.evaluate(() => { $('o3d').click(); return { noTx: document.documentElement.classList.contains('no-tx'), fades: document.getAnimations().filter((a) => a.id === 'view').map((a) => a.effect.target.id) }; });
    check('the 3D switch applies in one frame (no transitions) and fades the panels and the top bar in (opacity only)', sw.noTx && ['o-left', 'topbar', 'o-tasks', 'o-act'].every((i) => sw.fades.includes(i)), JSON.stringify(sw));
    check('3D on: the same fold (one memory for both)', await until(page, () => document.documentElement.dataset.boardView === 'office' && $('o-left').classList.contains('folded') && !!$('o-left').offsetWidth && $('o-left').getBoundingClientRect().height < 60));
    await page.click('#o-left [data-o-fold]');
    await page.click('#o3d');
    check('unfolded in 3D: open on the Board view too', await until(page, () => document.documentElement.dataset.boardView === 'board' && !$('o-left').classList.contains('folded') && $('o-left').getBoundingClientRect().height > 100));

    // Keyboard: the buttons work from the keyboard; the palette has the command.
    await page.focus('#o3d'); await page.keyboard.press('Enter');
    check('the switch works from the keyboard (Enter)', await view(page) === 'office' && await page.$eval('#o3d', (b) => b.getAttribute('aria-pressed') === 'true'));
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    await page.type('#pal-in', '3d office off'); await sleep(150);
    const pal = await page.$eval('#pal-list', (l) => l.innerText);
    await page.keyboard.press('Enter');
    check('Ctrl+K: "Turn the 3D office off" (and back)', /Turn the 3D office off/.test(pal) && await until(page, () => document.documentElement.dataset.boardView === 'board'), pal.replace(/\s+/g, ' ').slice(0, 80));
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    await page.type('#pal-in', '3d office'); await sleep(150);
    const embeds = officeReqs(reqs).filter((u) => /embed\.js/.test(u)).length;
    check('the palette offers "Turn the 3D office on" on the plain board', /Turn the 3D office on/.test(await page.$eval('#pal-list', (l) => l.innerText)));
    await page.keyboard.press('Enter');
    check('the office comes back without downloading its code again', await until(page, () => document.documentElement.dataset.boardView === 'office') && officeReqs(reqs).filter((u) => /embed\.js/.test(u)).length === embeds);

    // What to do now's links: blocked tasks are listed in the dock (stay); a link to Start here opens the board view.
    await page.click('#now [data-go="blocked"]');
    check('"blocked" in What to do now stays in the office, on the Blocked list', await view(page) === 'office' && await page.evaluate(() => $('o-blocked').contains(document.activeElement)));
    await page.evaluate(() => oExpand(false));
    await page.evaluate(() => { const a = document.querySelector('#now [data-go]:not([data-go="blocked"])'); if (a) a.setAttribute('data-test-go', ''); });
    if (await page.$('#now [data-test-go]')) {
      await page.click('#now [data-test-go]');
      check('a What to do now link to the tasks brings the board up over the room (still 3D)', await until(page, () => document.getElementById('o-tasks').classList.contains('max')) && await view(page) === 'office');
    }
    await page.click('#goal-btn');
    check('the Goal in the top bar shows the full goal', await page.evaluate(() => !$('o-goal').hidden && /voting app for hackathon projects/.test($('o-goal').innerText)));
    await page.click('#o-goal [data-act="o-goal-edit"]');
    check('"Edit the goal" edits it in place (still the 3D view), focus in the text', await view(page) === 'office' && await page.evaluate(() => document.activeElement === $('o-goal-in')));
    await page.evaluate(() => { $('o-goal-in').value = ''; }); await page.type('#o-goal-in', 'A voting app for hackathon projects, with a live leaderboard'); await page.keyboard.press('Enter');
    check('Enter saves the goal from the popover, focus back on Edit the goal', await until(page, () => /live leaderboard/.test(state.settings.goal) && document.activeElement?.dataset.fk === 'o-goal-edit' && /live leaderboard/.test(document.getElementById('goal-btn').title)) && await view(page) === 'office');
    await page.keyboard.press('Escape');

    // Ctrl+K: "Edit the demo time" opens the popover in 3D, and focus lands in it (the command runs after the palette closes).
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    await page.type('#pal-in', 'demo time'); await sleep(150); await page.keyboard.press('Enter');
    check('Ctrl+K "Edit the demo time" in 3D: the popover, focus in its time field', await until(page, () => !document.getElementById('o-dl').hidden && document.activeElement?.id === 'o-dl-in') && await view(page) === 'office', await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName));
    // The top bar's popovers are glass like the panels (not see-through), with 3D on.
    const alpha = (id) => page.evaluate((i) => { const bg = getComputedStyle(document.getElementById(i)).backgroundColor; const m = /\/\s*([\d.]+)\)$/.exec(bg) || /rgba\(.*,\s*([\d.]+)\)$/.exec(bg); return m ? Number(m[1]) : 1; }, id);
    check('3D: the Demo popover is glass, not see-through', await alpha('o-dl') >= 0.9, String(await alpha('o-dl')));
    // Tab past its last control goes on to the next chip and closes it.
    await page.evaluate(() => { const b = [...document.querySelectorAll('#o-dl button')].filter((x) => x.offsetWidth).at(-1); b.focus(); });
    await page.keyboard.press('Tab');
    check('Tab past the Demo popover\'s last control: on to the next chip, the popover closed', await until(page, () => document.getElementById('o-dl').hidden && document.activeElement?.dataset.fk === [...document.querySelectorAll('#topbar button')].filter((b) => b.offsetWidth)[[...document.querySelectorAll('#topbar button')].filter((b) => b.offsetWidth).indexOf(document.getElementById('clock')) + 1]?.dataset.fk), await page.evaluate(() => document.activeElement?.dataset.fk));
    await page.click(await page.evaluate(() => document.getElementById('roles-btn').offsetWidth) ? '#roles-btn' : '#plan-btn');
    const rp = await page.evaluate(() => (document.getElementById('roles-btn').offsetWidth ? 'o-roles' : 'o-plan'));
    check('3D: the Roles / Planner popover is glass, not see-through', await until(page, (i) => !document.getElementById(i).hidden, rp) && await alpha(rp) >= 0.9, String(await alpha(rp)));
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // The skip links stay in 3D: "Skip to what needs attention" lands in the Needs attention dock, "Skip to tasks" on a
    // card in the Tasks window.
    await page.focus('#goal-btn'); await page.evaluate(() => document.activeElement.blur());
    check('3D: "Skip to what needs attention" and "Skip to tasks" are both there', await page.evaluate(() => getComputedStyle(document.querySelector('.skip[data-skip="now"]')).display !== 'none' && getComputedStyle(document.querySelector('.skip[data-skip="tasks"]')).display !== 'none'));
    await page.focus('.skip[data-skip="tasks"]'); await page.keyboard.press('Enter');
    check('3D: "Skip to tasks" focuses a card in the Tasks window', await until(page, () => !!document.activeElement?.closest('#o-tasks .card')) && await view(page) === 'office', await page.evaluate(() => document.activeElement?.className));
    await page.focus('#goal-btn'); await page.evaluate(() => document.activeElement.blur());
    await page.focus('.skip[data-skip="now"]'); await page.keyboard.press('Enter');
    check('the skip link focuses What to do now in the dock', await until(page, () => document.getElementById('now').contains(document.activeElement)) && await view(page) === 'office');

    // Remembered across reloads; ?view= overrides.
    await page.click('#o3d');
    check('off is saved in this browser (for every board)', await page.evaluate(() => localStorage.getItem('agent-board-3d') === 'off'));
    await page.click('#o3d');
    check('on is saved too', await page.evaluate(() => localStorage.getItem('agent-board-3d') === 'on'));
    await page.reload(); await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
    check('after a reload: still 3D on', await view(page) === 'office' && await until(page, () => !!document.querySelector('#office-scene canvas'), null, 20000));
    await page.goto(board.base + '/?view=board'); await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 8000 });
    check('?view=board: 3D off for this visit (nothing downloaded or drawn), the saved choice untouched', await view(page) === 'board' && !(await page.$('#office-scene canvas')) && await page.evaluate(() => localStorage.getItem('agent-board-3d') === 'on'));
    await page.close();
    const v2 = await open('/?view=office');
    check('?view=office: 3D on for this visit, the board docked (the room in view); the saved off untouched', await view(v2.page) === 'office' && await until(v2.page, () => !!document.querySelector('#office-scene canvas'), null, 20000) && await v2.page.evaluate(() => localStorage.getItem('agent-board-3d') === 'off' && !$('o-tasks').classList.contains('max') && !$('o-tasks').classList.contains('folded')));

    // Theme: every theme has its own room (the scene palette with the theme's id), and Auto follows the OS: Dark or Light.
    const ids = await v2.page.evaluate(() => Object.keys(window.THEMES));
    const rooms = [];
    for (const t of ids) {
      await v2.page.evaluate((x) => setTheme(x), t); await sleep(120);
      if (!(await v2.page.evaluate((x) => office.mod?.palette === x && scenePalette() === x && window.__officeState?.agents.length > 0, t))) rooms.push(t);
    }
    check(`each of the ${ids.length} themes draws its own room (the scene palette follows)`, ids.length === 15 && !rooms.length, rooms.join());
    await v2.page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await v2.page.evaluate(() => setTheme('auto'));
    check('Auto on a light OS: the Light room', await until(v2.page, () => office.mod?.palette === 'light'));
    await v2.page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    // Chrome fires media-query 'change' events on a rendering frame, which a headless test tab doesn't reliably get.
    // The page must see the dark OS; if the browser hasn't delivered the event yet, fire it on the page's own listener.
    check('Auto: the page sees the OS switch to dark', await until(v2.page, () => darkMq.matches && scenePalette() === 'dark'));
    if (!(await until(v2.page, () => office.mod?.palette === 'dark', null, 2000))) await v2.page.evaluate(() => darkMq.dispatchEvent(new Event('change')));
    check('Auto follows the OS switching to dark: the Dark room', await until(v2.page, () => office.mod?.palette === 'dark'));
    // A column with more cards than fit says how many more; a helper shows under its agent with its own state; a person
    // whose only agent has their name is one row.
    for (let i = 0; i < 7; i++) await ana('create_task', { title: `Extra task ${i + 1}`, size: 'S' });
    const helperTask = await ana('create_task', { title: 'Helper task' });
    await ana('claim_task', { id: helperTask.id, as: 'ui-worker' }); await ana('update_task', { id: helperTask.id, status: 'in_progress', as: 'ui-worker' });
    const carol = await agent(board, 'carol'); await carol('board_status');
    await v2.page.setViewport({ width: 1366, height: 768 });
    await v2.page.evaluate(() => { if (document.getElementById('o-tasks').classList.contains('folded')) document.getElementById('o-tasks-fold').click(); });
    check('an overflowing Tasks column scrolls inside the window (its cards list scrolls, the window keeps its size)', await until(v2.page, () => { const c = document.querySelector('#o-tasks-b .col[data-status="open"]'); const ul = c?.querySelector('.cards'); if (!ul) return false; const w = document.getElementById('o-tasks').getBoundingClientRect(); return ul.scrollHeight > ul.clientHeight + 4 && getComputedStyle(ul).overflowY === 'auto' && c.getBoundingClientRect().bottom <= w.bottom + 1; }), await v2.page.evaluate(() => { const ul = document.querySelector('#o-tasks-b .col[data-status="open"] .cards'); return ul ? `${ul.scrollHeight}/${ul.clientHeight}` : 'no list'; }));
    check('a helper shows under its agent, with its own state and task', await until(v2.page, () => { const h = document.querySelector('[data-o-agent="ana-claude"]')?.closest('li')?.querySelector('.o-helpers'); return !!h && /ui-worker/.test(h.innerText) && /working/.test(h.innerText) && /Helper task/.test(h.innerText); }));
    check('a person whose one agent has their name: their line, then that agent\'s row (as on the Board view)', await until(v2.page, () => !!document.querySelector('[data-person-row="carol"] [data-o-agent="carol"]') && !!document.querySelector('[data-person-row="carol"] .o-pn')));
    for (const [w, h, theme] of [[1440, 900, 'dusk'], [1440, 900, 'light'], [1440, 900, 'sticky'], [1366, 768, 'dark']]) {
      await v2.page.evaluate((t) => setTheme(t), theme);
      await v2.page.setViewport({ width: w, height: h }); await sleep(800);
      await v2.page.screenshot({ path: path.join(out, `office-${w}-${theme}.png`) });
    }
    await v2.page.close();

    // Reduced motion: the board docks and expands at once.
    const rm = await open('/', { setup: () => { try { localStorage.setItem('agent-board-3d', 'on'); } catch {} } });
    await rm.page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await until(rm.page, () => !!document.querySelector('#office-scene canvas'), null, 20000);
    check('reduced motion: panels fold and open at once (no animation at all)', await rm.page.evaluate(() => { const ok = []; for (const s of ['#o-right [data-o-fold]', '#o-tasks-fold', '#o-left [data-o-fold]']) { document.querySelector(s).click(); ok.push(!document.getAnimations().length); document.querySelector(s).click(); ok.push(!document.getAnimations().length); } return ok.every(Boolean) && !$('o-right').classList.contains('folded'); }));
    check('reduced motion: the board expands and docks at once (no slide)', await rm.page.evaluate(() => { $('o-tasks-max').click(); const a = !$('o-tasks').getAnimations().length && $('o-tasks').classList.contains('max'); $('o-tasks-max').click(); return a && !$('o-tasks').getAnimations().length && !$('o-tasks').classList.contains('max'); }));
    await rm.page.close();

    // The office code can't be fetched (offline): a note, and the board stays.
    const off = await open('/', { errs: [] }); // 3D off, then turned on // the refused request logs an error: expected here
    await off.page.setRequestInterception(true);
    off.page.on('request', (r) => (/\/office\/embed\.js/.test(r.url()) ? r.abort() : r.continue()));
    await off.page.click('#o3d');
    check('office code fails to load: back on the board with a note', await until(off.page, () => document.documentElement.dataset.boardView === 'board' && /didn't load/.test(document.getElementById('toasts').innerText)));
    await off.page.close();
  }
  if (!page.isClosed()) await page.close().catch(() => {});

  // ---- No WebGL: the board stays, with a message, and the switch goes away ----
  const ng = await open('/', { setup: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, o) { return /webgl/.test(k) ? null : g.call(this, k, o); }; } });
  await ng.page.click('#o3d');
  check('WebGL unavailable: stays on the board with a message', await until(ng.page, () => document.documentElement.dataset.boardView === 'board' && /can't show the 3D office/.test(document.getElementById('toasts').innerText)));
  check('WebGL unavailable: the switch hides, nothing 3D downloaded', await ng.page.$eval('#o3d', (g) => g.hidden) && officeReqs(ng.reqs).length === 0, officeReqs(ng.reqs).join(' '));
  await ng.page.close();
  const ng2 = await open('/?view=office', { setup: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, o) { return /webgl/.test(k) ? null : g.call(this, k, o); }; } });
  check('WebGL unavailable with ?view=office: the board, with the message', await view(ng2.page) === 'board' && await until(ng2.page, () => /can't show the 3D office/.test(document.getElementById('toasts').innerText)));
  await ng2.page.close();

  // No WebGL, nothing saved (3D on by default): the plain board, quietly (nobody asked for 3D), no switch.
  const ng3 = await open('/', { setup: () => { try { localStorage.removeItem('agent-board-3d'); } catch {} const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, o) { return /webgl/.test(k) ? null : g.call(this, k, o); }; } });
  check('WebGL unavailable by default: the plain board without a note, the switch hidden', await view(ng3.page) === 'board' && !/3D office/.test(await ng3.page.$eval('#toasts', (t) => t.innerText)) && await ng3.page.$eval('#o3d', (g) => g.hidden) && officeReqs(ng3.reqs).length === 0);
  await ng3.page.close();

  // ---- Phones: no switch, and ?view=office stays on the board ----
  const ph = await open('/?view=office', { phone: true, setup: () => { try { localStorage.removeItem('agent-board-3d'); } catch {} } });
  check('phone: the switch is hidden', !(await shown(ph.page, '#o3d')));
  check('phone: ?view=office stays on the board, nothing 3D loaded', await view(ph.page) === 'board' && officeReqs(ph.reqs).length === 0);
  await ph.page.close();

  // ---- Windows up to 1100px wide: no switch, the plain board; the saved choice is kept and 3D comes back wider ----
  const nw = await open('/', { vp: { width: 1000, height: 800 }, setup: () => { try { localStorage.setItem('agent-board-3d', 'on'); } catch {} } });
  check('1000px wide, 3D saved on: the switch is hidden and the plain board shows, nothing 3D loaded, the saved choice kept', !(await shown(nw.page, '#o3d')) && await view(nw.page) === 'board' && await shown(nw.page, '#board') && officeReqs(nw.reqs).length === 0 && await nw.page.evaluate(() => localStorage.getItem('agent-board-3d') === 'on'));
  await nw.page.setViewport({ width: 1100, height: 800 }); await sleep(300);
  check('1100px: still the plain board, no switch', !(await shown(nw.page, '#o3d')) && await view(nw.page) === 'board');
  if (webgl) {
    await nw.page.setViewport({ width: 1280, height: 800 });
    check('wider again (1280px): 3D comes back, with the switch', await until(nw.page, () => document.documentElement.dataset.boardView === 'office' && !!document.getElementById('o3d').offsetWidth && document.getElementById('o3d').getAttribute('aria-pressed') === 'true'));
    await nw.page.setViewport({ width: 1000, height: 800 });
    check('narrow again: the plain board, the saved choice still on', await until(nw.page, () => document.documentElement.dataset.boardView === 'board' && localStorage.getItem('agent-board-3d') === 'on'));
  }
  await nw.page.close();
  const nv = await open('/?view=office', { vp: { width: 1000, height: 800 } });
  check('1000px wide with ?view=office: the plain board, nothing 3D loaded', await view(nv.page) === 'board' && !(await shown(nv.page, '#o3d')) && officeReqs(nv.reqs).length === 0);
  await nv.page.close();

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
