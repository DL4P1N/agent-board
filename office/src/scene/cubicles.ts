import * as THREE from 'three';
import { DESKS, CUBICLE, type DeskSlot } from '../layout';
import type { AgentState } from '../types';
import { BoxBuilder, meshFrom, rng } from './builder';
import { ACCENT, plant, mug, duck, figurine, booksStack, cactus, photoFrame, paperStack } from './props';
import { ScreenCanvas, type ScreenMode } from './screens';
import { glowTexture, makeCanvasTex } from './textures';
import { drawText, textWidth } from './pixelFont';
import type { Shared } from './shared';
import type { Palette } from './palettes';

const WARM = new THREE.Color(0xffd9a0);
const FABRIC = [0x7b8fb8, 0x9a86b8, 0x7eaa98, 0xc0a07e];
const SIDE_STEP = 1.9; // north part of the side partitions is taller

/** Static geometry for one cubicle (partitions, desk, drawers, keyboard...). */
export function buildCubicleStatic(b: BoxBuilder, d: DeskSlot): void {
  const { x: cx, z: cz } = d.center;
  const r = rng(d.index * 131 + 7);
  const fab = FABRIC[d.col % FABRIC.length];
  const trim = 0xdcdce4;
  const W = CUBICLE.width, D = CUBICLE.depth;
  // north partition
  b.box(cx, 0.75, cz - D / 2 + 0.05, W, 1.5, 0.1, fab);
  b.box(cx, 1.53, cz - D / 2 + 0.05, W + 0.08, 0.06, 0.16, trim);
  // side partitions (stepped)
  for (const sx of [-1, 1]) {
    const x = cx + sx * (W / 2 - 0.05);
    b.box(x, 0.65, cz - D / 2 + SIDE_STEP / 2, 0.1, 1.3, SIDE_STEP, fab);
    b.box(x, 1.33, cz - D / 2 + SIDE_STEP / 2, 0.16, 0.06, SIDE_STEP, trim);
    const lowLen = D - SIDE_STEP;
    b.box(x, 0.42, cz - D / 2 + SIDE_STEP + lowLen / 2, 0.1, 0.84, lowLen, fab);
    b.box(x, 0.86, cz - D / 2 + SIDE_STEP + lowLen / 2, 0.16, 0.05, lowLen, trim);
    b.box(x, 0.8, cz - D / 2 + 0.05, 0.14, 1.6, 0.14, 0x4a4a58);
  }
  // pinboard + notes on the west partition's inner face (faces +x, visible from the camera)
  const px = cx - W / 2 + 0.11;
  b.box(px, 1.0, cz - 0.75, 0.03, 0.55, 1.15, 0xb98b5a);
  const noteCols = [0xffe36a, 0xff9ab8, 0x8ad8ff, 0xa8f08a, 0xffb86a];
  for (let i = 0; i < 6; i++) {
    b.box(px + 0.02, 0.88 + r() * 0.26, cz - 1.25 + i * 0.17 + r() * 0.05, 0.015, 0.12, 0.12, noteCols[Math.floor(r() * 5)], 0, (r() - 0.5) * 0.4);
  }
  // little wall item above the monitors on the north partition's inner face
  const wx = cx + 1.15;
  b.box(wx, 1.2, cz - D / 2 + 0.11, 0.38, 0.28, 0.02, 0xf4f0e6);
  b.box(wx, 1.2, cz - D / 2 + 0.122, 0.3, 0.2, 0.01, [0x5a8ad0, 0xd0705a, 0x5ab870][d.index % 3]);

  // desk
  b.box(cx, 0.72, cz - 0.56, 3.12, 0.06, 1.5, 0xd0a46c);
  b.box(cx, 0.745, cz + 0.18, 3.12, 0.012, 0.03, 0xe8c48c);
  b.box(cx - 1.5, 0.36, cz - 0.56, 0.06, 0.7, 1.4, 0x6a4a32);
  b.box(cx + 1.12, 0.36, cz - 0.58, 0.66, 0.7, 1.36, 0x8a6a48);
  for (let i = 0; i < 3; i++) {
    b.box(cx + 1.12, 0.17 + i * 0.22, cz + 0.11, 0.6, 0.18, 0.02, 0xa07e56);
    b.box(cx + 1.12, 0.21 + i * 0.22, cz + 0.125, 0.18, 0.025, 0.015, 0xd8d8e0);
  }
  b.box(cx - 0.95, 0.27, cz - 0.7, 0.22, 0.48, 0.42, 0x23252e); // PC tower
  b.box(cx - 0.95, 0.4, cz - 0.48, 0.12, 0.02, 0.01, 0x5ad8ff);
  // keyboard/mouse
  b.box(cx + 0.02, 0.768, cz + 0.03, 0.66, 0.025, 0.22, 0x2a2e3a);
  b.box(cx + 0.02, 0.783, cz + 0.03, 0.6, 0.006, 0.16, 0x4a5064);
  b.box(cx + 0.55, 0.765, cz + 0.05, 0.2, 0.014, 0.22, 0x3a3f52);
  b.box(cx + 0.55, 0.778, cz + 0.05, 0.06, 0.02, 0.1, 0xe8e8f0);
  // monitor stands
  b.box(cx + 0.05, 0.775, cz - 0.62, 0.32, 0.03, 0.22, 0x2a2e3a);
  b.box(cx + 0.05, 0.9, cz - 0.64, 0.07, 0.24, 0.05, 0x2a2e3a);
  b.box(cx + 0.05, 1.17, cz - 0.7, 0.7, 0.4, 0.06, 0x20222c); // back housing
  const sx = cx - 0.98, sz = cz - 0.7;
  b.box(sx, 0.775, sz, 0.26, 0.03, 0.2, 0x2a2e3a, 0.5);
  b.box(sx, 0.88, sz, 0.06, 0.2, 0.05, 0x2a2e3a, 0.5);
  // lamp
  b.box(cx + 1.24, 0.775, cz - 1.12, 0.18, 0.03, 0.18, 0x2a2a34);
  b.box(cx + 1.24, 0.95, cz - 1.12, 0.03, 0.34, 0.03, 0x2a2a34);
  b.box(cx + 1.16, 1.11, cz - 1.12, 0.14, 0.03, 0.03, 0x2a2a34);
  // decor
  mug(b, cx + 0.74, 0.75, cz - 1.08, [0xd0524a, 0xf0f0f0, 0x4a82d0, 0xffd25a][d.index % 4]);
  const pick = (slot: number, x: number, z: number) => {
    const k = Math.floor(r() * 6);
    if (k === 0) plant(b, x, z, 0.55, d.index * 10 + slot, 0.75);
    else if (k === 1) cactus(b, x, 0.75, z);
    else if (k === 2) duck(b, x, 0.75, z);
    else if (k === 3) figurine(b, x, 0.75, z, [0xe5484d, 0x4a82d0, 0xd97757, 0x5ad17a][d.index % 4], 0xffe0b8);
    else if (k === 4) booksStack(b, x, 0.75, z, d.index * 3 + slot);
    else photoFrame(b, x, 0.75, z, [0x8ad8ff, 0xffb88a, 0xa8f08a][d.index % 3]);
  };
  pick(0, cx + 1.25, cz - 0.2);
  pick(1, cx - 1.4, cz + 0.0);
  // wastebasket
  b.box(cx + 1.5, 0.16, cz + 0.85, 0.24, 0.32, 0.24, 0x4a4e5e);
  b.box(cx + 1.5, 0.33, cz + 0.85, 0.2, 0.02, 0.2, 0x1a1a22);
}

