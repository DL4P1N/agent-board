// Creates the WebGL office only when it is first shown. Until then nothing 3D exists: three.js and the scene code
// are a separate chunk (dynamic import), so the board view never downloads them or touches the GPU.
// Same surface the UI uses on OfficeScene; calls made before the scene exists are remembered and replayed.
import type { SimState, VisualSettings } from '../types';
import type { OfficeScene } from './OfficeScene';

export class LazyScene {
  private scene: OfficeScene | null = null;
  private loading: Promise<OfficeScene | null> | null = null;
  private visual: VisualSettings;
  private selected: string | null = null;
  private pickCb: ((id: string | null) => void) | null = null;
  private onReady: (() => void) | null = null;

  constructor(private host: HTMLElement, visual: VisualSettings) { this.visual = { ...visual }; }

  /** True once the WebGL scene exists. */
  get ready(): boolean { return this.scene !== null; }

  /** Start creating the scene (idempotent). Resolves to null if WebGL could not start. */
  ensure(): Promise<OfficeScene | null> {
    if (this.scene) return Promise.resolve(this.scene);
    this.loading ??= import('./OfficeScene').then(({ OfficeScene }) => {
      const s = new OfficeScene(this.host, { ...this.visual });
      if (this.pickCb) s.onPick(this.pickCb);
      s.selectAgent(this.selected);
      this.scene = s;
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => s.resize()).observe(this.host);
      this.onReady?.();
      return s;
    }).catch((err) => {
      console.error('3D office failed to start', err);
      this.loading = null;
      return null;
    });
    return this.loading;
  }
  /** Called once when the scene has been created (e.g. to hide a loading note). */
  whenReady(cb: () => void): void { this.onReady = cb; if (this.scene) cb(); }

  update(state: SimState, dt: number): void { this.scene?.update(state, dt); }
  setVisual(v: VisualSettings): void { this.visual = { ...v }; this.scene?.setVisual(v); }
  selectAgent(id: string | null): void { this.selected = id; this.scene?.selectAgent(id); }
  onPick(cb: (id: string | null) => void): void { this.pickCb = cb; this.scene?.onPick(cb); }
  resize(): void { this.scene?.resize(); }
}
