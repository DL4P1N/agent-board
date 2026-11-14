// Floating ticket board (kanban overlay on the 3D office). Minimizes to a live-count chip (T), goes fullscreen
// and translucent (F), and opens a ticket editor / creator drawer when a card is clicked.
import type { AgentState, Difficulty, SimState, Ticket, TicketSpec } from '../types';
import type { Panel, UICtx } from './ctx';
import { DIFF_COLORS, DIFF_NAMES, clamp, h, pips, setHidden, setPips, setText, setAttr, toggleClass } from './dom';
import { hudWindow, type HudWin } from './hud';
import { icon } from './icons';
import { setSkillChips, skillById, skillChip } from './chips';
import { usd } from './format';
import { providerName } from '../providers';

const COLS: { id: string; title: string; statuses: string[]; limit: number; fsLimit: number }[] = [
  { id: 'backlog', title: 'Backlog', statuses: ['backlog'], limit: 10, fsLimit: 60 },
  { id: 'progress', title: 'In progress', statuses: ['assigned', 'in_progress'], limit: 14, fsLimit: 60 },
  { id: 'review', title: 'In review', statuses: ['in_review'], limit: 14, fsLimit: 60 },
  { id: 'changes', title: 'Changes requested', statuses: ['changes_requested'], limit: 14, fsLimit: 60 },
  { id: 'merged', title: 'Merged', statuses: ['merged'], limit: 8, fsLimit: 40 },
  { id: 'cancelled', title: 'Cancelled', statuses: ['cancelled'], limit: 8, fsLimit: 40 },
];

interface Card {
  el: HTMLElement; id: HTMLElement; title: HTMLElement; desc: HTMLElement; pips: HTMLElement; dot: HTMLElement; cost: HTMLElement; skills: HTMLElement;
  rework: HTMLElement; bar: HTMLElement; pin: HTMLElement; prio: HTMLElement; who: HTMLElement; whoDot: HTMLElement; whoName: HTMLElement; whoTier: HTMLElement;
  whoSwatch: HTMLElement; whoOwner: HTMLElement; help: HTMLElement; ms: HTMLElement;
}

interface Filters { q: string; assignee: string; skill: string; milestone: string; diff: string }

