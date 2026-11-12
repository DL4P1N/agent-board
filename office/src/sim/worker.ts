/** Worker agent behaviour: depot -> (library) -> desk -> work -> PR plane -> review -> merge/rework, plus help requests. */
import { DESKS } from '../layout';
import { SKILL_SLOTS } from '../skills';
import type { AgentState, Ticket } from '../types';
import { fillTotal, shortModel, speedOf, workBaseSeconds } from './difficulty';
import { createHelp, helpQuestion, pickHelper } from './help';
import { BLOCK_REASONS, WAIT_REASONS } from './names';
import { WALK_MPS, advanceWalk, walkTo } from './movement';
import { tokenRates } from './pricing';
import { keyedRng } from './prng';
import type { Rt, World } from './world';

export function updateWorker(w: World, rt: Rt, h: number): void {
  const a = rt.a;
  if (a.bubble !== null) { rt.bubbleT -= h; if (rt.bubbleT <= 0) a.bubble = null; }
  const ov = w.overrides.get(a.id);
  const wantOffline = rt.leaving || (ov !== undefined && ov.offline === true);
  if (wantOffline) { if (a.phase !== 'offline') goOffline(w, rt); }
  else if (a.phase === 'offline') comeOnline(w, rt);
  if (a.phase === 'offline') { updateOffline(w, rt, h); return; }

  if (rt.walking) {
    if (advanceWalk(rt, WALK_MPS * w.settings.walkSpeed, h)) onArrive(w, rt);
    return;
  }

  // verdict planes first: an author must not be starved of its celebration / rework by a stream of help requests
  if (a.phase === 'awaiting_review' && rt.pend !== 0 && rt.atDesk) {
    if (rt.pend === 1) { rt.pend = 0; startRework(w, rt); } else { rt.pend = 0; celebrate(w, rt); }
    return;
  }
  if (rt.helpInbox.length > 0 && rt.hp === null && rt.atDesk && canHelpNow(rt) && startHelping(w, rt)) return;

  switch (a.phase) {
    case 'idle': {
      const t = w.claim(rt);
      if (t) {
        rt.idleT = 0; rt.reason = '';
        w.say(rt, `taking ${t.id} (d${t.difficulty})`);
        w.log(a.id, 'ticket', `${a.name} claimed ${t.id} "${t.title}"`);
        w.emit({ type: 'ticket_assigned', ticket: t, agentId: a.id });
        if (w.planeDelivered.has(t.id)) {
          // the orchestrator flew this one over: no depot trip
          w.planeDelivered.delete(t.id); w.depotIds.delete(t.id);
          applyPickupConfig(w, rt);
          afterPickup(w, rt);
        } else {
          a.phase = 'to_depot';
          walkTo(rt, { station: 'depot' }, 'depot');
        }
        return;
      }
      if (!rt.atDesk) { walkTo(rt, { desk: a.deskIndex }, 'desk_idle'); return; }
      rt.idleT += h;
      a.pose = rt.idleT > 45 ? 'sleep' : 'wait';
      a.phaseProgress = 0;
      return;
    }
    case 'picking_up': {
      rt.t += h; a.phaseProgress = Math.min(1, rt.t / rt.dur);
      if (rt.t >= rt.dur) finishPickup(w, rt);
      return;
    }
    case 'picking_skills': {
      rt.t += h; a.phaseProgress = Math.min(1, rt.t / rt.dur);
      if (rt.t >= rt.dur) equipSkills(w, rt);
      return;
    }
    case 'working': case 'reworking': workTick(w, rt, h); return;
    case 'waiting': case 'blocked': interTick(w, rt, h); return;
    case 'asking_help': askingTick(w, rt, h); return;
    case 'awaiting_help': awaitingHelpTick(w, rt, h); return;
    case 'helping': helpingTick(w, rt, h); return;
    case 'submitting': {
      rt.t += h; a.phaseProgress = Math.min(1, rt.t / rt.dur);
      if (rt.t >= rt.dur) { a.phase = 'awaiting_review'; a.pose = 'wait'; }
      return;
    }
    case 'awaiting_review': {
      if (rt.pend === 1) { rt.pend = 0; startRework(w, rt); }
      else if (rt.pend === 2) { rt.pend = 0; celebrate(w, rt); }
      else a.pose = 'wait';
      return;
    }
    case 'celebrating': {
      rt.t += h; a.phaseProgress = Math.min(1, rt.t / rt.dur);
      if (rt.t >= rt.dur) { a.phase = 'idle'; a.pose = rt.atDesk ? 'wait' : 'idle'; rt.idleT = 0; }
      return;
    }
    default: {
      // any unexpected resting state: fall back to idle
      a.phase = 'idle';
    }
  }
}

