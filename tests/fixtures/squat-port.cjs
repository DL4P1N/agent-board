// Loaded with `node --require` into scripts/rehearse.mjs (tests/rehearsal.mjs): the first time it starts the board
// server, another program takes that port first and answers /health as if it were a board (with a pid that isn't the
// child's). SQUAT_FILE gets the port it took. A script that trusts any /health answer then talks to the wrong program.
const cp = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const real = cp.spawn;
let squatted = false;
cp.spawn = function (file, args, opts) {
  if (!squatted && Array.isArray(args) && /server\.js$/.test(String(args[0] || '')) && opts?.env?.PORT) {
    squatted = true;
    const rogue = http.createServer((_q, res) => { res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true,"app":"claude-board","pid":1}'); });
    rogue.listen(Number(opts.env.PORT), '127.0.0.1');
    rogue.unref();
    fs.writeFileSync(process.env.SQUAT_FILE, String(opts.env.PORT));
  }
  return real.apply(this, arguments);
};
cp.syncBuiltinESMExports?.();
