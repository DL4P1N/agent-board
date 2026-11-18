// The Express app: security headers, the health check, the boards page and admin API, and the routing of a
// request to its board (/b/<slug>/…, or the default board at the root).
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_DIR, VERSION } from './config.js';
import { tokenFrom, safeEq, internalError } from './http-util.js';
import { createAdminRouter } from './admin.js';

export function createApp({ registry, live, adminToken }) {
  const { runtimes, failures, defaultRuntime } = live;
  const app = express();
  // Security headers on every answer. The CSP blocks plugins, <base> tricks, framing (clickjacking), form posts
  // and connections to anywhere but this server. No script-src: the pages use inline scripts (a strict one would
  // need hashes or nonces); the escaping of untrusted text is what keeps scripts out (tests/ui/hostile.mjs).
  const CSP = "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self'; form-action 'self'";
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({ 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
    next();
  });
  app.use(express.json({ limit: '2mb' }));

  // app stays 'claude-board' (the name before the rename to Agent Board): older join/doctor/start scripts and
  // people's monitoring check it. name is the display name. pid tells a script which server answered (the tests'
  // board vs another one that took the port first).
  app.get('/health', (_req, res) => res.json({ ok: true, app: 'claude-board', name: 'Agent Board', version: VERSION, boards: runtimes.size, pid: process.pid }));

  app.use('/api/admin', createAdminRouter({ registry, live, adminToken }));

  // The boards page (the host's overview). The page itself holds no secrets; it asks for the admin token.
  app.get(['/boards', '/boards/'], (_req, res) => {
    const page = path.join(PUBLIC_DIR, 'boards.html');
    if (fs.existsSync(page)) return res.sendFile(page);
    res.type('text/plain').send('The boards page is not installed. Manage boards with:  npm run boards');
  });

  // ---------- a board at /b/<slug>/ ----------
  app.use('/b/:slug', (req, res, next) => {
    const slug = String(req.params.slug || '').toLowerCase();
    const rt = runtimes.get(slug);
    if (rt) return rt.router(req, res, next);
    const b = registry.get(slug);
    const isData = /^\/(api|mcp)(\/|$)/.test(req.path);
    const failed = failures.get(slug) || (b && registry.problem(slug));
    if (b && b.status === 'live' && failed) {
      if (isData) return res.status(503).json({ error: `This board failed to open: ${failed}` });
      return res.status(503).type('text/plain').send(`This board failed to open: ${failed}\nAsk the host to check the server's window.`);
    }
    if (b && b.status === 'archived') {
      if (isData) return res.status(410).json({ error: 'This board is archived.' });
      return res.status(410).type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Board archived</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem;color:#222"><h1 style="font-size:1.4rem">This board is archived</h1><p>"${String(b.name).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}" isn't being served any more. Ask the host to restore it, or to send you the link to the current board.</p></body>`);
    }
    if (isData) return res.status(404).json({ error: `No board called "${slug}".` });
    return res.status(404).type('text/plain').send(`No board called "${slug}".`);
  });

  // ---------- the default board at the root (/, /api, /mcp) ----------
  app.use((req, res, next) => {
    const rt = defaultRuntime();
    const isData = /^\/(api|mcp)(\/|$)/.test(req.path);
    // A token that isn't the default board's but belongs to another live board: that board used to be the
    // default (served here) and moved. Say where, instead of a bare 401.
    const t = isData ? tokenFrom(req) : '';
    if (t && !(rt && [rt.token, rt.agentToken, rt.viewerToken].some((x) => safeEq(t, x)))) {
      const moved = [...runtimes.values()].find((o) => [o.token, o.agentToken, o.viewerToken].some((x) => safeEq(t, x)));
      if (moved) return res.status(409).json({ error: 'This board moved', moved_to: `/b/${moved.slug}` });
    }
    if (!rt) {
      const f = failures.get(registry.defaultSlug);
      return res.status(503).json({ error: f ? `The default board failed to open: ${f}` : 'No board is live. Restore one or create one at /boards.' });
    }
    return rt.router(req, res, next);
  });

  // Malformed JSON and other request errors: a JSON answer instead of Express's HTML page.
  // Request errors (body-parser's, with a 4xx status) say what was wrong; anything else is the server's own.
  app.use((err, _req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status || err.statusCode;
    if (status >= 400 && status < 500) return res.status(status).json({ error: err.type === 'entity.parse.failed' ? 'Request body is not valid JSON.' : String(err.message || err) });
    if (!internalError(res, err)) { console.error('board request failed:', err); res.status(500).json({ error: 'Something went wrong on the board server (the details are in its window).' }); }
  });

  return app;
}
