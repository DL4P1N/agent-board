/** Integrator: reviews PRs FIFO from the inbox, merges to main (deploys every 3rd) or throws a "changes requested" plane back to the author. */
import { STATIONS } from '../layout';
import { fitDeficit, reviewBaseSeconds } from './difficulty';
import { hackOnMerged, startDeploy } from './hack';
import { REJECT_REASONS } from './names';
import { WALK_MPS, advanceWalk, walkTo } from './movement';
import { tokenRates } from './pricing';
import { keyedRng } from './prng';
import { authorMerged, authorRejected } from './worker';
import type { Rt, World } from './world';

// sub: 0 seated idle, 1 reviewing, 2 throwing the 'changes' plane, 4 walking home, 5 walking to main, 6 stamping,
//      7 walking to deploy, 8 deploying, 9 throwing the 'merged' plane, 10 celebrating (hackathon submitted)

export function updateIntegrator(w: World, rt: Rt, h: number): void {
  const a = rt.a;
  if (a.bubble !== null) { rt.bubbleT -= h; if (rt.bubbleT <= 0) a.bubble = null; }
  if (rt.walking) {
    if (advanceWalk(rt, WALK_MPS * w.settings.walkSpeed, h)) arrive(w, rt);
    return;
  }
  switch (rt.sub) {
    case 0: {
      if (w.submitFx & 2) {
        w.submitFx &= ~2;
        rt.sub = 10; a.phase = 'celebrating'; a.pose = 'celebrate'; rt.t = 0; rt.dur = 4;
        w.say(rt, 'Shipped!', 4);
        return;
      }
      if (w.inboxQueue.length > 0) { startReview(w, rt); return; }
      rt.poseT -= h;
      if (rt.poseT <= 0) { rt.poseAlt = !rt.poseAlt; rt.poseT = 3 + rt.rng.next() * 5; }
      a.pose = rt.poseAlt ? 'type' : 'wait';
      return;
    }
    case 1: reviewTick(w, rt, h); return;
    case 2: timer(rt, h, () => finishThrow(w, rt, false)); return;
    case 6: timer(rt, h, () => doMerge(w, rt)); return;
    case 8: timer(rt, h, () => doDeploy(w, rt)); return;
    case 9: timer(rt, h, () => finishThrow(w, rt, true)); return;
    case 10: timer(rt, h, () => { rt.sub = 0; a.phase = 'idle'; a.pose = 'wait'; }); return;
    default: rt.sub = 0; return;
  }
}

function timer(rt: Rt, h: number, done: () => void): void {
  rt.t += h; rt.a.phaseProgress = Math.min(1, rt.t / rt.dur);
  if (rt.t >= rt.dur) done();
}

function arrive(w: World, rt: Rt): void {
  const a = rt.a;
  switch (rt.next) {
    case 'main': rt.sub = 6; a.pose = 'pickup'; rt.t = 0; rt.dur = 1.5; break;
    case 'deploy': rt.sub = 8; a.pose = 'pickup'; rt.t = 0; rt.dur = 2.0; break;
    case 'home_i': rt.sub = 0; a.phase = 'idle'; a.pose = 'wait'; rt.atDesk = true; rt.th = STATIONS.integSeat.heading; break;
    default: break;
  }
}

function startReview(w: World, rt: Rt): void {
  const a = rt.a;
  const id = w.inboxQueue.shift()!;
  const t = w.tickets.get(id);
  w.state.inboxStacks = Math.max(0, w.state.inboxStacks - 1);
  if (!t || t.status !== 'in_review') return;      // cancelled while queued
  rt.curId = id;
  a.ticketId = id; a.phase = 'reviewing'; a.pose = 'review'; rt.sub = 1; rt.t = 0;
  rt.wrng = keyedRng(w.settings.seed, `review:${t.id}:${t.reworks}`);
  rt.dur = reviewBaseSeconds(t.difficulty) * (0.8 + 0.4 * rt.wrng.next()) * (t.reworks > 0 ? 0.7 : 1);
  a.activeSubagents = Math.min(a.config.subagents, 1 + (t.difficulty >> 1));
  w.say(rt, `reviewing ${t.id}`);
  w.log(a.id, 'review', `${a.name} started reviewing ${t.id} (${w.state.inboxStacks} more in queue)`);
}

