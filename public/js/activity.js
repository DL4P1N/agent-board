// Activity: the feed (event lines, Problems and Merges tabs, Load earlier), direct messages, mentions, file locks, the
// chat composer with @ autocomplete, and the live announcements of activity for screen readers.

import './tasks.js';
import { $, ANYONE, me, seenMention, setSeenMention, state, store, ui } from './state.js';
import { agentRoot, ago, canMove, esc, fmt, hs, isMe, mentionsLite, mentionsMe, patch, plural, reveal, short,
  taskById, timeEl, toast, who } from './helpers.js';
import { act, api, scheduleReload } from './data.js';
import { agentInfoNow, isLimited, roster } from './derived.js';
import { render } from './render.js';
import { selfMoves } from './topbar.js';
import { actionText, expandedEv, isAction, isChat, isLong } from './tasks.js';
import { oShow } from './boot.js';

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

export { ac, ACT_GAP, announceActivity, closeAc, dmUnreadCount, evHtml, growMsg, markDmSeen, older, openDm,
  renderFeed, renderLocks, setActGap, settingsText };
