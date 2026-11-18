// Tasks: the banners above the board, the filter and search, cards, the Columns and Table views, keyboard roving
// between cards, and drag and drop (moveTask).

import './agents.js';
import { $, COL_DESC, COL_EMPTY, COL_SHOWN, COLS, DONE_SHOWN, FROZEN_DESC, HOLDING, LABEL, me, SIZE_TIP, state,
  STATUSES, store, ui } from './state.js';
import { agentRoot, ago, canMove, cardRects, esc, fmt, fullTime, hs, isHttps, isStale, isWebUrl, moveCards, nameTag,
  ownerOffline, patch, plural, root, short, taskById, timeEl, toast, when } from './helpers.js';
import { act, api, scheduleReload } from './data.js';
import { agentInfo, agentLimited, approvalWait, clientOf, colOf, filterRoot, openQuestions, people, taskVisible,
  timeNow } from './derived.js';
import { render } from './render.js';
import { exportBtns } from './setup.js';
import { focusMoveAsk, moveAskHtml } from './actions.js';
import { renderOffice } from './panels.js';

function renderBoardEmpty(si) {
  const el = $('board-empty'); const S = state.settings;
  el.hidden = state.tasks.length > 0;
  if (state.tasks.length) return patch(el, '');
  let msg;
  if (!S.goal) msg = '<b>No tasks yet.</b> Once the goal is set (Setup, step 2), the first agent on the board writes the task list. You can also add tasks yourself with <b>+ New task</b>.';
  else if (S.planner) { const c = clientOf(S.planner); msg = `${nameTag(S.planner)}'s agent${c ? ` (${esc(c)})` : ''}, the planner, is writing the task list<span class="dots"></span> Cards appear here as it creates them.`; }
  else if (si.workingA.length) msg = '<b>No tasks yet.</b> Waiting for an agent to become the planner and write the task list<span class="dots"></span>';
  else if (si.waitingA.length) msg = `<b>No tasks yet.</b> ${plural(si.waitingA.length, 'agent is', 'agents are')} connected but nobody started one: type <code>/board</code> in it (<code>$board</code> in Codex). The first one that starts writes the task list.`;
  else msg = '<b>No tasks yet.</b> The first agent that starts on the board (Setup, step 3) becomes the planner and writes the task list from the goal. Or add tasks yourself with <b>+ New task</b>.';
  patch(el, msg);
}

// A banner above the board: waiting for plan approval, or the end-of-day write-up.
// main's CI failed: a banner above the board, so nobody merges on top of a broken main unnoticed.
function renderCi() {
  const el = $('ci-note'); const ci = state.main_ci;
  const html = ci?.status === 'fail'
    ? `<p><b>main is failing</b>${ci.failing?.length ? `: ${esc(ci.failing.join(', '))}` : ''}${ci.title ? ` — ${esc(short(ci.title, 120))}` : ''}${ci.sha ? ` <code>${esc(String(ci.sha).slice(0, 7))}</code>` : ''}. Agents have been told to fix main before merging more.</p>
      ${ci.url || ci.at ? `<div class="inl">${isHttps(ci.url) ? `<a href="${esc(ci.url)}" target="_blank" rel="noopener noreferrer" data-fk="ci-link">Open the failing run</a>` : ci.url ? `<span class="muted">Failing run: ${esc(ci.url)}</span>` : ''}${ci.at ? `<span class="muted t-meta">${timeEl(ci.at)}</span>` : ''}</div>` : ''}`
    : '';
  el.hidden = !html;
  patch(el, html);
}
// A small pill next to "Merges to main": main's latest CI run.
function ciPill() {
  const ci = state.main_ci; if (!ci) return '';
  if (ci.status === 'pass') return `<span class="pill ok ci-pill" title="The latest CI run on main passed${ci.title ? ': ' + esc(ci.title) : ''}">✓ main green</span>`;
  if (ci.status === 'pending') return `<span class="pill ci-pill" title="CI is running on main">main: checks running…</span>`;
  if (ci.status === 'fail') return `<span class="pill bad ci-pill" title="${esc(`main is failing${ci.failing?.length ? ': ' + ci.failing.join(', ') : ''}`)}">main failing</span>`;
  return '';
}

