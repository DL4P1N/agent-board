// The page's delegated events: one click, key, input, submit and change handler for the whole page (data-act,
// data-go...), the keyboard shortcuts, going to a question, card or mention, and the help dialog.

import './activity.js';
import { $, ANYONE, LABEL, seenMention, setSeenMention, smooth, state, store, ui } from './state.js';
import { agentRoot, ago, announce, clock, dropDrafts, esc, focusMark, glide, isStale, refocusAfter, mentionsMe, plural, snapCards, taskById, toast, when } from './helpers.js';
import { act, api, load, scheduleReload } from './data.js';
import { agentInfoNow, bouncedTasks, colOf, cutTasks, filterRoot, openQuestions, setupInfo, setupOpen, stepOpen,
  teamCapacity, unreviewedTasks } from './derived.js';
import { render } from './render.js';
import { toggleNotify } from './topbar.js';
import { exportFile, inviteText, nfEvents, NOTIFY_KIND, renderSetup, rotateToken } from './setup.js';
import { askAgents, doneOpen, moveTask, pingedAt, renderBoard, tv } from './tasks.js';
import { closeAc, growMsg, openDm } from './activity.js';
import { leaveTask, openTask } from './task-dialog.js';
import { boardView, needBoard } from './office.js';
import { oAct, oDl, oGoal, oMerge, oPlan, oRoles, oSetup, oShow, pickAgent, renderDocks, renderOffice, setupFocus } from './panels.js';
import { togglePalette } from './palette.js';

// A change that only touches the task board (a card's menu, Done folding, Show more) redraws only the task board.
function redrawTasks() { renderBoard(); renderOffice(); }
// One request per form at a time: Enter (or a click) again while one is on its way does nothing.
const busy = new Set();
async function once(key, fn) { if (busy.has(key)) return; busy.add(key); try { return await fn(); } finally { busy.delete(key); } }

let keysOn = store.get('board-keys') !== 'off';

