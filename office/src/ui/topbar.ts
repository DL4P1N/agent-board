// TOP BAR: product, room code + invite popover, connection pill, speed readout, pause, palette switcher.
import type { SimState, VisualSettings } from '../types';
import type { Panel, UICtx } from './ctx';
import { copyText, fmtClock, flash, h, setAttr, setText, toggleClass } from './dom';
import { icon } from './icons';

export const ROOM_CODE = 'PIXEL-7FK2';
export const INVITE_TEXT = `Join the Agent Board room ${ROOM_CODE}: run "npx agent-board join ${ROOM_CODE}" and follow the prompts. Works with Claude Code, Codex, GitHub Copilot, Gemini CLI, Cursor or any MCP tool.`;

const PALETTES: { id: VisualSettings['palette']; label: string }[] = [
  { id: 'dusk', label: 'Dusk' }, { id: 'day', label: 'Day' }, { id: 'night', label: 'Night' }, { id: 'terminal', label: 'Terminal' },
];

export function createTopbar(ctx: UICtx, actions: { about(): void; togglePanels(): void; resetLayout(): void }): Panel {
  const logo = h('div', { class: 'brand' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, icon('orchestrator')), h('span', { class: 'brand-name' }, 'Agent Board'));

  const copyRoom = h('button', { type: 'button', class: 'btn tiny', title: 'Copy room code', 'aria-label': 'Copy room code', onClick: async () => { flash(copyRoom, (await copyText(ROOM_CODE)) ? 'Copied' : 'Press Ctrl+C'); } }, 'Copy');
  const room = h('div', { class: 'room-chip', title: 'Shared room code (mock)' }, h('span', { class: 'dim' }, 'ROOM'), h('code', {}, ROOM_CODE), copyRoom);

  // invite popover
  const copyInvite = h('button', { type: 'button', class: 'btn', onClick: async () => { flash(copyInvite, (await copyText(INVITE_TEXT)) ? 'Copied' : 'Select + copy'); } }, 'Copy prompt');
  const pop = h('div', { class: 'popover', id: 'invite-pop', role: 'dialog', 'aria-label': 'Invite teammates' },
    h('div', { class: 'pop-head' }, h('b', {}, 'Invite with one prompt'), h('span', { class: 'chip warn', title: 'Nothing is actually listening yet' }, 'MOCK')),
    h('p', { class: 'note' }, 'Paste this into your coding agent (Claude Code, Codex, Copilot, Gemini CLI, Cursor or any MCP tool) on any machine to bring that person\'s agents into this room:'),
    h('pre', { class: 'invite-text', tabIndex: 0 }, INVITE_TEXT),
    h('div', { class: 'btn-row' }, copyInvite),
    h('p', { class: 'note' }, 'Demo only: the command does not exist yet and no agent will actually connect.'));
  pop.hidden = true;
  const inviteBtn = h('button', { type: 'button', class: 'btn accent', 'aria-expanded': 'false', 'aria-controls': 'invite-pop' }, icon('link'), h('span', { class: 'lbl' }, ' Invite'));
  const setPop = (open: boolean): void => { pop.hidden = !open; inviteBtn.setAttribute('aria-expanded', String(open)); };
  inviteBtn.addEventListener('click', (e) => { e.stopPropagation(); setPop(pop.hidden); });
  document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target as Node)) setPop(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { setPop(false); inviteBtn.focus(); e.stopImmediatePropagation(); } }, true);
  const inviteWrap = h('div', { class: 'invite-wrap' }, inviteBtn, pop);

  const conn = h('div', { class: 'conn', title: 'Live presence in this room (mock)' }, h('i', { class: 'live-dot' }), h('span', { class: 'conn-text' }));
  const connText = conn.querySelector('.conn-text') as HTMLElement;
  const speed = h('div', { class: 'speed', title: 'Simulated time and speed' }, h('span', { class: 'sim-clock' }), h('b', { class: 'sim-mult' }));
  const clockEl = speed.querySelector('.sim-clock') as HTMLElement;
  const multEl = speed.querySelector('.sim-mult') as HTMLElement;
  const pause = h('button', { type: 'button', class: 'btn icon-btn', title: 'Pause / resume (Space)', onClick: () => ctx.togglePause() });
  const slower = h('button', { type: 'button', class: 'btn icon-btn tiny', title: 'Slower ( [ )', 'aria-label': 'Slower', onClick: () => ctx.bumpSpeed(-1) }, '-');
  const faster = h('button', { type: 'button', class: 'btn icon-btn tiny', title: 'Faster ( ] )', 'aria-label': 'Faster', onClick: () => ctx.bumpSpeed(1) }, '+');

  const swatches = h('div', { class: 'palettes', role: 'radiogroup', 'aria-label': 'Colour palette' },
    ...PALETTES.map((p) => h('button', { type: 'button', role: 'radio', class: `pal pal-${p.id}`, title: `${p.label} palette`, 'aria-label': `${p.label} palette`, 'aria-checked': 'false', onClick: () => ctx.setVisual({ palette: p.id }) })));
  const panelsBtn = h('button', { type: 'button', class: 'btn icon-btn', title: 'Hide / show all panels (P)', 'aria-label': 'Toggle panels', onClick: () => actions.togglePanels() }, icon('panels'));
  const resetBtn = h('button', { type: 'button', class: 'btn icon-btn', title: 'Reset layout: panel and window positions (Shift+R)', 'aria-label': 'Reset layout', onClick: () => actions.resetLayout() }, icon('undo'));
  const helpBtn = h('button', { type: 'button', class: 'btn icon-btn', title: 'About this demo', 'aria-label': 'About this demo', onClick: () => actions.about() }, icon('help'));

  // main view switch: the 3D office or the technical board (V)
  const viewBtn = (v: 'office' | 'board', ico: 'users' | 'panels', label: string, title: string): HTMLButtonElement =>
    h('button', { type: 'button', role: 'radio', title, 'aria-label': label, 'aria-checked': 'false', onClick: () => ctx.setView(v) }, icon(ico), h('span', { class: 'lbl' }, label));
  const viewOffice = viewBtn('office', 'users', '3D office', 'The 3D pixel office (V switches)');
  const viewBoard = viewBtn('board', 'panels', 'Board', 'Technical board: stats, tickets, activity and costs, no 3D (V switches)');
  const viewSeg = h('div', { class: 'seg view-seg', role: 'radiogroup', 'aria-label': 'View' }, viewOffice, viewBoard);

  const el = h('header', { class: 'topbar' }, logo, viewSeg, room, inviteWrap, h('span', { class: 'grow' }), conn, speed, h('div', { class: 'speed-ctl' }, slower, pause, faster), swatches, panelsBtn, resetBtn, helpBtn);

  let lastPaused: boolean | null = null, lastPal = '', lastView = '';
  const update = (state: SimState): void => {
    if (lastView !== ctx.view) {
      lastView = ctx.view;
      for (const [b, v] of [[viewOffice, 'office'], [viewBoard, 'board']] as const) { toggleClass(b, 'on', ctx.view === v); b.setAttribute('aria-checked', String(ctx.view === v)); }
    }
    const online = state.agents.filter((a) => a.phase !== 'offline');
    const humans = new Set(online.map((a) => a.owner)).size;
    setText(connText, `${online.length} agents - ${humans} humans online`);
    setText(clockEl, `sim ${fmtClock(state.time)}`);
    const sp = ctx.sim.settings.simSpeed;
    setText(multEl, sp === 0 ? 'PAUSED' : `${sp}x`);
    toggleClass(speed, 'paused', sp === 0);
    if ((sp === 0) !== lastPaused) { lastPaused = sp === 0; pause.replaceChildren(icon(sp === 0 ? 'play' : 'pause')); setAttr(pause, 'aria-label', sp === 0 ? 'Resume' : 'Pause'); }
    if (lastPal !== ctx.visual.palette) {
      lastPal = ctx.visual.palette;
      swatches.querySelectorAll('button').forEach((b, i) => { const on = PALETTES[i].id === lastPal; toggleClass(b, 'on', on); b.setAttribute('aria-checked', String(on)); });
    }
  };
  return { el, update };
}