function renderBoardNote() {
  const el = $('board-note'); const t = timeNow(); const done = state.phase === 'all_done' && state.tasks.length;
  let kind = '', html = '';
  if (approvalWait()) {
    kind = 'appr';
    html = `<p><b>Agents are waiting for your approval.</b> Check the task list below before they start: open a card to change it, or add what's missing with <b>+ New task</b>. They start claiming as soon as you approve.</p>
      <div class="inl"><button type="button" data-act="approve" data-fk="bn-appr">Approve plan &amp; start</button><button type="button" class="ghost" data-act="new-task" data-fk="bn-new">+ New task</button></div>`;
  } else if (done) {
    html = `<p><b>Every task is merged.</b> Write-up for your submission: a summary of the goal, who built what, the decisions you made and what's unfinished.</p><div class="inl">${exportBtns('bn')}</div>`;
  } else if (t.past) {
    kind = 'freeze';
    html = `<p><b>The demo time (${esc(when(t.deadline))}) has passed.</b> Agents have been told to wrap up and merge what they have. Write-up for your submission: the goal, who built what, the decisions you made and what's unfinished.</p>
      <div class="inl">${exportBtns('bn')}</div>`;
  }
  // The feature freeze has no banner: the Demo chip names it, What to do now says what to do, and the Open column
  // dims what won't start.
  el.hidden = !html; el.className = 'bnote' + (kind ? ' k-' + kind : '');
  patch(el, html);
}
function renderFilter() {
  const ps = people().map((p) => p.name).filter((n) => n !== me);
  if (ui.filter && ui.filter !== 'me' && !ps.includes(ui.filter) && ui.filter !== root(me)) ui.filter = '';
  const opts = [['', 'Everyone'], ['me', `My team (${me})`], ...ps.map((n) => [n, n])];
  patch($('filter'), opts.map(([v, l]) => `<option value="${esc(v)}" ${v === ui.filter ? 'selected' : ''}>${esc(l)}</option>`).join(''));
  $('filter').value = ui.filter;
  const r = filterRoot();
  $('filterbar').hidden = !r;
  patch($('filterbar'), r ? `<span>Showing tasks for <b class="pc" ${hs(r)}>${esc(r)}</b> (assigned to, or created by, them and their agents)</span><button class="ghost sm" data-filter="">Show everyone</button>` : '');
}

