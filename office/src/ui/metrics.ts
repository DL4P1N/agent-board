// Metrics overlay: progress, ETA vs deadline, spend vs budget, cost breakdowns and sparklines. Key: M.
import type { SimState } from '../types';
import type { Panel, UICtx } from './ctx';
import { clamp, h, setStyle, setText, toggleClass } from './dom';
import { hudWindow, type HudWin } from './hud';
import { Sparkline } from './sparkline';
import { usd } from './format';

const TIER_COLORS: Record<string, string> = { haiku: '#4ade80', sonnet: '#38bdf8', opus: '#c084fc', fable: '#f472b6', mini: '#5eead4', standard: '#fbbf24', max: '#fb7185' };
const FALLBACK = ['#94a3b8', '#fb923c', '#a3e635', '#22d3ee'];
export const tierColor = (t: string, i: number): string => TIER_COLORS[t] ?? FALLBACK[i % FALLBACK.length];

function kv(label: string, title?: string): { row: HTMLElement; v: HTMLElement } {
  const v = h('b', {});
  return { row: h('div', { class: 'kv', title: title ?? '' }, h('span', {}, label), v), v };
}

export function stack(): { el: HTMLElement; legend: HTMLElement; bar: HTMLElement; set(items: { key: string; value: number; color: string }[]): void } {
  const bar = h('div', { class: 'stack' });
  const legend = h('div', { class: 'stack-legend' });
  let sig = '';
  return {
    el: h('div', { class: 'stack-box' }, bar, legend), legend, bar,
    set(items) {
      const total = items.reduce((s, i) => s + i.value, 0);
      const s2 = items.map((i) => `${i.key}:${total > 0 ? Math.round((i.value / total) * 100) : 0}:${i.value.toFixed(1)}`).join('|');
      if (s2 === sig) return; sig = s2;
      bar.replaceChildren(...items.filter((i) => i.value > 0).map((i) => h('i', { style: `width:${(i.value / total) * 100}%;background:${i.color}`, title: `${i.key} ${usd(i.value)}` })));
      legend.replaceChildren(...items.map((i) => h('span', { class: 'lg' }, h('i', { style: `background:${i.color}` }), `${i.key} ${usd(i.value)}`)));
    },
  };
}

