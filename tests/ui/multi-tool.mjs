// Mixed-tools board: dana runs Claude Code + Codex on one laptop, bob uses Copilot in VS Code.

// Starts its own throwaway board. Run all suites with: npm test
import { startBoard, launchBrowser, shotsDir, finish, seed, Client, StreamableHTTPClientTransport } from '../helpers.mjs';

const board = await startBoard();
const BASE = board.base;
const out = shotsDir('multi-tool');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);

async function agent(name, client) {
  const c = new Client({ name: client, version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp?agent=${name}&token=testtok`)));
  return async (tool, args = {}) => {
    const r = await c.callTool({ name: tool, arguments: args });
    try { return JSON.parse(r.content[0].text); } catch { return r.content[0].text; }
  };
}
const dc = await agent('dana-claude', 'claude-code');
const dx = await agent('dana-codex', 'codex-mcp-client');
const bob = await agent('bob', 'Visual Studio Code');
for (const a of [dc, dx, bob]) await a('board_status'); // someone typed /board in each tool
await dc('set_goal', { goal: 'A voting app for hackathon projects. Demo: submit, vote, live leaderboard.' });
await dc('claim_role', { role: 'planner' });
const t1 = await dc('create_task', { title: 'Project scaffolding', priority: 1 });
const t2 = await dc('create_task', { title: 'Vote API' });
const t3 = await dc('create_task', { title: 'Leaderboard page' });
await dc('create_task', { title: 'Submission form' });
await dc('claim_task', { id: t1.id, as: 'setup' });
await dc('update_task', { id: t1.id, status: 'in_progress', as: 'setup' });
await dx('claim_task', { id: t2.id });
await dx('update_task', { id: t2.id, status: 'in_progress', note: 'endpoints drafted' });
await bob('claim_task', { id: t3.id });
await bob('post', { text: '@dana-codex which route prefix for the API?' });

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 1000 } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
await page.evaluateOnNewDocument(() => { try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); } catch {} });
await page.goto(BASE + '/');
await page.waitForSelector('#people [data-person-row]');
await new Promise((r) => setTimeout(r, 800));

// Agents: one row per agent; a person's rows read together as their card.
const cards = await page.$$eval('#people [data-person-row]', (els) => { const m = new Map(); for (const e of els) m.set(e.dataset.personRow, (m.get(e.dataset.personRow) || e.dataset.personRow + ' ') + e.innerText.replace(/\s+/g, ' ') + ' '); return [...m.values()]; });
const danaCard = cards.find((c) => c.startsWith('dana'));
check('one card for dana (not dana-claude / dana-codex)', cards.filter((c) => /^dana/.test(c)).length === 1, JSON.stringify(cards.map((c) => c.slice(0, 30))));
check('dana card lists both tools', /Claude Code/.test(danaCard) && /Codex/.test(danaCard), danaCard);
check('dana card shows Codex task and Claude helper task', /Vote API/.test(danaCard) && /Project scaffolding/.test(danaCard));
check('dana card has planner pill', /planner/.test(danaCard));
check('bob card shows Copilot (VS Code)', cards.some((c) => c.startsWith('bob') && /Copilot \(VS Code\)/.test(c)));

// Open setup: step 3 lists all tools; integrator dropdown lists individual agents
await page.evaluate(() => document.querySelector('[data-act="setup-open"], [data-act="setup-toggle"]')?.click());
await new Promise((r) => setTimeout(r, 300));
const step3 = await page.evaluate(() => { const b = document.querySelector('[data-step="start"]'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); return true; });
await new Promise((r) => setTimeout(r, 300));
const startText = await page.$eval('#step-start', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
check('U7 step 3 lists the tools in use', ['Claude Code', 'Codex', 'Copilot in VS Code'].every((t) => startText.includes(t)) && !startText.includes('Copilot CLI'), startText.slice(0, 300));
await page.click('#step-start [data-act="other-tools"]'); await new Promise((r) => setTimeout(r, 200));
const startAll = await page.$eval('#step-start', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
check('U7 "Other tools" shows the rest', startAll.includes('Copilot CLI'), startAll.slice(0, 300));
await page.evaluate(() => { const b = document.querySelector('[data-step="integrator"]'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); });
await new Promise((r) => setTimeout(r, 300));
const opts = await page.$$eval('#integ-sel option', (os) => os.map((o) => o.value)).catch(() => []);
check('integrator choices are agents', opts.includes('dana-claude') && opts.includes('dana-codex') && opts.includes('bob') && !opts.includes('dana'), JSON.stringify(opts));
await page.screenshot({ path: `${out}/m-desktop-dark.png`, fullPage: true });

await page.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 400));
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('mobile: no horizontal overflow', overflow <= 0, overflow + 'px');
await page.screenshot({ path: `${out}/m-mobile-dark.png`, fullPage: true });

check('no page/console errors', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
