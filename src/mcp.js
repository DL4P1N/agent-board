// MCP tool definitions. A fresh McpServer is built per HTTP request (stateless),
// bound to the calling agent's identity from the X-Agent header.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const MAX_WAIT_S = 90;

export function buildMcpServer(board, baseAgent) {
  const server = new McpServer(
    { name: 'claude-board', version: '1.0.0' },
    {
      instructions:
        'Shared coordination board for a team of humans and Claude agents working on one git repo. ' +
        'Start with board_status. Claim a task before working on it; work on its branch, never on main. ' +
        'Lock only shared hot files (schemas, package.json, route tables) before editing them. ' +
        'When idle or waiting, call wait_for_events with the last cursor. Post when blocked; use ask_human for decisions only a person can make. ' +
        'Subagents should pass `as` (e.g. "auth-worker") so their actions are attributed as "<you>/<as>".',
    }
  );

  const who = (as) => {
    if (!as) return baseAgent;
    const clean = String(as).trim().replace(/\s+/g, '-');
    return clean.startsWith(baseAgent + '/') || clean === baseAgent ? clean : `${baseAgent}/${clean}`;
  };
  const asArg = z.string().optional().describe('Optional sub-identity, e.g. your subagent name. Attributed as "<agent>/<as>".');
  const ok = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] });
  const fail = (e) => ({ isError: true, content: [{ type: 'text', text: String(e?.message || e) }] });
  const wrap = (fn) => async (args, extra) => {
    try { return ok(await fn(args || {}, extra)); } catch (e) { return fail(e); }
  };

  server.registerTool(
    'board_status',
    {
      title: 'Board status',
      description: 'Overview: your active tasks, open tasks, stale tasks, locks, unanswered human questions, recent activity, and the current event cursor. Call this first.',
      inputSchema: { as: asArg },
    },
    wrap(({ as }) => board.status(who(as)))
  );

  server.registerTool(
    'post',
    {
      title: 'Post message',
      description: 'Post a message to the board. Use @name to mention someone. Channels: general (default), help (blocked/need help), review (ready for review/merge), or any custom one.',
      inputSchema: {
        text: z.string(),
        channel: z.string().optional(),
        task_id: z.number().int().optional(),
        as: asArg,
      },
    },
    wrap(({ text, channel, task_id, as }) => board.post(who(as), { text, channel, task_id }))
  );

  server.registerTool(
    'read_events',
    {
      title: 'Read events',
      description: 'Read board events (messages, task changes, locks, questions, answers) with id > since. Returns events and the new cursor.',
      inputSchema: {
        since: z.number().int().optional().describe('Event id cursor; default 0'),
        channel: z.string().optional(),
        task_id: z.number().int().optional(),
        include_own: z.boolean().optional().describe('Include events you authored (default false)'),
        limit: z.number().int().min(1).max(500).optional(),
      },
    },
    wrap(({ since = 0, channel, task_id, include_own, limit }) => {
      const events = board.events({ since, channel, task_id, limit, exclude_author: include_own ? undefined : baseAgent });
      return { events, cursor: events.length ? events.at(-1).id : Math.max(since, 0) };
    })
  );

  server.registerTool(
    'wait_for_events',
    {
      title: 'Wait for events',
      description:
        `Block until new events from OTHER agents/humans arrive (or timeout, max ${MAX_WAIT_S}s). This is how you "receive webhooks". ` +
        'Pass the cursor from your last call. Returns {events, cursor}. Empty events means timeout — call again or do other work.',
      inputSchema: {
        since: z.number().int().optional().describe('Cursor from board_status / previous call. Omit to wait only for brand-new events.'),
        timeout_s: z.number().int().min(1).max(MAX_WAIT_S).optional().describe('Default 60'),
        channel: z.string().optional(),
      },
    },
    wrap(async ({ since, timeout_s = 60, channel }, extra) => {
      const cursor0 = since ?? board.latestEventId();
      const events = await board.waitForEvents(
        { since: cursor0, channel, exclude_author: baseAgent, limit: 200 },
        Math.min(timeout_s, MAX_WAIT_S) * 1000,
        extra?.signal
      );
      return { events, cursor: events.length ? events.at(-1).id : cursor0, timed_out: events.length === 0 };
    })
  );

  server.registerTool(
    'list_tasks',
    {
      title: 'List tasks',
      description: 'List tasks, optionally filtered by status (open, claimed, in_progress, blocked, review, done) or assignee.',
      inputSchema: {
        status: z.union([z.string(), z.array(z.string())]).optional(),
        assignee: z.string().optional(),
      },
    },
    wrap(({ status, assignee }) => board.listTasks({ status, assignee }))
  );

  server.registerTool(
    'get_task',
    {
      title: 'Get task',
      description: 'Get one task plus its full discussion/event history.',
      inputSchema: { id: z.number().int() },
    },
    wrap(({ id }) => {
      const task = board.getTask(id);
      if (!task) throw new Error(`task #${id} not found`);
      return { task, history: board.events({ task_id: id, limit: 200 }) };
    })
  );

  server.registerTool(
    'create_task',
    {
      title: 'Create task',
      description: 'Add a task to the backlog. Keep tasks small (1 branch, < ~1 hour). priority: 1=high, 2=normal, 3=low. depends_on: task ids that must be done first.',
      inputSchema: {
        title: z.string(),
        description: z.string().optional().describe('Acceptance criteria, relevant files, interfaces to respect'),
        priority: z.number().int().min(1).max(3).optional(),
        depends_on: z.array(z.number().int()).optional(),
        as: asArg,
      },
    },
    wrap(({ title, description, priority, depends_on, as }) => board.createTask(who(as), { title, description, priority, depends_on }))
  );

  server.registerTool(
    'claim_task',
    {
      title: 'Claim task',
      description: 'Atomically claim an open task. Fails if someone else already has it or its dependencies are unfinished. Returns the task with the branch name to use.',
      inputSchema: { id: z.number().int(), as: asArg },
    },
    wrap(({ id, as }) => board.claimTask(who(as), id))
  );

  server.registerTool(
    'update_task',
    {
      title: 'Update task',
      description:
        'Update your task: status (claimed, in_progress, blocked, review, done), a progress note, or branch. ' +
        'Use "review" when the branch is pushed and ready to merge; "blocked" with a note explaining why. Locks held for the task are released on done.',
      inputSchema: {
        id: z.number().int(),
        status: z.enum(['claimed', 'in_progress', 'blocked', 'review', 'done']).optional(),
        note: z.string().optional(),
        branch: z.string().optional(),
        as: asArg,
      },
    },
    wrap(({ id, status, note, branch, as }) => board.updateTask(who(as), id, { status, note, branch }))
  );

  server.registerTool(
    'release_task',
    {
      title: 'Release task',
      description: 'Give a task back to the open pool (you can\'t finish it, or it should be split). Releases its locks.',
      inputSchema: { id: z.number().int(), note: z.string().optional(), as: asArg },
    },
    wrap(({ id, note, as }) => board.releaseTask(who(as), id, note))
  );

  server.registerTool(
    'lock_files',
    {
      title: 'Lock files',
      description:
        'Advisory all-or-nothing lock on repo paths (relative, forward slashes; a directory path like "src/db/" is fine). ' +
        'Only lock shared hot spots. Re-locking your own paths renews the TTL. Returns conflicts if someone else holds any path.',
      inputSchema: {
        paths: z.array(z.string()).min(1),
        ttl_s: z.number().int().min(30).max(7200).optional().describe('Default 900 (15 min)'),
        task_id: z.number().int().optional(),
        reason: z.string().optional(),
        as: asArg,
      },
    },
    wrap(({ paths, ttl_s, task_id, reason, as }) => board.lockFiles(who(as), { paths, ttl_s, task_id, reason }))
  );

  server.registerTool(
    'unlock_files',
    {
      title: 'Unlock files',
      description: 'Release locks you (or your subagents) hold. force=true removes someone else\'s lock — only after asking them.',
      inputSchema: { paths: z.array(z.string()).min(1), force: z.boolean().optional(), as: asArg },
    },
    wrap(({ paths, force, as }) => board.unlockFiles(who(as), { paths, force }))
  );

  server.registerTool(
    'list_locks',
    { title: 'List locks', description: 'Current file locks with owners and seconds until expiry.', inputSchema: {} },
    wrap(() => board.listLocks())
  );

  server.registerTool(
    'ask_human',
    {
      title: 'Ask a human',
      description: 'Ask the humans a question (product decisions, credentials, ambiguous requirements). It shows on the web board; the answer arrives as an "answer" event via wait_for_events.',
      inputSchema: { question: z.string(), task_id: z.number().int().optional(), as: asArg },
    },
    wrap(({ question, task_id, as }) => board.ask(who(as), { question, task_id }))
  );

  return server;
}
