import * as THREE from 'three';
import { STATIONS } from '../layout';
import { SKILLS, type Skill } from '../skills';
import { SkillIndex, type SkillLike } from './skillLookup';
import type { AgentState, SimState, Ticket } from '../types';
import { BoxBuilder, meshFrom, rng } from './builder';
import { ACCENT, DIFF_COLORS, paperStack, plant, mug, lampMesh, bookshelfDecor, shade } from './props';
import { ScreenCanvas } from './screens';
import { glowTexture, hex, makeCanvasTex, makeSignTex } from './textures';
import { drawText, drawTextCentered, textWidth } from './pixelFont';
import type { Shared } from './shared';
import type { Palette } from './palettes';
import type { ParticlePool } from './effects';

export interface StationCtx { sh: Shared; fx: ParticlePool; tint: (m: THREE.MeshBasicMaterial) => void }

export interface StationUpdate { state: SimState; t: number; dt: number; pal: Palette; reduced: boolean; live?: boolean }

function signPlane(ctx: StationCtx, text: string, bg: string, fg: string, border: string, height: number, scale = 1): THREE.Mesh {
  const { tex, aspect } = makeSignTex(text, bg, fg, border, scale);
  const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  ctx.tint(m);
  return new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), m);
}

/** A row of pop-in/out paper stack slots. */
class PopSlots {
  meshes: THREE.Mesh[] = [];
  s: number[] = [];
  v: number[] = [];
  constructor(parent: THREE.Object3D, positions: [number, number, number][], geos: THREE.BufferGeometry[], mat: THREE.Material) {
    positions.forEach((p, i) => {
      const m = new THREE.Mesh(geos[i % geos.length], mat);
      m.position.set(...p);
      m.castShadow = true; m.receiveShadow = true;
      m.scale.setScalar(0.0001);
      parent.add(m);
      this.meshes.push(m); this.s.push(0); this.v.push(0);
    });
  }
  /** Spring impulse on slot i (a visible "bump" when a paper lands on it). */
  kick(i: number, amount = 5): void {
    if (i >= 0 && i < this.v.length) this.v[i] += amount;
  }
  update(count: number, dt: number): void {
    for (let i = 0; i < this.meshes.length; i++) {
      const target = i < count ? 1 : 0;
      this.v[i] += (target - this.s[i]) * 160 * dt;
      this.v[i] *= Math.exp(-11 * dt);
      this.s[i] = Math.max(0, this.s[i] + this.v[i] * dt);
      const m = this.meshes[i];
      m.visible = this.s[i] > 0.01 || target === 1;
      m.scale.setScalar(Math.max(0.0001, this.s[i]));
    }
  }
}

function stackGeos(n: number, sheets: number, w: number, d: number, tint: number, header: number, seed: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const b = new BoxBuilder();
    paperStack(b, 0, 0, 0, sheets + (i % 3), seed + i, tint, w, d, header);
    out.push(b.build());
  }
  return out;
}

// ---------------------------------------------------------------- depot
export class Depot {
  group = new THREE.Group();
  private slots: PopSlots;
  constructor(ctx: StationCtx) {
    const b = new BoxBuilder();
    const cx = STATIONS.depot.prop.x;
    const wood = 0xb88a58, dark = 0x6a4a30;
    // wall shelving (decorative archive)
    for (const x of [cx - 2.15, cx, cx + 2.15]) b.box(x, 1.35, -10.55, 0.1, 2.7, 0.8, dark);
    for (const y of [0.3, 1.1, 1.9, 2.7]) b.box(cx, y, -10.55, 4.4, 0.08, 0.8, wood);
    b.box(cx, 1.4, -10.93, 4.3, 2.6, 0.04, 0x5a3e28);
    let seed = 5;
    for (const y of [0.34, 1.14, 1.94]) { bookshelfDecor(b, cx - 2.05, y, -10.7, -10.4, seed++); }
    // archive: boxes & folders on shelves
    const r = rng(77);
    for (const y of [0.34, 1.14, 1.94]) {
      for (let i = 0; i < 6; i++) {
        const x = cx - 2.0 + i * 0.7 + r() * 0.1;
        if (r() < 0.25) continue;
        b.box(x, y + 0.2, -10.58, 0.5, 0.36, 0.5, [0xc9a672, 0xd8b88a, 0xb8905e][i % 3]);
        b.box(x, y + 0.26, -10.32, 0.34, 0.12, 0.02, 0xf4f0e6);
      }
    }
    // counter
    b.box(cx, 0.47, -8.9, 4.4, 0.94, 0.95, 0x8a6240);
    b.box(cx, 0.97, -8.9, 4.6, 0.07, 1.05, 0xd8b078);
    b.box(cx, 0.45, -8.4, 4.2, 0.8, 0.04, 0xa07848);
    for (let i = 0; i < 7; i++) b.box(cx - 1.8 + i * 0.6, 0.45, -8.38, 0.5, 0.7, 0.02, 0x7a5434);
    this.group.add(meshFrom(b, ctx.sh.vc));
    const sign = signPlane(ctx, 'TICKETS', '#2a3a6a', '#ffe9a8', '#ffd25a', 0.55, 2);
    sign.position.set(cx, 3.05, -10.94);
    this.group.add(sign);
    const sign2 = signPlane(ctx, 'TAKE ONE', '#f4ecd8', '#2a2a3a', '#8a6a48', 0.17, 1);
    sign2.position.set(cx, 0.55, -8.36);
    this.group.add(sign2);
    // 14 stacks on the counter (2 rows of 7)
    const pos: [number, number, number][] = [];
    for (let row = 0; row < 2; row++) for (let i = 0; i < 7; i++) pos.push([cx - 1.74 + i * 0.58 + (row ? 0.1 : 0), 1.005, row ? -8.62 : -9.2]);
    this.slots = new PopSlots(this.group, pos, stackGeos(5, 5, 0.3, 0.36, 0xf6f1e3, 0x4a6fd0, 40), ctx.sh.vc);
  }
  update(u: StationUpdate): void { this.slots.update(Math.max(0, Math.min(14, u.state.depotStacks ?? 0)), u.dt); }
}

// ---------------------------------------------------------------- skill library (dynamic: driven by state.skills)
const LIB_SLOTS_PER_BAY = 15;
const LIB_MAX = 30;

interface Cart {
  group: THREE.Group; body: THREE.Mesh; plate: THREE.Mesh; plateMat: THREE.MeshBasicMaterial; plateCv: ReturnType<typeof makeCanvasTex>;
  halo: THREE.Mesh | null; cat: THREE.Mesh; s: number; v: number; sig: string; custom: boolean; y: number; z: number; parent: THREE.Object3D;
}

export class Library {
  group = new THREE.Group();
  private bayB = new THREE.Group();
  private bayBs = 0; private bayBv = 0;
  carts: Cart[] = [];
  private lampGlow: THREE.MeshBasicMaterial;
  private lampMat: THREE.MeshBasicMaterial;
  private catMats = new Map<string, THREE.MeshBasicMaterial>();
  private ctx: StationCtx;
  private countCv = makeCanvasTex(72, 13, false);
  private countSig = '';
  private haloMat: THREE.MeshBasicMaterial;
  private idx = new SkillIndex();

