#!/usr/bin/env node
// Runs every test: the agent-side smoke test, then each browser suite in tests/ui/.
// Each suite starts its own throwaway board on a free port, so nothing else needs to be running.
//   npm test                 all suites
//   npm test -- journey      only suites whose name contains "journey"
//   npm test -- --no-ui      only the suites in tests/ (no browser needed); can be combined with a name
// A suite that runs longer than SUITE_TIMEOUT_MS (default 8 minutes) is stopped, with everything it started, and fails.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, killTree } from './helpers.mjs';

const args = process.argv.slice(2);
const noUi = args.includes('--no-ui');
const filter = args.find((a) => !a.startsWith('--')) || '';
const TIMEOUT = Number(process.env.SUITE_TIMEOUT_MS) || 8 * 60e3;
const suites = [
  ...fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.mjs') && !['helpers.mjs', 'run.mjs'].includes(f)).sort().map((f) => path.join(ROOT, 'tests', f)),
  ...(noUi ? [] : fs.readdirSync(path.join(ROOT, 'tests', 'ui')).filter((f) => f.endsWith('.mjs')).sort().map((f) => path.join(ROOT, 'tests', 'ui', f))),
].filter((f) => path.basename(f).includes(filter));

// Runs one suite; on a timeout, ends its whole process tree (its boards and browsers too). On POSIX the suite gets its
// own process group (detached), so killing the group reaches everything it started; Ctrl+C on the runner, which no
// longer reaches that group by itself, ends it the same way.
const posix = process.platform !== 'win32';
let current = null;
for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { killTree(current, { group: posix }); process.exit(130); });
const run = (file, env) => new Promise((resolve) => {
  const child = current = spawn(process.execPath, [file], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], detached: posix });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; killTree(child, { group: posix }); }, TIMEOUT);
  // Output is read until the pipes close, but not for long after the suite exits (something it started could hold them).
  child.once('exit', (status) => {
    clearTimeout(timer);
    if (current === child) current = null;
    const done = () => resolve({ status, out, timedOut });
    const t = setTimeout(done, 2000);
    child.once('close', () => { clearTimeout(t); done(); });
  });
});

const summary = [];
for (const file of suites) {
  const name = path.relative(ROOT, file).replace(/\\/g, '/');
  process.stdout.write(`\n▶ ${name}\n`);
  // Each suite gets its own temp folder: anything a suite leaves there (a data folder, a browser profile, a hook's
  // cursor file) fails it, and the folder is deleted afterwards, so even a crashed suite doesn't litter the system temp folder.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-board-run-'));
  const t0 = Date.now();
  const r = await run(file, { ...process.env, TMPDIR: tmp, TEMP: tmp, TMP: tmp });
  const left = r.timedOut ? [] : fs.readdirSync(tmp).filter((n) => /^(agent-board|claude-board|board-|cb-|cf-args|rehearse|puppeteer_dev_)/.test(n));
  try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch {}
  let out = `${r.out}${r.timedOut ? `\nFAIL timed out after ${Math.round(TIMEOUT / 1000)}s (stopped)\n` : ''}${left.length ? `\nFAIL left temp folders behind: ${left.join(', ')}\n` : ''}`;
  const failures = out.split('\n').filter((l) => /^(FAIL|CRASH)\b/.test(l));
  // Every suite ends with "N/N passed" (helpers.mjs finish()): a suite that exits 0 without it, or with fewer passed
  // than run, ended early or lost checks somewhere, and fails.
  const counts = out.match(/(\d+)\/(\d+) passed/g)?.pop();
  const [pass, total] = (counts?.match(/\d+/g) || []).map(Number);
  const ok = r.status === 0 && !failures.length && total > 0 && pass === total;
  if (r.status === 0 && !failures.length && !ok) out += counts ? `\nFAIL only ${counts}\n` : '\nFAIL no "N/N passed" line: the suite ended without reporting its checks\n';
  if (!ok) process.stdout.write(out.split('\n').filter((l) => !/^PASS\b/.test(l)).join('\n') + '\n');
  summary.push(`${ok ? '✓' : '✗'} ${name}${counts ? `  (${counts})` : ''}  ${Math.round((Date.now() - t0) / 1000)}s`);
  process.stdout.write(`${summary.at(-1)}\n`);
}
console.log(`\n${summary.join('\n')}`);
const failed = summary.filter((s) => s.startsWith('✗')).length;
console.log(failed ? `\n${failed} suite(s) failed. Screenshots: tests/ui/shots/` : '\nAll suites passed.');
process.exitCode = failed ? 1 : 0;
