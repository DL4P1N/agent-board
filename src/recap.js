// The session recap (GET <board>/api/recap, the recap page): what a team looks at after the session. Read-only, built
// from the tasks, the questions and the event log, for one span of time.
//
// The span: from `since` (ms) to the last event after it. By default `since` is the start of the current session:
// when the current goal was set (an edit of the goal doesn't restart it; clearing the goal and setting a new one
// does), or the board's first event when no goal was ever set. States still going at the end (a task still blocked,
// a question not answered yet) count until that last event.
import { agentRootOf, normName } from './board.js';

const WORK = new Set(['claimed', 'in_progress']);
const WAIT = new Set(['blocked', 'review']);
const TOP = 5;

// When the current session started: the event that set the current goal after it was last empty, else the first event.
export function sessionStart(db) {
  let start = 0;
  let empty = true;
  for (const e of db.prepare("SELECT ts, text FROM events WHERE kind = 'settings' AND text LIKE 'set the goal: %' ORDER BY id").all()) {
    // The goal comes first in a settings event's text ("set the goal: …; integrator → …").
    const cleared = /^set the goal: \(cleared\)(;|$)/.test(e.text);
    if (cleared) empty = true;
    else if (empty) { start = e.ts; empty = false; }
  }
  if (start && !empty) return start;
  return db.prepare('SELECT MIN(ts) AS t FROM events').get().t || Date.now();
}

