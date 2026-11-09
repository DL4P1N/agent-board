// Board domain logic: tasks, messages/events, locks, human questions.
// All writes are synchronous on a single thread, so each function is atomic.
import { DatabaseSync } from 'node:sqlite';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';

const STATUSES = ['open', 'claimed', 'in_progress', 'blocked', 'review', 'done'];
const STALE_MS = 30 * 60 * 1000;

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
    if (!human && task.assignee && !sameTeam(author, task.assignee) && status && status !== task.status) {
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

  // ---------- summary ----------
  status(agent) {
    const tasks = this.listTasks();
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const t of tasks) counts[t.status]++;
    return {
      you: agent,
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
