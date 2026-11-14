/** Orchestrator: plans at the board, files tickets (brief plan in hackathon mode), delivers them (walk to the depot / paper planes for pinned ones), answers help, watches ETA + budget. */
import { STATIONS } from '../layout';
import { FREEZE_S, openCount, takePlanned, unclaimedCount } from './hack';
import { WALK_MPS, advanceWalk, walkTo } from './movement';
import { tokenRates } from './pricing';
import { keyedRng } from './prng';
import type { Rt, World } from './world';

const CADENCE = 22;        // sprint mode: min sim-seconds between planning trips
const HACK_CADENCE = 9;    // hackathon: the plan is front-loaded, keep the depot stocked
// sub: 0 seated, 1 walking to board, 2 planning, 3 walking to depot, 4 dropping, 5 walking home, 6 celebrating,
//      7 answering a help request, 9 throwing 'assign' planes for pinned tickets

export function updateOrchestrator(w: World, rt: Rt, h: number): void {
  const a = rt.a, s = w.settings, st = w.state;
  if (a.bubble !== null) { rt.bubbleT -= h; if (rt.bubbleT <= 0) a.bubble = null; }
  watch(w, rt, h);

  if (rt.walking) {
    if (advanceWalk(rt, WALK_MPS * s.walkSpeed, h)) arrive(w, rt);
    return;
  }
  const hack = s.mode === 'hackathon';

  switch (rt.sub) {
    case 0: {
      if (w.submitFx & 1) {
        w.submitFx &= ~1;
        rt.sub = 6; a.phase = 'celebrating'; a.pose = 'celebrate'; rt.t = 0; rt.dur = 4.5;
        return;
      }
      if (rt.helpInbox.length > 0 && startAnswer(w, rt)) return;
      if (!hack && w.sprintCreated >= s.totalScope && w.sprintMerged > 0 && st.metrics.open === 0 && w.held.length === 0) {
        const mins = (st.time - w.sprintStartT) / 60;
        w.log(a.id, 'plan', `Sprint ${w.sprintNo} shipped: ${w.sprintMerged}/${s.totalScope} in ${mins.toFixed(0)}m, $${w.sprintCostUsd.toFixed(0)}`);
        w.say(rt, `Sprint ${w.sprintNo} shipped!`, 4);
        w.emit({ type: 'plan_updated', plan: st.plan });
        rt.sub = 6; a.phase = 'celebrating'; a.pose = 'celebrate'; rt.t = 0; rt.dur = 3.5;
        return;
      }
      w.orchSince += h;
      let go = false;
      if (hack) {
        const hk = st.hack;
        if (w.planQueue.length > 0 && hk.stage !== 'submitted' && st.time < hk.endsAt - FREEZE_S) {
          const need = s.workerCount + 2 - unclaimedCount(w);
          go = (need >= 2 || (need >= 1 && unclaimedCount(w) === 0)) && w.orchSince >= (hk.stage === 'kickoff' ? 1.5 : HACK_CADENCE);
        }
      } else {
        const scopeLeft = s.totalScope - w.sprintCreated;
        if (scopeLeft > 0) w.orchBudget = Math.min(8, w.orchBudget + s.ticketsPerMinute / 60 * h);
        go = scopeLeft > 0 && w.orchBudget >= 1 && w.orchSince >= CADENCE;
      }
      if (go) {
        w.orchSince = 0; rt.sub = 1; a.phase = 'planning'; a.pose = 'walk';
        w.say(rt, hack ? (st.hack.stage === 'kickoff' ? 'Reading the brief' : 'Filing the next tasks') : 'Planning next batch');
        walkTo(rt, { station: 'board' }, 'board');
      } else if (w.held.length > 0 && w.orchSince >= 3) {
        w.orchSince = 0;
        startDelivery(w, rt);
      } else {
        rt.poseT -= h;
        if (rt.poseT <= 0) { rt.poseAlt = !rt.poseAlt; rt.poseT = 3 + rt.rng.next() * 6; }
        a.pose = st.metrics.utilization > 0 ? (rt.poseAlt ? 'think' : 'type') : 'wait';
      }
      return;
    }
    case 2: {
      const r = tokenRates(a.config.effort, a.contextFill);
      w.charge(rt, r.input * h * 0.3, r.output * h * 0.3, r.cacheRead * h * 0.3, null, false, false);
      w.bumpFill(rt, 0.004 * h);
      rt.planNext -= h;
      if (rt.planNext <= 0) {
        if (rt.planLeft > 0) {
          rt.planLeft--;
          if (hack) {
            const p = takePlanned(w);
            if (p) {
              const t = w.newTicket({ title: p.title, description: p.description, difficulty: p.difficulty, skills: p.skills, epic: p.epic, milestone: p.milestone, priority: p.priority }, 'orchestrator');
              w.charge(rt, 6000, 1500, 0, null, false, false);
              w.say(rt, `${t.id} ${t.title}`);
            }
          } else if (w.sprintCreated < s.totalScope) {
            const t = w.createSprintTicket();
            w.charge(rt, 6000, 1500, 0, null, false, false);
            w.say(rt, `${t.id} ${t.title}`);
          }
          rt.planNext = rt.planLeft > 0 ? (hack && st.hack.stage === 'kickoff' ? 0.9 : 2.0) : 1.2;
        } else startDelivery(w, rt);
      }
      return;
    }
    case 6: {
      rt.t += h; a.phaseProgress = Math.min(1, rt.t / rt.dur);
      if (rt.t >= rt.dur) {
        if (hack) {
          rt.sub = 0; a.phase = 'idle'; a.pose = 'wait';
          return;
        }
        w.beginSprint(false);
        w.log(a.id, 'plan', `${st.plan.name} kicked off - ${s.totalScope} tasks, ${s.deadlineMinutes} min window`);
        w.say(rt, 'Next sprint - planning...', 4);
        rt.sub = 0; a.phase = 'idle'; a.pose = 'wait';
      }
      return;
    }
    case 4: {
      rt.t += h; a.phaseProgress = Math.min(1, rt.t / rt.dur);
      if (rt.t >= rt.dur) {
        const n = rt.carried.length;
        for (const t of rt.carried) w.depotIds.add(t.id);
        st.depotStacks += n;
        rt.carried.length = 0;
        a.carrying = null;
        if (n > 0) { w.say(rt, `${n} task${n > 1 ? 's' : ''} at the depot`); w.log(a.id, 'ticket', `${a.name} stocked the depot with ${n} task${n > 1 ? 's' : ''}`); }
        rt.sub = 5; a.phase = 'idle';
        walkTo(rt, { station: 'orchSeat' }, 'home');
      }
      return;
    }
    case 7: answerTick(w, rt, h); return;
    case 9: {
      rt.t += h;
      if (rt.t < rt.dur) return;
      const t = rt.assignQ.shift();
      if (t && t.status === 'backlog' && t.pinnedTo && w.rts.has(t.pinnedTo)) {
        rt.throwT = 0.9; a.pose = 'throw';
        w.sendPlane('assign', { agent: a.id }, { agent: t.pinnedTo }, t.id, { agent: t.pinnedTo, ticketId: t.id }, t.id, t.id, 0.5);
        w.say(rt, `${t.id} -> ${w.agentName(t.pinnedTo)}`, 3);
        w.log(a.id, 'ticket', `${a.name} sent ${t.id} to ${w.agentName(t.pinnedTo)} by plane`);
        rt.t = 0; rt.dur = 1.1;
        return;
      }
      if (rt.assignQ.length > 0) { rt.t = rt.dur; return; }      // skip a dead entry, throw the next one right away
      afterAssign(w, rt);
      return;
    }
    default: rt.sub = 0; return;
  }
}

