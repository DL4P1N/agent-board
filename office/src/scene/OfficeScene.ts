/**
 * 3D pixel-art office. Renders the whole scene into a low-res render target (size = canvas / visual.pixelSize), then a
 * fullscreen pass upscales it with nearest sampling + Bayer dither + palette quantisation + depth outlines + vignette.
 * Public API (stable): constructor(host, visual), update(state, dt), setVisual, selectAgent, onPick, resize, dispose.
 * Additive: getCameraState / setCamera, getStats.
 */
import * as THREE from 'three';
import { DESKS, STATIONS, findPath, type Place, type StationId } from '../layout';
import type { AgentState, Flight, Phase, Pose, SimState, VisualSettings } from '../types';
import { createAgentRig, type AgentRig, type RigFrame } from './characters';
import { CameraRig, type CameraState, type ViewInsets } from './cameraRig';
import { PALETTES, type Palette } from './palettes';
import { PixelPipeline } from './post';
import { makeShared, type Shared } from './shared';
import { Room } from './room';
import { Cubicles } from './cubicles';
import { Depot, Library, Vault, PlanBoard, OrchDesk, IntegratorDesk, Racks, type StationCtx, type StationUpdate } from './stations';
import { FlightLayer } from './flights';
import { ScoreboardTV } from './scoreboard';
import { SkillIndex } from './skillLookup';
import { ParticlePool } from './effects';
import { LabelLayer, type LabelItem, type FlightTagItem } from './labels';

const SEATED_POSES = new Set<Pose>(['type', 'think', 'wait', 'blocked', 'sleep', 'review', 'raise_hand', 'throw']);

/** Hand/landing height (world y) for station endpoints of a paper airplane. */
const STATION_Y: Partial<Record<StationId, number>> = { depot: 1.2, inbox: 1.0, outTray: 1.0, library: 1.7, vault: 1.1, board: 2.3, orchSeat: 1.1, integSeat: 1.1, mainRack: 1.5, deployRack: 1.5 };
const SEAT_POINTS: { x: number; z: number }[] = [
  ...DESKS.map((d) => d.seat),
  STATIONS.orchSeat.stand,
  STATIONS.integSeat.stand,
];

const PAPER_STATIONS = ['depot', 'inbox', 'outTray'] as const;
const PAPER_CARRY = { kind: 'tickets' as const, count: 1 };

const PATH_PHASES: Partial<Record<Phase, (a: AgentState) => Place>> = {
  to_depot: () => ({ station: 'depot' }),
  to_library: () => ({ station: 'library' }),
  to_desk: (a) => ({ desk: a.deskIndex }),
  to_review: () => ({ station: 'inbox' }),
  rework_pickup: () => ({ station: 'outTray' }),
  delivering: () => ({ station: 'depot' }),
  returning: () => ({ station: 'outTray' }),
};

