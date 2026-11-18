// The entry point: <script type="module" src="js/boot.js"> in index.html. Being split into modules: each imports the one
// before it first, so they run in the order the page's old inline script had. What isn't in a module yet is here,
// still in its old order, and runs last.

import './activity.js';
import { $, ANYONE, BASE, HINT, HOLDING, HUES, LABEL, me, nsKey, oSave, oUi, qs, reduceMotion, seenMention,
  setSeenMention, SLUG, smooth, state, STATUSES, store, token, ui } from './state.js';
import { agentRoot, ago, announce, clock, esc, fmt, fullTime, hue, isStale, knownPeople, mentionsMe, nameHash,
  nameTag, ownerOffline, patch, plural, reveal, short, taskById, toast, when, who, youTag } from './helpers.js';
import { act, api, connect, es, esOpen, load, recheck, scheduleReload, setConn, setLoad, showGate, unavailable,
  unavailableStatus } from './data.js';
import { agentInfo, agentInfoNow, agentLimited, agentsLine, agentState, blockedSplit, bouncedTasks, capText, cutTasks,
  dlSkipped, filterRoot, limitText, openQuestions, outlook, people, setupInfo, setupOpen, setupShown, stays, stepOpen,
  teamCapacity, timeNow } from './derived.js';
import { render } from './render.js';
import { nowSeen, setNowSeen, syncNeeds } from './needs.js';
import { renderTopbar, setTimeKey, tickTime, timeKey, toggleNotify } from './topbar.js';
import { defaultDeadline, exportFile, fetchExport, inviteText, localInput, nfEvents, NOTIFY_KIND, plannerBox,
  rotateToken, stepIntegrator } from './setup.js';
import { officeState } from './agents.js';
import { askAgents, blockedNote, doneOpen, moveTask, pingedAt, prFeedback, prInfo, renderBoard, taskShown, tv } from './tasks.js';
import { ac, ACT_GAP, closeAc, evHtml, growMsg, openDm, setActGap, settingsText } from './activity.js';

let editing = null; // snapshot of the task open in the dialog
let keysOn = store.get('board-keys') !== 'off';

