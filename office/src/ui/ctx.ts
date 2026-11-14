import type { BoardCommands, AgentState, SimSettings, SimState, VisualSettings } from '../types';
import type { Simulation } from '../sim';
import type { LazyScene } from '../scene/LazyScene';
import type { Prefs } from './store';

export interface UICtx {
  sim: Simulation;
  scene: LazyScene;
  visual: VisualSettings;
  prefs: Prefs;
  state: SimState;
  selectedId: string | null;
  /** Board commands implemented by the sim (may be partially missing while the sim is being upgraded). Always call with optional chaining. */
  cmd: Partial<BoardCommands>;
  setSettings(patch: Partial<SimSettings>): void;
  setVisual(patch: Partial<VisualSettings>): void;
  select(id: string | null): void;
  togglePause(): void;
  bumpSpeed(dir: 1 | -1): void;
  savePrefs(): void;
  refresh(): void;
  resetAll(): void;
  restart(): void;
  resetVisuals(): void;
  agent(id: string | null): AgentState | undefined;
  /** Current main view and a way to switch it (3D office or technical board). */
  view: 'office' | 'board';
  setView(v: 'office' | 'board'): void;
  /** Open the ticket editor drawer for a ticket (works in both views). */
  openTicket(id: string): void;
  /** Open the ticket creator drawer. */
  openNewTicket(): void;
  /** Open the About dialog. */
  openAbout(): void;
}

export interface Panel {
  el: HTMLElement;
  update(state: SimState): void;
}
