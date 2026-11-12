/**
 * Standalone voxel character gallery. Run: npx vite --port 5175  ->  /src/scene/characters/demo.html
 * Debug handle: window.demo (state, apply(), advance(seconds), rigs).
 */
import * as THREE from 'three';
import type { Pose, Provider, Role } from '../../types';
import { RIG_SEAT, createAgentRig } from './index';
import type { AgentRig, RigFrame } from './rigTypes';

const POSES: Pose[] = ['idle', 'walk', 'carry_walk', 'pickup', 'type', 'think', 'wait', 'blocked', 'review', 'plan', 'celebrate', 'sleep', 'throw', 'raise_hand'];
const SKILL_COLORS = ['#38bdf8', '#34d399', '#f472b6', '#fbbf24', '#fb923c', '#ef4444'];
const OWNER_COLORS = ['#a78bfa', '#f97316', '#22c55e', '#38bdf8', '#f43f5e', '#eab308'];
const CLAUDE_TIERS = ['haiku', 'sonnet', 'opus', 'fable'];
const CODEX_TIERS = ['mini', 'standard', 'max'];

interface State {
  layout: 'poses' | 'tiers' | 'roles' | 'single';
  pose: string;
  provider: string;
  role: string;
  tier: string;
  subagents: number;
  fill: number;
  seated: boolean;
  carry: string;
  count: number;
  owner: string;
  ownerOn: boolean;
  skills: boolean[];
  selected: boolean;
  speed: number;
  spin: boolean;
  pix: boolean;
  pxsize: number;
  zoom: number;
  az: number;
  el: number;
}

const S: State = {
  layout: 'poses', pose: 'all', provider: 'mix', role: 'worker', tier: 'mix', subagents: 2, fill: 0.5, seated: true,
  carry: 'none', count: 3, owner: '#a78bfa', ownerOn: true, skills: [true, true, false, false, false, false], selected: false,
  speed: 1, spin: false, pix: false, pxsize: 3, zoom: 1, az: Math.PI - 0.45, el: 0.62,
};

// ---------------------------------------------------------------- three setup
const stage = document.getElementById('stage') as HTMLElement;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6f7a90);
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x555a66, 1.1));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.1);
sun.position.set(-6, 12, -7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14; sun.shadow.camera.right = 14; sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ color: 0x8a93a6 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(60, 60, 0x717a8e, 0x7b8499);
grid.position.y = 0.002;
scene.add(grid);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);

// pixelation
const quadScene = new THREE.Scene();
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadMat = new THREE.MeshBasicMaterial({ map: null });
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat));
let rt: THREE.WebGLRenderTarget | null = null;

// ---------------------------------------------------------------- furniture
const matWood = new THREE.MeshLambertMaterial({ color: 0xb08a5a });
const matDark = new THREE.MeshLambertMaterial({ color: 0x3b4252 });
const matBoard = new THREE.MeshLambertMaterial({ color: 0xf2f4f8 });
const matChair = new THREE.MeshLambertMaterial({ color: 0x5b6070 });
const matScreen = new THREE.MeshBasicMaterial({ color: 0x7fd3ff });
function box(w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material): THREE.Mesh {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  me.position.set(x, y, z);
  me.castShadow = true; me.receiveShadow = true;
  return me;
}
function makeSeatedFurniture(): THREE.Group {
  const g = new THREE.Group();
  const T = RIG_SEAT.deskTop;
  g.add(box(1.4, 0.05, 0.8, 0, T - 0.025, RIG_SEAT.deskEdgeZ - 0.4, matWood));
  g.add(box(0.05, T - 0.05, 0.75, 0.65, (T - 0.05) / 2, RIG_SEAT.deskEdgeZ - 0.4, matDark));
  g.add(box(0.05, T - 0.05, 0.75, -0.65, (T - 0.05) / 2, RIG_SEAT.deskEdgeZ - 0.4, matDark));
  g.add(box(0.42, 0.025, 0.15, 0, T + 0.0125, -0.5, matDark));
  g.add(box(0.5, 0.32, 0.04, 0.95, T + 0.2, -1.0, matDark));
  g.add(box(0.44, 0.26, 0.01, 0.95, T + 0.2, -0.975, matScreen));
  // chair
  g.add(box(0.52, 0.06, 0.5, 0, RIG_SEAT.seatTop - 0.03, 0.02, matChair));
  g.add(box(0.5, 0.5, 0.06, 0, RIG_SEAT.seatTop + 0.28, RIG_SEAT.chairBackZ, matChair));
  g.add(box(0.06, RIG_SEAT.seatTop - 0.06, 0.06, 0, (RIG_SEAT.seatTop - 0.06) / 2, 0.02, matDark));
  return g;
}
function makeStandFurniture(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.4, 0.05, 0.7, 0, 0.93, -0.75, matWood));
  g.add(box(0.05, 0.9, 0.65, 0.65, 0.45, -0.75, matDark));
  g.add(box(0.05, 0.9, 0.65, -0.65, 0.45, -0.75, matDark));
  g.add(box(0.42, 0.025, 0.15, 0, 0.96, -0.62, matDark));
  return g;
}
function makeBoard(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.8, 1.1, 0.06, 0, 1.45, -0.95, matBoard));
  g.add(box(1.9, 1.2, 0.04, 0, 1.45, -0.98, matDark));
  return g;
}

