// HUD framework: floating, draggable, resizable overlay windows that minimize into chips, plus resizable docks.
//
// hudWindow(ctx, id, title, defaultMin, cls?, opts?)  -- signature is backward compatible; `opts` is optional.
// Windows mount THEMSELVES (no need to append win.el anywhere): open windows live in a free-position layer, minimized
// ones flow as chips in a row per `zone` ('top' = top-centre row, 'bottom' = bottom-left row). On narrow screens
// ('bottom' windows go into the bottom sheet, 'top' ones into a row under the top bar) dragging/resizing is disabled.
import { icon } from './icons';
import { clamp, h, setText, toggleClass } from './dom';
import type { UICtx } from './ctx';

export type HudZone = 'top' | 'bottom';
export interface Rect { x: number; y: number; w: number; h: number }
/** Everything a default-placement function may need. All values in CSS px. */
export interface HudLayout { vw: number; vh: number; rem: number; gap: number; topY: number; bottomY: number; leftX: number; rightX: number; stripH: number }

export interface HudOptions {
  /** 'top' or 'bottom' chip row / default band. Default 'bottom'. */
  zone?: HudZone;
  /** Default size in rem (used by the generic placement). */
  defaultSize?: { w: number; h: number };
  /** Min / max size in rem. */
  minSize?: { w: number; h: number };
  maxSize?: { w: number; h: number };
  /** Custom default placement (px). Called whenever the window has no user-saved rect. */
  place?: (l: HudLayout, size: { w: number; h: number }) => Rect;
  resizable?: boolean;   // default true
  draggable?: boolean;   // default true
  /** Called when fullscreen is entered / left. */
  onFullscreen?: (on: boolean) => void;
}

export interface HudWin {
  el: HTMLElement;
  body: HTMLElement;
  extras: HTMLElement;       // slot in the title bar for small controls
  head: HTMLElement;
  setChip(text: string): void;
  setMin(min: boolean): void;
  toggle(): void;
  isMin(): boolean;
  /** Expand to (nearly) the whole viewport under the top bar and back. */
  setFullscreen(on: boolean): void;
  isFullscreen(): boolean;
  /** Forget the user-saved position/size (back to the default placement). */
  resetRect(): void;
  raise(): void;
}

interface WinInternal {
  id: string; el: HTMLElement; zone: HudZone; order: number; opts: HudOptions;
  min: boolean; defMin: boolean; rect: Rect | null; fs: boolean; z: number;
  setMinState(m: boolean, persist?: boolean): void; refreshAria(): void; handles: HTMLElement[];
}

const MOBILE_Q = '(max-width: 960px)';
const STEP = 16;

class HudManager {
  ctx!: UICtx;
  layer = h('div', { class: 'hud-layer' });
  chipsTop = h('div', { class: 'chips chips-top' });
  chipsBottom = h('div', { class: 'chips chips-bottom' });
  sheet = h('div', { class: 'hud-sheet' });
  wins = new Map<string, WinInternal>();
  mobile = false;
  attached = false;
  z = 10;
  private raf = 0;
  private counter = 0;

