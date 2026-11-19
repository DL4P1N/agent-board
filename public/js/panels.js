// The panels, the same in both views: folding them to their title bars, the Tasks window's states in 3D (expanded,
// docked, folded, maximised: oExpand, oApply, oFrame), the top bar's popovers, the docks, and the 3D room's agent picking.

import './office.js';
import { $, nsKey, oSave, oUi, smooth, state, store, ui } from './state.js';
import { agentRoot, dropDrafts, esc, glide, hasDraft, nameTag, patch, setText, short, stashDrafts } from './helpers.js';
import { blockedSplit, inPass, openQuestions, setupInfo, setupShown, timeNow } from './derived.js';
import { render } from './render.js';
import { syncNeeds } from './needs.js';
import { renderTopbar } from './topbar.js';
import { defaultDeadline, localInput, plannerBox, stepIntegrator } from './setup.js';
import { blockedNote } from './tasks.js';
import { ac, settingsText } from './activity.js';
import { themePop } from './theme.js';
import { boardView, office, oRate } from './office.js';

// ---------- the panels, the same in both views ----------
// Needs attention (left), Agents, Activity and File locks (right), the top bar with the goal, the demo time under the header
// clock. One fold state for both views (oUi), and one way to fold: every panel (the 3D Tasks window too) folds to its
// title bar, which opens it again (its button, or a click anywhere on it). Folding moves (glide, in helpers.js).
// The Tasks panel is one element in both views: under the top bar in the centre column with 3D off, moved into the
// room's view with 3D on (where it is docked, expanded or folded), in the same place. Its notes, search text, filter,
// scroll and focus carry over when 3D goes on or off.
function officeMount(on) {
  const tw = $('o-tasks'), to = on ? $('office-view') : $('boardwrap');
  // Moving a node takes focus out of it: whatever had focus inside gets it back (with its caret), where it now is.
  const had = document.activeElement; const moved = had && had !== document.body && tw.contains(had);
  let sel = null; try { if (moved && had.selectionStart != null) sel = [had.selectionStart, had.selectionEnd]; } catch {}
  if (tw.parentElement !== to) to.append(tw);
  if (moved && document.activeElement !== had && had.isConnected) { had.focus({ preventScroll: true }); if (sel) try { had.setSelectionRange(sel[0], sel[1]); } catch {} }
}
// The task board starts open and docked (the room in view below it), and turning 3D on docks it; File locks start
// folded. Folding, expanding or docking one yourself is remembered. ?view=office docks it for that visit.
const oTasksOff = () => (typeof oUi.tasks === 'boolean' ? oUi.tasks : false);
const oMax = () => (office.dockOnce ? false : typeof oUi.max === 'boolean' ? oUi.max : false);
// Panels folding or the board sliding: the room holds still meanwhile (oRate) and its camera waits (oFrame), then eases
// to the new framing once they have landed, so the panels move smoothly.
let oMoving = 0, qOutWait = null; // qOutWait: Needs attention folding (oFold)
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
  const go = () => { oUi.max = on; oSave(); oApply(); };
  if (!shown) { go(); return office.mod?.resize(); }
  // The room's canvas is measured again once the board has landed (not in the slide's first frame).
  oMotion(() => glide(go, { size: [tw] }).then((r) => { office.mod?.resize(); return r; }));
}
const oLocksOff = () => (typeof oUi.locks === 'boolean' ? oUi.locks : store.get('board-locks') !== 'open');
const oOff = (w) => (w === 'tasks' ? oTasksOff() : w === 'locks' ? oLocksOff() : w === 'act' ? !!oUi.actOff : !!oUi[w]);
const O_PANELS = [['left', 'Needs attention'], ['right', 'Agents'], ['act', 'Activity'], ['locks', 'File locks'], ['tasks', 'Tasks']];
const O_BOX = { left: 'o-left', right: 'o-right', act: 'o-act', locks: 'o-locks', tasks: 'o-tasks' };
// The Tasks window's maximise / restore icons (corners out, corners in).
const O_MAX = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>', O_RESTORE = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2v4H2M10 2v4h4M14 10h-4v4M2 10h4v4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
// A top bar popover sits --gutter under its chip (like every popover), inside the window; where there isn't room under
// it (low on a phone's screen), it opens over the chip instead.
function placePop(id, chipId, wDef = 460) {
  const p = $(id); const c = $(chipId); const r = c?.offsetWidth ? c.getBoundingClientRect() : null; const w = p.offsetWidth || wDef;
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')) || 12;
  p.style.left = `${Math.max(8, Math.min((r ? r.left : 8), innerWidth - w - 8))}px`;
  if (!r) return;
  const h = p.offsetHeight; const below = r.bottom + gap + h <= innerHeight - 8;
  p.style.top = `${Math.round(Math.max(8, below ? r.bottom + gap : Math.min(r.top - gap - h, innerHeight - h - 8)))}px`;
}
function oApply() {
  const tOff = oTasksOff(), max = oMax();
  $('o-tasks').classList.toggle('max', max && !tOff);
  $('o-tasks-max').setAttribute('aria-pressed', String(max)); $('o-tasks-max').setAttribute('aria-label', oMaxLabel()); $('o-tasks-max').title = oMaxLabel();
  if ($('o-tasks-max')._icon !== max) { $('o-tasks-max').innerHTML = max ? O_RESTORE : O_MAX; $('o-tasks-max')._icon = max; }
  oRate();
  // Every panel folds to its title bar; its button says what it does, with the panel's own name.
  for (const [w, name] of O_PANELS) {
    const box = $(O_BOX[w]), b = box.querySelector('[data-o-fold]'), off = oOff(w), l = `${off ? 'Open' : 'Fold'} ${name}`;
    box.classList.toggle('folded', off); b.setAttribute('aria-expanded', String(!off)); b.title = l; b.setAttribute('aria-label', l);
  }
  // The cards' "question waiting" (CSS: #o-left.q-out): gone as Needs attention opens, back once its fold has landed.
  if (!oOff('left')) $('o-left').classList.remove('q-out'); else if (!qOutWait) $('o-left').classList.add('q-out');
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
  frameSoon();
}
// The top bar's height, for the CSS of what sits under it (the goal popover, and Setup and the Tasks window with 3D on):
// kept by a ResizeObserver, so nothing measures it while drawing.
if ('ResizeObserver' in window) new ResizeObserver(([e]) => $('main').style.setProperty('--tb-h', e.target.getBoundingClientRect().height + 'px')).observe($('topbar'));
// The camera's framing measures the panels: once per frame at most, when the layout is done anyway.
let frameReq = 0;
function frameSoon() { if (!frameReq) frameReq = requestAnimationFrame(() => { frameReq = 0; oFrame(); }); }
// The room is framed in the part of the view the docks, the top bar and the Tasks window (or its title bar, under the
// top bar) leave free: below them, between the side columns (the camera is told the insets).
let oDockH = 0;
function oFrame() {
  if (!office.mod?.setInsets || boardView !== 'office' || oMoving) return;
  const v = $('office-view').getBoundingClientRect(); if (!v.width || !v.height) return;
  // A side column counts while one of its panels is open (folded title bars at its top leave the room free).
  const R = (...ids) => { const e = ids.map($).find((x) => x && !x.hidden && x.offsetWidth && !x.classList.contains('folded')); return e ? e.getBoundingClientRect() : null; };
  const l = R('o-left'), r = R('o-right', 'o-act', 'o-locks'), t = $('o-tasks').offsetWidth ? $('o-tasks').getBoundingClientRect() : null, top = $('topbar').getBoundingClientRect();
  // Expanded, the board covers the room: it's framed as if docked (as tall as it last was docked, at most 65% of the
  // room under the top bar and leaving 320px of it, as in office.css), so sliding the board down or up doesn't move the camera.
  const covered = t && $('o-tasks').classList.contains('max');
  if (t && !covered) oDockH = t.height;
  const roomH = () => v.bottom - parseFloat(getComputedStyle($('main')).getPropertyValue('--edge')) - t.top;
  const dockBottom = () => t.top + Math.min(oDockH || Infinity, Math.max(160, Math.min(0.65 * roomH(), roomH() - 320)));
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
  // Folding Needs attention: the cards' "question waiting" comes back once it has landed (the board unchanged mid-glide).
  const tok = which === 'left' && folded ? (qOutWait = {}) : null;
  oMotion(() => glide(() => {
    oUi[which === 'act' ? 'actOff' : which] = folded; oSave(); renderDocks();
    if (boardView === 'office') renderOffice();
  }, { size: col, pin: [box, body] }).then((r) => {
    if (tok && qOutWait === tok) { qOutWait = null; if (oOff('left')) $('o-left').classList.add('q-out'); }
    if (boardView === 'office') office.mod?.resize?.(); return r;
  }));
  // Focus stays on the control you used; from inside a body that folds away (or from nowhere: a click on the title bar),
  // it moves to the panel's fold button.
  if (folded ? from && body.contains(from) : !from || from === document.body || box.contains(from)) btn.focus({ preventScroll: true });
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
  // A goal typed and not saved (the popover dismissed): it opens in the form again, with that text.
  if (open) stashDrafts($('o-goal-b'));
  ui.oGoal = open; ui.oGoalEdit = open && (edit || hasDraft('o-goal')); ui.goalErr = ''; if (open) { ui.oDl = false; ui.oMerge = false; ui.oPlan = false; ui.oRoles = false; setupAway(); if (ui.themeOpen) themePop(false, false); }
  $('o-goal-b')._html = undefined; renderDocks(); $('tb-a')._html = undefined; $('tb-b')._html = undefined; renderTopbar(setupInfo());
  if (!open) return $('goal-btn')?.focus({ preventScroll: true });
  const ta = $('o-goal-in');
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } else $('o-goal').querySelector('.o-ib').focus({ preventScroll: true });
}
function oDl(open) {
  ui.oDl = open; ui.dlErr = ''; if (open) { ui.oGoal = false; ui.oMerge = false; ui.oPlan = false; ui.oRoles = false; setupAway(); if (ui.themeOpen) themePop(false, false); }
  if (open) { stashDrafts($('o-dl-b')); $('o-dl-b').innerHTML = ''; $('o-dl-b')._html = undefined; } // a fresh form, with what was typed and not saved (closing, it fades out as it was)
  renderDocks();
  if (open) $('o-dl-in')?.focus(); else $('clock').focus({ preventScroll: true });
}
// Opening is for this visit (a reload doesn't bring a finished board's Setup back over the tasks); closing is remembered,
// so an unfinished board's Setup stays closed too.
function oSetup(open, focus = true) {
  store.set('board-setup', open ? '' : 'closed'); ui.forceSetup = open;
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
  if (ui.oPlan && !ev.target.closest?.('#o-plan, #plan-btn, [data-act="pick-planner"]') && ev.target.isConnected) { ui.oPlan = false; renderDocks(); renderTopbar(setupInfo()); }
  if (ui.oRoles && !ev.target.closest?.('#o-roles, #roles-btn, [data-act="pick-planner"]') && ev.target.isConnected) { ui.oRoles = false; renderDocks(); renderTopbar(setupInfo()); }
  if (boardView === 'office' && setupShown() && ev.target.isConnected && !ev.target.closest?.('#setup, [data-fk="s-open"], [data-go^="step-"], [data-act="invite"], #o3d, dialog, #toasts')) { setupAway(); render(); }
});
// A popover closes once focus leaves it and its chip (Tab, or a click on something that takes focus), like the theme
// chooser. Tab past a popover's last control goes on to the chip after its own; Shift+Tab from its first, back to its chip.
const POPS = { oGoal: ['o-goal', 'goal-btn'], oDl: ['o-dl', 'clock'], oMerge: ['o-merge', 'merge-btn'], oPlan: ['o-plan', 'plan-btn'], oRoles: ['o-roles', 'roles-btn'] };
function popAway(k) { ui[k] = false; if (k === 'oGoal') ui.oGoalEdit = false; renderDocks(); renderTopbar(setupInfo()); }
document.addEventListener('focusout', (ev) => {
  // Onto another chip, its own click does the rest (a chip redrawn under the pointer would lose that click).
  const to = ev.relatedTarget; if (!to || to.closest?.('#topbar, dialog')) return;
  for (const [k, [pop, chip]] of Object.entries(POPS)) if (ui[k] && ev.target.closest?.(`#${pop}, #${chip}`) && !to.closest?.('#' + pop)) popAway(k);
  // With 3D on Setup is a popover too: Tab past it (into the Tasks window under it) closes it.
  if (boardView === 'office' && setupShown() && ev.target.closest?.('#setup') && !to.closest?.('#setup, #toasts')) { setupAway(); render(); }
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
      <div class="o-fr"><input id="o-dl-in" type="datetime-local" aria-label="Demo time" data-keep="o-dl" data-draft value="${esc(localInput(t.deadline || defaultDeadline()))}" step="60" aria-describedby="o-dl-hint o-dl-err" ${ui.dlErr ? 'aria-invalid="true"' : ''}></div>
      <div class="o-fr"><label for="o-fz-in">Feature freeze</label><span class="o-in"><input id="o-fz-in" type="number" data-keep="o-fz" data-draft value="${esc(fm)}" min="0" max="600" step="5" inputmode="numeric" aria-describedby="o-fz-u o-dl-hint"><span class="muted" id="o-fz-u">min before</span></span></div>
      <p class="hint" id="o-dl-hint">${t.deadline ? '' : 'Not set yet: the time shown is a suggestion. '}At the freeze agents stop taking new tasks (except priority-1 fixes) and get what they have merged.</p>
      <div class="err" id="o-dl-err" role="alert">${esc(ui.dlErr || '')}</div>
      <div class="xacts">${t.deadline ? '<button type="button" class="ghost sm" data-act="dl-clear" data-fk="o-dl-clear">Remove</button>' : ''}<span class="sp"></span><button type="button" class="ghost sm" data-o-close="dl" data-fk="o-dl-cancel">Cancel</button><button type="submit" class="sm" data-fk="o-dl-save">Save time</button></div></form>`;
}
// The panels' own lines: Needs attention's counts (the need-you badge's words), what's blocked and who is out of usage,
// Activity's latest event when folded, the goal and demo time popovers.
// Also called on its own (a fold, a popover): one memo pass, so the per-agent lookups index once.
function renderDocks(qOpen) { return inPass(() => renderDocksNow(qOpen ?? openQuestions())); }
function renderDocksNow(qOpen) {
  // Folded, Needs attention's title bar counts what waits on you (the need-you badge's count; its words are the tooltip).
  const needTxt = (ui.needParts || []).join(' · ');
  setText($('o-left-n'), oUi.left && ui.needN ? String(ui.needN) : ''); $('o-left-n').title = needTxt;
  // Under the questions: blocked tasks without a question (those are answered above), with why.
  const alone = blockedSplit(qOpen).alone;
  patch($('o-blocked'), (alone.length ? `<section class="o-sec" aria-labelledby="o-bl-h"><h3 id="o-bl-h">Blocked</h3><ul class="o-list">${
    alone.map((t) => `<li><button type="button" class="link tref" data-open-task="${t.id}" data-fk="ob-${t.id}">#${t.id} ${esc(short(t.title, 48))}</button>${t.assignee ? ` <span class="muted">·</span> ${nameTag(agentRoot(t.assignee))}` : ''}${blockedNote(t) ? `<span class="o-why bad">${esc(short(blockedNote(t), 140))}</span>` : ''}</li>`).join('')}</ul></section>` : ''));
  // Folded Activity: its title bar says the latest event.
  const last = state.events.reduce((m, e) => (!m || e.id > m.id ? e : m), null);
  const lt = last ? `${last.author}: ${last.kind === 'settings' ? settingsText(last) : last.text}` : 'No activity yet';
  setText($('o-act-x'), oUi.actOff ? short(lt, 80) : ''); $('o-act-x').title = oUi.actOff ? lt : '';
  // The goal popover: the full goal, edited in place.
  const goal = String(state.settings.goal || '').trim();
  patch($('o-goal-b'), ui.oGoalEdit || (ui.oGoal && !goal)
    ? `<form class="o-form goalform" data-goalform="o" novalidate><label for="o-goal-in">${goal ? 'The goal' : 'In 1–3 sentences: what are you building, and what should the demo show?'}</label>
        <textarea id="o-goal-in" data-keep="o-goal" data-draft rows="4" maxlength="1000" title="Enter saves · Shift+Enter adds a new line" aria-describedby="o-goal-err" ${ui.goalErr ? 'aria-invalid="true"' : ''}>${esc(goal)}</textarea>
        <div class="err" id="o-goal-err" role="alert">${esc(ui.goalErr || '')}</div>
        <div class="xacts"><span class="sp"></span>${goal ? '<button type="button" class="ghost sm" data-act="o-goal-cancel" data-fk="o-goal-cancel">Cancel</button>' : ''}<button type="submit" class="sm" data-fk="o-goal-save">Save goal</button></div></form>`
    : `<p>${esc(goal)}</p><div class="xacts"><button type="button" class="ghost sm" data-act="o-goal-edit" data-fk="o-goal-edit">Edit the goal</button></div>`);
  if (ui.oDl) patch($('o-dl-b'), oDlForm());
  if (ui.oMerge) patch($('o-merge-b'), stepIntegrator('o-integ-sel', 'o-merge-h'));
  if (ui.oPlan) patch($('o-plan-b'), plannerBox('o-', 'o-plan-h'));
  if (ui.oRoles) patch($('o-roles-b'), `<div class="rl-sec">${plannerBox('r-')}</div><div class="rl-sec">${stepIntegrator('r-integ-sel')}</div>`);
  oApply();
}
// ---------- 3D view: the room and the Tasks window ----------
// The Tasks panel is the board itself (officeMount moved it into the room's view), as tall as its content (a search
// that matches nothing: one line): nothing of its own to draw.
function renderOffice() {
  if (boardView !== 'office') return;
  oFrame();
}
let resizeReq = 0;
addEventListener('resize', () => { if (!resizeReq) resizeReq = requestAnimationFrame(() => { resizeReq = 0; oApply(); }); });
// Another tab of this board folded or opened a panel: this one follows (one remembered state, not two overwriting
// each other).
addEventListener('storage', (e) => {
  if (e.key !== nsKey('board-office-ui')) return;
  let v = {}; try { v = JSON.parse(e.newValue || '{}') || {}; } catch {}
  for (const k of Object.keys(oUi)) if (!(k in v)) delete oUi[k];
  Object.assign(oUi, v); renderDocks(); if (boardView === 'office') renderOffice();
});
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
  if (fh && !ev.target.closest('button, a, input, select, textarea, label')) { const b = fh.querySelector('[data-o-fold]'); if (b) { oFold(b.dataset.oFold, false); return b.focus({ preventScroll: true }); } }
  const t = ev.target.closest('button'); if (!t) return;
  const d = t.dataset;
  if (d.oFold) return oFold(d.oFold);
  if ('oMax' in d) return oExpand(!oMax());
  if (d.oClose === 'goal') return oGoal(false);
  if (d.oClose === 'dl') { if (d.fk === 'o-dl-cancel') dropDrafts($('o-dl-b')); return oDl(false); } // its Cancel drops what was typed; × keeps it
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
  if (boardView !== 'office' && setupShown() && ev.target.closest?.('#setup, [data-fk="s-open"]')) { glide(() => oSetup(false, false), { move: [$('boardwrap'), document.querySelector('.pagefoot')], open: $('setup') }); return setupFocus(false); }
  if (ui.oGoal) return oGoal(false);
  if (boardView === 'office' && oMax() && !oTasksOff() && $('o-tasks').contains(ev.target)) { oExpand(false); return $('o-tasks-max').focus({ preventScroll: true }); }
  if (ui.picked && ev.target.closest?.('#o-right, #office-view')) { const n = ui.picked; pickAgent(null, true); document.querySelector(`[data-fk="oa-${CSS.escape(n)}"]`)?.focus({ preventScroll: true }); }
});

export { oAct, oApply, oDl, oExpand, officeMount, oFold, oFrame, oGoal, oMax, oMaxLabel, oMerge, oMoving, oPlan, oRoles,
  oSetup, oShow, oTasksOff, pickAgent, renderDocks, renderOffice, setupFocus };
