// Managing boards (the host, with the admin token) at /api/admin. The admin token only manages boards; it
// never works as a board token, and board tokens never work here.
import express from 'express';
import { safeEq, h } from './http-util.js';
import { RateLimiter } from './limits.js';
import { clientIp, tooMany } from './request-limits.js';

// Wrong admin tokens per network address: 10 a minute, then that address waits before it may try again (a guess
// at the token costs time), whatever token it sends meanwhile.
const ADMIN_FAILS_PER_MINUTE = 10;

export function createAdminRouter({ registry, live, adminToken }) {
  const { runtimes, failures, startBoard, stopBoard, boardSummary, boardLinks } = live;
  const fails = new RateLimiter(ADMIN_FAILS_PER_MINUTE);
  const blockedUntil = new Map(); // address -> ms
  setInterval(() => { fails.sweep(); for (const [ip, t] of blockedUntil) if (t <= Date.now()) blockedUntil.delete(ip); }, 60e3).unref();
  function adminAuth(req, res, next) {
    const ip = clientIp(req);
    const until = blockedUntil.get(ip) || 0;
    if (until > Date.now()) return tooMany(req, res, Math.ceil((until - Date.now()) / 1000), `Too many wrong admin tokens from this address (${ip}). Wait ${Math.ceil((until - Date.now()) / 1000)} s, then try again.`);
    const h2 = req.get('authorization') || '';
    // Header or Bearer only: ?admin= in API URLs would end up in logs and history. (The /boards page takes
    // ?admin= once as a handoff and removes it from the address bar.)
    const t = h2.toLowerCase().startsWith('bearer ') ? h2.slice(7).trim() : String(req.get('x-admin-token') || '');
    if (!t || !safeEq(t, adminToken)) {
      const r = fails.take(ip);
      if (!r.ok) {
        blockedUntil.set(ip, Date.now() + r.retryAfter * 1000);
        return tooMany(req, res, r.retryAfter, `Too many wrong admin tokens from this address (${ip}). Wait ${r.retryAfter} s, then try again.`);
      }
      return res.status(401).json({ error: 'This needs the admin token (printed when the server starts, and in data/admin-token).' });
    }
    next();
  }
  const admin = express.Router();
  admin.use(adminAuth, express.json({ limit: '2mb' }));
  admin.get('/boards', h(() => registry.list().map(boardSummary)));
  admin.post('/boards', h((req) => {
    const b = registry.create(req.body?.name, req.body?.slug);
    try { startBoard(b); } catch (e) {
      // Don't leave a "live" board that nothing serves.
      registry.forget(b.slug);
      failures.delete(b.slug);
      throw e;
    }
    return boardLinks(b.slug);
  }));
  admin.get('/boards/:slug/open', h((req) => boardLinks(registry.must(req.params.slug).slug)));
  admin.post('/boards/:slug/archive', h((req) => {
    const b = registry.archive(req.params.slug);
    stopBoard(b.slug);
    return boardSummary(registry.get(b.slug));
  }));
  admin.post('/boards/:slug/restore', h((req) => {
    const before = registry.must(req.params.slug);
    const prev = { status: before.status, archived_at: before.archived_at };
    const b = registry.restore(req.params.slug);
    try { startBoard(b); } catch (e) {
      registry.setStatus(b.slug, prev);
      failures.delete(b.slug);
      throw e;
    }
    return boardSummary(registry.get(b.slug));
  }));
  admin.post('/boards/:slug/default', h((req) => {
    const slug = registry.must(req.params.slug).slug;
    if (!runtimes.has(slug)) throw new Error(`"${slug}" isn't being served${failures.has(slug) ? ` (it failed to open: ${failures.get(slug)})` : ''}: it can't be the default.`);
    registry.setDefault(slug);
    return boardSummary(registry.get(slug));
  }));
  admin.delete('/boards/:slug', h((req) => {
    if (runtimes.has(req.params.slug)) throw new Error(`Archive "${req.params.slug}" first; only archived boards can be deleted.`);
    return registry.remove(req.params.slug);
  }));
  return admin;
}
