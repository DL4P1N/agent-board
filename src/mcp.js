// MCP tool definitions. A fresh McpServer is built per HTTP request (stateless),
// bound to the calling agent's identity from the X-Agent header.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { normName } from './board.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_WAIT_S = 90;
const PLAYBOOK_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'playbook.md');
const playbook = () => fs.readFileSync(PLAYBOOK_PATH, 'utf8');

export function buildMcpServer(board, baseAgent) {
  baseAgent = normName(baseAgent);
  const server = new McpServer(
    { name: 'claude-board', version: '1.0.0' },
    {
      instructions:
        'Shared coordination board for a team of humans and Claude agents working on one git repo. ' +
        'If you were asked to join or work on the board, call get_playbook first and follow it. ' +
        'Then use board_status: its next_action field tells you exactly what to do now (set the goal, plan, claim work, or merge). ' +
        'Claim a task before working on it; work on its branch, never on main (unless you are the integrator). ' +
        'Lock only shared hot files (schemas, package.json, route tables) before editing them. ' +
        'When idle or waiting, call wait_for_events with the last cursor. Post when blocked; use ask_human for decisions only a person can make. ' +
        'Subagents should pass `as` (e.g. "auth-worker") so their actions are attributed as "<you>/<as>".',
    }
  );

  // First real use of the board (someone typed /board): show this agent as started on the web board.
  const started = () => { if (board.markStarted(baseAgent)) board.bus.emit('event', { id: 0, kind: 'presence', text: '' }); };
  const who = (as) => {
    if (!as) return baseAgent;
    // Helper names: short, plain characters only (no slashes, so nobody can pose as another agent).
    const clean = normName(as).replace(/\s+/g, '-').replace(/^.*\//, '').replace(/[^\w.-]/g, '').slice(0, 40);
    if (!clean) return baseAgent;
    return clean === baseAgent ? baseAgent : `${baseAgent}/${clean}`;
  };
  const asArg = z.string().optional().describe('Optional sub-identity, e.g. your subagent name. Attributed as "<agent>/<as>".');
  const ok = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] });
  const fail = (e) => ({ isError: true, content: [{ type: 'text', text: String(e?.message || e) }] });
  const wrap = (fn) => async (args, extra) => {
    try { return ok(await fn(args || {}, extra)); } catch (e) { return fail(e); }
  };
  // Every tool call is recorded: real work (not waiting/reading) shows the agent as busy on the web board.
  const presence = () => board.bus.emit('event', { id: 0, kind: 'presence', text: '' });
  const tool = (name, def, handler) => server.registerTool(name, def, async (args, extra) => {
    try { if (board.noteToolCall(baseAgent, name)) presence(); } catch {}
    return handler(args, extra);
  });

  tool(
    'board_status',
    {
      title: 'Board status',
      description:
        'Call this first, and again whenever you are unsure what to do. Returns next_action (plain-language instructions for you right now), ' +
        'the team phase (needs_goal, needs_plan, building, all_done), the project goal, roles (planner, integrator), your role, your tasks, open tasks, locks, questions, recent activity, and the event cursor.',
      inputSchema: { as: asArg },
    },
    wrap(({ as }) => { started(); return board.status(who(as)); })
  );

  tool(
    'get_playbook',
    {
      title: 'Get the playbook',
      description: 'How to work as this laptop\'s orchestrator on the team board (works for Claude Code, Codex, Copilot and any other agent). Call this when asked to join the board, then follow it.',
      inputSchema: {},
    },
    wrap(() => { started(); return playbook(); })
  );

  // Same playbook as an MCP prompt, for clients that surface prompts as slash commands.
  server.registerPrompt(
    'board',
    { title: 'Join the team board', description: 'Start working as this laptop\'s orchestrator on the team board.' },
    () => ({ messages: [{ role: 'user', content: { type: 'text', text: 'Join the team board and follow this playbook:\n\n' + playbook() } }] })
  );

  tool(
    'set_goal',
    {
      title: 'Set project goal',
      description: 'Set the team\'s project goal (1–3 sentences: what we are building and what the demo should show). Only works if no goal is set yet; humans can change it on the web board.',
      inputSchema: { goal: z.string().min(5) },
    },
    wrap(({ goal }) => board.setSettings(baseAgent, { goal }))
  );

  tool(
    'claim_role',
    {
      title: 'Claim a role',
      description:
        'Atomically take a team role if nobody has it. planner = writes the initial backlog. integrator = owns main: merges branches in review, runs tests, marks tasks done. ' +
        'Fails if someone else already holds it; then carry on as a worker. Humans can reassign roles on the web board.',
      inputSchema: { role: z.enum(['planner', 'integrator']) },
    },
    wrap(({ role }) => board.claimRole(baseAgent, role))
  );

  tool(
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

  tool(
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

  tool(
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

  tool(
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

  tool(
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

  tool(
    'create_task',
    {
      title: 'Create task',
      description: 'Add a task to the backlog. Keep tasks small (1 branch, < ~1 hour). priority: 1=high, 2=normal, 3=low (priority-1 tasks stay claimable during the feature freeze, so use it for bug fixes). size: S/M/L (agents on bigger plans get L tasks first). depends_on: ids of existing tasks that must be done first. ' +
        'If you are not the planner and the planner is online, the task is a PROPOSAL: it waits (status proposed) until the planner approves it; carry on meanwhile. reserved_for (planner only): the agent that should do it.' +
        (board.statsLine() ? ' ' + board.statsLine() : ''),
      inputSchema: {
        title: z.string(),
        description: z.string().optional().describe('Acceptance criteria, relevant files, interfaces to respect'),
        priority: z.number().int().min(1).max(3).optional(),
        size: z.enum(['S', 'M', 'L']).optional().describe('S: < 20 min, M: < 1 h, L: bigger or trickier'),
        depends_on: z.array(z.number().int()).optional(),
        reserved_for: z.string().optional().describe('Planner only: agent name (e.g. "alice-codex") that should do this task. Only it can claim it.'),
        as: asArg,
      },
    },
    wrap(({ title, description, priority, size, depends_on, reserved_for, as }) => board.createTask(who(as), { title, description, priority, size, depends_on, reserved_for }))
  );

  tool(
    'claim_task',
    {
      title: 'Claim task',
      description: 'Atomically claim an open task. Fails (with the reason) if someone else has it, its dependencies are unfinished, it is reserved for another agent, you are at your plan\'s capacity, idle teammates need the remaining work, the plan is not approved yet, or the feature freeze is on (priority-1 tasks excepted). Returns the task with the branch name to use.',
      inputSchema: { id: z.number().int(), as: asArg },
    },
    wrap(({ id, as }) => board.claimTask(who(as), id))
  );

  tool(
    'update_task',
    {
      title: 'Update task',
      description:
        'Update your task: status (claimed, in_progress, blocked, review, done), a progress note, branch, size, or its pull request (pr_url). You can only change tasks you hold; whoever merges (the integrator, or the agent that took the review with claim_review) may move review → done, or → in_progress to send it back for fixes (the author is @mentioned). ' +
        'Use "review" when the branch is pushed and ready to merge (pass pr_url if you opened a PR); "blocked" with a note explaining why. Locks held for the task are released on done. Planner only: reserved_for reserves an open task for an agent ("" clears).',
      inputSchema: {
        id: z.number().int(),
        status: z.enum(['claimed', 'in_progress', 'blocked', 'review', 'done']).optional(),
        note: z.string().optional(),
        branch: z.string().optional(),
        size: z.enum(['S', 'M', 'L']).optional(),
        pr_url: z.string().optional().describe('Link to the pull request for this task'),
        reserved_for: z.string().optional().describe('Planner only: agent that should do this task ("" clears)'),
        as: asArg,
      },
    },
    wrap(({ id, status, note, branch, size, pr_url, reserved_for, as }) => board.updateTask(who(as), id, { status, note, branch, size, pr_url, reserved_for }))
  );

  tool(
    'release_task',
    {
      title: 'Release task',
      description: 'Give a task back to the open pool (you can\'t finish it, it should be split, or you hit your plan\'s usage limit). Releases its locks. You may also release someone else\'s task if it is stale (no update for 15+ min) and its owner is offline.',
      inputSchema: { id: z.number().int(), note: z.string().optional(), as: asArg },
    },
    wrap(({ id, note, as }) => board.releaseTask(who(as), id, note))
  );

  tool(
    'claim_review',
    {
      title: 'Take a review',
      description:
        'Take a task that is in review so you can merge it (atomic: two agents never merge the same task). Not your own work, one review at a time. ' +
        'Allowed when the integrator setting is "whoever is free", or when you are the integrator. Then review, merge, test, and update_task done, or send it back with update_task status in_progress and what to fix.',
      inputSchema: { id: z.number().int(), as: asArg },
    },
    wrap(({ id, as }) => board.claimReview(who(as), id))
  );

  tool(
    'decide_proposal',
    {
      title: 'Approve or reject a proposed task',
      description: 'Planner (or humans): approve a proposed task so agents can claim it (optionally adjust priority, size or reserved_for), or reject it with a reason that goes back to the agent that proposed it.',
      inputSchema: {
        id: z.number().int(),
        approve: z.boolean(),
        note: z.string().optional().describe('Why (sent to the proposer), especially when rejecting'),
        priority: z.number().int().min(1).max(3).optional(),
        size: z.enum(['S', 'M', 'L']).optional(),
        reserved_for: z.string().optional(),
      },
    },
    wrap(({ id, approve, note, priority, size, reserved_for }) => board.decideProposal(baseAgent, id, { approve, note, priority, size, reserved_for }))
  );

  tool(
    'report_usage_limit',
    {
      title: 'Report that you hit your usage limit',
      description: 'Call this as soon as your subscription tells you you hit a usage or rate limit. The board marks you as out of usage (until the reset time, if you give it) and tells the team your tasks can be taken over. Then release_task each task you hold with a note, and stop. The mark clears when you call the board again later.',
      inputSchema: {
        until: z.string().optional().describe('When it resets, if shown: an ISO time, or a clock time today like "15:00" or "3pm"'),
        note: z.string().optional().describe('e.g. "Max 5x weekly limit"'),
      },
    },
    wrap(({ until, note }) => board.reportUsageLimit(baseAgent, { until, note }))
  );

  tool(
    'release_role',
    {
      title: 'Give up a role',
      description: 'Give up the planner or integrator role you hold, e.g. when you can\'t push or merge on this laptop. The team is told so someone else can claim it. (A role holder who is offline or out of usage can also simply be replaced with claim_role.)',
      inputSchema: { role: z.enum(['planner', 'integrator']), note: z.string().optional().describe('Why, e.g. "gh pr merge is blocked here"') },
    },
    wrap(({ role, note }) => board.releaseRole(baseAgent, role, note))
  );

  tool(
    'cancel_task',
    {
      title: 'Cancel a task',
      description: 'Planner only (humans do it on the web board): remove a task that should not be done, e.g. a duplicate of another task or work that is no longer needed. Give the reason; it is posted to the team.',
      inputSchema: { id: z.number().int(), reason: z.string().describe('e.g. "duplicate of #19"') },
    },
    wrap(({ id, reason }) => board.cancelTask(baseAgent, id, reason))
  );

  tool(
    'set_activity',
    {
      title: 'Say what you are doing',
      description: 'Tell the board what you are working on when it is not a board task (e.g. something a human asked you in your terminal), so the web board shows you as busy, not idle. Shown for up to 30 minutes; set_activity("") clears it.',
      inputSchema: { doing: z.string().describe('Short, e.g. "fixing the CI config Dana asked for"') },
    },
    wrap(({ doing }) => board.setActivity(baseAgent, doing))
  );

  tool(
    'lock_files',
    {
      title: 'Lock files',
      description:
        'Advisory all-or-nothing lock on repo paths (relative, forward slashes; a directory path like "src/db/" is fine). ' +
        'Only lock shared hot spots. Re-locking your own paths renews the TTL. Returns conflicts if someone else holds any path.',
      inputSchema: {
        paths: z.array(z.string()).min(1),
        ttl_s: z.number().int().min(30).max(3600).optional().describe('Default 900 (15 min), at most 3600; re-lock to renew'),
        task_id: z.number().int().optional(),
        reason: z.string().optional(),
        as: asArg,
      },
    },
    wrap(({ paths, ttl_s, task_id, reason, as }) => board.lockFiles(who(as), { paths, ttl_s, task_id, reason }))
  );

  tool(
    'unlock_files',
    {
      title: 'Unlock files',
      description: 'Release locks you (or your subagents) hold. force=true removes someone else\'s lock — only after asking them.',
      inputSchema: { paths: z.array(z.string()).min(1), force: z.boolean().optional(), as: asArg },
    },
    wrap(({ paths, force, as }) => board.unlockFiles(who(as), { paths, force }))
  );

  tool(
    'list_locks',
    { title: 'List locks', description: 'Current file locks with owners and seconds until expiry.', inputSchema: {} },
    wrap(() => board.listLocks())
  );

  tool(
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
