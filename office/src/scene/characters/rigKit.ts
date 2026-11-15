/**
 * Voxel rig kit: dimensions, seeded looks, vertex-coloured box merging, and shared geometry/material caches.
 * Everything is built from boxes. Body parts use ONE shared Lambert material with vertex colours; glowing parts
 * use ONE shared Basic material with (faux-shaded) vertex colours. So 14 rigs cost only a handful of materials.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Provider, Role } from '../../types';
import { PROVIDERS, perProvider } from '../../providers';

// ---------------------------------------------------------------- dimensions (local units ~ metres)
export const DIM = {
  thigh: 0.37,
  shin: 0.37,
  legs: 0.74,
  hipX: 0.13,
  torsoBase: 0.1,
  torsoTop: 0.5,
  shoulderX: 0.35,
  shoulderY: 0.44,
  upper: 0.27,
  fore: 0.3,
  headPivotY: 0.5,
  headSize: 0.48,
  seatDrop: 0.35,
  /** Standing head-top height (without hair/tier ornaments). */
  standHeight: 1.74,
};

// ---------------------------------------------------------------- rng / colours
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mulHex(hex: number, f: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.round((hex & 255) * f));
  return (r << 16) | (g << 8) | b;
}
export function mixHex(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
}
export function parseHex(s: string | undefined, fallback = 0x888888): number {
  if (!s) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(s.trim());
  return m ? parseInt(m[1], 16) : fallback;
}

export interface Accent { main: number; dark: number; light: number; glow: number }
export const ACCENT: Record<Provider, Accent> = perProvider((id) => ({ ...PROVIDERS[id].accent }));

const SKINS = [0xf6d2b0, 0xe8b88c, 0xcf9560, 0xa9693b, 0x7a4a2a, 0x4f2f1c, 0xfbdcc4];
const HAIRS = [0x2a1d16, 0x4b2e1b, 0x8a5a2b, 0xdcaa45, 0xb5402a, 0x15151c, 0x8a8f9a, 0x7a4fd8, 0x2f9bd9, 0xe86aa6];
const PANTS = [0x2f3a56, 0x3a3a42, 0x5b4636, 0x4a5d3a, 0x56436b, 0x7a7f8c, 0x24303a];
const SHOES = [0xf2f2f2, 0x1d1d24, 0x8b4a20, 0xe5e0c8, 0xc23b3b, 0x3a5fb0];

export type HairStyle = 'flat' | 'bun' | 'spiky' | 'beanie' | 'none';
export interface Look {
  skin: number;
  hair: number;
  hairStyle: HairStyle;
  pants: number;
  shoe: number;
  glasses: boolean;
  longSleeve: boolean;
  beanie: number;
  beanieCuff: number;
  phase: number;
}

export function makeLook(seed: number, provider: Provider): Look {
  const r = mulberry32(seed * 7919 + 17);
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length) % a.length];
  const styles: HairStyle[] = ['flat', 'bun', 'spiky', 'beanie', 'none', 'flat', 'spiky'];
  const acc = ACCENT[provider];
  const beanie = pick([0x2b2f3d, 0xf2efe6, 0xe0b23a, mulHex(acc.dark, 0.9)]);
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    hairStyle: pick(styles),
    pants: pick(PANTS),
    shoe: pick(SHOES),
    glasses: r() < 0.35,
    longSleeve: r() < 0.35,
    beanie,
    beanieCuff: mixHex(beanie, 0xffffff, 0.35),
    phase: r() * 20,
  };
}

/** Tier label -> 1..5 (tiny nub, antenna, antenna+ball, crown fins, halo crown). Unknown -> 3. */
export function tierLevel(tier: string): number {
  switch ((tier || '').toLowerCase()) {
    case 'haiku': case 'mini': return 1;
    case 'sonnet': return 2;
    case 'standard': return 3;
    case 'opus': return 4;
    case 'fable': case 'max': return 5;
    default: return 3;
  }
}
/** Height of tier ornament above its mount point (for glyph placement). */
export const TIER_TOP = [0, 0.1, 0.29, 0.43, 0.32, 0.52];

// ---------------------------------------------------------------- box merging
const _c = new THREE.Color();

