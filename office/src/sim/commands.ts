/** Human-facing board commands, implemented over the World (Simulation delegates here). */
import { EPIC_POOL } from './names';
import { SKILL_SLOTS, type Skill, type SkillCategory } from '../skills';
import type { Difficulty, Ticket, TicketSpec } from '../types';
import { clampDifficulty } from './difficulty';
import { FREEZE_S, descope, slug } from './hack';
import { createHelp, helpQuestion } from './help';
import { estimateForDifficulty } from './pricing';
import { keyedRng } from './prng';
import { equipSkillLru } from './worker';
import type { World } from './world';

const isTerminal = (t: Ticket): boolean => t.status === 'merged' || t.status === 'cancelled';

export function createTicket(w: World, spec: TicketSpec): Ticket {
  const title = (spec.title ?? '').trim() || 'Untitled task';
  const t = w.newTicket({ ...spec, title }, 'human');
  if (w.curMode === 'hackathon' && w.state.hack.active) { w.hackPlanned++; w.state.plan.totalTickets = w.hackPlanned; }
  return t;
}

/** A human "+ ticket" button press: random title from the epic pool. */
export function addRandomTicket(w: World, difficulty?: number): Ticket {
  const r = keyedRng(w.settings.seed, 'addt:' + (w.ticketSeq + 1));
  const epic = EPIC_POOL[Math.floor(r.next() * EPIC_POOL.length)];
  const def = r.pick(epic.items);
  const used = w.titleUse.get(def.t) ?? 0;
  w.titleUse.set(def.t, used + 1);
  const title = used === 0 ? def.t : `${def.t} (part ${used + 1})`;
  const spec: TicketSpec = { title, skills: def.s.filter((x) => w.skillMap.has(x)) };
  if (difficulty !== undefined && Number.isFinite(difficulty)) spec.difficulty = clampDifficulty(difficulty);
  return createTicket(w, spec);
}

export function updateTicket(w: World, id: string, patch: Partial<TicketSpec>): void {
  const t = w.tickets.get(id);
  if (!t || isTerminal(t)) return;
  const changes: string[] = [];
  if (patch.title !== undefined) { const x = patch.title.trim(); if (x && x !== t.title) { t.title = x; changes.push('title'); } }
  if (patch.description !== undefined) { t.description = patch.description; changes.push('description'); }
  if (patch.epic !== undefined && patch.epic.trim()) { t.epic = patch.epic.trim(); changes.push('epic'); }
  if (patch.difficulty !== undefined) {
    const d: Difficulty = clampDifficulty(patch.difficulty);
    if (d !== t.difficulty) {
      t.estimatedCostUsd *= estimateForDifficulty(d, w.settings.fleetMix, w.settings.rejectRate) / Math.max(1e-6, estimateForDifficulty(t.difficulty, w.settings.fleetMix, w.settings.rejectRate));
      t.difficulty = d; changes.push(`difficulty d${d}`);
    }
  }
  if (patch.skills !== undefined) { t.skills = patch.skills.filter((x, i, arr) => w.skillMap.has(x) && arr.indexOf(x) === i).slice(0, 4); changes.push('skills'); }
  if (patch.priority !== undefined && Number.isFinite(patch.priority)) { t.priority = patch.priority; changes.push(`priority ${t.priority}`); }
  if (patch.pinnedTo !== undefined) {
    if (patch.pinnedTo === null) { t.pinnedTo = null; changes.push('unpinned'); }
    else if (w.rts.get(patch.pinnedTo)?.a.role === 'worker') { t.pinnedTo = patch.pinnedTo; changes.push(`pinned to ${w.agentName(patch.pinnedTo)}`); }
  }
  if (patch.milestone !== undefined && patch.milestone !== t.milestone) {
    const h = w.state.hack;
    const old = t.milestone;
    if (old) {
      const m = h.milestones.find((x) => x.id === old);
      if (m) { const i = m.ticketIds.indexOf(t.id); if (i >= 0) m.ticketIds.splice(i, 1); }
      w.msCreated.set(old, Math.max(0, (w.msCreated.get(old) ?? 0) - 1));
      w.msPlanned.set(old, Math.max(0, (w.msPlanned.get(old) ?? 0) - 1));
    }
    t.milestone = patch.milestone;
    if (patch.milestone) {
      const m = h.milestones.find((x) => x.id === patch.milestone);
      if (m) { m.ticketIds.push(t.id); m.done = false; }
      w.msCreated.set(patch.milestone, (w.msCreated.get(patch.milestone) ?? 0) + 1);
      w.msPlanned.set(patch.milestone, (w.msPlanned.get(patch.milestone) ?? 0) + 1);
    }
    changes.push('milestone');
  }
  if (changes.length) w.log(null, 'ticket', `Updated ${t.id}: ${changes.join(', ')}`);
}

export function cancelTicket(w: World, id: string): void {
  const t = w.tickets.get(id);
  if (!t || isTerminal(t)) return;
  descope(w, id);
}