// ---------- events (delegated) ----------
function focusCard(id) { document.querySelector(`.card[data-id="${id}"]`)?.focus({ preventScroll: true }); }
// Moving a task to Claimed / In progress without an owner asks who it is for, under its card (both views: pre keeps
// the 3D card's focus keys apart).
function moveAskHtml(t, pre = '') {
  if (ui.moveAsk?.id !== t.id) return '';
  return `<div class="mvmenu mvask" role="group" aria-label="Who is #${t.id} for?"><span class="ml">${LABEL[ui.moveAsk.to]} needs an owner. Who is it for?</span>${askAgents(t).map((a) => `<button type="button" class="ghost" data-ask-to="${esc(a)}" data-ask-id="${t.id}" data-fk="${pre}ask-${t.id}-${esc(a)}">${esc(a)}</button>`).join('')}<button type="button" class="ghost" data-ask-cancel="${t.id}" data-fk="${pre}askc-${t.id}">Cancel</button></div>`;
}
// The first button of that question, in the view on screen.
const focusMoveAsk = () => [...document.querySelectorAll('.mvask button')].find((b) => b.offsetParent)?.focus({ preventScroll: true });
// A task's card in the view on screen (the Board's card or the 3D Tasks window's).
function focusTask(id) {
  const c = document.querySelector(`.card[data-id="${id}"]`);
  if (c?.offsetParent) { c.focus({ preventScroll: true }); c.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
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
  ui.tab = 'me'; store.set('board-tab', 'me'); markMentionsSeen(); $('feed')._html = undefined; render();
  const n = $('feed').querySelector(`[data-eid="${eid}"]`);
  $('feed').scrollIntoView({ behavior: smooth(), block: 'center' });
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
  toast(`Answer sent to ${asker}`); scheduleReload();
  const q = state.questions.find((x) => x.id === qid); if (q) q.answer = answer;
  render();
}
function goWrapup() {
  const n = $('board-note');
  // Before the demo (e.g. during the freeze) the write-up buttons live in the help dialog.
  if (n.hidden) { openHelp(); const b = helpDlg.querySelector('[data-act="export-md"]'); b?.scrollIntoView({ block: 'center' }); return b?.focus(); }
  n.scrollIntoView({ behavior: smooth(), block: 'center' });
  (n.querySelector('[data-act^="export"]') || n).focus({ preventScroll: true });
}
function skipTo(where) {
  if (where === 'now') { oShow('left'); $('nyou').scrollIntoView({ block: 'start' }); return focusNow(); }
  if (where === 'chat') { oShow('act'); $('msg').scrollIntoView({ block: 'center' }); return $('msg').focus({ preventScroll: true }); }
  needBoard();
  const c = $('board').querySelector('.card'); ($('board').hidden || !state.tasks.length ? $('board-empty') : $('board')).scrollIntoView({ block: 'start' });
  if (c) c.focus({ preventScroll: true }); else { $('board').focus({ preventScroll: true }); }
}
// Phones: Chat sits far down the page; the header's chat icon jumps to its message box.
$('tochat').onclick = () => { oShow('act'); $('msg').scrollIntoView({ behavior: smooth(), block: 'center' }); $('msg').focus({ preventScroll: true }); };

document.addEventListener('click', (ev) => {
  const sk = ev.target.closest('[data-skip]'); if (sk) { ev.preventDefault(); return skipTo(sk.dataset.skip); }
  if (ev.target.closest('a[href]')) return; // links (PRs, URLs in chat) open by themselves
  if (ev.target.closest('.card input, .card label')) return; // typing a reject reason doesn't open the card
  const el = ev.target.closest('button, .card, [data-open-task]');
  if (ui.moveMenu && !ev.target.closest('.mvmenu, [data-move]')) { ui.moveMenu = null; render(); }
  if (ui.moveAsk && !ev.target.closest('.mvask, [data-move-to]')) { ui.moveAsk = null; render(); }
  if (!el) return;
  const d = el.dataset;
  if (el.classList.contains('card')) return openTask(Number(d.id));
  if (d.move) { const id = Number(d.move); ui.moveMenu = ui.moveMenu === id ? null : id; render(); reveal(document.querySelector(`.card[data-id="${id}"] .mvmenu`)); return (ui.moveMenu ? document.querySelector(`.card[data-id="${id}"] .mvmenu button`) : document.querySelector(`[data-fk="mv-${id}"]`))?.focus({ preventScroll: true }); }
  if (d.moveTo) { const id = Number(d.moveId); const t = taskById(id); ui.moveMenu = null; if (t && t.status !== d.moveTo) moveTask(t, d.moveTo); render(); return ui.moveAsk?.id === id ? document.querySelector(`.card[data-id="${id}"] .mvask button`)?.focus({ preventScroll: true }) : focusCard(id); }
  if (d.askTo) { const id = Number(d.askId); const t = taskById(id); const { to, force } = ui.moveAsk || {}; ui.moveAsk = null; if (t && to) moveTask(t, to, { force, assignee: d.askTo }); render(); return focusTask(id); }
  if (d.askCancel) { const id = Number(d.askCancel); ui.moveAsk = null; render(); return focusTask(id); }
  if (d.release) { const t = taskById(Number(d.release)); if (t) { moveTask(t, 'open'); render(); } return; }
  if (d.approve) { const id = Number(d.approve); act(api(`/tasks/${id}/decide`, { method: 'POST', body: JSON.stringify({ approve: true }) }), `Approved #${id}: agents can claim it now`).then(() => focusCard(id)).catch(() => {}); return; }
  if (d.reject) { ui.rejecting = Number(d.reject); render(); return $('rj-' + d.reject)?.focus(); }
  if (d.rejectNo) { const id = Number(d.rejectNo); ui.rejecting = null; render(); return document.querySelector(`[data-fk="rj-b-${id}"]`)?.focus(); }
  if (d.limit) { ui.limitForm = d.limit; render(); return $('lu-' + d.limit)?.focus(); }
  if (d.limcancel) { const n = d.limcancel; ui.limitForm = null; render(); return document.querySelector(`[data-fk="lm-${CSS.escape(n)}"]`)?.focus(); }
  if (d.unlimit) { const n = d.unlimit; act(api(`/agents/${encodeURIComponent(n)}`, { method: 'PATCH', body: JSON.stringify({ limited: false }) }), `${n} counts as available again`).catch(() => {}); return; }
  if (d.go === 'ci') { const n = $('ci-note'); n.scrollIntoView({ behavior: smooth(), block: 'center' }); return (n.querySelector('a') || n).focus({ preventScroll: true }); }
  if (d.go === 'proposed') { const c = document.querySelector('.card.proposed'); c?.scrollIntoView({ behavior: smooth(), block: 'center', inline: 'center' }); return c?.focus({ preventScroll: true }); }
  if (d.ping) {
    const t = taskById(Number(d.ping)); if (!t?.assignee) return;
    if (pingedAt(t)) return toast(`Already pinged ${agentRoot(t.assignee)} ${ago(pingedAt(t))}. Give it a few minutes.`);
    const mins = Math.round((Date.now() - t.updated_at) / 60000);
    act(api('/messages', { method: 'POST', body: JSON.stringify({ text: `@${t.assignee} #${t.id} has had no update for ${mins} min. Still on it? If you're stuck, say why here; if you stopped, release it back to open.`, channel: 'general' }) }), `Pinged ${t.assignee} in chat`).catch(() => {});
    return;
  }
  if (d.goQ) return goQuestion(Number(d.goQ));
  if (d.copy) return copyText(d.copy, el);
  if (d.step) { const si = setupInfo(); ui.steps[d.step] = !stepOpen(d.step, si.cur); render(); return reveal($('sb-' + d.step)); }
  if (d.act) return doAct(d.act, el);
  if (d.go && d.go.startsWith('step-')) return goStep(d.go.slice(5));
  if (d.go === 'compose') { oShow('act'); $('msg').scrollIntoView({ behavior: smooth(), block: 'center' }); return $('msg').focus({ preventScroll: true }); }
  if (d.openTask) return openTask(Number(d.openTask));
  if (d.dm) return openDm(d.dm);
  if ('dmBack' in d) { const n = ui.dm; ui.dm = null; store.set('board-dm', ''); $('feed')._html = undefined; render(); return document.querySelector(`[data-fk="dm-${CSS.escape(n || '')}"]`)?.focus({ preventScroll: true }); }
  if (d.mention) return mention(d.mention);
  if ('filter' in d && el.id !== 'filter') { setFilter(filterRoot() === d.filter && d.filter ? '' : d.filter); return; }
  if (d.tab) { ui.tab = d.tab; store.set('board-tab', ui.tab); if (ui.tab === 'me') markMentionsSeen(); if (ui.tab === 'direct') { ui.dm = null; store.set('board-dm', ''); } $('feed')._html = undefined; return render(); }
  if ('showDone' in d) { ui.showAllDone = !ui.showAllDone; return render(); }
  if (d.showCol) { const c = (ui.showCols ||= new Set()); c.has(d.showCol) ? c.delete(d.showCol) : c.add(d.showCol); return render(); }
  if (d.unlock) { ui.confirmLock = d.unlock; render(); return document.querySelector(`[data-fk="un-${CSS.escape(d.unlock)}"]`)?.focus(); }
  if ('unlockNo' in d) { ui.confirmLock = null; return render(); }
  if (d.unlockYes) { const p = d.unlockYes; ui.confirmLock = null; act(api('/locks/release', { method: 'POST', body: JSON.stringify({ paths: [p] }) }), `Released lock on ${p}`).catch(() => {}); return render(); }
  if (d.go === 'questions') { oShow('left'); $('q-panel').scrollIntoView({ behavior: smooth(), block: 'start' }); return $('questions').querySelector('textarea')?.focus({ preventScroll: true }); }
  if (d.go === 'mentions') { ui.tab = 'me'; store.set('board-tab', 'me'); markMentionsSeen(); $('feed')._html = undefined; render(); return oAct(); }
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
    m.scrollIntoView({ behavior: smooth(), block: 'center' }); m.focus({ preventScroll: true }); m.setSelectionRange(m.value.length, m.value.length);
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
  if (d.go === 'review') { $('col-review')?.scrollIntoView({ behavior: smooth(), block: 'center', inline: 'center' }); return ($('col-review')?.querySelector('.card') || $('col-review'))?.focus({ preventScroll: true }); }
  if (d.go === 'stale') { const c = document.querySelector('.card.stale'); c?.scrollIntoView({ behavior: smooth(), block: 'center', inline: 'center' }); return c?.focus({ preventScroll: true }); }
});
document.addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey && ev.key.toLowerCase() === 'k') { ev.preventDefault(); return togglePalette(); }
  const card = ev.target.closest?.('.card');
  if (ev.key === 'Escape' && ui.moveAsk && (card || ev.target.closest?.('.mvask'))) { const id = ui.moveAsk.id; ui.moveAsk = null; render(); return focusTask(id); }
  if (ev.key === 'Escape' && ui.moveMenu && card) { const id = ui.moveMenu; ui.moveMenu = null; render(); return document.querySelector(`[data-fk="mv-${id}"]`)?.focus(); }
  if (card && ev.target === card && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); return openTask(Number(card.dataset.id)); }
  const typing = ev.target.closest?.('input, textarea, select, dialog');
  if (!keysOn || typing || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.key === 'n' || ev.key === 'N') { ev.preventDefault(); openTask(null); }
  else if (ev.key === '?') { ev.preventDefault(); openHelp(); }
  else if (ev.key === '/') { ev.preventDefault(); $('msg').focus(); }
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
  if (['td-name', 'td-deps'].includes(ev.target.id) && ev.target.getAttribute('aria-invalid')) ev.target.removeAttribute('aria-invalid');
  if (['td-prio', 'td-size', 'td-res', 'td-asg'].includes(ev.target.id) && ev.target.getAttribute('aria-invalid')) { ev.target.removeAttribute('aria-invalid'); $('td-err').textContent = ''; }
});
document.addEventListener('submit', async (ev) => {
  const lf = ev.target.closest('[data-limform]');
  if (lf) {
    ev.preventDefault();
    const n = lf.dataset.limform; const tv = $('lu-' + n)?.value || ''; const note = ($('ln-' + n)?.value || '').trim();
    let until = null;
    if (tv) { const [h, mi] = tv.split(':').map(Number); const d = new Date(); d.setHours(h, mi, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); until = d.getTime(); }
    try {
      await api(`/agents/${encodeURIComponent(n)}`, { method: 'PATCH', body: JSON.stringify({ limited: true, until, note }) });
      ui.limitForm = null; toast(`${n} marked out of usage${until ? ` until ${clock(until)}` : ''}. Other agents may take over its tasks.`); scheduleReload(); render();
      document.querySelector(`[data-fk="ul-${CSS.escape(n)}"]`)?.focus();
    } catch (e) { toast(e.message, true); }
    return;
  }
  const rjf = ev.target.closest('[data-rjform]');
  if (rjf) {
    ev.preventDefault();
    const id = Number(rjf.dataset.rjform); const note = (rjf.querySelector('input')?.value || '').trim();
    try {
      await api(`/tasks/${id}/decide`, { method: 'POST', body: JSON.stringify({ approve: false, note }) });
      ui.rejecting = null; toast(`Rejected proposal #${id}`); scheduleReload();
      state.tasks = state.tasks.filter((t) => t.id !== id); render(); // optimistic: it's gone
    } catch (e) { toast(e.message, true); }
    return;
  }
  const gf = ev.target.closest('[data-goalform]');
  if (gf) {
    ev.preventDefault();
    const ta = gf.querySelector('textarea'); const btn = gf.querySelector('button[type=submit]');
    const goal = ta.value.trim(); const inOffice = gf.dataset.goalform === 'o';
    if (!goal) { ui.goalErr = 'Write a sentence or two about what you are building first.'; render(); return $(inOffice ? 'o-goal-in' : 'goal-in')?.focus(); }
    btn.disabled = true;
    try {
      state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify({ goal }) });
      if (inOffice) { ui.oGoalEdit = false; ui.goalErr = ''; toast('Goal saved. The agents will plan from it.'); render(); scheduleReload(); return document.querySelector('[data-fk="o-goal-edit"]')?.focus({ preventScroll: true }); }
      ui.editGoal = false; ui.goalErr = ''; ui.steps.goal = !state.settings.repo || (!Number(state.settings.deadline) && !dlSkipped()); toast(Number(state.settings.deadline) || dlSkipped() ? 'Goal saved. The agents will plan from it.' : 'Goal saved. The agents will plan from it. Now set the demo time below.'); render(); scheduleReload();
      document.querySelector('[data-fk="sh-goal"]')?.focus({ preventScroll: true });
    } catch (e) { toast(e.message, true); btn.disabled = false; }
    return;
  }
  const df = ev.target.closest('[data-dlform]');
  if (df) {
    ev.preventDefault();
    const inOffice = df.dataset.dlform === 'o'; const din = inOffice ? 'o-dl-in' : 'dl-in';
    const v = $(din).value; const ts = v ? new Date(v).getTime() : NaN;
    const fm = Math.max(0, Math.min(600, Math.round(Number($(inOffice ? 'o-fz-in' : 'fz-in').value) || 0)));
    ui.dlErr = '';
    if (!Number.isFinite(ts)) ui.dlErr = 'Pick the date and time of the demo.';
    else if (ts <= Date.now()) ui.dlErr = 'That time has already passed. Pick a time later than now.';
    if (ui.dlErr) { render(); return $(din)?.focus(); }
    const btn = df.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify({ deadline: ts, freeze_minutes: fm }) });
      ui.editDeadline = false; ui.dlErr = '';
      toast(`Demo at ${when(ts)}${fm ? `; feature freeze at ${when(ts - fm * 60e3)}` : ''}. Agents see it too.`);
      if (inOffice) { ui.oDl = false; render(); scheduleReload(); return $('clock').focus({ preventScroll: true }); }
      render(); scheduleReload();
      document.querySelector('[data-fk="dl-edit"]')?.focus({ preventScroll: true });
    } catch (e) { toast(e.message, true); btn.disabled = false; }
    return;
  }
  const nfForm = ev.target.closest('[data-notifyform]');
  if (nfForm) {
    ev.preventDefault();
    const inp = $('nf-url'); const url = inp ? inp.value.trim() : '';
    if (url && !/^https?:\/\//i.test(url)) { ui.nf.err = 'Paste the full webhook address, starting with https://'; render(); return $('nf-url')?.focus(); }
    if (!url && !ui.nf.url) { ui.nf.err = 'Paste a webhook URL first.'; render(); return $('nf-url')?.focus(); }
    const events = [...(ui.nf.events || nfEvents(null))];
    const btn = nfForm.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const r = await api('/notify', { method: 'PUT', body: JSON.stringify(url ? { url, events } : { events }) });
      Object.assign(ui.nf, { url: r?.url ?? (url || ui.nf.url), kind: r?.kind ?? ui.nf.kind, events: r?.events ? nfEvents(r.events) : new Set(events), err: '', change: false });
      if (inp) inp.value = '';
      toast(`Saved. ${NOTIFY_KIND[ui.nf.kind] ? `Sending to ${NOTIFY_KIND[ui.nf.kind]}.` : ''} Press Send test to check it.`); render();
      document.querySelector('[data-fk="nf-test"]')?.focus({ preventScroll: true });
    } catch (e) { ui.nf.err = e.message; btn.disabled = false; render(); $('nf-url')?.focus(); }
    return;
  }
  const rf = ev.target.closest('[data-repoform]');
  if (rf) {
    ev.preventDefault();
    const inp = rf.querySelector('input'); const repo = inp.value.trim();
    if (repo && (/\s/.test(repo) || !/^(https?:\/\/|git@|ssh:\/\/|file:|[\w.-]+\/[\w.-]+)/.test(repo))) { ui.repoErr = 'That doesn\'t look like a git URL. Paste what you\'d put after git clone, e.g. https://github.com/team/project'; render(); return $('repo-in')?.focus(); }
    try {
      state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify({ repo }) });
      ui.editRepo = false; ui.repoErr = ''; toast(repo ? 'Project repo saved. It\'s in the invite message now.' : 'Project repo cleared.'); render(); scheduleReload();
      document.querySelector('[data-fk="repo-edit"], [data-fk="repo-save"]')?.focus({ preventScroll: true });
    } catch (e) { toast(e.message, true); }
    return;
  }
  const f = ev.target.closest('[data-qform]'); if (!f) return;
  ev.preventDefault();
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
});

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
  if (a === 'dl-skip') { store.set('board-dl-skip', '1'); ui.steps.goal = false; render(); toast('No demo time: no countdown or feature freeze. Set one any time in step 2.'); return document.querySelector('[data-fk="sh-goal"]')?.focus({ preventScroll: true }); }
  if (a === 'qr') { ui.qr = !ui.qr; render(); return document.querySelector('[data-fk="qr-tog"]')?.focus({ preventScroll: true }); }
  if (a === 'clock') return oDl(el?.id === 'clock' ? !ui.oDl : true);
  if (a === 'goal') return oGoal(!ui.oGoal);
  if (a === 'merge') return oMerge(!ui.oMerge);
  if (a === 'planner') return oPlan(!ui.oPlan);
  if (a === 'roles') return oRoles(!ui.oRoles);
  if (a === 'o-goal-edit') return oGoal(true, { edit: true });
  if (a === 'o-goal-cancel') { ui.oGoalEdit = false; ui.goalErr = ''; renderDocks(); return document.querySelector('[data-fk="o-goal-edit"]')?.focus(); }
  if (a === 'dl-edit') { ui.editDeadline = true; render(); return $('dl-in')?.focus(); }
  if (a === 'dl-cancel') { ui.editDeadline = false; ui.dlErr = ''; render(); return document.querySelector('[data-fk="dl-edit"]')?.focus(); }
  if (a === 'dl-clear') {
    return api('/settings', { method: 'PUT', body: JSON.stringify({ deadline: '' }) }).then((st) => {
      state.settings = st; ui.editDeadline = false; ui.dlErr = ''; toast('Deadline removed. No countdown or feature freeze.');
      if (ui.oDl) { ui.oDl = false; render(); scheduleReload(); return $('clock').hidden ? focusNow() : $('clock').focus(); }
      render(); scheduleReload();
      $('dl-in')?.focus();
    }).catch((e) => toast(e.message, true));
  }
  if (a === 'setup-open' || a === 'setup-close') {
    if (boardView === 'office') return oSetup(a === 'setup-open');
    store.set('board-setup', a === 'setup-open' ? 'open' : 'closed'); ui.forceSetup = false; render();
    return setupFocus(a === 'setup-open');
  }
  if (a === 'invite') return goStep('invite');
  if (a === 'copy-invite') return copyText(inviteText(), document.querySelector('[data-act="copy-invite"]'), 'Invite copied. Paste it in your team chat.');
  if (a === 'addrs') { ui.addrs = !ui.addrs; return render(); }
  if (a === 'goal-edit') { ui.editGoal = true; render(); const t = $('goal-in'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } return; }
  if (a === 'goal-cancel') { ui.editGoal = false; ui.goalErr = ''; render(); return document.querySelector('[data-fk="goal-edit"]')?.focus(); }
  if (a === 'repo-edit') { ui.editRepo = true; render(); return $('repo-in')?.focus(); }
  if (a === 'repo-cancel') { ui.editRepo = false; ui.repoErr = ''; render(); return document.querySelector('[data-fk="repo-edit"]')?.focus(); }
  if (a === 'done-toggle') {
    const open = !doneOpen(); ui.doneOpen = open ? 'open' : 'closed'; store.set('board-done', ui.doneOpen); render();
    return document.querySelector(`[data-fk="${open ? 'done-close' : 'done-tog'}"]`)?.focus({ preventScroll: true });
  }
  if (a === 'new-task') return openTask(null);
  if (a === 'clear-search') { tv.q = ''; $('tsearch').value = ''; renderBoard(); renderOffice(); return $('tsearch').focus(); }
}
function goStep(key, focus) {
  const si = setupInfo();
  if (boardView === 'office') { if (!ui.oSetup) oSetup(true, false); }
  else if (!setupOpen(si.complete)) ui.forceSetup = true; // open for this visit only
  ui.steps[key] = true; render();
  const li = $('step-' + key); if (!li) return;
  li.scrollIntoView({ behavior: smooth(), block: 'start' });
  if (focus === 'dl' && !ui.editDeadline) { ui.editDeadline = true; render(); }
  if (focus === 'dl') { const n = li.querySelector('#dl-in, [data-fk="dl-edit"]'); if (n) { n.scrollIntoView({ behavior: smooth(), block: 'center' }); return n.focus({ preventScroll: true }); } }
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
function openHelp() { if (!helpDlg.open) helpDlg.showModal(); helpDlg.querySelector('.x').focus(); }
$('help-btn').onclick = openHelp;
helpDlg.addEventListener('click', (ev) => { if (ev.target.closest('[data-close]')) return helpDlg.close();
  if (ev.target === helpDlg) { const r = helpDlg.getBoundingClientRect(); if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) helpDlg.close(); } });