function colourize(g: THREE.BufferGeometry, hex: number, shaded: boolean): void {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const n = pos.count;
  const arr = new Float32Array(n * 3);
  _c.setHex(hex);
  for (let i = 0; i < n; i++) {
    let f = 1;
    if (shaded) {
      const ny = nor.getY(i);
      const nx = nor.getX(i);
      f = ny > 0.5 ? 1.0 : ny < -0.5 ? 0.5 : Math.abs(nx) > 0.5 ? 0.7 : 0.84;
    }
    arr[i * 3] = _c.r * f;
    arr[i * 3 + 1] = _c.g * f;
    arr[i * 3 + 2] = _c.b * f;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

/** Coloured box piece. rotation applied about the box centre, then translated. */
export function bx(w: number, h: number, d: number, x: number, y: number, z: number, hex: number,
  rx = 0, ry = 0, rz = 0, shaded = false): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.deleteAttribute('uv');
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  colourize(g, hex, shaded);
  return g;
}
/** Glow-style box (faux face shading, meant for the Basic material). */
export function gb(w: number, h: number, d: number, x: number, y: number, z: number, hex: number,
  rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  return bx(w, h, d, x, y, z, hex, rx, ry, rz, true);
}
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!g) throw new Error('merge failed');
  return g;
}

// ---------------------------------------------------------------- shared materials
export const matBody = new THREE.MeshLambertMaterial({ vertexColors: true });
export const matGlow = new THREE.MeshBasicMaterial({ vertexColors: true });
export const matParticle = new THREE.MeshBasicMaterial({ color: 0xffffff });

// ---------------------------------------------------------------- per-rig body geometry
export interface BodyGeos {
  pelvis: THREE.BufferGeometry;
  torso: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  upperR: THREE.BufferGeometry; foreR: THREE.BufferGeometry;
  upperL: THREE.BufferGeometry; foreL: THREE.BufferGeometry;
  thigh: THREE.BufferGeometry; shin: THREE.BufferGeometry;
  pack: THREE.BufferGeometry;
  badge: THREE.BufferGeometry;
  eyes: THREE.BufferGeometry;
  mouth: THREE.BufferGeometry;
}

export function badgeX(role: Role): number { return role === 'worker' ? 0.07 : 0; }