export function createBoard(ctx: UICtx): Panel & { win: HudWin; closeDrawer(): boolean; openNew(): void; openTicket(id: string): void; drawer: HTMLElement } {
  let wrap!: HTMLElement;
  let fsBtn!: HTMLButtonElement;
  const win = hudWindow(ctx, 'board', 'Ticket board', false, 'board-win', {
    zone: 'bottom', minSize: { w: 22, h: 9 }, defaultSize: { w: 44, h: 12 },
    place: (l, size) => ({ x: l.leftX, y: l.bottomY - size.h, w: size.w, h: size.h }),
    onFullscreen: (on) => {
      wrap?.classList.toggle('fs-mode', on);
      if (fsBtn) { fsBtn.replaceChildren(icon(on ? 'shrink' : 'expand')); fsBtn.title = on ? 'Exit fullscreen (Esc or F)' : 'Fullscreen board (F)'; fsBtn.setAttribute('aria-label', fsBtn.title); }
      refresh();
    },
  });
  const root = h('div', { class: 'board' });
  toggleClass(root, 'list', ctx.prefs.boardMode === 'list');
  const modeBtn = h('button', { type: 'button', class: 'btn tiny', title: 'Switch between detailed cards and a compact list', onClick: () => {
    ctx.prefs.boardMode = ctx.prefs.boardMode === 'list' ? 'cards' : 'list';
    toggleClass(root, 'list', ctx.prefs.boardMode === 'list');
    setText(modeBtn, ctx.prefs.boardMode === 'list' ? 'Cards' : 'List');
    ctx.savePrefs();
  } }, ctx.prefs.boardMode === 'list' ? 'Cards' : 'List');
  const newBtn = h('button', { type: 'button', class: 'btn tiny accent', title: 'Create a ticket', onClick: () => openNew() }, icon('plus'), ' New');
  fsBtn = h('button', { type: 'button', class: 'ibtn', title: 'Fullscreen board (F)', 'aria-label': 'Fullscreen board (F)', onClick: () => win.setFullscreen(!win.isFullscreen()) }, icon('expand'));
  win.extras.append(newBtn, modeBtn, fsBtn, h('span', { class: 'key-hint', title: 'Press T to toggle, F for fullscreen' }, 'T'));

  // ---- filters (fullscreen only)
  const filters: Filters = { q: '', assignee: '', skill: '', milestone: '', diff: '' };
  let showCancelled = false;
  const mkSel = (label: string, key: keyof Filters): { el: HTMLElement; sel: HTMLSelectElement } => {
    const sel = h('select', { class: 'sel', 'aria-label': label, onChange: () => { filters[key] = sel.value; refresh(); } }) as HTMLSelectElement;
    return { el: h('label', { class: 'flt' }, h('span', { class: 'dim' }, label), sel), sel };
  };
  const search = h('input', { type: 'search', class: 'sel flt-q', placeholder: 'Search tickets...', 'aria-label': 'Search tickets', onInput: () => { filters.q = search.value.trim().toLowerCase(); refresh(); } }) as HTMLInputElement;
  const fAssignee = mkSel('Assignee', 'assignee'), fSkill = mkSel('Skill', 'skill'), fMs = mkSel('Milestone', 'milestone'), fDiff = mkSel('Difficulty', 'diff');
  const cancelToggle = h('label', { class: 'flt flt-check' }, h('input', { type: 'checkbox', onChange: (e: Event) => { showCancelled = (e.target as HTMLInputElement).checked; refresh(); } }), h('span', {}, 'Show cancelled')) as HTMLElement;
  const clearBtn = h('button', { type: 'button', class: 'btn tiny', onClick: () => { Object.assign(filters, { q: '', assignee: '', skill: '', milestone: '', diff: '' }); search.value = ''; syncFilterSelects(true); refresh(); } }, 'Clear');
  const count = h('span', { class: 'dim flt-count' });
  const toolbar = h('div', { class: 'board-toolbar' }, search, fAssignee.el, fSkill.el, fMs.el, fDiff.el, cancelToggle, clearBtn, count);
  const cancelColChk = cancelToggle.querySelector('input') as HTMLInputElement;

  const cols = COLS.map((c) => {
    const countEl = h('span', { class: 'col-count' });
    const list = h('div', { class: 'col-list' });
    const more = h('div', { class: 'col-more' });
    const el = h('div', { class: `col col-${c.id}` }, h('div', { class: 'col-head' }, h('span', {}, c.title), countEl), list, more);
    root.appendChild(el);
    return { ...c, count: countEl, list, more, el };
  });
  wrap = h('div', { class: 'board-wrap' }, toolbar, root);
  win.body.appendChild(wrap);
  win.body.classList.add('board-body');

  // ---- cards
  const cards = new Map<string, Card>();
  const make = (t: Ticket): Card => {
    const id = h('b', { class: 'tk-id' }, t.id);
    const title = h('span', { class: 'tk-title' });
    const desc = h('span', { class: 'tk-desc' });
    const p = pips(t.difficulty);
    const dot = h('i', { class: 'pdot' });
    const cost = h('span', { class: 'cost' });
    const skills = h('span', { class: 'skill-row' });
    const rework = h('span', { class: 'rework', title: 'rework rounds' });
    const bar = h('i', {});
    const pin = h('span', { class: 'tk-pin', title: 'Pinned' }, icon('pin'));
    const prio = h('span', { class: 'chip warn tk-prio' });
    const whoDot = h('i', { class: 'pdot' }), whoName = h('b', {}), whoTier = h('span', { class: 'tier' }), whoSwatch = h('i', { class: 'swatch' }), whoOwner = h('span', { class: 'dim' });
    const who = h('span', { class: 'tk-who' }, whoDot, whoName, whoTier, whoSwatch, whoOwner);
    const help = h('span', { class: 'chip warn', title: 'Help requests raised on this ticket' });
    const ms = h('span', { class: 'chip violet' });
    const el = h('button', { type: 'button', class: 'tk-card', onClick: () => openTicket(t.id), title: 'Click to edit this ticket' },
      h('span', { class: 'tk-top' }, id, pin, prio, p, rework, dot), title, desc, who,
      h('span', { class: 'bar thin' }, bar), h('span', { class: 'tk-cost-row' }, cost, help, ms), skills);
    return { el, id, title, desc, pips: p, dot, cost, skills, rework, bar, pin, prio, who, whoDot, whoName, whoTier, whoSwatch, whoOwner, help, ms };
  };

  const matches = (t: Ticket, agents: Map<string, AgentState>): boolean => {
    if (filters.assignee) { if (filters.assignee === 'none' ? !!t.assignee : t.assignee !== filters.assignee) return false; }
    if (filters.skill && !(t.skills ?? []).includes(filters.skill)) return false;
    if (filters.milestone && (t.milestone ?? '') !== filters.milestone) return false;
    if (filters.diff && String(t.difficulty) !== filters.diff) return false;
    if (filters.q) {
      const a = t.assignee ? agents.get(t.assignee)?.name ?? '' : '';
      if (!`${t.id} ${t.title} ${t.description ?? ''} ${a}`.toLowerCase().includes(filters.q)) return false;
    }
    return true;
  };

  let optSig = '';
  const syncFilterSelects = (force = false): void => {
    const st = ctx.state;
    const sig = [st.agents.map((a) => a.id + a.name).join(','), (st.skills ?? []).map((s) => s.id).join(','), (st.hack?.milestones ?? []).map((m) => m.id).join(',')].join('|');
    if (sig === optSig && !force) return;
    optSig = sig;
    const fill = (sel: HTMLSelectElement, opts: [string, string][], keep: string): void => {
      sel.replaceChildren(...opts.map(([v, l]) => h('option', { value: v }, l)));
      sel.value = opts.some(([v]) => v === keep) ? keep : '';
    };
    fill(fAssignee.sel, [['', 'anyone'], ['none', 'unassigned'], ...st.agents.filter((a) => a.role === 'worker').map((a) => [a.id, a.name] as [string, string])], filters.assignee);
    fill(fSkill.sel, [['', 'any'], ...(st.skills ?? []).map((s) => [s.id, s.name] as [string, string])], filters.skill);
    fill(fMs.sel, [['', 'any'], ...(st.hack?.milestones ?? []).map((m) => [m.id, m.title] as [string, string])], filters.milestone);
    fill(fDiff.sel, [['', 'any'], ...[1, 2, 3, 4, 5].map((n) => [String(n), `${n} ${DIFF_NAMES[n]}`] as [string, string])], filters.diff);
  };

  // ---- drawer (ticket editor / creator)
  type Mode = 'edit' | 'new';
  let mode: Mode = 'edit';
  let editId: string | null = null;
  let confirming = false;
  const draft = { title: '', description: '', difficulty: 3 as Difficulty, skills: [] as string[], pinnedTo: '' as string, milestone: '' as string };
  let drawerOpen = false;

  const drTitle = h('h3', { class: 'dr-title' });
  const drClose = h('button', { type: 'button', class: 'ibtn', title: 'Close (Esc)', 'aria-label': 'Close editor', onClick: () => closeDrawer() }, icon('close'));
  const fTitle = h('input', { type: 'text', class: 'sel', maxlength: '120', placeholder: 'Ticket title', id: 'dr-title-in' }) as HTMLInputElement;
  const fDesc = h('textarea', { class: 'sel dr-desc', rows: 4, placeholder: 'Description / acceptance criteria', id: 'dr-desc-in' }) as HTMLTextAreaElement;
  const diffRow = h('div', { class: 'dr-diff', role: 'radiogroup', 'aria-label': 'Difficulty' });
  const diffBtns = ([1, 2, 3, 4, 5] as Difficulty[]).map((n) => {
    const b = h('button', { type: 'button', role: 'radio', class: 'dchip', style: `--c:${DIFF_COLORS[n]}`, title: `${DIFF_NAMES[n]} (${n})`, 'aria-label': `Difficulty ${n}, ${DIFF_NAMES[n]}`, onClick: () => setDifficulty(n) }, String(n));
    diffRow.appendChild(b); return b;
  });
  const diffName = h('span', { class: 'dim' });
  diffRow.appendChild(diffName);
  const skillBox = h('div', { class: 'dr-skills', role: 'group', 'aria-label': 'Skills' });
  const fPin = h('select', { class: 'sel', id: 'dr-pin' }) as HTMLSelectElement;
  const fMile = h('select', { class: 'sel', id: 'dr-ms' }) as HTMLSelectElement;
  const prioVal = h('b', { class: 'dr-prio-val' });
  const prioMinus = h('button', { type: 'button', class: 'btn tiny', 'aria-label': 'Lower priority', title: 'Lower priority', onClick: () => bumpPrio(-1) }, '-');
  const prioPlus = h('button', { type: 'button', class: 'btn tiny', 'aria-label': 'Raise priority', title: 'Raise priority (picked up sooner)', onClick: () => bumpPrio(1) }, '+');
  const prioRow = h('div', { class: 'se-row' }, h('span', { class: 'se-label' }, 'Priority'), prioMinus, prioVal, prioPlus);
  const statusLine = h('p', { class: 'note dr-status' });
  const msg = h('p', { class: 'note dr-msg', role: 'status' });
  const createBtn = h('button', { type: 'button', class: 'btn accent', onClick: () => doCreate() }, icon('plus'), ' Create ticket');
  const cancelBtn = h('button', { type: 'button', class: 'btn warn', onClick: () => { confirming = true; syncConfirm(); (yesBtn as HTMLElement).focus(); } }, icon('trash'), ' Cancel ticket');
  const yesBtn = h('button', { type: 'button', class: 'btn warn', onClick: () => { if (editId) ctx.cmd.cancelTicket?.(editId); ctx.refresh(); confirming = false; closeDrawer(); } }, 'Yes, cancel it');
  const keepBtn = h('button', { type: 'button', class: 'btn', onClick: () => { confirming = false; syncConfirm(); cancelBtn.focus(); } }, 'Keep');
  const confirmBox = h('div', { class: 'dr-confirm', role: 'alert' }, h('span', {}, 'Really cancel this ticket?'), yesBtn, keepBtn);
  const lbl = (text: string, forId: string, ...kids: (Node | null)[]): HTMLElement => h('div', { class: 'dr-field' }, h('label', { class: 'dr-label', htmlFor: forId }, text), ...kids);
  const drawer = h('aside', { class: 'drawer', role: 'dialog', 'aria-label': 'Ticket editor' },
    h('header', { class: 'dr-head' }, drTitle, drClose),
    h('div', { class: 'dr-body' },
      lbl('Title', 'dr-title-in', fTitle), lbl('Description', 'dr-desc-in', fDesc),
      h('div', { class: 'dr-field' }, h('span', { class: 'dr-label' }, 'Difficulty'), diffRow),
      h('div', { class: 'dr-field' }, h('span', { class: 'dr-label' }, 'Skills'), skillBox),
      h('div', { class: 'dr-field' }, h('label', { class: 'dr-label', htmlFor: 'dr-pin' }, 'Pin to agent'), fPin),
      h('div', { class: 'dr-field' }, h('label', { class: 'dr-label', htmlFor: 'dr-ms' }, 'Milestone'), fMile),
      prioRow, statusLine, msg,
      h('div', { class: 'btn-row' }, createBtn, cancelBtn), confirmBox));
  drawer.hidden = true;
  win.body.parentElement!.appendChild(drawer);

  const tk = (): Ticket | undefined => (editId ? ctx.state.tickets.find((t) => t.id === editId) : undefined);
  const supports = (k: 'updateTicket' | 'createTicket' | 'cancelTicket'): boolean => typeof ctx.cmd[k] === 'function';
  const patch = (p: Partial<TicketSpec>): void => {
    if (!editId) return;
    if (!supports('updateTicket')) { setText(msg, 'The simulation does not support editing tickets yet.'); return; }
    ctx.cmd.updateTicket?.(editId, p);
    setText(msg, 'Saved'); ctx.refresh();
  };
  function setDifficulty(n: Difficulty): void { if (mode === 'new') { draft.difficulty = n; syncDrawer(true); } else patch({ difficulty: n }); }
  function bumpPrio(d: number): void { const t = tk(); if (t) patch({ priority: (t.priority ?? 0) + d }); }
  fTitle.addEventListener('change', () => { if (mode === 'new') draft.title = fTitle.value; else if (fTitle.value.trim()) patch({ title: fTitle.value.trim() }); });
  fTitle.addEventListener('input', () => { if (mode === 'new') draft.title = fTitle.value; });
  fDesc.addEventListener('change', () => { if (mode === 'new') draft.description = fDesc.value; else patch({ description: fDesc.value }); });
  fDesc.addEventListener('input', () => { if (mode === 'new') draft.description = fDesc.value; });
  fPin.addEventListener('change', () => { if (mode === 'new') draft.pinnedTo = fPin.value; else patch({ pinnedTo: fPin.value || null }); });
  fMile.addEventListener('change', () => { if (mode === 'new') draft.milestone = fMile.value; else patch({ milestone: fMile.value || null }); });
  drawer.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeDrawer(); } });

  function toggleSkill(id: string): void {
    const cur = mode === 'new' ? draft.skills : (tk()?.skills ?? []);
    const next = cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id];
    if (mode === 'new') { draft.skills = next; syncDrawer(true); } else patch({ skills: next });
  }
  function doCreate(): void {
    if (!draft.title.trim()) { setText(msg, 'Please give the ticket a title.'); fTitle.focus(); return; }
    if (!supports('createTicket')) { setText(msg, 'The simulation does not support creating tickets yet.'); return; }
    ctx.cmd.createTicket?.({ title: draft.title.trim(), description: draft.description, difficulty: draft.difficulty, skills: [...draft.skills], pinnedTo: draft.pinnedTo || null, milestone: draft.milestone || null });
    ctx.refresh(); closeDrawer();
  }
  function syncConfirm(): void { setHidden(confirmBox, !confirming); setHidden(cancelBtn, confirming || mode !== 'edit' || !canCancel()); }
  function canCancel(): boolean { const t = tk(); return !!t && t.status !== 'merged' && t.status !== 'cancelled' && supports('cancelTicket'); }

  let skillSig = '', pinSig = '', msSig = '';
  function syncDrawer(force = false): void {
    if (!drawerOpen) return;
    const st = ctx.state;
    const t = tk();
    if (mode === 'edit' && !t) { closeDrawer(); return; }
    const src = mode === 'new' ? { title: draft.title, description: draft.description, difficulty: draft.difficulty, skills: draft.skills, pinnedTo: draft.pinnedTo || null, milestone: draft.milestone || null, priority: 0 } : t!;
    setText(drTitle, mode === 'new' ? 'New ticket' : `${t!.id} - ${t!.status.replace('_', ' ')}`);
    if (document.activeElement !== fTitle && (force || fTitle.value !== src.title)) fTitle.value = src.title;
    if (document.activeElement !== fDesc && (force || fDesc.value !== (src.description ?? ''))) fDesc.value = src.description ?? '';
    diffBtns.forEach((b, i) => { const on = src.difficulty === i + 1; toggleClass(b, 'on', on); setAttr(b, 'aria-checked', String(on)); });
    setText(diffName, `${DIFF_NAMES[src.difficulty] ?? ''}`);
    // skills toggles
    const catalog = st.skills ?? [];
    const sSig = catalog.map((s) => s.id + s.color + s.glyph).join(',') + '|' + src.skills.join(',');
    if (sSig !== skillSig || force) {
      skillSig = sSig;
      const have = new Set(src.skills);
      const ids = [...catalog.map((s) => s.id), ...src.skills.filter((id) => !catalog.some((s) => s.id === id))];
      skillBox.replaceChildren(...ids.map((id) => {
        const on = have.has(id);
        return h('button', { type: 'button', class: `sk-toggle${on ? ' on' : ''}`, 'aria-pressed': String(on), title: skillById(id)?.blurb ?? id, onClick: () => toggleSkill(id) }, skillChip(id), h('span', {}, skillById(id)?.name ?? id));
      }));
    }
    // pin + milestone selects
    const workers = st.agents.filter((a) => a.role === 'worker');
    const pSig = workers.map((a) => a.id + a.name).join(',');
    if (pSig !== pinSig) { pinSig = pSig; fPin.replaceChildren(h('option', { value: '' }, 'anyone'), ...workers.map((a) => h('option', { value: a.id }, `${a.name} (${providerName(a.provider)})`))); }
    if (document.activeElement !== fPin) fPin.value = src.pinnedTo ?? '';
    const ms = st.hack?.milestones ?? [];
    const mSig = ms.map((m) => m.id).join(',');
    if (mSig !== msSig) { msSig = mSig; fMile.replaceChildren(h('option', { value: '' }, 'none'), ...ms.map((m) => h('option', { value: m.id }, m.title))); }
    if (document.activeElement !== fMile) fMile.value = src.milestone ?? '';
    setText(prioVal, String(src.priority ?? 0));
    setHidden(prioRow, mode === 'new');
    setHidden(createBtn, mode !== 'new');
    setHidden(statusLine, mode === 'new');
    if (t) {
      const a = t.assignee ? st.agents.find((x) => x.id === t.assignee) : undefined;
      setText(statusLine, `${a ? `Assigned to ${a.name}` : 'Unassigned'} - ${Math.round(t.progress * 100)}% done - ${usd(t.usage?.costUsd)} spent of ~${usd(t.estimatedCostUsd)} est${t.source === 'human' ? ' - filed by a human' : ''}`);
    }
    syncConfirm();
  }
  function openDrawer(m: Mode, id: string | null): void {
    mode = m; editId = id; confirming = false; drawerOpen = true; drawer.hidden = false; setText(msg, '');
    if (m === 'new') Object.assign(draft, { title: '', description: '', difficulty: ctx.state.tickets.length ? 3 : 3, skills: [], pinnedTo: '', milestone: '' });
    skillSig = '';
    syncDrawer(true);
    (m === 'new' ? fTitle : drClose).focus();
  }
  function openTicket(id: string): void { openDrawer('edit', id); }
  function openNew(): void { if (win.isMin() && ctx.view === 'office') win.setMin(false); openDrawer('new', null); }
  function closeDrawer(): boolean {
    if (!drawerOpen) return false;
    drawerOpen = false; drawer.hidden = true; confirming = false; editId = null; return true;
  }

  // ---- update
  let lastState: SimState | null = null;
  const refresh = (): void => { if (lastState) update(lastState); };
  const update = (state: SimState): void => {
    lastState = state;
    const byId = new Map(state.agents.map((a) => [a.id, a]));
    const fs = win.isFullscreen();
    const useFilters = fs;
    const buckets: Ticket[][] = cols.map(() => []);
    let open = 0, review = 0, merged = 0;
    for (const t of state.tickets) {
      if (t.status === 'merged') merged++; else if (t.status !== 'cancelled') open++;
      if (t.status === 'in_review') review++;
      if (useFilters && !matches(t, byId)) continue;
      const ci = cols.findIndex((c) => c.statuses.includes(t.status));
      if (ci >= 0) buckets[ci].push(t);
    }
    win.setChip(`${open} open - ${review} review - ${merged} merged - ${usd(state.metrics.totalCostUsd)}`);
    syncDrawer(); // the drawer also serves the board view, so keep it live even when this window is minimized or hidden
    if (win.isMin() || ctx.view === 'board') return;
    if (fs) { syncFilterSelects(); const n = buckets.reduce((s, b, i) => s + (cols[i].id === 'cancelled' && !showCancelled ? 0 : b.length), 0); setText(count, `${n} shown`); }

    const live = new Set<string>();
    cols.forEach((c, ci) => {
      const hideCol = c.id === 'cancelled' && !showCancelled;
      setHidden(c.el, hideCol);
      if (hideCol) { for (const t of buckets[ci]) { const k = cards.get(t.id); if (k) { k.el.remove(); cards.delete(t.id); } } return; }
      let list = buckets[ci];
      if (c.id === 'merged') list = list.slice().sort((a, b) => (b.mergedAt ?? 0) - (a.mergedAt ?? 0));
      else if (c.id === 'backlog') list = list.slice().sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      const shown = list.slice(0, fs ? c.fsLimit : c.limit);
      setText(c.count, String(list.length));
      const hidden = list.length - shown.length;
      setText(c.more, hidden > 0 ? `+${hidden} more` : '');
      setHidden(c.more, hidden <= 0);
      shown.forEach((t, i) => {
        live.add(t.id);
        let k = cards.get(t.id);
        if (!k) { k = make(t); cards.set(t.id, k); }
        if (c.list.children[i] !== k.el) c.list.insertBefore(k.el, c.list.children[i] ?? null);
        const a = t.assignee ? byId.get(t.assignee) : undefined;
        setText(k.title, t.title); k.title.title = `${t.title} (${t.epic})`;
        setText(k.desc, t.description ?? '');
        setPips(k.pips, t.difficulty);
        k.dot.className = a ? `pdot ${a.provider}` : 'pdot none'; k.dot.title = a ? `${a.name} (${a.owner})` : 'unassigned';
        setText(k.rework, t.reworks ? `R${t.reworks}` : '');
        k.bar.style.width = `${Math.round(clamp(t.status === 'merged' ? 1 : t.progress, 0, 1) * 100)}%`;
        const act = t.usage?.costUsd ?? 0, est = t.estimatedCostUsd ?? 0;
        setText(k.cost, act > 0 ? `${usd(act)} / ~${usd(est)} est` : `~${usd(est)} est`);
        const ratio = est > 0 ? act / est : 0;
        k.cost.className = `cost${ratio > 1.6 ? ' bad' : ratio > 1.2 ? ' warn' : ''}`;
        setSkillChips(k.skills, t.skills, a ? a.skills : null);
        const pinned = t.pinnedTo ? byId.get(t.pinnedTo) : undefined;
        setHidden(k.pin, !t.pinnedTo); if (t.pinnedTo) k.pin.title = `Pinned to ${pinned?.name ?? t.pinnedTo}`;
        setHidden(k.prio, !t.priority); setText(k.prio, `P${t.priority > 0 ? '+' : ''}${t.priority}`);
        setHidden(k.help, !t.helpRequests); setText(k.help, `?${t.helpRequests}`);
        const ms = t.milestone ? state.hack?.milestones.find((m) => m.id === t.milestone) : undefined;
        setHidden(k.ms, !t.milestone); setText(k.ms, ms?.title ?? t.milestone ?? '');
        setHidden(k.who, !a);
        if (a) {
          k.whoDot.className = `pdot ${a.provider}`; setText(k.whoName, a.name); setText(k.whoTier, a.config.tier); k.whoTier.className = `tier ${a.provider}`; k.whoTier.title = a.config.model;
          k.whoSwatch.style.background = a.ownerColor; setText(k.whoOwner, a.owner);
        }
        toggleClass(k.el, 'mine', !!t.assignee && t.assignee === ctx.selectedId);
        toggleClass(k.el, 'done', t.status === 'merged' || t.status === 'cancelled');
        toggleClass(k.el, 'editing', drawerOpen && editId === t.id);
      });
      while (c.list.children.length > shown.length) c.list.lastElementChild!.remove();
    });
    for (const [id, k] of cards) if (!live.has(id)) { k.el.remove(); cards.delete(id); }
    void cancelColChk;
  };
  return { el: win.el, update, win, closeDrawer, openNew, openTicket, drawer };
}
