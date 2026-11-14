/** Human <-> agent chat: delayed replies, intents applied through the board commands, planes thrown for relays. */
import type { ChatContext, Intent, Ticket } from '../types';
import { addSkill, cancelTicket, createTicket, equipSkill, removeSkill, requestHelp, setBrief, setDeadline, unequipSkill, updateTicket } from './commands';
import { broadcast, cutScope } from './hack';
import { parseChat } from './intents';
import { keyedRng } from './prng';
import type { Rt, World } from './world';

/** Reply delay: 1..3 sim-seconds after the message (the ChatMessage from 'you' is pushed immediately). */
export function say(w: World, to: string, text: string): void {
  const t = (text ?? '').trim();
  if (!t) return;
  const dest = to === 'all' || to === 'orch' || w.rts.has(to) ? to : 'orch';
  const m = w.postChat('you', dest, t, 'say');
  const at = w.state.time + 1 + 2 * keyedRng(w.settings.seed, 'chat:' + m.id).next();
  w.chatPending.push({ at, msgId: m.id, to: dest, text: t });
}

export function chatTick(w: World): void {
  const q = w.chatPending;
  if (q.length === 0) return;
  const now = w.state.time;
  let due: typeof q | null = null;
  for (const p of q) if (p.at <= now) (due ??= []).push(p);
  if (!due) return;
  for (const p of due) q.splice(q.indexOf(p), 1);
  due.sort((a, b) => a.at - b.at);
  for (const p of due) handle(w, p);
}

function handle(w: World, p: { to: string; text: string }): void {
  const st = w.state;
  const speaker: Rt = w.rts.get(p.to === 'all' ? 'orch' : p.to) ?? w.rts.get('orch')!;
  const ctx: ChatContext = { time: st.time, agents: st.agents, tickets: st.tickets, skills: st.skills, metrics: st.metrics, plan: st.plan, hack: st.hack, settings: w.settings };
  const parsed = parseChat(p.text, p.to, ctx);
  // chatting is not free: the addressee pays for reading the message and writing the reply
  w.charge(speaker, 900 + p.text.length * 8, 220 + parsed.reply.length * 3, 0, null, false, false);
  w.postChat(speaker.a.id, 'you', parsed.reply, 'say');
  w.say(speaker, parsed.reply, 5);
  w.log(speaker.a.id, 'chat', `${speaker.a.name} replied: ${parsed.reply}`);
  for (const it of parsed.intents) apply(w, it);
  // a message to everyone with no relay intents still gets a volley of planes (the parser relays explicitly when it wants to)
  if (p.to === 'all' && !parsed.intents.some((i) => i.type === 'message_agent' || i.type === 'cut_scope')) {
    const orch = w.rts.get('orch');
    if (orch) orch.throwT = 0.9;
    broadcast(w, 'noted', 'chat');
  }
}

function act(w: World, text: string, kind: 'action' | 'system' = 'action'): void {
  w.postChat('orch', 'you', text, kind);
  w.log('orch', 'chat', text);
}

const open = (t: Ticket | undefined): t is Ticket => !!t && t.status !== 'merged' && t.status !== 'cancelled';

function apply(w: World, it: Intent): void {
  switch (it.type) {
    case 'create_ticket': {
      const t = createTicket(w, it.spec);
      act(w, `Created ${t.id} "${t.title}"`);
      return;
    }
    case 'cancel_ticket': {
      const t = w.tickets.get(it.id);
      if (!open(t)) { act(w, `No open task ${it.id}`, 'system'); return; }
      cancelTicket(w, it.id);
      act(w, `Cancelled ${it.id} "${t.title}"`);
      return;
    }
    case 'set_difficulty': {
      if (!open(w.tickets.get(it.id))) { act(w, `No open task ${it.id}`, 'system'); return; }
      updateTicket(w, it.id, { difficulty: it.difficulty });
      act(w, `Re-rated ${it.id} to difficulty ${it.difficulty}`);
      return;
    }
    case 'prioritize': {
      if (!open(w.tickets.get(it.id))) { act(w, `No open task ${it.id}`, 'system'); return; }
      updateTicket(w, it.id, { priority: it.priority });
      act(w, `Set ${it.id} priority to ${it.priority}`);
      return;
    }
    case 'pin_ticket': {
      if (!open(w.tickets.get(it.id))) { act(w, `No open task ${it.id}`, 'system'); return; }
      if (it.agentId !== null && w.rts.get(it.agentId)?.a.role !== 'worker') { act(w, `Can't pin to ${it.agentId}`, 'system'); return; }
      updateTicket(w, it.id, { pinnedTo: it.agentId });
      act(w, it.agentId ? `Pinned ${it.id} to ${w.agentName(it.agentId)}` : `Unpinned ${it.id}`);
      return;
    }
    case 'add_skill': { const sk = addSkill(w, it.skill); act(w, `Added skill ${sk.name} to the library`); return; }
    case 'remove_skill': {
      if (!w.skillMap.has(it.id)) { act(w, `No skill ${it.id}`, 'system'); return; }
      const n = w.skillName(it.id);
      removeSkill(w, it.id);
      act(w, `Removed skill ${n}`);
      return;
    }
    case 'equip_skill': {
      if (!w.rts.has(it.agentId) || !w.skillMap.has(it.skillId)) { act(w, 'Unknown agent or skill', 'system'); return; }
      equipSkill(w, it.agentId, it.skillId);
      act(w, `Equipped ${w.skillName(it.skillId)} on ${w.agentName(it.agentId)}`);
      return;
    }
    case 'unequip_skill': {
      if (!w.rts.has(it.agentId)) { act(w, 'Unknown agent', 'system'); return; }
      unequipSkill(w, it.agentId, it.skillId);
      act(w, `Took ${w.skillName(it.skillId)} off ${w.agentName(it.agentId)}`);
      return;
    }
    case 'set_deadline': {
      setDeadline(w, it.minutes);
      act(w, `Deadline set to ${Math.round(it.minutes)} min from now`);
      return;
    }
    case 'cut_scope': {
      const cut = cutScope(w, Math.max(1, Math.round(it.count)), 'human');
      if (cut.length === 0) act(w, 'Nothing left that I can cut', 'system');
      return;     // cutScope posts its own action message + broadcast planes
    }
    case 'set_brief': {
      setBrief(w, it.project, it.brief);
      act(w, `New brief: ${w.settings.projectName} - replanning`);
      return;
    }
    case 'message_agent': {
      const rt = w.rts.get(it.agentId);
      const orch = w.rts.get('orch');
      if (!rt || !orch || rt.a.phase === 'offline') { act(w, `${it.agentId} is not reachable`, 'system'); return; }
      orch.throwT = 0.9;
      w.sendPlane('chat', { agent: 'orch' }, { agent: rt.a.id }, `${w.flightSeq}:${rt.a.id}`, { agent: rt.a.id, text: it.text }, 'msg');
      w.log('orch', 'chat', `Atlas relayed to ${rt.a.name}: ${it.text}`);
      act(w, `Sent ${rt.a.name} a note`);
      return;
    }
    case 'ask_help': {
      requestHelp(w, it.fromAgentId, it.toAgentId, it.question);
      act(w, `Asked ${w.agentName(it.toAgentId)} to help ${w.agentName(it.fromAgentId)}`);
      return;
    }
    case 'set_speed': {
      const v = Number.isFinite(it.value) ? Math.min(8, Math.max(0, it.value)) : 1;
      w.settings.simSpeed = v;
      act(w, v === 0 ? 'Paused' : `Speed set to ${v}x`);
      return;
    }
    case 'status': return;     // the reply text carries the status
  }
}
