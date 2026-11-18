// The boards a server is running: starting, stopping and looking at them. Each live board is a runtime
// (src/runtime.js); the registry (src/boards.js) says which boards exist. A board that can't be opened is
// remembered in `failures`, and the other boards keep running.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { safeEq } from './http-util.js';
import { bestBase } from './network.js';
import { createBoardRuntime } from './runtime.js';

export function createLiveBoards({ registry, envTokenSlug }) {
  const runtimes = new Map(); // slug -> runtime (live boards only)
  // Live boards that couldn't be opened (corrupt database, bad registry entry, a token another board uses):
  // slug -> reason. They answer 503 and show as "failed" on the boards page; the other boards keep running.
  const failures = new Map();
  function startBoard(b) {
    if (runtimes.has(b.slug)) return runtimes.get(b.slug);
    failures.delete(b.slug);
    let rt;
    try {
      rt = createBoardRuntime(b.slug, registry.dirOf(b), { registry, envTokenSlug });
      // Two boards with the same token would let one board's links and agents act on the other.
      const twin = [...runtimes.values()].find((o) => safeEq(o.token, rt.token));
      if (twin) { rt.close(); throw new Error(`it uses the same token as "${twin.slug}". Give it its own token (delete ${path.join(registry.dirOf(b), 'token')} while the server is stopped) and restore it.`); }
    } catch (e) {
      const reason = String(e?.message || e);
      failures.set(b.slug, reason);
      console.error(`✗ Board "${b.slug}" failed to open: ${reason}`);
      throw Object.assign(new Error(`This board failed to open: ${reason}`), { status: 503 });
    }
    runtimes.set(b.slug, rt);
    return rt;
  }
  function stopBoard(slug) {
    failures.delete(slug);
    const rt = runtimes.get(slug);
    if (!rt) return;
    rt.close();
    runtimes.delete(slug);
  }
  const defaultRuntime = () => runtimes.get(registry.defaultSlug);

  // Numbers for the boards page: live boards from their runtime, archived ones by reading the file.
  function boardSummary(b) {
    const live = runtimes.get(b.slug);
    const out = {
      slug: b.slug, name: b.name, status: failures.has(b.slug) || registry.problem(b.slug) ? 'failed' : b.status, default: b.slug === registry.defaultSlug,
      created: b.created || null, archived_at: b.archived_at || null,
      error: failures.get(b.slug) || registry.problem(b.slug) || null,
      url: `${bestBase()}/b/${b.slug}/`,
      tasks: 0, done: 0, agents_online: 0, last_activity: null,
    };
    try {
      if (live) {
        // Proposed tasks aren't counted, as on the board and the presenter ("4 of 19 done").
        const tasks = live.board.listTasks().filter((t) => t.status !== 'proposed');
        out.tasks = tasks.length; out.done = tasks.filter((t) => t.status === 'done').length;
        out.agents_online = live.board.presence().filter((p) => p.kind === 'agent' && p.online).length;
        out.last_activity = live.board.db.prepare('SELECT MAX(ts) AS t FROM events').get().t || null;
      } else if (!registry.problem(b.slug)) {
        const file = path.join(registry.dirOf(b), 'board.db');
        if (fs.existsSync(file)) {
          const db = new DatabaseSync(file, { readOnly: true });
          try {
            const t = db.prepare("SELECT COUNT(*) AS n, SUM(status = 'done') AS d FROM tasks WHERE status != 'proposed'").get();
            out.tasks = Number(t.n) || 0; out.done = Number(t.d) || 0;
            out.last_activity = db.prepare('SELECT MAX(ts) AS t FROM events').get().t || null;
          } finally { db.close(); }
        }
      }
    } catch {}
    return out;
  }
  // Links that open a board as a human (the board's token in the URL), plus how teammates join it.
  function boardLinks(slug) {
    const rt = runtimes.get(slug);
    if (!rt) throw new Error(`"${slug}" isn't live: restore it first.`);
    const info = rt.setupInfo();
    const best = info.join_commands[0];
    return {
      slug, name: registry.get(slug)?.name || slug,
      url: best.web_url, token: rt.token,
      join_command: best.command,
      viewer_url: `${best.web_url.replace(/\?token=.*$/, '')}present.html?token=${rt.viewerToken}`,
    };
  }
  return { runtimes, failures, startBoard, stopBoard, defaultRuntime, boardSummary, boardLinks };
}
