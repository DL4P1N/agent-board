// BOARD VIEW: the default, technical view of the room (V or the top-bar switch toggles the 3D office).
// Reading order: deadline verdict and key numbers, "What needs you" (act on it right there), who is doing what
// (per person), the tasks (columns or a sortable table), then activity, help requests and costs.
// The agents dock, the task editor drawer, comms and the hackathon window are shared with the 3D office.
import type { AgentState, LogEntry, SimState, Ticket } from '../types';
import type { Panel, UICtx } from './ctx';
import { clamp, fmtClock, h, pips, segmented, setHidden, setText, toggleClass } from './dom';
import { icon } from './icons';
import { setSkillChips } from './chips';
import { KIND_LABEL, STATUS_LABEL, phaseInfo, usd } from './format';
import { stack, tierColor } from './metrics';
import { snippet, whoAndText } from './interact';
import { modelLabel } from './models';
import { attentionItems, outlook, type AttnItem } from './attention';
import { PROVIDERS, PROVIDER_IDS } from '../providers';
import './techView.css';

const COLS: { id: string; title: string; statuses: Ticket['status'][] }[] = [
  { id: 'backlog', title: 'To do', statuses: ['backlog'] },
  { id: 'progress', title: 'In progress', statuses: ['assigned', 'in_progress'] },
  { id: 'review', title: 'In review', statuses: ['in_review'] },
  { id: 'changes', title: 'Sent back', statuses: ['changes_requested'] },
  { id: 'merged', title: 'Done', statuses: ['merged'] },
];
const STATUS_TONE: Record<string, string> = {
  backlog: 'mute', assigned: 'info', in_progress: 'info', in_review: 'violet', changes_requested: 'warn', merged: 'ok', cancelled: 'mute',
};
const STATUS_ORDER: Record<string, number> = { changes_requested: 0, in_review: 1, in_progress: 2, assigned: 3, backlog: 4, merged: 5, cancelled: 6 };
const ACT_FILTERS: { id: string; label: string; kinds: LogEntry['kind'][] | null }[] = [
  { id: 'all', label: 'Everything', kinds: null },
  { id: 'ship', label: 'Merges and reviews', kinds: ['merge', 'review', 'reject'] },
  { id: 'trouble', label: 'Problems', kinds: ['block', 'reject', 'help', 'cost'] },
  { id: 'tickets', label: 'Tasks and plan', kinds: ['ticket', 'plan'] },
  { id: 'talk', label: 'Chat and help', kinds: ['chat', 'help'] },
];
const COL_LIMIT = 40;
const ACT_ROWS = 150;
const ATTN_SHOWN = 5;

type SortKey = 'id' | 'title' | 'status' | 'diff' | 'who' | 'progress' | 'cost' | 'ratio';

interface Tile { el: HTMLElement; v: HTMLElement; sub: HTMLElement; bar: HTMLElement | null; fill: HTMLElement | null }
function tile(label: string, title: string, withBar = false, cls = ''): Tile {
  const v = h('b', { class: 'tv-tile-v' });
  const sub = h('span', { class: 'tv-tile-sub' });
  const fill = withBar ? h('i', {}) : null;
  const bar = withBar ? h('span', { class: 'bar thin' }, fill) : null;
  const el = h('div', { class: `tv-tile ${cls}`.trim(), title }, h('span', { class: 'tv-tile-l' }, label), v, sub, bar);
  return { el, v, sub, bar, fill };
}

function panel(id: string, title: string, cls: string, ...extras: (Node | null)[]): { el: HTMLElement; body: HTMLElement; count: HTMLElement; head: HTMLElement } {
  const count = h('span', { class: 'tv-count' });
  const body = h('div', { class: 'tv-body' });
  const head = h('h2', { class: 'tv-title', tabIndex: -1 }, title);
  const el = h('section', { class: `tv-panel ${cls}`, id, 'aria-labelledby': `${id}-h` },
    h('header', { class: 'tv-h' }, head, count, h('span', { class: 'grow' }), ...extras), body);
  head.id = `${id}-h`;
  return { el, body, count, head };
}

const ratioOf = (t: Ticket): number => { const est = t.estimatedCostUsd ?? 0; return est > 0 ? (t.usage?.costUsd ?? 0) / est : 0; };
const plural = (n: number, w: string): string => `${n} ${w}${n === 1 ? '' : 's'}`;