function setFilter(v) { ui.filter = v; store.set('board-filter', v); render(); }
$('filter').addEventListener('change', (e) => setFilter(e.target.value));
function markMentionsSeen() {
  const max = Math.max(seenMention, ...state.events.filter(mentionsMe).map((e) => e.id));
  if (max !== seenMention) { setSeenMention(max); store.set('board-seen-mention', String(max)); }
}
function mention(name) {
  oShow('act');
  if ($('task-dlg').open) $('task-dlg').close();
  if (ui.tab === 'direct') { ui.tab = 'all'; store.set('board-tab', 'all'); $('feed')._html = undefined; render(); }
  const m = $('msg'); const tagText = '@' + name + ' ';
  if (!m.value.includes(tagText)) m.value = (m.value && !/\s$/.test(m.value) ? m.value + ' ' : m.value) + tagText;
  m.focus(); m.setSelectionRange(m.value.length, m.value.length); growMsg(); closeAc();
}

// ---------- task dialog ----------
const dlg = $('task-dlg');
const FIELDS = { title: () => $('td-name').value, description: () => $('td-desc').value, priority: () => Number($('td-prio').value), size: () => $('td-size').value, reserved_for: () => $('td-res').value || null, assignee: () => $('td-asg').value || null, status: () => $('td-status').value };
const SETF = { title: (v) => { $('td-name').value = v; }, description: (v) => { $('td-desc').value = v; }, priority: (v) => { $('td-prio').value = String(v); }, size: (v) => { $('td-size').value = v || 'M'; }, reserved_for: (v) => { resOptions(v); }, assignee: (v) => { asgOptions(v); }, status: (v) => { $('td-status').value = v; } };
const FNAME = { title: 'title', description: 'description', priority: 'priority', size: 'size', reserved_for: 'reservation', assignee: 'assignee', status: 'status' };
// The Assign-to and Reserve-for lists: agents that can work now first, then the rest, each a–z; and why not.
const availRank = (a) => ({ online: 0, waiting: 1, limited: 2, offline: 3 }[agentState(a)]);
const byAvailable = (a, b) => availRank(a) - availRank(b) || a.name.localeCompare(b.name);
const availText = (a) => ({ waiting: ' · not started', limited: ` · ${limitText(a)}`, offline: ' · offline' }[agentState(a)] || '');
// "Assigned to": agents on the board (helpers like alice/ui-worker stay listed while they hold it).
function asgOptions(value) {
  const sel = $('td-asg'); const cur = value !== undefined ? value || '' : sel.value;
  const ags = [...agentInfo().values()].filter((a) => a.started || a.online).sort(byAvailable);
  const opts = [['', 'Nobody (unassigned)'], ...ags.map((a) => [a.name, `${a.name} · ${[a.client, a.plan].filter(Boolean).join(', ') || 'agent'}${availText(a)}`])];
  if (cur && !opts.some(([v]) => v === cur)) opts.push([cur, cur]);
  const html = opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  if (sel._html !== html) { sel.innerHTML = html; sel._html = html; }
  sel.value = cur;
}
// "Reserve for…": started agents (with tool and plan), plus whoever it's reserved for now. Keeps the current choice.
function resOptions(value) {
  const sel = $('td-res'); const cur = value !== undefined ? value || '' : sel.value;
  const ags = [...agentInfo().values()].filter((a) => a.started).sort(byAvailable);
  const opts = [['', 'Anyone (no reservation)'], ...ags.map((a) => [a.name, `${a.name} · ${[a.client, a.plan].filter(Boolean).join(', ') || 'agent'} · ${capText(a)} tasks${availText(a)}`])];
  if (cur && !opts.some(([v]) => v === cur)) opts.push([cur, `${cur} (not started)`]);
  const html = opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  if (sel._html !== html) { sel.innerHTML = html; sel._html = html; }
  sel.value = cur;
}
// Server validation errors (400 {error}), shown inline next to the field they're about.
function fieldError(msg) {
  const m = String(msg || '');
  if (/depends_on|unknown task id/i.test(m)) {
    const ids = (m.match(/:\s*([\d,\s#-]+)$/) || [])[1];
    return { el: 'td-deps', text: `Depends on: there's no task ${ids ? ids.trim().split(/[\s,]+/).map((x) => '#' + x.replace(/^#/, '')).join(', ') : 'with that id'}. Check the ids (it may have been deleted).` };
  }
  if (/priority/i.test(m)) return { el: 'td-prio', text: 'Priority must be P1, P2 or P3.' };
  if (/size/i.test(m)) return { el: 'td-size', text: 'Size must be S, M or L.' };
  if (/title/i.test(m)) return { el: 'td-name', text: m.replace(/^title/, 'Title') + '.' };
  if (/reserve/i.test(m)) return { el: 'td-res', text: m };
  return { el: null, text: m };
}
function showFieldError(msg) {
  const f = fieldError(msg); $('td-err').textContent = f.text;
  if (!f.el) return;
  const n = $(f.el); if (n.closest('[hidden]')) return;
  n.setAttribute('aria-invalid', 'true'); n.focus();
}
// Fields the human has changed in the dialog (compared with the task as it was when they started editing it).
const editedFields = () => (editing ? Object.keys(FIELDS).filter((f) => FIELDS[f]() !== editing[f]) : []);
const dlgDirty = () => (editing ? editedFields().length > 0 : !!($('td-name').value.trim() || $('td-desc').value.trim() || $('td-deps').value.trim()));
function openTask(id) {
  const t = id ? taskById(id) : null;
  if (id && !t) return toast(`Task #${id} no longer exists`, true);
  editing = t ? JSON.parse(JSON.stringify(t)) : null;
  $('td-title').textContent = t ? `Task #${t.id}` : 'New task';
  $('td-name').value = t?.title || '';
  $('td-desc').value = t?.description || '';
  $('td-prio').value = String(t?.priority || 2);
  if (editing) { editing.size = editing.size || 'M'; editing.reserved_for = editing.reserved_for || null; editing.assignee = editing.assignee || null; }
  $('td-size').value = t?.size || 'M';
  resOptions(t?.reserved_for || '');
  asgOptions(t?.assignee || ''); $('td-asg-wrap').hidden = !t; $('td-asg-hint').hidden = !t;
  $('td-status').innerHTML = [...(t?.status === 'proposed' ? ['proposed'] : []), ...STATUSES].map((s) => `<option value="${s}">${LABEL[s]}</option>`).join('');
  $('td-status').value = t?.status || 'open';
  $('td-status-wrap').hidden = !t;
  $('td-deps-wrap').hidden = !!t;
  $('td-deps').value = '';
  $('td-err').textContent = ''; $('td-status-hint').textContent = t ? HINT[t.status] + '.' : ''; $('td-status-hint').classList.add('vh'); $('td-status').title = t ? HINT[t.status] : '';
  for (const n of ['td-name', 'td-deps', 'td-prio', 'td-size', 'td-res']) $(n).removeAttribute('aria-invalid');
  $('td-conflict').hidden = true; $('td-discard').hidden = true;
  $('td-save').textContent = t ? 'Save changes' : 'Create task';
  // A proposal: Approve and Reject… (an approved task can be cancelled like any other).
  const prop = t?.status === 'proposed';
  $('td-approve').hidden = !prop; $('td-reject').hidden = !prop;
  $('td-hist-wrap').hidden = !t;
  $('td-history')._html = undefined;
  $('td-mention').hidden = !t?.assignee;
  // One destructive button: Cancel task… (Delete is offered in its confirmation); a done task can't be cancelled, so
  // its footer has Delete task instead.
  const del = $('td-delete'); const doneT = t?.status === 'done';
  if (doneT) $('td-cancel').before(del); else $('td-del-alt').append(del);
  del.className = doneT ? 'ghost dz' : 'ghost sm'; del.hidden = !t; resetDelete();
  $('td-cancel').hidden = !t || t.status === 'done' || prop; resetCancel();
  dlg.style.marginTop = ''; dlg.style.maxHeight = '';
  if (!dlg.open) dlg.showModal();
  renderDialogLive(); syncSave();
  // Pinned where it opened: what opens inside it later (a reason field, a note) makes it grow downward, never jump.
  const top = dlg.offsetTop; dlg.style.marginTop = top + 'px'; dlg.style.maxHeight = `calc(100vh - ${top + 12}px)`;
  // A blocked task with a question: the answer box is the job; otherwise the title.
  ($('td-block').querySelector('textarea') || $('td-name')).focus();
}
function renderDialogLive() {
  const t = editing && taskById(editing.id);
  if (!editing) { $('td-meta').innerHTML = ''; renderTaskBlock(null); $('td-deps-hint').textContent = 'Task ids that must be done before this can be claimed. Optional.'; $('td-deps-hint').classList.add('vh'); resOptions(); return; }
  if (!t) { $('td-conflict').hidden = false; $('td-conflict').textContent = 'This task no longer exists.'; return; }
  // Fields the human didn't touch follow the server; a warning only when one they DID edit changed underneath them.
  const mine = editedFields();
  const norm = (f, v) => (f === 'size' ? v || 'M' : f === 'reserved_for' || f === 'assignee' ? v || null : v);
  for (const f of Object.keys(FIELDS)) if (!mine.includes(f) && norm(f, t[f]) !== editing[f]) { SETF[f](norm(f, t[f])); editing[f] = norm(f, t[f]); }
  resOptions(mine.includes('reserved_for') ? undefined : editing.reserved_for); // agent list stays current
  asgOptions(mine.includes('assignee') ? undefined : editing.assignee);
  editing.branch = t.branch;
  const clash = mine.filter((f) => norm(f, t[f]) !== editing[f]);
  $('td-conflict').hidden = !clash.length;
  if (clash.length) $('td-conflict').textContent = `While you were editing, someone else changed the ${clash.map((f) => FNAME[f]).join(' and ')}${clash.includes('status') ? ` (now ${LABEL[t.status]})` : ''}. Saving replaces it with your version.`;
  $('td-mention').hidden = !t.assignee;
  renderTaskBlock(t);
  const deps = t.depends_on.map((d) => { const x = taskById(d); return `<button type="button" class="link tref" data-open-task="${d}">#${d}</button> ${x ? `(${LABEL[x.status]})` : '(missing)'}`; });
  syncSave();
  // The status and the assignee are the fields below; the meta line says what they don't.
  patch($('td-meta'), [
    t.branch ? `<span>branch <code>${esc(t.branch)}</code></span>` : '',
    (() => { const pr = prInfo(t); return pr ? `<span>pull request <a href="${esc(pr.url)}" target="_blank" rel="noopener noreferrer">${esc(pr.url.replace(/^https?:\/\/(www\.)?/, ''))}</a>${pr.text ? ` <span class="pill ${pr.cls}">${esc(pr.text)}</span>` : ''}</span>${prFeedback(t)}` : ''; })(),
    t.status === 'review' && t.reviewer ? `<span>being merged by ${who(t.reviewer)}</span>` : '',
    t.assignee && HOLDING.includes(t.status) && agentLimited(t.assignee) ? '<span class="pill warn">owner out of usage — agents may take it over</span>' : '',
    `<span>created by ${who(t.created_by)} ${ago(t.created_at)}</span>`,
    `<span>updated ${ago(t.updated_at)}</span>`,
    isStale(t) ? `<span class="pill flag">stale: no update for 15+ min${t.assignee && ownerOffline(t) ? ' · owner offline — agents may take it over' : ''}</span>` : '',
  ].join(''));
  $('td-deps-hint').innerHTML = deps.length ? `Depends on ${deps.join(', ')}. Dependencies are fixed after creation.` : ''; $('td-deps-hint').classList.remove('vh');
  const h = $('td-history'); const before = h._html;
  const evs = state.events.filter((e) => e.task_id === t.id);
  patch(h, evs.map((e, i) => evHtml(e, evs[i - 1])).join('') || '<div class="muted empty-note">No activity yet.</div>');
  if (before !== h._html) h.scrollTop = h.scrollHeight; // newest at the bottom, in view
}
// Blocked: the reason first, then the agent's open question with an answer box, then the way back to In progress.
function renderTaskBlock(t) {
  const el = $('td-block'); const blocked = t?.status === 'blocked';
  el.hidden = !blocked;
  if (!blocked) return patch(el, '');
  const note = blockedNote(t); const q = openQuestions().find((x) => x.task_id === t.id);
  patch(el, `<p class="tb-why"><b>Blocked:</b> ${note ? esc(note) : '<span class="muted">no reason given. Ask in chat with Message assignee.</span>'}</p>
    ${q ? `<div class="tb-q"><div class="t-meta muted">${who(q.asker, true)} asked ${ago(q.created_at)}</div><div class="qt">${fmt(q.question, true)}</div>
      <div class="tb-qa"><label class="vh" for="tdqa-${q.id}">Answer to ${esc(q.asker)}</label><textarea id="tdqa-${q.id}" data-keep="tdqa-${q.id}" data-tdq="${q.id}" data-asker="${esc(q.asker)}" rows="1" placeholder="Your answer" title="Enter sends · Shift+Enter adds a new line" aria-describedby="tdqe-${q.id}"></textarea><button type="button" data-td-answer="${q.id}" data-fk="tdqb-${q.id}">Answer</button></div>
      <div class="err" id="tdqe-${q.id}" role="alert"></div></div>` : ''}
    <div class="inl"><button type="button" class="ghost sm" data-td-unblock data-fk="td-unblock" title="${t.assignee ? `Unblocked: ${esc(t.assignee)} carries on` : 'Unblocked: back to work'}">Back to In progress</button></div>`);
}
async function answerFromDialog(qid) {
  const ta = $('tdqa-' + qid); const b = document.querySelector(`[data-td-answer="${qid}"]`); if (!ta || !b) return;
  const answer = ta.value.trim(); const err = $('tdqe-' + qid);
  if (!answer) { err.textContent = 'Type an answer first.'; ta.setAttribute('aria-invalid', 'true'); return ta.focus(); }
  b.disabled = true; b.textContent = 'Sending…';
  try { await sendAnswer(qid, ta.dataset.asker, answer); document.querySelector('[data-fk="td-unblock"]')?.focus(); }
  catch (e) { b.disabled = false; b.textContent = 'Answer'; if (e.message !== 'Token rejected') { err.textContent = `Not sent: ${e.message}`; ta.focus(); } }
}
$('td-block').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && ev.target.dataset?.tdq) { ev.preventDefault(); answerFromDialog(Number(ev.target.dataset.tdq)); }
});
$('td-block').addEventListener('click', (ev) => {
  const a = ev.target.closest('[data-td-answer]'); if (a) return answerFromDialog(Number(a.dataset.tdAnswer));
  if (ev.target.closest('[data-td-unblock]')) { const t = editing && taskById(editing.id); if (t && t.status === 'blocked') { moveTask(t, 'in_progress'); render(); } }
});
$('td-status').addEventListener('change', () => {
  const s = $('td-status').value;
  const more = s === 'open' && editing?.assignee ? ' Moving back to Open unassigns it and frees its file locks.' : s === 'done' ? ' Marking done frees any file locks held for this task.' : '';
  $('td-status-hint').textContent = HINT[s] + '.' + more; $('td-status').title = HINT[s];
  $('td-status-hint').classList.toggle('vh', !more); // shown only when the change does something more than its name says
});
// Closing with unsaved edits asks first (inline, no browser popup).
function requestCloseTask() { if (dlgDirty() && $('td-discard').hidden) { $('td-discard').hidden = false; $('td-keep').focus(); return; } dlg.close(); }
dlg.addEventListener('cancel', (ev) => { if (dlgDirty() && $('td-discard').hidden) { ev.preventDefault(); requestCloseTask(); } });
$('td-keep').onclick = () => { $('td-discard').hidden = true; $('td-name').focus(); };
$('td-drop').onclick = () => dlg.close();
dlg.addEventListener('click', (ev) => { if (ev.target.closest('[data-close]')) return requestCloseTask();
  if (ev.target === dlg) { const r = dlg.getBoundingClientRect(); if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) requestCloseTask(); } });