// ---------- events (delegated) ----------
// Moving a task to Claimed / In progress without an owner asks who it is for, under its card (both views: pre keeps
// the 3D card's focus keys apart).
function moveAskHtml(t, pre = '') {
  if (ui.moveAsk?.id !== t.id) return '';
  return `<div class="mvmenu mvask" role="group" aria-label="Who is #${t.id} for?"><span class="ml">${LABEL[ui.moveAsk.to]} needs an owner. Who is it for?</span>${askAgents(t).map((a) => `<button type="button" class="ghost" data-ask-to="${esc(a)}" data-ask-id="${t.id}" data-fk="${pre}ask-${t.id}-${esc(a)}">${esc(a)}</button>`).join('')}<button type="button" class="ghost" data-ask-cancel="${t.id}" data-fk="${pre}askc-${t.id}">Cancel</button></div>`;
}
// The first button of that question, in the view on screen.
const focusMoveAsk = () => [...document.querySelectorAll('.mvask button')].find((b) => b.offsetParent)?.focus({ preventScroll: true });
// A task's card in the view on screen (the Board's card or the 3D Tasks window's), or its row in the Table view.
// A card cut from its column (behind "Show N more") is drawn for this (ui.landId keeps it); in a folded Done column,
// focus goes to the column's button, never to the page.
function focusTask(id) {
  const find = () => [document.querySelector(`.card[data-id="${id}"]`), document.querySelector(`#tasktable [data-fk="tt-${id}"]`)].find((n) => n?.offsetParent);
  let c = find();
  if (!c && taskById(id)) { ui.landId = id; render(); c = find(); }
  if (!c) { const t = taskById(id); c = t && $('col-' + colOf(t))?.querySelector('.dtog, .more'); }
  if (c) { c.focus({ preventScroll: true }); c.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}
// Needs attention's links to tasks of a kind (in Review, stale, a proposal): the first card (or the column), or in the
// Table view, where the columns are hidden, the first such row.
const tableShown = () => tv.view === 'table' && !$('tasktable').hidden;
function goCards(pred, sel, col) {
  if (tableShown()) {
    const b = [...$('tasktable').querySelectorAll('tr[data-id]')].find((r) => { const t = taskById(Number(r.dataset.id)); return t && pred(t); })?.querySelector('button');
    b?.scrollIntoView({ behavior: smooth(), block: 'center' }); return b?.focus({ preventScroll: true });
  }
  const box = col ? $(col) : document.querySelector(sel);
  box?.scrollIntoView({ behavior: smooth(), block: 'center', inline: 'center' });
  return (col ? box?.querySelector('.card') || box : box)?.focus({ preventScroll: true });
}
function focusNow() { const b = $('now').hidden ? $('questions').querySelector('textarea') : $('now').querySelector('button'); if (b) b.focus({ preventScroll: true }); else { $('now').tabIndex = -1; $('now').focus({ preventScroll: true }); } }

function goQuestion(id) {
  oShow('left');
  const c = $('q-' + id); if (!c) return toast('That question was already answered.');
  c.scrollIntoView({ behavior: smooth(), block: 'center' }); $('qa-' + id)?.focus({ preventScroll: true });
}
function goCard(id) {
  needBoard();
  const c = document.querySelector(`.card[data-id="${id}"]`);
  if (!c) return openTask(id);
  c.scrollIntoView({ behavior: smooth(), block: 'center', inline: 'center' }); c.focus({ preventScroll: true });
}
function goMention(eid) {
  oShow('act');
  ui.tab = 'me'; store.set('board-tab', 'me'); $('feed')._html = undefined; render();
  const n = $('feed').querySelector(`[data-eid="${eid}"]`);
  $('feed').scrollIntoView({ behavior: smooth(), block: 'nearest' });
  if (n) $('feed').scrollTop = n.offsetTop - 8;
  $('feed').focus({ preventScroll: true });
}
function goBoard() {
  needBoard();
  const c = $('board').querySelector('.card'); $('boardwrap').scrollIntoView({ behavior: smooth(), block: 'start' });
  (c || $('board')).focus({ preventScroll: true });
}
// Answer an agent's question (the top panel, or a blocked task's dialog). It disappears at once (optimistic).
async function sendAnswer(qid, asker, answer) {
  await api(`/questions/${qid}/answer`, { method: 'POST', body: JSON.stringify({ answer }) });
  (ui.qSent ||= new Set()).add(qid);
  // An answer can't be changed once sent (the agent may already be acting on it): a correction goes to its direct thread.
  toast(`Answer sent to ${asker}`, false, { label: 'Correct it', run: () => correctAnswer(asker) }); scheduleReload();
  const q = state.questions.find((x) => x.id === qid); if (q) q.answer = answer;
  render();
}
// The asker's direct thread, the message box started with "Correction to my answer: " (unless something is typed there).
function correctAnswer(asker) {
  openDm(agentRoot(asker));
  const m = $('msg'); if (m.value.trim()) return;
  m.value = 'Correction to my answer: '; growMsg(); m.setSelectionRange(m.value.length, m.value.length);
}
function goWrapup() {
  const n = $('board-note');
  // Before the demo (e.g. during the freeze) the write-up buttons live in the help dialog.
  if (n.hidden) { openHelp(); const b = helpDlg.querySelector('[data-act="export-md"]'); b?.scrollIntoView({ block: 'center' }); return b?.focus(); }
  n.scrollIntoView({ behavior: smooth(), block: 'center' });
  (n.querySelector('[data-act^="export"]') || n).focus({ preventScroll: true });
}
// The way to the chat ("/", Skip to chat, the phone's chat icon, Also's links) is the shared chat's message box, not a
// direct thread's (or the thread list, which has none). The page scrolls only if the box is out of view (nearest).
function toChatTab() { if (ui.tab === 'direct') { ui.tab = 'all'; store.set('board-tab', 'all'); $('feed')._html = undefined; render(); } }
function goChat(behavior) { oShow('act'); toChatTab(); $('composer').scrollIntoView({ behavior, block: 'nearest' }); $('msg').focus({ preventScroll: true }); } // the whole box: Send too
function skipTo(where) {
  if (where === 'now') { oShow('left'); $('nyou').scrollIntoView({ block: 'start' }); return focusNow(); }
  if (where === 'chat') return goChat('auto');
  needBoard();
  // The Table view: its first sort button (the columns are hidden).
  if (tableShown()) { $('tasktable').scrollIntoView({ block: 'start' }); return $('tasktable').querySelector('button')?.focus({ preventScroll: true }); }
  const c = $('board').querySelector('.card'); ($('board').hidden || !state.tasks.length ? $('board-empty') : $('board')).scrollIntoView({ block: 'start' });
  if (c) c.focus({ preventScroll: true }); else { $('board').focus({ preventScroll: true }); }
}
// Phones: Chat sits far down the page; the header's chat icon jumps to its message box.
$('tochat').onclick = () => goChat(smooth());

document.addEventListener('click', (ev) => {
  const sk = ev.target.closest('[data-skip]'); if (sk) { ev.preventDefault(); return skipTo(sk.dataset.skip); }
  if (ev.target.closest('a[href]')) return; // links (PRs, URLs in chat) open by themselves
  if (ev.target.closest('.card input, .card label')) return; // typing a reject reason doesn't open the card
  const el = ev.target.closest('button, .card, [data-open-task]');
  // What opens inside a card (its Move… menu, who it's for, the reject reason), Done and a Setup step snap open and
  // shut, like an agent's details: only cards that change column glide. They redraw only the task board.
  if (ui.moveMenu && !ev.target.closest('.mvmenu, [data-move]')) { ui.moveMenu = null; snapCards(redrawTasks); }
  if (ui.moveAsk && !ev.target.closest('.mvask, [data-move-to]')) { ui.moveAsk = null; snapCards(redrawTasks); }
  if (!el) return;
  const d = el.dataset;
  if (el.classList.contains('card')) return openTask(Number(d.id));
  if (d.move) { const id = Number(d.move); ui.moveMenu = ui.moveMenu === id ? null : id; snapCards(redrawTasks); return (ui.moveMenu ? document.querySelector(`.card[data-id="${id}"] .mvmenu button`) : document.querySelector(`[data-fk="mv-${id}"]`))?.focus({ preventScroll: true }); }
  if (d.moveTo) { const id = Number(d.moveId); const t = taskById(id); ui.moveMenu = null; if (t && t.status !== d.moveTo) moveTask(t, d.moveTo); render(); return ui.moveAsk?.id === id ? document.querySelector(`.card[data-id="${id}"] .mvask button`)?.focus({ preventScroll: true }) : focusTask(id); }
  if (d.askTo) { const id = Number(d.askId); const t = taskById(id); const { to, force } = ui.moveAsk || {}; ui.moveAsk = null; if (t && to) moveTask(t, to, { force, assignee: d.askTo }); render(); return focusTask(id); }
  if (d.askCancel) { const id = Number(d.askCancel); ui.moveAsk = null; snapCards(redrawTasks); return focusTask(id); }
  if (d.release) { const t = taskById(Number(d.release)); if (t) { moveTask(t, 'open'); render(); } return; }
  if (d.approve) {
    // The server says when the freeze (or the demo time having passed) keeps agents from claiming it (freeze_note).
    const id = Number(d.approve);
    api(`/tasks/${id}/decide`, { method: 'POST', body: JSON.stringify({ approve: true }) })
      .then(async (r) => { toast(r?.freeze_note ? `Approved #${id}. ${r.freeze_note}` : `Approved #${id}: agents can claim it now`); await load(); focusTask(id); }, (e) => toast(e.message, true));
    return;
  }
  if (d.reject) { ui.rejecting = Number(d.reject); snapCards(redrawTasks); return $('rj-' + d.reject)?.focus(); }
  if (d.rejectNo) return cancelReject();
  if (d.limit) { ui.limitForm = d.limit; render(); return $('lu-' + d.limit)?.focus(); }
  if (d.limcancel) { const n = d.limcancel; ui.limitForm = null; render(); return document.querySelector(`[data-fk="lm-${CSS.escape(n)}"]`)?.focus(); }
  if (d.unlimit) { const n = d.unlimit; act(api(`/agents/${encodeURIComponent(n)}`, { method: 'PATCH', body: JSON.stringify({ limited: false }) }), `${n} counts as available again`).catch(() => {}); return; }
  // Needs attention after the demo time: the Demo popover (move it), or remove it.
  if (d.go === 'demo') return doAct('clock', el);
  if (d.go === 'dl-clear') return doAct('dl-clear', el);
  if (d.go === 'ci') { const n = $('ci-note'); n.scrollIntoView({ behavior: smooth(), block: 'center' }); return (n.querySelector('a') || n).focus({ preventScroll: true }); }
  if (d.go === 'proposed') return goCards((t) => t.status === 'proposed', '.card.proposed');
  if (d.ping) {
    const t = taskById(Number(d.ping)); if (!t?.assignee) return;
    if (pingedAt(t)) return toast(`Already pinged ${agentRoot(t.assignee)} ${ago(pingedAt(t))}. Give it a few minutes.`);
    const mins = Math.round((Date.now() - t.updated_at) / 60000);
    act(api('/messages', { method: 'POST', body: JSON.stringify({ text: `@${t.assignee} #${t.id} has had no update for ${mins} min. Still on it? If you're stuck, say why here; if you stopped, release it back to open.`, channel: 'general' }) }), `Pinged ${t.assignee} in chat`).catch(() => {});
    return;
  }
  if (d.goQ) return goQuestion(Number(d.goQ));
  if (d.copy) return copyText(d.copy, el);
  if (d.step) { const si = setupInfo(); ui.steps[d.step] = !stepOpen(d.step, si.cur); return renderSetup(si); }
  if (d.act) return doAct(d.act, el);
  if (d.go && d.go.startsWith('step-')) return goStep(d.go.slice(5));
  if (d.go === 'compose') return goChat(smooth());
  if (d.openTask) return openTask(Number(d.openTask));
  if (d.dm) return openDm(d.dm);
  if ('dmBack' in d) { const n = ui.dm; ui.dm = null; $('feed')._html = undefined; render(); return document.querySelector(`[data-fk="dm-${CSS.escape(n || '')}"]`)?.focus({ preventScroll: true }); }
  if (d.mention) return mention(d.mention);
  if ('filter' in d && el.id !== 'filter') { setFilter(filterRoot() === d.filter && d.filter ? '' : d.filter); return; }
  if (d.tab) { ui.tab = d.tab; store.set('board-tab', ui.tab); if (ui.tab === 'direct') ui.dm = null; $('feed')._html = undefined; return render(); }
  if ('showDone' in d) { ui.showAllDone = !ui.showAllDone; return redrawTasks(); }
  if (d.showCol) { const c = (ui.showCols ||= new Set()); c.has(d.showCol) ? c.delete(d.showCol) : c.add(d.showCol); return redrawTasks(); }
  if (d.unlock) { ui.confirmLock = d.unlock; render(); return document.querySelector(`[data-fk="un-${CSS.escape(d.unlock)}"]`)?.focus(); }
  if ('unlockNo' in d) { ui.confirmLock = null; return render(); }
  if (d.unlockYes) { const p = d.unlockYes; ui.confirmLock = null; act(api('/locks/release', { method: 'POST', body: JSON.stringify({ paths: [p] }) }), `Released lock on ${p}`).catch(() => {}); return render(); }
  if (d.go === 'questions') { oShow('left'); $('q-panel').scrollIntoView({ behavior: smooth(), block: 'start' }); return $('questions').querySelector('textarea')?.focus({ preventScroll: true }); }
  if (d.go === 'mentions') { ui.tab = 'me'; store.set('board-tab', 'me'); $('feed')._html = undefined; render(); oAct(); return $('feed').scrollIntoView({ behavior: smooth(), block: 'nearest' }); }
  if (d.go === 'blocked') {
    // The Blocked list under the questions in Needs attention, with why.
    oShow('left');
    const b = $('o-blocked').querySelector('button'); b?.scrollIntoView({ behavior: smooth(), block: 'nearest' });
    return b?.focus({ preventScroll: true });
  }
  if (d.go === 'cut') {
    // Show (or hide) the P3 tasks that probably won't make it; with none to name, the demo time is the lever.
    if (!cutTasks()?.list.length) return doAct('clock', el);
    ui.showCut = !ui.showCut; render();
    return ui.showCut ? $('cut-list')?.querySelector('button')?.focus() : undefined;
  }
  if (d.go === 'rejected') { const b = bouncedTasks()[0]; return b && openTask(b.id); }
  if (d.go === 'board') return goBoard();
  if (d.go === 'now') { oShow('left'); $('o-left-b').scrollTop = 0; $('nyou').scrollIntoView({ behavior: smooth(), block: 'start' }); return focusNow(); }
  if (d.go === 'idle') {
    // Draft a request to the planner (not sent: the human reviews it), or add a task directly when nobody plans.
    const pl = state.settings.planner; if (!pl) return openTask(null);
    const c = teamCapacity();
    oShow('act'); mention(pl); const m = $('msg');
    if (!/idle/.test(m.value)) m.value += `${plural(c.idle.length, 'agent is', 'agents are')} idle and only ${plural(c.forIdle, 'task is', 'tasks are')} ready to claim. Please add more tasks for the goal.`;
    growMsg();
    m.scrollIntoView({ behavior: smooth(), block: 'nearest' }); m.focus({ preventScroll: true }); m.setSelectionRange(m.value.length, m.value.length);
    return toast('Message drafted to the planner: edit it or press Enter to send. Or add a task yourself with + New task.');
  }
  if (d.go === 'wrapup') return goWrapup();
  if (d.go === 'conflict') {
    // Select the clashing agent in Agents, so its warning and "Belongs to" are in view.
    const a = [...agentInfoNow().values()].find((x) => x.conflict); if (!a) return;
    oShow('right'); pickAgent(a.name, true);
    const el = document.querySelector(`[data-fk="pb-${CSS.escape(a.name)}"]`) || document.querySelector(`[data-fk="oa-${CSS.escape(a.name)}"]`);
    el?.scrollIntoView({ behavior: smooth(), block: 'center' }); return el?.focus({ preventScroll: true });
  }
  if (d.go === 'review') return goCards((t) => t.status === 'review', null, 'col-review');
  // The oldest task in Review nobody is reviewing: its card (or row).
  if (d.go === 'unreviewed') { const u = unreviewedTasks()[0]; if (!u) return; needBoard(); return tableShown() ? goCards((t) => t.id === u.t.id) : goCard(u.t.id); }
  if (d.go === 'stale') return goCards(isStale, '.card.stale');
});
document.addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey && ev.key.toLowerCase() === 'k') { ev.preventDefault(); return togglePalette(); }
  const card = ev.target.closest?.('.card');
  if (ev.key === 'Escape' && ui.moveAsk && (card || ev.target.closest?.('.mvask'))) { ev.preventDefault(); const id = ui.moveAsk.id; ui.moveAsk = null; render(); return focusTask(id); }
  if (ev.key === 'Escape' && ui.moveMenu && card) { ev.preventDefault(); const id = ui.moveMenu; ui.moveMenu = null; redrawTasks(); return document.querySelector(`[data-fk="mv-${id}"]`)?.focus(); }
  // Esc in a card's Reject form: back to the card's Reject… button, nothing rejected.
  if (ev.key === 'Escape' && ui.rejecting && ev.target.closest?.('[data-rjform]')) { ev.preventDefault(); return cancelReject(); }
  if (card && ev.target === card && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); return openTask(Number(card.dataset.id)); }
  const typing = ev.target.closest?.('input, textarea, select, dialog');
  if (!keysOn || typing || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.key === 'n' || ev.key === 'N') { ev.preventDefault(); openTask(null); }
  else if (ev.key === '?') { ev.preventDefault(); openHelp(); }
  else if (ev.key === '/') { ev.preventDefault(); skipTo('chat'); }
});
// Question answers: Enter sends, Shift+Enter newline.
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && ev.target.matches?.('[data-qform] textarea, [data-goalform] textarea')) { ev.preventDefault(); ev.target.form.requestSubmit(); }
});
document.addEventListener('input', (ev) => {
  if (['goal-in', 'o-goal-in'].includes(ev.target.id) && ui.goalErr) { ui.goalErr = ''; ev.target.removeAttribute('aria-invalid'); for (const e of document.querySelectorAll('#goal-err, #o-goal-err')) e.textContent = ''; }
  if (['dl-in', 'o-dl-in'].includes(ev.target.id) && ui.dlErr) { ui.dlErr = ''; ev.target.removeAttribute('aria-invalid'); for (const e of document.querySelectorAll('#dl-err, #o-dl-err')) e.textContent = ''; }
  if (/^qa-\d+$/.test(ev.target.id) && ui.qErr?.[ev.target.id.slice(3)]) { delete ui.qErr[ev.target.id.slice(3)]; ev.target.removeAttribute('aria-invalid'); const e = $('qe-' + ev.target.id.slice(3)); if (e) e.textContent = ''; }
  if (ev.target.id === 'repo-in' && ui.repoErr) { ui.repoErr = ''; ev.target.removeAttribute('aria-invalid'); $('repo-err').textContent = ''; }
  if (['td-name', 'td-deps'].includes(ev.target.id) && ev.target.getAttribute('aria-invalid')) { ev.target.removeAttribute('aria-invalid'); if (ev.target.id === 'td-name') $('td-name-err').textContent = ''; }
  if (['td-prio', 'td-size', 'td-res', 'td-asg'].includes(ev.target.id) && ev.target.getAttribute('aria-invalid')) { ev.target.removeAttribute('aria-invalid'); $('td-err').textContent = ''; }
});
// Every form sends once at a time (once(), keyed by the form): Enter pressed again while it's on its way does nothing.
document.addEventListener('submit', (ev) => {
  const f = ev.target.closest('[data-limform], [data-rjform], [data-goalform], [data-dlform], [data-notifyform], [data-qform]');
  if (!f) return;
  ev.preventDefault();
  const key = ['limform', 'rjform', 'goalform', 'dlform', 'notifyform', 'qform'].map((k) => (k in f.dataset ? `${k}:${f.dataset[k]}` : '')).join('');
  once(key, () => submitForm(f));
});
async function submitForm(f) {
  if ('limform' in f.dataset) {
    const n = f.dataset.limform; const tv = $('lu-' + n)?.value || ''; const note = ($('ln-' + n)?.value || '').trim();
    let until = null;
    if (tv) { const [h, mi] = tv.split(':').map(Number); const d = new Date(); d.setHours(h, mi, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); until = d.getTime(); }
    try {
      await api(`/agents/${encodeURIComponent(n)}`, { method: 'PATCH', body: JSON.stringify({ limited: true, until, note }) });
      ui.limitForm = null; toast(`${n} marked out of usage${until ? ` until ${clock(until)}` : ''}. Other agents may take over its tasks.`); scheduleReload(); render();
      document.querySelector(`[data-fk="ul-${CSS.escape(n)}"]`)?.focus();
    } catch (e) { toast(e.message, true); }
    return;
  }
  if ('rjform' in f.dataset) {
    const id = Number(f.dataset.rjform); const note = (f.querySelector('input')?.value || '').trim();
    try {
      await api(`/tasks/${id}/decide`, { method: 'POST', body: JSON.stringify({ approve: false, note }) });
      // Its card goes: focus moves to the card that takes its place in the column (or the column's next one).
      const next = cardAfter(id);
      ui.rejecting = null; toast(`Rejected proposal #${id}`); scheduleReload();
      state.tasks = state.tasks.filter((t) => t.id !== id); render(); // optimistic: it's gone
      landAfter(next);
    } catch (e) { toast(e.message, true); }
    return;
  }
  if ('goalform' in f.dataset) {
    if (f.dataset.goalform === 'o') return saveGoalPopover(f);
    return saveStepGoal(f);
  }
  if ('dlform' in f.dataset) {
    // The Demo popover's form (step 2 saves its demo time with the goal).
    const v = $('o-dl-in').value; const ts = v ? new Date(v).getTime() : NaN;
    const fm = Math.max(0, Math.min(600, Math.round(Number($('o-fz-in').value) || 0)));
    ui.dlErr = '';
    if (!Number.isFinite(ts)) ui.dlErr = 'Pick the date and time of the demo.';
    else if (ts <= Date.now()) ui.dlErr = 'That time has already passed. Pick a time later than now.';
    if (ui.dlErr) { ui.dlFreeze = ''; render(); return $('o-dl-in')?.focus(); }
    // A time inside the freeze window freezes the board at once: say so first, and save on the second Save.
    const freezeNow = fm > 0 && ts - fm * 60e3 <= Date.now(); const key = `${ts}|${fm}`;
    if (freezeNow && ui.dlFreeze !== key) { ui.dlFreeze = key; render(); return document.querySelector('[data-fk="o-dl-save"]')?.focus(); }
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify({ deadline: ts, freeze_minutes: fm }) });
      dropDrafts(f); ui.dlErr = ''; ui.dlFreeze = '';
      toast(`Demo at ${when(ts)}${fm ? `; feature freeze ${freezeNow ? 'from now' : `at ${when(ts - fm * 60e3)}`}` : ''}. Agents see it too.`);
      ui.oDl = false; render(); scheduleReload(); return $('clock').focus({ preventScroll: true });
    } catch (e) { toast(e.message, true); btn.disabled = false; }
    return;
  }
  if ('notifyform' in f.dataset) {
    const inp = $('nf-url'); const url = inp ? inp.value.trim() : '';
    if (url && !/^https?:\/\//i.test(url)) { ui.nf.err = 'Paste the full webhook address, starting with https://'; render(); return $('nf-url')?.focus(); }
    if (!url && !ui.nf.url) { ui.nf.err = 'Paste a webhook URL first.'; render(); return $('nf-url')?.focus(); }
    const events = [...(ui.nf.events || nfEvents(null))];
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const r = await api('/notify', { method: 'PUT', body: JSON.stringify(url ? { url, events } : { events }) });
      Object.assign(ui.nf, { url: r?.url ?? (url || ui.nf.url), kind: r?.kind ?? ui.nf.kind, events: r?.events ? nfEvents(r.events) : new Set(events), err: '', change: false });
      if (inp) inp.value = '';
      toast(`Saved. ${NOTIFY_KIND[ui.nf.kind] ? `Sending to ${NOTIFY_KIND[ui.nf.kind]}.` : ''} Press Send test to check it.`); render();
      document.querySelector('[data-fk="nf-test"]')?.focus({ preventScroll: true });
    } catch (e) { ui.nf.err = e.message; btn.disabled = false; render(); $('nf-url')?.focus(); }
    return;
  }
  const ta = f.querySelector('textarea'); const btn = f.querySelector('button');
  const answer = ta.value.trim();
  const qid = Number(f.dataset.qform);
  ui.qErr = ui.qErr || {};
  const qErr = (msg) => { ui.qErr[qid] = msg; render(); $('qa-' + qid)?.focus(); };
  if (!answer) return qErr('Type an answer first.');
  if (ui.qErr[qid]) { delete ui.qErr[qid]; render(); }
  const idx = openQuestions().findIndex((q) => q.id === qid);
  const sb = $('q-' + qid)?.querySelector('button[type=submit]') || btn; sb.disabled = true; sb.textContent = 'Sending…';
  try {
    await sendAnswer(qid, f.dataset.asker, answer);
    // Keep going: next question's answer box, or the "what to do now" line when none are left.
    const rest = openQuestions(); const next = rest[Math.min(Math.max(idx, 0), rest.length - 1)];
    if (next) $('qa-' + next.id)?.focus(); else focusNow();
  }
  catch (e) {
    const b = $('q-' + qid)?.querySelector('button[type=submit]'); if (b) { b.disabled = false; b.textContent = 'Answer'; }
    if (e.message !== 'Token rejected') qErr(`Not sent: ${e.message}`);
  }
}
// The goal popover (the top bar's Goal chip): the goal only.
async function saveGoalPopover(f) {
  const ta = f.querySelector('textarea'); const btn = f.querySelector('button[type=submit]');
  const goal = ta.value.trim();
  if (!goal) { ui.goalErr = 'Write a sentence or two about what you are building first.'; render(); return $('o-goal-in')?.focus(); }
  btn.disabled = true;
  try {
    state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify({ goal }) });
    dropDrafts(f); ui.oGoalEdit = false; ui.goalErr = ''; toast('Goal saved. The agents will plan from it.'); render(); scheduleReload();
    return document.querySelector('[data-fk="o-goal-edit"]')?.focus({ preventScroll: true });
  } catch (e) { toast(e.message, true); btn.disabled = false; }
}
// Setup's step 2: the goal, the project repo and the demo time, checked and saved together.
async function saveStepGoal(f) {
  const S = state.settings;
  const goal = $('goal-in').value.trim(); const repo = ($('repo-in')?.value || '').trim();
  const v = $('dl-in')?.value || ''; const ts = v ? new Date(v).getTime() : 0;
  const fm = Math.max(0, Math.min(600, Math.round(Number($('fz-in')?.value) || 0)));
  ui.goalErr = ''; ui.repoErr = ''; ui.dlErr = '';
  if (!goal) ui.goalErr = 'Write a sentence or two about what you are building first.';
  if (repo && (/\s/.test(repo) || !/^(https?:\/\/|git@|ssh:\/\/|file:|[\w.-]+\/[\w.-]+)/.test(repo))) ui.repoErr = 'That doesn\'t look like a git URL. Paste what you\'d put after git clone, e.g. https://github.com/team/project';
  if (v && !Number.isFinite(ts)) ui.dlErr = 'Pick the date and time of the demo.';
  else if (ts && ts !== Number(S.deadline) && ts <= Date.now()) ui.dlErr = 'That time has already passed. Pick a time later than now.';
  const bad = ui.goalErr ? 'goal-in' : ui.repoErr ? 'repo-in' : ui.dlErr ? 'dl-in' : '';
  if (bad) { render(); return $(bad)?.focus(); }
  const body = { goal };
  if (repo !== (S.repo || '')) body.repo = repo;
  if (ts && (ts !== Number(S.deadline) || String(fm) !== String(S.freeze_minutes))) Object.assign(body, { deadline: ts, freeze_minutes: fm });
  // The suggested demo time, saved as it was shown (nobody touched it): the toast says so, with a way to take it back.
  const suggested = !!body.deadline && !Number(S.deadline) && v === $('dl-in')?.defaultValue;
  const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
  try {
    state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify(body) });
    dropDrafts(f); ui.editGoal = false; // the step stays as it was: open (showing what was saved, with Edit) if it was opened
    if (suggested) toast(`Saved. The agents will plan from the goal. The suggested demo time was saved too: demo at ${when(ts)}${fm ? `, feature freeze ${fm} min before` : ''}.`, false, { label: 'No demo time', run: () => doAct('dl-skip-saved') });
    else toast(`Saved. The agents will plan from the goal${Number(state.settings.deadline) ? `; demo at ${when(Number(state.settings.deadline))}` : ''}.`);
    render(); scheduleReload();
    document.querySelector('[data-fk="sh-goal"]')?.focus({ preventScroll: true });
  } catch (e) {
    btn.disabled = false;
    if (/time|deadline/i.test(e.message)) { ui.dlErr = e.message; render(); return $('dl-in')?.focus(); }
    toast(e.message, true);
  }
}
// The card next to one that is about to go (in its column), and focus on it once the board has redrawn.
function cardAfter(id) {
  const c = document.querySelector(`.card[data-id="${id}"]`); const li = c?.closest('li');
  const n = li?.nextElementSibling?.querySelector('.card') || li?.previousElementSibling?.querySelector('.card');
  return { id: n?.dataset.id || null, col: c?.closest('.col')?.id || null };
}
function landAfter({ id, col }) {
  const n = (id && document.querySelector(`.card[data-id="${id}"]`)) || (col && $(col)?.querySelector('.card'));
  if (n?.offsetParent) n.focus({ preventScroll: true }); else if (col && $(col)) { const h = $(col).querySelector('h3'); h.tabIndex = -1; h.focus({ preventScroll: true }); } else $('board').focus({ preventScroll: true });
}
// Cancel a card's Reject…: the form goes, focus back on its Reject… button.
function cancelReject() { const id = ui.rejecting; ui.rejecting = null; snapCards(redrawTasks); document.querySelector(`[data-fk="rj-b-${id}"]`)?.focus(); }

