// Board domain logic: tasks, messages/events, locks, human questions.
// All writes are synchronous on a single thread, so each function is atomic.
import { DatabaseSync } from 'node:sqlite';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';

const STATUSES = ['open', 'claimed', 'in_progress', 'blocked', 'review', 'done'];
const STALE_MS = 30 * 60 * 1000;
const AGENT_ONLINE_MS = 10 * 60 * 1000;
const HUMAN_ONLY = ['deadline', 'freeze_minutes', 'require_approval', 'plan_approved'];

const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
// Deadline / feature-freeze state from settings.
export function timeInfo(s, now = Date.now()) {
  const deadline = Number(s.deadline) || 0;
  if (!deadline) return { deadline: 0, frozen: false };
  const freezeAt = deadline - (Number(s.freeze_minutes) || 0) * 60e3;
  const left = Math.max(0, deadline - now);
  const h = Math.floor(left / 3600e3);
  const m = Math.round((left % 3600e3) / 60e3);
  return { deadline, freezeAt, frozen: now >= freezeAt, deadlineLabel: clock(deadline), freezeLabel: clock(freezeAt), leftLabel: h ? `${h}h ${m}m` : `${m}m` };
}

function describeSetting(key, val, cur) {
  if (key === 'goal') return `set the goal: ${val || '(cleared)'}`;
  if (key === 'repo') return `set the project repo: ${val || '(cleared)'}`;
  if (key === 'deadline') return val ? `set the demo deadline to ${new Date(Number(val)).toLocaleString()}` : 'cleared the deadline';
  if (key === 'freeze_minutes') return `feature freeze starts ${val} min before the deadline`;
  if (key === 'require_approval') return val ? 'turned on plan approval: agents wait for a human OK before starting tasks' : 'turned off plan approval';
  if (key === 'plan_approved') return val ? 'approved the task list: agents can start' : 'withdrew approval of the task list';
  return `${key} → ${val || 'nobody'}`;
}

