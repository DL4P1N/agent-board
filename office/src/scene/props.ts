import * as THREE from 'three';
import { BoxBuilder, rng } from './builder';

import { PROVIDERS, perProvider } from '../providers';
/** Main accent per tool (from the provider registry). */
export const ACCENT = perProvider((id) => PROVIDERS[id].accent.main);
export const DIFF_COLORS = ['#5ad17a', '#b9e04a', '#f2c94c', '#f08a3c', '#e5484d'];

export type B = BoxBuilder;

export function plant(b: B, x: number, z: number, s = 1, seed = 1, y0 = 0): void {
  const r = rng(seed);
  b.box(x, y0 + 0.17 * s, z, 0.42 * s, 0.34 * s, 0.42 * s, 0xa0603a);
  b.box(x, y0 + 0.35 * s, z, 0.46 * s, 0.05 * s, 0.46 * s, 0x6a3f26);
  b.box(x, y0 + 0.37 * s, z, 0.36 * s, 0.03 * s, 0.36 * s, 0x3a2a1e);
  const greens = [0x3f9a4a, 0x56b85a, 0x2f7a3c, 0x72cf6a];
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2, d = 0.06 + r() * 0.12 * s;
    const h = (0.25 + r() * 0.45) * s;
    b.box(x + Math.cos(a) * d, y0 + 0.4 * s + h / 2, z + Math.sin(a) * d, (0.16 + r() * 0.1) * s, h, (0.16 + r() * 0.1) * s, greens[i % 4], r() * 1.5);
  }
  b.box(x, y0 + 0.4 * s + 0.65 * s, z, 0.3 * s, 0.22 * s, 0.3 * s, greens[3], r());
}

export function bigPlant(b: B, x: number, z: number, seed = 1): void {
  const r = rng(seed);
  b.box(x, 0.3, z, 0.7, 0.6, 0.7, 0xb86a3e);
  b.box(x, 0.62, z, 0.76, 0.06, 0.76, 0x7a4528);
  b.box(x, 0.64, z, 0.6, 0.03, 0.6, 0x3a2a1e);
  const greens = [0x3f9a4a, 0x56b85a, 0x2f7a3c, 0x72cf6a];
  b.box(x, 1.0, z, 0.12, 0.8, 0.12, 0x6a4a2a);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r(), d = 0.2 + r() * 0.25;
    const y = 1.0 + r() * 0.9;
    b.box(x + Math.cos(a) * d, y, z + Math.sin(a) * d, 0.34, 0.28, 0.34, greens[i % 4], r() * 1.5);
  }
  b.box(x, 2.1, z, 0.45, 0.32, 0.45, greens[3], 0.4);
}

export function mug(b: B, x: number, y: number, z: number, color: number): void {
  b.box(x, y + 0.05, z, 0.09, 0.1, 0.09, color);
  b.box(x + 0.055, y + 0.05, z, 0.025, 0.06, 0.03, color);
  b.box(x, y + 0.101, z, 0.07, 0.01, 0.07, 0x3a2418);
}

export function duck(b: B, x: number, y: number, z: number): void {
  b.box(x, y + 0.04, z, 0.12, 0.08, 0.1, 0xffd23a);
  b.box(x, y + 0.11, z - 0.03, 0.07, 0.07, 0.07, 0xffd23a);
  b.box(x, y + 0.1, z - 0.075, 0.04, 0.02, 0.035, 0xff8a2a);
}

export function figurine(b: B, x: number, y: number, z: number, c1: number, c2: number): void {
  b.box(x, y + 0.01, z, 0.12, 0.02, 0.12, 0x2a2a3a);
  b.box(x, y + 0.09, z, 0.07, 0.14, 0.05, c1);
  b.box(x, y + 0.2, z, 0.07, 0.07, 0.07, c2);
}

export function booksStack(b: B, x: number, y: number, z: number, seed: number): void {
  const r = rng(seed);
  const cols = [0xd0524a, 0x4a82d0, 0x5ab870, 0xe0b040, 0x8a5ab8];
  let yy = y;
  for (let i = 0; i < 3; i++) {
    const h = 0.04 + r() * 0.03;
    b.box(x + (r() - 0.5) * 0.02, yy + h / 2, z, 0.26 - i * 0.02, h, 0.19, cols[Math.floor(r() * cols.length)], (r() - 0.5) * 0.3);
    yy += h;
  }
}

export function cactus(b: B, x: number, y: number, z: number): void {
  b.box(x, y + 0.04, z, 0.12, 0.08, 0.12, 0xb86a3e);
  b.box(x, y + 0.14, z, 0.07, 0.15, 0.07, 0x4aa05a);
  b.box(x + 0.06, y + 0.15, z, 0.05, 0.03, 0.04, 0x4aa05a);
  b.box(x + 0.08, y + 0.19, z, 0.03, 0.08, 0.04, 0x4aa05a);
  b.box(x, y + 0.23, z, 0.03, 0.02, 0.03, 0xff7aa8);
}

export function photoFrame(b: B, x: number, y: number, z: number, c: number): void {
  b.box(x, y + 0.08, z, 0.2, 0.15, 0.025, 0x3a2a1e, 0, -0.2);
  b.box(x, y + 0.08, z + 0.006, 0.16, 0.11, 0.025, c, 0, -0.2);
}