export function buildBody(look: Look, provider: Provider, role: Role, ownerHex: number | null): BodyGeos {
  const A = ACCENT[provider];
  const skin = look.skin;
  const dark = 0x1b1b24;
  const owner = ownerHex ?? 0x9aa0ad;

  // pelvis (static trousers block + belt)
  const pelvis = merge([
    bx(0.5, 0.13, 0.28, 0, 0.035, 0, look.pants),
    bx(0.53, 0.05, 0.31, 0, 0.085, 0, 0x2a2a30),
    bx(0.08, 0.05, 0.02, 0, 0.085, -0.16, 0xd8c26a),
  ]);

  // torso
  const tparts = [
    bx(0.52, 0.4, 0.3, 0, 0.3, 0, A.main),
    bx(0.52, 0.07, 0.3, 0, 0.465, 0, A.light),
    bx(0.18, 0.06, 0.18, 0, 0.52, 0, skin),
    bx(0.2, 0.2, 0.02, badgeX(role), 0.3, -0.155, dark),
  ];
  if (role === 'worker') {
    tparts.push(bx(0.034, 0.3, 0.02, -0.15, 0.34, -0.158, owner));
    tparts.push(bx(0.1, 0.13, 0.02, -0.15, 0.16, -0.158, owner));
    tparts.push(bx(0.07, 0.03, 0.022, -0.15, 0.19, -0.16, 0xffffff));
  } else {
    // shoulder sash stripe in owner colour on the chest edge
    tparts.push(bx(0.52, 0.035, 0.31, 0, 0.42, 0, owner));
  }
  if (role === 'worker') tparts.push(bx(0.52, 0.03, 0.31, 0, 0.42, 0, owner));
  const torso = merge(tparts);

  // head
  const hp: THREE.BufferGeometry[] = [
    bx(0.48, 0.48, 0.48, 0, 0.26, 0, skin),
    bx(0.04, 0.1, 0.08, 0.26, 0.26, 0, skin),
    bx(0.04, 0.1, 0.08, -0.26, 0.26, 0, skin),
    bx(0.06, 0.07, 0.04, 0, 0.21, -0.25, mulHex(skin, 0.9)),
  ];
  const hc = look.hair;
  const addBackHair = () => hp.push(bx(0.5, 0.3, 0.06, 0, 0.37, 0.23, hc));
  const addFringe = () => hp.push(bx(0.5, 0.07, 0.04, 0, 0.465, -0.245, hc));
  switch (look.hairStyle) {
    case 'flat':
      hp.push(bx(0.5, 0.1, 0.5, 0, 0.54, 0, hc));
      addBackHair(); addFringe();
      hp.push(bx(0.03, 0.12, 0.2, 0.245, 0.42, -0.1, hc), bx(0.03, 0.12, 0.2, -0.245, 0.42, -0.1, hc));
      break;
    case 'bun':
      hp.push(bx(0.5, 0.09, 0.5, 0, 0.535, 0, hc));
      addBackHair(); addFringe();
      hp.push(bx(0.2, 0.2, 0.2, 0, 0.64, 0.13, hc), bx(0.22, 0.04, 0.22, 0, 0.55, 0.13, A.main));
      break;
    case 'spiky': {
      hp.push(bx(0.5, 0.06, 0.5, 0, 0.52, 0, hc));
      addBackHair(); addFringe();
      const sp: [number, number, number, number][] = [
        [0, 0, 0.2, 0], [-0.15, -0.14, 0.15, 0.25], [0.15, -0.14, 0.15, -0.25], [-0.15, 0.14, 0.15, 0.25],
        [0.15, 0.14, 0.15, -0.25], [0, -0.16, 0.12, 0], [0, 0.16, 0.12, 0],
      ];
      for (const s of sp) hp.push(bx(0.12, s[2] + 0.04, 0.12, s[0], 0.55 + s[2] / 2, s[1], hc, s[1] * 0.8, 0, s[3] + s[0] * 0.5));
      break;
    }
    case 'beanie':
      hp.push(bx(0.52, 0.14, 0.52, 0, 0.51, 0, look.beanie));
      hp.push(bx(0.545, 0.07, 0.545, 0, 0.45, 0, look.beanieCuff));
      hp.push(bx(0.12, 0.1, 0.12, 0, 0.62, 0, look.beanieCuff));
      hp.push(bx(0.5, 0.1, 0.04, 0, 0.38, 0.24, hc));
      break;
    default:
      break;
  }
  if (look.glasses) {
    const gc = 0x15151c;
    for (const sx of [-1, 1]) {
      const cx = sx * 0.115;
      hp.push(bx(0.17, 0.025, 0.02, cx, 0.36, -0.248, gc), bx(0.17, 0.025, 0.02, cx, 0.245, -0.248, gc),
        bx(0.025, 0.12, 0.02, cx - 0.0725, 0.3, -0.248, gc), bx(0.025, 0.12, 0.02, cx + 0.0725, 0.3, -0.248, gc));
      hp.push(bx(0.02, 0.02, 0.4, sx * 0.245, 0.33, -0.04, gc));
    }
    hp.push(bx(0.06, 0.025, 0.02, 0, 0.33, -0.248, gc));
  }
  if (ownerHex !== null) {
    // owner head band (sits under any visor / hair fringe, wraps the head)
    hp.push(bx(0.5, 0.05, 0.5, 0, 0.405, 0, owner));
    // keep the band from hiding the eyes: eyes live at y 0.3 +- 0.05
  } else if (look.hairStyle !== 'beanie') {
    // no owner: nothing
  }
  if (role === 'orchestrator') {
    const gray = 0x2a2d38;
    hp.push(bx(0.55, 0.045, 0.08, 0, 0.525, 0.0, gray));
    hp.push(bx(0.04, 0.24, 0.07, 0.268, 0.4, 0, gray), bx(0.04, 0.24, 0.07, -0.268, 0.4, 0, gray));
    hp.push(bx(0.08, 0.17, 0.17, 0.29, 0.26, 0, A.main), bx(0.08, 0.17, 0.17, -0.29, 0.26, 0, A.main));
    hp.push(bx(0.09, 0.09, 0.09, 0.3, 0.26, 0, A.light), bx(0.09, 0.09, 0.09, -0.3, 0.26, 0, A.light));
    hp.push(bx(0.03, 0.03, 0.2, -0.29, 0.17, -0.14, gray));
    hp.push(bx(0.2, 0.03, 0.03, -0.2, 0.15, -0.255, gray));
    hp.push(bx(0.07, 0.07, 0.07, -0.1, 0.15, -0.255, 0x111116));
  } else if (role === 'integrator') {
    const g1 = 0x3ddc84;
    hp.push(bx(0.53, 0.06, 0.53, 0, 0.465, 0, mulHex(g1, 0.75)));
    hp.push(bx(0.5, 0.03, 0.26, 0, 0.455, -0.37, g1));
    hp.push(bx(0.5, 0.012, 0.03, 0, 0.455, -0.505, 0xb8ffd4));
  }
  const head = merge(hp);

  // arms
  const sleeveMain = A.main;
  const mkUpper = () => merge([
    bx(0.17, 0.27, 0.17, 0, -0.135, 0, sleeveMain),
    bx(0.18, 0.04, 0.18, 0, -0.25, 0, A.light),
    bx(0.18, 0.04, 0.18, 0, -0.07, 0, owner),
  ]);
  const mkFore = (left: boolean) => {
    const parts = [
      bx(0.145, 0.2, 0.145, 0, -0.1, 0, look.longSleeve ? A.dark : skin),
      bx(0.155, 0.035, 0.155, 0, -0.185, 0, 0x2a2a30),
      bx(0.15, 0.1, 0.15, 0, -0.25, 0, skin),
    ];
    if (left) parts.push(bx(0.05, 0.05, 0.02, -0.0, -0.185, -0.08, 0xdff3ff));
    return merge(parts);
  };
  const upperR = mkUpper(); const upperL = mkUpper();
  const foreR = mkFore(false); const foreL = mkFore(true);

  // legs
  const thigh = merge([bx(0.2, 0.37, 0.22, 0, -0.185, 0, look.pants)]);
  const shin = merge([
    bx(0.18, 0.27, 0.2, 0, -0.135, 0, look.pants),
    bx(0.2, 0.08, 0.3, 0, -0.31, -0.05, look.shoe),
    bx(0.21, 0.03, 0.31, 0, -0.355, -0.05, mulHex(look.shoe, 0.45)),
  ]);

  // back pack + gauge frame (static)
  const pack = merge([
    bx(0.36, 0.34, 0.12, 0, 0.29, 0.21, A.dark),
    bx(0.38, 0.05, 0.14, 0, 0.45, 0.21, mulHex(A.dark, 0.75)),
    bx(0.12, 0.3, 0.05, 0, 0.29, 0.295, 0x14141b),
    bx(0.04, 0.02, 0.07, 0.07, 0.4, 0.3, 0xffcc44),
    bx(0.04, 0.02, 0.07, 0.07, 0.4 - 0.0, 0.3, 0xffcc44),
  ]);

  // chest badge (glow)
  let badge: THREE.BufferGeometry;
  if (provider === 'claude') {
    badge = merge([
      gb(0.17, 0.04, 0.02, 0, 0, 0, A.glow),
      gb(0.17, 0.04, 0.02, 0, 0, 0, A.glow, 0, 0, Math.PI / 2),
      gb(0.15, 0.04, 0.02, 0, 0, 0, A.glow, 0, 0, Math.PI / 4),
      gb(0.15, 0.04, 0.02, 0, 0, 0, A.glow, 0, 0, -Math.PI / 4),
    ]);
  } else {
    badge = merge([
      gb(0.07, 0.035, 0.02, -0.055, 0.025, 0, A.glow, 0, 0, Math.PI / 4),
      gb(0.07, 0.035, 0.02, -0.055, -0.025, 0, A.glow, 0, 0, -Math.PI / 4),
      gb(0.07, 0.035, 0.02, 0.055, 0.025, 0, A.glow, 0, 0, -Math.PI / 4),
      gb(0.07, 0.035, 0.02, 0.055, -0.025, 0, A.glow, 0, 0, Math.PI / 4),
      gb(0.032, 0.12, 0.02, 0, 0, 0, A.glow, 0, 0, -0.35),
    ]);
  }

  const eyes = merge([
    bx(0.1, 0.11, 0.02, -0.11, 0, 0, 0xffffff), bx(0.1, 0.11, 0.02, 0.11, 0, 0, 0xffffff),
    bx(0.055, 0.075, 0.024, -0.105, -0.005, -0.002, 0x15151f), bx(0.055, 0.075, 0.024, 0.105, -0.005, -0.002, 0x15151f),
  ]);
  const mouth = merge([bx(0.12, 0.05, 0.02, 0, 0, 0, 0x5b2a2a)]);

  return { pelvis, torso, head, upperR, upperL, foreR, foreL, thigh, shin, pack, badge, eyes, mouth };
}

