// Resizing the panels, in both views from 1280px wide (three columns; below that there is nothing to resize): each
// side column's inner edge sets its width and its foot its height (Needs attention's own, or the right column's: its
// panels then end above the foot), the edges between Agents, Activity and File locks set Agents' and File locks'
// heights (Activity takes the rest), and the Tasks panel's foot sets its height (docked, with 3D on: a size of its
// own). Each edge is a separator (index.html; drawn in board.css): dragged, or focused and moved with the arrow keys
// (Shift: further), Home / End for the smallest / largest, Enter or a double-click for the default. The sizes are
// remembered per board in this browser (state.js: sizes) and kept inside what the window leaves room for (on load, on
// a resize, after a fold), the saved size itself kept for a larger window again. Nothing saved, nothing is set: the
// layout is the one the CSS gives.

import './office.js';
import { $, nsKey, sizes, sizesSave } from './state.js';
import { boardView } from './office.js';

const WIDE = matchMedia('(min-width: 1280px)');
const SIDE_MIN = 240; // the narrowest side column the layout has (at 1280px)
const SIDE_MAX = 520;
const CENTRE_MIN = 680; // the centre column (top bar, task columns) never narrower: four task columns keep room for a title
const LEFT_MIN = 120; // Needs attention: its title bar and a few lines
const TASKS_MIN = 160; // the Tasks panel: its title bar, the column headings and a card (the docked window's floor in office.css)
const ROOM_MIN = 120; // 3D: the room kept in view under the docked Tasks window
const STEP = 16, STEP_BIG = 64;

const office = () => boardView === 'office';
// Each separator: the axis it moves along, which way makes its panel larger, its panel (or column) and its saved size.
const H = {
  left: { axis: 'x', dir: 1, box: 'o-left', key: 'left' },
  lefth: { axis: 'y', dir: 1, box: 'o-left', key: 'leftH' },
  right: { axis: 'x', dir: -1, box: 'o-rcol', key: 'right' },
  rcolh: { axis: 'y', dir: 1, box: 'o-rcol', key: 'rcolH' },
  agents: { axis: 'y', dir: 1, box: 'o-right', key: 'agents' },
  locks: { axis: 'y', dir: -1, box: 'o-locks', key: 'locks' },
  tasks: { axis: 'y', dir: 1, box: 'o-tasks', key: 'tasks' },
};
const keyOf = (k) => (k === 'tasks' && office() ? 'tasks3d' : H[k].key);
const root = document.documentElement;
const num = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const saved = (key) => (num(sizes[key]) ? sizes[key] : null);
const clamp = (v, [lo, hi]) => Math.round(Math.min(hi, Math.max(lo, v)));
const tok = (n) => parseFloat(getComputedStyle(root).getPropertyValue(n)) || 12;
const rect = (e) => e.getBoundingClientRect();
const folded = (e) => e.classList.contains('folded');
const rcolPanels = () => ['o-right', 'o-act', 'o-locks'].map($).filter((p) => p.offsetHeight);
// A length the CSS gives (var(--dock), a min-height such as min(300px, 45%)) in px, measured in place.
function measure(css, inEl) {
  const p = document.createElement('div');
  p.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:0;left:0;width:0';
  p.style.height = css; inEl.append(p);
  const v = p.getBoundingClientRect().height; p.remove(); return v;
}
const dockDefault = () => measure('var(--dock)', document.body);
// The right column's panels, top to the last one's foot.
const stackH = () => { const col = $('o-rcol'), ps = rcolPanels(); return ps.length ? rect(ps.at(-1)).bottom - rect(col).top : 0; };

// The smallest and largest size a separator's panel can have now, next to the others as they are.
function range(k) {
  const g = tok('--gutter'), e = tok('--edge'), col = $('o-rcol');
  if (k === 'left' || k === 'right') {
    const room = rect($('main')).width - 2 * e - 2 * g - CENTRE_MIN;
    const other = rect(k === 'left' ? col : $('o-left')).width;
    return [SIDE_MIN, Math.max(SIDE_MIN, Math.floor(Math.min(SIDE_MAX, room - other)))];
  }
  if (k === 'lefth') return [LEFT_MIN, Math.max(LEFT_MIN, Math.floor(measure(getComputedStyle($('o-left')).maxHeight, $('main'))))];
  if (k === 'rcolh') {
    // Down to every open panel at its smallest (a folded one's title bar), up to the foot.
    const ps = rcolPanels();
    const lo = ps.reduce((s, p) => s + (folded(p) ? rect(p).height : measure(getComputedStyle(p).minHeight, col)), 0) + Math.max(0, ps.length - 1) * g;
    const foot = office() ? rect($('main')).bottom : innerHeight;
    const hi = foot - e - rect(col).top;
    return [Math.ceil(lo), Math.max(Math.ceil(lo), Math.floor(hi))];
  }
  if (k === 'agents' || k === 'locks') {
    // Activity keeps its minimum (or its title bar, folded) next to the other one as it is.
    const box = $(H[k].box), other = $(k === 'agents' ? 'o-locks' : 'o-right'), act = $('o-act');
    const lo = Math.ceil(measure(getComputedStyle(box).minHeight, col));
    const actMin = folded(act) ? rect(act).height : measure(getComputedStyle(act).minHeight, col);
    const hi = col.clientHeight - (rcolPanels().length - 1) * g - actMin - (other.offsetHeight ? rect(other).height : 0);
    return [lo, Math.max(lo, Math.floor(hi))];
  }
  // Tasks: with 3D on, leaving some of the room in view; with 3D off the page scrolls, so up to a few screens.
  if (!office()) return [TASKS_MIN, Math.max(TASKS_MIN, 3 * innerHeight)];
  const roomH = rect($('office-view')).bottom - e - rect($('o-tasks')).top;
  return [TASKS_MIN, Math.max(TASKS_MIN, Math.floor(roomH - ROOM_MIN))];
}
// The size a separator's panel has now.
function cur(k) {
  if (k === 'rcolh') return Math.round(stackH());
  const r = rect($(H[k].box)); return Math.round(H[k].axis === 'x' ? r.width : r.height);
}

