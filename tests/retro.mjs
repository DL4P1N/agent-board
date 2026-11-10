// Retro, summary and the freeze webhook: still-blocked time, review credit, plurals, readable
// statuses, sorted lists, and the freeze announced (and sent) as soon as the freeze time changes.
// Run all suites with: npm test
import http from 'node:http';
import { startBoard, finish, agent } from './helpers.mjs';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 6000) => { for (const t0 = Date.now(); Date.now() - t0 < ms;) { const v = await fn(); if (v) return v; await sleep(100); } return null; };

// A fake webhook receiver.
const got = [];
const hook = http.createServer((req, res) => {
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', () => { try { got.push(JSON.parse(body)); } catch {} res.writeHead(200); res.end('ok'); });
});
await new Promise((r) => hook.listen(0, '127.0.0.1', r));

const board = await startBoard();
const human = (p, method = 'GET', body) => fetch(`${board.base}/api${p}`, {
  method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${board.token}`, 'X-Agent': 'dana' }, body: body && JSON.stringify(body),
}).then((r) => r.json());
const text = (p) => fetch(`${board.base}/api${p}`, { headers: { Authorization: `Bearer ${board.token}` } }).then((r) => r.text());

try {
  await human('/settings', 'PUT', { goal: 'A test app.', integrator: '*' });
  const ana = await agent(board, 'ana-claude');
  const bob = await agent(board, 'bob-claude');
  await ana('board_status'); await bob('board_status');
  const T = [];
  for (const title of ['First', 'Second', 'Third', 'Fourth', 'Fifth']) T.push(await human('/tasks', 'POST', { title, size: 'S' }));

  // ana builds #3 then #1 (merged by bob); bob builds #2 (merged by ana, after sending it back once).
  const build = async (who, t) => { await who('claim_task', { id: t.id }); await who('update_task', { id: t.id, status: 'in_progress' }); await who('update_task', { id: t.id, status: 'review', note: 'ready' }); };
  const merge = async (who, t) => { await who('claim_review', { id: t.id }); return who('update_task', { id: t.id, status: 'done' }); };
  await build(ana, T[2]); await build(bob, T[1]);
  await merge(bob, T[2]);
  await ana('claim_review', { id: T[1].id });
  await ana('update_task', { id: T[1].id, status: 'in_progress', note: 'tests fail' });
  await bob('update_task', { id: T[1].id, status: 'review', note: 'fixed' });
  await merge(ana, T[1]);
  await build(ana, T[0]); await merge(bob, T[0]);
  // #4 is blocked and still is; #5 is in progress.
  await ana('claim_task', { id: T[3].id });
  await ana('update_task', { id: T[3].id, status: 'blocked', note: 'need the API key' });
  await bob('claim_task', { id: T[4].id });
  await bob('update_task', { id: T[4].id, status: 'in_progress' });
  await sleep(300);

  // ---- retro ----
  const md = await text('/retro');
  const blockedSec = md.match(/## Blocked time[\s\S]*?(?=\n## )/)?.[0] || '';
  check('NO-2: a task that is still blocked counts as blocked time', !/Nothing was blocked/.test(blockedSec) && /1 task was blocked, \d+m in all \(1 still blocked\)\./.test(blockedSec), blockedSec);
  check('NO-2: the still-blocked task is listed and marked', new RegExp(`- #${T[3].id} Fourth: \\d+m, still blocked`).test(blockedSec), blockedSec);
  const person = md.match(/## Per person[\s\S]*?(?=\n## )/)?.[0] || '';
  check('NO-4: reviews and merges are credited per person (bob)', /\*\*bob\*\*: 1 done, 2 reviewed \(2 merged\)/.test(person), person);
  check('NO-4: a send-back counts as a review (ana)', /\*\*ana\*\*: 2 done, 1 reviewed \(1 merged\)/.test(person), person);
  check('NO-5: proper plurals in the retro (no "(s)")', !/\(s\)/.test(md) && /1 task, 1 time in all\./.test(md), md.match(/## Sent back[\s\S]{0,80}/)?.[0]);
  check('NO-5: "Released or taken over" and stalls use plurals', /Released or taken over: 0 tasks/.test(md) && /being worked on: 0 times/.test(md), md.match(/## Handovers[\s\S]{0,200}/)?.[0]);

  // ---- summary ----
  const sum = await text('/summary');
  const anaSec = sum.split(/\n### /).find((x) => x.startsWith('ana ')) || '';
  check('NO-3: done tasks are listed by id', anaSec.indexOf(`#${T[0].id} First`) >= 0 && anaSec.indexOf(`#${T[0].id} First`) < anaSec.indexOf(`#${T[2].id} Third`), anaSec);
  const nf = sum.match(/## Not finished[\s\S]*/)?.[0] || '';
  check('NO-3: "Not finished" uses readable statuses', new RegExp(`#${T[3].id} Fourth — blocked`).test(nf) && new RegExp(`#${T[4].id} Fifth — in progress`).test(nf) && !/in_progress/.test(nf), nf);

  // ---- NO-1: freeze announced when the freeze time changes, not only on the 20 s tick ----
  await human('/notify', 'PUT', { url: `http://localhost:${hook.address().port}/hook?kind=generic` });
  const n0 = got.length;
  await human('/settings', 'PUT', { deadline: Date.now() + 15e3, freeze_minutes: 60 });
  const ev = await until(async () => (await human('/state')).events?.find((e) => /FEATURE FREEZE/.test(e.text)), 4000);
  check('NO-1: the freeze is announced right after the deadline is changed (well under the 20 s tick)', !!ev);
  const sent = await until(() => got.slice(n0).find((g) => /FEATURE FREEZE/.test(g.text || '')), 4000);
  check('NO-1: the freeze webhook is sent at once', !!sent && sent.kind === 'freeze', JSON.stringify(got.slice(n0)));
  // The same freeze time saved again is not announced twice.
  await human('/settings', 'PUT', { freeze_minutes: 60, goal: 'A test app, v2.' });
  await sleep(800);
  const freezes = (await human('/state')).events.filter((e) => /FEATURE FREEZE/.test(e.text)).length;
  check('NO-1: saving other settings does not announce the freeze again', freezes === 1, String(freezes));
} catch (e) {
  R.push(`CRASH ${e.stack}`);
}
hook.close();
await finish(R, { board });
