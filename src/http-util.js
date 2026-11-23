// Small helpers shared by the route modules (no board involved): reading the token and agent name off a
// request, comparing secrets, and the JSON handler wrapper.
import crypto from 'node:crypto';
import { normName, NAME_RE, RESERVED_NAMES } from './board.js';

export function tokenFrom(req) {
  const h = req.get('authorization') || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  const t = req.get('x-board-token') || req.query.token || '';
  return typeof t === 'string' ? t : '';
}
export function safeEq(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
// The name's root ("alice" for "alice/ui-worker") is not one an agent may use: "board" (the board's own
// announcements), "anonymous" (a call without a name), or no name at all ("/x").
export const badRoot = (name) => { const root = name.split('/')[0]; return RESERVED_NAMES.has(root) || !NAME_RE.test(root); };
export function agentFrom(req) {
  const a = (req.get('x-agent') || req.body?.author || req.query.agent || '').toString().trim();
  // Names are case-insensitive: "Dana" and "dana" are one person.
  return normName(a).replace(/[^\w.\-/]/g, '').slice(0, 64) || 'anonymous';
}
// Send this answer gzipped? Only to browsers that accept it (every browser's User-Agent starts "Mozilla/"): Node's
// fetch accepts gzip too, but on Windows a script that exits soon after reading a gzipped answer can crash in
// libuv (nodejs/node#56645), and our scripts (join, doctor, the tests) don't need it. The answer depends on the
// User-Agent as well as Accept-Encoding, so both are in Vary (GZIP_VARY), for any cache in between.
export const GZIP_VARY = 'Accept-Encoding, User-Agent';
export const wantsGzip = (req) => /^Mozilla\//.test(req.get('user-agent') || '') && /\bgzip\b/i.test(req.get('accept-encoding') || '');

// join's laptop id (?laptop=, X-Laptop, a body field): letters, digits, _ and -, at most 32; '' when missing.
export const laptopParam = (v) => String(v || '').replace(/[^\w-]/g, '').slice(0, 32);

// A bug or a database error, not a refusal meant for the caller: its text (SQL, property names) stays in the
// server's window. A TypeError from reading the request (a field missing or of the wrong type, e.g. "Cannot read
// properties of undefined", "x.trim is not a function") is a malformed request: 400. Any other TypeError is a bug: 500.
const INPUT_TYPE_ERROR = /^Cannot read properties of (undefined|null) |\bis not iterable\b|^\S+\.\w+ is not a function$|^The "[^"]+" argument must be/;
export function internalError(res, e) {
  if (!(e instanceof TypeError || e instanceof ReferenceError || e instanceof RangeError || /^ERR_/.test(String(e?.code || '')))) return false;
  console.error('board request failed:', e);
  if (e instanceof TypeError && INPUT_TYPE_ERROR.test(e.message || '')) res.status(400).json({ error: 'The request is missing a field or has one of the wrong type.' });
  else res.status(500).json({ error: 'Something went wrong on the board server (the details are in its window).' });
  return true;
}
export const h = (fn) => async (req, res) => {
  // A handler may set its own error status (e.g. 403) before throwing; otherwise 400.
  try { res.json(await fn(req, res)); } catch (e) {
    if (res.headersSent) return;
    if (!e?.status && internalError(res, e)) return;
    res.status(e?.status || (res.statusCode >= 400 ? res.statusCode : 400)).json({ error: String(e?.message || e) });
  }
};