/** A neat pile of paper sheets. tint: sheet colour. Returns height. */
export function paperStack(b: B, x: number, y: number, z: number, sheets: number, seed: number, tint = 0xf6f1e3, w = 0.34, d = 0.46, header = 0x4a6fd0): number {
  const r = rng(seed);
  const th = 0.022;
  for (let i = 0; i < sheets; i++) {
    const jitter = 0.025;
    const k = 0.93 + r() * 0.07;
    b.box(x + (r() - 0.5) * jitter, y + th * (i + 0.5), z + (r() - 0.5) * jitter, w, th * 0.9, d, k > 0.97 ? tint : shade(tint, k), (r() - 0.5) * 0.12);
  }
  // header band on the top sheet (looks like a ticket)
  b.box(x, y + th * sheets + 0.003, z - d * 0.3, w * 0.8, 0.004, d * 0.12, header);
  return th * sheets + 0.006;
}

export function shade(c: number, k: number): number {
  const r = Math.round(((c >> 16) & 255) * k), g = Math.round(((c >> 8) & 255) * k), bl = Math.round((c & 255) * k);
  return (r << 16) | (g << 8) | bl;
}

export function lampMesh(b: B, x: number, y: number, z: number, baseColor = 0x2a2a34): void {
  b.box(x, y + 0.02, z, 0.16, 0.04, 0.16, baseColor);
  b.box(x, y + 0.2, z, 0.03, 0.34, 0.03, baseColor, 0, 0, 0.12);
  b.box(x - 0.04, y + 0.38, z, 0.18, 0.025, 0.03, baseColor, 0, 0, 0.0);
}

export function waterCooler(b: B, x: number, z: number): void {
  b.box(x, 0.45, z, 0.6, 0.9, 0.55, 0xe8eef4);
  b.box(x, 0.9, z, 0.62, 0.05, 0.57, 0xc9d3dc);
  b.box(x + 0.26, 0.55, z, 0.06, 0.1, 0.18, 0x5ab8ff);
  b.box(x + 0.26, 0.4, z, 0.06, 0.1, 0.18, 0xff6a5a);
  b.box(x + 0.22, 0.3, z, 0.12, 0.03, 0.22, 0x8a96a2);
  b.box(x, 1.28, z, 0.46, 0.65, 0.46, 0x7ec8ff);
  b.box(x, 1.28, z, 0.38, 0.55, 0.38, 0xb5e4ff);
  b.box(x, 1.62, z, 0.2, 0.06, 0.2, 0x7ec8ff);
}

export function coffeeStation(b: B, x: number, z0: number, z1: number): void {
  const zc = (z0 + z1) / 2, len = z1 - z0;
  b.box(x, 0.45, zc, 0.8, 0.9, len, 0x8a6a4a);
  b.box(x, 0.93, zc, 0.86, 0.06, len + 0.04, 0xd9c4a0);
  b.box(x + 0.41, 0.45, zc, 0.03, 0.8, len - 0.1, 0x6a4a2a);
  // machine
  b.box(x - 0.1, 1.2, zc - 0.5, 0.45, 0.5, 0.5, 0x2a2e3a);
  b.box(x + 0.14, 1.2, zc - 0.5, 0.04, 0.42, 0.42, 0x3a4050);
  b.box(x + 0.15, 1.3, zc - 0.5, 0.03, 0.08, 0.2, 0xff5a4a);
  b.box(x + 0.15, 1.05, zc - 0.5, 0.05, 0.14, 0.1, 0x1a1a22);
  b.box(x + 0.17, 0.99, zc - 0.5, 0.1, 0.05, 0.1, 0xf0f0f0);
  // kettle + cups + jar
  b.box(x - 0.05, 1.05, zc + 0.15, 0.25, 0.2, 0.25, 0xc0c8d0);
  b.box(x - 0.05, 1.18, zc + 0.15, 0.12, 0.06, 0.12, 0x3a3a44);
  for (let i = 0; i < 4; i++) mug(b, x + 0.1, 0.96, zc + 0.45 + i * 0.14, [0xd0524a, 0x4a82d0, 0xffd25a, 0xf0f0f0][i]);
  b.box(x - 0.1, 1.06, zc + 0.85, 0.18, 0.22, 0.18, 0xe8dcc0);
  b.box(x - 0.1, 1.2, zc + 0.85, 0.2, 0.06, 0.2, 0xd05a4a);
}

export function bookshelfDecor(b: B, x: number, y: number, z0: number, z1: number, seed: number): void {
  const r = rng(seed);
  let z = z0;
  const cols = [0xd0524a, 0x4a82d0, 0x5ab870, 0xe0b040, 0x8a5ab8, 0xd97757, 0x2dd4bf, 0xe8e0d0];
  while (z < z1 - 0.1) {
    const w = 0.07 + r() * 0.08, h = 0.4 + r() * 0.25;
    b.box(x, y + h / 2, z + w / 2, 0.35, h, w, cols[Math.floor(r() * cols.length)]);
    z += w + 0.01;
  }
}
