/** Metrics recomputed once per step(): flow, cost, budget warnings. */
import { hackEtaSec } from './hack';
import type { World } from './world';

export function updateMetrics(w: World): void {
  const st = w.state, m = st.metrics, s = w.settings;
  const hack = s.mode === 'hackathon' && st.hack.active;
  let open = 0, inReview = 0, remaining = 0, estSum = 0, estN = 0;
  for (const t of st.tickets) {
    if (t.status === 'cancelled') continue;
    estSum += t.estimatedCostUsd; estN++;
    if (t.status === 'merged') continue;
    open++;
    if (t.status === 'in_review') inReview++;
    remaining += Math.max(t.estimatedCostUsd - t.usage.costUsd, 0.25 * t.estimatedCostUsd);
  }
  const merged = w.mergedCount;
  m.merged = merged; m.open = open; m.inReview = inReview; m.rejected = w.rejectedCount;

  const win = 180;
  while (w.recentMerges.length > 0 && w.recentMerges[0] < st.time - win) w.recentMerges.shift();
  const span = Math.min(win, Math.max(30, st.time));
  m.throughputPerMin = w.recentMerges.length / (span / 60);
  m.avgCycleSec = merged > 0 ? w.cycleSum / merged : 0;

  let workers = 0, busy = 0, burn = 0;
  for (const a of st.agents) {
    burn += a.burnUsdPerMin;
    if (a.role !== 'worker' || a.phase === 'offline') continue;
    workers++;
    if (a.phase === 'working' || a.phase === 'reworking') busy++;
  }
  m.utilization = workers > 0 ? busy / workers : 0;

  let helpOpen = 0;
  for (const r of st.help) if (r.status === 'open') helpOpen++;
  m.helpTotal = w.helpTotal; m.helpOpen = helpOpen;

  // scope / ETA / budget are per project (sprint or hackathon); merged + cost totals are lifetime
  const sm = w.sprintMerged;
  const queued = hack ? w.planQueue.length : 0;
  const total = hack ? Math.max(1, w.hackPlanned) : Math.max(1, s.totalScope - w.projCancelled);
  m.scopeDone = hack && st.hack.stage === 'submitted' ? 1 : Math.min(1, sm / total);
  const left = hack ? queued + open : Math.max(total - sm, open);
  // no ETA until the pipeline has produced a few merges (early throughput is meaningless)
  const cumRate = sm / Math.max(0.5, (st.time - w.sprintStartT) / 60);
  const rate = 0.5 * m.throughputPerMin + 0.5 * cumRate;   // blend: trailing window alone is bursty
  if (hack) {
    const e = left <= 0 ? 0 : hackEtaSec(w);
    m.etaMinutes = e === null ? null : e / 60;
  } else m.etaMinutes = left <= 0 ? 0 : sm >= 3 && rate > 0.01 ? left / rate : null;

  // ---- cost
  m.wasteUsd = w.wasteUsd;
  m.burnUsdPerMin = burn;
  const projCost = w.sprintCostUsd;
  const avg = sm > 0 ? w.sprintMergedCost / sm : estN > 0 ? estSum / estN : 3;
  m.avgCostPerMergedUsd = merged > 0 ? w.lifeMergedCost / merged : 0;
  const notCreated = hack ? queued : Math.max(0, s.totalScope - w.sprintCreated);
  m.projectedScopeCostUsd = projCost + remaining + notCreated * avg;   // this project's projected total
  m.budgetUsedPct = s.budgetUsd > 0 ? projCost / s.budgetUsd * 100 : 0;   // per project, percent

  if (s.budgetUsd > 0) {
    const pct = m.budgetUsedPct;
    const orch = w.rts.get('orch');
    if (pct >= 80 && !w.warned) {
      w.warned = true;
      w.log('orch', 'cost', `Budget ${pct.toFixed(0)}% used ($${projCost.toFixed(2)} of $${s.budgetUsd.toFixed(0)} this ${hack ? 'project' : 'sprint'}), burning $${burn.toFixed(2)}/min`);
      if (orch) w.say(orch, `Budget ${pct.toFixed(0)}% used - watch burn`, 5);
      w.emit({ type: 'budget_warning', usedPct: pct });
    } else if (pct < 70) w.warned = false;
    const over = pct > 100;
    if (over && !w.overBudget) {
      w.overBudget = true;
      w.log('orch', 'cost', 'Over budget: downshifting new tasks to a cheaper tier with fewer subagents');
      if (orch) w.say(orch, 'Over budget - downshifting', 5);
    } else if (!over && w.overBudget) {
      w.overBudget = false;
      w.log('orch', 'cost', 'Back under budget: restoring difficulty-based configs');
    }
  } else { w.warned = false; w.overBudget = false; }
}