export function createTechView(ctx: UICtx): Panel {
  // ---------------------------------------------------------------- intro (first visit)
  const intro = h('div', { class: 'tv-intro', role: 'note' },
    h('span', { class: 'chip warn' }, 'Demo'),
    h('span', {}, 'This is a simulated Agent Board: the agents, tasks and costs are made up so you can try the layout.'),
    h('span', { class: 'grow' }),
    h('button', { type: 'button', class: 'btn tiny', onClick: () => ctx.openAbout() }, 'What am I looking at?'),
    h('button', { type: 'button', class: 'btn tiny', onClick: () => { ctx.prefs.introSeen = true; ctx.savePrefs(); intro.remove(); } }, 'Got it'));
  if (ctx.prefs.introSeen) intro.remove();

  // ---------------------------------------------------------------- tiles
  const tOutlook = tile('Deadline', 'Will the remaining work fit in the time left? Compares the orchestrator\'s estimate with the clock.', false, 'tv-outlook');
  const tScope = tile('Done', 'Merged tasks out of the planned scope', true);
  const tActive = tile('Working', 'Tasks being implemented right now, and how busy the agents are');
  const tReview = tile('In review', 'Pull requests waiting for the Integrator, and how many were sent back');
  const tHelp = tile('Questions', 'Open help requests between agents');
  const tSpend = tile('Spent (est.)', 'Estimated spend so far against the budget', true);
  const tBurn = tile('Burn rate', 'Current spend rate and the average cost of one merged task');
  const tTools = tile('Tools', 'Which coding-agent tools the connected agents run');
  const stats = h('div', { class: 'tv-stats', role: 'group', 'aria-label': 'Key numbers' }, ...[tOutlook, tScope, tActive, tReview, tHelp, tSpend, tBurn, tTools].map((t) => t.el));

  // ---------------------------------------------------------------- what needs you
  const attn = panel('tv-attn', 'What needs you', 'tv-attn');
  const attnList = h('ul', { class: 'tv-attn-list' });
  const attnMore = h('button', { type: 'button', class: 'btn tiny tv-attn-more', onClick: () => { attnAll = !attnAll; attnSig = STALE; refresh(); } });
  const attnLive = h('div', { class: 'vh', role: 'status', 'aria-live': 'polite' });
  attn.body.append(attnList, attnMore, attnLive);
  let attnAll = false;

  // ---------------------------------------------------------------- who's doing what
  let ownerFilter = '';
  const people = panel('tv-people', "Who's doing what", 'tv-people');
  const peopleList = h('ul', { class: 'tv-people-list' });
  people.body.appendChild(peopleList);

  // ---------------------------------------------------------------- tasks
  let q = '';
  let scope: 'open' | 'all' | 'done' = 'open';
  let sortKey: SortKey = 'status', sortDir: 1 | -1 = 1;
  const search = h('input', { type: 'search', class: 'sel tv-q', placeholder: 'Filter tasks...', 'aria-label': 'Filter tasks', onInput: () => { q = search.value.trim().toLowerCase(); sig = ''; refresh(); } }) as HTMLInputElement;
  const scopeSeg = segmented<'open' | 'all' | 'done'>([
    { value: 'open', label: 'Open', title: 'Hide done and cancelled tasks' },
    { value: 'all', label: 'All' }, { value: 'done', label: 'Done', title: 'Done and cancelled only' },
  ], scope, (v) => { scope = v; sig = ''; refresh(); }, 'Which tasks');
  scopeSeg.el.classList.add('tv-seg');
  const modeSeg = segmented<'columns' | 'table'>([
    { value: 'columns', label: 'Columns', title: 'One column per status' },
    { value: 'table', label: 'Table', title: 'One sortable row per task' },
  ], ctx.prefs.techTickets, (v) => { ctx.prefs.techTickets = v; ctx.savePrefs(); sig = ''; syncMode(); refresh(); }, 'Task layout');
  modeSeg.el.classList.add('tv-seg');
  const newBtn = h('button', { type: 'button', class: 'btn tiny accent', title: 'Create a task', onClick: () => ctx.openNewTicket() }, icon('plus'), ' New task');
  const ownerChip = h('button', { type: 'button', class: 'chip info tv-owner-chip', title: 'Show everyone\'s tasks again', onClick: () => { ownerFilter = ''; sig = ''; peopleSig = STALE; refresh(); } });
  const tk = panel('tv-tickets', 'Tasks', 'tv-tickets', ownerChip, search, scopeSeg.el, modeSeg.el, newBtn);

  const colEls = COLS.map((c) => {
    const count = h('span', { class: 'col-count' });
    const list = h('div', { class: 'tv-col-list', role: 'list', 'aria-label': c.title });
    const more = h('div', { class: 'tv-more' });
    const el = h('div', { class: `tv-col col-${c.id}` }, h('div', { class: 'col-head' }, h('span', {}, c.title), count), list, more);
    return { ...c, el, count, list, more };
  });
  const columns = h('div', { class: 'tv-cols', 'aria-describedby': 'tv-cols-hint' }, ...colEls.map((c) => c.el));
  const colsHint = h('p', { class: 'vh', id: 'tv-cols-hint' }, 'Arrow keys move between tasks and columns. Enter opens a task.');
  // roving focus: one Tab stop for the whole board, arrows move inside it
  columns.addEventListener('keydown', (e) => {
    const card = (e.target as HTMLElement).closest('.tv-card') as HTMLElement | null;
    if (!card) return;
    const ci = colEls.findIndex((c) => c.list.contains(card));
    const list = Array.from(colEls[ci].list.children) as HTMLElement[];
    const i = list.indexOf(card);
    let next: HTMLElement | undefined;
    if (e.key === 'ArrowDown') next = list[i + 1];
    else if (e.key === 'ArrowUp') next = list[i - 1];
    else if (e.key === 'Home') next = list[0];
    else if (e.key === 'End') next = list[list.length - 1];
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const step = e.key === 'ArrowRight' ? 1 : -1;
      for (let j = ci + step; j >= 0 && j < colEls.length; j += step) { const c = colEls[j].list.children; if (c.length) { next = c[Math.min(i, c.length - 1)] as HTMLElement; break; } }
    } else return;
    e.preventDefault();
    if (next) { focusCard(next); }
  });
  let focusedCard = '';
  const focusCard = (el: HTMLElement): void => { columns.querySelectorAll<HTMLElement>('.tv-card').forEach((c) => { c.tabIndex = c === el ? 0 : -1; }); focusedCard = el.dataset.id ?? ''; el.focus(); };

  const th = (key: SortKey, label: string, cls = ''): HTMLElement => {
    const b = h('button', { type: 'button', class: 'tv-sort', dataset: { key }, onClick: () => { if (sortKey === key) sortDir = sortDir === 1 ? -1 : 1; else { sortKey = key; sortDir = 1; } sig = ''; refresh(); } }, label);
    return h('th', { scope: 'col', class: cls }, b);
  };
  const tbody = h('tbody', {});
  const table = h('div', { class: 'tv-table-wrap' }, h('table', { class: 'tv-table' },
    h('caption', { class: 'vh' }, 'Tasks. Column headers sort; Enter on a row opens the task.'),
    h('thead', {}, h('tr', {}, th('id', 'ID'), th('title', 'Title', 'w-title'), th('status', 'Status'), th('diff', 'Difficulty'), th('who', 'Agent'),
      th('progress', 'Progress'), th('cost', 'Cost / estimate'), th('ratio', 'vs estimate'), h('th', { scope: 'col' }, 'Skills'))),
    tbody));
  const empty = h('p', { class: 'note tv-empty' });
  tk.body.append(colsHint, columns, table, empty);
  const syncMode = (): void => {
    const tableMode = ctx.prefs.techTickets === 'table';
    setHidden(columns, tableMode); setHidden(table, !tableMode); setHidden(scopeSeg.el, !tableMode);
    modeSeg.set(ctx.prefs.techTickets);
  };
  syncMode();

  // ---------------------------------------------------------------- activity
  let actFilter = ACT_FILTERS[0];
  const actSel = h('select', { class: 'sel tv-act-sel', 'aria-label': 'Show activity', onChange: () => { actFilter = ACT_FILTERS.find((f) => f.id === actSel.value) ?? ACT_FILTERS[0]; lastLog = null; refresh(); } },
    ...ACT_FILTERS.map((f) => h('option', { value: f.id }, f.label))) as HTMLSelectElement;
  const act = panel('tv-act', 'Activity', 'tv-act', actSel);
  const actList = h('ol', { class: 'tv-act-list', reversed: true });
  act.body.appendChild(actList);

  // ---------------------------------------------------------------- costs
  const cost = panel('tv-costs', 'Costs (est.)', 'tv-costs');
  const byTier = stack(), byProv = stack();
  const kvs: Record<string, HTMLElement> = {};
  const kv = (k: string, label: string, title: string): HTMLElement => { const v = h('b', {}); kvs[k] = v; return h('div', { class: 'kv', title }, h('span', {}, label), v); };
  cost.body.append(
    h('div', { class: 'tv-sub' }, 'By model'), byTier.el,
    h('div', { class: 'tv-sub' }, 'By tool'), byProv.el,
    h('div', { class: 'tv-kvs' },
      kv('total', 'Total', 'All agents, including orchestration'), kv('orch', 'Orchestration', 'Orchestrator and Integrator overhead'),
      kv('waste', 'Rework waste', 'Spend on attempts that got sent back'), kv('perMerge', 'Per merged task', 'Average'),
      kv('projected', 'Projected for the scope', 'Forecast to finish all scope'), kv('budget', 'Budget', 'Set in Controls, 0 = unlimited')),
    h('p', { class: 'note' }, 'Illustrative prices, not real billing.'));

  // ---------------------------------------------------------------- help
  const help = panel('tv-help', 'Help between agents', 'tv-help');
  const helpList = h('ul', { class: 'tv-help-list' });
  help.body.appendChild(helpList);

  const main = h('div', { class: 'tv-main' }, attn.el, people.el, tk.el);
  const side = h('div', { class: 'tv-side' }, act.el, help.el, cost.el);
  const el = h('main', { class: 'tech', id: 'tech', 'aria-label': 'Board' }, intro, stats, h('div', { class: 'tv-grid' }, main, side));

  // ---------------------------------------------------------------- helpers
  const agentBtn = (a: AgentState | undefined, fallback = 'nobody yet'): HTMLElement => a
    ? h('button', { type: 'button', class: `tv-who${a.id === ctx.selectedId ? ' on' : ''}`, title: `${a.name} (${a.owner}): ${PROVIDERS[a.provider]?.name ?? a.provider}, ${a.config.model}. Click to inspect`,
        onClick: (e: Event) => { e.stopPropagation(); ctx.select(a.id === ctx.selectedId ? null : a.id); } },
      h('i', { class: `pdot ${a.provider}`, 'aria-hidden': 'true' }), h('b', {}, a.name), h('span', { class: `tier ${a.provider}` }, modelLabel(a.config)))
    : h('span', { class: 'dim tv-who none' }, fallback);

  const rowSig = (t: Ticket, a: AgentState | undefined): string =>
    [t.status, t.title, t.difficulty, Math.round(t.progress * 100), (t.usage?.costUsd ?? 0).toFixed(2), t.reworks, t.pinnedTo, t.helpRequests, (t.skills ?? []).join(','),
      a ? `${a.id}${a.config.model}${(a.skills ?? []).join(',')}` : '', a?.id === ctx.selectedId].join('|');
  const chipsFor = (t: Ticket): (HTMLElement | null)[] => [
    t.pinnedTo ? h('span', { class: 'tk-pin', title: `Pinned to ${ctx.agent(t.pinnedTo)?.name ?? t.pinnedTo}` }, icon('pin')) : null,
    t.reworks ? h('span', { class: 'chip bad', title: 'The Integrator sent it back for changes' }, `Sent back ×${t.reworks}`) : null,
    t.helpRequests ? h('span', { class: 'chip warn', title: 'Help requests raised while working on it' }, plural(t.helpRequests, 'question')) : null,
  ];

  const cardCache = new Map<string, { el: HTMLElement; sig: string }>();
  const card = (t: Ticket, a: AgentState | undefined): HTMLElement => {
    const s = rowSig(t, a);
    const hit = cardCache.get(t.id);
    if (hit && hit.sig === s) return hit.el;
    const r = ratioOf(t);
    const act = t.usage?.costUsd ?? 0;
    const pct = Math.round(clamp(t.status === 'merged' ? 1 : t.progress, 0, 1) * 100);
    const bar = h('i', {}); bar.style.width = `${pct}%`;
    const skills = h('span', { class: 'skill-row' }); setSkillChips(skills, t.skills, a ? a.skills : null);
    const node = h('div', { class: `tv-card${a && a.id === ctx.selectedId ? ' mine' : ''}${t.status === 'merged' ? ' done' : ''}`, role: 'listitem', tabIndex: -1, dataset: { id: t.id },
      'aria-label': `${t.id}: ${t.title}. ${STATUS_LABEL[t.status]}${a ? `, ${a.name}` : ''}${t.status === 'in_progress' ? `, ${pct}% done` : ''}`,
      title: `${t.id} ${t.title}\n${t.epic}${t.description ? `\n\n${t.description}` : ''}`,
      onClick: () => ctx.openTicket(t.id), onFocus: () => { focusedCard = t.id; },
      onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.openTicket(t.id); } } },
      h('span', { class: 'tv-card-top' }, h('b', { class: 'tk-id' }, t.id), pips(t.difficulty), ...chipsFor(t), h('span', { class: 'grow' }),
        h('span', { class: `cost${r > 1.6 ? ' bad' : r > 1.2 ? ' warn' : ''}`, title: act > 0 ? 'Spent so far / estimate' : 'Estimate' }, act > 0 ? `${usd(act)} / ${usd(t.estimatedCostUsd)}` : `~${usd(t.estimatedCostUsd)}`)),
      h('span', { class: 'tv-card-title' }, t.title),
      h('span', { class: 'tv-card-foot' }, agentBtn(a, t.status === 'backlog' ? 'not claimed yet' : '-'), skills),
      t.status === 'merged' || t.status === 'backlog' ? null : h('span', { class: 'bar thin' }, bar));
    cardCache.set(t.id, { el: node, sig: s });
    return node;
  };

  const rowCache = new Map<string, { el: HTMLElement; sig: string }>();
  const row = (t: Ticket, a: AgentState | undefined): HTMLElement => {
    const s = rowSig(t, a);
    const hit = rowCache.get(t.id);
    if (hit && hit.sig === s) return hit.el;
    const r = ratioOf(t);
    const act = t.usage?.costUsd ?? 0;
    const pct = Math.round(clamp(t.status === 'merged' ? 1 : t.progress, 0, 1) * 100);
    const bar = h('i', {}); bar.style.width = `${pct}%`;
    const skills = h('span', { class: 'skill-row' }); setSkillChips(skills, t.skills, a ? a.skills : null);
    const node = h('tr', { class: `${a && a.id === ctx.selectedId ? 'mine' : ''}${t.status === 'merged' || t.status === 'cancelled' ? ' done' : ''}`, tabIndex: 0, title: 'Click or press Enter to edit',
      onClick: () => ctx.openTicket(t.id), onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); ctx.openTicket(t.id); } } },
      h('td', {}, h('b', { class: 'tk-id' }, t.id)),
      h('td', { class: 'w-title' }, h('span', { class: 'tv-ell' }, t.title), ...chipsFor(t)),
      h('td', {}, h('span', { class: `chip ${STATUS_TONE[t.status] ?? 'mute'}` }, STATUS_LABEL[t.status] ?? t.status)),
      h('td', {}, pips(t.difficulty)),
      h('td', {}, agentBtn(a, '-')),
      h('td', { class: 'num' }, h('span', { class: 'tv-prog' }, h('span', { class: 'bar thin' }, bar), `${pct}%`)),
      h('td', { class: 'num' }, act > 0 ? usd(act) : '-', h('span', { class: 'dim' }, ` / ${usd(t.estimatedCostUsd)}`)),
      h('td', { class: `num cost${r > 1.6 ? ' bad' : r > 1.2 ? ' warn' : ''}` }, act > 0 ? `${r.toFixed(1)}x` : '-'),
      h('td', {}, skills));
    rowCache.set(t.id, { el: node, sig: s });
    return node;
  };

  const place = (parent: HTMLElement, nodes: HTMLElement[]): void => {
    nodes.forEach((n, i) => { if (parent.children[i] !== n) parent.insertBefore(n, parent.children[i] ?? null); });
    while (parent.children.length > nodes.length) parent.lastElementChild!.remove();
  };

  const matches = (t: Ticket, byId: Map<string, AgentState>): boolean => {
    const a = t.assignee ? byId.get(t.assignee) : undefined;
    if (ownerFilter && a?.owner !== ownerFilter) return false;
    if (!q) return true;
    return `${t.id} ${t.title} ${t.epic} ${t.description ?? ''} ${a?.name ?? ''} ${a?.owner ?? ''} ${(t.skills ?? []).join(' ')}`.toLowerCase().includes(q);
  };

  const sortVal = (t: Ticket, byId: Map<string, AgentState>): string | number => {
    switch (sortKey) {
      case 'id': return Number(t.id.replace(/\D/g, '')) || 0;
      case 'title': return t.title.toLowerCase();
      case 'status': return STATUS_ORDER[t.status] ?? 9;
      case 'diff': return t.difficulty;
      case 'who': return t.assignee ? (byId.get(t.assignee)?.name ?? '~').toLowerCase() : '~';
      case 'progress': return t.status === 'merged' ? 1 : t.progress;
      case 'cost': return t.usage?.costUsd ?? 0;
      case 'ratio': return ratioOf(t);
    }
  };

  // keyed "what needs you" rows, so a half-typed reply survives updates
  const attnRows = new Map<string, { li: HTMLElement; text: HTMLElement; acts: HTMLElement; actSig: string; input: HTMLInputElement | null }>();
  const attnRow = (it: AttnItem, lead: boolean): HTMLElement => {
    let r = attnRows.get(it.key);
    if (!r) {
      const text = h('p', { class: 'tv-attn-text' });
      const acts = h('div', { class: 'tv-attn-acts' });
      let input: HTMLInputElement | null = null;
      const li = h('li', { class: 'tv-attn-i' }, h('i', { class: 'tv-flag', 'aria-hidden': 'true' }), h('div', { class: 'tv-attn-main' }, text, acts));
      if (it.reply) {
        const to = it.reply.to;
        input = h('input', { type: 'text', class: 'sel tv-reply', placeholder: it.reply.placeholder, 'aria-label': it.reply.placeholder }) as HTMLInputElement;
        const sent = h('span', { class: 'tv-sent', role: 'status' });
        const send = (): void => { const v = input!.value.trim(); if (!v) { input!.focus(); return; } ctx.cmd.say?.(to, v); input!.value = ''; setText(sent, 'Sent'); window.setTimeout(() => setText(sent, ''), 2500); ctx.refresh(); };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
        (li.lastElementChild as HTMLElement).appendChild(h('form', { class: 'tv-reply-row', onSubmit: (e: Event) => { e.preventDefault(); send(); } }, input, h('button', { type: 'submit', class: 'btn tiny' }, 'Send'), sent));
      }
      r = { li, text, acts, actSig: '', input };
      attnRows.set(it.key, r);
    }
    r.li.className = `tv-attn-i ${it.tone}${lead ? ' lead' : ''}`;
    setText(r.text, it.text);
    const aSig = it.actions.map((a) => a.label).join('|');
    if (aSig !== r.actSig) {
      r.actSig = aSig;
      r.acts.replaceChildren(...it.actions.map((a) => h('button', { type: 'button', class: `btn tiny${a.primary ? ' accent' : ''}`, onClick: () => a.run() }, a.label)));
    } else {
      // keep the handlers pointing at the latest closures
      Array.from(r.acts.children).forEach((b, i) => { (b as HTMLButtonElement).onclick = () => it.actions[i]?.run(); });
    }
    return r.li;
  };

  // ---------------------------------------------------------------- update
  let sig = '';
  let lastLog: LogEntry | null = null;
  const STALE = '<stale>'; // never equals a real signature, so the next update always redraws (including "nothing to show")
  let attnSig = STALE, helpSig = STALE, peopleSig = STALE, lastSel: string | null = null;
  let seenAttn = new Set<string>();
  let lastState: SimState | null = null;
  const refresh = (): void => { if (lastState) update(lastState, true); };

  const update = (state: SimState, force = false): void => {
    lastState = state;
    if (ctx.view !== 'board') return;
    const m = state.metrics;
    const byId = new Map(state.agents.map((a) => [a.id, a]));
    const workers = state.agents.filter((a) => a.role === 'worker');
    if (lastSel !== ctx.selectedId) { lastSel = ctx.selectedId; sig = ''; helpSig = STALE; peopleSig = STALE; }

    // tiles
    const o = outlook(state);
    setText(tOutlook.v, o.label); setText(tOutlook.sub, o.detail);
    tOutlook.el.className = `tv-tile tv-outlook ${o.tone}`;
    const total = Math.max(state.plan.totalTickets, m.merged);
    setText(tScope.v, `${m.merged} of ${total}`); setText(tScope.sub, `${Math.round(m.scopeDone * 100)}% of the scope`);
    tScope.fill!.style.width = `${Math.round(clamp(m.scopeDone, 0, 1) * 100)}%`;
    const inProg = state.tickets.filter((t) => t.status === 'in_progress' || t.status === 'assigned').length;
    const online = workers.filter((a) => a.phase !== 'offline');
    setText(tActive.v, String(inProg)); setText(tActive.sub, `${online.filter((a) => a.phase !== 'idle').length} of ${online.length} agents active`);
    setText(tReview.v, String(m.inReview)); setText(tReview.sub, `${m.rejected} sent back so far`);
    setText(tHelp.v, String(m.helpOpen)); setText(tHelp.sub, `${m.helpTotal} asked in total`);
    toggleClass(tHelp.el, 'warn', m.helpOpen > 0);
    setText(tSpend.v, usd(m.totalCostUsd));
    const budget = ctx.sim.settings.budgetUsd ?? 0;
    setText(tSpend.sub, budget > 0 ? `${Math.round(m.budgetUsedPct)}% of ${usd(budget)}` : 'no budget set');
    tSpend.fill!.style.width = `${Math.round(clamp(m.budgetUsedPct / 100, 0, 1) * 100)}%`;
    tSpend.bar!.className = `bar thin budget${m.budgetUsedPct >= 100 ? ' over' : m.budgetUsedPct >= 80 ? ' warn' : ''}`;
    toggleClass(tSpend.el, 'bad', budget > 0 && m.budgetUsedPct >= 100);
    setText(tBurn.v, `${usd(m.burnUsdPerMin)}/min`); setText(tBurn.sub, m.avgCostPerMergedUsd > 0 ? `${usd(m.avgCostPerMergedUsd)} per merged task` : 'no merges yet');
    const byTool = PROVIDER_IDS.map((id) => [id, online.filter((a) => a.provider === id).length] as const).filter(([, n]) => n > 0);
    setText(tTools.v, String(byTool.length)); setText(tTools.sub, byTool.map(([id, n]) => `${n} ${PROVIDERS[id].short}`).join(', ') || 'no agents online');

    // what needs you
    const items = attentionItems(ctx, state);
    const aSig = items.map((i) => i.key + i.text + i.actions.map((a) => a.label).join()).join('\n') + attnAll;
    if (aSig !== attnSig || force) {
      attnSig = aSig;
      setText(attn.count, items.length ? `${items.length}` : '');
      toggleClass(attn.el, 'calm', !items.length);
      const shown = attnAll ? items : items.slice(0, ATTN_SHOWN);
      const busy = online.filter((a) => a.role === 'worker' && a.phase !== 'idle').length;
      if (shown.length) place(attnList, shown.map((it, i) => attnRow(it, i === 0)));
      else attnList.replaceChildren(h('li', { class: 'tv-attn-i ok lead' }, h('i', { class: 'tv-flag', 'aria-hidden': 'true' }),
        h('div', { class: 'tv-attn-main' }, h('p', { class: 'tv-attn-text' }, o.verdict === 'done' ? `Nothing needs you right now. ${o.label}: ${o.detail}.` : `Nothing needs you right now. ${busy ? `${plural(busy, 'agent')} on tasks` : 'Agents are getting started'}; deadline: ${o.verdict === 'estimating' ? 'estimate coming' : o.label.toLowerCase()}.`))));
      for (const k of attnRows.keys()) if (!items.some((i) => i.key === k)) attnRows.delete(k);
      setText(attnMore, attnAll ? 'Show fewer' : `Show all ${items.length}`);
      setHidden(attnMore, items.length <= ATTN_SHOWN);
      // read out only what is new (a re-render must not repeat the whole list)
      const fresh = items.filter((i) => !seenAttn.has(i.key));
      if (fresh.length && seenAttn.size) setText(attnLive, `Needs you: ${fresh[0].text}`);
      seenAttn = new Set(items.map((i) => i.key));
    }

    // who's doing what, per person
    const owners = new Map<string, AgentState[]>();
    for (const a of state.agents) { const l = owners.get(a.owner) ?? []; l.push(a); owners.set(a.owner, l); }
    const pSig = [...owners.entries()].map(([o2, l]) => o2 + l.map((a) => a.id + a.phase + a.ticketId + a.config.model + a.provider).join(',')).join(';') + ownerFilter;
    if (pSig !== peopleSig || force) {
      peopleSig = pSig;
      setText(people.count, `${owners.size} ${owners.size === 1 ? 'person' : 'people'}`);
      peopleList.replaceChildren(...[...owners.entries()].map(([owner, list]) => {
        const stuck = list.filter((a) => phaseInfo(a.phase).tone === 'bad').length;
        const busy = list.filter((a) => phaseInfo(a.phase).tone === 'ok').length;
        const off = list.filter((a) => a.phase === 'offline').length;
        const sum = [`${plural(list.length, 'agent')}`, busy ? `${busy} working` : '', stuck ? `${stuck} stuck` : '', off ? `${off} offline` : ''].filter(Boolean).join(', ');
        return h('li', { class: `tv-person${ownerFilter === owner ? ' on' : ''}` },
          h('div', { class: 'tv-person-h' },
            h('i', { class: 'swatch', style: `background:${list[0].ownerColor || 'var(--muted)'}`, 'aria-hidden': 'true' }),
            h('b', {}, owner), h('span', { class: `dim${stuck ? ' tv-stuck' : ''}` }, sum), h('span', { class: 'grow' }),
            h('button', { type: 'button', class: 'btn tiny', 'aria-pressed': String(ownerFilter === owner), onClick: () => { ownerFilter = ownerFilter === owner ? '' : owner; sig = ''; refresh(); } }, ownerFilter === owner ? 'Showing their tasks' : 'Their tasks')),
          h('ul', { class: 'tv-person-agents' }, ...list.map((a) => {
            const pi = phaseInfo(a.phase);
            const t = a.ticketId ? state.tickets.find((x) => x.id === a.ticketId) : undefined;
            return h('li', {}, agentBtn(a),
              h('span', { class: `chip ${pi.tone}` }, pi.label.toLowerCase()),
              t ? h('button', { type: 'button', class: 'tv-link', onClick: () => ctx.openTicket(t.id), title: t.title }, `${t.id} ${snippet(t.title, 42)}`) : h('span', { class: 'dim' }, a.role === 'worker' ? 'no task' : a.role));
          })));
      }));
    }

    // tasks
    setHidden(ownerChip, !ownerFilter); setText(ownerChip, `${ownerFilter}'s tasks ×`);
    const tSig = state.tickets.map((t) => rowSig(t, t.assignee ? byId.get(t.assignee) : undefined) + t.id).join(';') + ctx.prefs.techTickets + scope + q + sortKey + sortDir + ownerFilter;
    if (tSig !== sig || force) {
      sig = tSig;
      const live = state.tickets.filter((t) => matches(t, byId));
      setText(tk.count, `${state.tickets.filter((t) => t.status !== 'cancelled' && t.status !== 'merged').length} open`);
      if (ctx.prefs.techTickets === 'columns') {
        colEls.forEach((c) => {
          let list = live.filter((t) => c.statuses.includes(t.status));
          if (c.id === 'merged') list = list.sort((a, b) => (b.mergedAt ?? 0) - (a.mergedAt ?? 0));
          else if (c.id === 'backlog') list = list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
          setText(c.count, String(list.length));
          place(c.list, list.slice(0, COL_LIMIT).map((t) => card(t, t.assignee ? byId.get(t.assignee) : undefined)));
          setText(c.more, list.length > COL_LIMIT ? `+${list.length - COL_LIMIT} more` : ''); setHidden(c.more, list.length <= COL_LIMIT);
        });
        // exactly one card is in the Tab order: the last one focused, else the first one
        const cards = Array.from(columns.querySelectorAll<HTMLElement>('.tv-card'));
        const keep = cards.find((c) => c.dataset.id === focusedCard) ?? cards[0];
        cards.forEach((c) => { c.tabIndex = c === keep ? 0 : -1; });
        setText(empty, live.length ? '' : q || ownerFilter ? 'No tasks match.' : 'No tasks yet. The orchestrator files them as it plans, or add one with New task.');
      } else {
        const rows = live.filter((t) => scope === 'all' ? true : scope === 'done' ? (t.status === 'merged' || t.status === 'cancelled') : (t.status !== 'merged' && t.status !== 'cancelled'));
        rows.sort((a, b) => { const x = sortVal(a, byId), y = sortVal(b, byId); return (x < y ? -1 : x > y ? 1 : 0) * sortDir || (Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, ''))); });
        place(tbody, rows.map((t) => row(t, t.assignee ? byId.get(t.assignee) : undefined)));
        table.querySelectorAll<HTMLElement>('.tv-sort').forEach((b) => {
          const on = b.dataset.key === sortKey;
          toggleClass(b, 'on', on);
          b.parentElement!.setAttribute('aria-sort', on ? (sortDir === 1 ? 'ascending' : 'descending') : 'none');
        });
        setText(empty, rows.length ? '' : q || ownerFilter ? 'No tasks match.' : 'Nothing here.');
      }
      setHidden(empty, !empty.textContent);
      const ids = new Set(state.tickets.map((t) => t.id));
      for (const k of cardCache.keys()) if (!ids.has(k)) cardCache.delete(k);
      for (const k of rowCache.keys()) if (!ids.has(k)) rowCache.delete(k);
    }

    // activity: newest first, appended incrementally
    const log = state.log;
    const last = log[log.length - 1] ?? null;
    if (last !== lastLog || force) {
      let from = 0;
      const idx = lastLog ? log.lastIndexOf(lastLog) : -1;
      if (idx >= 0 && !force) from = idx + 1; else actList.replaceChildren();
      const frag: HTMLElement[] = [];
      for (let i = from; i < log.length; i++) {
        const e = log[i];
        if (actFilter.kinds && !actFilter.kinds.includes(e.kind)) continue;
        const a = e.agentId ? byId.get(e.agentId) : undefined;
        frag.push(h('li', { class: `log-row k-${e.kind}` }, h('span', { class: 't' }, fmtClock(e.t)), h('span', { class: `kind k-${e.kind}` }, KIND_LABEL[e.kind] ?? e.kind.toUpperCase()),
          h('span', { class: 'msg' }, ...whoAndText(a, e.text))));
      }
      for (const n of frag) actList.insertBefore(n, actList.firstChild);
      while (actList.children.length > ACT_ROWS) actList.lastElementChild!.remove();
      lastLog = last;
      setText(act.count, last ? `latest ${fmtClock(last.t)}` : '');
    }

    // costs
    const tiers = Object.entries(m.costByTier ?? {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    byTier.set(tiers.map(([k, v], i) => ({ key: modelLabel({ model: '', tier: k }), value: v, color: tierColor(k, i) })));
    byProv.set(PROVIDER_IDS.map((id) => ({ key: PROVIDERS[id].short, value: m.costByProvider?.[id] ?? 0, color: `var(--p-${id})` })).filter((i) => i.value > 0));
    setText(kvs.total, usd(m.totalCostUsd)); setText(kvs.orch, usd(m.orchestrationCostUsd)); setText(kvs.waste, usd(m.wasteUsd));
    setText(kvs.perMerge, m.avgCostPerMergedUsd > 0 ? usd(m.avgCostPerMergedUsd) : '-'); setText(kvs.projected, usd(m.projectedScopeCostUsd));
    setText(kvs.budget, budget > 0 ? `${usd(budget)} (${Math.round(m.budgetUsedPct)}% used)` : 'unlimited');
    setText(cost.count, usd(m.totalCostUsd));

    // help between agents (open first, then the latest answered)
    const reqs = [...state.help].reverse().sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1)).slice(0, 8);
    const hSig = reqs.map((r) => r.id + r.status).join(',');
    if (hSig !== helpSig || force) {
      helpSig = hSig;
      setText(help.count, m.helpOpen ? `${m.helpOpen} open` : '');
      helpList.replaceChildren(...(reqs.length ? reqs.map((r) => {
        const from = byId.get(r.fromAgent), to = r.toAgent === 'orch' ? undefined : byId.get(r.toAgent);
        return h('li', { class: `tv-help-i ${r.status}` },
          h('span', { class: 'tv-help-who' }, agentBtn(from, r.fromAgent), h('span', { class: 'dim' }, ' asked '), to ? agentBtn(to) : h('b', {}, 'the orchestrator'),
            r.ticketId ? h('button', { type: 'button', class: 'tk-id tv-link', onClick: () => ctx.openTicket(r.ticketId!) }, r.ticketId) : null,
            h('span', { class: 'grow' }), h('span', { class: `chip ${r.status === 'open' ? 'warn' : r.status === 'answered' ? 'ok' : 'mute'}` }, r.status === 'timeout' ? 'no answer' : r.status)),
          h('span', { class: 'tv-help-q' }, snippet(r.question, 140)),
          r.answer ? h('span', { class: 'tv-help-a dim' }, snippet(r.answer, 140)) : null);
      }) : [h('li', { class: 'note' }, 'No help requests yet. Stuck agents ask a teammate with the right skill, or the orchestrator.')]));
    }
  };

  return { el, update: (s) => update(s) };
}
