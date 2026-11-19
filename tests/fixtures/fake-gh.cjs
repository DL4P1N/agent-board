// Stand-in for the GitHub CLI (`gh`) in tests: answers the few commands the board server runs
// from a JSON file the test rewrites between steps (path in FAKE_GH_STATE):
//   { "auth": true, "prs": { "<url>": <gh pr view --json …> }, "branch": "main", "runs": [<gh run list --json …>] }
// Unknown commands exit 1 (the server treats that as "no answer").
//
// Two ways in:
//   - run directly: `node fake-gh.cjs <args>` (the `gh` shell shim on macOS/Linux)
//   - preloaded into a copy of node named gh.exe (Windows: the server runs `gh` without a shell, so
//     it must be a real .exe): NODE_OPTIONS=--require <this file>. It only acts when the process is
//     that gh.exe; any other node process loading it (the server itself) is left alone.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function answer(args) {
  let st = {};
  try { st = JSON.parse(fs.readFileSync(process.env.FAKE_GH_STATE, 'utf8')); } catch {}
  if (process.env.FAKE_GH_LOG) try { fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(args) + '\n'); } catch {}
  const [a, b] = args;
  if (a === 'auth' && b === 'status') return { code: st.auth === false ? 1 : 0 };
  // delay_ms: answer PR questions slowly (a slow network), to test what happens meanwhile.
  if (a === 'pr' && b === 'view' && st.delay_ms) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, st.delay_ms);
  if (a === 'pr' && b === 'view') { const pr = (st.prs || {})[args[2]]; return pr ? { code: 0, out: pr } : { code: 1 }; }
  if (a === 'repo' && b === 'view') return { code: 0, out: { defaultBranchRef: { name: st.branch || 'main' } } };
  if (a === 'run' && b === 'list') return Array.isArray(st.runs) ? { code: 0, out: st.runs } : { code: 1 };
  return { code: 1 };
}

function main(args) {
  const r = answer(args);
  // Synchronous writes: the process exits right after, and pipes on Windows are async.
  if (r.out !== undefined) fs.writeSync(1, JSON.stringify(r.out));
  process.exit(r.code);
}

if (require.main === module) {
  main(process.argv.slice(2));
} else if (/^gh(\.exe)?$/i.test(path.basename(process.execPath))) {
  // node.exe copied as gh.exe: node took the first argument as a script path (made absolute),
  // so take its last path part back; the other arguments are as given.
  const argv = process.argv.slice(1);
  if (argv.length) argv[0] = path.basename(argv[0]);
  main(argv);
}
