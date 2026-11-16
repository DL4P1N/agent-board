#!/usr/bin/env node
// The board's themes, in one place. Each theme is 11 base colours (the approved set: bg, panel, border, text, muted,
// accent, accentInk, ok, warn, bad, info); every other token (the raised and sunken surfaces, chips, fields, lines,
// soft fills, hovers, Review, mentions, toasts...) is derived from them by derive() below, the same way for every
// theme. Dusk, Day, Night and Terminal keep their hand-tuned values (the office demo's four palettes).
//
// This script writes the generated blocks into the pages that carry theme tokens, between "themes:start" and
// "themes:end" markers (CSS and JS), plus office/src/themes.ts:
//   node scripts/themes.mjs           rewrite them
//   node scripts/themes.mjs --check   exit 1 when a page is out of date, a base text colour is under 4.5:1
//                                     or an accent is within 30 degrees of hue of its theme's warn or bad
// The 3D room's palettes (office/src/scene/palettes.ts) are hand-made per theme, with the same ids.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- the themes, in the chooser's order (Auto comes last there and follows the OS: Dark or Light) ----
// light: the colour scheme (light themes get a light room, the light tool colours and darker person colours).
export const BASE = {
  dark: { name: 'Dark', bg: '#060607', panel: '#0c0d0f', border: '#2b2d33', text: '#e6e7ea', muted: '#9ea3ac', accent: '#7aa7ff', accentInk: '#0a1530', ok: '#6fd08c', warn: '#e6b450', bad: '#f2777a', info: '#66c4e3' },
  light: { name: 'Light', light: true, bg: '#f1f2f4', panel: '#ffffff', border: '#8b909a', text: '#1b1d21', muted: '#585d68', accent: '#2b5bcc', accentInk: '#ffffff', ok: '#1b6b37', warn: '#835600', bad: '#b2261e', info: '#08647f' },
  dusk: { name: 'Dusk' },
  day: { name: 'Day', light: true },
  night: { name: 'Night' },
  terminal: { name: 'Terminal' },
  contrast: { name: 'High Contrast', bg: '#000000', panel: '#0b0b0b', border: '#ffffff', text: '#ffffff', muted: '#d6d6d6', accent: '#ff70ff', accentInk: '#000000', ok: '#5cff9d', warn: '#ffe600', bad: '#ff7a7a', info: '#7cd0ff',
    // Lines as strong as the borders, and Review apart from both In progress and Done.
    over: { line: '#8a8a8a', 'line-strong': '#bdbdbd', 'field-line': '#ffffff', review: '#e0a8ff' } },
  paper: { name: 'Paper', light: true, bg: '#e9e4d8', panel: '#faf8f2', border: '#7d7464', text: '#1d1b18', muted: '#5a5448', accent: '#1d4ea3', accentInk: '#ffffff', ok: '#1b6a33', warn: '#7f5600', bad: '#ac2c26', info: '#0b6378' },
  synthwave: { name: 'Synthwave', bg: '#130824', panel: '#1e0e37', border: '#8a3fd1', text: '#fbeeff', muted: '#c0a3e0', accent: '#ff4fa8', accentInk: '#22001a', ok: '#4dffc6', warn: '#ffd45e', bad: '#ff6b5b', info: '#52dcff' },
  ocean: { name: 'Ocean', bg: '#04161f', panel: '#0a2230', border: '#1f5a73', text: '#e2f4f8', muted: '#94bccb', accent: '#ff8a65', accentInk: '#2a0d00', ok: '#5fe0b5', warn: '#ffe066', bad: '#ff7aa2', info: '#6fd3ff' },
  sticky: { name: 'Sticky Note', light: true, bg: '#ffe066', panel: '#fff7cc', border: '#c29012', text: '#2b1d05', muted: '#563f0c', accent: '#6b2bb5', accentInk: '#ffffff', ok: '#195c26', warn: '#683e00', bad: '#981226', info: '#0d4d8c' },
  coral: { name: 'Coral', light: true, bg: '#ffd3c2', panel: '#fff3ee', border: '#c25a3c', text: '#2e0f08', muted: '#6a3324', accent: '#6a32c9', accentInk: '#ffffff', ok: '#1b6430', warn: '#6e4300', bad: '#8f0f2a', info: '#124f8a' },
  candy: { name: 'Cotton Candy', light: true, accentSoft: 0.06, bg: '#e4efff', panel: '#fff4fa', border: '#8f78c9', text: '#2a1640', muted: '#5e4a7e', accent: '#c4127a', accentInk: '#ffffff', ok: '#126b3a', warn: '#865000', bad: '#b3261a', info: '#1a5bc0' },
  sunset: { name: 'Sunset', bg: '#1c0d14', panel: '#28131d', border: '#8a3b52', text: '#ffeee8', muted: '#d4a7ac', accent: '#ff80d0', accentInk: '#2a1000', ok: '#8fe0a0', warn: '#ffd166', bad: '#ff7d8c', info: '#80c8ff' },
  forest: { name: 'Forest', bg: '#0e1912', panel: '#15251a', border: '#43734b', text: '#e8f1e3', muted: '#a2baa0', accent: '#c9a7ff', accentInk: '#241600', ok: '#8edb8a', warn: '#f2b84b', bad: '#ff8070', info: '#7cc9e3' },
};
export const IDS = Object.keys(BASE);
export const AUTO = { dark: 'dark', light: 'light' }; // what Auto shows on a dark / light OS

