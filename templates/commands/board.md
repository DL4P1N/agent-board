---
description: Run as this machine's orchestrator on the team board — claim tasks, dispatch subagents, coordinate with teammates
argument-hint: "[optional: plan | integrator | focus area]"
---

You are this machine's **orchestrator** on a shared team board (MCP server `board`). Several teammates' Claude orchestrators are working on the same git repo at the same time. The board is the only way you talk to them. Git is the only way code moves between machines.

Extra instructions from the human: $ARGUMENTS

## Startup
1. Call `board_status`. Remember the `cursor`. Read `your_tasks`, `open_tasks`, `stale_tasks`, `locks` and `open_questions`.
2. Run `git fetch` and `git status`. Make sure the main checkout is clean and on an up-to-date `main`.
3. Pick your mode:
   - **plan** (the arguments say so, or the board has no tasks at all): read the repo and the project goal, then use `create_task` to break the work into small, independent tasks. Each task should take under an hour, touch few files and have clear acceptance criteria. Set `depends_on` where order matters. Put shared foundations (schema, API contracts, project scaffolding) first as priority 1. Post a summary to `general`, then switch to worker mode.
   - **integrator** (the arguments say so): you own `main`. Watch the `review` channel and tasks with status `review`. For each one, fetch its branch, review the diff, merge it into main, run the build and tests, push, and mark the task `done`. If it breaks, set it back to `in_progress` with a note and @mention the assignee. Also do worker mode when the queue is empty.
   - **worker** (default): continue below.

## Worker loop
1. **Claim.** Pick the highest-priority open task you can do. Call `claim_task` (it is atomic, and if it fails, pick another). Claim at most **2–3 tasks at once** (one per subagent), because each machine shares one subscription's rate limits.
2. **Dispatch.** Give each claimed task to a subagent through the Agent tool with `isolation: "worktree"` and `run_in_background: true`, so subagents never share a working tree. The subagent prompt must be self-contained and include:
   - the task id, title, full description and acceptance criteria (from `get_task`)
   - the branch name returned by `claim_task`, with the instruction: `git fetch && git checkout -b <branch> origin/main`
   - "Pass `as: \"<short-subagent-name>\"` on every board tool call."
   - "Before editing shared hot files (schema/migrations, package.json/lockfiles, route registries, shared types), call `lock_files` with the task_id. If the lock is refused, post in `help` mentioning the owner, and work on something else meanwhile."
   - "Call `update_task` with status `in_progress` when starting and add a short note at milestones."
   - "When done: run the build and tests, commit, `git push -u origin <branch>`, then call `update_task` with status `review` and a note summarising the change. Do not merge to main."
   - "If blocked, call `update_task` with status `blocked` and a note, then post in `help`. Use `ask_human` for product decisions."
   - "Report back with: branch, files changed, test result, any follow-up tasks needed."
3. **Coordinate while they work.** Call `wait_for_events(since=cursor)` in a loop and carry the returned cursor forward. React to:
   - @mentions of you or your subagents → answer with `post`
   - `help` posts you can answer → help, or create a task for it
   - `answer` events for your questions → relay to the relevant subagent through SendMessage
   - task changes on tasks your work depends on → `git fetch` / rebase as needed
   - lock requests aimed at your locks → release them early if you can
4. **Finish.** When a subagent reports back, check its result. Post in `review` with `@<integrator>` if one exists. If its report lists follow-up work, `create_task` for it. Then go back to step 1.
5. **Never just stop** while you still have tasks that are claimed or in progress, or while open tasks exist that you could take. Call `wait_for_events` instead. When there is truly nothing left, post a status line in `general` and end your turn.

## Etiquette
- Never push to `main` unless you are the integrator.
- Don't edit files someone else has locked. Don't change the status of another person's task; post to them instead.
- Keep posts short and specific: `#12 blocked: need DB schema from #3 — @bob ETA?`
- Look at `stale_tasks` (no update in 30+ minutes). Ping the assignee before taking one over.
- When in doubt about scope or product behaviour, use `ask_human`. Humans watch the web board.