export class Board {
  constructor(dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new DatabaseSync(path.join(dataDir, 'board.db'));
    this.bus = new EventEmitter();
    this.bus.setMaxListeners(0);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        author TEXT NOT NULL,
        kind TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'general',
        task_id INTEGER,
        text TEXT NOT NULL DEFAULT '',
        data TEXT
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        priority INTEGER NOT NULL DEFAULT 2,
        assignee TEXT,
        branch TEXT,
        depends_on TEXT NOT NULL DEFAULT '[]',
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS locks (
        path TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        task_id INTEGER,
        reason TEXT NOT NULL DEFAULT '',
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS presence_v2 (
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        last_seen INTEGER NOT NULL,
        client TEXT,
        PRIMARY KEY (name, kind)
      );
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asker TEXT NOT NULL,
        question TEXT NOT NULL,
        task_id INTEGER,
        answer TEXT,
        answered_by TEXT,
        created_at INTEGER NOT NULL,
        answered_at INTEGER
      );
    `);
    this.migrate();
  }

  // Older boards created presence_v2 without the client column.
  migrate() {
    const cols = this.db.prepare('PRAGMA table_info(presence_v2)').all().map((c) => c.name);
    if (!cols.includes('client')) this.db.exec('ALTER TABLE presence_v2 ADD COLUMN client TEXT');
    if (!cols.includes('started_at')) this.db.exec('ALTER TABLE presence_v2 ADD COLUMN started_at INTEGER');
  }

  // ---------- events ----------
  emit({ author, kind, channel = 'general', task_id = null, text = '', data = null }) {
    const mentions = [...String(text).matchAll(/@([\w.\-/]+)/g)].map((m) => m[1]);
    if (mentions.length) data = { ...(data || {}), mentions };
    const ts = Date.now();
    const r = this.db
      .prepare('INSERT INTO events (ts, author, kind, channel, task_id, text, data) VALUES (?,?,?,?,?,?,?)')
      .run(ts, author, kind, channel, task_id, text, data ? JSON.stringify(data) : null);
    const ev = { id: Number(r.lastInsertRowid), ts, author, kind, channel, task_id, text, data };
    this.bus.emit('event', ev);
    return ev;
  }

  latestEventId() {
    return Number(this.db.prepare('SELECT COALESCE(MAX(id),0) AS m FROM events').get().m);
  }

  events({ since = 0, channel, task_id, exclude_author, limit = 100 } = {}) {
    let sql = 'SELECT * FROM events WHERE id > ?';
    const args = [since];
    if (channel) { sql += ' AND channel = ?'; args.push(channel); }
    if (task_id) { sql += ' AND task_id = ?'; args.push(task_id); }
    if (exclude_author) {
      sql += ' AND author != ? AND author NOT LIKE ?';
      args.push(exclude_author, exclude_author + '/%');
    }
    sql += ' ORDER BY id ASC LIMIT ?';
    args.push(limit);
    return this.db.prepare(sql).all(...args).map(rowToEvent);
  }

  recentEvents(limit = 50) {
    return this.db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT ?').all(limit).map(rowToEvent).reverse();
  }

  // Long-poll: resolve as soon as matching events exist, or after timeoutMs.
  async waitForEvents(filter, timeoutMs, signal) {
    const now = this.events(filter);
    if (now.length) return now;
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.bus.off('event', onEvent);
        signal?.removeEventListener?.('abort', finish);
        resolve(this.events(filter));
      };
      const onEvent = (ev) => {
        if (ev.id <= (filter.since || 0)) return;
        if (filter.channel && ev.channel !== filter.channel) return;
        if (filter.exclude_author && (ev.author === filter.exclude_author || ev.author.startsWith(filter.exclude_author + '/'))) return;
        // small debounce so bursts arrive together
        setTimeout(finish, 250);
      };
      const timer = setTimeout(finish, timeoutMs);
      this.bus.on('event', onEvent);
      signal?.addEventListener?.('abort', finish);
    });
  }

  // ---------- messages ----------
  post(author, { text, channel = 'general', task_id = null }) {
    if (!text || !text.trim()) throw new Error('text is required');
    return this.emit({ author, kind: 'message', channel, task_id, text });
  }

  // ---------- tasks ----------
  getTask(id) {
    const t = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    return t ? rowToTask(t) : null;
  }

  listTasks({ status, assignee } = {}) {
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const args = [];
    if (status) {
      const list = Array.isArray(status) ? status : [status];
      sql += ` AND status IN (${list.map(() => '?').join(',')})`;
      args.push(...list);
    }
    if (assignee) { sql += ' AND (assignee = ? OR assignee LIKE ?)'; args.push(assignee, assignee + '/%'); }
    sql += ' ORDER BY CASE status WHEN \'done\' THEN 1 ELSE 0 END, priority ASC, id ASC';
    return this.db.prepare(sql).all(...args).map(rowToTask);
  }

  createTask(author, { title, description = '', priority = 2, depends_on = [] }) {
    if (!title || !title.trim()) throw new Error('title is required');
    const now = Date.now();
    const r = this.db
      .prepare('INSERT INTO tasks (title, description, priority, depends_on, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(title.trim(), description, priority, JSON.stringify(depends_on), author, now, now);
    const task = this.getTask(Number(r.lastInsertRowid));
    this.emit({ author, kind: 'task_created', channel: 'tasks', task_id: task.id, text: `#${task.id} ${task.title}` });
    return task;
  }

