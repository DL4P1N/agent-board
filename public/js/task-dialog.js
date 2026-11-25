// The task dialog: new and edit, its fields kept live while others change the task, delete, cancel and send back
// (each armed first), approving a proposal, and noticing when someone saves over you.

import './actions.js';
import { $, HINT, HOLDING, LABEL, me, state, STATUSES } from './state.js';
import { ago, esc, fmt, isStale, ownerOffline, patch, refreshTimes, taskById, toast, who } from './helpers.js';
import { api, load, scheduleReload } from './data.js';
import { agentInfo, agentLimited, agentState, capText, claimHold, limitText, openQuestions, timeNow } from './derived.js';
import { render } from './render.js';
import { blockedNote, moveTask, prFeedback, prInfo } from './tasks.js';
import { evHtml, growMsg } from './activity.js';
import { focusTask, mention, sendAnswer } from './actions.js';

let editing = null; // snapshot of the task open in the dialog
let shown = {}; // what each field showed when filled from the task (an input or list may hold a value differently)

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
// A title error shows under Title; any other under the form's fields.
function showFieldError(msg) {
  const f = fieldError(msg); $(f.el === 'td-name' ? 'td-name-err' : 'td-err').textContent = f.text;
  if (!f.el) return;
  const n = $(f.el); if (n.closest('[hidden]')) return;
  n.setAttribute('aria-invalid', 'true'); n.focus();
}
// Fields the human has changed in the dialog (compared with the task as it was when they started editing it).
const editedFields = () => (editing ? Object.keys(FIELDS).filter((f) => FIELDS[f]() !== shown[f]) : []);
const noteShown = (f) => { shown[f] = FIELDS[f](); };
const dlgDirty = () => (editing ? editedFields().length > 0 : !!($('td-name').value.trim() || $('td-desc').value.trim() || $('td-deps').value.trim()));
function openTask(id, { discard = false } = {}) {
  const t = id ? taskById(id) : null;
  if (id && !t) return toast(`Task #${id} no longer exists`, true);
  // A #ref clicked inside the open dialog: unsaved edits are asked about first (Discard opens the other task).
  if (!discard && dlg.open && (editing?.id ?? null) !== (id ?? null) && dlgDirty()) { pendingOpen = () => openTask(id, { discard: true }); $('td-discard').hidden = false; $('td-keep').focus(); return; }
  pendingOpen = undefined;
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
  shown = {}; if (editing) for (const f of Object.keys(FIELDS)) noteShown(f);
  $('td-err').textContent = ''; $('td-name-err').textContent = ''; $('td-status-hint').textContent = t ? HINT[t.status] + '.' : ''; $('td-status-hint').classList.add('vh'); $('td-status').title = t ? HINT[t.status] : '';
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
  // A blocked task with a question: the answer box is the job; otherwise the title, showing its start (a long title
  // would open scrolled to its end). On a touch screen an existing task opens on its heading: a focused field would
  // pop the keyboard up over it.
  const ans = $('td-block').querySelector('textarea'); const n = $('td-name');
  if (ans) ans.focus();
  else if (t && matchMedia('(hover: none) and (pointer: coarse)').matches) { const h = $('td-title'); h.tabIndex = -1; h.focus(); }
  else { n.focus(); if (t && n.scrollWidth > n.clientWidth) { n.setSelectionRange(0, 0); n.scrollLeft = 0; } } // a title that fits keeps the caret at its end
}
// Whether others may take a task over now (nobody can after the demo time, or during the freeze unless it allows it).
const takeNote = (t) => { const h = claimHold(t); return h ? `nobody can take it over (${h})` : 'agents may take it over'; };
// Why agents won't claim an open task now, in full (the server says the same in freeze_note).
function holdText(t) {
  const tm = timeNow();
  if (tm.past) return 'The demo time has passed: agents take no new tasks until it is moved or removed (the Demo chip).';
  return 'Feature freeze: agents will not claim it before the demo. Only priority-1 fixes of size S or M, and work someone already started, can still be claimed.';
}
function renderDialogLive() {
  const t = editing && taskById(editing.id);
  if (!editing) { $('td-meta').innerHTML = ''; $('td-meta')._html = undefined; renderTaskBlock(null); patch($('td-deps-hint'), 'Task ids that must be done before this can be claimed. Optional.'); $('td-deps-hint').classList.add('vh'); resOptions(); return; }
  if (!t) { $('td-conflict').hidden = false; $('td-conflict').textContent = 'This task no longer exists.'; return; }
  // Fields the human didn't touch follow the server; a warning only when one they DID edit changed underneath them.
  const mine = editedFields();
  const norm = (f, v) => (f === 'size' ? v || 'M' : f === 'reserved_for' || f === 'assignee' ? v || null : v);
  for (const f of Object.keys(FIELDS)) if (!mine.includes(f) && norm(f, t[f]) !== editing[f]) { SETF[f](norm(f, t[f])); editing[f] = norm(f, t[f]); noteShown(f); }
  resOptions(mine.includes('reserved_for') ? undefined : editing.reserved_for); // agent list stays current
  asgOptions(mine.includes('assignee') ? undefined : editing.assignee);
  for (const f of ['reserved_for', 'assignee']) if (!mine.includes(f)) noteShown(f);
  editing.branch = t.branch;
  const clash = mine.filter((f) => norm(f, t[f]) !== editing[f]);
  $('td-conflict').hidden = !clash.length;
  if (clash.length) $('td-conflict').textContent = `While you were editing, someone else changed the ${clash.map((f) => FNAME[f]).join(' and ')}${clash.includes('status') ? ` (now ${LABEL[t.status]})` : ''}. Saving replaces it with your version.`;
  $('td-mention').hidden = !t.assignee;
  renderTaskBlock(t);
  const deps = t.depends_on.map((d) => { const x = taskById(d); return `<button type="button" class="link tref" data-open-task="${d}" data-fk="dep-${d}">#${d}</button> ${x ? `(${LABEL[x.status]})` : '(missing)'}`; });
  syncSave();
  // The status and the assignee are the fields below; the meta line says what they don't.
  patch($('td-meta'), [
    t.branch ? `<span>branch <code>${esc(t.branch)}</code></span>` : '',
    (() => { const pr = prInfo(t); return pr ? `<span>pull request <a href="${esc(pr.url)}" target="_blank" rel="noopener noreferrer" data-fk="td-pr">${esc(pr.url.replace(/^https?:\/\/(www\.)?/, ''))}</a>${pr.text ? ` <span class="pill ${pr.cls}">${esc(pr.text)}</span>` : ''}</span>${prFeedback(t)}` : ''; })(),
    t.status === 'review' && t.reviewer ? `<span>being merged by ${who(t.reviewer)}</span>` : '',
    t.assignee && HOLDING.includes(t.status) && agentLimited(t.assignee) ? `<span class="pill warn">owner out of usage — ${takeNote(t)}</span>` : '',
    // Open or proposed, and the demo time keeps agents from claiming it (the server's freeze_note, in short).
    ['open', 'proposed'].includes(t.status) && claimHold(t) ? `<span class="pill warn" title="${esc(holdText(t))}">${timeNow().past ? 'demo time passed: no new claims' : 'on hold for the feature freeze'}</span>` : '',
    `<span>created by ${who(t.created_by)} ${ago(t.created_at)}</span>`,
    `<span>updated ${ago(t.updated_at)}</span>`,
    isStale(t) ? `<span class="pill flag">stale: no update for 15+ min${t.assignee && ownerOffline(t) ? ` · owner offline — ${takeNote(t)}` : ''}</span>` : '',
  ].join(''));
  patch($('td-deps-hint'), deps.length ? `Depends on ${deps.join(', ')}. Dependencies are fixed after creation.` : ''); $('td-deps-hint').classList.remove('vh');
  const h = $('td-history'); const before = h._html;
  // Newest at the bottom, in view: on opening, and while it's read there; scrolled up to older lines, it stays put.
  const follow = before === undefined || h.scrollHeight - h.scrollTop - h.clientHeight < 24;
  const evs = state.events.filter((e) => e.task_id === t.id);
  patch(h, evs.map((e, i) => evHtml(e, evs[i - 1])).join('') || '<div class="empty-note">No activity yet.</div>');
  refreshTimes(h);
  if (before !== h._html && follow) h.scrollTop = h.scrollHeight;
}
// Blocked: the reason first, then the agent's open question with an answer box, then the way back to In progress.
function renderTaskBlock(t) {
  const el = $('td-block'); const blocked = t?.status === 'blocked';
  el.hidden = !blocked;
  if (!blocked) return patch(el, '');
  const note = blockedNote(t); const q = openQuestions().find((x) => x.task_id === t.id);
  patch(el, `<p class="tb-why"><b>Blocked:</b> ${note ? esc(note) : '<span class="muted">no reason given. Ask in chat with Message assignee.</span>'}</p>
    ${q ? `<div class="tb-q"><div class="t-meta muted">${who(q.asker, true)} asked ${ago(q.created_at)}</div><div class="qt">${fmt(q.question)}</div>
      <div class="tb-qa"><label class="vh" for="tdqa-${q.id}">Answer to ${esc(q.asker)}</label><textarea id="tdqa-${q.id}" data-keep="tdqa-${q.id}" data-tdq="${q.id}" data-asker="${esc(q.asker)}" rows="1" placeholder="Your answer" title="Enter sends · Shift+Enter adds a new line" aria-describedby="tdqe-${q.id}"></textarea><button type="button" data-td-answer="${q.id}" data-fk="tdqb-${q.id}">Answer</button></div>
      <div class="err" id="tdqe-${q.id}" role="alert"></div></div>` : ''}
    <div class="inl"><button type="button" class="ghost sm" data-td-unblock data-fk="td-unblock" title="${t.assignee ? `Unblocked: ${esc(t.assignee)} carries on` : 'Unblocked: back to work'}">Back to In progress</button></div>`);
}
async function answerFromDialog(qid) {
  const ta = $('tdqa-' + qid); const b = document.querySelector(`[data-td-answer="${qid}"]`); if (!ta || !b) return;
  const answer = ta.value.trim(); const err = $('tdqe-' + qid);
  if (!answer) { err.textContent = 'Type an answer first.'; ta.setAttribute('aria-invalid', 'true'); return ta.focus(); }
  if (b.disabled) return; // on its way already
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
// Closing with unsaved edits asks first (inline, no browser popup). Esc while it asks means Keep editing.
let pendingOpen; // what to do instead once the edits are discarded (a #ref, a name or Message assignee clicked in the dialog)
function requestCloseTask() { if (dlgDirty() && $('td-discard').hidden) { pendingOpen = undefined; $('td-discard').hidden = false; $('td-keep').focus(); return; } dlg.close(); }
// Leaving the dialog for the chat (Message assignee, a name in its history): unsaved edits are asked about first,
// like closing it; Discard goes on.
function leaveTask(fn) {
  if (dlg.open && dlgDirty()) { pendingOpen = () => { dlg.close(); fn(); }; $('td-discard').hidden = false; $('td-keep').focus(); return; }
  if (dlg.open) dlg.close();
  fn();
}
const keepEditing = () => { pendingOpen = undefined; $('td-discard').hidden = true; $('td-name').focus(); };
dlg.addEventListener('cancel', (ev) => {
  if (!$('td-discard').hidden) { ev.preventDefault(); return keepEditing(); }
  if (dlgDirty()) { ev.preventDefault(); requestCloseTask(); }
});
$('td-keep').onclick = keepEditing;
$('td-drop').onclick = () => { const next = pendingOpen; pendingOpen = undefined; if (!next) return dlg.close(); $('td-discard').hidden = true; next(); };
dlg.addEventListener('click', (ev) => { if (ev.target.closest('[data-close]')) return requestCloseTask();
  if (ev.target === dlg) { const r = dlg.getBoundingClientRect(); if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) requestCloseTask(); } });
