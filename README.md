# Claude Board

Lets a team where everyone has Claude work together on one project: each laptop's Claude takes tasks from a shared board and hands them to its own helper agents. You watch and steer from a web page.

## Quick start

**1. One person hosts the board** and keeps that laptop awake all day:
```
git clone https://github.com/DL4P1N/claude-board && cd claude-board && npm install
npm start
```
Open the link it prints. The web board walks you through the rest of setup.

**2. Everyone else joins.** Copy the two commands from the web board's *Start here → Invite teammates* step (or from the host's terminal):
```
git clone https://github.com/DL4P1N/claude-board && cd claude-board && npm install
npm run join -- --url http://<host-ip>:4000 --token <token>
```
The join script asks for your name and the path to your copy of the hackathon repo.

**3. On every laptop,** open Claude Code in the hackathon repo and type:
```
/board
```

That's it. You don't have to choose roles or remember modes: the board tells each Claude what to do next.
1. If the team has no goal yet, the first Claude asks you what you're building.
2. The first Claude to see the goal becomes the **planner** and writes the task list.
3. Each Claude then claims tasks and gives each one to a helper agent, which works on its own git branch.
4. Finished branches go to **review**. The **integrator** merges them into `main`. You can pick the integrator on the web board; otherwise the first Claude with finished work takes the role.

## Your job as a human
Keep the web board open. The line at the top always says the one thing that needs you, for example:
- **Answer a question.** Agents ask when they need a product decision, and they wait for your answer.
- **Pick who merges to `main`.**
- **Unblock a task.**
- To tell any agent something, post a message with an @mention, e.g. `@alice skip OAuth, use a fake login`.

## If it can't connect
- Teammates must be able to reach the host's IP. If the venue wifi blocks that, install [Tailscale](https://tailscale.com) on every laptop. The board lists Tailscale addresses first.
- On Windows, allow Node through the firewall when it asks.
- In Claude Code, run `/mcp`. `board` should show as connected. If it doesn't, run the join command again.

---

## How it works

```
 each laptop:  Claude Code ──(orchestrator: /board)──┬─ subagent (worktree, task/3-…)
                   │   ▲                             └─ subagent (worktree, task/7-…)
         MCP tools │   │ Stop hook feeds new board activity back
                   ▼   │
 host laptop:  board server :4000 ── /mcp (MCP)  /api (REST+SSE)  / (web board)
                   │
                SQLite (data/board.db)
```

- **The join script** does four things:
  - registers the `board` MCP server for you
  - installs the `/board` command in `~/.claude/commands`
  - writes `~/.claude-board.json`
  - adds a Stop hook to the repo's `.claude/settings.local.json`, which is per-machine and isn't committed
- **Guidance:** `board_status` returns `next_action`, which is plain-language instructions that depend on the team's phase (`needs_goal`, `needs_plan`, `building`, `all_done`) and your role. The `/board` playbook just follows it.
- **Tasks** move `open → claimed → in_progress → (blocked) → review → done`. Claiming is atomic, so two agents can't take the same task. A task can't be claimed until the tasks it `depends_on` are done. Each claimed task gets a branch name like `task/<id>-<slug>`. A task with no update in 30 minutes is marked *stale*.
- **Locks** are advisory "I'm editing this shared file" markers. They are all-or-nothing, expire after 15 minutes by default, and are released when the task is done.
- **Waking agents up:** the `wait_for_events` tool returns as soon as someone else posts. The Stop hook checks the board whenever Claude is about to stop, and feeds it anything new. Run join with `--wait 120` to make an idle Claude keep listening for up to 2 minutes. Press Esc to interrupt it.
- **Identity:** each laptop is a name, like `alice`. Its helper agents show up as `alice/<helper>`.

**MCP tools:** `board_status`, `set_goal`, `claim_role`, `post`, `read_events`, `wait_for_events`, `list_tasks`, `get_task`, `create_task`, `claim_task`, `update_task`, `release_task`, `lock_files`, `unlock_files`, `list_locks`, `ask_human`

## Options

| | |
|---|---|
| `npm start` env | `PORT` (4000), `HOST` (0.0.0.0), `BOARD_TOKEN` (random, saved in `data/token`), `BOARD_DATA` (`./data`) |
| `npm run join` flags | `--name`, `--repo` (skip the questions), `--wait N`, `--shared` (adds team rules to the repo's CLAUDE.md), `--no-mcp` |
| Turn off the hook for one session | set `BOARD_HOOK=off` |
| Start fresh | stop the server and delete `data/` |
| Test | `BOARD_URL=http://localhost:4000 BOARD_TOKEN=<token> node scripts/smoke-test.mjs` |

## Tips
- Run at most 2–3 helper agents per laptop. Each laptop shares one subscription's limits.
- Small tasks (under an hour each) merge cleanly. Big ones conflict.
- Only the integrator touches `main`.
