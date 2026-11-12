import * as THREE from 'three';

/** Mulberry32 PRNG */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ColorLike = number | string | THREE.Color;

const UNIT_POS = [
  // +x
  1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1,
  // -x
  -1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1,
  // +y
  -1, 1, -1, -1, 1, 1, 1, 1, 1, 1, 1, -1,
  // -y
  -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1,
  // +z
  -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
  // -z
  1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1,
];
const UNIT_NOR = [1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1];

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();

/** Accumulates axis-aligned (optionally rotated) boxes with per-box vertex colours into one merged geometry. */
export class BoxBuilder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  idx: number[] = [];

  box(cx: number, cy: number, cz: number, w: number, h: number, d: number, color: ColorLike, ry = 0, rx = 0, rz = 0): this {
    _c.set(color as THREE.ColorRepresentation);
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(cx, cy, cz);
    _m.compose(_p, _q, _s.set(1, 1, 1));
    const base = this.pos.length / 3;
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const rotated = ry !== 0 || rx !== 0 || rz !== 0;
    for (let f = 0; f < 6; f++) {
      const nb = f * 3;
      if (rotated) _v.set(UNIT_NOR[nb], UNIT_NOR[nb + 1], UNIT_NOR[nb + 2]).applyQuaternion(_q);
      for (let k = 0; k < 4; k++) {
        const pb = f * 12 + k * 3;
        _v.set(UNIT_POS[pb] * hw, UNIT_POS[pb + 1] * hh, UNIT_POS[pb + 2] * hd).applyMatrix4(_m);
        this.pos.push(_v.x, _v.y, _v.z);
        if (rotated) {
          const n = _v.set(UNIT_NOR[nb], UNIT_NOR[nb + 1], UNIT_NOR[nb + 2]).applyQuaternion(_q);
          this.nor.push(n.x, n.y, n.z);
        } else this.nor.push(UNIT_NOR[nb], UNIT_NOR[nb + 1], UNIT_NOR[nb + 2]);
        this.col.push(_c.r, _c.g, _c.b);
      }
      const o = base + f * 4;
      this.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    return this;
  }

  /** Upward-facing horizontal quad (floor tiles etc). */
  top(x0: number, z0: number, x1: number, z1: number, y: number, color: ColorLike): this {
    _c.set(color as THREE.ColorRepresentation);
    const base = this.pos.length / 3;
    this.pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0);
    for (let i = 0; i < 4; i++) { this.nor.push(0, 1, 0); this.col.push(_c.r, _c.g, _c.b); }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return this;
  }

  get empty(): boolean { return this.pos.length === 0; }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx.length > 65000 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Convenience: build a Mesh from a builder with a shared vertex-colour material. */
export function meshFrom(b: BoxBuilder, mat: THREE.Material, cast = true, receive = true): THREE.Mesh {
  const m = new THREE.Mesh(b.build(), mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}
