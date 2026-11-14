// BOARD VIEW: the technical alternative to the 3D office (V toggles). Same state, same design language, no WebGL.
// Layout: stat tiles, "needs attention" list, tickets (columns or a sortable table), then activity, costs and help.
// The agents dock, the ticket editor drawer, comms and the hackathon window are shared with the office view.
import type { AgentState, LogEntry, SimState, Ticket } from '../types';
import type { Panel, UICtx } from './ctx';
import { clamp, fmtClock, h, pips, segmented, setHidden, setPips, setText, toggleClass } from './dom';
import { icon } from './icons';
import { setSkillChips } from './chips';
import { KIND_LABEL, phaseInfo, usd } from './format';
import { stack, tierColor } from './metrics';
import { snippet } from './interact';
import './techView.css';

const COLS: { id: string; title: string; statuses: Ticket['status'][] }[] = [
  { id: 'backlog', title: 'Backlog', statuses: ['backlog'] },
  { id: 'progress', title: 'In progress', statuses: ['assigned', 'in_progress'] },
  { id: 'review', title: 'In review', statuses: ['in_review'] },
  { id: 'changes', title: 'Changes requested', statuses: ['changes_requested'] },
  { id: 'merged', title: 'Merged', statuses: ['merged'] },
];
const STATUS_SHORT: Record<string, string> = {
  backlog: 'BACKLOG', assigned: 'ASSIGNED', in_progress: 'IN PROGRESS', in_review: 'IN REVIEW', changes_requested: 'CHANGES', merged: 'MERGED', cancelled: 'CANCELLED',
};
const STATUS_TONE: Record<string, string> = {
  backlog: 'mute', assigned: 'info', in_progress: 'info', in_review: 'violet', changes_requested: 'warn', merged: 'ok', cancelled: 'mute',
};
const STATUS_ORDER: Record<string, number> = { changes_requested: 0, in_review: 1, in_progress: 2, assigned: 3, backlog: 4, merged: 5, cancelled: 6 };
const ACT_FILTERS: { id: string; label: string; kinds: LogEntry['kind'][] | null }[] = [
  { id: 'all', label: 'Everything', kinds: null },
  { id: 'ship', label: 'Merges and reviews', kinds: ['merge', 'review', 'reject'] },
  { id: 'trouble', label: 'Problems', kinds: ['block', 'reject', 'help', 'cost'] },
  { id: 'tickets', label: 'Tickets and plan', kinds: ['ticket', 'plan'] },
  { id: 'talk', label: 'Chat and help', kinds: ['chat', 'help'] },
];
const COL_LIMIT = 40;
const ACT_ROWS = 150;

type SortKey = 'id' | 'title' | 'status' | 'diff' | 'who' | 'progress' | 'cost' | 'ratio';

interface Tile { el: HTMLElement; v: HTMLElement; sub: HTMLElement; bar: HTMLElement | null; fill: HTMLElement | null }
function tile(label: string, title: string, withBar = false): Tile {
  const v = h('b', { class: 'tv-tile-v' });
  const sub = h('span', { class: 'tv-tile-sub' });
  const fill = withBar ? h('i', {}) : null;
  const bar = withBar ? h('span', { class: 'bar thin' }, fill) : null;
  const el = h('div', { class: 'tv-tile', title }, h('span', { class: 'tv-tile-l' }, label), v, sub, bar);
  return { el, v, sub, bar, fill };
}

function panel(title: string, cls: string, ...extras: (Node | null)[]): { el: HTMLElement; body: HTMLElement; count: HTMLElement } {
  const count = h('span', { class: 'tv-count' });
  const body = h('div', { class: 'tv-body' });
  const el = h('section', { class: `tv-panel ${cls}`, 'aria-label': title },
    h('header', { class: 'tv-h' }, h('h2', { class: 'tv-title' }, title), count, h('span', { class: 'grow' }), ...extras), body);
  return { el, body, count };
}

const ratioOf = (t: Ticket): number => { const est = t.estimatedCostUsd ?? 0; return est > 0 ? (t.usage?.costUsd ?? 0) / est : 0; };

