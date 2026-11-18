// The web board's own files (public/), for every board. Browsers that accept gzip get the text files gzipped
// (see wantsGzip; Node's zlib, compressed once per file and kept in memory until the file changes); the 3D
// office's chunks, whose names carry a content hash, may be cached for a year; the rest is checked on each load.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import express from 'express';
import { PUBLIC_DIR } from './config.js';
import { wantsGzip } from './http-util.js';

const TEXT = /\.(html|js|mjs|css|svg|json|txt|map|md|webmanifest)$/i;
// office/<name>-<8-character hash>.js|css, as Vite names them (embed.js has no hash: it's the entry point).
const HASHED = /^office\/[\w.-]+-[\w-]{8}\.(js|css)$/;
const cacheControl = (rel) => (HASHED.test(rel) ? 'public, max-age=31536000, immutable' : 'public, max-age=0');

export function staticFiles(root) {
  root = path.resolve(root);
  const rel = (file) => path.relative(root, file).split(path.sep).join('/');
  const plain = express.static(root, {
    setHeaders: (res, file) => {
      res.set('Cache-Control', cacheControl(rel(file)));
      if (TEXT.test(file)) res.set('Vary', 'Accept-Encoding');
    },
  });
  const zipped = new Map(); // absolute path -> { mtimeMs, size, gz, etag }

  function gzipped(req, res, next) {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !wantsGzip(req)) return next();
    let p;
    try { p = decodeURIComponent(req.path); } catch { return next(); }
    if (p.endsWith('/')) {
      // "/b/<slug>" without its slash: express.static redirects to "/b/<slug>/", so the page's relative links work.
      if (!req.originalUrl.split('?')[0].endsWith('/')) return next();
      p += 'index.html';
    }
    if (!TEXT.test(p) || p.includes('\0') || p.split('/').some((s) => s.startsWith('.'))) return next();
    const file = path.join(root, p);
    if (!file.startsWith(root + path.sep)) return next();
    let st;
    try { st = fs.statSync(file); } catch { return next(); }
    if (!st.isFile()) return next();
    let z = zipped.get(file);
    if (!z || z.mtimeMs !== st.mtimeMs || z.size !== st.size) {
      z = { mtimeMs: st.mtimeMs, size: st.size, gz: zlib.gzipSync(fs.readFileSync(file), { level: 9 }), etag: `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}-gz"` };
      zipped.set(file, z);
    }
    res.set({ Vary: 'Accept-Encoding', 'Cache-Control': cacheControl(rel(file)), ETag: z.etag, 'Last-Modified': st.mtime.toUTCString() });
    res.type(path.extname(file));
    if (req.fresh) return res.status(304).end();
    res.set({ 'Content-Encoding': 'gzip', 'Content-Length': String(z.gz.length) });
    return res.end(req.method === 'HEAD' ? undefined : z.gz);
  }

  return [gzipped, plain];
}

// One for all boards, so each file is compressed once.
export const publicFiles = staticFiles(PUBLIC_DIR);