  claimTask(author, id) {
    const task = this.getTask(id);
    if (!task) throw new Error(`task #${id} not found`);
    const gate = this.claimGate();
    if (gate) throw new Error(gate);
    const blockers = task.depends_on.map((d) => this.getTask(d)).filter((d) => d && d.status !== 'done');
    if (blockers.length) {
      throw new Error(`task #${id} depends on unfinished task(s): ${blockers.map((b) => `#${b.id} (${b.status})`).join(', ')}`);
    }
    const branch = task.branch || `task/${id}-${slug(task.title)}`;
    const r = this.db
      .prepare("UPDATE tasks SET status='claimed', assignee=?, branch=?, updated_at=? WHERE id=? AND status='open'")
      .run(author, branch, Date.now(), id);
    if (r.changes === 0) {
      throw new Error(`task #${id} is not open (status=${task.status}, assignee=${task.assignee || 'none'}). Pick another task.`);
    }
    this.emit({ author, kind: 'task_claimed', channel: 'tasks', task_id: id, text: `claimed #${id} ${task.title} → branch ${branch}` });
    return this.getTask(id);
  }

  updateTask(author, id, { status, note, branch, title, description, priority, assignee }, { human = false } = {}) {
    const task = this.getTask(id);
    if (!task) throw new Error(`task #${id} not found`);
    // The integrator merges other people's work, so it may move a task out of review (to done, or back to in_progress).
    const integrator = this.getSettings().integrator;
    const isIntegratorMove = integrator && sameTeam(author, integrator) && task.status === 'review' && ['done', 'in_progress'].includes(status);
    if (!human && !isIntegratorMove && task.assignee && !sameTeam(author, task.assignee) && status && status !== task.status) {
      throw new Error(`task #${id} is assigned to ${task.assignee}; post a message to them instead of changing its status.`);
    }
    if (status && !STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);
    const next = {
      status: status ?? task.status,
      branch: branch ?? task.branch,
      title: title ?? task.title,
      description: description ?? task.description,
      priority: priority ?? task.priority,
      assignee: assignee !== undefined ? assignee : task.assignee,
    };
    if (next.status === 'open') next.assignee = null;
    this.db
      .prepare('UPDATE tasks SET status=?, branch=?, title=?, description=?, priority=?, assignee=?, updated_at=? WHERE id=?')
      .run(next.status, next.branch, next.title, next.description, next.priority, next.assignee, Date.now(), id);
    const parts = [];
    if (status && status !== task.status) parts.push(`${task.status} → ${status}`);
    if (note) parts.push(note);
    this.emit({
      author,
      kind: 'task_updated',
      channel: 'tasks',
      task_id: id,
      text: `#${id} ${parts.join(' — ') || 'updated'}`,
      data: { status: next.status },
    });
    if (next.status === 'done' || next.status === 'open') this.releaseLocksForTask(id);
    return this.getTask(id);
  }

  releaseTask(author, id, note) {
    return this.updateTask(author, id, { status: 'open', note: note ? `released: ${note}` : 'released' });
  }

  // ---------- locks ----------
  purgeLocks() {
    this.db.prepare('DELETE FROM locks WHERE expires_at < ?').run(Date.now());
  }

  listLocks() {
    this.purgeLocks();
    return this.db.prepare('SELECT * FROM locks ORDER BY path').all().map((l) => ({ ...l, expires_in_s: Math.round((l.expires_at - Date.now()) / 1000) }));
  }

  lockFiles(author, { paths, ttl_s = 900, task_id = null, reason = '' }) {
    this.purgeLocks();
    const norm = paths.map(normPath);
    const conflicts = norm
      .map((p) => this.db.prepare('SELECT * FROM locks WHERE path = ?').get(p))
      .filter((l) => l && !sameTeam(author, l.owner));
    if (conflicts.length) {
      return { ok: false, conflicts: conflicts.map((c) => ({ path: c.path, owner: c.owner, task_id: c.task_id, reason: c.reason, expires_in_s: Math.round((c.expires_at - Date.now()) / 1000) })) };
    }
    const exp = Date.now() + ttl_s * 1000;
    const up = this.db.prepare(
      'INSERT INTO locks (path, owner, task_id, reason, expires_at) VALUES (?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET owner=excluded.owner, task_id=excluded.task_id, reason=excluded.reason, expires_at=excluded.expires_at'
    );
    for (const p of norm) up.run(p, author, task_id, reason, exp);
    this.emit({ author, kind: 'lock', channel: 'locks', task_id, text: `locked ${norm.join(', ')} for ${ttl_s}s${reason ? ` (${reason})` : ''}` });
    return { ok: true, locked: norm, expires_in_s: ttl_s };
  }

  unlockFiles(author, { paths, force = false }) {
    const norm = paths.map(normPath);
    const released = [];
    const refused = [];
    for (const p of norm) {
      const l = this.db.prepare('SELECT * FROM locks WHERE path = ?').get(p);
      if (!l) continue;
      if (!force && !sameTeam(author, l.owner)) { refused.push({ path: p, owner: l.owner }); continue; }
      this.db.prepare('DELETE FROM locks WHERE path = ?').run(p);
      released.push(p);
    }
    if (released.length) {
      this.emit({ author, kind: 'unlock', channel: 'locks', text: `${force ? 'force-' : ''}unlocked ${released.join(', ')}` });
    }
    return { released, refused };
  }

  releaseLocksForTask(task_id) {
    const r = this.db.prepare('DELETE FROM locks WHERE task_id = ?').run(task_id);
    if (r.changes) this.emit({ author: 'board', kind: 'unlock', channel: 'locks', task_id, text: `released ${r.changes} lock(s) held for #${task_id}` });
  }

  // ---------- human questions ----------
  ask(author, { question, task_id = null }) {
    const r = this.db
      .prepare('INSERT INTO questions (asker, question, task_id, created_at) VALUES (?,?,?,?)')
      .run(author, question, task_id, Date.now());
    const id = Number(r.lastInsertRowid);
    this.emit({ author, kind: 'question', channel: 'humans', task_id, text: question, data: { question_id: id } });
    return { question_id: id };
  }

  answer(author, id, answer) {
    const q = this.db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    if (!q) throw new Error(`question ${id} not found`);
    this.db.prepare('UPDATE questions SET answer=?, answered_by=?, answered_at=? WHERE id=?').run(answer, author, Date.now(), id);
    this.emit({
      author,
      kind: 'answer',
      channel: 'humans',
      task_id: q.task_id,
      text: `@${q.asker} re "${q.question.slice(0, 80)}": ${answer}`,
      data: { question_id: id },
    });
    return this.db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
  }

  listQuestions({ open_only = false } = {}) {
    const sql = open_only ? 'SELECT * FROM questions WHERE answer IS NULL ORDER BY id' : 'SELECT * FROM questions ORDER BY id DESC LIMIT 50';
    return this.db.prepare(sql).all();
  }

  // ---------- settings: project goal + roles ----------
  getSettings() {
    const rows = this.db.prepare('SELECT key, value FROM settings').all();
    const s = { goal: '', repo: '', integrator: '', planner: '', deadline: '', freeze_minutes: '60', require_approval: '', plan_approved: '' };
    for (const r of rows) s[r.key] = r.value;
    return s;
  }

  // human=true: web UI (may overwrite anything). Agents may only fill an empty goal.
  setSettings(author, patch, { human = false } = {}) {
    const cur = this.getSettings();
    const changes = [];
    for (const key of ['goal', 'repo', 'integrator', 'planner', 'deadline', 'freeze_minutes', 'require_approval', 'plan_approved']) {
      if (patch[key] === undefined) continue;
      let val = String(patch[key] ?? '').trim();
      if (key === 'integrator' || key === 'planner') val = val.split('/')[0];
      if (HUMAN_ONLY.includes(key) && !human) throw new Error(`Only humans can change ${key} (on the web board).`);
      if (key === 'deadline' && val) {
        const t = /^\d+$/.test(val) ? Number(val) : Date.parse(val);
        if (!Number.isFinite(t)) throw new Error('deadline must be a date/time');
        val = String(t);
      }
      if (key === 'freeze_minutes') val = String(Math.max(0, Math.min(600, Math.round(Number(val) || 0))));
      if (key === 'require_approval' || key === 'plan_approved') val = /^(1|true|yes|on)$/i.test(val) ? '1' : '';
      if (val === cur[key]) continue;
      if (!human && key === 'goal' && cur.goal) throw new Error(`The goal is already set: "${cur.goal}". Only humans can change it (on the web board).`);
      this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, val);
      changes.push(describeSetting(key, val, cur));
    }
    if (changes.length) this.emit({ author, kind: 'settings', channel: 'general', text: changes.join('; ') });
    return this.getSettings();
  }