export function ornamentMount(look: Look): number {
  return look.hairStyle === 'spiky' ? 0.6 : look.hairStyle === 'beanie' ? 0.67 : 0.57;
}

// ---------------------------------------------------------------- tier ornaments (cached per provider+level)
export interface TierGeos { body: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null; halo: THREE.BufferGeometry | null }
const tierCache = new Map<string, TierGeos>();
export function tierGeos(level: number, provider: Provider): TierGeos {
  const key = provider + level;
  const hit = tierCache.get(key);
  if (hit) return hit;
  const A = ACCENT[provider];
  const gold = 0xffd24a;
  const metal = 0x3a3d4a;
  let body: THREE.BufferGeometry | null = null;
  let glow: THREE.BufferGeometry | null = null;
  let halo: THREE.BufferGeometry | null = null;
  if (level === 1) {
    glow = merge([gb(0.09, 0.09, 0.09, 0, 0.045, 0, A.glow)]);
  } else if (level === 2) {
    body = merge([bx(0.035, 0.2, 0.035, 0, 0.1, 0, metal), bx(0.07, 0.03, 0.07, 0, 0.015, 0, metal)]);
    glow = merge([gb(0.09, 0.09, 0.09, 0, 0.245, 0, A.glow)]);
  } else if (level === 3) {
    body = merge([bx(0.035, 0.26, 0.035, 0, 0.13, 0, metal), bx(0.08, 0.03, 0.08, 0, 0.015, 0, metal)]);
    glow = merge([gb(0.17, 0.17, 0.17, 0, 0.345, 0, A.glow, 0.6, 0.0, 0.6)]);
  } else {
    const crown: THREE.BufferGeometry[] = [
      bx(0.4, 0.07, 0.06, 0, 0.035, 0.17, gold), bx(0.4, 0.07, 0.06, 0, 0.035, -0.17, gold),
      bx(0.06, 0.07, 0.4, 0.17, 0.035, 0, gold), bx(0.06, 0.07, 0.4, -0.17, 0.035, 0, gold),
    ];
    const gems: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      crown.push(bx(0.08, 0.16, 0.08, sx * 0.17, 0.15, sz * 0.17, gold));
      gems.push(gb(0.075, 0.075, 0.075, sx * 0.17, 0.25, sz * 0.17, A.glow));
    }
    crown.push(bx(0.1, 0.26, 0.1, 0, 0.13, 0, gold));
    gems.push(gb(0.09, 0.09, 0.09, 0, 0.3, 0, A.glow));
    body = merge(crown);
    glow = merge(gems);
    if (level === 5) {
      halo = merge([
        gb(0.54, 0.05, 0.06, 0, 0.5, 0.24, 0xfff1b0), gb(0.54, 0.05, 0.06, 0, 0.5, -0.24, 0xfff1b0),
        gb(0.06, 0.05, 0.42, 0.24, 0.5, 0, 0xfff1b0), gb(0.06, 0.05, 0.42, -0.24, 0.5, 0, 0xfff1b0),
      ]);
    }
  }
  const out = { body, glow, halo };
  tierCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------- paper / book stacks