function seat(rt: Rt): void { rt.atDesk = true; rt.th = DESKS[rt.a.deskIndex].heading; }

function onArrive(w: World, rt: Rt): void {
  const a = rt.a;
  switch (rt.next) {
    case 'depot': beginPickup(w, rt); break;
    case 'library': beginSkills(w, rt); break;
    case 'desk_idle': seat(rt); a.phase = 'idle'; a.pose = 'wait'; rt.idleT = 0; break;
    case 'desk_work': seat(rt); startWork(w, rt, false); break;
    case 'desk_rework': seat(rt); startWork(w, rt, true); break;
    case 'desk_wait': seat(rt); a.phase = 'awaiting_review'; a.pose = 'wait'; break;
    case 'desk_resume': seat(rt); resumeWork(w, rt); break;
    case 'vault': a.pose = 'pickup'; rt.sub = 2; rt.t = 0; rt.dur = 2; break;
    default: break;
  }
}

// ---------------------------------------------------------------- pickup + skills
function applyPickupConfig(w: World, rt: Rt): void {
  const a = rt.a, t = rt.ticket!;
  rt.lastDiff = t.difficulty;
  a.config = w.configFor(rt, t.difficulty, true);
  a.overridden = w.hasConfigOverride(a.id);
  const m = shortModel(a.config), n = a.config.subagents;
  if (rt.downshifted) {
    w.say(rt, `-> ${m} (budget)`);
    w.log(a.id, 'cost', `Over budget: ${a.name} runs ${t.id} on ${a.config.model} with ${n} subagents`);
  } else {
    w.say(rt, n === 0 ? `-> ${m}, solo` : `-> ${m}, ${n} subagent${n > 1 ? 's' : ''}`);
  }
}

function beginPickup(w: World, rt: Rt): void {
  const a = rt.a;
  a.phase = 'picking_up'; a.pose = 'pickup'; rt.t = 0; rt.dur = 1.2;
  applyPickupConfig(w, rt);
}

function touchSkill(a: AgentState, id: string): void {
  const i = a.skills.indexOf(id);
  if (i >= 0) { a.skills.splice(i, 1); a.skills.push(id); }
}

function finishPickup(w: World, rt: Rt): void {
  const t = rt.ticket!;
  w.depotIds.delete(t.id);
  if (!w.planeDelivered.has(t.id)) w.state.depotStacks = Math.max(0, w.state.depotStacks - 1);
  afterPickup(w, rt);
}

/** Papers in hand: fetch missing skills from the library, or head straight to the desk. */
function afterPickup(w: World, rt: Rt): void {
  const a = rt.a, t = rt.ticket!;
  a.carrying = { kind: 'tickets', count: 1 };
  const missing: string[] = [];
  for (const id of t.skills) { if (a.skills.includes(id)) touchSkill(a, id); else if (w.skillMap.has(id)) missing.push(id); }
  rt.missing = missing;
  if (missing.length > 0) {
    a.phase = 'to_library';
    walkTo(rt, { station: 'library' }, 'library');
  } else {
    w.say(rt, 'skills ready');
    a.phase = 'to_desk';
    walkTo(rt, { desk: a.deskIndex }, 'desk_work');
  }
}