// ---------------------------------------------------------------- stations
interface Station {
  root: THREE.Group;
  seatedF: THREE.Group; standF: THREE.Group; board: THREE.Group;
  rig: AgentRig;
  frame: RigFrame;
  label: HTMLDivElement;
  cfg: Cfg;
}
interface Cfg { pose: Pose | null; provider: Provider; role: Role; tier: string; seed: number; text: string; pos: THREE.Vector3 }
const stations: Station[] = [];
const labelsEl = document.getElementById('labels') as HTMLElement;

function buildConfigs(): Cfg[] {
  const out: Cfg[] = [];
  const prov = (i: number): Provider => (S.provider === 'mix' ? (i % 2 === 0 ? 'claude' : 'codex') : (S.provider as Provider));
  const roleOf = (i: number): Role => (S.role === 'mix' ? (['worker', 'orchestrator', 'integrator'] as Role[])[i % 3] : (S.role as Role));
  const tierOf = (p: Provider, i: number): string => (S.tier === 'mix' ? (p === 'claude' ? CLAUDE_TIERS[(i >> 1) % 4] : CODEX_TIERS[(i >> 1) % 3]) : S.tier);
  if (S.layout === 'poses') {
    POSES.forEach((p, i) => {
      const c = i % 4, r = Math.floor(i / 4);
      const pv = prov(i);
      out.push({ pose: p, provider: pv, role: roleOf(i), tier: tierOf(pv, i), seed: i * 5 + 3, text: p, pos: new THREE.Vector3((c - 1.5) * 3.6, 0, (r - 1.5) * 3.8) });
    });
  } else if (S.layout === 'tiers') {
    const list: [Provider, string][] = [['claude', 'haiku'], ['claude', 'sonnet'], ['claude', 'opus'], ['claude', 'fable'], ['codex', 'mini'], ['codex', 'standard'], ['codex', 'max']];
    list.forEach(([pv, tr], i) => {
      const c = i % 4, r = Math.floor(i / 4);
      out.push({ pose: null, provider: pv, role: roleOf(i), tier: tr, seed: i * 3 + 1, text: pv + ' ' + tr, pos: new THREE.Vector3((c - 1.5) * 2.4, 0, (r - 0.5) * 2.8) });
    });
  } else if (S.layout === 'roles') {
    const roles: Role[] = ['worker', 'orchestrator', 'integrator'];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      const pv: Provider = r === 0 ? 'claude' : 'codex';
      out.push({ pose: null, provider: pv, role: roles[c], tier: S.tier === 'mix' ? (pv === 'claude' ? 'opus' : 'max') : S.tier, seed: 11 + c * 4 + r, text: pv + ' ' + roles[c], pos: new THREE.Vector3((c - 1) * 3.2, 0, (r - 0.5) * 3.8) });
    }
  } else {
    const pv: Provider = S.provider === 'codex' ? 'codex' : 'claude';
    out.push({ pose: null, provider: pv, role: S.role === 'mix' ? 'worker' : (S.role as Role), tier: S.tier === 'mix' ? 'opus' : S.tier, seed: 8, text: '', pos: new THREE.Vector3(0, 0, 0) });
  }
  return out;
}

