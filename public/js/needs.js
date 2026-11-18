// Needs attention: the header's count badge, What to do now (the single most important thing for you) and the
// questions agents are waiting on.

import './render.js';
import { $, ALL_PHASES, ANYONE, me, oUi, state, ui } from './state.js';
import { ago, esc, fmt, fullTime, patch, plural, root, short, taskById, who } from './helpers.js';
import { agentInfoNow, agentOf, approvalWait, blockedSplit, bouncedTasks, cutTasks, dlSkipped, setupShown,
  teamCapacity, timeNow } from './derived.js';

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

export { nowSeen, renderNeeds, renderNow, renderQuestions, setNowSeen, syncNeeds };