  // Atomic: take a role if nobody has it (or you already do).
  claimRole(author, role) {
    if (!['planner', 'integrator'].includes(role)) throw new Error('role must be planner or integrator');
    const root = author.split('/')[0];
    const cur = this.getSettings()[role];
    if (cur && cur !== root) throw new Error(`${cur} is already the ${role}. Carry on as a worker.`);
    if (cur === root) return { role, holder: root, already: true };
    this.setSettings(author, { [role]: root }, { human: true });
    return { role, holder: root };
  }

  // ---------- presence ----------
  // A person's Claude ("agent") and their browser ("human") are tracked separately, even under the same name.
  // Returns true when an agent comes online (new, or silent for 10+ min), so callers can push a live update.
  touch(name, kind) {
    const root = String(name || '').split('/')[0];
    if (!root || root === 'anonymous' || root === 'board' || !['agent', 'human'].includes(kind)) return false;
    const prev = this.db.prepare('SELECT last_seen FROM presence_v2 WHERE name = ? AND kind = ?').get(root, kind);
    const now = Date.now();
    this.db
      .prepare('INSERT INTO presence_v2 (name, kind, last_seen) VALUES (?,?,?) ON CONFLICT(name, kind) DO UPDATE SET last_seen = excluded.last_seen')
      .run(root, kind, now);
    return kind === 'agent' && (!prev || now - prev.last_seen >= AGENT_ONLINE_MS);
  }