// Closed: focus goes back where it was (the browser does that), or to the task's card when that's gone or the task was
// opened from the palette (dlgBackTo).
let dlgBackTo = null;
function setDlgBackTo(id) { dlgBackTo = id; }
dlg.addEventListener('close', () => {
  const id = editing?.id; const back = dlgBackTo; dlgBackTo = null;
  editing = null; $('td-discard').hidden = true; resetCancel();
  setTimeout(() => { const a = document.activeElement; if (id && (back === id || !a || a === document.body)) focusTask(id); });
});
$('td-desc').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); $('task-form').requestSubmit(); } });
$('td-mention').onclick = () => { const a = editing?.assignee; const id = editing?.id; if (a) { mention(a); $('msg').value += `re #${id}: `; growMsg(); } };
// Delete asks for a second click (inline confirm, no browser popup).
let deleteArmed = null;
function resetDelete() { clearTimeout(deleteArmed); deleteArmed = null; $('td-delete').textContent = 'Delete task'; $('td-delete').classList.remove('danger'); }
$('td-delete').onclick = async () => {
  const t = editing; if (!t) return;
  if (!deleteArmed) {
    $('td-delete').textContent = `Click again to delete #${t.id}`; $('td-delete').classList.add('danger');
    deleteArmed = setTimeout(resetDelete, 5000);
    return;
  }
  resetDelete();
  try {
    await api(`/tasks/${t.id}`, { method: 'DELETE' });
    dlg.close(); toast(`Deleted #${t.id} ${t.title}`); scheduleReload();
  } catch (e) { $('td-err').textContent = `Couldn't delete: ${e.message}`; }
};
// Cancel: like delete it removes the task, but records why in the feed and @-mentions the assignee. Two clicks.
let cancelArmed = null;
function resetCancel() {
  resetDelete(); cancelArmed = null; $('td-cancel').textContent = 'Cancel task…'; $('td-cancel').classList.remove('danger'); $('td-cancel-row').hidden = true; $('td-cancel-reason').value = '';
  rejectArmed = false; $('td-reject').textContent = 'Reject…'; $('td-reject').classList.remove('danger'); $('td-rej-row').hidden = true; $('td-rej-reason').value = '';
  const prop = editing?.status === 'proposed'; $('td-cancel').hidden = !editing || editing.status === 'done' || prop; $('td-reject').hidden = !prop;
  $('td-keep-task').hidden = true; dlg.classList.remove('confirming');
}
// Asking: the footer is only the question (CSS hides Save, Close, Message assignee and Approve), with Keep task.
function confirmMode(btn) {
  dlg.classList.add('confirming'); $('td-keep-task').hidden = false;
  for (const b of ['td-cancel', 'td-reject']) if ($(b) !== btn) $(b).hidden = true;
}
$('td-keep-task').onclick = () => { const b = rejectArmed ? $('td-reject') : $('td-cancel'); resetCancel(); b.focus(); };
$('td-cancel').onclick = async () => {
  const t = editing; if (!t) return;
  if (!cancelArmed) {
    $('td-cancel').textContent = `Cancel #${t.id}`; $('td-cancel').classList.add('danger');
    $('td-cancel-row').hidden = false; confirmMode($('td-cancel')); $('td-cancel-reason').focus();
    cancelArmed = true;
    return;
  }
  const reason = $('td-cancel-reason').value.trim();
  resetCancel();
  try {
    await api(`/tasks/${t.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
    dlg.close(); toast(`Cancelled #${t.id} ${t.title}`); scheduleReload();
  } catch (e) { $('td-err').textContent = `Couldn't cancel: ${e.message}`; }
};
// Reject… (a proposal): why, then Reject #id; the proposer is told.
let rejectArmed = false;
$('td-reject').onclick = async () => {
  const t = editing; if (!t) return;
  if (!rejectArmed) {
    rejectArmed = true; $('td-reject').textContent = `Reject #${t.id}`; $('td-reject').classList.add('danger');
    $('td-rej-l').textContent = `Why reject it? (optional, sent to ${t.created_by})`;
    $('td-rej-row').hidden = false; confirmMode($('td-reject')); $('td-rej-reason').focus();
    return;
  }
  const note = $('td-rej-reason').value.trim();
  try {
    await api(`/tasks/${t.id}/decide`, { method: 'POST', body: JSON.stringify({ approve: false, note }) });
    dlg.close(); toast(`Rejected proposal #${t.id}`); scheduleReload();
    state.tasks = state.tasks.filter((x) => x.id !== t.id); render(); // optimistic: it's gone
  } catch (e) { $('td-err').textContent = `Couldn't reject: ${e.message}`; }
};
for (const [inp, btn] of [['td-cancel-reason', 'td-cancel'], ['td-rej-reason', 'td-reject']]) $(inp).addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); $(btn).click(); } });
// Save changes: only once a field differs from the task (a new task always has Create task).
function syncSave() { $('td-save').hidden = !!editing && !dlgDirty(); }
$('task-form').addEventListener('input', syncSave); $('task-form').addEventListener('change', syncSave);
// Approve (a proposal): any edits are saved first, through the form, then it's approved.
let approving = false;
$('td-approve').onclick = () => { approving = true; $('task-form').requestSubmit(); };
$('task-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const approve = approving && editing?.status === 'proposed'; approving = false;
  const err = $('td-err'); err.textContent = '';
  const title = $('td-name').value.trim();
  if (!title) { err.textContent = 'Give the task a title.'; $('td-name').setAttribute('aria-invalid', 'true'); return $('td-name').focus(); }
  const description = $('td-desc').value; const priority = Number($('td-prio').value);
  const size = $('td-size').value; const reserved_for = $('td-res').value || null;
  const btn = $('td-save'); const btnText = btn.textContent; btn.disabled = true; btn.textContent = editing ? 'Saving…' : 'Creating…';
  try {
    if (editing) {
      const o = editing; const body = {};
      if (title !== o.title) body.title = title;
      if (description !== o.description) body.description = description;
      if (priority !== o.priority) body.priority = priority;
      if (size !== o.size) body.size = size;
      if (reserved_for !== o.reserved_for) body.reserved_for = reserved_for || '';
      const assignee = $('td-asg').value || null; const to = $('td-status').value;
      // A status change goes through moveTask, like Move… and drag: it asks who a Claimed / In progress
      // task is for (unless Assign to is set here) and offers "Move anyway" past unfinished dependencies.
      const move = to !== o.status && !approve;
      if (assignee !== o.assignee && !(move && assignee)) body.assignee = assignee || '';
      if (Object.keys(body).length) {
        const saved = await api(`/tasks/${o.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        noteSave(o.id, body, saved);
        if (!move && !approve) toast(`Saved #${o.id}`);
        scheduleReload();
      }
      if (approve) { await api(`/tasks/${o.id}/decide`, { method: 'POST', body: JSON.stringify({ approve: true }) }); toast(`Approved #${o.id}: agents can claim it now`); scheduleReload(); }

      if (move) {
        const t = taskById(o.id) || o; if ('assignee' in body) t.assignee = assignee;
        dlg.close();
        moveTask(t, to, assignee && assignee !== t.assignee ? { assignee } : {});
        return;
      }
    } else {
      const raw = $('td-deps').value.split(/[\s,]+/).map((s) => s.replace(/^#/, '')).filter(Boolean);
      const bad = raw.filter((s) => !/^\d+$/.test(s) || !taskById(Number(s)));
      if (bad.length) { err.textContent = `Unknown task id${bad.length > 1 ? 's' : ''}: ${bad.join(', ')}`; $('td-deps').setAttribute('aria-invalid', 'true'); $('td-deps').focus(); return; }
      const t = await api('/tasks', { method: 'POST', body: JSON.stringify({ title, description, priority, size, depends_on: [...new Set(raw.map(Number))] }) });
      // Reservations are set on an existing task; if that part fails, the task still exists: say so.
      if (reserved_for) {
        try { await api(`/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify({ reserved_for }) }); }
        catch (e) { toast(`Created #${t.id}, but couldn't reserve it: ${e.message}`, true); scheduleReload(); dlg.close(); return; }
      }
      toast(`Created #${t.id} ${t.title}${reserved_for ? ` (reserved for ${reserved_for})` : ''}`); scheduleReload();
    }
    dlg.close();
  } catch (e) { showFieldError(e.message); }
  finally { btn.disabled = false; btn.textContent = btnText; }
});
$('new-task-btn').onclick = () => openTask(null);
// Someone else saves over what I just saved (two people editing one task): tell me, once. Only the text
// fields: status and assignee change all the time as agents work. Watched for 10 minutes after my save.
const OVERWRITE_FIELDS = ['title', 'description', 'priority', 'size', 'reserved_for'];
const mySaves = new Map();
function noteSave(id, body, saved) {
  const vals = {}; for (const f of OVERWRITE_FIELDS) if (f in body) vals[f] = (saved && f in saved ? saved[f] : body[f]) ?? null;
  if (Object.keys(vals).length) mySaves.set(id, { vals, at: Date.now() });
}
function checkOverwrites(s) {
  for (const [id, sv] of mySaves) {
    const t = s.tasks.find((x) => x.id === id);
    if (!t || Date.now() - sv.at > 10 * 60e3) { mySaves.delete(id); continue; }
    const changed = Object.keys(sv.vals).filter((f) => (t[f] ?? null) !== sv.vals[f] && !(f === 'reserved_for' && !t[f] && !sv.vals[f]));
    if (!changed.length) continue;
    mySaves.delete(id);
    const by = [...(s.events || [])].reverse().find((e) => e.task_id === id && e.kind === 'task_updated' && e.ts >= sv.at && e.author !== me)?.author;
    toast(`#${id} was changed by ${by || 'someone else'} after you saved it (${changed.map((f) => FNAME[f] || f).join(', ')}).`, false, { label: 'Open', run: () => openTask(id) });
  }
}

// ---------- theme ----------
// Auto (Dark or Light, following the OS) or one of the fifteen themes (window.THEMES in <head>, generated by
// scripts/themes.mjs: id -> [name, page colour, 1 when light]). The saved value is shared with the presenters and the
// Boards page; anything unknown reads as Auto (window.themeOf).
// Chooser order, 4 to a row: Auto and the basics, then each light theme beside its dark partner (Day | Night, Paper | Terminal...).
const THEME_ORDER = ['auto', 'light', 'dark', 'contrast', 'day', 'night', 'paper', 'terminal', 'sticky', 'sunset', 'candy', 'synthwave', 'coral', 'ocean', 'dusk', 'forest'];
const THEME_LIST = (() => { const all = [['auto', 'Auto', 'Dark or Light, following the device'], ...Object.entries(window.THEMES).map(([v, [l, , lt]]) => [v, l, lt ? 'light' : 'dark'])];
  const at = (v) => { const i = THEME_ORDER.indexOf(v); return i < 0 ? 99 : i; };
  return all.sort((a, b) => at(a[0]) - at(b[0])); })();
let themePref = 'auto';
function setThemePref(t) { themePref = t; }
try { themePref = window.themeOf(localStorage.getItem('board-theme')); } catch {}
// The chooser's tiles: a tiny board in each theme (Auto: Dark and Light side by side), its name under it.
const miniBoard = (t) => `<span class="mini" data-tp="${t}"><span class="mp"><span class="mb a"></span><span class="mb"></span><span class="mb x"></span></span><span class="mp"><span class="mb"></span><span class="mb o"></span><span class="mb n"></span><span class="mb w"></span></span><span class="mp"><span class="mb"></span><span class="mb o"></span><span class="mb"></span></span></span>`;
$('tp-grid').innerHTML = THEME_LIST.map(([v, l, d], i) => `<button type="button" class="tile" role="radio" data-theme-set="${v}" aria-checked="false" tabindex="-1" title="${v === 'auto' ? d : `${l} (${d})`}"><span aria-hidden="true" class="${v === 'auto' ? 'mini split' : ''}">${v === 'auto' ? miniBoard('dark') + miniBoard('light') : miniBoard(v)}</span><span class="nm">${l}</span></button>`).join('');
function syncThemeButtons() {
  for (const b of document.querySelectorAll('[data-theme-set]')) {
    const on = b.dataset.themeSet === themePref;
    // The chooser is a radio group: one Tab stop, on the current theme.
    b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1;
  }
  const l = THEME_LIST.find(([v]) => v === themePref) || THEME_LIST[0];
  const sw = $('theme-sw'); sw.className = 'sw sw-' + l[0]; sw.dataset.tp = l[0];
  $('theme-btn').setAttribute('aria-label', `Theme: ${l[1]}. Change it`); $('theme-btn').title = `Theme: ${l[1]}`;
}
function setTheme(t) {
  themePref = window.applyTheme(t);
  try { localStorage.setItem('board-theme', themePref); } catch {}
  syncThemeButtons();
  office.mod?.setTheme(scenePalette());
}
// Under the theme button, kept inside the window, no taller than the room below the header (it scrolls inside itself
// when that is short). Phones: a sheet from the bottom (CSS).
function placeThemePop() {
  const p = $('theme-pop');
  if (matchMedia('(max-width: 760px)').matches) { p.style.removeProperty('--tp-top'); p.style.removeProperty('--tp-right'); p.style.removeProperty('--tp-max'); return; }
  const r = $('theme-btn').getBoundingClientRect();
  p.style.setProperty('--tp-top', Math.round(r.bottom + 8) + 'px');
  p.style.setProperty('--tp-max', Math.max(160, Math.round(innerHeight - r.bottom - 16)) + 'px');
  p.style.setProperty('--tp-right', Math.round(Math.max(8, Math.min(innerWidth - r.right, innerWidth - p.offsetWidth - 8))) + 'px');
}
// One theme control for both views: the header's swatch button opens the chooser. A click (or Enter, Space) picks a
// theme and closes it; arrow keys move through the grid (left/right along it, up/down a row) and apply as they go,
// Home and End too; Esc or a click elsewhere closes it and focus goes back to the button.
function themePop(open, focus = true) {
  ui.themeOpen = open; $('theme-pop').hidden = !open; $('theme-btn').setAttribute('aria-expanded', String(open));
  if (open) placeThemePop();
  if (open && (ui.oGoal || ui.oDl || ui.oMerge || ui.oPlan || ui.oRoles)) { ui.oGoal = false; ui.oDl = false; ui.oMerge = false; ui.oPlan = false; ui.oRoles = false; renderDocks(); }
  if (!focus) return;
  if (open) $('theme-pop').querySelector('[aria-checked="true"]')?.focus({ preventScroll: true }); else $('theme-btn').focus({ preventScroll: true });
}
document.addEventListener('click', (ev) => {
  const b = ev.target.closest?.('[data-theme-set]');
  if (b) { setTheme(b.dataset.themeSet); if (b.closest('#theme-pop')) themePop(false); return; }
  if (ev.target.closest?.('#theme-btn')) return themePop(!ui.themeOpen);
  if (ui.themeOpen && !ev.target.closest?.('#theme-pop')) themePop(false, false);
});
addEventListener('resize', () => { if (ui.themeOpen) placeThemePop(); });
$('theme-pop').addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); return themePop(false); }
  if (ev.key === 'Tab') return themePop(false, false);
  const rs = [...$('theme-pop').querySelectorAll('[role="radio"]')]; const i = rs.indexOf(document.activeElement);
  if (i < 0) return;
  // Up / down: the tile in the row above / below nearest to this one's column (the rows aren't all full).
  const tops = [...new Set(rs.map((b) => b.offsetTop))].sort((a, b) => a - b), n = rs.length;
  const vert = (d) => { const r = tops[tops.indexOf(rs[i].offsetTop) + d]; if (r === undefined) return i;
    const row = rs.filter((b) => b.offsetTop === r); const x = rs[i].offsetLeft; return rs.indexOf(row.reduce((m, b) => (Math.abs(b.offsetLeft - x) < Math.abs(m.offsetLeft - x) ? b : m))); };
  const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, ArrowDown: ev.key === 'ArrowDown' ? vert(1) : i, ArrowUp: ev.key === 'ArrowUp' ? vert(-1) : i, Home: 0, End: n - 1 }[ev.key];
  if (to === undefined) return;
  ev.preventDefault();
  if (to !== i) setTheme(rs[to].dataset.themeSet);
  rs[to].focus(); rs[to].scrollIntoView({ block: 'nearest' });
});
syncThemeButtons();

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

