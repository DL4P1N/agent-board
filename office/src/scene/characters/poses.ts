/**
 * Procedural pose library. Each pose writes ~31 "channels" (joint angles etc.) into a Float32Array.
 * The rig evaluates the outgoing and incoming pose and lerps channels to cross-fade; no allocation per frame.
 *
 * Angle conventions (all radians; sign handling for left/right/forward lives in the rig):
 *  pitch  : + = limb swings FORWARD (-z) / torso leans forward / head looks DOWN
 *  abduct : + = limb moves OUTWARD (away from the body centre)
 *  flex   : + = elbow bends (forearm forward) / knee bends (shin backward)
 *  yaw    : + = turn to the character's LEFT
 */
import type { Pose } from '../../types';

export const BX = 0, BY = 1, BZ = 2, BYAW = 3, BROLL = 4;
export const TP = 5, TR = 6, TY = 7;
export const HP = 8, HY = 9, HR = 10;
export const RSP = 11, RSA = 12, REF = 13, LSP = 14, LSA = 15, LEF = 16;
export const RHP = 17, RHA = 18, RKF = 19, LHP = 20, LHA = 21, LKF = 22;
export const SEAT = 23, EYE = 24, MOUTH = 25, SMILE = 26;
export const SY = 27, SZ = 28, SS = 29, BREATH = 30;
export const PLX = 31, PLY = 32, PLZ = 33, PLS = 34;
export const NCH = 35;

export interface PCtx {
  /** carrying anything right now */
  carry: boolean;
  /** remembers that we carried something recently (used for the drop half of a pickup loop) */
  hasLast: boolean;
  /** pickup reaches UP to a shelf (skills / empty) instead of down/forward (papers) */
  reachUp: boolean;
  /** per-rig phase offset (seconds) */
  phase: number;
  integrator: boolean;
  orchestrator: boolean;
}

const PI = Math.PI;
const HALF_PI = Math.PI / 2;

