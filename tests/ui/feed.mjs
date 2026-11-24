// The activity feed and composer: board actions as status lines, "Load earlier activity", long posts
// clamped, a feed that's only as tall as its content, mention ordering, "someone saved over you",
// the saved webhook shown as text, and the invite / QR code. Acts as human "dana".
import { startBoard, launchBrowser, shotsDir, finish, agent, rest as restOf, openLink } from '../helpers.mjs';

// Its webhooks go to a server on 127.0.0.1 (refused unless the host allows localhost).
const board = await startBoard({ env: { BOARD_WEBHOOK_LOCALHOST: '1' } });
const out = shotsDir('feed');
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rest = (who, p, method, body) => restOf(board, who, p, method, body);
const until = async (fn, ms = 5000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(100); } return null; };

const browser = await launchBrowser({ headless: true, defaultViewport: { width: 1440, height: 1000 } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));

try {
  const bc = await agent(board, 'bob-claude'); await bc('board_status');
  const bx = await agent(board, 'bob-codex', 'codex-mcp-client'); await bx('board_status');
  await rest('alice/db-worker', '/messages', 'POST', { text: 'helper says hi' });

  await openLink(page, `${board.base}/?token=${board.token}&name=dana`);
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForFunction(() => document.getElementById('conn').classList.contains('live'), { timeout: 5000 });

  // WB-23: few events, so the feed is short (no fixed tall box); the message box gets the full width.
  const fh = await page.$eval('#feed', (f) => f.getBoundingClientRect().height);
  check('WB-23 a near-empty feed is short', fh < 200, fh + 'px');
  const w = await page.evaluate(() => ({ msg: $('msg').getBoundingClientRect().width, comp: $('composer').getBoundingClientRect().width }));
  check('WB-23 the message box spans the composer', w.msg >= w.comp - 4, JSON.stringify(w));

  // WB-24: "@b": the person first, prefix matches before word matches, no "alice/db-worker".
  await page.click('#msg'); await page.type('#msg', '@b');
  await page.waitForSelector('#msg-ac:not([hidden])');
  const names = await page.$$eval('#msg-ac li .pc', (l) => l.map((x) => x.textContent));
  check('WB-24 the person comes first', names[0] === '@bob', names.join(' '));
  check('WB-24 agents follow, substring-only names are left out', names.includes('@bob-claude') && names.includes('@bob-codex') && !names.includes('@alice/db-worker'), names.join(' '));
  await page.keyboard.press('Enter'); await page.keyboard.type(' hi');
  check('WB-24 a space after a picked name isn\'t doubled', (await page.$eval('#msg', (m) => m.value)) === '@bob hi', JSON.stringify(await page.$eval('#msg', (m) => m.value)));
  await page.type('#msg', ' @db');
  await page.waitForSelector('#msg-ac:not([hidden])');
  const dbn = await page.$$eval('#msg-ac li .pc', (l) => l.map((x) => x.textContent));
  check('WB-24 a word inside a name still matches (@db → alice/db-worker)', dbn.includes('@alice/db-worker'), dbn.join(' '));
  await page.keyboard.press('Escape');
  await page.$eval('#msg', (m) => { m.value = ''; });

  // WB-20: a human marking an agent out of usage / changing its limit is a status line, not chat.
  await rest('dana', '/agents/bob-codex', 'PATCH', { limited: true, note: 'weekly limit' });
  await rest('dana', '/agents/bob-claude', 'PATCH', { slots: 3 });
  const st = await rest('dana', '/state');
  const lim = st.events.find((e) => /bob-codex hit its usage limit/.test(e.text));
  check('WB-20 agents still get the @all message', /^@all bob-codex/.test(lim?.text || '') && lim.data?.mentions?.includes('all') && lim.data?.notice === 'limit', JSON.stringify(lim));
  await page.waitForFunction(() => [...document.querySelectorAll('#feed .ev')].some((e) => /may now hold/.test(e.innerText)), { timeout: 5000 });
  const act = await page.$$eval('#feed .ev', (l) => l.filter((e) => /usage limit|may now hold/.test(e.innerText)).map((e) => ({ cls: e.className, t: e.innerText })));
  check('WB-20 shown as status lines', act.length === 2 && act.every((a) => /\bsys\b/.test(a.cls) && /\bact\b/.test(a.cls)), JSON.stringify(act));
  check('WB-20 in people words (no @all, no tool names, no "task(s)")', act.every((a) => !/@all|release_task|task\(s\)|set on the web board/.test(a.t)), JSON.stringify(act));
  await page.click('[data-tab="chat"]'); await sleep(200);
  check('WB-20 not in the Chat tab', !(await page.$$eval('#feed .ev', (l) => l.some((e) => /usage limit|may now hold/.test(e.innerText)))));
  await page.click('[data-tab="all"]'); await sleep(200);

  // WB-22: a long agent post is clamped with "Show more".
  const long = Array.from({ length: 14 }, (_, i) => `line ${i + 1} of a long report`).join('\n');
  await rest('bob-claude', '/messages', 'POST', { text: long });
  await page.waitForSelector('#feed .ev.long');
  const clamp = await page.$eval('#feed .ev.long .eb', (b) => ({ c: b.clientHeight, s: b.scrollHeight }));
  check('WB-22 long post clamped', clamp.c < clamp.s && clamp.c < 100, JSON.stringify(clamp));
  await page.click('#feed .ev.long [data-more]');
  const opened = await page.$eval('#feed .ev.long', (e) => ({ open: e.classList.contains('open'), exp: e.querySelector('[data-more]').getAttribute('aria-expanded'), txt: e.querySelector('[data-more]').textContent, h: e.querySelector('.eb').clientHeight, s: e.querySelector('.eb').scrollHeight }));
  check('WB-22 Show more expands it', opened.open && opened.exp === 'true' && opened.txt === 'Show less' && opened.h >= opened.s - 1, JSON.stringify(opened));
  await rest('bob-claude', '/messages', 'POST', { text: 'short one' });
  await page.waitForFunction(() => [...document.querySelectorAll('#feed .ev')].some((e) => e.innerText.includes('short one')), { timeout: 5000 });
  check('WB-22 stays open when new events arrive', await page.$eval('#feed .ev.long', (e) => e.classList.contains('open')));
  await page.click('#feed .ev.long [data-more]');
  check('WB-22 Show less clamps it again', !(await page.$eval('#feed .ev.long', (e) => e.classList.contains('open'))));
  await (await page.$('#o-act')).screenshot({ path: `${out}/feed-actions-long.png` });

  // WB-21: more than 200 events: "Load earlier activity" pages back.
  for (let i = 0; i < 230; i++) await rest('bob-claude', '/messages', 'POST', { text: `filler ${i}` });
  const cur = (await rest('dana', '/state')).cursor;
  const pg = await rest('dana', `/events?before=${cur}`);
  check('WB-21 /events?before= gives the 200 before it, oldest first', pg.events.length === 200 && pg.events.every((e, i, a) => e.id < cur && (!i || a[i - 1].id < e.id)) && pg.events.at(-1).id === cur - 1, `${pg.events.length}`);
  await page.waitForFunction(() => [...document.querySelectorAll('#feed .ev')].some((e) => e.innerText.includes('filler 229')), { timeout: 10000 });
  const firstBefore = await page.evaluate(() => state.events[0].id);
  check('WB-21 the feed starts at the last 200', firstBefore > 1 && !!(await page.$('#feed [data-older]')));
  await page.$eval('#feed', (f) => { f.scrollTop = 0; });
  await page.click('#feed [data-older]');
  await until(() => page.evaluate(() => state.events[0].id === 1));
  check('WB-21 Load earlier activity brings back the start', await page.evaluate(() => state.events[0].id === 1 && [...document.querySelectorAll('#feed .ev')].some((e) => e.innerText.includes('helper says hi'))));
  check('WB-21 no button once everything is loaded', !(await page.$('#feed [data-older]')));
  check('WB-21 no "New activity" pill for older lines', await page.$eval('#jump', (j) => j.hidden));
  await rest('bob-claude', '/messages', 'POST', { text: 'after paging' });
  await page.waitForFunction(() => [...document.querySelectorAll('#feed .ev')].some((e) => e.innerText.includes('after paging')), { timeout: 5000 });
  check('WB-21 live updates keep the earlier page', await page.evaluate(() => state.events[0].id === 1));
  // More than 200 events between two reloads: the events in between are fetched, not skipped.
  await page.evaluate(() => { window.__load = load; load = async () => {}; });
  for (let i = 0; i < 260; i++) await rest('bob-claude', '/messages', 'POST', { text: `burst ${i}` });
  await page.evaluate(() => { load = window.__load; return load(); });
  const gap = await page.evaluate(() => {
    const ids = state.events.map((e) => e.id); const texts = state.events.map((e) => e.text);
    return { first: ids[0], sorted: ids.every((x, i) => !i || ids[i - 1] < x), dup: new Set(ids).size !== ids.length, all: Array.from({ length: 260 }, (_, i) => `burst ${i}`).every((t) => texts.includes(t)) };
  });
  check('WB-21 a reload after 260 new events keeps every event (gap fetched, no duplicates)', gap.first === 1 && gap.sorted && !gap.dup && gap.all, JSON.stringify(gap));
  // Load earlier while a load of the board is on its way (a fresh tab: the feed is the last 200, no earlier page yet):
  // the load must not replace the feed under the page Load earlier is fetching, or the lines between the two go missing.
  {
    const p2 = await browser.newPage();
    p2.on('pageerror', (e) => errors.push('pageerror (2nd tab): ' + e.message));
    await p2.goto(`${board.base}/?token=${board.token}&name=dana`);
    await p2.waitForFunction(() => document.getElementById('conn').classList.contains('live') && state.events.length === 200 && !!document.querySelector('#feed [data-older]'), { timeout: 10000 });
    const had = await p2.evaluate(() => state.events.map((e) => e.id));
    // Task events (not chat lines, which the page adds itself) pile up while loading is held back...
    await p2.evaluate(() => { window.__load = load; load = async () => true; });
    for (let i = 0; i < 50; i++) await rest('erin', '/tasks', 'POST', { title: `race task ${i}` });
    // ...then Load earlier's page comes back slowly, and a load (the last 200, now 50 further on) lands first.
    await p2.evaluate(() => {
      const f = window.fetch;
      window.fetch = async (u, o) => { const r = await f(u, o); if (/\/api\/events\?before=/.test(String(u))) await new Promise((ok) => setTimeout(ok, 800)); return r; };
      load = window.__load;
    });
    await p2.$eval('#feed', (f) => { f.scrollTop = 0; });
    await p2.click('#feed [data-older]');
    await p2.evaluate(() => load());
    await p2.waitForFunction(() => !document.querySelector('#feed [data-older][disabled]'), { timeout: 10000 });
    const after = await p2.evaluate(() => ({ ids: state.events.map((e) => e.id), titles: state.tasks.filter((t) => /^race task/.test(t.title)).length }));
    const kept = new Set(after.ids);
    const lost = had.filter((id) => !kept.has(id));
    check('WB-21 Load earlier during a load: no line goes missing, the earlier page is in front, the load applied', !lost.length && after.ids[0] < had[0] && after.ids.every((x, i, a) => !i || a[i - 1] < x) && after.titles === 50, JSON.stringify({ lost: lost.length, first: after.ids[0], had0: had[0], titles: after.titles }));
    await p2.close();
  }

  // WB-25: I save a task, then someone else saves over it: I'm told.
  const t = await rest('erin', '/tasks', 'POST', { title: 'Write the README' });
  await until(() => page.evaluate((id) => !!taskById(id), t.id));
  await page.evaluate((id) => { openTask(id); $('td-name').value = 'Write the README (dana)'; $('task-form').requestSubmit(); }, t.id);
  await page.waitForFunction((id) => document.getElementById('toasts').innerText.includes(`Saved #${id}`), { timeout: 5000 }, t.id);
  await rest('erin', `/tasks/${t.id}`, 'PATCH', { title: 'Write the README (erin)' });
  const ow = await until(() => page.$eval('#toasts', (x) => x.innerText).then((s) => (/was changed by erin/.test(s) ? s : null)));
  check('WB-25 told when someone saves over my edit', !!ow && ow.includes(`#${t.id}`) && /title/.test(ow), ow || await page.$eval('#toasts', (x) => x.innerText));

  // NO-6: a saved webhook shows as text with Change and Remove.
  await rest('dana', '/notify', 'PUT', { url: 'http://localhost:9/hook-secret' });
  await page.evaluate(() => { ui.steps.invite = true; ui.nf.open = true; ui.nf.loaded = false; render(); });
  await page.waitForSelector('#nf-saved');
  // Clicked in the middle of the screen: near the top, the sticky header would be over it.
  const clickIn = async (sel) => { await page.$eval(sel, (b) => b.scrollIntoView({ block: 'center' })); await page.click(sel); };
  const saved = await page.evaluate(() => ({ t: $('nf-saved').innerText, input: !!$('nf-url'), change: !!document.querySelector('[data-act="nf-change"]'), remove: document.querySelector('[data-act="nf-off"]')?.textContent }));
  check('NO-6 saved URL shown as text, no input', /localhost/.test(saved.t) && !saved.input && saved.change && saved.remove === 'Remove', JSON.stringify(saved));
  await clickIn('[data-act="nf-change"]');
  check('NO-6 Change shows an empty field, focused', await page.evaluate(() => !!$('nf-url') && document.activeElement === $('nf-url') && !$('nf-url').value && !$('nf-saved')));
  await clickIn('[data-act="nf-keep"]');
  check('NO-6 Keep goes back to the saved text', !!(await page.$('#nf-saved')));
  await clickIn('[data-fk="nf-save"]');
  await page.waitForFunction(() => /Saved\./.test(document.getElementById('toasts').innerText), { timeout: 5000 });
  check('NO-6 Save without a field keeps the URL (events only)', !!(await rest('dana', '/notify')).url);
  await clickIn('[data-act="nf-off"]');
  await page.waitForSelector('#nf-url');
  check('NO-6 Remove clears it', !(await rest('dana', '/notify')).url && !(await page.$('#nf-saved')));

  // ONB-7: one QR code (the board link); the invite names every tool.
  await page.evaluate(() => { ui.qr = true; render(); });
  const qrs = await page.$$eval('#qr-codes figure', (f) => f.map((x) => x.innerText));
  check('ONB-7 one QR code, for the board link', qrs.length <= 1 && !/paste/i.test(qrs.join(' ')), JSON.stringify(qrs));
  const inv = await page.evaluate(() => inviteText());
  check('ONB-7 invite has Gemini CLI and Cursor', /Gemini CLI: \/board/.test(inv) && /Cursor: \/board/.test(inv), inv);
} catch (e) { results.push('CRASH ' + e.stack); }
check('no page/console errors', errors.length === 0, errors.join(' | '));
await finish(results, { browser, board });
