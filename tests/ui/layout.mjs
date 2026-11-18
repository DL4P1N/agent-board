#!/usr/bin/env node
// Layout, measured on the demo board (8 agents, 20-odd tasks) with a mouse, in both views: three columns and the 3D
// switch from 1280px wide (two columns and no switch below); one Tasks panel whose columns sit in the same place with
// 3D on and off; docked, the Tasks panel as tall as its cards up to 65% of the room under the top bar; every agent on
// one line, all 8 in view at 1440×900; Activity's four filters, the card's "question waiting" only while Needs attention
// is folded; the feed never under the composer; chips as tall as a folded panel; popovers --gutter from what opens
// them; inset focus rings; high contrast in every theme; Show's note in 3D; no internal tool names in an agent's row.
// Run all suites with: npm test
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, launchBrowser, shotsDir, finish } from '../helpers.mjs';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = shotsDir('layout');
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

// A mouse (CI's headless Chrome is one; locally it can report touch), with software WebGL for the 3D room.
const browser = await launchBrowser({ office: true, args: ['--blink-settings=primaryPointerType=4,availablePointerTypes=4,primaryHoverType=2,availableHoverTypes=2', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const until = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, { timeout, polling: 100 }, arg).then(() => true).catch(() => false);
const settle = async (page) => { await until(page, () => !document.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().endTime !== Infinity && !a.effect?.target?.closest?.('#office-scene'))); await sleep(150); };
let webgl = true;

async function open({ w, h, view = 'board', theme = 'dusk', contrast = false }) {
  const page = await (await browser.createBrowserContext()).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: w, height: h });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }, { name: 'prefers-reduced-motion', value: 'reduce' }, ...(contrast ? [{ name: 'prefers-contrast', value: 'more' }] : [])]);
  await page.evaluateOnNewDocument((c) => { try { localStorage.setItem('agent-board-3d', c.view === 'office' ? 'on' : 'off'); localStorage.setItem('board-theme', c.theme); localStorage.setItem('board-setup', 'closed'); } catch {} }, { view, theme });
  await page.goto(url, { waitUntil: 'load' });
  await until(page, () => document.getElementById('conn')?.classList.contains('live') && document.querySelectorAll('#board .card').length > 10, null, 15000);
  if (view === 'office') webgl = await until(page, () => document.documentElement.dataset.boardView === 'office' && !document.querySelector('.office-view.loading'), null, 20000);
  await settle(page);
  return page;
}
// Runs a block of checks; a block that throws (an element the old layout doesn't have) fails as one check.
async function block(name, fn) { try { await fn(); } catch (e) { check(name, false, 'threw: ' + e.message.split('\n')[0]); } }
const close = (page) => page.browserContext().close();
const rect = (page, sel) => page.$eval(sel, (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; });

