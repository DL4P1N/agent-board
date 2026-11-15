// Builds the presenter view (office/present.html + src/live/) into the board server's static folder, so the server
// needs no build step: public/present.html plus its scripts in public/office/. Relative URLs (base './'), so the same
// files work at / and under /b/<slug>/. Run from the repo root with `npm run build:present`.
// Also builds the board's own "3D office" view (src/live/embed.ts) as public/office/embed.js: a fixed name, because the
// board (public/index.html, no build step) imports it by that name; the chunks it loads (three.js, the scene) keep hashes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(here, '../public');
const assets = path.join(pub, 'office');

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    target: 'es2022',
    outDir: pub,
    // public/ holds the rest of the board: never empty it, only the presenter's own folder.
    emptyOutDir: false,
    assetsDir: 'office',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: { present: path.resolve(here, 'present.html'), embed: path.resolve(here, 'src/live/embed.ts') },
      // Keep the embed's exports (mount): a library-style entry, not a page script.
      preserveEntrySignatures: 'exports-only',
      output: { entryFileNames: (c) => (c.name === 'embed' ? 'office/embed.js' : 'office/[name]-[hash].js') },
    },
  },
  plugins: [{ name: 'clean-presenter-assets', apply: 'build', buildStart() { fs.rmSync(assets, { recursive: true, force: true }); } }],
});
