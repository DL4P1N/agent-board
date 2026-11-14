// UI controller: builds the HUD once, then diffs it at ~9 Hz. Implements UICtx for all panels.
import { type BoardCommands, DEFAULT_SETTINGS, DEFAULT_VISUAL, type AgentState, type SimEvent, type SimSettings, type SimState, type VisualSettings } from '../types';
import type { Simulation } from '../sim';
import type { LazyScene } from '../scene/LazyScene';
import type { Panel, UICtx } from './ctx';
import { clear, h, toggleClass } from './dom';
import { saveSoon, clearSaved, type Persisted, type Prefs } from './store';
import { createTopbar } from './topbar';
import { createControlPanel, SPEED_STEPS, speedIndex } from './controlPanel';
import { createAgentPanel } from './agentPanel';
import { createBoard } from './board';
import { createLog } from './log';
import { createMetrics } from './metrics';
import { createPlan, createSkillLibrary } from './planSkills';
import { createAbout } from './about';
import { Toasts } from './toasts';
import { setCatalog } from './chips';
import { attachHud, closeTopHudWindow, exitHudFullscreen, relayoutHud, resetHudLayout, BOARD_VIEW_HIDDEN, type HudWin } from './hud';
import { createTechView } from './techView';
import { createComms, type CommsPanel } from './comms';
import { createHackathon, type HackPanel } from './hackathon';
import { createPalette } from './palette';

const UPDATE_MS = 110;

export class UI implements UICtx {
  visual: VisualSettings;
  prefs: Prefs;
  state: SimState;
  selectedId: string | null = null;
  get cmd(): Partial<BoardCommands> { return this.sim as unknown as Partial<BoardCommands>; }
  private panels: Panel[] = [];
  private lastUpdate = 0;
  private force = true;
  private lastSpeed = 1;
  private toasts = new Toasts();
  private about = createAbout();
  private wins: Record<string, HudWin> = {};
  private comms!: CommsPanel;
  private hack!: HackPanel;
  private boardPanel!: { closeDrawer(): boolean; openNew(): void; openTicket(id: string): void; drawer: HTMLElement };
  private tech!: Panel;
  private selectCb: ((id: string | null) => void) | null = null;
  private mtab: 'none' | 'controls' | 'agents' | 'stats' = 'none';