// The latest note an agent wrote when blocking a task ("#4 in_progress → blocked — need OAuth client id").
function blockedNote(t) {
  if (t.status !== 'blocked') return '';
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i];
    if (e.task_id !== t.id || e.kind !== 'task_updated' || e.data?.status !== 'blocked') continue;
    const s = String(e.text).replace(/^#\d+\s*/, '').replace(/^\w+ → \w+(\s+—\s+)?/, '').trim();
    if (s && s !== 'updated') return s;
  }
  return '';
}
// A task's pull request, from its link and (when the host has gh) its state on GitHub.
// text: the most important thing about it; cls: pill colour.
function prInfo(t) {
  const url = t.pr?.url || t.pr_url; if (!url || !isWebUrl(url)) return null;
  const p = t.pr || {};
  const r = prInfoBase(url, p);
  r.failing = Array.isArray(p.failing) ? p.failing : [];
  r.tip = `Open the pull request${r.text ? ` (${r.text})` : ''}${r.failing.length ? `. Failing: ${r.failing.join(', ')}` : ''}${p.conflict ? '. It conflicts with main: the author has to merge main into the branch and resolve it' : p.behind ? '. main has moved on since: update the branch before merging' : ''}`;
  return r;
}
function prInfoBase(url, p) {
  if (p.state === 'MERGED') return { url, text: 'merged', cls: 'ok' };
  if (p.state === 'CLOSED') return { url, text: 'closed', cls: 'bad' };
  if (p.conflict) return { url, text: 'merge conflict', cls: 'bad' };
  if (p.review === 'CHANGES_REQUESTED') return { url, text: 'changes requested', cls: 'bad' };
  if (p.checks === 'fail') return { url, text: 'checks ✗', cls: 'bad' };
  if (p.checks === 'pending') return { url, text: 'checks …', cls: 'warn' };
  if (p.behind) return { url, text: 'behind main', cls: 'warn' };
  if (p.review === 'APPROVED') return { url, text: p.checks === 'pass' ? 'approved · checks ✓' : 'approved', cls: 'ok' };
  if (p.checks === 'pass') return { url, text: 'checks ✓', cls: 'ok' };
  return { url, text: '', cls: '' };
}
// Failing checks and the latest review comments on a task's pull request (from the host's gh), for the task dialog.
function prFeedback(t) {
  const p = t.pr || {}; const failing = Array.isArray(p.failing) ? p.failing : []; const fb = Array.isArray(p.feedback) ? p.feedback : [];
  const extra = p.conflict ? '<div><b>Merge conflict:</b> the branch conflicts with main. The author merges main into it and resolves the conflict.</div>' : p.behind ? '<div><b>Behind main:</b> main has new commits; update the branch before merging.</div>' : '';
  if (!failing.length && !fb.length) return extra ? `<div class="prfb row">${extra}</div>` : '';
  const kindText = (f) => f.kind === 'review' ? (f.state === 'CHANGES_REQUESTED' ? 'requested changes' : f.state === 'APPROVED' ? 'approved' : 'reviewed') : 'commented';
  return `<div class="prfb row">${extra}${failing.length ? `<div><b>Failing checks:</b> ${esc(failing.join(', '))}</div>` : ''}${fb.length ? `<div><b>Latest review feedback</b></div><ul>${fb.slice(0, 5).map((f) => `<li><b>${esc(f.author || 'someone')}</b> <span class="muted">${esc(kindText(f))}</span>${f.body ? `: ${fmt(String(f.body), true)}` : ''}</li>`).join('')}</ul>` : ''}</div>`;
}
// When a human last pinged this task's owner from a card ("#12 has had no update…"), within 10 minutes.
function pingedAt(t) {
  if (!t.assignee) return 0;
  const who = agentRoot(t.assignee).toLowerCase(); const since = Date.now() - 10 * 60e3;
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i]; if (e.ts < since) break;
    if (e.kind === 'message' && String(e.text).includes(`#${t.id} has had no update`) && (e.data?.mentions || []).some((m) => agentRoot(m).toLowerCase() === who)) return e.ts;
  }
  return 0;
}
function card(t) {
  const deps = t.depends_on.map((d) => ({ id: d, t: taskById(d) }));
  const waiting = t.status === 'done' ? [] : deps.filter((d) => !d.t || d.t.status !== 'done');
  const stale = isStale(t);
  const note = blockedNote(t);
  const q = openQuestions().find((x) => x.task_id === t.id);
  const size = ['S', 'L'].includes(t.size) ? t.size : 'M';
  // Reserved: shown until the reserved agent itself holds it.
  const rsv = t.reserved_for && t.status !== 'done' && agentRoot(t.assignee) !== agentRoot(t.reserved_for);
  const off = stale && ownerOffline(t);
  const prop = t.status === 'proposed';
  const outU = !!t.assignee && HOLDING.includes(t.status) && agentLimited(t.assignee);
  const pr = prInfo(t);
  const merging = t.status === 'review' && t.reviewer;
  const prio = t.priority === 1 ? 'P1, high priority' : t.priority >= 3 ? 'low priority' : 'normal priority';
  // Feature freeze: an open task that isn't a P1 bug fix won't be started before the demo.
  const tm = timeNow(); const held = tm.frozen && !tm.past && (t.status === 'open' || prop) && t.priority !== 1;
  const aria = `#${t.id} ${t.title}. ${LABEL[t.status]}${prop ? ` by ${t.created_by}, waiting for approval` : ''}, ${t.assignee ? 'assigned to ' + t.assignee : 'unassigned'}, ${prio}${waiting.length ? `, waits on ${waiting.map((d) => '#' + d.id).join(' and ')}` : ''}${size !== 'M' ? `, size ${size}` : ''}${rsv ? `, reserved for ${t.reserved_for}` : ''}${pr ? `, pull request${pr.text ? ': ' + pr.text : ''}` : ''}${merging ? `, being merged by ${t.reviewer}` : ''}${stale ? `, stale: no update for 15+ minutes${off ? ', owner offline: agents may take it over' : ''}` : ''}${outU ? ', owner out of usage: agents may take it over' : ''}${q ? ', question waiting' : ''}${note ? `, blocked: ${note}` : ''}${held ? ', on hold for the feature freeze' : ''}. Press Enter to open`;
  const menu = ui.moveMenu === t.id ? `<div class="mvmenu" role="group" aria-label="Move #${t.id} to"><span class="ml">Move to:</span>${COLS.filter((s) => s !== t.status).map((s) => `<button type="button" class="ghost" data-move-to="${s}" data-move-id="${t.id}" data-fk="mt-${t.id}-${s}">${LABEL[s]}</button>`).join('')}</div>` : '';
  const ask = moveAskHtml(t);
  const rej = ui.rejecting === t.id;
  const propActs = prop ? (rej
    ? `<form class="rj" data-rjform="${t.id}"><label class="vh" for="rj-${t.id}">Why reject #${t.id}? (optional)</label><input id="rj-${t.id}" data-keep="rj-${t.id}" placeholder="Why? (optional, sent to ${esc(t.created_by)})" maxlength="300"><button type="submit" class="danger" data-fk="rjy-${t.id}">Reject</button><button type="button" class="ghost" data-reject-no="${t.id}" data-fk="rjn-${t.id}">Cancel</button></form>`
    : `<button type="button" data-approve="${t.id}" data-fk="ap-${t.id}" title="Make it a normal open task agents can claim">Approve</button><button type="button" class="ghost" data-reject="${t.id}" data-fk="rj-b-${t.id}" title="Remove it; ${esc(t.created_by)} is told why">Reject…</button>`) : '';
  return `<article class="card ${t.assignee ? 'has-owner' : ''} ${stale ? 'stale' : ''} ${prop ? 'proposed' : ''} ${held ? 'held' : ''}" ${t.assignee ? hs(t.assignee) : ''} data-id="${t.id}" data-fk="card-${t.id}" tabindex="0" draggable="true" aria-label="${esc(aria)}">
    <div class="ct" title="${esc(t.title)}"><span class="id">#${t.id}</span> ${esc(t.title)}</div>
    ${note ? `<div class="bn" title="Latest note when it got blocked">“${esc(short(note, 140))}”</div>` : ''}
    <div class="cm">${t.priority === 1 ? '<span class="pill bad" title="Priority 1: do first (often something other tasks build on)">P1</span>' : t.priority >= 3 ? '<span class="pill" title="Priority 3: low, nice to have">P3</span>' : ''}
      ${size !== 'M' ? `<span class="pill size ${size}" title="${SIZE_TIP[size]}"><span class="vh">size </span>${size}</span>` : ''}
      ${prop ? `<span class="pill flag" title="Proposed by ${esc(t.created_by)}: nobody can claim it until the planner or a human approves it">proposed by ${esc(t.created_by)}</span>` : ''}
      ${rsv ? (() => { const away = ownerOffline({ assignee: t.reserved_for }) || agentLimited(t.reserved_for);
        return away ? `<span class="pill rsv" title="Reserved for ${esc(t.reserved_for)}, who isn't around (offline or out of usage), so any agent may take it">reserved for ${esc(t.reserved_for)} · away, open to anyone</span>`
          : `<span class="pill rsv" title="Reserved: only ${esc(t.reserved_for)} can claim it, and it's listed first for them">reserved for ${esc(t.reserved_for)}</span>`; })() : ''}
      ${pr ? `<a class="pill ${pr.cls}" href="${esc(pr.url)}" target="_blank" rel="noopener noreferrer" title="${esc(pr.tip)}">PR${pr.text ? ' · ' + esc(pr.text) : ''}</a>` : ''}
      ${merging ? `<span class="pill role" title="${esc(t.reviewer)} is reviewing and merging it">merging: ${esc(t.reviewer)}</span>` : ''}
      ${t.assignee ? `<span class="pc" ${hs(t.assignee)} title="Assigned to ${esc(t.assignee)}">${esc(t.assignee)}</span>` : t.status !== 'done' && t.status !== 'open' && !prop ? '<span class="pill warn" title="Nobody holds this task: open it to pick who it is for, or move it back to Open">unassigned</span>' : ''}
      ${t.status === 'claimed' ? '<span title="Claimed: an agent picked it up but hasn’t started yet">claimed, not started</span>' : ''}
      ${waiting.length ? `<span class="pill flag" title="Depends on other tasks: can't be picked up until these are done">waits on ${waiting.map((d) => '#' + d.id).join(' ')}</span>` : deps.length ? `<span title="Dependencies done">after ${deps.map((d) => '#' + d.id).join(' ')} ✓</span>` : ''}
      ${stale ? `<span class="pill flag" title="Stale: no update for 15+ minutes. The agent may be stuck: ping it, or release the task back to Open.${off ? ' Its owner is offline, so other agents may take it over.' : ''}">stale</span>` : ''}
      <span title="Last update ${esc(fullTime(t.updated_at))}">${ago(t.updated_at)}</span>
      <button type="button" class="mv" data-move="${t.id}" data-fk="mv-${t.id}" aria-expanded="${ui.moveMenu === t.id}" aria-label="Move #${t.id} to another column" title="Change status">Move…</button></div>
    ${q || stale || outU || prop ? `<div class="ca">${propActs}${q ? `<button type="button" class="qb" data-go-q="${q.id}" data-fk="cq-${t.id}" title="${esc(short(q.question, 120))}">question waiting</button>` : ''}${outU ? '<span class="own off">owner out of usage — agents may take it over</span>' : stale && t.assignee ? `<span class="own${off ? ' off' : ''}">${off ? `owner offline — agents may take it over` : `${esc(agentRoot(t.assignee))} is still online: ping it first`}</span>` : ''}${stale || outU ? `<button type="button" class="ghost" data-release="${t.id}" data-fk="rel-${t.id}">Release to Open</button>${t.assignee && !outU ? (pingedAt(t) ? `<span class="muted t-meta" title="You can ping again 10 minutes after the last ping">pinged ${ago(pingedAt(t))}</span>` : `<button type="button" class="ghost" data-ping="${t.id}" data-fk="ping-${t.id}" title="Post a message asking ${esc(t.assignee)} whether it's still on it">Ping @${esc(agentRoot(t.assignee))}</button>`) : ''}` : ''}</div>` : ''}
    ${menu}${ask}</article>`;
}
function doneOpen() {
  if (ui.doneOpen === 'open') return true;
  if (ui.doneOpen === 'closed') return false;
  return ($('board').clientWidth || window.innerWidth) >= 5 * 170 + 50; // auto: only when all five columns fit
}
// Search box + Columns/Table toggle. The box is static HTML (never re-rendered), so typed text survives.
const tv = { view: store.get('board-view') === 'table' ? 'table' : 'columns', q: '', sort: 'status', dir: 1 };
const taskText = (t) => `#${t.id} ${t.id} ${t.title} ${t.assignee || ''} ${t.reviewer || ''}`.toLowerCase();
function taskShown(t) {
  if (!taskVisible(t)) return false;
  const q = tv.q.trim().toLowerCase(); if (!q) return true;
  return q.split(/\s+/).every((w) => taskText(t).includes(w));
}
const TSORT = {
  status: (t) => (t.status === 'proposed' ? -1 : STATUSES.indexOf(t.status)),
  priority: (t) => t.priority || 2,
  size: (t) => ['S', 'M', 'L'].indexOf(t.size) + 1 || 2,
  assignee: (t) => (t.assignee || '\uffff').toLowerCase(),
  updated: (t) => -(t.updated_at || 0),
};
const TCOLS = [['id', '#'], ['title', 'Task'], ['status', 'Status'], ['priority', 'Priority'], ['size', 'Size'], ['assignee', 'Assignee'], ['updated', 'Updated']];
function renderTable(visible) {
  const f = TSORT[tv.sort] || TSORT.status;
  const rows = [...visible].sort((a, b) => { const x = f(a); const y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * tv.dir || a.id - b.id; });
  const th = TCOLS.map(([k, l]) => TSORT[k]
    ? `<th scope="col" aria-sort="${tv.sort === k ? (tv.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" data-tsort="${k}" data-fk="ts-${k}">${l}</button></th>`
    : `<th scope="col">${l}</th>`).join('');
  const body = rows.map((t) => `<tr data-open-task="${t.id}" data-id="${t.id}"><td>#${t.id}</td><td class="tt"><button type="button" class="link" data-open-task="${t.id}" data-fk="tt-${t.id}">${esc(t.title)}</button></td><td><span class="pill s-${t.status}">${LABEL[t.status]}</span></td><td>P${t.priority || 2}</td><td>${['S', 'L'].includes(t.size) ? t.size : 'M'}</td><td>${t.assignee ? esc(t.assignee) : '<span class="muted">unassigned</span>'}</td><td title="Last update ${esc(fullTime(t.updated_at))}">${ago(t.updated_at)}</td></tr>`).join('');
  patch($('tasktable'), `<table><caption class="vh">Tasks, sorted by ${tv.sort}</caption><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>${rows.length ? '' : `<p class="muted tt-empty">${tv.q.trim() ? 'No tasks match your search.' : 'No tasks to show.'}</p>`}`);
}
$('tsearch').addEventListener('input', () => { tv.q = $('tsearch').value; renderBoard(); renderOffice(); });
const noMatchHtml = (fk) => `No tasks match “${esc(tv.q.trim())}”. <button type="button" class="link" data-act="clear-search" data-fk="${fk}">Clear search</button>`;
$('viewtog').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-view]'); if (!b) return;
  tv.view = b.dataset.view === 'table' ? 'table' : 'columns'; store.set('board-view', tv.view); renderBoard(); renderOffice();
});
$('tasktable').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-tsort]'); if (!b) return;
  if (tv.sort === b.dataset.tsort) tv.dir = -tv.dir; else { tv.sort = b.dataset.tsort; tv.dir = 1; }
  renderBoard();
});
// A column's cards, the same order in both views: proposals at the top of Open, then priority, then oldest first (the
// order agents claim them in); Done newest first.
function colSort(list, col) {
  if (col === 'done') return list.sort((a, b) => b.updated_at - a.updated_at);
  return list.sort((a, b) => (col === 'open' && (b.status === 'proposed') - (a.status === 'proposed')) || a.priority - b.priority || a.id - b.id);
}
function renderBoard() {
  const visible = state.tasks.filter(taskShown);
  const table = tv.view === 'table';
  $('viewtog').querySelectorAll('button').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.view === tv.view)); b.tabIndex = b.dataset.view === tv.view ? -1 : 0; });
  $('taskbar').classList.toggle('none', !state.tasks.length);
  // A search that matches nothing: one line with a way out, instead of "no matches" in every column.
  const noMatch = state.tasks.length > 0 && !!tv.q.trim() && !visible.length;
  if (state.tasks.length) { const be = $('board-empty'); be.hidden = !noMatch; patch(be, noMatch ? noMatchHtml('clear-search') : ''); }
  $('board').hidden = table || noMatch; $('tasktable').hidden = !table || !state.tasks.length || noMatch; $('cols-hint').hidden = table || noMatch;
  if (table) { if (state.tasks.length && !noMatch) renderTable(visible); return; }
  const dOpen = doneOpen();
  const tm = timeNow(); const frozen = tm.frozen && !tm.past;
  $('board').classList.toggle('none', !state.tasks.length);
  $('board').classList.toggle('done-closed', !dOpen);
  const html = COLS.map((s) => {
    // Proposed tasks sit at the top of Open until someone approves them; claimed ones in In progress.
    let items = colSort(visible.filter((t) => colOf(t) === s), s);
    const total = items.length;
    if (s === 'done' && !dOpen) {
      return `<div class="col s-done collapsed" data-status="done" id="col-done" role="region" aria-label="Done, ${plural(total, 'task')}"><button type="button" class="dtog" id="colh-done" data-act="done-toggle" data-fk="done-tog" aria-expanded="false" aria-label="Done, ${plural(total, 'task')}: show the column" title="Show the Done column (tasks merged into main). You can still drop cards here."><span class="ok-mk" aria-hidden="true">✓</span>Done ${total} <span class="chev" aria-hidden="true">▾</span></button></div>`;
    }
    let more = '';
    if (s === 'done') {
      if (!ui.showAllDone && items.length > DONE_SHOWN) { more = `<button class="ghost more" data-show-done data-fk="more-done">Show ${items.length - DONE_SHOWN} older</button>`; items = items.slice(0, DONE_SHOWN); }
      else if (ui.showAllDone && items.length > DONE_SHOWN) more = `<button class="ghost more" data-show-done data-fk="more-done">Show fewer</button>`;
    } else if (items.length > COL_SHOWN + 3) {
      // Long columns: the first COL_SHOWN, plus any card that needs a human (proposed, stale, question, open menu).
      const all = (ui.showCols ||= new Set()).has(s);
      const keep = (t, i) => all || i < COL_SHOWN || t.status === 'proposed' || isStale(t) || ui.moveMenu === t.id || ui.moveAsk?.id === t.id || openQuestions().some((q) => q.task_id === t.id);
      const shown = items.filter(keep);
      more = `<button class="ghost more" data-show-col="${s}" data-fk="more-${s}">${all ? 'Show fewer' : `Show ${items.length - shown.length} more`}</button>`;
      items = shown;
    }
    const empty = !state.tasks.length ? '' : tv.q.trim() && !total ? 'No matches' : filterRoot() && !total ? `None for ${esc(filterRoot())}` : COL_EMPTY[s];
    // Feature freeze: Open says what can still start.
    const desc = s === 'open' && frozen ? FROZEN_DESC : COL_DESC[s];
    return `<div class="col s-${s} ${total ? 'has' : ''}" data-status="${s}" id="col-${s}" role="region" aria-label="${LABEL[s]}, ${plural(total, 'task')}" aria-describedby="cold-${s}"><h3 title="${COL_DESC[s]}"><span id="colh-${s}">${LABEL[s]}</span><span><span id="colc-${s}">${total}</span>${s === 'done' ? '<button type="button" class="dclose" data-act="done-toggle" data-fk="done-close" aria-expanded="true" aria-label="Collapse the Done column" title="Collapse"><span class="chev" aria-hidden="true">▾</span></button>' : ''}</span></h3><p class="cd${desc !== COL_DESC[s] ? ' fz-note' : ''}" id="cold-${s}" title="${desc}">${desc}</p>
      ${items.length ? `<ul class="cards">${items.map((t) => `<li>${card(t)}</li>`).join('')}</ul>` : empty ? `<div class="empty">${empty}</div>` : ''}${more}</div>`;
  }).join('');
  const el = $('board');
  const before = boardDrawn && el._html !== html && canMove() ? cardRects() : null;
  // Roving tabindex only when the board was redrawn (focus moves between cards are handled by roveTo).
  if (patch(el, html)) roveCards();
  boardDrawn = true;
  if (before) moveCards(before);
}
let boardDrawn = false;

