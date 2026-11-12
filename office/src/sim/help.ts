/** Help requests between agents: creation, helper choice, delivery, reply landing, timeouts. Behaviour of the asker/helper lives in worker.ts. */
import type { HelpRequest, Ticket } from '../types';
import { HELP_ANSWERS, HELP_QUESTIONS, SECRET_ANSWERS } from './names';
import { keyedRng } from './prng';
import type { Rt, World } from './world';

export const HELP_TIMEOUT = 40;

export function helpQuestion(w: World, t: Ticket | null, key: string): string {
  const r = keyedRng(w.settings.seed, 'hq:' + key);
  const skill = t && t.skills.length ? w.skillName(t.skills[0]) : 'this';
  const title = t ? t.title : 'the current task';
  const q = r.pick(HELP_QUESTIONS);
  return q.replace('{skill}', skill).replace('{title}', title);
}

export function helpAnswerText(w: World, req: HelpRequest): string {
  const r = keyedRng(w.settings.seed, 'ha:' + req.id + ':' + req.fromAgent);
  return req.toAgent === 'orch' ? r.pick(SECRET_ANSWERS) : r.pick(HELP_ANSWERS);
}

/** Workers that are eligible to receive a help plane right now (seated or about to be). */
export function helperEligible(o: Rt): boolean {
  const a = o.a;
  if (a.role !== 'worker' || o.leaving) return false;
  switch (a.phase) {
    case 'idle': case 'awaiting_review': case 'waiting': case 'blocked': case 'working': case 'reworking': return true;
    default: return false;
  }
}

/** Pick a peer by skill match; prefer idle/awaiting_review/waiting, avoid blocked. Null if nobody can help. */
export function pickHelper(w: World, rt: Rt, ticket: Ticket | null, key: string): string | null {
  const r = keyedRng(w.settings.seed, 'hp:' + key);
  let best: string | null = null, bestScore = -Infinity;
  for (const o of w.rtList) {
    if (o === rt || !helperEligible(o)) continue;
    if (o.helpInbox.length > 0 || o.curHelp) continue;
    let sc = 0;
    if (ticket) for (const sk of ticket.skills) if (o.a.skills.includes(sk)) sc += 3;
    switch (o.a.phase) {
      case 'idle': case 'awaiting_review': sc += 2.5; break;
      case 'waiting': sc += 1.5; break;
      case 'working': case 'reworking': sc += 0.3; break;
      case 'blocked': sc -= 2.5; break;
      default: break;
    }
    if (w.state.time - o.helpedAt < 15) sc -= 4;     // let someone else take it: nobody answers back-to-back forever
    sc += r.next() * 0.8;
    if (sc > bestScore) { bestScore = sc; best = o.a.id; }
  }
  return best;
}

export function createHelp(w: World, fromId: string, toId: string, ticket: Ticket | null, question: string, byHuman: boolean, key: string): HelpRequest {
  const st = w.state;
  const req: HelpRequest = {
    id: `H-${++w.helpSeq}`, fromAgent: fromId, toAgent: toId, ticketId: ticket ? ticket.id : null, question, answer: null,
    t0: st.time, status: 'open', byHuman,
  };
  st.help.push(req);
  w.helpById.set(req.id, req);
  // keep the transcript short: drop the oldest finished requests beyond 30
  if (st.help.length > 30) {
    for (let i = 0; i < st.help.length && st.help.length > 30; i++) {
      if (st.help[i].status !== 'open') { w.helpById.delete(st.help[i].id); st.help.splice(i, 1); i--; }
    }
  }
  w.helpTotal++;
  if (ticket) ticket.helpRequests++;
  w.log(fromId, 'help', `${w.agentName(fromId)} asked ${toId === 'orch' ? 'the orchestrator' : w.agentName(toId)}: ${question}`);
  w.emit({ type: 'help_requested', request: req });
  w.sendPlane('help', { agent: fromId }, { agent: toId }, key, { agent: toId, reqId: req.id }, '?', ticket ? ticket.id : undefined);
  return req;
}

/** The help plane landed: queue it for the helper (they pick it up when seated and free). */
export function deliverHelp(w: World, req: HelpRequest): void {
  if (req.status !== 'open') return;
  const rt = w.rts.get(req.toAgent);
  if (!rt || rt.a.phase === 'offline') return;      // will time out
  rt.helpInbox.push(req.id);
}

/** The reply plane landed with the asker. */
export function replyLanded(w: World, req: HelpRequest): void {
  if (req.status !== 'open') return;
  req.status = 'answered';
  req.answer = helpAnswerText(w, req);
  const asker = w.rts.get(req.fromAgent);
  const t = req.ticketId ? w.tickets.get(req.ticketId) : undefined;
  if (asker) {
    // the asker pays for reading + applying the answer (counts toward the ticket)
    w.charge(asker, 1400, 380, 0, t && t.assignee === asker.a.id ? t : null, false, false);
    if (asker.askReq === req.id) asker.helpDone = true;
  }
  w.log(req.toAgent, 'help', `${w.agentName(req.toAgent)} answered ${w.agentName(req.fromAgent)}: ${req.answer}`);
  w.emit({ type: 'help_answered', request: req });
}

export function helpTimeouts(w: World): void {
  const now = w.state.time;
  for (const req of w.state.help) {
    if (req.status === 'open' && now - req.t0 >= HELP_TIMEOUT) {
      req.status = 'timeout';
      const rt = w.rts.get(req.toAgent);
      if (rt) { const i = rt.helpInbox.indexOf(req.id); if (i >= 0) rt.helpInbox.splice(i, 1); }
    }
  }
}
