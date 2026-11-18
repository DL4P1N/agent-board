// The header and the top bar: the demo-time clock and feature freeze, desktop notifications (the bell), the header's
// height for the sticky rails, and the top bar's goal, progress and merges chips.

import './needs.js';
import { $, ANYONE, state, store, ui } from './state.js';
import { announce, esc, mentionsMe, nameTag, ownerOffline, patch, short, taskById, toast, when } from './helpers.js';
import { agentLimited, dur, outlook, setupShown, timeNow } from './derived.js';
import { render } from './render.js';
import { blockedNote, ciPill } from './tasks.js';
import { focusNow, goCard, goMention, goQuestion } from './actions.js';
import { narrowMq } from './office.js';

let prevFrozen = null;
function renderClock() {
  const t = timeNow(); const b = $('clock');
  // DEMO, then the time itself ("in 2h 0m", never cut), then the rest (freeze time, verdict), which is cut first.
  const chip = (tm, rest = '') => `<span class="tbl">Demo</span> <span class="o-x"><span class="tm">${tm}</span>${rest ? `<span class="rest">${rest}</span>` : ''}</span><span class="o-ar chev" aria-hidden="true">▾</span>`;
  if (!t.deadline) {
    prevFrozen = null;
    const h = chip('not set'); if (b._html !== h) { b.innerHTML = h; b._html = h; }
    b.className = 'tbc clock unset'; b.title = 'No demo time yet: set it so agents stop on time'; b.setAttribute('aria-label', 'Demo not set. Set the demo time');
    return;
  }
  const now = Date.now();
  // tm + detail: the detail (freeze time) hides on narrower screens when a verdict follows the time.
  let tm, detail = '', cls = '', tip;
  if (t.past) { tm = 'time passed'; cls = 'past'; tip = `The demo was at ${when(t.deadline)}. Click to edit the time.`; }
  else if (t.frozen) { tm = `in ${dur(t.deadline - now)}`; cls = 'frozen'; tip = `Feature freeze since ${when(t.freezeAt)}: agents don't take new tasks, except priority-1 bug fixes. Demo at ${when(t.deadline)}. Click to edit the time.`; }
  else {
    tm = `in ${dur(t.deadline - now)}`; detail = t.fm ? ` · freeze ${t.warn ? 'in ' + dur(t.freezeAt - now) : when(t.freezeAt)}` : '';
    cls = t.warn ? 'warn' : ''; tip = `Demo at ${when(t.deadline)}${t.fm ? `; feature freeze at ${when(t.freezeAt)} (${t.fm} min before): agents stop taking new tasks then (priority-1 bug fixes still allowed)` : ''}. Click to edit the time.`;
  }
  const ol = outlook(t);
  // The verdict is a short word after the time, in its colour (on track, tight, behind by ~N); the full one is the
  // tooltip. During the freeze the chip names the freeze instead ("Behind" only means those tasks won't start).
  const vd = ol?.label && !t.frozen ? ol : null;
  if (ol) tip = `${ol.label ? `${ol.label}. ` : ''}${ol.why}.
${tip}`;
  const word = vd ? (vd.verdict === 'behind' ? `behind by ~${vd.shortBy}` : vd.label.toLowerCase()) : '';
  const text = `Demo ${tm}${t.frozen && !t.past ? ' · feature freeze' : detail}${vd ? ' · ' + vd.label : ''}`;
  const html = chip(esc(tm), t.frozen && !t.past
    ? '&nbsp;· feature freeze<span class="fz"> — finish &amp; merge</span>'
    : `${detail ? `<span class="fz">&nbsp;${esc(detail.slice(1))}</span>` : ''}${vd ? `<span class="vdw">&nbsp;· <b class="vd ${vd.verdict}">${esc(word)}</b></span>` : ''}`);
  if (b._html !== html) { b.innerHTML = html; b._html = html; tbFit(); }
  b.className = 'tbc clock ' + cls + (vd ? ' v-' + vd.verdict : ''); b.title = tip; b.setAttribute('aria-label', `${text}. Edit the demo time`);
  // One polite announcement when the freeze starts while the page is open.
  if (prevFrozen === false && t.frozen && !t.past) announce(`Feature freeze started. Agents won't take new tasks; help merge and test.`);
  prevFrozen = t.frozen;
}
// Re-render when the countdown crosses a boundary (warn / freeze / deadline); otherwise only the header ticks.
let timeKey = '';
function setTimeKey(k) { timeKey = k; } // tests force a re-render (through window, see boot.js)
function tickTime() {
  if ($('app').hidden) return;
  const t = timeNow(); const key = `${t.deadline}|${t.warn}|${t.frozen}|${t.past}`;
  if (key !== timeKey) { timeKey = key; return render(); }
  renderClock();
}

