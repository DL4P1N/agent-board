// Checks for the merged expert-review fixes.
// Starts its own throwaway board. Run all suites with: npm test
import { startBoard, launchBrowser, shotsDir, finish, seed, Client, StreamableHTTPClientTransport } from '../helpers.mjs';

const board = await startBoard();
const BASE = board.base;
const out = shotsDir('usability');
const results = [];
const check = (n, ok, x = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rest = (who, path, method = 'GET', body) => fetch(BASE + '/api' + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer testtok', 'X-Agent': who }, body: body && JSON.stringify(body) }).then((r) => r.json());
// slots: how many tasks the agent's plan lets it hold at once (the busy board needs more than the default).
async function agent(name, client = 'claude-code', slots = 0) {
  const c = new Client({ name: client, version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp?agent=${encodeURIComponent(name)}&token=testtok${slots ? `&slots=${slots}` : ''}`)));
  return async (tool, args = {}) => { const r = await c.callTool({ name: tool, arguments: args }); const t = r.content[0].text; if (r.isError) console.log('ERR', name, tool, t); try { return JSON.parse(t); } catch { return t; } };
}

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 1000 } });
const errors = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|ERR_CONNECTION|EventSource/i.test(m.text()) && errors.push('console: ' + m.text()));
  page.on('dialog', (d) => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
};
const scheme = (page, s) => page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: s }]);
const txt = (page, sel) => page.$eval(sel, (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
const reload = (page) => page.evaluate(() => load());
const openStep = async (page, key) => { await page.evaluate((k) => { const b = document.querySelector('[data-step="' + k + '"]'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }, key); await sleep(200); };

// Contrast helpers (run in the page)
const CONTRAST_FNS = `
  window.__lum = (c) => { const m = c.match(/[\\d.]+/g).map(Number); return m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); };
  window.__cr = (a, b) => { const x = __lum(a), y = __lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };`;

try {
  // ================= Part A: guidance on a fresh board =================
  const page = await browser.newPage(); watch(page);
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); } catch {} });
  await page.goto(BASE + '/');
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 5000 });
  await sleep(300);
  check('A empty: phase track leads with Connect, same as what-to-do', await page.$eval('.phases .cur', (e) => e.textContent) === 'Connect' && /Connect your first laptop/.test(await txt(page, '#now')), await txt(page, '#now'));
  check('A header has Copy board link', await page.$eval('#link-btn', (b) => b.getAttribute('aria-label')) === 'Copy board link');
  await page.click('#link-btn'); await sleep(200);
  check('A copy board link gives feedback', /Board link copied/.test(await txt(page, '#toasts')));
  check('A step 1 offers Copy invite message', !!(await page.$('#step-invite [data-act="copy-invite"]')));
  await scheme(page, 'light'); await sleep(150); await page.screenshot({ path: `${out}/r-empty-light.png` });
  await scheme(page, 'dark'); await sleep(150); await page.screenshot({ path: `${out}/r-empty-dark.png` });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await sleep(300);
  await page.screenshot({ path: `${out}/r-empty-phone-dark.png` });
  await page.setViewport({ width: 1440, height: 1000 }); await sleep(200);

  // An agent's tool connects, but nobody typed /board yet.
  const erin = await agent('erin', 'claude-code');
  await reload(page); await sleep(300);
  const inv = await page.$eval('#step-invite', (e) => ({ done: e.classList.contains('done'), t: e.innerText.replace(/\s+/g, ' ') }));
  check('A step 1 never shows as done; says "invite more"', !inv.done && /1 laptop connected · invite more/.test(inv.t), inv.t.slice(0, 120));
  check('A step 3 not done while agent only connected', await page.$eval('#step-start', (e) => !e.classList.contains('done') && /connected, not started/.test(e.innerText)));
  await openStep(page, 'invite');
  check('A chip says connected · not started — type /board', /erin.*connected · not started — type \/board/.test(await txt(page, '#step-invite .chips')), await txt(page, '#step-invite .chips'));
  check('A person row says not started', /not started — type \/board/.test(await txt(page, '#people')), await txt(page, '#people'));

  // Goal set, no tasks, no planner, nobody started.
  await openStep(page, 'goal');
  await page.click('#goal-in');
  await page.keyboard.press('Enter'); await sleep(200);
  check('A empty goal: inline error with aria-invalid', await page.evaluate(() => $('goal-in').getAttribute('aria-invalid') === 'true' && /Write a sentence/.test($('goal-err').textContent) && $('goal-in').getAttribute('aria-describedby').includes('goal-err')));
  check('A goal hint: agent may also ask in its terminal', /may also ask you for the goal in its terminal/.test(await txt(page, '#step-goal')));
  await page.type('#goal-in', 'A voting app for hackathon projects. Demo: submit, vote, live leaderboard.');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /No agent has started yet/.test(document.getElementById('now').innerText), { timeout: 5000 }).catch(() => {});
  check('A what-to-do: "No agent has started yet. Did everyone type /board ($board in Codex)?"', /No agent has started yet\. Did everyone type \/board \(\$board in Codex\)\?/.test(await txt(page, '#now')), await txt(page, '#now'));

  // Project repo URL
  await openStep(page, 'goal');
  await page.type('#repo-in', 'not a url');
  await page.click('[data-fk="repo-save"]'); await sleep(200);
  check('A bad repo URL: inline error + aria-invalid', await page.evaluate(() => $('repo-in')?.getAttribute('aria-invalid') === 'true' && /git URL/.test($('repo-err').textContent)));
  await page.click('#repo-in', { count: 3 }); await page.type('#repo-in', 'https://github.com/team/vote-app');
  await page.click('[data-fk="repo-save"]'); await sleep(500);
  const st1 = await rest('dana', '/state');
  check('A repo saved to settings', st1.settings.repo === 'https://github.com/team/vote-app', st1.settings.repo);
  const invite = await page.evaluate(() => inviteText());
  check('A invite message has every step', ['git clone https://github.com/DL4P1N/claude-board', 'npm run join -- --url http://', '--token testtok', 'git clone https://github.com/team/vote-app', '/board', '$board', 'copilot --allow-tool board --autopilot --max-autopilot-continues 50', 'Just watching? Open http://'].every((s) => invite.includes(s)), invite);
  await openStep(page, 'invite');
  await page.click('[data-act="copy-invite"]'); await sleep(200);
  check('A copy invite gives feedback', /Invite copied/.test(await txt(page, '#toasts')));
  const hasLan = st1.setup.join_commands[0].label.startsWith('same wifi');
  if (hasLan) check('A address wording: "Works for teammates on the same wifi" (adapter in tooltip)', await page.evaluate(() => [...document.querySelectorAll('#step-invite .hint')].some((h) => /^Works for teammates on the same wifi/.test(h.textContent) && /same wifi\/LAN — /.test(h.title))) && !/same wifi\/LAN —/.test(await txt(page, '#step-invite')));

  // Step 3: Copilot CLI gets two commands
  await openStep(page, 'start');
  check('A Copilot CLI: launch box + /board box', await page.evaluate(() => /copilot --allow-tool board/.test(document.querySelector('[data-fk="cp-start-copilot-cli-launch"]')?.previousElementSibling?.textContent || '') && !!document.querySelector('[data-fk="cp-start-copilot-cli"]')));
  // ONB-6: one Copilot CLI command everywhere (step 3, invite, help), taken from the server's agent_tools.
  const cpl = st1.setup.agent_tools.find((t) => t.id === 'copilot-cli')?.launch;
  const cpBoxes = await page.evaluate(() => ({ step: document.querySelector('[data-fk="cp-start-copilot-cli-launch"]')?.previousElementSibling?.textContent || '', help: document.querySelector('#help-dlg').textContent.replace(/\s+/g, ' ') }));
  check('ONB-6 Copilot CLI launch: full --autopilot command in step 3, invite and help', cpl === 'copilot --allow-tool board --autopilot --max-autopilot-continues 50' && cpBoxes.step.includes(cpl) && invite.includes(cpl) && cpBoxes.help.includes(cpl), JSON.stringify({ cpl, step: cpBoxes.step }));
  // ONB-5 / DOC-6: every list of tools names Gemini CLI and Cursor too; the Questions entry doesn't rely on colour.
  const tl = await page.evaluate(() => [document.querySelector('#gate .lede'), document.querySelector('#setup .intro'), document.querySelector('#help-dlg .gloss')].map((e) => e?.textContent || ''));
  check('ONB-5 gate, Start here intro and help list Gemini CLI and Cursor', tl.every((t) => /Gemini CLI/.test(t) && /Cursor/.test(t)), tl.map((t) => t.slice(0, 80)).join(' | '));
  check('DOC-6 help: Questions point at the "waiting for a human answer" panel, not a colour', /waiting for a human answer/.test(tl[2]) && !/orange/i.test(tl[2]));
  // ONB-10: one time format: no seconds, no leading zero, weekday only when it isn't today.
  const tf = await page.evaluate(() => { const d = new Date(); d.setHours(9, 5, 7, 0); const y = new Date(d); y.setDate(y.getDate() - 2); return { c: clock(+d), w: when(+d), wy: when(+y), f: fullTime(+d), a: ago(+y) }; });
  check('ONB-10 clock: "9:05 AM"-style, no seconds or leading zero; other days get a weekday', /^9[:.]05/.test(tf.c) && !/07/.test(tf.c + tf.f) && tf.w === tf.c && /^\D+ 9[:.]05/.test(tf.wy) && tf.a === tf.wy, JSON.stringify(tf));
  check('A two-tools hint', /Two tools on one laptop\? Start each one in the folder join printed for it/.test(await txt(page, '#step-start')));
  await openStep(page, 'integrator');
  check('A integrator empty option wording', (await page.$eval('#integ-sel option', (o) => o.textContent)) === 'Let the first agent with finished work do it');

  // erin really starts
  await erin('board_status'); await sleep(500);
  check('A step 3 ticks once an agent started', await page.$eval('#step-start', (e) => e.classList.contains('done') && /1 agent started/.test(e.innerText)));
  check('A low-priority offer: Connect your laptop\'s agent', /Connect your laptop's agent/.test(await txt(page, '#now .na2')) && /Nothing to do yet/.test(await txt(page, '#now .na')), await txt(page, '#now'));

  // Mentions: only direct ones count; they clear once seen in the feed
  await erin('post', { text: '@all standup in 5' }); await erin('post', { text: '@everyone ship it' }); await sleep(500);
  check('A @all/@everyone not counted', (await page.$eval('[data-tab="me"]', (b) => b.getAttribute('aria-label'))) === '@me' && !/mention/.test(await page.$eval('#needs', (e) => e.querySelector('button')?.getAttribute('aria-label') || '')));
  await erin('post', { text: '@dana can you check the goal?' }); await sleep(500);
  check('A direct @dana counted; @me accessible name', (await page.$eval('[data-tab="me"]', (b) => b.getAttribute('aria-label'))) === '@me, 1 unread');
  await sleep(2600);
  check('A mention cleared after being visible in the feed', (await page.$eval('[data-tab="me"]', (b) => b.getAttribute('aria-label'))) === '@me' && !/mention/.test(await page.$eval('#needs', (e) => e.querySelector('button')?.getAttribute('aria-label') || '')));

  // Tasks + my own agent → setup collapses, calm state suggests picking a merger
  // A human adds it: an agent's own create_task would count as recent work and make it busy, not idle.
  const t1 = await rest('dana', '/tasks', 'POST', { title: 'Project scaffolding' });
  const dc = await agent('dana-claude', 'claude-code'); await dc('board_status');
  await page.evaluate(() => { localStorage.removeItem('board-setup'); ui.forceSetup = false; ui.steps = {}; });
  await reload(page); await sleep(400);
  check('A collapsed Setup button names what is left', (await txt(page, '[data-act="setup-open"]')) === 'Setup: pick merger', await txt(page, '[data-act="setup-open"]'));
  check('A summary bar: "Connect a laptop" + repo', /Connect a laptop/.test(await txt(page, '#setup')) && /Repo: https:\/\/github.com\/team\/vote-app/.test(await txt(page, '#setup')));
  // One task for two idle agents: the low-priority offer asks for more tasks first...
  check('A All good + "2 agents are idle: add tasks…"', /All good/.test(await txt(page, '#now .na')) && /2 agents are idle: add tasks or ask the planner for more/.test(await txt(page, '#now .na2')), await txt(page, '#now'));
  // ...and once there is enough work, it suggests picking a merger.
  const t1b = await erin('create_task', { title: 'Database schema' });
  await reload(page); await sleep(300);
  check('A All good + "While you wait: pick who merges to main"', /All good/.test(await txt(page, '#now .na')) && /While you wait: pick who merges to main/.test(await txt(page, '#now .na2')), await txt(page, '#now'));

  // Every task done ranks above an unread mention
  await page.$eval('#feed', (f) => { f.scrollTop = 0; });
  for (const t of [t1, t1b]) await rest('dana', `/tasks/${t.id}`, 'PATCH', { status: 'done' });
  await erin('post', { text: '@dana all merged!' }); await sleep(500);
  check('A all-done outranks mentions (the mention follows under Also)', /Every task is done/.test(await txt(page, '#now .na')) && !!(await page.$('#now .also [data-go="mentions"]')), await txt(page, '#now'));
  await page.close();

  // ================= Part B: busy board =================
  await board.restart();
  const A = {
    alice: await agent('alice', 'claude-code', 5), bob: await agent('bob', 'Visual Studio Code', 5), chen: await agent('chen', 'codex-mcp-client', 5),
    erin: await agent('erin', 'GitHub Copilot CLI', 5), dc: await agent('dana-claude', 'claude-code', 5), dx: await agent('dana-codex', 'codex-mcp-client', 5),
  };
  for (const a of Object.values(A)) await a('board_status');
  await A.alice('set_goal', { goal: 'A voting app for hackathon projects: teams submit, everyone votes, a live leaderboard shows the winners at the demo.' });
  await A.alice('claim_role', { role: 'planner' });
  await rest('dana', '/settings', 'PUT', { repo: 'https://github.com/team/vote-app' });
  const titles = ['Project scaffolding (Vite + Express)', 'Database schema for users, teams and submissions', 'REST API for submissions', 'Google OAuth login', 'Submission form UI', 'Voting endpoint with rate limit',
    'Leaderboard page with live refresh', 'CI pipeline with tests on PRs', 'Demo README with screenshots', 'Seed script with demo teams', 'Team profile page', 'Admin moderation queue', 'Email notifications for winners',
    'Dark mode theme', 'Accessibility pass on forms', 'Rate limit dashboard', 'Image upload for submissions', 'Search and filter submissions', 'Vote fraud detection heuristics', 'Countdown timer for voting window',
    'Export results as CSV', 'Mobile layout for leaderboard', 'Error tracking setup', 'Load test the voting endpoint', 'Landing page copy', 'Judges scoring mode', 'Websocket live updates', 'Docker compose for local dev', 'Privacy policy page', 'Final demo script'];
  const ids = [];
  for (let i = 0; i < titles.length; i++) ids.push((await A.alice('create_task', { title: titles[i], priority: i < 4 ? 1 : i > 24 ? 3 : 2, description: 'Acceptance: works end to end in the demo.' })).id);
  const who = [A.alice, A.bob, A.chen, A.erin, A.dc, A.dx];
  const helpers = [undefined, 'ui-worker', undefined, undefined, 'db-worker', undefined];
  const plan = { done: [0, 1, 2, 7, 9, 27], review: [3, 10, 13], in_progress: [4, 5, 6, 11, 12, 14], blocked: [15, 16], claimed: [17, 18, 19] };
  let k = 0;
  for (const [status, list] of Object.entries(plan)) for (const i of list) {
    const ag = who[k % who.length]; const as = helpers[k % who.length]; k++;
    await ag('claim_task', { id: ids[i], as });
    if (status !== 'claimed') await ag('update_task', { id: ids[i], status: status === 'done' ? 'review' : status, note: status === 'blocked' ? (i === 15 ? 'need the Grafana API key to read rate limits' : 'S3 bucket not created yet') : status === 'review' ? 'pushed, PR ready' : undefined, as });
    if (status === 'done') await rest('dana', `/tasks/${ids[i]}`, 'PATCH', { status: 'done' });
  }
  const blockedQ = await who[(plan.done.length + plan.review.length + plan.in_progress.length) % 6]('ask_human', { question: 'Which Grafana instance should the rate limit dashboard read from: the shared one or a new one?', task_id: ids[15], as: helpers[(plan.done.length + plan.review.length + plan.in_progress.length) % 6] });
  await A.chen('ask_human', { question: 'Should the leaderboard show vote counts publicly, or only ranks?', task_id: ids[6] });
  await A.bob('post', { text: '@dana can you look at the submission form styling?' });
  await A.erin('post', { text: 'Countdown timer is half done, @alice which timezone do we show?' });
  for (let i = 0; i < 6; i++) await who[i]('post', { text: `status: ${['schema merged', 'form layout done', 'leaderboard wired to API', 'CI green on main', 'db migrations pass', 'vote endpoint drafted'][i]}` });
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(board.dataDir + '/board.db');
  const staleId = ids[12];
  db.prepare('UPDATE tasks SET updated_at=? WHERE id=?').run(Date.now() - 42 * 60e3, staleId);
  db.close();

  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage(); watch(p);
  await p.evaluateOnNewDocument((s) => { eval(s); try { localStorage.setItem('board-token', 'testtok'); localStorage.setItem('board-name', 'dana'); } catch {} }, CONTRAST_FNS);
  await scheme(p, 'dark');
  await p.setViewport({ width: 1366, height: 768 });
  await p.goto(BASE + '/');
  await p.waitForFunction(() => document.getElementById('conn').classList.contains('live') && document.querySelectorAll('.card').length > 20, { timeout: 8000 });
  await sleep(400);
  const lay = await p.evaluate(() => ({ board: $('board').getBoundingClientRect().top + scrollY, card: document.querySelector('#board .card').getBoundingClientRect().top + scrollY, colW: $('col-open').offsetWidth, people: $('people').closest('.panel').offsetHeight, persons: document.querySelectorAll('#people .person').length }));
  check('B busy: 5 people, compact people panel', lay.persons === 5 && lay.people < 200, JSON.stringify(lay));
  check('B 1366×768: kanban starts in the first viewport', lay.board < 768 && lay.card < 768 - 40, JSON.stringify(lay));
  check('B columns at least 170px wide', lay.colW >= 170, lay.colW + 'px');
  const doneTxt = await p.$eval('#col-done', (e) => e.textContent.trim());
  check('B Done collapsed to "Done 6" (the column\'s own name, as in every view)', /Done 6/.test(doneTxt) && !/Merged/.test(doneTxt), doneTxt);
  await p.screenshot({ path: `${out}/r-busy-1366-dark.png` });
  await scheme(p, 'light'); await sleep(150); await p.screenshot({ path: `${out}/r-busy-1366-light.png` });
  await p.setViewport({ width: 1440, height: 1000 }); await sleep(250);
  await p.screenshot({ path: `${out}/r-busy-1440-light.png` });
  await scheme(p, 'dark'); await sleep(150); await p.screenshot({ path: `${out}/r-busy-1440-dark.png` });

  // Blocked card: latest note + question badge
  const bcard = await txt(p, `.card[data-id="${ids[15]}"]`);
  check('B blocked card shows its latest blocked note', /need the Grafana API key/.test(bcard), bcard);
  check('B blocked card aria-label has note + waits/priority wording', await p.$eval(`.card[data-id="${ids[15]}"]`, (c) => /blocked: need the Grafana/.test(c.getAttribute('aria-label')) && /priority/.test(c.getAttribute('aria-label'))));
  await p.click(`.card[data-id="${ids[15]}"] .qb`); await sleep(500);
  check('B "question waiting" badge jumps to that question', await p.evaluate((q) => document.activeElement?.id === 'qa-' + q, blockedQ.question_id));

  // Kanban semantics
  // Named "<heading>, N tasks" (an aria-label, so no stray space before the comma); cards in lists.
  check('B columns are regions named after their headings; cards in lists', await p.evaluate(() => [...document.querySelectorAll('.col')].every((c) => { const h = document.getElementById('colh-' + c.dataset.status); return c.getAttribute('role') === 'region' && h && (c.getAttribute('aria-label') || '').startsWith(h.textContent.replace(/[^A-Za-z ]/g, '').trim() + ', ') && /, \d+ tasks?$/.test(c.getAttribute('aria-label')); }) && !!document.querySelector('.col ul.cards > li > .card')));

  // Stale card: Ping + Release (with Undo)
  const before = (await rest('dana', '/state')).events.length;
  await p.click(`[data-ping="${staleId}"]`); await sleep(600);
  const evs = (await rest('dana', '/state')).events;
  check('B stale card: one-click Ping posts an @mention', evs.some((e) => e.kind === 'message' && e.author === 'dana' && new RegExp(`#${staleId} has had no update`).test(e.text)), before);
  const owner = (await rest('dana', '/state')).tasks.find((t) => t.id === staleId).assignee;
  await p.click(`[data-release="${staleId}"]`);
  await p.waitForFunction((id) => document.querySelector(`#col-open .card[data-id="${id}"]`), { timeout: 5000 }, staleId);
  check('B stale card: Release to Open', (await rest('dana', '/state')).tasks.find((t) => t.id === staleId).status === 'open');
  await p.waitForSelector('#toasts button'); await p.click('#toasts button'); await sleep(800);
  const back = (await rest('dana', '/state')).tasks.find((t) => t.id === staleId);
  check('B Undo on the moved toast restores status and owner', back.status === 'in_progress' && back.assignee === owner, `${back.status} ${back.assignee}`);

  // Move… by keyboard
  const openId = ids[25];
  await p.focus(`.card[data-id="${openId}"]`);
  await p.keyboard.press('Tab');
  check('B Tab from a card reaches its Move… button', await p.evaluate((id) => document.activeElement?.dataset.move === String(id), openId));
  await p.keyboard.press('Enter'); await sleep(200);
  for (let i = 0; i < 6 && !(await p.evaluate(() => document.activeElement?.dataset.moveTo === 'review')); i++) await p.keyboard.press('Tab');
  await p.keyboard.press('Enter'); await sleep(700);
  check('B Move… menu changes status by keyboard', (await rest('dana', '/state')).tasks.find((t) => t.id === openId).status === 'review');

  // Feed keeps the reader's place
  await p.$eval('#feed', (f) => { f.scrollTop = 150; }); await sleep(200);
  const anc = await p.evaluate(() => { const f = $('feed'); for (const n of f.children) if (n.offsetTop + n.offsetHeight > f.scrollTop) return { id: n.dataset.eid, off: n.offsetTop - f.scrollTop }; });
  for (let i = 0; i < 3; i++) await rest('chen', '/messages', 'POST', { text: 'new message ' + i });
  // Wait for the live update to land (the "new messages" button appears) instead of a fixed sleep: slow machines vary.
  await p.waitForFunction(() => !document.getElementById('jump').hidden, { timeout: 5000 }).catch(() => {});
  await sleep(200);
  const anc2 = await p.evaluate((id) => { const f = $('feed'); const n = f.querySelector(`[data-eid="${id}"]`); return n ? n.offsetTop - f.scrollTop : null; }, anc.id);
  check('B feed scroll anchor kept when new events arrive', anc2 !== null && Math.abs(anc2 - anc.off) <= 2 && !(await p.$eval('#jump', (j) => j.hidden)), `${anc.off} → ${anc2}`);
  check('B consecutive status lines grouped', await p.evaluate(() => document.querySelectorAll('#feed .ev.sys.cont').length > 0));
  check('B feed name/#id buttons are not Tab stops', await p.evaluate(() => [...document.querySelectorAll('#feed button')].every((b) => b.tabIndex === -1)));

  // Tab stops before the first card + skip link
  await p.reload(); await p.waitForFunction(() => document.querySelectorAll('.card').length > 20); await sleep(300);
  let stops = 0; let first = null;
  for (; stops < 80; ) { await p.keyboard.press('Tab'); stops++; const d = await p.evaluate(() => ({ card: document.activeElement?.classList.contains('card'), t: document.activeElement?.textContent.slice(0, 20) })); if (stops === 1) first = d.t; if (d.card) break; }
  check('B first card within 30 Tab stops (was 39)', stops <= 30, `${stops} stops`);
  await p.reload(); await p.waitForFunction(() => document.querySelectorAll('.card').length > 20); await sleep(300);
  await p.keyboard.press('Tab');
  const sk0 = await p.evaluate(() => document.activeElement?.textContent);
  await p.keyboard.press('Tab');
  const sk = await p.evaluate(() => document.activeElement?.textContent);
  await p.keyboard.press('Enter'); await sleep(200);
  check('B first skip link is "Skip to what needs you"', sk0 === 'Skip to what needs you', sk0);
  check('B skip link "Skip to tasks" focuses the first card', sk === 'Skip to tasks' && await p.evaluate(() => document.activeElement?.classList.contains('card')), sk);
  await p.reload(); await p.waitForFunction(() => document.querySelectorAll('.card').length > 20); await sleep(300);
  await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); await sleep(200);
  check('B "Skip to what needs you" focuses the What to do now lead', await p.evaluate(() => !!document.activeElement?.closest('#now')), await p.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));

  // Answering a question moves focus to the next one; live region announces new questions
  const q1 = await p.$eval('.qcard textarea', (t) => t.id);
  await p.click('#' + q1); await p.type('#' + q1, 'Use the shared one'); await p.keyboard.press('Enter');
  await p.waitForFunction((id) => !document.getElementById(id), { timeout: 5000 }, q1); await sleep(200);
  check('B after answering, focus moves to the next question', await p.evaluate(() => document.activeElement?.matches('.qcard textarea')));
  await A.bob('ask_human', { question: 'Is a 10 votes per person cap fine?' }); await sleep(900);
  check('B live region announces the new question once', /New question from bob/.test(await p.$eval('#announcer', (a) => a.textContent)));
  check('B #conn is not re-announced (no change → no DOM write)', await p.evaluate(() => { const c = $('conn'); let n = 0; new MutationObserver(() => n++).observe(c, { childList: true, characterData: true, subtree: true }); setConn('live'); setConn('live'); return new Promise((r) => setTimeout(() => r(n === 0), 50)); }));

  // Task dialog: conflict only for fields I edited; Esc asks before discarding
  const dId = ids[28];
  await p.click(`.card[data-id="${dId}"] .ct`); await p.waitForSelector('#task-dlg[open]');
  await p.click('#td-desc'); await p.keyboard.type(' Also link it from the footer.');
  await A.alice('update_task', { id: dId, note: 'looking at this next' }); await sleep(700);
  check('B dialog: agent note does not trigger a conflict warning', await p.$eval('#td-conflict', (e) => e.hidden));
  await rest('bob', `/tasks/${dId}`, 'PATCH', { title: 'Privacy policy + terms page' }); await sleep(700);
  check('B dialog: untouched field follows the server silently', (await p.$eval('#td-name', (e) => e.value)) === 'Privacy policy + terms page' && await p.$eval('#td-conflict', (e) => e.hidden));
  await rest('bob', `/tasks/${dId}`, 'PATCH', { description: 'Server-side description' }); await sleep(700);
  const cf = await p.$eval('#td-conflict', (e) => (e.hidden ? '' : e.textContent));
  check('B dialog: warns when a field I edited changed on the server', /description/.test(cf), cf);
  check('B dialog: history scrolled to newest', await p.$eval('#td-history', (h) => h.scrollHeight - h.scrollTop - h.clientHeight < 4));
  await p.keyboard.press('Escape'); await sleep(200);
  check('B dialog: Esc with unsaved edits asks first', await p.evaluate(() => $('task-dlg').open && !$('td-discard').hidden && document.activeElement?.id === 'td-keep'));
  await p.click('#td-drop'); await sleep(200);
  check('B dialog: Discard closes it', await p.evaluate(() => !$('task-dlg').open));

  // Shortcut toggle
  await p.click('#help-btn'); await sleep(150);
  await p.click('#keys-on'); await p.keyboard.press('Escape'); await sleep(150);
  await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press('n'); await sleep(200);
  check('B single-key shortcuts can be turned off (persisted)', await p.evaluate(() => !$('task-dlg').open && localStorage.getItem('board-keys') === 'off'));
  await p.click('#help-btn'); await sleep(150); await p.click('#keys-on'); await p.keyboard.press('Escape');

  // Disconnected banner
  await p.evaluate(() => setConn('down', 'Disconnected, retrying…'));
  check('B disconnected: visible banner', await p.$eval('#downbar', (b) => !b.hidden && b.offsetHeight > 20 && /Lost the connection/.test(b.textContent)));
  await p.evaluate(() => setConn('live'));

  // Contrast (both themes)
  for (const s of ['light', 'dark']) {
    await scheme(p, s); await sleep(150);
    const c = await p.evaluate(() => {
      const cs = (el, pe) => getComputedStyle(el, pe);
      const msg = $('msg'); const panel = msg.closest('.panel');
      const fld = Math.min(__cr(cs(msg).borderTopColor, cs(msg).backgroundColor), __cr(cs(msg).borderTopColor, cs(panel).backgroundColor));
      const ph = __cr(cs(msg, '::placeholder').color, cs(msg).backgroundColor);
      const probe = document.createElement('div'); probe.innerHTML = '<div class="tabs"><span class="n">3</span></div><button class="danger">x</button><div class="toast bad">y</div>';
      document.body.append(probe);
      const n = probe.querySelector('.n'), d = probe.querySelector('.danger'), t = probe.querySelector('.toast');
      const badge = __cr(cs(n).color, cs(n).backgroundColor), danger = __cr(cs(d).color, cs(d).backgroundColor), tb = __cr(cs(t).color, cs(t).backgroundColor);
      probe.remove();
      // person names on panel, chip and stale-card backgrounds, every hue
      const hues = HUES; // the page's own palette
      let worst = 99;
      for (const bgSel of ['.panel', '.chip', '.card.stale']) {
        const host = document.createElement('div'); host.className = bgSel.slice(1).replace('.', ' '); document.querySelector('main').append(host);
        for (const h of hues) { const sp = document.createElement('span'); sp.className = 'pc'; sp.style.setProperty('--h', h); host.append(sp); worst = Math.min(worst, __cr(cs(sp).color, cs(host).backgroundColor)); }
        host.remove();
      }
      return { fld, ph, badge, danger, tb, worst };
    });
    check(`B ${s}: field borders ≥ 3:1`, c.fld >= 3, c.fld.toFixed(2));
    check(`B ${s}: placeholder ≥ 4.5:1`, c.ph >= 4.5, c.ph.toFixed(2));
    check(`B ${s}: @me badge, danger button, error toast ≥ 4.5:1`, c.badge >= 4.5 && c.danger >= 4.5 && c.tb >= 4.5, [c.badge, c.danger, c.tb].map((x) => x.toFixed(2)).join(' / '));
    check(`B ${s}: person names ≥ 4.5:1 on panel/chip/stale card`, c.worst >= 4.5, c.worst.toFixed(2));
  }
  check('B targets: feed tabs and needs buttons ≥ 24px', await p.evaluate(() => [...document.querySelectorAll('.tabs button, #needs button')].every((b) => b.getBoundingClientRect().height >= 24)));

  // Phone
  for (const s of ['dark', 'light']) {
    await scheme(p, s);
    await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await sleep(350);
    const ph = await p.evaluate(() => ({ pos: getComputedStyle(document.querySelector('header')).position, ov: document.documentElement.scrollWidth - innerWidth, sameRow: Math.abs($('help-btn').getBoundingClientRect().top - $('me-btn').getBoundingClientRect().top) < 4 }));
    check(`B phone ${s}: header not sticky, "?" stays with "you", no overflow`, ph.pos !== 'sticky' && ph.sameRow && ph.ov <= 0, JSON.stringify(ph));
    await p.screenshot({ path: `${out}/r-busy-phone-${s}.png` });
    await p.screenshot({ path: `${out}/r-busy-phone-${s}-full.png`, fullPage: true });
  }
  await ctx.close();
} catch (e) { results.push('CRASH ' + e.stack); }
check('no page/console errors or native dialogs', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
