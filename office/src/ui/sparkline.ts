// Tiny pixel-style canvas chart. Logical resolution is low and the canvas is scaled up with
// image-rendering: pixelated, so lines stay chunky.
export interface Series { data: number[]; color: string; fill?: boolean }

export class Sparkline {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  constructor(public w = 96, public h = 24) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.canvas.className = 'spark';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
  }
  draw(series: Series[], grid: string, maxOverride?: number): void {
    const c = this.ctx; if (!c) return;
    const { w, h } = this;
    c.clearRect(0, 0, w, h);
    c.fillStyle = grid;
    for (let y = h - 1; y >= 0; y -= 6) c.fillRect(0, y, w, 1);
    let max = maxOverride ?? 0;
    if (maxOverride === undefined) for (const s of series) for (const v of s.data) if (v > max) max = v;
    if (max <= 0) max = 1;
    for (const s of series) {
      const n = s.data.length; if (n < 1) continue;
      c.fillStyle = s.color;
      let prevY = -1;
      for (let x = 0; x < w; x++) {
        const i = n === 1 ? 0 : Math.round((x / (w - 1)) * (n - 1));
        const y = Math.max(0, Math.min(h - 1, h - 1 - Math.round((s.data[i] / max) * (h - 2))));
        if (s.fill) { c.globalAlpha = 0.28; c.fillRect(x, y, 1, h - y); c.globalAlpha = 1; }
        c.fillRect(x, y, 1, 1);
        if (prevY >= 0 && Math.abs(y - prevY) > 1) { const a = Math.min(y, prevY), b = Math.max(y, prevY); c.fillRect(x, a, 1, b - a); }
        prevY = y;
      }
    }
  }
}
