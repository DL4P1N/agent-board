// Tiny DOM helpers shared by every UI panel. No framework: elements are built once and then
// diffed in place (setText / setAttr / toggleClass) so slider drags never lose focus.
import { icon } from './icons';

export type Child = Node | string | number | null | undefined | false;
export type Props = {
  class?: string;
  style?: string;
  dataset?: Record<string, string>;
  [key: string]: unknown;
};

const PROP_KEYS = new Set(['value', 'checked', 'disabled', 'hidden', 'selected', 'htmlFor', 'textContent', 'title', 'id', 'type', 'min', 'max', 'step', 'readOnly', 'tabIndex', 'name', 'placeholder', 'rows', 'open']);

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k === 'dataset') Object.assign(el.dataset, v as Record<string, string>);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (PROP_KEYS.has(k)) (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: Element): void { while (el.firstChild) el.removeChild(el.firstChild); }

/** Diffed text update. */
export function setText(el: Element, s: string): void { if (el.textContent !== s) el.textContent = s; }
export function setAttr(el: Element, name: string, v: string | null): void {
  if (v === null) { if (el.hasAttribute(name)) el.removeAttribute(name); }
  else if (el.getAttribute(name) !== v) el.setAttribute(name, v);
}
export function setStyle(el: HTMLElement, prop: string, v: string): void {
  if (el.style.getPropertyValue(prop) !== v) el.style.setProperty(prop, v);
}
export function toggleClass(el: Element, cls: string, on: boolean): void { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }
export function setHidden(el: HTMLElement, hidden: boolean): void { if (el.hidden !== hidden) el.hidden = hidden; }

export const pct = (v: number, d = 0): string => `${(v * 100).toFixed(d)}%`;
export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export const DIFF_COLORS = ['', '#4ade80', '#a3e635', '#fbbf24', '#fb923c', '#e879f9'];
export const DIFF_NAMES = ['', 'trivial', 'easy', 'medium', 'hard', 'epic'];

/** 5-pip difficulty indicator; pips 1..d are lit in the difficulty colour. */
export function pips(d: number): HTMLElement {
  const el = h('span', { class: 'pips', role: 'img' });
  for (let i = 1; i <= 5; i++) el.appendChild(h('i'));
  setPips(el, d);
  return el;
}
export function setPips(el: HTMLElement, d: number): void {
  const di = Math.round(clamp(d, 0, 5));
  if (el.dataset.d === String(di)) return;
  el.dataset.d = String(di);
  el.setAttribute('aria-label', `difficulty ${di} of 5`);
  el.style.setProperty('--pip', DIFF_COLORS[di] || 'transparent');
  const kids = el.children;
  for (let i = 0; i < kids.length; i++) toggleClass(kids[i], 'on', i < di);
}

// ---------------------------------------------------------------------------------------------
// Sliders

let uid = 0;
export const nextId = (p: string): string => `${p}-${++uid}`;

export interface SliderOpts {
  label: string;
  min: number; max: number; step: number;
  value: number;
  def: number;
  fmt?: (v: number) => string;
  unit?: string;
  hint?: string;
  /** map slider position <-> value for non-linear sliders (position domain is min..max) */
  toPos?: (v: number) => number;
  fromPos?: (p: number) => number;
  onInput: (v: number) => void;
  idPrefix?: string;
}
export interface SliderRow {
  el: HTMLElement;
  input: HTMLInputElement;
  set(v: number): void;
  get(): number;
  setFormat(fmt: (v: number) => string): void;
}

export function sliderRow(o: SliderOpts): SliderRow {
  const id = nextId(o.idPrefix ?? 'sl');
  const toPos = o.toPos ?? ((v: number) => v);
  const fromPos = o.fromPos ?? ((p: number) => p);
  let fmt = o.fmt ?? ((v: number) => String(+v.toFixed(2)));
  let cur = o.value;
  let dragging = false;

  const out = h('output', { class: 'sl-val', htmlFor: id });
  const reset = h('button', { class: 'sl-reset', type: 'button', title: `Reset ${o.label} to default`, 'aria-label': `Reset ${o.label} to default` }, icon('undo'));
  const input = h('input', { id, type: 'range', min: String(o.min), max: String(o.max), step: String(o.step), title: o.hint ?? '' }) as HTMLInputElement;
  const label = h('label', { class: 'sl-label', htmlFor: id, title: (o.hint ? o.hint + ' ' : '') + '(double-click to reset)' }, o.label);
  const el = h('div', { class: 'sl-row' }, h('div', { class: 'sl-head' }, label, out, reset), input);

  const paint = (): void => {
    const pos = toPos(cur);
    const p = (pos - o.min) / (o.max - o.min || 1);
    input.style.setProperty('--p', `${(clamp(p, 0, 1) * 100).toFixed(1)}%`);
    const t = fmt(cur) + (o.unit ? ` ${o.unit}` : '');
    setText(out, t);
    setAttr(input, 'aria-valuetext', t);
    toggleClass(el, 'changed', Math.abs(cur - o.def) > 1e-9);
    if (!dragging && input.valueAsNumber !== pos) input.value = String(pos);
  };
  const doReset = (): void => { cur = o.def; paint(); o.onInput(cur); };

  input.addEventListener('pointerdown', () => { dragging = true; });
  const end = (): void => { dragging = false; };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  input.addEventListener('blur', end);
  input.addEventListener('input', () => {
    cur = fromPos(input.valueAsNumber);
    paint();
    o.onInput(cur);
  });
  label.addEventListener('dblclick', doReset);
  reset.addEventListener('click', doReset);
  paint();

  return {
    el, input,
    set(v: number) { if (dragging || v === cur) return; cur = v; paint(); },
    get: () => cur,
    setFormat(f) { fmt = f; paint(); },
  };
}