interface Entry {
  rig: AgentRig;
  x: number; z: number; heading: number;
  inited: boolean;
  compactions: number;
  phase: Phase | null;
  seen: number;
  sx: number; sy: number; fx: number; fy: number; // screen positions (head, feet) in css px
  label: LabelItem;
  pathAcc: number;
  path: { x: number; z: number }[] | null;
  castTick: number;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function angleLerp(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class OfficeScene {
  private visual: VisualSettings;
  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private pipeline!: PixelPipeline;
  private scene = new THREE.Scene();
  private cam!: CameraRig;
  private labels!: LabelLayer;
  private sun!: THREE.DirectionalLight;
  private ambient!: THREE.AmbientLight;
  private hemi!: THREE.HemisphereLight;
  private sh!: Shared;
  private room!: Room;
  private cubicles!: Cubicles;
  private fx!: ParticlePool;
  private flights!: FlightLayer;
  private integ!: IntegratorDesk;
  private skills = new SkillIndex();
  private stations: { update(u: StationUpdate): void }[] = [];
  private ring!: THREE.Mesh;
  private ringMat!: THREE.MeshBasicMaterial;
  private pathLines!: THREE.LineSegments;
  private pathPos!: Float32Array;
  private entries = new Map<string, Entry>();
  private selected: string | null = null;
  private pickCb: ((id: string | null) => void) | null = null;
  private ro: ResizeObserver | null = null;
  private cssW = 1;
  private cssH = 1;
  private rtW = 2;
  private rtH = 2;
  private dpr = 1;
  private time = 0;
  private frame = 0;
  private lastSimTime = -1;
  private simSpeed = 1;
  private reduced = false;
  private pal: Palette = PALETTES.dusk;
  private palKey: string | null = null;
  private qualityKey: string | null = null;
  private ok = false;
  private hoverId: string | null = null;
  private lastPalKey = '';
  private labelItems: LabelItem[] = [];
  private flightTags: FlightTagItem[] = [];
  private frameTimes: number[] = [];
  private lastAgents = new Map<string, number>();
  private _v = new THREE.Vector3();
  private _focus = new THREE.Vector3();

  constructor(public host: HTMLElement, visual: VisualSettings) {
    this.visual = { ...visual };
    this.container = document.createElement('div');
    this.container.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:#0c0a18;';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(this.container);
    try {
      this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { this.reduced = false; }
    try {
      this.init();
      this.ok = true;
    } catch (err) {
      console.warn('[OfficeScene] WebGL unavailable', err);
      this.container.innerHTML = '';
      const msg = document.createElement('div');
      msg.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:#d8d0f0;font:14px/1.5 ui-monospace,Menlo,Consolas,monospace;background:#120e22;';
      msg.textContent = 'The 3D office needs WebGL, which is not available in this browser. The board, agents and stats still work from the panels.';
      this.container.appendChild(msg);
    }
  }

  // ------------------------------------------------------------------ setup
  private init(): void {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none;';
    this.container.appendChild(canvas);
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer = renderer;
    renderer.autoClear = true;
    renderer.info.autoReset = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NoToneMapping;
    this.pipeline = new PixelPipeline(renderer);

    this.sh = makeShared();
    this.fx = new ParticlePool(480);
    // lights
    this.ambient = new THREE.AmbientLight(0xffffff, 1);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.ambient, this.hemi, this.sun, this.sun.target);

    this.room = new Room(this.sh);
    this.scene.add(this.room.group);
    this.cubicles = new Cubicles(this.sh);
    this.scene.add(this.cubicles.group);
    const sctx: StationCtx = { sh: this.sh, fx: this.fx, tint: this.room.tint };
    const depot = new Depot(sctx), library = new Library(sctx), vault = new Vault(sctx), board = new PlanBoard(sctx);
    const orch = new OrchDesk(sctx), integ = new IntegratorDesk(sctx), racks = new Racks(sctx);
    const tv = new ScoreboardTV(sctx);
    this.integ = integ;
    for (const s of [depot, library, vault, board, orch, integ, racks, tv]) { this.scene.add(s.group); this.stations.push(s); }
    this.scene.add(this.fx.mesh);
    this.flights = new FlightLayer(this.fx);
    this.flights.onLand = (f) => { if (f.kind === 'pr' && 'station' in f.to && f.to.station === 'inbox') this.integ.bumpInbox(); };
    this.scene.add(this.flights.group);

    // selection ring
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.72, 20), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.ring.renderOrder = 3;
    this.scene.add(this.ring);

    // debug paths
    this.pathPos = new Float32Array(16 * 40 * 6);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this.pathPos, 3).setUsage(THREE.DynamicDrawUsage));
    pg.setDrawRange(0, 0);
    this.pathLines = new THREE.LineSegments(pg, new THREE.LineBasicMaterial({ color: 0xffe14a, toneMapped: false, depthTest: false }));
    this.pathLines.frustumCulled = false;
    this.pathLines.renderOrder = 5;
    this.pathLines.visible = false;
    this.scene.add(this.pathLines);

