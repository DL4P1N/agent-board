// Talking to the server: api() and act(), the sign-in gate, an unavailable board (archived, moved, token rotated),
// load() for /api/state, and the live stream (/api/stream) that triggers it.

import './helpers.js';
import { $, BASE, DEFAULT_SETTINGS, me, setMe, setState, setToken, SLUG, state, store, token } from './state.js';
import { esc, knownPeople, toast } from './helpers.js';
import { render } from './render.js';
import { selfMoves } from './topbar.js';
import { older } from './activity.js';
import { checkOverwrites } from './task-dialog.js';
import { start } from './boot.js';

// A page that held a working token gets a 401: the host rotated the token or started a fresh board.
const TOKEN_CHANGED = 'The board\'s link changed. Ask the host for the new link.';
// Only a 401 that says the token was rotated means the link changed; any other 401 is a token the board doesn't know.
const TOKEN_REJECTED = 'That token was rejected. Ask the host for the board link.';
const tokenError = (body) => (body?.reason === 'token_rotated' ? TOKEN_CHANGED : TOKEN_REJECTED);
let savingN = 0;
function savingCount(d) { savingN = Math.max(0, savingN + d); $('conn').toggleAttribute('data-saving', savingN > 0); }
async function api(path, opts = {}) {
  let r;
  if (opts.method === 'PATCH' && /^\/tasks\/\d+$/.test(path)) { try { const b = JSON.parse(opts.body); if (b.status) selfMoves.set(Number(path.split('/')[2]), { status: b.status, ts: Date.now() }); } catch {} }
  // A slow save (bad wifi): the header says "Saving…" until the server answers.
  let slowOn = false; const slow = opts.method && opts.method !== 'GET' ? setTimeout(() => { slowOn = true; savingCount(1); }, 700) : 0;
  try {
    // no-store: a 410 (archived) is cacheable by default, so a restored board would still look archived.
    r = await fetch(BASE + '/api' + path, { cache: 'no-store', ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'X-Agent': me, ...(opts.headers || {}) } });
  } catch { throw new Error('Cannot reach the board server. Is it still running?'); }
  finally { clearTimeout(slow); if (slowOn) savingCount(-1); }
  const body = await r.json().catch(() => ({}));
  if (unavailableStatus(r.status, body)) throw new Error('Token rejected');
  if (r.status === 401) { showGate(tokenError(body)); throw new Error('Token rejected'); }
  if (!r.ok) throw new Error(body.error || r.statusText || 'Request failed');
  return body;
}
// The board itself isn't available: archived (410), moved to its own address (409), or its data
// couldn't be opened (503). Shows the matching page and returns true.
function unavailableStatus(status, body = {}) {
  if (status === 410) { showUnavailable('archived'); return true; }
  if (status === 409 && body.moved_to) { showUnavailable('moved', body.moved_to); return true; }
  if (status === 503) { showUnavailable('failed', body.error || 'unknown error'); return true; }
  return false;
}
async function act(promise, okMsg) {
  try { const r = await promise; if (okMsg) toast(okMsg); scheduleReload(); return r; }
  catch (e) { toast(e.message, true); throw e; }
}

