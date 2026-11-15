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
// The board's theme choice (Auto / Dusk / Day / Night / Terminal, per browser) picks the office palette. Auto (no
// html[data-theme]) follows the OS: Dusk on a dark one, Day on a light one. Older saved values: light = Day, dark = Dusk.
type Palette = VisualSettings['palette'];
const PALETTES: readonly Palette[] = ['dusk', 'day', 'night', 'terminal'];
const BARS: Record<Palette, string> = { dusk: '#1b1530', day: '#efe4cf', night: '#080c1a', terminal: '#020a04' };
const themeOf = (t: string | null | undefined): Palette | null => {
  const v = t === 'light' ? 'day' : t === 'dark' ? 'dusk' : t;
  return (PALETTES as readonly string[]).includes(v ?? '') ? (v as Palette) : null;
};
const palette = (): Palette => themeOf(root.dataset.theme) ?? (mq('(prefers-color-scheme: dark)') ? 'dusk' : 'day');
const light = (): boolean => palette() === 'day';
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
Object.defineProperty(window, '__officePalette', { get: () => palette(), configurable: false });

const visual = (): VisualSettings => ({ ...DEFAULT_VISUAL, palette: palette(), live: true, showLabels: true, showBubbles: true, autoOrbit: false, focus: 0 });
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
  const t = themeOf(e.newValue);
  if (t) root.dataset.theme = t; else delete root.dataset.theme;
  // The page's own tags follow (the pre-paint script in present.html set them for the first paint).
  const meta = (id: string, attr: string, v: string): void => document.getElementById(id)?.setAttribute(attr, v);
  const dark = t !== null && t !== 'day';
  meta('m-scheme', 'content', t === null ? 'light dark' : dark ? 'dark' : 'light');
  meta('m-tc-light', 'media', t === null ? '(prefers-color-scheme: light)' : t === 'day' ? 'all' : 'not all');
  meta('m-tc-dark', 'media', t === null ? '(prefers-color-scheme: dark)' : dark ? 'all' : 'not all');
  meta('m-tc-dark', 'content', t && dark ? BARS[t] : BARS.dusk);
  themeChanged();
});
// Keep the MediaQueryList: a temporary one can be garbage-collected and take its listener with it.
const darkMq = matchMedia('(prefers-color-scheme: dark)');
try { darkMq.addEventListener('change', themeChanged); } catch { /* old browsers */ }

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
