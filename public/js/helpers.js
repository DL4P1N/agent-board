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
function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return s < 6 * 86400 ? when(ts) : new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
// One time format everywhere: "4:00 PM" (or "16:00", by locale) today, "Tue 4:00 PM" on another day; full date only in tooltips.
// The locale formatting is slow and a feed shows hundreds of times: each string is made once per timestamp.
const memoTs = (f) => { const m = new Map(); return (ts) => { let v = m.get(ts); if (v === undefined) { if (m.size > 4000) m.clear(); v = f(ts); m.set(ts, v); } return v; }; };
const clock = memoTs((ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
const weekday = memoTs((ts) => new Date(ts).toLocaleDateString([], { weekday: 'short' }));
let today = { at: 0, start: 0 };
const todayStart = () => { const n = Date.now(); if (n - today.at > 30e3) { const d = new Date(n); d.setHours(0, 0, 0, 0); today = { at: n, start: d.getTime() }; } return today.start; };
const when = (ts) => { const d = todayStart(); return ts >= d && ts < d + 86400e3 ? clock(ts) : `${weekday(ts)} ${clock(ts)}`; };
const fullTime = memoTs((ts) => new Date(ts).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
// "5m ago" within the hour, the clock time after. A <time> keeps its timestamp (data-ts), so refreshTimes() can move
// its words on in place instead of drawing the line again.
const timeText = (ts) => (Date.now() - ts < 3600e3 ? ago(ts) : clock(ts));
const timeOpen = memoTs((ts) => `<time datetime="${new Date(ts).toISOString()}" data-ts="${ts}" title="${esc(fullTime(ts))}">`);
const timeEl = (ts) => `${timeOpen(ts)}${timeText(ts)}</time>`;
function refreshTimes(root) { for (const t of root.querySelectorAll('time[data-ts]')) { const s = timeText(Number(t.dataset.ts)); if (t.textContent !== s) t.textContent = s; } }
// Set an element's text only when it changes (a same-value write still makes the browser lay the page out again).
const setText = (el, s) => { s = String(s ?? ''); if (el && el.textContent !== s) el.textContent = s; };
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

// Escape-then-format: split raw text into tokens, escape each, linkify #ids and @names. A pull request's address
// reads "PR #49" (the address is its tooltip).
// inline=true (the feed): its #id links get no Tab stop of their own (the feed would otherwise be dozens of stops);
// web links always do.
function fmt(text, inline = false) {
  return String(text ?? '').split(/(https?:\/\/[^\s<>"']+|#\d+\b|@[\w.\-/]+)/g).map((p, i, all) => {
    if (i % 2 === 0) return esc(p);
    // "PR #12" / "issue #5" point at GitHub, not at board task #12.
    if (p[0] === '#' && /(?:\bPRs?|\bpull(?:\s+request)?|\bissues?|!)\s?$/i.test(all[i - 1] || '')) return esc(p);
    if (/^https?:/i.test(p)) {
      const url = p.replace(/[.,;:!?)\]]+$/, ''); const trail = p.slice(url.length);
      const pr = /^https?:\/\/[^/]+\/[^/]+\/[^/]+\/pull\/(\d+)(?:[/?#].*)?$/i.exec(url);
      return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"${pr ? ` title="${esc(url)}"` : ''}>${pr ? `PR #${pr[1]}` : esc(url)}</a>${esc(trail)}`;
    }
    if (p[0] === '#') { const t = taskById(Number(p.slice(1))); return t ? `<button type="button" class="link tref" data-open-task="${t.id}" title="${esc(t.title)}"${inline ? ' tabindex="-1"' : ''}>${esc(p)}</button>` : esc(p); }
    const name = p.slice(1);
    return `<span class="at ${isMe(name) ? 'me' : ''}">${esc(p)}</span>`;
  }).join('');
}

// A field that also has data-draft (the goal and demo time popovers, Setup's step 2) keeps what was typed when its form
// goes unsaved (dismissed, Setup closed): it comes back when the form is drawn again, until saved or cancelled (dropDrafts).
const drafts = new Map();
function stashDrafts(el) { el?.querySelectorAll('[data-draft][data-keep]').forEach((n) => { if (n.value !== n.defaultValue) drafts.set(n.dataset.keep, n.value); else drafts.delete(n.dataset.keep); }); }
function dropDrafts(el) { el?.querySelectorAll('[data-draft][data-keep]').forEach((n) => { drafts.delete(n.dataset.keep); n.removeAttribute('data-draft'); }); }
const hasDraft = (key) => drafts.has(key);
// Replace a container's HTML without losing what the user is typing or where focus is.
// Inputs carry data-keep="<stable key>", focusable items data-fk="<stable key>".
function patch(el, html) {
  if (el._html === html) return false;
  const kept = {}; let focusKey = null; let sel = null;
  const active = document.activeElement;
  stashDrafts(el);
  el.querySelectorAll('[data-keep]').forEach((n) => { kept[n.dataset.keep] = n.value; });
  if (active && el.contains(active)) {
    focusKey = active.dataset.keep || active.dataset.fk || null;
    if (active.dataset.keep) try { sel = [active.selectionStart, active.selectionEnd]; } catch {}
  }
  el.innerHTML = html; el._html = html;
  el.querySelectorAll('[data-keep]').forEach((n) => { const k = n.dataset.keep; if (k in kept) n.value = kept[k]; else if ('draft' in n.dataset && drafts.has(k)) n.value = drafts.get(k); });
  if (focusKey) {
    const n = el.querySelector(`[data-keep="${CSS.escape(focusKey)}"],[data-fk="${CSS.escape(focusKey)}"]`);
    if (n) { n.focus({ preventScroll: true }); if (sel) try { n.setSelectionRange(sel[0], sel[1]); } catch {} }
  }
  return true;
}

/// ---------- motion: short, one-shot, and off under reduced motion ----------
// Durations and the curve are the stylesheet's tokens (--t-fast, --t-base, --t-slow, --ease in tokens.css), read once.
let tokens = null;
function motion() {
  if (tokens) return tokens;
  const cs = getComputedStyle(document.documentElement);
  const ms = (n, d) => { const v = cs.getPropertyValue(n).trim(), x = parseFloat(v); return Number.isFinite(x) ? (/ms$/.test(v) ? x : x * 1000) : d; };
  const t = { fast: ms('--t-fast', 100), base: ms('--t-base', 160), slow: ms('--t-slow', 240), ease: cs.getPropertyValue('--ease').trim() || 'ease-out' };
  if (cs.getPropertyValue('--t-slow').trim()) tokens = t; // the stylesheet is in: keep them
  return t;
}
const canMove = () => !reduceMotion() && !document.hidden && typeof Element.prototype.animate === 'function';
// Something new arrives: a short fade and a few pixels of travel.
function reveal(n, dy = -4) { if (n && canMove()) n.animate([{ opacity: 0, transform: `translateY(${dy}px)` }, { opacity: 1, transform: 'none' }], { duration: motion().base, easing: motion().ease }); }
// Something leaves a list: the removed element (no longer in the page) fades out where it was, out of the flow, so
// what stays can glide into its place. r: where it was; host: a positioned box it was inside.
function leave(n, r, host) {
  if (!n || !r?.width || !host || !canMove()) return;
  pinCopy(n, r, host);
  n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: motion().fast, easing: motion().ease, fill: 'forwards' }).finished.then(() => n.remove(), () => n.remove());
}
// Something that has gone (or a copy of it), out of the flow at the place r it had inside host (a positioned box):
// seen, never read out, focused or clicked.
function pinCopy(n, r, host) {
  const h = host.getBoundingClientRect();
  for (const e of [n, ...n.querySelectorAll('[id], [data-id], [data-fk], [data-keep]')]) for (const a of ['id', 'data-id', 'data-fk', 'data-keep']) e.removeAttribute(a);
  n.classList.add('leaving'); n.setAttribute('aria-hidden', 'true'); n.inert = true;
  Object.assign(n.style, { position: 'absolute', margin: '0', left: `${r.left - h.left + host.scrollLeft - host.clientLeft}px`, top: `${r.top - h.top + host.scrollTop - host.clientTop}px`,
    width: `${r.width}px`, height: `${r.height}px`, pointerEvents: 'none', zIndex: '1' });
  host.append(n);
}
// Moves made on this page (Move…, a drag, Undo): only those get the ring, so agents' moves on a live board don't flash
// the accent every few seconds. A dragged card is already where it was dropped: it doesn't slide there again.
const localMoves = new Map(); // task id -> { at, glide }
function noteMove(id, { glide = true } = {}) { localMoves.set(String(id), { at: Date.now(), glide }); }
// Opening or closing something inside the board (Done, a card's Move… menu or reject form) snaps, like switching
// Columns / Table: what render() does inside snapCards() moves no card.
let snapping = false;
function snapCards(fn) { snapping = true; try { return fn(); } finally { snapping = false; } }
// Where every card is on screen right now (mid-animation included, so a second move starts from where the card is).
function cardRects() {
  if (snapping) return null;
  const m = new Map();
  for (const c of $('board').querySelectorAll('.card:not(.leaving)')) m.set(c.dataset.id, { r: c.getBoundingClientRect(), col: c.closest('.col')?.dataset.status, el: c });
  return m;
}
// After the board re-rendered: cards glide from where they were to where they are now; one moved to another column on
// this page gets a ring that fades, a new one fades in, one that went (rejected, cancelled) fades out where it was.
// A big reshuffle just snaps.
function moveCards(before) {
  const jobs = [], now = new Set();
  for (const c of $('board').querySelectorAll('.card:not(.leaving)')) {
    now.add(c.dataset.id);
    const b = before.get(c.dataset.id);
    if (!b) { jobs.push([c, null]); continue; }
    const r = c.getBoundingClientRect(); const dx = b.r.left - r.left; const dy = b.r.top - r.top;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) jobs.push([c, { dx, dy, col: b.col !== c.closest('.col')?.dataset.status }]);
  }
  const gone = [...before.entries()].filter(([id, b]) => !now.has(id) && !b.el.isConnected && !taskById(Number(id))); // off the board, not filtered out
  if (jobs.length > 48) return;
  const { slow, ease } = motion();
  const ring = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  for (const [id, m] of localMoves) if (Date.now() - m.at > 10e3) localMoves.delete(id);
  if (gone.length <= 2) for (const [, b] of gone) leave(b.el, b.r, $('board'));
  for (const [c, j] of jobs) {
    if (!j) { reveal(c, 6); continue; }
    const mine = j.col && localMoves.get(c.dataset.id); if (mine) localMoves.delete(c.dataset.id);
    if (!mine || mine.glide) c.animate([{ transform: `translate(${j.dx}px, ${j.dy}px)` }, { transform: 'none' }], { duration: slow, easing: ease });
    if (mine) c.animate([{ outline: `2px solid ${ring}`, outlineOffset: '1px' }, { outline: '2px solid transparent', outlineOffset: '1px' }], { duration: slow * 4, easing: ease });
  }
}
// Panels folding and opening, the Tasks window sliding, Setup opening: apply() makes the change, and the boxes it
// resizes or pushes move from where they were to where they are now, in step, at --t-slow; their neighbours follow
// through the layout, so nothing jumps and nothing snaps at the end.
//   size: boxes whose height may change (every panel of a column: one folds, the others give or take its room)
//   pin:  [panel, body] for the panel that folds or opens: its body keeps its open height (clipped, not squeezed) and
//         stays shown (.o-moving) until the panel has landed
//   move: boxes that are only pushed (they slide from their old place)
//   open: a box that appears above the pushed ones: it is uncovered from the top down as they slide away; or one that
//         goes: a copy of it stays where it was and is covered from the bottom up as they slide back
// A second change mid-way starts from where things are. With reduced motion it's instant. The promise resolves when
// everything has landed (false if a newer change took over).
function glide(apply, { size = [], pin = null, move = [], open = null } = {}) {
  size = size.filter(Boolean); move = move.filter(Boolean);
  const [pp, pb] = pin || [];
  const all = [...size, ...move, pb].filter(Boolean);
  // Stop what is moving here (a panel interrupted mid-fold lands at once; its height animates on from where it was).
  const stop = () => { for (const e of all) { for (const a of e.getAnimations({ subtree: true })) if (a.id === 'glide') a.cancel(); e.classList.remove('o-moving'); } };
  if (!canMove()) { stop(); apply(); return Promise.resolve(true); }
  const h0 = size.map((e) => e.getBoundingClientRect().height), y0 = move.map((e) => e.getBoundingClientRect().top), o0 = open?.offsetHeight;
  const bh0 = pb ? pb.getBoundingClientRect().height : 0;
  const shut = o0 ? [open.cloneNode(true), open.getBoundingClientRect()] : null; // taken before apply() empties it
  stop();
  apply();
  const h1 = size.map((e) => e.getBoundingClientRect().height), y1 = move.map((e) => e.getBoundingClientRect().top);
  // Opening: the body's height once open, measured now (the panel is still drawn at its folded height until it animates).
  const bh1 = pb ? pb.getBoundingClientRect().height : 0;
  const { slow: duration, ease: easing } = motion(), o = { duration, easing, id: 'glide' };
  const box = (h) => ({ height: `${h}px`, minHeight: '0px', maxHeight: 'none', flexGrow: 0, flexShrink: 0, flexBasis: 'auto', overflow: 'hidden' });
  const anims = [];
  size.forEach((e, i) => { if (Math.abs(h0[i] - h1[i]) > 1) anims.push(e.animate([box(h0[i]), box(h1[i])], o)); });
  move.forEach((e, i) => { if (Math.abs(y0[i] - y1[i]) > 1) anims.push(e.animate([{ transform: `translateY(${y0[i] - y1[i]}px)` }, { transform: 'none' }], o)); });
  if (open && !o0 && open.offsetHeight && anims.length) anims.push(open.animate([{ clipPath: 'inset(0 -8px 100% -8px)' }, { clipPath: 'inset(0 -8px -8px -8px)' }], o)); // its shadow included
  if (shut && !open.offsetHeight && anims.length && open.parentElement) {
    const [copy, r] = shut; pinCopy(copy, r, open.parentElement);
    const a = copy.animate([{ clipPath: 'inset(0 -8px -8px -8px)' }, { clipPath: 'inset(0 -8px 100% -8px)' }], { ...o, fill: 'forwards' });
    a.finished.then(() => copy.remove(), () => copy.remove()); anims.push(a);
  }
  if (!anims.length) return Promise.resolve(true);
  const tok = {};
  if (pp) {
    const keep = { height: `${Math.max(bh0, bh1)}px`, flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }; // folding: as it was; opening: as it will be
    pp.classList.add('o-moving'); pp._glide = tok;
    anims.push(pb.animate([keep, keep], o));
  }
  return Promise.all(anims.map((a) => a.finished)).then(() => { if (pp?._glide === tok) pp.classList.remove('o-moving'); return true; }, () => false);
}
// A box whose content just changed grows or shrinks from its old height h0 to its new one, its content clipped meanwhile
// (Needs attention when a question arrives or is answered: what is under it moves in step). Returns the animation.
function easeHeight(el, h0) {
  const h1 = el.getBoundingClientRect().height;
  if (!canMove() || Math.abs(h0 - h1) <= 1) return null;
  const { slow: duration, ease: easing } = motion();
  const box = (h) => ({ height: `${h}px`, minHeight: '0px', maxHeight: 'none', flexGrow: 0, flexShrink: 0, flexBasis: 'auto', overflow: 'hidden' });
  return el.animate([box(h0), box(h1)], { duration, easing, id: 'glide' });
}
// The whole page changes look at once (a theme, the 3D switch): no colour or border transitions while it applies.
function instantly(fn) {
  const h = document.documentElement; h.classList.add('no-tx');
  try { fn(); } finally { requestAnimationFrame(() => requestAnimationFrame(() => h.classList.remove('no-tx'))); }
}

// action: { label, run } adds a button (e.g. Undo); such toasts stay a little longer. Every toast leaves the same way
// (.out: a short fade), whether its time is up, its button was pressed or newer ones pushed it out.
function toastOut(d) {
  if (!d.isConnected || d.classList.contains('out')) return;
  if (reduceMotion()) return d.remove();
  d.classList.add('out'); setTimeout(() => toastsShift(() => d.remove()), motion().fast + 20);
}
// A toast arriving or going moves the others: they slide to their new places in step (translate, so a toast's own
// fade in or out, a transform, runs on).
function toastsShift(fn) {
  const box = $('toasts');
  if (!canMove()) return fn();
  const was = [...box.children].map((t) => [t, t.getBoundingClientRect().top]);
  fn();
  const { slow: duration, ease: easing } = motion();
  for (const [t, y] of was) {
    if (!t.isConnected) continue;
    for (const a of t.getAnimations()) if (a.id === 'push') a.cancel();
    const dy = y - t.getBoundingClientRect().top;
    if (Math.abs(dy) > 1) t.animate([{ translate: `0 ${dy}px` }, { translate: '0 0' }], { duration, easing, id: 'push' });
  }
}
// The room the toasts take at the foot of the screen (their height and the gap below), for the page to leave free.
if ('ResizeObserver' in window) {
  const box = $('toasts');
  new ResizeObserver(() => document.documentElement.style.setProperty('--toast-room', box.offsetHeight ? Math.ceil(box.offsetHeight + parseFloat(getComputedStyle(box).bottom)) + 'px' : '0px')).observe(box);
}
function toast(msg, bad = false, action = null) {
  const d = document.createElement('div');
  d.className = 'toast' + (bad ? ' bad' : '');
  const s = document.createElement('span'); s.textContent = msg; d.append(s);
  if (action) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label;
    b.onclick = () => { toastOut(d); action.run(); }; d.append(b);
  }
  if (bad) d.setAttribute('role', 'alert');
  toastsShift(() => $('toasts').append(d));
  const shown = [...$('toasts').children].filter((t) => !t.classList.contains('out'));
  shown.slice(0, Math.max(0, shown.length - 3)).forEach(toastOut);
  // A toast with a button (Undo) waits while the pointer or focus is on it, then gets its time again.
  const ms = bad ? 7000 : action ? 8000 : 3500;
  let t = setTimeout(() => toastOut(d), ms);
  if (action) {
    const hold = () => clearTimeout(t), go = () => { clearTimeout(t); if (!d.matches(':hover, :focus-within')) t = setTimeout(() => toastOut(d), ms); };
    d.addEventListener('mouseenter', hold); d.addEventListener('focusin', hold);
    d.addEventListener('mouseleave', go); d.addEventListener('focusout', () => setTimeout(go));
  }
  // A modal dialog (Help, a task) hides the page's live regions from screen readers: say it inside the dialog too.
  const dlg = [...document.querySelectorAll('dialog[open]')].pop();
  if (dlg) { let l = dlg.querySelector(':scope > .dlg-live'); if (!l) { l = document.createElement('div'); l.className = 'vh dlg-live'; l.setAttribute('aria-live', bad ? 'assertive' : 'polite'); dlg.append(l); } l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 60); }
}
function announce(msg) { const a = $('announcer'); a.textContent = ''; setTimeout(() => { a.textContent = msg; }, 60); }