const stackCache = new Map<string, THREE.BufferGeometry>();
export const MAX_STACK = 6;
const TAB_COLORS = [0xff9f43, 0x5ec2ff, 0xb48cff, 0xffd84a, 0xff6f91, 0x6be585];
export function stackGeo(kind: 'tickets' | 'pr' | 'rejected' | 'skills', count: number, colors: string[]): THREE.BufferGeometry {
  const n = Math.max(1, Math.min(MAX_STACK, count | 0));
  const key = kind + n + (kind === 'skills' ? colors.join('') : '');
  const hit = stackCache.get(key);
  if (hit) return hit;
  const parts: THREE.BufferGeometry[] = [];
  const th = kind === 'skills' ? 0.06 : 0.03;
  const total = n * th;
  for (let i = 0; i < n; i++) {
    const y = i * th + th / 2 - total / 2;
    const jx = Math.sin(i * 12.9) * 0.012;
    const jz = Math.cos(i * 7.7) * 0.01;
    const ry = Math.sin(i * 5.3) * 0.05;
    if (kind === 'skills') {
      const c = parseHex(colors.length ? colors[i % colors.length] : undefined, TAB_COLORS[i % TAB_COLORS.length]);
      const w = 0.3 - (i % 3) * 0.015;
      parts.push(bx(w, th * 0.92, 0.23, jx, y, jz, c, 0, ry, 0));
      parts.push(bx(w - 0.03, th * 0.55, 0.01, jx, y, jz + 0.115, 0xf4efe0, 0, ry, 0));
      parts.push(bx(0.03, th * 0.95, 0.235, jx - w / 2 + 0.015, y, jz, mulHex(c, 0.72), 0, ry, 0));
      parts.push(bx(0.07, th * 0.3, 0.012, jx, y, jz - 0.117, 0xffffff, 0, ry, 0));
    } else {
      parts.push(bx(0.3, th * 0.94, 0.23, jx, y, jz, 0xf5f2e8, 0, ry, 0));
      if (kind === 'tickets') {
        parts.push(bx(0.075, th, 0.06, jx + 0.115, y, jz - 0.085, TAB_COLORS[i % TAB_COLORS.length], 0, ry, 0));
        parts.push(bx(0.18, th * 0.96, 0.012, jx - 0.04, y, jz - 0.02, 0xcfcab8, 0, ry, 0));
      } else if (kind === 'pr') {
        parts.push(bx(0.3, th * 0.98, 0.045, jx, y, jz - 0.07, 0x34d399, 0, ry, 0));
      } else {
        parts.push(bx(0.3, th * 0.98, 0.045, jx, y, jz - 0.07, 0xef4444, 0, ry, 0));
      }
    }
  }
  if (kind === 'rejected') {
    const ty = total / 2 + 0.002;
    parts.push(bx(0.24, 0.012, 0.04, 0, ty, 0.03, 0xef4444, 0, 0.75, 0));
    parts.push(bx(0.24, 0.012, 0.04, 0, ty, 0.03, 0xef4444, 0, -0.75, 0));
  }
  const g = merge(parts);
  if (stackCache.size > 80) {
    for (const v of stackCache.values()) v.dispose();
    stackCache.clear();
  }
  stackCache.set(key, g);
  return g;
}