try {
  // ---- D-b: three columns and the 3D switch from 1280px; two columns and the plain board below ----
  await block('1279 / 1280', async () => {
    const p = await open({ w: 1279, h: 800, view: 'office' });
    const n = await p.evaluate(() => ({ view: document.documentElement.dataset.boardView, sw: !!document.getElementById('o3d').offsetWidth, left: document.getElementById('o-left').getBoundingClientRect().left, rcol: document.getElementById('o-rcol').getBoundingClientRect().left }));
    check('1279px wide, 3D saved on: the plain board in two columns (Agents and Activity under Needs attention), no 3D switch', n.view === 'board' && !n.sw && Math.abs(n.rcol - n.left) < 1, JSON.stringify(n));
    await p.setViewport({ width: 1280, height: 800 });
    check('1280px: 3D on, with the switch', await until(p, () => document.documentElement.dataset.boardView === 'office' && !!document.getElementById('o3d').offsetWidth, null, 20000));
    await close(p);
    const b = await open({ w: 1280, h: 800 });
    const c = await b.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); return { left: r('o-left').right, tasks: [r('o-tasks').left, r('o-tasks').right], rcol: r('o-rcol').left, sw: !!document.getElementById('o3d').offsetWidth }; });
    check('1280px, 3D off: three columns (Needs attention, the Tasks panel, Agents and Activity side by side) and the switch', c.left < c.tasks[0] && c.tasks[1] < c.rcol && c.sw, JSON.stringify(c));
    await b.screenshot({ path: `${out}/board-1280.png` });
    await close(b);
  });

  // ---- V2: one Tasks panel; its columns, cards and search exactly where they are with 3D on and off ----
  const where = (page) => page.evaluate(() => {
    const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width].map((v) => Math.round(v)); };
    return { panel: R(document.getElementById('o-tasks')), bar: ['tsearch', 'filter', 'viewtog', 'new-task-btn'].map((id) => R(document.getElementById(id))), cols: [...document.querySelectorAll('#board .col')].map((c) => [R(c.querySelector('h3')), R(c.querySelector('.card'))]) };
  });
  for (const [w, h] of [[1280, 800], [1440, 900], [1920, 1080]]) {
    await block(`V2 ${w}`, async () => {
      const b = await open({ w, h }); const off = await where(b); await close(b);
      const o = await open({ w, h, view: 'office' });
      if (!webgl) { check(`${w}×${h}: no WebGL here, the 3D checks skipped`, !process.env.CI, 'CI must run them'); await close(o); return; }
      const on = await where(o);
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      check(`${w}×${h}: the Tasks panel, its title bar's search, Show, Columns / Table and New task, column headings and first cards in exactly the same places with 3D on and off`, !!off.panel && off.cols.length >= 5 && same(on, off), JSON.stringify({ off, on }));
      await o.screenshot({ path: `${out}/office-${w}.png` });
      await close(o);
    });
  }

  if (webgl) {
    // ---- D-a: docked, as tall as its cards up to 65% of the room under the top bar; a search shrinks it ----
    await block('D-a', async () => {
      const o = await open({ w: 1440, h: 900, view: 'office' });
      const m = () => o.evaluate(() => { const t = document.getElementById('o-tasks').getBoundingClientRect(), v = document.getElementById('office-view').getBoundingClientRect(), edge = parseFloat(getComputedStyle(document.querySelector('main')).getPropertyValue('--edge')) || 12;
        return { h: Math.round(t.height), share: +(t.height / (v.bottom - edge - t.top)).toFixed(3), scrolls: [...document.querySelectorAll('#board .cards')].filter((u) => u.scrollHeight > u.clientHeight + 4).length, max: document.getElementById('o-tasks').classList.contains('max') }; });
      const a = await m();
      check('3D docked with many cards: the Tasks panel takes up to 65% of the room under the top bar (60-66%), its longest columns scroll inside', !a.max && a.share >= 0.6 && a.share <= 0.66 && a.scrolls >= 1, JSON.stringify(a));
      const title = await o.evaluate(() => state.tasks.find((t) => t.status === 'open').title);
      await o.type('#tsearch', title); await settle(o); await sleep(300);
      const s = await m();
      check('3D docked, a search that leaves one card: the panel shrinks to its cards (no column scrolls)', s.h < a.h - 150 && s.scrolls === 0, JSON.stringify(s));
      // ---- C2: Show's note (and the other notes above the columns) in the Tasks panel with 3D on ----
      await o.$eval('#tsearch', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
      const who = await o.$$eval('#filter option', (os) => os.map((x) => x.value).find((v) => v && v !== 'you'));
      await o.select('#filter', who); await settle(o);
      const fb = await o.evaluate(() => { const f = document.getElementById('filterbar'), t = document.getElementById('o-tasks').getBoundingClientRect(), r = f.getBoundingClientRect(); return { shown: !!f.offsetHeight, inside: r.top >= t.top && r.bottom <= t.bottom, text: f.innerText.trim().slice(0, 60) }; });
      check('3D: choosing someone in Show puts its note (and its Show everyone button) at the top of the Tasks panel', fb.shown && fb.inside, JSON.stringify(fb));
      await close(o);
    });
  }

  // ---- D-c: one line per agent; all 8 in view at 1440×900 with the planner and merges tags ----
  for (const view of ['board', 'office']) {
    await block(`D-c ${view}`, async () => {
      const p = await open({ w: 1440, h: 900, view });
      if (view === 'office' && !webgl) return close(p);
      const a = await p.evaluate(() => {
        const l = document.getElementById('o-agents').getBoundingClientRect(), rows = [...document.querySelectorAll('#people .o-agent')];
        const inView = (e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.top >= l.top - 0.5 && r.bottom <= l.bottom + 0.5; };
        return { n: rows.length, inView: rows.filter(inView).length, tallest: Math.round(Math.max(...rows.map((b) => b.getBoundingClientRect().height))),
          roles: [...document.querySelectorAll('#people .o-agent .o-rl')].filter((e) => { const r = e.getBoundingClientRect(), b = e.closest('.o-agent').getBoundingClientRect(); return r.width > 0 && r.right <= b.right + 0.5 && inView(e); }).map((e) => e.textContent) };
      });
      check(`${view} 1440×900: every agent (8) on one line (≤34px) and all of them in view in Agents`, a.n === 8 && a.inView === a.n && a.tallest <= 34, JSON.stringify(a));
      check(`${view} 1440×900: "planner" and "merges" tags in view on their agents' rows`, a.roles.includes('planner') && a.roles.includes('merges'), JSON.stringify(a.roles));
      await close(p);
    });
  }

  // ---- D-d, U10, V3, C6, V1 on the Board view at 1440×900 ----
  await block('board 1440', async () => {
    const p = await open({ w: 1440, h: 900 });
    check('Activity\'s filters: All, Chat, @me and Direct', (await p.$$eval('#tabs [data-tab]', (bs) => bs.map((b) => b.dataset.tab))).join() === 'all,chat,me,direct');
    const qb = () => p.$$eval('#board .card .qb', (bs) => bs.map((b) => b.getClientRects().length > 0));
    const q0 = await qb();
    await p.click('#o-left [data-o-fold]'); await settle(p);
    const q1 = await qb();
    check('a card\'s "question waiting" shows only while Needs attention (which has the question) is folded', q0.length >= 1 && q0.every((v) => !v) && q1.every((v) => v), JSON.stringify({ open: q0, folded: q1 }));
    // V3: the top bar's chips are as tall as a panel's title bar, folded or open.
    const v3 = await p.evaluate(() => ({ chip: document.getElementById('goal-btn').getBoundingClientRect().height, folded: document.getElementById('o-left').getBoundingClientRect().height, head: document.querySelector('#o-right > .o-head').getBoundingClientRect().height }));
    check('the top bar\'s chips are as tall as a folded panel (its title bar)', Math.abs(v3.chip - v3.folded) < 0.5 && Math.abs(v3.head - v3.folded) <= 2, JSON.stringify(v3));
    await p.click('#o-left [data-o-fold]'); await settle(p);
    // U10: an agent's row never shows the board's internal tool names.
    const u10 = await p.evaluate(() => { for (const a of state.presence) if (a.kind === 'agent') { a.doing = 'working (last board call: create_task)'; a.last = Date.now(); } render(); return document.getElementById('people').innerText; });
    check('an agent\'s row never names the board\'s own tools ("last board call: create_task")', !/create_task|last board call/.test(u10), u10.split('\n').find((l) => /create_task/.test(l)) || '');
    // C6: focus rings drawn inside the element (nothing scrolling cuts them).
    await p.keyboard.press('Shift');
    const ring = (sel) => p.evaluate((s) => { const e = [...document.querySelectorAll(s)].at(-1); e.focus(); const cs = getComputedStyle(e); const r = { sel: s, vis: e.matches(':focus-visible'), style: cs.outlineStyle, offset: parseFloat(cs.outlineOffset) }; e.blur(); return r; }, sel);
    const rings = [await ring('#board .card'), await ring('#people .o-agent'), await ring('#tabs button')];
    check('focus rings are inset (a card, the last agent row, a filter): no scrolling list cuts them', rings.every((r) => r.vis && r.style !== 'none' && r.offset < 0), JSON.stringify(rings));
    await close(p);
  });

  // ---- V1: the feed ends above the composer, File locks open, both views, laptop and desktop heights ----
  for (const [w, h] of [[1280, 720], [1440, 900]]) {
    for (const view of ['board', 'office']) {
      await block(`V1 ${w} ${view}`, async () => {
        const p = await open({ w, h, view });
        if (view === 'office' && !webgl) return close(p);
        if (await p.$eval('#o-locks', (e) => e.classList.contains('folded'))) { await p.click('#o-locks [data-o-fold]'); await settle(p); }
        const f = await p.evaluate(() => { const a = document.getElementById('feed').getBoundingClientRect(), w = document.querySelector('#o-act .feedwrap')?.getBoundingClientRect() || a, c = document.getElementById('composer').getBoundingClientRect(); return { feedBottom: Math.round(Math.max(a.bottom, w.bottom)), feedH: Math.round(Math.min(a.height, w.height)), composerTop: Math.round(c.top), locks: !document.getElementById('o-locks').classList.contains('folded') }; });
        check(`${view} ${w}×${h}, File locks open: the feed ends above the composer and keeps ≥96px`, f.locks && f.feedBottom <= f.composerTop && f.feedH >= 96, JSON.stringify(f));
        await close(p);
      });
    }
  }

  // ---- C5: popovers --gutter under what opens them ----
  for (const view of ['board', 'office']) {
    await block(`C5 ${view}`, async () => {
      const p = await open({ w: 1440, h: 900, view });
      if (view === 'office' && !webgl) return close(p);
      const gutter = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('main')).getPropertyValue('--gutter')));
      const gaps = {};
      for (const [btn, pop] of [['#goal-btn', '#o-goal'], ['#clock', '#o-dl'], ['#roles-btn', '#o-roles'], ['#topbar [data-act="setup-open"]', '#setup']]) {
        await p.click(btn); await until(p, (s) => !!document.querySelector(s)?.offsetHeight, pop); await settle(p);
        gaps[pop] = Math.round(((await rect(p, pop)).t - (await rect(p, '#topbar')).b) * 2) / 2;
        await p.keyboard.press('Escape'); await settle(p);
        if (await p.$eval(pop, (e) => !!e.offsetHeight)) { await p.click(btn); await settle(p); }
      }
      await p.click('#theme-btn'); await until(p, () => !!document.getElementById('theme-pop')?.offsetHeight); await settle(p);
      gaps['#theme-pop'] = Math.round(((await rect(p, '#theme-pop')).t - (await rect(p, 'header')).b) * 2) / 2;
      check(`${view}: every popover (goal, demo time, roles, Setup, theme) opens --gutter (${gutter}px) under the top bar or header`, Object.values(gaps).every((g) => g === gutter), JSON.stringify(gaps));
      await p.screenshot({ path: `${out}/${view}-theme-pop.png` });
      await close(p);
    });
  }

  // ---- C1, V5: themes ----
  await block('themes', async () => {
    const p = await open({ w: 1440, h: 900, contrast: true });
    const c = await p.evaluate(() => { const s = getComputedStyle(document.documentElement); return { line: s.getPropertyValue('--line').trim(), field: s.getPropertyValue('--field-line').trim() }; });
    check('high contrast (prefers-contrast: more) wins over the Dusk theme: lines as strong as field borders', !!c.line && c.line === c.field, JSON.stringify(c));
    await close(p);
    const l = await open({ w: 1440, h: 900, theme: 'light' });
    const v = await l.evaluate(() => { const s = getComputedStyle(document.documentElement); return { panel: s.getPropertyValue('--panel').trim(), raised: s.getPropertyValue('--raised').trim() }; });
    check('Light: raised rows (agent rows, cards) differ from the white panel', v.raised !== v.panel, JSON.stringify(v));
    await l.screenshot({ path: `${out}/board-light.png` });
    await close(l);
  });

  check('no page errors', !errors.length, errors.join(' | '));
} catch (e) {
  console.log('CRASH', e.stack);
  R.push('FAIL crashed');
}

demo.stdin.write('stop\n');
await Promise.race([demoExit, sleep(15000)]);
await finish(R, { browser });
