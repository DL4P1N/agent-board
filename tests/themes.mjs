// The theme tokens: every page carries the blocks scripts/themes.mjs generates (no hand edits left behind), each of the
// fifteen themes has its room in the 3D office, and every base text colour is at least 4.5:1 on its surfaces.
// Run all suites with: npm test
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.mjs';
import { build, contrastProblems, IDS, BASE, TOKENS } from '../scripts/themes.mjs';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' ? ' — ' + x : ''}`);

const stale = [...build()].filter(([p, txt]) => !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== txt).map(([p]) => path.relative(ROOT, p));
check('every page carries the current generated theme blocks (run node scripts/themes.mjs)', !stale.length, stale.join(', '));
check('fifteen themes in the agreed order', IDS.join() === 'dark,light,dusk,day,night,terminal,contrast,paper,synthwave,ocean,sticky,coral,candy,sunset,forest');
check('display names', IDS.map((t) => BASE[t].name).join() === 'Dark,Light,Dusk,Day,Night,Terminal,High Contrast,Paper,Synthwave,Ocean,Sticky Note,Coral,Candy,Sunset,Forest');
check('light themes: Light, Day, Paper, Sticky Note, Coral, Candy', IDS.filter((t) => BASE[t].light).join() === 'light,day,paper,sticky,coral,candy');
check('Dusk, Day, Night and Terminal keep their board colours', TOKENS.dusk.bg === '#1b1530' && TOKENS.day.bg === '#efe4cf' && TOKENS.night.bg === '#080c1a' && TOKENS.terminal.bg === '#020a04' && TOKENS.day.accent === '#9a4a14');
const low = contrastProblems();
check('every base text colour >= 4.5:1 on the surfaces it sits on, field borders >= 3:1, in every theme', !low.length, low.join('; '));
const pal = fs.readFileSync(path.join(ROOT, 'office/src/scene/palettes.ts'), 'utf8');
const rooms = IDS.filter((t) => !new RegExp(`^  ${t}: \\{`, 'm').test(pal));
check('each theme has its own room palette in the 3D office', !rooms.length, rooms.join());

console.log(R.join('\n'));
const failed = R.filter((r) => !r.startsWith('PASS')).length;
console.log(`\n${R.length - failed}/${R.length} passed`);
process.exitCode = failed ? 1 : 0;