  constructor(private root: HTMLElement, public sim: Simulation, public scene: LazyScene, loaded: Persisted) {
    this.visual = { ...loaded.visual };
    this.prefs = loaded.prefs;
    this.state = sim.state;
    this.applyPalette();
    document.documentElement.dataset.view = this.prefs.view;
    this.scene.whenReady(() => document.getElementById('scene')?.classList.remove('loading'));
    if (this.prefs.view === 'office') this.show3d();

    const topbar = createTopbar(this, { about: () => this.about.open(), togglePanels: () => this.togglePanels(), resetLayout: () => this.resetLayout() });
    const controls = createControlPanel(this);
    const agents = createAgentPanel(this);
    const metrics = createMetrics(this);
    const board = createBoard(this);
    const log = createLog(this);
    const plan = createPlan(this);
    const skills = createSkillLibrary(this);
    this.boardPanel = board;
    const comms = createComms(this);
    const hack = createHackathon(this);
    this.comms = comms; this.hack = hack;
    this.wins = { metrics: metrics.win, board: board.win, log: log.win, plan: plan.win, skills: skills.win, comms: comms.win, hack: hack.win };
    const tech = createTechView(this);
    this.tech = tech;
    this.panels = [topbar, controls, agents, metrics, board, log, plan, skills, comms, hack, tech];
    const palette = createPalette(this, {
      togglePanels: () => this.togglePanels(), openAbout: () => this.about.open(), resetLayout: () => this.resetLayout(),
      setView: (v) => this.setView(v), getView: () => this.view,
      setKeys: (on) => this.setKeys(on), getKeys: () => this.prefs.keys,
      toggleWindow: (id) => { if (id === 'comms') comms.toggle(); else if (id === 'hack') hack.toggle(); else this.wins[id]?.toggle(); },
      openComms: (to) => comms.open(to), openHack: (focusBrief) => (focusBrief ? hack.focusBrief() : hack.open()),
      toast: (title, text, tone = 'info') => this.toasts.push(`pal-${title}`, title, text, tone, 200),
    });

    const tab = (id: 'controls' | 'agents' | 'stats', label: string): HTMLButtonElement =>
      h('button', { type: 'button', class: 'tab', dataset: { tab: id }, onClick: () => this.setMobileTab(this.mtab === id ? 'none' : id) }, label);
    const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Panels' }, tab('controls', 'Controls'), tab('agents', 'Agents'), tab('stats', 'Stats'));
    const showPill = h('button', { type: 'button', class: 'btn show-panels', onClick: () => this.togglePanels() }, 'Panels hidden - press P');

    clear(root);
    // DOM order = reading order: skip links, top bar, the page, then the docks (keyboard users reach the board first)
    const skip = (href: string, label: string): HTMLElement => h('a', { class: 'skip-link', href, onClick: (e: Event) => {
      e.preventDefault(); const t = document.querySelector<HTMLElement>(href); if (!t) return;
      if (href === '#agents-dock' && t.classList.contains('collapsed')) (t.querySelector('.dock-pill') as HTMLElement | null)?.click();
      const f = t.matches('[tabindex]') ? t : t.querySelector<HTMLElement>('h2, [tabindex], button') ?? t; if (!f.hasAttribute('tabindex')) f.tabIndex = -1; f.focus(); } }, label);
    const skips = h('nav', { class: 'skip-links', 'aria-label': 'Skip links' }, skip('#tv-attn', 'Skip to What needs you'), skip('#tv-tickets', 'Skip to tasks'), skip('#agents-dock', 'Skip to agents'));
    agents.el.id = 'agents-dock';
    root.append(skips, topbar.el, tech.el, agents.el, controls.el, tabbar, showPill, this.toasts.el, this.toasts.live, this.about.el, palette.el);
    // windows mount themselves (free-floating layer + chip rows + mobile sheet) and keep the docks' insets in sync
    attachHud(this, root);
    this.placeDrawer();

    sim.on((e) => this.onSimEvent(e));
    window.addEventListener('keydown', (e) => this.onKey(e));
    if (this.sim.settings.simSpeed > 0) this.lastSpeed = this.sim.settings.simSpeed;
    this.update(sim.state, performance.now(), true);
  }

