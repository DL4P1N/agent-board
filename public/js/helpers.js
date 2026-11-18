// Small helpers for rendering: escaping (esc), links, people's names and colours, times, the message formatter (fmt),
// patch (only touch the DOM when the HTML changed), motion, toasts and screen-reader announcements.

import './state.js';
import { $, HUES, me, reduceMotion, STALE_MS, state } from './state.js';

// ---------- helpers ----------
// Links that come from GitHub or agents (CI runs, PRs) only become links when they're web addresses.
const isHttps = (u) => /^https:\/\//i.test(String(u || ''));
const isWebUrl = (u) => /^https?:\/\//i.test(String(u || ''));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// An agent's own name without its helper part: "dana-codex/ui" -> "dana-codex".
const agentRoot = (a) => String(a || '').split('/')[0].toLowerCase();
// The person behind a name. The server says who each connected agent belongs to (set here, recorded by
// join, or guessed); for other names (old events, helpers) the same guess: drop a tool ending
// ("-claude", "-codex2"…), else "<person>-<anything>" when that person is known.
const TOOL_SUFFIX = /-(claude|codex|copilot|copilotcli|copilot-vscode|copilot-cli)\d*$/;
let personCache = null;
function personMap() {
  if (personCache?.s === state && personCache.me === me) return personCache;
  const byAgent = new Map(); const known = new Set();
  for (const p of state.presence || []) {
    const n = String(p.name || '').toLowerCase(); const per = String(p.person || '').toLowerCase();
    if (p.kind === 'agent' && per) byAgent.set(n, per);
    if (per) known.add(per);
    if (p.kind === 'human' && n) known.add(n);
  }
  if (me) known.add(me);
  return (personCache = { s: state, me, byAgent, known, memo: new Map() });
}
const root = (a) => {
  const n = agentRoot(a); if (!n) return n;
  const pm = personMap();
  if (pm.byAgent.has(n)) return pm.byAgent.get(n);
  if (pm.memo.has(n)) return pm.memo.get(n);
  let r = n;
  if (TOOL_SUFFIX.test(n)) r = n.replace(TOOL_SUFFIX, '');
  else { const i = n.lastIndexOf('-'); if (i > 0 && pm.known.has(n.slice(0, i))) r = n.slice(0, i); }
  pm.memo.set(n, r);
  return r;
};
// Every person we know of: from presence (agents' people, humans), plus `me`.
const knownPeople = () => [...personMap().known].filter((n) => n && n !== 'board' && n !== 'anonymous').sort();
const sameTeam = (a, b) => !!a && !!b && root(a) === root(b);
const nameHash = (n) => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
// A person's colour comes from their name alone, so it never changes when someone else joins, and every
// screen agrees. Two people can share a colour: the initial in their People dot (.pdot) tells them apart.
const hue = (name) => HUES[nameHash(root(name)) % HUES.length];
const hs = (name) => `style="--h:${hue(name)}"`;
// A name that @mentions on click. inline=true (feed, question headers): clickable but no Tab stop of its own.
const who = (a, inline = false) => `<button type="button" class="link pc" ${hs(a)} data-mention="${esc(a)}" title="Click to @mention ${esc(a)} in chat"${inline ? ' tabindex="-1"' : ''}>${esc(a)}</button>`;
const FUNNEL = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return s < 6 * 86400 ? when(ts) : new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
// One time format everywhere: "4:00 PM" (or "16:00", by locale) today, "Tue 4:00 PM" on another day; full date only in tooltips.
const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const when = (ts) => new Date(ts).toDateString() === new Date().toDateString() ? clock(ts) : `${new Date(ts).toLocaleDateString([], { weekday: 'short' })} ${clock(ts)}`;
const fullTime = (ts) => new Date(ts).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const timeEl = (ts) => `<time datetime="${new Date(ts).toISOString()}" title="${esc(fullTime(ts))}">${Date.now() - ts < 3600e3 ? ago(ts) : clock(ts)}</time>`;
const isStale = (t) => ['claimed', 'in_progress'].includes(t.status) && (typeof t.stale === 'boolean' ? t.stale : Date.now() - t.updated_at > STALE_MS);
// The agent (laptop session) behind a task's owner is offline: other agents may take a stale task over.
const ownerOffline = (t) => { const n = agentRoot(t.assignee); if (!n) return false; const p = (state.presence || []).find((x) => x.kind === 'agent' && x.name === n); return !p || !p.online; };
const taskById = (id) => state.tasks.find((t) => t.id === id);
const BROADCAST = ['all', 'everyone', 'humans', 'here'];
// Only a direct @<my name> / @<my person> counts as a mention of me (it's counted and badged).
const isMe = (m) => { m = String(m || '').toLowerCase(); return !!me && (m === me || m === root(me)); };
const mentionsMe = (e) => !sameTeam(e.author, me) && (e.data?.mentions || []).some(isMe);
// Broadcasts (@all…) and messages to my own agents (@dana-codex) are only highlighted lightly.
const mentionsLite = (e) => !sameTeam(e.author, me) && !mentionsMe(e) && (e.data?.mentions || []).some((m) => BROADCAST.includes(m) || root(m) === root(me));
const short = (s, n = 90) => { s = String(s || '').replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// Escape-then-format: split raw text into tokens, escape each, linkify #ids and @names.
// inline=true: links get no Tab stop of their own (the feed would otherwise be dozens of stops).
function fmt(text, inline = false) {
  return String(text ?? '').split(/(https?:\/\/[^\s<>"']+|#\d+\b|@[\w.\-/]+)/g).map((p, i, all) => {
    if (i % 2 === 0) return esc(p);
    // "PR #12" / "issue #5" point at GitHub, not at board task #12.
    if (p[0] === '#' && /(?:\bPRs?|\bpull(?:\s+request)?|\bissues?|!)\s?$/i.test(all[i - 1] || '')) return esc(p);
    if (/^https?:/i.test(p)) {
      const url = p.replace(/[.,;:!?)\]]+$/, ''); const trail = p.slice(url.length);
      return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"${inline ? ' tabindex="-1"' : ''}>${esc(url)}</a>${esc(trail)}`;
    }
    if (p[0] === '#') { const t = taskById(Number(p.slice(1))); return t ? `<button type="button" class="link tref" data-open-task="${t.id}" title="${esc(t.title)}"${inline ? ' tabindex="-1"' : ''}>${esc(p)}</button>` : esc(p); }
    const name = p.slice(1);
    return `<span class="at ${isMe(name) ? 'me' : ''}">${esc(p)}</span>`;
  }).join('');
}

