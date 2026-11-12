import * as THREE from 'three';
import { makeCanvasTex } from './textures';
import { drawText, drawTextCentered } from './pixelFont';
import { rng } from './builder';

export type ScreenMode = 'off' | 'code' | 'think' | 'wait' | 'blocked' | 'help' | 'review' | 'idle' | 'plan';

const KW = ['#c792ea', '#82aaff', '#c3e88d', '#f78c6c', '#ffcb6b', '#89ddff'];

interface Line { indent: number; segs: { len: number; c: number }[] }
function makeLines(seed: number): Line[] {
  const r = rng(seed * 7919 + 13);
  const out: Line[] = [];
  for (let i = 0; i < 48; i++) {
    const segs = [];
    const n = 1 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) segs.push({ len: 3 + Math.floor(r() * 10), c: Math.floor(r() * (KW.length + 2)) });
    out.push({ indent: r() < 0.25 ? 0 : r() < 0.6 ? 2 : 4, segs });
  }
  return out;
}

export class ScreenCanvas {
  c; mat: THREE.MeshBasicMaterial; private lines: Line[]; private lastKey = '';
  constructor(public w: number, public h: number, seed: number) {
    this.c = makeCanvasTex(w, h);
    this.mat = new THREE.MeshBasicMaterial({ map: this.c.tex, toneMapped: false });
    this.lines = makeLines(seed);
  }
  setGain(g: number): void { this.mat.color.setScalar(g); }