// ---------- desktop notifications (opt-in; only while this tab is in the background) ----------
let notifyOn = store.get('board-notify') === 'on';
const hasNotify = () => 'Notification' in window;
// The browser's permission, read once and kept current by its change event (not read on every redraw).
let perm = hasNotify() ? Notification.permission : 'denied';
try { navigator.permissions?.query({ name: 'notifications' }).then((s) => { s.onchange = () => { perm = Notification.permission; renderBell(); }; }).catch(() => {}); } catch {}
function notifyState() {
  if (!hasNotify()) return 'unsupported';
  if (perm === 'denied') return 'denied';
  return notifyOn && perm === 'granted' ? 'on' : 'off';
}
function renderBell() {
  const b = $('notify-btn'); const st = notifyState();
  b.setAttribute('aria-pressed', String(st === 'on'));
  b.classList.toggle('blocked', st === 'denied' || st === 'unsupported');
  b.title = { on: 'Desktop notifications on: questions, @mentions of you, blocked tasks and the feature freeze, while this tab is in the background. Click to turn off.',
    off: 'Notify me: get a desktop notification for questions, @mentions of you, blocked tasks and the feature freeze while this tab is in the background',
    denied: 'Notifications are blocked for this page in your browser settings', unsupported: 'This browser can\'t show desktop notifications' }[st];
}
async function toggleNotify() {
  if (!hasNotify()) return toast('This browser can\'t show desktop notifications. The tab title still counts what\'s waiting for you.', true);
  if (notifyState() === 'on') { notifyOn = false; store.set('board-notify', 'off'); renderBell(); return toast('Desktop notifications off.'); }
  if (!window.isSecureContext) return toast('Browsers only allow notifications on https or localhost, not on this address. The tab title still counts what\'s waiting for you.', true);
  let p = perm = Notification.permission;
  if (p === 'default') { try { p = await Notification.requestPermission(); } catch { p = Notification.permission; } }
  perm = p;
  if (p !== 'granted') {
    notifyOn = false; store.set('board-notify', 'off'); renderBell();
    return toast(p === 'denied' ? 'Notifications are blocked for this page. Allow them in your browser\'s site settings (the icon left of the address), then press the bell again.' : 'Notifications stay off: the browser didn\'t get a yes.', true);
  }
  notifyOn = true; store.set('board-notify', 'on'); renderBell();
  toast('Notifications on. You\'ll get one when this tab is in the background.');
}
// Status changes this page made itself, so "blocked" by you doesn't notify you. Only the last two minutes count, so
// older ones are dropped as new ones come.
const selfMoves = new Map();
function noteSelfMove(id, status) {
  const now = Date.now();
  for (const [k, v] of selfMoves) if (now - v.ts >= 2 * 60e3) selfMoves.delete(k);
  selfMoves.set(id, { status, ts: now });
}
// Every request this page sends (data.js onRequest): a task's status change is one of this page's own moves.
function noteRequest(path, opts) {
  if (opts.method === 'PATCH' && /^\/tasks\/\d+$/.test(path)) { try { const b = JSON.parse(opts.body); if (b.status) noteSelfMove(Number(path.split('/')[2]), b.status); } catch {} }
}
let notifyCursor = null;
function noteFor(e) {
  if (e.kind === 'question') {
    const qid = e.data?.question_id;
    if (!state.questions.some((q) => q.id === qid && !q.answer)) return null;
    return { title: `Question from ${e.author}`, body: short(e.text, 180), tag: 'q-' + qid, go: () => goQuestion(qid) };
  }
  if (e.author === 'board' && e.kind === 'message' && /feature freeze/i.test(e.text)) {
    return { title: /in 30 minutes/i.test(e.text) ? 'Feature freeze in 30 minutes' : 'Feature freeze', body: short(e.text.replace(/^@all\s*/, ''), 180), tag: 'freeze-' + e.id, go: focusNow };
  }
  if (e.kind === 'message' && mentionsMe(e)) {
    return { title: `${e.author} mentioned you`, body: short(e.text, 180), tag: 'm-' + e.id, go: () => goMention(e.id) };
  }
  if (e.kind === 'task_updated' && e.data?.status === 'blocked' && e.task_id) {
    const s = selfMoves.get(e.task_id);
    if (s && s.status === 'blocked' && Date.now() - s.ts < 2 * 60e3) return null;
    const t = taskById(e.task_id); if (!t || t.status !== 'blocked') return null;
    const note = blockedNote(t);
    return { title: `#${t.id} is blocked`, body: short(`${t.title}${note ? ` — ${note}` : ''}`, 180), tag: 'b-' + t.id, go: () => goCard(t.id) };
  }
  return null;
}
function checkNotify() {
  const maxId = state.events.reduce((m, e) => Math.max(m, e.id), 0);
  if (notifyCursor === null) { notifyCursor = maxId; return; } // history on first load never notifies
  const fresh = state.events.filter((e) => e.id > notifyCursor);
  notifyCursor = Math.max(notifyCursor, maxId);
  if (!fresh.length || notifyState() !== 'on' || !document.hidden) return;
  const notes = fresh.map(noteFor).filter(Boolean);
  const shown = notes.length > 3 ? [{ title: 'Agent Board', body: `${notes.length} things need your attention: ${notes.map((n) => n.title).join('; ')}`, tag: 'many', go: focusNow }] : notes;
  for (const n of shown) {
    try {
      const x = new Notification(n.title, { body: n.body, tag: n.tag });
      x.onclick = () => { try { window.focus(); } catch {} try { x.close(); } catch {} n.go(); };
    } catch {}
  }
}
// The Board view's rails stick right under the header, whatever its height.
if ('ResizeObserver' in window) new ResizeObserver(([e]) => document.documentElement.style.setProperty('--hdr', Math.round(e.target.offsetHeight) + 'px')).observe(document.querySelector('#app > header'));

