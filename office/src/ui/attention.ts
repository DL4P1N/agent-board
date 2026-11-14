// WHAT NEEDS YOU: the human-in-the-loop list (board view + the top-bar badge), and the deadline verdict.
// Every item says what is wrong in plain words and offers the action that fixes it, right there.
import type { AgentState, SimState } from '../types';
import type { UICtx } from './ctx';
import { snippet } from './interact';

export type Verdict = 'estimating' | 'on_track' | 'at_risk' | 'behind' | 'done' | 'over';
export interface Outlook { verdict: Verdict; label: string; detail: string; tone: 'ok' | 'warn' | 'bad' | 'mute'; shortBy: number; minutesLeft: number | null }

const mins = (m: number): string => (m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.max(0, Math.round(m))} min`);

/** Will we make the deadline? Compares the orchestrator's ETA for the remaining scope with the time left. */
export function outlook(state: SimState): Outlook {
  const hk = state.hack;
  const hackOn = !!hk?.active && hk.stage !== 'idle';
  if (hackOn && hk.stage === 'submitted') return { verdict: 'done', label: 'Submitted', detail: 'The demo is in', tone: 'ok', shortBy: 0, minutesLeft: null };
  const left = hackOn ? (hk.endsAt - state.time) / 60 : state.plan.deadlineMinutes - state.time / 60;
  const merged = state.metrics.merged;
  const open = state.tickets.filter((t) => t.status !== 'merged' && t.status !== 'cancelled').length;
  const remaining = Math.max(open, state.plan.totalTickets - merged);
  if (remaining <= 0) return merged > 0
    ? { verdict: 'done', label: 'All done', detail: `${merged} merged`, tone: 'ok', shortBy: 0, minutesLeft: left }
    : { verdict: 'estimating', label: 'No tasks yet', detail: 'Nothing is planned', tone: 'mute', shortBy: 0, minutesLeft: left };
  if (left <= 0) return { verdict: 'over', label: 'Time is up', detail: `${remaining} tasks unfinished`, tone: 'bad', shortBy: Math.max(1, Math.ceil(remaining / 2)), minutesLeft: 0 };
  const eta = state.metrics.etaMinutes;
  if (eta == null || state.time < 90) return { verdict: 'estimating', label: 'Estimating', detail: `${mins(left)} left`, tone: 'mute', shortBy: 0, minutesLeft: left };
  const ratio = eta / left;
  // never suggest cutting more than half of what is left: past that, more time is the better lever
  const shortBy = ratio > 1 ? Math.min(Math.max(1, Math.round(remaining * (1 - left / eta))), Math.max(1, Math.ceil(remaining / 2))) : 0;
  if (ratio <= 0.9) return { verdict: 'on_track', label: 'On track', detail: `${mins(left)} left, about ${mins(eta)} of work`, tone: 'ok', shortBy, minutesLeft: left };
  if (ratio <= 1.1) return { verdict: 'at_risk', label: 'Tight', detail: `${mins(left)} left, about ${mins(eta)} of work`, tone: 'warn', shortBy, minutesLeft: left };
  return { verdict: 'behind', label: `Behind by ~${Math.max(1, Math.round(remaining * (1 - left / eta)))}`, detail: `${mins(left)} left, about ${mins(eta)} of work`, tone: 'bad', shortBy, minutesLeft: left };
}

export interface AttnAction { label: string; run: () => void; primary?: boolean }
export interface AttnItem {
  key: string;
  tone: 'bad' | 'warn' | 'info';
  text: string;
  actions: AttnAction[];
  /** Inline reply box: whatever the human types goes to this agent. */
  reply?: { to: string; placeholder: string };
}

/** Best teammate to help a stuck agent: online, not stuck itself, most skill overlap with the task. */
function helperFor(state: SimState, a: AgentState): AgentState | undefined {
  const t = a.ticketId ? state.tickets.find((x) => x.id === a.ticketId) : undefined;
  const need = new Set(t?.skills ?? []);
  const busy = new Set(['offline', 'blocked', 'asking_help', 'awaiting_help', 'helping']);
  return state.agents
    .filter((x) => x.role === 'worker' && x.id !== a.id && !busy.has(x.phase))
    .map((x) => ({ x, score: (x.skills ?? []).filter((s) => need.has(s)).length }))
    .sort((p, q) => q.score - p.score)[0]?.x;
}

export function attentionItems(ctx: UICtx, state: SimState): AttnItem[] {
  const items: AttnItem[] = [];
  const name = (id: string): string => (id === 'orch' ? 'the orchestrator' : state.agents.find((a) => a.id === id)?.name ?? id);
  const say = (to: string, text: string): void => { ctx.cmd.say?.(to, text); ctx.refresh(); };

  // 1. the deadline
  const o = outlook(state);
  if (o.verdict === 'behind' || o.verdict === 'over') {
    const n = Math.max(1, o.shortBy);
    items.push({ key: 'deadline', tone: 'bad',
      text: o.verdict === 'over' ? `Time is up with ${o.detail}.` : `${o.label.replace('Behind by ~', 'Behind: about ')} tasks won't fit before the deadline (${o.detail}).`,
      actions: [
        { label: `Cut the ${n} lowest-priority task${n === 1 ? '' : 's'}`, primary: true, run: () => say('orch', `cut scope by ${n}`) },
        { label: 'Add 10 minutes', run: () => { ctx.cmd.setDeadline?.(Math.max(0, o.minutesLeft ?? 0) + 10); ctx.refresh(); } },
      ] });
  }
  // 2. stuck agents: answer them, or send a teammate
  for (const a of state.agents) {
    if (a.phase !== 'blocked') continue;
    const helper = helperFor(state, a);
    items.push({ key: `b-${a.id}`, tone: 'bad', text: `${a.name} is stuck${a.ticketId ? ` on ${a.ticketId}` : ''}${a.bubble ? `: "${a.bubble}"` : '.'}`,
      reply: { to: a.id, placeholder: `Tell ${a.name} how to get unstuck...` },
      actions: [
        ...(helper ? [{ label: `Ask ${helper.name} to help`, primary: true, run: () => { ctx.cmd.requestHelp?.(a.id, helper.id); ctx.refresh(); } }] : []),
        { label: 'Inspect', run: () => ctx.select(a.id) },
      ] });
  }
  // 3. questions: anything asked of the orchestrator, or a teammate who has not answered for a while
  for (const r of state.help) {
    if (r.status !== 'open') continue;
    const waited = state.time - r.t0;
    if (r.toAgent !== 'orch' && waited < 45) continue;
    items.push({ key: `h-${r.id}`, tone: 'warn',
      text: `${name(r.fromAgent)} asks ${name(r.toAgent)}${r.ticketId ? ` about ${r.ticketId}` : ''}: "${snippet(r.question, 110)}"${r.toAgent !== 'orch' ? ` (no answer for ${Math.round(waited)}s)` : ''}`,
      reply: { to: r.fromAgent, placeholder: `Answer ${name(r.fromAgent)}...` },
      actions: [{ label: 'Inspect', run: () => ctx.select(r.fromAgent) }] });
  }
  // 4. money
  const budget = ctx.sim.settings.budgetUsd ?? 0;
  const pct = state.metrics.budgetUsedPct;
  if (budget > 0 && pct >= 80) {
    items.push({ key: 'budget', tone: pct >= 100 ? 'bad' : 'warn',
      text: pct >= 100 ? `Over budget: ${Math.round(pct)}% spent (est.). Agents are being moved to cheaper models.` : `${Math.round(pct)}% of the budget is spent (est.).`,
      actions: [
        { label: 'Raise the budget by $50', primary: true, run: () => ctx.setSettings({ budgetUsd: budget + 50 }) },
        { label: 'Show costs', run: () => document.getElementById('tv-costs')?.scrollIntoView({ block: 'nearest' }) },
      ] });
  }
  // 5. review pile-up
  const inReview = state.tickets.filter((t) => t.status === 'in_review').length;
  if (inReview >= 4) items.push({ key: 'review', tone: 'warn', text: `${inReview} pull requests are waiting for review. The Integrator is the bottleneck.`, actions: [{ label: 'Inspect the Integrator', run: () => ctx.select('integ') }] });
  // 6. tasks that need a look
  for (const t of state.tickets) {
    if (t.status === 'changes_requested' && t.reworks >= 2) {
      items.push({ key: `c-${t.id}`, tone: 'warn', text: `${t.id} was sent back ${t.reworks} times${t.assignee ? ` (${name(t.assignee)})` : ''}: ${t.title}`, actions: [{ label: 'Open task', run: () => ctx.openTicket(t.id) }] });
    } else if (t.status !== 'merged' && t.status !== 'cancelled') {
      const est = t.estimatedCostUsd ?? 0, act = t.usage?.costUsd ?? 0;
      if (est > 0 && act / est > 1.6) items.push({ key: `o-${t.id}`, tone: 'warn', text: `${t.id} costs ${(act / est).toFixed(1)}x its estimate: ${t.title}`, actions: [{ label: 'Open task', run: () => ctx.openTicket(t.id) }] });
    }
  }
  return items;
}
