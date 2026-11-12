import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** Pooled particle system (instanced boxes): confetti, smoke, sparks, coins. No per-frame allocation. */
export class ParticlePool {
  mesh: THREE.InstancedMesh;
  private n: number;
  private px: Float32Array; private py: Float32Array; private pz: Float32Array;
  private vx: Float32Array; private vy: Float32Array; private vz: Float32Array;
  private life: Float32Array; private max: Float32Array; private size: Float32Array; private grav: Float32Array;
  private rx: Float32Array; private ry: Float32Array; private spin: Float32Array;
  private shrink: Uint8Array;
  private next = 0;
  active = 0;

  constructor(n = 480) {
    this.n = n;
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    const f = () => new Float32Array(n);
    this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f();
    this.life = f(); this.max = f(); this.size = f(); this.grav = f(); this.rx = f(); this.ry = f(); this.spin = f();
    this.shrink = new Uint8Array(n);
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) this.mesh.setMatrixAt(i, _m);
    this.mesh.count = n;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: THREE.ColorRepresentation, gravity = 6, spin = 0, shrink = true): void {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    if (this.life[i] <= 0) this.active++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.grav[i] = gravity;
    this.rx[i] = Math.random() * 6; this.ry[i] = Math.random() * 6; this.spin[i] = spin;
    this.shrink[i] = shrink ? 1 : 0;
    _c.set(color);
    this.mesh.setColorAt(i, _c);
    this.mesh.instanceColor!.needsUpdate = true;
  }

  confetti(x: number, y: number, z: number, count = 40, speed = 3.2): void {
    const cols = [0xff5a6a, 0xffd25a, 0x5ad17a, 0x5ab8ff, 0xd97757, 0x2dd4bf, 0xe879f9, 0xffffff];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.3 + Math.random() * 0.7) * speed;
      this.spawn(x, y, z, Math.cos(a) * sp, 2.5 + Math.random() * 3.5, Math.sin(a) * sp, 1.6 + Math.random() * 1.2, 0.07 + Math.random() * 0.06, cols[i % cols.length], 7, 6 + Math.random() * 8);
    }
  }

  sparks(x: number, y: number, z: number, count: number, color: THREE.ColorRepresentation, speed = 2): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.3 + Math.random()) * speed;
      this.spawn(x, y, z, Math.cos(a) * sp, 1 + Math.random() * 2.5, Math.sin(a) * sp, 0.5 + Math.random() * 0.5, 0.06, color, 6, 0);
    }
  }

  update(dt: number): void {
    if (this.active <= 0) return;
    let act = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); continue; }
      act++;
      this.vy[i] -= this.grav[i] * dt;
      const drag = Math.exp(-0.6 * dt);
      this.vx[i] *= drag; this.vz[i] *= drag;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      if (this.py[i] < 0.05 && this.grav[i] > 0) { this.py[i] = 0.05; this.vy[i] = 0; this.vx[i] *= 0.7; this.vz[i] *= 0.7; }
      const k = this.shrink[i] ? Math.min(1, this.life[i] / (this.max[i] * 0.35)) : 1;
      const sz = this.size[i] * k;
      this.rx[i] += this.spin[i] * dt; this.ry[i] += this.spin[i] * 0.7 * dt;
      _e.set(this.rx[i], this.ry[i], 0);
      _q.setFromEuler(_e);
      _p.set(this.px[i], this.py[i], this.pz[i]);
      _s.set(sz, sz * 0.35 + sz * 0.0, sz);
      if (this.spin[i] === 0) _s.set(sz, sz, sz);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.active = act;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