const setW = (name, v) => (v == null ? root.style.removeProperty(name) : root.style.setProperty(name, `${v}px`));
function setH(el, v) {
  if (v == null) { el.classList.remove('sized'); el.style.removeProperty('--rsz-h'); return; }
  el.classList.add('sized'); el.style.setProperty('--rsz-h', `${v}px`);
}
// A panel folding or opening (glide, helpers.js) is mid-way: its column's heights wait until it has landed.
const gliding = () => document.getAnimations?.().some((a) => a.id === 'glide' && a.playState === 'running');

// Applies the saved sizes, each kept inside what the window and the other panels leave it.
function rsApply() {
  const can = WIDE.matches && $('main').offsetWidth > 0;
  // Widths: the left column's first (a window made narrower takes from the right one), each leaving the centre its room.
  let l = saved('left'), r = saved('right');
  if (can) {
    const room = rect($('main')).width - 2 * tok('--edge') - 2 * tok('--gutter') - CENTRE_MIN, def = dockDefault();
    const hi = (other) => Math.max(SIDE_MIN, Math.min(SIDE_MAX, room - other));
    if (l != null) l = clamp(l, [SIDE_MIN, hi(r != null ? SIDE_MIN : def)]);
    if (r != null) r = clamp(r, [SIDE_MIN, hi(l ?? def)]);
  }
  setW('--dock-l', l); setW('--dock-r', r);
  // Heights: Needs attention; the right column, then Agents and File locks in it; the Tasks panel. A folded panel keeps
  // its size for when it opens.
  if (can && gliding()) { rsSoon(); } else {
    const one = (k) => {
      const box = $(H[k].box); let v = saved(keyOf(k));
      if (v != null && can && box.offsetHeight && !folded(box) && !(k === 'tasks' && office() && box.classList.contains('max'))) v = clamp(v, range(k));
      setH(box, v);
    };
    for (const k of ['lefth', 'rcolh', 'agents', 'locks', 'tasks']) one(k);
    if (can) fitRcol();
  }
  if (can) { rsEnd(); for (const k of Object.keys(H)) aria(k); }
}
// Sized Agents and File locks are exactly their height (they don't shrink with the column): when the column has less
// room than they and Activity's minimum need, File locks gives way first, then Agents, each down to its own minimum
// (what is shown changes, not what is saved, so a taller window brings their sizes back).
function fitRcol() {
  const col = $('o-rcol'), act = $('o-act'), g = tok('--gutter');
  const open = (id) => { const p = $(id); return p.offsetHeight && !folded(p) ? p : null; };
  const sized = ['o-locks', 'o-right'].map(open).filter((p) => p?.classList.contains('sized'));
  if (!sized.length) return;
  const ps = rcolPanels();
  const room = col.clientHeight - Math.max(0, ps.length - 1) * g;
  const actNeed = folded(act) ? rect(act).height : measure(getComputedStyle(act).minHeight, col);
  const others = ps.filter((p) => p !== act && !sized.includes(p)).reduce((s, p) => s + rect(p).height, 0);
  let over = sized.reduce((s, p) => s + parseFloat(p.style.getPropertyValue('--rsz-h')), 0) + actNeed + others - room;
  for (const p of sized) {
    if (over <= 0) break;
    const h = parseFloat(p.style.getPropertyValue('--rsz-h')), min = measure(getComputedStyle(p).minHeight, col);
    const to = Math.max(min, h - over); over -= h - to; p.style.setProperty('--rsz-h', `${Math.floor(to)}px`);
  }
}
let req = 0;
function rsSoon() { if (!req) req = requestAnimationFrame(() => { req = 0; rsApply(); }); }
// The right column's inner edge and foot reach as far down as its panels do.
let endReq = 0;
function rsEnd() {
  const col = $('o-rcol'), ps = rcolPanels();
  const end = ps.length ? `${Math.max(0, Math.round(rect(col).bottom - rect(ps.at(-1)).bottom))}px` : '0px';
  if (col.style.getPropertyValue('--rsz-end') !== end) col.style.setProperty('--rsz-end', end);
}
if ('ResizeObserver' in window) {
  // Any panel changing size (the page laid out, a panel opened or folded, the window resized): the right column's foot
  // follows its panels, and every separator shown has its value and range (one shown late still gets them).
  const ro = new ResizeObserver(() => { if (!endReq) endReq = requestAnimationFrame(() => { endReq = 0; if (WIDE.matches) { rsEnd(); for (const k of Object.keys(H)) aria(k); } }); });
  for (const id of ['main', 'o-left', 'o-tasks', 'o-rcol', 'o-right', 'o-act', 'o-locks']) ro.observe($(id));
}
function aria(k) {
  const el = $(`rsz-${k}`); if (!el?.offsetWidth) return;
  const [lo, hi] = range(k), now = cur(k);
  el.setAttribute('aria-valuemin', String(lo)); el.setAttribute('aria-valuemax', String(hi)); el.setAttribute('aria-valuenow', String(now));
  el.setAttribute('aria-valuetext', `${now} pixels ${H[k].axis === 'x' ? 'wide' : 'tall'}`);
}

