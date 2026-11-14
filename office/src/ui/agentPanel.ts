// RIGHT DOCK: roster of all agents, or the inspector for the selected one.
import type { AgentConfig, AgentOverride, AgentState, Provider, SimState, Ticket } from '../types';
import { SKILL_SLOTS } from '../skills';
import type { Panel, UICtx } from './ctx';
import { clamp, fillSelect, h, pips, segmented, selectRow, setAttr, setHidden, setPips, setStyle, setText, sliderRow, switchRow, toggleClass } from './dom';
import { icon, type IconName } from './icons';
import { dock } from './hud';
import { setSkillChips, setSkillSlots, skillChip, skillById } from './chips';
import { EFFORTS, allModels, findModel } from './models';
import { phaseInfo, tokens, usd, STATUS_LABEL } from './format';
import { PROVIDERS, PROVIDER_IDS } from '../providers';

const ROLE_ICON: Record<string, IconName> = { worker: 'worker', orchestrator: 'orchestrator', integrator: 'integrator' };
const ROLE_LABEL: Record<string, string> = { worker: 'Worker', orchestrator: 'Orchestrator', integrator: 'Integrator' };

interface RosterRow { el: HTMLButtonElement; dot: HTMLElement; phase: HTMLElement; tier: HTMLElement; cost: HTMLElement; ticket: HTMLElement; swatch: HTMLElement; owner: HTMLElement; skills: HTMLElement }

function kv(label: string, title?: string): { row: HTMLElement; v: HTMLElement } {
  const v = h('b', {});
  return { row: h('div', { class: 'kv', title: title ?? '' }, h('span', {}, label), v), v };
}

