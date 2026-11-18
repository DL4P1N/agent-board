// The panels, the same in both views: folding them to their title bars, the Tasks window's states in 3D (expanded,
// docked, folded, maximised: oExpand, oApply, oFrame), the top bar's popovers, the docks, and the 3D room's agent picking.

import './office.js';
import { $, oSave, oUi, smooth, state, store, ui } from './state.js';
import { agentRoot, esc, glide, nameTag, patch, short } from './helpers.js';
import { blockedSplit, openQuestions, setupInfo, setupShown, timeNow } from './derived.js';
import { render } from './render.js';
import { syncNeeds } from './needs.js';
import { renderTopbar } from './topbar.js';
import { defaultDeadline, localInput, plannerBox, stepIntegrator } from './setup.js';
import { blockedNote, taskShown, tv } from './tasks.js';
import { ac, settingsText } from './activity.js';
import { themePop } from './theme.js';
import { boardView, office, oRate } from './office.js';

// ---------- the panels, the same in both views ----------
// Needs attention (left), Agents, Activity and File locks (right), the top bar with the goal, the demo time under the header
// clock. One fold state for both views (oUi), and one way to fold: every panel (the 3D Tasks window too) folds to its
// title bar, which opens it again (its button, or a click anywhere on it). Folding moves (glide, in helpers.js).
const oHome = {};
// The plain board's tasks move into the Tasks window while 3D is on, and back: its task bar (Tasks, search, Show,
// Columns / Table) becomes the window's title bar, its columns (or table) the window's body. One task board, the same
// elements: the search text, the filter, scroll and focus carry over when 3D goes on or off.
const TASK_PARTS = ['board-empty', 'board', 'tasktable'];
function officeMount(on) {
  const tb = $('taskbar'), parts = TASK_PARTS.map($);
  if (on) {
    if (!oHome.tb) { oHome.tb = document.createComment('taskbar'); tb.before(oHome.tb); oHome.body = document.createComment('tasks'); parts[0].before(oHome.body); }
    if (!$('o-tasks-head').contains(tb)) $('o-tasks-head').prepend(tb);
    if (!$('o-tasks-b').contains(parts[0])) $('o-tasks-b').append(...parts);
  } else if (oHome.tb) { if (oHome.tb.nextSibling !== tb) oHome.tb.after(tb); if (oHome.body.nextSibling !== parts[0]) oHome.body.after(...parts); }
}
// The task board starts open and docked (the room in view below it), and turning 3D on docks it; File locks start
// folded. Folding, expanding or docking one yourself is remembered. ?view=office docks it for that visit.
const oTasksOff = () => (typeof oUi.tasks === 'boolean' ? oUi.tasks : false);
const oMax = () => (office.dockOnce ? false : typeof oUi.max === 'boolean' ? oUi.max : false);
// Panels folding or the board sliding: the room holds still meanwhile (oRate) and its camera waits (oFrame), then eases
// to the new framing once they have landed, so the panels move smoothly.
let oMoving = 0;
function oMotion(run) {
  oMoving++; oRate();
  return run().then(() => { if (--oMoving) return; oRate(); oFrame(); });
}
// Expanded <-> docked: the board's top stays under the top bar and its bottom edge slides between the foot and the
// docked window's (its glass covering the room as it goes down, or uncovering it going up); one element, the columns
// inside it the same. A layout move (not a clip), so the window keeps its bottom edge as it goes. Instant with reduced
// motion or when it's folded.
const O_EXPAND = 'Expand Tasks over the room', O_DOCK = 'Dock Tasks to show the room';
const oMaxLabel = () => (oMax() ? O_DOCK : O_EXPAND);
function oExpand(on) {
  const tw = $('o-tasks'), shown = boardView === 'office' && !oTasksOff() && !!tw.offsetHeight;
  office.dockOnce = false;
  const go = () => { oUi.max = on; oSave(); oApply(); office.mod?.resize(); };
  if (!shown) return go();
  oMotion(() => glide(go, { size: [tw] }));
}
const oLocksOff = () => (typeof oUi.locks === 'boolean' ? oUi.locks : store.get('board-locks') !== 'open');
const oOff = (w) => (w === 'tasks' ? oTasksOff() : w === 'locks' ? oLocksOff() : w === 'act' ? !!oUi.actOff : !!oUi[w]);
const O_PANELS = [['left', 'Needs attention'], ['right', 'Agents'], ['act', 'Activity'], ['locks', 'File locks'], ['tasks', 'Tasks']];
const O_BOX = { left: 'o-left', right: 'o-right', act: 'o-act', locks: 'o-locks', tasks: 'o-tasks' };
// The Tasks window's maximise / restore icons (corners out, corners in).
const O_MAX = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>', O_RESTORE = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2v4H2M10 2v4h4M14 10h-4v4M2 10h4v4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
// A top bar popover sits under its chip, inside the window; where there isn't room under it (low on a phone's screen),
// it opens over the chip instead.
function placePop(id, chipId, wDef = 460) {
  const p = $(id); const c = $(chipId); const r = c?.offsetWidth ? c.getBoundingClientRect() : null; const w = p.offsetWidth || wDef;
  p.style.left = `${Math.max(8, Math.min((r ? r.left : 8), innerWidth - w - 8))}px`;
  if (!r) return;
  const h = p.offsetHeight; const below = r.bottom + 8 + h <= innerHeight - 8;
  p.style.top = `${Math.round(Math.max(8, below ? r.bottom + 8 : Math.min(r.top - 8 - h, innerHeight - h - 8)))}px`;
}
function oApply() {
  const tOff = oTasksOff(), max = oMax();
  $('o-tasks').classList.toggle('max', max && !tOff);
  $('o-tasks-max').setAttribute('aria-pressed', String(max)); $('o-tasks-max').setAttribute('aria-label', oMaxLabel()); $('o-tasks-max').title = oMaxLabel();
  $('o-tasks-max').innerHTML = max ? O_RESTORE : O_MAX;
  oRate();
  // Every panel folds to its title bar; its button says what it does, with the panel's own name.
  for (const [w, name] of O_PANELS) {
    const box = $(O_BOX[w]), b = box.querySelector('[data-o-fold]'), off = oOff(w), l = `${off ? 'Open' : 'Fold'} ${name}`;
    box.classList.toggle('folded', off); b.setAttribute('aria-expanded', String(!off)); b.title = l; b.setAttribute('aria-label', l);
  }
  $('o-goal').hidden = !ui.oGoal; $('goal-btn')?.setAttribute('aria-expanded', String(!!ui.oGoal));
  $('o-dl').hidden = !ui.oDl; $('clock').setAttribute('aria-expanded', String(!!ui.oDl));
  $('o-merge').hidden = !ui.oMerge; $('merge-btn')?.setAttribute('aria-expanded', String(!!ui.oMerge));
  $('o-plan').hidden = !ui.oPlan; $('plan-btn')?.setAttribute('aria-expanded', String(!!ui.oPlan));
  $('o-roles').hidden = !ui.oRoles; $('roles-btn')?.setAttribute('aria-expanded', String(!!ui.oRoles));
  if (ui.oRoles) placePop('o-roles', 'roles-btn');
  if (ui.oPlan) placePop('o-plan', 'plan-btn');
  if (ui.oMerge) placePop('o-merge', 'merge-btn');
  if (ui.oDl) placePop('o-dl', 'clock', 400);
  syncNeeds();
  if (boardView === 'office') $('main').style.setProperty('--tb-h', $('topbar').offsetHeight + 'px');
  oFrame();
}
// The room is framed in the part of the view the docks, the top bar and the Tasks window (or its title bar, under the
// top bar) leave free: below them, between the side columns (the camera is told the insets).
function oFrame() {
  if (!office.mod?.setInsets || boardView !== 'office' || oMoving) return;
  const v = $('office-view').getBoundingClientRect(); if (!v.width || !v.height) return;
  // A side column counts while one of its panels is open (folded title bars at its top leave the room free).
  const R = (...ids) => { const e = ids.map($).find((x) => x && !x.hidden && x.offsetWidth && !x.classList.contains('folded')); return e ? e.getBoundingClientRect() : null; };
  const l = R('o-left'), r = R('o-right', 'o-act', 'o-locks'), t = $('o-tasks').offsetWidth ? $('o-tasks').getBoundingClientRect() : null, top = $('topbar').getBoundingClientRect();
  // Expanded, the board covers the room: it's framed as if docked (the window's CSS height under the top bar), so
  // sliding the board down or up doesn't move the camera.
  const dockBottom = () => t.top + Math.max(Math.min(Math.max(176, 0.27 * v.height), 270), Math.min(innerHeight * 0.5, 360));
  const covered = t && $('o-tasks').classList.contains('max');
  office.mod.setInsets({
    left: l ? (l.right - v.left) / v.width : 0,
    right: r ? (v.right - r.left) / v.width : 0,
    top: Math.max(0, ((t ? (covered ? dockBottom() : t.bottom) : top.bottom) - v.top) / v.height),
    bottom: 0,
  });
}
// Fold or open a panel: it rolls up to its title bar or down from it while the other panels of its column give or take
// the room in step (glide), in both views; the 3D camera waits for it to land.
function oFold(which, folded = !oOff(which)) {
  const box = $(O_BOX[which]), body = box.querySelector(':scope > .o-body'), btn = box.querySelector('[data-o-fold]');
  const col = [...box.parentElement.children].filter((e) => e.classList.contains('o-panel'));
  const from = document.activeElement;
  oMotion(() => glide(() => {
    oUi[which === 'act' ? 'actOff' : which] = folded; oSave(); renderDocks();
    if (boardView === 'office') { renderOffice(); office.mod?.resize?.(); }
  }, { size: col, pin: [box, body] }));
  // Focus stays on the control you used; from inside a body that folds away, it moves to the panel's fold button.
  if (folded && from && body.contains(from)) btn.focus({ preventScroll: true });
  if (which === 'act' && !folded) { const f = $('feed'); f.scrollTop = f.scrollHeight; }
}
// Open a folded panel (a link led to it).
function oShow(which) { if (oOff(which)) oFold(which, false); }
// Show Activity (unfolded), at its latest event; focus the feed.
function oAct(focus = true) {
  oShow('act');
  const f = $('feed'); f.scrollTop = f.scrollHeight; if (focus) f.focus({ preventScroll: true });
}
// The goal, the demo time, the planner and who merges open in place under their chips in the top bar (one at a time), and each is
// edited there. A click elsewhere or Esc closes them.
function oGoal(open, { edit = false } = {}) {
  ui.oGoal = open; ui.oGoalEdit = open && edit; ui.goalErr = ''; if (open) { ui.oDl = false; ui.oMerge = false; ui.oPlan = false; ui.oRoles = false; setupAway(); if (ui.themeOpen) themePop(false, false); }
  $('o-goal-b')._html = undefined; renderDocks(); $('tb-a')._html = undefined; $('tb-b')._html = undefined; renderTopbar(setupInfo());
  if (!open) return $('goal-btn')?.focus({ preventScroll: true });
  const ta = $('o-goal-in');
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } else $('o-goal').querySelector('.o-ib').focus({ preventScroll: true });
}
function oDl(open) {
  ui.oDl = open; ui.dlErr = ''; if (open) { ui.oGoal = false; ui.oMerge = false; ui.oPlan = false; ui.oRoles = false; setupAway(); if (ui.themeOpen) themePop(false, false); }
  $('o-dl-b').innerHTML = ''; $('o-dl-b')._html = undefined; renderDocks();
  if (open) $('o-dl-in')?.focus(); else $('clock').focus({ preventScroll: true });
}
function oSetup(open, focus = true) {
  store.set('board-setup', open ? 'open' : 'closed'); ui.forceSetup = false;
  if (open) { ui.oGoal = false; ui.oDl = false; ui.oMerge = false; ui.oPlan = false; ui.oRoles = false; if (ui.themeOpen) themePop(false, false); }
  render();
  if (focus) setupFocus(open);
}
// With 3D on, Setup is a popover too: another one opening (or a click elsewhere) closes it.
function setupAway() { if (boardView === 'office' && setupShown()) { store.set('board-setup', 'closed'); ui.forceSetup = false; } }
// Setup, in both views: opened, focus moves into it (its current step) and a phone scrolls it into view; closed, focus
// goes back to the Setup chip.
function setupFocus(open) {
  const el = $('setup');
  if (!open || el.hidden) return document.querySelector('[data-fk="s-open"]')?.focus({ preventScroll: true });
  el.querySelector('.o-body').scrollTop = 0;
  (el.querySelector('.step.cur .step-h') || el.querySelector('.step-h'))?.focus({ preventScroll: true });
  const r = el.getBoundingClientRect();
  if (boardView !== 'office' && (r.top < 0 || r.top > innerHeight * 0.6)) el.scrollIntoView({ behavior: smooth(), block: 'start' });
}
function oMerge(open) {
  ui.oMerge = open; if (open) { ui.oGoal = false; ui.oDl = false; ui.oPlan = false; ui.oRoles = false; setupAway(); if (ui.themeOpen) themePop(false, false); }
  $('o-merge-b')._html = undefined; renderDocks(); $('tb-b')._html = undefined; renderTopbar(setupInfo());
  if (open) $('o-integ-sel')?.focus(); else $('merge-btn')?.focus({ preventScroll: true });
}
function oPlan(open) {
  ui.oPlan = open; if (open) { ui.oGoal = false; ui.oDl = false; ui.oMerge = false; ui.oRoles = false; setupAway(); if (ui.themeOpen) themePop(false, false); }
  $('o-plan-b')._html = undefined; renderDocks(); $('tb-b')._html = undefined; renderTopbar(setupInfo());
  if (open) $('o-plan-sel')?.focus(); else $('plan-btn')?.focus({ preventScroll: true });
}
// Roles (below 1600px): the planner and who merges, both chosen in one popover.
function oRoles(open) {
  ui.oRoles = open; if (open) { ui.oGoal = false; ui.oDl = false; ui.oMerge = false; ui.oPlan = false; setupAway(); if (ui.themeOpen) themePop(false, false); }
  $('o-roles-b')._html = undefined; renderDocks(); $('tb-b')._html = undefined; renderTopbar(setupInfo());
  if (open) $('r-plan-sel')?.focus(); else $('roles-btn')?.focus({ preventScroll: true });
}
// Crossing 1600px swaps Roles and the two chips: a popover open under one of them closes.
matchMedia('(max-width: 1599px)').addEventListener?.('change', () => {
  if (!ui.oRoles && !ui.oPlan && !ui.oMerge) return;
  ui.oRoles = false; ui.oPlan = false; ui.oMerge = false; renderDocks(); renderTopbar(setupInfo());
});
document.addEventListener('click', (ev) => {
  if (ui.oGoal && !ev.target.closest?.('#o-goal, #goal-btn') && ev.target.isConnected) { ui.oGoal = false; renderDocks(); }
  if (ui.oDl && !ev.target.closest?.('#o-dl, #clock, [data-act="clock"]') && ev.target.isConnected) { ui.oDl = false; renderDocks(); }
  if (ui.oMerge && !ev.target.closest?.('#o-merge, #merge-btn') && ev.target.isConnected) { ui.oMerge = false; renderDocks(); renderTopbar(setupInfo()); }
  if (ui.oPlan && !ev.target.closest?.('#o-plan, #plan-btn') && ev.target.isConnected) { ui.oPlan = false; renderDocks(); renderTopbar(setupInfo()); }
  if (ui.oRoles && !ev.target.closest?.('#o-roles, #roles-btn') && ev.target.isConnected) { ui.oRoles = false; renderDocks(); renderTopbar(setupInfo()); }
  if (boardView === 'office' && setupShown() && ev.target.isConnected && !ev.target.closest?.('#setup, [data-fk="s-open"], [data-go^="step-"], [data-act="invite"], dialog, #toasts')) { setupAway(); render(); }
});
// A popover closes once focus leaves it and its chip (Tab, or a click on something that takes focus), like the theme
// chooser. Tab past a popover's last control goes on to the chip after its own; Shift+Tab from its first, back to its chip.
const POPS = { oGoal: ['o-goal', 'goal-btn'], oDl: ['o-dl', 'clock'], oMerge: ['o-merge', 'merge-btn'], oPlan: ['o-plan', 'plan-btn'], oRoles: ['o-roles', 'roles-btn'] };
function popAway(k) { ui[k] = false; if (k === 'oGoal') ui.oGoalEdit = false; renderDocks(); renderTopbar(setupInfo()); }
document.addEventListener('focusout', (ev) => {
  // Onto another chip, its own click does the rest (a chip redrawn under the pointer would lose that click).
  const to = ev.relatedTarget; if (!to || to.closest?.('#topbar, dialog')) return;
  for (const [k, [pop, chip]] of Object.entries(POPS)) if (ui[k] && ev.target.closest?.(`#${pop}, #${chip}`) && !to.closest?.('#' + pop)) popAway(k);
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Tab' || ev.defaultPrevented) return;
  const pop = ev.target.closest?.('.o-pop'); const k = pop && Object.keys(POPS).find((x) => POPS[x][0] === pop.id); if (!k) return;
  const fs = [...pop.querySelectorAll('button, input, select, textarea, a[href]')].filter((e) => !e.disabled && e.offsetWidth);
  if (ev.target !== (ev.shiftKey ? fs[0] : fs[fs.length - 1])) return;
  const chips = [...$('topbar').querySelectorAll('button')].filter((b) => b.offsetWidth);
  const at = chips.indexOf($(POPS[k][1])); const fk = chips[ev.shiftKey ? at : at + 1]?.dataset.fk; if (!fk) return;
  ev.preventDefault(); popAway(k); document.querySelector(`#topbar [data-fk="${fk}"]`)?.focus();
});
// The demo time form for its popover: the board's own (step 2 of Setup), with ids of its own.
function oDlForm() {
  const S = state.settings; const t = timeNow();
  const fm = S.freeze_minutes === '' || S.freeze_minutes == null ? '60' : S.freeze_minutes;
  return `<form class="o-form" data-dlform="o" novalidate>
      <div class="o-fr"><input id="o-dl-in" type="datetime-local" aria-label="Demo time" data-keep="o-dl" value="${esc(localInput(t.deadline || defaultDeadline()))}" step="60" aria-describedby="o-dl-hint o-dl-err" ${ui.dlErr ? 'aria-invalid="true"' : ''}></div>
      <div class="o-fr"><label for="o-fz-in">Feature freeze</label><span class="o-in"><input id="o-fz-in" type="number" data-keep="o-fz" value="${esc(fm)}" min="0" max="600" step="5" inputmode="numeric" aria-describedby="o-fz-u o-dl-hint"><span class="muted" id="o-fz-u">min before</span></span></div>
      <p class="hint" id="o-dl-hint">${t.deadline ? '' : 'Not set yet: the time shown is a suggestion. '}At the freeze agents stop taking new tasks (except priority-1 fixes) and get what they have merged.</p>
      <div class="err" id="o-dl-err" role="alert">${esc(ui.dlErr || '')}</div>
      <div class="xacts">${t.deadline ? '<button type="button" class="ghost sm" data-act="dl-clear" data-fk="o-dl-clear">Remove</button>' : ''}<span class="sp"></span><button type="button" class="ghost sm" data-o-close="dl" data-fk="o-dl-cancel">Cancel</button><button type="submit" class="sm" data-fk="o-dl-save">Save time</button></div></form>`;
}
// The panels' own lines: Needs attention's counts (the need-you badge's words), what's blocked and who is out of usage,
// Activity's latest event when folded, the goal and demo time popovers.
function renderDocks(qOpen = openQuestions(), si = setupInfo()) {
  // Folded, Needs attention's title bar counts what waits on you (the need-you badge's count; its words are the tooltip).
  const needTxt = (ui.needParts || []).join(' · ');
  $('o-left-n').textContent = oUi.left && ui.needN ? String(ui.needN) : ''; $('o-left-n').title = needTxt;
  // Under the questions: blocked tasks without a question (those are answered above), with why.
  const alone = blockedSplit(qOpen).alone;
  patch($('o-blocked'), (alone.length ? `<section class="o-sec" aria-labelledby="o-bl-h"><h3 id="o-bl-h">Blocked</h3><ul class="o-list">${
    alone.map((t) => `<li><button type="button" class="link tref" data-open-task="${t.id}" data-fk="ob-${t.id}">#${t.id} ${esc(short(t.title, 48))}</button>${t.assignee ? ` <span class="muted">·</span> ${nameTag(agentRoot(t.assignee))}` : ''}${blockedNote(t) ? `<span class="o-why bad">${esc(short(blockedNote(t), 140))}</span>` : ''}</li>`).join('')}</ul></section>` : ''));
  // Folded Activity: its title bar says the latest event.
  const last = state.events.reduce((m, e) => (!m || e.id > m.id ? e : m), null);
  const lt = last ? `${last.author}: ${last.kind === 'settings' ? settingsText(last) : last.text}` : 'No activity yet';
  $('o-act-x').textContent = oUi.actOff ? short(lt, 80) : ''; $('o-act-x').title = oUi.actOff ? lt : '';
  // The goal popover: the full goal, edited in place.
  const goal = String(state.settings.goal || '').trim();
  patch($('o-goal-b'), ui.oGoalEdit || (ui.oGoal && !goal)
    ? `<form class="o-form goalform" data-goalform="o" novalidate><label for="o-goal-in">${goal ? 'The goal' : 'In 1–3 sentences: what are you building, and what should the demo show?'}</label>
        <textarea id="o-goal-in" data-keep="o-goal" rows="4" maxlength="1000" title="Enter saves · Shift+Enter adds a new line" aria-describedby="o-goal-err" ${ui.goalErr ? 'aria-invalid="true"' : ''}>${esc(goal)}</textarea>
        <div class="err" id="o-goal-err" role="alert">${esc(ui.goalErr || '')}</div>
        <div class="xacts"><span class="sp"></span>${goal ? '<button type="button" class="ghost sm" data-act="o-goal-cancel" data-fk="o-goal-cancel">Cancel</button>' : ''}<button type="submit" class="sm" data-fk="o-goal-save">Save goal</button></div></form>`
    : `<p>${esc(goal)}</p><div class="xacts"><button type="button" class="ghost sm" data-act="o-goal-edit" data-fk="o-goal-edit">Edit the goal</button></div>`);
  if (ui.oDl) patch($('o-dl-b'), oDlForm());
  if (ui.oMerge) patch($('o-merge-b'), stepIntegrator(null, 'o-integ-sel', 'o-merge-h'));
  if (ui.oPlan) patch($('o-plan-b'), plannerBox('o-', 'o-plan-h'));
  if (ui.oRoles) patch($('o-roles-b'), `<div class="rl-sec">${plannerBox('r-')}</div><div class="rl-sec">${stepIntegrator(null, 'r-integ-sel')}</div>`);
  oApply();
}
// ---------- 3D view: the room and the Tasks window ----------
// The Tasks window shows the board itself (officeMount moved its columns and table in): nothing of its own to draw.
// A search that matches nothing: one line, and the window shrinks to it (as on the Board view).
function renderOffice() {
  if (boardView !== 'office') return;
  $('o-tasks').classList.toggle('nomatch', !!(state.tasks.length && tv.q.trim() && !state.tasks.some(taskShown)));
  oFrame();
}
const CHEV = '<span class="chev" aria-hidden="true">▾</span>';
addEventListener('resize', () => oApply());
// Select an agent (its row, or its character in the room); again: unselect. The selection is the same in both views.
function pickAgent(id, fromRow = false) {
  ui.picked = id || null; office.mod?.select(ui.picked); render();
  if (!ui.picked) return;
  if (!fromRow) oShow('right');
  // The row and what opened under it, in view inside the panel (only the panel scrolls, never the page).
  const b = $('o-agents'), row = document.querySelector(`[data-fk="oa-${CSS.escape(ui.picked)}"]`), det = $('o-det');
  if (!row || !b.offsetHeight) return;
  const br = b.getBoundingClientRect(), top = row.getBoundingClientRect().top, bottom = (det || row).getBoundingClientRect().bottom;
  const dy = bottom > br.bottom ? Math.min(bottom - br.bottom + 8, top - br.top) : top < br.top ? top - br.top - 8 : 0;
  if (dy) b.scrollBy({ top: dy, behavior: smooth() });
}
$('app').addEventListener('click', (ev) => {
  // A folded title bar opens on a click anywhere on it (its own controls do what they do).
  const fh = ev.target.closest('.o-panel.folded > .o-head');
  if (fh && !ev.target.closest('button, a, input, select, textarea, label')) { const b = fh.querySelector('[data-o-fold]'); if (b) return oFold(b.dataset.oFold, false); }
  const t = ev.target.closest('button'); if (!t) return;
  const d = t.dataset;
  if (d.oFold) return oFold(d.oFold);
  if ('oMax' in d) return oExpand(!oMax());
  if (d.oClose === 'goal') return oGoal(false);
  if (d.oClose === 'dl') return oDl(false);
  if (d.oClose === 'merge') return oMerge(false);
  if (d.oClose === 'plan') return oPlan(false);
  if (d.oClose === 'roles') return oRoles(false);
  if (d.oAgent) { const n = d.oAgent; pickAgent(ui.picked === n ? null : n, true); return document.querySelector(`[data-fk="oa-${CSS.escape(n)}"]`)?.focus({ preventScroll: true }); }
});
// Esc closes the window on top: a popover (goal, demo time; the theme picker closes itself), then the maximised tasks,
// then the selected agent.
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape' || ev.defaultPrevented || ev.target.closest?.('dialog')) return;
  if (ev.target.matches?.('input, textarea, select') && !ev.target.closest('#o-goal, #o-dl, #o-merge, #o-plan, #o-roles, #setup')) return;
  if (ac.open) return;
  if (ui.oDl) return oDl(false);
  if (ui.oMerge) return oMerge(false);
  if (ui.oPlan) return oPlan(false);
  if (ui.oRoles) return oRoles(false);
  if (setupShown() && boardView === 'office') return oSetup(false);
  if (boardView !== 'office' && setupShown() && ev.target.closest?.('#setup, [data-fk="s-open"]')) { glide(() => oSetup(false, false), { move: [$('boardwrap')] }); return setupFocus(false); }
  if (ui.oGoal) return oGoal(false);
  if (boardView === 'office' && oMax() && !oTasksOff() && $('o-tasks').contains(ev.target)) { oExpand(false); return $('o-tasks-max').focus({ preventScroll: true }); }
  if (ui.picked && ev.target.closest?.('#o-right, #office-view')) { const n = ui.picked; pickAgent(null, true); document.querySelector(`[data-fk="oa-${CSS.escape(n)}"]`)?.focus({ preventScroll: true }); }
});

export { oAct, oApply, oDl, oExpand, officeMount, oFold, oFrame, oGoal, oMax, oMaxLabel, oMerge, oMoving, oPlan, oRoles,
  oSetup, oShow, oTasksOff, pickAgent, renderDocks, renderOffice, setupFocus };