// ---------------------------------------------------------------- skills
const SKILL_COLORS = ['#38bdf8', '#a3e635', '#f472b6', '#fbbf24', '#fb923c', '#22d3ee', '#c084fc', '#34d399', '#f87171', '#818cf8'];
const CATEGORIES: SkillCategory[] = ['frontend', 'backend', 'testing', 'devops', 'security', 'data', 'docs', 'quality'];

function glyphFor(name: string): string {
  const words = name.trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? 'SK').slice(0, 2).toUpperCase();
}

export function addSkill(w: World, skill: Partial<Skill> & { name: string }): Skill {
  const name = (skill.name ?? '').trim() || 'Custom skill';
  const base = slug(name);
  let id = base, n = 2;
  while (w.skillMap.has(id)) id = `${base}-${n++}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
  const sk: Skill = {
    id, name,
    blurb: skill.blurb ?? 'Custom skill added by a human',
    category: skill.category && CATEGORIES.includes(skill.category) ? skill.category : CATEGORIES[h % CATEGORIES.length],
    color: skill.color ?? SKILL_COLORS[h % SKILL_COLORS.length],
    glyph: skill.glyph ?? glyphFor(name),
    custom: true,
    loadTokens: skill.loadTokens ?? 2000,
  };
  if (skill.needsSecret) sk.needsSecret = skill.needsSecret;
  w.state.skills.push(sk);
  w.rebuildSkillMap();
  w.log(null, 'skill', `Skill added to the library: ${sk.name}`);
  return sk;
}

export function removeSkill(w: World, id: string): void {
  const i = w.state.skills.findIndex((k) => k.id === id);
  if (i < 0) return;
  const name = w.state.skills[i].name;
  w.state.skills.splice(i, 1);
  w.rebuildSkillMap();
  for (const t of w.state.tickets) { const j = t.skills.indexOf(id); if (j >= 0) t.skills.splice(j, 1); }
  for (const p of w.planQueue) { const j = p.skills.indexOf(id); if (j >= 0) p.skills.splice(j, 1); }
  for (const rt of w.rtList) {
    const j = rt.a.skills.indexOf(id);
    if (j >= 0) rt.a.skills.splice(j, 1);
    rt.missing = rt.missing.filter((x) => x !== id);
    if (rt.a.phase === 'picking_skills' && rt.a.carrying && rt.a.carrying.kind === 'skills') rt.a.carrying.count = rt.missing.length;
  }
  w.log(null, 'skill', `Skill removed from the library: ${name}`);
}

export function equipSkill(w: World, agentId: string, skillId: string): void {
  const rt = w.rts.get(agentId);
  if (!rt || !w.skillMap.has(skillId)) return;
  equipSkillLru(rt.a, skillId, rt.ticket ? rt.ticket.skills : []);
  w.log(agentId, 'skill', `${rt.a.name} equipped ${w.skillName(skillId)} (${rt.a.skills.length}/${SKILL_SLOTS} slots)`);
  w.emit({ type: 'skills_loaded', agentId, skills: [skillId] });
}

export function unequipSkill(w: World, agentId: string, skillId: string): void {
  const rt = w.rts.get(agentId);
  if (!rt) return;
  const i = rt.a.skills.indexOf(skillId);
  if (i >= 0) { rt.a.skills.splice(i, 1); w.log(agentId, 'skill', `${rt.a.name} put back ${w.skillName(skillId)}`); }
}

// ---------------------------------------------------------------- help / brief / deadline
export function requestHelp(w: World, fromId: string, toId: string, question?: string): void {
  const f = w.rts.get(fromId);
  if (!f || f.a.phase === 'offline' || fromId === toId) return;
  if (toId !== 'orch' && w.rts.get(toId)?.a.role !== 'worker') return;
  const t = f.ticket && !isTerminal(f.ticket) ? f.ticket : null;
  const key = 'hh:' + (w.helpSeq + 1);
  const q = question && question.trim() ? question.trim() : helpQuestion(w, t, key);
  createHelp(w, fromId, toId, t, q, true, key);
  f.throwT = 0.9;
}

export function setBrief(w: World, projectName: string, brief: string): void {
  const s = w.settings;
  s.projectName = projectName.trim() || s.projectName;
  s.brief = brief.trim() || s.brief;
  s.mode = 'hackathon';
  w.restartProject();
}

export function setDeadline(w: World, minutesFromNow: number): void {
  if (!Number.isFinite(minutesFromNow)) return;
  const s = w.settings, st = w.state, m = Math.max(0.1, minutesFromNow);
  const base = s.mode === 'hackathon' && st.hack.active && st.hack.stage !== 'submitted' ? st.hack.startedAt : w.sprintStartT;
  s.deadlineMinutes = (st.time - base) / 60 + m;
  w.reconcile();
  if (s.mode === 'hackathon' && st.hack.endsAt - st.time > FREEZE_S) w.hackFrozen = false;
  w.log('orch', 'plan', `Deadline moved: ${m.toFixed(0)} min from now`);
  w.emit({ type: 'plan_updated', plan: st.plan });
}