export function createAgentPanel(ctx: UICtx): Panel {
  const d = dock(ctx, 'agents', 'Agents', 'right');

  // ---------------------------------------------------------------- roster
  const rosterSummary = h('p', { class: 'sec-desc' });
  const rosterList = h('div', { class: 'roster', role: 'list' });
  const rosterView = h('div', { class: 'roster-view' }, rosterSummary, rosterList,
    h('p', { class: 'note' }, 'Click an agent here or in the office to inspect it and override its config.'));
  const rows = new Map<string, RosterRow>();

  const makeRow = (a: AgentState): RosterRow => {
    const dot = h('i', { class: 'pdot' });
    const phase = h('span', { class: 'chip' });
    const tier = h('span', { class: 'tier' });
    const cost = h('span', { class: 'r-cost' });
    const ticket = h('span', { class: 'r-ticket' });
    const swatch = h('i', { class: 'swatch' });
    const owner = h('span', { class: 'r-owner' });
    const skills = h('span', { class: 'skill-slots sm' });
    const el = h('button', { type: 'button', class: 'r-row', role: 'listitem', onClick: () => ctx.select(a.id) },
      h('span', { class: 'r-top' }, dot, h('span', { class: 'r-role' }, icon(ROLE_ICON[a.role] ?? 'worker')), h('span', { class: 'r-name' }, a.name), phase),
      h('span', { class: 'r-sub' }, swatch, owner, tier, cost, ticket),
      a.role === 'worker' ? h('span', { class: 'r-skills' }, skills) : null);
    return { el, dot, phase, tier, cost, ticket, swatch, owner, skills };
  };

  // ---------------------------------------------------------------- inspector
  const back = h('button', { type: 'button', class: 'btn tiny back', onClick: () => ctx.select(null) }, icon('back'), ' Roster');
  const iName = h('h3', { class: 'i-name' });
  const iProv = h('span', { class: 'prov' });
  const iRole = h('span', { class: 'i-role' });
  const iSwatch = h('i', { class: 'swatch' });
  const iOwner = h('span', {});
  const iModel = h('code', { class: 'i-model' });
  const iTier = h('span', { class: 'tier' });
  const iPhase = h('span', { class: 'chip' });
  const iProgFill = h('i', {});
  const iProg = h('div', { class: 'bar prog', role: 'progressbar', 'aria-label': 'Phase progress', 'aria-valuemin': '0', 'aria-valuemax': '100' }, iProgFill);
  const iHelp = h('div', { class: 'i-help note' });
  const header = h('div', { class: 'i-header' },
    h('div', { class: 'i-title' }, iName, iProv),
    h('div', { class: 'i-meta' }, icon('worker'), iRole, h('span', { class: 'owner-line' }, iSwatch, h('span', { class: 'dim' }, 'owner'), iOwner)),
    h('div', { class: 'i-modelline' }, iModel, iTier),
    h('div', { class: 'i-phase' }, iPhase, iProg), iHelp);

  // ticket card
  const tId = h('b', { class: 'tk-id' });
  const tTitle = h('span', { class: 'tk-title' });
  const tPips = pips(0);
  const tStatus = h('span', { class: 'chip mute' });
  const tRework = h('span', { class: 'dim' });
  const tCost = h('span', { class: 'cost' });
  const tSkills = h('span', { class: 'skill-row' });
  const tProgFill = h('i', {});
  const ticketCard = h('div', { class: 'card ticket-card' },
    h('div', { class: 'card-h' }, 'Current ticket'),
    h('div', { class: 'tk-line' }, tId, tTitle),
    h('div', { class: 'tk-line' }, tPips, tStatus, tRework),
    h('div', { class: 'bar thin' }, tProgFill),
    h('div', { class: 'tk-line' }, tCost), h('div', { class: 'tk-line' }, tSkills));
  const noTicket = h('div', { class: 'card muted-card' }, h('div', { class: 'card-h' }, 'Current ticket'), h('p', { class: 'note' }, 'No ticket right now.'));

  // config card
  const cModel = kv('Model'); const cEffort = kv('Effort');
  const gFill = h('i', { class: 'g-fill' }); const gZone = h('i', { class: 'g-zone' }); const gTick = h('i', { class: 'g-tick' }); const gMark = h('i', { class: 'g-mark' });
  const gauge = h('div', { class: 'gauge', role: 'img', 'aria-label': 'Context window fill' }, gFill, gZone, gTick, gMark);
  const gText = h('div', { class: 'g-text' });
  const subIcons = h('span', { class: 'sub-icons' });
  const cSubs = kv('Subagents');
  cSubs.v.replaceChildren(subIcons);
  const configCard = h('div', { class: 'card' }, h('div', { class: 'card-h' }, 'Config'), cModel.row, cEffort.row,
    h('div', { class: 'g-label' }, 'Context / autocompact', h('span', { class: 'dim' }, ' (tick = compaction point)')), gauge, gText, cSubs.row);

  // skills card: equipped chips (with x), dashed empty slots, and an equip dropdown (respects SKILL_SLOTS)
  const slotBox = h('div', { class: 'skill-slots eq-list' });
  const eqSel = h('select', { class: 'sel', 'aria-label': 'Skill to equip' }) as HTMLSelectElement;
  const eqBtn = h('button', { type: 'button', class: 'btn tiny accent', onClick: () => { if (curId && eqSel.value) { ctx.cmd.equipSkill?.(curId, eqSel.value); ctx.refresh(); } } }, icon('plus'), ' equip');
  const eqNote = h('p', { class: 'note' });
  const skillsHead = h('div', { class: 'card-h' }, `Skills (${SKILL_SLOTS} slots)`);
  const skillsCard = h('div', { class: 'card' }, skillsHead, slotBox, h('div', { class: 'sk-equip' }, eqSel, eqBtn), eqNote);
  let skillSig = '';
  const syncSkills = (a: AgentState, catalog: { id: string; name: string }[]): void => {
    const eq = (a.skills ?? []).slice(0, SKILL_SLOTS);
    const sig = a.id + '|' + eq.join(',') + '|' + catalog.map((c) => c.id).join(',') + (a.role === 'worker' ? 'w' : 'o');
    if (sig === skillSig) return;
    skillSig = sig;
    slotBox.replaceChildren(
      ...eq.map((id) => h('span', { class: 'sk-eq', title: `${skillById(id)?.name ?? id}: ${skillById(id)?.blurb ?? ''}` }, skillChip(id), h('span', { class: 'sk-eq-name' }, skillById(id)?.name ?? id),
        h('button', { type: 'button', class: 'ibtn sk-x', title: `Unequip ${skillById(id)?.name ?? id}`, 'aria-label': `Unequip ${skillById(id)?.name ?? id}`, onClick: () => { ctx.cmd.unequipSkill?.(a.id, id); ctx.refresh(); } }, icon('close')))),
      ...Array.from({ length: Math.max(0, SKILL_SLOTS - eq.length) }, () => h('span', { class: 'skill-chip empty', title: 'empty skill slot' })));
    const free = catalog.filter((c) => !eq.includes(c.id));
    eqSel.replaceChildren(...free.map((c) => h('option', { value: c.id }, c.name)));
    const full = eq.length >= SKILL_SLOTS;
    eqSel.disabled = eqBtn.disabled = full || free.length === 0;
    setText(eqNote, full ? `All ${SKILL_SLOTS} slots are in use: unequip one first.` : `${SKILL_SLOTS - eq.length} slot${SKILL_SLOTS - eq.length === 1 ? '' : 's'} free.`);
  };

  // cost card
  const kCost = kv('Spent (est.)', 'Estimated spend from an illustrative price table'); const kBurn = kv('Burn rate'); const kSub = kv('Subagent premium', 'Portion of spend caused by subagents');
  const kIn = kv('Input tokens'); const kOut = kv('Output tokens'); const kCache = kv('Cache reads');
  const costCard = h('div', { class: 'card' }, h('div', { class: 'card-h' }, 'Cost (estimates)'), kCost.row, kBurn.row, kSub.row, kIn.row, kOut.row, kCache.row);

  // overrides
  const ov = new Map<string, AgentOverride>();
  let curId: string | null = null;
  const send = (patch: AgentOverride): void => {
    if (!curId) return;
    const merged = { ...(ov.get(curId) ?? {}), ...patch };
    ov.set(curId, merged);
    ctx.sim.setAgentOverride(curId, merged);
    ctx.refresh();
  };
  const oModel = selectRow('Model', [], '', (v) => { const m = findModel(v); send({ model: v, tier: m?.tier }); }, 'ovmodel');
  fillSelect(oModel.select, allModels().map((m) => ({ value: m.model, label: `${m.model} (${m.tier})`, group: PROVIDERS[m.provider].name })));
  const oBuf = sliderRow({ label: 'Autocompact buffer', min: 5, max: 50, step: 1, unit: '%', value: 20, def: 20, idPrefix: 'ovbuf', onInput: (v) => send({ autocompactBuffer: v }), hint: 'Share of context kept free before compaction.' });
  const oSub = sliderRow({ label: 'Subagents', min: 0, max: 8, step: 1, value: 2, def: 2, idPrefix: 'ovsub', onInput: (v) => send({ subagents: v }) });
  const oEff = selectRow('Effort', EFFORTS.map((e) => ({ value: e, label: e })), 'medium', (v) => send({ effort: v as AgentConfig['effort'] }), 'oveff');
  const oProv = selectRow('Tool', PROVIDER_IDS.map((id) => ({ value: id, label: PROVIDERS[id].name })), 'claude', (v) => {
    if (!curId) return;
    const cur = { ...(ov.get(curId) ?? {}) }; delete cur.model; delete cur.tier; ov.set(curId, cur);
    send({ provider: v as Provider });
  }, 'ovprov');
  const oOff = switchRow('Offline (send home)', false, (v) => send({ offline: v }), 'Takes the agent offline: it goes home and sleeps.', 'ovoff');
  const oAuto = h('button', { type: 'button', class: 'btn', title: 'Remove every override on this agent and return to auto-by-difficulty', onClick: () => { if (!curId) return; ov.delete(curId); ctx.sim.setAgentOverride(curId, null); ctx.refresh(); } }, icon('undo'), ' Auto');
  const ovBadge = h('span', { class: 'chip warn' }, 'OVERRIDDEN');
  const overrides = h('div', { class: 'card' }, h('div', { class: 'card-h' }, 'Overrides', ovBadge, oAuto),
    oProv.el, oModel.el, oBuf.el, oSub.el, oEff.el, oOff.el);

  // stats
  const sDone = kv('Tickets done'); const sMerged = kv('Merged'); const sRework = kv('Reworks'); const sWalk = kv('Metres walked');
  const statsCard = h('div', { class: 'card' }, h('div', { class: 'card-h' }, 'Stats'), sDone.row, sMerged.row, sRework.row, sWalk.row);

  const inspector = h('div', { class: 'inspector' }, back, header, ticketCard, noTicket, configCard, skillsCard, costCard, overrides, statsCard);
  inspector.hidden = true;
  d.body.append(rosterView, inspector);

  let ticketKey = '';
  let lastSub = '';
  const update = (state: SimState): void => {
    const sel = ctx.agent(ctx.selectedId);
    if (!sel && ctx.selectedId) ctx.selectedId = null;

    // ---- roster (always kept fresh, cheap)
    const seen = new Set<string>();
    for (const a of state.agents) {
      seen.add(a.id);
      let r = rows.get(a.id);
      if (!r) { r = makeRow(a); rows.set(a.id, r); rosterList.appendChild(r.el); }
      const pi = phaseInfo(a.phase);
      setText(r.phase, pi.label); r.phase.className = `chip ${pi.tone}`;
      r.dot.className = `pdot ${a.provider}${a.phase === 'offline' ? ' off' : ''}`;
      setStyle(r.swatch, 'background', a.ownerColor || 'var(--muted)');
      setText(r.owner, a.owner);
      setText(r.tier, a.config.tier); r.tier.className = `tier ${a.provider}`; r.tier.title = a.config.model;
      setText(r.cost, usd(a.usage?.costUsd));
      setText(r.ticket, a.ticketId ?? '-');
      if (a.role === 'worker') setSkillSlots(r.skills, a.skills, 'sm');
      const nm2 = (id: string | null): string => (id ? state.agents.find((x) => x.id === id)?.name ?? id : '');
      const tip = `${a.name} - ${pi.label}${a.waitingOn ? ` - waiting on ${nm2(a.waitingOn)} for help` : ''}${a.helping ? ` - helping ${nm2(a.helping)}` : ''}`;
      if (r.el.title !== tip) r.el.title = tip;
      toggleClass(r.el, 'sel', a.id === ctx.selectedId);
      setAttr(r.el, 'aria-pressed', String(a.id === ctx.selectedId));
    }
    for (const [id, r] of rows) if (!seen.has(id)) { r.el.remove(); rows.delete(id); }
    // keep DOM order == state order
    state.agents.forEach((a, i) => { const el = rows.get(a.id)!.el; if (rosterList.children[i] !== el) rosterList.insertBefore(el, rosterList.children[i] ?? null); });
    const online = state.agents.filter((a) => a.phase !== 'offline').length;
    setText(rosterSummary, `${online} of ${state.agents.length} agents online - ${usd(state.metrics.totalCostUsd)} spent (est.)`);

    setHidden(rosterView, !!sel);
    setHidden(inspector, !sel);
    if (!sel) { curId = null; return; }
    if (curId !== sel.id) { curId = sel.id; ticketKey = ''; lastSub = ''; inspector.scrollTop = 0; }

    // ---- inspector
    const cfg = sel.config;
    setText(iName, sel.name);
    setText(iProv, PROVIDERS[sel.provider]?.name ?? sel.provider); iProv.className = `prov ${sel.provider}`;
    setText(iRole, ROLE_LABEL[sel.role] ?? sel.role);
    setStyle(iSwatch, 'background', sel.ownerColor || 'var(--muted)');
    setText(iOwner, sel.owner);
    setText(iModel, cfg.model); setText(iTier, cfg.tier); iTier.className = `tier ${sel.provider}`;
    const pi = phaseInfo(sel.phase);
    setText(iPhase, pi.label); iPhase.className = `chip ${pi.tone}`;
    const nm = (id: string | null): string => (id ? state.agents.find((x) => x.id === id)?.name ?? id : '');
    setHidden(iHelp, !sel.waitingOn && !sel.helping);
    setText(iHelp, sel.waitingOn ? `Waiting on ${nm(sel.waitingOn)} for help` : sel.helping ? `Helping ${nm(sel.helping)}` : '');
    const pp = Math.round(clamp(sel.phaseProgress, 0, 1) * 100);
    setStyle(iProgFill, 'width', `${pp}%`); setAttr(iProg, 'aria-valuenow', String(pp));

    const tk: Ticket | undefined = sel.ticketId ? state.tickets.find((t) => t.id === sel.ticketId) : undefined;
    setHidden(ticketCard, !tk); setHidden(noTicket, !!tk);
    if (tk) {
      setText(tId, tk.id); setText(tTitle, tk.title); setPips(tPips, tk.difficulty);
      setText(tStatus, STATUS_LABEL[tk.status] ?? tk.status);
      setText(tRework, tk.reworks ? `${tk.reworks} rework${tk.reworks > 1 ? 's' : ''}` : 'no reworks');
      setStyle(tProgFill, 'width', `${Math.round(clamp(tk.progress, 0, 1) * 100)}%`);
      const act = tk.usage?.costUsd ?? 0, est = tk.estimatedCostUsd ?? 0;
      setText(tCost, `${usd(act)} / ~${usd(est)} est`);
      tCost.className = `cost ${est > 0 && act / est > 1.6 ? 'bad' : est > 0 && act / est > 1.2 ? 'warn' : ''}`;
      setSkillChips(tSkills, tk.skills, sel.skills);
      ticketKey = tk.id;
    }
    void ticketKey;

    setText(cModel.v, `${cfg.model} (${cfg.tier})`); setText(cEffort.v, cfg.effort);
    const fill = clamp(sel.contextFill, 0, 1), trig = 1 - cfg.autocompactBuffer / 100;
    setStyle(gFill, 'width', `${fill * 100}%`); setStyle(gMark, 'left', `${fill * 100}%`);
    setStyle(gZone, 'left', `${trig * 100}%`); setStyle(gZone, 'width', `${(1 - trig) * 100}%`); setStyle(gTick, 'left', `${trig * 100}%`);
    toggleClass(gauge, 'hot', fill >= trig);
    setText(gText, `context ${Math.round(fill * 100)}% - compacts at ${Math.round(trig * 100)}% - ${sel.compactions} compaction${sel.compactions === 1 ? '' : 's'}`);
    const sub = `${cfg.subagents}/${sel.activeSubagents}`;
    if (sub !== lastSub) {
      lastSub = sub;
      if (cfg.subagents <= 0) subIcons.replaceChildren(h('span', { class: 'dim' }, 'none'));
      else subIcons.replaceChildren(...Array.from({ length: cfg.subagents }, (_, i) => h('span', { class: `sub-ico${i < sel.activeSubagents ? ' on' : ''}`, title: i < sel.activeSubagents ? 'active subagent' : 'idle slot' }, icon('bot'))),
        h('span', { class: 'dim' }, ` ${sel.activeSubagents} active / ${cfg.subagents} allowed`));
    }
    syncSkills(sel, state.skills ?? []);

    const u = sel.usage;
    setText(kCost.v, usd(u?.costUsd)); setText(kBurn.v, `${usd(sel.burnUsdPerMin)}/min`); setText(kSub.v, usd(sel.subagentCostUsd));
    setText(kIn.v, tokens(u?.inputTokens)); setText(kOut.v, tokens(u?.outputTokens)); setText(kCache.v, tokens(u?.cacheReadTokens));

    // overrides (controls keep focus while dragged: set() skips while dragging; selects skip while focused)
    oModel.set(cfg.model); oBuf.set(cfg.autocompactBuffer); oSub.set(cfg.subagents); oEff.set(cfg.effort);
    oProv.set(sel.provider); oOff.set(sel.phase === 'offline');
    setHidden(ovBadge, !sel.overridden);
    oAuto.disabled = !sel.overridden && !ov.has(sel.id);
    setText(sDone.v, String(sel.stats.done)); setText(sMerged.v, String(sel.stats.merged)); setText(sRework.v, String(sel.stats.reworks)); setText(sWalk.v, `${sel.stats.walkedMeters.toFixed(0)} m`);
  };

  return { el: d.el, update };
}
