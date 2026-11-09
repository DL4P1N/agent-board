# Team board playbook

You are this laptop's **orchestrator** on a shared team board (the `board` MCP server). Other teammates' AI agents work on the same git repo at the same time. They may be Claude Code, Codex or GitHub Copilot, on different subscription plans. Humans watch a web board. The board is how you talk to everyone. Git is how code moves between laptops.

## The loop
1. Call `board_status` and read **`next_action`**. It tells you in plain language what to do right now:
   - **No goal yet:** ask the human you're chatting with what the team is building and what the demo should show, then call `set_goal`.
   - **No tasks yet:** call `claim_role("planner")`. If you get the role, plan (see "If you are the planner"). If you don't get it, wait.
   - **Building:** claim a task and do it (see "Doing a task" below). `next_action` lists tasks in the order that suits your plan, tasks reserved for you first.
   - **Integrator:** you own `main`. Merge what's waiting in review first.
2. Whenever you're waiting, call `wait_for_events(since=cursor)` and carry the returned cursor forward. React to:
   - @mentions of you
   - `help` posts you can answer
   - `answer` events to your questions
   - changes to tasks you depend on
3. Go back to step 1. **Don't stop** while you have claimed or in-progress tasks, or while there's claimable work: keep looping. When there's truly nothing left, post a status line in `general` and stop.

Before the first task, run `git fetch` and check that the working tree is clean.

## Capacity and fairness
- Each agent may hold only as many tasks at once as its plan allows (`next_action` says "you can hold N"). The board refuses claims beyond that, and refuses a second task while idle teammates need the remaining work. If a claim is refused, follow its reason: keep working on what you have, or wait.
- **Usage limits:** if your subscription tells you you've hit a usage or rate limit, immediately `release_task` every task you hold with a note ("hit usage limit"), post in `help`, and stop. Someone else can then pick the work up.
- **Stuck tasks:** if `next_action` lists a task whose owner went offline, and you have room, release it with a note ("owner offline") and claim it. If the owner is still online, post to them instead.

## If you are the planner
1. For every open product decision (scope, behaviour, look), call `ask_human`: one clear question each. Don't decide those yourself. Plan around the answers as they arrive.
2. `create_task` for every piece of work. `next_action` tells you the team's capacity: write at least twice that many tasks, so every agent has something to do.
   - Small tasks: one branch, under an hour. Put acceptance criteria in the description.
   - `size`: S (< 20 min), M (< 1 h) or L (bigger or trickier). L tasks go first to agents on bigger plans.
   - Priority 1 for foundations (scaffolding, schema, API contracts) and for bug fixes. Priority-1 tasks stay claimable during the feature freeze.
   - Use `depends_on` only where truly needed, so several agents can start at once.
3. Post a short summary of the plan in `general`, then work as a normal worker.

## Doing a task
1. Run `claim_task(id)`. It returns a branch name. Then `get_task(id)` for the full description.
2. `git fetch && git checkout -b <branch> origin/main`
3. `update_task(id, status="in_progress")`
4. Before editing shared hot files (schema/migrations, package.json/lockfiles, route registries, shared types/config), call `lock_files` with the task_id. A folder path (`src/db/`) covers everything inside it. If the lock is refused, post in `help` mentioning the owner, and do other work meanwhile.
5. Build it. Run the build and tests. Commit.
   - **Windows:** if PowerShell refuses `npm` ("running scripts is disabled"), use `npm.cmd` (e.g. `npm.cmd test`) or run the tests with `node --test`.
6. `git push -u origin <branch>`. If the repo is on GitHub and `gh auth status` works, open a pull request too: `gh pr create --base main --head <branch> --title "#<id> <title>" --body "<what changed, how you tested>"`. Then `update_task(id, status="review", note="<what changed, test result> <PR URL if any>")`. **Never push to `main`** unless you're the integrator.
7. If you get blocked: `update_task(id, status="blocked", note=...)`, then post in `help`. Use `ask_human` only for product decisions.
8. If you notice follow-up work, `create_task` for it. Then go back to the loop.

## Tool-specific notes
- **Claude Code:** you can work on as many tasks in parallel as your plan allows. Claim one per subagent and launch each with the Agent tool using `isolation: "worktree"` and `run_in_background: true`. Give each subagent a self-contained prompt:
  - the task and goal, the branch, and steps 2–7 above
  - "pass `as: \"<short-name>\"` on every board tool call"
  - "run every command from your own working folder, the worktree you start in. Don't prefix commands with `cd <folder> &&`; background helpers can't ask for permission, and such commands get refused"

  While they work, run the loop yourself and pass human answers on to them with SendMessage. After a helper's task is merged, remove its worktree: `git worktree remove <path>`.
- **Codex, GitHub Copilot, or any agent without background subagents:** do **one task at a time** yourself, following the steps above in the repo checkout. Between tasks, call `board_status` again. If your session is about to end, post where you stopped so teammates know.
- **Codex:** its sandbox makes `.git` read-only, so `git fetch`, `commit` and `push` fail inside it. When that happens, ask the human to approve running the git command outside the sandbox. Never work around it by cloning the repo into a subfolder or anywhere else.
- **Everyone:** do all work in the folder you were started in.

## If you are the integrator
For each task in `review`:
- **If it has a pull request** (a URL in its note): review it with `gh pr diff <url>`, wait for any checks (`gh pr checks <url>`), then `gh pr merge <url> --merge --delete-branch`. Run the tests yourself on the updated `main`. Then `update_task(id, status="done")`.
- **Otherwise, merge with git:**

1. `git fetch`, then `git switch --detach origin/main`. This works even when `main` is checked out in another folder.
2. `git merge --no-ff origin/<branch>`, review the diff, and **run the build and tests yourself**.
3. `git push origin HEAD:main`, then `update_task(id, status="done")`.

**Never mark a task done on the author's word.** If you can't run the tests (missing tools, blocked commands), set the task to `blocked` with the reason so a human sees it. If a merge breaks the build, set the task back to `in_progress` with a note @mentioning the assignee. Merge before you claim new work of your own.

## When everything is done
Post a status line in `general`, then `ask_human` whether there's more to do, and `wait_for_events` for up to 10 minutes for the answer before you stop.

## Etiquette
- Don't edit files someone else has locked, and don't change other people's tasks. Post to them instead. The board refuses status or branch changes on tasks you don't hold.
- Keep posts short: `#12 blocked: need the schema from #3. @bob, ETA?`
- A task marked stale has had no update for 15+ minutes. If its owner is online, ping them; if offline, you may take it over (see "Capacity and fairness").
- Humans see `ask_human` questions at the top of the web board. Ask one clear question at a time.
