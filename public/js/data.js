// Talking to the server: api() and act(), the sign-in gate, an unavailable board (archived, moved, token rotated),
// load() for /api/state, and the live stream (/api/stream): a chat message is added to the feed as it comes, anything
// else fetches the board's state again.
// It draws nothing itself and imports no UI module: what the page does with the data is registered here (boot.js wires
// the UI modules' handlers), so the modules that show the board import this one and not the other way round.

import './helpers.js';
import { $, BASE, DEFAULT_SETTINGS, me, setMe, setState, setToken, SLUG, state, store, token } from './state.js';
import { esc, knownPeople, toast } from './helpers.js';

const hooks = { request: [], state: [], event: [], paint: [] };
// fn(path, opts): a request is about to be sent (opts.body is the JSON text).
const onRequest = (fn) => { hooks.request.push(fn); };
// async fn(s): the board's state has arrived and is about to replace `state`; fn may change s (the feed keeps earlier pages).
const onState = (fn) => { hooks.state.push(fn); };
// fn(ev): a chat message from the live stream was just added to state.events or state.direct.
const onEvent = (fn) => { hooks.event.push(fn); };
// fn(quiet): draw the page from state; quiet in a tab in the background (title, notifications, announcements only).
const onPaint = (fn) => { hooks.paint.push(fn); };

// A page that held a working token gets a 401: the host rotated the token or started a fresh board.
const TOKEN_CHANGED = 'The board\'s link changed. Ask the host for the new link.';
// Only a 401 that says the token was rotated means the link changed; any other 401 is a token the board doesn't know.
const TOKEN_REJECTED = 'That token was rejected. Ask the host for the board link.';
const tokenError = (body) => (body?.reason === 'token_rotated' ? TOKEN_CHANGED : TOKEN_REJECTED);
let savingN = 0;
function savingCount(d) { savingN = Math.max(0, savingN + d); $('conn').toggleAttribute('data-saving', savingN > 0); }
// This page rotating the token (setup.js): a request sent with the old token meanwhile gets a 401, waits for the new
// token and is sent again with it, instead of signing the host out.
let tokenTurn = null;
function tokenChange(p) { const q = tokenTurn = p.catch(() => {}).finally(() => { if (tokenTurn === q) tokenTurn = null; }); }
// opts.once: no second try after a 401 (the rotation itself, and a request already sent again).
async function api(path, opts = {}) {
  let r;
  const sent = token;
  for (const fn of hooks.request) fn(path, opts);
  // A slow save (bad wifi): the header says "Saving…" until the server answers.
  let slowOn = false; const slow = opts.method && opts.method !== 'GET' ? setTimeout(() => { slowOn = true; savingCount(1); }, 700) : 0;
  try {
    // no-store: a 410 (archived) is cacheable by default, so a restored board would still look archived.
    r = await fetch(BASE + '/api' + path, { cache: 'no-store', ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'X-Agent': me, ...(opts.headers || {}) } });
  } catch (e) { throw new Error(e?.name === 'TimeoutError' ? 'The board server is not answering.' : 'Cannot reach the board server. Is it still running?'); }
  finally { clearTimeout(slow); if (slowOn) savingCount(-1); }
  const body = await r.json().catch(() => ({}));
  if (unavailableStatus(r.status, body)) throw new Error('Token rejected');
  if (r.status === 401 && !opts.once) {
    const turn = tokenTurn; if (turn) await turn;
    if (turn || token !== sent) return api(path, { ...opts, once: true });
  }
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
    // Only a web address becomes a link (the server sends /b/<board>; anything else, e.g. javascript:, doesn't).
    if (!/^https?:$/.test(url.protocol)) return showUnavailable('failed', 'it moved, but its new address is not a web link. Ask the host for the new link.');
    $('moved-link').textContent = new URL(to + '/', location.origin).href; $('moved-link').href = url.href; $('moved-open').href = url.href;
    document.title = 'Board moved · Agent Board';
  }
  if (kind === 'failed') { $('failed-msg').textContent = String(info).replace(/^(This|The default) board failed to open:\s*/i, ''); document.title = `Couldn't open · ${SLUG ? name + ' · ' : ''}Agent Board`; }
  clearInterval(recoverTimer); recoverTimer = setInterval(tryRecover, 4000);
}
// One check at a time: a slow answer (the server busy restoring) doesn't get a second check started beside it.
let recovering = false;
async function tryRecover() {
  if (!unavailable || !token || recovering) return;
  recovering = true;
  try { await recoverOnce(); } finally { recovering = false; }
}
async function recoverOnce() {
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
// back: opened from the name button by someone signed in, who can go back to the board (Back, Esc) as they were.
function showGate(err = '', { back = false } = {}) {
  es?.close(); esOpen = false; clearTimeout(retryT); retryT = 0;
  clearInterval(recoverTimer); unavailable = null; for (const id of UNAVAILABLE) $(id).hidden = true;
  $('app').hidden = true; $('gate').hidden = false; $('g-back').hidden = !back;
  $('g-token').value = token; $('g-name').value = me; $('g-err').textContent = err;
  (token ? $('g-name') : $('g-token')).focus();
  gateNames();
}
async function backToBoard() {
  if ($('gate').hidden || $('g-back').hidden) return;
  $('gate').hidden = true; $('g-back').hidden = true; $('g-err').textContent = '';
  $('app').hidden = false; $('me-btn').focus({ preventScroll: true });
  if (await load() && !unavailable && !$('app').hidden) connect();
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
  if (r.status === 401) { const b = await r.json().catch(() => ({})); $('g-err').textContent = tokenError(b); return $('g-token').focus(); }
  // A board that is unavailable (archived, moved, failed to open) signs in too, as a page opened with a saved token
  // does: start() shows why and starts the timers, so the page is all there once the board comes back.
  setToken(t); setMe(n); store.set('board-token', token); store.set('board-name', me);
  signedIn?.();
});
// What signing in starts (boot.js's start(), handed over from there: this module doesn't import the entry point).
let signedIn = null;
function onSignIn(fn) { signedIn = fn; }
$('me-btn').onclick = () => showGate('', { back: true });
$('g-back').onclick = backToBoard;
$('gate').addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('g-back').hidden) { ev.preventDefault(); backToBoard(); } });

