/**
 * Presenter view: the 3D office driven by the live board (built into public/present.html by `npm run build:present`).
 * Read-only: no simulator, no controls. Falls back to the classic presenter (public/present-classic.html) when WebGL
 * is missing or the scene can't start.
 */
import './present.css';
import { installProviderCss } from '../providers';
import { DEFAULT_VISUAL, type VisualSettings } from '../types';
import type { OfficeScene } from '../scene/OfficeScene';
import { LiveWorld } from './adapter';
import type { BoardState } from './board';
import { connect, SLUG, viewToken } from './connection';
import { Overlay } from './overlay';

const root = document.documentElement;
const mq = (q: string): boolean => { try { return matchMedia(q).matches; } catch { return false; } };
const reduced = mq('(prefers-reduced-motion: reduce)');
// The board's theme choice (Auto / Light / Dark, per browser) picks the office palette: Dusk for dark, Day for light.
const light = (): boolean => (root.dataset.theme === 'light' ? true : root.dataset.theme === 'dark' ? false : !mq('(prefers-color-scheme: dark)'));
const classicHref = (): string => 'present-classic.html' + (viewToken() ? '?token=' + encodeURIComponent(viewToken()) : '');

let fellBack = false;
function fallback(why: string): void {
  if (fellBack) return;
  fellBack = true;
  root.dataset.scene = 'failed';
  console.warn(`[presenter] ${why}: opening the simple view`);
  location.replace(classicHref());
}

installProviderCss();
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const host = $('scene');
const overlay = new Overlay({ root: $('live'), top: $('top'), bottom: $('bottom'), msg: $('msg') }, classicHref, SLUG);
const world = new LiveWorld({ motion: !reduced, light: light() });
let board: BoardState | null = null;

// Read-only debug hook for tests and the console: a copy of the state the scene draws.
Object.defineProperty(window, '__officeState', { get: () => JSON.parse(JSON.stringify(world.state)), configurable: false });

const visual = (): VisualSettings => ({ ...DEFAULT_VISUAL, palette: light() ? 'day' : 'dusk', live: true, showLabels: true, showBubbles: true, autoOrbit: false, focus: 0 });
let scene: OfficeScene | null = null;
// With reduced motion the office stands still: it only animates for a moment after something on it changed.
let settleUntil = 0;
let sig = '';
const settle = (): void => { settleUntil = performance.now() + 1200; };
function stateSig(): string {
  const s = world.state;
  return s.agents.map((a) => `${a.id}:${a.provider}:${a.deskIndex}:${a.pose}:${a.bubble ?? ''}:${a.ownerColor}`).join('|') + '#' + s.tickets.map((t) => t.id + t.status).join(',') + '#' + s.plan.name;
}
function applyBoard(): void {
  if (!board) return;
  world.apply(board);
  const n = stateSig();
  if (n !== sig) { sig = n; settle(); }
}
function labelScale(): void { root.style.setProperty('--label-scale', String(Math.max(1.25, Math.min(2, Math.min(innerWidth / 1100, innerHeight / 620))).toFixed(2))); }
labelScale();
addEventListener('resize', () => { labelScale(); settle(); });

function themeChanged(): void {
  world.setOptions({ light: light() });
  scene?.setVisual(visual());
  sig = ''; applyBoard();
}
// The theme changed on the board in another tab (same browser), or the OS switched light/dark.
addEventListener('storage', (e) => {
  if (e.key !== 'board-theme') return;
  const v = e.newValue;
  if (v === 'light' || v === 'dark') root.dataset.theme = v; else delete root.dataset.theme;
  themeChanged();
});
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChanged); } catch { /* old browsers */ }

connect({
  state(s) { board = s; overlay.setState(s); applyBoard(); },
  message(html) { overlay.setMessage(html); settle(); },
  status(live, note) { overlay.setStatus(live, note); },
});
setInterval(() => { if (overlay.tick()) settle(); }, 1000);

async function start(): Promise<void> {
  try {
    const { OfficeScene: Scene } = await import('../scene/OfficeScene');
    const s = new Scene(host, visual());
    if (!s.usable) { s.dispose(); return fallback('WebGL is not available'); }
    scene = s;
    root.dataset.scene = 'ready';
  } catch (err) {
    return fallback(`the 3D office could not start (${err instanceof Error ? err.message : String(err)})`);
  }
  let last = performance.now();
  const FRAME = 1 / 30; // calm and light on a projector laptop: 30 fps is plenty
  const frame = (now: number): void => {
    requestAnimationFrame(frame);
    const dt = (now - last) / 1000;
    if (dt < FRAME * 0.9) return;
    last = now;
    const step = Math.min(0.1, dt);
    world.tick(step);
    if (reduced) {
      // Still: a near-zero step keeps every pose where it is; a short real step only while something just changed.
      if (now < settleUntil) scene!.update(world.state, step);
      else if (Math.floor(now / 500) !== Math.floor((now - dt * 1000) / 500)) scene!.update(world.state, 0.0001);
      return;
    }
    scene!.update(world.state, step);
  };
  requestAnimationFrame(frame);
}
void start();
