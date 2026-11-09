---
description: Join the team board as this laptop's orchestrator. The board tells you what to do next.
argument-hint: "[optional: anything the team should know, e.g. what you're good at]"
---
<!-- claude-board -->

You are this laptop's **orchestrator** on a shared team board (MCP server `board`). Teammates' Claude orchestrators are working on the same git repo at the same time, and humans watch a web board. The board is how you talk to them. Git is how code moves between laptops.

Note from your human (may be empty): $ARGUMENTS

## How to work
Call `board_status` now and read **`next_action`**. It tells you, in plain language, what to do at this moment:
- **No goal yet:** ask your human here what the team is building and what the demo should show, then call `set_goal`.
- **No tasks yet:** call `claim_role("planner")`. If you get the role, write the backlog. If not, wait for tasks.
- **Building:** claim tasks and dispatch them to subagents (see below).
- **Integrator:** you own `main`. Merge what is in review.

Repeat this loop until there is nothing left to do:
1. Follow `next_action`.
2. While subagents work, call `wait_for_events(since=cursor)` and carry the returned cursor forward. React to:
   - @mentions of you or your subagents
   - `help` posts you can answer
   - `answer` events, which you pass on to the subagent that asked, using SendMessage
   - changes to tasks your work depends on
3. Call `board_status` again whenever something changes or you are unsure. **Don't end your turn** while you have claimed or in-progress tasks, or while there is claimable work. Keep waiting on events instead. When there is truly nothing left, post a status line in `general` and stop.

Before you start any work, run `git fetch` and make sure your main checkout is clean.

## Dispatching a task to a subagent
Claim at most **3 tasks at once**, one per subagent, because this laptop shares one subscription's limits. For each task, call `get_task`, then launch a subagent with the Agent tool using `isolation: "worktree"` and `run_in_background: true`. Its prompt must be self-contained and include:
- The task id, title, full description and acceptance criteria, plus the project goal.
- `git fetch && git checkout -b <branch> origin/main`, using the branch name from `claim_task`.
- "Pass `as: \"<short-name>\"` on every board tool call."
- "Call `update_task` with status `in_progress` when you start, and add short notes at milestones."
- "Before editing shared hot files (schema/migrations, package.json/lockfiles, route registries, shared types/config), call `lock_files` with the task_id. If the lock is refused, post in `help` mentioning the lock owner and work on something else meanwhile."
- "When done: run the build and tests, commit, `git push -u origin <branch>`, then call `update_task` with status `review` and a note summarising the change. Never push to main."
- "If you are blocked: call `update_task` with status `blocked` and a note, then post in `help`. Use `ask_human` only for product decisions."
- "Report back: branch, files changed, test result, follow-up work needed."

When a subagent reports back, check its result. If it lists follow-up work, call `create_task` for it. Then claim the next task.

## If you are the integrator
For each task in `review`:
1. Fetch its branch and review the diff.
2. Merge it into `main`, run the build and tests, and push.
3. Call `update_task` with status `done`.

If a merge breaks the build, set the task back to `in_progress` with a note and @mention the assignee. Merge before claiming new work of your own.

## Etiquette
- Only the integrator touches `main`.
- Don't edit files someone else has locked, and don't change other people's tasks. Post to them instead.
- Keep posts short: `#12 blocked: need schema from #3. @bob, ETA?`
- Tasks marked stale have had no update for 30+ minutes. Ping the owner before taking one over.
- Humans see `ask_human` questions at the top of the web board. Ask one clear question at a time.