document.addEventListener('change', async (ev) => {
  if (ev.target.id === 'keys-on') { keysOn = ev.target.checked; store.set('board-keys', keysOn ? 'on' : 'off'); return applyKeys(); }
  if (ev.target.dataset?.nev) { ui.nf.events = ui.nf.events || nfEvents(null); ev.target.checked ? ui.nf.events.add(ev.target.dataset.nev) : ui.nf.events.delete(ev.target.dataset.nev); return; }
  if (ev.target.id === 'appr-on') {
    const on = ev.target.checked;
    try {
      state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify({ require_approval: on }) });
      toast(on ? 'Plan approval on: agents wait for your OK on the task list before they start.' : 'Plan approval off: agents start on tasks right away.');
      render(); scheduleReload();
    } catch (e) { toast(e.message, true); render(); }
    return;
  }
  if (ev.target.dataset.person) {
    const n = ev.target.dataset.person; const v = ev.target.value;
    try {
      await api(`/agents/${encodeURIComponent(n)}`, { method: 'PATCH', body: JSON.stringify({ person: v }) });
      toast(v ? `${n} now shows under ${v}` : `${n} is grouped automatically again`); scheduleReload();
    } catch (e) { toast(e.message, true); render(); }
    return;
  }
  if (ev.target.dataset.slots) {
    const n = ev.target.dataset.slots; const v = ev.target.value;
    try {
      await api(`/agents/${encodeURIComponent(n)}`, { method: 'PATCH', body: JSON.stringify({ slots: v ? Number(v) : null }) });
      toast(v ? `${n} may now hold ${plural(Number(v), 'task')} at once` : `${n} is back to its plan's default`); scheduleReload();
    } catch (e) { toast(e.message, true); render(); }
    return;
  }
  if (['plan-sel', 'pex-sel', 'o-plan-sel', 'o-pex-sel', 'r-plan-sel', 'r-pex-sel'].includes(ev.target.id)) {
    const pex = ev.target.id.endsWith('pex-sel');
    const v = ev.target.value; const body = pex ? { planner_extra: Number(v) } : { planner: v };
    try {
      state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify(body) });
      toast(pex ? (Number(v) ? `When nobody else is free, the planner may take up to ${plural(Number(v), 'extra task')}` : 'The planner sticks to its own task limit') : v ? `${v} is the planner` : 'Cleared. The first agent that starts will plan.');
      render(); scheduleReload();
    } catch (e) { toast(e.message, true); render(); }
    return;
  }
  if (!['integ-sel', 'o-integ-sel', 'r-integ-sel'].includes(ev.target.id)) return;
  const v = ev.target.value;
  try {
    state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify({ integrator: v }) });
    toast(v === ANYONE ? 'Whoever is free will merge finished work into main' : v ? `${v} will merge finished work into main` : 'Cleared. The first agent with finished work will take the job.');
    render(); scheduleReload();
  } catch (e) { toast(e.message, true); render(); }
});
function applyKeys() {
  $('keys-on').checked = keysOn;
  $('slash-hint').hidden = !keysOn;
  $('new-task-btn').title = keysOn ? 'New task (N)' : 'New task';
  $('help-btn').title = keysOn ? 'What does everything mean? (?)' : 'What does everything mean?';
}
async function approvePlan() {
  try {
    state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify({ plan_approved: true }) });
    toast('Plan approved. Agents can start claiming tasks.'); announce('Plan approved. Agents can start.');
    await load(); focusNow();
  } catch (e) { toast(e.message, true); }
}
function doAct(a, el) {
  if (a === 'approve') return approvePlan();
  if (a === 'export-md') return exportFile('md', el);
  if (a === 'export-copy') return exportFile('copy', el);
  if (a === 'export-json') return exportFile('json', el);
  if (a === 'export-retro') return exportFile('retro', el);
  if (a === 'nf-tog') { ui.nf.open = !ui.nf.open; render(); return document.querySelector('[data-fk="nf-tog"]')?.focus({ preventScroll: true }); }
  if (a === 'nf-test') {
    return api('/notify/test', { method: 'POST', body: '{}' }).then((r) => toast(r?.ok === false || r?.error ? `Test failed: ${r.error || `the webhook answered ${r.status}`}` : 'Test sent. Check your chat or phone.', r?.ok === false || !!r?.error)).catch((e) => toast(`Test failed: ${e.message}`, true));
  }
  if (a === 'nf-off') {
    return api('/notify', { method: 'PUT', body: JSON.stringify({ url: '' }) }).then((r) => { Object.assign(ui.nf, { url: r?.url || '', kind: r?.kind || null, err: '', change: false }); toast('Webhook removed. Notifications stopped.'); render(); document.querySelector('[data-fk="nf-save"]')?.focus({ preventScroll: true }); }).catch((e) => { ui.nf.err = e.message; render(); });
  }
  if (a === 'nf-change' || a === 'nf-keep') { ui.nf.change = a === 'nf-change'; ui.nf.err = ''; render(); return document.querySelector(a === 'nf-change' ? '#nf-url' : '[data-fk="nf-change"]')?.focus({ preventScroll: true }); }
  if (a === 'rotate') { ui.rotateArm = true; render(); return document.querySelector('[data-fk="rot-no"]')?.focus({ preventScroll: true }); }
  if (a === 'rotate-no') { ui.rotateArm = false; render(); return document.querySelector('[data-fk="rot"]')?.focus({ preventScroll: true }); }
  if (a === 'rotate-yes') return rotateToken();
  if (a === 'sec-go') { const b = document.querySelector('[data-fk="rot"], [data-fk="rot-no"]'); b?.scrollIntoView({ behavior: smooth(), block: 'center' }); return b?.focus({ preventScroll: true }); }
  if (a === 'dl-skip') {
    // For the whole board: nobody's step 2 suggests a time again (the field empties; what else was typed stays).
    return api('/settings', { method: 'PUT', body: JSON.stringify({ no_deadline: true }) }).then((st) => {
      state.settings = st; if ($('dl-in')) $('dl-in').value = ''; render(); scheduleReload();
      toast('No demo time: no countdown or feature freeze. Set one any time in step 2.');
      document.querySelector('[data-fk="goal-save"], [data-fk="sh-goal"]')?.focus({ preventScroll: true });
    }).catch((e) => toast(e.message, true));
  }
  if (a === 'other-tools') { ui.otherTools = !ui.otherTools; renderSetup(setupInfo()); return document.querySelector('[data-fk="other-tools"]')?.focus({ preventScroll: true }); }
  // Setup's step 4 points to where the planner is chosen: the Roles chip (the Planner chip from 1600px).
  if (a === 'pick-planner') return matchMedia('(max-width: 1599px)').matches ? oRoles(true) : oPlan(true);
  if (a === 'qr') { ui.qr = !ui.qr; render(); return document.querySelector('[data-fk="qr-tog"]')?.focus({ preventScroll: true }); }
  if (a === 'clock') return oDl(el?.id === 'clock' ? !ui.oDl : true);
  if (a === 'goal') return oGoal(!ui.oGoal);
  if (a === 'merge') return oMerge(!ui.oMerge);
  if (a === 'planner') return oPlan(!ui.oPlan);
  if (a === 'roles') return oRoles(!ui.oRoles);
  if (a === 'o-goal-edit') return oGoal(true, { edit: true });
  if (a === 'o-goal-cancel') { dropDrafts($('o-goal-b')); ui.oGoalEdit = false; ui.goalErr = ''; renderDocks(); return document.querySelector('[data-fk="o-goal-edit"]')?.focus(); }
  // The toast after step 2 saved the suggested demo time: take it back, and don't suggest one again.
  if (a === 'dl-skip-saved') {
    return api('/settings', { method: 'PUT', body: JSON.stringify({ deadline: '', no_deadline: true }) }).then((st) => {
      state.settings = st; render(); scheduleReload();
      toast('No demo time: no countdown or feature freeze. Set one any time in step 2.');
    }).catch((e) => toast(e.message, true));
  }
  if (a === 'dl-clear') {
    // Removed on purpose: nobody's step 2 suggests one again either.
    return api('/settings', { method: 'PUT', body: JSON.stringify({ deadline: '', no_deadline: true }) }).then((st) => {
      state.settings = st; ui.dlErr = ''; dropDrafts($('o-dl-b')); toast('Demo time removed. No countdown or feature freeze.');
      if (ui.oDl) { ui.oDl = false; render(); scheduleReload(); return $('clock').hidden ? focusNow() : $('clock').focus(); }
      render(); scheduleReload();
      if ($('dl-in')) { $('dl-in').value = ''; $('dl-in').focus(); }
    }).catch((e) => toast(e.message, true));
  }
  if (a === 'setup-open' || a === 'setup-close') {
    const open = a === 'setup-open';
    if (boardView === 'office') return oSetup(open);
    // With 3D off Setup opens over the board, which slides down to make room (and back up when it closes).
    glide(() => oSetup(open, false), { move: [$('boardwrap'), document.querySelector('.pagefoot')], open: $('setup') });
    return setupFocus(open);
  }
  if (a === 'invite') return goStep('invite');
  if (a === 'copy-invite') return copyText(inviteText(), document.querySelector('[data-act="copy-invite"]'), 'Invite copied. Paste it in your team chat.');
  if (a === 'addrs') { ui.addrs = !ui.addrs; return render(); }
  if (a === 'goal-edit') { ui.editGoal = true; render(); const t = $('goal-in'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } return; }
  if (a === 'goal-cancel') { dropDrafts($('step-goal')); ui.editGoal = false; ui.goalErr = ''; ui.repoErr = ''; ui.dlErr = ''; render(); return document.querySelector('[data-fk="goal-edit"]')?.focus(); }
  if (a === 'done-toggle') {
    const open = !doneOpen(); ui.doneOpen = open ? 'open' : 'closed'; store.set('board-done', ui.doneOpen); snapCards(redrawTasks);
    return document.querySelector(`[data-fk="${open ? 'done-close' : 'done-tog'}"]`)?.focus({ preventScroll: true });
  }
  if (a === 'new-task') return openTask(null);
  if (a === 'clear-search') { tv.q = ''; $('tsearch').value = ''; renderBoard(); renderOffice(); return $('tsearch').focus(); }
}
function goStep(key, focus) {
  const si = setupInfo(), opening = !setupOpen(si.complete);
  const show = () => {
    if (opening) { ui.forceSetup = true; ui.oGoal = false; ui.oDl = false; ui.oMerge = false; ui.oPlan = false; ui.oRoles = false; } // open for this visit only
    ui.steps[key] = true; render();
  };
  // With 3D off Setup opens over the board, which slides down for it (as from the Setup chip).
  if (opening && boardView !== 'office') glide(show, { move: [$('boardwrap'), document.querySelector('.pagefoot')], open: $('setup') }); else show();
  const li = $('step-' + key); if (!li) return;
  li.scrollIntoView({ behavior: smooth(), block: 'start' });
  if (focus === 'dl' && !ui.editGoal && state.settings.goal) { ui.editGoal = true; render(); }
  if (focus === 'dl') { const n = li.querySelector('#dl-in'); if (n) { n.scrollIntoView({ behavior: smooth(), block: 'center' }); return n.focus({ preventScroll: true }); } }
  (li.querySelector('.step-b [data-act="copy-invite"], .step-b textarea, .step-b select, .step-b [data-copy]') || li.querySelector('.step-h'))?.focus({ preventScroll: true });
}
async function copyText(text, btn, okMsg = 'Copied. Paste it in a terminal.') {
  let ok = false;
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; } } catch {}
  if (!ok) { // plain http on a LAN address: the async clipboard API isn't available
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(ta); ta.select(); try { ok = document.execCommand('copy'); } catch {} ta.remove();
  }
  btn?.focus({ preventScroll: true });
  if (ok && btn) {
    if (!btn._label) btn._label = btn.innerHTML;
    btn.textContent = 'Copied ✓'; clearTimeout(btn._t);
    btn._t = setTimeout(() => { if (btn.isConnected) btn.innerHTML = btn._label; btn._label = null; }, 1500);
  }
  toast(ok ? okMsg : 'Could not copy automatically: select the text and copy it by hand.', !ok);
}
$('notify-btn').onclick = toggleNotify;
const helpDlg = $('help-dlg');
// Closed: focus goes back where it was (the same card if a live update redrew it meanwhile).
let helpBack = null;
function openHelp() { if (!helpDlg.open) { helpBack = focusMark(); helpDlg.showModal(); } helpDlg.querySelector('.x').focus(); }
helpDlg.addEventListener('close', () => { const back = helpBack; helpBack = null; refocusAfter(helpDlg, back); });
$('help-btn').onclick = openHelp;
helpDlg.addEventListener('click', (ev) => { if (ev.target.closest('[data-close]')) return helpDlg.close();
  if (ev.target === helpDlg) { const r = helpDlg.getBoundingClientRect(); if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) helpDlg.close(); } });

function setFilter(v) { ui.filter = v; store.set('board-filter', v); render(); }
$('filter').addEventListener('change', (e) => setFilter(e.target.value));
function mention(name) {
  // From the task dialog (a name in its history): unsaved edits are asked about first.
  if ($('task-dlg').open) return leaveTask(() => mention(name));
  oShow('act');
  toChatTab();
  const m = $('msg'); const tagText = '@' + name + ' ';
  if (!m.value.includes(tagText)) m.value = (m.value && !/\s$/.test(m.value) ? m.value + ' ' : m.value) + tagText;
  m.focus(); m.setSelectionRange(m.value.length, m.value.length); growMsg(); closeAc();
}

export { applyKeys, copyText, doAct, focusMoveAsk, focusNow, focusTask, goCard, goChat, goMention, goQuestion, goStep,
  helpDlg, mention, moveAskHtml, openHelp, sendAnswer, setFilter };
