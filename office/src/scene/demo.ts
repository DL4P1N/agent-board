/** Standalone harness: mounts OfficeScene and drives it with the real Simulation (default) or a tiny fake (?fake=1).
 *  Query params: fake=1 workers=N speed=X palette=dusk|day|night|terminal pixel=N dither=X quality=low|high labels=0 bubbles=0 paths=1
 *  skills=N flights=0 hack=off|build|polish|demo|submitted|plan (fake only)
 *  orbit=1 az=<deg> el=<deg> zoom=X select=<agentId> focus=0..1 shot=1 (hide ui) */
import type { Simulation } from '../sim';
import { OfficeScene } from './OfficeScene';
import { FakeSim } from './fakeState';
import { DEFAULT_VISUAL, type SimState, type VisualSettings } from '../types';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number): number => (q.has(k) ? Number(q.get(k)) : d);
const visual: VisualSettings = {
  ...DEFAULT_VISUAL,
  palette: (q.get('palette') as VisualSettings['palette']) ?? 'dusk',
  pixelSize: num('pixel', DEFAULT_VISUAL.pixelSize),
  dither: num('dither', DEFAULT_VISUAL.dither),
  quality: (q.get('quality') as VisualSettings['quality']) ?? 'high',
  showLabels: q.get('labels') !== '0',
  showBubbles: q.get('bubbles') !== '0',
  showPaths: q.get('paths') === '1',
  autoOrbit: q.get('orbit') === '1',
  focus: num('focus', 0),
};

const host = document.getElementById('scene')!;
const scene = new OfficeScene(host, visual);
let selected: string | null = q.get('select');
scene.selectAgent(selected);
scene.onPick((id) => { selected = id; scene.selectAgent(id); });
const deg = Math.PI / 180;
if (q.has('az') || q.has('el') || q.has('zoom')) {
  scene.setCamera({
    ...(q.has('az') ? { azimuth: num('az', 40) * deg } : {}),
    ...(q.has('el') ? { elevation: num('el', 36) * deg } : {}),
    ...(q.has('zoom') ? { zoom: num('zoom', 1) } : {}),
    ...(q.has('tx') ? { target: { x: num('tx', 0), y: 1, z: num('tz', 0) } } : {}),
  });
}

const fake = q.get('fake') === '1';
const speed = num('speed', fake ? 1 : 1);
let getState: () => SimState;
let step: (dt: number) => void;
if (fake) {
  const f = new FakeSim(num('workers', 8), speed, { skills: num('skills', 18), flights: q.get('flights') !== '0', hack: (q.get('hack') as 'off' | 'build' | 'polish' | 'demo' | 'submitted' | 'plan') ?? 'build' });
  getState = () => f.state;
  step = (dt) => f.step(dt);
} else {
  // dynamic import so the fake harness keeps working while the sim is mid-edit
  const { Simulation: Sim } = await import('../sim');
  const sim = new Sim({ workerCount: num('workers', 8), simSpeed: speed });
  getState = () => sim.state;
  step = (dt) => sim.step(dt);
  (window as unknown as { sim: Simulation }).sim = sim;
}
// optional fast-forward so the office is already lively for screenshots
const warm = num('warm', 0);
for (let i = 0; i < warm * 20; i++) step(0.05);

const bar = document.getElementById('bar')!;
if (q.get('shot') !== '1') {
  for (const p of ['dusk', 'day', 'night', 'terminal'] as const) {
    const b = document.createElement('button'); b.textContent = p;
    b.onclick = () => { visual.palette = p; scene.setVisual(visual); };
    bar.appendChild(b);
  }
  const mk = (label: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; bar.appendChild(b); };
  mk('px+', () => { visual.pixelSize = Math.min(8, visual.pixelSize + 1); scene.setVisual(visual); });
  mk('px-', () => { visual.pixelSize = Math.max(1, visual.pixelSize - 1); scene.setVisual(visual); });
  mk('orbit', () => { visual.autoOrbit = !visual.autoOrbit; scene.setVisual(visual); });
  mk('labels', () => { visual.showLabels = !visual.showLabels; scene.setVisual(visual); });
  mk('paths', () => { visual.showPaths = !visual.showPaths; scene.setVisual(visual); });
  mk('quality', () => { visual.quality = visual.quality === 'high' ? 'low' : 'high'; scene.setVisual(visual); });
  mk('focus', () => { visual.focus = visual.focus > 0.5 ? 0 : 1; scene.setVisual(visual); });
}
const hud = document.getElementById('hud')!;
if (q.get('shot') === '1') hud.style.display = 'none';

