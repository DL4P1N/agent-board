import * as THREE from 'three';
import { ROOM, DESKS, CUBICLE, STATIONS } from '../layout';
import { BoxBuilder, meshFrom, rng } from './builder';
import { makeCanvasTex, drawWindowArt, drawPoster, type PosterKind, glowTexture } from './textures';
import { bigPlant, plant, waterCooler, coffeeStation } from './props';
import type { Shared } from './shared';
import type { Palette } from './palettes';

interface WinDef { wall: 'N' | 'W'; at: number; y: number; w: number; h: number }
const WINDOWS: WinDef[] = [
  { wall: 'N', at: -12.2, y: 3.95, w: 1.7, h: 1.1 }, { wall: 'N', at: -7.5, y: 4.05, w: 2.8, h: 0.95 },
  { wall: 'N', at: 9.7, y: 3.95, w: 1.9, h: 1.1 },
  { wall: 'W', at: -6.4, y: 2.8, w: 2.0, h: 2.2 }, { wall: 'W', at: 7.8, y: 2.9, w: 2.2, h: 2.0 }, { wall: 'W', at: 4.9, y: 3.9, w: 1.4, h: 1.0 },
  { wall: 'W', at: -9.6, y: 3.9, w: 1.4, h: 1.0 },
];
interface PostDef { wall: 'N' | 'W'; at: number; y: number; kind: PosterKind; w: number; h: number }
const POSTERS: PostDef[] = [
  { wall: 'N', at: 12.2, y: 3.95, kind: 'shipit', w: 1.2, h: 1.55 }, { wall: 'N', at: -10.45, y: 2.1, kind: 'agile', w: 0.8, h: 1.05 },
  { wall: 'W', at: -3.6, y: 2.9, kind: 'works', w: 1.3, h: 1.65 }, { wall: 'W', at: 6.35, y: 2.3, kind: 'nap', w: 1.0, h: 1.2 },
  { wall: 'W', at: 10.2, y: 3.0, kind: 'blame', w: 1.2, h: 1.55 }, { wall: 'N', at: 11.0, y: 1.9, kind: 'coffee', w: 0.7, h: 0.9 },
];

export class Room {
  group = new THREE.Group();
  matAisle = new THREE.MeshLambertMaterial({ vertexColors: true });
  matCarpet = new THREE.MeshLambertMaterial({ vertexColors: true });
  matWall = new THREE.MeshLambertMaterial({ vertexColors: true });
  matSlab = new THREE.MeshLambertMaterial({ vertexColors: true });
  private winTex = makeCanvasTex(40, 26, true);
  private winMat = new THREE.MeshBasicMaterial({ map: this.winTex.tex, toneMapped: false });
  private tints: THREE.MeshBasicMaterial[] = [];
  private patchMat = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  private patchMesh: THREE.Mesh;
  private lastPal: Palette | null = null;
  tint = (m: THREE.MeshBasicMaterial): void => { this.tints.push(m); };

