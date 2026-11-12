import * as THREE from 'three';
import type { Flight, FlightKind, SimState } from '../types';
import type { ParticlePool } from './effects';
import { makeCanvasTex } from './textures';
import { drawTextCentered } from './pixelFont';

const MAX = 32;
const FADE = 0.4;

interface KindStyle { main: number; keel: number; label?: string }
export const FLIGHT_STYLE: Record<FlightKind, KindStyle> = {
  pr: { main: 0xf5f7ff, keel: 0x3f66d8 },
  merged: { main: 0x5ad17a, keel: 0x1b7a40, label: 'LGTM' },
  changes: { main: 0xe5484d, keel: 0x7a1a20, label: 'changes' },
  help: { main: 0xffd25a, keel: 0xc88a10, label: '?' },
  help_reply: { main: 0x2dd4bf, keel: 0x0f7a70 },
  assign: { main: 0xb08aff, keel: 0x5a34c0 },
  chat: { main: 0xff9a4a, keel: 0xb85a14 },
  broadcast: { main: 0xffffff, keel: 0x8a94b0 },
};

function dartGeometry(main: number, keel: number): THREE.BufferGeometry {
  // nose along +z. oversized (~0.6 long) so it reads at pixelSize 3-4.
  const nose = [0, 0, 0.36], tail = [0, 0, -0.3];
  const lt = [-0.34, 0.1, -0.26], rt = [0.34, 0.1, -0.26];
  const kb = [0, -0.14, -0.28], top = [0, 0.05, -0.1];
  const tris: { v: number[][]; c: number }[] = [
    { v: [nose, tail, lt], c: main }, { v: [nose, rt, tail], c: main },
    { v: [nose, top, tail], c: keel }, { v: [nose, tail, kb], c: keel },
    { v: [tail, lt, top], c: main }, { v: [tail, top, rt], c: main },
  ];
  const pos: number[] = [], col: number[] = [];
  const c = new THREE.Color();
  for (const t of tris) {
    c.set(t.c);
    for (const v of t.v) { pos.push(v[0], v[1], v[2]); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export interface FlightTag { key: string; text: string; color: string; x: number; y: number; z: number }
export type Resolver = (ep: Flight['from'], out: THREE.Vector3, isFrom: boolean) => boolean;

interface Slot { group: THREE.Group; mesh: THREE.Mesh; shadow: THREE.Mesh; q: THREE.Sprite; emit: number; id: string; kind: FlightKind | '' }

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3(), _n = new THREE.Vector3();

/** Stateless-ish paper airplane renderer: positions are recomputed from state.time each frame. */
export class FlightLayer {
  group = new THREE.Group();
  private slots: Slot[] = [];
  private geos = {} as Record<FlightKind, THREE.BufferGeometry>;
  private mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
  private landed = new Set<string>();
  private seen = new Set<string>();
  tags: FlightTag[] = [];
  onLand: ((f: Flight) => void) | null = null;

  constructor(private fx: ParticlePool) {
    for (const k of Object.keys(FLIGHT_STYLE) as FlightKind[]) this.geos[k] = dartGeometry(FLIGHT_STYLE[k].main, FLIGHT_STYLE[k].keel);
    const qc = makeCanvasTex(14, 14, false);
    qc.ctx.fillStyle = '#10141f'; qc.ctx.fillRect(0, 0, 14, 14);
    qc.ctx.fillStyle = '#ffd25a'; qc.ctx.fillRect(1, 1, 12, 12);
    drawTextCentered(qc.ctx, '?', 7, 3, '#10141f', 1);
    qc.tex.needsUpdate = true;
    const qm = new THREE.SpriteMaterial({ map: qc.tex, toneMapped: false });
    const shadowGeo = new THREE.CircleGeometry(0.3, 10);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false });
    for (let i = 0; i < MAX; i++) {
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.visible = false; shadow.renderOrder = 2;
      this.group.add(shadow);
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(this.geos.pr, this.mat);
      mesh.castShadow = false;
      group.add(mesh);
      const q = new THREE.Sprite(qm);
      q.scale.set(0.4, 0.4, 1);
      q.position.set(0, 0.5, 0);
      q.visible = false;
      group.add(q);
      group.visible = false;
      this.group.add(group);
      this.slots.push({ group, mesh, shadow, q, emit: 0, id: '', kind: '' });
    }
  }

  private static hash(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return (h >>> 0) / 4294967296;
  }

  /** point on the flight path at progress p (0..1) into out */
  private path(a: THREE.Vector3, b: THREE.Vector3, p: number, lift: number, wob: number, phase: number, out: THREE.Vector3): THREE.Vector3 {
    const e = p * p * (3 - 2 * p) * 0.55 + p * 0.45; // eased but never stalls
    out.lerpVectors(a, b, e);
    out.y += 4 * p * (1 - p) * lift;
    // sideways wobble perpendicular to travel (horizontal)
    const dx = b.x - a.x, dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    const w = Math.sin(p * Math.PI * 4 + phase) * wob * Math.sin(Math.PI * p);
    out.x += (-dz / l) * w; out.z += (dx / l) * w;
    return out;
  }

  update(state: SimState, dt: number, resolve: Resolver, showTags: boolean): void {
    const time = state.time;
    const flights = state.flights ?? [];
    this.tags.length = 0;
    this.seen.clear();
    let n = 0;
    for (let i = 0; i < flights.length && n < MAX; i++) {
      const f = flights[i];
      const end = f.t0 + f.dur;
      if (time < f.t0 || time > end + FADE) continue;
      this.seen.add(f.id);
      if (!resolve(f.from, _a, true) || !resolve(f.to, _b, false)) continue;
      const slot = this.slots[n++];
      const g = slot.group;
      const style = FLIGHT_STYLE[f.kind] ?? FLIGHT_STYLE.broadcast;
      if (slot.kind !== f.kind) { slot.mesh.geometry = this.geos[f.kind] ?? this.geos.broadcast; slot.kind = f.kind; }
      slot.q.visible = f.kind === 'help';
      const dist = Math.hypot(_b.x - _a.x, _b.z - _a.z);
      const lift = Math.min(2.6, 0.5 + dist * 0.2);
      const ph = FlightLayer.hash(f.id) * 6.28;
      const wob = Math.min(0.35, 0.08 + dist * 0.02);
      const p = Math.min(1, Math.max(0, (time - f.t0) / Math.max(0.1, f.dur)));
      this.path(_a, _b, p, lift, wob, ph, _p);
      let scale = 1;
      if (time > end) {
        // landing fade: settle toward the target and shrink
        const k = Math.min(1, (time - end) / FADE);
        scale = 1 - k * k;
        _p.y -= k * 0.15;
        if (!this.landed.has(f.id)) {
          this.landed.add(f.id);
          const col = style.main;
          for (let k2 = 0; k2 < 10; k2++) {
            const a2 = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 1.1;
            this.fx.spawn(_p.x, _p.y, _p.z, Math.cos(a2) * sp, 0.8 + Math.random() * 1.5, Math.sin(a2) * sp, 0.55 + Math.random() * 0.35, 0.07 + Math.random() * 0.04, k2 % 3 ? col : 0xffffff, 5, 6, true);
          }
          this.onLand?.(f);
        }
      }
      // orientation from velocity
      this.path(_a, _b, Math.min(1, p + 0.03), lift, wob, ph, _n);
      g.position.copy(_p);
      if (time <= end) {
        g.lookAt(_n.x, _n.y, _n.z);
        // bank into the wobble, pitch follows the arc
        g.rotateZ(Math.cos(p * Math.PI * 4 + ph) * 0.5 * Math.sin(Math.PI * p));
      }
      g.scale.setScalar(Math.max(0.001, scale) * 1.5);
      g.visible = true;
      slot.shadow.visible = true;
      slot.shadow.position.set(_p.x, 0.075, _p.z);
      slot.shadow.scale.setScalar(Math.max(0.05, scale) * (0.8 + Math.min(1, _p.y * 0.3)));
      // trail: a few small paper bits that fade
      if (time <= end) {
        slot.emit += dt * 14;
        while (slot.emit >= 1) {
          slot.emit -= 1;
          this.fx.spawn(_p.x + (Math.random() - 0.5) * 0.06, _p.y - 0.02, _p.z + (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.15, -0.05, (Math.random() - 0.5) * 0.15, 0.45, 0.1, style.main, 0, 3, true);
        }
      }
      if (showTags) {
        let text = '';
        if (f.kind === 'pr') text = f.ticketId ?? f.label ?? '';
        else if (f.kind === 'merged') text = 'LGTM';
        else if (f.kind === 'changes') text = 'changes';
        else if (f.kind === 'help') text = 'help';
        else text = f.label ?? '';
        if (text && scale > 0.2) this.tags.push({ key: f.id, text, color: '#' + style.main.toString(16).padStart(6, '0'), x: _p.x, y: _p.y + 0.55, z: _p.z });
      }
    }
    for (let i = n; i < MAX; i++) { this.slots[i].group.visible = false; this.slots[i].shadow.visible = false; }
    // forget landed flights that left the state
    if (this.landed.size > 64) for (const id of this.landed) if (!this.seen.has(id)) this.landed.delete(id);
  }
}
