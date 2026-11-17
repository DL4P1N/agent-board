// COMMAND PALETTE: Ctrl/Cmd+K (or "/" with nothing focused). Fuzzy search over actions with multi-step flows.
import type { AgentState, Difficulty, SimState } from '../types';
import type { UICtx } from './ctx';
import { DIFF_COLORS, DIFF_NAMES, h, setText, toggleClass } from './dom';
import { icon, type IconName } from './icons';
import { agentOf, cmd, dot, fuzzy, nameOf, mmss } from './interact';
import './palette.css';
import { providerName } from '../providers';

export interface PaletteHooks {
  togglePanels(): void;
  openAbout(): void;
  /** Main view: 3D office or technical board. */
  setView?(v: 'office' | 'board'): void;
  getView?(): 'office' | 'board';
  setKeys?(on: boolean): void;
  getKeys?(): boolean;
  /** Toggle a HUD window by id ('board' | 'log' | 'metrics' | 'plan' | 'skills' | 'comms' | 'hack'). */
  toggleWindow(id: string): void;
  openComms(to?: string): void;
  openHack(focusBrief?: boolean): void;
  toast(title: string, text: string, tone?: 'ok' | 'info' | 'warn' | 'gold'): void;
  /** Optional: restore the default window layout (when the window framework exposes it). */
  resetLayout?(): void;
}

interface Item {
  id: string;
  label: string;
  sub?: string;
  hint?: string;
  group?: string;
  ico?: IconName;
  agent?: AgentState;
  keywords?: string;
  /** added to the fuzzy score (ties between similar actions) */
  boost?: number;
  /** hidden while the query is empty (reachable by typing) */
  bulk?: boolean;
  run(): Mode | void;
}
type Mode =
  | { kind: 'list'; crumb: string; placeholder: string; items: (q: string) => Item[]; filter: boolean; empty?: string }
  | { kind: 'ticket'; crumb: string };

export interface Palette { el: HTMLElement; open(initial?: string): void; close(): void; toggle(): void; isOpen(): boolean }

const GROUP_ORDER = ['Suggested', 'Tickets', 'Team', 'Skills', 'Time', 'View'];