function reviewTick(w: World, rt: Rt, h: number): void {
  const a = rt.a, t = rt.curId ? w.tickets.get(rt.curId) : undefined;
  if (!t) { rt.sub = 0; a.phase = 'idle'; a.pose = 'wait'; a.activeSubagents = 0; return; }
  rt.t += h; a.phaseProgress = Math.min(1, rt.t / rt.dur);
  const r = tokenRates(a.config.effort, a.contextFill);
  w.charge(rt, r.input * h * 1.5, r.output * h * 1.5, r.cacheRead * h * 1.5, t, false, true);
  w.bumpFill(rt, 0.006 * h);
  if (rt.t < rt.dur) return;

  const s = w.settings, d = t.difficulty;
  const authorRt = t.assignee ? w.rts.get(t.assignee) : undefined;
  let p = s.rejectRate * (0.6 + 0.2 * (d - 1));
  if (authorRt) p += 0.1 * fitDeficit(authorRt.a.config, d);
  p *= Math.pow(0.5, t.reworks);
  p = s.rejectRate > 0 ? Math.min(0.9, p) : 0;
  const reject = rt.wrng.next() < p;
  a.activeSubagents = 0;
  if (!reject) {
    a.carrying = { kind: 'pr', count: 1 }; a.phase = 'merging'; rt.sub = 5;
    walkTo(rt, { station: 'mainRack' }, 'main');
    return;
  }
  const reason = rt.wrng.pick(REJECT_REASONS);
  const authorId = t.assignee ?? '';
  t.status = 'changes_requested'; t.reworks++; w.rejectedCount++;
  w.log(a.id, 'reject', `${t.id} sent back: ${reason}`);
  w.say(rt, 'changes requested');
  w.emit({ type: 'pr_rejected', ticket: t, agentId: authorId });
  if (authorRejected(w, t, reason)) {
    // fold the comments into a red plane and toss it to the author
    a.phase = 'returning'; a.pose = 'throw'; rt.sub = 2; rt.t = 0; rt.dur = 0.9;
    w.sendPlane('changes', { agent: a.id }, { agent: authorId }, `${t.id}:${t.reworks}`, { agent: authorId, ticketId: t.id }, reason, t.id, 0.5);
  } else {
    a.ticketId = null; rt.curId = null; a.phase = 'idle'; a.pose = 'wait'; rt.sub = 0;
  }
}

function finishThrow(w: World, rt: Rt, merged: boolean): void {
  const a = rt.a;
  a.ticketId = null; rt.curId = null; a.carrying = null;
  if (merged && w.mergeSeq % 3 === 0) {
    rt.sub = 7; a.phase = 'merging';
    walkTo(rt, { station: 'deployRack' }, 'deploy');
  } else {
    rt.sub = 4; a.phase = 'idle';
    walkTo(rt, { station: 'integSeat' }, 'home_i');
  }
}

function doMerge(w: World, rt: Rt): void {
  const a = rt.a, st = w.state;
  const t = rt.curId ? w.tickets.get(rt.curId) : undefined;
  if (!t || t.status !== 'in_review') { rt.sub = 4; a.carrying = null; walkTo(rt, { station: 'integSeat' }, 'home_i'); return; }
  const authorId = t.assignee ?? '';
  t.status = 'merged'; t.mergedAt = st.time; t.progress = 1;
  w.finalStatus.set(t.id, 'merged');
  w.sprintMerged++; w.sprintMergedCost += t.usage.costUsd; w.lifeMergedCost += t.usage.costUsd;
  w.mergedCount++; w.cycleSum += t.mergedAt - t.createdAt; w.recentMerges.push(t.mergedAt);
  w.mergeSeq++; st.mainCommits++;
  w.log(a.id, 'merge', `Merged ${t.id} to main (cost $${t.usage.costUsd.toFixed(2)}, est $${t.estimatedCostUsd.toFixed(2)})`);
  w.say(rt, `Merged ${t.id}`);
  w.emit({ type: 'pr_merged', ticket: t, agentId: authorId });
  authorMerged(w, t);
  hackOnMerged(w, t);
  if (st.tickets.length > 90) w.pruneTerminal(30);
  // the green plane: the author celebrates when it lands (no tray walk)
  a.carrying = null; a.phase = 'merging'; a.pose = 'throw'; rt.sub = 9; rt.t = 0; rt.dur = 0.9;
  if (authorId) w.sendPlane('merged', { agent: a.id }, { agent: authorId }, t.id, { agent: authorId, ticketId: t.id }, t.id, t.id, 0.5);
}

function doDeploy(w: World, rt: Rt): void {
  w.state.deployments++;
  w.log(rt.a.id, 'merge', `Deployed main to production (#${w.state.deployments})`);
  w.say(rt, 'Deployed!');
  if (w.settings.mode === 'hackathon' && w.state.hack.active) startDeploy(w);
  rt.sub = 4; rt.a.phase = 'idle';
  walkTo(rt, { station: 'integSeat' }, 'home_i');
}