// ---------------------------------------------------------------- props
export const PropGeo = {
  _clip: null as THREE.BufferGeometry | null,
  _marker: null as THREE.BufferGeometry | null,
  _pen: null as THREE.BufferGeometry | null,
  _stamp: null as THREE.BufferGeometry | null,
  _sheet: null as THREE.BufferGeometry | null,
  _plane: null as THREE.BufferGeometry | null,
  clipboard(): THREE.BufferGeometry {
    return (this._clip ??= merge([
      bx(0.26, 0.34, 0.025, 0, 0, 0, 0x9a6a3c),
      bx(0.21, 0.28, 0.012, 0, -0.01, -0.012, 0xf6f3ea),
      bx(0.09, 0.04, 0.03, 0, 0.17, -0.005, 0x8c929e),
      bx(0.15, 0.015, 0.014, 0, 0.04, -0.02, 0x9aa0ad),
      bx(0.15, 0.015, 0.014, 0, 0.0, -0.02, 0x9aa0ad),
      bx(0.1, 0.015, 0.014, -0.025, -0.04, -0.02, 0x9aa0ad),
    ]));
  },
  marker(): THREE.BufferGeometry {
    return (this._marker ??= merge([
      bx(0.045, 0.2, 0.045, 0, -0.1, 0, 0x2e6bff),
      bx(0.05, 0.05, 0.05, 0, -0.01, 0, 0xf2f2f2),
      bx(0.03, 0.04, 0.03, 0, -0.22, 0, 0x1b3fa6),
    ]));
  },
  pen(): THREE.BufferGeometry {
    return (this._pen ??= merge([
      bx(0.035, 0.2, 0.035, 0, -0.1, 0, 0xe03a3a),
      bx(0.025, 0.05, 0.025, 0, -0.225, 0, 0x2a2a30),
    ]));
  },
  /** Stamp held in a fist: knob in hand, base below (world-aligned by the rig). Origin = fist. */
  stamp(): THREE.BufferGeometry {
    return (this._stamp ??= merge([
      bx(0.07, 0.1, 0.07, 0, -0.04, 0, 0x6a4a2a),
      bx(0.09, 0.03, 0.09, 0, -0.1, 0, 0x6a4a2a),
      bx(0.24, 0.05, 0.17, 0, -0.135, 0, 0xc23b3b),
      bx(0.22, 0.025, 0.15, 0, -0.17, 0, 0x7a1f1f),
    ]));
  },
  /** Folded paper airplane, nose toward -z, origin at its centre. */
  plane(): THREE.BufferGeometry {
    return (this._plane ??= merge([
      bx(0.035, 0.05, 0.22, 0, -0.01, 0, 0xdcdcd0),
      bx(0.2, 0.012, 0.12, 0.1, 0.012, 0.03, 0xffffff, 0, 0, 0.18),
      bx(0.2, 0.012, 0.12, -0.1, 0.012, 0.03, 0xffffff, 0, 0, -0.18),
      bx(0.03, 0.03, 0.05, 0, 0, -0.12, 0xff6f91),
    ]));
  },
  sheet(): THREE.BufferGeometry {
    return (this._sheet ??= merge([
      bx(0.26, 0.02, 0.2, 0, 0, 0, 0xf5f2e8),
      bx(0.16, 0.022, 0.012, -0.03, 0, -0.04, 0xa8a393),
      bx(0.16, 0.022, 0.012, -0.03, 0, -0.01, 0xa8a393),
      bx(0.1, 0.022, 0.012, -0.06, 0, 0.02, 0xa8a393),
      bx(0.05, 0.024, 0.05, 0.09, 0, 0.07, 0x34d399),
    ]));
  },
};