// Dusk, Day, Night and Terminal: the hand-tuned board tokens (unchanged), plus the Boards page's --ok-soft.
const TOOLS_DARK = { 'tool-claude': '#d97757', 'tool-codex': '#2dd4bf', 'tool-copilot': '#a78bfa', 'tool-gemini': '#f472b6', 'tool-cursor': '#facc15', 'tool-other': '#9ca3af' };
const TOOLS_LIGHT = { 'tool-claude': '#a8492a', 'tool-codex': '#0b6e65', 'tool-copilot': '#6d3fd6', 'tool-gemini': '#c2185b', 'tool-cursor': '#7a5500', 'tool-other': '#52525b' };
const FIXED = {
  dusk: { ...TOOLS_DARK,
    bg: '#1b1530', sunken: '#201939', panel: '#241c40', raised: '#2b2249', chip: '#342a5a', field: '#130e24',
    ink: '#f1e9ff', muted: '#b0a2d2', line: '#44386c', 'line-strong': '#67589a', 'field-line': '#8e7fc6',
    border: '#5b4b8a', outline: '#0d0a1a', hi: 'rgba(255, 255, 255, .12)', lo: 'rgba(0, 0, 0, .35)',
    accent: '#ff9466', 'accent-hover': '#ffab88', 'accent-ink': '#2a1600', 'accent-soft': '#46344a', 'accent-line': '#9b6652',
    info: '#6ec1ff', review: '#5fd8c8',
    ok: '#7ee081', warn: '#ffe15c', 'warn-soft': '#3f3343', 'warn-line': '#8d7f40', stale: '#2f2540',
    bad: '#ff6b9a', 'bad-hover': '#ff8a96', 'bad-soft': '#432647', 'bad-line': '#93405a',
    mention: '#403545', 'mention-line': '#b39642', 'on-fill': '#1b1530',
    toast: '#2b2249', 'toast-ink': '#f1e9ff', scrim: 'rgba(8, 5, 18, .72)',
    pl: '74%', ps: '70%', dl: '62%', shade: '2px 2px 0 rgba(0, 0, 0, .35)', 'ok-soft': '#2b3a45' },
  day: { ...TOOLS_LIGHT,
    bg: '#efe4cf', sunken: '#f3e9d8', panel: '#fff7e8', raised: '#fffcf6', chip: '#efe3cc', field: '#fffaf0',
    ink: '#2c2114', muted: '#67563e', line: '#d4c2a2', 'line-strong': '#a68f69', 'field-line': '#7a5f3d',
    border: '#7a5f3d', outline: '#3a2a14', hi: 'rgba(255, 255, 255, .7)', lo: 'rgba(80, 50, 10, .16)',
    accent: '#9a4a14', 'accent-hover': '#823d0f', 'accent-ink': '#fff7e8', 'accent-soft': '#f7e2cb', 'accent-line': '#d29f75',
    info: '#135fa8', review: '#0b6b6e',
    ok: '#1a6e2d', warn: '#686000', 'warn-soft': '#f8e8c6', 'warn-line': '#d3ab5e', stale: '#fbefd8',
    bad: '#b42335', 'bad-hover': '#991c2c', 'bad-soft': '#f9e0dc', 'bad-line': '#e2a3a3',
    mention: '#fbecb8', 'mention-line': '#c49f35', 'on-fill': '#fff7e8',
    toast: '#fff7e8', 'toast-ink': '#2c2114', scrim: 'rgba(58, 42, 20, .45)',
    pl: '26%', ps: '60%', dl: '48%', shade: '1px 1px 0 rgba(255, 255, 255, .6)', 'ok-soft': '#e2efd9' },
  night: { ...TOOLS_DARK, 'tool-claude': '#e08566',
    bg: '#080c1a', sunken: '#0b1122', panel: '#0f1730', raised: '#152040', chip: '#1c2a50', field: '#060a16',
    ink: '#dce7ff', muted: '#9aaad6', line: '#26365f', 'line-strong': '#3d5290', 'field-line': '#6a80c0',
    border: '#31457f', outline: '#02040c', hi: 'rgba(160, 190, 255, .14)', lo: 'rgba(0, 0, 0, .45)',
    accent: '#ff9466', 'accent-hover': '#ffab88', 'accent-ink': '#2a1600', 'accent-soft': '#3a2c34', 'accent-line': '#9b6652',
    info: '#5cd6f0', review: '#c4a0ff',
    ok: '#5fe3a1', warn: '#f0dc50', 'warn-soft': '#2a2838', 'warn-line': '#7d7535', stale: '#141d38',
    bad: '#ff7aa6', 'bad-hover': '#ff97a8', 'bad-soft': '#341c38', 'bad-line': '#8a3a55',
    mention: '#2c2c45', 'mention-line': '#a8913f', 'on-fill': '#080c1a',
    toast: '#152040', 'toast-ink': '#dce7ff', scrim: 'rgba(2, 4, 12, .75)',
    pl: '76%', ps: '70%', dl: '62%', shade: '2px 2px 0 rgba(0, 0, 0, .45)', 'ok-soft': '#133238' },
  terminal: { 'tool-claude': '#ff9a6b', 'tool-codex': '#4de0ff', 'tool-copilot': '#c4a0ff', 'tool-gemini': '#ff7ac0', 'tool-cursor': '#f5ff6b', 'tool-other': '#9ab89f',
    bg: '#020a04', sunken: '#03100a', panel: '#04140a', raised: '#071c0e', chip: '#0b2814', field: '#010703',
    ink: '#a4ffb5', muted: '#5fc477', line: '#0f4a1f', 'line-strong': '#1d7a37', 'field-line': '#2fb352',
    border: '#1d9a3d', outline: '#000', hi: 'rgba(57, 255, 106, .16)', lo: 'rgba(0, 0, 0, .5)',
    // A cyan accent (an amber one read as the same colour as warn); In progress moves to a periwinkle blue beside it.
    accent: '#4de0ff', 'accent-hover': '#85eaff', 'accent-ink': '#001418', 'accent-soft': '#062a30', 'accent-line': '#1f7f8f',
    info: '#8ab4ff', review: '#e8fff0',
    ok: '#39ff6a', warn: '#e5ff4d', 'warn-soft': '#1c260a', 'warn-line': '#7a8a2a', stale: '#0a1d0e',
    bad: '#ff6b6b', 'bad-hover': '#ff8f8f', 'bad-soft': '#2e1010', 'bad-line': '#8a2a2a',
    mention: '#1c2a10', 'mention-line': '#9aa83a', 'on-fill': '#020a04',
    toast: '#071c0e', 'toast-ink': '#a4ffb5', scrim: 'rgba(0, 0, 0, .75)',
    pl: '72%', ps: '70%', dl: '58%', shade: '2px 2px 0 rgba(0, 0, 0, .5)', 'ok-soft': '#0d3519' },
};