  draw(mode: ScreenMode, t: number, accent: string, progress: number, extra = ''): void {
    const { ctx, tex } = this.c;
    const { w, h } = this;
    const key = mode;
    void key;
    if (mode === 'off') {
      if (this.lastKey === 'off') return;
      ctx.fillStyle = '#06070a'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#12151c'; ctx.fillRect(0, 0, w, 1);
      this.lastKey = 'off'; tex.needsUpdate = true; return;
    }
    this.lastKey = mode;
    if (mode === 'code' || mode === 'think') {
      ctx.fillStyle = '#10141f'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent; ctx.fillRect(0, 0, w, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(2, 1, 12, 2);
      ctx.fillStyle = '#1a2133'; ctx.fillRect(0, 4, 8, h - 4);
      const rows = Math.floor((h - 5) / 3);
      const speed = mode === 'code' ? 7 : 1.1;
      const off = Math.floor(t * speed);
      for (let r = 0; r < rows; r++) {
        const L = this.lines[(r + off) % this.lines.length];
        let x = 10 + L.indent;
        const y = 6 + r * 3;
        for (const s of L.segs) {
          ctx.fillStyle = KW[s.c % KW.length] ?? '#aab4d0';
          if (s.c >= KW.length) ctx.fillStyle = '#8791b0';
          const len = Math.min(s.len, w - x - 2);
          if (len > 0) ctx.fillRect(x, y, len, 2);
          x += s.len + 2;
          if (x > w - 3) break;
        }
        ctx.fillStyle = '#3a4560'; ctx.fillRect(2, y, 4, 2);
      }
      if (Math.floor(t * 2) % 2 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(10 + ((off * 5) % 20), 6 + (rows - 1) * 3, 2, 2); }
    } else if (mode === 'wait') {
      ctx.fillStyle = '#0d1424'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent; ctx.fillRect(0, 0, w, 4);
      const cx = Math.floor(w / 2), cy = Math.floor(h / 2) - 3;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const bright = ((Math.floor(t * 8) - i + 80) % 8) / 8;
        const v = Math.floor(70 + (1 - bright) * 185);
        ctx.fillStyle = `rgb(${v},${v},${Math.min(255, v + 20)})`;
        ctx.fillRect(Math.round(cx + Math.cos(a) * 6) - 1, Math.round(cy + Math.sin(a) * 6) - 1, 2, 2);
      }
      ctx.fillStyle = '#26324e'; ctx.fillRect(6, h - 8, w - 12, 4);
      ctx.fillStyle = '#5ad17a'; ctx.fillRect(6, h - 8, Math.max(2, Math.floor((w - 12) * Math.min(1, progress))), 4);
    } else if (mode === 'help') {
      const flash = Math.floor(t * 3) % 2 === 0;
      ctx.fillStyle = flash ? '#2e2606' : '#201a04'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffd25a'; ctx.fillRect(0, 0, w, 4);
      const bx = Math.floor(w / 2) - 14, by = 7;
      ctx.fillStyle = '#10141f'; ctx.fillRect(bx - 1, by - 1, 30, 22);
      ctx.fillStyle = '#ffd25a'; ctx.fillRect(bx, by, 28, 20);
      ctx.fillRect(bx + 6, by + 20, 4, 3);
      drawTextCentered(ctx, '?', Math.floor(w / 2), by + 3, '#10141f', 2);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = (Math.floor(t * 3) + i) % 3 === 0 ? '#ffd25a' : '#5a4a14'; ctx.fillRect(Math.floor(w / 2) - 7 + i * 6, h - 7, 4, 4); }
    } else if (mode === 'blocked') {
      const flash = Math.floor(t * 3) % 2 === 0;
      ctx.fillStyle = flash ? '#3a0c12' : '#2a080c'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e5484d'; ctx.fillRect(0, 0, w, 4);
      const bx = Math.floor(w / 2) - 14, by = 9;
      ctx.fillStyle = '#ffeaea'; ctx.fillRect(bx, by, 28, 18);
      ctx.fillStyle = '#e5484d'; ctx.fillRect(bx, by, 28, 4);
      ctx.fillStyle = '#e5484d'; ctx.fillRect(bx + 12, by + 7, 4, 7); ctx.fillRect(bx + 12, by + 15, 4, 2);
      ctx.fillStyle = '#e5484d'; ctx.fillRect(4, h - 7, w - 8, 2); ctx.fillRect(4, h - 4, Math.floor((w - 8) * 0.6), 2);
    } else if (mode === 'review') {
      ctx.fillStyle = '#0e1220'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent; ctx.fillRect(0, 0, w, 4);
      const rows = Math.floor((h - 5) / 3);
      const off = Math.floor(t * 1.6);
      for (let r = 0; r < rows; r++) {
        const L = this.lines[(r + off) % this.lines.length];
        const kind = (r + off) % 5;
        ctx.fillStyle = kind === 1 || kind === 2 ? 'rgba(80,220,120,0.35)' : kind === 4 ? 'rgba(235,80,90,0.4)' : 'rgba(0,0,0,0)';
        ctx.fillRect(0, 6 + r * 3 - 1, w, 3);
        ctx.fillStyle = kind === 1 || kind === 2 ? '#7dffa0' : kind === 4 ? '#ff7a85' : '#6b7596';
        ctx.fillRect(3, 6 + r * 3, 2, 1);
        ctx.fillRect(8 + L.indent, 6 + r * 3, Math.min(w - 12, 6 + L.segs[0].len * 2), 2);
      }
    } else if (mode === 'plan') {
      ctx.fillStyle = '#0f1424'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent; ctx.fillRect(0, 0, w, 4);
      const cols = 4, cw = Math.floor((w - 4) / cols);
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = '#26304e'; ctx.fillRect(2 + c * cw, 6, cw - 1, h - 8);
        const n = 2 + ((c * 3 + Math.floor(t / 3)) % 4);
        for (let k = 0; k < n; k++) { ctx.fillStyle = ['#5ad17a', '#f2c94c', '#f08a3c', '#e5484d'][(c + k) % 4]; ctx.fillRect(3 + c * cw, 8 + k * 4, cw - 3, 3); }
      }
    } else {
      // idle screensaver: bouncing logo
      ctx.fillStyle = '#080b14'; ctx.fillRect(0, 0, w, h);
      const px = Math.abs(((t * 6) % ((w - 10) * 2)) - (w - 10)), py = Math.abs(((t * 4) % ((h - 8) * 2)) - (h - 8));
      ctx.fillStyle = accent; ctx.fillRect(Math.floor(px), Math.floor(py), 8, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(Math.floor(px) + 1, Math.floor(py) + 1, 3, 1);
      if (extra) drawTextCentered(ctx, extra, w / 2, h - 8, '#1d2a44', 1);
    }
    tex.needsUpdate = true;
  }

  /** Browser-test mini window (side monitor). active = a test run is happening. */
  drawBrowser(active: boolean, t: number, accent: string, ok: boolean): void {
    const { ctx, tex } = this.c;
    const { w, h } = this;
    if (!active) {
      if (this.lastKey === 'bdim') return;
      this.lastKey = 'bdim';
      ctx.fillStyle = '#0a0d16'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1b2236'; ctx.fillRect(0, 0, w, 3);
      tex.needsUpdate = true; return;
    }
    this.lastKey = 'bon';
    ctx.fillStyle = '#e9edf5'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c4cbd9'; ctx.fillRect(0, 0, w, 4);
    ctx.fillStyle = '#ff6b6b'; ctx.fillRect(1, 1, 2, 2); ctx.fillStyle = '#ffd25a'; ctx.fillRect(4, 1, 2, 2); ctx.fillStyle = '#5ad17a'; ctx.fillRect(7, 1, 2, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(11, 1, w - 13, 2);
    ctx.fillStyle = accent; ctx.fillRect(2, 6, w - 4, 4);
    const p = Math.floor(t * 2) % 4;
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i === p % 3 ? '#9ec5ff' : '#d3d9e6'; ctx.fillRect(2 + i * Math.floor((w - 2) / 3), 12, Math.floor((w - 2) / 3) - 2, 8); }
    ctx.fillStyle = '#9aa3b8'; ctx.fillRect(2, h - 4, w - 8, 1);
    ctx.fillStyle = ok ? '#2fb85a' : '#e5484d';
    const bx = w - 9, by = h - 8;
    if (Math.floor(t * 1.5) % 2 === 0) { ctx.fillRect(bx, by + 2, 2, 2); ctx.fillRect(bx + 2, by + 4, 2, 2); ctx.fillRect(bx + 4, by, 2, 4); }
    tex.needsUpdate = true;
  }
}
export { drawText };