export function createPalette(ctx: UICtx, hooks: PaletteHooks): Palette {
  const input = h('input', {
    type: 'text', class: 'pal-in', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list', 'aria-autocomplete': 'list',
    autocomplete: 'off', spellcheck: false, 'aria-label': 'Search commands', placeholder: 'Type a command, or a message for the orchestrator...',
  }) as HTMLInputElement;
  const crumb = h('span', { class: 'pal-crumb', hidden: true });
  const closeBtn = h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Close command palette', title: 'Close (Esc)' }, icon('close'));
  const listEl = h('ul', { class: 'pal-list', role: 'listbox', id: 'pal-list', 'aria-label': 'Results' });
  const formEl = h('div', { class: 'pal-form', hidden: true });
  const foot = h('div', { class: 'pal-foot dim' },
    h('span', {}, h('kbd', {}, 'Up'), h('kbd', {}, 'Down'), ' navigate'), h('span', {}, h('kbd', {}, 'Enter'), ' run'),
    h('span', {}, h('kbd', {}, 'Esc'), ' close'), h('span', { class: 'pal-foot-r' }, h('kbd', {}, 'Ctrl+Enter'), ' ask orchestrator'));
  const box = h('div', { class: 'pal-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' },
    h('div', { class: 'pal-head' }, icon('command'), crumb, input, closeBtn), listEl, formEl, foot);
  const scrim = h('div', { class: 'pal-scrim', hidden: true }, box);

  let stack: Mode[] = [];
  let shown: Item[] = [];
  let active = 0;
  let prevFocus: HTMLElement | null = null;
  let ticketTitleOk = false;

  const S = (): SimState => ctx.state;
  const top = (): Mode => stack[stack.length - 1];
  const isOpen = (): boolean => !scrim.hidden;

  // ----------------------------------------------------------------- actions
  const sendTo = (id: string, text: string): void => {
    cmd(ctx, 'say', id, text);
    hooks.openComms(id);
    ctx.refresh();
  };
  const textMode = (crumbName: string, placeholder: string, label: (q: string) => string, empty: string, run: (q: string) => void): Mode => ({
    kind: 'list', crumb: crumbName, placeholder, filter: false, empty,
    items: (q) => (q.trim() ? [{ id: 'go', label: label(q.trim()), ico: 'plane', hint: 'Enter', run: () => { run(q.trim()); } }] : []),
  });
  const messageMode = (id: string): Mode => {
    const name = nameOf(S(), id);
    return textMode(`Message ${name}`, `Type a message for ${id === 'all' ? 'the whole team' : name}, then Enter`, (q) => `Send to ${name}: ${q}`, 'Type your message...', (q) => sendTo(id, q));
  };

  const rootItems = (): Item[] => {
    const s = S();
    const set = ctx.sim.settings;
    const agents = s.agents;
    const workers = agents.filter((a) => a.role === 'worker');
    const orch = agents.find((a) => a.role === 'orchestrator');
    const paused = set.simSpeed === 0;
    const items: Item[] = [];
    const add = (i: Item): void => { items.push(i); };

    add({ id: 'ticket', group: 'Suggested', label: 'Add task...', ico: 'plus', keywords: 'new create file task ticket', run: () => ({ kind: 'ticket', crumb: 'Add task' }) });
    add({ id: 'msg-orch', group: 'Suggested', label: 'Message orchestrator...', ico: 'chat', hint: 'C', keywords: 'chat say tell orch plan', run: () => messageMode(orch?.id ?? 'orch') });
    add({ id: 'status', group: 'Suggested', label: 'Ask orchestrator for status', ico: 'orchestrator', keywords: 'status report standup progress eta', run: () => { sendTo(orch?.id ?? 'orch', 'status'); } });
    add({ id: 'kickoff', group: 'Suggested', label: 'Kick off new project...', ico: 'flag', hint: 'H', keywords: 'hackathon brief new project start replan', run: () => { hooks.openHack(true); } });
    add({ id: 'cut', group: 'Suggested', label: 'Cut scope by 2', ico: 'close', keywords: 'descope drop tasks tickets reduce', run: () => { cmd(ctx, 'say', 'orch', 'cut scope by 2'); hooks.toast('Scope', 'Asked the orchestrator to cut scope by 2', 'info'); ctx.refresh(); } });
    add({ id: 'ext', group: 'Suggested', label: 'Extend deadline +10 min', ico: 'plus', keywords: 'deadline time longer more minutes', run: () => { shiftDeadline(10); } });
    add({ id: 'ext-', group: 'Time', bulk: true, label: 'Shorten deadline -5 min', ico: 'back', keywords: 'deadline time less minutes', run: () => { shiftDeadline(-5); } });
    add({ id: 'pause', group: 'Suggested', label: paused ? 'Resume' : 'Pause', ico: paused ? 'play' : 'pause', hint: 'Space', keywords: 'pause resume play stop freeze time', run: () => { ctx.togglePause(); } });
    add({ id: 'skill-add', group: 'Suggested', label: 'Add skill...', ico: 'plus', keywords: 'new skill library cartridge create', run: () => textMode('Add skill', 'Skill name, then Enter', (q) => `Add skill "${q}"`, 'Type a skill name...', (q) => {
      const sk = cmd(ctx, 'addSkill', { name: q });
      hooks.toast('Skill added', sk?.name ?? q, 'ok'); ctx.refresh();
    }) });

    // messaging / team
    add({ id: 'msg-all', group: 'Team', bulk: true, label: 'Message everyone...', ico: 'users', keywords: 'broadcast team all chat', run: () => messageMode('all') });
    for (const a of agents) {
      if (a.role === 'orchestrator') continue;
      add({ id: `msg-${a.id}`, group: 'Team', bulk: true, label: `Message ${a.name}...`, boost: 6, sub: a.role === 'worker' ? a.owner : 'integrator', agent: a, ico: 'chat', keywords: `chat tell say ${a.provider} ${providerName(a.provider)} ${a.owner} ${a.role}`, run: () => messageMode(a.id) });
    }
    for (const a of agents) {
      if (a.role === 'integrator') continue;
      add({ id: `help-${a.id}`, group: 'Team', bulk: true, label: `Ask ${a.role === 'orchestrator' ? 'Orchestrator' : a.name} to help...`, agent: a, ico: 'plane', keywords: `help assist plane pair ${a.provider} ${providerName(a.provider)}`, run: () => ({
        kind: 'list', crumb: `${nameOf(s, a.id)} helps`, placeholder: 'Who needs help?', filter: true,
        items: () => workers.filter((w) => w.id !== a.id).map((w): Item => ({
          id: `help-${a.id}-${w.id}`, label: `Ask ${nameOf(S(), a.id)} to help ${w.name}`, agent: w, ico: 'plane', keywords: w.owner,
          run: () => { cmd(ctx, 'requestHelp', w.id, a.id); hooks.toast('Paper plane', `${w.name} -> ${nameOf(S(), a.id)}`, 'info'); ctx.refresh(); },
        })),
      }) });
    }
    for (const a of agents) {
      add({ id: `sel-${a.id}`, group: 'Team', bulk: true, label: `Select agent ${nameOf(s, a.id)}`, boost: 3, agent: a, ico: a.role === 'worker' ? 'worker' : a.role === 'orchestrator' ? 'orchestrator' : 'integrator', keywords: `inspect focus ${a.provider} ${providerName(a.provider)} ${a.owner} ${a.role}`, run: () => { ctx.select(a.id); } });
    }

    // skills
    for (const sk of s.skills ?? []) {
      add({ id: `rm-${sk.id}`, group: 'Skills', bulk: true, label: `Remove skill ${sk.name}`, sub: sk.custom ? 'custom' : 'built-in', ico: 'close', keywords: `delete library ${sk.category}`,
        run: () => { cmd(ctx, 'removeSkill', sk.id); hooks.toast('Skill removed', sk.name, 'warn'); ctx.refresh(); } });
      add({ id: `eq-${sk.id}`, group: 'Skills', bulk: true, label: `Equip ${sk.name} on...`, ico: 'plus', keywords: `give hand skill agent ${sk.category}`, run: () => ({
        kind: 'list', crumb: `Equip ${sk.name}`, placeholder: 'Which agent?', filter: true,
        items: () => S().agents.filter((a) => a.role === 'worker').map((a): Item => ({
          id: `eq-${sk.id}-${a.id}`, label: `Equip ${sk.name} on ${a.name}`, agent: a, ico: 'plus', keywords: a.owner,
          run: () => { cmd(ctx, 'equipSkill', a.id, sk.id); hooks.toast('Skill equipped', `${sk.name} on ${a.name}`, 'ok'); ctx.refresh(); },
        })),
      }) });
    }

    // time
    for (const sp of [1, 2, 4, 8]) {
      add({ id: `speed-${sp}`, group: 'Time', bulk: true, label: `Speed ${sp}x`, sub: set.simSpeed === sp ? 'current' : undefined, ico: 'play', keywords: 'faster slower simulation time', run: () => { ctx.setSettings({ simSpeed: sp }); } });
    }

    // view
    if (hooks.setView) {
      const cur = hooks.getView?.() ?? 'office';
      add({ id: 'view-board', group: 'View', label: 'Board view (technical, no 3D)', sub: cur === 'board' ? 'current' : undefined, hint: 'V', ico: 'panels', keywords: 'board table kanban 2d technical dashboard view switch flat', run: () => { hooks.setView?.('board'); } });
      add({ id: 'view-office', group: 'View', label: '3D office view', sub: cur === 'office' ? 'current' : undefined, hint: 'V', ico: 'users', keywords: 'office 3d room pixel scene view switch', run: () => { hooks.setView?.('office'); } });
    }
    if (hooks.setKeys) {
      const on = hooks.getKeys?.() ?? true;
      add({ id: 'keys', group: 'View', label: on ? 'Turn off single-key shortcuts' : 'Turn on single-key shortcuts', ico: 'command', keywords: 'keyboard shortcuts hotkeys accessibility keys', run: () => { hooks.setKeys?.(!on); } });
    }
    add({ id: 'overlays', group: 'View', label: 'Toggle overlays', ico: 'panels', hint: 'P', keywords: 'hide show panels ui hud', run: () => { hooks.togglePanels(); } });
    for (const [id, title, key] of [['comms', 'Comms', 'C'], ['hack', 'Project', 'H'], ['board', 'Task board', 'T'], ['log', 'Activity log', 'L'], ['metrics', 'Metrics', 'M'], ['plan', 'Plan', ''], ['skills', 'Skill library', '']] as const) {
      add({ id: `win-${id}`, group: 'View', bulk: true, label: `Toggle ${title} window`, hint: key, ico: 'panels', keywords: 'show hide window minimize', run: () => { hooks.toggleWindow(id); } });
    }
    add({ id: 'about', group: 'View', bulk: true, label: 'About / keyboard shortcuts', hint: '?', ico: 'help', keywords: 'help keys docs', run: () => { hooks.openAbout(); } });
    if (hooks.resetLayout) add({ id: 'layout', group: 'View', bulk: true, label: 'Reset layout', ico: 'undo', keywords: 'windows positions default', run: () => { hooks.resetLayout?.(); } });
    return items;
  };

  function shiftDeadline(deltaMin: number): void {
    const s = S();
    let remaining: number;
    if (s.hack?.active && s.hack.endsAt > 0) remaining = (s.hack.endsAt - s.time) / 60;
    else remaining = s.plan.deadlineMinutes - s.time / 60;
    const next = Math.max(1, Math.round(remaining + deltaMin));
    cmd(ctx, 'setDeadline', next);
    hooks.toast('Deadline', `${deltaMin > 0 ? '+' : ''}${deltaMin} min: ${next} min left`, 'info');
    ctx.refresh();
  }

  // ----------------------------------------------------------------- results
  const compute = (q: string): Item[] => {
    const m = top();
    if (m.kind !== 'list') return [];
    const isRoot = stack.length === 1;
    let items = isRoot ? rootItems() : m.items(q);
    const query = q.trim();
    if (m.filter || isRoot) {
      if (!query) { if (isRoot) items = items.filter((i) => !i.bulk); }
      else {
        items = items
          .map((i, n) => ({ i, n, raw: Math.max(fuzzy(query, i.label) * 2, fuzzy(query, `${i.label} ${i.sub ?? ''} ${i.keywords ?? ''}`)) }))
          .filter((x) => x.raw >= 0).map((x) => ({ ...x, s: x.raw + (x.i.boost ?? 0) }))
          .sort((a, b) => b.s - a.s || a.n - b.n).map((x) => x.i);
        // keep non-bulk results ahead of equally good bulk ones? scoring already handles; cap the list
        items = items.slice(0, 40);
      }
    }
    if (isRoot && query) {
      const free: Item = { id: 'free', label: `Send to orchestrator: ${query}`, ico: 'plane', hint: 'Ctrl+Enter', run: () => { sendTo('orch', query); } };
      if (items.length) items.push(free); else items.unshift(free);
    }
    return items;
  };

  const paintActive = (): void => {
    const rows = listEl.children;
    let activeEl: HTMLElement | null = null;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as HTMLElement;
      if (r.dataset.i === undefined) continue;
      const on = Number(r.dataset.i) === active;
      toggleClass(r, 'on', on);
      if (r.getAttribute('aria-selected') !== String(on)) r.setAttribute('aria-selected', String(on));
      if (on) activeEl = r;
    }
    if (activeEl) { input.setAttribute('aria-activedescendant', activeEl.id); activeEl.scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  };

  const render = (): void => {
    const m = top();
    const isForm = m.kind === 'ticket';
    listEl.hidden = isForm; formEl.hidden = !isForm;
    input.setAttribute('aria-expanded', String(!isForm));
    crumb.hidden = stack.length === 1;
    setText(crumb, m.crumb);
    if (isForm) { shown = []; return; }
    shown = compute(input.value);
    if (active >= shown.length) active = Math.max(0, shown.length - 1);
    const rows: HTMLElement[] = [];
    const grouped = stack.length === 1 && !input.value.trim();
    let lastGroup = '';
    const ordered = grouped ? shown.slice().sort((a, b) => GROUP_ORDER.indexOf(a.group ?? '') - GROUP_ORDER.indexOf(b.group ?? '')) : shown;
    if (grouped) shown = ordered;
    ordered.forEach((it, i) => {
      if (grouped && it.group && it.group !== lastGroup) { lastGroup = it.group; rows.push(h('li', { class: 'pal-group', role: 'presentation' }, it.group)); }
      const row = h('li', { class: 'pal-opt', role: 'option', id: `pal-opt-${i}`, 'aria-selected': 'false', dataset: { i: String(i) } },
        it.agent ? dot(it.agent.provider, it.agent.ownerColor) : h('span', { class: 'po-ico', 'aria-hidden': 'true' }, it.ico ? icon(it.ico) : null),
        h('span', { class: 'po-label' }, it.label),
        it.sub ? h('span', { class: 'po-sub dim' }, it.sub) : null,
        it.hint ? h('kbd', { class: 'po-hint' }, it.hint) : null);
      row.addEventListener('mousemove', () => { if (active !== i) { active = i; paintActive(); } });
      row.addEventListener('mousedown', (e) => e.preventDefault());
      row.addEventListener('click', () => run(i));
      rows.push(row);
    });
    if (!rows.length) rows.push(h('li', { class: 'pal-empty dim', role: 'presentation' }, (m.kind === 'list' && m.empty) || 'No matches'));
    listEl.replaceChildren(...rows);
    paintActive();
  };

  function enter(mode: Mode): void {
    stack.push(mode);
    input.value = '';
    active = 0;
    if (mode.kind === 'ticket') { buildTicketForm(); input.placeholder = 'Task title...'; }
    else input.placeholder = mode.placeholder;
    render();
    input.focus();
  }
  function back(): void {
    if (stack.length <= 1) return;
    stack.pop();
    input.value = '';
    active = 0;
    const m = top();
    input.placeholder = m.kind === 'list' && stack.length > 1 ? m.placeholder : 'Type a command, or a message for the orchestrator...';
    render();
  }
  function run(i: number): void {
    const it = shown[i];
    if (!it) return;
    const next = it.run();
    if (next) enter(next); else close();
  }

  // ----------------------------------------------------------------- ticket form
  const state = { difficulty: 3 as Difficulty, skills: new Set<string>() };
  let diffBtns: HTMLButtonElement[] = [];
  let createBtn: HTMLButtonElement;
  function createTicket(): void {
    const title = input.value.trim();
    if (!title) return;
    const t = cmd(ctx, 'createTicket', { title, difficulty: state.difficulty, skills: [...state.skills] });
    hooks.toast('Task filed', `${t?.id ?? ''} ${title}`.trim(), 'ok');
    close(); ctx.refresh();
  }
  function paintDiff(): void {
    diffBtns.forEach((b, i) => { const on = i + 1 === state.difficulty; toggleClass(b, 'on', on); b.setAttribute('aria-checked', String(on)); });
  }
  function buildTicketForm(): void {
    state.difficulty = 3; state.skills = new Set();
    diffBtns = ([1, 2, 3, 4, 5] as Difficulty[]).map((n) => h('button', {
      type: 'button', class: 'dchip', role: 'radio', 'aria-checked': 'false', style: `--c:${DIFF_COLORS[n]}`, title: `${DIFF_NAMES[n]} (difficulty ${n})`, 'aria-label': `Difficulty ${n}, ${DIFF_NAMES[n]}`,
      onClick: () => { state.difficulty = n; paintDiff(); },
    }, String(n)));
    const skillBtns = (S().skills ?? []).map((sk) => {
      const b = h('button', { type: 'button', class: 'pf-skill', 'aria-pressed': 'false', style: `--c:${sk.color}`, title: `${sk.name}: ${sk.blurb}` }, h('b', {}, sk.glyph), ' ', sk.name);
      b.addEventListener('click', () => {
        if (state.skills.has(sk.id)) state.skills.delete(sk.id); else state.skills.add(sk.id);
        const on = state.skills.has(sk.id); toggleClass(b, 'on', on); b.setAttribute('aria-pressed', String(on));
      });
      return b;
    });
    createBtn = h('button', { type: 'button', class: 'btn accent', disabled: true, onClick: createTicket }, icon('plus'), ' Create task');
    ticketTitleOk = false;
    formEl.replaceChildren(
      h('div', { class: 'pf-row' }, h('span', { class: 'pf-label' }, 'Difficulty'), h('span', { class: 'pf-diffs', role: 'radiogroup', 'aria-label': 'Difficulty' }, ...diffBtns)),
      h('div', { class: 'pf-row pf-skills' }, h('span', { class: 'pf-label' }, 'Skills'), h('span', { class: 'pf-skillset', role: 'group', 'aria-label': 'Skills needed' }, ...skillBtns)),
      h('div', { class: 'pf-row pf-actions' }, createBtn, h('span', { class: 'dim' }, 'Type a title above, then press Enter. Unpinned: the next free agent takes it.')));
    paintDiff();
  }

  // ----------------------------------------------------------------- open / close
  function open(initial = ''): void {
    if (isOpen()) { input.focus(); return; }
    prevFocus = document.activeElement as HTMLElement | null;
    stack = [{ kind: 'list', crumb: '', placeholder: '', filter: true, items: () => [] }];
    input.value = initial; active = 0;
    input.placeholder = 'Type a command, or a message for the orchestrator...';
    scrim.hidden = false;
    render();
    input.focus(); input.select();
  }
  function close(): void {
    if (!isOpen()) return;
    scrim.hidden = true;
    stack = []; shown = [];
    const p = prevFocus; prevFocus = null;
    if (p && document.contains(p) && p !== document.body) p.focus(); else (document.activeElement as HTMLElement | null)?.blur?.();
  }
  const toggle = (): void => { if (isOpen()) close(); else open(); };

  input.addEventListener('input', () => {
    if (top().kind === 'ticket') { ticketTitleOk = !!input.value.trim(); if (createBtn) createBtn.disabled = !ticketTitleOk; return; }
    active = 0; render();
  });
  closeBtn.addEventListener('click', close);
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });

  scrim.addEventListener('keydown', (e) => {
    e.stopPropagation(); // keep every other shortcut (A, P, Space...) out while the palette is up
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); close(); return; }
    if (e.isComposing) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const f = [...box.querySelectorAll<HTMLElement>('input, button, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.hidden && !(el as HTMLButtonElement).disabled && el.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
      e.preventDefault(); f[next].focus();
      return;
    }
    if (e.target !== input) return;
    const isForm = top().kind === 'ticket';
    if (e.key === 'Enter') {
      e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && input.value.trim() && !isForm) { const q = input.value.trim(); sendTo('orch', q); close(); return; }
      if (isForm) createTicket(); else run(active);
    } else if (!isForm && e.key === 'ArrowDown') { e.preventDefault(); if (shown.length) { active = (active + 1) % shown.length; paintActive(); } }
    else if (!isForm && e.key === 'ArrowUp') { e.preventDefault(); if (shown.length) { active = (active - 1 + shown.length) % shown.length; paintActive(); } }
    else if (e.key === 'Backspace' && !input.value && stack.length > 1) { e.preventDefault(); back(); }
    else if (isForm && e.altKey && /^[1-5]$/.test(e.key)) { e.preventDefault(); state.difficulty = Number(e.key) as Difficulty; paintDiff(); }
  });

  // ----------------------------------------------------------------- global shortcuts
  const editable = (t: EventTarget | null): boolean => {
    const el = t as HTMLElement | null;
    if (!el || !el.tagName) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') { const ty = (el as HTMLInputElement).type; return ty !== 'range' && ty !== 'checkbox' && ty !== 'button'; }
    return false;
  };
  window.addEventListener('keydown', (e) => {
    if (isOpen()) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); return; }
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.key === '/' || e.key === 'k' || e.key === 'K') && !editable(e.target) && !document.querySelector('dialog[open]')) { e.preventDefault(); open(); }
  });

  void agentOf; void mmss;
  return { el: scrim, open, close, toggle, isOpen };
}