// The top bar, the same in both views: chips for the goal (opens it in place), the demo time (#clock, renderClock), progress
// (done of all tasks except proposals), the repo, the planner (chosen in place), who merges to main with main's CI (the merger choice in place), then
// the way into setup. Below 1600px (CSS) the planner and who merges are one Roles chip: it shows who merges (the planner in its tooltip and label), one popover with both choices.
function mergerText() {
  const S = state.settings;
  return S.integrator === ANYONE ? 'whoever is free' : S.integrator || '';
}
function renderTopbar(si) {
  const S = state.settings;
  const left = si.steps.find((s) => !s.done);
  const T = state.tasks.filter((t) => t.status !== 'proposed'); const done = T.filter((t) => t.status === 'done').length;
  const pct = T.length ? Math.round((done / T.length) * 100) : 0;
  const goal = String(S.goal || '').trim(); const head = goal.split('\n').find((l) => l.trim()) || '';
  const open = setupShown(si);
  const m = mergerText(); const away = S.integrator && S.integrator !== ANYONE && (ownerOffline({ assignee: S.integrator }) || agentLimited(S.integrator));
  const ci = state.main_ci?.status === 'pass' ? ', main is green' : state.main_ci?.status === 'fail' ? ', main is failing' : state.main_ci?.status === 'pending' ? ', checks running on main' : '';
  const pName = S.planner ? nameTag(S.planner) : '<span class="muted">first agent</span>';
  const mName = m ? (S.integrator === ANYONE ? 'whoever is free' : nameTag(S.integrator)) + (away ? ' <span class="muted">(away)</span>' : '') : '<span class="muted">not picked</span>';
  const pWho = S.planner || 'the first agent that starts'; const mWho = `${m || 'not picked yet'}${away ? ' (away)' : ''}`;
  const a = patch($('tb-a'), `<button type="button" class="tbc tb-goal" id="goal-btn" data-act="goal" data-fk="tb-goal" aria-expanded="${!!ui.oGoal}" aria-controls="o-goal" title="${esc(goal || 'No goal set yet')}" aria-label="Goal ${esc(goal ? head : 'not set')}. ${ui.oGoal ? 'Close' : 'Show'} the full goal"><span class="tbl">Goal</span> <span class="o-x">${goal ? esc(head) : '<span class="muted">not set</span>'}</span><span class="o-ar chev" aria-hidden="true">▾</span></button>`);
  const b = patch($('tb-b'), `${T.length ? `<span class="tbc stat" id="done-count" title="${done} of ${T.length} tasks merged into main (${pct}%)"><span class="tbl">Done</span><b>${done} of ${T.length}</b><span class="mbar" aria-hidden="true"><i style="width:${pct}%"></i></span></span>` : ''}
      ${S.repo ? `<span class="tbc repo-s" title="Project repo: ${esc(S.repo)}"><span class="tbl">Repo</span><span class="o-x">${esc(S.repo)}</span></span>` : ''}
      <button type="button" class="tbc tb-roles" id="roles-btn" data-act="roles" data-fk="tb-roles" aria-expanded="${!!ui.oRoles}" aria-controls="o-roles" title="${esc(`Planner: ${pWho} (writes the task list from the goal and approves proposed tasks)\nMerges to main: ${mWho}${away ? ': whoever is free merges meanwhile' : ''}${ci ? ` (${ci.slice(2)})` : ''}`)}" aria-label="${esc(`Merges ${m || 'not picked'}${away ? ' (away)' : ''}${ci}. Roles: the planner (${pWho}) and who merges.`)} ${ui.oRoles ? 'Close' : 'Choose the planner and who merges'}"><span class="tbl">Merges</span> <span class="o-x"><span class="rn">${mName}</span></span>${state.main_ci?.status === 'fail' ? '<span class="ci-dot" aria-hidden="true"></span>' : ''}<span class="o-ar chev" aria-hidden="true">▾</span></button>
      <button type="button" class="tbc tb-plan" id="plan-btn" data-act="planner" data-fk="tb-plan" aria-expanded="${!!ui.oPlan}" aria-controls="o-plan" title="The agent that writes the task list from the goal and approves proposed tasks${S.planner ? '' : ' (none picked: the first agent that starts plans)'}" aria-label="Planner ${esc(S.planner || 'first agent')}. ${ui.oPlan ? 'Close' : 'Choose the planner'}"><span class="tbl">Planner</span> <span class="o-x">${pName}</span><span class="o-ar chev" aria-hidden="true">▾</span></button>
      <button type="button" class="tbc tb-merge" id="merge-btn" data-act="merge" data-fk="tb-merge" aria-expanded="${!!ui.oMerge}" aria-controls="o-merge" title="The person whose agent merges finished branches into main${away ? ` (${S.integrator} is away: whoever is free merges meanwhile)` : ''}${ci ? ` (${ci.slice(2)})` : ''}" aria-label="Merges ${esc(m || 'not picked')}${away ? ' (away)' : ''}${ci}. ${ui.oMerge ? 'Close' : 'Choose who merges to main'}"><span class="tbl">Merges</span> <span class="o-x">${mName}</span>${ciPill()}${state.main_ci?.status === 'fail' ? '<span class="ci-dot" aria-hidden="true"></span>' : ''}<span class="o-ar chev" aria-hidden="true">▾</span></button>
      <span class="acts"><button type="button" class="tbc tb-act" data-act="${open ? 'setup-close' : 'setup-open'}" data-fk="s-open" aria-expanded="${open}" aria-controls="setup" ${left ? `title="Setup: ${esc(left.left)}" aria-label="Setup: ${esc(left.left)}. ${open ? 'Hide' : 'Open'} Setup"` : ''}><span class="o-x">Setup${left ? `<span class="sl">: ${esc(left.left)}</span>` : ''}</span><span class="o-ar chev" aria-hidden="true">▾</span></button></span>`);
  if (a || b) tbFit();
}
// The top bar's last resort (see the CSS): measured, so it works in any font.
function tbFit() {
  const tb = $('topbar'); if (!tb) return;
  tb.classList.remove('fit1', 'fit2');
  if (narrowMq.matches || !tb.offsetWidth) return; // one row of chips only in the three-column layout
  const over = () => tb.scrollWidth > tb.clientWidth + 1;
  if (over()) { tb.classList.add('fit1'); if (over()) tb.classList.add('fit2'); }
}
if ('ResizeObserver' in window) new ResizeObserver(() => tbFit()).observe($('topbar'));
document.fonts?.ready.then(tbFit);

export { checkNotify, noteRequest, renderBell, renderClock, renderTopbar, selfMoves, setTimeKey, tickTime, timeKey, toggleNotify };
