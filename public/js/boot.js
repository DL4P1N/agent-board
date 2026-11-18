// The entry point: <script type="module" src="js/boot.js"> in index.html. Being split into modules: each imports the one
// before it first, so they run in the order the page's old inline script had. What isn't in a module yet is here,
// still in its old order, and runs last.

import './derived.js';
import { $, ACTIVE, ALL_PHASES, ANYONE, BASE, COL_DESC, COL_EMPTY, COL_SHOWN, COLS, DONE_SHOWN, FROZEN_DESC, HINT,
  HOLDING, HUES, LABEL, me, nsKey, oSave, oUi, qs, reduceMotion, seenMention, setSeenMention, setToken, SIZE_TIP,
  SLUG, smooth, state, STATUSES, store, token, ui } from './state.js';
import { agentRoot, ago, announce, canMove, cardRects, clock, cmdBox, esc, fmt, fullTime, FUNNEL, hs, hue, isHttps,
  isMe, isStale, isWebUrl, knownPeople, mentionsLite, mentionsMe, moveCards, nameHash, nameTag, ownerOffline, patch,
  plural, reveal, root, short, taskById, timeEl, toast, when, who, youTag } from './helpers.js';
import { act, api, connect, es, esOpen, load, recheck, scheduleReload, setConn, setLoad, showGate, tokenError,
  unavailable, unavailableStatus } from './data.js';
import { agentInfo, agentInfoNow, agentLimited, agentOf, agentsLine, agentState, approvalWait, blockedSplit,
  bouncedTasks, capText, capTip, clientOf, colOf, copilotLaunch, cutTasks, dlSkipped, dur, filterRoot, isLimited,
  limitText, notStartedText, openQuestions, outlook, people, roster, setupInfo, setupOpen, setupShown, startCmd,
  stays, stepOpen, taskVisible, teamCapacity, timeNow, unreadMentions } from './derived.js';

let editing = null; // snapshot of the task open in the dialog
let keysOn = store.get('board-keys') !== 'off';
let prevFrozen = null;
function renderClock() {
  const t = timeNow(); const b = $('clock');
  // DEMO, then the time itself ("in 2h 0m", never cut), then the rest (freeze time, verdict), which is cut first.
  const chip = (tm, rest = '') => `<span class="tbl">Demo</span> <span class="o-x"><span class="tm">${tm}</span>${rest ? `<span class="rest">${rest}</span>` : ''}</span><span class="o-ar" aria-hidden="true">▾</span>`;
  if (!t.deadline) {
    prevFrozen = null;
    const h = chip('not set'); if (b._html !== h) { b.innerHTML = h; b._html = h; }
    b.className = 'tbc clock unset'; b.title = 'No demo time yet: set it so agents stop on time'; b.setAttribute('aria-label', 'Demo time not set. Set it');
    return;
  }
  const now = Date.now();
  // tm + detail: the detail (freeze time) hides on narrower screens when a verdict follows the time.
  let tm, detail = '', cls = '', tip;
  if (t.past) { tm = 'time passed'; cls = 'past'; tip = `The demo was at ${when(t.deadline)}. Click to change the time.`; }
  else if (t.frozen) { tm = `in ${dur(t.deadline - now)}`; cls = 'frozen'; tip = `Feature freeze since ${when(t.freezeAt)}: agents don't take new tasks, except priority-1 bug fixes. Demo at ${when(t.deadline)}. Click to change the time.`; }
  else {
    tm = `in ${dur(t.deadline - now)}`; detail = t.fm ? ` · freeze ${t.warn ? 'in ' + dur(t.freezeAt - now) : when(t.freezeAt)}` : '';
    cls = t.warn ? 'warn' : ''; tip = `Demo at ${when(t.deadline)}${t.fm ? `; feature freeze at ${when(t.freezeAt)} (${t.fm} min before): agents stop taking new tasks then (priority-1 bug fixes still allowed)` : ''}. Click to change.`;
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
  b.className = 'tbc clock ' + cls + (vd ? ' v-' + vd.verdict : ''); b.title = tip; b.setAttribute('aria-label', `${text}. Change the demo time`);
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

// ---------- export: write-up + backup ----------
async function fetchExport(kind) {
  let r;
  try { r = await fetch(BASE + '/api/' + (kind === 'json' ? 'export' : kind === 'retro' ? 'retro' : 'summary'), { cache: 'no-store', headers: { Authorization: 'Bearer ' + token } }); }
  catch { throw new Error('Cannot reach the board server. Is it still running?'); }
  const body = await r.clone().json().catch(() => ({}));
  if (unavailableStatus(r.status, body)) throw new Error('Token rejected');
  if (r.status === 401) { showGate(tokenError(body)); throw new Error('Token rejected'); }
  if (!r.ok) throw new Error(`Could not get the ${kind === 'json' ? 'backup' : kind === 'retro' ? 'retro' : 'summary'} (${r.status})`);
  return r.text();
}
async function exportFile(kind, btn) {
  if (btn) btn.disabled = true;
  try {
    const text = await fetchExport(kind);
    if (kind === 'copy') return copyText(text, btn, 'Summary copied (markdown). Paste it into your submission.');
    const day = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: kind === 'json' ? 'application/json' : 'text/markdown' }));
    a.download = kind === 'json' ? `agent-board-backup-${day}.json` : kind === 'retro' ? `agent-board-retro-${day}.md` : `agent-board-summary-${day}.md`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast(kind === 'json' ? 'Backup downloaded (JSON).' : kind === 'retro' ? 'Retro downloaded (markdown): what took long, review bounces, where it got stuck.' : 'Summary downloaded (markdown).');
  } catch (e) { if (e.message !== 'Token rejected') toast(e.message, true); }
  finally { if (btn) { btn.disabled = false; btn.focus({ preventScroll: true }); } }
}
const exportBtns = (k) => `<button type="button" data-act="export-md" data-fk="${k}-md">Download summary (.md)</button><button type="button" class="ghost" data-act="export-copy" data-fk="${k}-cp">Copy summary</button><button type="button" class="ghost" data-act="export-retro" data-fk="${k}-rt" title="For the team: time per task, review bounces, where work got stuck">Download retro (.md)</button><button type="button" class="ghost" data-act="export-json" data-fk="${k}-js">Download backup (JSON)</button>`;

