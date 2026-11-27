#!/usr/bin/env node
// Resizing the panels, on the demo board with a mouse, in both views from 1280px wide: every separator (the side
// columns' inner edges and feet, the edges between Agents, Activity and File locks, the Tasks panel's foot) is a
// labelled, focusable separator with its value and range, invisible until hovered or focused and taking no room;
// dragging one changes its panel's size and the size comes back after a reload; the arrow keys, Home / End, Enter and
// a double-click; the limits (the centre's room, Activity's minimum, the right column's foot, the window made
// smaller); the 3D Tasks window's docked height with expanded and folded still working; no separators under 1280px.
// Run all suites with: npm test
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, launchBrowser, shotsDir, finish } from '../helpers.mjs';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = shotsDir('resize');
const errors = [];

// The demo board, seeded and still (--static), on a free port with its own temp folder; "stop" ends it and removes it.
const demo = spawn(process.execPath, [path.join(ROOT, 'scripts', 'demo.mjs'), '--static'], { stdio: ['pipe', 'pipe', 'inherit'] });
let log = '';
demo.stdout.on('data', (d) => { log += d; });
const demoExit = new Promise((r) => demo.once('exit', r));
process.once('exit', () => { try { demo.kill(); } catch {} });
for (let i = 0; i < 300 && !/Data folder:/.test(log); i++) await sleep(100);
const url = log.match(/Board \(as "you"\):\s+(\S+)/)?.[1];
if (!url) { console.log(`CRASH the demo did not start:\n${log}`); process.exit(1); }

const browser = await launchBrowser({ office: true, args: ['--blink-settings=primaryPointerType=4,availablePointerTypes=4,primaryHoverType=2,availableHoverTypes=2', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const until = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, { timeout, polling: 100 }, arg).then(() => true).catch(() => false);
const settle = async (page) => { await until(page, () => !document.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().endTime !== Infinity && !a.effect?.target?.closest?.('#office-scene'))); await sleep(150); };
let webgl = true;

// A page in its own context (its own localStorage); the sizes in `sizes` are saved before its first load only.
async function open({ w, h, view = 'board', sizes = null, ctx = null }) {
  const context = ctx || await browser.createBrowserContext();
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: w, height: h });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument((c) => { try {
    localStorage.setItem('agent-board-3d', c.view === 'office' ? 'on' : 'off'); localStorage.setItem('board-setup', 'closed');
    if (c.sizes && !sessionStorage.getItem('sized')) { localStorage.setItem('board-sizes', JSON.stringify(c.sizes)); sessionStorage.setItem('sized', '1'); }
  } catch {} }, { view, sizes });
  await load(page, view);
  return page;
}
async function load(page, view, reload = false) {
  if (reload) await page.reload({ waitUntil: 'load' }); else await page.goto(url, { waitUntil: 'load' });
  await until(page, () => document.getElementById('conn')?.classList.contains('live') && document.querySelectorAll('#board .card').length > 10, null, 15000);
  if (view === 'office') webgl = await until(page, () => document.documentElement.dataset.boardView === 'office' && !document.querySelector('.office-view.loading'), null, 20000);
  // Toasts (the "on the board as you" one on load) aren't this suite's: one over the Tasks panel's foot would take the drag.
  await page.addStyleTag({ content: '#toasts { display: none !important; }' });
  await page.evaluate(() => document.fonts.ready.then(() => {}));
  await settle(page);
}
async function block(name, fn) { try { await fn(); } catch (e) { check(name, false, 'threw: ' + e.message.split('\n')[0]); } }
const close = (page) => page.browserContext().close();
// Sizes of the panels and the column, and what is saved.
const geo = (page) => page.evaluate(() => {
  const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  const ps = ['o-right', 'o-act', 'o-locks'].map((id) => document.getElementById(id)).filter((p) => p.offsetHeight);
  return { left: r('o-left'), rcol: r('o-rcol'), right: r('o-right'), act: r('o-act'), locks: r('o-locks'), tasks: r('o-tasks'), main: r('main'), topbar: r('topbar'),
    stack: Math.round(ps.at(-1).getBoundingClientRect().bottom), saved: JSON.parse(localStorage.getItem('board-sizes') || '{}'),
    vars: [document.documentElement.style.getPropertyValue('--dock-l'), document.documentElement.style.getPropertyValue('--dock-r')],
    sized: [...document.querySelectorAll('.sized')].map((e) => e.id) };
});
// Drags a separator from its middle by (dx, dy), in steps, with the mouse.
async function drag(page, id, dx, dy) {
  const c = await page.$eval(`#${id}`, (e) => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + Math.min(b.height / 2, 200) }; });
  await page.mouse.move(c.x, c.y); await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(c.x + (dx * i) / 5, c.y + (dy * i) / 5);
  await page.mouse.up(); await sleep(60);
}
const aria = (page, id) => page.$eval(`#${id}`, (e) => ({ now: Number(e.getAttribute('aria-valuenow')), min: Number(e.getAttribute('aria-valuemin')), max: Number(e.getAttribute('aria-valuemax')) }));
const shown = (page) => page.evaluate(() => [...document.querySelectorAll('.rsz')].filter((e) => e.offsetWidth).map((e) => e.dataset.rsz));
const near = (a, b, d = 1.5) => Math.abs(a - b) <= d;

