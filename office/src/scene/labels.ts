import { PROVIDERS, type ProviderId } from '../providers';
import type { SkillFn } from './skillLookup';

export interface FlightTagItem { key: string; text: string; color: string; x: number; y: number }

export interface LabelItem {
  id: string; name: string; provider: ProviderId; tier: string; model: string; owner: string; ownerColor: string;
  skills: string[]; phase: string; ticketId: string | null; status?: string | null; cost: number; burn: number; bubble: string | null;
  x: number; y: number; visible: boolean; selected: boolean;
}

const CSS = `
.ab-labels{position:absolute;inset:0;overflow:hidden;pointer-events:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace;-webkit-font-smoothing:none;}
.ab-tag{position:absolute;left:0;top:0;will-change:transform;display:none;}
.ab-tagin{transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:3px;}
.ab-card{background:rgba(18,14,32,.86);border:1px solid var(--pc);box-shadow:0 0 0 1px #000,2px 2px 0 rgba(0,0,0,.45);padding:2px 5px 3px;color:#f2ecff;font-size:9px;line-height:11px;font-weight:700;letter-spacing:.1px;white-space:nowrap;display:flex;flex-direction:column;gap:1px;min-width:0;}
.ab-card{pointer-events:auto;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;}
.ab-card.sel{box-shadow:0 0 0 1px #000,0 0 0 2px var(--pc),2px 3px 0 2px rgba(0,0,0,.5);background:rgba(26,20,46,.94);}
.ab-r{display:flex;align-items:center;gap:4px;}
.ab-dot{width:7px;height:7px;background:var(--pc);box-shadow:0 0 0 1px #000;flex:none;}
.ab-name{text-shadow:1px 1px 0 #000;}
.ab-tier{font-size:8px;line-height:9px;padding:0 3px;background:var(--tc);color:#10101c;box-shadow:0 0 0 1px #000;text-transform:uppercase;}
.ab-model{font-size:8px;color:#b9b0d8;font-weight:600;}
.ab-owner{font-size:8px;color:#e8e2ff;padding-left:4px;border-left:3px solid var(--oc);font-weight:600;}
.ab-skills{display:flex;gap:2px;}
.ab-sk{font-size:7px;line-height:9px;min-width:11px;text-align:center;padding:0 1px;color:#10101c;box-shadow:0 0 0 1px #000;font-weight:800;}
.ab-labels.compact .ab-card:not(.sel) .ab-r2,.ab-labels.compact .ab-card:not(.sel) .ab-skills{display:none !important;}
.ab-q{font-size:9px;line-height:9px;padding:0 3px;background:#ffd25a;color:#10141f;box-shadow:0 0 0 1px #000;font-weight:900;display:none;}
.ab-q.say{font-size:8px;line-height:9px;font-weight:800;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ab-q.bad{background:#ff8a8a;}
.ab-more{font-size:9px;color:#d8d0f0;font-weight:600;border-top:1px dashed rgba(255,255,255,.2);margin-top:1px;padding-top:2px;display:flex;flex-direction:column;gap:1px;}
.ab-cost{color:#ffd25a;}
.ab-tier:empty,.ab-model:empty{display:none;}
.ab-fl{position:absolute;left:0;top:0;will-change:transform;display:none;pointer-events:none;}
.ab-fli{transform:translate(-50%,-100%);font-size:9px;line-height:10px;font-weight:800;padding:0 4px 1px;background:#10141f;color:#fff;border:1px solid var(--fc);box-shadow:0 0 0 1px #000,2px 2px 0 rgba(0,0,0,.45);white-space:nowrap;text-shadow:1px 1px 0 #000;}
.ab-bub{max-width:190px;background:#fffbe8;color:#1c1830;border:2px solid #1c1830;padding:3px 6px;font-size:10px;line-height:12px;font-weight:700;white-space:normal;text-align:center;box-shadow:2px 2px 0 rgba(0,0,0,.4);position:relative;margin-bottom:3px;}
.ab-bub:after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-4px;border:4px solid transparent;border-top:5px solid #1c1830;}
`;