  private static bayGeo(b: BoxBuilder, zc: number, ox: number, face: number): void {
    const wood = 0x9a6a44, dark = 0x5a3c28;
    const x0 = -13.45 - ox, z0 = zc - 2.5;
    const boards = [1.25, 2.15, 3.05];
    b.box(face - 0.05 - ox, 1.7, zc, 0.1, 3.4, 5.2, 0x4a3022);
    for (let i = 0; i <= 5; i++) b.box(x0, 1.7, z0 + i * 1.0, 0.95, 3.4, 0.1, dark);
    b.box(x0, 0.19, zc, 1.0, 0.38, 5.1, 0x6a4630);
    for (let i = 0; i < 5; i++) { b.box(-12.94 - ox, 0.19, z0 + 0.5 + i, 0.02, 0.28, 0.82, 0x7e5638); b.box(-12.92 - ox, 0.19, z0 + 0.5 + i, 0.02, 0.05, 0.2, 0xd8c070); }
    for (const y of [0.4, ...boards]) b.box(x0, y - 0.05, zc, 1.0, 0.1, 5.1, wood);
    b.box(x0, 3.2, zc, 1.05, 0.12, 5.3, dark);
    b.box(x0, 3.42, zc, 0.5, 0.05, 5.4, 0x8a96a4);
    for (const y of boards) for (let i = 0; i < 5; i++) {
      const sz = z0 + 0.5 + i;
      for (const [dx, dz, w, d] of [[0, -0.37, 0.56, 0.03], [0, 0.37, 0.56, 0.03], [-0.27, 0, 0.03, 0.74], [0.27, 0, 0.03, 0.74]] as const)
        b.box(-13.2 - ox + dx, y + 0.005, sz + dz, w, 0.01, d, 0x3a2a24);
    }
  }

