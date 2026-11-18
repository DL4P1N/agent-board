// The page's delegated events: one click, key, input, submit and change handler for the whole page (data-act,
// data-go...), the keyboard shortcuts, going to a question, card or mention, and the help dialog.

import './activity.js';
import { $, ANYONE, LABEL, seenMention, setSeenMention, smooth, state, store, ui } from './state.js';
import { agentRoot, ago, announce, clock, esc, glide, mentionsMe, plural, snapCards, taskById, toast, when } from './helpers.js';
import { act, api, load, scheduleReload } from './data.js';
import { agentInfoNow, bouncedTasks, cutTasks, dlSkipped, filterRoot, openQuestions, setupInfo, setupOpen, stepOpen,
  teamCapacity } from './derived.js';
import { render } from './render.js';
import { toggleNotify } from './topbar.js';
import { exportFile, inviteText, nfEvents, NOTIFY_KIND, rotateToken } from './setup.js';
import { askAgents, doneOpen, moveTask, pingedAt, renderBoard, tv } from './tasks.js';
import { closeAc, growMsg, openDm } from './activity.js';
import { openTask } from './task-dialog.js';
import { boardView, needBoard } from './office.js';
import { oAct, oDl, oGoal, oMerge, oPlan, oRoles, oSetup, oShow, pickAgent, renderDocks, renderOffice, setupFocus } from './panels.js';
import { togglePalette } from './palette.js';

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
  // What opens inside a card (its Move… menu, who it's for, the reject reason), Done and a Setup step snap open and
  // shut, like an agent's details: only cards that change column glide.
  if (ui.moveMenu && !ev.target.closest('.mvmenu, [data-move]')) { ui.moveMenu = null; snapCards(render); }
  if (ui.moveAsk && !ev.target.closest('.mvask, [data-move-to]')) { ui.moveAsk = null; snapCards(render); }
  if (!el) return;
  const d = el.dataset;
  if (el.classList.contains('card')) return openTask(Number(d.id));
  if (d.move) { const id = Number(d.move); ui.moveMenu = ui.moveMenu === id ? null : id; snapCards(render); return (ui.moveMenu ? document.querySelector(`.card[data-id="${id}"] .mvmenu button`) : document.querySelector(`[data-fk="mv-${id}"]`))?.focus({ preventScroll: true }); }
  if (d.moveTo) { const id = Number(d.moveId); const t = taskById(id); ui.moveMenu = null; if (t && t.status !== d.moveTo) moveTask(t, d.moveTo); render(); return ui.moveAsk?.id === id ? document.querySelector(`.card[data-id="${id}"] .mvask button`)?.focus({ preventScroll: true }) : focusCard(id); }
  if (d.askTo) { const id = Number(d.askId); const t = taskById(id); const { to, force } = ui.moveAsk || {}; ui.moveAsk = null; if (t && to) moveTask(t, to, { force, assignee: d.askTo }); render(); return focusTask(id); }
  if (d.askCancel) { const id = Number(d.askCancel); ui.moveAsk = null; snapCards(render); return focusTask(id); }
  if (d.release) { const t = taskById(Number(d.release)); if (t) { moveTask(t, 'open'); render(); } return; }
  if (d.approve) { const id = Number(d.approve); act(api(`/tasks/${id}/decide`, { method: 'POST', body: JSON.stringify({ approve: true }) }), `Approved #${id}: agents can claim it now`).then(() => focusCard(id)).catch(() => {}); return; }
  if (d.reject) { ui.rejecting = Number(d.reject); snapCards(render); return $('rj-' + d.reject)?.focus(); }
  if (d.rejectNo) { const id = Number(d.rejectNo); ui.rejecting = null; snapCards(render); return document.querySelector(`[data-fk="rj-b-${id}"]`)?.focus(); }
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
  if (d.step) { const si = setupInfo(); ui.steps[d.step] = !stepOpen(d.step, si.cur); return render(); }
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
  if (a === 'goal-cancel') { ui.editGoal = false; ui.goalErr = ''; render(); return document.querySelector('[data-fk="goal-edit"]')?.focus(); }
  if (a === 'repo-edit') { ui.editRepo = true; render(); return $('repo-in')?.focus(); }
  if (a === 'repo-cancel') { ui.editRepo = false; ui.repoErr = ''; render(); return document.querySelector('[data-fk="repo-edit"]')?.focus(); }
  if (a === 'done-toggle') {
    const open = !doneOpen(); ui.doneOpen = open ? 'open' : 'closed'; store.set('board-done', ui.doneOpen); snapCards(render);
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

export { applyKeys, copyText, doAct, focusMoveAsk, focusNow, focusTask, goCard, goMention, goQuestion, goStep,
  helpDlg, markMentionsSeen, mention, moveAskHtml, openHelp, sendAnswer, setFilter };