  // ------------------------------------------------------------------ UICtx
  setSettings(patch: Partial<SimSettings>): void {
    this.sim.setSettings(patch);
    if (patch.simSpeed !== undefined && patch.simSpeed > 0) this.lastSpeed = patch.simSpeed;
    this.persist(); this.refresh();
  }
  setVisual(patch: Partial<VisualSettings>): void {
    Object.assign(this.visual, patch);
    this.scene.setVisual({ ...this.visual });
    if (patch.palette) this.applyPalette();
    this.persist(); this.refresh();
  }
  resetVisuals(): void { this.setVisual({ ...DEFAULT_VISUAL }); }
  select(id: string | null, fromScene = false): void {
    if (id === this.selectedId) return;
    this.selectedId = id;
    if (!fromScene) this.scene.selectAgent(id);
    this.selectCb?.(id);
    this.refresh();
  }
  pick(id: string | null): void { this.select(id, true); }
  get view(): 'office' | 'board' { return this.prefs.view; }
  /** Switch between the 3D office and the technical board view. The 3D scene stops rendering in the board view. */
  setView(v: 'office' | 'board'): void {
    if (v === this.prefs.view) return;
    this.prefs.view = v;
    document.documentElement.dataset.view = v;
    if (v === 'board' && this.mtab === 'stats') this.setMobileTab('none');
    this.placeDrawer();
    if (v === 'office') this.show3d();
    relayoutHud();
    this.persist(); this.refresh();
    try { const u = new URL(location.href); if (u.searchParams.has('view')) { u.searchParams.set('view', v); history.replaceState(null, '', u); } } catch { /* ignore */ }
  }
  /** Create the WebGL office on first use. If its code can't load, fall back to the board view. */
  private show3d(): void {
    if (!this.scene.ready) document.getElementById('scene')?.classList.add('loading');
    void this.scene.ensure().then((s) => {
      if (!s) {
        document.getElementById('scene')?.classList.remove('loading');
        this.toasts.push('webgl', '3D office did not load', 'Its code could not be fetched (offline?). Staying on the board view', 'warn', 1000);
        this.setView('board');
        return;
      }
      requestAnimationFrame(() => s.resize());
    });
  }
  /** Turn single-key shortcuts on or off. */
  setKeys(on: boolean): void { this.prefs.keys = on; this.persist(); this.toasts.push('keys', on ? 'Shortcuts on' : 'Shortcuts off', on ? 'Single-key shortcuts like V and C work again' : 'Only Ctrl+K and Esc respond now', 'info', 200); }
  openTicket(id: string): void { this.boardPanel.openTicket(id); }
  openAbout(): void { this.about.open(); }
  openNewTicket(): void { this.boardPanel.openNew(); }
  onSelect(cb: (id: string | null) => void): void { this.selectCb = cb; }
  togglePause(): void {
    const s = this.sim.settings.simSpeed;
    if (s > 0) { this.lastSpeed = s; this.setSettings({ simSpeed: 0 }); } else this.setSettings({ simSpeed: this.lastSpeed || 1 });
  }
  bumpSpeed(dir: 1 | -1): void {
    const i = Math.max(1, Math.min(SPEED_STEPS.length - 1, speedIndex(this.sim.settings.simSpeed || this.lastSpeed) + dir));
    this.setSettings({ simSpeed: SPEED_STEPS[i] });
  }
  savePrefs(): void { this.persist(); }
  refresh(): void { this.force = true; }
  agent(id: string | null): AgentState | undefined { return id ? this.state.agents.find((a) => a.id === id) : undefined; }
  resetAll(): void {
    clearSaved();
    this.selectedId = null; this.scene.selectAgent(null);
    this.sim.reset({ ...DEFAULT_SETTINGS, manualConfig: { ...DEFAULT_SETTINGS.manualConfig } });
    this.lastSpeed = 1;
    this.persist(); this.refresh();
  }
  resetLayout(): void { resetHudLayout(); this.toasts.push('layout', 'Layout reset', 'Panels and windows are back in their default places', 'info', 1000); }
  restart(): void { this.sim.reset(); this.selectedId = null; this.scene.selectAgent(null); this.refresh(); }

  // ------------------------------------------------------------------ internals
  private persist(): void {
    saveSoon(() => ({ settings: this.sim.settings, visual: this.visual, prefs: this.prefs }));
  }
  /** The ticket drawer lives in the ticket window in the office view and in the board view's page otherwise. */
  private placeDrawer(): void {
    const d = this.boardPanel.drawer;
    const host = this.prefs.view === 'board' ? this.tech.el.parentElement ?? this.root : this.wins.board.el.querySelector('.win-full') ?? this.wins.board.el;
    if (d.parentElement !== host) host.appendChild(d);
    d.classList.toggle('tv-drawer', this.prefs.view === 'board');
  }
  private applyPalette(): void { document.documentElement.dataset.palette = this.visual.palette; }

  private togglePanels(): void {
    const el = document.documentElement;
    el.dataset.panels = el.dataset.panels === 'hidden' ? 'shown' : 'hidden';
  }
  private setMobileTab(t: 'none' | 'controls' | 'agents' | 'stats'): void {
    this.mtab = t;
    document.documentElement.dataset.mtab = t;
    this.root.querySelectorAll('.tab').forEach((b) => toggleClass(b, 'on', (b as HTMLElement).dataset.tab === t));
  }