// ---- colour helpers ----
const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** a mixed with b: t = 0 is a, t = 1 is b (sRGB, like color-mix(in srgb)). */
export const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const rgba = (h, a) => `rgba(${hex(h).join(', ')}, ${a})`;
export const lum = (h) => { const c = hex(h).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ---- the derivation table: every board token from the 11 base colours ----
// Surfaces step bg < sunken < panel < raised (dark: toward the text colour; light: toward white). Soft fills are the
// panel tinted with their colour; lines are the panel mixed toward the border. Review sits between In progress (info)
// and Done (ok). On a filled red button the text is the page colour (dark) or the panel (light).
export function derive(b) {
  const L = !!b.light;
  const t = {
    ...(L ? TOOLS_LIGHT : TOOLS_DARK),
    bg: b.bg,
    sunken: mix(b.bg, b.panel, L ? 0.25 : 0.45),
    panel: b.panel,
    raised: L ? mix(b.panel, '#ffffff', 0.5) : mix(b.panel, b.text, 0.05),
    chip: L ? mix(b.panel, b.border, 0.14) : mix(b.panel, b.text, 0.1),
    field: L ? mix(b.panel, '#ffffff', 0.6) : mix(b.bg, '#000000', 0.35),
    ink: b.text, muted: b.muted,
    line: mix(b.panel, b.border, L ? 0.4 : 0.6),
    'line-strong': L ? mix(b.panel, b.border, 0.8) : mix(b.border, b.muted, 0.25),
    'field-line': L ? mix(b.border, b.text, 0.35) : mix(b.border, b.muted, 0.55),
    border: b.border,
    outline: L ? mix(b.text, b.bg, 0.1) : mix(b.bg, '#000000', 0.55),
    hi: L ? 'rgba(255, 255, 255, .7)' : 'rgba(255, 255, 255, .12)',
    lo: L ? rgba(b.text, 0.16) : 'rgba(0, 0, 0, .4)',
    accent: b.accent,
    'accent-hover': L ? mix(b.accent, '#000000', 0.15) : mix(b.accent, '#ffffff', 0.18),
    'accent-ink': b.accentInk,
    'accent-soft': mix(b.panel, b.accent, b.accentSoft ?? (L ? 0.1 : 0.16)),
    'accent-line': mix(b.panel, b.accent, L ? 0.45 : 0.5),
    info: b.info,
    review: mix(b.info, b.ok, 0.5),
    ok: b.ok, warn: b.warn,
    'warn-soft': mix(b.panel, b.warn, L ? 0.12 : 0.14),
    'warn-line': mix(b.panel, b.warn, 0.45),
    stale: mix(b.panel, b.warn, L ? 0.06 : 0.07),
    bad: b.bad,
    'bad-hover': L ? mix(b.bad, '#000000', 0.15) : mix(b.bad, '#ffffff', 0.18),
    'bad-soft': mix(b.panel, b.bad, L ? 0.11 : 0.14),
    'bad-line': mix(b.panel, b.bad, L ? 0.4 : 0.45),
    mention: mix(b.panel, b.warn, 0.08),
    'mention-line': mix(b.panel, b.warn, 0.65),
    'on-fill': L ? b.panel : b.bg,
    toast: L ? b.panel : mix(b.panel, b.text, 0.05),
    'toast-ink': b.text,
    scrim: L ? rgba(b.text, 0.45) : rgba(mix(b.bg, '#000000', 0.5), 0.75),
    pl: L ? '26%' : '74%', ps: L ? '60%' : '70%', dl: L ? '48%' : '62%',
    shade: L ? '1px 1px 0 rgba(255, 255, 255, .6)' : '2px 2px 0 rgba(0, 0, 0, .4)',
    'ok-soft': mix(b.panel, b.ok, L ? 0.12 : 0.14),
  };
  return { ...t, ...(b.over || {}) };
}

/** Every theme's full board token map. */
export const TOKENS = Object.fromEntries(IDS.map((id) => [id, FIXED[id] || derive(BASE[id])]));
export const isLight = (id) => !!BASE[id]?.light;

// What each page carries (the Boards page and the presenters use a subset, under their own names).
const BOARD_KEYS = ['tool-claude', 'tool-codex', 'tool-copilot', 'tool-gemini', 'tool-cursor', 'tool-other', 'bg', 'sunken', 'panel', 'raised', 'chip', 'field', 'ink', 'muted', 'line', 'line-strong', 'field-line', 'border', 'outline', 'hi', 'lo', 'accent', 'accent-hover', 'accent-ink', 'accent-soft', 'accent-line', 'info', 'review', 'ok', 'warn', 'warn-soft', 'warn-line', 'stale', 'bad', 'bad-hover', 'bad-soft', 'bad-line', 'mention', 'mention-line', 'on-fill', 'toast', 'toast-ink', 'scrim', 'pl', 'ps', 'dl', 'shade'];
const BOARDS_KEYS = ['bg', 'sunken', 'panel', 'chip', 'field', 'ink', 'muted', 'line', 'line-strong', 'field-line', 'border', 'outline', 'hi', 'lo', 'accent', 'accent-hover', 'accent-ink', 'accent-soft', 'ok', 'ok-soft', 'bad', 'bad-hover', 'bad-soft', 'on-fill', 'toast', 'toast-ink', 'shade'];
// The presenters: --accent is the board's In progress blue (links, the progress bar), --mark the board's accent
// (what needs you), --line the panel border.
const presenterTokens = (id) => {
  const t = TOKENS[id];
  return { bg: t.bg, panel: t.panel, chip: t.chip, ink: t.ink, muted: t.muted, line: t.border, 'field-line': t['field-line'], outline: t.outline, hi: t.hi, lo: t.lo, shade: t.shade,
    accent: t.info, review: t.review, mark: t.accent, 'mark-ink': t['accent-ink'], 'accent-ink': t['on-fill'], ok: t.ok, warn: t.warn, 'warn-soft': t['warn-soft'], bad: t.bad, 'bad-soft': t['bad-soft'],
    pl: isLight(id) ? '28%' : t.pl, ps: t.ps };
};
const pick = (t, keys) => Object.fromEntries(keys.map((k) => [k, t[k]]));

// ---- writers ----
const decls = (map, ind) => {
  const parts = Object.entries(map).map(([k, v]) => `--${k}: ${v};`);
  const lines = [];
  for (let i = 0; i < parts.length; i += 6) lines.push(ind + parts.slice(i, i + 6).join(' '));
  return lines.join('\n');
};
// Light is the page default (Auto on a light OS) and Dark is Auto on a dark OS; every theme also answers to
// [data-tp="<id>"] so a preview (the chooser's tiles, the header swatch) can show it inside a page in another theme.
function cssBlocks(tokensOf, ind = '  ') {
  const scheme = (id) => `color-scheme: ${isLight(id) ? 'light' : 'dark'};`;
  const out = [];
  out.push(`${ind}:root, [data-tp="${AUTO.light}"] {\n${ind}  ${scheme(AUTO.light)}\n${decls(tokensOf(AUTO.light), ind + '  ')}\n${ind}}`);
  out.push(`${ind}@media (prefers-color-scheme: dark) {\n${ind}  :root:not([data-theme]) {\n${ind}    ${scheme(AUTO.dark)}\n${decls(tokensOf(AUTO.dark), ind + '    ')}\n${ind}  }\n${ind}}`);
  for (const id of IDS) {
    if (id === AUTO.light) continue;
    out.push(`${ind}:root[data-theme="${id}"], [data-tp="${id}"] {\n${ind}  ${scheme(id)}\n${decls(tokensOf(id), ind + '  ')}\n${ind}}`);
  }
  return out.join('\n');
}
const boardCss = () => cssBlocks((id) => pick(TOKENS[id], BOARD_KEYS))
  // The header swatch for Auto: Light and Dark, split on the diagonal.
  + `\n  .sw[data-tp="auto"] { background: linear-gradient(135deg, ${TOKENS[AUTO.light].panel} 50%, ${TOKENS[AUTO.dark].panel} 50%); }`;
const boardsCss = () => cssBlocks((id) => pick(TOKENS[id], BOARDS_KEYS));
const presenterCss = (ind) => cssBlocks(presenterTokens, ind);
// office/present.html: the page colour before the stylesheet loads.
const presentBg = () => [
  `html, body { margin: 0; background: ${TOKENS[AUTO.light].bg}; }`,
  `@media (prefers-color-scheme: dark) { html:not([data-theme]), html:not([data-theme]) body { background: ${TOKENS[AUTO.dark].bg}; } }`,
  ...IDS.map((id) => `html[data-theme="${id}"], html[data-theme="${id}"] body { background: ${TOKENS[id].bg}; }`),
].join('\n');
// The inline pre-paint scripts: id -> [name, page colour (the browser bar), 1 when light]. Order = the chooser's.
// Then the favicon: the logo (three agents, two in the accent behind one in the text colour, eyes cut out) on a tile
// in the theme's panel colour. themeIcon(id) puts it in the page's <link rel="icon" id="m-icon">; for Auto ('auto' or
// anything unknown) the icon itself follows the OS: Light, or Dark under prefers-color-scheme: dark.
export const iconColours = (id) => [TOKENS[id].accent, TOKENS[id].ink, TOKENS[id].panel];
const ICON_FN = [
  'window.themeIcon = function (t) {',
  "  var I = THEME_ICON, c = function (id) { return '.ma{fill:' + I[id][0] + '}.mi{fill:' + I[id][1] + '}.me{fill:' + I[id][2] + '}'; };",
  "  var h = function (k) { return \"<rect x='12' width='2.6' height='6' rx='1.3' class='\" + k + \"'/><circle cx='13.3' cy='1.6' r='2.4' class='ma'/><rect y='7' width='26' height='21' rx='8' class='\" + k + \"'/><rect x='6' y='14' width='4' height='7' rx='2' class='me'/><rect x='16' y='14' width='4' height='7' rx='2' class='me'/>\"; };",
  `  var css = Object.prototype.hasOwnProperty.call(I, t) ? c(t) : c('${AUTO.light}') + '@media (prefers-color-scheme:dark){' + c('${AUTO.dark}') + '}';`,
  "  var svg = \"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><style>\" + css + \"</style><rect class='me' width='32' height='32' rx='7'/><g transform='translate(2 2.4) scale(.875)'><g transform='translate(-.5 3.5) scale(.53)'>\" + h('ma') + \"</g><g transform='translate(18.7 3.5) scale(.53)'>\" + h('ma') + \"</g><g transform='translate(6.1 6.8) scale(.76)'>\" + h('mi') + '</g></g></svg>';",
  "  var l = document.getElementById('m-icon');",
  "  if (l) l.setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(svg));",
  '};',
];
const themesJs = (ind, lhs) => [
  `${ind}${lhs} = {\n${IDS.map((id) => `${ind}  ${id}: [${JSON.stringify(BASE[id].name)}, '${TOKENS[id].bg}'${isLight(id) ? ', 1' : ''}]`).join(',\n')}\n${ind}};`,
  `${ind}// The favicon's colours per theme: accent, text, panel.`,
  `${ind}var THEME_ICON = {\n${IDS.map((id) => `${ind}  ${id}: [${iconColours(id).map((c) => `'${c}'`).join(', ')}]`).join(',\n')}\n${ind}};`,
  ...ICON_FN.map((l) => ind + l),
].join('\n');
const themesTs = () => `// Generated by scripts/themes.mjs: edit the themes there, then run \`node scripts/themes.mjs\`.
// The board's themes, in the chooser's order: id -> display name, page colour (the browser bar), light or dark.
export const THEMES = {
${IDS.map((id) => `  ${id}: { name: ${JSON.stringify(BASE[id].name)}, bg: '${TOKENS[id].bg}', light: ${isLight(id)} },`).join('\n')}
} as const;
export type ThemeId = keyof typeof THEMES;
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
/** What Auto shows: Dark on a dark OS, Light on a light one. */
export const AUTO_THEME = { dark: '${AUTO.dark}', light: '${AUTO.light}' } as const satisfies Record<'dark' | 'light', ThemeId>;
/** A saved board-theme value as a theme id, or null for Auto (anything unknown). */
export const themeOf = (t: string | null | undefined): ThemeId | null => (t && Object.prototype.hasOwnProperty.call(THEMES, t) ? (t as ThemeId) : null);
`;

// [file, marker style, content]: CSS markers are /* themes:start */ ... /* themes:end */, JS ones // themes:start ...
const TARGETS = [
  ['public/index.html', 'css', () => boardCss()],
  ['public/index.html', 'js', () => themesJs('', 'window.THEMES')],
  ['public/boards.html', 'css', () => boardsCss()],
  ['public/boards.html', 'js', () => themesJs('  ', 'var THEMES')],
  ['public/present-classic.html', 'css', () => presenterCss('  ')],
  ['public/present-classic.html', 'js', () => themesJs('  ', 'var THEMES')],
  ['office/src/live/present.css', 'css', () => presenterCss('')],
  ['office/present.html', 'css', () => presentBg()],
  ['office/present.html', 'js', () => themesJs('  ', 'var THEMES')],
];
const MARK = { css: [/\/\* themes:start[^*]*\*\/\n/, '/* themes:end */'], js: [/\/\/ themes:start[^\n]*\n/, '// themes:end'] };

function render(src, style, body, file) {
  const [startRe, end] = MARK[style];
  const m = startRe.exec(src);
  if (!m) throw new Error(`${file}: no ${style} themes:start marker`);
  const from = m.index + m[0].length;
  const to = src.indexOf(end, from);
  if (to < 0) throw new Error(`${file}: no ${style} themes:end marker`);
  const lineStart = src.lastIndexOf('\n', to) + 1; // keep the end marker's own indentation
  return src.slice(0, from) + body + '\n' + src.slice(lineStart);
}

export function build() {
  const files = new Map();
  for (const [f, style, body] of TARGETS) {
    const p = path.join(ROOT, f);
    files.set(p, render(files.get(p) ?? fs.readFileSync(p, 'utf8'), style, body(), f));
  }
  files.set(path.join(ROOT, 'office/src/themes.ts'), themesTs());
  return files;
}

/** Base text colours under 4.5:1 on the surfaces they sit on, per theme (the page scan in the UI tests checks the rest). */
export function contrastProblems() {
  const out = [];
  for (const id of IDS) {
    const t = TOKENS[id];
    for (const f of ['ink', 'muted', 'accent', 'info', 'review', 'ok', 'warn', 'bad']) {
      for (const b of ['bg', 'sunken', 'panel', 'raised', 'chip', 'field']) { const r = ratio(t[f], t[b]); if (r < 4.5) out.push(`${id}: --${f} on --${b} ${r.toFixed(2)}`); }
    }
    for (const [f, b] of [['accent-ink', 'accent'], ['on-fill', 'bad'], ['warn', 'warn-soft'], ['bad', 'bad-soft'], ['toast-ink', 'toast'], ['ink', 'mention'], ['accent', 'mention'], ['ink', 'stale'], ['muted', 'stale'], ['accent', 'accent-soft']]) {
      const r = ratio(t[f], t[b]); if (r < 4.5) out.push(`${id}: --${f} on --${b} ${r.toFixed(2)}`);
    }
    // Field borders are controls: 3:1 against the field and the panel.
    for (const b of ['field', 'panel']) { const r = ratio(t['field-line'], t[b]); if (r < 3) out.push(`${id}: --field-line on --${b} ${r.toFixed(2)} (3:1)`); }
  }
  return out;
}

// ---- the accent stays apart from the status colours ----
// The accent means "needs you"; warn (amber) and bad (red) mean a state. Within 30 degrees of hue they read as the same
// thing, so every theme keeps its accent at least that far from both.
const hue = (h) => { const [r, g, b] = hex(h).map((v) => v / 255); const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); if (!d) return 0;
  const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };
