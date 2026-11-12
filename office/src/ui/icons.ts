// 8x8 pixel-art icons rendered as crisp inline SVG (fill = currentColor). No emoji, no images.
const GRIDS = {
  star: ['...XX...', '...XX...', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '.XXXXXX.', '.XX..XX.', 'XX....XX'],
  worker: ['XXXXXXXX', 'X......X', 'X.XX...X', 'X..XX..X', 'X.XX...X', 'XXXXXXXX', '..XXXX..', '.XXXXXX.'],
  orchestrator: ['..XXXX..', 'XXXXXXXX', 'X......X', 'X.XXXX.X', 'X......X', 'X.XXX..X', 'X......X', 'XXXXXXXX'],
  integrator: ['XXXXXXXX', 'XX....XX', 'X...X..X', 'X..XX.XX', 'XX.XX..X', '.X.X..X.', '..XX..X.', '...XXXX.'],
  bot: ['...XX...', '.XXXXXX.', 'XXXXXXXX', 'X.XXXX.X', 'XXXXXXXX', '.XXXXXX.', '..X..X..', '.XX..XX.'],
  play: ['.X......', '.XX.....', '.XXX....', '.XXXX...', '.XXXX...', '.XXX....', '.XX.....', '.X......'],
  pause: ['........', '.XX..XX.', '.XX..XX.', '.XX..XX.', '.XX..XX.', '.XX..XX.', '.XX..XX.', '........'],
  copy: ['..XXXXX.', '..X...X.', 'XXXXX.X.', 'X...XXX.', 'X...X...', 'X...X...', 'X...X...', 'XXXXX...'],
  chev: ['........', '........', 'XX....XX', '.XX..XX.', '..XXXX..', '...XX...', '........', '........'],
  close: ['........', 'XX....XX', '.XX..XX.', '..XXXX..', '..XXXX..', '.XX..XX.', 'XX....XX', '........'],
  undo: ['..XXX...', '.XX..XX.', 'XXX...XX', '.XX...XX', '..X...XX', '......XX', '.X...XX.', '..XXXX..'],
  help: ['..XXXX..', '.XX..XX.', '.XX..XX.', '....XX..', '...XX...', '...XX...', '........', '...XX...'],
  users: ['.XX..XX.', 'XXXX.XXX', 'XXXXXXXX', '.XX..XX.', '........', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX'],
  panels: ['XXXXXXXX', 'X......X', 'X.XX.XXX', 'X.XX.X.X', 'X.XX.X.X', 'X.XX.XXX', 'X......X', 'XXXXXXXX'],
  link: ['.XXX.XXX', 'XX.XXX.X', 'X.XX..XX', 'X.X.XX.X', 'XX.XX.XX', 'X.XXX.XX', 'XX.XXX..', '.XXX.XXX'],
  plus: ['...XX...', '...XX...', '...XX...', 'XXXXXXXX', 'XXXXXXXX', '...XX...', '...XX...', '...XX...'],
  back: ['...X....', '..XX....', '.XXXXXXX', 'XXXXXXXX', '.XXXXXXX', '..XX....', '...X....', '........'],
  gear: ['...XX...', 'XX.XX.XX', 'XXXXXXXX', '.XX..XX.', '.XX..XX.', 'XXXXXXXX', 'XX.XX.XX', '...XX...'],
  pin: ['..XXXX..', '..X..X..', '..X..X..', '.XXXXXX.', '...XX...', '...XX...', '...XX...', '...X....'],
  expand: ['XXX..XXX', 'X......X', 'X......X', '........', '........', 'X......X', 'X......X', 'XXX..XXX'],
  shrink: ['........', '.XX..XX.', '.X....X.', '........', '........', '.X....X.', '.XX..XX.', '........'],
  trash: ['..XXXX..', 'XXXXXXXX', '.X.XX.X.', '.X.XX.X.', '.X.XX.X.', '.X.XX.X.', '.XXXXXX.', '........'],
  zzz: ['XXXX....', '..X.....', '.X..XXX.', 'XXXX..X.', '.....X..', '....X...', '....XXX.', '........'],
  plane: ['.......X', '.....XXX', '...XXX.X', '.XXX..XX', 'XXXXXXXX', '..XXXXX.', '....XXX.', '......X.'],
  chat: ['.XXXXXX.', 'XXXXXXXX', 'X.X.X.XX', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XX....', '.X......'],
  flag: ['XXXXXX..', 'XXXXXXX.', 'XXXXXXXX', 'XXXXXXX.', 'XXXXXX..', 'XX......', 'XX......', 'XX......'],
  command: ['.XX..XX.', 'X..XX..X', 'X..XX..X', '.XXXXXX.', '.XXXXXX.', 'X..XX..X', 'X..XX..X', '.XX..XX.'],
  bolt: ['....XX..', '...XX...', '..XXX...', '.XXXXXX.', '...XXX..', '..XX....', '..X.....', '.X......'],
  check: ['........', '.......X', '......XX', 'X....XX.', 'XX..XX..', '.XXXX...', '..XX....', '........'],
} as const;
export type IconName = keyof typeof GRIDS;

const cache = new Map<string, string>();
function svgFor(name: IconName): string {
  let s = cache.get(name);
  if (s) return s;
  const g = GRIDS[name];
  let rects = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (g[y][x] === 'X') rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  s = `<svg class="px-icon px-${name}" viewBox="0 0 8 8" width="1em" height="1em" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
  cache.set(name, s);
  return s;
}
export function icon(name: IconName): HTMLElement {
  const span = document.createElement('span');
  span.className = 'ico';
  span.innerHTML = svgFor(name);
  return span;
}
export function iconSvg(name: IconName): string { return svgFor(name); }