function beginSkills(w: World, rt: Rt): void {
  const a = rt.a;
  a.phase = 'picking_skills'; a.pose = 'pickup'; rt.t = 0; rt.dur = 1.5;
  a.carrying = { kind: 'skills', count: rt.missing.length };
  w.say(rt, 'Grabbing ' + rt.missing.map((id) => w.skillName(id)).join(', '));
}

export function equipSkillLru(a: AgentState, id: string, keep: string[]): void {
  const i = a.skills.indexOf(id);
  if (i >= 0) a.skills.splice(i, 1);
  a.skills.push(id);
  while (a.skills.length > SKILL_SLOTS) {
    let idx = a.skills.findIndex((s) => s !== id && !keep.includes(s));
    if (idx < 0) idx = a.skills.findIndex((s) => s !== id);
    if (idx < 0) break;
    a.skills.splice(idx, 1);
  }
}

function equipSkills(w: World, rt: Rt): void {
  const a = rt.a, t = rt.ticket!;
  const loaded = rt.missing.filter((id) => w.skillMap.has(id));
  for (const id of loaded) {
    equipSkillLru(a, id, t.skills);
    w.charge(rt, w.skillMap.get(id)!.loadTokens, 0, 0, t, false, false);
  }
  rt.missing = [];
  if (loaded.length) {
    w.log(a.id, 'skill', `${a.name} loaded ${loaded.map((id) => w.skillName(id)).join(', ')} (${a.skills.length}/${SKILL_SLOTS} slots)`);
    w.emit({ type: 'skills_loaded', agentId: a.id, skills: loaded });
  }
  a.carrying = { kind: 'tickets', count: 1 };
  a.phase = 'to_desk';
  walkTo(rt, { desk: a.deskIndex }, 'desk_work');
}

// ---------------------------------------------------------------- work
function startWork(w: World, rt: Rt, rework: boolean): void {
  const a = rt.a, t = rt.ticket!, s = w.settings;
  const rng = keyedRng(s.seed, `work:${t.id}:${t.reworks}`);
  rt.wrng = rng;
  a.carrying = null; t.status = 'in_progress'; t.progress = 0; rt.rework = rework;
  a.phase = rework ? 'reworking' : 'working'; a.pose = 'type'; a.phaseProgress = 0;
  if (!rework) a.contextFill = 0.05 + rng.next() * 0.1 + 0.01 * t.skills.length;
  else w.passCost.set(t.id, 0);
  // make sure the skills the ticket needs are equipped (a human may have edited it since pickup)
  for (const id of t.skills) if (!a.skills.includes(id) && w.skillMap.has(id)) equipSkillLru(a, id, t.skills);
  const d = t.difficulty;
  rt.baseDur = workBaseSeconds(d) * (0.75 + 0.5 * rng.next()) * (rework ? 0.35 + 0.25 * rng.next() : 1) * (s.mode === 'hackathon' ? w.hackScale : 1);
  let pb = s.blockRate * (rework ? 0.4 : 1);
  let secret: string | null = null;
  if (!rework) for (const id of t.skills) { const sk = w.skillMap.get(id); if (sk && sk.needsSecret) { secret = sk.needsSecret; break; } }
  if (secret) pb = pb * 2.5 + (s.blockRate > 0 ? 0.08 : 0);
  pb = Math.min(0.9, pb);
  rt.blockSecret = false;
  if (rng.chance(pb)) {
    rt.blockAt = 0.2 + 0.55 * rng.next();
    if (secret && rng.chance(0.8)) { rt.blockText = `need ${secret}`; rt.blockVault = rng.chance(0.75); rt.blockSecret = true; }
    else { const r = rng.pick(BLOCK_REASONS); rt.blockText = r.text; rt.blockVault = r.vault && rng.chance(0.6); }
  } else rt.blockAt = -1;
  rt.waitAt = rng.chance(rework ? 0.1 : 0.2) ? 0.15 + 0.7 * rng.next() : -1;
  if (rt.waitAt >= 0 && rt.blockAt >= 0 && Math.abs(rt.waitAt - rt.blockAt) < 0.08) rt.waitAt = -1;
  // "stuck, ask a peer" moments arrive as a Poisson-ish clock over working time (hard tickets stall more often)
  rt.helpAt = s.helpRate > 0 ? helpGap(w, rt, d, rework) : -1;
  rt.inter = 0; rt.poseT = 4 + rt.rng.next() * 6; rt.poseAlt = false; rt.waveT = 0; rt.subTarget = 0; rt.subStepT = 0;
  w.say(rt, rework ? (rt.reason ? `Fix: ${rt.reason}` : 'reworking...') : `${t.id} - on it`);
}