// ---------- gate ----------
// The board isn't available (archived, moved, failed to open): say so instead of retrying the live
// stream, and check quietly every few seconds so the page comes back by itself (restored, default
// switched back, data fixed) without a reload.
let unavailable = null; let recoverTimer = null;
const UNAVAILABLE = ['archived', 'moved', 'failed'];
function showUnavailable(kind, info = '') {
  es?.close(); esOpen = false; unavailable = kind;
  $('app').hidden = true; $('gate').hidden = true;
  for (const id of UNAVAILABLE) $(id).hidden = id !== kind;
  const name = state?.board?.name || SLUG || 'this board';
  if (kind === 'archived') { $('arch-name').textContent = name; document.title = `Archived · ${SLUG ? name + ' · ' : ''}Agent Board`; }
  if (kind === 'moved') {
    const to = String(info).replace(/\/+$/, '');
    const url = new URL(to + '/', location.origin); url.searchParams.set('token', token); if (me) url.searchParams.set('name', me);
    $('moved-link').textContent = new URL(to + '/', location.origin).href; $('moved-link').href = url.href; $('moved-open').href = url.href;
    document.title = 'Board moved · Agent Board';
  }
  if (kind === 'failed') { $('failed-msg').textContent = String(info).replace(/^(This|The default) board failed to open:\s*/i, ''); document.title = `Couldn't open · ${SLUG ? name + ' · ' : ''}Agent Board`; }
  clearInterval(recoverTimer); recoverTimer = setInterval(tryRecover, 4000);
}
async function tryRecover() {
  if (!unavailable || !token) return;
  let r; try { r = await fetch(BASE + '/api/state', { cache: 'no-store', headers: { Authorization: 'Bearer ' + token } }); } catch { return; }
  const body = await r.clone().json().catch(() => ({}));
  if (r.ok) {
    clearInterval(recoverTimer); recoverTimer = null; unavailable = null;
    for (const id of UNAVAILABLE) $(id).hidden = true;
    $('app').hidden = false; await load(); if (!unavailable) connect();
    return toast('The board is back.');
  }
  if (r.status === 401) { clearInterval(recoverTimer); unavailable = null; for (const id of UNAVAILABLE) $(id).hidden = true; return showGate(tokenError(body)); }
  const kind = r.status === 410 ? 'archived' : r.status === 409 ? 'moved' : r.status === 503 ? 'failed' : null;
  if (kind && kind !== unavailable) unavailableStatus(r.status, body);
}
function showGate(err = '') {
  clearInterval(recoverTimer); unavailable = null; for (const id of UNAVAILABLE) $(id).hidden = true;
  $('app').hidden = true; $('gate').hidden = false;
  $('g-token').value = token; $('g-name').value = me; $('g-err').textContent = err;
  (token ? $('g-name') : $('g-token')).focus();
  gateNames();
}
// Names already on the board, offered in the name box, so people pick theirs instead of typing a new one.
async function gateNames() {
  let names = (state.presence || []).length ? knownPeople() : [];
  const t = $('g-token').value.trim() || token;
  if (!names.length && t) {
    try {
      const r = await fetch(BASE + '/api/state', { cache: 'no-store', headers: { Authorization: 'Bearer ' + t } });
      if (r.ok) { const st = await r.json(); names = [...new Set((st.presence || []).map((p) => String(p.person || p.name || '').toLowerCase()).filter((n) => n && n !== 'board' && n !== 'anonymous'))].sort(); }
    } catch {}
  }
  const html = names.map((n) => `<option value="${esc(n)}"></option>`).join('');
  if ($('g-names').innerHTML !== html) $('g-names').innerHTML = html;
}
$('g-token').addEventListener('change', gateNames);
$('gate').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const t = $('g-token').value.trim(); const n = $('g-name').value.trim().toLowerCase().replace(/[^\w.\-]/g, '');
  if (!t) { $('g-err').textContent = 'Enter the board token.'; return $('g-token').focus(); }
  if (!n) { $('g-err').textContent = 'Enter your name (letters, numbers, . - _).'; return $('g-name').focus(); }
  const r = await fetch(BASE + '/api/state', { cache: 'no-store', headers: { Authorization: 'Bearer ' + t } }).catch(() => null);
  if (!r) { $('g-err').textContent = 'Cannot reach the board server. Is it still running?'; return; }
  if (r.status === 410 || r.status === 409 || r.status === 503) { setToken(t); setMe(n); const body = await r.json().catch(() => ({})); return unavailableStatus(r.status, body); }
  if (r.status === 401) { const b = await r.json().catch(() => ({})); $('g-err').textContent = tokenError(b); return $('g-token').focus(); }
  setToken(t); setMe(n); store.set('board-token', token); store.set('board-name', me);
  start();
});
$('me-btn').onclick = () => showGate();