  constructor(ctx: StationCtx) {
    this.ctx = ctx;
    const zA = STATIONS.library.prop.z, zB = -5.0, oxB = -13.95;
    // bay A (with ladder + reading lamp)
    const b = new BoxBuilder();
    Library.bayGeo(b, zA, 0, -13.89);
    const lz = zA + 3.0;
    for (const dz of [-0.25, 0.25]) b.box(-13.45, 1.7, lz + dz, 0.07, 3.5, 0.07, 0xc9a06a, 0, 0, 0.1);
    for (let i = 0; i < 8; i++) b.box(-13.45 - (0.1 * (0.3 + i * 0.4)) + 0.2, 0.3 + i * 0.4, lz, 0.05, 0.05, 0.5, 0xc9a06a);
    const lampZ = zA + 3.9;
    b.box(-13.1, 0.03, lampZ, 0.34, 0.06, 0.34, 0x2a2a34);
    b.box(-13.1, 0.85, lampZ, 0.05, 1.7, 0.05, 0x2a2a34);
    b.box(-12.4, 0.2, lampZ + 0.1, 0.45, 0.4, 0.45, 0x8a4a4a);
    b.box(-12.4, 0.42, lampZ + 0.1, 0.5, 0.06, 0.5, 0xb85a5a);
    this.group.add(meshFrom(b, ctx.sh.vc));
    this.lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe0a0, toneMapped: false });
    const shadeM = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.4), this.lampGlow);
    shadeM.position.set(-13.1, 1.75, lampZ);
    this.group.add(shadeM);
    this.lampMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffc070, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), this.lampMat);
    gl.rotation.x = -Math.PI / 2; gl.position.set(-12.6, 0.075, lampZ + 0.2);
    this.group.add(gl);

    // bay B (second bay, pops in when the catalog has more than 15 skills); pivot on the wall so it grows out of it
    const b2 = new BoxBuilder();
    Library.bayGeo(b2, zB, oxB, -13.79);
    this.bayB.position.set(oxB, 0, 0);
    this.bayB.add(meshFrom(b2, ctx.sh.vc));
    this.bayB.visible = false; this.bayB.scale.set(0.0001, 1, 1);
    this.group.add(this.bayB);

    // signs
    const title = signPlane(ctx, 'SKILL LIBRARY', '#1f2a4a', '#9be8ff', '#38bdf8', 0.62, 2);
    title.rotation.y = Math.PI / 2; title.position.set(-13.93, 4.12, zA);
    this.group.add(title);
    const sub = signPlane(ctx, 'LOAD SKILLS BEFORE CODING', '#f4ecd8', '#3a2a1e', '#8a6a48', 0.2, 1);
    sub.rotation.y = Math.PI / 2; sub.position.set(-13.92, 3.62, zA - 1.55);
    this.group.add(sub);
    const t2 = signPlane(ctx, 'SKILL LIBRARY II', '#1f2a4a', '#9be8ff', '#38bdf8', 0.4, 1.4);
    t2.rotation.y = Math.PI / 2; t2.position.set(-13.93 - oxB, 3.95, zB);
    this.bayB.add(t2);
    // count plate (dynamic)
    const cm = new THREE.MeshBasicMaterial({ map: this.countCv.tex, toneMapped: false });
    ctx.tint(cm);
    const cp = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1 * 13 / 72), cm);
    cp.rotation.y = Math.PI / 2; cp.position.set(-13.92, 3.62, zA + 1.85);
    this.group.add(cp);
    this.drawCount(0, 0);

    this.haloMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffd25a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

    // pooled cartridge slots (content assigned at update time)
    const boards = [1.25, 2.15, 3.05];
    for (let i = 0; i < LIB_MAX; i++) {
      const inB = i >= LIB_SLOTS_PER_BAY, k = i % LIB_SLOTS_PER_BAY;
      const zc = inB ? zB : zA, z0 = zc - 2.5;
      const row = Math.floor(k / 5), col = k % 5;
      const y = boards[row], z = z0 + 0.5 + col;
      const parent: THREE.Object3D = inB ? this.bayB : this.group;
      const ox = inB ? oxB : 0;
      const g = new THREE.Group();
      g.position.set(-13.2 - ox, y, z);
      const body = new THREE.Mesh(new THREE.BufferGeometry(), ctx.sh.vc);
      body.castShadow = true; body.receiveShadow = true;
      g.add(body);
      const plateCv = makeCanvasTex(26, 16, true);
      const plateMat = new THREE.MeshBasicMaterial({ map: plateCv.tex, toneMapped: false });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.38), plateMat);
      plate.rotation.y = Math.PI / 2; plate.position.set(0.295, 0.36, 0);
      g.add(plate);
      const cat = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.17), this.catMat('QUALITY'));
      cat.rotation.y = Math.PI / 2; cat.position.set(-12.945 - ox, y - 0.06, z);
      cat.visible = false;
      parent.add(cat);
      g.scale.setScalar(0.0001); g.visible = false;
      parent.add(g);
      this.carts.push({ group: g, body, plate, plateMat, plateCv, halo: null, cat, s: 0, v: 0, sig: '', custom: false, y, z, parent });
    }
  }

  private catMat(cat: string): THREE.MeshBasicMaterial {
    let m = this.catMats.get(cat);
    if (!m) {
      const t = makeSignTex(cat.toUpperCase(), '#f4ecd8', '#2a2030', '#8a6a48', 1, 2, 1);
      m = new THREE.MeshBasicMaterial({ map: t.tex, toneMapped: false });
      this.ctx.tint(m);
      this.catMats.set(cat, m);
    }
    return m;
  }

  private drawCount(n: number, extra: number): void {
    const { ctx, tex } = this.countCv;
    ctx.fillStyle = '#8a6a48'; ctx.fillRect(0, 0, 72, 13);
    ctx.fillStyle = '#f4ecd8'; ctx.fillRect(1, 1, 70, 11);
    drawTextCentered(ctx, n + (n === 1 ? ' SKILL' : ' SKILLS') + (extra > 0 ? ' +' + extra : ''), 36, 3, '#2a2030', 1);
    tex.needsUpdate = true;
  }

  private assign(c: Cart, sk: SkillLike | null): void {
    c.body.geometry.dispose();
    if (!sk) { c.body.geometry = new THREE.BufferGeometry(); c.cat.visible = false; c.custom = false; if (c.halo) c.halo.visible = false; return; }
    const col = new THREE.Color(sk.color || '#9aa4c0');
    const hexc = col.getHex();
    const cb = new BoxBuilder();
    cb.box(0, 0.31, 0, 0.58, 0.62, 0.74, hexc);
    cb.box(0, 0.64, 0, 0.5, 0.05, 0.66, shade(hexc, 0.78));
    cb.box(0.05, 0.1, 0, 0.5, 0.1, 0.5, 0x2a2a34, 0, 0, 0);
    cb.box(-0.1, 0.66, 0, 0.3, 0.04, 0.4, 0x15151c);
    if (sk.custom) { cb.box(0, 0.7, 0, 0.12, 0.1, 0.12, 0xffd25a); cb.box(0, 0.74, 0, 0.05, 0.07, 0.05, 0xffffff); }
    c.body.geometry = cb.build();
    const { ctx, tex } = c.plateCv;
    ctx.fillStyle = sk.custom ? '#ffd25a' : '#10141f'; ctx.fillRect(0, 0, 26, 16);
    if (sk.custom) { ctx.fillStyle = '#10141f'; ctx.fillRect(1, 1, 24, 14); }
    ctx.fillStyle = sk.color || '#9aa4c0'; ctx.fillRect(sk.custom ? 2 : 1, sk.custom ? 2 : 1, sk.custom ? 22 : 24, sk.custom ? 12 : 14);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(1, 1, 24, 2);
    const glyph = (sk.glyph || sk.name.slice(0, 2) || '??').toUpperCase();
    const sc = glyph.length > 2 ? 1 : 2;
    const lum = col.r * 0.3 + col.g * 0.59 + col.b * 0.11;
    const fg = lum > 0.45 ? '#10141f' : '#ffffff';
    drawTextCentered(ctx, glyph, 13, sc === 2 ? 2 : 5, fg, sc);
    if (sk.custom) {
      // pixel star (top-left)
      ctx.fillStyle = '#ffffff';
      for (const [sx, sy] of [[4, 3], [3, 4], [4, 4], [5, 4], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [3, 6], [5, 6]]) ctx.fillRect(sx, sy, 1, 1);
      ctx.fillStyle = '#ffd25a'; ctx.fillRect(4, 5, 1, 1);
    }
    tex.needsUpdate = true;
    c.cat.material = this.catMat(sk.category || 'quality');
    c.cat.visible = true;
    c.custom = !!sk.custom;
    if (sk.custom) {
      if (!c.halo) {
        c.halo = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), this.haloMat);
        c.halo.rotation.y = Math.PI / 2; c.halo.position.set(0.33, 0.4, 0); c.halo.renderOrder = 2;
        c.group.add(c.halo);
      }
      c.halo.visible = true;
    } else if (c.halo) c.halo.visible = false;
  }

  update(u: StationUpdate): void {
    const cat: readonly Skill[] = u.state.skills && u.state.skills.length ? u.state.skills : SKILLS;
    this.idx.sync(cat);
    const stock = u.state.libraryStock ? new Set(u.state.libraryStock) : null;
    const n = Math.min(LIB_MAX, cat.length);
    for (let i = 0; i < this.carts.length; i++) {
      const c = this.carts[i];
      const sk = i < n ? cat[i] : null;
      const want = sk ? sk.id + sk.color + sk.glyph + (sk.custom ? 'c' : '') : '';
      let target = 0;
      if (want !== c.sig) {
        if (c.s < 0.03) { this.assign(c, sk); c.sig = want; target = sk && (!stock || stock.has(sk.id)) ? 1 : 0; }
      } else target = sk && (!stock || stock.has(sk.id)) ? 1 : 0;
      c.v += (target - c.s) * 150 * u.dt;
      c.v *= Math.exp(-10 * u.dt);
      c.s = Math.max(0, c.s + c.v * u.dt);
      c.group.visible = c.s > 0.01;
      c.group.scale.setScalar(Math.max(0.0001, c.s));
      if (c.halo && c.halo.visible) c.halo.scale.setScalar(0.85 + (u.reduced ? 0.1 : 0.15 * Math.sin(u.t * 3 + i)));
    }
    // second bay
    const needB = n > LIB_SLOTS_PER_BAY ? 1 : 0;
    this.bayBv += (needB - this.bayBs) * 90 * u.dt; this.bayBv *= Math.exp(-9 * u.dt);
    this.bayBs = Math.max(0, this.bayBs + this.bayBv * u.dt);
    this.bayB.visible = this.bayBs > 0.01;
    this.bayB.scale.set(Math.max(0.0001, this.bayBs), 1, 1);
    const sig = n + '/' + Math.max(0, cat.length - LIB_MAX);
    if (sig !== this.countSig) { this.countSig = sig; this.drawCount(n, Math.max(0, cat.length - LIB_MAX)); }
    const wob = u.reduced ? 1 : 0.9 + 0.1 * Math.sin(u.t * 2.1);
    this.lampGlow.color.setRGB(1 * wob, 0.82 * wob, 0.55 * wob);
    this.lampMat.opacity = 0.42 * u.pal.lampStrength * wob;
  }
}

