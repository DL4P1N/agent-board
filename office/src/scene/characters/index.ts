/**
 * Voxel character rigs for Agent Board.
 *
 * createAgentRig(opts) -> AgentRig. Local origin = feet centre, front = -z. ~30 draw calls-worth of tiny meshes per rig,
 * all sharing two materials (vertex-coloured Lambert + Basic) and cached geometries. update() allocates nothing.
 *
 * Seated poses: put the rig pivot at the seat point (x/z centre of the chair, y = floor). The rig lowers its hips by 0.35
 * (hip height 0.39), thighs horizontal pointing -z, shins vertical, feet flat on the floor. See RIG_SEAT below for the
 * recommended furniture dimensions.
 */
import * as THREE from 'three';
import type { Pose } from '../../types';
import type { AgentRig, CreateAgentRig, RigFrame, RigOptions } from './rigTypes';
import {
  ACCENT, DIM, Glyph, MAX_STACK, PropGeo, SharedGeo, TIER_TOP, buildBody, makeLook, matBody, matGlow, matParticle,
  ornamentMount, parseHex, stackGeo, tierGeos, tierLevel,
} from './rigKit';
import {
  BREATH, BROLL, BX, BY, BYAW, BZ, EYE, HP, HR, HY, LEF, LHA, LHP, LKF, LSA, LSP, MOUTH, NCH, REF, RHA, RHP, RKF,
  PLS, PLX, PLY, PLZ, RSA, RSP, SEAT, SMILE, SS, SY, SZ, TP, TR, TY, canSeat, evalPose, holdChannels, type PCtx,
} from './poses';

export type { AgentRig, RigFrame, RigOptions } from './rigTypes';
export { tierLevel } from './rigKit';

/** Recommended furniture placement relative to the rig pivot when seated (world units). */
export const RIG_SEAT = {
  /** hips sit this much lower than standing */
  drop: DIM.seatDrop,
  /** top of the chair seat (thighs rest on it) */
  seatTop: 0.3,
  /** desk top height; keyboard ~ +0.02 */
  deskTop: 0.72,
  /** desk front edge z (relative to pivot, desk extends toward -z) */
  deskEdgeZ: -0.36,
  /** where the typing hands rest (relative to pivot) */
  keyboard: { x: 0, y: 0.74, z: -0.5 },
  /** chair back plane z (rig's back/backpack reaches z=+0.32) */
  chairBackZ: 0.36,
  /** head height values (headHeight property) */
  headHeightStanding: 2.9,
  headHeightSeated: 2.55,
};

const POSES: Pose[] = ['idle', 'walk', 'carry_walk', 'pickup', 'type', 'think', 'wait', 'blocked', 'review', 'plan', 'celebrate', 'sleep', 'throw', 'raise_hand'];
const POSE_INDEX: Record<string, number> = {};
POSES.forEach((p, i) => { POSE_INDEX[p] = i; });

const selMatCache = new Map<string, THREE.MeshBasicMaterial>();
function selMat(hex: number): THREE.MeshBasicMaterial {
  const k = String(hex);
  let m = selMatCache.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide }); selMatCache.set(k, m); }
  return m;
}