// ---------- desktop notifications (opt-in; only while this tab is in the background) ----------
let notifyOn = store.get('board-notify') === 'on';
const hasNotify = () => 'Notification' in window;
function notifyState() {
  if (!hasNotify()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return notifyOn && Notification.permission === 'granted' ? 'on' : 'off';
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
  let p = Notification.permission;
  if (p === 'default') { try { p = await Notification.requestPermission(); } catch { p = Notification.permission; } }
  if (p !== 'granted') {
    notifyOn = false; store.set('board-notify', 'off'); renderBell();
    return toast(p === 'denied' ? 'Notifications are blocked for this page. Allow them in your browser\'s site settings (the icon left of the address), then press the bell again.' : 'Notifications stay off: the browser didn\'t get a yes.', true);
  }
  notifyOn = true; store.set('board-notify', 'on'); renderBell();
  toast('Notifications on. You\'ll get one when this tab is in the background.');
}
// Status changes this page made itself, so "blocked" by you doesn't notify you.
const selfMoves = new Map();
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

// Screen readers: mentions of me and newly blocked tasks, said politely, at most once every ACT_GAP ms.
// Questions and the freeze have their own announcements (#announcer).
let ACT_GAP = 10e3;
function setActGap(ms) { ACT_GAP = ms; } // tests shorten it (through window, see boot.js)
let actCursor = null, actQueue = [], actTimer = 0, actLast = 0;
function activityLine(e) {
  if (e.kind === 'message' && mentionsMe(e)) return `${e.author} mentioned you: ${short(e.text, 120)}`;
  if (e.kind === 'task_updated' && e.data?.status === 'blocked' && e.task_id) {
    const s = selfMoves.get(e.task_id); if (s && s.status === 'blocked' && Date.now() - s.ts < 2 * 60e3) return null;
    const t = taskById(e.task_id); return t && t.status === 'blocked' ? `#${t.id} is blocked: ${short(t.title, 80)}` : null;
  }
  return null;
}
function announceActivity() {
  const maxId = state.events.reduce((m, e) => Math.max(m, e.id), 0);
  if (actCursor === null) { actCursor = maxId; return; } // history on first load isn't read out
  for (const e of state.events) if (e.id > actCursor) { const l = activityLine(e); if (l) actQueue.push(l); }
  actCursor = Math.max(actCursor, maxId);
  flushActivity();
}
function flushActivity() {
  if (!actQueue.length || actTimer) return;
  const wait = actLast + ACT_GAP - Date.now();
  if (wait > 0) { actTimer = setTimeout(() => { actTimer = 0; flushActivity(); }, wait); return; }
  const q = actQueue.splice(0); actLast = Date.now();
  const msg = q.length === 1 ? q[0] : `${q.length} updates. ${q.slice(0, 3).join('. ')}${q.length > 3 ? '. And more in the activity feed' : ''}`;
  const a = $('activity-live'); a.textContent = ''; setTimeout(() => { a.textContent = msg; }, 60);
}

// ---------- render ----------
let prevQIds = null;
function render() {
  $('me').textContent = me; $('me-btn').setAttribute('aria-label', `You: ${me}. Change your name`);
  // Presenter view opens with the read-only viewer token, never the board token; hidden until the server gives one.
  { const vt = state.setup?.viewer_token; const pl = $('present-link'); pl.hidden = !vt; $('present-row').hidden = !vt; if (vt) pl.href = BASE + '/present.html?token=' + encodeURIComponent(vt); }
  const qOpen = openQuestions();
  // Screen readers: one polite announcement when a new question arrives (not on every refresh).
  if (prevQIds) {
    const fresh = qOpen.filter((q) => !prevQIds.has(q.id));
    if (fresh.length && qOpen.length > prevQIds.size) announce(fresh.length > 1 ? `${fresh.length} new questions for the humans` : `New question from ${fresh[0].asker}`);
  }
  prevQIds = new Set(qOpen.map((q) => q.id));
  const unread = unreadMentions();
  if (ui.tab === 'me' && unread.length) { markMentionsSeen(); return render(); }
  // The open thread is read while it's on screen.
  if (ui.tab === 'direct' && ui.dm && document.visibilityState === 'visible') markDmSeen(ui.dm);
  const dmN = dmUnreadCount();
  document.title = (qOpen.length + unread.length + dmN ? `(${qOpen.length + unread.length + dmN}) ` : '') + (SLUG ? `${state.board?.name || SLUG} · ` : '') + 'Agent Board';
  if (SLUG && state.board?.name) { const b = $('bname'); if (b.textContent !== state.board.name) { b.textContent = state.board.name; b.title = `Board "${state.board.name}" (/b/${SLUG}/) on this server`; } }
  renderNeeds(qOpen, unread);
  renderClock(); renderBell();
  const si = setupInfo();
  renderNow(qOpen, unread, si);
  renderTopbar(si);
  renderSetup(si);
  renderBoardEmpty(si);
  renderBoardNote(); renderCi();
  renderQuestions(qOpen);
  renderAgents(si, qOpen); requestAnimationFrame(fadeAgents);
  renderFilter();
  if (!ui.dragging) renderBoard();
  renderFeed(unread.length);
  renderLocks();
  renderDocks(qOpen, si);
  if ($('task-dlg').open) renderDialogLive();
  checkNotify(); announceActivity();
  if (boardView === 'office') { office.mod?.update(officeState()); if (!ui.dragging) renderOffice(); }
}
// The header's one needs-attention count badge: what waits on a human. Shown only while What to do now (where each of these
// is listed) is scrolled out of view; it jumps back up there.
function renderNeeds(qOpen, unread) {
  const blocked = blockedSplit(qOpen).alone.length;
  const clash = [...agentInfoNow().values()].filter((a) => a.conflict).length;
  const parts = [[qOpen.length, 'question'], [blocked, 'blocked task'], [unread.length, 'new mention'], [clash, 'name on 2 laptops', 'names on 2 laptops']].filter(([n]) => n);
  const n = parts.reduce((a, [k]) => a + k, 0);
  ui.needN = n;
  const list = parts.map(([k, w, ws]) => plural(k, w, ws));
  ui.needParts = list;
  patch($('needs'), n ? `<button type="button" data-go="now" data-fk="n-all" title="${esc(list.join(' · '))}" aria-label="${esc(`${n} ${n === 1 ? 'thing needs' : 'things need'} attention: ${list.join(', ')}. Go to Needs attention`)}">${n} need${n === 1 ? 's' : ''} attention <span aria-hidden="true">↑</span></button>` : '');
  syncNeeds();
}
// Hidden while What to do now is on screen (below the sticky header), and while Needs attention is folded to its chip (the
// chip has the count).
let nowSeen = true;
function setNowSeen(v) { nowSeen = v; } // tests set it (through window, see boot.js)
function syncNeeds() { $('needs').hidden = nowSeen || !!oUi.left; }
if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { nowSeen = e.isIntersecting; syncNeeds(); }, { rootMargin: '-56px 0px 0px 0px' }).observe($('nyou'));
// The Board view's rails stick right under the header, whatever its height.
if ('ResizeObserver' in window) new ResizeObserver(([e]) => document.documentElement.style.setProperty('--hdr', Math.round(e.target.offsetHeight) + 'px')).observe(document.querySelector('#app > header'));
// The single most important thing for this human to do right now (+ at most one low-priority extra).
function renderNow(qOpen, unread, si) {
  const S = state.settings; const T = state.tasks.length;
  const review = state.tasks.filter((t) => t.status === 'review').length;
  // A blocked task with an open question is answered by answering it: counted once, with the question.
  const bs = blockedSplit(qOpen); const blocked = bs.alone.length;
  let kind = 'ok', text, go = '', text2 = '', go2 = '', appr = false;
  const tm = timeNow();
  // After the event: the demo time has passed and no agent is on the board any more.
  const over = tm.past && !si.onlineA.length && !si.waitingA.length;
  // What holds agents up, ranked by how many each one blocks: the first one leads, up to two more follow.
  const clash = [...agentInfoNow().values()].filter((a) => a.conflict);
  const nOn = si.onlineA.length;
  const ranked = [];
  if (clash.length) ranked.push({ kind: 'urgent', go: 'conflict', more: clash.length === 1 ? `Fix ${clash[0].name} on 2 laptops` : `Fix ${clash.length} names on 2 laptops`,
    text: clash.length === 1 ? `${clash[0].name} is running on ${clash[0].conflict.laptops || 2} laptops: one of them should re-run join with another name` : `${clash.length} agent names are each running on 2 laptops: re-run join with other names` });
  if (approvalWait()) ranked.push({ kind: 'setup', go: 'board', appr: true, more: `Approve the plan${nOn ? ` (${plural(nOn, 'agent')} waiting)` : ''}`,
    text: `Review the task list (${plural(T, 'task')}), then approve it: ${nOn ? plural(nOn, 'agent waits', 'agents wait') : 'agents wait'} until you do` });
  if (review && !S.integrator) ranked.push({ kind: 'urgent', go: 'step-integrator', more: `Pick who merges (${review} in Review)`, text: `Pick who merges to main: ${plural(review, 'finished task is', 'finished tasks are')} waiting to be merged` });
  if (qOpen.length) ranked.push({ kind: 'urgent', go: 'questions', more: `Answer ${plural(qOpen.length, 'question')}`,
    text: `Answer ${plural(qOpen.length, 'question')}${bs.asked.length ? ` (${plural(bs.asked.length, 'task is', 'tasks are')} blocked on ${qOpen.length > 1 ? 'them' : 'it'})` : `: ${qOpen.length > 1 ? 'agents are' : 'an agent is'} waiting for you`}` });
  // The feature freeze changes what humans should do, so it comes right after the questions.
  if (tm.frozen && !tm.past && state.phase !== 'all_done') ranked.push({ kind: 'urgent', go: review ? 'review' : 'compose', go2: 'wrapup', text2: 'Write-up for your submission', more: 'Feature freeze: help merge and test',
    text: `Feature freeze: agents won't start new tasks. Help merge and test ${review ? `the ${plural(review, 'task')} in Review` : 'main'}, then rehearse the demo. P1 bug fixes can still be claimed` });
  if (blocked) ranked.push({ kind: 'urgent', go: 'blocked', more: `Help with ${plural(blocked, 'blocked task')}`, text: `${plural(blocked, 'task is', 'tasks are')} blocked: read why and help` });
  // Tasks that keep coming back from review: the task (or its checks) is probably unclear.
  const bounced = bouncedTasks();
  if (bounced.length) ranked.push({ kind: 'urgent', go: 'rejected', more: bounced.length === 1 ? `#${bounced[0].id} came back from review ${bounced[0].n}×` : `${bounced.length} tasks keep coming back from review`,
    text: bounced.length === 1 ? `#${bounced[0].id} ${short(bounced[0].title, 40)} came back from review ${bounced[0].n} times: check what keeps failing and make the task clearer`
      : `${bounced.length} tasks came back from review twice or more: check what keeps failing and make them clearer` });
  // Behind the deadline: name the P3 tasks that probably won't make it (never more than half of what's left). The human decides.
  const cut = tm.frozen ? null : cutTasks(tm); // frozen: unstarted tasks can't be claimed anyway, the freeze line says so
  if (cut) ranked.push({ kind: 'urgent', go: 'cut', more: cut.list.length ? `${plural(cut.list.length, 'P3 task')} probably won't make it` : cut.label,
    text: cut.list.length ? `${plural(cut.list.length, 'P3 task')} probably won't make it: move ${cut.list.length > 1 ? 'them' : 'it'} out, or move the demo time` : `${cut.label} at this pace: drop or shrink some tasks, or move the demo time` });
  const reviewWait = review >= 4 && S.integrator;
  if (reviewWait) ranked.push({ kind: 'urgent', go: 'review', more: `${review} tasks waiting in Review`,
    text: `${review} tasks are waiting in Review: merging is the bottleneck. Help review and test${S.integrator === ANYONE ? '' : ', or let whoever is free merge (Setup, step 5)'}` });
  // Out of usage isn't listed: nobody can do anything about it here. Agents shows it, and so does each card it holds.
  const top = over ? null : ranked[0];
  $('needs').classList.toggle('quiet', over);
  if (over) { kind = 'done'; go = 'wrapup'; text = 'The event is over. Download the summary and retro'; }
  else if (top) { ({ kind, go, text } = top); appr = !!top.appr; if (top.go2) { go2 = top.go2; text2 = top.text2; } }
  else if (state.phase === 'all_done') { go = 'compose'; text = 'Every task is done. Check the result, then add more tasks or tell the agents what\'s next in chat'; go2 = 'wrapup'; text2 = 'Write-up for your submission'; }
  else if (unread.length) { kind = 'setup'; go = 'mentions'; text = `${plural(unread.length, 'new message mentions', 'new messages mention')} you`; }
  else if (si.cur && si.cur !== 'integrator') {
    kind = 'setup'; go = 'step-' + si.cur;
    text = {
      invite: 'Connect your first laptop: step 1 of Setup has the commands and an invite message for your team chat',
      goal: 'Write what you\'re building (1–3 sentences) so the agents can plan',
      start: !T && !S.planner ? 'No agent has started yet. Did everyone type /board ($board in Codex)?'
        : si.waitingA.length ? `${plural(si.waitingA.length, 'agent is', 'agents are')} connected but not started: type /board in it ($board in Codex)`
        : 'No agent is running right now: start yours in your project folder (step 3 shows what to type in each tool)',
      backlog: !S.goal ? 'Write the goal first, then the agents plan the tasks' : S.planner ? `Nothing to do yet: ${agentOf(S.planner)} is writing the task list` : 'Nothing to do yet: waiting for an agent to start writing the task list (or add tasks yourself)',
    }[si.cur];
    if (si.cur === 'backlog' && S.goal) kind = 'ok';
  }
  else text = 'All good: agents are working. Keep this page open; questions for you will appear here';
  if (kind === 'ok' && me && state.phase !== 'all_done' && !text2) {
    const mine = si.ros.find((r) => r.name === root(me));
    const mineStarted = si.startedA.some((a) => root(a.name) === root(me));
    const othersStarted = si.startedA.some((a) => root(a.name) !== root(me));
    const cap = teamCapacity();
    // Idle agents first: with nothing to claim, another laptop wouldn't help.
    if (T && state.phase === 'building' && !tm.frozen && cap.short) { go2 = 'idle'; text2 = `${plural(cap.idle.length, 'agent is', 'agents are')} idle: add tasks or ask the planner for more`; }
    else if (othersStarted && !mineStarted) { go2 = mine?.agent ? 'step-start' : 'step-invite'; text2 = mine?.waiting ? 'Start your laptop\'s agent' : 'Connect your laptop\'s agent'; }
    else if (!S.integrator && T) { go2 = 'step-integrator'; text2 = 'While you wait: pick who merges to main'; }
  }
  // The next things in line, then setup that can happen meanwhile (at most three lines in all).
  const more = over ? [] : ranked.slice(1).map((r) => ({ go: r.go, text: r.more, freeze: !!r.go2 }));
  // Mentions lead only when nothing else does; otherwise they come next, after the freeze (also in the @me tab).
  if (!over && unread.length && go !== 'mentions') more.splice(more[0]?.freeze ? 1 : 0, 0, { go: 'mentions', text: plural(unread.length, 'new mention') });
  if (!over && S.goal && !tm.deadline && !dlSkipped()) more.push({ act: 'clock', text: 'Set the demo time so agents stop on time' });
  if (si.cur === 'invite' && !S.goal) more.push({ go: 'step-goal', text: 'Write the goal (step 2)' });
  const lv = () => '';
  // "Also:" only before two of them; one is just the link.
  const moreHtml = more.length ? `<div class="also">${more.length > 1 ? '<span class="n">Also:</span>' : ''}${more.slice(0, 2).map((m, i) => `<button type="button" class="link" ${m.act ? `data-act="${m.act}"` : `data-go="${m.go}"${lv(m.go)}`} data-fk="now-more-${i}">${esc(m.text)} <span aria-hidden="true">→</span></button>`).join('')}</div>` : '';
  const cutHtml = ui.showCut && cut?.list.length && !over ? `<ul class="cut-list" id="cut-list" aria-label="P3 tasks that probably won't make it"><li class="n">Probably won't make it:</li>${cut.list.map((t) => `<li><button type="button" class="link" data-open-task="${t.id}" data-fk="cut-${t.id}">#${t.id} ${esc(short(t.title, 48))}</button></li>`).join('')}</ul>` : '';
  const el = $('now'); el.className = 'now k-' + kind;
  // No lead where it would repeat what's right there: the question cards under it (what they block is a muted line
  // under them), or the open Setup step it points to.
  const qLead = go === 'questions' && qOpen.length;
  const hideLead = qLead || (kind === 'setup' && String(go).startsWith('step-') && setupShown(si));
  const lead = qLead ? ''
    : hideLead ? (more.length || text2 ? '' : '<p class="na-sub">Nothing needs attention yet: Setup shows what\'s next.</p>') : go

      ? `<button type="button" class="link na" data-go="${go}"${lv(go)} data-fk="now-go">${esc(text)} <span class="go" aria-hidden="true">→</span></button>`
      : `<span class="na">${esc(text)}</span>`;
  el.classList.toggle('no-lead', !!hideLead);
  // Where the team is (connect → goal → tasks → build → done): under the demo time, in the Demo popover. "Connect" leads
  // while no laptop is connected. With plan approval on, a "Review plan" step sits between writing tasks and building.
  const curP = si.cur === 'invite' && !T ? 'connect' : state.phase;
  const track = S.require_approval || approvalWait() ? [...ALL_PHASES.slice(0, 3), ['awaiting_approval', 'Review plan'], ...ALL_PHASES.slice(3)] : ALL_PHASES;
  const ci = track.findIndex(([k]) => k === curP);
  // A list, so screen readers hear "Phase: Build, step 5 of 6" and each step as a list item.
  patch($('o-dl-ph'), `<div class="phases" title="Where the team is: connect laptops → set a goal → the planner writes tasks${track !== ALL_PHASES ? ' → humans approve them' : ''} → agents build → everything merged"><span class="ph-l" aria-hidden="true">Phase</span><ol role="list" aria-label="${ci < 0 ? 'Phase' : `Phase: ${track[ci][1]}, step ${ci + 1} of ${track.length}`}">${track.map(([k, l], i) =>
    `<li>${i ? '<span class="arr" aria-hidden="true">›</span>' : ''}<span class="p ${k === curP ? 'cur' : i < ci ? 'past' : ''}" ${k === curP ? 'aria-current="step"' : ''}>${l}</span></li>`).join('')}</ol></div>`);
  patch(el, `<h2 class="nl" id="now-h">What to do now</h2>${lead}${appr ? '<button type="button" class="appr" data-act="approve" data-fk="now-appr">Approve plan &amp; start</button>' : ''}${text2 ? `<button type="button" class="link na2" data-go="${go2}"${lv(go2)} data-fk="now-go2">${esc(text2)} <span aria-hidden="true">→</span></button>` : ''}${cutHtml}${moreHtml}`);
  // Nothing under the questions' own cards: no empty band above them.
  el.hidden = !!hideLead && !lead && !appr && !text2 && !cutHtml && !moreHtml;

}

