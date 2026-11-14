import * as THREE from 'three';
import { ACCENT } from './props';
import { PROVIDER_IDS, type ProviderId } from '../providers';

export type AccentKey = ProviderId | 'off';

export interface Shared {
  vc: THREE.MeshLambertMaterial;            // vertex-coloured, palette independent
  lam: Record<AccentKey, THREE.MeshLambertMaterial>;   // accent plastics (bezel, chair, trim), one per tool + 'off'
  lampOn: Record<AccentKey, THREE.MeshBasicMaterial>;
  invisible: THREE.MeshBasicMaterial;
  glowBase: THREE.MeshBasicMaterial;
}

export function makeShared(): Shared {
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true });
  const col: Record<AccentKey, number> = { ...ACCENT, off: 0x3a3d4a };
  const lam = {} as Shared['lam'];
  const lampOn = {} as Shared['lampOn'];
  for (const k of [...PROVIDER_IDS, 'off'] as AccentKey[]) {
    lam[k] = new THREE.MeshLambertMaterial({ color: col[k] });
    lampOn[k] = new THREE.MeshBasicMaterial({ color: k === 'off' ? 0x2a2c34 : col[k], toneMapped: false });
    if (k !== 'off') lampOn[k].color.multiplyScalar(1.25);
  }
  return { vc, lam, lampOn, invisible: new THREE.MeshBasicMaterial({ visible: false }), glowBase: new THREE.MeshBasicMaterial() };
}