function arrive(w: World, rt: Rt): void {
  const a = rt.a, s = w.settings, st = w.state;
  switch (rt.next) {
    case 'board': {
      rt.sub = 2; a.phase = 'planning'; a.pose = 'plan';
      if (s.mode === 'hackathon') {
        const kick = st.hack.stage === 'kickoff';
        const need = s.workerCount + 2 - unclaimedCount(w);
        const n = Math.max(0, Math.min(w.planQueue.length, Math.max(1, need), kick ? s.workerCount + 2 : 4));
        rt.planLeft = n; rt.planNext = kick ? 1.2 : 1.0;
      } else {
        const scopeLeft = s.totalScope - w.sprintCreated;
        const n = Math.max(0, Math.min(Math.floor(w.orchBudget), scopeLeft));
        w.orchBudget -= n;
        rt.planLeft = n; rt.planNext = 1.5;
      }
      a.activeSubagents = Math.min(2, a.config.subagents);
      refreshNote(w, rt, true);
      break;
    }
    case 'depot': rt.sub = 4; a.pose = 'pickup'; rt.t = 0; rt.dur = 1.2; break;
    case 'home': rt.sub = 0; a.phase = 'idle'; a.pose = 'wait'; rt.atDesk = true; rt.th = STATIONS.orchSeat.heading; break;
    default: break;
  }
}

