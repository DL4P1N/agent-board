#!/usr/bin/env node
// Runs before `npm start` / `npm run join` / `npm run doctor`: checks Node and installs
// dependencies on first use, so nobody has to remember `npm install`. Uses only built-ins.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`✗ claude-board needs Node.js 22.13 or newer (you have ${process.versions.node}).`);
  console.error('  Install the current LTS from https://nodejs.org and try again.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const missing = Object.keys(pkg.dependencies || {}).filter((d) => !fs.existsSync(path.join(ROOT, 'node_modules', d, 'package.json')));
if (missing.length) {
  console.log(`Installing dependencies (first run: ${missing.join(', ')})…`);
  const r = spawnSync('npm install --no-audit --no-fund', { cwd: ROOT, shell: true, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('✗ npm install failed. Check your internet connection and run `npm install` in the claude-board folder.');
    process.exit(1);
  }
}
