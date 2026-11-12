import * as THREE from 'three';
import { ACCENT } from './props';

export interface Shared {
  vc: THREE.MeshLambertMaterial;            // vertex-coloured, palette independent
  lam: Record<'claude' | 'codex' | 'off', THREE.MeshLambertMaterial>;   // accent plastics (bezel, chair, trim)
  lampOn: Record<'claude' | 'codex' | 'off', THREE.MeshBasicMaterial>;
  invisible: THREE.MeshBasicMaterial;
  glowBase: THREE.MeshBasicMaterial;
}

export function makeShared(): Shared {
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true });
  const col = { claude: ACCENT.claude, codex: ACCENT.codex, off: 0x3a3d4a };
  const lam = {} as Shared['lam'];
  const lampOn = {} as Shared['lampOn'];
  for (const k of ['claude', 'codex', 'off'] as const) {
    lam[k] = new THREE.MeshLambertMaterial({ color: col[k] });
    lampOn[k] = new THREE.MeshBasicMaterial({ color: k === 'off' ? 0x2a2c34 : col[k], toneMapped: false });
  }
  lampOn.claude.color.multiplyScalar(1.25);
  lampOn.codex.color.multiplyScalar(1.25);
  return { vc, lam, lampOn, invisible: new THREE.MeshBasicMaterial({ visible: false }), glowBase: new THREE.MeshBasicMaterial() };
}