  attach(ctx: UICtx, root: HTMLElement): void {
    this.ctx = ctx;
    this.attached = true;
    root.append(this.layer, this.chipsTop, this.chipsBottom, this.sheet);
    const mq = window.matchMedia(MOBILE_Q);
    this.mobile = mq.matches;
    mq.addEventListener('change', () => { this.mobile = mq.matches; this.mountAll(); this.layout(); });
    window.addEventListener('resize', () => this.relayout());
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.relayout());
      ro.observe(this.chipsBottom); ro.observe(this.chipsTop);
      const tb = root.querySelector('.topbar'); if (tb) ro.observe(tb);
      root.querySelectorAll('.dock').forEach((d) => ro.observe(d));
    }
    if (this.mobile) for (const w of this.wins.values()) if (w.zone === 'top' && !w.min) w.setMinState(true, false); // keep the 3D view usable on phones
    this.mountAll();
    this.layout();
  }

  nextOrder(): number { return this.counter++; }

  register(w: WinInternal): void {
    this.wins.set(w.id, w);
    if (this.attached) { this.mount(w); this.relayout(); }
  }

  private insertOrdered(parent: HTMLElement, w: WinInternal): void {
    if (w.el.parentElement === parent) return;
    let before: Element | null = null;
    for (const c of Array.from(parent.children)) { if (Number((c as HTMLElement).dataset.order ?? 0) > w.order) { before = c; break; } }
    parent.insertBefore(w.el, before);
  }

  mount(w: WinInternal): void {
    if (this.mobile) this.insertOrdered(w.zone === 'top' ? this.chipsTop : this.sheet, w);
    else this.insertOrdered(w.min ? (w.zone === 'top' ? this.chipsTop : this.chipsBottom) : this.layer, w);
  }
  mountAll(): void { for (const w of this.wins.values()) this.mount(w); }

  relayout(): void {
    if (this.raf || !this.attached) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.layout(); });
  }

  measure(): HudLayout {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 14;
    const gap = rem * 0.5;
    const vw = window.innerWidth, vh = window.innerHeight;
    const tb = document.querySelector('.topbar') as HTMLElement | null;
    const topY = (tb ? tb.getBoundingClientRect().bottom : rem * 3.5) + gap;
    const chipsH = this.chipsBottom.children.length ? this.chipsBottom.offsetHeight : 0;
    const bottomY = vh - gap - (chipsH > 0 ? chipsH + gap : 0);
    const lDock = document.querySelector('.dock.left') as HTMLElement | null;
    const rDock = document.querySelector('.dock.right') as HTMLElement | null;
    const hidden = document.documentElement.dataset.panels === 'hidden';
    const leftX = lDock && !hidden ? lDock.getBoundingClientRect().right + gap : gap;
    const rightX = rDock && !hidden ? rDock.getBoundingClientRect().left - gap : vw - gap;
    const stripH = vh < 560 ? 10 * rem : clamp(0.28 * vh, 12.5 * rem, 21 * rem);
    return { vw, vh, rem, gap, topY, bottomY, leftX, rightX, stripH };
  }

  sizeLimits(w: WinInternal, l: HudLayout): { minW: number; minH: number; maxW: number; maxH: number } {
    const o = w.opts;
    return {
      minW: (o.minSize?.w ?? 16) * l.rem, minH: (o.minSize?.h ?? 8) * l.rem,
      maxW: Math.min(l.vw - l.gap * 2, (o.maxSize?.w ?? 200) * l.rem), maxH: Math.min(l.vh - l.topY - l.gap, (o.maxSize?.h ?? 200) * l.rem),
    };
  }

  defaultRect(w: WinInternal, l: HudLayout, k: number): Rect {
    const { rem, gap } = l;
    const size = { w: (w.opts.defaultSize?.w ?? 24) * rem, h: (w.opts.defaultSize?.h ?? 16) * rem };
    if (w.opts.place) return w.opts.place(l, size);
    const narrow = l.vw < 1100;
    const mW = (narrow ? 18 : 22) * rem, lW = (narrow ? 16 : 20) * rem;
    switch (w.id) {
      case 'metrics': return { x: gap, y: l.bottomY - l.stripH, w: mW, h: l.stripH };
      case 'log': return { x: l.vw - gap - lW, y: l.bottomY - l.stripH, w: lW, h: l.stripH };
      case 'board': {
        const mOpen = this.wins.get('metrics') && !this.wins.get('metrics')!.min, lOpen = this.wins.get('log') && !this.wins.get('log')!.min;
        const x = mOpen ? gap + mW + gap : gap, right = lOpen ? l.vw - gap - lW - gap : l.vw - gap;
        return { x, y: l.bottomY - l.stripH, w: Math.max(18 * rem, right - x), h: l.stripH };
      }
      case 'plan': return { x: l.leftX, y: l.topY, w: 22 * rem, h: 13 * rem };
      case 'skills': { const sw = 27 * rem; return { x: Math.max(l.leftX, l.rightX - sw), y: l.topY, w: sw, h: Math.min(32 * rem, l.vh - l.topY - 4 * rem) }; }
      default: {
        const off = k * 2 * rem;
        return w.zone === 'top'
          ? { x: l.leftX + off, y: l.topY + off, w: size.w, h: size.h }
          : { x: l.leftX + off, y: l.bottomY - size.h - off, w: size.w, h: size.h };
      }
    }
  }

  clampRect(r: Rect, w: WinInternal, l: HudLayout): Rect {
    const lim = this.sizeLimits(w, l);
    const ww = clamp(r.w, Math.min(lim.minW, lim.maxW), lim.maxW), hh = clamp(r.h, Math.min(lim.minH, lim.maxH), lim.maxH);
    return { w: ww, h: hh, x: clamp(r.x, 0, Math.max(0, l.vw - ww)), y: clamp(r.y, l.topY - l.gap, Math.max(l.topY - l.gap, l.vh - hh)) };
  }

  /** The rect a window should occupy right now. */
  currentRect(w: WinInternal, l: HudLayout, k: number): Rect {
    if (w.fs) return { x: l.gap, y: l.topY, w: l.vw - l.gap * 2, h: l.vh - l.topY - l.gap };
    if (w.rect) return this.clampRect(w.rect, w, l);
    return this.clampRect(this.defaultRect(w, l, k), w, l);
  }

  apply(w: WinInternal, r: Rect): void {
    const s = w.el.style;
    s.left = `${Math.round(r.x)}px`; s.top = `${Math.round(r.y)}px`; s.width = `${Math.round(r.w)}px`; s.height = `${Math.round(r.h)}px`;
  }

  layout(): void {
    const doc = document.documentElement;
    const l = this.measure();
    doc.style.setProperty('--top-h', `${Math.ceil(l.topY - l.gap * 2)}px`);
    const ct = this.chipsTop.children.length ? this.chipsTop.getBoundingClientRect() : null;
    doc.style.setProperty('--chips-top-b', ct && ct.height > 0 ? `${Math.ceil(ct.bottom)}px` : '0px'); // the board view starts below the top chip row
    if (this.mobile) {
      for (const w of this.wins.values()) { w.el.style.left = w.el.style.top = w.el.style.width = w.el.style.height = ''; }
      doc.style.setProperty('--hud-b', '0px');
      return;
    }
    let top = l.bottomY;
    let generic = 0;
    for (const w of this.wins.values()) {
      if (w.min) { w.el.style.left = w.el.style.top = w.el.style.width = w.el.style.height = ''; continue; }
      const isGeneric = !['metrics', 'log', 'board', 'plan', 'skills'].includes(w.id) && !w.opts.place;
      const r = this.currentRect(w, l, isGeneric ? generic++ : 0);
      this.apply(w, r);
      w.refreshAria();
      if (doc.dataset.view === 'board' && BOARD_VIEW_HIDDEN.has(w.id)) continue; // replaced by the board view, so it takes no room
      if (w.zone === 'bottom' && !w.rect && !w.fs && r.y + r.h >= l.bottomY - 2) top = Math.min(top, r.y); // only windows sitting in the bottom band push the docks up
    }
    doc.style.setProperty('--hud-b', `${Math.ceil(l.vh - top)}px`);
    doc.style.setProperty('--left-edge', `${Math.round(l.leftX)}px`);
    doc.style.setProperty('--right-edge', `${Math.round(l.vw - l.rightX)}px`);
  }

  resetLayout(): void {
    const p = this.ctx.prefs;
    p.rects = {}; p.dockW = {};
    for (const w of this.wins.values()) { w.rect = null; w.fs = false; w.el.classList.remove('fs'); w.setMinState(w.defMin); w.opts.onFullscreen?.(false); }
    document.querySelectorAll<HTMLElement>('.dock').forEach((d) => { d.style.width = ''; });
    this.ctx.savePrefs();
    this.mountAll();
    this.layout();
  }

  /** Minimise the open floating window that is on top (Esc). Returns false when none is open. */
  closeTop(skip: Set<string>): boolean {
    let top: WinInternal | null = null;
    for (const w of this.wins.values()) if (!w.min && !skip.has(w.id) && w.el.offsetParent !== null && (!top || w.z > top.z)) top = w;
    if (!top) return false;
    top.setMinState(true);
    return true;
  }

  exitFullscreen(): boolean {
    let any = false;
    for (const w of this.wins.values()) if (w.fs) { w.fs = false; w.el.classList.remove('fs'); w.opts.onFullscreen?.(false); any = true; }
    if (any) { document.documentElement.classList.remove('hud-fs'); this.layout(); }
    return any;
  }
}