const plural = (n, w, ws = w + 's') => `${n} ${n === 1 ? w : ws}`;
const cmdBox = (text, key, what) => `<div class="cmd"><code>${esc(text)}</code><button type="button" class="ghost" data-copy="${esc(text)}" data-fk="cp-${key}" aria-label="Copy ${esc(what)}">Copy</button></div>`;
const nameTag = (n) => `<b class="pc" ${hs(n)}>${esc(n)}</b>`;
// " (you)" after my own name, unless my name already says it.
const youTag = (n) => (n === me && String(n).toLowerCase() !== 'you' ? ' (you)' : '');
// Where focus is now, to come back to after a dialog: that element, or the same card when a live update redrew it
// meanwhile (the old element is gone, and focus would otherwise land on the page).
function focusMark() {
  const a = document.activeElement; const id = a?.closest?.('.card[data-id]')?.dataset.id;
  return () => {
    if (a?.isConnected) return a.focus({ preventScroll: true });
    if (id) document.querySelector(`.card[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  };
}
// After a dialog closed: focus back if it is on the page or still in the dialog, now and again once its fade has
// finished (while it fades, what's behind it can't always take focus). The close event comes a task after close():
// focus already moved elsewhere by then (a click, a key, the browser putting it back) stays where it is.
function refocusAfter(dlg, back) {
  if (!back) return;
  const lost = () => { const a = document.activeElement; return !a || a === document.body || dlg.contains(a); };
  // Only the latest close of this dialog hands focus back: an earlier one still waiting on its fade gives up.
  const turn = dlg._refocus = (dlg._refocus || 0) + 1;
  const stale = () => dlg.open || dlg._refocus !== turn;
  if (stale()) return;
  if (lost()) back();
  // A closing dialog can stay in the top layer (and keep the page inert) a little past its fade: try each frame for a while.
  const again = (n = 30) => { if (stale() || !lost()) return; back(); if (lost() && n > 0) requestAnimationFrame(() => again(n - 1)); };
  const fade = dlg.getAnimations();
  if (fade.length) Promise.all(fade.map((x) => x.finished.catch(() => {}))).then(() => again()); else setTimeout(() => again());
}

export { agentRoot, ago, announce, canMove, cardRects, clock, cmdBox, dropDrafts, easeHeight, esc, fmt, focusMark, fullTime, glide, hasDraft, hs, hue,
  instantly, isHttps, isMe, isStale, isWebUrl, knownPeople, leave, mentionsLite, mentionsMe, motion, moveCards, nameHash,
  nameTag, noteMove, ownerOffline, patch, plural, refocusAfter, refreshTimes, reveal, root, setText, short, snapCards, stashDrafts, taskById, timeEl,
  toast, when, who, youTag };