// Closed: focus goes back where it was (the browser does that), or to the task's card when that's gone or the task was
// opened from the palette (dlgBackTo).
let dlgBackTo = null;
function setDlgBackTo(id) { dlgBackTo = id; }
// A task that went with the dialog (rejected, cancelled, deleted): focus goes to the card next to where it was.
let gone = null, goneNext = null;
function cardNext(id) {
  const c = document.querySelector(`.card[data-id="${id}"]`); const li = c?.closest('li');
  return { id: (li?.nextElementSibling || li?.previousElementSibling)?.querySelector('.card')?.dataset.id || null, col: c?.closest('.col')?.id || null };
}
dlg.addEventListener('close', () => {
  if (dlg.open) return; // a late close event for a dialog already reopened on another task: nothing to tidy
  const id = editing?.id; const back = dlgBackTo; dlgBackTo = null;
  editing = null; $('td-discard').hidden = true; resetCancel();
  const next = gone === id ? goneNext : null; gone = null; goneNext = null;
  setTimeout(() => {
    const a = document.activeElement; if (!id || !(back === id || !a || a === document.body)) return;
    if (!next) return focusTask(id);
    const n = (next.id && document.querySelector(`.card[data-id="${next.id}"]`)) || (next.col && $(next.col)?.querySelector('.card'));
    if (n?.offsetParent) n.focus({ preventScroll: true }); else $('board').focus({ preventScroll: true });
  });
});
$('td-desc').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); if (!saving) $('task-form').requestSubmit(); } });
$('td-mention').onclick = () => { const a = editing?.assignee; const id = editing?.id; if (a) leaveTask(() => { mention(a); $('msg').value += `re #${id}: `; growMsg(); }); };
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
    goneNext = cardNext(t.id); gone = t.id; dlg.close(); toast(`Deleted #${t.id} ${t.title}`); scheduleReload();
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
    goneNext = cardNext(t.id); gone = t.id; dlg.close(); toast(`Cancelled #${t.id} ${t.title}`); scheduleReload();
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
    goneNext = cardNext(t.id); gone = t.id; dlg.close(); toast(`Rejected proposal #${t.id}`); scheduleReload();
    state.tasks = state.tasks.filter((x) => x.id !== t.id); render(); // optimistic: it's gone
  } catch (e) { $('td-err').textContent = `Couldn't reject: ${e.message}`; }
};
for (const [inp, btn] of [['td-cancel-reason', 'td-cancel'], ['td-rej-reason', 'td-reject']]) $(inp).addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); $(btn).click(); } });
// Save changes: only once a field differs from the task (a new task always has Create task).
function syncSave() { $('td-save').hidden = !!editing && !dlgDirty(); }
$('task-form').addEventListener('input', syncSave); $('task-form').addEventListener('change', syncSave);
// Approve (a proposal): any edits are saved first, through the form, then it's approved.
let approving = false;
// Ignored while a save is on its way: the dropped submit would leave approving set for the next save.
$('td-approve').onclick = () => { if (saving) return; approving = true; $('task-form').requestSubmit(); };
// One save at a time: Ctrl+Enter (or Save) again while it's on its way doesn't create the task twice.
let saving = false;
$('task-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (saving) return;
  saving = true;
  try { await saveTask(); } finally { saving = false; }
});
async function saveTask() {
  const approve = approving && editing?.status === 'proposed'; approving = false;
  const err = $('td-err'); err.textContent = ''; $('td-name-err').textContent = '';
  const title = $('td-name').value.trim();
  if (!title) { $('td-name-err').textContent = 'Give the task a title.'; $('td-name').setAttribute('aria-invalid', 'true'); return $('td-name').focus(); }
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
      const assignee = $('td-asg').value || null; let to = $('td-status').value;
      // Assigning an open task claims it for that agent: that's a move to Claimed (with "Move anyway" below).
      if (to === 'open' && o.status === 'open' && assignee && assignee !== o.assignee && !approve) to = 'claimed';
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
      if (approve) { const r = await api(`/tasks/${o.id}/decide`, { method: 'POST', body: JSON.stringify({ approve: true }) }); toast(r?.freeze_note ? `Approved #${o.id}. ${r.freeze_note}` : `Approved #${o.id}: agents can claim it now`); scheduleReload(); }

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
      toast(`Created #${t.id} ${t.title}${reserved_for ? ` (reserved for ${reserved_for})` : ''}${t.freeze_note ? `. ${t.freeze_note}` : ''}`);
      // Focus goes to the new card (not back to where the dialog was opened from, which may be gone, or the page).
      dlg.close(); await load(); return focusTask(t.id);
    }
    dlg.close();
  } catch (e) { showFieldError(e.message); }
  finally { btn.disabled = false; btn.textContent = btnText; }
}
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
  // The board answers again: a "can't reach" from a save tried while it didn't is stale now.
  const err = $('td-err'); if (/Cannot reach the board server|not answering/.test(err.textContent)) err.textContent = 'Connected again: press Save to try once more.';
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

export { checkOverwrites, leaveTask, openTask, renderDialogLive, setDlgBackTo };
