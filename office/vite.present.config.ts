// Builds the presenter view (office/present.html + src/live/) into the board server's static folder, so the server
// needs no build step: public/present.html plus its scripts in public/office/. Relative URLs (base './'), so the same
// files work at / and under /b/<slug>/. Run from the repo root with `npm run build:present`.
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
    rollupOptions: { input: { present: path.resolve(here, 'present.html') } },
  },
  plugins: [{ name: 'clean-presenter-assets', apply: 'build', buildStart() { fs.rmSync(assets, { recursive: true, force: true }); } }],
});
