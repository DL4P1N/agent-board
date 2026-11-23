/**
 * The parts of the real board's GET /api/state that the presenter reads (see src/server.js and src/board.js),
 * plus the small helpers the board page (public/index.html) uses on them, copied so both say the same thing.
 */

export type TaskStatus = 'open' | 'claimed' | 'in_progress' | 'blocked' | 'review' | 'done' | 'proposed';

export interface BoardTask {
  id: number;
  title: string;
  status: TaskStatus;
  priority: number;
  size: 'S' | 'M' | 'L';
  assignee: string | null;
  reviewer?: string | null;
  depends_on?: number[];
  reserved_for?: string | null;
  created_at: number;
  updated_at: number;
  /** The server's "no update for 15+ minutes while claimed or in progress". */
  stale?: boolean;
}

export interface BoardPresence {
  name: string;
  person?: string;
  kind: 'agent' | 'human';
  client?: string | null;
  online: boolean;
  started?: boolean;
  limited?: { until?: number | null } | null;
  busy?: boolean;
  doing?: string | null;
  slots?: number;
  extra_slots?: number;
  base_slots?: number;
  slots_override?: number | null;
  last_seen?: number;
}

export interface BoardQuestion { id: number; asker: string; question: string; task_id?: number | null; answer?: string | null; created_at: number }
export interface BoardEvent { id?: number; ts: number; author: string; kind: string; text?: string; task_id?: number | null; data?: Record<string, unknown> | null }

export interface BoardState {
  tasks: BoardTask[];
  presence: BoardPresence[];
  questions: BoardQuestion[];
  events: BoardEvent[];
  settings: { goal?: string; deadline?: number | string; freeze_minutes?: number | string; integrator?: string; planner?: string; [k: string]: unknown };
  stats?: { minutes?: Record<string, number> } | null;
  phase?: string;
  board?: { slug: string; name: string; default: boolean; path: string };
  /** The board page's status word per agent (its Agents row's: "working", "idle", "Question"...): the name tag shows it. */
  agentStatus?: Record<string, string>;
}

/** Not a person's agent: the board itself, or a call without a name. */
export const skipName = (n: string | null | undefined): boolean => !n || n === 'board' || n === 'anonymous';
export const agentRoot = (a: string | null | undefined): string => String(a || '').split('/')[0].toLowerCase();

// Person colours, the same as the main board (public/index.html): a person's hue comes from their name alone.
export const HUES = [45, 75, 110, 145, 175, 200, 222, 245, 270, 295, 320];
export const nameHash = (n: string): number => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export function personOf(name: string, presence: BoardPresence[]): string {
  const root = agentRoot(name);
  const p = presence.find((x) => x.kind === 'agent' && x.name === root);
  if (p?.person) return String(p.person).toLowerCase();
  return root.replace(/-(claude|codex|copilot|copilotcli|copilot-vscode|copilot-cli|gemini|cursor)\d*$/, '');
}
export const hueOf = (name: string, presence: BoardPresence[]): number => HUES[nameHash(personOf(name, presence)) % HUES.length];

