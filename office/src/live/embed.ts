/**
 * The 3D office as a view inside the main board (public/index.html), built into public/office/embed.js by
 * `npm run build:present`. The board loads it with a dynamic import() only when someone first switches to
 * "3D office", so three.js never loads for people who stay on the board.
 *
 * Unlike the presenter (main.ts) it reads nothing by itself: the board passes the GET /api/state object it already
 * loads on every reload to update(). Same adapter (LiveWorld) and OfficeScene as the presenter.
 *
 *   const office = (await import('./office/embed.js')).mount(el, { theme: 'dark', reducedMotion: false, onPick });
 *   office.update(state); office.setTheme('light'); office.setActive(false); office.destroy();
 */
import { OfficeScene } from '../scene/OfficeScene';
import { DEFAULT_VISUAL, type SimState, type VisualSettings } from '../types';
import { LiveWorld } from './adapter';
import type { BoardState } from './board';

export interface EmbedOptions {
  /** The board's theme right now: Dusk palette for dark, Day for light. */
  theme: 'light' | 'dark';
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
  setTheme(theme: 'light' | 'dark'): void;
  /** Pause rendering while the office is hidden (the board view), resume when it is shown again. */
  setActive(on: boolean): void;
  /** Highlight an agent (or none). */
  select(agent: string | null): void;
  resize(): void;
  destroy(): void;
  /** A copy of what the scene draws (tests and the console). */
  snapshot(): SimState;
}

export function mount(container: HTMLElement, opts: EmbedOptions): OfficeEmbed {
  let light = opts.theme === 'light';
  const reduced = !!opts.reducedMotion;
  const world = new LiveWorld({ motion: !reduced, light });
  const visual = (): VisualSettings => ({ ...DEFAULT_VISUAL, palette: light ? 'day' : 'dusk', live: true, showLabels: true, showBubbles: true, autoOrbit: false, focus: 0 });
  const scene = new OfficeScene(container, visual());
  let board: BoardState | null = null;
  let active = true;
  let raf = 0;
  let dead = false;
  // With reduced motion the office stands still: it only animates for a moment after something on it changed.
  let settleUntil = 0;
  let sig = '';
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
    scene.onPick((id) => { scene.selectAgent(id); opts.onPick?.(id); });
  }

  let last = performance.now();
  const FRAME = 1 / 30; // calm, and light on a laptop that also runs the agents: 30 fps is plenty
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
    setTheme(t) {
      const l = t === 'light';
      if (l === light || dead) return;
      light = l;
      world.setOptions({ light });
      scene.setVisual(visual());
      sig = ''; apply();
    },
    setActive(on: boolean) {
      if (dead) return;
      active = on;
      if (on) { scene.resize(); run(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    },
    select(agent) { if (!dead) scene.selectAgent(agent); },
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
