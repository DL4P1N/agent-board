/**
 * The 3D office live behind the main board (public/index.html), built into public/office/embed.js by
 * `npm run build:present`. The board loads it with a dynamic import() while its 3D switch is on, so three.js never
 * loads for people who turn it off (or on phones).
 *
 * Unlike the presenter (main.ts) it reads nothing by itself: the board passes the GET /api/state object it already
 * loads on every reload to update(). Same adapter (LiveWorld) and OfficeScene as the presenter.
 *
 *   const office = (await import('./office/embed.js')).mount(el, { theme: 'dark', reducedMotion: false, onPick });
 *   office.update(state); office.setTheme('night'); office.select('ana-claude'); office.setActive(false); office.destroy();
 */
import { OfficeScene } from '../scene/OfficeScene';
import { DEFAULT_VISUAL, type SimState, type VisualSettings } from '../types';

import { THEMES, themeOf } from '../themes';

type Palette = VisualSettings['palette'];
/** The board's theme (one of its fifteen, Auto already resolved) as a scene palette: each has its own room. Anything else: Dark. */
export function paletteOf(t: string | null | undefined): Palette {
  return themeOf(t) ?? 'dark';
}
import { LiveWorld } from './adapter';
import type { BoardState } from './board';

export interface EmbedOptions {
  /** The board's theme right now (Auto resolved to Dark or Light), so the room matches the page. */
  theme: Palette;
  /** prefers-reduced-motion: no paper planes or cheers; the office only moves for a moment after a change. */
  reducedMotion: boolean;
  /** An agent was clicked in the office (its agent name, e.g. "ana-claude"), or empty space (null). */
  onPick?: (agent: string | null) => void;
}

export interface OfficeEmbed {
  /** False when WebGL could not start: the caller should destroy() it and stay on the board. */
  readonly usable: boolean;
  /** A fresh board state (the /api/state object). Cheap: call it on every reload. */
  update(state: BoardState): void;
  setTheme(theme: Palette): void;
  /** Pause rendering while the office is hidden, resume when it is shown again. */
  setActive(on: boolean): void;
  /** Frames a second while active (30 by default): a few while the board covers the room, so it still moves behind
   *  the glass at little cost. */
  setFps(fps: number): void;
  /** Where the page's panels cover the view, as fractions of its width (left, right) and height (top, bottom): the room
   *  is framed in the part left free, so no desk sits under a dock or the Tasks window. */
  setInsets(i: { top: number; right: number; bottom: number; left: number }): void;
  /** Highlight an agent (or none). */
  select(agent: string | null): void;
  /** The agent highlighted now (picked in the scene or selected by the page), or null. */
  readonly selected: string | null;
  /** The palette the room is drawn in. */
  readonly palette: Palette;
  resize(): void;
  destroy(): void;
  /** A copy of what the scene draws (tests and the console). */
  snapshot(): SimState;
}

export function mount(container: HTMLElement, opts: EmbedOptions): OfficeEmbed {
  let palette = paletteOf(opts.theme);
  let selected: string | null = null;
  const reduced = !!opts.reducedMotion;
  // Owner colours are a little darker in a light room, like the board's own person colours in a light theme.
  const world = new LiveWorld({ motion: !reduced, light: THEMES[palette].light });
  const visual = (): VisualSettings => ({ ...DEFAULT_VISUAL, palette, live: true, showLabels: true, showBubbles: true, autoOrbit: false, focus: 0 });
  const scene = new OfficeScene(container, visual());
  let board: BoardState | null = null;
  let active = true;
  let raf = 0;
  let dead = false;
  // With reduced motion the office stands still: it only animates for a moment after something on it changed.
  let settleUntil = 0;
  let sig = '';
  let insetKey = '';
  const settle = (): void => { settleUntil = performance.now() + 1200; };
  const stateSig = (): string => {
    const s = world.state;
    return s.agents.map((a) => `${a.id}:${a.provider}:${a.deskIndex}:${a.pose}:${a.bubble ?? ''}:${a.ownerColor}`).join('|') + '#' + s.tickets.map((t) => t.id + t.status).join(',') + '#' + s.plan.name;
  };
  const apply = (): void => {
    if (!board) return;
    world.apply(board);
    const n = stateSig();
    if (n !== sig) { sig = n; settle(); }
  };

  if (scene.usable) {
    scene.onPick((id) => { selected = id; scene.selectAgent(id); opts.onPick?.(id); });
  }

  let last = performance.now();
  let FRAME = 1 / 30; // calm, and light on a laptop that also runs the agents: 30 fps is plenty
  const frame = (now: number): void => {
    raf = 0;
    if (dead || !active || !scene.usable) return;
    raf = requestAnimationFrame(frame);
    const dt = (now - last) / 1000;
    if (dt < FRAME * 0.9) return;
    last = now;
    const step = Math.min(0.1, dt);
    world.tick(step);
    if (reduced) {
      // Still: a near-zero step keeps every pose where it is; a short real step only while something just changed.
      if (now < settleUntil) scene.update(world.state, step);
      else if (Math.floor(now / 500) !== Math.floor((now - dt * 1000) / 500)) scene.update(world.state, 0.0001);
      return;
    }
    scene.update(world.state, step);
  };
  const run = (): void => { if (!raf && active && !dead && scene.usable) { last = performance.now(); settle(); raf = requestAnimationFrame(frame); } };
  run();

  return {
    get usable() { return scene.usable; },
    update(s: BoardState) { if (dead) return; board = s; apply(); },
    get selected() { return selected; },
    get palette() { return palette; },
    setTheme(t) {
      const p = paletteOf(t);
      if (p === palette || dead) return;
      palette = p;
      world.setOptions({ light: THEMES[p].light });
      scene.setVisual(visual());
      sig = ''; apply();
    },
    setActive(on: boolean) {
      if (dead) return;
      active = on;
      if (on) { scene.resize(); run(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    },
    setFps(fps: number) { FRAME = 1 / Math.max(1, Math.min(30, fps || 30)); },
    select(agent) { if (dead) return; selected = agent; scene.selectAgent(agent); settle(); },
    setInsets(i) {
      if (dead) return;
      const k = `${i.top.toFixed(3)} ${i.right.toFixed(3)} ${i.bottom.toFixed(3)} ${i.left.toFixed(3)}`;
      if (k === insetKey) return;
      insetKey = k; scene.setInsets(i); settle();
    },
    resize() { if (!dead) { scene.resize(); settle(); } },
    destroy() {
      if (dead) return;
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      scene.dispose();
    },
    snapshot: () => JSON.parse(JSON.stringify(world.state)) as SimState,
  };
}