const hueGap = (a, b) => { const x = Math.abs(hue(a) - hue(b)); return Math.min(x, 360 - x); };
export const ACCENT_GAP = 30;
/** Themes whose accent is within ACCENT_GAP degrees of hue of their warn or bad colour. */
export function accentClashes() {
  const out = [];
  for (const id of IDS) for (const k of ['warn', 'bad']) { const g = hueGap(TOKENS[id].accent, TOKENS[id][k]); if (g < ACCENT_GAP) out.push(`${id}: --accent ${Math.round(g)} deg from --${k}`); }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const [p, txt] of build()) {
    const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    if (cur === txt) continue;
    if (check) stale.push(path.relative(ROOT, p)); else fs.writeFileSync(p, txt);
  }
  const low = contrastProblems();
  if (low.length) console.log('Contrast under the minimum:\n  ' + low.join('\n  '));
  const clash = accentClashes();
  if (clash.length) console.log(`Accent within ${ACCENT_GAP} degrees of hue of a status colour:\n  ` + clash.join('\n  '));
  if (check && stale.length) console.log(`Out of date (run node scripts/themes.mjs): ${stale.join(', ')}`);
  else if (!check) console.log('Theme blocks written.');
  if (low.length || clash.length || stale.length) process.exitCode = 1;
}