// ---------- data ----------
// One /api/state at a time: a load asked for while one is on its way runs once it is back (it fetches what changed
// meanwhile), so an older answer never replaces a newer one. Resolves true once the page has the board's state, false
// otherwise; it never rejects (an error while applying the state is logged), so callers needn't catch.
let loading = null, again = false;
async function load() {
  if (loading) { again = true; return loading; }
  const once = () => loadOnce().catch((e) => { console.error('Loading the board failed:', e); return false; });
  loading = (async () => { let ok; do { again = false; ok = await once(); } while (again && !unavailable && !$('app').hidden); return ok; })();
  try { return await loading; } finally { loading = null; }
}
// Waits for a load on its way (if any) to finish. Load earlier waits for it, so a page it fetches can't land beside a feed
// that load is about to replace.
const loadSettled = () => loading || Promise.resolve();
async function loadOnce() {
  let s;
  try {
    // A stalled answer gives up after 15s, so the next load (a live event, the 20s timer) can run.
    s = await api('/state', { signal: AbortSignal.timeout(15000) });
    s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
    s.presence = s.presence || []; s.phase = s.phase || (s.tasks.length ? 'building' : 'needs_goal');
  } catch (e) { if (e.message !== 'Token rejected') setConn('down', e.message); return false; }
  for (const fn of hooks.state) await fn(s);
  setState(s); state.loaded = true; setConn(esOpen ? 'live' : 'connecting');
  paint();
  return true;
}
function setLoad(f) { load = f; } // tests stub load out (through window, see boot.js)
// Draw the page from state. A tab in the background only updates its title, desktop notifications and screen-reader
// announcements, and draws the rest when it is shown again. A drawing error is logged, never taken for a lost connection.
let behind = false;
function paint() {
  try {
    behind = document.hidden;
    for (const fn of hooks.paint) fn(behind);
  } catch (e) { console.error('The board could not draw itself:', e); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && behind && state.loaded && !$('app').hidden) paint(); });