function rebuild(): void {
  for (const s of stations) { s.rig.dispose(); scene.remove(s.root); s.label.remove(); }
  stations.length = 0;
  for (const cfg of buildConfigs()) {
    const root = new THREE.Group();
    root.position.copy(cfg.pos);
    const seatedF = makeSeatedFurniture(), standF = makeStandFurniture(), board = makeBoard();
    root.add(seatedF, standF, board);
    const rig = createAgentRig({ provider: cfg.provider, role: cfg.role, seed: cfg.seed, name: cfg.text || 'solo', ownerColor: S.ownerOn ? OWNER_COLORS[cfg.seed % OWNER_COLORS.length] : undefined });
    root.add(rig.object);
    scene.add(root);
    const label = document.createElement('div');
    label.className = 'lab';
    label.textContent = cfg.text;
    labelsEl.appendChild(label);
    const frame: RigFrame = { pose: 'idle', seated: true, carrying: null, skillColors: [], tier: 'sonnet', subagents: 0, contextFill: 0, speed: 1, selected: false };
    stations.push({ root, seatedF, standF, board, rig, frame, label, cfg });
  }
}

function currentPose(st: Station): Pose {
  if (st.cfg.pose) return S.pose === 'all' ? st.cfg.pose : (S.pose as Pose);
  return S.pose === 'all' ? 'idle' : (S.pose as Pose);
}

function applyFrame(st: Station): void {
  const f = st.frame;
  const p = currentPose(st);
  f.pose = p;
  f.seated = S.seated;
  f.carrying = S.carry === 'none' ? null : { kind: S.carry as 'tickets' | 'pr' | 'rejected' | 'skills', count: S.count };
  if (S.layout === 'poses' && S.pose === 'all') {
    // sensible defaults per pose in the overview
    if (p === 'carry_walk' && !f.carrying) f.carrying = { kind: 'tickets', count: S.count };
    if (p === 'pickup' && !f.carrying && st.cfg.seed % 2 === 0) f.carrying = { kind: 'pr', count: S.count };
  }
  f.skillColors = S.skills.map((on, i) => (on ? SKILL_COLORS[i] : '')).filter(Boolean);
  f.tier = st.cfg.tier;
  f.subagents = S.subagents;
  f.contextFill = S.fill;
  f.speed = S.speed;
  f.selected = S.selected;
  const seated = f.seated && ['idle', 'type', 'think', 'wait', 'blocked', 'sleep', 'review', 'throw', 'raise_hand'].includes(p);
  st.seatedF.visible = seated;
  st.standF.visible = !seated && (p === 'type' || p === 'review' || p === 'pickup' || p === 'think');
  st.board.visible = p === 'plan';
}

// ---------------------------------------------------------------- controls
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const poseSel = $<HTMLSelectElement>('pose');
['all', ...POSES].forEach((p) => { const o = document.createElement('option'); o.textContent = p; poseSel.appendChild(o); });
const skEl = $('skills');
SKILL_COLORS.forEach((c, i) => {
  const d = document.createElement('span');
  d.className = 'sk' + (S.skills[i] ? ' on' : '');
  d.style.background = c;
  d.onclick = () => { S.skills[i] = !S.skills[i]; d.classList.toggle('on', S.skills[i]); };
  skEl.appendChild(d);
});
function bindSel(id: string, key: keyof State, rb = false): void {
  const el = $<HTMLSelectElement>(id);
  el.addEventListener('change', () => { (S as unknown as Record<string, unknown>)[key] = el.value; if (rb) rebuild(); });
}
function bindRange(id: string, key: keyof State, vid?: string, digits = 0): void {
  const el = $<HTMLInputElement>(id);
  const f = () => { (S as unknown as Record<string, unknown>)[key] = parseFloat(el.value); if (vid) $(vid).textContent = parseFloat(el.value).toFixed(digits); };
  el.addEventListener('input', f);
}
function bindChk(id: string, key: keyof State, rb = false): void {
  const el = $<HTMLInputElement>(id);
  el.addEventListener('change', () => { (S as unknown as Record<string, unknown>)[key] = el.checked; if (rb) rebuild(); });
}
bindSel('layout', 'layout', true); bindSel('pose', 'pose'); bindSel('provider', 'provider', true); bindSel('role', 'role', true); bindSel('tier', 'tier', true);
bindSel('carry', 'carry');
bindRange('subagents', 'subagents', 'subagentsV'); bindRange('fill', 'fill', 'fillV', 2); bindRange('count', 'count', 'countV');
bindRange('speed', 'speed', 'speedV', 2); bindRange('pxsize', 'pxsize', 'pxsizeV'); bindRange('zoom', 'zoom');
bindChk('seated', 'seated'); bindChk('selected', 'selected'); bindChk('spin', 'spin'); bindChk('pix', 'pix'); bindChk('ownerOn', 'ownerOn', true);
$<HTMLInputElement>('owner').addEventListener('input', (e) => { S.owner = (e.target as HTMLInputElement).value; OWNER_COLORS[0] = S.owner; rebuild(); });
$('flash').addEventListener('click', () => {
  for (const s of stations) s.rig.flashCompaction();
  const el = $<HTMLInputElement>('fill');
  setTimeout(() => { S.fill = 0.12; el.value = '0.12'; $('fillV').textContent = '0.12'; }, 120);
});