// Total length of a list of [from, to] intervals once overlaps are merged.
function union(list) {
  const xs = list.filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  const out = [];
  for (const [a, b] of xs) {
    const last = out.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}
const total = (list) => list.reduce((n, [a, b]) => n + (b - a), 0);
// The part of `list` not covered by the merged intervals `cover`.
function minus(list, cover) {
  let left = union(list);
  for (const [c0, c1] of cover) {
    left = left.flatMap(([a, b]) => (b <= c0 || a >= c1 ? [[a, b]] : [a < c0 ? [a, c0] : null, b > c1 ? [c1, b] : null].filter(Boolean)));
  }
  return left;
}

// A task event's own words after its status change ("#4 blocked → in_progress — got the key" -> "got the key").
function noteOf(text) {
  const parts = String(text || '').replace(/^#\d+\s*/, '').split(' — ');
  const i = parts.findIndex((p) => / → /.test(p));
  return parts.slice(i + 1).filter((p) => !/^(assigned to @|unassigned$|reserved for @|reservation removed$|PR https?:)/.test(p)).join(' — ').slice(0, 300);
}

export function recap(board, { since } = {}) {
  const db = board.db;
  const auto = !(Number(since) > 0);
  const from = auto ? sessionStart(db) : Number(since);
  const last = db.prepare('SELECT MAX(ts) AS t FROM events WHERE ts >= ?').get(from).t;
  const until = Math.max(from, last || from);
  const clip = ([a, b]) => [Math.max(a, from), Math.min(b, until)];
  const inSpan = (ts) => ts >= from && ts <= until;

  const settings = board.getSettings();
  const tasks = board.listTasks();
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const created = new Map(db.prepare("SELECT task_id, text FROM events WHERE kind = 'task_created' AND task_id IS NOT NULL").all()
    .map((e) => [e.task_id, String(e.text).replace(/^(proposed )?#\d+\s*/, '').split(' — ')[0].replace(/ \(reserved for @[\w.-]+\)$/, '')]));
  const title = (id) => byId.get(id)?.title || created.get(id) || '';

  // Who is a human: the web board's people, whoever answered a question, whoever approved the task list (humans only).
  const humans = new Set(db.prepare("SELECT name FROM presence_v2 WHERE kind = 'human'").all().map((r) => normName(r.name)));
  for (const r of db.prepare('SELECT DISTINCT answered_by AS n FROM questions WHERE answered_by IS NOT NULL').all()) humans.add(normName(r.n));
  for (const r of db.prepare("SELECT DISTINCT author AS n FROM events WHERE kind = 'settings' AND text LIKE '%approved the task list%'").all()) humans.add(normName(r.n));
  const nobody = (n) => !n || n === 'board' || n === 'anonymous';
  const isAgent = (n) => !nobody(n) && !humans.has(n);

  // Walk every task's claims and status changes once: per task its status intervals and who held it.
  const evs = db.prepare("SELECT id, ts, author, kind, task_id, text, data FROM events WHERE task_id IS NOT NULL AND kind IN ('task_claimed', 'task_updated', 'task_deleted') ORDER BY id").all();
  const st = new Map(); // task id -> { status, owner, at, firstClaim, doneAt, bounces }
  const spans = []; // { task, status, owner, a, b, end } (end: the event that closed it)
  const merges = [];
  for (const e of evs) {
    const s = st.get(e.task_id) || { status: 'open', owner: null, at: e.ts, firstClaim: 0, doneAt: 0, bounces: 0 };
    st.set(e.task_id, s);
    let status = s.status; let owner = s.owner;
    if (e.kind === 'task_deleted') status = null;
    else if (e.kind === 'task_claimed') { status = 'claimed'; owner = normName(agentRootOf(e.author)); }
    else {
      try { status = JSON.parse(e.data || '{}').status || status; } catch {}
      const to = String(e.text).match(/assigned to @([\w.-]+)/);
      if (to) owner = normName(to[1]);
      if (/ — unassigned( —|$)/.test(e.text) || status === 'open') owner = null;
      if (/review → in_progress/.test(e.text)) s.bounces++;
      if (/review → done/.test(e.text) && inSpan(e.ts)) merges.push(e.task_id);
    }
    // The first claim: the first move to claimed / in progress, by a claim or a human assigning or moving it.
    if (!s.firstClaim && ['claimed', 'in_progress'].includes(status)) s.firstClaim = e.ts;
    if (status !== s.status || owner !== s.owner) {
      spans.push({ task: e.task_id, status: s.status, owner: s.owner, a: s.at, b: e.ts, end: e });
      if (status === 'done' && s.status !== 'done') s.doneAt = e.ts;
      s.status = status; s.owner = owner; s.at = e.ts;
    }
  }
  for (const [id, s] of st) if (s.status && byId.has(id)) spans.push({ task: id, status: s.status, owner: s.owner, a: s.at, b: until, end: null });

  // In scope: tasks on the board now, not proposals, and not finished before the span started.
  const scope = tasks.filter((t) => t.status !== 'proposed' && !(t.status === 'done' && (st.get(t.id)?.doneAt || t.updated_at) < from));
  const done = scope.filter((t) => t.status === 'done');
  const doneAt = (t) => st.get(t.id)?.doneAt || t.updated_at;

  const questions = db.prepare('SELECT asker, answered_by, task_id, question, created_at, answered_at FROM questions').all();
  const agents = new Map();
  const A = (n) => { n = normName(agentRootOf(n)); if (!agents.has(n)) agents.set(n, { name: n, done: 0, work: [], wait: [], questions: 0 }); return agents.get(n); };
  for (const t of done) if (t.assignee && isAgent(normName(agentRootOf(t.assignee)))) A(t.assignee).done++;
  for (const x of spans) {
    if (!x.owner || !isAgent(x.owner)) continue;
    const iv = clip([x.a, x.b]);
    if (iv[1] <= iv[0]) continue;
    if (WORK.has(x.status)) A(x.owner).work.push(iv);
    else if (WAIT.has(x.status)) A(x.owner).wait.push(iv);
  }
  for (const q of questions) {
    const who = normName(agentRootOf(q.asker));
    if (!isAgent(who)) continue;
    if (inSpan(q.created_at)) A(who).questions++;
    const iv = clip([q.created_at, q.answered_at || until]);
    if (iv[1] > iv[0]) A(who).wait.push(iv);
  }
  const agentRows = [...agents.values()].map((a) => {
    const work = union(a.work);
    return { name: a.name, done: a.done, working_ms: total(work), waiting_ms: total(minus(a.wait, work)), questions: a.questions };
  }).filter((a) => a.done || a.working_ms || a.waiting_ms || a.questions)
    .sort((p, q) => q.done - p.done || q.working_ms - p.working_ms || p.name.localeCompare(q.name));

  // Humans: questions answered, and approvals (the task list, proposed tasks).
  const people = new Map();
  const H = (n) => { n = normName(n); if (!people.has(n)) people.set(n, { name: n, answered: 0, approvals: 0 }); return people.get(n); };
  for (const q of questions) if (q.answered_by && q.answered_at && inSpan(q.answered_at) && !nobody(normName(q.answered_by))) H(q.answered_by).answered++;
  const approvals = db.prepare("SELECT author, kind, text FROM events WHERE ts >= ? AND ts <= ? AND ((kind = 'settings' AND text LIKE '%approved the task list%') OR (kind = 'task_updated' AND text LIKE '%proposed → open — approved%'))").all(from, until);
  for (const e of approvals) {
    const n = normName(e.author);
    if (humans.has(n) && !nobody(n)) H(n).approvals++;
  }
  const humanRows = [...people.values()].sort((p, q) => (q.answered + q.approvals) - (p.answered + p.approvals) || p.name.localeCompare(q.name));

  // The slowest tasks done in the span: first claim to done.
  const slowest = done.map((t) => { const s = st.get(t.id); return { id: t.id, title: t.title, owner: t.assignee ? normName(agentRootOf(t.assignee)) : null, ms: s?.firstClaim && doneAt(t) > s.firstClaim ? doneAt(t) - s.firstClaim : 0, bounces: s?.bounces || 0 }; })
    .filter((x) => x.ms > 0).sort((p, q) => q.ms - p.ms).slice(0, TOP);

  // The longest blocks, each with what ended it: the move out of Blocked (who, to what, their note) and an answer
  // to a question about the task that came while it was blocked.
  const blocks = spans.filter((x) => x.status === 'blocked').map((x) => {
    const [a, b] = clip([x.a, x.b]);
    const still = !x.end;
    const answer = questions.filter((q) => q.task_id === x.task && q.answered_at && q.answered_at >= x.a && q.answered_at <= (x.end?.ts ?? until)).at(-1);
    let to = null;
    if (x.end) { try { to = x.end.kind === 'task_deleted' ? 'deleted' : x.end.kind === 'task_claimed' ? 'claimed' : JSON.parse(x.end.data || '{}').status || null; } catch {} }
    return { id: x.task, title: title(x.task), owner: x.owner, ms: Math.max(0, b - a), still,
      by: x.end ? normName(agentRootOf(x.end.author)) : null, to, note: x.end && x.end.kind === 'task_updated' ? noteOf(x.end.text) : '',
      answered_by: answer ? normName(answer.answered_by) : null, question: answer ? String(answer.question).slice(0, 300) : null };
  }).filter((x) => x.ms > 0).sort((p, q) => q.ms - p.ms).slice(0, TOP);

  return {
    goal: settings.goal,
    since: from, until, default_span: auto,
    tasks: { done: done.length, total: scope.length },
    merges: merges.length,
    questions: { asked: questions.filter((q) => inSpan(q.created_at)).length, answered: questions.filter((q) => q.answered_at && inSpan(q.answered_at)).length },
    agents: agentRows,
    humans: humanRows,
    slowest,
    blocks,
    // When each task done in the span was finished, oldest first: the timeline.
    done_at: done.map(doneAt).filter(inSpan).sort((p, q) => p - q),
  };
}
