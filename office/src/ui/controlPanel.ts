// LEFT DOCK: scenario + control panel. Every slider maps 1:1 onto SimSettings / VisualSettings.
import { DEFAULT_SETTINGS, DEFAULT_VISUAL, type AgentConfig, type Difficulty, type SimSettings, type SimState, type VisualSettings } from '../types';
import type { Panel, UICtx } from './ctx';
import { DIFF_COLORS, DIFF_NAMES, clamp, h, pips, section, segmented, selectRow, sliderRow, switchRow, setAttr, setText, toggleClass, fillSelect, type Section, type SliderRow } from './dom';
import { icon } from './icons';
import { EFFORTS, allModels, configForDifficulty, findModel } from './models';
import { dock } from './hud';
import { usd } from './format';
import { PROVIDERS, PROVIDER_IDS, fleetCounts, mixShares, type ProviderId } from '../providers';

const SPEED_STEPS = [0, 0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8];
export const speedIndex = (v: number): number => {
  let best = 0;
  for (let i = 0; i < SPEED_STEPS.length; i++) if (Math.abs(SPEED_STEPS[i] - v) < Math.abs(SPEED_STEPS[best] - v)) best = i;
  return best;
};
export { SPEED_STEPS };

const PRESETS: { id: string; label: string; hint: string; patch: Partial<SimSettings> }[] = [
  { id: 'calm', label: 'Calm morning', hint: '4 agents, a trickle of easy tickets, friendly reviews.',
    patch: { workerCount: 4, ticketsPerMinute: 0.8, meanDifficulty: 2, difficultySpread: 0.6, rejectRate: 0.1, blockRate: 0.03, totalScope: 16, deadlineMinutes: 60, workSpeed: 1, budgetUsd: 80 } },
  { id: 'sprint', label: 'Sprint crunch', hint: '12 agents, 5 tickets a minute, hard tickets, tight deadline.',
    patch: { workerCount: 12, ticketsPerMinute: 5, meanDifficulty: 3.8, difficultySpread: 1.2, totalScope: 48, deadlineMinutes: 30, rejectRate: 0.3, blockRate: 0.15, workSpeed: 1.2, budgetUsd: 300 } },
  { id: 'review', label: 'Review bottleneck', hint: 'Strict integrator (60% rejected): watch rework pile up at one desk.',
    patch: { workerCount: 10, ticketsPerMinute: 3, meanDifficulty: 3, difficultySpread: 1, rejectRate: 0.6, blockRate: 0.1, totalScope: 30, deadlineMinutes: 45 } },
  { id: 'flaky', label: 'Flaky CI & missing keys', hint: '40% of tickets hit a blocker: agents sit BLOCKED waiting for secrets or CI.',
    patch: { workerCount: 6, ticketsPerMinute: 2, meanDifficulty: 3, rejectRate: 0.2, blockRate: 0.4, totalScope: 24, deadlineMinutes: 50 } },
  { id: 'tiny', label: 'Tiny team', hint: 'Just 2 agents working a small scope.',
    patch: { workerCount: 2, ticketsPerMinute: 1, meanDifficulty: 2.5, difficultySpread: 0.8, rejectRate: 0.2, blockRate: 0.08, totalScope: 10, deadlineMinutes: 30, budgetUsd: 40 } },
];