const TIER_COL: Record<string, string> = { haiku: '#7ee8a2', sonnet: '#7ab8ff', opus: '#c79bff', fable: '#ff9ad2', mini: '#7ee8d2', standard: '#9ad0ff', max: '#ffb87a' };
export function tierColor(t: string): string { return TIER_COL[t] ?? '#c8c8d8'; }
export function shortModel(m: string): string { return m.replace(/^claude-/, '').replace(/^gpt-/, 'gpt'); }
function fmtMoney(v: number): string { return '$' + (v >= 100 ? v.toFixed(0) : v.toFixed(2)); }

interface El {
  root: HTMLDivElement; card: HTMLDivElement; tier: HTMLSpanElement; name: HTMLSpanElement; q: HTMLSpanElement; model: HTMLSpanElement; owner: HTMLSpanElement;
  skills: HTMLDivElement; more: HTMLDivElement; l1: HTMLDivElement; l2: HTMLDivElement; bub: HTMLDivElement; inner: HTMLDivElement;
  key: { [k: string]: string }; lastT: string; seen: number;
  /** The tag's size (bubble and card), measured again only after its content changed; and this frame's place. */
  w: number; h: number; dirty: boolean; x: number; y: number; top: number;
}

const GAP = 2; // px between a tag and the one it moved above

export class LabelLayer {
  root: HTMLDivElement;
  private els = new Map<string, El>();
  private frame = 0;
  private compact = false;
  private fl = new Map<string, { root: HTMLDivElement; inner: HTMLDivElement; seen: number; t: string; txt: string; col: string }>();
  private flFrame = 0;
  private ro: ResizeObserver | null;
  /** `bindTag` wires an agent's name tag (a plain element, not a Tab stop) to the scene's own pick / camera handling. */
  constructor(host: HTMLElement, private bindTag: ((tag: HTMLElement, id: string) => void) | null = null) {
    if (!document.getElementById('ab-label-css')) {
      const style = document.createElement('style');
      style.id = 'ab-label-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    this.root = document.createElement('div');
    this.root.className = 'ab-labels';
    host.appendChild(this.root);
    // That scale follows the window: measure the tags again when the room's size changes.
    this.ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { for (const e of this.els.values()) e.dirty = true; });
    this.ro?.observe(this.root);
  }

  private make(id: string): El {
    const root = document.createElement('div'); root.className = 'ab-tag';
    const inner = document.createElement('div'); inner.className = 'ab-tagin';
    const bub = document.createElement('div'); bub.className = 'ab-bub'; bub.style.display = 'none';
    const card = document.createElement('div'); card.className = 'ab-card';
    const r1 = document.createElement('div'); r1.className = 'ab-r';
    const dot = document.createElement('span'); dot.className = 'ab-dot';
    const name = document.createElement('span'); name.className = 'ab-name';
    const tier = document.createElement('span'); tier.className = 'ab-tier';
    const q = document.createElement('span'); q.className = 'ab-q'; q.textContent = '?';
    r1.append(dot, name, tier, q);
    const r2 = document.createElement('div'); r2.className = 'ab-r ab-r2';
    const model = document.createElement('span'); model.className = 'ab-model';
    const owner = document.createElement('span'); owner.className = 'ab-owner';
    r2.append(model, owner);
    const skills = document.createElement('div'); skills.className = 'ab-skills';
    const more = document.createElement('div'); more.className = 'ab-more'; more.style.display = 'none';
    const l1 = document.createElement('div'); const l2 = document.createElement('div'); l2.className = 'ab-cost';
    more.append(l1, l2);
    card.append(r1, r2, skills, more);
    inner.append(bub, card);
    this.bindTag?.(card, id);
    root.appendChild(inner);
    this.root.appendChild(root);
    return { root, card, name, q, tier, model, owner, skills, more, l1, l2, bub, inner, key: {}, lastT: '', seen: 0, w: 0, h: 0, dirty: true, x: 0, y: 0, top: 0 };
  }

  private set(e: El, k: string, v: string, fn: () => void): void { if (e.key[k] !== v) { e.key[k] = v; e.dirty = true; fn(); } }
  private shown: El[] = [];

