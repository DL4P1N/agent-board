#!/usr/bin/env node
// Runs every test: the agent-side smoke test, then each browser suite in tests/ui/.
// Each suite starts its own throwaway board on a free port, so nothing else needs to be running.
//   npm test                 all suites
//   npm test -- journey      only suites whose name contains "journey"
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './helpers.mjs';

const filter = process.argv[2] || '';
const suites = [
  path.join(ROOT, 'tests', 'smoke.mjs'),
  ...fs.readdirSync(path.join(ROOT, 'tests', 'ui')).filter((f) => f.endsWith('.mjs')).sort().map((f) => path.join(ROOT, 'tests', 'ui', f)),
].filter((f) => path.basename(f).includes(filter));

const summary = [];
for (const file of suites) {
  const name = path.relative(ROOT, file).replace(/\\/g, '/');
  process.stdout.write(`\n▶ ${name}\n`);
  const r = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const failures = out.split('\n').filter((l) => /^(FAIL|CRASH)\b/.test(l));
  const counts = out.match(/(\d+)\/(\d+) passed/g)?.pop();
  const ok = r.status === 0 && !failures.length;
  if (!ok) process.stdout.write(out.split('\n').filter((l) => !/^PASS\b/.test(l)).join('\n') + '\n');
  summary.push(`${ok ? '✓' : '✗'} ${name}${counts ? `  (${counts})` : ''}`);
  process.stdout.write(`${summary.at(-1)}\n`);
}
console.log(`\n${summary.join('\n')}`);
const failed = summary.filter((s) => s.startsWith('✗')).length;
console.log(failed ? `\n${failed} suite(s) failed. Screenshots: tests/ui/shots/` : '\nAll suites passed.');
process.exitCode = failed ? 1 : 0;
