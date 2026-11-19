// Visual snapshots: a few whole screens of a fixed board, compared pixel by pixel with the baselines in
// tests/ui/snapshots/*.png. The board is seeded the same way every run, on a fixed clock (the server through
// tests/fixtures/fixed-clock.mjs, the page with its Date frozen), in UTC and en-US, with reduced motion, at a fixed
// viewport, and the 3D room's canvas hidden (the panels over it are still checked). Fonts and text rendering differ
// between systems, so the baselines are made on CI (Linux, the pinned Chrome in .github/workflows/test.yml):
//   on CI (or COMPARE_SNAPSHOTS=1)  each screen is compared with its baseline; a missing baseline fails
//   anywhere else                   the screens are rendered and saved, not compared
//   UPDATE_SNAPSHOTS=1              writes the screens as the new baselines
//   SNAPSHOT_DIR=<dir>              baselines in another folder (default tests/ui/snapshots)
// Every screen is also saved as tests/ui/shots/snapshots/<name>.png (in the CI artifact: a candidate baseline), and a
// failed comparison draws what differs into tests/ui/shots/snapshots/diff/<name>.png. docs/testing.md has the steps.
// Run all suites with: npm test
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { ROOT, startBoard, launchBrowser, shotsDir, finish, seed, rest } from '../helpers.mjs';

const FIXED_NOW = Date.UTC(2026, 0, 15, 9, 0, 0); // the board server's clock starts here
const PAGE_NOW = FIXED_NOW + 3 * 60e3; // the page's frozen clock: everything seeded reads "3m ago", far from a rounding edge
const CHANNEL = 24; // a pixel differs when a colour channel is off by more than this (of 255)
const MAX_RATIO = 0.002; // a screen fails when more than this share of its pixels differ

const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';
const COMPARE = !UPDATE && (process.env.COMPARE_SNAPSHOTS === '1' || (!!process.env.CI && process.env.COMPARE_SNAPSHOTS !== '0'));
const BASE_DIR = path.resolve(ROOT, process.env.SNAPSHOT_DIR || path.join('tests', 'ui', 'snapshots'));
const out = shotsDir('snapshots');
fs.rmSync(path.join(out, 'diff'), { recursive: true, force: true });