// ---------------------------------------------------------------- status glyphs (glow, symmetric about y)
const glyphCache = new Map<string, THREE.BufferGeometry>();
function cached(k: string, f: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = glyphCache.get(k);
  if (!g) { g = f(); glyphCache.set(k, g); }
  return g;
}
export const Glyph = {
  bang: () => cached('bang', () => merge([
    gb(0.17, 0.12, 0.17, 0, 0.2, 0, 0xff4d5e), gb(0.12, 0.16, 0.12, 0, 0.06, 0, 0xff4d5e), gb(0.12, 0.12, 0.12, 0, -0.17, 0, 0xff4d5e),
  ])),
  hourglass: () => cached('hg', () => {
    const c = 0xffc233, cap = 0xb97a1c;
    const p: THREE.BufferGeometry[] = [gb(0.05, 0.04, 0.05, 0, 0, 0, c)];
    for (const s of [1, -1]) {
      p.push(gb(0.1, 0.06, 0.1, 0, s * 0.05, 0, c), gb(0.17, 0.06, 0.17, 0, s * 0.11, 0, c), gb(0.24, 0.06, 0.24, 0, s * 0.17, 0, c));
      p.push(gb(0.3, 0.04, 0.3, 0, s * 0.22, 0, cap));
    }
    return merge(p);
  }),
  z: (size: number) => cached('z' + size, () => {
    const c = 0xcfe6ff, t = 0.045;
    const L = Math.hypot(size, size);
    return merge([
      gb(size, t, 0.07, 0, size / 2, 0, c), gb(size, t, 0.07, 0, -size / 2, 0, c),
      gb(t, L, 0.07, 0, 0, 0, c, 0, 0, -Math.PI / 4 - 0.1),
    ]);
  }),
  pencil: () => cached('pencil', () => {
    const g = merge([
      gb(0.07, 0.26, 0.07, 0, 0, 0, 0xffd23f), gb(0.07, 0.05, 0.07, 0, 0.155, 0, 0xff8fb1),
      gb(0.07, 0.06, 0.07, 0, -0.16, 0, 0xf0cfa3), gb(0.03, 0.03, 0.03, 0, -0.205, 0, 0x2a2a30),
      gb(0.05, 0.05, 0.05, 0.2, 0.1, 0, 0xfff3b0), gb(0.04, 0.04, 0.04, -0.2, -0.05, 0.05, 0xfff3b0), gb(0.04, 0.04, 0.04, 0.05, 0.25, -0.2, 0xfff3b0),
    ]);
    return g;
  }),
  think: () => cached('think', () => merge([
    gb(0.08, 0.08, 0.08, 0.14, -0.05, 0, 0xcfe8ff), gb(0.08, 0.08, 0.08, -0.07, 0.0, 0.12, 0xcfe8ff), gb(0.08, 0.08, 0.08, -0.07, 0.07, -0.12, 0xcfe8ff),
  ])),
  question: () => cached('q', () => {
    const rows = ['.XXX.', 'X...X', '....X', '..XX.', '..X..', '.....', '..X..'];
    const v = 0.065, c = 0xffd84a;
    const p: THREE.BufferGeometry[] = [];
    for (let r = 0; r < rows.length; r++) for (let q = 0; q < 5; q++) {
      if (rows[r][q] !== 'X') continue;
      const x = (q - 2) * v, y = (3 - r) * v;
      p.push(gb(v, v, 0.09, x, y, 0, c));
    }
    return merge(p);
  }),
  star: () => cached('star', () => merge([
    gb(0.14, 0.14, 0.14, 0, 0, 0, 0xffe066),
    gb(0.06, 0.34, 0.06, 0, 0, 0, 0xffe066), gb(0.34, 0.06, 0.06, 0, 0, 0, 0xffe066), gb(0.06, 0.06, 0.34, 0, 0, 0, 0xffe066),
    gb(0.05, 0.24, 0.05, 0, 0, 0, 0xfff3b0, 0, 0, Math.PI / 4), gb(0.05, 0.24, 0.05, 0, 0, 0, 0xfff3b0, 0, 0, -Math.PI / 4),
    gb(0.05, 0.24, 0.05, 0, 0, 0, 0xfff3b0, Math.PI / 4, 0, 0), gb(0.05, 0.24, 0.05, 0, 0, 0, 0xfff3b0, -Math.PI / 4, 0, 0),
  ])),
};