// Replace a container's HTML without losing what the user is typing or where focus is.
// Inputs carry data-keep="<stable key>", focusable items data-fk="<stable key>".
function patch(el, html) {
  if (el._html === html) return false;
  const kept = {}; let focusKey = null; let sel = null;
  const active = document.activeElement;
  el.querySelectorAll('[data-keep]').forEach((n) => { kept[n.dataset.keep] = n.value; });
  if (active && el.contains(active)) {
    focusKey = active.dataset.keep || active.dataset.fk || null;
    if (active.dataset.keep) try { sel = [active.selectionStart, active.selectionEnd]; } catch {}
  }
  el.innerHTML = html; el._html = html;
  el.querySelectorAll('[data-keep]').forEach((n) => { if (n.dataset.keep in kept) n.value = kept[n.dataset.keep]; });
  if (focusKey) {
    const n = el.querySelector(`[data-keep="${CSS.escape(focusKey)}"],[data-fk="${CSS.escape(focusKey)}"]`);
    if (n) { n.focus({ preventScroll: true }); if (sel) try { n.setSelectionRange(sel[0], sel[1]); } catch {} }
  }
  return true;
}

// ---------- motion: short, one-shot, and off under reduced motion ----------
// Durations and the curve match --t-base / --t-slow / --ease in the stylesheet.
const EASE = 'cubic-bezier(.2, .7, .2, 1)';
const canMove = () => !reduceMotion() && !document.hidden && typeof Element.prototype.animate === 'function';
// Something new arrives: a short fade and a few pixels of travel.
function reveal(n, dy = -4) { if (n && canMove()) n.animate([{ opacity: 0, transform: `translateY(${dy}px)` }, { opacity: 1, transform: 'none' }], { duration: 180, easing: EASE }); }
// Where every card is on screen right now (mid-animation included, so a second move starts from where the card is).
function cardRects() {
  const m = new Map();
  for (const c of $('board').querySelectorAll('.card')) m.set(c.dataset.id, { r: c.getBoundingClientRect(), col: c.closest('.col')?.dataset.status });
  return m;
}
// After the board re-rendered: cards glide from where they were to where they are now; one that changed
// column gets a ring that fades, a new one fades in. A big reshuffle (filter, resize) just snaps.
function moveCards(before) {
  const jobs = [];
  for (const c of $('board').querySelectorAll('.card')) {
    const b = before.get(c.dataset.id);
    if (!b) { jobs.push([c, null]); continue; }
    const r = c.getBoundingClientRect(); const dx = b.r.left - r.left; const dy = b.r.top - r.top;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) jobs.push([c, { dx, dy, col: b.col !== c.closest('.col')?.dataset.status }]);
  }
  if (!jobs.length || jobs.length > 24) return;
  const ring = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  for (const [c, j] of jobs) {
    if (!j) { reveal(c, 6); continue; }
    c.animate([{ transform: `translate(${j.dx}px, ${j.dy}px)` }, { transform: 'none' }], { duration: j.col ? 260 : 200, easing: EASE });
    if (j.col) c.animate([{ outline: `2px solid ${ring}`, outlineOffset: '1px' }, { outline: '2px solid transparent', outlineOffset: '1px' }], { duration: 900, easing: 'ease-out' });
  }
}