// ---------------------------------------------------------------- vault
export class Vault {
  group = new THREE.Group();
  led: THREE.MeshBasicMaterial;
  glow: THREE.MeshBasicMaterial;
  strip: THREE.MeshBasicMaterial;
  constructor(ctx: StationCtx) {
    const b = new BoxBuilder();
    const x = STATIONS.vault.prop.x, zf = -9.55;
    b.box(x, 1.0, zf - 0.65, 1.9, 2.0, 1.3, 0x4a5868);
    b.box(x, 2.02, zf - 0.65, 2.0, 0.08, 1.4, 0x657688);
    b.box(x, 0.06, zf - 0.65, 2.0, 0.12, 1.4, 0x2a323e);
    b.box(x, 1.0, zf + 0.025, 1.62, 1.68, 0.06, 0x75879b);
    b.box(x, 1.0, zf + 0.06, 1.46, 1.52, 0.03, 0x66798e);
    // handle wheel
    const hx = x - 0.28;
    b.box(hx, 1.0, zf + 0.12, 0.54, 0.07, 0.06, 0xd8d8e0).box(hx, 1.0, zf + 0.12, 0.07, 0.54, 0.06, 0xd8d8e0);
    b.box(hx, 1.0, zf + 0.12, 0.4, 0.07, 0.06, 0xd8d8e0, 0, 0, Math.PI / 4).box(hx, 1.0, zf + 0.12, 0.4, 0.07, 0.06, 0xd8d8e0, 0, 0, -Math.PI / 4);
    b.box(hx, 1.0, zf + 0.15, 0.16, 0.16, 0.08, 0xffd25a);
    // keypad
    b.box(x + 0.5, 1.05, zf + 0.1, 0.36, 0.56, 0.05, 0x1e222c);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) b.box(x + 0.4 + c * 0.1, 0.9 + r * 0.1, zf + 0.14, 0.07, 0.07, 0.02, (r + c) % 2 ? 0xc0c8d8 : 0x9aa4b8);
    // hinges
    for (const y of [0.45, 1.55]) b.box(x - 0.86, y, zf + 0.03, 0.06, 0.2, 0.08, 0x2a323e);
    // key rack + cards on the floor side
    b.box(x + 1.25, 0.2, zf - 0.2, 0.4, 0.4, 0.5, 0x3a3a48);
    b.box(x + 1.25, 0.42, zf - 0.2, 0.2, 0.04, 0.3, 0xffd25a);
    this.group.add(meshFrom(b, ctx.sh.vc));
    this.led = new THREE.MeshBasicMaterial({ color: 0xe5484d, toneMapped: false });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.03), this.led);
    led.position.set(x + 0.5, 1.28, zf + 0.14);
    this.group.add(led);
    this.strip = new THREE.MeshBasicMaterial({ color: 0x3affc0, toneMapped: false, transparent: true, opacity: 0.8 });
    const st = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.02), this.strip);
    st.position.set(x, 1.86, zf + 0.085);
    this.group.add(st);
    const sign = signPlane(ctx, 'SECRETS', '#1a1a24', '#ff8a8a', '#e5484d', 0.4, 2);
    sign.position.set(x, 2.45, zf - 0.0);
    this.group.add(sign);
    this.glow = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x3affc0, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), this.glow);
    g.rotation.x = -Math.PI / 2; g.position.set(x, 0.075, zf + 0.9);
    this.group.add(g);
  }
  update(u: StationUpdate): void {
    const blocked = u.state.agents.some((a) => a.phase === 'blocked');
    const blink = Math.floor(u.t * (blocked ? 4 : 1)) % 2 === 0;
    this.led.color.setHex(blocked ? (blink ? 0xff4a4a : 0x501010) : (blink ? 0x3aff7a : 0x145a2a));
    const p = u.reduced ? 0.7 : 0.7 + 0.3 * Math.sin(u.t * 1.6);
    this.glow.opacity = 0.22 * p * (0.6 + u.pal.lampStrength * 0.6);
    this.strip.opacity = 0.5 + 0.4 * p;
  }
}

// ---------------------------------------------------------------- planning board
const COLS = [
  { key: 'backlog', label: 'BACKLOG', color: '#9aa4c0' },
  { key: 'doing', label: 'IN PROGRESS', color: '#ffd25a' },
  { key: 'review', label: 'IN REVIEW', color: '#c792ea' },
  { key: 'merged', label: 'MERGED', color: '#5ad17a' },
];
function colOf(t: Ticket): number {
  switch (t.status) {
    case 'backlog': case 'assigned': return 0;
    case 'in_progress': case 'changes_requested': return 1;
    case 'in_review': return 2;
    default: return 3;
  }
}
function money(v: number): string { return '$' + (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)); }
function moneyShort(v: number): string { return '$' + (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(0) : v.toFixed(1)); }