// ---------------------------------------------------------------- misc shared geometry
export const SharedGeo = {
  _drone: null as THREE.BufferGeometry | null,
  _ring: null as THREE.BufferGeometry | null,
  _sel: null as THREE.BufferGeometry | null,
  _flashRing: null as THREE.BufferGeometry | null,
  _flashShell: null as THREE.BufferGeometry | null,
  _particle: null as THREE.BufferGeometry | null,
  _cart: null as THREE.BufferGeometry | null,
  _gaugeFill: null as THREE.BufferGeometry | null,
  drone(provider: Provider): THREE.BufferGeometry {
    const A = ACCENT[provider];
    const key = '_drone' + provider;
    const self = this as unknown as Record<string, THREE.BufferGeometry | undefined>;
    return (self[key] ??= merge([
      gb(0.17, 0.15, 0.17, 0, 0, 0, A.glow),
      gb(0.2, 0.025, 0.04, 0, 0.09, 0, 0xffffff), gb(0.04, 0.025, 0.2, 0, 0.09, 0, 0xffffff),
      gb(0.12, 0.04, 0.02, 0, 0.01, -0.09, 0x14141b),
    ]));
  },
  selRing(): THREE.BufferGeometry {
    if (!this._sel) {
      const g = new THREE.RingGeometry(0.66, 0.8, 8, 1);
      g.rotateX(-Math.PI / 2);
      g.rotateY(Math.PI / 8);
      this._sel = g;
    }
    return this._sel;
  },
  flashRing(): THREE.BufferGeometry {
    return (this._flashRing ??= merge([
      gb(1.0, 0.05, 0.07, 0, 0, 0.5, 0xffffff), gb(1.0, 0.05, 0.07, 0, 0, -0.5, 0xffffff),
      gb(0.07, 0.05, 1.0, 0.5, 0, 0, 0xffffff), gb(0.07, 0.05, 1.0, -0.5, 0, 0, 0xffffff),
    ]));
  },
  flashShell(): THREE.BufferGeometry {
    return (this._flashShell ??= merge([
      bx(0.6, 0.5, 0.38, 0, 0.3, 0.02, 0xffffff), bx(0.56, 0.56, 0.56, 0, 0.78, 0, 0xffffff), bx(0.42, 0.38, 0.2, 0, 0.29, 0.22, 0xffffff),
    ]));
  },
  particle(): THREE.BufferGeometry {
    return (this._particle ??= new THREE.BoxGeometry(0.07, 0.07, 0.07));
  },
  cartridge(): THREE.BufferGeometry {
    return (this._cart ??= merge([
      bx(0.085, 0.14, 0.06, 0, 0.07, 0, 0x2a2a34),
      gb(0.06, 0.085, 0.066, 0, 0.075, 0, 0xffffff),
      bx(0.05, 0.02, 0.05, 0, 0.0, 0, 0xb8b8c8),
    ]));
  },
  gaugeFill(): THREE.BufferGeometry {
    if (!this._gaugeFill) {
      const g = new THREE.BoxGeometry(0.14, 1, 0.07);
      g.translate(0, 0.5, 0);
      this._gaugeFill = g;
    }
    return this._gaugeFill;
  },
};
