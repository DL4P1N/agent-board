import type { Phase } from '../types';

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'mute' | 'gold' | 'violet';
export const PHASE_INFO: Record<Phase, { label: string; tone: Tone }> = {
  offline: { label: 'OFFLINE', tone: 'mute' },
  idle: { label: 'IDLE', tone: 'mute' },
  to_depot: { label: 'TO DEPOT', tone: 'info' },
  picking_up: { label: 'PICKING UP', tone: 'info' },
  to_library: { label: 'FETCHING SKILLS', tone: 'violet' },
  picking_skills: { label: 'FETCHING SKILLS', tone: 'violet' },
  to_desk: { label: 'TO DESK', tone: 'info' },
  working: { label: 'WORKING', tone: 'ok' },
  waiting: { label: 'WAITING', tone: 'warn' },
  blocked: { label: 'BLOCKED', tone: 'bad' },
  submitting: { label: 'SENDING PR', tone: 'info' },
  asking_help: { label: 'ASKING FOR HELP', tone: 'warn' },
  awaiting_help: { label: 'WAITING ON HELP', tone: 'warn' },
  helping: { label: 'HELPING', tone: 'violet' },
  to_review: { label: 'TO REVIEW', tone: 'info' },
  awaiting_review: { label: 'AWAIT REVIEW', tone: 'warn' },
  rework_pickup: { label: 'REWORK PICKUP', tone: 'bad' },
  reworking: { label: 'REWORKING', tone: 'warn' },
  celebrating: { label: 'MERGED', tone: 'gold' },
  planning: { label: 'PLANNING', tone: 'gold' },
  delivering: { label: 'DELIVERING', tone: 'info' },
  reviewing: { label: 'REVIEWING', tone: 'violet' },
  merging: { label: 'MERGING', tone: 'ok' },
  returning: { label: 'RETURNING', tone: 'warn' },
};
export const phaseInfo = (p: Phase): { label: string; tone: Tone } => PHASE_INFO[p] ?? { label: String(p).toUpperCase(), tone: 'mute' };

export function usd(v: number | undefined | null): string {
  const n = v ?? 0;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (n >= 100) return `$${n.toFixed(0)}`;
  if (n >= 10) return `$${n.toFixed(1)}`;
  return `$${n.toFixed(2)}`;
}
export function tokens(n: number | undefined | null): string {
  const v = n ?? 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return String(Math.round(v));
}
export const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog', assigned: 'Assigned', in_progress: 'In progress', in_review: 'In review', changes_requested: 'Changes requested', merged: 'Merged',
};
export const KIND_LABEL: Record<string, string> = {
  info: 'INFO', help: 'HELP', chat: 'CHAT', skill: 'SKILL', ticket: 'TICKET', review: 'REVIEW', merge: 'MERGE', reject: 'REJECT', plan: 'PLAN', block: 'BLOCK', compact: 'COMPACT', cost: 'COST',
};