// A change made with a board control (e.g. marking an agent out of usage) is posted as a message so agents
// read it, but it isn't something the person wrote: show it as a status line, in words for people.
const isAction = (e) => e.kind === 'message' && !!e.data?.action;
const isChat = (e) => (e.kind === 'message' && !isAction(e)) || e.kind === 'question' || e.kind === 'answer';
const actionText = (e) => String(e.text).replace(/^@all\s+/, '').replace(/ \(set on the web board\)/g, '').replace(/: release_task and claim\./g, '.').replace(/task\(s\)/g, 'tasks');
// Long posts are clamped to 4 lines with "Show more"; which ones are open survives re-renders.
const expandedEv = new Set();
const isLong = (t) => String(t || '').split('\n').length > 5 || String(t || '').length > 500;
// Roving tabindex: one Tab stop per column. Arrow keys move between its cards (Left/Right: next column);
// the current card's own buttons and links stay in the Tab order, other cards' are skipped.
const roveAt = {}; // column status → id of its current card
const CARD_CTLS = 'button, a[href], input, select, textarea';
function setRove(c, on) {
  c.tabIndex = on ? 0 : -1;
  for (const n of c.querySelectorAll(CARD_CTLS)) {
    if (!('rt' in n.dataset)) n.dataset.rt = n.getAttribute('tabindex') ?? '';
    if (!on) n.tabIndex = -1; else if (n.dataset.rt === '') n.removeAttribute('tabindex'); else n.setAttribute('tabindex', n.dataset.rt);
  }
}
function roveCards() {
  const act = document.activeElement?.closest?.('.card');
  for (const col of $('board').querySelectorAll('.col')) {
    const cards = [...col.querySelectorAll('.card')]; if (!cards.length) continue;
    const cur = cards.find((c) => c === act) || cards.find((c) => c.dataset.id === roveAt[col.dataset.status]) || cards[0];
    for (const c of cards) setRove(c, c === cur);
  }
}
function roveTo(c) {
  const col = c.closest('.col'); if (!col) return;
  roveAt[col.dataset.status] = c.dataset.id;
  for (const x of col.querySelectorAll('.card')) setRove(x, x === c);
}
$('board').addEventListener('focusin', (ev) => { const c = ev.target.closest('.card'); if (c && c.tabIndex !== 0) roveTo(c); });
$('board').addEventListener('keydown', (ev) => {
  const c = ev.target.closest?.('.card'); if (!c || ev.target !== c || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const col = c.closest('.col'); const cards = [...col.querySelectorAll('.card')]; const i = cards.indexOf(c);
  let n = null;
  if (ev.key === 'ArrowDown') n = cards[i + 1];
  else if (ev.key === 'ArrowUp') n = cards[i - 1];
  else if (ev.key === 'Home') n = cards[0];
  else if (ev.key === 'End') n = cards[cards.length - 1];
  else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
    const cols = [...$('board').querySelectorAll('.col')].filter((x) => x.querySelector('.card'));
    const nc = cols[cols.indexOf(col) + (ev.key === 'ArrowRight' ? 1 : -1)];
    n = nc && (nc.querySelector('.card[tabindex="0"]') || nc.querySelector('.card'));
  } else return;
  ev.preventDefault();
  if (n) { n.focus(); n.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
});

// Drag & drop between columns (the one board, in either view: the 3D Tasks window shows the same columns). The same
// rules either way (moveTask). The board doesn't re-render its columns mid-drag. The
// room's camera only listens on its canvas, which a drag over the window never reaches.
const DRAG_CARD = '.card', DROP_COL = '.col';
document.addEventListener('dragstart', (ev) => {
  const c = ev.target.closest?.(DRAG_CARD); if (!c) return;
  ui.dragging = true; c.classList.add('dragging');
  ev.dataTransfer.setData('text/plain', c.dataset.id); ev.dataTransfer.effectAllowed = 'move';
});
document.addEventListener('dragend', (ev) => {
  ui.dragging = false; ev.target.closest?.(DRAG_CARD)?.classList.remove('dragging');
  document.querySelectorAll('.drop').forEach((c) => c.classList.remove('drop'));
  $('board')._html = undefined; render();
});
document.addEventListener('dragover', (ev) => {
  const col = ev.target.closest?.(DROP_COL); if (!col || !ui.dragging) return;
  ev.preventDefault(); ev.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.drop').forEach((c) => c !== col && c.classList.remove('drop'));
  col.classList.add('drop');
});
document.addEventListener('drop', (ev) => {
  const col = ev.target.closest?.(DROP_COL); if (!col) return;
  ev.preventDefault();
  const id = Number(ev.dataTransfer.getData('text/plain')); const t = taskById(id); const to = col.dataset.status;
  ui.dragging = false; // dropped: the columns may render again (the owner question shows on the card)
  if (t && colOf(t) !== to) moveTask(t, to);
});
// Change a task's status (drag, Move… menu, Release). The toast offers Undo.
// Claimed / In progress need an owner (asked on the card) and finished dependencies ("Move anyway").
function moveTask(t, to, { force = false, assignee } = {}) {
  const from = t.status; const prevAssignee = t.assignee; const id = t.id;
  if (HOLDING.includes(to) && !HOLDING.includes(from) && !force) {
    const waiting = t.depends_on.filter((d) => { const x = taskById(d); return x && x.status !== 'done'; });
    if (waiting.length) return toast(`#${id} waits on ${waiting.map((d) => '#' + d).join(', ')}, which ${waiting.length > 1 ? "aren't" : "isn't"} done yet.`, true, { label: 'Move anyway', run: () => setTimeout(() => moveTask(taskById(id) || t, to, { force: true })) }); // after this click's handlers
  }
  if (HOLDING.includes(to) && !assignee && !t.assignee) {
    if (!askAgents(t).length) return toast(`#${id} needs someone to work on it before it can be ${LABEL[to]}. No agent has joined yet.`, true);
    ui.moveAsk = { id, to, force }; render();
    return focusMoveAsk();
  }
  t.status = to; t.updated_at = Date.now(); t.stale = false; if (to === 'open') t.assignee = null; if (assignee) t.assignee = assignee; // optimistic
  api(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status: to, ...(assignee ? { assignee } : {}), ...(force ? { force: true } : {}) }) })
    .then(() => {
      toast(`#${id} moved to ${LABEL[to]}${assignee ? ` for ${assignee}` : ''}${to === 'open' && from !== 'open' && prevAssignee ? ' (unassigned)' : ''}`, false, { label: 'Undo', run: () => {
        act(api(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(from === 'open' ? { status: from } : { status: from, assignee: prevAssignee, force: true }) }), `#${id} is back in ${LABEL[from]}`).catch(() => {});
      } });
      scheduleReload();
    })
    .catch((e) => { toast(e.message, true); scheduleReload(); });
}
// Who a moved card can be for: started or online agents, the reserved one first.
function askAgents(t) {
  const r = t.reserved_for ? agentRoot(t.reserved_for) : '';
  return [...agentInfo().values()].filter((a) => a.started || a.online).map((a) => a.name)
    .sort((a, b) => (agentRoot(b) === r) - (agentRoot(a) === r) || a.localeCompare(b));
}

// Done auto-collapses when six columns don't fit: re-check when the window size changes.
let resizeT; addEventListener('resize', () => { if (ui.doneOpen) return; clearTimeout(resizeT); resizeT = setTimeout(() => { if (!$('app').hidden) render(); }, 200); });

export { actionText, askAgents, blockedNote, ciPill, doneOpen, expandedEv, isAction, isChat, isLong, moveTask,
  pingedAt, prFeedback, prInfo, renderBoard, renderBoardEmpty, renderBoardNote, renderCi, renderFilter, taskShown, tv };
