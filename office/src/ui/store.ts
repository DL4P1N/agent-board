// localStorage persistence (always in try/catch: private windows / blocked storage must not break the demo).
import { DEFAULT_SETTINGS, DEFAULT_VISUAL, type SimSettings, type VisualSettings } from '../types';

const KEY = 'agent-board:v2';

export interface Prefs {
  open: Record<string, boolean>;      // control-panel sections
  min: Record<string, boolean>;       // minimized HUD windows
  collapse: Record<string, boolean>;  // collapsed docks
  rects: Record<string, { x: number; y: number; w: number; h: number }>; // user-saved HUD window geometry (px)
  dockW: Record<string, number>;      // user-saved dock widths (px)
  boardMode: 'cards' | 'list';
  /** Main view: the 3D office, or the technical 2D board (no WebGL rendering). */
  view: 'office' | 'board';
  /** How the board view lays out tickets. */
  techTickets: 'columns' | 'table';
}
export interface Persisted { settings: SimSettings; visual: VisualSettings; prefs: Prefs; hadSaved: boolean }

export const DEFAULT_PREFS: Prefs = {
  open: { scenarios: true, fleet: true, workload: true, behaviour: false, time: true, config: true, visuals: false },
  min: { plan: true, skills: true },
  collapse: {},
  rects: {},
  dockW: {},
  boardMode: 'cards',
  view: 'board',
  techTickets: 'columns',
};

function pick<T extends object>(defaults: T, saved: unknown): T {
  const out = { ...defaults } as Record<string, unknown>;
  if (saved && typeof saved === 'object') {
    for (const [k, dv] of Object.entries(defaults)) {
      const sv = (saved as Record<string, unknown>)[k];
      if (typeof sv === typeof dv && sv !== null) {
        out[k] = dv && typeof dv === 'object' ? { ...(dv as object), ...(sv as object) } : sv;
      }
    }
  }
  return out as T;
}

export function load(): Persisted {
  let raw: unknown = null;
  try { const s = localStorage.getItem(KEY); if (s) raw = JSON.parse(s); } catch { /* ignore */ }
  const r = (raw ?? {}) as Record<string, unknown>;
  const settings = pick(DEFAULT_SETTINGS, r.settings);
  if (settings.simSpeed <= 0) settings.simSpeed = 1; // never boot paused
  const prefsRaw = (r.prefs ?? {}) as Partial<Prefs>;
  const prefs: Prefs = {
    open: { ...DEFAULT_PREFS.open, ...(prefsRaw.open ?? {}) },
    min: { ...DEFAULT_PREFS.min, ...(prefsRaw.min ?? {}) },
    collapse: { ...(prefsRaw.collapse ?? {}) },
    rects: { ...(prefsRaw.rects ?? {}) },
    dockW: { ...(prefsRaw.dockW ?? {}) },
    boardMode: prefsRaw.boardMode === 'list' ? 'list' : 'cards',
    view: prefsRaw.view === 'office' ? 'office' : 'board',
    techTickets: prefsRaw.techTickets === 'table' ? 'table' : 'columns',
  };
  // ?view=board / ?view=office in the URL wins (shareable link to either view)
  try { const v = new URLSearchParams(location.search).get('view'); if (v === 'board' || v === 'office') prefs.view = v; } catch { /* ignore */ }
  return { settings, visual: pick(DEFAULT_VISUAL, r.visual), prefs, hadSaved: raw !== null };
}

let timer = 0;
export function saveSoon(get: () => { settings: SimSettings; visual: VisualSettings; prefs: Prefs }): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(get())); } catch { /* ignore */ }
  }, 250);
}
export function clearSaved(): void { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
