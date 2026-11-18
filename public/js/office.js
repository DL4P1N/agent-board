// The 3D office: on or off. Loads the scene (public/office/embed.js) only while 3D is on, the header's 3D switch,
// the scene's palette per theme (scenePalette), and the state it draws.

import './theme.js';
import { $, BASE, qs, reduceMotion, state, ui } from './state.js';
import { announce, toast } from './helpers.js';
import { stays } from './derived.js';
import { render } from './render.js';
import { officeState } from './agents.js';
import { setThemePref, syncThemeButtons } from './theme.js';
import { oApply, oExpand, officeMount, oFold, oFrame, oMax, oSlide, oTasksOff, pickAgent } from './panels.js';

// ---------- the 3D office: on or off ----------
// With 3D on (the default wherever it can run) the office is always live behind the page: the panels float over it
// as glass, and the task board is the Tasks window: expanded over the room, docked at the foot (the room above it), or
// folded to its title bar. With 3D off (the header switch; phones; no WebGL) it's the plain board: no office code and
// no GPU. The office (three.js and the scene: public/office/embed.js, built from office/src/live/embed.ts by
// `npm run build:present`) draws the same /api/state this page loads: it fetches nothing itself.
// On / off is saved in this browser for every board ('agent-board-3d'); ?view=office (3D on, the board docked) and
// ?view=board (3D off) set it for this visit only.
const office = { mod: null, loading: null, failed: false, dockOnce: false };
let boardView = 'board'; // 'office' while 3D is on
const viewParam = ['office', 'board'].includes(qs.get('view')) ? qs.get('view') : '';
const D3_KEY = 'agent-board-3d';
const d3Pref = () => { try { return localStorage.getItem(D3_KEY) !== 'off'; } catch { return true; } };
const phoneMq = matchMedia('(max-width: 760px)');
const officeAllowed = () => !office.failed && !phoneMq.matches && 'WebGLRenderingContext' in window;
// Probed before the office loads, so a browser without WebGL never downloads it.
function webglWorks() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch { return false; }
}
// The palette the page shows now (Auto resolved), which the 3D room uses too.
const scenePalette = () => { const t = window.themeOf(document.documentElement.getAttribute('data-theme')); return t !== 'auto' ? t : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; };
function noOffice(msg) {
  office.failed = true;
  setBoardView('board', { save: false, quiet: true });
  toast(msg);
}
function renderViewSwitch() {
  const b = $('o3d'); b.hidden = !officeAllowed();
  b.setAttribute('aria-pressed', String(boardView === 'office'));
  b.title = boardView === 'office' ? 'The live 3D office is on, behind the board. Turn it off to save power (the plain board).' : 'Turn on the live 3D office behind the board';
}
function setBoardView(v, { save = true, quiet = false } = {}) {
  if (v === 'office' && !officeAllowed()) v = 'board';
  if (v === 'office' && !office.mod && !webglWorks()) return noOffice("This browser can't show the 3D office (WebGL is off or not supported). Showing the plain board.");
  const changed = v !== boardView;
  if (changed) ui.oSetup = false;
  boardView = v;
  document.documentElement.dataset.boardView = v;
  if (save) { try { localStorage.setItem(D3_KEY, v === 'office' ? 'on' : 'off'); } catch {} }
  if (qs.has('view')) { try { const u = new URL(location.href); u.searchParams.set('view', v); history.replaceState(null, '', u); } catch {} }
  renderViewSwitch();
  officeMount(v === 'office');
  if (state.loaded) render(); else oApply();
  if (v === 'office') showOffice();
  else if (office.mod) { office.mod.destroy(); office.mod = null; } // off: nothing left on the GPU
  if (changed && !quiet) announce(v === 'office' ? '3D office on' : '3D office off: the plain board');
}
// Anything that leads to the task columns: with 3D on, the board comes up over the room (unfolded, expanded).
function needBoard() { if (boardView !== 'office') return; if (oTasksOff()) oFold('tasks', false); if (!oMax()) oExpand(true); }
function showOffice() {
  if (office.mod) { office.mod.setActive(true); oRate(); if (state) office.mod.update(officeState()); office.mod.select(ui.picked || null); return; }
  if (office.loading) return;
  const view = $('office-view'); view.classList.add('loading'); view.setAttribute('aria-busy', 'true');
  office.loading = import(BASE + '/office/embed.js').then((m) => {
    if (boardView !== 'office') return; // turned off while it loaded
    const o = m.mount($('office-scene'), { theme: scenePalette(), reducedMotion: reduceMotion(), onPick: pickAgent });
    if (!o.usable) { o.destroy(); return noOffice("The 3D office couldn't start WebGL in this browser. Showing the plain board."); }
    office.mod = o;
    if (state) o.update(state);
    o.select(ui.picked || null);
    oRate(); oFrame();
    // The room fades in once its first frame is drawn (it stays hidden while .loading): no empty room first.
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }).catch((e) => {
    console.warn('3D office did not load', e);
    if (boardView === 'office') setBoardView('board', { save: false, quiet: true });
    toast("The 3D office didn't load (offline?). Showing the plain board.");
  }).finally(() => { office.loading = null; view.classList.remove('loading'); view.removeAttribute('aria-busy'); });
}
// While the board is expanded over it, the room keeps moving behind the glass at a few frames a second; docked or
// folded, at its full (calm) rate. A hidden tab draws nothing (the browser stops the frames).
function oRate() { office.fps = !office.mod ? 0 : oSlide ? 1 : oMax() && !oTasksOff() ? 4 : 30; office.mod?.setFps?.(office.fps); }
// A copy of what the office draws, for tests and the console (null until it has loaded).
Object.defineProperty(window, '__officeState', { get: () => office.mod?.snapshot() ?? null, configurable: true });
// Another tab (the board, the presenter, the Boards page) changed the theme, or the OS switched light / dark.
addEventListener('storage', (e) => { if (e.key !== 'board-theme') return; setThemePref(window.applyTheme(e.newValue)); syncThemeButtons(); office.mod?.setTheme(scenePalette()); });
// Keep the MediaQueryList: a temporary one can be garbage-collected and take its listener with it.
const darkMq = matchMedia('(prefers-color-scheme: dark)');
darkMq.addEventListener?.('change', () => office.mod?.setTheme(scenePalette()));
phoneMq.addEventListener?.('change', () => {
  if (phoneMq.matches && boardView === 'office') setBoardView('board', { save: false, quiet: true });
  else if (!phoneMq.matches && boardView !== 'office' && d3Pref() && viewParam !== 'board') setBoardView('office', { save: false, quiet: true });
  renderViewSwitch();
});
$('o3d').addEventListener('click', () => setBoardView(boardView === 'office' ? 'board' : 'office'));
// With 3D on, What to do now's links to the task columns bring the board up first, then do what they say.
document.addEventListener('click', (ev) => {
  if (boardView !== 'office') return;
  const el = ev.target.closest?.('[data-go]');
  if (!el || stays(el.dataset.go)) return;
  needBoard();
}, true);

export { boardView, d3Pref, darkMq, needBoard, office, officeAllowed, oRate, scenePalette, setBoardView, viewParam,
  webglWorks };