  markStarted(name) {
    const root = String(name || '').split('/')[0];
    const r = this.db.prepare("UPDATE presence_v2 SET started_at = ? WHERE name = ? AND kind = 'agent' AND started_at IS NULL").run(Date.now(), root);
    return r.changes > 0;
  }

  // Which AI tool an agent uses (from the MCP initialize handshake), e.g. "Claude Code", "Codex".
  setClient(name, client) {
    const root = String(name || '').split('/')[0];
    if (!root || !client) return false;
    const r = this.db.prepare("UPDATE presence_v2 SET client = ? WHERE name = ? AND kind = 'agent' AND (client IS NULL OR client != ?)").run(client, root, client);
    return r.changes > 0;
  }

  // Agents count as online if they called the board in the last 10 min (orchestrators can be busy for a while).
  presence(humansOnline = new Set()) {
    const rows = this.db.prepare('SELECT * FROM presence_v2 ORDER BY name, kind').all();
    const out = rows.map((r) => ({
      name: r.name,
      person: personOf(r.name),
      kind: r.kind,
      client: r.client || null,
      last_seen: r.last_seen,
      online: r.kind === 'human' ? humansOnline.has(r.name) : Date.now() - r.last_seen < AGENT_ONLINE_MS,
      // An agent has really started (someone typed /board) once it reads the playbook or the board status.
      started: r.kind === 'agent' ? !!r.started_at : undefined,
    }));
    for (const h of humansOnline) if (!out.some((p) => p.name === h && p.kind === 'human')) out.push({ name: h, person: h, kind: 'human', last_seen: Date.now(), online: true });
    return out;
  }

