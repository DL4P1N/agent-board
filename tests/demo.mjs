#!/usr/bin/env node
// `npm run demo` smoke test: runs the demo in --static mode, checks the seeded board, stops it and checks the temp folder is gone.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT } from './helpers.mjs';

const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'demo.mjs'), '--static'], { stdio: ['pipe', 'pipe', 'inherit'] });
let out = '';
child.stdout.on('data', (d) => { out += d; });
const exited = new Promise((r) => child.once('exit', r));
process.once('exit', () => child.kill());

try {
  for (let i = 0; i < 300 && !/Data folder:/.test(out); i++) await new Promise((r) => setTimeout(r, 100));
  const url = out.match(/Board \(as "you"\):\s+(\S+)/)?.[1];
  const dir = out.match(/Data folder:\s+(.+)/)?.[1]?.trim();
  assert.ok(url && dir, `demo did not print its links:\n${out}`);
  const u = new URL(url);
  assert.equal(u.searchParams.get('name'), 'you');
  assert.ok(/view=office/.test(out) && /present\.html\?token=view-/.test(out), 'banner has the 3D and presenter links');
  assert.ok(fs.existsSync(dir), 'temp data folder exists');
  assert.ok(path.resolve(dir) !== path.join(ROOT, 'data'), 'does not use data/');

  const s = await (await fetch(`${u.origin}/api/state`, { headers: { Authorization: `Bearer ${u.searchParams.get('token')}` } })).json();
  const agents = s.presence.filter((p) => p.kind === 'agent');
  assert.ok(agents.length >= 7 && agents.length <= 9, `7-9 agents, got ${agents.length}`);
  assert.ok(agents.every((a) => a.model), 'every agent has a model');
  assert.deepEqual([...new Set(agents.map((a) => a.client))].sort(), ['Claude Code', 'Codex', 'Copilot (VS Code)', 'Copilot CLI', 'Cursor', 'Gemini CLI']);
  assert.ok(new Set(agents.map((a) => a.person)).size >= 4, '4+ people');
  assert.ok(agents.some((a) => a.limited), 'an agent is out of usage');
  const helpers = agents.flatMap((a) => a.helpers);
  assert.ok(helpers.length >= 3 && helpers.every((h) => h.model) && helpers.some((h) => h.done_at), 'subagents with models, one finished');
  const by = (st) => s.tasks.filter((t) => t.status === st).length;
  for (const st of ['proposed', 'open', 'claimed', 'in_progress', 'blocked', 'review', 'done']) assert.ok(by(st) >= 1, `a ${st} task`);
  assert.ok(s.tasks.length >= 18, `18+ tasks, got ${s.tasks.length}`);
  assert.ok(s.tasks.some((t) => t.stale), 'a stale task');
  assert.ok(s.tasks.some((t) => t.status === 'blocked' && /\w/.test((s.events.find((e) => e.task_id === t.id && /blocked/.test(e.text)) || {}).text || '')), 'blocked with a reason');
  assert.ok(s.questions.filter((q) => !q.answer).length >= 2, 'open questions');
  assert.ok(s.events.some((e) => (e.data?.mentions || []).includes('you')), 'a mention of you');
  assert.ok(s.locks.length >= 1, 'file locks');
  assert.ok(s.settings.goal && s.settings.repo && s.settings.integrator && s.settings.planner, 'goal, repo, roles');
  assert.ok(s.time.deadline > Date.now() + 60 * 60e3 && s.time.freezeAt < s.time.deadline, 'deadline about 2h out with a freeze');
  assert.ok(s.stats?.done >= 3 && Object.keys(s.stats.minutes).length, 'enough finished tasks for the deadline verdict');
  console.log(`PASS demo board: ${agents.length} agents, ${helpers.length} subagents, ${s.tasks.length} tasks, ${s.questions.length} questions`);

  child.stdin.write('stop\n');
  await Promise.race([exited, new Promise((_, rej) => setTimeout(() => rej(new Error('demo did not stop')), 15000))]);
  assert.ok(!fs.existsSync(dir), 'temp data folder deleted');
  await assert.rejects(fetch(`${u.origin}/health`), 'server is gone');
  console.log('PASS demo stops and cleans up\n\n2/2 passed');
  process.exit(0);
} catch (e) {
  console.log(`FAIL ${e.message}`);
  child.kill();
  process.exit(1);
}