// ---------------------------------------------------------------------------------------------
// Switch / segmented / select

export interface SwitchRow { el: HTMLElement; input: HTMLInputElement; set(v: boolean): void }
export function switchRow(label: string, value: boolean, onChange: (v: boolean) => void, hint?: string, idPrefix = 'sw'): SwitchRow {
  const id = nextId(idPrefix);
  const input = h('input', { id, type: 'checkbox', role: 'switch', class: 'sw-input' }) as HTMLInputElement;
  input.checked = value;
  const el = h('div', { class: 'sw-row', title: hint ?? '' },
    h('label', { class: 'sw-label', htmlFor: id }, label),
    h('span', { class: 'sw-wrap' }, input, h('span', { class: 'sw-track', 'aria-hidden': 'true' }, h('i'))));
  input.addEventListener('change', () => onChange(input.checked));
  return { el, input, set(v) { if (input.checked !== v) input.checked = v; } };
}

export interface Segmented<T extends string> { el: HTMLElement; set(v: T): void; buttons: Record<string, HTMLButtonElement> }
export function segmented<T extends string>(items: { value: T; label: string; title?: string }[], value: T, onChange: (v: T) => void, ariaLabel: string): Segmented<T> {
  const buttons: Record<string, HTMLButtonElement> = {};
  const el = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': ariaLabel });
  const set = (v: T): void => {
    for (const it of items) {
      const b = buttons[it.value];
      toggleClass(b, 'on', it.value === v);
      setAttr(b, 'aria-checked', String(it.value === v));
    }
  };
  for (const it of items) {
    const b = h('button', { type: 'button', role: 'radio', title: it.title ?? it.label, onClick: () => { set(it.value); onChange(it.value); } }, it.label);
    buttons[it.value] = b;
    el.appendChild(b);
  }
  set(value);
  return { el, set, buttons };
}

export interface SelectRow { el: HTMLElement; select: HTMLSelectElement; set(v: string): void }
export function selectRow(label: string, options: { value: string; label: string; group?: string }[], value: string, onChange: (v: string) => void, idPrefix = 'se'): SelectRow {
  const id = nextId(idPrefix);
  const select = h('select', { id, class: 'sel' }) as HTMLSelectElement;
  fillSelect(select, options);
  select.value = value;
  select.addEventListener('change', () => onChange(select.value));
  const el = h('div', { class: 'se-row' }, h('label', { class: 'se-label', htmlFor: id }, label), select);
  return { el, select, set(v) { if (select.value !== v && document.activeElement !== select) select.value = v; } };
}
export function fillSelect(select: HTMLSelectElement, options: { value: string; label: string; group?: string }[]): void {
  clear(select);
  const groups = new Map<string, HTMLElement>();
  for (const o of options) {
    const opt = h('option', { value: o.value }, o.label);
    if (o.group) {
      let g = groups.get(o.group);
      if (!g) { g = h('optgroup', { label: o.group }); groups.set(o.group, g); select.appendChild(g); }
      g.appendChild(opt);
    } else select.appendChild(opt);
  }
}

// ---------------------------------------------------------------------------------------------
// Collapsible section

export interface Section { el: HTMLElement; body: HTMLElement; setOpen(o: boolean): void }
export function section(title: string, desc: string | null, open: boolean, onToggle: (open: boolean) => void, ...body: Child[]): Section {
  const bodyEl = h('div', { class: 'sec-body' }, desc ? h('p', { class: 'sec-desc' }, desc) : null, ...body);
  const btn = h('button', { class: 'sec-head', type: 'button', 'aria-expanded': String(open) },
    h('span', { class: 'sec-chev', 'aria-hidden': 'true' }, icon('chev')), h('span', { class: 'sec-title' }, title));
  const el = h('section', { class: 'sec' }, btn, bodyEl);
  const setOpen = (o: boolean): void => {
    toggleClass(el, 'open', o);
    btn.setAttribute('aria-expanded', String(o));
    bodyEl.hidden = !o;
  };
  btn.addEventListener('click', () => { const o = !el.classList.contains('open'); setOpen(o); onToggle(o); });
  setOpen(open);
  return { el, body: bodyEl, setOpen };
}

// ---------------------------------------------------------------------------------------------
// Clipboard

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = h('textarea', { style: 'position:fixed;opacity:0;left:-999px' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

export function flash(btn: HTMLElement, text: string, ms = 1400): void {
  const prev = btn.dataset.label ?? btn.textContent ?? '';
  btn.dataset.label = prev;
  btn.textContent = text;
  btn.classList.add('flashed');
  window.setTimeout(() => { btn.textContent = prev; btn.classList.remove('flashed'); }, ms);
}
