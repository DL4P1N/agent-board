/**
 * Reads the board with the read-only viewer token, exactly like the classic presenter (public/present-classic.html):
 * the same storage key, the same multi-board BASE (/b/<slug>/), the same expired / archived / moved / failed messages,
 * GET /api/state on every live event (debounced) and every 5 s.
 */
import type { BoardState } from './board';

// Several boards can share a server: /b/<slug>/ has its own API under /b/<slug>/api. The default board is at the root.
export const BASE = (location.pathname.match(/^\/b\/[^/]+/) || [''])[0];
export const SLUG = BASE ? decodeURIComponent(BASE.slice(3)) : '';
const store = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k: string): void => { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};
// A read-only viewer token (from the board's "Presenter view" link), kept apart from the main
// board's token so a projector laptop never holds the full board token.
export const VIEW_KEY = 'board-view-token' + (BASE ? '@' + BASE : '');
const qs = new URLSearchParams(location.search);
let token = qs.get('token') || store.get(VIEW_KEY) || '';
if (qs.get('token')) { store.set(VIEW_KEY, token); history.replaceState(null, '', location.pathname); }
/** The token this page runs with (for the "Simple view" link and the WebGL fallback, which open the classic page). */
export const viewToken = (): string => token;

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const EXPIRED = "This presenter link has expired: open a new one from the board (<b>Presenter view</b> in its help, <b>?</b>, or Ctrl+K).";
export const NO_TOKEN = 'Open this from the board: <b>Presenter view</b> in its help (<b>?</b>) or Ctrl+K.';

export interface ConnectionEvents {
  /** A fresh board state. */
  state(s: BoardState): void;
  /** Something to say instead of the board (HTML, already escaped), or null once the board is back. */
  message(html: string | null): void;
  /** Live stream status, or a "can't reach" note while the last state stays on screen. */
  status(live: boolean, note: string): void;
}

export function connect(on: ConnectionEvents): void {
  let expired = false; let unavailable = 0; let live = false; let lastErr = ''; let have = false;
  let es: EventSource | null = null; let reloadT: ReturnType<typeof setTimeout> | undefined;

  async function load(): Promise<void> {
    if (!token) { on.message(NO_TOKEN); return; }
    if (expired) return;
    try {
      const r = await fetch(BASE + '/api/state', { cache: 'no-store', headers: { Authorization: 'Bearer ' + token } });
      if (r.status === 401 || r.status === 403) { expired = true; es?.close(); store.del(VIEW_KEY); on.message(EXPIRED); return; }
      // Archived (410), moved to its own address (409) or failed to open (503): say so, keep checking
      // (the 5 s poll), and come back by itself when the board is available again.
      if (r.status === 410 || r.status === 409 || r.status === 503) {
        const body = await r.json().catch(() => ({} as Record<string, string>));
        unavailable = r.status; es?.close(); live = false;
        if (r.status === 410) return on.message('This board is archived. The presenter view comes back by itself when the host restores it.');
        if (r.status === 503) return on.message(`This board couldn't open: ${esc(body.error || 'unknown error')}. Checking again by itself.`);
        const to = String(body.moved_to || '').replace(/\/+$/, '');
        const url = new URL(to + '/present.html', location.origin); url.searchParams.set('token', token);
        return on.message(`This board moved to its own address. <a href="${esc(url.href)}">Open the presenter view there</a>.`);
      }
      if (!r.ok) throw new Error(r.statusText);
      const s = (await r.json()) as BoardState;
      lastErr = '';
      if (unavailable || !have) { unavailable = 0; on.message(null); }
      have = true;
      on.state(s);
      on.status(live, '');
      if (!es || es.readyState === 2) stream(); // the stream closed for good (archived, restarted): open it again
    } catch {
      lastErr = "Can't reach the board server; retrying…";
      if (have) on.status(false, lastErr); else on.message(esc(lastErr));
    }
  }

  function stream(): void {
    if (!token || expired || unavailable || typeof EventSource === 'undefined') return;
    es?.close();
    es = new EventSource(BASE + '/api/stream?token=' + encodeURIComponent(token));
    es.onopen = () => { live = true; on.status(true, lastErr); };
    es.onmessage = () => { clearTimeout(reloadT); reloadT = setTimeout(load, 300); };
    // A rotated or revoked token: the stream fails; check once whether the link has expired.
    es.onerror = () => { live = false; on.status(false, lastErr); clearTimeout(reloadT); reloadT = setTimeout(load, 1500); };
  }

  void load();
  setInterval(() => { void load(); }, 5000);
}
