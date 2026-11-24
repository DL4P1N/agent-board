// The entry point: <script type="module" src="js/boot.js"> in index.html. The page's modules, in the order they run
// (each imports the one before it first, so the order is the one the page's old inline script had):
// state, helpers, data, derived, render, needs, topbar, setup, agents, tasks, activity, actions, task-dialog, theme,
// office, panels, palette, boot.

import './palette.js';
import { $, HUES, me, nsKey, oSave, oUi, pending, qs, SLUG, state, store, token, ui } from './state.js';
import { ago, clock, fullTime, hue, knownPeople, nameHash, taskById, toast, when } from './helpers.js';
import { connect, es, esOpen, load, onEvent, onPaint, onRequest, onSignIn, onState, paint, recheck, retrying, setConn, setLoad,
  showGate, unavailable, unavailableStatus } from './data.js';
import { agentsLine, outlook, setupInfo, teamCapacity } from './derived.js';
import { render, renderQuiet } from './render.js';
import { nowSeen, setNowSeen, syncNeeds } from './needs.js';
import { noteRequest, setTimeKey, tickTime, timeKey } from './topbar.js';
import { defaultDeadline, fetchExport, inviteText, localInput } from './setup.js';
import { moveTask } from './tasks.js';
import { ACT_GAP, feedOnEvent, feedOnState, setActGap } from './activity.js';
import { applyKeys, goStep, openHelp } from './actions.js';
import { checkOverwrites, openTask } from './task-dialog.js';
import { setTheme } from './theme.js';
import { d3Pref, darkMq, office, officeAllowed, scenePalette, setBoardView, viewParam, webglWorks } from './office.js';
import { oExpand, pickAgent } from './panels.js';

// What the page does with the data data.js fetches (it imports no UI module). In this order: the feed keeps its earlier
// pages before the task dialog compares the new state with what you saved.
onRequest(noteRequest);
onState(feedOnState);
onState(checkOverwrites);
onEvent(feedOnEvent);
onPaint((quiet) => (quiet ? renderQuiet() : render()));

let started = false;
async function start() {
  // A link's ?token= and ?name= (read in state.js) leave the address bar at once, also when the sign-in form shows (the token stays in this tab until sign-in, state.js).
  if (qs.get('token') || qs.get('name')) history.replaceState(null, '', location.pathname);
  if (!token || !me) return showGate();
  store.set('board-token', token); pending.set('');
  $('gate').hidden = true; $('app').hidden = false;
  // Which board this is (several can share a server), and the host's way back to the list of boards.
  if (SLUG) { const b = $('bname'); b.hidden = false; b.textContent = SLUG; b.title = `Board "${SLUG}" on this server`; }
  // Only a non-secret "this browser is the host's" flag (set by the Boards page); the admin token itself never leaves that page.
  $('boards-link').hidden = !(() => { try { return localStorage.getItem('board-is-host') === '1'; } catch { return false; } })();
  applyKeys();
  // Before the switch was 3D on / off there were two views, Board and 3D office, remembered per board: the 3D office
  // one means the board docked (Board, the default state: expanded). Either way 3D is on.
  const oldView = store.get('board-view-mode');
  if (oldView) { if (oldView === 'office' && typeof oUi.max !== 'boolean') { oUi.max = false; oSave(); } try { localStorage.removeItem(nsKey('board-view-mode')); } catch {} }
  if (viewParam === 'office') office.dockOnce = true;
  // 3D on by default, but quietly the plain board where WebGL can't run (no note: nobody asked for 3D).
  if (!viewParam && d3Pref() && officeAllowed() && !webglWorks()) office.failed = true;
  setBoardView(viewParam || (d3Pref() ? 'office' : 'board'), { save: false, quiet: true });
  await load(); if (!unavailable && !$('app').hidden) connect();
  if (!started) {
    started = true;
    // Keep timers fresh (an agent going offline emits no event), and notice a live stream that closed for good (unless
    // a retry is already waiting). A tab in the background catches up when it is shown.
    setInterval(() => {
      if (unavailable || $('app').hidden || document.hidden) return;
      if (es && es.readyState === EventSource.CLOSED) return retrying() ? undefined : recheck();
      return esOpen ? load() : paint();
    }, 20000);
    setInterval(tickTime, 30000);
  }
}

// What tests/ui reach on window by name (in page.evaluate), as they could while the page was one inline script. Each
// is read live from its module; the four a test sets (ACT_GAP, load, nowSeen, timeKey) write through to it.
const onWindow = {
  $: () => $, HUES: () => HUES, state: () => state, ui: () => ui, office: () => office, darkMq: () => darkMq,
  agentsLine: () => agentsLine, ago: () => ago, clock: () => clock, defaultDeadline: () => defaultDeadline,
  fetchExport: () => fetchExport, fullTime: () => fullTime, goStep: () => goStep, hue: () => hue,
  inviteText: () => inviteText, knownPeople: () => knownPeople, localInput: () => localInput, moveTask: () => moveTask,
  nameHash: () => nameHash, oExpand: () => oExpand, openHelp: () => openHelp, openTask: () => openTask,
  outlook: () => outlook, pickAgent: () => pickAgent, render: () => render, scenePalette: () => scenePalette,
  setConn: () => setConn, setTheme: () => setTheme, setupInfo: () => setupInfo, syncNeeds: () => syncNeeds,
  taskById: () => taskById, teamCapacity: () => teamCapacity, tickTime: () => tickTime, toast: () => toast,
  unavailableStatus: () => unavailableStatus, when: () => when,
};
const onWindowRw = { ACT_GAP: [() => ACT_GAP, setActGap], load: [() => load, setLoad], nowSeen: [() => nowSeen, setNowSeen], timeKey: [() => timeKey, setTimeKey] };
for (const [k, get] of Object.entries(onWindow)) Object.defineProperty(window, k, { get, configurable: true });
for (const [k, [get, set]] of Object.entries(onWindowRw)) Object.defineProperty(window, k, { get, set, configurable: true });

onSignIn(start);
start();