    this.cam = new CameraRig(canvas);
    this.cam.reducedMotion = this.reduced;
    this.cam.onClick = (x, y) => this.handleClick(x, y);
    this.cam.onHover = (x, y) => this.handleHover(x, y);
    // A name tag selects its agent through the same pickCb a click on the sprite uses.
    this.labels = new LabelLayer(this.container, (tag, id) => this.cam.addHandle(tag, () => this.pickCb?.(id)));

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host);
    this.resize();
    this.applyVisual(true);
  }

  // ------------------------------------------------------------------ public API
  /** False when WebGL could not start (the scene then shows a short message instead of the office). */
  get usable(): boolean { return this.ok; }
  setVisual(v: VisualSettings): void { this.visual = { ...v }; if (this.ok) this.applyVisual(false); }
  selectAgent(id: string | null): void { this.selected = id; }
  onPick(cb: (id: string | null) => void): void { this.pickCb = cb; }
  getCameraState(): CameraState { return this.cam.getState(); }
  setCamera(s: Partial<CameraState>): void { if (this.ok) this.cam.setState(s); }
  /** Parts of the view covered by panels (fractions of its width / height): the room is framed in the rest. */
  setInsets(i: ViewInsets): void { if (this.ok) this.cam.insets = { ...i }; }
  getStats(): { frameMs: number; renderTarget: [number, number]; drawCalls: number; triangles: number } {
    const t = this.frameTimes;
    const avg = t.length ? t.reduce((a, b) => a + b, 0) / t.length : 0;
    const info = this.renderer?.info.render;
    return { frameMs: avg, renderTarget: [this.rtW, this.rtH], drawCalls: info?.calls ?? 0, triangles: info?.triangles ?? 0 };
  }

  /** Test helper: mean sRGB colour (0..255) of a square patch around a world point in the last rendered frame.
   *  Call right after update() (same task) since the drawing buffer is not preserved. */
  sampleWorld(x: number, y: number, z: number, half = 5): [number, number, number] | null {
    if (!this.ok || !this.renderer) return null;
    const gl = this.renderer.getContext();
    const v = new THREE.Vector3(x, y, z).project(this.cam.camera);
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const px = Math.round((v.x * 0.5 + 0.5) * W), py = Math.round((v.y * 0.5 + 0.5) * H);
    const x0 = Math.max(0, px - half), y0 = Math.max(0, py - half);
    const w = Math.min(W - x0, half * 2), h = Math.min(H - y0, half * 2);
    if (w <= 0 || h <= 0) return null;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < buf.length; i += 4) { r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; }
    const n = buf.length / 4;
    return [r / n, g / n, b / n];
  }

  resize(): void {
    if (!this.ok || !this.renderer) return;
    const r = this.host.getBoundingClientRect();
    const w = Math.max(2, Math.floor(r.width)), h = Math.max(2, Math.floor(r.height));
    this.cssW = w; this.cssH = h;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    const s = this.pipeline.setSize(w, h, this.visual.pixelSize);
    this.rtW = s.w; this.rtH = s.h;
  }

  dispose(): void {
    this.ro?.disconnect();
    if (this.ok) {
      for (const e of this.entries.values()) { this.scene.remove(e.rig.object); e.rig.dispose(); }
      this.entries.clear();
      this.cam.dispose();
      this.labels.dispose();
      this.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
      });
      this.pipeline.dispose();
      this.renderer?.dispose();
      // dispose() frees the GPU objects but not the context itself: without this each 3D off/on leaves one open
      // and the browser ends up at "Too many active WebGL contexts".
      try { this.renderer?.forceContextLoss(); } catch { /* already lost */ }
    }
    this.container.parentNode?.removeChild(this.container);
  }

  // ------------------------------------------------------------------ visual / palette
  private applyVisual(force: boolean): void {
    const v = this.visual;
    const pal = PALETTES[v.palette] ?? PALETTES.dusk;
    const palChanged = force || this.lastPalKey !== v.palette;
    if (palChanged) {
      this.lastPalKey = v.palette;
      this.pal = pal;
      this.scene.background = new THREE.Color(pal.clear);
      this.ambient.color.setHex(pal.ambient.color); this.ambient.intensity = pal.ambient.intensity * Math.PI;
      this.hemi.color.setHex(pal.hemi.sky); this.hemi.groundColor.setHex(pal.hemi.ground); this.hemi.intensity = pal.hemi.intensity * Math.PI;
      this.sun.color.setHex(pal.sun.color); this.sun.intensity = pal.sun.intensity * Math.PI;
      this.sun.position.set(...pal.sun.pos);
      this.room.applyPalette(pal);
    }
    this.pipeline.setParams(pal, v.dither);
    const q = v.quality;
    if (q !== this.qualityKey && this.renderer) {
      this.qualityKey = q;
      const on = q === 'high';
      this.renderer.shadowMap.enabled = on;
      this.sun.castShadow = on;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach((x) => { x.needsUpdate = true; }); else if (m) m.needsUpdate = true;
      });
    }
    if (this.pipeline.pixelSize !== v.pixelSize) this.resize();
    this.pathLines.visible = v.showPaths;
  }

  // ------------------------------------------------------------------ picking
  private pickAt(clientX: number, clientY: number): string | null {
    const r = this.container.getBoundingClientRect();
    const px = clientX - r.left, py = clientY - r.top;
    let best: string | null = null, bd = 30;
    for (const [id, e] of this.entries) {
      // distance from point to the feet-head screen segment
      const ax = e.fx, ay = e.fy, bx = e.sx, by = e.sy + 10;
      const dx = bx - ax, dy = by - ay;
      const l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
      const d = Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
      const scale = Math.max(0.7, Math.min(2.2, 1 / (this.cam.halfH / 11)));
      if (d < bd * scale && d / scale < bd) { bd = d / scale; best = id; }
    }
    return best;
  }
  private handleClick(x: number, y: number): void { this.pickCb?.(this.pickAt(x, y)); }
  private handleHover(x: number, y: number): void {
    const id = this.pickAt(x, y);
    if (id !== this.hoverId) { this.hoverId = id; if (this.canvas) this.canvas.style.cursor = id ? 'pointer' : 'grab'; }
  }

  // ------------------------------------------------------------------ agents
  private getEntry(a: AgentState): Entry {
    let e = this.entries.get(a.id);
    if (e) return e;
    const rig = createAgentRig({ provider: a.provider, role: a.role, seed: hashStr(a.id + a.name), ownerColor: a.ownerColor, name: a.name });
    this.scene.add(rig.object);
    e = {
      rig, x: a.pos.x, z: a.pos.z, heading: a.heading, inited: false, compactions: a.compactions ?? 0, phase: null, seen: 0,
      sx: 0, sy: 0, fx: 0, fy: 0, pathAcc: 99, path: null, castTick: 0,
      label: { id: a.id, name: a.name, provider: a.provider, tier: '', model: '', owner: '', ownerColor: '#888', skills: [], phase: '', ticketId: null, cost: 0, burn: 0, bubble: null, x: 0, y: 0, visible: false, selected: false },
    };
    this.setCast(rig.object);
    this.entries.set(a.id, e);
    return e;
  }
  private setCast(o: THREE.Object3D): void {
    o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  }

  private syncAgents(state: SimState, dt: number): void {
    this.frame++;
    const k = 1 - Math.exp(-28 * dt), kh = 1 - Math.exp(-16 * dt);
    const frameStamp = this.frame;
    for (const a of state.agents) {
      const e = this.getEntry(a);
      e.seen = frameStamp;
      // smoothing (snap on teleport / first sight)
      const dist = Math.hypot(a.pos.x - e.x, a.pos.z - e.z);
      if (!e.inited || dist > 2.5) { e.x = a.pos.x; e.z = a.pos.z; e.heading = a.heading; e.inited = true; }
      else { e.x += (a.pos.x - e.x) * k; e.z += (a.pos.z - e.z) * k; e.heading = angleLerp(e.heading, a.heading, kh); }
      const o = e.rig.object;
      o.position.set(e.x, 0, e.z);
      o.rotation.y = e.heading;

      // seated?
      let nearSeat = false;
      if (SEATED_POSES.has(a.pose)) {
        for (const s of SEAT_POINTS) if (Math.hypot(a.pos.x - s.x, a.pos.z - s.z) < 0.22) { nearSeat = true; break; }
      }
      const skillColors: string[] = [];
      for (const id of a.skills ?? []) skillColors.push(this.skills.fn(id).color);
      let carrying = a.carrying;
      if (a.pose === 'pickup' && !carrying) {
        // paper drop/pick at depot/inbox/outTray: avoid the "reach up to a shelf" look
        for (const id of PAPER_STATIONS) {
          const st = STATIONS[id];
          if (Math.hypot(a.pos.x - st.stand.x, a.pos.z - st.stand.z) < 1.3) { carrying = PAPER_CARRY; break; }
        }
      }
      if (a.pose === 'plan' && Math.hypot(a.pos.x - STATIONS.board.stand.x, a.pos.z - STATIONS.board.stand.z) < 1.2) e.heading = angleLerp(e.heading, 0, kh);
      o.rotation.y = e.heading;
      const frame: RigFrame = {
        pose: a.pose, seated: nearSeat, carrying, skillColors,
        tier: a.config.tier, subagents: a.activeSubagents, contextFill: a.contextFill,
        speed: this.simSpeed, selected: a.id === this.selected,
      };
      e.rig.update(dt, frame);
      if ((a.compactions ?? 0) > e.compactions) e.rig.flashCompaction();
      e.compactions = a.compactions ?? 0;
      if (a.phase === 'celebrating' && e.phase !== 'celebrating') this.fx.confetti(e.x, 1.6, e.z, 36, 2.8);
      e.phase = a.phase;
      // burning desk: rising coin sparks (cheap, only when high burn)
      if (a.burnUsdPerMin > 0.15 && !this.reduced && Math.random() < dt * Math.min(2.2, a.burnUsdPerMin * 2.5) && nearSeat) {
        this.fx.spawn(e.x + (Math.random() - 0.5) * 0.4, 1.5, e.z - 0.2, 0, 0.7, 0, 1.1, 0.09, 0xffd25a, -0.2, 0, true);
      }
      if (++e.castTick % 90 === 0) this.setCast(o);
    }
    for (const [id, e] of this.entries) {
      if (e.seen !== frameStamp) { this.scene.remove(e.rig.object); e.rig.dispose(); this.entries.delete(id); if (this.selected === id) this.selected = null; }
    }
  }

  // ------------------------------------------------------------------ main loop
  update(state: SimState, dtReal: number): void {
    if (!this.ok || !this.renderer) return;
    const t0 = performance.now();
    const dt = Math.min(0.1, Math.max(0.0001, dtReal || 0.016));
    this.time += dt;
    if (this.visual.pixelSize !== this.pipeline.pixelSize || Math.min(2, window.devicePixelRatio || 1) !== this.dpr) this.resize(); // also handles moving between monitors (dpr change fires no ResizeObserver)
    // sim speed estimate (for animation clocks)
    if (this.lastSimTime >= 0) {
      const inst = Math.max(0, (state.time - this.lastSimTime) / dt);
      this.simSpeed += (Math.min(8, inst) - this.simSpeed) * (1 - Math.exp(-4 * dt));
    }
    this.lastSimTime = state.time;

    this.skills.sync(state.skills);
    this.syncAgents(state, dt);

    const su: StationUpdate = { state, t: this.time, dt, pal: this.pal, reduced: this.reduced, live: !!this.visual.live };
    this.cubicles.update(state.agents, this.time, dt, this.pal, this.reduced);
    for (const s of this.stations) s.update(su);
    this.flights.update(state, dt, (ep, out, isFrom) => this.resolveEndpoint(ep, out, isFrom), this.visual.showLabels);
    this.fx.update(dt);

    // selection ring
    const sel = this.selected ? this.entries.get(this.selected) : undefined;
    if (sel) {
      this.ring.visible = true;
      this.ring.position.set(sel.x, 0.09, sel.z);
      const p = 1 + (this.reduced ? 0 : 0.08 * Math.sin(this.time * 5));
      this.ring.scale.set(p, p, p);
      this.ringMat.opacity = 0.7 + (this.reduced ? 0.2 : 0.25 * Math.sin(this.time * 5 + 1));
    } else this.ring.visible = false;

    // camera
    this._focus.set(sel ? sel.x : 0, 0.9, sel ? sel.z : 0);
    this.cam.update(dt, this.rtW, this.rtH, { on: this.visual.autoOrbit, speed: this.visual.orbitSpeed }, this.visual.focus, sel ? this._focus : null);
    this.pipeline.setOutlineWorld(Math.max(0.2, this.cam.texelWorld * 1.6), 199);

    if (this.visual.showPaths) this.updatePaths(state, dt);

    this.renderer.info.reset();
    this.pipeline.render(this.scene, this.cam.camera);
    this.updateLabels(state);

    this.frameTimes.push(performance.now() - t0);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
  }

  private resolveEndpoint(ep: Flight['from'], out: THREE.Vector3, isFrom: boolean): boolean {
    if ('agent' in ep) {
      const e = this.entries.get(ep.agent);
      if (!e) return false;
      out.set(e.x, isFrom ? 1.25 : 1.1, e.z);
      return true;
    }
    const st = STATIONS[ep.station];
    if (!st) return false;
    out.set(st.prop.x, STATION_Y[ep.station] ?? 1.2, st.prop.z);
    return true;
  }

  private updateLabels(state: SimState): void {
    const cam = this.cam.camera;
    const items = this.labelItems;
    items.length = 0;
    const w = this.cssW, h = this.cssH;
    for (const a of state.agents) {
      const e = this.entries.get(a.id);
      if (!e) continue;
      const hh = e.rig.headHeight;
      this._v.set(e.x, Math.max(1.2, hh - 0.95), e.z).project(cam);
      e.sx = (this._v.x * 0.5 + 0.5) * w; e.sy = (-this._v.y * 0.5 + 0.5) * h;
      const vis = Math.abs(this._v.x) < 1.08 && Math.abs(this._v.y) < 1.08;
      this._v.set(e.x, 0.05, e.z).project(cam);
      e.fx = (this._v.x * 0.5 + 0.5) * w; e.fy = (-this._v.y * 0.5 + 0.5) * h;
      const L = e.label;
      L.name = a.name; L.provider = a.provider; L.tier = a.config.tier; L.model = a.config.model; L.owner = a.owner; L.ownerColor = a.ownerColor ?? '#9a8ac0';
      L.skills = a.skills ?? []; L.phase = a.phase; L.ticketId = a.ticketId; L.status = a.status; L.cost = a.usage?.costUsd ?? 0; L.burn = a.burnUsdPerMin ?? 0;
      L.bubble = a.bubble; L.x = e.sx; L.y = e.sy; L.visible = vis; L.selected = a.id === this.selected;
      items.push(L);
    }
    // A small room on screen (the board's docked view; under ~22 css px a metre, where a bubble over a tag reaches the
    // tag of the agent at the next desk) folds each bubble's words into its agent's tag; zoomed in, or the presenter's
    // big room, keeps the speech bubbles.
    const small = h / (2 * this.cam.halfH) < 22;
    this.labels.update(items, this.visual.showLabels, this.visual.showBubbles, this.cam.zoom * (1 + this.visual.focus * 2.6 * (this.selected ? 1 : 0)) < 1.45, this.skills.fn, small);
    // flight tags
    const tags = this.flightTags;
    tags.length = 0;
    for (const t of this.flights.tags) {
      this._v.set(t.x, t.y, t.z).project(cam);
      if (Math.abs(this._v.x) > 1.1 || Math.abs(this._v.y) > 1.1) continue;
      tags.push({ key: t.key, text: t.text, color: t.color, x: (this._v.x * 0.5 + 0.5) * w, y: (-this._v.y * 0.5 + 0.5) * h });
    }
    this.labels.updateFlights(tags);
  }

  private updatePaths(state: SimState, dt: number): void {
    let n = 0;
    const arr = this.pathPos;
    for (const a of state.agents) {
      const e = this.entries.get(a.id);
      const fn = PATH_PHASES[a.phase];
      if (!e || !fn || (a.pose !== 'walk' && a.pose !== 'carry_walk')) continue;
      e.pathAcc += dt;
      if (e.pathAcc > 0.5 || !e.path) {
        e.pathAcc = 0;
        try { e.path = findPath({ point: { x: a.pos.x, z: a.pos.z } }, fn(a)); } catch { e.path = null; }
      }
      const p = e.path;
      if (!p) continue;
      let px = e.x, pz = e.z;
      for (let i = 0; i < p.length && n < 16 * 40 - 1; i++) {
        arr[n * 6] = px; arr[n * 6 + 1] = 0.12; arr[n * 6 + 2] = pz;
        arr[n * 6 + 3] = p[i].x; arr[n * 6 + 4] = 0.12; arr[n * 6 + 5] = p[i].z;
        px = p[i].x; pz = p[i].z; n++;
      }
    }
    const g = this.pathLines.geometry;
    g.setDrawRange(0, n * 2);
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
