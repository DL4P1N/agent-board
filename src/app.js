// The Express app: security headers, the health check, the boards page and admin API, and the routing of a
// request to its board (/b/<slug>/…, or the default board at the root).
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_DIR, VERSION } from './config.js';
import { tokenFrom, safeEq, internalError } from './http-util.js';
import { createAdminRouter } from './admin.js';

const escHtml = (x) => String(x).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// A small page for someone who followed a link that doesn't lead to a board (not found, archived, failed to open): calm, in light or dark.
const notePage = (title, heading, text) => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escHtml(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem;color:#222;background:#f6f6f7}h1{font-size:1.4rem;margin:0 0 .5rem}p{margin:.5rem 0}.mute{color:#666}@media (prefers-color-scheme:dark){body{color:#e6e7ea;background:#0c0d0f}.mute{color:#9a9ca3}}</style><body><h1>${escHtml(heading)}</h1>${text}</body></html>`;

export function createApp({ registry, live, adminToken }) {
  const { runtimes, failures, defaultRuntime } = live;
  const app = express();
  // Security headers on every answer. The CSP blocks plugins, <base> tricks, framing (clickjacking), form posts,
  // connections to anywhere but this server, and scripts from anywhere else (and eval). Inline scripts are still
  // allowed: the pages use them (a strict policy would need hashes or nonces), so the escaping of untrusted text is
  // what keeps injected scripts out (tests/ui/hostile.mjs).
  const CSP = "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self'; form-action 'self'; script-src 'self' 'unsafe-inline'";
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({ 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
    next();
  });
  // Request bodies (JSON) are read further in, only where they're used: a board's /api and /mcp after its
  // per-address limit and its token check (runtime.js), and the admin API after its token check. A request for nothing that exists
  // never has its body read or decompressed.

  // app stays 'claude-board' (the name before the rename to Agent Board): older join/doctor/start scripts and
  // people's monitoring check it. name is the display name. pid tells a script which server answered (the tests'
  // board vs another one that took the port first).
  // The process id and the number of boards only to a caller on this computer (the start scripts, the tests, a second
  // `npm start`), not through a tunnel or a proxy: nobody else needs them. The version stays public: doctor on a
  // teammate's laptop compares it with its own.
  app.get('/health', (req, res) => {
    const peer = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
    const local = ['127.0.0.1', '::1'].includes(peer) && !req.get('cf-connecting-ip') && !req.get('x-forwarded-for');
    res.json({ ok: true, app: 'claude-board', name: 'Agent Board', version: VERSION, ...(local ? { boards: runtimes.size, pid: process.pid } : {}) });
  });

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
      return res.status(503).type('html').send(notePage('Board unavailable', 'This board failed to open', `<p>${escHtml(failed)}</p><p class="mute">Ask the host to check the server's window.</p>`));
    }
    if (b && b.status === 'archived') {
      if (isData) return res.status(410).json({ error: 'This board is archived.' });
      return res.status(410).type('html').send(notePage('Board archived', 'This board is archived', `<p>"${escHtml(b.name)}" isn't being served any more. Ask the host to restore it, or to send you the link to the current board.</p>`));
    }
    if (isData) return res.status(404).json({ error: `No board called "${slug}".` });
    return res.status(404).type('html').send(notePage('Board not found', 'No board here', `<p>This server has no board called "${escHtml(slug)}".</p><p class="mute">Check the link, or ask the host for the current one.</p>`));
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
      if (moved) {
        // Where it went and what to do, for an agent (its MCP call shows only this text) as much as for the page.
        const to = `/b/${moved.slug}`;
        const mcp = /^\/mcp(\/|$)/.test(req.path);
        const error = `This board moved to ${to}/ on this server. ${mcp ? `Its MCP address is now ${to}/mcp: ask your human to re-run the join command from the web board, then restart this tool.` : 'Open it there, or re-run the join command from the web board.'}`;
        return res.status(409).json(mcp ? { jsonrpc: '2.0', error: { code: -32001, message: error }, id: null, moved_to: to } : { error, moved_to: to });
      }
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