const CONFETTI = [0xff5d73, 0xffd23f, 0x5ee6a8, 0x5ec2ff, 0xb48cff, 0xff9f43];
const NPART = 14;
const NDRONE = 8;
const BLEND_TIME = 0.2;
const TWO_PI = Math.PI * 2;
const NO_COLORS: string[] = [];
function sameColors(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function smooth(cur: number, target: number, rate: number, dt: number): number {
  return cur + (target - cur) * (1 - Math.exp(-rate * dt));
}

export const createAgentRig: CreateAgentRig = (opts: RigOptions): AgentRig => {
  const provider = opts.provider;
  const role = opts.role;
  const A = ACCENT[provider];
  const look = makeLook(opts.seed, provider);
  const ownerHex = opts.ownerColor ? parseHex(opts.ownerColor, 0x9aa0ad) : null;
  const geos = buildBody(look, provider, role, ownerHex);
  let level = 3;
  let curTier = '';

  const object = new THREE.Group();
  object.name = 'rig:' + opts.name;
  const owned: { dispose(): void }[] = Object.values(geos);

  const mk = (g: THREE.BufferGeometry, mat: THREE.Material = matBody, shadow = true): THREE.Mesh => {
    const m = new THREE.Mesh(g, mat);
    if (shadow) { m.castShadow = true; m.receiveShadow = true; }
    return m;
  };

  // ---- skeleton
  const hips = new THREE.Group();
  object.add(hips);
  hips.add(mk(geos.pelvis));
  const torso = new THREE.Group();
  hips.add(torso);
  torso.add(mk(geos.torso));
  const badge = mk(geos.badge, matGlow, false);
  badge.position.set(role === 'worker' ? 0.07 : 0, 0.3, -0.168);
  torso.add(badge);
  torso.add(mk(geos.pack));

  const gaugeMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
  const gauge = mk(SharedGeo.gaugeFill(), gaugeMat, false);
  gauge.position.set(0, 0.155, 0.298);
  torso.add(gauge);

  // skill cartridges (instanced, 4 slots on the backpack top)
  const cart = new THREE.InstancedMesh(SharedGeo.cartridge(), matGlow, 4);
  cart.frustumCulled = false;
  torso.add(cart);
  const slotKey: string[] = ['', '', '', ''];
  const slotScale = [0, 0, 0, 0];
  const _col = new THREE.Color();
  for (let i = 0; i < 4; i++) cart.setColorAt(i, _col.setHex(0x888888));
  cart.count = 4;

  const head = new THREE.Group();
  head.position.y = DIM.headPivotY;
  torso.add(head);
  head.add(mk(geos.head));
  const eyes = mk(geos.eyes, matBody, false);
  eyes.position.set(0, 0.3, -0.249);
  head.add(eyes);
  const mouth = mk(geos.mouth, matBody, false);
  mouth.position.set(0, 0.13, -0.249);
  head.add(mouth);

  // tier ornament
  const mount = ornamentMount(look);
  const tierRoot = new THREE.Group();
  tierRoot.position.y = mount;
  head.add(tierRoot);
  let tierBody: THREE.Mesh | null = null;
  let tierGlow: THREE.Mesh | null = null;
  let tierHalo: THREE.Mesh | null = null;
  const setTier = (name: string): void => {
    curTier = name;
    level = tierLevel(name);
    if (tierBody) { tierRoot.remove(tierBody); tierBody = null; }
    if (tierGlow) { tierRoot.remove(tierGlow); tierGlow = null; }
    if (tierHalo) { tierRoot.remove(tierHalo); tierHalo = null; }
    const tg = tierGeos(level, provider);
    if (tg.body) { tierBody = mk(tg.body, matBody, false); tierRoot.add(tierBody); }
    if (tg.glow) { tierGlow = mk(tg.glow, matGlow, false); tierRoot.add(tierGlow); }
    if (tg.halo) { tierHalo = mk(tg.halo, matGlow, false); tierRoot.add(tierHalo); }
  };

  // arms
  const armR = new THREE.Group(); armR.position.set(DIM.shoulderX, DIM.shoulderY, 0);
  const armL = new THREE.Group(); armL.position.set(-DIM.shoulderX, DIM.shoulderY, 0);
  torso.add(armR, armL);
  armR.add(mk(geos.upperR)); armL.add(mk(geos.upperL));
  const elbowR = new THREE.Group(); elbowR.position.y = -DIM.upper;
  const elbowL = new THREE.Group(); elbowL.position.y = -DIM.upper;
  armR.add(elbowR); armL.add(elbowL);
  elbowR.add(mk(geos.foreR)); elbowL.add(mk(geos.foreL));
  const handR = new THREE.Group(); handR.position.y = -0.27;
  const handL = new THREE.Group(); handL.position.y = -0.27;
  elbowR.add(handR); elbowL.add(handL);

  // legs
  const legR = new THREE.Group(); legR.position.set(DIM.hipX, 0, 0);
  const legL = new THREE.Group(); legL.position.set(-DIM.hipX, 0, 0);
  hips.add(legR, legL);
  legR.add(mk(geos.thigh)); legL.add(mk(geos.thigh));
  const kneeR = new THREE.Group(); kneeR.position.y = -DIM.thigh;
  const kneeL = new THREE.Group(); kneeL.position.y = -DIM.thigh;
  legR.add(kneeR); legL.add(kneeL);
  kneeR.add(mk(geos.shin)); kneeL.add(mk(geos.shin));

  // ---- props
  const stackMesh = mk(stackGeo('tickets', 1, []), matBody, true);
  stackMesh.visible = false;
  torso.add(stackMesh);
  let stackKey = '';
  let lastKind: 'tickets' | 'pr' | 'rejected' | 'skills' = 'tickets';
  let lastCount = 1;
  let lastSkills: string[] = [];

  const planeMesh = mk(PropGeo.plane(), matBody, false);
  planeMesh.visible = false;
  torso.add(planeMesh);

  const clipGroup = new THREE.Group();
  const clipMesh = mk(PropGeo.clipboard(), matBody, false);
  clipMesh.position.set(0.0, 0.1, -0.1);
  clipMesh.rotation.x = 0.3;
  clipGroup.add(clipMesh);
  clipGroup.visible = false;
  const sheetGroup = new THREE.Group();
  const sheetMesh = mk(PropGeo.sheet(), matBody, false);
  sheetMesh.position.set(0, 0.1, -0.05);
  sheetMesh.rotation.x = 1.15;
  sheetGroup.add(sheetMesh);
  sheetGroup.visible = false;
  const marker = mk(PropGeo.marker(), matBody, false); marker.visible = false;
  const pen = mk(PropGeo.pen(), matBody, false); pen.visible = false;
  const stampGroup = new THREE.Group();
  const stampMesh = mk(PropGeo.stamp(), matBody, false);
  stampMesh.scale.setScalar(1.25);
  stampGroup.add(stampMesh);
  stampGroup.visible = false;
  if (role === 'orchestrator') { handL.add(clipGroup); handR.add(marker); }
  if (role !== 'integrator') handR.add(pen);
  handL.add(sheetGroup);
  let beltStamp: THREE.Mesh | null = null;
  if (role === 'integrator') {
    handR.add(stampGroup);
    beltStamp = mk(PropGeo.stamp(), matBody, false);
    beltStamp.position.set(-0.31, 0.2, 0.0);
    beltStamp.rotation.z = 0.35;
    beltStamp.scale.setScalar(0.85);
    hips.add(beltStamp);
  }

  // ---- compaction effects
  const flashShellMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  const flashShell = mk(SharedGeo.flashShell(), flashShellMat, false);
  flashShell.scale.setScalar(1.08);
  flashShell.visible = false;
  hips.add(flashShell);
  const flashRingMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  const flashRing = mk(SharedGeo.flashRing(), flashRingMat, false);
  flashRing.visible = false;
  object.add(flashRing);
  owned.push(flashShellMat, flashRingMat, gaugeMat);
  let flashT = -1;

  // selection ring
  const selRing = new THREE.Mesh(SharedGeo.selRing(), selMat(A.glow));
  selRing.position.y = 0.03;
  selRing.visible = false;
  object.add(selRing);

  // ---- glyphs
  const glyphGroup = new THREE.Group();
  object.add(glyphGroup);
  const gBang = mk(Glyph.bang(), matGlow, false);
  const gHour = mk(Glyph.hourglass(), matGlow, false);
  const gZ = [mk(Glyph.z(0.17), matGlow, false), mk(Glyph.z(0.13), matGlow, false), mk(Glyph.z(0.1), matGlow, false)];
  const gPencil = mk(Glyph.pencil(), matGlow, false);
  const gThink = mk(Glyph.think(), matGlow, false);
  const gStar = mk(Glyph.star(), matGlow, false);
  const gQ = mk(Glyph.question(), matGlow, false);
  const glyphMeshes: THREE.Object3D[] = [gBang, gHour, gPencil, gThink, gStar, gQ];
  glyphGroup.add(gBang, gHour, gPencil, gThink, gStar, gQ, gZ[0], gZ[1], gZ[2]);
  for (const g of glyphMeshes) g.visible = false;
  for (const z of gZ) z.visible = false;
  // order: bang, hour, pencil, think, star, zzz
  const gScale = [0, 0, 0, 0, 0, 0, 0];
  gPencil.rotation.z = 0.0;
  gPencil.scale.setScalar(0.9);

  // ---- drones
  const drones = new THREE.InstancedMesh(SharedGeo.drone(provider), matGlow, NDRONE);
  drones.frustumCulled = false;
  drones.count = 0;
  object.add(drones);
  const dScale = new Float32Array(NDRONE);

  // ---- confetti particles
  const parts = new THREE.InstancedMesh(SharedGeo.particle(), matParticle, NPART);
  parts.frustumCulled = false;
  for (let i = 0; i < NPART; i++) parts.setColorAt(i, _col.setHex(CONFETTI[i % CONFETTI.length]));
  object.add(parts);
  const P = new Float32Array(NPART * 7); // x y z vx vy vz life
  let emitT = 0;
  let partActive = 0;

  // ---- animation state
  const cCur = new Float32Array(NCH);
  const cSnap = new Float32Array(NCH);
  const cOut = new Float32Array(NCH);
  const cHold = new Float32Array(NCH);
  const ctx: PCtx = { carry: false, hasLast: false, reachUp: true, phase: look.phase, integrator: role === 'integrator', orchestrator: role === 'orchestrator' };
  let t = look.phase * 3.1; // scaled clock
  let rt = look.phase;      // real clock
  let pt = 0;
  let curKey = -1;
  let blend = 1;
  let curPose: Pose = 'idle';
  let curSeat = false;
  let holdW = 0;
  let gaugeDisp = 0;
  let seatW = 0;
  let hipYPrev = DIM.legs;
  let first = true;

  const rig: AgentRig = {
    object,
    headHeight: RIG_SEAT.headHeightStanding,
    flashCompaction() { flashT = 0; },
    update(dtIn: number, frame: RigFrame) {
      const dt = dtIn > 0.1 ? 0.1 : dtIn < 0 ? 0 : dtIn;
      const spd = frame.speed > 0 ? frame.speed : 0;
      const sdt = dt * spd;
      t += sdt; rt += dt; pt += sdt;

      if (frame.tier !== curTier) setTier(frame.tier);

      // ---- pose selection / cross-fade (snapshot of the current output blends into the new pose)
      const pose = frame.pose;
      const seat = frame.seated && canSeat(pose);
      const key = (POSE_INDEX[pose] ?? 0) * 2 + (seat ? 1 : 0);
      if (key !== curKey) {
        if (curKey >= 0 && !first) { cSnap.set(cOut); blend = 0; } else blend = 1;
        curKey = key; pt = 0; curPose = pose; curSeat = seat;
      }
      const carry = frame.carrying;
      if (carry) { lastKind = carry.kind; lastCount = carry.count; ctx.hasLast = true; }
      ctx.carry = carry !== null;
      ctx.reachUp = carry ? carry.kind === 'skills' : true;
      evalPose(curPose, curSeat, cCur, t, pt, ctx);
      const o = cOut;
      if (blend < 1) {
        blend = blend + dt / BLEND_TIME;
        if (blend > 1) blend = 1;
        const e = blend * blend * (3 - 2 * blend);
        for (let i = 0; i < NCH; i++) o[i] = cSnap[i] + (cCur[i] - cSnap[i]) * e;
      } else o.set(cCur);
      first = false;

      // ---- hold-the-stack override for standing idle/wait/walk while carrying
      const wantHold = carry !== null && !curSeat && (curPose === 'idle' || curPose === 'wait' || curPose === 'walk' || curPose === 'blocked');
      holdW = smooth(holdW, wantHold ? 1 : 0, 10, dt);
      if (holdW > 0.002) {
        cHold.fill(0);
        holdChannels(cHold, 0.01 * Math.sin(rt * 2));
        for (let i = RSP; i <= LEF; i++) o[i] += (cHold[i] - o[i]) * holdW;
        o[SY] += (cHold[SY] - o[SY]) * holdW; o[SZ] += (cHold[SZ] - o[SZ]) * holdW; o[SS] += (cHold[SS] - o[SS]) * holdW;
      }

      // ---- grounding: lowest foot sits on the floor; seated blends to the seat height
      const reachR = (DIM.thigh * Math.cos(o[RHP]) + DIM.shin * Math.cos(o[RHP] - o[RKF])) * Math.cos(o[RHA]);
      const reachL = (DIM.thigh * Math.cos(o[LHP]) + DIM.shin * Math.cos(o[LHP] - o[LKF])) * Math.cos(o[LHA]);
      const ground = reachR > reachL ? reachR : reachL;
      const seatedHip = DIM.legs - DIM.seatDrop;
      const sw = o[SEAT];
      const hipY = ground + (seatedHip - ground) * sw + o[BY];
      hipYPrev = hipY;
      seatW = sw;

      hips.position.set(o[BX], hipY, o[BZ]);
      hips.rotation.set(0, o[BYAW], o[BROLL]);
      torso.rotation.set(-o[TP], o[TY], o[TR]);
      torso.scale.y = 1 + 0.025 * o[BREATH];
      head.rotation.set(-o[HP], o[HY], o[HR]);
      armR.rotation.set(o[RSP], 0, o[RSA]);
      armL.rotation.set(o[LSP], 0, -o[LSA]);
      elbowR.rotation.x = o[REF];
      elbowL.rotation.x = o[LEF];
      legR.rotation.set(o[RHP], 0, o[RHA]);
      legL.rotation.set(o[LHP], 0, -o[LHA]);
      kneeR.rotation.x = -o[RKF];
      kneeL.rotation.x = -o[LKF];

      // face
      const bl = ((rt * 0.29 + look.phase) % 1) < 0.03 ? 0.1 : 1;
      const eo = o[EYE] * bl;
      eyes.scale.y = eo < 0.06 ? 0.06 : eo;
      mouth.scale.set(1 + 0.6 * o[SMILE], 0.35 + 1.7 * o[MOUTH], 1);
      mouth.position.y = 0.13 + 0.01 * o[SMILE];

      // ---- tools in hands
      const isOrch = role === 'orchestrator';
      const isInt = role === 'integrator';
      const align = o[TP] - o[RSP] - o[REF];
      const alignL = o[TP] - o[LSP] - o[LEF];
      const rev = curPose === 'review';
      const pln = curPose === 'plan';
      clipGroup.visible = isOrch && pln;
      marker.visible = isOrch && pln;
      pen.visible = !isInt && rev;
      sheetGroup.visible = rev;
      sheetGroup.rotation.x = alignL;
      clipGroup.rotation.x = alignL;
      if (isInt) {
        stampGroup.visible = rev;
        stampGroup.rotation.x = align;
        if (beltStamp) beltStamp.visible = !rev;
      }

      // ---- paper / book stack
      let ss = o[SS];
      if (!carry && curPose !== 'pickup') ss = 0;
      if (ss > 0.02) {
        const kind = carry ? carry.kind : lastKind;
        const cnt = carry ? carry.count : lastCount;
        const skc = frame.skillColors || NO_COLORS;
        const k = kind + Math.max(1, Math.min(MAX_STACK, cnt | 0));
        const skillsChanged = kind === 'skills' && !sameColors(skc, lastSkills);
        if (k !== stackKey || skillsChanged) {
          stackKey = k;
          lastSkills = skc.slice();
          stackMesh.geometry = stackGeo(kind, cnt, skc);
        }
        stackMesh.visible = true;
        stackMesh.position.set(0, o[SY], o[SZ]);
        stackMesh.scale.setScalar((ss > 1 ? 1 : ss) * 1.15);
      } else stackMesh.visible = false;

      if (o[PLS] > 0.02 && curPose === 'throw') {
        planeMesh.visible = true;
        planeMesh.position.set(o[PLX], o[PLY], o[PLZ]);
        planeMesh.scale.setScalar(o[PLS] > 1 ? 1 : o[PLS]);
      } else planeMesh.visible = false;

      // ---- context gauge
      const target = frame.contextFill < 0 ? 0 : frame.contextFill > 1 ? 1 : frame.contextFill;
      if (!(flashT >= 0 && flashT < 0.22)) gaugeDisp = smooth(gaugeDisp, target, target < gaugeDisp ? 6 : 10, dt);
      gauge.scale.y = gaugeDisp * 0.27 < 0.004 ? 0.004 : gaugeDisp * 0.27;
      if (flashT >= 0 && flashT < 0.22 && Math.floor(flashT * 40) % 2 === 0) gaugeMat.color.setHex(0xffffff);
      else if (gaugeDisp > 0.9) gaugeMat.color.setHex(Math.sin(rt * 12) > 0 ? 0xff3b3b : 0xc42323);
      else if (gaugeDisp > 0.7) gaugeMat.color.setHex(0xffb81f);
      else gaugeMat.color.setHex(0x4ade80);

      // ---- compaction flash
      if (flashT >= 0) {
        flashT += dt;
        if (flashT > 0.8) {
          flashT = -1; flashShell.visible = false; flashRing.visible = false;
        } else {
          const sOp = 0.9 * (1 - flashT / 0.35);
          flashShell.visible = sOp > 0.01;
          flashShellMat.opacity = sOp > 0 ? sOp : 0;
          const u = flashT / 0.8;
          flashRing.visible = true;
          flashRing.position.y = hipYPrev + 0.35;
          flashRing.scale.setScalar(0.6 + 2.6 * (1 - (1 - u) * (1 - u)));
          flashRingMat.opacity = (1 - u) * 0.95;
        }
      }

      // ---- tier ornament animation
      if (tierGlow) tierGlow.scale.setScalar(1 + 0.12 * Math.sin(rt * 4 + 1));
      if (tierHalo) { tierHalo.rotation.y = rt * 1.4; tierHalo.position.y = 0.02 * Math.sin(rt * 2.5); tierHalo.scale.setScalar(1 + 0.05 * Math.sin(rt * 5)); }

      // ---- selection
      if (frame.selected) {
        selRing.visible = true;
        const s = 1 + 0.08 * Math.sin(rt * 5);
        selRing.scale.set(s, 1, s);
        badge.scale.setScalar(1 + 0.25 * (0.5 + 0.5 * Math.sin(rt * 5)));
      } else if (selRing.visible) { selRing.visible = false; badge.scale.setScalar(1); }

      // ---- status glyph
      let want = -1;
      switch (curPose) {
        case 'blocked': want = 0; break;
        case 'wait': want = 1; break;
        case 'type': want = 2; break;
        case 'think': want = 3; break;
        case 'celebrate': want = 4; break;
        case 'sleep': want = 5; break;
        case 'raise_hand': want = 6; break;
        default: break;
      }
      for (let i = 0; i < 7; i++) {
        gScale[i] = smooth(gScale[i], i === want ? 1 : 0, 12, dt);
        if (gScale[i] < 0.01) gScale[i] = 0;
      }
      gBang.visible = gScale[0] > 0; gBang.scale.setScalar(gScale[0] * (1 + 0.1 * Math.sin(rt * 9)));
      gHour.visible = gScale[1] > 0; gHour.scale.setScalar(gScale[1] * 0.9);
      gPencil.visible = gScale[2] > 0; gPencil.scale.setScalar(gScale[2] * 0.9);
      gThink.visible = gScale[3] > 0; gThink.scale.setScalar(gScale[3] * 1.2);
      gStar.visible = gScale[4] > 0; gStar.scale.setScalar(gScale[4] * (1 + 0.15 * Math.sin(rt * 8)));
      gQ.visible = gScale[6] > 0; gQ.scale.setScalar(gScale[6] * 1.5 * (1 + 0.06 * Math.sin(rt * 6)));
      for (let k = 0; k < 3; k++) {
        const z = gZ[k];
        z.visible = gScale[5] > 0;
        if (z.visible) {
          const u = (rt * 0.4 + k / 3) % 1;
          z.position.set(0.05 * k - 0.05, -0.18 + 0.42 * u, 0);
          z.scale.setScalar(gScale[5] * Math.sin(Math.PI * u) * 1.15 + 0.001);
        }
      }
      const gy = hipYPrev + DIM.torsoTop + mount + TIER_TOP[level] + 0.33;
      glyphGroup.position.y = gy + 0.04 * Math.sin(rt * 2.4);
      glyphGroup.rotation.y = gScale[5] > 0.5 ? 0.8 * Math.sin(rt * 0.9) : gScale[6] > 0.5 ? 0.9 * Math.sin(rt * 1.1) : rt * 1.1;
      glyphGroup.visible = want >= 0 || gScale[0] + gScale[1] + gScale[2] + gScale[3] + gScale[4] + gScale[5] + gScale[6] > 0;

      // ---- cartridges
      const sk = frame.skillColors || NO_COLORS;
      const nSk = sk ? (sk.length > 4 ? 4 : sk.length) : 0;
      const cm = cart.instanceMatrix.array as Float32Array;
      for (let i = 0; i < 4; i++) {
        let tgt = 0;
        if (i < nSk) {
          const want = sk[i];
          if (slotKey[i] === want) tgt = 1;
          else if (slotScale[i] > 0.05) tgt = 0;
          else {
            slotKey[i] = want; cart.setColorAt(i, _col.setHex(parseHex(want)));
            if (cart.instanceColor) cart.instanceColor.needsUpdate = true;
            tgt = 1;
          }
        }
        slotScale[i] = smooth(slotScale[i], tgt, 14, dt);
        if (Math.abs(slotScale[i] - tgt) < 0.01) slotScale[i] = tgt;
        const s = slotScale[i];
        const e = s * (1 + 0.3 * Math.sin(Math.PI * s)) + 0.0001;
        const o16 = i * 16;
        cm[o16] = e; cm[o16 + 1] = 0; cm[o16 + 2] = 0; cm[o16 + 3] = 0;
        cm[o16 + 4] = 0; cm[o16 + 5] = e; cm[o16 + 6] = 0; cm[o16 + 7] = 0;
        cm[o16 + 8] = 0; cm[o16 + 9] = 0; cm[o16 + 10] = e; cm[o16 + 11] = 0;
        cm[o16 + 12] = (i < 2 ? -0.14 : 0.14); cm[o16 + 13] = 0.14 + (i & 1) * 0.15; cm[o16 + 14] = 0.27; cm[o16 + 15] = 1;
      }
      cart.instanceMatrix.needsUpdate = true;

      // ---- drones
      const nDr = frame.subagents < 0 ? 0 : frame.subagents > NDRONE ? NDRONE : Math.round(frame.subagents);
      const dm = drones.instanceMatrix.array as Float32Array;
      let maxVis = 0;
      for (let i = 0; i < NDRONE; i++) {
        let s = smooth(dScale[i], i < nDr ? 1 : 0, 9, dt);
        if (Math.abs(s - (i < nDr ? 1 : 0)) < 0.005) s = i < nDr ? 1 : 0;
        dScale[i] = s;
        if (s > 0) maxVis = i + 1;
        const e = s * (1 + 0.35 * Math.sin(Math.PI * s)) + 0.0001;
        const odd = i & 1;
        const slot = ORDER[i];
        const ang = (odd ? -0.9 : 1.1) * rt + slot * (Math.PI / 4) * 1.0;
        const rad = 0.82 + 0.16 * odd + 0.05 * Math.sin(rt * 1.7 + i);
        const hy = (odd ? 1.0 : 1.5) + 0.08 * Math.sin(rt * 2.1 + i * 1.3) + 0.0 + (hipYPrev - DIM.legs) * 0.6;
        const yaw = -ang + (odd ? 0 : Math.PI) + rt * 0.5;
        const cs = Math.cos(yaw) * e, sn = Math.sin(yaw) * e;
        const o16 = i * 16;
        dm[o16] = cs; dm[o16 + 1] = 0; dm[o16 + 2] = -sn; dm[o16 + 3] = 0;
        dm[o16 + 4] = 0; dm[o16 + 5] = e; dm[o16 + 6] = 0; dm[o16 + 7] = 0;
        dm[o16 + 8] = sn; dm[o16 + 9] = 0; dm[o16 + 10] = cs; dm[o16 + 11] = 0;
        dm[o16 + 12] = Math.cos(ang) * rad; dm[o16 + 13] = hy; dm[o16 + 14] = Math.sin(ang) * rad; dm[o16 + 15] = 1;
      }
      drones.count = maxVis;
      drones.visible = maxVis > 0;
      drones.instanceMatrix.needsUpdate = true;

      // ---- confetti
      const emitting = curPose === 'celebrate';
      if (emitting) {
        emitT += dt;
        while (emitT > 0.045) {
          emitT -= 0.045;
          for (let i = 0; i < NPART; i++) {
            const b = i * 7;
            if (P[b + 6] <= 0) {
              const a = Math.random() * TWO_PI, r = 0.2 + Math.random() * 0.5;
              P[b] = Math.cos(a) * 0.15; P[b + 1] = hipYPrev + 0.9; P[b + 2] = Math.sin(a) * 0.15;
              P[b + 3] = Math.cos(a) * r; P[b + 4] = 1.8 + Math.random() * 1.6; P[b + 5] = Math.sin(a) * r;
              P[b + 6] = 0.7 + Math.random() * 0.6;
              break;
            }
          }
        }
      }
      if (emitting || partActive > 0) {
        const pm = parts.instanceMatrix.array as Float32Array;
        let alive = 0;
        for (let i = 0; i < NPART; i++) {
          const b = i * 7;
          let s = 0;
          if (P[b + 6] > 0) {
            P[b + 6] -= dt;
            P[b + 4] -= 7 * dt;
            P[b] += P[b + 3] * dt; P[b + 1] += P[b + 4] * dt; P[b + 2] += P[b + 5] * dt;
            if (P[b + 1] < 0.05) { P[b + 1] = 0.05; P[b + 4] = 0; P[b + 3] *= 0.5; P[b + 5] *= 0.5; }
            s = P[b + 6] > 0 ? Math.min(1, P[b + 6] * 3) : 0;
            if (s > 0) alive++;
          }
          const o16 = i * 16;
          const sp = Math.sin(rt * 8 + i);
          pm[o16] = s * (0.7 + 0.3 * sp); pm[o16 + 1] = 0; pm[o16 + 2] = 0; pm[o16 + 3] = 0;
          pm[o16 + 4] = 0; pm[o16 + 5] = s; pm[o16 + 6] = 0; pm[o16 + 7] = 0;
          pm[o16 + 8] = 0; pm[o16 + 9] = 0; pm[o16 + 10] = s * (0.7 + 0.3 * sp); pm[o16 + 11] = 0;
          pm[o16 + 12] = P[b]; pm[o16 + 13] = P[b + 1]; pm[o16 + 14] = P[b + 2]; pm[o16 + 15] = 1;
        }
        partActive = alive;
        parts.instanceMatrix.needsUpdate = true;
        parts.visible = true;
      } else parts.visible = false;

      rig.headHeight = RIG_SEAT.headHeightStanding - DIM.seatDrop * seatW;
    },
    dispose() {
      for (const g of owned) g.dispose();
      drones.dispose(); parts.dispose(); cart.dispose();
      object.removeFromParent();
    },
  };
  setTier('sonnet');
  return rig;
};

// deterministic slot order so a few drones spread around the character
const ORDER = [0, 4, 2, 6, 1, 5, 3, 7];
