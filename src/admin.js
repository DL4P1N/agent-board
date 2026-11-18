// Managing boards (the host, with the admin token) at /api/admin. The admin token only manages boards; it
// never works as a board token, and board tokens never work here.
import express from 'express';
import { safeEq, h } from './http-util.js';

export function createAdminRouter({ registry, live, adminToken }) {
  const { runtimes, failures, startBoard, stopBoard, boardSummary, boardLinks } = live;
  function adminAuth(req, res, next) {
    const h2 = req.get('authorization') || '';
    // Header or Bearer only: ?admin= in API URLs would end up in logs and history. (The /boards page takes
    // ?admin= once as a handoff and removes it from the address bar.)
    const t = h2.toLowerCase().startsWith('bearer ') ? h2.slice(7).trim() : String(req.get('x-admin-token') || '');
    if (!t || !safeEq(t, adminToken)) return res.status(401).json({ error: 'This needs the admin token (printed when the server starts, and in data/admin-token).' });
    next();
  }
  const admin = express.Router();
  admin.use(adminAuth);
  admin.get('/boards', h(() => registry.list().map(boardSummary)));
  admin.post('/boards', h((req) => {
    const b = registry.create(req.body?.name, req.body?.slug);
    try { startBoard(b); } catch (e) {
      // Don't leave a "live" board that nothing serves.
      registry.data.boards = registry.data.boards.filter((x) => x.slug !== b.slug); registry.save();
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
      const x = registry.get(b.slug); x.status = prev.status; if (prev.archived_at) x.archived_at = prev.archived_at; registry.save();
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
