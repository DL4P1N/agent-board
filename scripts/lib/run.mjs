// Starting a program with its arguments as a list: no shell, so nothing in a path, URL or token is ever interpreted.
// On Windows, tools installed with npm are .cmd shims, which only run through cmd.exe. Those start through the
// Node script the shim wraps instead (with this Node). A shim that wraps something else runs through cmd.exe with
// each argument quoted for it (paths can't hold a double quote there; one in a URL is doubled). cmd.exe still
// replaces %NAME% inside quotes and nothing escapes that, so an argument that would pick up a variable is refused.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const found = new Map();
// The matches on PATH, in the order the shell would pick them ([] when missing). Looked up once per program.
export function whereIs(bin) {
  if (!found.has(bin)) {
    const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8', windowsHide: true });
    found.set(bin, r.status === 0 ? (r.stdout || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : []);
  }
  return found.get(bin);
}
export const onPath = (bin) => whereIs(bin).length > 0;

// Variables cmd.exe makes up on the spot (not in the environment), expanded like any other.
const CMD_DYNAMIC = new Set(['CD', 'DATE', 'TIME', 'RANDOM', 'ERRORLEVEL', 'CMDEXTVERSION', 'CMDCMDLINE', 'HIGHESTNUMANODENUMBER', '__CD__', '__APPDIR__']);

// [file, args, options] to hand to spawn or spawnSync for `bin argv…`, or null when bin isn't on PATH.
export function command(bin, argv) {
  const hits = whereIs(bin);
  if (!hits.length) return null;
  if (process.platform !== 'win32') return [bin, argv, {}];
  const hit = hits.find((p) => /\.(exe|com|cmd|bat)$/i.test(p)) || '';
  if (/\.(exe|com)$/i.test(hit)) return [hit, argv, {}];
  if (hit) {
    let shim = '';
    try { shim = fs.readFileSync(hit, 'utf8'); } catch {}
    const m = shim.match(/"%~?dp0%?\\([^"]+\.c?js)"/);
    const js = m && path.join(path.dirname(hit), m[1]);
    if (js && fs.existsSync(js)) return [process.execPath, [js, ...argv], {}];
  }
  for (const a of argv.map(String)) {
    // Every % starts a candidate (cmd re-scans after an unknown name); a URL's %C3%A9 only counts if C3 is a variable
    // (set, or one of cmd's dynamic ones).
    const name = [...a.matchAll(/(?=%([^%"]+)%)/g)].map((m) => m[1].split(':')[0]).find((n) => process.env[n] !== undefined || CMD_DYNAMIC.has(n.toUpperCase()));
    if (name) throw new Error(`${bin} runs through cmd.exe here, which would replace %${name}% in an argument with that variable's value. Remove the %…% from the address or path, or install ${bin} so it runs without cmd.exe.`);
  }
  return [[bin, ...argv].map((a) => `"${String(a).replace(/"/g, '""')}"`).join(' '), [], { shell: true }];
}

// spawnSync through command(); a program that isn't on PATH fails with ENOENT (r.error), as spawnSync would.
export function runSync(bin, argv, opts = {}) {
  const [file, args, extra] = command(bin, argv) || [bin, argv, {}];
  return spawnSync(file, args, { encoding: 'utf8', windowsHide: true, ...opts, ...extra });
}
