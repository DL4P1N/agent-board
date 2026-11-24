// Agent coordination from real use (review round 4b) and agent text posing as people (round 4, M2): the freeze and
// started tasks, claims after the demo time, fair sharing ("needs work"), mentions, answered questions, reservations,
// force-unlocks, cursors ahead of the board, event roles, name clashes across roles, quoted text in next_action and
// the Stop hook. Most checks run on a Board in a temp folder; the HTTP ones start their own throwaway board.
// Run all suites with: npm test
import { Board } from '../src/board.js';
import { tempDir, finish } from './helpers.mjs';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + String(x).slice(0, 400) : ''}`);
const boards = [];
const fresh = (goal = 'A test app for coordination rules.') => {
  const b = new Board(tempDir());
  boards.push(b);
  if (goal) b.setSettings('dana', { goal }, { human: true });
  return b;
};
// An agent that is online and started (someone typed /board). slots: its plan's task limit.
const join = (b, name, { slots, client } = {}) => {
  b.touch(name, 'agent'); b.markStarted(name);
  if (client) b.setClient(name, client);
  if (slots) b.setPlan(name, 'plan', slots);
};
const refusal = (fn) => { try { fn(); return ''; } catch (e) { return String(e.message || e); } };
const setRaw = (b, key, val) => b.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(val));
const freeze = (b) => b.setSettings('dana', { deadline: String(Date.now() + 30 * 60e3), freeze_minutes: '60' }, { human: true });
const pastDemo = (b) => { setRaw(b, 'deadline', Date.now() - 60e3); setRaw(b, 'freeze_minutes', 60); };
const next = (b, who) => b.nextAction(who).next_action;

// ================= UH1: the freeze strands a started task whose owner is gone =================
{
  const b = fresh();
  join(b, 'ana'); join(b, 'ben', { slots: 2 });
  const started = b.createTask('dana', { title: 'Started before the freeze', size: 'S' }, { human: true });
  const claimedOnly = b.createTask('dana', { title: 'Claimed, never started', size: 'S' }, { human: true });
  const brandNew = b.createTask('dana', { title: 'Brand new feature', size: 'S' }, { human: true });
  b.claimTask('ana', started.id); b.updateTask('ana', started.id, { status: 'in_progress', note: 'half done' });
  b.claimTask('ben', claimedOnly.id);
  freeze(b);
  // ana runs out of usage: her started task may be taken over, and that has to work during the freeze too.
  b.setAgent('dana', 'ana', { limited: true });
  const n1 = next(b, 'ben');
  check('UH1: during the freeze next_action still offers a started task whose owner is out of usage', n1.includes(`#${started.id}`) && /usage limit/.test(n1), n1);
  b.releaseTask('ben', started.id, 'owner out of usage');
  const taken = refusal(() => b.claimTask('ben', started.id));
  check('UH1: …and the started task can be claimed again during the freeze', !taken && b.getTask(started.id).assignee === 'ben', taken);
  // Genuinely new work stays frozen: a brand-new task, and one that was only claimed (never started) and released.
  b.releaseTask('ben', claimedOnly.id);
  join(b, 'cy');
  check('UH1: the freeze still refuses a brand-new task', /Feature freeze/.test(refusal(() => b.claimTask('cy', brandNew.id))));
  check('UH1: …and a task that was claimed but never started', /Feature freeze/.test(refusal(() => b.claimTask('cy', claimedOnly.id))));
}

// ================= UM7: claims after the demo time; the P1 exception is for S/M bug fixes =================
{
  const b = fresh();
  join(b, 'ana', { slots: 3 });
  const bigFix = b.createTask('dana', { title: 'Large priority-1 rewrite', priority: 1, size: 'L' }, { human: true });
  const smallFix = b.createTask('dana', { title: 'Fix the crash', priority: 1, size: 'S' }, { human: true });
  const lateFix = b.createTask('dana', { title: 'Fix the typo', priority: 1, size: 'S' }, { human: true });
  freeze(b);
  const n = next(b, 'ana');
  check('UM7: during the freeze next_action offers the S/M priority-1 fix, not the L one', n.includes(`#${smallFix.id}`) && !n.includes(`#${bigFix.id}`), n);
  check('UM7: a priority-1 task of size L is refused during the freeze', /Feature freeze/.test(refusal(() => b.claimTask('ana', bigFix.id))));
  check('UM7: a priority-1 S task is still claimable during the freeze', !refusal(() => b.claimTask('ana', smallFix.id)));
  pastDemo(b);
  const late = refusal(() => b.claimTask('ana', lateFix.id));
  check('UM7: after the demo time every claim is refused, priority-1 included', /demo time/i.test(late), late);
  const n2 = b.nextAction('ana');
  check('UM7: after the demo time next_action offers nothing to claim', !n2.next_action.includes(`#${lateFix.id}`) && !n2.actionable, JSON.stringify(n2));
}

// ================= UM8: proposals during the freeze =================
{
  const b = fresh();
  join(b, 'maya'); join(b, 'ben');
  b.claimRole('maya', 'planner');
  b.createTask('maya', { title: 'Existing work', size: 'S' });
  freeze(b);
  const p = b.createTask('ben', { title: 'A new feature idea', size: 'M' });
  check('UM8: a proposal during the freeze is told it won\'t be claimable before the demo', p.status === 'proposed' && /freeze/i.test(p.freeze_note || ''), JSON.stringify(p));
  const n = next(b, 'maya');
  check('UM8: the planner\'s proposal step says what to approve during the freeze', n.includes(`#${p.id}`) && /freeze/i.test(n.split('\n').find((l) => l.includes(`#${p.id}`)) || ''), n);
  const ok = b.decideProposal('maya', p.id, { approve: true });
  check('UM8: approving a feature during the freeze says nobody can claim it before the demo', /freeze/i.test(ok.freeze_note || ''), JSON.stringify(ok));
}

for (const b of boards) b.close();
await finish(R);
