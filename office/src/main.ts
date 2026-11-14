import './styles.css';
import { Simulation } from './sim';
import { LazyScene } from './scene/LazyScene';
import { UI } from './ui/UI';
import { load } from './ui/store';

const loaded = load();
document.documentElement.dataset.palette = loaded.visual.palette;

const sceneHost = document.getElementById('scene') as HTMLElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const sim = new Simulation(loaded.settings);
const scene = new LazyScene(sceneHost, { ...loaded.visual }); // WebGL is only created when the 3D office is first shown
const ui = new UI(uiRoot, sim, scene, loaded);

scene.onPick((id) => ui.pick(id));

window.addEventListener('resize', () => scene.resize());

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  sim.step(dt);
  if (ui.view === 'office') scene.update(sim.state, dt); // the board view shows no 3D, so skip rendering entirely
  ui.update(sim.state, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for debugging in the console.
(window as unknown as { agentBoard: unknown }).agentBoard = { sim, scene, ui };