export class PlanBoard {
  group = new THREE.Group();
  private c = makeCanvasTex(384, 144, true);
  private sig = '';
  private acc = 0;
  private skills = new SkillIndex();
  private skillFn = this.skills.fn;
  private mat: THREE.MeshBasicMaterial;
  private live = false;
  constructor(ctx: StationCtx) {
    const b = new BoxBuilder();
    const x = STATIONS.board.prop.x;
    b.box(x, 2.9, -10.9, 9.5, 3.7, 0.14, 0x6a4830);
    b.box(x, 2.9, -10.82, 9.2, 3.45, 0.04, 0x2a2a38);
    b.box(x, 1.02, -10.7, 9.6, 0.1, 0.45, 0x5a3c26); // marker ledge
    for (let i = 0; i < 6; i++) b.box(x - 3 + i * 0.35, 1.1, -10.62, 0.22, 0.04, 0.05, [0xe5484d, 0x4a82d0, 0x2f2f3a, 0x3fb870, 0xffd25a, 0xe879f9][i]);
    // pins
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.box(x + sx * 4.5, 2.9 + sy * 1.65, -10.76, 0.12, 0.12, 0.06, 0xe5484d);
    this.group.add(meshFrom(b, ctx.sh.vc, false, false));
    this.mat = new THREE.MeshBasicMaterial({ map: this.c.tex, toneMapped: false });
    ctx.tint(this.mat);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 3.375), this.mat);
    plane.position.set(x, 2.9, -10.79);
    this.group.add(plane);
    this.draw(null, 0);
  }

  private draw(s: SimState | null, t: number): void {
    const { ctx, tex } = this.c;
    const W = 384, H = 144;
    ctx.fillStyle = '#1c2236'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#262e4a'; ctx.fillRect(0, 0, W, 29);
    ctx.fillStyle = '#d97757'; ctx.fillRect(0, 0, 8, 29); ctx.fillStyle = '#2dd4bf'; ctx.fillRect(8, 0, 4, 29);
    if (!s) { drawText(ctx, 'PLAN BOARD', 18, 8, '#ffffff', 2); tex.needsUpdate = true; return; }
    const name = (s.plan?.name ?? 'PLAN').toUpperCase();
    // live: the done count takes the right of the header, so the name gets what is left (12 px per letter at scale 2)
    const maxName = this.live ? Math.max(4, Math.floor((W - 26 - 18 - textWidth('DONE ' + (s.metrics?.merged ?? 0) + '/' + s.tickets.length, 2)) / 12)) : 24;
    drawText(ctx, name.length > maxName ? name.slice(0, maxName) : name, 18, 4, '#ffffff', 2);
    // note marquee
    const note = (s.plan?.note ?? '').toUpperCase();
    const avail = 240;
    if (textWidth(note) <= avail) drawText(ctx, note, 18, 20, '#9fb0e0', 1);
    else {
      ctx.save(); ctx.beginPath(); ctx.rect(18, 19, avail, 9); ctx.clip();
      const total = textWidth(note) + 40;
      const off = Math.floor(t * 14) % total;
      drawText(ctx, note, 18 - off, 20, '#9fb0e0', 1); drawText(ctx, note, 18 - off + total, 20, '#9fb0e0', 1);
      ctx.restore();
    }
    // spend + gauge (live board data: the done count instead; the board records no spend)
    const m = s.metrics;
    if (this.live) {
      const done = 'DONE ' + (m?.merged ?? 0) + '/' + s.tickets.length;
      drawText(ctx, done, W - 8 - textWidth(done, 2), 7, '#5ad17a', 2);
    } else {
      const spend = 'SPEND ' + money(m?.totalCostUsd ?? 0);
      drawText(ctx, spend, W - 8 - textWidth(spend, 1) - 0, 5, '#ffd25a', 1);
      const pct = Math.max(0, Math.min(1, (m?.budgetUsedPct ?? 0) / 100));
      const gx = W - 128, gy = 16;
      ctx.fillStyle = '#10142a'; ctx.fillRect(gx, gy, 120, 8);
      const gc = pct > 0.9 ? '#e5484d' : pct > 0.7 ? '#f08a3c' : '#5ad17a';
      ctx.fillStyle = gc; ctx.fillRect(gx + 1, gy + 1, Math.max(0, Math.round(118 * pct)), 6);
      ctx.fillStyle = '#ffffff'; for (let i = 1; i < 4; i++) ctx.fillRect(gx + i * 30, gy, 1, 2);
      const bl = m && m.budgetUsedPct > 0 ? 'BUDGET ' + Math.round(m.budgetUsedPct) + '%' : 'NO BUDGET';
      drawText(ctx, bl, gx, 26 - 1, '#7f8ab0', 1);
    }
    // columns
    const cw = 94, cols: Ticket[][] = [[], [], [], []];
    for (const tk of s.tickets) cols[colOf(tk)].push(tk);
    cols[0].sort((a, b) => a.createdAt - b.createdAt);
    cols[3].sort((a, b) => (b.mergedAt ?? 0) - (a.mergedAt ?? 0));
    for (let ci = 0; ci < 4; ci++) {
      const cx = 2 + ci * (cw + 1);
      ctx.fillStyle = '#232b45'; ctx.fillRect(cx, 31, cw - 1, H - 32);
      ctx.fillStyle = COLS[ci].color; ctx.fillRect(cx, 31, cw - 1, 2);
      drawText(ctx, this.live && ci === 3 ? 'DONE' : COLS[ci].label, cx + 3, 36, COLS[ci].color, 1);
      const cnt = String(cols[ci].length);
      drawText(ctx, cnt, cx + cw - 4 - textWidth(cnt), 36, '#ffffff', 1);
      const list = cols[ci];
      const perRow = 2, rows = 9, shown = Math.min(list.length, perRow * rows);
      for (let k = 0; k < shown; k++) {
        const tk = list[k];
        const rx = cx + 2 + (k % perRow) * 46, ry = 46 + Math.floor(k / perRow) * 10;
        const col = DIFF_COLORS[Math.max(0, Math.min(4, (tk.difficulty ?? 1) - 1))];
        ctx.fillStyle = '#0c1020'; ctx.fillRect(rx, ry, 44, 9);
        ctx.fillStyle = col; ctx.fillRect(rx + 1, ry + 1, 42, 7);
        if (tk.status === 'changes_requested') { ctx.fillStyle = '#e5484d'; ctx.fillRect(rx, ry, 44, 1); ctx.fillRect(rx, ry + 8, 44, 1); }
        if (tk.status === 'in_progress') { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(rx + 1, ry + 6, Math.round(42 * (1 - (tk.progress ?? 0))), 2); }
        const cost = this.live ? tk.id : moneyShort(tk.usage?.costUsd ?? 0);
        drawText(ctx, cost.length > 6 ? cost.slice(0, 6) : cost, rx + 3, ry + 1, '#10141f', 1);
        let dx = rx + 44 - 4;
        const sk = (tk.skills ?? []).slice(0, 3);
        for (let q = sk.length - 1; q >= 0; q--) {
          ctx.fillStyle = '#10141f'; ctx.fillRect(dx - 3, ry + 2, 4, 5);
          ctx.fillStyle = this.skillFn(sk[q]).color; ctx.fillRect(dx - 2, ry + 3, 2, 3);
          dx -= 4;
        }
      }
      if (list.length > shown) drawText(ctx, '+' + (list.length - shown) + ' MORE', cx + 3, H - 9, '#9aa4c0', 1);
    }
    tex.needsUpdate = true;
  }

  update(u: StationUpdate): void {
    this.acc += u.dt;
    if (this.acc < 0.4) return;
    this.acc = 0;
    const s = u.state;
    this.skills.sync(s.skills);
    this.live = !!u.live;
    let sig = (this.live ? 'L' : '') + this.skills.sig + (s.plan?.name ?? '') + '|' + (s.metrics?.totalCostUsd ?? 0).toFixed(2) + '|' + (s.metrics?.budgetUsedPct ?? 0).toFixed(2) + '|' + ((s.plan?.note ?? '').length > 40 ? Math.floor(u.t * 14) : s.plan?.note);
    for (const t of s.tickets) sig += t.id + t.status + (t.usage?.costUsd ?? 0).toFixed(1) + Math.round((t.progress ?? 0) * 8);
    if (sig === this.sig) return;
    this.sig = sig;
    this.draw(s, u.t);
  }
}

