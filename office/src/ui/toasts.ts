// Rate-limited toasts (max 3 visible).
import { h } from './dom';
import { iconSvg } from './icons';

export type ToastTone = 'ok' | 'bad' | 'info' | 'warn' | 'gold';

export class Toasts {
  readonly el = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  private lastByKey = new Map<string, number>();
  private lastAny = 0;

  push(key: string, title: string, text: string, tone: ToastTone, minGapMs = 1800, star = false): void {
    const now = performance.now();
    if (now - (this.lastByKey.get(key) ?? -1e9) < minGapMs) return;
    if (now - this.lastAny < 350) return;
    this.lastByKey.set(key, now); this.lastAny = now;
    const star_ = star ? h('span', { class: 'toast-star', 'aria-hidden': 'true' }) : null;
    if (star_) star_.innerHTML = iconSvg('star');
    const t = h('div', { class: `toast ${tone}` }, star_, h('div', {}, h('b', {}, title), h('span', {}, text)));
    this.el.appendChild(t);
    while (this.el.children.length > 3) this.el.firstElementChild!.remove();
    window.setTimeout(() => { t.classList.add('out'); window.setTimeout(() => t.remove(), 350); }, 3600);
  }
}