/** The goal is often pasted from a doc: plain words (no `code`, **bold**, [links](…) or # headings). */
export const plain = (s: unknown): string => String(s || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`+|\*\*|__/g, '').replace(/^\s*#+\s+/gm, '').replace(/\s+/g, ' ').trim();
/** The goal's first line, or its first sentence when that line is long: a heading for the big screen. Keep in sync with
 *  goalHead() in public/present-classic.html. */
export function goalHead(s: unknown): string {
  const line = plain(String(s || '').split('\n').find((l) => l.trim()) || '');
  const m = line.length > 60 ? line.match(/^(.{20,}?[.!?])\s/) : null;
  return m ? m[1] : line;
}
export const plural = (n: number, w: string, ws = w + 's'): string => `${n} ${n === 1 ? w : ws}`;
/** The board's clock(): "2:49 AM" (the top bar, both presenters). */
export const clock = (ts: number): string => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** Countdown digits, like the classic presenter: "2h 05m" or "4:59". */
export function durClock(ms: number): string {
  const t = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const s = t % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s).padStart(2, '0')}`;
}
/** Durations in words, like the board: "3h 12m", "45m", "2d 4h". */
export function dur(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60e3)); const h = Math.floor(m / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

export interface TimeNow { deadline: number; freezeAt: number; fm: number; frozen: boolean; past: boolean; warn: boolean }
const WARN_MS = 30 * 60e3;
/** Same as the board's timeNow(): the demo time and feature freeze from the settings. */
export function timeNow(b: BoardState, now = Date.now()): TimeNow {
  const deadline = Number(b.settings?.deadline) || 0;
  if (!deadline) return { deadline: 0, freezeAt: 0, fm: 0, frozen: false, past: false, warn: false };
  const fm = Number(b.settings?.freeze_minutes) || 0; const freezeAt = deadline - fm * 60e3;
  const frozen = now >= freezeAt;
  return { deadline, freezeAt, fm, frozen, past: now >= deadline, warn: !frozen && freezeAt - now <= WARN_MS };
}

const isLimited = (p: { limited?: { until?: number | null } | null }, now: number): boolean => !!p.limited && (!p.limited.until || p.limited.until > now);
export const limitedNow = isLimited;

// ---- One vocabulary and one counting rule for every view: the board (public/index.html), its 3D view, this presenter
// and the classic one (public/present-classic.html). Keep the copies there in sync. ----
/** Status names, as the board's column headings say them. */
export const LABEL: Record<TaskStatus, string> = { proposed: 'Proposed', open: 'Open', claimed: 'Claimed', in_progress: 'In progress', blocked: 'Blocked', review: 'Review', done: 'Done' };
/** Tasks per board column. Proposals sit (and count) in Open and claimed tasks in In progress, as on the board (colOf());
 *  "x of y done" leaves proposals out. */
export function columnCounts(tasks: BoardTask[]): Record<'open' | 'in_progress' | 'blocked' | 'review' | 'done', number> {
  const n = { open: 0, in_progress: 0, blocked: 0, review: 0, done: 0 };
  for (const t of tasks) n[t.status === 'proposed' ? 'open' : t.status === 'claimed' ? 'in_progress' : t.status]++;
  return n;
}
/** What waits on a human, by the board's rule (its Needs attention): the open questions; blocked tasks WITHOUT an open
 *  question (a task blocked on a question is counted once, as the question); agents out of usage. Stale tasks aren't
 *  listed there (the board flags them on their cards). Keep in sync with needsOf() in public/present-classic.html and
 *  blockedSplit() in public/js/derived.js. */
export function needsOf(b: BoardState, now = Date.now()): { questions: BoardQuestion[]; blocked: BoardTask[]; limited: BoardPresence[] } {
  const questions = (b.questions || []).filter((q) => !q.answer).sort((x, y) => x.id - y.id);
  const asked = new Set(questions.map((q) => q.task_id).filter(Boolean));
  const tasks = b.tasks || [];
  return {
    questions,
    blocked: tasks.filter((t) => t.status === 'blocked' && !asked.has(t.id)).sort((x, y) => x.priority - y.priority || x.id - y.id),
    limited: (b.presence || []).filter((p) => p.kind === 'agent' && !skipName(p.name) && isLimited(p, now)),
  };
}

/** Agent slots online now (the board's teamCapacity().slots): started, online, not out of usage. */
export function teamSlots(b: BoardState, now = Date.now()): number {
  const AGENT_ONLINE_MS = 10 * 60e3;
  const m = new Map<string, { slots: number; extra: number; base: number; override: number | null; client: string | null; online: boolean; started: boolean; limited: { until?: number | null } | null }>();
  const get = (n: string) => { n = n.toLowerCase(); if (!m.has(n)) m.set(n, { slots: 0, extra: 0, base: 0, override: null, client: null, online: false, started: false, limited: null }); return m.get(n)!; };
  for (const p of b.presence || []) {
    if (p.kind !== 'agent' || skipName(p.name)) continue;
    const a = get(p.name); if (p.client) a.client = String(p.client);
    a.extra = Number(p.extra_slots) || 0;
    if (p.slots) a.slots = (Number(p.slots) || 0) - a.extra;
    if (p.base_slots) a.base = Number(p.base_slots) || 0;
    if (p.slots_override != null) a.override = Number(p.slots_override) || null;
    if (p.limited) a.limited = p.limited;
    a.online = a.online || !!p.online; a.started = a.started || !!p.started;
  }
  for (const e of b.events || []) {
    const n = agentRoot(e.author); if (skipName(n)) continue;
    if (['task_claimed', 'lock', 'question'].includes(e.kind) || String(e.author).includes('/')) { const a = get(n); a.started = true; if (now - e.ts < AGENT_ONLINE_MS) a.online = true; }
  }
  for (const t of b.tasks || []) if (t.assignee && !skipName(agentRoot(t.assignee))) get(agentRoot(t.assignee)).started = true;
  for (const t of b.tasks || []) if (t.status === 'review' && t.reviewer && !skipName(agentRoot(t.reviewer))) get(agentRoot(t.reviewer)).started = true;
  let slots = 0;
  for (const [name, a] of m) {
    if (!a.base) a.base = a.client === 'Claude Code' ? 2 : 1;
    if (!a.slots) a.slots = a.override || a.base;
    // Online comes from presence when the agent has a row there (the board's agentLive()).
    const p = (b.presence || []).find((x) => x.kind === 'agent' && String(x.name).toLowerCase() === name);
    const live = p ? !!p.online : a.online;
    if (a.started && live && !isLimited(a, now)) slots += a.slots;
  }
  return slots;
}

export interface Outlook { verdict: 'ok' | 'tight' | 'behind' | 'unknown'; label?: string; why: string; shortBy?: number; left?: number }
const LEFT_ST: TaskStatus[] = ['open', 'claimed', 'in_progress', 'review', 'blocked'];
/** Keep in sync with outlook() in public/index.html (a separate bundle). The board's deadline verdict: will the work left fit before the freeze (or the demo,
 *  once frozen)? null: no demo time, it has passed, or nothing is left. */
export function outlook(b: BoardState, t: TimeNow = timeNow(b), now = Date.now()): Outlook | null {
  if (!t.deadline || t.past) return null;
  const left = (b.tasks || []).filter((x) => LEFT_ST.includes(x.status));
  if (!left.length) return null;
  const m = b.stats?.minutes || {}; const known = Object.values(m);
  if (!known.length) return { verdict: 'unknown', why: 'Not enough finished tasks to estimate yet' };
  const slots = teamSlots(b, now);
  if (!slots) return { verdict: 'unknown', why: 'No agent is online to estimate with' };
  const fallback = m.M ?? known.reduce((a, c) => a + c, 0) / known.length;
  const work = left.reduce((n, x) => n + (m[x.size] ?? fallback), 0);
  const to = t.frozen ? t.deadline : t.freezeAt;
  const mins = Math.max(1, (to - now) / 60e3); const eta = work / slots; const ratio = eta / mins;
  const shortBy = ratio > 1 ? Math.max(1, Math.round(left.length * (1 - mins / eta))) : 0;
  const verdict = ratio <= 0.9 ? 'ok' : ratio <= 1.1 ? 'tight' : 'behind';
  const label = verdict === 'ok' ? 'On track' : verdict === 'tight' ? 'Tight' : `Behind by ~${plural(shortBy, 'task')}`;
  const why = `About ${dur(eta * 60e3)} of work left (${plural(left.length, 'task')} at this board's median time per size, over ${plural(slots, 'agent slot')} online) and ${dur(mins * 60e3)} to the ${t.frozen ? 'demo' : 'freeze'}`;
  return { verdict, label, why, shortBy, left: left.length };
}

/** The big countdown, like the classic presenter's: digits, a line under them, and a colour class. */
export function countdown(b: BoardState, now = Date.now()): { big: string; sub: string; cls: '' | 'warn' | 'bad' | 'none' } {
  const t = timeNow(b, now);
  if (!t.deadline) return { big: 'No demo time', sub: 'Set it on the board: Setup, step 2.', cls: 'none' };
  if (now - t.deadline >= 60 * 60e3) {
    const ts = (b.tasks || []).filter((x) => x.status !== 'proposed');
    return { big: 'Event finished', sub: `Demo was at ${clock(t.deadline)}. Final: ${ts.filter((x) => x.status === 'done').length} of ${ts.length} tasks done.`, cls: 'none' };
  }
  if (t.past) return { big: 'Demo time', sub: `Demo was at ${clock(t.deadline)}. Wrapping up.`, cls: 'warn' };
  if (t.frozen) return { big: durClock(t.deadline - now), sub: `Feature freeze · demo at ${clock(t.deadline)}`, cls: 'warn' }; // amber, as on the board: a phase, not an error
  return { big: durClock(t.deadline - now), sub: `until the demo (${clock(t.deadline)})${t.freezeAt && t.freezeAt < t.deadline ? ` · freeze ${clock(t.freezeAt)}` : ''}`, cls: t.freezeAt && t.freezeAt - now < 30 * 60e3 ? 'warn' : '' };
}