// ---------------------------------------------------------------- orchestrator desk
export class OrchDesk {
  group = new THREE.Group();
  screens: ScreenCanvas[];
  chair: THREE.Mesh;
  private acc = 0;
  private sh: Shared;
  constructor(ctx: StationCtx) {
    this.sh = ctx.sh;
    const b = new BoxBuilder();
    const x = STATIONS.orchSeat.prop.x, z = STATIONS.orchSeat.prop.z;
    b.box(x, 0.72, z - 0.06, 3.2, 0.07, 1.4, 0x4a4e6a);
    b.box(x, 0.755, z + 0.63, 3.2, 0.015, 0.03, 0x6a6f95);
    b.box(x - 1.5, 0.36, z - 0.06, 0.08, 0.72, 1.3, 0x2e3146);
    b.box(x + 1.5, 0.36, z - 0.06, 0.08, 0.72, 1.3, 0x2e3146);
    b.box(x, 0.45, z - 0.62, 3.0, 0.6, 0.04, 0x2e3146);
    b.box(x, 0.768, z + 0.45, 0.7, 0.025, 0.22, 0x2a2e3a);
    b.box(x, 0.783, z + 0.45, 0.62, 0.006, 0.16, 0x4a5064);
    // two monitors, facing south
    for (const mx of [-0.62, 0.62]) {
      b.box(x + mx, 0.775, z - 0.2, 0.3, 0.03, 0.2, 0x2a2e3a);
      b.box(x + mx, 0.9, z - 0.22, 0.07, 0.25, 0.05, 0x2a2e3a);
      b.box(x + mx, 1.2, z - 0.28, 0.7, 0.42, 0.06, 0x1e202a);
    }
    // headset
    b.box(x - 1.2, 0.8, z + 0.3, 0.2, 0.04, 0.04, 0x2a2a34).box(x - 1.3, 0.77, z + 0.3, 0.06, 0.1, 0.12, 0x2a2a34).box(x - 1.1, 0.77, z + 0.3, 0.06, 0.1, 0.12, 0x2a2a34);
    b.box(x - 1.3, 0.76, z + 0.39, 0.02, 0.05, 0.1, 0xd97757);
    // clipboard
    b.box(x + 1.15, 0.9, z - 0.35, 0.34, 0.46, 0.03, 0x7a5030, 0, -0.3);
    b.box(x + 1.15, 0.9, z - 0.33, 0.28, 0.38, 0.015, 0xf6f1e3, 0, -0.3);
    for (let i = 0; i < 4; i++) b.box(x + 1.15, 0.9 + i * 0.07 - 0.05, z - 0.32, 0.2, 0.012, 0.01, 0x4a6fd0, 0, -0.3);
    mug(b, x + 1.25, 0.75, z + 0.4, 0xd0524a);
    plant(b, x - 1.3, z - 0.3, 0.6, 3, 0.75);
    lampMesh(b, x + 1.4, 0.75, z - 0.05);
    // sticky notes row on desk front
    for (let i = 0; i < 3; i++) b.box(x - 0.3 + i * 0.3, 0.76, z + 0.58, 0.1, 0.01, 0.1, [0xffe36a, 0xff9ab8, 0x8ad8ff][i], i * 0.3);
    this.group.add(meshFrom(b, ctx.sh.vc));
    this.screens = [new ScreenCanvas(64, 40, 101), new ScreenCanvas(64, 40, 102)];
    [-0.62, 0.62].forEach((mx, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.36), this.screens[i].mat);
      m.position.set(x + mx, 1.2, z - 0.28 + 0.034);
      this.group.add(m);
    });
    // chair
    const cb = new BoxBuilder();
    const sz = STATIONS.orchSeat.stand.z;
    cb.box(x, 0.04, sz, 0.56, 0.04, 0.07, 0x2a2a34).box(x, 0.04, sz, 0.07, 0.04, 0.56, 0x2a2a34).box(x, 0.14, sz, 0.07, 0.2, 0.07, 0x3a3a46);
    this.group.add(meshFrom(cb, ctx.sh.vc));
    const cc = new BoxBuilder();
    cc.box(x, 0.255, sz + 0.03, 0.54, 0.09, 0.64, 0xffffff).box(x, 0.58, sz + 0.42, 0.5, 0.5, 0.07, 0xffffff);
    this.chair = meshFrom(cc, ctx.sh.lam.claude);
    this.group.add(this.chair);
    // rug under the orchestrator
    const rb = new BoxBuilder();
    for (let i = 0; i < 7; i++) rb.box(x, 0.03, z - 2.0 + i * 0.7 + 0.35, 6.6 - (i % 2) * 0.0, 0.03, 0.62, i % 2 ? 0xd9835a : 0xeedcb0);
    rb.box(x, 0.026, z + 0.35, 6.9, 0.02, 4.9, 0x3a2a4a);
    this.group.add(meshFrom(rb, ctx.sh.vc, false, true));
  }
  update(u: StationUpdate): void {
    const orch = u.state.agents.find((a) => a.role === 'orchestrator');
    if (orch) this.chair.material = this.sh.lam[orch.provider];
    this.acc += u.dt;
    if (this.acc < 0.2) return;
    this.acc = 0;
    const off = !orch || orch.phase === 'offline';
    this.screens[0].setGain(u.pal.screenGain); this.screens[1].setGain(u.pal.screenGain);
    this.screens[0].draw(off ? 'off' : 'plan', u.t, '#d97757', 0);
    this.screens[1].draw(off ? 'off' : orch!.pose === 'type' ? 'code' : 'think', u.t, '#d97757', 0);
  }
}

// ---------------------------------------------------------------- integrator desk + trays
export class IntegratorDesk {
  group = new THREE.Group();
  private inbox: PopSlots;
  private out: PopSlots;
  screen: ScreenCanvas;
  private acc = 0;
  constructor(ctx: StationCtx) {
    const b = new BoxBuilder();
    const dx = 9.05;
    b.box(dx - 0.16, 0.72, -7.0, 1.3, 0.07, 3.5, 0x5a4a3a);
    b.box(dx - 0.16, 0.755, -7.0, 1.3, 0.012, 3.5, 0x6e5c48);
    b.box(dx + 0.4, 0.36, -8.65, 0.08, 0.7, 0.2, 0x3a2e24);
    b.box(dx + 0.4, 0.36, -5.35, 0.08, 0.7, 0.2, 0x3a2e24);
    b.box(dx - 0.3, 0.4, -7.0, 0.04, 0.6, 3.3, 0x3a2e24);
    // monitor facing east (+x)
    b.box(dx - 0.1, 0.775, -7.0, 0.2, 0.03, 0.3, 0x2a2e3a);
    b.box(dx - 0.12, 0.9, -7.0, 0.05, 0.25, 0.07, 0x2a2e3a);
    b.box(dx - 0.2, 1.2, -7.0, 0.06, 0.45, 0.82, 0x1e202a);
    b.box(dx + 0.35, 0.768, -7.0, 0.22, 0.025, 0.62, 0x2a2e3a);
    b.box(dx + 0.35, 0.783, -7.0, 0.16, 0.006, 0.56, 0x4a5064);
    // stamp + inkpad
    b.box(dx + 0.3, 0.78, -7.85, 0.26, 0.03, 0.2, 0x5a1a1a).box(dx + 0.3, 0.8, -7.85, 0.2, 0.01, 0.14, 0xd0383a);
    b.box(dx + 0.3, 0.83, -7.5, 0.1, 0.06, 0.1, 0x7a5030).box(dx + 0.3, 0.9, -7.5, 0.07, 0.1, 0.07, 0x4a2a1a).box(dx + 0.3, 0.97, -7.5, 0.1, 0.03, 0.1, 0x2a1a10);
    mug(b, dx + 0.35, 0.755, -6.2, 0xf0f0f0);
    plant(b, dx - 0.2, -8.3, 0.5, 11, 0.755);
    // trays
    for (const tz of [-6.0, -8.0]) {
      b.box(dx - 0.45, 0.8, tz, 0.64, 0.06, 1.0, 0x2a2a34);
      for (const s of [-1, 1]) b.box(dx - 0.45, 0.86, tz + s * 0.5, 0.64, 0.14, 0.04, tz > -7 ? 0x3a6ab0 : 0xb03a3a);
      b.box(dx - 0.14, 0.86, tz, 0.04, 0.14, 1.0, tz > -7 ? 0x3a6ab0 : 0xb03a3a);
      b.box(dx - 0.76, 0.86, tz, 0.04, 0.14, 1.0, tz > -7 ? 0x3a6ab0 : 0xb03a3a);
    }
    // chair (east of the desk)
    const cx = STATIONS.integSeat.stand.x, cz = STATIONS.integSeat.stand.z;
    b.box(cx, 0.04, cz, 0.07, 0.04, 0.56, 0x2a2a34).box(cx, 0.04, cz, 0.56, 0.04, 0.07, 0x2a2a34).box(cx, 0.14, cz, 0.07, 0.2, 0.07, 0x3a3a46);
    b.box(cx - 0.03, 0.255, cz, 0.64, 0.09, 0.54, 0x6a5ab8).box(cx + 0.42, 0.58, cz, 0.07, 0.5, 0.5, 0x6a5ab8);
    this.group.add(meshFrom(b, ctx.sh.vc));
    this.screen = new ScreenCanvas(64, 40, 140);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.38), this.screen.mat);
    sm.rotation.y = Math.PI / 2;
    sm.position.set(dx - 0.2 + 0.034, 1.2, -7.0);
    this.group.add(sm);
    for (const [tz, txt, bg, fg] of [[-6.0, 'INBOX', '#2a4a8a', '#cfe0ff'], [-8.0, 'OUT', '#8a2a2a', '#ffd0d0']] as const) {
      const sp = signPlane(ctx, txt, bg, fg, '#f4ecd8', 0.2, 1);
      sp.position.set(dx - 0.3, 1.25, tz - 0.6);
      sp.rotation.y = Math.PI / 4;
      this.group.add(sp);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), ctx.sh.vc);
      void post;
    }
    const mk = (tz: number): [number, number, number][] => {
      const arr: [number, number, number][] = [];
      for (let ix = 0; ix < 2; ix++) for (let iz = 0; iz < 3; iz++) arr.push([dx - 0.58 + ix * 0.27, 0.83, tz - 0.31 + iz * 0.31]);
      return arr;
    };
    this.inbox = new PopSlots(this.group, mk(-6.0), stackGeos(4, 6, 0.22, 0.27, 0xf6f1e3, 0x4a6fd0, 60), ctx.sh.vc);
    this.out = new PopSlots(this.group, mk(-8.0), stackGeos(4, 6, 0.22, 0.27, 0xf3b6ae, 0xd0383a, 80), ctx.sh.vc);
  }
  /** A PR plane landed on the inbox: bump the top stack (and the one below) so the landing reads. */
  bumpInbox(): void {
    const top = Math.min(6, this.inboxCount) - 1;
    this.inbox.kick(top, 7); this.inbox.kick(top - 1, 3.5);
    if (top < 0) this.inbox.kick(0, 4);
  }
  private inboxCount = 0;
  update(u: StationUpdate): void {
    this.inboxCount = u.state.inboxStacks ?? 0;
    this.inbox.update(Math.min(6, u.state.inboxStacks ?? 0), u.dt);
    this.out.update(Math.min(6, u.state.outStacks ?? 0), u.dt);
    this.acc += u.dt;
    if (this.acc < 0.2) return;
    this.acc = 0;
    const integ = u.state.agents.find((a) => a.role === 'integrator');
    this.screen.setGain(u.pal.screenGain);
    const off = !integ || integ.phase === 'offline';
    const mode = off ? 'off' : integ!.pose === 'review' || integ!.phase === 'reviewing' ? 'review' : integ!.pose === 'wait' ? 'wait' : 'idle';
    this.screen.draw(mode, u.t, '#8a7ae8', integ ? integ.phaseProgress : 0);
  }
}

