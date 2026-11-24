// "This board moved": the web board and the classic presenter turn the server's moved_to into a link (with the token
// in it) only when it stays on this server. A moved_to pointing elsewhere (//evil.example/…) never becomes a link.
// The 409 answers are made up in the browser (request interception). Starts its own throwaway board. Run all suites with: npm test
import { startBoard, launchBrowser, shotsDir, finish } from '../helpers.mjs';
import { viewerTokenFor } from '../../src/tokens.js';

const board = await startBoard();
const out = shotsDir('moved-origin');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const browser = await launchBrowser({ defaultViewport: { width: 1280, height: 900 } });

// A page whose /api/state answers 409 with this moved_to.
async function open(path, movedTo, setup) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (r) => (new URL(r.url()).pathname.endsWith('/api/state')
    ? r.respond({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'This board moved', moved_to: movedTo }) })
    : r.continue()));
  if (setup) await page.evaluateOnNewDocument(setup, board.token);
  await page.goto(board.base + path);
  return page;
}
const hrefs = (page) => page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href));

try {
  const store = (t) => { try { localStorage.setItem('board-token', t); localStorage.setItem('board-name', 'dana'); } catch {} };
  // ---- the web board ----
  let page = await open('/', '//evil.example/b/x', store);
  const failed = await page.waitForFunction(() => !document.getElementById('failed')?.hidden, { timeout: 15000 }).then(() => true).catch(() => false);
  let links = await hrefs(page);
  check('web board: a moved_to on another site is no link, and says to ask the host', failed && !links.some((h) => /evil\.example/.test(h)), links.filter((h) => /evil/.test(h)).join(' '));
  await page.screenshot({ path: `${out}/web-offsite.png` });
  await page.close();
  page = await open('/', '/b/other', store);
  const moved = await page.waitForFunction(() => !document.getElementById('moved')?.hidden, { timeout: 15000 }).then(() => true).catch(() => false);
  const href = await page.$eval('#moved-open', (a) => a.href).catch(() => '');
  check('web board: a moved_to on this server is a link there', moved && new URL(href).origin === new URL(board.base).origin && new URL(href).pathname === '/b/other/', href);
  await page.close();

  // ---- the classic presenter ----
  const view = viewerTokenFor(board.token);
  page = await open(`/present-classic.html?token=${view}`, '//evil.example/b/x');
  const said = await page.waitForFunction(() => /Ask the host for the new presenter link/.test(document.body.textContent), { timeout: 15000 }).then(() => true).catch(() => false);
  links = await hrefs(page);
  check('classic presenter: a moved_to on another site is no link', said && !links.some((h) => /evil\.example/.test(h)), links.filter((h) => /evil/.test(h)).join(' '));
  await page.close();
} catch (e) {
  check('suite ran without throwing', false, e?.stack || String(e));
}

await finish(results, { browser, board });