// orbit
let drag: { x: number; y: number } | null = null;
renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointerup', () => { drag = null; });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!drag) return;
  S.az -= (e.clientX - drag.x) * 0.008;
  S.el = Math.max(0.1, Math.min(1.45, S.el + (e.clientY - drag.y) * 0.006));
  drag = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  S.zoom = Math.max(0.5, Math.min(6, S.zoom * Math.exp(-e.deltaY * 0.001)));
  $<HTMLInputElement>('zoom').value = String(S.zoom);
}, { passive: false });

// ---------------------------------------------------------------- render loop
const _v = new THREE.Vector3();
function resize(): void {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  if (S.pix) {
    const rw = Math.max(1, Math.floor(w / S.pxsize)), rh = Math.max(1, Math.floor(h / S.pxsize));
    if (!rt || rt.width !== rw || rt.height !== rh) {
      rt?.dispose();
      rt = new THREE.WebGLRenderTarget(rw, rh, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
      quadMat.map = rt.texture;
      quadMat.needsUpdate = true;
    }
  }
}

function baseHalfHeight(): number {
  switch (S.layout) { case 'poses': return 10.2; case 'tiers': return 4.6; case 'roles': return 5.2; default: return 2.3; }
}
function updateCamera(): void {
  const w = stage.clientWidth, h = stage.clientHeight;
  const hh = baseHalfHeight() / S.zoom, hw = hh * (w / h);
  camera.left = -hw; camera.right = hw; camera.top = hh; camera.bottom = -hh;
  camera.updateProjectionMatrix();
  const d = 30;
  const target = _v.set(0, S.layout === 'single' ? 1.2 : 0.6, 0);
  camera.position.set(target.x + Math.sin(S.az) * Math.cos(S.el) * d, target.y + Math.sin(S.el) * d, target.z + Math.cos(S.az) * Math.cos(S.el) * d);
  camera.lookAt(target);
}

function render(): void {
  resize();
  updateCamera();
  if (S.pix && rt) {
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);
  } else renderer.render(scene, camera);
  // labels
  const w = stage.clientWidth, h = stage.clientHeight;
  for (const st of stations) {
    _v.set(st.root.position.x, 0, st.root.position.z + 1.1).project(camera);
    st.label.style.left = ((_v.x * 0.5 + 0.5) * w) + 'px';
    st.label.style.top = ((-_v.y * 0.5 + 0.5) * h) + 'px';
    st.label.style.display = S.layout === 'single' ? 'none' : 'block';
  }
}

function tick(dt: number): void {
  if (S.spin) S.az += dt * 0.5;
  for (const st of stations) { applyFrame(st); st.rig.update(dt, st.frame); }
}

let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tick(dt);
  render();
  requestAnimationFrame(loop);
}

rebuild();
const demoApi = {
  S, stations,
  rebuild,
  /** apply partial state, sync the DOM inputs and rebuild if structural */
  apply(p: Partial<State>) {
    Object.assign(S, p);
    for (const k of Object.keys(p)) {
      const el = document.getElementById(k === 'pxsize' ? 'pxsize' : k) as HTMLInputElement | HTMLSelectElement | null;
      if (el) { if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = !!(S as unknown as Record<string, unknown>)[k]; else el.value = String((S as unknown as Record<string, unknown>)[k]); }
    }
    rebuild();
  },
  advance(sec: number) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) tick(1 / 60); render(); },
  stop: false,
};
(window as unknown as { demo: typeof demoApi }).demo = demoApi;
requestAnimationFrame(loop);