// The top bar, the same in both views: chips for the goal (opens it in place), the demo time (#clock, renderClock), progress
// (done of all tasks except proposals), the repo, the planner (chosen in place), who merges to main with main's CI (the merger choice in place), then
// the way into setup. Below 1600px (CSS) the planner and who merges are one Roles chip: both names, one popover with both choices.
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
  patch($('tb-a'), `<button type="button" class="tbc tb-goal" id="goal-btn" data-act="goal" data-fk="tb-goal" aria-expanded="${!!ui.oGoal}" aria-controls="o-goal" title="${esc(goal || 'No goal set yet')}" aria-label="Goal: ${esc(goal ? short(head, 120) : 'not set yet')}. ${ui.oGoal ? 'Close' : 'Show'} the full goal"><span class="tbl">Goal</span><span class="o-x">${goal ? esc(head) : '<span class="muted">not set</span>'}</span><span class="o-ar" aria-hidden="true">▾</span></button>`);
  patch($('tb-b'), `${T.length ? `<span class="tbc stat" id="done-count" title="${done} of ${T.length} tasks merged into main (${pct}%)"><span class="tbl">Done</span><b>${done} of ${T.length}</b><span class="mbar" aria-hidden="true"><i style="width:${pct}%"></i></span></span>` : ''}
      ${S.repo ? `<span class="tbc repo-s" title="Project repo: ${esc(S.repo)}"><span class="tbl">Repo</span><span class="o-x">${esc(S.repo)}</span></span>` : ''}
      <button type="button" class="tbc tb-roles" id="roles-btn" data-act="roles" data-fk="tb-roles" aria-expanded="${!!ui.oRoles}" aria-controls="o-roles" title="${esc(`Planner: ${pWho} (writes the task list from the goal and approves proposed tasks)\nMerges to main: ${mWho}${away ? ': whoever is free merges meanwhile' : ''}${ci ? ` (${ci.slice(2)})` : ''}`)}" aria-label="${esc(`Roles. Planner: ${pWho}. Merges to main: ${mWho}${ci}.`)} ${ui.oRoles ? 'Close' : 'Choose the planner and who merges'}"><span class="tbl">Roles</span><span class="o-x"><span class="rn">${pName}</span><span class="rs" aria-hidden="true">·</span><span class="rn">${m ? (S.integrator === ANYONE ? 'whoever is free' : nameTag(S.integrator)) : '<span class="muted">not picked</span>'}</span></span>${state.main_ci?.status === 'fail' ? '<span class="ci-dot" aria-hidden="true"></span>' : ''}<span class="o-ar" aria-hidden="true">▾</span></button>
      <button type="button" class="tbc tb-plan" id="plan-btn" data-act="planner" data-fk="tb-plan" aria-expanded="${!!ui.oPlan}" aria-controls="o-plan" title="The agent that writes the task list from the goal and approves proposed tasks${S.planner ? '' : ' (none picked: the first agent that starts plans)'}" aria-label="Planner: ${esc(pWho)}. ${ui.oPlan ? 'Close' : 'Choose the planner'}"><span class="tbl">Planner</span><span class="o-x">${pName}</span><span class="o-ar" aria-hidden="true">▾</span></button>
      <button type="button" class="tbc tb-merge" id="merge-btn" data-act="merge" data-fk="tb-merge" aria-expanded="${!!ui.oMerge}" aria-controls="o-merge" title="The person whose agent merges finished branches into main${away ? ` (${S.integrator} is away: whoever is free merges meanwhile)` : ''}${ci ? ` (${ci.slice(2)})` : ''}" aria-label="Merges to main: ${esc(m || 'not picked yet')}${away ? ' (away)' : ''}${ci}. ${ui.oMerge ? 'Close' : 'Choose who merges'}"><span class="tbl">Merges</span><span class="o-x">${mName}</span>${ciPill()}${state.main_ci?.status === 'fail' ? '<span class="ci-dot" aria-hidden="true"></span>' : ''}<span class="o-ar" aria-hidden="true">▾</span></button>
      <span class="acts"><button type="button" class="tbc tb-act" data-act="${open ? 'setup-close' : 'setup-open'}" data-fk="s-open" aria-expanded="${open}" aria-controls="setup" ${left ? `title="Setup: ${esc(left.left)}" aria-label="${open ? 'Hide' : 'Open'} Setup. Left to do: ${esc(left.left)}"` : ''}><span class="o-x">Setup${left ? `<span class="sl">: ${esc(left.left)}</span>` : ''}</span><span class="o-ar" aria-hidden="true">▾</span></button></span>`);
  tbFit();
}
// The top bar's last resort (see the CSS): measured, so it works in any font.
function tbFit() {
  const tb = $('topbar'); if (!tb) return;
  tb.classList.remove('fit1', 'fit2');
  if (innerWidth < 1101 || !tb.offsetWidth) return;
  const over = () => tb.scrollWidth > tb.clientWidth + 1;
  if (over()) { tb.classList.add('fit1'); if (over()) tb.classList.add('fit2'); }
}
if ('ResizeObserver' in window) new ResizeObserver(() => tbFit()).observe($('topbar'));
document.fonts?.ready.then(tbFit);
function renderSetup(si) {
  const el = $('setup');
  el.hidden = !setupShown(si);
  if (el.hidden) return patch(el, '');
  const body = { invite: stepInvite, goal: stepGoal, start: stepStart, backlog: stepBacklog, integrator: stepIntegrator };
  const all = si.doneCount >= si.steps.length;
  // The same head as the goal's popover: its name, then x (closes it, focus back on the Setup chip). Once every step is
  // done, the intro and "steps tick off by themselves" go.
  patch(el, `<div class="sh"><h2>Setup</h2><span class="muted">${si.doneCount} of ${si.steps.length} done${all ? '' : ' · steps tick off by themselves'}</span><button type="button" class="o-ib sx" data-act="setup-close" data-fk="s-x" aria-label="Close Setup" title="Close (Esc)">×</button></div>
    ${all ? '' : `<p class="intro">This board coordinates your team's AI coding agents: Claude Code, Codex, GitHub Copilot, Gemini CLI or Cursor (or any MCP tool), mixed however you like. They split the goal into small tasks, claim them, build each one in its own git branch, and ask you here when they need a decision.</p>`}
    <ol class="steps">${si.steps.map((s, i) => {
      const open = stepOpen(s.key, si.cur);
      const tick = s.done;
      return `<li class="step ${tick ? 'done' : ''} ${s.key === si.cur ? 'cur' : ''}" id="step-${s.key}">
        <button type="button" class="step-h" data-step="${s.key}" data-fk="sh-${s.key}" aria-expanded="${open}" aria-controls="sb-${s.key}">
          <span class="mk" aria-hidden="true">${tick ? '✓' : i + 1}</span><span class="step-t">${esc(s.title)}${tick ? '<span class="vh"> (done)</span>' : ''}</span><span class="step-s">${esc(s.sum)}</span></button>
        ${open ? `<div class="step-b" id="sb-${s.key}">${body[s.key](si)}</div>` : ''}</li>`;
    }).join('')}</ol>
    <div class="boardsec" id="board-sec">${securityBox()}</div>`);
}
// "Team can run 7 tasks at once · 4 running", and a warning when idle agents outnumber the ready tasks.
function teamCapHtml(long = false) {
  const c = teamCapacity(); if (!c.agents.length) return '';
  const tip = `Started, online agents: ${c.agents.map((a) => `${a.name} (${[a.client, a.plan].filter(Boolean).join(', ') || 'agent'}: ${capText(a)})`).join('; ')}. ${plural(c.ready, 'open task is', 'open tasks are')} ready to claim.`;
  const low = c.short && state.tasks.length && state.phase === 'building';
  const idleTxt = low ? ` · ${plural(c.idle.length, 'agent')} idle, ${c.forIdle} ready to claim` : '';
  if (!long) return `<span class="teamcap${low ? ' low' : ''}" title="${esc(tip)}">Team can run ${plural(c.slots, 'task')} at once · ${c.running} running${esc(idleTxt)}</span>`;
  return `<p class="capline${low ? ' low' : ''}" title="${esc(tip)}"><b>Team capacity:</b> ${plural(c.slots, 'task')} at once across ${plural(c.agents.length, 'started agent')} · ${c.running} running · ${plural(c.ready, 'open task', 'open tasks')} ready${low ? `. ${plural(c.idle.length, 'agent has', 'agents have')} nothing to do: add tasks, or ask the planner for more.` : ''}</p>`;
}
function chips(si, laptops = false) {
  return `<div class="chips${laptops ? ' lines' : ''}">${si.ros.filter((r) => r.agent || (!laptops && r.humanOnline)).map((r) => {
    const bits = r.agents.map((a) => { const st = agentState(a); return `${a.plan || a.client || 'agent'} ${st === 'waiting' ? notStartedText(a) : st === 'online' ? `online · ${capText(a)} tasks` : st}`; });
    if (r.humanOnline) bits.push(r.name === me ? 'you' : 'watching');
    const tip = (r.agent ? r.agents.map((a) => { const st = agentState(a); const nm = `${a.name}${a.client ? ` (${a.client})` : ''}`;
      return st === 'online' ? `${nm} is running on the board.` : st === 'waiting' ? `${nm} is connected, but nobody started it: type ${startCmd(a.client)} in it.` : `${nm} was last seen ${ago(a.last)}.`; }).join(' ') + ' ' : 'No agent connected under this name. ') + (r.humanOnline ? 'Has this page open.' : '');
    return `<span class="chip" title="${esc(tip)}"><span class="on ${r.working || r.humanOnline ? 'y' : r.waiting ? 'w' : ''}"></span><span class="pc" ${hs(r.name)}>${esc(r.name)}</span><span class="muted">${esc(bits.join(' · '))}</span></span>`;
  }).join('')}</div>`;
}
// Friendlier wording for the server's address labels; the adapter name stays in the tooltip.
const addrText = (a) => a.ip === 'localhost' ? 'Only works on this laptop' : /^same wifi/i.test(a.label) ? 'Works for teammates on the same wifi' : /^Tailscale/i.test(a.label) ? 'Works across networks (Tailscale)' : /^Cloudflare/i.test(a.label) ? 'Works from any network (Cloudflare tunnel)' : /^virtual/i.test(a.label) ? 'Virtual adapter: probably not reachable' : a.label;
function boardLink() {
  const best = state.setup?.join_commands?.[0];
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return local && best && best.ip !== 'localhost' ? best.web_url : `${location.origin}${BASE}/?token=${encodeURIComponent(token)}`;
}
// One ready-to-paste message for the team chat.
function inviteText() {
  const su = state.setup || {}; const best = su.join_commands?.[0]; const S = state.settings;
  const join = best?.command || 'npm run join -- --url <board address> --token <token>  (ask the host)';
  const L = ['Join our team board (Agent Board). On your laptop:', ''];
  let n = 1;
  L.push(`${n++}. First time only, get the board tool:`, `   ${su.clone_command || 'git clone https://github.com/DL4P1N/agent-board && cd agent-board'}`, '   (already have an agent-board folder, or an older claude-board one? run git pull in it)');
  L.push(`${n++}. In the agent-board folder, connect your laptop (it asks your name, AI tool and project folder):`, `   ${join}`);
  if (S.repo) L.push(`${n++}. Get the project repo (if you don't have it yet):`, `   git clone ${S.repo}`);
  L.push(`${n++}. Then open your AI tool in the project repo and type /board`, `   (Codex: $board · Copilot CLI: start it with  ${copilotLaunch()}  then type /board)`);
  L.push('   (Gemini CLI: /board · Cursor: /board in the Agent chat)');
  L.push('', `Just watching? Open ${boardLink()}`);
  return L.join('\n');
}
// A QR code image for some text, drawn by the board server (works offline: no outside service).
const qrSrc = (text) => `${BASE}/api/qr.svg?token=${encodeURIComponent(token)}&text=${encodeURIComponent(text)}`;
function stepInvite(si) {
  const su = state.setup;
  if (!su || !su.join_commands?.length) return '<p>Ask the host for the join command printed by <code>npm start</code>.</p>' + chips(si);
  const [best, ...rest] = su.join_commands;
  const onlyLocal = best.ip === 'localhost';
  return `<p>Everyone who'll run an AI agent (you too) connects their laptop once, in a terminal. It takes about a minute.</p>
    <div class="inl mt-2"><button type="button" class="ghost" data-act="copy-invite" data-fk="s-invite">Copy invite message</button><span class="muted t-meta">One message for your team chat with every step below${state.settings.repo ? ' and the project repo' : ''}.</span></div>
    <div class="sub"><b>First time on this laptop?</b> Get the board tool first. Skip this if you already have an <code>agent-board</code> folder (or an older <code>claude-board</code> one: then run <code>git pull</code> in it, so it's up to date).</div>${cmdBox(su.clone_command, 'clone', 'download command')}
    <div class="sub"><b>Connect to this board:</b> run it inside the <code>agent-board</code> folder. It asks your name, which AI tool(s) you use and where your project is, then tests the connection.</div>${cmdBox(best.command, 'join', 'join command')}
    ${onlyLocal ? '<p class="note">No network address found, so teammates can\'t reach this laptop yet. Join the same wifi, start Tailscale, or restart the board with <code>npm run tunnel</code>.</p>' : `<p class="hint" title="${esc(best.label)}">${esc(addrText(best))}.</p>`}
    ${rest.length ? `<button type="button" class="link muted t-meta mt-1" data-act="addrs" data-fk="addrs" aria-expanded="${ui.addrs}"><span class="chev" aria-hidden="true">▾</span> Other addresses (if that one doesn't connect)</button>
      ${ui.addrs ? rest.map((a, i) => `<div class="sub" title="${esc(a.label)}">${esc(addrText(a))}</div>${cmdBox(a.command, 'alt' + i, 'join command: ' + addrText(a))}`).join('') : ''}` : ''}
    <div class="sub">Just want to watch? Send them this page's link</div>${cmdBox(best.web_url, 'web', 'board link')}
    <button type="button" class="link muted t-meta mt-1" data-act="qr" data-fk="qr-tog" aria-expanded="${!!ui.qr}" aria-controls="qr-codes"><span class="chev" aria-hidden="true">▾</span> ${ui.qr ? 'Hide QR code' : 'Show QR code (scan with a phone)'}</button>
    ${ui.qr ? `<div class="qrs" id="qr-codes">
      <figure><img src="${esc(qrSrc(best.web_url))}" alt="QR code for this board's link, ${esc(best.web_url)}" width="180" height="180"><figcaption>Board link: open it on a phone to watch. To connect a laptop, copy the join command above or send the invite message.</figcaption></figure></div>` : ''}
    ${si.ros.some((r) => r.agent) ? `<div class="sub">Laptops connected</div>${chips(si, true)}` : ''}
    ${(() => { const w = si.ros.filter((r) => r.humanOnline && !r.agent); return w.length ? `<p class="muted t-meta mt-1">Watching this page: ${w.map((r) => `${nameTag(r.name)}${youTag(r.name)}`).join(', ')}</p>` : ''; })()}
    ${notifyBox()}`;
}

// ---------- notifications to a team chat or phone (webhook) ----------
// Keys as the server names them (src/server.js NOTIFY_EVENTS).
const NOTIFY_EVENTS = [['questions', 'Questions for humans'], ['main', 'main is failing'], ['blocked', 'Blocked tasks'], ['conflict', 'Same name on two laptops'], ['freeze', 'Feature freeze'], ['limit', 'Usage limits']];
const NOTIFY_KIND = { slack: 'Slack', discord: 'Discord', ntfy: 'ntfy (phone push)', generic: 'a plain webhook (JSON POST)', other: 'a plain webhook (JSON POST)' };
// The server may send events as a list of keys or as {key: true}.
const nfEvents = (ev) => new Set(Array.isArray(ev) ? ev : typeof ev === 'string' ? ev.split(',').filter(Boolean) : ev && typeof ev === 'object' ? Object.keys(ev).filter((k) => ev[k]) : NOTIFY_EVENTS.map(([k]) => k));
async function loadNotify() {
  if (ui.nf.loading) return; ui.nf.loading = true;
  try {
    const r = await api('/notify');
    Object.assign(ui.nf, { loaded: true, url: r.url || '', kind: r.kind || null, events: nfEvents(r.events), err: '' });
  } catch (e) { Object.assign(ui.nf, { loaded: true, err: e.message, events: ui.nf.events || nfEvents(null) }); }
  ui.nf.loading = false; render();
}
function notifyBox() {
  const n = ui.nf;
  const tog = `<button type="button" class="link muted t-meta mt-2" data-act="nf-tog" data-fk="nf-tog" aria-expanded="${n.open}" aria-controls="nf-box"><span class="chev" aria-hidden="true">▾</span> Notifications when you're away${n.url ? ` <span class="pill ok">on · ${esc(NOTIFY_KIND[n.kind] || 'webhook')}</span>` : ''}</button>`;
  if (!n.open) return tog;
  if (!n.loaded) { if (!n.loading) setTimeout(loadNotify, 0); return `${tog}<p class="muted" id="nf-box">Loading…</p>`; }
  const ev = n.events || nfEvents(null);
  return `${tog}<form class="nf" id="nf-box" data-notifyform>
    <p class="hint m0">Gets questions to you when you're away from the laptop: the board posts to your team chat or phone.</p>
    ${n.url && !n.change ? `<div class="sub">Webhook</div>
    <p class="m0" id="nf-saved">Sending to ${esc(NOTIFY_KIND[n.kind] || 'a webhook')}: <code>${esc(n.url)}</code></p>
    <div class="inl m0"><button type="button" class="ghost" data-act="nf-change" data-fk="nf-change">Change</button><button type="button" class="ghost" data-act="nf-off" data-fk="nf-off">Remove</button></div>`
    : `<label for="nf-url">${n.url ? 'New webhook URL' : 'Webhook URL: Slack, Discord, ntfy, or any URL that accepts a POST'}</label>
    <input type="url" id="nf-url" data-keep="nf-url" autocomplete="off" spellcheck="false" placeholder="https://hooks.slack.com/services/… or https://ntfy.sh/your-topic" aria-describedby="nf-hint nf-err">
    <p class="hint m0" id="nf-hint">${n.url ? 'Replaces the saved one when you press Save. ' : ''}For a phone: install the ntfy app, subscribe to a hard-to-guess topic, and paste <code>https://ntfy.sh/&lt;topic&gt;</code> here.</p>`}
    <fieldset><legend>Send</legend>${NOTIFY_EVENTS.map(([k, l]) => `<label><input type="checkbox" data-nev="${k}" data-fk="nev-${k}" ${ev.has(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>
    <div class="inl m0"><button type="submit" data-fk="nf-save">Save</button>
      <button type="button" class="ghost" data-act="nf-test" data-fk="nf-test" ${n.url ? '' : 'disabled title="Save a webhook URL first"'}>Send test</button>
      ${n.url && n.change ? '<button type="button" class="ghost" data-act="nf-keep" data-fk="nf-keep">Keep the saved one</button>' : ''}</div>
    <div class="err" id="nf-err" role="alert">${esc(n.err || '')}</div></form>`;
}
// ---------- rotate the board token (a link leaked) ----------
function securityBox() {
  return `<div class="sub">Board security: if a link leaked</div>
    <p class="hint m0">The board token is in every join command and board link. Rotating it locks out everyone who has the old one.</p>
    ${ui.rotateArm ? `<div class="rot note" role="alert"><span><b>Everyone will have to re-run join</b> with the new command (and reopen the board). Agents connected now lose access until they do.</span>
      <button type="button" class="danger" data-act="rotate-yes" data-fk="rot-yes">Rotate now</button><button type="button" class="ghost" data-act="rotate-no" data-fk="rot-no">Keep the token</button></div>`
      : '<div class="rot"><button type="button" class="ghost" data-act="rotate" data-fk="rot">Rotate token…</button></div>'}`;
}
async function rotateToken() {
  try {
    const r = await api('/token/rotate', { method: 'POST', body: '{}' });
    if (!r?.token) throw new Error('The server didn\'t return a new token.');
    setToken(r.token); store.set('board-token', token);
    if (r.setup) state.setup = r.setup;
    ui.rotateArm = false; ui.steps.invite = true;
    connect(); await load();
    toast('Token rotated: send everyone the new join command.');
    document.querySelector('[data-fk="s-invite"]')?.focus({ preventScroll: true });
  } catch (e) { ui.rotateArm = false; render(); toast(`Couldn't rotate the token: ${e.message}`, true); }
}
// How long tasks took so far (per size) and how often reviews sent them back, from the server's stats.
function statsLine() {
  const s = state.stats; if (!s || typeof s !== 'object') return '';
  const sizes = (s.minutes && typeof s.minutes === 'object' && s.minutes) || (s.sizes && typeof s.sizes === 'object' && s.sizes) || s;
  const med = (v) => (typeof v === 'number' ? v : v && typeof v === 'object' ? v.median ?? v.median_min ?? v.minutes ?? null : null);
  const parts = ['S', 'M', 'L'].map((k) => [k, med(sizes[k])]).filter(([, m]) => Number.isFinite(m)).map(([k, m]) => `${k} ≈ ${Math.round(m)} min`);
  let br = s.bounce_rate ?? s.bounceRate;
  if (Number.isFinite(br)) { if (br <= 1) br *= 100; parts.push(`${Math.round(br)}% came back from review at least once`); }
  const rw = med(s.review_wait_min ?? s.review_wait ?? s.reviewWait);
  if (Number.isFinite(rw)) parts.push(`reviews waited ≈ ${Math.round(rw)} min`);
  return parts.length ? `<p class="hint" title="Median time from claim to done, per task size, on this board so far. The planner sees these too.">So far${Number.isFinite(s.done) ? ` (${s.done} done)` : ''}: ${esc(parts.join(' · '))}</p>` : '';
}
function stepGoal() {
  const S = state.settings;
  const goal = S.goal && !ui.editGoal
    ? `<p class="goaltext">${esc(S.goal)}</p><button type="button" class="ghost sm" data-act="goal-edit" data-fk="goal-edit">Edit goal</button>`
    : `<p>In 1–3 sentences: what are you building, and what should the demo show? The agents plan their tasks from this. Your agent may also ask you for the goal in its terminal — either works.</p>
    <form class="goalform" data-goalform><label class="vh" for="goal-in">Project goal</label>
      <textarea id="goal-in" data-keep="goal" rows="2" maxlength="1000" title="Enter saves · Shift+Enter adds a new line" aria-describedby="goal-err" ${ui.goalErr ? 'aria-invalid="true"' : ''} placeholder="e.g. A web app where teams submit their project and everyone votes. The demo shows submitting, voting and a live leaderboard.">${esc(S.goal)}</textarea>
      <button type="submit" data-fk="goal-save">Save goal</button>${S.goal ? '<button type="button" class="ghost" data-act="goal-cancel" data-fk="goal-cancel">Cancel</button>' : ''}</form>
    <div class="err" id="goal-err">${esc(ui.goalErr || '')}</div>`;
  const repo = S.repo && !ui.editRepo
    ? `<div class="repo"><span class="muted">Project repo:</span> <code>${esc(S.repo)}</code><button type="button" class="ghost sm" data-act="repo-edit" data-fk="repo-edit">Edit repo</button></div>`
    : `<form class="repo" data-repoform><label for="repo-in">Project repo URL <span class="muted fw-normal">(optional)</span></label>
      <input id="repo-in" data-keep="repo" value="${esc(S.repo)}" placeholder="https://github.com/your-team/project" autocomplete="off" spellcheck="false" aria-describedby="repo-hint repo-err" ${ui.repoErr ? 'aria-invalid="true"' : ''}>
      <button type="submit" class="ghost sm" data-fk="repo-save">Save repo</button>${S.repo ? '<button type="button" class="ghost sm" data-act="repo-cancel" data-fk="repo-cancel">Cancel</button>' : ''}
      <p class="hint row m0" id="repo-hint">The git repo you're all building in. It goes into the invite message, and agents see it too.</p>
      <div class="err row m0" id="repo-err">${esc(ui.repoErr || '')}</div></form>`;
  return goal + repo + deadlineBlock();
}
// "2026-11-09T17:00" in local time, for <input type="datetime-local">.
const localInput = (ts) => { const d = new Date(ts); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
// Default demo time: today 17:00, or 3 hours from now (on the hour) if 17:00 is close or past.
function defaultDeadline() {
  const d = new Date(); d.setHours(17, 0, 0, 0);
  if (d.getTime() - Date.now() < 2 * 3600e3) { const x = new Date(Date.now() + 3 * 3600e3); x.setMinutes(0, 0, 0); return x.getTime(); }
  return d.getTime();
}
function deadlineBlock() {
  const S = state.settings; const t = timeNow();
  if (t.deadline && !ui.editDeadline) {
    return `<div class="repo"><span class="muted">Demo:</span> <b>${esc(when(t.deadline))}</b><span class="muted" aria-hidden="true">·</span><span>${t.fm ? `feature freeze ${esc(when(t.freezeAt))} <span class="muted">(${t.fm} min before)</span>` : 'no feature freeze'}</span>
      <button type="button" class="ghost sm" data-act="dl-edit" data-fk="dl-edit">Change time</button></div>`;
  }
  const fm = S.freeze_minutes === '' || S.freeze_minutes == null ? '60' : S.freeze_minutes;
  return `<form class="repo dlform" data-dlform><label for="dl-in">Demo time <span class="muted fw-normal">(optional)</span></label>
      <input id="dl-in" type="datetime-local" data-keep="dl" value="${esc(localInput(t.deadline || defaultDeadline()))}" step="60" aria-describedby="dl-hint dl-err" ${ui.dlErr ? 'aria-invalid="true"' : ''}>
      <label for="fz-in">Feature freeze</label><input id="fz-in" type="number" data-keep="fz" value="${esc(fm)}" min="0" max="600" step="5" inputmode="numeric" aria-describedby="fz-u dl-hint"><span class="u" id="fz-u">min before</span>
      <button type="submit" class="ghost sm" data-fk="dl-save">Save time</button>${!t.deadline && !dlSkipped() ? '<button type="button" class="ghost sm" data-act="dl-skip" data-fk="dl-skip">No demo time</button>' : ''}${t.deadline ?'<button type="button" class="ghost sm" data-act="dl-cancel" data-fk="dl-cancel">Cancel</button><button type="button" class="ghost sm" data-act="dl-clear" data-fk="dl-clear">Remove deadline</button>' : ''}
      <p class="hint row m0" id="dl-hint">${t.deadline ? '' : '<b>Not set yet:</b> the time shown is a suggestion until you press Save time. '}When the demo starts. The header counts down to it. At the feature freeze agents stop taking new tasks (except priority-1 bug fixes) and get what they have merged, so main works for the demo.</p>
      <div class="err row m0" id="dl-err">${esc(ui.dlErr || '')}</div></form>`;
}
function stepStart(si) {
  const tools = state.setup?.agent_tools?.length ? state.setup.agent_tools : [{ id: 'claude', name: 'Claude Code', start: '/board', where: 'Type it in Claude Code, opened in the project repo.' }];
  const label = (a) => { const d = [a.client, a.plan].filter(Boolean).join(' · '); return `${nameTag(a.name)}${d ? ` <span class="muted">(${esc(d)}${a.started ? `, ${a.slots} at once` : ''})</span>` : ''}`; };
  return `<p>On each laptop, open your AI tool in the project folder and start the board. Find your tool below:</p>
    <ul class="tools">${tools.map((t) => {
      // Copilot CLI needs launching with the board tool allowed first: two commands.
      const launch = t.launch;
      const cmds = launch
        ? `<div class="cmds"><div class="sub">1. Launch it with the board allowed:</div>${cmdBox(launch, 'start-' + t.id + '-launch', 'launch command for ' + t.name)}<div class="sub">2. Then type:</div>${cmdBox(t.start, 'start-' + t.id, 'start command for ' + t.name)}</div>`
        : cmdBox(t.start, 'start-' + t.id, `start command for ${t.name}`);
      return `<li class="tool-r"><span class="tn">${esc(t.name)}</span>${cmds}<span class="tw">${esc(launch ? 'Run both in the project repo.' : t.where || '')}</span></li>`;
    }).join('')}</ul>
    <p class="hint">Two tools on one laptop? Start each one in the folder join printed for it.</p>
    <p class="muted">That session becomes the laptop's <b>main agent</b> (the "orchestrator"): it takes tasks from this board and builds each one in its own git branch. Claude Code can also hand tasks to several subagents at once; the other tools work one task at a time. If the tool doesn't know the command or can't see the board, run <code>npm run doctor</code> in the agent-board folder: it checks the connection and says what to fix.</p>
    <p>${si.startedA.length ? `Started: ${si.startedA.map(label).join(', ')}` : 'No agent started yet. It shows up here a few seconds after someone types the start command.'}</p>
    ${teamCapHtml(true)}
    ${si.waitingA.length ? `<p class="ns-txt">Connected but not started: ${si.waitingA.map((a) => `${label(a)} — type <code>${esc(startCmd(a.client))}</code> in it`).join('; ')}</p>` : ''}`;
}
function approvalBox() {
  const S = state.settings;
  return `<label class="keys"><input type="checkbox" id="appr-on" data-fk="appr" ${S.require_approval ? 'checked' : ''} aria-describedby="appr-hint"> Review the task list before agents start</label>
    <p class="hint" id="appr-hint">${approvalWait() ? 'Agents are waiting. Edit or add tasks, then approve.'
      : S.require_approval && S.plan_approved ? '<span class="appr-done">Plan approved ✓</span> Agents are working through it.'
      : S.require_approval ? 'After the planner writes the tasks, agents wait until someone here presses Approve plan &amp; start.'
      : 'Off: agents start on tasks as soon as the planner writes them.'}</p>
    ${approvalWait() ? '<div class="inl"><button type="button" data-act="approve" data-fk="s-appr">Approve plan &amp; start</button></div>' : ''}`;
}
// Individual agents, not people: with two tools on one laptop only ONE of them should plan or merge.
function agentNames(extra = []) {
  const agentNames = (state.presence || []).filter((p) => p.kind === 'agent').map((p) => String(p.name).toLowerCase());
  const assignees = state.tasks.map((t) => t.assignee && agentRoot(t.assignee));
  return [...new Set([...agentNames, ...assignees, ...extra].filter((n) => n && n !== ANYONE))].sort();
}
// The planner's choice: label, select, the extra tasks it may take, one hint. In its own popover (labelledBy: the
// popover's heading) there is no label: the heading names the select.
function plannerBox(pre = '', labelledBy = '') {
  const S = state.settings; const names = agentNames([S.planner]);
  const ex = Math.max(0, Math.min(5, Number(S.planner_extra ?? 2) || 0));
  return `<div class="inl">${labelledBy ? '' : `<label for="${pre}plan-sel" class="m0">Planner</label>`}
      <select id="${pre}plan-sel" data-fk="${pre}plan-sel" class="w-auto"${labelledBy ? ` aria-labelledby="${labelledBy}"` : ''}><option value="">The first agent that starts</option>${names.map((n) => `<option value="${esc(n)}" ${n === S.planner ? 'selected' : ''}>${esc(n)}${root(n) === root(me) ? ' (yours)' : ''}</option>`).join('')}</select></div>
    <div class="inl"><label for="${pre}pex-sel" class="m0 fw-normal">When nobody else is free, the planner may take up to</label>
      <select id="${pre}pex-sel" data-fk="${pre}pex" class="w-auto">${[0, 1, 2, 3, 4, 5].map((i) => `<option value="${i}" ${i === ex ? 'selected' : ''}>${i}</option>`).join('')}</select>
      <span class="muted t-meta">extra small/medium tasks with subagents</span></div>
    <p class="hint">Other agents' new tasks wait as <b>proposed</b> until the planner (or you) approves them.</p>`;
}
function stepBacklog() {
  const S = state.settings; const n = state.tasks.length;
  const add = '<div class="inl"><span class="muted">You can always add tasks yourself:</span><button type="button" class="ghost sm" data-act="new-task" data-fk="s-new">+ New task</button></div>' + plannerBox() + approvalBox();
  if (n && approvalWait()) return `<p>${plural(n, 'task')} on the board${S.planner ? `, written by the planner, ${nameTag(S.planner)}` : ''}. Check them below: open a card to edit it, or add what's missing. Agents start claiming once you approve.</p>${add}`;
  if (n) return `<p>${plural(n, 'task')} on the board${S.planner ? `, written by the planner, ${nameTag(S.planner)}` : ''}. Agents claim them on their own, highest priority first.</p>${statsLine()}${add}`;
  if (!S.goal) return `<p>Write the goal first (step 2). Then the first agent that starts on the board (step 3) becomes the <b>planner</b> and writes the task list from it automatically.</p>${add}`;
  if (S.planner) { const c = clientOf(S.planner); return `<p>${nameTag(S.planner)}'s agent${c ? ` (${esc(c)})` : ''} is the <b>planner</b> and is writing the task list now<span class="dots"></span> Cards appear on the board below as it goes.</p>${add}`; }
  return `<p>The first agent that starts on the board (step 3) becomes the <b>planner</b> and writes the task list from the goal automatically.</p>${add}`;
}
// Who merges to main, in the same order as the planner's: label, select (with main's CI), one hint. Setup's step 5,
// the Roles popover, and the Merges popover (no label there: its heading names the select).
function stepIntegrator(_si, sel = 'integ-sel', labelledBy = '') {
  const S = state.settings;
  const review = state.tasks.filter((t) => t.status === 'review').length;
  const names = agentNames([S.integrator]);
  return `<div class="inl">${labelledBy ? '' : `<label for="${sel}" class="m0">Merges to main</label>`}
      <select id="${sel}" data-fk="${sel.replace(/-sel$/, '')}"${labelledBy ? ` aria-labelledby="${labelledBy}"` : ''}><option value="">Let the first agent with finished work do it</option><option value="${ANYONE}" ${S.integrator === ANYONE ? 'selected' : ''}>Whoever is free (any agent with room merges)</option>${names.map((n) => `<option value="${esc(n)}" ${n === S.integrator ? 'selected' : ''}>${esc(n)}${youTag(n)}</option>`).join('')}</select>${ciPill()}</div>
    <p class="hint">One agent merges at a time and runs the tests first; whoever is free never merges its own work.</p>
    ${review && !S.integrator ? `<p class="note">${plural(review, 'finished task is', 'finished tasks are')} waiting to be merged.</p>` : ''}`;
}
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

function renderQuestions(qOpen) {
  $('q-panel').hidden = !qOpen.length;
  // Screen readers only: the cards say it.
  patch($('q-h'), qOpen.length ? `${qOpen.length === 1 ? 'An agent is' : `${qOpen.length} agents are`} waiting for a human answer` : '');
  patch($('questions'), qOpen.map((q) => {
    const t = q.task_id && taskById(q.task_id);
    const old = Date.now() - q.created_at > 30 * 60e3; // muted text; amber only once it has waited half an hour
    return `<article class="qcard" id="q-${q.id}" aria-label="Question from ${esc(q.asker)}">
      <div class="qh">${who(q.asker, true)}${t ? `<span class="muted">on</span> <button type="button" class="link tref" data-open-task="${t.id}">#${t.id} ${esc(short(t.title, 40))}</button>` : ''}
        <span class="${old ? 'pill warn' : 'muted'}" title="${esc(fullTime(q.created_at))}">asked ${ago(q.created_at)}</span></div>
      <div class="qt">${fmt(q.question, true)}</div>
      <form data-qform="${q.id}" data-asker="${esc(q.asker)}">
        <label class="vh" for="qa-${q.id}">Answer to ${esc(q.asker)}</label>
        <textarea id="qa-${q.id}" data-keep="qa-${q.id}" rows="1" placeholder="Your answer" title="Enter sends · Shift+Enter adds a new line" aria-describedby="qe-${q.id}" ${ui.qErr?.[q.id] ? 'aria-invalid="true"' : ''}></textarea>
        <button type="submit" data-fk="qb-${q.id}">Answer</button>
      </form><div class="err" id="qe-${q.id}" role="alert">${esc(ui.qErr?.[q.id] || '')}</div></article>`;
  }).join(''));
  // Under the cards, muted: what answering them unblocks (each card's task says "question waiting").
  const nb = blockedSplit(qOpen).asked.length;
  $('q-sum').hidden = !nb;
  patch($('q-sum'), nb ? `Answering ${qOpen.length > 1 ? 'these' : 'it'} unblocks ${plural(nb, 'task')}` : '');
}

// ---------- Agents: one component for both views ----------
// Per person a heading line (initial, name, roles, the person filter), then one row per agent: its tool's dot, its name
// and its state (the room's word for it, see oStatus), then what it does, its tool and its model. Its subagents sit
// under it with their own state, task and model. A row selects the agent (in the 3D view also its character in the
// room); the selected agent shows its capacity, what it holds, its question, its last message and its controls.
// Same name used from two laptops at once: almost always two people who picked the same name in join.
const conflictText = (a) => `${a.name} is connected from ${a.conflict?.laptops || 2} laptops: two people may be using the same name. One of them should re-run join with another name.`;
// Where an agent's person comes from, for tooltips.
const personSourceText = (a) => ({ human: 'set here on the web board', join: 'from join', guess: 'guessed from the name' }[a.personSource] || 'guessed from the name');
function toolDot(a) {
  const c = String(a.client || '').toLowerCase();
  const k = c.includes('claude') ? 'claude' : c.includes('codex') ? 'codex' : c.includes('copilot') ? 'copilot' : c.includes('gemini') ? 'gemini' : c.includes('cursor') ? 'cursor' : 'other';
  return `<span class="tdot ${k}" data-tool="${k}" aria-hidden="true"></span>`;
}
// The model as the agent reported it, compact: "Claude Sonnet 5.5" -> "Sonnet 5.5" (the tool already says Claude).
const modelText = (m) => String(m || '').replace(/^claude[\s-]+/i, '').trim();
// What an agent shows follows the room's rule (lookFor() in office/src/live/adapter.ts), so its row and the bubble over
// its desk agree. Only what a human acts on gets a badge: a question, a blocked task (with no open question: answering
// is what unblocks those) and out of usage. Everything else is a plain word. [class, word, badge?]
function oStatus(a, qOpen) {
  if (isLimited(a)) return ['limited', 'Out of usage', true];
  if (!a.online) return ['off', 'offline'];
  if (!a.started) return ['off', 'not started'];
  if (qOpen.some((q) => agentRoot(q.asker) === a.name)) return ['question', 'Question', true];
  const mine = state.tasks.filter((t) => t.assignee && agentRoot(t.assignee) === a.name);
  if (mine.some((t) => t.status === 'blocked')) return ['blocked', 'Blocked', true];
  if (mine.some((t) => t.status === 'in_progress')) return ['working', 'working'];
  if (state.tasks.some((t) => t.status === 'review' && t.reviewer && agentRoot(t.reviewer) === a.name)) return ['review', 'merging'];
  if (mine.some((t) => t.status === 'claimed')) return ['working', 'working'];
  if (mine.some((t) => t.status === 'review')) return ['review', 'in review'];
  return ['idle', a.busy ? 'working' : 'idle'];
}
// A main agent's subagents (owner/subagent): the ones the board tracks (presence[].helpers, with their model) that hold
// a task or say what they're doing, plus any holding a task or asking a question. Each has its own state: one can be blocked
// while another works.
function subagentsOf(a, qOpen) {
  const by = new Map();
  const add = (n) => { n = String(n).toLowerCase(); if (!by.has(n)) by.set(n, { name: n, full: `${a.name}/${n}`, model: null, active: false, doing: null }); return by.get(n); };
  for (const h of a.helpers || []) { if (!h.task_id && !(h.active && h.doing)) continue; const x = add(h.name); x.model = h.model || null; x.active = !!h.active; x.doing = h.doing || null; }
  for (const t of state.tasks) if (String(t.assignee || '').includes('/') && agentRoot(t.assignee) === a.name && ACTIVE.includes(t.status)) add(t.assignee.split('/')[1]);
  for (const q of qOpen) if (q.asker.includes('/') && agentRoot(q.asker) === a.name) add(q.asker.split('/')[1]);
  return [...by.values()].sort((x, y) => x.name.localeCompare(y.name)).map((h) => {
    const ts = state.tasks.filter((t) => String(t.assignee || '').toLowerCase() === h.full && ACTIVE.includes(t.status));
    const q = qOpen.find((x) => x.asker.toLowerCase() === h.full); const b = ts.find((t) => t.status === 'blocked');
    const [cls, word] = q ? ['question', 'Question'] : b ? ['blocked', 'Blocked'] : ts.some((t) => HOLDING.includes(t.status)) ? ['working', 'working'] : ts.length ? ['review', 'in review'] : h.active ? ['working', 'working'] : ['idle', 'idle'];
    const t = (q?.task_id && taskById(q.task_id)) || b || ts.find((x) => HOLDING.includes(x.status)) || ts[0];
    return { ...h, cls, word, t };
  });
}
// What the 3D view draws: the board's state, plus each agent's status word (its Agents row's, from oStatus()), so its
// name tag in the room says the same thing as its row.
function officeState() {
  const q = openQuestions();
  return { ...state, agentStatus: Object.fromEntries([...agentInfo().values()].map((a) => [a.name, oStatus(a, q)[1]])) };
}
// Per-agent controls (the selected agent): whose agent it is, how many tasks it may hold, and "hit its usage limit".
function agentControls(a) {
  const k = esc(a.name);
  const opts = [['', `plan default (${a.base})`], ...Array.from({ length: 10 }, (_, i) => [String(i + 1), String(i + 1)])];
  const slots = `<label for="sl-${k}">Task limit</label><select id="sl-${k}" data-slots="${k}" data-fk="sl-${k}" title="How many tasks ${k} may hold at once">${opts.map(([v, l]) => `<option value="${v}" ${String(a.override || '') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  let lim;
  if (isLimited(a)) lim = `<span class="pill warn" title="${esc(a.limited.note || (a.limited.by === 'agent' ? 'Reported by the agent' : 'Marked on this page'))}">${esc(limitText(a))}${a.limited.by === 'agent' ? ' · reported by the agent' : ''}</span>${a.limited.note ? `<span class="muted">${esc(short(a.limited.note, 60))}</span>` : ''}<button type="button" class="ghost" data-unlimit="${k}" data-fk="ul-${k}" title="It has usage again: count it as available">It's back</button>`;
  else lim = `<button type="button" class="ghost" data-limit="${k}" data-fk="lm-${k}" aria-expanded="${ui.limitForm === a.name}" title="Its subscription hit a usage limit: stop counting it as available, let others take over its tasks">Hit usage limit…</button>`;
  const form = ui.limitForm === a.name && !isLimited(a) ? `<form class="lim-f" data-limform="${k}">
      <div><label for="lu-${k}">Back at (optional)</label><input type="time" id="lu-${k}" data-keep="lu-${k}" aria-describedby="lh-${k}"></div>
      <div class="grow"><label for="ln-${k}">Note (optional)</label><input id="ln-${k}" data-keep="ln-${k}" maxlength="200" placeholder="e.g. Claude says try again at 3pm" class="w-full"></div>
      <button type="submit" data-fk="ls-${k}">Mark out of usage</button><button type="button" class="ghost" data-limcancel="${k}" data-fk="lc-${k}">Cancel</button>
      <p class="hint row m0" id="lh-${k}">No time: it counts as back as soon as it talks to the board again.</p></form>` : '';
  // Who this agent belongs to: fixes an agent that shows up as its own person (or under the wrong one).
  const cur = a.personSource === 'human' ? a.person : '';
  // The people in the Agents panel (not every name ever typed on this page), plus its current person.
  const ppl = [...new Set([...people().map((p) => p.name), a.person, root(a.name)].filter(Boolean))].sort();
  const owner = `<label for="pb-${k}">Belongs to</label><select id="pb-${k}" data-person="${k}" data-fk="pb-${k}" title="Whose agent this is: ${esc(root(a.name))} (${esc(personSourceText(a))}). Pick a person to group it under them.">
      <option value="" ${cur ? '' : 'selected'}>automatic (${esc(a.personSource === 'human' ? 'join or name' : root(a.name))})</option>${ppl.map((n) => `<option value="${esc(n)}" ${cur === n ? 'selected' : ''}>${esc(n)}${youTag(n)}</option>`).join('')}</select>`;
  const clash = a.conflict ? `<div class="note row" role="status">${esc(conflictText(a))}</div>` : '';
  // Each label over its control, the two side by side; the usage-limit control and a name clash under them.
  return `<div class="actl"><div class="af">${owner}</div><div class="af">${slots}</div><div class="al">${lim}</div>${clash}</div>${form}`;
}
// Under the selected agent's row: its tool, plan and capacity, what it holds or merges, its question (with Answer),
// what it last said, a way to message it and its controls.
function agentDetail(a, qOpen, lastText) {
  const order = (x, y) => (HOLDING.includes(y.status) - HOLDING.includes(x.status)) || x.id - y.id;
  const held = state.tasks.filter((t) => t.assignee && agentRoot(t.assignee) === a.name && ACTIVE.includes(t.status)).sort(order);
  const reviewing = state.tasks.filter((t) => t.status === 'review' && t.reviewer && agentRoot(t.reviewer) === a.name && !held.includes(t));
  const q = qOpen.find((x) => agentRoot(x.asker) === a.name);
  const row = (t, label, cls) => `<li><div class="tk"><span class="pill ${cls}">${label}</span>${isStale(t) ? '<span class="pill flag">stale</span>' : ''}${t.assignee && t.assignee.includes('/') ? `<span class="muted t-meta">${esc(t.assignee.split('/')[1])}</span>` : ''}<button type="button" class="link" data-open-task="${t.id}" data-fk="pt-${t.id}" title="${esc(t.title)}">#${t.id} ${esc(t.title)}</button></div></li>`;
  const lines = [...held.map((t) => row(t, LABEL[t.status], 's-' + t.status)), ...reviewing.map((t) => row(t, 'Merging', 's-review'))];
  const st = agentState(a);
  // Its state is the row's word (oStatus): the detail only adds what the row doesn't say.
  const what = st === 'limited' ? limitText(a) : st === 'offline' ? `Offline${boardView === 'office' ? ': not in the room' : ''} (last seen ${a.last ? ago(a.last) : 'never'})` : st === 'waiting' ? notStartedText(a) : '';
  const cap = `<div class="pcap" title="${esc(capTip(a))}">${esc([a.client, a.plan].filter(Boolean).join(' · ') || 'agent')} · ${a.active} of ${a.slots} at once${a.override ? ' (set here)' : ''}${a.model ? ` · ${esc(a.model)}` : ''}${a.extra ? ` <span class="pill ok" title="Planner: nobody else is free and small/medium work is ready, so it may run ${a.extra} more with subagents">+${a.extra} extra as planner</span>` : ''}</div>`;
  const doing = (lines.length || a.busy) && a.doing && !isLimited(a) && !/^#\d+/.test(a.doing) ? `<div class="doing" title="${esc(a.doing)}">${esc(short(a.doing, 120))}</div>` : '';
  return `<div class="o-det" id="o-det" role="group" aria-label="${esc(a.name)}">${cap}${what ? `<p class="muted">${esc(what)}</p>` : ''}${lines.length ? `<ul>${lines.join('')}</ul>` : ''}${doing}`
    + (q ? `<p><span class="pill warn">Question</span> ${esc(short(q.question, 110))}</p>` : '')
    + (lastText && !/^#\d+ updated$/.test(lastText) ? `<div class="last" title="${esc(lastText)}">${esc(short(lastText, 120))}</div>` : '') // "#12 updated" says nothing
    + `<div class="oc-a">${q ? `<button type="button" class="sm" data-go-q="${q.id}" data-fk="oq-${esc(a.name)}">Answer</button>` : ''}<button type="button" class="ghost sm" data-dm="${esc(a.name)}" data-fk="om-${esc(a.name)}" title="${esc(`Open your direct thread with ${a.name}: other agents don't see it, everyone on this page does`)}">Message ${esc(a.name)}</button></div>`
    + agentControls(a) + '</div>';
}
function renderAgents(si, qOpen) {
  // You, with no agent and nothing held, aren't listed: Setup says how to connect one.
  const ps = people().filter((p) => p.name !== me || (p.r.agents || []).length || [...p.agents.values()].some((a) => a.tasks.length) || p.locks || p.asks);
  const all = ps.flatMap((p) => p.r.agents || []);
  // The team at a glance: the count in the title bar (also on the folded chip), what can run at once in the panel.
  const cnt = agentsLine(si, true);
  // The title bar says only how many are online (the rows say who is out of usage, offline or not started); the
  // whole count is its tooltip.
  $('o-right-sub').textContent = all.length ? `${si.onlineA.length} online` : ''; $('o-right-sub').title = all.length ? cnt + '.\nOnline = an agent someone started with /board, seen in the last 10 min and not out of usage. Not started = its tool is connected but nobody typed /board yet. Out of usage = hit its plan\'s limit. Offline = not seen for 10 min.' : '';
  $('o-right-n').textContent = all.length ? `${si.onlineA.length} online` : '';
  $('o-right-pill').setAttribute('aria-label', `Agents${all.length ? `: ${cnt}` : ''}. Open the panel`);
  patch($('p-sum'), teamCapHtml());
  if (ui.picked && !all.some((a) => a.name === ui.picked)) ui.picked = null;
  const r = filterRoot(); const S = state.settings;
  const agentRow = (a, p) => {
    const [cls, word, badge] = oStatus(a, qOpen);
    const own = state.tasks.filter((t) => String(t.assignee || '').toLowerCase() === a.name && ACTIVE.includes(t.status)).sort((x, y) => (HOLDING.includes(y.status) - HOLDING.includes(x.status)) || x.id - y.id);
    const qSelf = qOpen.find((x) => x.asker.toLowerCase() === a.name);
    const merging = state.tasks.find((t) => t.status === 'review' && t.reviewer && agentRoot(t.reviewer) === a.name);
    const subs = subagentsOf(a, qOpen);
    const what = a.conflict ? `on ${a.conflict.laptops || 2} laptops: re-run join with another name`
      : cls === 'limited' ? limitText(a).replace(/^out of usage(?: · )?/, '') || 'until it talks to the board again'
      : word === 'not started' ? `type ${startCmd(a.client)} in it`
      : cls === 'off' ? `last seen ${a.last ? ago(a.last) : 'never'}`
      : qSelf ? 'asked you a question' : own[0] ? `#${own[0].id} ${short(own[0].title, 60)}` : merging ? `merging #${merging.id}`
      : a.busy && a.doing && !/^#\d+/.test(a.doing) ? short(a.doing, 60) : '';
    const tm = [a.client, modelText(a.model)].filter(Boolean).join(' · ');
    const sel = ui.picked === a.name;
    const sr = `<span class="vh">, ${esc([a.client || 'agent', a.plan].filter(Boolean).join(' on '))}: ${capText(a)} tasks</span>`;
    return `<li><button type="button" class="o-agent${cls === 'off' ? ' off' : ''}" ${hs(p.name)} data-o-agent="${esc(a.name)}" data-fk="oa-${esc(a.name)}" aria-pressed="${sel}" title="${esc(capTip(a))}${boardView === 'office' ? (a.online ? ' Click to show it in the room.' : ' Offline: not in the room.') : ''}">`
      + `<span class="o-r1">${toolDot(a)}<span class="o-an">${esc(a.name)}${sr}</span><span class="o-st ${cls}${badge ? ' bx' : ''}">${word}</span></span>`
      + `<span class="o-r2"${sel ? ' hidden' : ''}><span class="o-tk${a.conflict ? ' bad' : ''}">${esc(what || tm || 'AI tool not reported yet')}</span>${what && tm ? `<span class="o-cl" title="${esc([a.client, a.model].filter(Boolean).join(' · '))}">${esc(tm)}</span>` : ''}</span></button>`
      + (subs.length ? `<ul class="o-helpers" aria-label="${esc(a.name)}'s subagents">${subs.map((h) => `<li><button type="button" class="link o-hn" data-mention="${esc(h.full)}" title="Subagent of ${esc(a.name)}: works on one task. Click to @mention ${esc(h.full)} in chat">${esc(h.name)}</button><span class="o-hs ${h.cls}">${h.word}</span><span class="o-tk">${h.t ? `#${h.t.id} ${esc(h.t.title)}` : h.doing ? esc(h.doing) : ''}</span>${h.model ? `<span class="o-hm" title="${esc(h.model)}">${esc(modelText(h.model))}</span>` : ''}</li>`).join('')}</ul>` : '')
      + `${sel ? agentDetail(a, qOpen, p.agents.get(a.name)?.lastText) : ''}</li>`;
  };
  patch($('people'), ps.length ? ps.map((p) => {
    const key = esc(p.name); const sel = r === p.name; const agents = p.r.agents || [];
    const tasks = [...p.agents.values()].flatMap((a) => a.tasks);
    const roles = (S.planner && root(S.planner) === p.name ? '<span class="pill role" title="Planner: wrote the task list from the goal">planner</span>' : '')
      + (S.integrator && S.integrator !== ANYONE && root(S.integrator) === p.name ? '<span class="pill role" title="Merges finished branches into main">merges to main</span>' : '');
    const filt = agents.length || tasks.length ? `<button type="button" class="o-ib pfilt" data-filter="${key}" data-fk="pf-${key}" aria-pressed="${sel}" aria-label="${sel ? 'Show everyone\'s tasks' : `Show only ${key}'s tasks`}" title="${sel ? 'Showing only their tasks: show everyone\'s' : `Show only ${key}'s tasks`}">${FUNNEL}</button>` : '';
    const lt = [...p.agents.values()].find((a) => a.lastText && !agents.some((x) => x.name === a.id))?.lastText;
    return `<li class="person${sel ? ' sel' : ''}" ${hs(p.name)} data-person-row="${key}"><div class="o-pn"><span class="pdot" aria-hidden="true" data-i="${esc([...p.name][0]?.toUpperCase() || '')}"></span><b class="pc" ${hs(p.name)}>${key}</b>${youTag(p.name) ? '<span class="muted">(you)</span>' : ''}${roles}${filt}</div>`
      + (agents.length ? `<ul class="o-agents" aria-label="${key}'s agents">${agents.map((a) => agentRow(a, p)).join('')}</ul>`
        : `<p class="o-none" title="${esc(lt || '')}">${p.r.humanOnline && p.name !== me ? 'watching · ' : ''}no AI agent</p>`)
      + '</li>';
  }).join('') : '<li class="muted">Nobody yet. When a teammate\'s AI agent connects, it appears here with what it\'s working on.</li>');

}

// More rows below the Agents panel's edge: its foot fades, so a cut row reads as "more", not as a fragment.
function fadeAgents() {
  const b = $('o-agents'); b.classList.toggle('more-below', b.scrollHeight - b.scrollTop - b.clientHeight > 2); b.classList.toggle('more-above', b.scrollTop > 2);
  const t = $('tabs'); t.classList.toggle('more-right', t.scrollWidth - t.scrollLeft - t.clientWidth > 2);
}
$('o-agents').addEventListener('scroll', fadeAgents, { passive: true });
$('tabs').addEventListener('scroll', fadeAgents, { passive: true });
addEventListener('resize', () => requestAnimationFrame(fadeAgents));
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

// evHtml is cached per event: the key holds everything else its HTML depends on. Task titles (#id links),
// people (mention highlights, colours) and who I am are shared by every line: when they change, the cache is dropped.
const evCache = new Map(); let evShared = { s: null, k: '' };
function evHtml(e, prev) {
  if (evShared.s !== state) {
    const k = me + '\u0001' + state.tasks.map((t) => t.id + ':' + t.title).join('\u0002') + '\u0001' + (state.presence || []).map((p) => `${p.kind}:${p.name}:${p.person || ''}`).join('\u0002');
    if (k !== evShared.k || evCache.size > 5000) evCache.clear();
    evShared = { s: state, k };
  }
  const cont = !isChat(e) && !!prev && !isChat(prev) && prev.author === e.author && e.ts - prev.ts < 10 * 60e3;
  const open = e.kind === 'question' && state.questions.some((q) => q.id === e.data?.question_id && !q.answer);
  const key = `${cont}|${open}|${expandedEv.has(e.id)}|${Date.now() - e.ts < 3600e3 ? ago(e.ts) : ''}`;
  const hit = evCache.get(e.id);
  if (hit && hit.key === key && hit.e === e.ts + e.text) return hit.html;
  const html = evHtmlRaw(e, prev);
  evCache.set(e.id, { key, e: e.ts + e.text, html });
  return html;
}
function evHtmlRaw(e, prev) {
  if (e.channel === 'direct' && e.data?.dm?.from === 'board') return `<div class="ev sys" data-eid="${e.id}"><div class="eh"><span class="eb">${fmt(e.text, true)}</span>${timeEl(e.ts)}</div></div>`;
  if (!isChat(e)) {
    // Consecutive status lines from the same author are grouped: the name shows once.
    const cont = prev && !isChat(prev) && prev.author === e.author && e.ts - prev.ts < 10 * 60e3;
    return `<div class="ev sys${cont ? ' cont' : ''}${isAction(e) ? ' act' : ''}${isAction(e) && mentionsMe(e) ? ' mention' : ''}" data-eid="${e.id}"><div class="eh"><span class="eb">${cont ? `<span class="vh">${esc(e.author)} </span>` : who(e.author, true) + (isAction(e) ? ' · ' : ' ')}${fmt(noTool(e.kind === 'settings' ? settingsText(e) : isAction(e) ? actionText(e) : e.text), true)}</span>${timeEl(e.ts)}</div></div>`;
  }
  const mention = mentionsMe(e); const lite = !mention && mentionsLite(e);
  const tag = e.kind === 'question' ? '<span class="pill warn">asked the humans</span>' : e.kind === 'answer' ? '<span class="pill">answered</span>' : '';
  const open = e.kind === 'question' && state.questions.some((q) => q.id === e.data?.question_id && !q.answer);
  const long = isLong(e.text); const shown = long && expandedEv.has(e.id);
  return `<div class="ev chat ${mention ? 'mention' : lite ? 'mention-lite' : ''} ${open ? 'question' : ''}${long ? ' long' : ''}${shown ? ' open' : ''}" data-eid="${e.id}"><div class="eh">${who(e.author, true)}${tag}${e.channel === 'direct' ? (e.data?.dm?.from === 'agent' && e.data.dm.to && !isMe(e.data.dm.to) ? `<span class="ch">to ${esc(e.data.dm.to)}</span>` : '') : e.channel !== 'general' ? `<span class="ch">#${esc(e.channel)}</span>` : ''}${timeEl(e.ts)}</div>
    <div class="eb">${fmt(e.text, true)}</div>${long ? `<button type="button" class="link muted evmore" data-more="${e.id}" aria-expanded="${shown}">${shown ? 'Show less' : 'Show more'}</button>` : ''}</div>`;
}
// A status line written for the agents ends with the tool to use, "(decide_proposal)": people don't need it.
const noTool = (s) => String(s).replace(/\s*\([a-z]+(?:_[a-z]+)+\)(?=\s*(?:$|[.;,]))/g, '');
// "planner → alice; integrator → nobody" in plain words.
function settingsText(e) {
  return String(e.text).split('; ').map((part) => {
    const m = part.match(/^(planner|integrator) → (.*)$/); if (!m) return part;
    const [, role, v] = m; const self = v === agentRoot(e.author);
    if (/^nobody/.test(v)) return role === 'planner' ? 'cleared the planner role' : 'cleared who merges to main';
    if (role === 'integrator' && /^whoever is free/.test(v)) return 'let whoever is free merge finished work into main';
    if (role === 'planner') return self ? 'is now the planner (writes the task list)' : `made ${v} the planner (writes the task list)`;
    return self ? 'will merge finished work into main' : `picked ${v} to merge finished work into main`;
  }).join('; ');
}
// Feed filters, derived from kind + data (task_updated carries data.status; the rest is read from the text).
const isProblem = (e) => (e.kind === 'task_updated' && (e.data?.status === 'blocked' || /review → in_progress/.test(e.text)))
  || (e.kind === 'task_deleted' && /^rejected proposal/.test(e.text))
  || (e.kind === 'message' && (e.data?.notice === 'limit' || (e.author === 'board' && /is being used from \d+ laptops/.test(e.text))));
const isMergeReview = (e) => e.kind === 'task_updated' && (e.data?.status === 'review' || e.data?.status === 'done') && /→ (review|done)\b/.test(e.text);
// ---------- direct messages (the Activity panel's Direct tab, both views) ----------
// One thread per agent (its name), plus the planner's thread ("planner"): whoever is the planner reads it, and while
// nobody is, its messages wait for the first one. Every human sees every thread; other agents don't. Unread: replies
// to me newer than what I last saw in that thread (remembered in this browser).
const DM_PLANNER = 'planner';
const seenDm = (() => { try { const v = JSON.parse(store.get('board-seen-dm') || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } })();
const dmAll = () => state.direct || [];
const dmThread = (name) => dmAll().filter((e) => e.data?.dm?.thread === name);
const dmUnreadIn = (name) => dmThread(name).filter((e) => e.data?.dm?.from === 'agent' && isMe(e.data.dm.to) && e.id > (seenDm[name] || 0)).length;
const dmUnreadCount = () => [...new Set(dmAll().map((e) => e.data?.dm?.thread))].reduce((n, t) => n + dmUnreadIn(t), 0);
function markDmSeen(name) {
  const max = Math.max(0, ...dmThread(name).map((e) => e.id));
  if (max > (seenDm[name] || 0)) { seenDm[name] = max; store.set('board-seen-dm', JSON.stringify(seenDm)); return true; }
  return false;
}
const dmTitle = (name) => (name === DM_PLANNER ? 'Planner' : name);
// Who reads a thread: the agent, or for the planner's thread whoever is the planner now ('' = nobody yet).
const dmReader = (name) => (name === DM_PLANNER ? state.settings.planner || '' : name);
function dmEmptyText(name) {
  if (name === DM_PLANNER) return state.settings.planner ? `Nothing here yet. Messages here go to ${esc(state.settings.planner)}, the planner, and follow the role if it changes.` : 'Nothing here yet. Nobody is the planner yet: messages wait here for the first agent that becomes planner.';
  return `Nothing here yet. Write to ${esc(name)} below.`;
}
// The thread list: the planner's thread first, then threads by their latest message, then the other agents.
function dmListHtml() {
  const info = agentInfoNow();
  const names = [...new Set([...dmAll().map((e) => e.data?.dm?.thread).filter((t) => t && t !== DM_PLANNER), ...info.keys()])];
  const last = (n) => dmThread(n).at(-1);
  names.sort((a, b) => (last(b)?.id || 0) - (last(a)?.id || 0) || a.localeCompare(b));
  const row = (n) => {
    const l = last(n); const un = dmUnreadIn(n); const pin = n === DM_PLANNER; const a = info.get(n);
    const sub = pin ? (state.settings.planner ? `goes to ${state.settings.planner}` : 'no planner yet') : !a ? 'not on the board' : a.online ? '' : 'offline';
    // The last message under the name; an agent with no thread yet is just its name.
    const line = l ? `${l.data?.dm?.from === 'board' ? '' : `${l.author === me ? 'You' : l.author}: `}${short(l.text, 120)}` : pin ? 'Ideas and changes for the plan' : '';
    const label = `${dmTitle(n)}${sub ? ` (${sub})` : ''}${un ? `, ${un} unread` : ''}. ${l ? `Last: ${short(l.text, 80)}` : line || 'No messages yet'}`;
    return `<li${pin ? ' class="pin"' : ''}><button type="button" class="dmrow${un ? ' unread' : ''}" data-dm="${esc(n)}" data-fk="dm-${esc(n)}" aria-label="${esc(label)}">`
      + `<span class="dn">${pin ? esc(dmTitle(n)) : `<span class="pc" ${hs(n)}>${esc(n)}</span>`}${sub ? ` <span class="muted">· ${esc(sub)}</span>` : ''}</span><span class="dr">${l ? timeEl(l.ts) : ''}${un ? `<span class="n" aria-hidden="true">${un}</span>` : ''}</span>`
      + (line ? `<span class="dl">${esc(line)}</span>` : '') + '</button></li>';
  };
  return `<ul class="dmlist" aria-label="Direct message threads">${row(DM_PLANNER)}${names.map(row).join('')}</ul>`
    + (names.length ? '' : '<div class="muted empty-note">No agents yet. When one connects, you can message it here.</div>');
}
// Above the feed while a thread is open: back to the list, and who reads it.
function renderDmBar() {
  const bar = $('dmbar'); const on = ui.tab === 'direct' && !!ui.dm;
  bar.hidden = !on;
  $('composer').hidden = ui.tab === 'direct' && !ui.dm;
  $('composer').classList.toggle('dm', on);
  syncComposer();
  if (!on) return;
  const r = dmReader(ui.dm);
  const note = ui.dm === DM_PLANNER ? (r ? `to ${r}` : 'waits for a planner') : 'hidden from other agents';
  patch(bar, `<button type="button" class="link" data-dm-back data-fk="dm-back" aria-label="Back to all threads">← Threads</button><span class="dmt">${esc(dmTitle(ui.dm))}</span><span class="muted" title="${esc(`Among the agents, only ${r || 'the planner'} reads this thread. Everyone on this web board can read it.`)}">${esc(note)}</span>`);
}
// The message box keeps a draft per place (the shared chat, each thread), so a chat draft never lands in a thread.
const drafts = {}; let composerKey = 'chat';
function syncComposer() {
  const key = ui.tab === 'direct' && ui.dm ? 'dm:' + ui.dm : 'chat';
  const m = $('msg');
  if (key !== composerKey) { drafts[composerKey] = m.value; m.value = drafts[key] || ''; composerKey = key; growMsg(); closeAc(); }
  const dm = key !== 'chat'; const r = dm && dmReader(ui.dm);
  const ph = dm ? `Message ${ui.dm === DM_PLANNER ? 'the planner' : ui.dm}` : 'Message, @ to mention';
  if (m.placeholder !== ph) m.placeholder = ph;
  const tip = dm ? `Among the agents only ${r || 'the planner'} reads this; everyone on this web board can. Enter sends, Shift+Enter adds a line` : 'Agents read this chat: @name for one agent, @all for everyone. Enter sends, Shift+Enter adds a line';
  if (m.title !== tip) m.title = tip;
  // The shared chat's hint, or this thread's (the message box points at whichever is shown).
  $('chat-hint').hidden = dm; $('dm-hint').hidden = !dm;
  if (m.getAttribute('aria-describedby') !== (dm ? 'dm-hint' : 'chat-hint')) m.setAttribute('aria-describedby', dm ? 'dm-hint' : 'chat-hint');
  if (!dm) return;
  const who = ui.dm === DM_PLANNER ? (r ? `Goes to ${r}, the planner (it follows the role)` : 'Waits for the first agent that becomes planner') : `Goes to ${ui.dm} only`;
  const t = `${who}. Other agents don't see it; everyone on this page does. Enter sends, Shift+Enter adds a line`;
  if ($('dm-hint').textContent !== t) $('dm-hint').textContent = t;
}
// Open an agent's thread (its Message button) or the planner's, with the message box focused.
function openDm(name, focus = true) {
  oShow('act');
  if ($('task-dlg').open) $('task-dlg').close();
  ui.tab = 'direct'; store.set('board-tab', 'direct'); ui.dm = name; store.set('board-dm', name);
  $('feed')._html = undefined; render();
  if (focus) { const m = $('msg'); m.focus({ preventScroll: true }); m.setSelectionRange(m.value.length, m.value.length); }
}
const TAB_EMPTY = { me: 'No mentions of you yet.', problems: 'No problems so far: nothing blocked, sent back or out of usage.', merges: 'No reviews or merges yet.' };
function renderFeed(unreadCount) {
  const tabs = { all: () => true, chat: isChat, me: (e) => mentionsMe(e), problems: isProblem, merges: isMergeReview };
  const dmUnread = dmUnreadCount();
  $('tabs').querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.tab === ui.tab));
    const n = b.dataset.tab === 'me' ? unreadCount : b.dataset.tab === 'direct' ? dmUnread : null;
    if (n === null) return;
    const label = b.dataset.tab === 'me' ? '@me' : 'Direct';
    const html = label + (n ? `<span class="n" aria-hidden="true">${n}</span>` : '');
    if (b.innerHTML !== html) b.innerHTML = html;
    b.setAttribute('aria-label', n ? `${label}, ${n} unread` : label);
  });
  renderDmBar();
  const feed = $('feed');
  const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40;
  const direct = ui.tab === 'direct';
  const evs = direct ? (ui.dm ? dmThread(ui.dm) : []) : state.events.filter(tabs[ui.tab] || tabs.all);
  const before = feed._html;
  // Reading older messages? Remember the first visible line so new/expired events don't move it.
  let anchor = null;
  if (!atBottom && before !== undefined) {
    for (const n of feed.children) if (n.dataset.eid && n.offsetTop + n.offsetHeight > feed.scrollTop) { anchor = { id: n.dataset.eid, off: n.offsetTop - feed.scrollTop }; break; }
  }
  const more = !direct && (older.more ?? (state.events.length >= 200 && state.events[0]?.id > 1));
  const html = direct && !ui.dm ? dmListHtml()
    : (more ? `<div class="older"><button type="button" class="link muted" data-older ${older.loading ? 'disabled' : ''}>${older.loading ? 'Loading…' : 'Load earlier activity'}</button></div>` : '')
    + (evs.length ? evs.map((e, i) => evHtml(e, evs[i - 1])).join('') : `<div class="muted empty-note">${direct ? dmEmptyText(ui.dm) : TAB_EMPTY[ui.tab] || 'No activity yet. Messages from agents and teammates show up here.'}</div>`);
  // New lines fade in (not on first load or a tab switch, and not a whole burst at once).
  const seen = before !== undefined && before !== html && canMove() ? new Set([...feed.children].map((n) => n.dataset.eid)) : null;
  patch(feed, html);
  if (seen) { const fresh = [...feed.children].filter((n) => n.dataset.eid && !seen.has(n.dataset.eid)); if (fresh.length <= 6) fresh.forEach((n) => reveal(n, 4)); }
  // The thread list reads from the top and stays put; a thread or the feed follows its newest line.
  if (direct && !ui.dm) { if (before === undefined) feed.scrollTop = 0; $('jump').hidden = true; }
  else if (atBottom || before === undefined) { feed.scrollTop = feed.scrollHeight; $('jump').hidden = true; }
  else if (before !== feed._html) {
    const n = anchor?.id && feed.querySelector(`[data-eid="${CSS.escape(anchor.id)}"]`);
    if (n) feed.scrollTop = n.offsetTop - anchor.off;
    if (!older.quiet) $('jump').hidden = false;
  }
  older.quiet = false;
  requestAnimationFrame(fadeFeed);
  if (before !== feed._html) observeMentions();
}
// The feed starts with the last 200 events; "Load earlier activity" pages back 200 at a time. Once a
// page is loaded, live reloads keep what's already here (see load()).
const older = { more: null, loading: false, keep: false, quiet: false };
async function loadOlder() {
  const first = state.events[0]; if (!first || older.loading) return;
  older.loading = true; older.quiet = true; render();
  try {
    const r = await api(`/events?before=${first.id}`); const got = r?.events || [];
    const have = new Set(state.events.map((e) => e.id));
    state.events = [...got.filter((e) => !have.has(e.id)), ...state.events];
    older.keep = true; older.more = got.length >= 200 && got[0].id > 1;
  } catch (e) { toast(`Couldn't load earlier activity: ${e.message}`, true); }
  older.loading = false; older.quiet = true; render();
}
document.addEventListener('click', (ev) => {
  if (ev.target.closest('[data-older]')) return loadOlder();
  const b = ev.target.closest('[data-more]'); if (!b) return;
  const id = Number(b.dataset.more);
  if (expandedEv.has(id)) expandedEv.delete(id); else expandedEv.add(id);
  render();
  document.querySelector(`#${b.closest('#td-history') ? 'td-history' : 'feed'} [data-more="${id}"]`)?.focus({ preventScroll: true });
});
$('feed').addEventListener('scroll', () => { const f = $('feed'); if (f.scrollHeight - f.scrollTop - f.clientHeight < 40) $('jump').hidden = true; fadeFeed(); });
// Older items above the top edge: fade it, so a cut-off line reads as "more above", not as a fragment.
function fadeFeed() { const f = $('feed'); f.classList.toggle('more-above', f.scrollTop > 2); }
$('jump').onclick = () => { $('feed').scrollTop = $('feed').scrollHeight; $('jump').hidden = true; };

// A mention counts as read once it has been visible in the feed for a moment.
let mentionIO = null; const mentionTimers = new Map();
function inFeedView(id) {
  const f = $('feed'); const n = f.querySelector(`.ev[data-eid="${id}"]`); if (!n) return false;
  const a = f.getBoundingClientRect(); const b = n.getBoundingClientRect();
  return b.height > 0 && b.top >= a.top - 2 && b.bottom <= a.bottom + 2 && a.height > 0;
}
function observeMentions() {
  if (!('IntersectionObserver' in window)) return;
  if (!mentionIO) mentionIO = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const id = Number(en.target.dataset.eid);
      if (en.isIntersecting && en.intersectionRatio > 0.9) {
        if (!mentionTimers.has(id)) mentionTimers.set(id, setTimeout(() => {
          mentionTimers.delete(id);
          if (document.visibilityState === 'visible' && inFeedView(id) && id > seenMention) { setSeenMention(id); store.set('board-seen-mention', String(id)); render(); }
        }, 1500));
      } else { clearTimeout(mentionTimers.get(id)); mentionTimers.delete(id); }
    }
  }, { root: $('feed'), threshold: [0, 0.95] });
  mentionIO.disconnect();
  $('feed').querySelectorAll('.ev.mention[data-eid]').forEach((n) => { if (Number(n.dataset.eid) > seenMention) mentionIO.observe(n); });
}

// File locks fold to their title bar (with the count), like the other panels: agents set and clear them, a human only
// steps in when an owner is gone.
function renderLocks() {
  $('l-count').textContent = state.locks.length ? `${state.locks.length} held` : 'none';
  patch($('locks'), state.locks.length ? state.locks.map((l) => {
    const mins = Math.max(0, Math.ceil((l.expires_at - Date.now()) / 60000));
    const confirming = ui.confirmLock === l.path;
    // Locks over an hour block teammates for a long time: make them stand out.
    const long = (l.expires_in_s ?? (l.expires_at - Date.now()) / 1000) > 3600;
    return `<li class="lock"><div><code>${esc(l.path)}</code>${long ? ` <span class="pill warn" title="Locked for over an hour by ${esc(l.owner)}. If someone is waiting on it, ask ${esc(agentRoot(l.owner))} to release it, or release it here.">long lock</span>` : ''}
      <div class="muted mt-1">${who(l.owner, true)}${l.task_id ? ` · <button type="button" class="link tref" data-open-task="${l.task_id}" tabindex="-1">#${l.task_id}</button>` : ''} · expires in ${mins}m${l.reason ? ` · ${esc(l.reason)}` : ''}</div></div>
      <div class="la">${confirming
        ? `<button class="danger" data-unlock-yes="${esc(l.path)}" data-fk="uy-${esc(l.path)}">Force release</button><button class="ghost" data-unlock-no data-fk="un-${esc(l.path)}">Keep</button>`
        : `<button class="ghost" data-unlock="${esc(l.path)}" data-fk="u-${esc(l.path)}" aria-label="Release lock on ${esc(l.path)}">Release</button>`}</div></li>`;
  }).join('') : '<li class="muted t-meta">No files are locked.</li>');
}

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

// ---------- chat ----------
$('composer').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const text = $('msg').value.trim(); if (!text) return $('msg').focus();
  $('send').disabled = true; closeAc();
  const to = composerKey.startsWith('dm:') ? composerKey.slice(3) : null;
  try { await act(api('/messages', { method: 'POST', body: JSON.stringify(to ? { text, to } : { text, channel: $('chan').value }) })); $('msg').value = ''; growMsg(); $('feed').scrollTop = $('feed').scrollHeight; if (to) scheduleReload(); }
  catch {} finally { $('send').disabled = false; $('msg').focus(); }
});
// The message box grows with what you type (up to ~8 lines, then it scrolls).
function growMsg() {
  const m = $('msg'); const max = parseFloat(getComputedStyle(m).maxHeight) || 200;
  // Empty: back to one line (Chrome counts a wrapped placeholder in scrollHeight).
  if (!m.value) { m.style.height = ''; m.style.overflowY = 'hidden'; return; }
  m.style.height = 'auto';
  const h = m.scrollHeight + (m.offsetHeight - m.clientHeight);
  m.style.height = Math.min(h, max) + 'px';
  m.style.overflowY = h > max ? 'auto' : 'hidden';
}
// @ autocomplete: agents, helpers, people and @all/@everyone/@humans.
const ac = { items: [], idx: 0, start: -1, open: false };
function acNames() {
  const out = new Map();
  const add = (name, sub, online, kind) => { name = String(name || '').toLowerCase(); if (!name || name === 'board' || name === 'anonymous' || out.has(name)) return; out.set(name, { name, sub, online, kind }); };
  const info = agentInfoNow();
  for (const a of info.values()) add(a.name, `${a.client || 'agent'}${isLimited(a) ? ' · out of usage' : a.online ? (a.started ? ' · online' : ' · not started') : ' · offline'}`, a.online && !isLimited(a), 'agent');
  const helpers = new Set([...state.events.map((e) => e.author), ...state.tasks.map((t) => t.assignee)].filter((n) => n && String(n).includes('/')));
  for (const h of helpers) add(h, `subagent of ${agentRoot(h)}`, info.get(agentRoot(h))?.online || false, 'helper');
  for (const r of roster()) add(r.name, `person${r.agents.length ? ` · ${plural(r.agents.length, 'agent')}` : ''}${r.humanOnline ? ' · watching' : ''}`, r.humanOnline || r.agentOnline, 'person');
  add('all', 'every agent and person', true, 'broadcast'); add('everyone', 'every agent and person', true, 'broadcast'); add('humans', 'people on this page', true, 'broadcast');
  // The role names reach whoever holds the role when the message is sent.
  const S = state.settings;
  if (S.planner) add('planner', `the planner, now ${S.planner}`, true, 'broadcast');
  if (S.integrator && S.integrator !== ANYONE) add('merger', `who merges to main, now ${S.integrator}`, true, 'broadcast');
  return [...out.values()];
}
function closeAc() {
  ac.open = false; ac.items = []; const ul = $('msg-ac'); ul.hidden = true; ul.innerHTML = '';
  const m = $('msg'); m.setAttribute('aria-expanded', 'false'); m.removeAttribute('aria-activedescendant');
}
function renderAc() {
  const ul = $('msg-ac'); const m = $('msg');
  ul.innerHTML = ac.items.map((it, i) => `<li role="option" id="ac-${i}" data-ac="${i}" aria-selected="${i === ac.idx}"><span class="pc" ${hs(it.name)}>@${esc(it.name)}</span><span class="ak ${it.online ? 'on' : ''}">${esc(it.sub)}</span></li>`).join('');
  ul.hidden = false; ac.open = true;
  m.setAttribute('aria-expanded', 'true'); m.setAttribute('aria-activedescendant', 'ac-' + ac.idx);
  ul.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}
function updateAc() {
  const m = $('msg'); const pos = m.selectionStart; if (pos !== m.selectionEnd) return closeAc();
  const mt = m.value.slice(0, pos).match(/(^|[\s(,;])@([\w.\-/]*)$/);
  if (!mt) return closeAc();
  const q = mt[2].toLowerCase(); ac.start = pos - mt[2].length - 1;
  // Whole-name prefix first, then a word inside the name ("@db" finds alice/db-worker); people before agents.
  const kindRank = { person: 0, agent: 1, helper: 2, broadcast: 3 };
  const word = (n) => n.split(/[-./_]/).some((w) => w.startsWith(q));
  ac.items = acNames().filter((it) => it.name.startsWith(q) || word(it.name))
    .sort((a, b) => (b.name.startsWith(q) - a.name.startsWith(q)) || (kindRank[a.kind] - kindRank[b.kind]) || (b.online - a.online) || a.name.localeCompare(b.name))
    .slice(0, 8);
  if (!ac.items.length) return closeAc();
  ac.idx = Math.min(ac.idx, ac.items.length - 1); if (!ac.open) ac.idx = 0;
  renderAc();
}
function pickAc(i) {
  const it = ac.items[i]; if (!it) return;
  const m = $('msg'); const pos = m.selectionStart;
  const ins = '@' + it.name + ' ';
  m.value = m.value.slice(0, ac.start) + ins + m.value.slice(pos).replace(/^\s+/, '');
  const c = ac.start + ins.length; m.focus(); m.setSelectionRange(c, c);
  closeAc(); growMsg(); ac.spaceAt = c;
}
$('msg').addEventListener('input', () => { growMsg(); updateAc(); });
$('msg').addEventListener('click', updateAc);
$('msg').addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== $('msg')) closeAc(); }, 120));
$('msg').addEventListener('keydown', (ev) => {
  // A picked name already ends in a space: a space typed right after it isn't doubled.
  const sp = ac.spaceAt; ac.spaceAt = -1;
  if (ev.key === ' ' && sp >= 0 && $('msg').selectionStart === sp && $('msg').selectionEnd === sp && $('msg').value[sp - 1] === ' ') return ev.preventDefault();
  if (ac.open) {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); ac.idx = (ac.idx + (ev.key === 'ArrowDown' ? 1 : -1) + ac.items.length) % ac.items.length; return renderAc(); }
    if ((ev.key === 'Enter' && !ev.shiftKey) || ev.key === 'Tab') { if (ev.isComposing) return; ev.preventDefault(); return pickAc(ac.idx); }
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); return closeAc(); }
  }
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); $('composer').requestSubmit(); }
  else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'Home' || ev.key === 'End') setTimeout(updateAc, 0);
});
// mousedown, not click: the textarea keeps focus.
$('msg-ac').addEventListener('mousedown', (ev) => { const li = ev.target.closest('[data-ac]'); if (!li) return; ev.preventDefault(); pickAc(Number(li.dataset.ac)); });

// Done auto-collapses when six columns don't fit: re-check when the window size changes.
let resizeT; addEventListener('resize', () => { if (ui.doneOpen) return; clearTimeout(resizeT); resizeT = setTimeout(() => { if (!$('app').hidden) render(); }, 200); });

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

export { boardView, checkOverwrites, older, render, selfMoves, settingsText, start };