// ---------------------------------------------------------------- main rack + deploy pad
export class Racks {
  group = new THREE.Group();
  private rackC = makeCanvasTex(32, 56, false);
  private rackAcc = 0;
  private lastCommits = -1;
  private lastDeploy = -1;
  private flash = 0;
  private beacon: THREE.MeshBasicMaterial;
  private rocket = new THREE.Group();
  private lights: THREE.MeshBasicMaterial[] = [];
  private launch = { phase: 'idle' as 'idle' | 'count' | 'fly' | 'hidden' | 'return', t: 0 };
  private button: THREE.MeshBasicMaterial;
  private padGlow: THREE.MeshBasicMaterial;
  private rackGlow: THREE.MeshBasicMaterial;
  private ctx: StationCtx;
  constructor(ctx: StationCtx) {
    this.ctx = ctx;
    const b = new BoxBuilder();
    const rx = STATIONS.mainRack.prop.x, zf = -9.9;
    b.box(rx, 1.2, zf - 0.5, 1.4, 2.4, 1.0, 0x23283a);
    b.box(rx, 2.42, zf - 0.5, 1.5, 0.06, 1.1, 0x3a4260);
    b.box(rx, 0.05, zf - 0.5, 1.5, 0.1, 1.1, 0x15182a);
    for (const sx of [-1, 1]) b.box(rx + sx * 0.7, 1.2, zf + 0.02, 0.06, 2.3, 0.06, 0x3a4260);
    // cables
    b.box(rx + 0.9, 0.12, zf + 0.35, 0.5, 0.06, 0.08, 0x3a9ad8, 0.6).box(rx - 0.9, 0.12, zf + 0.5, 0.5, 0.06, 0.08, 0xd8a03a, -0.4);
    // deploy pad
    const px = 13.0, pz = -6.0;
    b.box(px, 0.12, pz, 1.6, 0.24, 1.6, 0x3a4050);
    b.box(px, 0.26, pz, 1.4, 0.04, 1.4, 0x555d70);
    for (let i = 0; i < 4; i++) b.box(px + (i % 2 ? 0.35 : -0.35), 0.28, pz + (i < 2 ? 0.35 : -0.35), 0.5, 0.01, 0.1, 0xffd25a, i % 2 ? 0.8 : -0.8);
    // gantry tower on the east side
    for (const dz of [-0.55, 0.55]) b.box(px + 0.62, 1.25, pz + dz, 0.12, 2.5, 0.12, 0xc84a3a);
    for (let i = 0; i < 5; i++) b.box(px + 0.62, 0.4 + i * 0.5, pz, 0.1, 0.07, 1.1, 0xe86a5a);
    b.box(px + 0.3, 1.55, pz, 0.7, 0.07, 0.12, 0xc84a3a);
    // pedestal button
    b.box(px - 1.4, 0.4, pz, 0.45, 0.8, 0.45, 0x2e3446);
    b.box(px - 1.4, 0.82, pz, 0.5, 0.05, 0.5, 0x4a5268, 0, -0.35);
    this.group.add(meshFrom(b, ctx.sh.vc));
    // rack front screen
    const rm = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.1), new THREE.MeshBasicMaterial({ map: this.rackC.tex, toneMapped: false }));
    rm.position.set(rx, 1.22, zf + 0.012);
    this.group.add(rm);
    this.beacon = new THREE.MeshBasicMaterial({ color: 0x3aff7a, toneMapped: false });
    const bm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), this.beacon);
    bm.position.set(rx, 2.6, zf - 0.5);
    this.group.add(bm);
    const sign = signPlane(ctx, 'MAIN', '#1a3a2a', '#7dffa0', '#3aff7a', 0.34, 2);
    sign.position.set(rx, 3.0, -10.94);
    this.group.add(sign);
    this.rackGlow = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x3aff7a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const rg = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), this.rackGlow);
    rg.rotation.x = -Math.PI / 2; rg.position.set(rx, 0.075, zf + 1);
    this.group.add(rg);

    // rocket
    const rb = new BoxBuilder();
    rb.box(0, 0.75, 0, 0.5, 1.2, 0.5, 0xf2f2f8);
    rb.box(0, 1.5, 0, 0.4, 0.3, 0.4, 0xff5a4a).box(0, 1.72, 0, 0.26, 0.2, 0.26, 0xff5a4a).box(0, 1.88, 0, 0.12, 0.14, 0.12, 0xff5a4a);
    rb.box(0, 0.35, 0, 0.54, 0.12, 0.54, 0xff5a4a);
    for (const [fx, fz] of [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) rb.box(fx, 0.32, fz, fx ? 0.2 : 0.1, 0.4, fz ? 0.2 : 0.1, 0x2dd4bf);
    rb.box(0, 0.12, 0, 0.3, 0.12, 0.3, 0x3a3a44);
    rb.box(0, 1.0, 0.26, 0.22, 0.22, 0.04, 0x4ac8ff).box(0, 1.0, 0.25, 0.28, 0.28, 0.02, 0x2a2a3a);
    rb.box(0.26, 1.0, 0, 0.04, 0.22, 0.22, 0x4ac8ff);
    const rocketMesh = meshFrom(rb, ctx.sh.vc);
    this.rocket.add(rocketMesh);
    this.rocket.position.set(px, 0.28, pz);
    this.group.add(this.rocket);
    // pad lights
    for (let i = 0; i < 4; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0xffb030, toneMapped: false });
      this.lights.push(m);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), m);
      l.position.set(px + (i % 2 ? 0.7 : -0.7), 0.31, pz + (i < 2 ? 0.7 : -0.7));
      this.group.add(l);
    }
    this.button = new THREE.MeshBasicMaterial({ color: 0xe5484d, toneMapped: false });
    const bt = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.2), this.button);
    bt.position.set(px - 1.4, 0.9, pz); bt.rotation.x = -0.35;
    this.group.add(bt);
    const dsign = signPlane(ctx, 'DEPLOY', '#3a1a1a', '#ffd0a0', '#ff8a4a', 0.22, 1);
    dsign.position.set(px - 1.4, 1.2, pz + 0.3); dsign.rotation.y = Math.PI / 4;
    this.group.add(dsign);
    this.padGlow = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const pg = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), this.padGlow);
    pg.rotation.x = -Math.PI / 2; pg.position.set(px, 0.3, pz);
    this.group.add(pg);
  }

  private drawRack(t: number, flash: number): void {
    const { ctx, tex } = this.rackC;
    ctx.fillStyle = '#101424'; ctx.fillRect(0, 0, 32, 56);
    for (let u = 0; u < 9; u++) {
      const y = 2 + u * 6;
      ctx.fillStyle = flash > 0 ? `rgb(${Math.round(20 + 30 * flash)},${Math.round(50 + 70 * flash)},${Math.round(30 + 30 * flash)})` : '#1d2338';
      ctx.fillRect(2, y, 28, 5);
      ctx.fillStyle = '#0a0d1a'; ctx.fillRect(4, y + 1, 12, 3);
      for (let l = 0; l < 6; l++) {
        const on = flash > 0.05 ? true : ((Math.floor(t * (2 + (u % 3))) + l * 3 + u * 5) % 7) < 3;
        ctx.fillStyle = flash > 0.05 ? '#5dff8a' : on ? (l % 3 === 0 ? '#ffb030' : '#3aff7a') : '#143a22';
        ctx.fillRect(18 + l * 2, y + 1, 1, 1);
        ctx.fillRect(18 + l * 2, y + 3, 1, 1);
      }
    }
    tex.needsUpdate = true;
  }

  update(u: StationUpdate): void {
    const s = u.state;
    if (this.lastCommits < 0) { this.lastCommits = s.mainCommits ?? 0; }
    if (s.mainCommits > this.lastCommits) {
      this.flash = 1;
      const x = STATIONS.mainRack.prop.x;
      this.ctx.fx.confetti(x, 2.7, -9.4, 34, 3);
      this.ctx.fx.sparks(x, 1.5, -9.7, 14, 0x7dffa0, 2.5);
    }
    this.lastCommits = s.mainCommits ?? 0;
    this.flash = Math.max(0, this.flash - u.dt * 0.7);
    this.rackAcc += u.dt;
    if (this.rackAcc > (u.reduced ? 0.4 : 0.14)) { this.rackAcc = 0; this.drawRack(u.t, this.flash); }
    this.beacon.color.setHex(this.flash > 0.05 ? 0xb8ffc8 : (Math.floor(u.t * 1.5) % 2 ? 0x3aff7a : 0x1a8a44));
    this.rackGlow.opacity = this.flash * 0.7 * (0.5 + u.pal.lampStrength * 0.5);

    // deploy
    if (this.lastDeploy < 0) this.lastDeploy = s.deployments ?? 0;
    if ((s.deployments ?? 0) > this.lastDeploy && this.launch.phase === 'idle') { this.launch.phase = 'count'; this.launch.t = 0; }
    this.lastDeploy = s.deployments ?? 0;
    const L = this.launch;
    L.t += u.dt;
    const px = 13.0, pz = -6.0;
    let padOn = 0;
    if (L.phase === 'idle') {
      this.rocket.position.set(px, 0.28, pz); this.rocket.scale.setScalar(1);
      const k = Math.floor(u.t * 1.2) % 4;
      this.lights.forEach((m, i) => m.color.setHex(i === k ? 0xffd070 : 0x8a5a14));
      this.button.color.setHex(0xe5484d);
    } else if (L.phase === 'count') {
      const fast = Math.floor(u.t * 8) % 2;
      this.lights.forEach((m) => m.color.setHex(fast ? 0xff3a3a : 0x5a1010));
      this.button.color.setHex(fast ? 0xff9a9a : 0xe5484d);
      this.rocket.position.set(px + (Math.random() - 0.5) * 0.02, 0.28, pz + (Math.random() - 0.5) * 0.02);
      padOn = 0.6;
      if (L.t > 1.6) { L.phase = 'fly'; L.t = 0; }
    } else if (L.phase === 'fly') {
      this.lights.forEach((m) => m.color.setHex(0x3aff7a));
      const y = 0.28 + 0.5 * 5.5 * L.t * L.t;
      this.rocket.position.set(px, y, pz);
      padOn = 1;
      for (let i = 0; i < 3; i++) {
        this.ctx.fx.spawn(px + (Math.random() - 0.5) * 0.3, y + 0.1, pz + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1, -1.5 - Math.random() * 1.5, (Math.random() - 0.5) * 1, 0.7 + Math.random() * 0.5, 0.2 + Math.random() * 0.15, [0xffd25a, 0xff8a3a, 0xe0e0e8][i % 3], -1.5, 0);
      }
      if (L.t > 0.6 && L.t < 0.65) this.ctx.fx.sparks(px, 0.5, pz, 6, 0xffd25a, 3);
      if (y > 16) { L.phase = 'hidden'; L.t = 0; this.rocket.scale.setScalar(0.0001); }
    } else if (L.phase === 'hidden') {
      this.lights.forEach((m) => m.color.setHex(0x3aff7a));
      if (L.t > 1.2) { L.phase = 'return'; L.t = 0; this.rocket.position.set(px, 0.28, pz); }
    } else {
      const k = Math.min(1, L.t / 0.7);
      this.rocket.scale.setScalar(Math.max(0.0001, k));
      if (k >= 1) { L.phase = 'idle'; L.t = 0; }
    }
    this.padGlow.opacity = padOn * 0.5 * (0.7 + u.pal.lampStrength * 0.3);
  }
}

export { hex, rng };