const clock = pathToFileURL(path.join(ROOT, 'tests', 'fixtures', 'fixed-clock.mjs')).href;
const board = await startBoard({ env: { TZ: 'UTC', FIXED_NOW: String(FIXED_NOW), NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import=${clock}`.trim() } });
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);

// helpers.seed: three people with helpers, a task in every status, locks, questions, chat. Its stale task is aged on the
// test's own clock; here it is aged on the board's (40 minutes before it started), and the demo time is fixed too.
const t = await seed(board);
{
  const db = new DatabaseSync(path.join(board.dataDir, 'board.db'));
  db.prepare('UPDATE tasks SET updated_at=? WHERE id=?').run(FIXED_NOW - 40 * 60e3, t.vote.id);
  db.close();
}
await rest(board, 'dana', '/settings', 'PUT', { goal: 'A voting app for hackathon projects: teams submit, everyone votes, a live leaderboard', deadline: FIXED_NOW + 4 * 3600e3, freeze_minutes: 60 });

const browser = await launchBrowser({ office: true, args: ['--lang=en-US', '--force-color-profile=srgb', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];

// A page in its own browser context (its own storage), signed in as dana, settled: live, fonts loaded, nothing moving.
async function open({ vp, theme = 'dark', office = false, setup } = {}) {
  const page = await (await browser.createBrowserContext()).newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/WebGL|GPU stall|swiftshader/i.test(m.text())) errors.push(m.text()); });
  await page.setViewport({ deviceScaleFactor: 1, ...vp });
  await page.emulateTimezone('UTC');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'dark' }]);
  await page.evaluateOnNewDocument((now, theme, office) => {
    const Real = Date;
    window.Date = class extends Real { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } };
    try {
      localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); localStorage.setItem('board-setup', 'closed');
      localStorage.setItem('board-theme', theme); localStorage.setItem('agent-board-3d', office ? 'on' : 'off');
    } catch {}
    // No blinking caret, and the 3D room (drawn by WebGL, not pixel-stable) left out: the glass panels over it stay.
    addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '*{caret-color:transparent!important}#office-scene canvas{visibility:hidden!important}'; document.head.append(s); });
  }, PAGE_NOW, theme, office);
  if (setup) await page.evaluateOnNewDocument(setup);
  await page.goto(board.base + '/');
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 10000 });
  if (office) await page.waitForFunction(() => document.documentElement.dataset.boardView === 'office' && !!document.querySelector('#office-scene canvas'), { timeout: 20000 });
  return page;
}
const settle = (page) => page.evaluate(async () => {
  await document.fonts.ready;
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  for (let i = 0; i < 100 && document.getAnimations().some((a) => a.playState === 'running'); i++) await frame();
  await frame(); await frame();
  await new Promise((r) => setTimeout(r, 300));
});

// The comparison runs in a blank page: both PNGs decoded by the browser onto canvases, their pixels compared; on a
// failure it returns a diff image (the current screen faded, the differing pixels in red).
const cmp = await browser.newPage();
const compare = (a, b) => cmp.evaluate(async (a, b, CHANNEL) => {
  const img = (b64) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('not a PNG')); i.src = 'data:image/png;base64,' + b64; });
  const [ia, ib] = await Promise.all([img(a), img(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return { size: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
  const px = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height); };
  const pa = px(ia).data; const cur = px(ib); const pb = cur.data;
  let bad = 0; let worst = 0;
  const diff = new Uint8ClampedArray(pb.length);
  for (let i = 0; i < pa.length; i += 4) {
    const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]), Math.abs(pa[i + 3] - pb[i + 3]));
    if (d > worst) worst = d;
    const g = (pb[i] + pb[i + 1] + pb[i + 2]) / 12 + 170; // faded grey
    if (d > CHANNEL) { bad++; diff.set([255, 0, 0, 255], i); } else diff.set([g, g, g, 255], i);
  }
  const ratio = bad / (pa.length / 4);
  let png = '';
  if (bad) { const c = document.createElement('canvas'); c.width = ib.width; c.height = ib.height; c.getContext('2d').putImageData(new ImageData(diff, ib.width, ib.height), 0, 0); png = c.toDataURL('image/png').split(',')[1]; }
  return { bad, ratio, worst, png };
}, a, b, CHANNEL);

let maxRatio = 0;
async function snap(name, page, what) {
  await settle(page);
  const png = Buffer.from(await page.screenshot({ type: 'png' }));
  fs.writeFileSync(path.join(out, `${name}.png`), png);
  const base = path.join(BASE_DIR, `${name}.png`);
  if (UPDATE) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
    fs.writeFileSync(base, png);
    return check(`${name}: ${what} — baseline written`, true, path.relative(ROOT, base));
  }
  if (!COMPARE) return check(`${name}: ${what} — rendered, not compared (baselines are for CI's Linux Chrome; COMPARE_SNAPSHOTS=1 compares)`, true);
  if (!fs.existsSync(base)) return check(`${name}: ${what} — no baseline`, false, `${path.relative(ROOT, base)} is missing. This run's screen is the candidate: tests/ui/shots/snapshots/${name}.png (in the CI ui-screenshots artifact); check it and commit it as the baseline`);
  const r = await compare(fs.readFileSync(base).toString('base64'), png.toString('base64'));
  if (r.size) return check(`${name}: ${what} — matches its baseline`, false, `size differs: baseline ${r.size}`);
  maxRatio = Math.max(maxRatio, r.ratio);
  const ok = r.ratio <= MAX_RATIO;
  if (!ok) { fs.mkdirSync(path.join(out, 'diff'), { recursive: true }); fs.writeFileSync(path.join(out, 'diff', `${name}.png`), Buffer.from(r.png, 'base64')); }
  check(`${name}: ${what} — matches its baseline`, ok, `${r.bad} pixels differ (${(r.ratio * 100).toFixed(3)}%, at most ${(MAX_RATIO * 100).toFixed(1)}%; largest channel difference ${r.worst})${ok ? '' : `: the screen is tests/ui/shots/snapshots/${name}.png, what differs is tests/ui/shots/snapshots/diff/${name}.png`}`);
}

const desk = { width: 1440, height: 900 };
let p = await open({ vp: desk });
await snap('board-1440-dark', p, 'the Board view at 1440x900, Dark');
await p.click('[data-view="table"]');
await p.waitForFunction(() => !document.getElementById('tasktable').hidden && document.querySelectorAll('#tasktable tbody tr').length > 0);
await snap('table-1440-dark', p, 'the Table view');
await p.click('[data-view="columns"]');
await p.evaluate((id) => openTask(id), t.schema.id);
await p.waitForSelector('#task-dlg[open]');
await snap('task-dialog-1440-dark', p, 'the task dialog of a task in progress');
await p.close();

p = await open({ vp: desk, office: true });
await snap('office-docked-1440-dark', p, 'the 3D view with the Tasks window docked (room hidden)');
await p.close();

p = await open({ vp: desk, theme: 'light' });
await snap('board-1440-light', p, 'the Board view, Light');
await p.close();

p = await open({ vp: { width: 1280, height: 800 } });
await snap('board-1280-dark', p, 'the Board view at 1280x800');
await p.close();

p = await open({ vp: { width: 390, height: 844, isMobile: true, hasTouch: true } });
await snap('phone-390-dark', p, 'a phone, 390x844');
await p.close();

check('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
if (COMPARE) console.log(`largest share of differing pixels: ${(maxRatio * 100).toFixed(4)}%`);
await finish(R, { browser, board });