let paused = q.get('pause') === '1';
(window as unknown as Record<string, unknown>).setPaused = (b: boolean): void => { paused = b; };
let last = performance.now();
let acc = 0, frames = 0, hudT = 0;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused) step(dt);
  const s = getState();
  scene.update(s, paused ? 0.0001 : dt);
  acc += dt; frames++; hudT += dt;
  if (hudT > 0.5) {
    const st = scene.getStats();
    hud.textContent = `${(frames / acc).toFixed(0)} fps | cpu ${st.frameMs.toFixed(1)} ms | rt ${st.renderTarget.join('x')} | ${st.drawCalls} calls | sel ${selected ?? '-'}`;
    acc = 0; frames = 0; hudT = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(window as unknown as Record<string, unknown>).scene = scene;
(window as unknown as Record<string, unknown>).getState = getState;

/** Test helper: advance sim + scene synchronously (background tabs don't run rAF). */
(window as unknown as Record<string, unknown>).advance = (sec: number, dt = 1 / 30): void => {
  for (let t = 0; t < sec; t += dt) { step(dt); scene.update(getState(), dt); }
};

/** Regression helper: sweep camera elevation and report the mean colour of an open-floor patch per step.
 *  The floor colour under a static light must not depend on the view angle, so any jump flags a bug ("ground flash").
 *  The camera is centred on each sample point (open floor along the south-east view ray) so nothing occludes it.
 *  Usage: sweepElevation({ from: 16, to: 78, step: 1, zoom: 1, threshold: 40 }) -> { steps, jumps, maxJump } */
(window as unknown as Record<string, unknown>).sweepElevation = (opts: { from?: number; to?: number; step?: number; zoom?: number; threshold?: number; points?: [number, number][] } = {}) => {
  const { from = 16, to = 78, step = 1, zoom = 1, threshold = 40 } = opts;
  const points = opts.points ?? [[11.5, 2.5], [11.5, 6.5], [11.5, -2.5]];
  scene.resize();
  const cs = scene.getCameraState();
  const jumps: string[] = [];
  let maxJump = 0, steps = 0;
  for (const [x, z] of points) {
    scene.setCamera({ zoom, target: { x, y: 0, z } });
    for (let i = 0; i < 12; i++) scene.update(getState(), 1 / 60); // settle camera easing / first-frame state
    let prev: number[] | null = null;
    for (let el = from; el <= to; el += step) {
      scene.setCamera({ elevation: el * deg });
      scene.update(getState(), 1 / 60);
      const rgb = scene.sampleWorld(x, 0, z, 5) ?? [0, 0, 0];
      steps++;
      if (prev) {
        const dj = Math.max(...rgb.map((c, k) => Math.abs(c - prev![k])));
        maxJump = Math.max(maxJump, dj);
        if (dj > threshold) jumps.push(`el ${el} @(${x},${z}): jump ${dj.toFixed(0)} (${prev.map(Math.round)} -> ${rgb.map(Math.round)})`);
      }
      prev = rgb;
    }
  }
  scene.setCamera({ azimuth: cs.azimuth, elevation: cs.elevation, zoom: cs.zoom, target: cs.target });
  return { steps, jumps, maxJump: Math.round(maxJump) };
};

/** Test helper: step the sim until a flight of `kind` is at fraction p of its path, then frame the camera on it.
 *  Use with ?pause=1 so real-time frames don't move it on. Returns the flight id or 'none'. */
(window as unknown as Record<string, unknown>).showFlight = (kind?: string, p = 0.5, zoom = 3): string => {
  const st = getState();
  const mid = () => st.flights.find((f) => (!kind || f.kind === kind) && st.time > f.t0 + f.dur * p - 0.05 && st.time < f.t0 + f.dur * p + 0.05);
  for (let n = 0; !mid() && n < 4000; n++) step(0.05);
  const f = mid();
  if (!f) return 'none';
  const pos = (e: typeof f.from) => ('agent' in e ? st.agents.find((x) => x.id === e.agent)!.pos : { x: 8.6, z: -6 });
  const A = pos(f.from), B = pos(f.to);
  scene.setCamera({ zoom, target: { x: (A.x + B.x) / 2, y: 1, z: (A.z + B.z) / 2 } });
  scene.update(st, 0.0001);
  return f.kind + ' ' + f.id;
};