let paintT = 0;
const schedulePaint = () => { if (!paintT) paintT = setTimeout(() => { paintT = 0; paint(); }, 40); };
// A burst of events makes one load (at most one every 150ms, and one at a time).
let reloadTimer = 0;
const scheduleReload = () => { if (!reloadTimer) reloadTimer = setTimeout(() => { reloadTimer = 0; load(); }, 150); };
// A chat message (from an agent or a person, direct ones too) changes only the feed: it is added as it comes, without
// fetching the board. Anything else (a task, question, lock, setting or presence change, the board's own notices), or a
// message that doesn't follow the last event this page has (one was missed), loads the board's state.
function applyEvent(ev) {
  if (!state.loaded || loading || reloadTimer || !ev || ev.kind !== 'message' || ev.author === 'board' || ev.data?.action || ev.data?.notice) return false;
  if (!Number.isInteger(ev.id) || ev.id !== Number(state.cursor) + 1) return false;
  state.cursor = ev.id;
  if (ev.channel === 'direct') state.direct = [...(state.direct || []), ev];
  else state.events = [...state.events, ev];
  for (const fn of hooks.event) fn(ev);
  schedulePaint();
  return true;
}
function onStreamEvent(m) {
  let ev = null; try { ev = JSON.parse(m.data); } catch {}
  if (!applyEvent(ev)) scheduleReload();
}

// ---------- live updates ----------
let es; let esOpen = false; let hadError = false; let connKey = '';
// Only touch the DOM when the connection state changes, so screen readers aren't re-told "Live" every 20s.
function setConn(kind, msg) {
  const key = kind + '|' + (msg || ''); if (key === connKey) return; connKey = key;
  const c = $('conn'); c.className = 'conn ' + kind;
  c.textContent = kind === 'live' ? 'Live' : kind === 'down' ? (msg || 'Disconnected, retrying…') : 'Connecting…';
  c.title = kind === 'live' ? 'Receiving live updates' : 'Live updates paused; the board may be out of date';
  // The bar only shows it: #conn (a status) is what screen readers hear, once.
  const bar = $('downbar'); bar.hidden = kind !== 'down';
  // The bar sticks just under the header (when the header is sticky), so a scrolled page still sees it.
  const hd = document.querySelector('#app > header'); hd.classList.toggle('down', kind === 'down');
  if (kind === 'down') document.documentElement.style.setProperty('--hdr-h', (getComputedStyle(hd).position === 'sticky' ? hd.offsetHeight : 0) + 'px');
  if (kind === 'down') { bar.textContent = 'Lost the connection to the board server. Retrying by itself; what you see may be out of date.'; bar.title = msg || ''; }
}
function connect() {
  es?.close(); clearTimeout(retryT); retryT = 0;
  es = new EventSource(BASE + '/api/stream?token=' + encodeURIComponent(token) + '&name=' + encodeURIComponent(me));
  es.onopen = () => { esOpen = true; retryMs = 0; setConn('live'); if (hadError) { hadError = false; load(); } };
  es.onmessage = onStreamEvent;
  // A network blip: the browser retries by itself. An HTTP error (board archived, moved, token rotated, the server
  // failing) closes the stream for good: find out why with a normal request and reconnect once that works, waiting
  // longer after each failure (up to 30s).
  es.onerror = () => { esOpen = false; hadError = true; setConn('down', 'Disconnected, retrying…'); if (es.readyState === EventSource.CLOSED) retryLater(); };
}
let retryT = 0, retryMs = 0;
function retryLater() { clearTimeout(retryT); retryMs = Math.min(30000, retryMs ? retryMs * 2 : 800); retryT = setTimeout(() => { retryT = 0; recheck(); }, retryMs); }
const retrying = () => !!retryT;
async function recheck() {
  if (unavailable || $('app').hidden) return;
  const ok = await load();
  if (unavailable || $('app').hidden) return;
  if (!ok) return retryLater();
  if (!es || es.readyState === EventSource.CLOSED) connect();
}

export { act, api, connect, es, esOpen, load, loadSettled, onEvent, onPaint, onRequest, onSignIn, onState, paint, recheck, retrying,
  scheduleReload, setConn, setLoad, showGate, tokenChange, tokenError, unavailable, unavailableStatus };
