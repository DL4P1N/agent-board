import * as THREE from 'three';
import type { Palette } from './palettes';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;       // render-target size in texels
uniform float uDither;
uniform float uLevels;
uniform float uOutline;
uniform float uOutlineThresh;
uniform float uMono;
uniform vec3 uRamp0; uniform vec3 uRamp1; uniform vec3 uRamp2;
uniform float uVignette;
uniform float uContrast;
uniform float uSaturation;
uniform vec3 uLift;

float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float bayer4(vec2 p) { return bayer2(p) + bayer2(floor(p * 0.5)) * 0.25; }

vec3 toSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 px = 1.0 / uRes;
  vec3 col = texture2D(tColor, vUv).rgb;
  float d = texture2D(tDepth, vUv).x;
  // Outline from the SECOND difference of depth. Orthographic depth is linear, so a flat (even very oblique) plane has
  // d(+1) + d(-1) - 2 d == 0 and is never outlined, whatever the camera elevation. A first-difference test flagged the
  // whole floor as an edge once depth-per-texel (texel * cot(elevation)) exceeded the threshold -> ground "flashed".
  // s > 0: this pixel is nearer than the average of its neighbours -> silhouette on the near object.
  float dxp = texture2D(tDepth, vUv + vec2(px.x, 0.0)).x, dxn = texture2D(tDepth, vUv - vec2(px.x, 0.0)).x;
  float dyp = texture2D(tDepth, vUv + vec2(0.0, px.y)).x, dyn = texture2D(tDepth, vUv - vec2(0.0, px.y)).x;
  float s2 = max(dxp + dxn - 2.0 * d, dyp + dyn - 2.0 * d);
  float edge = step(uOutlineThresh, s2);
  col *= 1.0 - edge * uOutline;

  vec3 s = toSrgb(col);
  // grade
  float lum = dot(s, vec3(0.299, 0.587, 0.114));
  s = mix(vec3(lum), s, uSaturation);
  s = (s - 0.5) * uContrast + 0.5;
  s += uLift * (1.0 - lum);
  // vignette
  vec2 q = vUv - 0.5;
  s *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(q * vec2(1.15, 1.0)) * 1.25);
  // mono ramp (terminal)
  if (uMono > 0.0) {
    float l = clamp(dot(s, vec3(0.299, 0.587, 0.114)) * 1.35, 0.0, 1.0);
    vec3 r = l < 0.5 ? mix(uRamp0, uRamp1, l * 2.0) : mix(uRamp1, uRamp2, (l - 0.5) * 2.0);
    s = mix(s, r, uMono);
  }
  // ordered dither + quantise
  vec2 cell = floor(vUv * uRes);
  float b = bayer4(cell) - 0.47;
  float lv = uLevels - 1.0;
  s = floor(clamp(s + b * uDither / lv, 0.0, 1.0) * lv + 0.5) / lv;
  gl_FragColor = vec4(s, 1.0);
}
`;

export class PixelPipeline {
  rt: THREE.WebGLRenderTarget;
  width = 2;
  height = 2;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  pixelSize = 3;

  constructor(private renderer: THREE.WebGLRenderer) {
    const half = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    this.rt = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: half ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: true,
      generateMipmaps: false,
    });
    const dt = new THREE.DepthTexture(2, 2);
    dt.minFilter = THREE.NearestFilter;
    dt.magFilter = THREE.NearestFilter;
    this.rt.depthTexture = dt;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.rt.texture },
        tDepth: { value: dt },
        uRes: { value: new THREE.Vector2(2, 2) },
        uDither: { value: 0.35 },
        uLevels: { value: 9 },
        uOutline: { value: 0.5 },
        uOutlineThresh: { value: 0.0022 },
        uMono: { value: 0 },
        uRamp0: { value: new THREE.Color() },
        uRamp1: { value: new THREE.Color() },
        uRamp2: { value: new THREE.Color() },
        uVignette: { value: 0.25 },
        uContrast: { value: 1 },
        uSaturation: { value: 1 },
        uLift: { value: new THREE.Vector3() },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
  }

  /** cssW/cssH: canvas CSS size. Returns the render-target size. */
  setSize(cssW: number, cssH: number, pixelSize: number): { w: number; h: number } {
    this.pixelSize = Math.max(1, pixelSize);
    const w = Math.max(2, Math.ceil(cssW / this.pixelSize));
    const h = Math.max(2, Math.ceil(cssH / this.pixelSize));
    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      this.rt.setSize(w, h);
      this.mat.uniforms.uRes.value.set(w, h);
    }
    return { w, h };
  }

  /** Outline sensitivity in world units of depth (ortho depth is linear: range = far - near). */
  setOutlineWorld(units: number, range: number): void {
    this.mat.uniforms.uOutlineThresh.value = units / range;
  }

  setParams(p: Palette, dither: number): void {
    const u = this.mat.uniforms;
    u.uDither.value = dither;
    u.uLevels.value = p.post.levels;
    u.uOutline.value = p.post.outline;
    u.uMono.value = p.post.mono;
    // ramp colours are authored as sRGB hex; shader works in sRGB space at that point -> use raw (non colour-managed) values
    for (let i = 0; i < 3; i++) {
      const hex = p.post.ramp[i];
      (u['uRamp' + i].value as THREE.Color).setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, THREE.LinearSRGBColorSpace);
    }
    u.uVignette.value = p.post.vignette;
    u.uContrast.value = p.post.contrast;
    u.uSaturation.value = p.post.saturation;
    (u.uLift.value as THREE.Vector3).set(...p.post.lift);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);
  }

  dispose(): void {
    this.rt.dispose();
    this.rt.depthTexture?.dispose();
    this.mat.dispose();
  }
}