export function createTechView(ctx: UICtx): Panel {
  // ---------------------------------------------------------------- stat tiles
  const tScope = tile('Scope', 'Merged tickets out of the planned scope', true);
  const tActive = tile('Working', 'Tickets being implemented right now, and how busy the workers are');
  const tReview = tile('Review', 'Pull requests waiting for the Integrator, and how many were sent back');
  const tHelp = tile('Help', 'Unanswered help requests between agents');
  const tSpend = tile('Spend (est.)', 'Estimated spend so far against the budget', true);
  const tBurn = tile('Burn', 'Current spend rate and the average cost of one merged ticket');
  const tTime = tile('Time', 'Hackathon countdown, or the orchestrator\'s ETA against the deadline');
  const stats = h('div', { class: 'tv-stats', role: 'group', 'aria-label': 'Key numbers' }, ...[tScope, tActive, tReview, tHelp, tSpend, tBurn, tTime].map((t) => t.el));

  // ---------------------------------------------------------------- needs attention
  const attn = panel('Needs attention', 'tv-attn');
  const attnList = h('ul', { class: 'tv-attn-list' });
  attn.body.appendChild(attnList);

  // ---------------------------------------------------------------- tickets
  let q = '';
  let scope: 'open' | 'all' | 'done' = 'open';
  let sortKey: SortKey = 'status', sortDir: 1 | -1 = 1;
  const search = h('input', { type: 'search', class: 'sel tv-q', placeholder: 'Filter tickets...', 'aria-label': 'Filter tickets', onInput: () => { q = search.value.trim().toLowerCase(); sig = ''; refresh(); } }) as HTMLInputElement;
  const scopeSeg = segmented<'open' | 'all' | 'done'>([
    { value: 'open', label: 'Open', title: 'Hide merged and cancelled tickets in the table' },
    { value: 'all', label: 'All' }, { value: 'done', label: 'Done', title: 'Merged and cancelled only' },
  ], scope, (v) => { scope = v; sig = ''; refresh(); }, 'Which tickets');
  scopeSeg.el.classList.add('tv-seg');
  const modeSeg = segmented<'columns' | 'table'>([
    { value: 'columns', label: 'Columns', title: 'One column per status, like a kanban' },
    { value: 'table', label: 'Table', title: 'One sortable row per ticket' },
  ], ctx.prefs.techTickets, (v) => { ctx.prefs.techTickets = v; ctx.savePrefs(); sig = ''; syncMode(); refresh(); }, 'Ticket layout');
  modeSeg.el.classList.add('tv-seg');
  const newBtn = h('button', { type: 'button', class: 'btn tiny accent', title: 'Create a ticket (A adds a random one)', onClick: () => ctx.openNewTicket() }, icon('plus'), ' New');
  const tk = panel('Tickets', 'tv-tickets', search, scopeSeg.el, modeSeg.el, newBtn);

  const colEls = COLS.map((c) => {
    const count = h('span', { class: 'col-count' });
    const list = h('div', { class: 'tv-col-list', role: 'list' });
    const more = h('div', { class: 'tv-more' });
    const el = h('div', { class: `tv-col col-${c.id}` }, h('div', { class: 'col-head' }, h('span', {}, c.title), count), list, more);
    return { ...c, el, count, list, more };
  });
  const columns = h('div', { class: 'tv-cols' }, ...colEls.map((c) => c.el));

  const th = (key: SortKey, label: string, cls = ''): HTMLElement => {
    const b = h('button', { type: 'button', class: 'tv-sort', dataset: { key }, onClick: () => { if (sortKey === key) sortDir = sortDir === 1 ? -1 : 1; else { sortKey = key; sortDir = 1; } sig = ''; refresh(); } }, label);
    return h('th', { scope: 'col', class: cls }, b);
  };
  const tbody = h('tbody', {});
  const table = h('div', { class: 'tv-table-wrap' }, h('table', { class: 'tv-table' },
    h('thead', {}, h('tr', {}, th('id', 'ID'), th('title', 'Title', 'w-title'), th('status', 'Status'), th('diff', 'Diff'), th('who', 'Assignee'),
      th('progress', 'Progress'), th('cost', 'Cost'), th('ratio', 'vs est.'), h('th', { scope: 'col' }, 'Skills'))),
    tbody));
  const empty = h('p', { class: 'note tv-empty' });
  tk.body.append(columns, table, empty);
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
  const act = panel('Activity', 'tv-act', actSel);
  const actList = h('ol', { class: 'tv-act-list', 'aria-live': 'off', reversed: true });
  act.body.appendChild(actList);

  // ---------------------------------------------------------------- costs
  const cost = panel('Costs (est.)', 'tv-costs');
  const byTier = stack(), byProv = stack();
  const kvs: Record<string, HTMLElement> = {};
  const kv = (k: string, label: string, title: string): HTMLElement => { const v = h('b', {}); kvs[k] = v; return h('div', { class: 'kv', title }, h('span', {}, label), v); };
  cost.body.append(
    h('div', { class: 'tv-sub' }, 'By model tier'), byTier.el,
    h('div', { class: 'tv-sub' }, 'By provider'), byProv.el,
    h('div', { class: 'tv-kvs' },
      kv('total', 'Total', 'All agents, including orchestration'), kv('orch', 'Orchestration', 'Orchestrator and Integrator overhead'),
      kv('waste', 'Rework waste', 'Spend on attempts that got sent back'), kv('perMerge', 'Per merged ticket', 'Average'),
      kv('projected', 'Projected scope', 'Forecast to finish all scope'), kv('budget', 'Budget', 'Set in Controls, 0 = unlimited')),
    h('p', { class: 'note' }, 'Illustrative prices (src/sim/pricing.ts), not real billing.'));

  // ---------------------------------------------------------------- help
  const help = panel('Help requests', 'tv-help');
  const helpList = h('ul', { class: 'tv-help-list' });
  help.body.appendChild(helpList);

  const main = h('div', { class: 'tv-main' }, attn.el, tk.el);
  const side = h('div', { class: 'tv-side' }, act.el, help.el, cost.el);
  const el = h('main', { class: 'tech', id: 'tech', 'aria-label': 'Board view', tabIndex: -1 }, stats, h('div', { class: 'tv-grid' }, main, side));

  // ---------------------------------------------------------------- helpers
  const agentBtn = (a: AgentState | undefined, fallback = 'unassigned'): HTMLElement => a
    ? h('button', { type: 'button', class: `tv-who${a.id === ctx.selectedId ? ' on' : ''}`, title: `${a.name} (${a.owner}) - ${a.config.model}. Click to inspect`, onClick: (e: Event) => { e.stopPropagation(); ctx.select(a.id === ctx.selectedId ? null : a.id); } },
      h('i', { class: `pdot ${a.provider}` }), h('b', {}, a.name), h('span', { class: `tier ${a.provider}` }, a.config.tier))
    : h('span', { class: 'dim tv-who none' }, fallback);

  // Ticket rows (shared by columns + table) are rebuilt only when their signature changes.
  const rowSig = (t: Ticket, a: AgentState | undefined): string =>
    [t.status, t.title, t.difficulty, Math.round(t.progress * 100), (t.usage?.costUsd ?? 0).toFixed(2), t.reworks, t.priority, t.pinnedTo, t.helpRequests, (t.skills ?? []).join(','),
      a ? `${a.id}${a.config.tier}${(a.skills ?? []).join(',')}` : '', a?.id === ctx.selectedId].join('|');

  const cardCache = new Map<string, { el: HTMLElement; sig: string }>();
  const card = (t: Ticket, a: AgentState | undefined): HTMLElement => {
    const s = rowSig(t, a);
    const hit = cardCache.get(t.id);
    if (hit && hit.sig === s) return hit.el;
    const r = ratioOf(t);
    const act = t.usage?.costUsd ?? 0;
    const bar = h('i', {}); bar.style.width = `${Math.round(clamp(t.status === 'merged' ? 1 : t.progress, 0, 1) * 100)}%`;
    const skills = h('span', { class: 'skill-row' }); setSkillChips(skills, t.skills, a ? a.skills : null);
    const node = h('div', { class: `tv-card${a && a.id === ctx.selectedId ? ' mine' : ''}${t.status === 'merged' ? ' done' : ''}`, role: 'listitem', tabIndex: 0, title: `${t.id} ${t.title}\n${t.epic}${t.description ? `\n\n${t.description}` : ''}`,
      onClick: () => ctx.openTicket(t.id), onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.openTicket(t.id); } } },
      h('span', { class: 'tv-card-top' }, h('b', { class: 'tk-id' }, t.id), pips(t.difficulty),
        t.pinnedTo ? h('span', { class: 'tk-pin', title: 'Pinned' }, icon('pin')) : null,
        t.priority ? h('span', { class: 'chip warn' }, `P${t.priority > 0 ? '+' : ''}${t.priority}`) : null,
        t.reworks ? h('span', { class: 'chip bad', title: 'Rework rounds' }, `R${t.reworks}`) : null,
        t.helpRequests ? h('span', { class: 'chip warn', title: 'Help requests on this ticket' }, `?${t.helpRequests}`) : null,
        h('span', { class: 'grow' }),
        h('span', { class: `cost${r > 1.6 ? ' bad' : r > 1.2 ? ' warn' : ''}` }, act > 0 ? `${usd(act)}/${usd(t.estimatedCostUsd)}` : `~${usd(t.estimatedCostUsd)}`)),
      h('span', { class: 'tv-card-title' }, t.title),
      h('span', { class: 'tv-card-foot' }, agentBtn(a, t.status === 'backlog' ? 'unclaimed' : '-'), skills),
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
    const bar = h('i', {}); bar.style.width = `${Math.round(clamp(t.status === 'merged' ? 1 : t.progress, 0, 1) * 100)}%`;
    const skills = h('span', { class: 'skill-row' }); setSkillChips(skills, t.skills, a ? a.skills : null);
    const node = h('tr', { class: `${a && a.id === ctx.selectedId ? 'mine' : ''}${t.status === 'merged' || t.status === 'cancelled' ? ' done' : ''}`, tabIndex: 0, title: 'Click or press Enter to edit',
      onClick: () => ctx.openTicket(t.id), onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); ctx.openTicket(t.id); } } },
      h('td', {}, h('b', { class: 'tk-id' }, t.id)),
      h('td', { class: 'w-title' }, h('span', { class: 'tv-ell' }, t.title), t.reworks ? h('span', { class: 'chip bad' }, `R${t.reworks}`) : null),
      h('td', {}, h('span', { class: `chip ${STATUS_TONE[t.status] ?? 'mute'}` }, STATUS_SHORT[t.status] ?? t.status)),
      h('td', {}, pips(t.difficulty)),
      h('td', {}, agentBtn(a, '-')),
      h('td', { class: 'num' }, h('span', { class: 'tv-prog' }, h('span', { class: 'bar thin' }, bar), `${Math.round(clamp(t.status === 'merged' ? 1 : t.progress, 0, 1) * 100)}%`)),
      h('td', { class: 'num' }, act > 0 ? usd(act) : '-', h('span', { class: 'dim' }, ` / ${usd(t.estimatedCostUsd)}`)),
      h('td', { class: `num cost${r > 1.6 ? ' bad' : r > 1.2 ? ' warn' : ''}` }, act > 0 ? `${r.toFixed(2)}x` : '-'),
      h('td', {}, skills));
    rowCache.set(t.id, { el: node, sig: s });
    return node;
  };

  const place = (parent: HTMLElement, nodes: HTMLElement[]): void => {
    nodes.forEach((n, i) => { if (parent.children[i] !== n) parent.insertBefore(n, parent.children[i] ?? null); });
    while (parent.children.length > nodes.length) parent.lastElementChild!.remove();
  };

  const matches = (t: Ticket, byId: Map<string, AgentState>): boolean => {
    if (!q) return true;
    const a = t.assignee ? byId.get(t.assignee)?.name ?? '' : '';
    return `${t.id} ${t.title} ${t.epic} ${t.description ?? ''} ${a} ${(t.skills ?? []).join(' ')}`.toLowerCase().includes(q);
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

  // ---------------------------------------------------------------- update
  let sig = '';
  let lastLog: LogEntry | null = null;
  let attnSig = '', helpSig = '', lastSel: string | null = null;
  let lastState: SimState | null = null;
  const refresh = (): void => { if (lastState) update(lastState, true); };

  const update = (state: SimState, force = false): void => {
    lastState = state;
    if (ctx.view !== 'board') return;
    const m = state.metrics, p = state.plan;
    const byId = new Map(state.agents.map((a) => [a.id, a]));
    const workers = state.agents.filter((a) => a.role === 'worker');
    if (lastSel !== ctx.selectedId) { lastSel = ctx.selectedId; sig = ''; attnSig = ''; helpSig = ''; }

    // tiles
    const total = Math.max(p.totalTickets, m.merged);
    setText(tScope.v, `${m.merged}/${total}`); setText(tScope.sub, `${Math.round(m.scopeDone * 100)}% of ${p.name || 'scope'}`);
    tScope.fill!.style.width = `${Math.round(clamp(m.scopeDone, 0, 1) * 100)}%`;
    const inProg = state.tickets.filter((t) => t.status === 'in_progress' || t.status === 'assigned').length;
    setText(tActive.v, String(inProg)); setText(tActive.sub, `${Math.round(m.utilization * 100)}% of ${workers.filter((a) => a.phase !== 'offline').length} workers busy`);
    setText(tReview.v, String(m.inReview)); setText(tReview.sub, `${m.rejected} sent back`);
    setText(tHelp.v, String(m.helpOpen)); setText(tHelp.sub, `${m.helpTotal} asked in total`);
    toggleClass(tHelp.el, 'warn', m.helpOpen > 0);
    setText(tSpend.v, usd(m.totalCostUsd));
    const budget = ctx.sim.settings.budgetUsd ?? 0;
    setText(tSpend.sub, budget > 0 ? `${Math.round(m.budgetUsedPct)}% of ${usd(budget)}` : 'no budget set');
    tSpend.fill!.style.width = `${Math.round(clamp(m.budgetUsedPct / 100, 0, 1) * 100)}%`;
    tSpend.bar!.className = `bar thin budget${m.budgetUsedPct >= 100 ? ' over' : m.budgetUsedPct >= 80 ? ' warn' : ''}`;
    toggleClass(tSpend.el, 'bad', budget > 0 && m.budgetUsedPct >= 100);
    setText(tBurn.v, `${usd(m.burnUsdPerMin)}/min`); setText(tBurn.sub, m.avgCostPerMergedUsd > 0 ? `${usd(m.avgCostPerMergedUsd)} per merge` : 'no merges yet');
    const hk = state.hack;
    if (hk?.active && hk.stage !== 'idle') {
      const left = hk.endsAt - state.time;
      setText(tTime.v, hk.stage === 'submitted' ? 'SUBMITTED' : left > 0 ? fmtClock(left) : 'TIME UP');
      setText(tTime.sub, `${hk.stage} - ${Math.round(hk.demoReadiness * 100)}% demo-ready`);
      toggleClass(tTime.el, 'warn', left > 0 && left < 300 && hk.stage !== 'submitted');
    } else {
      const remaining = p.deadlineMinutes - state.time / 60;
      setText(tTime.v, `sim ${fmtClock(state.time)}`);
      setText(tTime.sub, m.etaMinutes == null ? 'ETA: estimating' : remaining <= 0 ? 'deadline passed' : `ETA ${m.etaMinutes.toFixed(0)}m vs ${remaining.toFixed(0)}m left`);
      toggleClass(tTime.el, 'warn', m.etaMinutes != null && remaining > 0 && m.etaMinutes > remaining);
    }

    // needs attention (most urgent first)
    const items: { tone: string; text: string; go: () => void; key: string }[] = [];
    for (const a of state.agents) if (a.phase === 'blocked') items.push({ tone: 'bad', key: `b${a.id}`, text: `${a.name} is blocked${a.ticketId ? ` on ${a.ticketId}` : ''}${a.bubble ? `: ${a.bubble}` : ''}`, go: () => ctx.select(a.id) });
    if (budget > 0 && m.budgetUsedPct >= 80) items.push({ tone: m.budgetUsedPct >= 100 ? 'bad' : 'warn', key: 'budget', text: `${Math.round(m.budgetUsedPct)}% of the budget is spent (est.)`, go: () => {} });
    for (const r of state.help) if (r.status === 'open') {
      const from = byId.get(r.fromAgent)?.name ?? r.fromAgent, to = r.toAgent === 'orch' ? 'the orchestrator' : byId.get(r.toAgent)?.name ?? r.toAgent;
      items.push({ tone: 'warn', key: `h${r.id}`, text: `${from} asks ${to}${r.ticketId ? ` (${r.ticketId})` : ''}: ${snippet(r.question, 80)}`, go: () => ctx.select(r.fromAgent) });
    }
    for (const t of state.tickets) {
      if (t.status === 'changes_requested') items.push({ tone: 'warn', key: `c${t.id}`, text: `${t.id} sent back${t.assignee ? ` to ${byId.get(t.assignee)?.name ?? t.assignee}` : ''} (round ${t.reworks}): ${t.title}`, go: () => ctx.openTicket(t.id) });
      else if (t.status !== 'merged' && t.status !== 'cancelled' && ratioOf(t) > 1.6) items.push({ tone: 'warn', key: `o${t.id}`, text: `${t.id} is ${ratioOf(t).toFixed(1)}x over its cost estimate: ${t.title}`, go: () => ctx.openTicket(t.id) });
    }
    const aSig = items.map((i) => i.key + i.text).join('\n');
    if (aSig !== attnSig || force) {
      attnSig = aSig;
      setText(attn.count, items.length ? String(items.length) : '');
      toggleClass(attn.el, 'calm', !items.length);
      const shown = items.slice(0, 6);
      attnList.replaceChildren(...(shown.length ? shown.map((i) => h('li', { class: `tv-attn-i ${i.tone}` }, h('button', { type: 'button', onClick: i.go }, h('i', { class: 'tv-flag' }), h('span', {}, i.text))))
        : [h('li', { class: 'tv-attn-i ok' }, h('span', {}, h('i', { class: 'tv-flag' }), `Nothing needs you right now. ${workers.filter((a) => phaseInfo(a.phase).tone === 'ok').length} agents working.`))]),
        ...(items.length > 6 ? [h('li', { class: 'tv-more' }, `+${items.length - 6} more`)] : []));
    }

    // tickets
    const tSig = state.tickets.map((t) => rowSig(t, t.assignee ? byId.get(t.assignee) : undefined) + t.id).join(';') + ctx.prefs.techTickets + scope + q + sortKey + sortDir;
    if (tSig !== sig || force) {
      sig = tSig;
      const live = state.tickets.filter((t) => matches(t, byId));
      setText(tk.count, String(state.tickets.filter((t) => t.status !== 'cancelled' && t.status !== 'merged').length) + ' open');
      if (ctx.prefs.techTickets === 'columns') {
        colEls.forEach((c) => {
          let list = live.filter((t) => c.statuses.includes(t.status));
          if (c.id === 'merged') list = list.sort((a, b) => (b.mergedAt ?? 0) - (a.mergedAt ?? 0));
          else if (c.id === 'backlog') list = list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
          setText(c.count, String(list.length));
          place(c.list, list.slice(0, COL_LIMIT).map((t) => card(t, t.assignee ? byId.get(t.assignee) : undefined)));
          setText(c.more, list.length > COL_LIMIT ? `+${list.length - COL_LIMIT} more` : ''); setHidden(c.more, list.length <= COL_LIMIT);
        });
        setText(empty, live.length ? '' : q ? 'No tickets match the filter.' : 'No tickets yet. The orchestrator files them as it plans, or add one with New.');
      } else {
        const rows = live.filter((t) => scope === 'all' ? true : scope === 'done' ? (t.status === 'merged' || t.status === 'cancelled') : (t.status !== 'merged' && t.status !== 'cancelled'));
        rows.sort((a, b) => { const x = sortVal(a, byId), y = sortVal(b, byId); return (x < y ? -1 : x > y ? 1 : 0) * sortDir || (Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, ''))); });
        place(tbody, rows.map((t) => row(t, t.assignee ? byId.get(t.assignee) : undefined)));
        table.querySelectorAll<HTMLElement>('.tv-sort').forEach((b) => {
          const on = b.dataset.key === sortKey;
          toggleClass(b, 'on', on);
          b.parentElement!.setAttribute('aria-sort', on ? (sortDir === 1 ? 'ascending' : 'descending') : 'none');
        });
        setText(empty, rows.length ? '' : q ? 'No tickets match the filter.' : 'Nothing here.');
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
          h('span', { class: 'msg' }, a ? h('b', { class: `who ${a.provider}` }, a.name) : null, a ? ' ' : null, e.text)));
      }
      for (const n of frag) actList.insertBefore(n, actList.firstChild);
      while (actList.children.length > ACT_ROWS) actList.lastElementChild!.remove();
      lastLog = last;
      setText(act.count, last ? `${fmtClock(last.t)}` : '');
    }

    // costs
    const tiers = Object.entries(m.costByTier ?? {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    byTier.set(tiers.map(([k, v], i) => ({ key: k, value: v, color: tierColor(k, i) })));
    byProv.set((['claude', 'codex'] as const).map((k) => ({ key: k, value: m.costByProvider?.[k] ?? 0, color: k === 'claude' ? '#d97757' : '#2dd4bf' })).filter((i) => i.value > 0));
    setText(kvs.total, usd(m.totalCostUsd)); setText(kvs.orch, usd(m.orchestrationCostUsd)); setText(kvs.waste, usd(m.wasteUsd));
    setText(kvs.perMerge, m.avgCostPerMergedUsd > 0 ? usd(m.avgCostPerMergedUsd) : '-'); setText(kvs.projected, usd(m.projectedScopeCostUsd));
    setText(kvs.budget, budget > 0 ? `${usd(budget)} (${Math.round(m.budgetUsedPct)}% used)` : 'unlimited');
    setText(cost.count, usd(m.totalCostUsd));

    // help requests (open first, then the latest answered)
    const reqs = [...state.help].reverse().sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1)).slice(0, 8);
    const hSig = reqs.map((r) => r.id + r.status).join(',');
    if (hSig !== helpSig || force) {
      helpSig = hSig;
      setText(help.count, m.helpOpen ? `${m.helpOpen} open` : '');
      helpList.replaceChildren(...(reqs.length ? reqs.map((r) => {
        const from = byId.get(r.fromAgent), to = r.toAgent === 'orch' ? undefined : byId.get(r.toAgent);
        return h('li', { class: `tv-help-i ${r.status}` },
          h('span', { class: 'tv-help-who' }, agentBtn(from, r.fromAgent), h('span', { class: 'dim' }, ' asks '), to ? agentBtn(to) : h('b', {}, 'Orchestrator'),
            r.ticketId ? h('button', { type: 'button', class: 'tk-id tv-link', onClick: () => ctx.openTicket(r.ticketId!) }, r.ticketId) : null,
            h('span', { class: 'grow' }), h('span', { class: `chip ${r.status === 'open' ? 'warn' : r.status === 'answered' ? 'ok' : 'mute'}` }, r.status)),
          h('span', { class: 'tv-help-q' }, snippet(r.question, 140)),
          r.answer ? h('span', { class: 'tv-help-a dim' }, snippet(r.answer, 140)) : null);
      }) : [h('li', { class: 'note' }, 'No help requests yet. Stuck agents ask a teammate with the right skill, or the orchestrator.')]));
    }
  };

  return { el, update: (s) => update(s) };
}