  /** Tags never cover each other: front tags (lower on screen) keep their place, a tag behind that would overlap one is
   *  lifted just above it. Sizes are cached, so a frame with no new words reads no layout; n is the agents on screen. */
  private place(): void {
    const v = this.shown;
    // On screen, as drawn: the board and the presenter scale the tags up (CSS), so not offsetWidth.
    for (const e of v) if (e.dirty) { const r = e.inner.getBoundingClientRect(); e.w = r.width; e.h = r.height; e.dirty = !e.w; }
    v.sort((a, b) => b.y - a.y);
    for (let i = 0; i < v.length; i++) {
      const a = v[i]; let bottom = a.y;
      // Only ever upward, above one tag at a time, so this ends (each placed tag is passed at most once).
      for (let moved = true; moved;) {
        moved = false;
        for (let j = 0; j < i; j++) {
          const b = v[j];
          if (Math.abs(a.x - b.x) * 2 < a.w + b.w && bottom > b.top && bottom - a.h < b.top + b.h) { bottom = b.top - GAP; moved = true; }
        }
      }
      a.top = bottom - a.h;
      const t = `translate3d(${a.x}px,${bottom}px,0)`;
      if (t !== a.lastT) { a.lastT = t; a.root.style.transform = t; }
    }
  }

  /** `fold`: the room is small on screen, so a speech bubble's words go into its agent's name tag (one box per agent,
   *  none stacked over a neighbour's); the bubble itself is drawn only when there's room for it. */
  update(items: LabelItem[], showLabels: boolean, showBubbles: boolean, compact = false, skillFn: SkillFn | null = null, fold = false): void {
    this.frame++;
    if (compact !== this.compact) { this.compact = compact; this.root.classList.toggle('compact', compact); for (const e of this.els.values()) e.dirty = true; }
    const shown = this.shown; shown.length = 0;
    for (const it of items) {
      let e = this.els.get(it.id);
      if (!e) { e = this.make(it.id); this.els.set(it.id, e); }
      e.seen = this.frame;
      const vis = it.visible && (showLabels || (showBubbles && !!it.bubble));
      if (!vis) { if (e.key.d !== '0') { e.key.d = '0'; e.root.style.display = 'none'; } continue; }
      if (e.key.d !== '1') { e.key.d = '1'; e.root.style.display = 'block'; e.dirty = true; }
      // In a small room the bubble's words ride in the tag (see `fold`), and that tag sits over its neighbours' tags.
      const say = fold && showLabels && showBubbles && it.bubble ? it.bubble : '';
      e.x = Math.round(it.x); e.y = Math.round(it.y);
      // The selected tag (drawn over the rest, and taller) stays at its agent; the others are placed after this loop.
      if (it.selected) { const t = `translate3d(${e.x}px,${e.y}px,0)`; if (t !== e.lastT) { e.lastT = t; e.root.style.transform = t; } }
      else shown.push(e);
      const z = String(Math.round(it.y) + (it.selected || say ? 1000 : 0));
      if (e.key.z !== z) { e.key.z = z; e.root.style.zIndex = z; } // not set(): the size stays
      this.set(e, 'cardv', showLabels ? '1' : '0', () => { e.card.style.display = showLabels ? 'flex' : 'none'; });
      if (showLabels) {
        const pc = PROVIDERS[it.provider]?.color ?? '#94a3b8';
        this.set(e, 'pc', pc, () => { e.card.style.setProperty('--pc', pc); });
        // The "?" badge only when no bubble says it already (the live office's bubble reads "Question"); in a small room
        // the badge carries the bubble's own words instead of a bubble above the tag.
        const hq = say ? 's' + (it.phase === 'blocked' ? 'b' : '') + say : (it.phase === 'asking_help' || it.phase === 'awaiting_help') && !(showBubbles && it.bubble) ? '?' : '';
        this.set(e, 'q', hq, () => {
          e.q.textContent = say || '?'; e.q.classList.toggle('say', !!say); e.q.classList.toggle('bad', !!say && it.phase === 'blocked');
          e.q.style.display = hq ? 'inline-block' : 'none';
        });
        this.set(e, 'name', it.name, () => { e.name.textContent = it.name; });
        const tc = tierColor(it.tier);
        this.set(e, 'tier', it.tier + tc, () => { e.tier.textContent = it.tier; e.tier.style.setProperty('--tc', tc); });
        const sm = shortModel(it.model);
        this.set(e, 'model', sm, () => { e.model.textContent = sm; });
        this.set(e, 'owner', it.owner + it.ownerColor, () => { e.owner.textContent = '@' + it.owner; e.owner.style.setProperty('--oc', it.ownerColor); });
        const sk = it.skills.join(',') + (skillFn ? it.skills.map((i2) => { const q = skillFn(i2); return q.color + q.glyph; }).join('') : '');
        this.set(e, 'skills', sk, () => {
          e.skills.textContent = '';
          for (const id of it.skills) {
            const s = skillFn ? skillFn(id) : { name: id, color: '#9aa4c0', glyph: id.slice(0, 2).toUpperCase() };
            const c = document.createElement('span'); c.className = 'ab-sk'; c.textContent = s.glyph; c.style.background = s.color; c.title = s.name;
            e.skills.appendChild(c);
          }
          e.skills.style.display = it.skills.length ? 'flex' : 'none';
        });
        this.set(e, 'sel', it.selected ? '1' : '0', () => { e.card.classList.toggle('sel', it.selected); e.more.style.display = it.selected ? 'flex' : 'none'; });
        if (it.selected) {
          // The live office passes the board's own status word (its Agents row's), so the tag never says something else.
          const l1 = it.status != null ? [it.ticketId, it.status].filter(Boolean).join(' · ') : `${it.ticketId ?? 'no task'} · ${it.phase.replace(/_/g, ' ')}`;
          this.set(e, 'l1', l1, () => { e.l1.textContent = l1; });
          // No cost line when nothing is known (the live office doesn't track spend): never a "$0.00".
          const paid = it.cost > 0.005 || it.burn > 0.005;
          this.set(e, 'l2', paid ? fmtMoney(it.cost) + '|' + (it.burn > 0.005 ? it.burn.toFixed(2) : '') : '-', () => { e.l2.style.display = paid ? '' : 'none'; e.l2.textContent = paid ? fmtMoney(it.cost) + (it.burn > 0.005 ? `  $${it.burn.toFixed(2)}/min` : '') : ''; });
        }
      }
      const bt = showBubbles && it.bubble && !(fold && showLabels) ? it.bubble : '';
      this.set(e, 'bub', bt, () => { e.bub.textContent = bt; e.bub.style.display = bt ? 'block' : 'none'; });
    }
    for (const [id, e] of this.els) {
      if (e.seen !== this.frame) { e.root.parentNode?.removeChild(e.root); this.els.delete(id); }
    }
    this.place();
  }