function helpGap(w: World, rt: Rt, d: number, rework: boolean): number {
  const u = rt.wrng.next();
  return -Math.log(1 - 0.98 * u) * (50 / Math.max(0.05, w.settings.helpRate)) * (1.5 - 0.15 * d) * (rework ? 2 : 1);
}

function startRework(w: World, rt: Rt): void {
  const t = rt.ticket;
  if (!t || t.status !== 'changes_requested') return;
  if (!rt.atDesk) { rt.a.phase = 'to_desk'; walkTo(rt, { desk: rt.a.deskIndex }, 'desk_rework'); return; }
  startWork(w, rt, true);
}

function celebrate(w: World, rt: Rt): void {
  const a = rt.a;
  a.phase = 'celebrating'; a.pose = 'celebrate'; rt.t = 0; rt.dur = 3; a.activeSubagents = 0; a.contextFill = 0.05;
  w.say(rt, 'Merged!');
}

function resumeWork(w: World, rt: Rt): void {
  rt.inter = 0; rt.a.phase = rt.rework ? 'reworking' : 'working'; rt.a.pose = 'type'; rt.waveT = 0;
}

function tickSubs(w: World, rt: Rt, h: number, working: boolean): void {
  const a = rt.a, n = a.config.subagents;
  let target = 0;
  if (working && n > 0) {
    rt.waveT -= h;
    if (rt.waveT <= 0) {
      rt.waveT = 4 + rt.wrng.next() * 6;
      rt.subTarget = rt.wrng.chance(0.15) ? 0 : Math.max(1, Math.round(n * (0.5 + 0.5 * rt.wrng.next())));
    }
    target = Math.min(rt.subTarget, n);
  }
  rt.subStepT -= h;
  if (rt.subStepT <= 0) {
    rt.subStepT = 0.7;
    if (a.activeSubagents < target) a.activeSubagents++;
    else if (a.activeSubagents > target) a.activeSubagents--;
  }
  if (a.activeSubagents > n) a.activeSubagents = n;
}

function workTick(w: World, rt: Rt, h: number): void {
  const a = rt.a, t = rt.ticket!, cfg = a.config;
  tickSubs(w, rt, h, true);
  rt.poseT -= h;
  if (rt.poseT <= 0) { rt.poseAlt = !rt.poseAlt; rt.poseT = rt.poseAlt ? 2 + rt.rng.next() * 3 : 6 + rt.rng.next() * 8; }
  a.pose = rt.compactT > 0 || rt.poseAlt ? 'think' : 'type';

  const sp = w.settings.workSpeed * speedOf(cfg, t.difficulty, a.activeSubagents);
  const dp = Math.min(1 - t.progress, h * sp / rt.baseDur);
  t.progress += dp;
  a.phaseProgress = t.progress;
  w.bumpFill(rt, dp * fillTotal(t.difficulty) * (1 + 0.03 * a.activeSubagents));

  const r = tokenRates(cfg.effort, a.contextFill);
  const bh = h * (w.settings.mode === 'hackathon' ? w.hackBurn : 1);   // slowed-down hackathon pace burns proportionally less per second
  w.charge(rt, r.input * bh, r.output * bh, r.cacheRead * bh, t, false, false);
  if (a.activeSubagents > 0) {
    const q = tokenRates(cfg.effort, 0.3, true), k = bh * a.activeSubagents;
    w.charge(rt, q.input * k, q.output * k, q.cacheRead * k, t, true, false);
  }

  if (rt.waitAt >= 0 && t.progress >= rt.waitAt) { startInter(w, rt, 1); return; }
  if (rt.blockAt >= 0 && t.progress >= rt.blockAt) { startInter(w, rt, 2); return; }
  if (rt.helpAt >= 0) {
    rt.helpAt -= h;
    if (rt.helpAt <= 0) { rt.helpAt = w.settings.helpRate > 0 ? helpGap(w, rt, t.difficulty, rt.rework) : -1; startInter(w, rt, 3); return; }
  }
  if (t.progress >= 1) finishWork(w, rt);
}