/** Split what the orchestrator holds: pinned tickets fly to their agent, the rest is carried to the depot. */
function startDelivery(w: World, rt: Rt): void {
  const a = rt.a;
  rt.carried.length = 0; rt.assignQ.length = 0;
  for (const t of w.held) {
    if (t.pinnedTo !== null && w.rts.has(t.pinnedTo)) rt.assignQ.push(t); else rt.carried.push(t);
  }
  w.held.length = 0;
  a.activeSubagents = 0;
  if (rt.assignQ.length > 0) {
    a.phase = 'delivering'; rt.sub = 9; rt.t = 1.1; rt.dur = 1.1;
    if (rt.carried.length > 0) a.carrying = { kind: 'tickets', count: rt.carried.length };
    return;
  }
  afterAssign(w, rt);
}

function afterAssign(w: World, rt: Rt): void {
  const a = rt.a;
  rt.assignQ.length = 0;
  if (rt.carried.length === 0) {
    a.carrying = null;
    if (rt.atDesk) { rt.sub = 0; a.phase = 'idle'; a.pose = 'wait'; }
    else { rt.sub = 5; a.phase = 'idle'; walkTo(rt, { station: 'orchSeat' }, 'home'); }
    return;
  }
  a.phase = 'delivering'; a.carrying = { kind: 'tickets', count: rt.carried.length };
  rt.sub = 3;
  walkTo(rt, { station: 'depot' }, 'depot');
}

// ---------------------------------------------------------------- help requests addressed to the orchestrator (secrets, access)
function startAnswer(w: World, rt: Rt): boolean {
  while (rt.helpInbox.length) {
    const req = w.helpById.get(rt.helpInbox.shift()!);
    if (!req || req.status !== 'open') continue;
    const a = rt.a;
    rt.curHelp = req.id; a.helping = req.fromAgent;
    a.phase = 'helping'; a.pose = 'type'; rt.sub = 7; rt.t = 0;
    rt.dur = 2.5 + 2 * keyedRng(w.settings.seed, 'od:' + req.id).next();
    w.say(rt, `Granting ${w.agentName(req.fromAgent)}`, 3);
    return true;
  }
  return false;
}

function answerTick(w: World, rt: Rt, h: number): void {
  const a = rt.a;
  rt.t += h; a.phaseProgress = Math.min(1, rt.t / rt.dur);
  const r = tokenRates(a.config.effort, a.contextFill);
  w.charge(rt, r.input * h * 0.4, r.output * h * 0.4, r.cacheRead * h * 0.4, null, false, false);
  if (rt.t < rt.dur) return;
  const req = rt.curHelp ? w.helpById.get(rt.curHelp) : undefined;
  if (req && req.status === 'open') {
    rt.throwT = 0.9;
    w.sendPlane('help_reply', { agent: a.id }, { agent: req.fromAgent }, 'hr:' + req.id, { agent: req.fromAgent, reqId: req.id }, '!', req.ticketId ?? undefined);
  }
  a.helping = null; rt.curHelp = null; rt.sub = 0; a.phase = 'idle'; a.pose = 'wait';
}

