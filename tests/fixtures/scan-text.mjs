// Shared by the UI suites (tests/ui/palette-theme.mjs): see scanText below.
// Contrast of every visible text node on the page, against the background it is drawn on (the first opaque
// background up the tree, with translucent ones composited over it; over the 3D room, the page colour). Run it with
// page.evaluate(scanText). Skips disabled controls (WCAG exempts them) and the room's name tags (fixed colours on
// their own dark cards). Returns { n, min, fails: ['ratio "text" fg on bg (selector)'] } for anything under `min`.
export function scanText(minRatio = 4.5) {
  const num = (c) => {
    if (!c || c === 'transparent') return [0, 0, 0, 0];
    const m = c.match(/-?[\d.]+(e-?\d+)?/g).map(Number);
    if (c.startsWith('color(')) return [m[0] * 255, m[1] * 255, m[2] * 255, m[3] ?? 1];
    return [m[0], m[1], m[2], m[3] ?? 1];
  };
  const over = (top, under) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1); };
  const L = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pageBg = num(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() ? (() => { const p = document.createElement('i'); p.style.color = 'var(--bg)'; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; })() : 'rgb(255,255,255)');
  const bgOf = (el) => {
    const layers = []; let op = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      op *= Number(cs.opacity);
      if (e.id === 'office-scene') break;
      if (cs.backgroundImage !== 'none' && !/^url/.test(cs.backgroundImage)) return { unknown: true };
      const c = num(cs.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let bg = pageBg; for (const l of layers.reverse()) bg = over(l, bg);
    return { bg, op };
  };
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set(); const fails = []; let n = 0, min = 99;
  for (let t; (t = walk.nextNode());) {
    const el = t.parentElement;
    if (!el || seen.has(el) || !t.textContent.trim()) continue;
    seen.add(el);
    if (el.closest('script, style, noscript, option, .ab-labels, [aria-hidden="true"] .vh') || el.closest(':disabled, [aria-disabled="true"]')) continue;
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const b = bgOf(el); if (b.unknown) continue;
    let fg = num(getComputedStyle(el).color);
    fg = over([fg[0], fg[1], fg[2], fg[3] * b.op], b.bg);
    const ratio = cr(fg, b.bg); n++; min = Math.min(min, ratio);
    if (ratio < minRatio) {
      const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + ' < ' + (el.parentElement?.className || el.parentElement?.tagName || '');
      fails.push(`${ratio.toFixed(2)} "${t.textContent.trim().slice(0, 30)}" rgb(${fg.slice(0, 3).map(Math.round)}) on rgb(${b.bg.slice(0, 3).map(Math.round)}) (${sel})`);
    }
  }
  return { n, min, fails };
}