  // ---------- guidance ----------
  // What phase is the team in, and what should THIS agent do next? Plain-language instructions.
  nextAction(agent) {
    const root = agent.split('/')[0];
    const s = this.getSettings();
    const tasks = this.listTasks();
    const mine = tasks.filter((t) => t.assignee && sameTeam(agent, t.assignee) && t.status !== 'done');
    const review = tasks.filter((t) => t.status === 'review');
    const doneIds = new Set(tasks.filter((t) => t.status === 'done').map((t) => t.id));
    const claimable = tasks.filter((t) => t.status === 'open' && t.depends_on.every((d) => doneIds.has(d)));
    const openQs = this.listQuestions({ open_only: true });
    const role = s.integrator === root ? 'integrator' : s.planner === root && tasks.length === 0 ? 'planner' : 'worker';

    let phase;
    if (!s.goal) phase = 'needs_goal';
    else if (!tasks.length) phase = 'needs_plan';
    else if (tasks.every((t) => t.status === 'done')) phase = 'all_done';
    else if (s.require_approval && !s.plan_approved) phase = 'awaiting_approval';
    else phase = 'building';
    const time = timeInfo(s);

    const steps = [];
    if (phase === 'needs_goal') {
      steps.push(
        'The team has not set a project goal yet. Ask the human you are chatting with: "What are we building, and what should the demo show?" ' +
        'Then call set_goal with 1–3 sentences. (Humans can also type it on the web board. If set_goal says a goal already exists, just continue.)'
      );
    } else if (phase === 'needs_plan') {
      if (!s.planner) steps.push('Nobody is planning yet. Call claim_role("planner"). If you get it, write the backlog (see below); if not, wait.');
      if (s.planner === root || !s.planner) {
        steps.push(
          'As planner: read the repo and the goal, then create_task for every piece of work. Keep tasks small (one branch, under an hour), ' +
          'write acceptance criteria in the description, set depends_on, and make foundations (scaffolding, schema, API contracts) priority 1. ' +
          'Post a short summary in general when done, then work as a normal worker.'
        );
      } else {
        steps.push(`${s.planner} is writing the backlog. Call wait_for_events until tasks appear, then claim one.`);
      }
    } else if (phase === 'awaiting_approval') {
      steps.push(
        s.planner === root
          ? 'The task list is written. The humans want to approve it before anyone starts: post a short summary of the plan in general, answer questions about it, adjust tasks if they ask, then wait_for_events until it is approved.'
          : 'The humans are reviewing the task list before work starts. Read it (list_tasks) and post in general if something is missing, then wait_for_events until it is approved.'
      );
    } else if (phase === 'all_done') {
      steps.push('Every task is done. Post a status update in general and ask_human whether there is more to do. Suggest follow-up tasks with create_task if you see gaps.');
    } else {
      if (role === 'integrator') {
        steps.push(
          review.length
            ? `You own main. Merge first: ${review.map((t) => `#${t.id} (${t.branch})`).join(', ')}. For each: fetch the branch, review, merge into main, run build/tests, push, update_task done. If it breaks, set it back to in_progress with a note @mentioning the assignee.`
            : 'You own main. Nothing is waiting in review right now, so work as a worker below and check back when something reaches review.'
        );
      } else if (!s.integrator && review.length) {
        steps.push(`${review.length} task(s) are waiting in review and nobody owns main. Call claim_role("integrator"). If you get it, merge them; if not, carry on.`);
      }
      if (mine.length) steps.push(`You have active tasks: ${mine.map((t) => `#${t.id} ${t.title} [${t.status}]`).join('; ')}. Keep them moving (or dispatch them to subagents) before claiming more.`);
      if (time.frozen) {
        steps.push(`FEATURE FREEZE (since ${time.freezeLabel}, demo at ${time.deadlineLabel}): do not claim or start new tasks. Finish and push what you have, get it merged, fix bugs on main, and help the integrator. Unfinished tasks you can't land in time: release_task them with a note.`);
      } else if (mine.length < 3) {
        steps.push(
          claimable.length
            ? `Claimable now (highest priority first): ${claimable.slice(0, 5).map((t) => `#${t.id} P${t.priority} ${t.title}`).join('; ')}. claim_task and do it (agents with background subagents: one per subagent, max 3 active; otherwise one at a time).`
            : 'No open tasks are claimable right now (all taken or waiting on dependencies). Help on the help channel, review others\' work, or create_task for gaps you notice; then wait_for_events.'
        );
      }
    }
    if (time.deadline && !time.frozen && phase !== 'all_done') steps.push(`Demo at ${time.deadlineLabel} (${time.leftLabel} left); feature freeze at ${time.freezeLabel}. Prefer small tasks that can land before the freeze.`);
    if (openQs.length) steps.push(`${openQs.length} question(s) are waiting for humans. Don't re-ask them; answers arrive as "answer" events.`);
    if (!s.integrator && phase === 'building' && role !== 'integrator' && !review.length) steps.push('Note: nobody owns main yet. The first agent with work in review should claim_role("integrator").');

    return { phase, your_role: role, goal: s.goal, repo: s.repo, deadline: time.deadline ? new Date(time.deadline).toISOString() : null, feature_freeze: time.frozen, roles: { planner: s.planner, integrator: s.integrator }, next_action: steps.join('\n') };
  }

  // Why claiming is not allowed right now, or '' if it is.
  claimGate() {
    const s = this.getSettings();
    if (s.require_approval && !s.plan_approved) return 'The humans have not approved the task list yet. Wait (wait_for_events); they approve it on the web board.';
    const t = timeInfo(s);
    if (t.frozen) return `Feature freeze since ${t.freezeLabel} (demo at ${t.deadlineLabel}): don't start new tasks. Finish and merge what is in progress, or help the integrator.`;
    return '';
  }

  // Markdown write-up of the day: goal, who built what, decisions, what's unfinished.
  summary() {
    const s = this.getSettings();
    const tasks = this.listTasks();
    const done = tasks.filter((t) => t.status === 'done');
    const notDone = tasks.filter((t) => t.status !== 'done');
    const answered = this.db.prepare('SELECT * FROM questions WHERE answer IS NOT NULL ORDER BY answered_at').all();
    const byPerson = new Map();
    for (const t of done) {
      const who = personOf(t.assignee || t.created_by);
      if (!byPerson.has(who)) byPerson.set(who, []);
      byPerson.get(who).push(t);
    }
    const first = this.db.prepare('SELECT MIN(ts) AS a, MAX(ts) AS b FROM events').get();
    const fmt = (ms) => (ms ? new Date(ms).toLocaleString() : '');
    const L = [];
    L.push('# Team board summary', '');
    if (s.goal) L.push(`**Goal:** ${s.goal}`, '');
    if (s.repo) L.push(`**Repo:** ${s.repo}`, '');
    L.push(`**Done:** ${done.length} of ${tasks.length} tasks${first.a ? ` · ${fmt(first.a)} – ${fmt(first.b)}` : ''}`, '');
    L.push('## What got built', '');
    if (!done.length) L.push('_Nothing merged yet._', '');
    for (const [who, list] of [...byPerson].sort((a, b) => b[1].length - a[1].length)) {
      L.push(`### ${who} (${list.length})`);
      for (const t of list) L.push(`- #${t.id} ${t.title}${t.assignee && t.assignee !== who ? ` _(by ${t.assignee})_` : ''}`);
      L.push('');
    }
    if (answered.length) {
      L.push('## Decisions (questions answered by humans)', '');
      for (const q of answered) L.push(`- **${q.question}** → ${q.answer} _(${q.answered_by})_`);
      L.push('');
    }
    if (notDone.length) {
      L.push('## Not finished', '');
      for (const t of notDone) L.push(`- #${t.id} ${t.title} — ${t.status}${t.assignee ? ` (${t.assignee})` : ''}`);
      L.push('');
    }
    return L.join('\n');
  }

  // Everything on the board, for backups.
  exportAll() {
    const all = (table) => this.db.prepare(`SELECT * FROM ${table}`).all();
    return { exported_at: new Date().toISOString(), settings: this.getSettings(), tasks: this.listTasks(), questions: all('questions'), locks: all('locks'), events: all('events').map((e) => ({ ...e, data: e.data ? JSON.parse(e.data) : null })) };
  }

  // ---------- summary ----------
  status(agent) {
    const tasks = this.listTasks();
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const t of tasks) counts[t.status]++;
    return {
      you: agent,
      ...this.nextAction(agent),
      cursor: this.latestEventId(),
      task_counts: counts,
      your_tasks: tasks.filter((t) => t.assignee && sameTeam(agent, t.assignee) && t.status !== 'done'),
      open_tasks: tasks.filter((t) => t.status === 'open').slice(0, 15),
      stale_tasks: tasks.filter((t) => t.stale),
      locks: this.listLocks(),
      open_questions: this.listQuestions({ open_only: true }),
      recent: this.recentEvents(15),
    };
  }
}

// "alice" and "alice/auth-worker" are the same team (orchestrator + its subagents).
export function sameTeam(a, b) {
  if (!a || !b) return false;
  const ra = a.split('/')[0];
  const rb = b.split('/')[0];
  return ra === rb;
}

// The person behind an agent name: join names extra tools on one laptop "<person>-<tool>".
export function personOf(name) {
  return String(name || '').split('/')[0].replace(/-(claude|codex|copilot|copilotcli)$/, '');
}

function normPath(p) {
  return String(p).trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'task';
}

function rowToEvent(r) {
  return { ...r, data: r.data ? JSON.parse(r.data) : null };
}

function rowToTask(r) {
  const active = ['claimed', 'in_progress'].includes(r.status);
  return { ...r, depends_on: JSON.parse(r.depends_on || '[]'), stale: active && Date.now() - r.updated_at > STALE_MS };
}