// action: { label, run } adds a button (e.g. Undo); such toasts stay a little longer.
function toast(msg, bad = false, action = null) {
  const d = document.createElement('div');
  d.className = 'toast' + (bad ? ' bad' : '');
  const s = document.createElement('span'); s.textContent = msg; d.append(s);
  if (action) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label;
    b.onclick = () => { d.remove(); action.run(); }; d.append(b);
  }
  if (bad) d.setAttribute('role', 'alert');
  $('toasts').append(d);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  setTimeout(() => {
    if (!d.isConnected || reduceMotion()) return d.remove();
    d.classList.add('out'); setTimeout(() => d.remove(), 140);
  }, bad ? 7000 : action ? 8000 : 3500);
}
function announce(msg) { const a = $('announcer'); a.textContent = ''; setTimeout(() => { a.textContent = msg; }, 60); }

const plural = (n, w, ws = w + 's') => `${n} ${n === 1 ? w : ws}`;
const cmdBox = (text, key, what) => `<div class="cmd"><code>${esc(text)}</code><button type="button" class="ghost" data-copy="${esc(text)}" data-fk="cp-${key}" aria-label="Copy ${esc(what)}">Copy</button></div>`;
const nameTag = (n) => `<b class="pc" ${hs(n)}>${esc(n)}</b>`;
// " (you)" after my own name, unless my name already says it.
const youTag = (n) => (n === me && String(n).toLowerCase() !== 'you' ? ' (you)' : '');

export { agentRoot, ago, announce, canMove, cardRects, clock, cmdBox, esc, fmt, fullTime, FUNNEL, hs, hue, isHttps,
  isMe, isStale, isWebUrl, knownPeople, mentionsLite, mentionsMe, moveCards, nameHash, nameTag, ownerOffline, patch,
  plural, reveal, root, short, taskById, timeEl, toast, when, who, youTag };