const mgr = new HudManager();

/** Attach the HUD layers to the UI root. Call once, BEFORE creating windows is ideal (windows created earlier are mounted on attach). */
export function attachHud(ctx: UICtx, root: HTMLElement): void { mgr.attach(ctx, root); }
/** HUD windows the board view replaces with its own sections (hidden there, CSS: html[data-view="board"]). */
export const BOARD_VIEW_HIDDEN = new Set(['board', 'log', 'metrics']);
export function resetHudLayout(): void { mgr.resetLayout(); }
export function exitHudFullscreen(): boolean { return mgr.exitFullscreen(); }
/** Minimise the top-most open window, ignoring the ids in `skip`. */
export function closeTopHudWindow(skip: Iterable<string> = []): boolean { return mgr.closeTop(new Set(skip)); }
export function relayoutHud(): void { mgr.relayout(); }

const dragging = (on: boolean): void => { document.documentElement.classList.toggle('hud-dragging', on); };

export function hudWindow(ctx: UICtx, id: string, title: string, defaultMin: boolean, cls = '', opts: HudOptions = {}): HudWin {
  const zone: HudZone = opts.zone ?? (id === 'plan' || id === 'skills' || id === 'hack' ? 'top' : 'bottom');
  let min = ctx.prefs.min[id] ?? defaultMin;
  const chipText = h('span', { class: 'chip-text' });
  const chip = h('button', { class: 'win-chip', type: 'button', title: `Show ${title}`, 'aria-expanded': 'false' },
    h('span', { class: 'chip-title' }, title), chipText, h('span', { class: 'chip-open', 'aria-hidden': 'true' }, icon('chev')));
  const extras = h('span', { class: 'win-extras' });
  const minBtn = h('button', { class: 'ibtn', type: 'button', title: `Minimize ${title}`, 'aria-label': `Minimize ${title}` }, icon('chev'));
  const body = h('div', { class: 'win-body' });
  const titleEl = h('h2', { class: 'win-title' }, title);
  const head = h('header', { class: 'win-head', title: 'Drag to move. Arrow keys move when focused.', tabIndex: 0, 'aria-label': `${title} title bar. Arrow keys move the window.` }, titleEl, extras, minBtn);
  const full = h('div', { class: 'win-full' }, head, body);
  const el = h('section', { class: `win ${cls}`.trim(), dataset: { win: id, order: String(mgr.nextOrder()) } }, chip, full);

  const internal: WinInternal = {
    id, el, zone, order: Number(el.dataset.order), opts, min, defMin: defaultMin, rect: ctx.prefs.rects?.[id] ?? null, fs: false, z: 0,
    setMinState: (m, persist = true) => setMin(m, persist), refreshAria: () => refreshAria(), handles: [],
  };

  // ---- resize handles
  type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
  const dirs: Dir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  const handles: Record<string, HTMLElement> = {};
  const live = (): Rect => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const setRect = (r: Rect): void => {
    const l = mgr.measure();
    internal.rect = mgr.clampRect(r, internal, l);
    mgr.apply(internal, internal.rect);
    refreshAria();
  };
  const persist = (): void => { if (internal.rect) { ctx.prefs.rects[id] = { x: Math.round(internal.rect.x), y: Math.round(internal.rect.y), w: Math.round(internal.rect.w), h: Math.round(internal.rect.h) }; } ctx.savePrefs(); mgr.relayout(); };
  const resize = (dir: Dir, start: Rect, dx: number, dy: number): void => {
    const l = mgr.measure(); const lim = mgr.sizeLimits(internal, l);
    let { x, y, w, h: hh } = start;
    if (dir.includes('e')) w = clamp(start.w + dx, lim.minW, Math.min(lim.maxW, l.vw - start.x));
    if (dir.includes('w')) { const nw = clamp(start.w - dx, lim.minW, Math.min(lim.maxW, start.x + start.w)); x = start.x + start.w - nw; w = nw; }
    if (dir.includes('s')) hh = clamp(start.h + dy, lim.minH, Math.min(lim.maxH, l.vh - start.y));
    if (dir.includes('n')) { const nh = clamp(start.h - dy, lim.minH, Math.min(lim.maxH, start.y + start.h - (l.topY - l.gap))); y = start.y + start.h - nh; hh = nh; }
    setRect({ x, y, w, h: hh });
  };
  for (const d of dirs) {
    const edge = d.length === 1;
    const hd = h('div', {
      class: `rh rh-${d}`, title: 'Drag to resize. Double-click to reset size.', 'data-dir': d,
      ...(edge ? { role: 'separator', tabIndex: 0, 'aria-orientation': d === 'e' || d === 'w' ? 'vertical' : 'horizontal', 'aria-label': `Resize ${title} (${d === 'e' || d === 'w' ? 'width' : 'height'}), arrow keys` } : { 'aria-hidden': 'true' }),
    });
    let start: Rect | null = null, sx = 0, sy = 0;
    hd.addEventListener('pointerdown', (e) => {
      if (mgr.mobile || internal.fs || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      hd.setPointerCapture(e.pointerId); start = live(); sx = e.clientX; sy = e.clientY; dragging(true); raise();
      hd.classList.add('active');
    });
    hd.addEventListener('pointermove', (e) => { if (start) resize(d, start, e.clientX - sx, e.clientY - sy); });
    const end = (e: PointerEvent): void => { if (!start) return; start = null; hd.classList.remove('active'); try { hd.releasePointerCapture(e.pointerId); } catch { /* ignore */ } dragging(false); persist(); };
    hd.addEventListener('pointerup', end); hd.addEventListener('pointercancel', end);
    hd.addEventListener('dblclick', (e) => { e.stopPropagation(); resetRect(); });
    if (edge) hd.addEventListener('keydown', (e) => {
      const k = e.key; const step = e.shiftKey ? STEP * 3 : STEP;
      const grow = (d === 'e' && k === 'ArrowRight') || (d === 'w' && k === 'ArrowLeft') || (d === 's' && k === 'ArrowDown') || (d === 'n' && k === 'ArrowUp');
      const shrink = (d === 'e' && k === 'ArrowLeft') || (d === 'w' && k === 'ArrowRight') || (d === 's' && k === 'ArrowUp') || (d === 'n' && k === 'ArrowDown');
      if (k === 'Home' || k === 'Enter') { e.preventDefault(); resetRect(); return; }
      if (!grow && !shrink) return;
      e.preventDefault(); e.stopPropagation();
      const amt = grow ? step : -step;
      const dx = d === 'e' ? amt : d === 'w' ? -amt : 0, dy = d === 's' ? amt : d === 'n' ? -amt : 0;
      resize(d, live(), dx, dy); persist();
    });
    handles[d] = hd; internal.handles.push(hd);
  }
  const refreshAria = (): void => {
    const r = live(); const l = mgr.measure(); const lim = mgr.sizeLimits(internal, l);
    for (const d of ['e', 'w'] as const) { const hd = handles[d]; hd.setAttribute('aria-valuemin', String(Math.round(lim.minW))); hd.setAttribute('aria-valuemax', String(Math.round(lim.maxW))); hd.setAttribute('aria-valuenow', String(Math.round(r.w))); }
    for (const d of ['n', 's'] as const) { const hd = handles[d]; hd.setAttribute('aria-valuemin', String(Math.round(lim.minH))); hd.setAttribute('aria-valuemax', String(Math.round(lim.maxH))); hd.setAttribute('aria-valuenow', String(Math.round(r.h))); }
  };
  if (opts.resizable !== false) full.append(...dirs.map((d) => handles[d]));

  // ---- drag by title bar
  if (opts.draggable !== false) {
    let start: Rect | null = null, sx = 0, sy = 0;
    head.addEventListener('pointerdown', (e) => {
      if (mgr.mobile || internal.fs || e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button, input, select, textarea, a, label')) return;
      head.setPointerCapture(e.pointerId); start = live(); sx = e.clientX; sy = e.clientY; dragging(true); raise();
      el.classList.add('moving');
    });
    head.addEventListener('pointermove', (e) => { if (start) setRect({ ...start, x: start.x + e.clientX - sx, y: start.y + e.clientY - sy }); });
    const end = (e: PointerEvent): void => { if (!start) return; start = null; el.classList.remove('moving'); try { head.releasePointerCapture(e.pointerId); } catch { /* ignore */ } dragging(false); persist(); };
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
    head.addEventListener('dblclick', (e) => { if (!(e.target as HTMLElement).closest('button, input, select')) { resetRect(); } });
    head.addEventListener('keydown', (e) => {
      if (e.target !== head || mgr.mobile || internal.fs) return;
      const step = e.shiftKey ? STEP * 3 : STEP;
      const mv: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const m = mv[e.key]; if (!m) return;
      e.preventDefault(); const r = live(); setRect({ ...r, x: r.x + m[0], y: r.y + m[1] }); persist();
    });
  }
  el.addEventListener('pointerdown', () => raise(), true);

  function raise(): void { internal.z = ++mgr.z; el.style.zIndex = String(internal.z); }
  function resetRect(): void { internal.rect = null; delete ctx.prefs.rects[id]; ctx.savePrefs(); mgr.layout(); }

  const apply = (): void => {
    toggleClass(el, 'min', min);
    chip.setAttribute('aria-expanded', String(!min));
    chip.hidden = !min;
    full.hidden = min;
  };
  function setMin(m: boolean, persist = true): void {
    min = m; internal.min = m; if (persist) ctx.prefs.min[id] = m;
    if (!m && mgr.mobile && persist) for (const o of mgr.wins.values()) if (o !== internal && o.zone === zone && !o.min) o.setMinState(true, false); // phones: one open window per zone
    if (m && internal.fs) setFullscreen(false);
    apply(); mgr.mount(internal); if (!m) raise(); mgr.layout(); if (persist) ctx.savePrefs();
  }
  function setFullscreen(on: boolean): void {
    if (on === internal.fs) return;
    if (on) { mgr.exitFullscreen(); if (min) setMin(false); }
    internal.fs = on; toggleClass(el, 'fs', on); document.documentElement.classList.toggle('hud-fs', on);
    if (on) raise();
    opts.onFullscreen?.(on); mgr.layout();
  }
  chip.addEventListener('click', () => setMin(false));
  minBtn.addEventListener('click', () => setMin(true));
  apply();
  mgr.register(internal);

  return {
    el, body, extras, head, setChip: (t) => setText(chipText, t), setMin, toggle: () => setMin(!min), isMin: () => min,
    setFullscreen, isFullscreen: () => internal.fs, resetRect, raise,
  };
}

// ---------------------------------------------------------------------------------------------
// Docks

export interface Dock { el: HTMLElement; body: HTMLElement; extras: HTMLElement; setCollapsed(c: boolean): void; toggle(): void }

/** Side dock with a header, a collapse button and a drag handle on its inner edge (persisted width). */
export function dock(ctx: UICtx, id: string, title: string, side: 'left' | 'right'): Dock {
  let collapsed = ctx.prefs.collapse[id] ?? false;
  const pill = h('button', { class: 'dock-pill', type: 'button', title: `Show ${title}` }, h('span', {}, title), icon('chev'));
  const extras = h('span', { class: 'win-extras' });
  const btn = h('button', { class: 'ibtn', type: 'button', title: `Collapse ${title}`, 'aria-label': `Collapse ${title}` }, icon('chev'));
  const body = h('div', { class: 'dock-body' });
  const full = h('div', { class: 'dock-full' }, h('header', { class: 'dock-head' }, h('h2', { class: 'win-title' }, title), extras, btn), body);
  const handle = h('div', { class: `dock-rh dock-rh-${side}`, role: 'separator', tabIndex: 0, 'aria-orientation': 'vertical', 'aria-label': `Resize ${title} panel width, arrow keys`, title: 'Drag to resize. Double-click to reset.' });
  full.appendChild(handle);
  const el = h('aside', { class: `dock ${side}`, dataset: { dock: id }, 'aria-label': title }, pill, full);

  const rem = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize) || 14;
  const limits = (): { min: number; max: number } => ({ min: 15 * rem(), max: Math.min(38 * rem(), window.innerWidth * 0.45) });
  const setW = (px: number | null, save: boolean): void => {
    if (px === null) { el.style.width = ''; delete ctx.prefs.dockW[id]; }
    else { const lim = limits(); const w = clamp(px, lim.min, lim.max); el.style.width = `${Math.round(w)}px`; ctx.prefs.dockW[id] = Math.round(w); }
    handle.setAttribute('aria-valuenow', String(Math.round(el.getBoundingClientRect().width)));
    if (save) ctx.savePrefs();
    relayoutHud();
  };
  if (ctx.prefs.dockW[id]) setW(ctx.prefs.dockW[id], false);
  let start = 0, sx = 0;
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; e.preventDefault();
    handle.setPointerCapture(e.pointerId); start = el.getBoundingClientRect().width; sx = e.clientX; dragging(true); handle.classList.add('active');
  });
  handle.addEventListener('pointermove', (e) => { if (!handle.classList.contains('active')) return; const dx = e.clientX - sx; setW(side === 'left' ? start + dx : start - dx, false); });
  const end = (e: PointerEvent): void => { if (!handle.classList.contains('active')) return; handle.classList.remove('active'); try { handle.releasePointerCapture(e.pointerId); } catch { /* ignore */ } dragging(false); ctx.savePrefs(); };
  handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  handle.addEventListener('dblclick', () => setW(null, true));
  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? STEP * 3 : STEP; const cur = el.getBoundingClientRect().width;
    const grow = (side === 'left' && e.key === 'ArrowRight') || (side === 'right' && e.key === 'ArrowLeft');
    const shrink = (side === 'left' && e.key === 'ArrowLeft') || (side === 'right' && e.key === 'ArrowRight');
    if (e.key === 'Home' || e.key === 'Enter') { e.preventDefault(); setW(null, true); return; }
    if (!grow && !shrink) return;
    e.preventDefault(); setW(cur + (grow ? step : -step), true);
  });

  const apply = (): void => {
    toggleClass(el, 'collapsed', collapsed);
    pill.hidden = !collapsed;
    full.hidden = collapsed;
    document.documentElement.dataset[`c${id}`] = collapsed ? '1' : '0';
  };
  const setCollapsed = (c: boolean): void => { collapsed = c; ctx.prefs.collapse[id] = c; apply(); ctx.savePrefs(); relayoutHud(); };
  pill.addEventListener('click', () => setCollapsed(false));
  btn.addEventListener('click', () => setCollapsed(true));
  apply();
  return { el, body, extras, setCollapsed, toggle: () => setCollapsed(!collapsed) };
}
