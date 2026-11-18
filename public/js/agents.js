// The Agents panel, one component for both views: a row per agent with its state in words, its tool and model, its
// subagents, and the controls under a picked agent.

import './setup.js';
import { $, ACTIVE, ANYONE, HOLDING, LABEL, me, state, ui } from './state.js';
import { agentRoot, ago, esc, FUNNEL, hs, isStale, patch, root, short, taskById, youTag } from './helpers.js';
import { agentInfo, agentsLine, agentState, capText, capTip, filterRoot, isLimited, limitText, notStartedText,
  openQuestions, people, startCmd } from './derived.js';
import { teamCapHtml } from './setup.js';
import { boardView } from './office.js';

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
  }).join('') : '<li class="empty-note">No agents yet. When a teammate\'s AI agent connects, it appears here with what it\'s working on.</li>');

}

// More rows below the Agents panel's edge: its foot fades, so a cut row reads as "more", not as a fragment.
function fadeAgents() {
  const b = $('o-agents'); b.classList.toggle('more-below', b.scrollHeight - b.scrollTop - b.clientHeight > 2); b.classList.toggle('more-above', b.scrollTop > 2);
  const t = $('tabs'); t.classList.toggle('more-right', t.scrollWidth - t.scrollLeft - t.clientWidth > 2);
}
$('o-agents').addEventListener('scroll', fadeAgents, { passive: true });
$('tabs').addEventListener('scroll', fadeAgents, { passive: true });
addEventListener('resize', () => requestAnimationFrame(fadeAgents));

export { fadeAgents, officeState, renderAgents };