  /** Pooled DOM tags following paper airplanes (screen-space css px). */
  updateFlights(tags: FlightTagItem[]): void {
    this.flFrame++;
    for (const t of tags) {
      let e = this.fl.get(t.key);
      if (!e) {
        const root = document.createElement('div'); root.className = 'ab-fl';
        const inner = document.createElement('div'); inner.className = 'ab-fli';
        root.appendChild(inner); this.root.appendChild(root);
        e = { root, inner, seen: 0, t: '', txt: '', col: '' };
        e.root.style.display = 'block';
        this.fl.set(t.key, e);
      }
      e.seen = this.flFrame;
      const tr = `translate3d(${Math.round(t.x)}px,${Math.round(t.y)}px,0)`;
      if (tr !== e.t) { e.t = tr; e.root.style.transform = tr; e.root.style.zIndex = '2000'; }
      if (e.txt !== t.text) { e.txt = t.text; e.inner.textContent = t.text; }
      if (e.col !== t.color) { e.col = t.color; e.inner.style.setProperty('--fc', t.color); }
    }
    for (const [k, e] of this.fl) if (e.seen !== this.flFrame) { e.root.parentNode?.removeChild(e.root); this.fl.delete(k); }
  }

  dispose(): void { this.ro?.disconnect(); this.root.parentNode?.removeChild(this.root); }
}