function interTick(w: World, rt: Rt, h: number): void {
  const a = rt.a;
  tickSubs(w, rt, h, false);
  if (a.phase === 'waiting') {
    rt.interT += h;
    if (rt.interT >= rt.interDur) resumeWork(w, rt);
    return;
  }
  // blocked: sit frustrated, then (for vault blocks) walk to the safe, wait a moment, come back
  switch (rt.sub) {
    case 0:
      rt.interT += h; a.pose = 'blocked';
      if (rt.interT >= rt.interDur) {
        if (rt.blockVault) { rt.sub = 1; walkTo(rt, { station: 'vault' }, 'vault'); }
        else resumeWork(w, rt);
      }
      return;
    case 2:
      rt.t += h; a.phaseProgress = Math.min(1, rt.t / rt.dur);
      if (rt.t >= rt.dur) { rt.sub = 3; a.pose = 'walk'; walkTo(rt, { desk: a.deskIndex }, 'desk_resume'); }
      return;
    default: return;
  }
}

function startInter(w: World, rt: Rt, kind: 1 | 2 | 3): void {
  const a = rt.a, t = rt.ticket!, hr = w.settings.helpRate;
  rt.inter = kind; rt.interT = 0; rt.sub = 0;
  if (kind === 1) {
    rt.waitAt = -1; a.phase = 'waiting'; a.pose = 'wait'; rt.interDur = 4 + rt.wrng.next() * 6;
    const txt = rt.wrng.pick(WAIT_REASONS);
    w.say(rt, txt, 4);
    w.log(a.id, 'info', `${a.name} is ${txt.toLowerCase()} (${t.id})`);
    if (hr > 0 && rt.wrng.chance(hr * 0.3)) beginAsk(w, rt);
  } else if (kind === 2) {
    rt.blockAt = -1; a.phase = 'blocked'; a.pose = 'blocked';
    rt.interDur = rt.blockVault ? 3 : 6 + rt.wrng.next() * 6;
    w.say(rt, rt.blockText, 4.5);
    w.log(a.id, 'block', `${a.name} blocked on ${t.id}: ${rt.blockText}`);
    if (hr > 0 && rt.wrng.chance(rt.blockSecret ? Math.min(1, hr * 1.6) : hr * 0.9)) beginAsk(w, rt);
  } else {
    rt.interDur = 16 + rt.wrng.next() * 8;
    if (!beginAsk(w, rt)) resumeWork(w, rt);
  }
}

// ---------------------------------------------------------------- help: asker side
function askKey(rt: Rt): string { return `${rt.a.id}:${rt.ticket!.id}:${rt.ticket!.reworks}:${rt.askN}`; }

function beginAsk(w: World, rt: Rt): boolean {
  const a = rt.a, t = rt.ticket!;
  rt.askN++;
  const key = askKey(rt);
  const target = rt.inter === 2 && rt.blockSecret ? 'orch' : pickHelper(w, rt, t, key);
  if (!target) return false;
  rt.askTarget = target;
  rt.interDur = Math.max(rt.interDur, 13 + 7 * rt.wrng.next());   // without help the stall would last this long
  a.activeSubagents = 0;
  a.phase = 'asking_help'; a.pose = 'raise_hand'; rt.t = 0; rt.dur = 0.6; rt.sub = 10;
  w.say(rt, rt.inter === 2 && rt.blockSecret ? 'asking Atlas for access' : 'anyone know this one?', 3);
  return true;
}

