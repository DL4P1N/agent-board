import type { VisualSettings } from '../types';

export interface Palette {
  clear: number;
  ambient: { color: number; intensity: number };
  hemi: { sky: number; ground: number; intensity: number };
  sun: { color: number; intensity: number; pos: [number, number, number] };
  floorAisle: number;
  floorCarpet: number;
  wall: number;
  wallTrim: number;
  slab: number;
  rug: number;
  window: { top: number; bottom: number; city: number; lit: number; stars: boolean };
  /** floor light patches under windows (additive colour + opacity) */
  windowGlow: { color: number; opacity: number };
  lampStrength: number;   // 0..1 intensity of the additive lamp pools
  posterTint: number;     // multiplies poster/window brightness
  screenGain: number;     // brightness of screens/emissives
  post: {
    levels: number;       // colour levels per channel
    mono: number;         // 0..1 mix into the 3-colour ramp
    ramp: [number, number, number];
    vignette: number;
    contrast: number;
    saturation: number;
    lift: [number, number, number];
    outline: number;      // 0..1 outline darkness
  };
}

export const PALETTES: Record<VisualSettings['palette'], Palette> = {
  dusk: {
    clear: 0x1a1430,
    ambient: { color: 0x8a78c8, intensity: 1.0 },
    hemi: { sky: 0xb0a4f4, ground: 0x5a4278, intensity: 0.6 },
    sun: { color: 0xffb070, intensity: 1.05, pos: [-9, 24, -6] },
    floorAisle: 0xc79a72,
    floorCarpet: 0x7a79b4,
    wall: 0xd7b4d2,
    wallTrim: 0x5a4470,
    slab: 0x2c2040,
    rug: 0xe0885a,
    window: { top: 0x5a3a9a, bottom: 0xff9a5a, city: 0x2a1a4a, lit: 0xffd27a, stars: false },
    windowGlow: { color: 0xff9a50, opacity: 0.2 },
    lampStrength: 0.8,
    posterTint: 0.95,
    screenGain: 1.0,
    post: { levels: 9, mono: 0, ramp: [0, 0, 0], vignette: 0.28, contrast: 1.08, saturation: 1.08, lift: [0.02, 0.01, 0.05], outline: 0.55 },
  },
  day: {
    clear: 0xa9dbf5,
    ambient: { color: 0xe3ecff, intensity: 0.8 },
    hemi: { sky: 0xdff1ff, ground: 0xc8b49a, intensity: 0.6 },
    sun: { color: 0xfff1d0, intensity: 1.05, pos: [-10, 24, -7] },
    floorAisle: 0xd8b88c,
    floorCarpet: 0x7fa6c9,
    wall: 0xf3ead8,
    wallTrim: 0x8a7a68,
    slab: 0x6a5a4c,
    rug: 0xe8806a,
    window: { top: 0x74c0ff, bottom: 0xcdeeff, city: 0x8aa6c0, lit: 0xf2f6ff, stars: false },
    windowGlow: { color: 0xfff0c0, opacity: 0.22 },
    lampStrength: 0.12,
    posterTint: 1.0,
    screenGain: 0.95,
    post: { levels: 10, mono: 0, ramp: [0, 0, 0], vignette: 0.12, contrast: 1.04, saturation: 1.05, lift: [0.0, 0.0, 0.0], outline: 0.4 },
  },
  night: {
    clear: 0x070a1a,
    ambient: { color: 0x5a6cb8, intensity: 1.05 },
    hemi: { sky: 0x7088d0, ground: 0x2a2a52, intensity: 0.6 },
    sun: { color: 0x8aa6f0, intensity: 0.7, pos: [-10, 22, -6] },
    floorAisle: 0xa88068,
    floorCarpet: 0x5a68a8,
    wall: 0xa090d0,
    wallTrim: 0x2a2548,
    slab: 0x141428,
    rug: 0xb05a58,
    window: { top: 0x070a24, bottom: 0x1a2a5a, city: 0x0a0e22, lit: 0xffe08a, stars: true },
    windowGlow: { color: 0x6a8ae0, opacity: 0.12 },
    lampStrength: 1.7,
    posterTint: 0.7,
    screenGain: 1.25,
    post: { levels: 8, mono: 0, ramp: [0, 0, 0], vignette: 0.4, contrast: 1.12, saturation: 1.1, lift: [0.0, 0.01, 0.04], outline: 0.6 },
  },
  terminal: {
    clear: 0x020a05,
    ambient: { color: 0x4fff80, intensity: 0.7 },
    hemi: { sky: 0x5aff90, ground: 0x103a1a, intensity: 0.45 },
    sun: { color: 0xd8ff9a, intensity: 1.0, pos: [-14, 18, -8] },
    floorAisle: 0x6f8f6a,
    floorCarpet: 0x4a7a56,
    wall: 0x8ab890,
    wallTrim: 0x1a3a22,
    slab: 0x06180c,
    rug: 0x9a8a4a,
    window: { top: 0x04260e, bottom: 0x1a8a3a, city: 0x03150a, lit: 0xb5ff7a, stars: true },
    windowGlow: { color: 0x58ff90, opacity: 0.14 },
    lampStrength: 0.9,
    posterTint: 0.9,
    screenGain: 1.2,
    post: { levels: 8, mono: 0.88, ramp: [0x021008, 0x1fb04a, 0xcaff9a], vignette: 0.4, contrast: 1.15, saturation: 1.0, lift: [0, 0.01, 0.0], outline: 0.6 },
  },
};