interface Parts { bezelMain: THREE.Mesh; bezelSide: THREE.Mesh; trim: THREE.Mesh; shade: THREE.Mesh; cushions: THREE.Mesh }

export class DeskVis {
  group = new THREE.Group();
  chair = new THREE.Group();
  main: ScreenCanvas;
  side: ScreenCanvas;
  parts: Parts;
  glowMat: THREE.MeshBasicMaterial;
  glow: THREE.Mesh;
  cardTex: ReturnType<typeof makeCanvasTex>;
  cardKey = '';
  paper: THREE.Mesh;
  tent: THREE.Mesh;
  occupied = false;
  acc = Math.random();
  glowCur = 0;
  chairZ: number;
  private kind: 'claude' | 'codex' | 'off' = 'off';
  private screenMode: ScreenMode | '' = '';

  constructor(public d: DeskSlot, private sh: Shared) {
    const { x: cx, z: cz } = d.center;
    this.main = new ScreenCanvas(64, 40, d.index + 1);
    this.side = new ScreenCanvas(40, 26, d.index + 50);
    // screens
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.52), this.main.mat);
    m.position.set(cx + 0.05, 1.19, cz - 0.62 + 0.036);
    this.group.add(m);
    const sg = new THREE.Group();
    sg.position.set(cx - 0.98, 0, cz - 0.7);
    sg.rotation.y = 0.55;
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.34), this.side.mat);
    sm.position.set(0, 1.04, 0.03);
    sg.add(sm);
    const bezelSide = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.05), sh.lam.off);
    bezelSide.position.set(0, 1.04, 0);
    bezelSide.castShadow = true;
    sg.add(bezelSide);
    this.group.add(sg);
    const bezelMain = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.07), sh.lam.off);
    bezelMain.position.set(cx + 0.05, 1.18, cz - 0.62);
    bezelMain.castShadow = true;
    this.group.add(bezelMain);

    // trim (top of partitions) - dynamic colour
    const tb = new BoxBuilder();
    const W = CUBICLE.width, D = CUBICLE.depth;
    tb.box(cx, 1.575, cz - D / 2 + 0.05, W + 0.1, 0.03, 0.18, 0xffffff);
    for (const s of [-1, 1]) {
      const x = cx + s * (W / 2 - 0.05);
      tb.box(x, 1.375, cz - D / 2 + SIDE_STEP / 2, 0.18, 0.03, SIDE_STEP + 0.02, 0xffffff);
      tb.box(x, 0.885, cz - D / 2 + SIDE_STEP + (D - SIDE_STEP) / 2, 0.18, 0.03, D - SIDE_STEP, 0xffffff);
    }
    const trim = meshFrom(tb, sh.lam.off, false, false);
    this.group.add(trim);

    // lamp shade
    const shade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.2), sh.lampOn.off);
    shade.position.set(cx + 1.12, 1.1, cz - 1.12);
    shade.rotation.z = 0.25;
    this.group.add(shade);

    // chair (cushions swap accent colour)
    const base = new BoxBuilder();
    base.box(0, 0.04, 0, 0.56, 0.04, 0.07, 0x2a2a34).box(0, 0.04, 0, 0.07, 0.04, 0.56, 0x2a2a34).box(0, 0.045, 0, 0.4, 0.04, 0.4, 0x2a2a34, Math.PI / 4);
    base.box(0, 0.14, 0, 0.07, 0.2, 0.07, 0x3a3a46);
    for (const [wx, wz] of [[0.26, 0], [-0.26, 0], [0, 0.26], [0, -0.26]]) base.box(wx, 0.015, wz, 0.07, 0.03, 0.07, 0x15151a);
    this.chair.add(meshFrom(base, sh.vc));
    const cb = new BoxBuilder();
    cb.box(0, 0.255, 0.03, 0.54, 0.09, 0.64, 0xffffff);
    cb.box(0, 0.58, 0.42, 0.5, 0.5, 0.07, 0xffffff);
    cb.box(0.29, 0.42, 0.08, 0.05, 0.03, 0.34, 0x333340);
    cb.box(-0.29, 0.42, 0.08, 0.05, 0.03, 0.34, 0x333340);
    cb.box(0.29, 0.35, 0.2, 0.04, 0.14, 0.04, 0x333340);
    cb.box(-0.29, 0.35, 0.2, 0.04, 0.14, 0.04, 0x333340);
    const cushions = meshFrom(cb, sh.lam.off);
    this.chair.add(cushions);
    this.chairZ = cz + 0.55;
    this.chair.position.set(cx, 0, cz - 0.1);
    this.group.add(this.chair);

    // glow pool on the floor + desk
    this.glowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.8), this.glowMat);
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.set(cx + 0.3, 0.07, cz + 0.1);
    this.glow.renderOrder = 2;
    this.group.add(this.glow);

    // name/owner tent card
    this.cardTex = makeCanvasTex(56, 24, true);
    const cardMat = new THREE.MeshBasicMaterial({ map: this.cardTex.tex, toneMapped: false });
    const side = new THREE.MeshLambertMaterial({ color: 0xf4ecd8 });
    this.tent = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.02), [side, side, side, side, cardMat, side]);
    this.tent.position.set(cx - 0.55, 0.86, cz + 0.08);
    this.tent.rotation.x = -0.3;
    this.group.add(this.tent);

    // ticket papers on the desk
    const pb = new BoxBuilder();
    paperStack(pb, 0, 0.75, 0, 7, d.index + 3, 0xf6f1e3, 0.26, 0.34);
    this.paper = meshFrom(pb, sh.vc);
    this.paper.position.set(cx + 0.9, 0, cz - 0.15);
    this.paper.rotation.y = 0.2;
    this.paper.visible = false;
    this.group.add(this.paper);

    this.parts = { bezelMain, bezelSide, trim, shade, cushions };
    this.main.draw('off', 0, '#000', 0);
    this.side.drawBrowser(false, 0, '#000', true);
    this.setLook('off');
  }

  private setLook(k: 'claude' | 'codex' | 'off'): void {
    if (k === this.kind) return;
    this.kind = k;
    const s = this.sh;
    this.parts.bezelMain.material = s.lam[k];
    this.parts.bezelSide.material = s.lam[k];
    this.parts.trim.material = k === 'off' ? s.lam.off : s.lam[k];
    this.parts.shade.material = s.lampOn[k];
    this.parts.cushions.material = s.lam[k];
  }

  private drawCard(name: string, owner: string, color: string): void {
    const key = name + '|' + owner + '|' + color;
    if (key === this.cardKey) return;
    this.cardKey = key;
    const { ctx, tex } = this.cardTex;
    ctx.fillStyle = '#f4ecd8'; ctx.fillRect(0, 0, 56, 24);
    ctx.fillStyle = color; ctx.fillRect(0, 0, 56, 3); ctx.fillRect(0, 0, 3, 24);
    ctx.fillStyle = '#1e2030';
    const n = name.length > 8 ? name.slice(0, 8) : name;
    drawText(ctx, n, 28 - textWidth(n) / 2 + 1, 6, '#1e2030', 1);
    const o = ('@' + owner).slice(0, 9);
    drawText(ctx, o, 28 - textWidth(o) / 2 + 1, 15, '#6a6a7a', 1);
    tex.needsUpdate = true;
  }

  update(agent: AgentState | null, t: number, dt: number, pal: Palette, reduced: boolean): void {
    const occ = !!agent;
    this.occupied = occ;
    const asleep = !occ || agent!.phase === 'offline' || agent!.pose === 'sleep';
    const kind: 'claude' | 'codex' | 'off' = !occ ? 'off' : agent!.provider;
    this.setLook(kind);
    const accentHex = kind === 'off' ? '#556' : '#' + ACCENT[kind as 'claude' | 'codex'].toString(16).padStart(6, '0');
    // chair push
    const targetZ = occ ? this.chairZ : this.d.center.z - 0.1;
    this.chair.position.z += (targetZ - this.chair.position.z) * (1 - Math.exp(-5 * dt));
    this.chair.rotation.y = occ ? 0 : 0.12 * (this.d.index % 3 - 1);
    // tent card
    if (occ) this.drawCard(agent!.name, agent!.owner, agent!.ownerColor ?? '#888888');
    else this.drawCard('VACANT', '', '#8a8aa0');
    this.tent.position.y = 0.86;
    // glow
    const glowTarget = !occ || asleep ? 0 : 1;
    this.glowCur += (glowTarget - this.glowCur) * (1 - Math.exp(-3 * dt));
    const flick = reduced ? 1 : 0.94 + 0.06 * Math.sin(t * 5 + this.d.index);
    this.glowMat.opacity = this.glowCur * pal.lampStrength * 0.55 * flick;
    if (kind !== 'off') this.glowMat.color.setHex(ACCENT[kind as 'claude' | 'codex']).lerp(WARM, 0.55);
    this.parts.shade.material = asleep ? this.sh.lampOn.off : this.sh.lampOn[kind];
    // papers
    this.paper.visible = !!agent && !!agent.ticketId && !agent.carrying && ['working', 'waiting', 'blocked', 'reworking', 'awaiting_review', 'asking_help', 'awaiting_help', 'helping'].includes(agent.phase);

    // screens (low rate)
    this.acc += dt;
    const period = reduced ? 0.4 : 0.16;
    if (this.acc < period) return;
    this.acc = 0;
    const gain = pal.screenGain;
    this.main.setGain(gain); this.side.setGain(gain);
    let mode: ScreenMode = 'off';
    if (occ && !asleep) {
      const a = agent!;
      if (a.pose === 'blocked' || a.phase === 'blocked') mode = 'blocked';
      else if (a.phase === 'asking_help' || a.pose === 'raise_hand') mode = 'help';
      else if (a.pose === 'type' || a.phase === 'working' || a.phase === 'reworking' || a.phase === 'helping') mode = 'code';
      else if (a.pose === 'think') mode = 'think';
      else if (a.pose === 'wait' || a.phase === 'waiting' || a.phase === 'awaiting_review' || a.phase === 'awaiting_help') mode = 'wait';
      else if (a.pose === 'review') mode = 'review';
      else mode = 'idle';
    } else if (occ) mode = 'idle';
    this.screenMode = mode;
    this.main.draw(mode, t, agent && agent.phase === 'awaiting_help' ? '#ffd25a' : accentHex, agent ? agent.phaseProgress : 0, occ && asleep ? 'ZZZ' : '');
    const active = mode === 'code' || mode === 'think' || mode === 'review';
    this.side.drawBrowser(active, t, accentHex, !(agent && agent.phase === 'reworking'));
  }

  get mode(): string { return this.screenMode; }
}

export class Cubicles {
  group = new THREE.Group();
  desks: DeskVis[] = [];
  constructor(sh: Shared) {
    const sb = new BoxBuilder();
    for (const d of DESKS) {
      buildCubicleStatic(sb, d);
      const dv = new DeskVis(d, sh);
      this.desks.push(dv);
      this.group.add(dv.group);
    }
    this.group.add(meshFrom(sb, sh.vc));
  }
  update(agents: AgentState[], t: number, dt: number, pal: Palette, reduced: boolean): void {
    for (const dv of this.desks) {
      const a = agents.find((x) => x.role === 'worker' && x.deskIndex === dv.d.index) ?? null;
      dv.update(a, t, dt, pal, reduced);
    }
  }
}