function askingTick(w: World, rt: Rt, h: number): void {
  const a = rt.a;
  rt.t += h;
  if (rt.sub === 10 && rt.t >= rt.dur) {
    rt.sub = 11; rt.t = 0; rt.dur = 0.9; a.pose = 'throw';
    const t = rt.ticket!;
    const key = askKey(rt);
    const req = createHelp(w, a.id, rt.askTarget, t, helpQuestion(w, t, key), false, key);
    rt.askReq = req.id; rt.helpDone = false;
  } else if (rt.sub === 11 && rt.t >= rt.dur) {
    a.phase = 'awaiting_help'; a.pose = rt.inter === 2 ? 'blocked' : 'wait'; a.waitingOn = rt.askTarget; rt.sub = 12;
  }
}

function awaitingHelpTick(w: World, rt: Rt, h: number): void {
  const a = rt.a, t = rt.ticket!;
  tickSubs(w, rt, h, false);
  rt.interT += h;
  const req = rt.askReq ? w.helpById.get(rt.askReq) : undefined;
  if (rt.helpDone) {
    rt.helpDone = false;
    if (rt.inter === 3) t.progress = Math.min(0.98, t.progress + 0.06);
    w.say(rt, 'thanks, that helps!', 3);
    endAsk(w, rt);
  } else if (!req || req.status === 'timeout' || rt.interT >= rt.interDur) {
    w.say(rt, 'moving on without it', 3);
    endAsk(w, rt);
  }
}

function endAsk(w: World, rt: Rt): void {
  rt.a.waitingOn = null; rt.askReq = null;
  resumeWork(w, rt);
}

// ---------------------------------------------------------------- help: helper side
export function canHelpNow(rt: Rt): boolean {
  const a = rt.a;
  if (rt.walking || !rt.atDesk || rt.leaving) return false;
  switch (a.phase) {
    case 'idle': case 'awaiting_review': case 'working': case 'reworking': case 'waiting': return true;
    case 'blocked': return rt.sub === 0;
    default: return false;
  }
}

function startHelping(w: World, rt: Rt): boolean {
  while (rt.helpInbox.length) {
    const req = w.helpById.get(rt.helpInbox.shift()!);
    if (!req || req.status !== 'open') continue;
    const a = rt.a;
    rt.hp = { phase: a.phase, pose: a.pose, sub: rt.sub, t: rt.t, dur: rt.dur };
    rt.curHelp = req.id; a.helping = req.fromAgent;
    a.phase = 'helping'; a.pose = 'type'; rt.sub = 20; rt.t = 0;
    rt.dur = 4 + 5 * keyedRng(w.settings.seed, 'hd:' + req.id).next();
    rt.poseT = 1.5; rt.poseAlt = false;
    w.say(rt, `Helping ${w.agentName(req.fromAgent)}`, 3);
    return true;
  }
  return false;
}

function helpingTick(w: World, rt: Rt, h: number): void {
  const a = rt.a;
  rt.t += h; a.phaseProgress = Math.min(1, rt.t / rt.dur);
  tickSubs(w, rt, h, false);
  if (rt.sub === 20) {
    rt.poseT -= h;
    if (rt.poseT <= 0) { rt.poseAlt = !rt.poseAlt; rt.poseT = 1.5 + rt.rng.next() * 1.5; }
    a.pose = rt.poseAlt ? 'think' : 'type';
    const r = tokenRates(a.config.effort, a.contextFill);
    const req = rt.curHelp ? w.helpById.get(rt.curHelp) : undefined;
    const at = req && req.ticketId ? w.tickets.get(req.ticketId) ?? null : null;
    // the helper's agent spends the tokens; the asker's ticket carries the cost
    w.charge(rt, r.input * h * 0.4, r.output * h * 0.4, r.cacheRead * h * 0.4, at && at.status !== 'merged' && at.status !== 'cancelled' ? at : null, false, false);
    if (rt.t >= rt.dur) {
      rt.sub = 21; rt.t = 0; rt.dur = 0.9; a.pose = 'throw';
      if (req && req.status === 'open') w.sendPlane('help_reply', { agent: a.id }, { agent: req.fromAgent }, 'hr:' + req.id, { agent: req.fromAgent, reqId: req.id }, '!', req.ticketId ?? undefined);
    }
  } else if (rt.t >= rt.dur) {
    const hp = rt.hp;
    a.helping = null; rt.curHelp = null; rt.hp = null; rt.helpedAt = w.state.time;
    if (hp) { a.phase = hp.phase; a.pose = hp.pose; rt.sub = hp.sub; rt.t = hp.t; rt.dur = hp.dur; } else { a.phase = 'idle'; a.pose = 'wait'; }
  }
}

