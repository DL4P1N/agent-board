import * as THREE from 'three';
import { BoxBuilder, meshFrom } from './builder';
import { makeCanvasTex } from './textures';
import { drawText, drawTextCentered, textWidth } from './pixelFont';
import type { SimState } from '../types';
import type { StationCtx, StationUpdate } from './stations';

const W = 128, H = 72;
export const TV_POS = { x: 6.9, y: 3.0, z: -10.84 };
const TV_W = 3.0, TV_H = TV_W * H / W;

function fmtClock(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
function clip(s: string, n: number): string { return s.length > n ? s.slice(0, n) : s; }

const STAGE_COL: Record<string, string> = { idle: '#7f8ab0', kickoff: '#4ac8ff', build: '#ffd25a', polish: '#c792ea', demo: '#ff9a4a', submitted: '#5ad17a' };

/** Hackathon scoreboard TV on the north wall. Redraws at ~2 fps (and immediately on stage changes). */
export class ScoreboardTV {
  group = new THREE.Group();
  private c = makeCanvasTex(W, H, true);
  private mat: THREE.MeshBasicMaterial;
  private acc = 99;
  private beat = 0;
  private lastStage = '';
  private lastSig = '';
  private confettiAcc = 0;
  private fx: StationCtx['fx'];

  constructor(ctx: StationCtx) {
    this.fx = ctx.fx;
    const b = new BoxBuilder();
    const { x, y, z } = TV_POS;
    b.box(x, y, z - 0.04, TV_W + 0.22, TV_H + 0.22, 0.12, 0x1a1c26);                 // bezel
    b.box(x, y - TV_H / 2 - 0.16, z - 0.02, TV_W * 0.5, 0.06, 0.1, 0x2a2e3a);        // speaker bar
    b.box(x, y + TV_H / 2 + 0.2, z - 0.05, 0.9, 0.05, 0.05, 0x2a2e3a);               // hanger
    for (const sx of [-1, 1]) b.box(x + sx * (TV_W / 2 + 0.06), y, z + 0.01, 0.03, TV_H + 0.22, 0.03, 0x3a3e4e);
    b.box(x + TV_W / 2 - 0.1, y - TV_H / 2 - 0.07, z + 0.03, 0.05, 0.025, 0.02, 0x5ad17a); // power led
    this.group.add(meshFrom(b, ctx.sh.vc, false, false));
    this.mat = new THREE.MeshBasicMaterial({ map: this.c.tex, toneMapped: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(TV_W, TV_H), this.mat);
    plane.position.set(x, y, z + 0.025);
    this.group.add(plane);
    this.draw(null, 0);
  }

  private bar(x: number, y: number, w: number, h: number, v: number, col: string): void {
    const { ctx } = this.c;
    ctx.fillStyle = '#05060e'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#2a3150'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, Math.round((w - 2) * Math.max(0, Math.min(1, v))), h - 2);
  }

  private draw(s: SimState | null, t: number): void {
    const { ctx, tex } = this.c;
    ctx.fillStyle = '#0b0e1c'; ctx.fillRect(0, 0, W, H);
    const hack = s?.hack;
    if (!s || !hack) { drawTextCentered(ctx, 'STANDBY', W / 2, 32, '#4a5278', 2); tex.needsUpdate = true; return; }
    const blink = this.beat % 2 === 0;
    const merged = s.metrics?.merged ?? 0;
    const total = Math.max(s.plan?.totalTickets ?? 0, s.tickets?.length ?? 0, merged);

    if (!hack.active) {
      // sprint mode: plan name + elapsed time
      ctx.fillStyle = '#262e4a'; ctx.fillRect(0, 0, W, 11);
      ctx.fillStyle = '#d97757'; ctx.fillRect(0, 0, 4, 11); ctx.fillStyle = '#2dd4bf'; ctx.fillRect(4, 0, 2, 11);
      drawText(ctx, 'SPRINT', 10, 2, '#ffffff', 1);
      const name = (s.plan?.name ?? 'PLAN').toUpperCase();
      drawText(ctx, clip(name, 20), 4, 15, '#9fb0e0', 1);
      if (name.length > 20) drawText(ctx, clip(name.slice(20), 20), 4, 23, '#9fb0e0', 1);
      drawText(ctx, 'SIM TIME', 4, 33, '#7f8ab0', 1);
      const clock = fmtClock(s.time);
      const sc = clock.length > 5 ? 2 : 3;
      drawTextCentered(ctx, clock, W / 2, 41, '#e8ecff', sc);
      const dl = s.plan?.deadlineMinutes ?? 0;
      if (dl > 0) this.bar(4, 62, 120, 6, s.time / (dl * 60), '#5ad17a');
      else drawText(ctx, 'MERGED ' + merged + '/' + total, 4, 62, '#5ad17a', 1);
      tex.needsUpdate = true;
      return;
    }

    const left = hack.endsAt - s.time;
    const submitted = hack.stage === 'submitted';
    // header
    const stageCol = STAGE_COL[hack.stage] ?? '#9aa4c0';
    ctx.fillStyle = '#262e4a'; ctx.fillRect(0, 0, W, 10);
    ctx.fillStyle = '#d97757'; ctx.fillRect(0, 0, 3, 10);
    const stage = hack.stage.toUpperCase();
    const sw = textWidth(stage) + 6;
    const proj = clip((hack.project || 'HACKATHON').toUpperCase(), Math.max(3, Math.floor((W - sw - 12) / 6)));
    drawText(ctx, proj, 6, 1, '#ffffff', 1);
    ctx.fillStyle = stageCol; ctx.fillRect(W - sw - 2, 1, sw, 8);
    drawText(ctx, stage, W - sw + 1, 2, '#10141f', 1);

    if (submitted) {
      ctx.fillStyle = blink ? '#5ad17a' : '#2f8a4c';
      ctx.fillRect(0, 10, W, 2); ctx.fillRect(0, H - 2, W, 2); ctx.fillRect(0, 10, 2, H - 10); ctx.fillRect(W - 2, 10, 2, H - 10);
      drawTextCentered(ctx, 'SUBMITTED', W / 2, 21, '#7dff9a', 2);
      drawTextCentered(ctx, 'GOOD LUCK!', W / 2, 36, '#c8ffd8', 1);
      drawTextCentered(ctx, 'MERGED ' + merged + '/' + total, W / 2, 46, '#ffffff', 1);
      drawTextCentered(ctx, clip((hack.pitch || '').toUpperCase(), 21), W / 2, 56, '#ffd25a', 1);
      this.bar(14, 65, 100, 5, 1, '#5ad17a');
      tex.needsUpdate = true;
      return;
    }

    // countdown
    const mins = left / 60;
    const col = left <= 0 ? '#ff4a52' : mins <= 5 ? '#ff4a52' : mins <= 15 ? '#ffb23c' : '#7dff9a';
    const urgent = left <= 0 || mins <= 5;
    if (urgent && blink) { ctx.fillStyle = '#3a0c14'; ctx.fillRect(0, 10, W, 31); }
    drawTextCentered(ctx, left <= 0 ? 'TIME' : 'DEMO IN', W / 2, 13, '#9fb0e0', 1);
    const clock = fmtClock(left);
    const sc = clock.length > 5 ? 2 : 3;
    drawTextCentered(ctx, clock, W / 2, sc === 3 ? 22 : 25, col, sc);
    // readiness bar
    drawText(ctx, 'READY', 4, 45, '#9fb0e0', 1);
    const pct = Math.round(Math.max(0, Math.min(1, hack.demoReadiness)) * 100);
    this.bar(38, 44, 66, 9, hack.demoReadiness, pct >= 80 ? '#5ad17a' : pct >= 50 ? '#ffd25a' : '#4ac8ff');
    drawText(ctx, pct + '%', 108, 45, '#ffffff', 1);
    // footer: deploy chip, scope cuts, merged
    const dcol = hack.deployStatus === 'live' ? '#5ad17a' : hack.deployStatus === 'building' ? (blink ? '#ffd25a' : '#a07c1c') : hack.deployStatus === 'failed' ? '#ff4a52' : '#5a6488';
    const dtxt = 'DEPLOY ' + (hack.deployStatus === 'none' ? '--' : hack.deployStatus.toUpperCase());
    ctx.fillStyle = dcol; ctx.fillRect(3, 56, textWidth(dtxt) + 4, 9);
    drawText(ctx, dtxt, 5, 57, '#10141f', 1);
    const cuts = 'CUTS ' + hack.scopeCuts;
    drawText(ctx, cuts, W - 4 - textWidth(cuts), 57, hack.scopeCuts > 0 ? '#ff9a4a' : '#7f8ab0', 1);
    drawText(ctx, 'MERGED ' + merged + '/' + total, 4, 66, '#c8d0f0', 1);
    tex.needsUpdate = true;
  }

  update(u: StationUpdate): void {
    const s = u.state;
    this.mat.color.setScalar(u.pal.screenGain);
    const stage = s.hack?.stage ?? '';
    const stageChanged = stage !== this.lastStage;
    this.acc += u.dt;
    if (stageChanged || this.acc >= 0.5) {
      this.acc = 0; this.beat++;
      this.lastStage = stage;
      this.draw(s, u.t);
      if (stageChanged && stage === 'submitted') this.fx.confetti(TV_POS.x, TV_POS.y + 1.2, TV_POS.z + 0.5, 70, 2.4);
    }
    if (stage === 'submitted' && !u.reduced) {
      this.confettiAcc += u.dt;
      if (this.confettiAcc > 3.5) { this.confettiAcc = 0; this.fx.confetti(TV_POS.x + (Math.random() - 0.5) * 2.4, TV_POS.y + 1.6, TV_POS.z + 0.6, 22, 1.4); }
    }
  }
}
