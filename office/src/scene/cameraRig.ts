import * as THREE from 'three';
import { ROOM } from '../layout';

export interface CameraState { azimuth: number; elevation: number; zoom: number; target: { x: number; y: number; z: number } }
/** The parts of the view covered by panels, as fractions of its width (left, right) and height (top, bottom). */
export interface ViewInsets { top: number; right: number; bottom: number; left: number }

const DEG = Math.PI / 180;
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _ft = new THREE.Vector3();
const _corners: THREE.Vector3[] = [];
for (const x of [ROOM.minX - 0.6, ROOM.maxX + 0.3]) for (const y of [-0.8, ROOM.wallHeight]) for (const z of [ROOM.minZ - 0.5, ROOM.maxZ + 0.3]) _corners.push(new THREE.Vector3(x, y, z));

/** Orthographic orbit camera with texel snapping, pan/zoom, auto-orbit and agent focus. */
export class CameraRig {
  camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 200);
  azimuth = 40 * DEG;      // 0 = camera due south of target looking north; +ve swings towards east
  elevation = 36 * DEG;
  zoom = 1;
  target = new THREE.Vector3(0, 1.2, 0.3);
  private fit = 12;
  private fitInit = false;
  private focusCur = 0;
  private focusPos = new THREE.Vector3();
  private focusInit = false;
  halfH = 12;
  texelWorld = 0.05;
  dragging = false;
  private lastX = 0;
  private lastY = 0;
  private mode: 'none' | 'rotate' | 'pan' = 'none';
  private moved = 0;
  private downX = 0;
  private downY = 0;
  onClick: ((x: number, y: number) => void) | null = null;
  onHover: ((x: number, y: number) => void) | null = null;
  private cleanup: (() => void)[] = [];
  reducedMotion = false;
  /** Where panels cover the view: the room is framed in the rest (eased, like the fit). */
  insets: ViewInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  private ins: ViewInsets = { top: 0, right: 0, bottom: 0, left: 0 };

  constructor(private el: HTMLElement) {
    const down = (e: PointerEvent) => {
      this.mode = e.button === 2 || e.shiftKey || e.button === 1 ? 'pan' : 'rotate';
      this.dragging = true;
      this.moved = 0;
      this.lastX = this.downX = e.clientX;
      this.lastY = this.downY = e.clientY;
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    const move = (e: PointerEvent) => {
      if (!this.dragging) { this.onHover?.(e.clientX, e.clientY); return; }
      const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.moved += Math.abs(dx) + Math.abs(dy);
      if (this.mode === 'rotate') {
        this.azimuth -= dx * 0.006;
        this.elevation = THREE.MathUtils.clamp(this.elevation + dy * 0.005, 12 * DEG, 78 * DEG);
      } else if (this.mode === 'pan') {
        const hpp = (this.halfH * 2) / Math.max(1, el.clientHeight);
        this.camera.matrixWorld.extractBasis(_right, _up, _dir);
        // pan on the ground plane: right axis + projected forward
        _tmp.set(-Math.sin(this.azimuth), 0, -Math.cos(this.azimuth));
        this.target.addScaledVector(_right, -dx * hpp);
        this.target.addScaledVector(_tmp, dy * hpp / Math.max(0.25, Math.sin(this.elevation)));
        this.target.x = THREE.MathUtils.clamp(this.target.x, ROOM.minX, ROOM.maxX);
        this.target.z = THREE.MathUtils.clamp(this.target.z, ROOM.minZ, ROOM.maxZ);
      }
    };
    const up = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (this.moved < 5 && e.button === 0) this.onClick?.(e.clientX, e.clientY);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(-e.deltaY * 0.0012), 0.45, 6);
    };
    const ctx = (e: Event) => e.preventDefault();
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('contextmenu', ctx);
    this.cleanup.push(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('contextmenu', ctx);
    });
  }

  getState(): CameraState {
    return { azimuth: this.azimuth, elevation: this.elevation, zoom: this.zoom, target: { x: this.target.x, y: this.target.y, z: this.target.z } };
  }
  setState(s: Partial<CameraState>): void {
    if (s.azimuth !== undefined) this.azimuth = s.azimuth;
    if (s.elevation !== undefined) this.elevation = s.elevation;
    if (s.zoom !== undefined) this.zoom = s.zoom;
    if (s.target) this.target.set(s.target.x, s.target.y, s.target.z);
  }

  private computeFit(aspect: number): number {
    // frame all corners of the room box at the current angles
    const ce = Math.cos(this.elevation), se = Math.sin(this.elevation);
    _dir.set(Math.sin(this.azimuth) * ce, se, Math.cos(this.azimuth) * ce); // from target to camera
    _right.set(Math.cos(this.azimuth), 0, -Math.sin(this.azimuth));
    _up.crossVectors(_dir, _right);
    let mx = 0, my = 0;
    const cx = 0, cy = 1.4, cz = 0;
    for (const c of _corners) {
      _tmp.set(c.x - cx, c.y - cy, c.z - cz);
      mx = Math.max(mx, Math.abs(_tmp.dot(_right)));
      my = Math.max(my, Math.abs(_tmp.dot(_up)));
    }
    return Math.max(my, mx / aspect) * 1.04;
  }

  /** Per-frame update. focusPos: world pos of selected agent (or null). */
  update(dt: number, rtW: number, rtH: number, auto: { on: boolean; speed: number }, focus: number, focusAt: THREE.Vector3 | null): void {
    const aspect = rtW / rtH;
    if (auto.on && !this.dragging && !this.reducedMotion) this.azimuth += auto.speed * 0.12 * dt;
    // The free part of the view (not under a panel): the room is fitted into it and centred on it.
    const k = this.reducedMotion || !this.fitInit ? 1 : 1 - Math.exp(-6 * dt);
    for (const s of ['top', 'right', 'bottom', 'left'] as const) this.ins[s] += (THREE.MathUtils.clamp(this.insets[s] || 0, 0, 0.45) - this.ins[s]) * k;
    const freeW = Math.max(0.1, 1 - this.ins.left - this.ins.right), freeH = Math.max(0.1, 1 - this.ins.top - this.ins.bottom);
    const f = this.computeFit(aspect * freeW / freeH) / freeH;
    if (!this.fitInit) { this.fit = f; this.fitInit = true; } else this.fit += (f - this.fit) * (1 - Math.exp(-6 * dt));

    // focus blending
    const want = focusAt ? focus : 0;
    this.focusCur += (want - this.focusCur) * (1 - Math.exp(-4 * dt));
    if (focusAt) {
      if (!this.focusInit) { this.focusPos.copy(focusAt); this.focusInit = true; }
      else this.focusPos.lerp(focusAt, 1 - Math.exp(-8 * dt));
    } else if (this.focusCur < 0.01) this.focusInit = false;
    const fc = this.focusCur;
    const effZoom = this.zoom * (1 + fc * 2.6);
    this.halfH = this.fit / effZoom;
    const halfW = this.halfH * aspect;
    const cam = this.camera;
    // Shift the frustum so the target sits at the centre of the free part (a view offset, no rotation).
    const dx = ((this.ins.left - this.ins.right) / 2) * 2 * halfW, dy = ((this.ins.bottom - this.ins.top) / 2) * 2 * this.halfH;
    cam.left = -halfW - dx; cam.right = halfW - dx; cam.top = this.halfH - dy; cam.bottom = -this.halfH - dy;
    cam.updateProjectionMatrix();

    _tmp.copy(this.target);
    if (fc > 0.001) _tmp.lerp(_ft.set(this.focusPos.x, 0.9, this.focusPos.z), fc);
    const ce = Math.cos(this.elevation), se = Math.sin(this.elevation);
    _dir.set(Math.sin(this.azimuth) * ce, se, Math.cos(this.azimuth) * ce);
    cam.position.copy(_tmp).addScaledVector(_dir, 90);
    cam.lookAt(_tmp);
    cam.updateMatrixWorld();

    // snap camera to the texel grid so static geometry doesn't shimmer when panning / zooming
    this.texelWorld = (this.halfH * 2) / rtH;
    const tw = this.texelWorld;
    cam.matrixWorld.extractBasis(_right, _up, _dir);
    const a = cam.position.dot(_right), b = cam.position.dot(_up);
    cam.position.addScaledVector(_right, Math.round(a / tw) * tw - a);
    cam.position.addScaledVector(_up, Math.round(b / tw) * tw - b);
    cam.updateMatrixWorld();
  }

  dispose(): void { for (const c of this.cleanup) c(); this.cleanup.length = 0; }
}
