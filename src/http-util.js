// Small helpers shared by the route modules (no board involved): reading the token and agent name off a
// request, comparing secrets, and the JSON handler wrapper.
import crypto from 'node:crypto';
import { normName } from './board.js';

export function tokenFrom(req) {
  const h = req.get('authorization') || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  return req.get('x-board-token') || req.query.token || '';
}
export function safeEq(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
export function agentFrom(req) {
  const a = (req.get('x-agent') || req.body?.author || req.query.agent || '').toString().trim();
  // Names are case-insensitive: "Dana" and "dana" are one person.
  return normName(a).replace(/[^\w.\-/]/g, '').slice(0, 64) || 'anonymous';
}
export const h = (fn) => async (req, res) => {
  // A handler may set its own error status (e.g. 403) before throwing; otherwise 400.
  try { res.json(await fn(req, res)); } catch (e) {
    if (res.headersSent) return;
    res.status(e?.status || (res.statusCode >= 400 ? res.statusCode : 400)).json({ error: String(e?.message || e) });
  }
};