try {
  // ---- the separators: roles, names, values, invisible, taking no room; nothing set without saved sizes ----
  await block('separators', async () => {
    const p = await open({ w: 1440, h: 900 });
    const s = await shown(p);
    check('1440, 3D off: separators on the side columns\' inner edges and feet, between Agents and Activity and on the Tasks panel\'s foot (none on folded File locks)', ['left', 'lefth', 'right', 'rcolh', 'agents', 'tasks'].every((k) => s.includes(k)) && !s.includes('locks'), s.join(','));
    const a = await p.evaluate(() => [...document.querySelectorAll('.rsz')].filter((e) => e.offsetWidth).map((e) => {
      const b = e.getBoundingClientRect(), before = getComputedStyle(e, '::before'), x = e.getAttribute('aria-orientation') === 'vertical';
      return { k: e.dataset.rsz, role: e.getAttribute('role'), label: e.getAttribute('aria-label'), o: e.getAttribute('aria-orientation'), tab: e.tabIndex, now: e.getAttribute('aria-valuenow'), min: e.getAttribute('aria-valuemin'), max: e.getAttribute('aria-valuemax'),
        hit: Math.round(x ? b.width : b.height), ink: before.opacity, at: document.elementFromPoint(b.left + b.width / 2, b.top + Math.min(b.height / 2, 100)) === e };
    }));
    check('each is role="separator" with a label, an orientation, a Tab stop and aria-valuenow/min/max', a.every((e) => e.role === 'separator' && e.label && /^(vertical|horizontal)$/.test(e.o) && e.tab === 0 && [e.now, e.min, e.max].every((v) => v !== null && Number.isFinite(Number(v))) && Number(e.min) <= Number(e.now) && Number(e.now) <= Number(e.max)), JSON.stringify(a));
    check('each is a 24px target (across its edge) and on top there, and nothing is drawn until hovered or focused', a.every((e) => e.hit >= 24 && e.at && e.ink === '0'), JSON.stringify(a.map((e) => [e.k, e.hit, e.at, e.ink])));
    const g0 = await geo(p);
    check('nothing saved: no width or height is set (the layout is the CSS\'s own)', !g0.vars[0] && !g0.vars[1] && !g0.sized.length && !Object.keys(g0.saved).length, JSON.stringify(g0));
    const hide = await p.addStyleTag({ content: '.rsz { display: none !important; }' }); await sleep(50);
    const g1 = await geo(p);
    const same = ['left', 'rcol', 'right', 'act', 'locks', 'tasks', 'topbar'].every((k) => JSON.stringify(g0[k]) === JSON.stringify(g1[k]));
    check('the separators take no room: every panel in the same place with them taken out', same, JSON.stringify({ with: g0.act, without: g1.act }));
    // Hovered: the line along the gutter; focused from the keyboard: the ring and the accent line.
    // Measured once the separators are back (hidden, it has no box).
    await hide.evaluate((e) => e.remove()); await sleep(50);
    const b = await p.$eval('#rsz-left', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 100 }; });
    await p.mouse.move(b.x, b.y); await sleep(250);
    const hov = await p.$eval('#rsz-left', (e) => ({ ink: getComputedStyle(e, '::before').opacity, cursor: getComputedStyle(e).cursor }));
    check('hovered: its line shows, with a resize cursor', hov.ink === '1' && hov.cursor === 'col-resize', JSON.stringify(hov));
    await p.mouse.move(700, 500);
    await p.keyboard.press('Shift'); await p.$eval('#rsz-agents', (e) => e.focus()); await sleep(250);
    const foc = await p.$eval('#rsz-agents', (e) => { const a = getComputedStyle(e, '::after'); return { fv: e.matches(':focus-visible'), ring: `${a.outlineStyle} ${a.outlineWidth}`, ink: getComputedStyle(e, '::before').opacity }; });
    check('focused from the keyboard: the app\'s 2px focus ring (around the gutter) and the line', foc.fv && foc.ring === 'solid 2px' && foc.ink === '1', JSON.stringify(foc));
    await p.screenshot({ path: `${out}/focus-1440.png` });
    await close(p);
  });

  // ---- side widths: drag, keys, double-click and Enter, limits, kept after a reload (3D off) ----
  await block('widths', async () => {
    const p = await open({ w: 1440, h: 900 });
    const g0 = await geo(p);
    await drag(p, 'rsz-left', 60, 0);
    const g1 = await geo(p);
    check('dragging Needs attention\'s inner edge 60px right: 60px wider, the centre starts 60px later, the right column unchanged', near(g1.left.w, g0.left.w + 60) && near(g1.topbar.l, g0.topbar.l + 60) && g1.rcol.w === g0.rcol.w && near(g1.saved.left, g1.left.w), JSON.stringify({ before: g0.left, after: g1.left, saved: g1.saved }));
    await drag(p, 'rsz-right', -40, 0);
    const g2 = await geo(p);
    check('dragging the right column\'s inner edge 40px left: 40px wider, saved on its own', near(g2.rcol.w, g0.rcol.w + 40) && near(g2.saved.right, g2.rcol.w) && near(g2.left.w, g1.left.w), JSON.stringify({ rcol: [g0.rcol.w, g2.rcol.w], saved: g2.saved }));
    await load(p, 'board', true);
    const g3 = await geo(p);
    check('after a reload both widths are back', near(g3.left.w, g2.left.w) && near(g3.rcol.w, g2.rcol.w), JSON.stringify([g3.left.w, g3.rcol.w]));
    // Keys.
    await p.keyboard.press('Shift'); await p.$eval('#rsz-left', (e) => e.focus());
    const k0 = (await geo(p)).left.w;
    await p.keyboard.press('ArrowRight'); const k1 = (await geo(p)).left.w;
    await p.keyboard.down('Shift'); await p.keyboard.press('ArrowLeft'); await p.keyboard.up('Shift'); const k2 = (await geo(p)).left.w;
    check('ArrowRight: 16px wider; Shift+ArrowLeft: 64px narrower', k1 === k0 + 16 && k2 === k1 - 64, `${k0} ${k1} ${k2}`);
    await p.keyboard.press('Home'); const home = await geo(p); const ah = await aria(p, 'rsz-left');
    await p.keyboard.press('End'); const end = await geo(p); const ae = await aria(p, 'rsz-left');
    check('Home: the smallest (240px); End: the largest, the centre column keeping 680px; aria-valuenow follows', home.left.w === 240 && ah.now === 240 && ah.min === 240 && end.left.w === ae.max && ae.now === ae.max && near(end.rcol.l - end.left.r - 24, 680, 2), JSON.stringify({ home: home.left.w, end: end.left.w, ae, centre: end.rcol.l - end.left.r - 24 }));
    await p.keyboard.press('Enter');
    const en = await geo(p);
    check('Enter: back to the default width (nothing saved for it)', en.left.w === g0.left.w && !('left' in en.saved) && !en.vars[0], JSON.stringify(en.saved));
    // Limits by dragging.
    await drag(p, 'rsz-right', -1000, 0); const big = await geo(p);
    check('dragged far: the right column stops where the centre keeps 680px (and at 520px at most)', big.rcol.w <= 520 && big.rcol.l - big.left.r - 24 >= 679, JSON.stringify({ rcol: big.rcol.w, centre: big.rcol.l - big.left.r - 24 }));
    await drag(p, 'rsz-right', 1000, 0); const small = await geo(p);
    check('dragged the other way: never under 240px', small.rcol.w === 240, String(small.rcol.w));
    const c = await p.$eval('#rsz-right', (e) => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + 100 }; });
    await p.mouse.click(c.x, c.y, { count: 2 }); await sleep(60);
    const dbl = await geo(p);
    check('a double-click: back to the default width', dbl.rcol.w === g0.rcol.w && !('right' in dbl.saved) && !dbl.vars[1], JSON.stringify(dbl.saved));
    // A window made smaller keeps the centre's room; made larger again, the saved width is back.
    await drag(p, 'rsz-left', 200, 0); await drag(p, 'rsz-right', -120, 0);
    const wide = await geo(p);
    await p.setViewport({ width: 1280, height: 800 }); await settle(p);
    const n = await geo(p);
    check('the window made 1280px wide: both sides narrowed so the centre keeps 680px, the saved widths kept', n.rcol.l - n.left.r - 24 >= 679 && n.left.w >= 240 && n.rcol.w >= 240 && n.saved.left === wide.saved.left && n.saved.right === wide.saved.right && n.left.w < wide.left.w, JSON.stringify({ left: n.left.w, rcol: n.rcol.w, centre: n.rcol.l - n.left.r - 24, saved: n.saved }));
    const k = await p.evaluate(() => { const bd = document.getElementById('board'); return { page: document.documentElement.scrollWidth - innerWidth, over: bd.scrollWidth - bd.clientWidth }; });
    check('… nothing scrolls sideways', k.page <= 0 && k.over <= 0, JSON.stringify(k));
    await p.setViewport({ width: 1440, height: 900 }); await settle(p);
    const back = await geo(p);
    check('made 1440px wide again: the saved widths are back', near(back.left.w, wide.left.w) && near(back.rcol.w, wide.rcol.w), JSON.stringify([back.left.w, wide.left.w, back.rcol.w, wide.rcol.w]));
    // Under 1280px: no separators, and the saved widths change nothing.
    await p.setViewport({ width: 1279, height: 800 }); await settle(p);
    const one = await p.evaluate(() => ({ shown: [...document.querySelectorAll('.rsz')].filter((e) => e.offsetWidth || e.offsetHeight).length, left: Math.round(document.getElementById('o-left').getBoundingClientRect().width), sized: document.querySelectorAll('.sized').length }));
    check('1279px wide: no separators, Needs attention its two-column width (264px) whatever was saved', one.shown === 0 && one.left === 264, JSON.stringify(one));
    await p.setViewport({ width: 390, height: 800 }); await settle(p);
    check('a phone: no separators', (await shown(p)).length === 0);
    await close(p);
  });

  // ---- heights in the right column: the splits, the foot; Needs attention's foot; the Tasks panel's foot (3D off) ----
  await block('heights', async () => {
    const p = await open({ w: 1440, h: 900 });
    await p.click('#l-tog'); await settle(p);
    check('File locks open: a separator between Activity and File locks', (await shown(p)).includes('locks'));
    const g0 = await geo(p);
    await drag(p, 'rsz-agents', 0, -40);
    const g1 = await geo(p);
    check('dragging the edge under Agents 40px up: Agents 40px shorter, Activity 40px taller, File locks unchanged', near(g1.right.h, g0.right.h - 40) && near(g1.act.h, g0.act.h + 40) && near(g1.locks.h, g0.locks.h) && near(g1.saved.agents, g1.right.h), JSON.stringify({ before: [g0.right.h, g0.act.h, g0.locks.h], after: [g1.right.h, g1.act.h, g1.locks.h] }));
    // Activity has 40px over its minimum here: 30 of them.
    await drag(p, 'rsz-locks', 0, -30);
    const g2 = await geo(p);
    check('dragging the edge above File locks 30px up: File locks 30px taller, Activity gives way', near(g2.locks.h, g1.locks.h + 30) && near(g2.act.h, g1.act.h - 30) && near(g2.right.h, g1.right.h), JSON.stringify({ after: [g2.right.h, g2.act.h, g2.locks.h] }));
    // Limits: Activity keeps its minimum, the column its foot.
    await drag(p, 'rsz-agents', 0, 1500);
    const g3 = await geo(p);
    const actMin = await p.evaluate(() => { const a = document.getElementById('o-act'), d = document.createElement('div'); d.style.cssText = `position:absolute;height:${getComputedStyle(a).minHeight}`; document.getElementById('o-rcol').append(d); const h = d.offsetHeight; d.remove(); return h; });
    check('Agents dragged far down: Activity keeps its minimum (tabs, a few events, the chat box) and the column ends at its foot', g3.act.h >= actMin - 1 && g3.stack <= g3.rcol.b + 1 && (await aria(p, 'rsz-agents')).now === (await aria(p, 'rsz-agents')).max, JSON.stringify({ act: g3.act.h, actMin, stack: g3.stack, col: g3.rcol.b }));
    await p.keyboard.press('Shift'); await p.$eval('#rsz-agents', (e) => e.focus()); await p.keyboard.press('Home');
    check('Home on it: Agents at its smallest (120px)', (await geo(p)).right.h === 120);
    await p.keyboard.press('ArrowDown'); check('ArrowDown: 16px taller', (await geo(p)).right.h === 136);
    // The column's foot.
    const f0 = await geo(p);
    // Activity has about 80px over its minimum here: 70 of them.
    await drag(p, 'rsz-rcolh', 0, -70);
    const f1 = await geo(p);
    check('dragging the right column\'s foot 70px up: its panels end 70px higher (Activity gives way)', near(f1.stack, f0.stack - 70) && near(f1.saved.rcolH, f1.stack - f1.rcol.t) && near(f1.right.h, f0.right.h) && near(f1.locks.h, f0.locks.h), JSON.stringify({ stack: [f0.stack, f1.stack], saved: f1.saved }));
    await drag(p, 'rsz-rcolh', 0, -2000);
    const f2 = await geo(p);
    check('… dragged far up: it stops where every panel is at its smallest', f2.act.h >= actMin - 1 && f2.right.h >= 119 && f2.locks.h >= 119, JSON.stringify([f2.right.h, f2.act.h, f2.locks.h]));
    await drag(p, 'rsz-rcolh', 0, 3000);
    const f3 = await geo(p);
    check('… and down: never past the column\'s foot', f3.stack <= f0.rcol.b + 1, JSON.stringify([f3.stack, f0.rcol.b]));
    await drag(p, 'rsz-rcolh', 0, -100); const keep = await geo(p);
    // Folded panels have no separators of their own.
    await p.click('#l-tog'); await settle(p);
    let s = await shown(p);
    check('File locks folded: no separator above it', !s.includes('locks') && s.includes('agents'), s.join(','));
    await p.click('[data-o-fold="right"]'); await settle(p);
    s = await shown(p);
    check('Agents folded: no separator under it', !s.includes('agents'), s.join(','));
    await p.click('[data-o-fold="right"]'); await p.click('#l-tog'); await settle(p);
    // Needs attention's foot.
    const l0 = await geo(p);
    await drag(p, 'rsz-lefth', 0, -150);
    const l1 = await geo(p);
    const sc = await p.evaluate(() => { const b = document.getElementById('o-left-b'); return b.scrollHeight > b.clientHeight + 1 && getComputedStyle(b).overflowY === 'auto'; });
    check('dragging Needs attention\'s foot 150px up: 150px shorter, its content scrolling inside', near(l1.left.h, l0.left.h - 150) && sc && near(l1.saved.leftH, l1.left.h), JSON.stringify({ h: [l0.left.h, l1.left.h], sc }));
    await drag(p, 'rsz-lefth', 0, 3000);
    const l2 = await geo(p);
    check('… dragged far down: it stops at the foot of the window', l2.left.b <= 900 - 12 + 1, JSON.stringify(l2.left));
    await p.click('[data-o-fold="left"]'); await settle(p);
    const lf = await p.evaluate(() => ({ s: !!document.getElementById('rsz-lefth').offsetWidth, w: !!document.getElementById('rsz-left').offsetWidth }));
    check('Needs attention folded: no separator on its foot (its width still has one)', !lf.s && lf.w, JSON.stringify(lf));
    await p.click('[data-o-fold="left"]'); await settle(p);
    await drag(p, 'rsz-lefth', 0, -2000); const lsmall = await geo(p);
    // The Tasks panel's foot, 3D off: its columns scroll inside it; taller than the window, the page scrolls to it.
    const t0 = await geo(p);
    await drag(p, 'rsz-tasks', 0, -(t0.tasks.h - 400));
    const t1 = await geo(p);
    const cs = await p.evaluate(() => [...document.querySelectorAll('#board .cards')].some((u) => u.scrollHeight > u.clientHeight + 1 && getComputedStyle(u).overflowY === 'auto'));
    check('3D off, the Tasks panel\'s foot dragged up: it is 400px tall, its longest columns scrolling inside', near(t1.tasks.h, 400, 2) && cs && near(t1.saved.tasks, t1.tasks.h), JSON.stringify({ h: t1.tasks.h, cs }));
    await p.keyboard.press('Shift'); await p.$eval('#rsz-tasks', (e) => e.focus());
    await p.keyboard.press('End');
    const t2 = await p.evaluate(() => ({ h: Math.round(document.getElementById('o-tasks').getBoundingClientRect().height), page: document.documentElement.scrollHeight > innerHeight }));
    check('End: up to three screens tall, the page scrolling', t2.h === 2700 && t2.page, JSON.stringify(t2));
    await p.$eval('#rsz-tasks', (e) => e.scrollIntoView({ block: 'center' })); await sleep(100);
    const reach = await p.$eval('#rsz-tasks', (e) => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && document.elementFromPoint(b.left + 200, b.top + b.height / 2) === e; });
    check('… its foot\'s separator scrolled into view and usable there', reach);
    await drag(p, 'rsz-tasks', 0, -(2700 - 500)); await p.evaluate(() => scrollTo(0, 0)); await sleep(60);
    const kept = await geo(p);
    // All of it after a reload.
    await load(p, 'board', true);
    const r = await geo(p);
    check('after a reload: Agents, File locks, the right column\'s foot, Needs attention\'s foot and the Tasks panel as they were', ['right', 'locks', 'left', 'tasks'].every((k) => near(r[k].h, kept[k].h)) && near(r.stack, kept.stack) && near(r.left.h, lsmall.left.h), JSON.stringify({ r: [r.right.h, r.locks.h, r.left.h, r.tasks.h, r.stack], kept: [kept.right.h, kept.locks.h, kept.left.h, kept.tasks.h, kept.stack], keep: keep.stack }));
    // A shorter window: the column's panels still fit.
    await p.setViewport({ width: 1440, height: 700 }); await settle(p);
    const sh = await geo(p);
    check('a 700px tall window: the right column\'s panels still end above its foot, Activity at its minimum or more', sh.stack <= sh.rcol.b + 1 && sh.act.h >= 100 && sh.left.b <= 700, JSON.stringify({ stack: sh.stack, col: sh.rcol.b, act: sh.act.h }));
    await p.screenshot({ path: `${out}/heights-1440x700.png` });
    await close(p);
  });

  // ---- 3D: the side widths with the centre between them, the Tasks window's docked height, expanded and folded ----
  await block('3D', async () => {
    const o = await open({ w: 1440, h: 900, view: 'office' });
    if (!webgl) { check('no WebGL here, the 3D checks skipped', !process.env.CI, 'CI must run them'); await close(o); return; }
    const g0 = await geo(o);
    await drag(o, 'rsz-left', 50, 0); await drag(o, 'rsz-right', -30, 0);
    const g1 = await geo(o);
    check('3D: both side columns wider, the top bar and the Tasks window a gutter from each', near(g1.left.w, g0.left.w + 50) && near(g1.rcol.w, g0.rcol.w + 30) && near(g1.tasks.l - g1.left.r, 12) && near(g1.rcol.l - g1.tasks.r, 12) && near(g1.topbar.l, g1.tasks.l) && near(g1.topbar.r, g1.tasks.r), JSON.stringify({ left: g1.left, tasks: g1.tasks, rcol: g1.rcol }));
    const s = await shown(o);
    check('3D: the same separators (and one on the docked Tasks window\'s foot)', ['left', 'lefth', 'right', 'rcolh', 'agents', 'tasks'].every((k) => s.includes(k)), s.join(','));
    await drag(o, 'rsz-tasks', 0, 80);
    const t1 = await geo(o);
    check('dragging the docked Tasks window\'s foot 80px down: 80px taller, its columns down to its foot, saved for 3D', near(t1.tasks.h, g1.tasks.h + 80) && near(t1.saved.tasks3d, t1.tasks.h) && !('tasks' in t1.saved), JSON.stringify({ h: [g1.tasks.h, t1.tasks.h], saved: t1.saved }));
    const room = await o.evaluate(() => { const v = document.getElementById('office-view').getBoundingClientRect(); return v.bottom - 12; });
    await drag(o, 'rsz-tasks', 0, 2000);
    const t2 = await geo(o);
    check('… dragged far down: it stops 120px above the foot, leaving some of the room in view', near(t2.tasks.b, room - 120, 2), JSON.stringify({ bottom: t2.tasks.b, room }));
    await drag(o, 'rsz-tasks', 0, -(t2.tasks.h - 300));
    const t3 = await geo(o);
    // Expanded: down to the foot, no separator; docked again: the height it was given.
    await o.click('#o-tasks-max'); await settle(o);
    const ex = await o.evaluate(() => ({ b: Math.round(document.getElementById('o-tasks').getBoundingClientRect().bottom), s: !!document.getElementById('rsz-tasks').offsetWidth, max: document.getElementById('o-tasks').classList.contains('max') }));
    check('expanded: the Tasks window reaches the foot, with no separator on it', ex.max && near(ex.b, room) && !ex.s, JSON.stringify({ ex, room }));
    await o.click('#o-tasks-max'); await settle(o);
    const dk = await geo(o);
    check('docked again: the height it was given (300px)', near(dk.tasks.h, t3.tasks.h) && near(dk.tasks.h, 300, 2), String(dk.tasks.h));
    await o.click('[data-o-fold="tasks"]'); await settle(o);
    const fo = await o.evaluate(() => ({ h: Math.round(document.getElementById('o-tasks').getBoundingClientRect().height), s: !!document.getElementById('rsz-tasks').offsetWidth }));
    check('folded: just its title bar, no separator', fo.h < 50 && !fo.s, JSON.stringify(fo));
    await o.click('[data-o-fold="tasks"]'); await settle(o);
    check('opened again: 300px', near((await geo(o)).tasks.h, 300, 2));
    await load(o, 'office', true);
    const rl = await geo(o);
    check('3D after a reload: the widths and the docked height as they were', near(rl.tasks.h, 300, 2) && near(rl.left.w, g1.left.w) && near(rl.rcol.w, g1.rcol.w), JSON.stringify([rl.tasks.h, rl.left.w, rl.rcol.w]));
    await o.keyboard.press('Shift'); await o.$eval('#rsz-tasks', (e) => e.focus()); await o.keyboard.press('Enter');
    const df = await geo(o);
    check('Enter on it: back to the docked default (as tall as its cards, up to 65% of the room)', !df.sized.includes('o-tasks') && !('tasks3d' in df.saved) && near(df.tasks.h, g0.tasks.h, 2), JSON.stringify({ h: df.tasks.h, def: g0.tasks.h }));
    await o.screenshot({ path: `${out}/office-1440.png` });
    await close(o);
  });

  check('no page errors', !errors.length, errors.join(' | '));
} catch (e) {
  console.log('CRASH', e.stack);
  R.push('FAIL crashed');
}

demo.stdin.write('stop\n');
await Promise.race([demoExit, sleep(15000)]);
if (process.env.CI) check('CI: WebGL works in this browser (SwiftShader), so the 3D checks ran', webgl);
await finish(R, { browser });