// ---------- the panels, the same in both views ----------
// Needs attention (left), Agents, Activity and File locks (right), the top bar with the goal, the demo time under the header
// clock. One fold state for both views (oUi), one way to open each panel again: a dock folds to its chip, Activity
// and File locks (and the 3D Tasks window) to their title bars.
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
// The task board starts expanded over the room (board first) and open; File locks start folded. Folding, expanding or
// docking one yourself is remembered. ?view=office docks it for that visit.
const oTasksOff = () => (typeof oUi.tasks === 'boolean' ? oUi.tasks : false);
const oMax = () => (office.dockOnce ? false : typeof oUi.max === 'boolean' ? oUi.max : true);
// Expanded <-> docked: the board's top edge slides between the top bar and the window's place at the foot (its glass
// covering the room above it as it goes, or uncovering it); one element, the columns inside it the same. Instant with
// reduced motion or when it's folded.
let oSlide = null;
function oExpand(on) {
  const tw = $('o-tasks'), r0 = tw.getBoundingClientRect(), shown = boardView === 'office' && !oTasksOff() && !!tw.offsetHeight;
  office.dockOnce = false; oUi.max = on; oSave(); oApply(); office.mod?.resize();
  oSlide?.cancel(); oSlide = null;
  if (!shown || reduceMotion()) return;
  const r1 = tw.getBoundingClientRect(), o = $('office-view').getBoundingClientRect();
  if (Math.abs(r0.top - r1.top) < 2) return;
  oSlide = tw.animate([{ top: `${r0.top - o.top}px`, height: 'auto' }, { top: `${r1.top - o.top}px`, height: 'auto' }], { duration: 420, easing: 'cubic-bezier(.4, 0, .2, 1)' });
  oRate(); // the room holds still while the board slides (its camera eases once it has landed), so the slide stays smooth
  oSlide.finished.then(() => { oSlide = null; oRate(); oFrame(); }).catch(() => {});
}
const oLocksOff = () => (typeof oUi.locks === 'boolean' ? oUi.locks : store.get('board-locks') !== 'open');
const oOff = (w) => (w === 'tasks' ? oTasksOff() : w === 'locks' ? oLocksOff() : w === 'act' ? !!oUi.actOff : !!oUi[w]);
// The Tasks window's maximise / restore icons (corners out, corners in).
const O_MAX = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>', O_RESTORE = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2v4H2M10 2v4h4M14 10h-4v4M2 10h4v4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
// A top bar popover sits under its chip, inside the window: on a phone, where the top bar can be low on the screen, it
// moves up until it fits.
function placePop(id, chipId, wDef = 460) {
  const p = $(id); const c = $(chipId); const r = c?.offsetWidth ? c.getBoundingClientRect() : null; const w = p.offsetWidth || wDef;
  p.style.left = `${Math.max(8, Math.min((r ? r.left : 8), innerWidth - w - 8))}px`;
  if (r) p.style.top = `${Math.round(Math.max(8, Math.min(r.bottom + 8, innerHeight - p.offsetHeight - 8)))}px`;
}
function oApply() {
  const m = $('main');
  for (const s of ['left', 'right']) {
    $('o-' + s).hidden = !!oUi[s]; $('o-' + s + '-pill').hidden = !oUi[s];
    m.classList.toggle(s[0] + '-off', !!oUi[s]);
  }
  const tOff = oTasksOff(), max = oMax();
  $('o-tasks').classList.toggle('max', max && !tOff);
  $('o-tasks-max').setAttribute('aria-pressed', String(max)); $('o-tasks-max').setAttribute('aria-label', max ? 'Slide the board down to show the office' : 'Expand the board over the office'); $('o-tasks-max').title = max ? 'Show the office (Esc)' : 'Expand the board';
  $('o-tasks-max').innerHTML = max ? O_RESTORE : O_MAX;
  oRate();
  for (const [box, b, off, what] of [[$('o-tasks'), $('o-tasks-fold'), tOff, 'the tasks'], [$('o-act'), $('o-act-fold'), !!oUi.actOff, 'Activity'], [$('o-locks'), $('l-tog'), oLocksOff(), 'the file locks']]) {
    box.classList.toggle('folded', off); b.setAttribute('aria-expanded', String(!off));
    b.title = off ? 'Show' : 'Fold'; b.setAttribute('aria-label', off ? `Show ${what}` : `Fold ${what} to ${what === 'Activity' ? 'its' : 'their'} title bar`);
  }
  $('l-body').hidden = oLocksOff();
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
// The room is framed in the part of the view no dock, the top bar or the Tasks window (or its title bar) covers (the
// camera is told the insets).
function oFrame() {
  if (!office.mod?.setInsets || boardView !== 'office') return;
  const v = $('office-view').getBoundingClientRect(); if (!v.width || !v.height) return;
  const R = (id) => { const e = $(id); return e && !e.hidden && e.offsetWidth ? e.getBoundingClientRect() : null; };
  const l = R('o-left'), r = R('o-right') || R('o-act'), t = R('o-tasks'), top = $('topbar').getBoundingClientRect();
  // Expanded (or sliding), the board covers the room: it's framed as if docked (the window's CSS height at the foot),
  // so sliding the board down or up doesn't move the camera.
  const dockTop = () => v.bottom - 18 - Math.max(Math.min(Math.max(176, 0.27 * v.height), 270), Math.min(innerHeight * 0.5, 360));
  const covered = t && ($('o-tasks').classList.contains('max') || !!oSlide);
  office.mod.setInsets({
    left: l ? (l.right - v.left) / v.width : 0,
    right: r ? (v.right - r.left) / v.width : 0,
    top: Math.max(0, (top.bottom - v.top) / v.height),
    bottom: t ? (v.bottom - (covered ? dockTop() : t.top)) / v.height : 0,
  });
}
function oFold(which, folded = !oOff(which)) {
  const from = document.activeElement;
  oUi[which === 'act' ? 'actOff' : which] = folded; oSave(); renderDocks();
  if (boardView === 'office') { renderOffice(); office.mod?.resize?.(); }
  // Focus stays on the control you used (Tasks, Activity and File locks fold to their title bars, which keep the
  // button); if that just went away, it moves to its counterpart (a dock's fold button <-> its chip).
  if (from && from !== document.body && !from.offsetParent) (folded ? $('o-' + which + '-pill') : $('o-' + which)?.querySelector('[data-o-fold]'))?.focus({ preventScroll: true });
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
  ui.oGoal = open; ui.oGoalEdit = open && edit; ui.goalErr = ''; if (open) { ui.oDl = false; ui.oMerge = false; ui.oPlan = false; ui.oRoles = false; ui.oSetup = false; if (ui.themeOpen) themePop(false, false); }
  $('o-goal-b')._html = undefined; renderDocks(); $('tb-a')._html = undefined; $('tb-b')._html = undefined; renderTopbar(setupInfo());
  if (!open) return $('goal-btn')?.focus({ preventScroll: true });
  const ta = $('o-goal-in');
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } else $('o-goal').querySelector('.o-ib').focus({ preventScroll: true });
}
function oDl(open) {
  ui.oDl = open; ui.dlErr = ''; if (open) { ui.oGoal = false; ui.oMerge = false; ui.oPlan = false; ui.oRoles = false; ui.oSetup = false; if (ui.themeOpen) themePop(false, false); }
  $('o-dl-b').innerHTML = ''; $('o-dl-b')._html = undefined; renderDocks();
  if (open) $('o-dl-in')?.focus(); else $('clock').focus({ preventScroll: true });
}
function oSetup(open, focus = true) {
  ui.oSetup = open; if (open) { ui.oGoal = false; ui.oDl = false; ui.oMerge = false; ui.oPlan = false; ui.oRoles = false; if (ui.themeOpen) themePop(false, false); }
  render();
  if (focus) setupFocus(open);
}
// Setup, in both views: opened, focus moves into it (its current step) and a phone scrolls it into view; closed, focus
// goes back to the Setup chip.
function setupFocus(open) {
  const el = $('setup');
  if (!open || el.hidden) return document.querySelector('[data-fk="s-open"]')?.focus({ preventScroll: true });
  el.scrollTop = 0;
  (el.querySelector('.step.cur .step-h') || el.querySelector('.step-h'))?.focus({ preventScroll: true });
  const r = el.getBoundingClientRect();
  if (boardView !== 'office' && (r.top < 0 || r.top > innerHeight * 0.6)) el.scrollIntoView({ behavior: smooth(), block: 'start' });
}
function oMerge(open) {
  ui.oMerge = open; if (open) { ui.oGoal = false; ui.oDl = false; ui.oPlan = false; ui.oRoles = false; ui.oSetup = false; if (ui.themeOpen) themePop(false, false); }
  $('o-merge-b')._html = undefined; renderDocks(); $('tb-b')._html = undefined; renderTopbar(setupInfo());
  if (open) $('o-integ-sel')?.focus(); else $('merge-btn')?.focus({ preventScroll: true });
}
function oPlan(open) {
  ui.oPlan = open; if (open) { ui.oGoal = false; ui.oDl = false; ui.oMerge = false; ui.oRoles = false; ui.oSetup = false; if (ui.themeOpen) themePop(false, false); }
  $('o-plan-b')._html = undefined; renderDocks(); $('tb-b')._html = undefined; renderTopbar(setupInfo());
  if (open) $('o-plan-sel')?.focus(); else $('plan-btn')?.focus({ preventScroll: true });
}
// Roles (below 1600px): the planner and who merges, both chosen in one popover.
function oRoles(open) {
  ui.oRoles = open; if (open) { ui.oGoal = false; ui.oDl = false; ui.oMerge = false; ui.oPlan = false; ui.oSetup = false; if (ui.themeOpen) themePop(false, false); }
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
  if (ui.oSetup && boardView === 'office' && ev.target.isConnected && !ev.target.closest?.('#setup, [data-fk="s-open"], [data-go^="step-"], [data-act="invite"], dialog, #toasts')) { ui.oSetup = false; render(); }
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
  const needTxt = (ui.needParts || []).join(' · ');
  $('o-left-sub').textContent = needTxt; $('o-left-sub').title = needTxt;
  $('o-left-n').textContent = ui.needN ? String(ui.needN) : '';
  $('o-left-pill').setAttribute('aria-label', `Needs attention${needTxt ? `: ${needTxt}` : ''}. Open the panel`);
  // Under the questions: blocked tasks without a question (those are answered above), with why.
  const alone = blockedSplit(qOpen).alone;
  patch($('o-blocked'), (alone.length ? `<section class="o-sec" aria-labelledby="o-bl-h"><h3 id="o-bl-h">Blocked</h3><ul class="o-list">${
    alone.map((t) => `<li><button type="button" class="link tref" data-open-task="${t.id}" data-fk="ob-${t.id}">#${t.id} ${esc(short(t.title, 48))}</button>${t.assignee ? ` <span class="muted">·</span> ${nameTag(agentRoot(t.assignee))}` : ''}${blockedNote(t) ? `<span class="o-why bad">${esc(short(blockedNote(t), 140))}</span>` : ''}</li>`).join('')}</ul></section>` : ''));
  // Folded Activity: its title bar says the latest event.
  const last = state.events.reduce((m, e) => (!m || e.id > m.id ? e : m), null);
  const lt = last ? `${last.author}: ${last.kind === 'settings' ? settingsText(last) : last.text}` : 'Nothing yet';
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
  if (ui.oSetup && boardView === 'office') return oSetup(false);
  if (boardView !== 'office' && setupShown() && ev.target.closest?.('#setup, [data-fk="s-open"]')) { store.set('board-setup', 'closed'); ui.forceSetup = false; render(); return setupFocus(false); }
  if (ui.oGoal) return oGoal(false);
  if (boardView === 'office' && oMax() && !oTasksOff() && $('o-tasks').contains(ev.target)) { oExpand(false); return $('o-tasks-max').focus({ preventScroll: true }); }
  if (ui.picked && ev.target.closest?.('#o-right, #office-view')) { const n = ui.picked; pickAgent(null, true); document.querySelector(`[data-fk="oa-${CSS.escape(n)}"]`)?.focus({ preventScroll: true }); }
});

// ---------- command palette (Ctrl+K) ----------
// Every command runs something that already exists in the page: it never does anything new by itself.
const palDlg = $('pal-dlg'), palIn = $('pal-in'), palList = $('pal-list');
let palItems = [], palSel = 0, palPrev = null, palNext = null;
const PAL_MAX = 40;
function palCommands() {
  const cmds = [];
  const add = (kind, label, run, extra = '') => cmds.push({ kind, label, run, hay: (label + ' ' + extra).toLowerCase() });
  const oq = openQuestions()[0];
  if (oq) add('Action', `Answer the oldest question (from ${oq.asker})`, () => goQuestion(oq.id), 'reply ' + oq.question);
  add('Action', 'New task', () => openTask(null), 'add create');
  if (officeAllowed()) add('View', boardView === 'office' ? 'Turn the 3D office off' : 'Turn the 3D office on', () => setBoardView(boardView === 'office' ? 'board' : 'office'), 'view office 3d scene characters background performance power');
  if (boardView === 'office' && !oTasksOff()) add('View', oMax() ? 'Show the office (slide the board down)' : 'Expand the board over the office', () => oExpand(!oMax()), 'view office board tasks expand dock');
  const vt = state.setup?.viewer_token;
  if (vt) add('Action', 'Open the presenter view (new tab)', () => window.open(BASE + '/present.html?token=' + encodeURIComponent(vt), '_blank', 'noopener'), 'projector big screen present 3d office');
  add('Action', state.settings?.deadline ? 'Edit the demo time' : 'Set the demo time', () => doAct('clock'), 'deadline clock countdown freeze');
  add('Action', 'Write a message in chat', () => { oShow('act'); $('msg').scrollIntoView({ behavior: smooth(), block: 'center' }); $('msg').focus({ preventScroll: true }); }, 'focus chat');
  add('Action', 'Open help', openHelp, 'what everything means keyboard');
  const others = people().map((p) => p.name).filter((n) => n !== me);
  add('Filter', 'Show tasks for everyone', () => setFilter(''), 'filter show');
  add('Filter', `Show tasks for my team (${me})`, () => setFilter('me'), 'filter show mine');
  for (const n of others) add('Filter', `Show tasks for ${n}`, () => setFilter(n), 'filter show');
  for (const [v, l, d] of THEME_LIST) add('Theme', `Theme: ${l}${v === themePref ? ' ✓' : ''}`, () => setTheme(v), `switch colour mode palette ${d} ${v}${v === 'auto' ? ' follow the device' : ''}${v === themePref ? ' current' : ''}`);
  for (const p of people()) add('Person', `Go to ${p.name}${youTag(p.name)} in Agents`, () => {

    // Their first agent, selected (what it holds and its controls), or their row when they have none.
    oShow('right'); const a = p.r.agents?.[0];
    if (a && ui.picked !== a.name) pickAgent(a.name, true);
    const el = document.querySelector(a ? `[data-fk="oa-${CSS.escape(a.name)}"]` : `[data-person-row="${CSS.escape(p.name)}"] button`) || document.querySelector(`[data-person-row="${CSS.escape(p.name)}"]`);
    if (el && !el.matches('button')) el.tabIndex = -1;
    el?.scrollIntoView({ behavior: smooth(), block: 'center' }); el?.focus({ preventScroll: true });
  }, p.name + ' person agent people');
  for (const t of state.tasks) add('Task', `#${t.id} ${t.title}`, () => { openTask(t.id); setDlgBackTo(t.id); }, `${LABEL[t.status] || t.status} ${t.assignee || ''}`);
  return cmds;
}
function palFilter(q) {
  const all = palCommands(); const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return all.filter((c) => c.kind === 'Action' || c.kind === 'View' || c.kind === 'Theme').slice(0, PAL_MAX);
  const idm = /^#?(\d+)$/.exec(q.trim());
  const rank = (c) => (idm && c.kind === 'Task' && c.label.startsWith('#' + idm[1] + ' ') ? 0 : c.kind === 'Task' ? 3 : c.kind === 'Person' ? 2 : 1);
  return all.filter((c) => words.every((w) => c.hay.includes(w))).map((c, i) => [c, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]).slice(0, PAL_MAX);
}
function palRender() {
  palItems = palFilter(palIn.value);
  palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
  // The kind only where the label doesn't say it: actions and themes ("Theme: Dusk") go without.
  palList.innerHTML = palItems.map((c, i) => `<li role="option" id="pal-o-${i}" data-i="${i}" aria-selected="${i === palSel}"><span class="pl">${esc(c.label)}</span>${c.kind === 'Action' || c.kind === 'Theme' ? '' : `<span class="pk">${c.kind}</span>`}</li>`).join('');

  $('pal-empty').hidden = palItems.length > 0;
  palIn.setAttribute('aria-activedescendant', palItems.length ? 'pal-o-' + palSel : '');
  announce(palItems.length ? `${palItems.length} result${palItems.length === 1 ? '' : 's'}` : 'Nothing matches');
}
function palSelect(i) {
  if (!palItems.length) return;
  palSel = (i + palItems.length) % palItems.length;
  for (const li of palList.children) li.setAttribute('aria-selected', String(Number(li.dataset.i) === palSel));
  palIn.setAttribute('aria-activedescendant', 'pal-o-' + palSel);
  $('pal-o-' + palSel)?.scrollIntoView({ block: 'nearest' });
}
function openPalette() {
  if ($('app').hidden || $('task-dlg').open || palDlg.open) return;
  palPrev = document.activeElement; palSel = 0; palIn.value = '';
  if (helpDlg.open) helpDlg.close();
  palDlg.showModal(); palRender(); palIn.focus();
}
function togglePalette() { if (palDlg.open) palDlg.close(); else openPalette(); }
function palRun(i) {
  const c = palItems[i]; if (!c) return;
  // The command runs once the palette has closed and handed focus back, so the focus it sets is where you land.
  palNext = c.run; palDlg.close();
}
// Closed: focus goes back where it was first, so a command that opens something (help, a task) hands focus back there.
palDlg.addEventListener('close', () => {
  const run = palNext; palNext = null;
  if (palPrev?.isConnected) palPrev.focus({ preventScroll: true });
  palPrev = null;

  if (run) setTimeout(run);
});
palIn.addEventListener('input', () => { palSel = 0; palRender(); });
palIn.addEventListener('keydown', (ev) => {
  if (ev.key === 'ArrowDown') { ev.preventDefault(); palSelect(palSel + 1); }
  else if (ev.key === 'ArrowUp') { ev.preventDefault(); palSelect(palSel - 1); }
  else if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); palRun(palSel); }
});
palList.addEventListener('click', (ev) => { const li = ev.target.closest('li'); if (li) palRun(Number(li.dataset.i)); });
palList.addEventListener('mousemove', (ev) => { const li = ev.target.closest('li'); if (li && Number(li.dataset.i) !== palSel) palSelect(Number(li.dataset.i)); });
palDlg.addEventListener('click', (ev) => { if (ev.target === palDlg) palDlg.close(); }); // the backdrop

let started = false;
async function start() {
  if (!token || !me) return showGate();
  if (qs.get('token') || qs.get('name')) history.replaceState(null, '', location.pathname);
  store.set('board-token', token);
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
    // Keep timers fresh (agents coming online don't emit events), and notice a live stream that closed for good.
    setInterval(() => { if (unavailable || $('app').hidden) return; if (es && es.readyState === EventSource.CLOSED) return recheck(); return esOpen ? load() : render(); }, 20000);
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

start();

export { boardView, checkOverwrites, copyText, focusMoveAsk, focusNow, goCard, goMention, goQuestion,
  markMentionsSeen, moveAskHtml, office, oShow, renderDialogLive, renderDocks, renderOffice, start };