export function createMetrics(ctx: UICtx): Panel & { win: HudWin } {
  const win = hudWindow(ctx, 'metrics', 'Metrics', true, 'metrics-win');
  win.extras.append(
    h('span', { class: 'chip mute', title: 'All $ values are ESTIMATES computed from an illustrative price table, not real billing.' }, 'EST. $'),
    h('span', { class: 'key-hint', title: 'Press M to toggle' }, 'M'));

  const mergedVal = h('b', {}); const mergedFill = h('i', {});
  const etaVal = h('b', {}); const etaBadge = h('span', { class: 'chip' });
  const spendVal = h('b', {}); const spendBadge = h('span', { class: 'chip' }); const spendFill = h('i', {});
  const spendBar = h('div', { class: 'bar budget', role: 'progressbar', 'aria-label': 'Budget used', 'aria-valuemin': '0', 'aria-valuemax': '100' }, spendFill,
    h('u', { class: 'tick t80', title: '80% warning' }), h('u', { class: 'tick t100', title: '100% cap' }));
  const tput = kv('Throughput'); const cycle = kv('Avg cycle'); const util = kv('Utilization'); const queue = kv('Open/review/back', 'Open tickets / in review / sent back for changes');
  const burn = kv('Burn rate'); const avg = kv('Avg $/merged'); const proj = kv('To finish', 'Orchestrator forecast of the cost of the remaining scope');
  const waste = kv('Rework waste', 'Spend on attempts the integrator sent back'); const orch = kv('Orchestration', 'Orchestrator + integrator spend');
  const tier = stack(); const prov = stack();
  const spark1 = new Sparkline(96, 22); const spark2 = new Sparkline(96, 22);

  win.body.append(
    h('div', { class: 'm-block' }, h('div', { class: 'm-row' }, h('span', {}, 'Merged / scope'), mergedVal), h('div', { class: 'bar' }, mergedFill)),
    h('div', { class: 'm-row' }, h('span', {}, 'ETA vs deadline'), etaVal, etaBadge),
    h('div', { class: 'm-block' }, h('div', { class: 'm-row' }, h('span', {}, 'Spend vs budget'), spendVal, spendBadge), spendBar),
    h('div', { class: 'kv-grid' }, tput.row, cycle.row, util.row, queue.row, burn.row, avg.row, proj.row, waste.row, orch.row),
    h('div', { class: 'm-sub' }, 'Cost by tier'), tier.el,
    h('div', { class: 'm-sub' }, 'Cost by provider'), prov.el,
    h('div', { class: 'sparks' },
      h('figure', {}, spark1.canvas, h('figcaption', {}, h('i', { class: 'lg-a' }), 'merged ', h('i', { class: 'lg-b' }), 'merges/min')),
      h('figure', {}, spark2.canvas, h('figcaption', {}, h('i', { class: 'lg-c' }), 'spend over time (est.)'))));

  // ---- 1 Hz sampler (sim-time driven, resets with the sim)
  const S = { merged: [] as number[], tput: [] as number[], cost: [] as number[] };
  let lastSample = 0, lastT = 0;
  const colors = { a: '', b: '', c: '', grid: '' };
  let lastPalette = '';
  const readColors = (): void => {
    const pal = document.documentElement.dataset.palette ?? '';
    if (pal === lastPalette && colors.a) return;
    lastPalette = pal;
    const cs = getComputedStyle(document.documentElement);
    colors.a = cs.getPropertyValue('--ok').trim() || '#7ee081';
    colors.b = cs.getPropertyValue('--accent').trim() || '#ffb86b';
    colors.c = cs.getPropertyValue('--info').trim() || '#6ec1ff';
    colors.grid = cs.getPropertyValue('--grid').trim() || 'rgba(255,255,255,.08)';
  };

  const update = (state: SimState): void => {
    const m = state.metrics, p = state.plan, s = ctx.sim.settings;
    const total = p.totalTickets || s.totalScope;
    const cost = m.totalCostUsd ?? 0;
    const remaining = p.deadlineMinutes - state.time / 60;
    const done = m.merged >= total && total > 0;
    // chip
    win.setChip(`${m.merged}/${total} merged - ${usd(cost)}${s.budgetUsd > 0 ? ` / ${usd(s.budgetUsd)}` : ''}`);

    // sampler (always runs so the sparkline has history even when the window is minimized)
    const now = performance.now();
    if (state.time < lastT) { S.merged.length = S.tput.length = S.cost.length = 0; lastSample = 0; }
    if (now - lastSample >= 1000 && state.time !== lastT) {
      lastSample = now;
      S.merged.push(m.merged); S.tput.push(m.throughputPerMin); S.cost.push(cost);
      if (S.merged.length > 120) { S.merged.shift(); S.tput.shift(); S.cost.shift(); }
    }
    lastT = state.time;
    if (win.isMin()) return;

    setText(mergedVal, `${m.merged} / ${total}`);
    setStyle(mergedFill, 'width', `${clamp(total ? m.merged / total : 0, 0, 1) * 100}%`);

    let eta: string, tone: string, label: string;
    if (done) { eta = 'complete'; tone = 'ok'; label = 'DONE'; }
    else if (m.etaMinutes === null || m.etaMinutes === undefined) { eta = 'estimating...'; tone = 'mute'; label = '...'; }
    else if (remaining <= 0) { eta = `+${m.etaMinutes.toFixed(0)}m, deadline passed`; tone = 'bad'; label = 'LATE'; }
    else { const risk = m.etaMinutes > remaining; eta = `${m.etaMinutes.toFixed(0)}m vs ${remaining.toFixed(0)}m left`; tone = risk ? 'warn' : 'ok'; label = risk ? 'AT RISK' : 'OK'; }
    setText(etaVal, eta); setText(etaBadge, label); etaBadge.className = `chip ${tone}`;

    const used = s.budgetUsd > 0 ? cost / s.budgetUsd : 0; // computed here: sim's budgetUsedPct is 0..100, not 0..1
    if (s.budgetUsd > 0) {
      setText(spendVal, `${usd(cost)} / ${usd(s.budgetUsd)} (${Math.round(used * 100)}%)`);
      setStyle(spendFill, 'width', `${clamp(used, 0, 1) * 100}%`);
      const lab = used >= 1 ? 'OVER' : used >= 0.8 ? 'AT RISK' : 'OK';
      setText(spendBadge, lab); spendBadge.className = `chip ${used >= 1 ? 'bad' : used >= 0.8 ? 'warn' : 'ok'}`;
      toggleClass(spendBar, 'over', used >= 1); toggleClass(spendBar, 'warn', used >= 0.8 && used < 1);
      spendBar.setAttribute('aria-valuenow', String(Math.round(used * 100)));
    } else {
      setText(spendVal, `${usd(cost)} (no cap)`); setStyle(spendFill, 'width', '0%'); setText(spendBadge, 'NO CAP'); spendBadge.className = 'chip mute';
      toggleClass(spendBar, 'over', false); toggleClass(spendBar, 'warn', false);
    }

    setText(tput.v, `${m.throughputPerMin.toFixed(1)}/min`);
    setText(cycle.v, m.avgCycleSec > 0 ? `${(m.avgCycleSec / 60).toFixed(1)} min` : '-');
    setText(util.v, `${Math.round(m.utilization * 100)}%`);
    setText(queue.v, `${m.open} / ${m.inReview} / ${m.rejected}`);
    setText(burn.v, `${usd(m.burnUsdPerMin)}/min`);
    setText(avg.v, m.merged > 0 ? usd(m.avgCostPerMergedUsd) : '-');
    setText(proj.v, usd(m.projectedScopeCostUsd));
    setText(waste.v, usd(m.wasteUsd));
    setText(orch.v, usd(m.orchestrationCostUsd));
    const tiers = Object.entries(m.costByTier ?? {}).sort((a, b) => b[1] - a[1]);
    tier.set(tiers.map(([k, v], i) => ({ key: k, value: v, color: tierColor(k, i) })));
    prov.set([{ key: 'claude', value: m.costByProvider?.claude ?? 0, color: 'var(--claude)' }, { key: 'codex', value: m.costByProvider?.codex ?? 0, color: 'var(--codex)' }]);

    readColors();
    const mx = Math.max(total, 1);
    spark1.draw([{ data: S.merged.map((v) => v / mx), color: colors.a, fill: true }, { data: S.tput.map((v) => v / Math.max(1, ...S.tput)), color: colors.b }], colors.grid, 1);
    spark2.draw([{ data: S.cost, color: colors.c, fill: true }], colors.grid);
  };
  return { el: win.el, update, win };
}
