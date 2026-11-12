import * as THREE from 'three';
import { drawText, drawTextCentered, textWidth } from './pixelFont';
import type { Palette } from './palettes';
import { rng } from './builder';

export interface CanvasTex { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture }

export function makeCanvasTex(w: number, h: number, mipmaps = true): CanvasTex {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter;
  tex.generateMipmaps = mipmaps;
  tex.anisotropy = 4;
  return { canvas, ctx, tex };
}

export function hex(n: number): string { return '#' + n.toString(16).padStart(6, '0'); }

let glowTex: THREE.CanvasTexture | null = null;
export function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.15)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** City skyline window art, redrawn per palette. */
export function drawWindowArt(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette): void {
  const top = new THREE.Color(p.window.top), bot = new THREE.Color(p.window.bottom), tmp = new THREE.Color();
  const bands = 10;
  for (let i = 0; i < bands; i++) {
    tmp.copy(top).lerp(bot, i / (bands - 1));
    ctx.fillStyle = '#' + tmp.getHexString(THREE.SRGBColorSpace);
    ctx.fillRect(0, Math.floor((h * i) / bands), w, Math.ceil(h / bands) + 1);
  }
  const r = rng(11);
  if (p.window.stars) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 12; i++) ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h * 0.55), 1, 1);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(4, 5, 8, 2); ctx.fillRect(7, 3, 6, 2); ctx.fillRect(w - 14, 8, 9, 2);
  }
  ctx.fillStyle = hex(p.window.city);
  let x = 0;
  const lit = hex(p.window.lit);
  while (x < w) {
    const bw = 3 + Math.floor(r() * 5), bh = 6 + Math.floor(r() * 12);
    ctx.fillStyle = hex(p.window.city);
    ctx.fillRect(x, h - bh, bw, bh);
    ctx.fillStyle = lit;
    for (let yy = h - bh + 2; yy < h - 1; yy += 3) for (let xx = x + 1; xx < x + bw - 1; xx += 2) if (r() < 0.45) ctx.fillRect(xx, yy, 1, 1);
    x += bw;
  }
}

export type PosterKind = 'shipit' | 'blame' | 'works' | 'nap' | 'coffee' | 'agile';
export function drawPoster(ctx: CanvasRenderingContext2D, w: number, h: number, kind: PosterKind): void {
  const bgs: Record<PosterKind, [string, string, string]> = {
    shipit: ['#2a1a5a', '#ff7a45', '#fff1c8'], blame: ['#f5ecd0', '#2a2a3a', '#d94a3a'], works: ['#1a2a4a', '#9bd1ff', '#ffd25a'],
    nap: ['#7ad1b8', '#1f3a4a', '#fff1c8'], coffee: ['#5a3a2a', '#f5d2a0', '#ff9a4a'], agile: ['#ffd25a', '#2a2a3a', '#d94a3a'],
  };
  const [bg, fg, ac] = bgs[kind];
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg; ctx.fillRect(0, 0, w, 2); ctx.fillRect(0, h - 2, w, 2); ctx.fillRect(0, 0, 2, h); ctx.fillRect(w - 2, 0, 2, h);
  const cx = w / 2;
  if (kind === 'shipit') {
    // rocket
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 4, 12, 8, 22);
    ctx.fillStyle = '#ff5a4a'; ctx.fillRect(cx - 3, 8, 6, 4); ctx.fillRect(cx - 1, 5, 2, 3);
    ctx.fillStyle = '#ff5a4a'; ctx.fillRect(cx - 8, 28, 4, 8); ctx.fillRect(cx + 4, 28, 4, 8);
    ctx.fillStyle = '#4ac8ff'; ctx.fillRect(cx - 2, 17, 4, 4);
    ctx.fillStyle = ac; ctx.fillRect(cx - 3, 34, 6, 5); ctx.fillStyle = '#ffd25a'; ctx.fillRect(cx - 1, 39, 2, 5);
    drawTextCentered(ctx, 'SHIP', cx, 50, ac, 1); drawTextCentered(ctx, 'IT', cx, 59, ac, 1);
  } else if (kind === 'blame') {
    drawTextCentered(ctx, 'GIT', cx, 8, ac, 2);
    drawTextCentered(ctx, 'BLAME', cx, 26, fg, 1);
    drawTextCentered(ctx, 'IS A', cx, 38, fg, 1);
    drawTextCentered(ctx, 'LIFE', cx, 50, ac, 1);
    drawTextCentered(ctx, 'STYLE', cx, 60, ac, 1);
  } else if (kind === 'works') {
    drawTextCentered(ctx, 'WORKS', cx, 10, ac, 1); drawTextCentered(ctx, 'ON MY', cx, 22, ac, 1); drawTextCentered(ctx, 'MACHINE', cx, 34, ac, 1);
    ctx.fillStyle = fg; ctx.fillRect(cx - 9, 46, 18, 12); ctx.fillStyle = '#10182a'; ctx.fillRect(cx - 7, 48, 14, 8); ctx.fillStyle = ac; ctx.fillRect(cx - 5, 50, 4, 1); ctx.fillRect(cx - 5, 52, 8, 1);
  } else if (kind === 'nap') {
    drawTextCentered(ctx, 'TODO:', cx, 10, fg, 1); drawTextCentered(ctx, 'NAP', cx, 24, ac, 2);
    drawText(ctx, 'Z', cx + 4, 44, fg, 1); drawText(ctx, 'Z', cx + 12, 38, fg, 2);
    ctx.fillStyle = fg; ctx.fillRect(cx - 14, 52, 20, 6); ctx.fillStyle = ac; ctx.fillRect(cx - 14, 50, 8, 3);
  } else if (kind === 'coffee') {
    drawTextCentered(ctx, 'COFFEE', cx, 8, ac, 1);
    ctx.fillStyle = fg; ctx.fillRect(cx - 9, 26, 18, 18); ctx.fillRect(cx + 9, 30, 4, 8); ctx.fillStyle = bg; ctx.fillRect(cx + 11, 32, 0, 0);
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(cx - 7, 28, 14, 4);
    ctx.fillStyle = ac; ctx.fillRect(cx - 5, 14, 2, 8); ctx.fillRect(cx, 12, 2, 10); ctx.fillRect(cx + 5, 15, 2, 7);
    drawTextCentered(ctx, 'IS', cx, 50, fg, 1); drawTextCentered(ctx, 'LIFE', cx, 59, ac, 1);
  } else {
    drawTextCentered(ctx, 'AGILE', cx, 8, fg, 1);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#ff7a45', '#4ac8ff', '#5ad17a'][i]; ctx.fillRect(8, 20 + i * 12, 12, 8); ctx.fillRect(24, 22 + i * 12, w - 34, 4); }
    drawTextCentered(ctx, 'SHIP', cx, 58, ac, 1);
  }
}

/** Sign texture: coloured plate with centred pixel text. Returns a tex sized to text. */
export function makeSignTex(text: string, bg: string, fg: string, border: string, scale = 1, padX = 4, padY = 3): { tex: THREE.CanvasTexture; aspect: number } {
  const w = textWidth(text, scale) + padX * 2 + 2, h = 7 * scale + padY * 2 + 2;
  const c = makeCanvasTex(w, h, false);
  c.ctx.fillStyle = border; c.ctx.fillRect(0, 0, w, h);
  c.ctx.fillStyle = bg; c.ctx.fillRect(1, 1, w - 2, h - 2);
  drawText(c.ctx, text, padX + 1, padY + 1, fg, scale);
  c.tex.needsUpdate = true;
  return { tex: c.tex, aspect: w / h };
}
