// Activity log overlay: newest last, auto-scroll unless the user scrolled up. Key: L.
import { whoAndText } from './interact';
import type { LogEntry, SimState } from '../types';
import type { Panel, UICtx } from './ctx';
import { fmtClock, h, setText } from './dom';
import { hudWindow, type HudWin } from './hud';
import { KIND_LABEL } from './format';

const MAX_ROWS = 200;

export function createLog(ctx: UICtx): Panel & { win: HudWin } {
  const win = hudWindow(ctx, 'log', 'Activity', true, 'log-win');
  win.extras.append(h('span', { class: 'key-hint', title: 'Press L to toggle' }, 'L'));
  const list = h('div', { class: 'log', role: 'log', 'aria-live': 'off', tabIndex: 0 });
  const jump = h('button', { type: 'button', class: 'btn tiny log-jump', onClick: () => { list.scrollTop = list.scrollHeight; stick = true; jump.hidden = true; } }, 'Jump to latest');
  jump.hidden = true;
  win.body.append(list, jump);
  let stick = true;
  list.addEventListener('scroll', () => {
    stick = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
    jump.hidden = stick;
  });

  let lastEntry: LogEntry | null = null;
  const addRow = (e: LogEntry, names: Map<string, { name: string; provider: string }>): void => {
    const a = e.agentId ? names.get(e.agentId) : undefined;
    list.appendChild(h('div', { class: `log-row k-${e.kind}` },
      h('span', { class: 't' }, fmtClock(e.t)),
      h('span', { class: `kind k-${e.kind}` }, KIND_LABEL[e.kind] ?? e.kind.toUpperCase()),
      h('span', { class: 'msg' }, ...whoAndText(a, e.text))));
  };

  const update = (state: SimState): void => {
    const log = state.log;
    const last = log[log.length - 1] ?? null;
    if (last) win.setChip(`${fmtClock(last.t)} ${last.text}`.slice(0, 44)); else win.setChip('no activity yet');
    if (win.isMin()) return;
    if (last === lastEntry) return;
    const names = new Map(state.agents.map((a) => [a.id, { name: a.name, provider: a.provider }]));
    let from = 0;
    if (lastEntry) {
      const idx = log.lastIndexOf(lastEntry);
      if (idx >= 0) from = idx + 1;
      else { list.replaceChildren(); from = 0; }
    } else list.replaceChildren();
    for (let i = from; i < log.length; i++) addRow(log[i], names);
    while (list.children.length > MAX_ROWS) list.firstElementChild!.remove();
    lastEntry = last;
    if (stick) list.scrollTop = list.scrollHeight;
    void setText;
  };
  return { el: win.el, update, win };
}