// ------------------------------------------------------------------ small math
export function sm(x: number): number { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
function env(t: number, a: number, b: number, c: number, d: number): number {
  if (t <= a || t >= d) return 0;
  if (t < b) return sm((t - a) / (b - a));
  if (t < c) return 1;
  return 1 - sm((t - c) / (d - c));
}
function look(t: number, ph: number): number { return Math.sin(t * 0.9 + ph) * Math.sin(t * 0.37 + ph * 1.7); }
function pos(x: number): number { return x > 0 ? x : 0; }

// ------------------------------------------------------------------ two-bone arm IK (torso frame)
const L1 = 0.27, L2 = 0.3, SHX = 0.35, SHY = 0.44;
/** Targets are in TORSO space (origin at hips, +y up, -z forward). Writes shoulder pitch/abduct + elbow flex. */
export function ikArm(c: Float32Array, left: boolean, tx: number, ty: number, tz: number): void {
  let hx = tx - (left ? -SHX : SHX);
  if (left) hx = -hx;
  let hy = ty - SHY;
  let hz = tz;
  let d = Math.sqrt(hx * hx + hy * hy + hz * hz);
  const maxd = L1 + L2 - 0.004, mind = Math.abs(L1 - L2) + 0.05;
  if (d > maxd) { const k = maxd / d; hx *= k; hy *= k; hz *= k; d = maxd; }
  else if (d < mind) { if (d < 1e-4) { hz = -mind; d = mind; } else { const k = mind / d; hx *= k; hy *= k; hz *= k; d = mind; } }
  let cf = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  cf = cf < -1 ? -1 : cf > 1 ? 1 : cf;
  const f = Math.acos(cf);
  const A = L1 + L2 * cf;
  const B = L2 * Math.sin(f);
  let sr = hx / A;
  sr = sr < -0.97 ? -0.97 : sr > 0.97 ? 0.97 : sr;
  const r = Math.asin(sr);
  const cc = A * Math.cos(r);
  let p = Math.atan2(hz, hy) - Math.atan2(-B, -cc);
  while (p < -1.4) p += 2 * PI;
  while (p > 2 * PI - 1.4) p -= 2 * PI;
  const o = left ? LSP : RSP;
  c[o] = p; c[o + 1] = r; c[o + 2] = f;
}
/** Targets relative to the hip pivot but in WORLD orientation, converted through torso pitch `tp` (forward lean). */
export function ikArmW(c: Float32Array, left: boolean, x: number, yw: number, zw: number, tp: number): void {
  const cs = Math.cos(tp), sn = Math.sin(tp);
  ikArm(c, left, x, yw * cs - zw * sn, yw * sn + zw * cs);
}
function lerpArm(c: Float32Array, T: Float32Array, left: boolean, w: number): void {
  const o = left ? LSP : RSP;
  for (let i = 0; i < 3; i++) c[o + i] += (T[o + i] - c[o + i]) * w;
}
const T1 = new Float32Array(NCH);

function rest(c: Float32Array): void {
  c.fill(0);
  c[EYE] = 1;
  c[RSA] = 0.07; c[LSA] = 0.07; c[REF] = 0.14; c[LEF] = 0.14;
  c[RHA] = 0.03; c[LHA] = 0.03;
}
function seatLegs(c: Float32Array): void {
  c[SEAT] = 1;
  c[RHP] = HALF_PI; c[LHP] = HALF_PI;
  c[RKF] = HALF_PI; c[LKF] = HALF_PI;
  c[RHA] = 0.06; c[LHA] = 0.06;
}
function holdStack(c: Float32Array, y: number, z: number): void {
  ikArm(c, false, 0.215, y, z - 0.06);
  ikArm(c, true, -0.215, y, z - 0.06);
  c[SY] = y; c[SZ] = z; c[SS] = 1;
}
export const HOLD_Y = 0.2, HOLD_Z = -0.37;
export function holdChannels(dst: Float32Array, bobY: number): void { holdStack(dst, HOLD_Y + bobY, HOLD_Z); }

function walkLegs(c: Float32Array, t: number, armSwing: number): void {
  const ph = t * 2 * PI;
  const s1 = Math.sin(ph), c1 = Math.cos(ph);
  c[RHP] = 0.55 * s1; c[LHP] = -0.55 * s1;
  let a = pos(c1); a = a * a * (3 - 2 * a);
  let b = pos(-c1); b = b * b * (3 - 2 * b);
  c[RKF] = 0.12 + 0.95 * a; c[LKF] = 0.12 + 0.95 * b;
  c[RSP] = -armSwing * s1; c[LSP] = armSwing * s1;
  c[REF] = 0.25 + 0.7 * pos(-s1) * (armSwing / 0.65); c[LEF] = 0.25 + 0.7 * pos(s1) * (armSwing / 0.65);
  c[BYAW] = 0.1 * s1;
  c[TY] = -0.17 * s1;
  c[HY] = 0.07 * s1;
  c[BROLL] = 0.025 * s1;
  c[TR] = -0.03 * s1;
  c[TP] = 0.07;
}

// ------------------------------------------------------------------ poses
type PoseFn = (c: Float32Array, t: number, pt: number, s: boolean, x: PCtx) => void;

const idle: PoseFn = (c, t, _pt, s, x) => {
  rest(c);
  const br = Math.sin(t * 2.1 + x.phase);
  c[BREATH] = br;
  c[HY] = 0.7 * look(t, x.phase);
  c[HP] = 0.05 * look(t * 0.8, x.phase + 2) - 0.02;
  if (s) {
    seatLegs(c);
    c[TP] = 0.03 + 0.01 * br;
    ikArmW(c, false, 0.13, 0.12, -0.24, 0.03);
    ikArmW(c, true, -0.13, 0.12, -0.24, 0.03);
  } else {
    const sw = Math.sin(t * 0.45 + x.phase);
    c[BX] = 0.03 * sw; c[BROLL] = 0.03 * sw; c[TR] = -0.025 * sw;
    c[RKF] = 0.04 + 0.08 * pos(sw); c[LKF] = 0.04 + 0.08 * pos(-sw);
    c[RSP] = 0.03 * br; c[LSP] = -0.03 * br;
    c[TP] = 0.012 * br;
  }
};

const walk: PoseFn = (c, t) => {
  rest(c);
  walkLegs(c, t, 0.62);
  c[BREATH] = 0;
};

const carryWalk: PoseFn = (c, t) => {
  rest(c);
  walkLegs(c, t, 0.0);
  const ph = t * 2 * PI;
  c[TY] = -0.05 * Math.sin(ph); c[TP] = 0.0; c[TR] = 0;
  holdStack(c, HOLD_Y + 0.016 * Math.sin(2 * ph + 1), HOLD_Z + 0.008 * Math.sin(ph));
};

const pickup: PoseFn = (c, t, pt, _s, x) => {
  rest(c);
  c[BREATH] = Math.sin(t * 2.1);
  const u = (pt / 1.9) % 1;
  // r: 0 = hands at chest, 1 = fully extended at the pick/drop point
  let r: number;
  if (u < 0.4) r = sm(u / 0.4);
  else if (u < 0.55) r = 1;
  else if (u < 0.95) r = 1 - sm((u - 0.55) / 0.4);
  else r = 0;
  // stack visible: carrying -> hidden in first half, appears on grab; dropping -> shown first half, gone after
  let vis: number;
  if (x.carry) vis = sm((u - 0.47) / 0.08);
  else if (x.hasLast) vis = 1 - sm((u - 0.47) / 0.08);
  else vis = 0;
  c[HY] = 0.15 * Math.sin(t * 1.3);
  if (x.reachUp) {
    // reach up to a shelf: arms raised, slight lean back, rise on toes (legs straighten)
    c[TP] = -0.12 * r;
    c[HP] = -0.25 * r;
    const y = HOLD_Y + (0.62 - HOLD_Y) * r;
    const z = HOLD_Z + (-0.42 - HOLD_Z) * r;
    ikArm(c, false, 0.215, y, z - 0.06); ikArm(c, true, -0.215, y, z - 0.06);
    c[SY] = y; c[SZ] = z; c[SS] = vis;
    c[BZ] = -0.03 * r;
    c[RKF] = 0.04; c[LKF] = 0.04;
  } else {
    c[TP] = 0.55 * r;
    c[RHP] = 0.45 * r; c[LHP] = 0.45 * r; c[RKF] = 0.95 * r; c[LKF] = 0.95 * r;
    c[BZ] = 0.1 * r;
    c[HP] = -0.3 * r;
    const y = HOLD_Y + (0.12 - HOLD_Y) * r;
    const z = HOLD_Z + (-0.5 - HOLD_Z) * r;
    ikArm(c, false, 0.215, y, z - 0.06); ikArm(c, true, -0.215, y, z - 0.06);
    c[SY] = y; c[SZ] = z; c[SS] = vis;
  }
};

const typeP: PoseFn = (c, t, _pt, s, x) => {
  rest(c);
  c[BREATH] = Math.sin(t * 2.4) * 0.6;
  const actS = 0.2 + 0.8 * sm((0.55 + 0.45 * Math.sin(t * 0.8 + x.phase) - 0.25) * 3);
  const tapR = 0.032 * pos(Math.sin(t * 37 + x.phase)) * actS;
  const tapL = 0.032 * pos(Math.sin(t * 43 + 1.7)) * actS;
  const tp = 0.1 + 0.025 * Math.sin(t * 0.9);
  c[TP] = tp;
  c[HP] = 0.14 + 0.05 * Math.sin(t * 2.3 + x.phase) * actS;
  c[HY] = 0.12 * Math.sin(t * 0.7 + x.phase);
  c[EYE] = 0.95;
  c[BX] = 0.0035 * Math.sin(t * 53) * actS;
  c[BZ] = 0.003 * Math.sin(t * 61) * actS;
  c[TY] = 0.03 * Math.sin(t * 5.1) * actS;
  if (s) {
    seatLegs(c);
    ikArmW(c, false, 0.12, 0.33 - tapR, -0.4, tp);
    ikArmW(c, true, -0.12, 0.33 - tapL, -0.4, tp);
  } else {
    ikArmW(c, false, 0.13, 0.2 - tapR, -0.4, tp);
    ikArmW(c, true, -0.13, 0.2 - tapL, -0.4, tp);
    c[RKF] = 0.05; c[LKF] = 0.05;
  }
};

const think: PoseFn = (c, t, _pt, s, x) => {
  rest(c);
  c[BREATH] = Math.sin(t * 1.9);
  c[HR] = 0.22 + 0.03 * Math.sin(t * 0.5);
  c[HP] = -0.1 + 0.05 * Math.sin(t * 0.4 + 1);
  c[HY] = 0.18 * Math.sin(t * 0.33 + x.phase);
  c[EYE] = 0.85 + 0.1 * Math.sin(t * 0.7);
  const tp = s ? 0.0 : 0.0;
  c[TP] = tp - 0.05;
  c[TR] = 0.05;
  // chin-rest right hand
  ikArm(c, false, 0.04, 0.5 + 0.015 * Math.sin(t * 1.3), -0.25);
  // left hand taps slowly
  const tap = pos(Math.sin(t * 2.4)) * env((t % 4.2), 0.8, 1.0, 1.8, 2.2);
  if (s) {
    seatLegs(c);
    ikArmW(c, true, -0.18, 0.33 - 0.035 * tap, -0.36, -0.05);
  } else {
    ikArm(c, true, -0.19, 0.2 - 0.035 * tap, -0.28);
    c[RKF] = 0.05 + 0.06 * Math.sin(t * 0.4); c[LKF] = 0.05;
    c[BX] = 0.02 * Math.sin(t * 0.4);
  }
};

const wait: PoseFn = (c, t, _pt, s, x) => {
  rest(c);
  const cyc = (t + x.phase) % 11;
  const watch = env(cyc, 2.2, 3.0, 4.6, 5.4);
  const yawn = env(cyc, 6.6, 7.4, 8.8, 9.6);
  c[BREATH] = Math.sin(t * 1.6) * (1 + 0.8 * yawn);
  const tapA = Math.sin(t * 8.5);
  if (s) {
    seatLegs(c);
    // slouched, head hanging, foot tapping
    c[TP] = 0.24 - 0.05 * watch - 0.2 * yawn;
    c[HP] = 0.2 - 0.02 * Math.sin(t * 0.6) - 0.12 * watch - 0.55 * yawn;
    c[HY] = 0.25 * Math.sin(t * 0.3 + x.phase) * (1 - watch);
    c[RKF] = HALF_PI - 0.2 * pos(tapA); c[RHP] = HALF_PI + 0.05 * pos(tapA);
    ikArmW(c, false, 0.14, 0.14, -0.2, 0.2);
    ikArmW(c, true, -0.14, 0.14, -0.2, 0.2);
  } else {
    // standing, arms crossed, foot tapping
    c[TP] = 0.02 - 0.12 * yawn; c[HP] = 0.08 - 0.1 * watch - 0.5 * yawn;
    c[HY] = 0.45 * look(t * 0.8, x.phase) * (1 - watch);
    c[BROLL] = 0.03; c[BX] = 0.03;
    c[RKF] = 0.08; c[RHP] = 0.0;
    c[LKF] = 0.1 + 0.55 * pos(tapA); c[LHP] = 0.1 * pos(tapA);
    ikArm(c, false, -0.14, 0.27, -0.2);
    ikArm(c, true, 0.16, 0.2, -0.22);
  }
  if (watch > 0.001) {
    T1.fill(0);
    ikArm(T1, true, -0.08, 0.58, -0.3);
    lerpArm(c, T1, true, watch);
    c[HY] += 0.25 * watch;
  }
  if (yawn > 0.001) {
    c[RSP] += (2.75 - c[RSP]) * yawn; c[LSP] += (2.75 - c[LSP]) * yawn;
    c[RSA] += (0.55 - c[RSA]) * yawn; c[LSA] += (0.55 - c[LSA]) * yawn;
    c[REF] += (0.25 - c[REF]) * yawn; c[LEF] += (0.25 - c[LEF]) * yawn;
    c[MOUTH] = yawn; c[EYE] = 1 - 0.85 * yawn;
  }
  c[EYE] *= 1 - 0.4 * (s ? 1 : 0);
};

const blocked: PoseFn = (c, t, _pt, s, x) => {
  rest(c);
  const cyc = (t + x.phase * 0.1) % 5.2;
  const angry = env(cyc, 2.4, 2.8, 4.5, 4.9);
  c[BREATH] = Math.sin(t * 5) * 0.7;
  c[EYE] = 0.6;
  c[MOUTH] = 0.3 + 0.3 * angry;
  const shakeH = 0.22 * Math.sin(t * 13) * (1 - angry);
  if (s) {
    seatLegs(c);
    c[TP] = 0.38 * (1 - angry) + 0.1 * angry;
    c[HP] = 0.3 * (1 - angry);
  } else {
    c[TP] = 0.2 * (1 - angry);
    c[HP] = 0.25 * (1 - angry) - 0.1 * angry;
    c[RKF] = 0.1; c[LKF] = 0.1;
  }
  c[HY] = shakeH + 0.1 * angry * Math.sin(t * 11);
  c[TR] = 0.04 * Math.sin(t * 7);
  // head in hands
  const tr = 0.012 * Math.sin(t * 29);
  ikArm(c, false, 0.26 + tr, 0.8, -0.1);
  ikArm(c, true, -0.26 - tr, 0.8, -0.1);
  if (angry > 0.001) {
    // fists up and shaking
    const sh = Math.sin(t * 17) * 0.2;
    T1.fill(0);
    T1[RSP] = 2.5 + sh * 0.4; T1[LSP] = 2.5 - sh * 0.4;
    T1[RSA] = 0.45; T1[LSA] = 0.45;
    T1[REF] = 1.1 + sh; T1[LEF] = 1.1 - sh;
    for (let i = 0; i < 3; i++) {
      c[RSP + i] += (T1[RSP + i] - c[RSP + i]) * angry;
      c[LSP + i] += (T1[LSP + i] - c[LSP + i]) * angry;
    }
    c[BY] = 0.015 * Math.sin(t * 17) * angry;
  }
};

const review: PoseFn = (c, t, _pt, s, x) => {
  rest(c);
  c[BREATH] = Math.sin(t * 2);
  const tp = 0.1;
  c[TP] = tp;
  c[HP] = 0.18;
  c[EYE] = 0.9;
  if (s) seatLegs(c); else { c[RKF] = 0.06; c[LKF] = 0.06; }
  const deskY = s ? 0.33 : 0.22;
  // left hand holds sheet up in front of the face
  const sy = 0.6 - (s ? 0.08 : 0), sz = -0.36;
  ikArm(c, true, -0.12, sy + 0.02 * Math.sin(t * 0.8), sz);
  c[HY] = 0.18 * Math.sin(t * 1.1 + x.phase);
  if (x.integrator) {
    const cyc = (t + x.phase * 0.2) % 3.6;
    let h = 0.2;
    if (cyc < 1.6) h = 0.2;
    else if (cyc < 2.0) h = 0.2 + 0.25 * sm((cyc - 1.6) / 0.4);
    else if (cyc < 2.1) h = 0.45 * (1 - (cyc - 2.0) / 0.1);
    else if (cyc < 2.5) h = 0;
    else if (cyc < 3.0) h = 0.2 * sm((cyc - 2.5) / 0.5);
    ikArmW(c, false, 0.1, deskY + 0.17 + h, -0.44, tp);
    if (cyc > 2.0 && cyc < 2.4) { c[BY] = -0.015 * (1 - sm((cyc - 2.0) / 0.4)); c[TP] += 0.05; }
  } else {
    // red pen scribble beside the sheet
    ikArm(c, false, -0.02 + 0.06 * Math.sin(t * 5), sy - 0.03 + 0.025 * Math.sin(t * 8.3), sz - 0.03);
  }
};

const plan: PoseFn = (c, t, _pt, _s, x) => {
  rest(c);
  c[BREATH] = Math.sin(t * 2);
  const sway = Math.sin(t * 0.6 + x.phase);
  const step = 0.2 * sway;
  c[BX] = step;
  c[RHA] = -step / 0.74 + 0.03; c[LHA] = -step / 0.74 + 0.03;
  c[RKF] = 0.06 + 0.1 * pos(sway); c[LKF] = 0.06 + 0.1 * pos(-sway);
  c[TP] = -0.03; c[TY] = 0.1 * sway;
  c[HP] = -0.12 + 0.05 * Math.sin(t * 1.4); c[HY] = 0.1 * Math.sin(t * 0.9);
  // right arm writes on the board
  ikArm(c, false, 0.3 + 0.1 * Math.sin(t * 1.6) + 0.05 * Math.sin(t * 5), 0.78 + 0.08 * Math.sin(t * 1.1 + 1) + 0.025 * Math.sin(t * 7), -0.46);
  // left arm hugs the clipboard
  ikArm(c, true, -0.12, 0.24, -0.3);
};

const celebrate: PoseFn = (c, t, pt, _s, x) => {
  rest(c);
  c[EYE] = 0.75; c[MOUTH] = 0.8; c[SMILE] = 1;
  const u = (pt / 0.75) % 1;
  // 0..0.2 crouch, 0.2..0.8 airborne, 0.8..1 land
  let crouch = 0, air = 0;
  if (u < 0.2) crouch = sm(u / 0.2);
  else if (u < 0.8) { const a = (u - 0.2) / 0.6; air = Math.sin(a * PI); crouch = 0; }
  else crouch = 1 - sm((u - 0.8) / 0.2);
  c[BY] = 0.42 * air;
  const tuck = 0.5 * air;
  c[RHP] = 0.5 * crouch + tuck * 0.7; c[LHP] = 0.5 * crouch + tuck * 0.4;
  c[RKF] = 1.0 * crouch + tuck; c[LKF] = 1.0 * crouch + tuck * 1.2;
  c[TP] = 0.2 * crouch - 0.08 * air;
  const wig = Math.sin(t * 18);
  c[RSP] = 2.85 - 0.15 * crouch + 0.1 * wig; c[LSP] = 2.85 - 0.15 * crouch - 0.1 * wig;
  c[RSA] = 0.45 + 0.1 * wig; c[LSA] = 0.45 - 0.1 * wig;
  c[REF] = 0.25; c[LEF] = 0.25;
  c[BYAW] = 0.7 * Math.sin(pt * 3.2 + x.phase * 0.0);
  c[HP] = -0.25; c[HR] = 0.1 * wig;
  c[BREATH] = Math.sin(t * 9);
};

const sleepP: PoseFn = (c, t, _pt, s, x) => {
  rest(c);
  c[EYE] = 0.0;
  const br = Math.sin(t * 1.3);
  c[BREATH] = br * 1.2;
  c[MOUTH] = 0.15 + 0.1 * Math.sin(t * 1.3 + 1);
  if (s) {
    seatLegs(c);
    const tp = 0.78;
    c[TP] = tp + 0.015 * br;
    c[HP] = 0.35; c[HR] = 0.55 + 0.02 * br; c[HY] = 0.35;
    ikArmW(c, false, 0.17, 0.37, -0.47, tp);
    ikArmW(c, true, -0.17, 0.37, -0.47, tp);
  } else {
    const sw = Math.sin(t * 0.7 + x.phase);
    c[TP] = 0.12 + 0.05 * br;
    c[HP] = 0.55 + 0.05 * Math.sin(t * 0.5); c[HR] = 0.15 * sw;
    c[BX] = 0.04 * sw; c[BROLL] = 0.05 * sw; c[TR] = -0.06 * sw;
    c[RKF] = 0.12 + 0.05 * pos(sw); c[LKF] = 0.12 + 0.05 * pos(-sw);
    c[RSP] = 0.05; c[LSP] = 0.05;
  }
};


// ---- throw (paper airplane) : loop 1.1 s, release at u = 0.6 (0.66 s after pose start)
export const THROW_PERIOD = 1.1;
export const THROW_RELEASE = 0.6;
const KU = [0, 0.3, 0.48, 0.6, 0.78, 1];
const K_HX = [0.03, 0.03, 0.3, 0.22, 0.1, 0.03];
const K_HY = [0.22, 0.22, 0.86, 0.8, 0.25, 0.22];
const K_HZ = [-0.3, -0.3, 0.2, -0.6, -0.5, -0.3];
const K_TP = [0.1, 0.1, -0.12, 0.15, 0.3, 0.1];
const K_TY = [0, 0, -0.35, 0.3, 0.2, 0];
const S_HY = [0.22, 0.22, 0.6, 0.58, 0.3, 0.22];
const S_HZ = [-0.3, -0.3, 0.0, -0.55, -0.45, -0.3];
const S_TP = [0.05, 0.05, -0.04, 0.1, 0.18, 0.05];
const S_TY = [0, 0, -0.3, 0.28, 0.15, 0];
const L_HX = [-0.03, -0.03, -0.26, -0.28, -0.2, -0.03];
const L_HY = [0.22, 0.22, 0.32, 0.3, 0.22, 0.22];
const L_HZ = [-0.3, -0.3, -0.38, -0.34, -0.3, -0.3];
function kf(u: number, v: number[]): number {
  let i = 0;
  while (i < 4 && u >= KU[i + 1]) i++;
  let w = (u - KU[i]) / (KU[i + 1] - KU[i]);
  w = i === 2 ? w * w : sm(w);
  return v[i] + (v[i + 1] - v[i]) * w;
}
const throwP: PoseFn = (c, t, pt, s, x) => {
  rest(c);
  c[BREATH] = Math.sin(t * 2.2);
  const u = (pt / THROW_PERIOD) % 1;
  const hx = kf(u, K_HX);
  const hy = kf(u, s ? S_HY : K_HY);
  const hz = kf(u, s ? S_HZ : K_HZ);
  const wig = u < 0.3 ? 0.02 * Math.sin(pt * 24) : 0;
  c[TP] = kf(u, s ? S_TP : K_TP);
  c[TY] = kf(u, s ? S_TY : K_TY);
  c[HP] = 0.25 * (1 - sm((u - 0.3) / 0.15)) * (u < 0.6 ? 1 : 0.0) - 0.05;
  c[HY] = u < 0.3 ? 0 : -0.25 * sm((u - 0.3) / 0.2) * (1 - sm((u - 0.7) / 0.2));
  c[MOUTH] = 0.5 * env(u, 0.5, 0.58, 0.68, 0.8);
  ikArm(c, false, hx + wig, hy, hz);
  ikArm(c, true, kf(u, L_HX) - wig, kf(u, L_HY), kf(u, L_HZ));
  if (s) {
    seatLegs(c);
  } else {
    const b = env(u, 0.42, 0.6, 0.7, 0.92);
    c[LHP] = 0.45 * b; c[LKF] = 0.12 + 0.1 * b; c[RKF] = 0.15 * b + 0.05; c[RHP] = -0.1 * b;
    c[BZ] = 0.0 + 0.0 * b;
  }
  // plane: appears while folding, travels with the right hand, vanishes crisply at release
  c[PLS] = u < 0.18 ? 0 : u < 0.3 ? sm((u - 0.18) / 0.12) : u < THROW_RELEASE ? 1 : 0;
  c[PLX] = hx; c[PLY] = hy + 0.02; c[PLZ] = hz - 0.07;
  void x;
};

const raiseHand: PoseFn = (c, t, _pt, s, x) => {
  rest(c);
  c[BREATH] = Math.sin(t * 3);
  const w = Math.sin(t * 7.5);
  c[RSP] = 2.95; c[RSA] = 0.22 + 0.4 * w; c[REF] = 0.12 + 0.2 * Math.sin(t * 7.5 + 1.2);
  c[TR] = -0.05 * w - 0.05; c[TP] = -0.04;
  c[HY] = 0.75 * Math.sin(t * 1.3 + x.phase * 0.1) * Math.sin(t * 0.5 + 1);
  c[HP] = -0.12 + 0.05 * Math.sin(t * 2.1);
  c[HR] = 0.1 * Math.sin(t * 1.3);
  c[MOUTH] = 0.35 + 0.25 * pos(Math.sin(t * 5));
  c[EYE] = 1;
  if (s) {
    seatLegs(c);
    ikArmW(c, true, -0.18, 0.33, -0.36, -0.04);
  } else {
    c[LSP] = 0.15; c[LSA] = 0.6; c[LEF] = 1.75;
    c[RKF] = 0.06; c[LKF] = 0.06;
    const sw = Math.sin(t * 1.1);
    c[BX] = 0.02 * sw; c[BROLL] = 0.02 * sw;
  }
};

const TABLE: Record<Pose, PoseFn> = {
  idle, walk, carry_walk: carryWalk, pickup, type: typeP, think, wait, blocked, review, plan, celebrate, sleep: sleepP, throw: throwP, raise_hand: raiseHand,
};

export function evalPose(pose: Pose, seated: boolean, c: Float32Array, t: number, pt: number, x: PCtx): void {
  (TABLE[pose] ?? idle)(c, t, pt, seated, x);
}

/** Poses that can be performed seated. */
export function canSeat(pose: Pose): boolean {
  return pose === 'idle' || pose === 'type' || pose === 'think' || pose === 'wait' || pose === 'blocked' || pose === 'sleep' || pose === 'review' || pose === 'throw' || pose === 'raise_hand';
}