// ---------- data ----------
async function load() {
  try {
    const s = await api('/state');
    s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
    s.presence = s.presence || []; s.phase = s.phase || (s.tasks.length ? 'building' : 'needs_goal');
    if (older.keep && s.events?.length) s.events = await keepOlder(s.events);
    checkOverwrites(s);
    setState(s); state.loaded = true; setConn(esOpen ? 'live' : 'connecting'); render();
  }
  catch (e) { if (e.message !== 'Token rejected') setConn('down', e.message); }
}
function setLoad(f) { load = f; } // tests stub load out (through window, see boot.js)
// Earlier pages are loaded (older.keep): put them in front of the latest events. If more events arrived
// since the last reload than the latest page holds, the events in between are fetched first; if that
// gap is too long (or can't be fetched), the earlier pages are dropped instead, so the feed never skips.
async function keepOlder(latest) {
  const first = latest[0].id; const lastHave = state.events.at(-1)?.id ?? 0;
  let gap = [];
  if (lastHave < first - 1) {
    let before = first; let closed = false;
    try {
      for (let i = 0; i < 5 && !closed; i++) {
        const got = (await api(`/events?before=${before}`))?.events || [];
        gap = [...got.filter((e) => e.id > lastHave), ...gap];
        closed = got.length < 200 || got[0].id <= lastHave + 1;
        if (got.length) before = got[0].id;
      }
    } catch { closed = false; }
    if (!closed) { older.keep = false; older.more = null; return latest; }
  }
  return [...state.events.filter((e) => e.id < (gap[0]?.id ?? first)), ...gap, ...latest];
}
let reloadTimer;
const scheduleReload = () => { clearTimeout(reloadTimer); reloadTimer = setTimeout(load, 150); };

// ---------- live updates ----------
let es; let esOpen = false; let hadError = false; let connKey = '';
// Only touch the DOM when the connection state changes, so screen readers aren't re-told "Live" every 20s.
function setConn(kind, msg) {
  const key = kind + '|' + (msg || ''); if (key === connKey) return; connKey = key;
  const c = $('conn'); c.className = 'conn ' + kind;
  c.textContent = kind === 'live' ? 'Live' : kind === 'down' ? (msg || 'Disconnected, retrying…') : 'Connecting…';
  c.title = kind === 'live' ? 'Receiving live updates' : 'Live updates paused; the board may be out of date';
  const bar = $('downbar'); bar.hidden = kind !== 'down';
  // The bar sticks just under the header (when the header is sticky), so a scrolled page still sees it.
  const hd = document.querySelector('#app > header'); hd.classList.toggle('down', kind === 'down');
  if (kind === 'down') document.documentElement.style.setProperty('--hdr-h', (getComputedStyle(hd).position === 'sticky' ? hd.offsetHeight : 0) + 'px');
  if (kind === 'down') { bar.textContent = 'Lost the connection to the board server. Retrying by itself; what you see may be out of date.'; bar.title = msg || ''; }
}
function connect() {
  es?.close();
  es = new EventSource(BASE + '/api/stream?token=' + encodeURIComponent(token) + '&name=' + encodeURIComponent(me));
  es.onopen = () => { esOpen = true; setConn('live'); if (hadError) { hadError = false; load(); } };
  es.onmessage = scheduleReload;
  // A network blip: the browser retries by itself. An HTTP error (board archived, moved, token
  // rotated) closes the stream for good: find out why with a normal request, then reconnect if it's fine.
  es.onerror = () => { esOpen = false; hadError = true; setConn('down', 'Disconnected, retrying…'); if (es.readyState === EventSource.CLOSED) setTimeout(recheck, 800); };
}
async function recheck() {
  if (unavailable || $('app').hidden) return;
  await load();
  if (!unavailable && !$('app').hidden && (!es || es.readyState === EventSource.CLOSED)) connect();
}

export { act, api, connect, es, esOpen, load, recheck, scheduleReload, setConn, setLoad, showGate, tokenError,
  unavailable, unavailableStatus };