  constructor(sh: Shared) {
    const g = this.group;
    const W = ROOM.maxX - ROOM.minX, D = ROOM.maxZ - ROOM.minZ;
    // ---- floor tiles
    const fb = new BoxBuilder();
    const r = rng(3);
    for (let x = ROOM.minX; x < ROOM.maxX; x++) {
      for (let z = ROOM.minZ; z < ROOM.maxZ; z++) {
        const k = ((x + z) & 1) ? 0.93 : 1.0;
        const j = k * (0.97 + r() * 0.03);
        const c = new THREE.Color(j, j, j);
        const sc = new THREE.Color(j * 0.78, j * 0.78, j * 0.78);
        fb.top(x + 0.04, z + 0.04, x + 1, z + 1, 0, c);
        fb.top(x, z, x + 0.04, z + 1, 0, sc);
        fb.top(x + 0.04, z, x + 1, z + 0.04, 0, sc);
      }
    }
    const floor = new THREE.Mesh(fb.build(), this.matAisle);
    floor.receiveShadow = true;
    g.add(floor);

    // ---- cubicle carpets
    const cb = new BoxBuilder();
    for (const d of DESKS) {
      const { x, z } = d.center;
      cb.box(x, 0.02, z, CUBICLE.width - 0.1, 0.04, CUBICLE.depth - 0.1, new THREE.Color(0.78, 0.78, 0.78));
      cb.box(x, 0.022, z, CUBICLE.width - 0.34, 0.044, CUBICLE.depth - 0.34, new THREE.Color(1, 1, 1));
      for (let i = 0; i < 6; i++) cb.box(x - 1.3 + i * 0.52, 0.0445, z + 0.1, 0.02, 0.001, CUBICLE.depth - 0.5, new THREE.Color(0.94, 0.94, 0.94));
    }
    const carpet = new THREE.Mesh(cb.build(), this.matCarpet);
    carpet.receiveShadow = true;
    g.add(carpet);

    // ---- slab + curb
    const sb = new BoxBuilder();
    const white = new THREE.Color(1, 1, 1), dim = new THREE.Color(0.7, 0.7, 0.7);
    sb.box(0, -0.43, 0, W + 0.6, 0.8, D + 0.6, dim);
    sb.box(0, -0.78, 0, W + 0.9, 0.04, D + 0.9, new THREE.Color(0.5, 0.5, 0.5));
    sb.box(0, 0.09, ROOM.maxZ + 0.1, W + 0.3, 0.18, 0.22, white);
    sb.box(ROOM.maxX + 0.1, 0.09, 0, 0.22, 0.18, D + 0.3, white);
    const slab = new THREE.Mesh(sb.build(), this.matSlab);
    slab.receiveShadow = true;
    g.add(slab);

    // ---- walls
    const wb = new BoxBuilder();
    const H = ROOM.wallHeight, T = 0.3;
    const wallV = (x: number, y: number, z: number, w: number, h: number, d: number, k: number) => wb.box(x, y, z, w, h, d, new THREE.Color(k, k, k));
    // north (z = minZ)
    wallV(0, H / 2, ROOM.minZ - T / 2, W + T, H, T, 1);
    wallV(0, 0.45, ROOM.minZ + 0.02, W, 0.9, 0.04, 0.82);
    wallV(0, 0.92, ROOM.minZ + 0.04, W, 0.07, 0.08, 0.55);
    wallV(0, 0.13, ROOM.minZ + 0.05, W, 0.26, 0.1, 0.5);
    wallV(0, H - 0.1, ROOM.minZ + 0.04, W, 0.2, 0.08, 0.5);
    // west (x = minX)
    wallV(ROOM.minX - T / 2, H / 2, 0, T, H, D, 0.94);
    wallV(ROOM.minX + 0.02, 0.45, 0, 0.04, 0.9, D, 0.78);
    wallV(ROOM.minX + 0.04, 0.92, 0, 0.08, 0.07, D, 0.52);
    wallV(ROOM.minX + 0.05, 0.13, 0, 0.1, 0.26, D, 0.48);
    wallV(ROOM.minX + 0.04, H - 0.1, 0, 0.08, 0.2, D, 0.48);
    const walls = new THREE.Mesh(wb.build(), this.matWall);
    walls.receiveShadow = true;
    g.add(walls);

    // ---- windows & posters
    const pb = new BoxBuilder();
    const frame = 0xefe6da, frameD = 0xb8a890;
    const glassGeoCache = new Map<string, THREE.PlaneGeometry>();
    for (const w of WINDOWS) {
      const key = w.w + 'x' + w.h;
      let geo = glassGeoCache.get(key);
      if (!geo) { geo = new THREE.PlaneGeometry(w.w, w.h); glassGeoCache.set(key, geo); }
      const m = new THREE.Mesh(geo, this.winMat);
      const N = w.wall === 'N';
      const px = N ? w.at : ROOM.minX + 0.05, pz = N ? ROOM.minZ + 0.05 : w.at;
      m.position.set(px, w.y, pz);
      if (!N) m.rotation.y = Math.PI / 2;
      g.add(m);
      // frame boxes (in local wall space)
      const add = (u: number, v: number, wu: number, hv: number, c: number, depth = 0.1) => {
        if (N) pb.box(w.at + u, w.y + v, ROOM.minZ + 0.07, wu, hv, depth, c);
        else pb.box(ROOM.minX + 0.07, w.y + v, w.at + u, depth, hv, wu, c);
      };
      const ft = 0.09;
      add(0, w.h / 2 + ft / 2, w.w + ft * 2, ft, frame); add(0, -w.h / 2 - ft / 2, w.w + ft * 2, ft, frame);
      add(-w.w / 2 - ft / 2, 0, ft, w.h, frame); add(w.w / 2 + ft / 2, 0, ft, w.h, frame);
      add(0, 0, 0.05, w.h, frameD, 0.12);
      if (w.h > 1.4) add(0, 0, w.w, 0.05, frameD, 0.12);
      add(0, -w.h / 2 - ft - 0.04, w.w + 0.3, 0.06, frame, 0.22); // sill
    }
    for (const p of POSTERS) {
      const c = makeCanvasTex(56, 72, true);
      drawPoster(c.ctx, 56, 72, p.kind);
      c.tex.needsUpdate = true;
      const mat = new THREE.MeshBasicMaterial({ map: c.tex, toneMapped: false });
      this.tints.push(mat);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), mat);
      const N = p.wall === 'N';
      m.position.set(N ? p.at : ROOM.minX + 0.1, p.y, N ? ROOM.minZ + 0.1 : p.at);
      if (!N) m.rotation.y = Math.PI / 2;
      g.add(m);
      if (N) pb.box(p.at, p.y, ROOM.minZ + 0.055, p.w + 0.1, p.h + 0.1, 0.04, 0x2a2030);
      else pb.box(ROOM.minX + 0.055, p.y, p.at, 0.04, p.h + 0.1, p.w + 0.1, 0x2a2030);
    }

    // ---- decor
    bigPlant(pb, ROOM.minX + 0.7, ROOM.minZ + 0.8, 1);
    bigPlant(pb, ROOM.maxX - 0.8, ROOM.maxZ - 1.0, 2);
    bigPlant(pb, ROOM.maxX - 0.8, 1.2, 3);
    bigPlant(pb, ROOM.minX + 0.8, ROOM.maxZ - 1.0, 4);
    bigPlant(pb, 4.3, ROOM.minZ + 0.8, 5);
    bigPlant(pb, -4.5, ROOM.minZ + 0.8, 6);
    waterCooler(pb, ROOM.minX + 0.6, 5.4);
    coffeeStation(pb, ROOM.minX + 0.6, 7.0, 9.9);
    // low bench along the east edge + vending-ish cabinet
    pb.box(ROOM.maxX - 0.5, 0.25, 4.0, 0.6, 0.5, 2.4, 0x5a4a6a);
    pb.box(ROOM.maxX - 0.5, 0.52, 4.0, 0.66, 0.08, 2.5, 0x8a7aa8);
    plant(pb, ROOM.maxX - 0.5, 4.0, 0.6, 9, 0.56);
    // entry mat on south edge
    pb.box(0, 0.025, ROOM.maxZ - 0.6, 3.4, 0.03, 1.0, 0x3a3048);
    pb.box(0, 0.04, ROOM.maxZ - 0.6, 3.0, 0.01, 0.7, 0x5a4a78);
    const props = meshFrom(pb, sh.vc);
    g.add(props);

    // ---- window light patches on the floor
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    let vi = 0;
    const patch = (x0: number, z0: number, x1: number, z1: number, sx: number, sz: number) => {
      pos.push(x0, 0.062, z0, x1, 0.062, z1, x1 + sx, 0.062, z1 + sz, x0 + sx, 0.062, z0 + sz);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    };
    for (const w of WINDOWS) {
      if (w.w < 1.5) continue;
      if (w.wall === 'W') patch(ROOM.minX, w.at - w.w / 2, ROOM.minX, w.at + w.w / 2, 5.2, 1.4);
      else patch(w.at - w.w / 2, ROOM.minZ, w.at + w.w / 2, ROOM.minZ, 1.8, 4.6);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    pg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    pg.setIndex(idx);
    this.patchMesh = new THREE.Mesh(pg, this.patchMat);
    this.patchMesh.renderOrder = 1;
    g.add(this.patchMesh);
  }

  applyPalette(p: Palette): void {
    if (this.lastPal === p) return;
    this.lastPal = p;
    this.matAisle.color.setHex(p.floorAisle);
    this.matCarpet.color.setHex(p.floorCarpet);
    this.matWall.color.setHex(p.wall);
    this.matSlab.color.setHex(p.slab);
    drawWindowArt(this.winTex.ctx, 40, 26, p);
    this.winTex.tex.needsUpdate = true;
    this.winMat.color.setScalar(p.posterTint);
    for (const t of this.tints) t.color.setScalar(p.posterTint);
    this.patchMat.color.setHex(p.windowGlow.color);
    this.patchMat.opacity = p.windowGlow.opacity;
  }
}
void STATIONS;