export function createControlPanel(ctx: UICtx): Panel {
  const d = dock(ctx, 'controls', 'Control room', 'left');
  const st = (): SimSettings => ctx.sim.settings;
  const sections: Record<string, Section> = {};
  const rows: { row: SliderRow; read: () => number }[] = [];
  const numRow = (k: keyof SimSettings, o: { label: string; min: number; max: number; step: number; unit?: string; fmt?: (v: number) => string; hint?: string }): SliderRow => {
    const r = sliderRow({ ...o, value: st()[k] as number, def: DEFAULT_SETTINGS[k] as number, idPrefix: String(k), onInput: (v) => ctx.setSettings({ [k]: v } as Partial<SimSettings>) });
    rows.push({ row: r, read: () => st()[k] as number });
    return r;
  };
  const sec = (id: string, title: string, desc: string | null, ...kids: (Node | null)[]): Section => {
    const s = section(title, desc, ctx.prefs.open[id] ?? false, (o) => { ctx.prefs.open[id] = o; ctx.savePrefs(); }, ...kids);
    sections[id] = s;
    return s;
  };

  // --- Scenarios ------------------------------------------------------------------------------
  const presetBtns = PRESETS.map((p) => h('button', { type: 'button', class: 'btn preset', title: p.hint, onClick: () => { ctx.setSettings(p.patch); } }, p.label));
  const scenarios = sec('scenarios', 'Scenarios', 'One click sets a whole situation. Then tweak any slider below.',
    h('div', { class: 'preset-grid' }, ...presetBtns),
    h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn', title: 'Restart the simulation with the current settings', onClick: () => ctx.restart() }, 'Restart'),
      h('button', { type: 'button', class: 'btn warn', title: 'Restore all sliders to their defaults and restart', onClick: () => ctx.resetAll() }, 'Reset')));

  // --- Fleet ----------------------------------------------------------------------------------
  const wc = numRow('workerCount', { label: 'Agents (cubicles)', min: 1, max: 12, step: 1, unit: 'agents', hint: 'How many agents are connected to the room.' });
  // fleet mix: one weight per tool; the agents are split in proportion (0 = none of that tool)
  const counts = (): Record<ProviderId, number> => fleetCounts(st().workerCount, st().fleetMix);
  const fmtCount = (id: ProviderId) => (v: number): string => { const n = counts()[id]; return v <= 0 ? 'none' : `${n} agent${n === 1 ? '' : 's'}`; };
  const mixRows = PROVIDER_IDS.map((id) => {
    const p = PROVIDERS[id];
    const row = sliderRow({ label: p.name, min: 0, max: 10, step: 1, value: st().fleetMix[id], def: DEFAULT_SETTINGS.fleetMix[id], idPrefix: `mix-${id}`,
      hint: `How much of the fleet runs ${p.name}. The agents are split in proportion to these weights.`, fmt: fmtCount(id),
      onInput: (v) => ctx.setSettings({ fleetMix: { ...st().fleetMix, [id]: v } }) });
    row.el.classList.add('mix-row'); row.el.style.setProperty('--pc', `var(--p-${id})`);
    row.el.querySelector('.sl-label')?.prepend(h('i', { class: `pdot ${id}` }), ' ');
    return { id, row };
  });
  const mixSummary = h('p', { class: 'sec-desc mix-sum' });
  const mixBox = h('div', { class: 'mix', role: 'group', 'aria-label': 'Fleet mix by tool' }, h('div', { class: 'mix-h' }, 'Tools in the room'), mixSummary, ...mixRows.map((m) => m.row.el));
  const legend = h('div', { class: 'owners', 'aria-label': 'Contributors' });
  const fleet = sec('fleet', 'Fleet', 'Each contributor brings their own agents, in whatever tool they use: Claude Code, Codex, GitHub Copilot, Gemini CLI, Cursor or any MCP tool.', wc.el, mixBox, legend);

  // --- Workload -------------------------------------------------------------------------------
  const chips = ([1, 2, 3, 4, 5] as Difficulty[]).map((n) => h('button', { type: 'button', class: 'dchip', style: `--c:${DIFF_COLORS[n]}`, title: `Add a ${DIFF_NAMES[n]} ticket (difficulty ${n})`, 'aria-label': `Add difficulty ${n} ticket`, onClick: () => { ctx.sim.addTicket(n); ctx.refresh(); } }, String(n)));
  const addRow = h('div', { class: 'add-ticket' },
    h('span', { class: 'at-label' }, '+ ticket'), ...chips,
    h('button', { type: 'button', class: 'btn tiny', title: 'Add a ticket with a random difficulty', onClick: () => { ctx.sim.addTicket(); ctx.refresh(); } }, 'any'));
  const budget = numRow('budgetUsd', { label: 'Budget (est.)', min: 0, max: 500, step: 5, hint: 'Soft cap on estimated spend. The orchestrator warns at 80% and downshifts models above 100%. 0 = unlimited.', fmt: (v) => (v === 0 ? 'unlimited' : usd(v)) });
  const workload = sec('workload', 'Workload', 'What the Orchestrator plans: how fast tickets arrive, how hard they are and how much money and time there is.',
    numRow('ticketsPerMinute', { label: 'Ticket rate', min: 0, max: 6, step: 0.1, unit: '/ min', hint: 'New tickets the orchestrator files per minute.' }).el,
    numRow('meanDifficulty', { label: 'Mean difficulty', min: 1, max: 5, step: 0.1, hint: 'Average difficulty 1 (trivial) .. 5 (epic).' }).el,
    numRow('difficultySpread', { label: 'Difficulty spread', min: 0, max: 2, step: 0.1, hint: 'How varied the tickets are.' }).el,
    numRow('totalScope', { label: 'Total scope', min: 4, max: 60, step: 1, unit: 'tickets', hint: 'Tickets in the plan.' }).el,
    numRow('deadlineMinutes', { label: 'Deadline', min: 5, max: 120, step: 1, unit: 'min', hint: 'Sim minutes from the start.' }).el,
    budget.el, addRow);

  // --- Behaviour ------------------------------------------------------------------------------
  const behaviour = sec('behaviour', 'Behaviour', 'How agents move and how picky the Integrator is.',
    numRow('workSpeed', { label: 'Work speed', min: 0.25, max: 4, step: 0.05, unit: 'x', hint: 'Agent productivity multiplier.' }).el,
    numRow('walkSpeed', { label: 'Walk speed', min: 0.5, max: 3, step: 0.1, unit: 'x', hint: 'How fast agents walk between stations.' }).el,
    numRow('helpRate', { label: 'Peer help', min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, hint: 'How often stuck agents throw a paper airplane to a teammate.' }).el,
    numRow('rejectRate', { label: 'Integrator strictness', min: 0, max: 0.7, step: 0.01, fmt: (v) => `${Math.round(v * 100)}% sent back`, hint: 'Chance a PR is sent back for changes.' }).el,
    numRow('blockRate', { label: 'Blocker chance', min: 0, max: 0.5, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%`, hint: 'Missing secrets / flaky CI: a ticket gets stuck.' }).el);

  // --- Time -----------------------------------------------------------------------------------
  const speed = sliderRow({
    label: 'Sim speed', min: 0, max: SPEED_STEPS.length - 1, step: 1, value: st().simSpeed, def: 1, idPrefix: 'simSpeed',
    toPos: speedIndex, fromPos: (i) => SPEED_STEPS[clamp(Math.round(i), 0, SPEED_STEPS.length - 1)],
    fmt: (v) => (v === 0 ? 'paused' : `${v}x`), hint: 'Time multiplier (0 = paused). Shortcuts: [ slower, ] faster, Space pause.',
    onInput: (v) => ctx.setSettings({ simSpeed: v }),
  });
  rows.push({ row: speed, read: () => st().simSpeed });
  const pauseBtn = h('button', { type: 'button', class: 'btn', onClick: () => ctx.togglePause() });
  const time = sec('time', 'Time', 'Speed the office up to watch a whole sprint, or pause to inspect.', speed.el, h('div', { class: 'btn-row' }, pauseBtn));

  // --- Agent config policy --------------------------------------------------------------------
  const mode = segmented<'auto' | 'manual'>([{ value: 'auto', label: 'Auto by difficulty' }, { value: 'manual', label: 'Manual' }], st().configMode, (v) => ctx.setSettings({ configMode: v }), 'Agent configuration mode');

  const tbl = h('div', { class: 'cfg-table', role: 'table', 'aria-label': 'Difficulty to agent configuration' });
  const th = (t: string): HTMLElement => h('span', { class: 'cfg-h', role: 'columnheader' }, t);
  tbl.appendChild(h('div', { class: 'cfg-row head', role: 'row' }, th('Diff'), th('Model per tool in use'), th('Autocompact buffer'), th('Subagents'), th('Effort')));
  const cfgRows: HTMLElement[] = [];
  const cfgModels: HTMLElement[] = [];
  for (let n = 1; n <= 5; n++) {
    const c = configForDifficulty('claude', n);
    const models = h('span', { class: 'cfg-models' });
    cfgModels.push(models);
    const row = h('div', { class: 'cfg-row', role: 'row', dataset: { d: String(n) }, title: `Difficulty ${n} (${DIFF_NAMES[n]})` },
      h('span', { class: 'cfg-d' }, pips(n)),
      models,
      h('span', { class: 'cfg-buf', title: `${c.autocompactBuffer}% of the context window is kept free before auto-compaction fires` },
        h('span', { class: 'bar' }, h('i', { style: `width:${Math.round((c.autocompactBuffer / 50) * 100)}%` })), h('b', {}, `${c.autocompactBuffer}%`)),
      h('span', { class: 'cfg-sub', title: `up to ${c.subagents} parallel subagents` }, icon('bot'), h('b', {}, `x${c.subagents}`)),
      h('span', { class: 'cfg-eff' }, c.effort));
    cfgRows.push(row); tbl.appendChild(row);
  }
  const autoBox = h('div', { class: 'auto-box' }, tbl,
    h('p', { class: 'note' }, 'Harder tickets get a stronger model, a bigger autocompact buffer and more subagents. They also get tagged with more skills the agent must fetch from the Skill Library.'),
    h('p', { class: 'note hl-note' }, 'Highlighted row: the difficulty most agents are working on right now.'));

  const mc = (): AgentConfig => st().manualConfig;
  const mcPatch = (p: Partial<AgentConfig>): void => ctx.setSettings({ manualConfig: { ...mc(), ...p } });
  const mModel = selectRow('Model', [], mc().model, (v) => { const m = findModel(v); mcPatch({ model: v, tier: m?.tier ?? mc().tier }); }, 'mcmodel');
  fillSelect(mModel.select, allModels().map((m) => ({ value: m.model, label: `${m.model} (${m.tier})`, group: PROVIDERS[m.provider].name })));
  mModel.select.value = mc().model;
  const mBuf = sliderRow({ label: 'Autocompact buffer', min: 5, max: 50, step: 1, unit: '%', value: mc().autocompactBuffer, def: DEFAULT_SETTINGS.manualConfig.autocompactBuffer, idPrefix: 'mcbuf', hint: 'Share of the context window kept free before auto-compaction.', onInput: (v) => mcPatch({ autocompactBuffer: v }) });
  const mSub = sliderRow({ label: 'Subagents', min: 0, max: 8, step: 1, value: mc().subagents, def: DEFAULT_SETTINGS.manualConfig.subagents, idPrefix: 'mcsub', hint: 'Max parallel subagents each agent may spawn.', onInput: (v) => mcPatch({ subagents: v }) });
  const mEff = selectRow('Effort', EFFORTS.map((e) => ({ value: e, label: e })), mc().effort, (v) => mcPatch({ effort: v as AgentConfig['effort'] }), 'mceff');
  const manualBox = h('div', { class: 'manual-box' }, mModel.el, mBuf.el, mSub.el, mEff.el, h('p', { class: 'note' }, 'Applies to every agent, regardless of ticket difficulty.'));

  const config = sec('config', 'Agent config policy', 'Does each ticket pick its own model, autocompact buffer and subagents, or do you pin one config for everybody?', mode.el, autoBox, manualBox);

  // --- Visuals --------------------------------------------------------------------------------
  const vrows: { set: (v: VisualSettings) => void }[] = [];
  const vNum = (k: 'pixelSize' | 'dither' | 'orbitSpeed' | 'focus', o: { label: string; min: number; max: number; step: number; unit?: string; fmt?: (v: number) => string; hint?: string }): HTMLElement => {
    const r = sliderRow({ ...o, value: ctx.visual[k], def: DEFAULT_VISUAL[k], idPrefix: k, onInput: (v) => ctx.setVisual({ [k]: v } as Partial<VisualSettings>) });
    vrows.push({ set: (v) => r.set(v[k]) });
    return r.el;
  };
  const vSw = (k: 'autoOrbit' | 'showLabels' | 'showBubbles' | 'showPaths', label: string, hint?: string): HTMLElement => {
    const r = switchRow(label, ctx.visual[k], (v) => ctx.setVisual({ [k]: v } as Partial<VisualSettings>), hint, k);
    vrows.push({ set: (v) => r.set(v[k]) });
    return r.el;
  };
  const palette = selectRow('Palette', [{ value: 'dusk', label: 'Dusk' }, { value: 'day', label: 'Day' }, { value: 'night', label: 'Night' }, { value: 'terminal', label: 'Terminal' }], ctx.visual.palette, (v) => ctx.setVisual({ palette: v as VisualSettings['palette'] }), 'palette');
  vrows.push({ set: (v) => palette.set(v.palette) });
  const quality = segmented<'low' | 'high'>([{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }], ctx.visual.quality, (v) => ctx.setVisual({ quality: v }), 'Render quality');
  vrows.push({ set: (v) => quality.set(v.quality) });
  const visuals = sec('visuals', 'Visuals', 'Camera and pixel-art rendering. These never change the simulation.',
    vNum('pixelSize', { label: 'Pixel size', min: 1, max: 8, step: 1, unit: 'px', hint: 'Size of one rendered pixel on screen.' }),
    vNum('dither', { label: 'Dither', min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, hint: 'Bayer dither strength.' }),
    palette.el,
    vSw('autoOrbit', 'Auto-orbit camera'),
    vNum('orbitSpeed', { label: 'Orbit speed', min: 0, max: 2, step: 0.05, unit: 'x' }),
    vNum('focus', { label: 'Focus on selected', min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, hint: 'Zoom the camera towards the selected agent (select one first).' }),
    vSw('showLabels', 'Name labels'), vSw('showBubbles', 'Speech bubbles'), vSw('showPaths', 'Walking paths'),
    h('div', { class: 'se-row' }, h('span', { class: 'se-label' }, 'Quality'), quality.el),
    h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn', onClick: () => ctx.resetVisuals() }, 'Reset visuals')));

  void [scenarios, fleet, workload, behaviour, time, config, visuals];
  d.body.append(scenarios.el, fleet.el, workload.el, time.el, config.el, behaviour.el, visuals.el);

  // --- update ---------------------------------------------------------------------------------
  let mixSig = '', ownersSig = '', lastMode = '', lastHL = 0, lastPaused: boolean | null = null;
  const update = (state: SimState): void => {
    for (const r of rows) r.row.set(r.read());
    for (const v of vrows) v.set(ctx.visual);
    const s = st();
    const ms = `${s.workerCount}|${PROVIDER_IDS.map((id) => s.fleetMix[id]).join(',')}`;
    if (ms !== mixSig) {
      mixSig = ms;
      const c = counts(), sh = mixShares(s.fleetMix);
      for (const m of mixRows) { m.row.set(s.fleetMix[m.id]); m.row.setFormat(fmtCount(m.id)); toggleClass(m.row.el, 'off', s.fleetMix[m.id] <= 0); }
      const used = PROVIDER_IDS.filter((id) => c[id] > 0);
      setText(mixSummary, used.length ? used.map((id) => `${c[id]} ${PROVIDERS[id].short}`).join(' / ') : 'No agents');
      // config table: show the model each tool in use would pick at every difficulty
      const shown = PROVIDER_IDS.filter((id) => sh[id] > 0);
      cfgModels.forEach((box, i) => box.replaceChildren(...shown.map((id) => { const cf = configForDifficulty(id, i + 1); return h('span', { class: `tier ${id}`, title: `${PROVIDERS[id].name}: ${cf.model}` }, cf.tier); })));
    }
    mode.set(s.configMode);
    if (lastMode !== s.configMode) { lastMode = s.configMode; autoBox.hidden = s.configMode !== 'auto'; manualBox.hidden = s.configMode !== 'manual'; }
    if (document.activeElement !== mModel.select) mModel.select.value = mc().model;
    mBuf.set(mc().autocompactBuffer); mSub.set(mc().subagents); mEff.set(mc().effort);
    const paused = s.simSpeed === 0;
    if (paused !== lastPaused) { lastPaused = paused; pauseBtn.replaceChildren(icon(paused ? 'play' : 'pause'), paused ? ' Resume' : ' Pause'); }

    // contributors legend (diffed)
    const workers = state.agents.filter((a) => a.role === 'worker');
    const sig = workers.map((a) => `${a.owner}|${a.ownerColor}|${a.provider}|${a.phase === 'offline' ? 0 : 1}`).join(';');
    if (sig !== ownersSig) {
      ownersSig = sig;
      const byOwner = new Map<string, { color: string; list: typeof workers }>();
      for (const a of workers) { const e = byOwner.get(a.owner) ?? { color: a.ownerColor, list: [] }; e.list.push(a); byOwner.set(a.owner, e); }
      legend.replaceChildren(...[...byOwner.entries()].map(([name, e]) => h('div', { class: 'owner' },
        h('i', { class: 'swatch', style: `background:${e.color || 'var(--muted)'}` }), h('span', { class: 'owner-name' }, name),
        h('span', { class: 'owner-dots' }, ...e.list.map((a) => h('i', { class: `pdot ${a.provider}${a.phase === 'offline' ? ' off' : ''}`, title: `${a.name} (${PROVIDERS[a.provider].name})` }))))));
      if (!byOwner.size) legend.replaceChildren(h('span', { class: 'note' }, 'No agents connected yet.'));
    }

    // highlight the most common difficulty among live tickets
    const count = [0, 0, 0, 0, 0, 0];
    let any = false;
    for (const t of state.tickets) if (t.status !== 'merged' && t.status !== 'backlog') { count[t.difficulty]++; any = true; }
    if (!any) for (const t of state.tickets) if (t.status !== 'merged') { count[t.difficulty]++; any = true; }
    let hl = Math.round(clamp(s.meanDifficulty, 1, 5));
    if (any) { let b = 1; for (let n = 2; n <= 5; n++) if (count[n] > count[b]) b = n; hl = b; }
    if (hl !== lastHL || lastHL === 0) { lastHL = hl; cfgRows.forEach((r, i) => toggleClass(r, 'hl', i + 1 === hl)); }
    setAttr(autoBox, 'data-hl', String(hl));
    void setText;
  };
  return { el: d.el, update };
}