function finishWork(w: World, rt: Rt): void {
  const a = rt.a, t = rt.ticket!;
  t.progress = 1; a.activeSubagents = 0; a.carrying = null;
  t.status = 'in_review';     // the plane is in the air; the PR reaches the inbox queue on landing
  a.phase = 'submitting'; a.pose = 'throw'; rt.t = 0; rt.dur = 0.9;
  w.say(rt, 'PR ready for review');
  w.sendPlane('pr', { agent: a.id }, { station: 'inbox' }, `${t.id}:${t.reworks}`, { agent: a.id, ticketId: t.id }, t.id, t.id, 0.5);
}

// ---------------------------------------------------------------- hooks used by the integrator
/** Merge accounting for the author (the celebration itself happens when the 'merged' plane lands). */
export function authorMerged(w: World, ticket: Ticket): void {
  const rt = ticket.assignee ? w.rts.get(ticket.assignee) : undefined;
  if (!rt) return;
  const a = rt.a;
  a.stats.merged++; a.stats.done++;
  if (a.ticketId === ticket.id) { a.ticketId = null; rt.ticket = null; }
}

/** Returns true if the author takes the ticket back for rework (change plane follows); false if it was returned to the depot. */
export function authorRejected(w: World, ticket: Ticket, reason: string): boolean {
  const rt = ticket.assignee ? w.rts.get(ticket.assignee) : undefined;
  w.wasteUsd += w.passCost.get(ticket.id) ?? 0;
  w.passCost.set(ticket.id, 0);
  if (rt && rt.a.phase !== 'offline' && !rt.leaving) {
    rt.reason = reason; rt.a.stats.reworks++;
    return true;
  }
  w.returnToDepot(ticket);
  if (rt) { rt.a.ticketId = null; rt.ticket = null; }
  w.log(null, 'ticket', `${ticket.id} returned to the depot (author unavailable)`);
  return false;
}

// ---------------------------------------------------------------- offline handling
function goOffline(w: World, rt: Rt): void {
  const a = rt.a;
  w.releaseTicket(rt);
  w.abortHelpState(rt);
  rt.helpInbox.length = 0; rt.pend = 0;
  a.phase = 'offline'; a.carrying = null; a.activeSubagents = 0; rt.inter = 0; rt.missing = [];
  w.say(rt, rt.leaving ? 'signing off' : 'going offline', 2.5);
  if (rt.atDesk && !rt.walking) a.pose = 'sleep';
  else walkTo(rt, { desk: a.deskIndex }, 'home_offline');
}

function comeOnline(w: World, rt: Rt): void {
  const a = rt.a;
  const hasPr = rt.ticket !== null && rt.ticket.status === 'in_review';
  a.phase = hasPr ? 'awaiting_review' : 'idle';
  rt.idleT = 0;
  if (rt.walking) { rt.next = hasPr ? 'desk_wait' : 'desk_idle'; a.pose = 'walk'; }
  else a.pose = rt.atDesk ? 'wait' : 'idle';
  w.say(rt, 'back online', 2.5);
}

function updateOffline(w: World, rt: Rt, h: number): void {
  const a = rt.a;
  if (rt.walking) {
    if (advanceWalk(rt, WALK_MPS * w.settings.walkSpeed, h)) { seat(rt); a.pose = 'sleep'; }
  } else a.pose = 'sleep';
  if (rt.leaving && !rt.walking && a.ticketId === null && !w.pendingRemove.includes(rt)) w.pendingRemove.push(rt);
}
