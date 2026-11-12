// Dev helper: long-run behaviour check (what happens after the scoped tickets are all merged?).
import { Simulation } from './index';

const s = new Simulation();
for (let m = 0; m < 60; m += 5) {
  for (let i = 0; i < 300 / 0.5; i++) s.step(0.5);
  const st = s.state;
  const busy = st.agents.filter((a) => a.phase === 'working' || a.phase === 'reworking').length;
  console.log(`t=${m + 5}m plan="${st.plan.name}" total=${st.plan.totalTickets} merged=${st.metrics.merged} open=${st.metrics.open} tickets=${st.tickets.length} busy=${busy} cost=${st.metrics.totalCostUsd.toFixed(0)}`);
}
