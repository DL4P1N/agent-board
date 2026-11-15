<!-- agent-board -->
## Team board rules (all agents and subagents)

Several people's Claude agents work on this repo at the same time. They coordinate through the `board` MCP server.

- **Work only on a claimed task, on its own branch** (`task/<id>-...`). Never commit to or push `main`. Only the integrator merges.
- **Lock shared hot files before editing them**: schema/migrations, package.json/lockfiles, route registries, shared types/config. Use `lock_files`. If the lock is refused, coordinate on the board instead of editing.
- **Report progress** with `update_task`: `in_progress`, then `review` (branch pushed), or `blocked` with a note.
- **Subagents** pass `as: "<your-name>"` on board tool calls.
- **Before starting** a task and **before pushing**, run `git fetch` and rebase on `origin/main`. Run the build and tests before you set a task to `review`.
- Questions for humans go to `ask_human`. Questions for other agents go to `post` with an @mention.
- Orchestrators start with `/board`. The board's `next_action` says whether to set the goal, plan, build or merge.