// What else follows a size (the 3D room's framing: panels.js).
let changed = () => {};
function rsOnChange(fn) { changed = fn; }
function set(k, v, save = true) {
  // An edge next to Activity trades height between Activity and that panel only: the panel on Activity's other side
  // (open, with no size of its own yet) is held at the height it has now.
  if (k === 'agents' || k === 'locks') {
    const o = k === 'agents' ? 'locks' : 'agents', ob = $(H[o].box);
    if (sizes[keyOf(o)] == null && ob.offsetHeight && !folded(ob)) sizes[keyOf(o)] = cur(o);
  }
  sizes[keyOf(k)] = clamp(v, range(k)); rsApply(); if (save) sizesSave(); changed();
}
function reset(k) { delete sizes[keyOf(k)]; sizesSave(); rsApply(); changed(); }
// The docked 3D Tasks window's height when one is set (panels.js oFrame frames the room under it).
function rsTasksH() { const t = $('o-tasks'); return office() && t.classList.contains('sized') ? parseFloat(t.style.getPropertyValue('--rsz-h')) || 0 : 0; }

// Dragging: the pointer is captured, so the drag goes on outside the separator (over the room, the page).
let drag = null;
document.addEventListener('pointerdown', (ev) => {
  const el = ev.target.closest?.('.rsz'); if (!el || ev.button !== 0) return;
  const k = el.dataset.rsz;
  try { el.setPointerCapture(ev.pointerId); } catch {}
  drag = { k, el, id: ev.pointerId, x: ev.clientX, y: ev.clientY, v: cur(k), was: sizes[keyOf(k)], moved: false };
  el.classList.add('on'); root.classList.add(`rsz-drag-${H[k].axis}`);
});
document.addEventListener('pointermove', (ev) => {
  if (!drag || ev.pointerId !== drag.id) return;
  const d = H[drag.k].axis === 'x' ? ev.clientX - drag.x : ev.clientY - drag.y;
  if (!drag.moved && Math.abs(d) < 2) return;
  drag.moved = true; set(drag.k, drag.v + H[drag.k].dir * d, false);
});
function dragEnd(cancel = false) {
  const { el, k, was, moved } = drag; drag = null;
  el.classList.remove('on'); root.classList.remove('rsz-drag-x', 'rsz-drag-y');
  if (!moved) return;
  if (cancel) { if (was === undefined) delete sizes[keyOf(k)]; else sizes[keyOf(k)] = was; rsApply(); changed(); }
  sizesSave();
}
for (const t of ['pointerup', 'pointercancel']) document.addEventListener(t, (ev) => { if (drag && ev.pointerId === drag.id) dragEnd(); });
document.addEventListener('dblclick', (ev) => { const el = ev.target.closest?.('.rsz'); if (el) { ev.preventDefault(); reset(el.dataset.rsz); } });
document.addEventListener('keydown', (ev) => {
  const el = ev.target.closest?.('.rsz'); if (!el || ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const k = el.dataset.rsz, h = H[k], step = ev.shiftKey ? STEP_BIG : STEP;
  const by = (h.axis === 'x' ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: -1, ArrowDown: 1 })[ev.key];
  if (by) set(k, cur(k) + h.dir * by * step);
  else if (ev.key === 'Home') set(k, range(k)[0]);
  else if (ev.key === 'End') set(k, range(k)[1]);
  else if (ev.key === 'Enter') reset(k);
  else if (ev.key === 'Escape' && drag) dragEnd(true);
  else return;
  ev.preventDefault();
});

// A window resized (before it is drawn) or crossing 1280px, and another tab of this board resizing a panel.
addEventListener('resize', rsApply);
WIDE.addEventListener?.('change', rsApply);
addEventListener('storage', (e) => {
  if (e.key !== nsKey('board-sizes')) return;
  let v = {}; try { v = JSON.parse(e.newValue || '{}') || {}; } catch {}
  for (const k of Object.keys(sizes)) delete sizes[k];
  if (v && typeof v === 'object') Object.assign(sizes, v);
  rsApply(); changed();
});
rsApply();

export { rsApply, rsOnChange, rsSoon, rsTasksH };