  private onSimEvent(e: SimEvent): void {
    const name = (id: string): string => this.state.agents.find((a) => a.id === id)?.name ?? id;
    switch (e.type) {
      case 'pr_merged': this.toasts.push('merged', 'Merged to main', `${e.ticket.id} ${e.ticket.title} (${name(e.agentId)})`, 'gold', 1200, true); break;
      case 'pr_rejected': this.toasts.push('rejected', 'Sent back', `${e.ticket.id} needs changes (${name(e.agentId)})`, 'bad', 2500); break;
      case 'compaction': this.toasts.push('compaction', 'Context compacted', `${name(e.agentId)} hit the autocompact threshold`, 'info', 6000); break;
      case 'plan_updated': this.toasts.push('plan', 'Plan updated', e.plan.note || e.plan.name, 'info', 4000); break;
      case 'budget_warning': this.toasts.push('budget', 'Budget warning (est.)', `${Math.round(e.usedPct > 5 ? e.usedPct : e.usedPct * 100)}% of the budget is spent`, 'warn', 8000); break;
      case 'help_requested': {
        const r = e.request; const to = r.toAgent === 'orch' ? 'the orchestrator' : name(r.toAgent);
        this.toasts.push('help', 'Help requested', `${name(r.fromAgent)} asks ${to} for help${r.ticketId ? ` on ${r.ticketId}` : ''}`, 'warn', 2500); break;
      }
      case 'help_answered': {
        const r = e.request; this.toasts.push('help-ans', 'Help answered', `${r.toAgent === 'orch' ? 'The orchestrator' : name(r.toAgent)} replied to ${name(r.fromAgent)}`, 'ok', 2500); break;
      }
      case 'milestone_done': {
        const ms = this.state.hack?.milestones?.find((m) => m.id === e.milestoneId);
        this.toasts.push('milestone', 'Milestone reached', ms?.title ?? e.milestoneId, 'gold', 1500, true); break;
      }
      case 'hack_stage': {
        this.toasts.push('stage', 'Hackathon stage', `Now in: ${e.stage}`, 'info', 3000); break;
      }
      case 'chat': {
        const m = e.message;
        if (m.from === 'you' || m.kind === 'system') break;
        const comms = document.querySelector('[data-win="comms"]');
        const open = comms && !comms.classList.contains('min') && document.documentElement.dataset.panels !== 'hidden';
        if (!open) this.toasts.push('chat', m.from === 'orch' ? 'Orchestrator' : name(m.from), m.text, 'info', 2500);
        break;
      }
      default: break;
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    if (this.about.isOpen()) return;
    const t = e.target as HTMLElement | null;
    const tag = t?.tagName ?? '';
    if (e.key === 'Escape') {
      if (this.boardPanel.closeDrawer()) return;
      if (exitHudFullscreen()) return;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { t?.blur(); return; }
      if (closeTopHudWindow(this.view === 'board' ? BOARD_VIEW_HIDDEN : [])) return; // Esc closes the window on top
      this.select(null); return;
    }
    if (!this.prefs.keys) return; // single-key shortcuts switched off (Ctrl+K and Esc still work)
    if (tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (tag === 'INPUT' && (t as HTMLInputElement).type !== 'range' && (t as HTMLInputElement).type !== 'checkbox') return;
    const k = e.key;
    if (k === ' ' || k === 'Spacebar') {
      if (tag === 'BUTTON' || tag === 'INPUT' && (t as HTMLInputElement).type === 'checkbox') return; // let focused controls handle Space
      e.preventDefault(); this.togglePause();
    } else if (k === '[') this.bumpSpeed(-1);
    else if (k === ']') this.bumpSpeed(1);
    else if (k === 'v' || k === 'V') this.setView(this.view === 'office' ? 'board' : 'office');
    else if (this.view === 'board' && 'fFtTlLmM'.includes(k)) return; // those windows are part of the board view itself
    else if (k === 'f' || k === 'F') this.wins.board.setFullscreen(!this.wins.board.isFullscreen());
    else if (k === 'R') this.resetLayout();
    else if (k === 'p' || k === 'P') this.togglePanels();
    else if (k === 't' || k === 'T') this.wins.board.toggle();
    else if (k === 'l' || k === 'L') this.wins.log.toggle();
    else if (k === 'm' || k === 'M') this.wins.metrics.toggle();
    else if (k === 'c' || k === 'C') { e.preventDefault(); this.comms.toggle(); }
    else if (k === 'h' || k === 'H') { e.preventDefault(); this.hack.toggle(); }
    else if (k === '?') this.about.open();
  }

  // ------------------------------------------------------------------ frame hook
  update(state: SimState, nowMs: number, force = false): void {
    this.state = state;
    if (!force && !this.force && nowMs - this.lastUpdate < UPDATE_MS) return;
    this.lastUpdate = nowMs; this.force = false;
    setCatalog(state.skills);
    for (const p of this.panels) p.update(state);
  }
}