// ---------------------------------------------------------------- plan note + deadline watch
function watch(w: World, rt: Rt, h: number): void {
  rt.noteT -= h;
  if (rt.noteT <= 0) { rt.noteT = 20 + rt.rng.next() * 15; refreshNote(w, rt, false); }
  rt.riskT -= h;
  if (rt.riskT <= 0) { rt.riskT = 4; checkRisk(w, rt); }
}

function setNote(w: World, note: string): void {
  if (w.state.plan.note === note) return;
  w.state.plan.note = note;
  w.emit({ type: 'plan_updated', plan: w.state.plan });
}

function refreshNote(w: World, rt: Rt, atBoard: boolean): void {
  const st = w.state, s = w.settings;
  const epic = rt.rng.pick(st.plan.epics.length ? st.plan.epics : ['Core']);
  if (s.mode === 'hackathon') {
    const h = st.hack;
    if (h.stage === 'submitted') return;
    if (w.atRisk) { setNote(w, 'Re-prioritising: deadline risk'); return; }
    switch (h.stage) {
      case 'kickoff': setNote(w, `Kickoff: ${w.planQueue.length} tasks to file`); return;
      case 'build': setNote(w, `Building the core: ${w.sprintMerged}/${w.hackPlanned} merged`); return;
      case 'polish': setNote(w, 'Polish - cutting whatever will not fit'); return;
      case 'demo': setNote(w, 'Demo prep: README, script, live preview'); return;
      default: return;
    }
  }
  if (w.atRisk) { setNote(w, 'Re-prioritising: deadline risk'); return; }
  if (w.sprintMerged >= s.totalScope) { setNote(w, 'Scope complete - shipping'); return; }
  if (st.inboxStacks >= 3) { setNote(w, 'Review queue backing up'); return; }
  if (st.depotStacks >= 5) { setNote(w, 'Backlog piling up at the depot'); return; }
  const opts = [`Splitting ${epic} epic`, `Sequencing ${epic} dependencies`, `Grooming ${epic} backlog`, 'Balancing load across agents'];
  setNote(w, atBoard ? opts[0] : rt.rng.pick(opts));
}

function checkRisk(w: World, rt: Rt): void {
  const st = w.state, m = st.metrics;
  if (w.settings.mode === 'hackathon' && (st.hack.stage === 'submitted' || openCount(w) + w.planQueue.length === 0)) { if (w.atRisk) w.atRisk = false; return; }
  const eta = m.etaMinutes;
  const proj = eta !== null && eta > 0 ? st.time / 60 + eta : 0;
  // hysteresis so the note does not flap
  const dl = st.plan.deadlineMinutes, t0 = w.sprintStartT / 60;
  const risk = w.atRisk ? (proj > t0 + (dl - t0) * 0.97 || st.time - w.riskSince < 120) : proj > t0 + (dl - t0) * 1.05;
  if (risk && !w.atRisk) {
    w.atRisk = true; w.lastRiskBubbleT = st.time; w.riskSince = st.time;
    w.log('orch', 'plan', `ETA ${eta!.toFixed(0)} min is past the ${(dl - t0).toFixed(0)} min deadline - descoping low-priority tasks`);
    w.say(rt, 'Deadline at risk - descoping', 4.5);
    setNote(w, 'Re-prioritising: deadline risk');
  } else if (risk && st.time - w.lastRiskBubbleT > 60) {
    w.lastRiskBubbleT = st.time;
    w.say(rt, 'Deadline at risk - descoping', 4.5);
  } else if (!risk && w.atRisk) {
    w.atRisk = false;
    w.log('orch', 'plan', 'Back on track for the deadline');
    setNote(w, 'Back on track');
  }
}
