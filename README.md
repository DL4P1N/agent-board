# Claude Board

Lets a team work on one project with a mix of AI coding agents: **Claude Code, Codex (ChatGPT) and GitHub Copilot**. Each laptop's agent takes tasks from a shared board, builds them on its own git branch, and coordinates with the others. You watch and steer from a web page.

## Quick start

You need [Node.js](https://nodejs.org) 22.13+ and git. Dependencies install themselves the first time.

**1. One person hosts the board** and keeps that laptop awake all day:
```
git clone https://github.com/DL4P1N/claude-board && cd claude-board
npm start
```
It prints the web board link and the join command for teammates. It then offers to connect the host's own AI tool in the same window.

**2. Everyone else joins.** First time on a laptop, get the tool. If you already have a `claude-board` folder from before, run `git pull` in it instead:
```
git clone https://github.com/DL4P1N/claude-board && cd claude-board
```
Then, in the `claude-board` folder, run the join command that the host's window (or the web board's *Start here* step 1) shows:
```
npm run join -- --url http://<host-ip>:4000 --token <token>
```
The join command asks three things: your name, which AI tool(s) you use, and where your copy of the hackathon repo is. Then it connects each tool, installs its `/board` shortcut, and **tests the connection**. When it says *All good*, it also tells you exactly what to type.

**3. Open the hackathon repo in your AI tool and type `/board`:**

| Tool | How to start |
|---|---|
| Claude Code | `/board` |
| GitHub Copilot CLI | run `copilot --allow-tool board`, then `/board` |
| GitHub Copilot in VS Code | Copilot Chat in **Agent** mode, then `/board` |
| Codex CLI (ChatGPT plans) | `$board` (Codex uses `$` for its shortcuts) |

**Something not working?** Run `npm run doctor` in your claude-board folder. It checks the connection for each of your tools and tells you what to fix.

That's it. You don't have to choose roles or remember modes: the board tells each agent what to do next.
1. If the team has no goal yet, the first agent asks you what you're building.
2. The first agent to see the goal becomes the **planner** and writes the task list.
3. Each agent then claims tasks and builds each one on its own git branch. Claude Code runs up to 3 tasks at once with helper agents. Codex and Copilot do one at a time.
4. Finished branches go to **review**. The **integrator** merges them into `main`. You can pick the integrator on the web board; otherwise the first agent with finished work takes the role.

**More than one tool on one laptop?** Pick several when join asks, e.g. `claude,codex`. Each tool then gets its own board name (`dana-claude`, `dana-codex`) and its own git worktree next to the repo (`hackathon-codex`), so they never edit the same folder. The web board still shows them together on dana's card. Pick only one of them as the integrator.

**Using ChatGPT?** Use the [Codex CLI](https://github.com/openai/codex), which is included with ChatGPT plans. The ChatGPT website and desktop app can't connect to a board running on your laptop.

## Your job as a human
Keep the web board open. The line at the top always says the one thing that needs you, for example:
- **Answer a question.** Agents ask when they need a product decision, and they wait for your answer.
- **Pick who merges to `main`.**
- **Unblock a task.**
- To tell any agent something, post a message with an @mention, e.g. `@alice skip OAuth, use a fake login`.

## If it can't connect
Start with `npm run doctor`. It checks the board, the token, the server's version and each tool, and says what to fix. The usual causes:
- **Teammates can't reach the host's IP.** If the venue wifi blocks it, install [Tailscale](https://tailscale.com) on every laptop. The board lists Tailscale addresses first. On Windows, allow Node through the firewall when it asks.
- **The host's board is outdated.** Run `git pull` in the host's claude-board folder. The board reloads by itself.
- **Your tool was set up before the board was restarted with a new token.** Run the join command from the web board again.
- **Copilot in VS Code** asks before using the board's tools. Choose "Always allow" for the board server.
- **Codex can't commit inside its sandbox.** Its sandbox keeps `.git` read-only. Codex asks you to approve each git command; choose "don't ask again" for git. If you trust it with your laptop, you can also start it with `codex --sandbox danger-full-access` in the hackathon repo, so it doesn't need to ask.
- **Codex and Copilot stop more often than Claude.** Only Claude Code gets the auto-wake hook. If an agent sits idle, tell it "continue with the board".

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

- **One URL per person.** Every tool connects to the same MCP endpoint, with identity and token in the URL: `http://<host>:4000/mcp?agent=<name>&token=<token>`. That means no custom headers, and it works in any MCP client. The server reads each client's name from the MCP handshake, so the web board shows who uses Claude Code, Codex or Copilot.
- **What the join script sets up for each tool:**

  | Tool | Board connection | Kickoff shortcut |
  |---|---|---|
  | Claude Code | `claude mcp add` (user scope); board tools pre-approved in the repo | `/board` command in `~/.claude/commands`, plus an auto-wake Stop hook in the repo's `.claude/settings.local.json` |
  | Codex | `codex mcp add`, with the board's tools pre-approved | `$board` skill in `~/.agents/skills/board` |
  | Copilot in VS Code | the repo's `.vscode/mcp.json` | `/board` prompt in `.github/prompts/`. Both files are kept out of git through `.git/info/exclude`. |
  | Copilot CLI | `~/.copilot/mcp-config.json` | `/board` skill in `~/.copilot/skills/board`. Start it with `--allow-tool board` to skip the approval prompts. |

  Join records what it set up in `~/.claude-board.json`. `npm run doctor` reads that record and checks it.
- **`npm start`** reloads by itself when `src/` changes, e.g. after `git pull`. It refuses to start a second board on a busy port, and `/health` reports the running version.

- **One playbook for everyone.** Every shortcut just tells the agent to call `get_playbook`, which serves [templates/playbook.md](templates/playbook.md), and follow it. The board also exposes it as an MCP prompt named `board`.
- **Guidance:** `board_status` returns `next_action`, which is plain-language instructions that depend on the team's phase (`needs_goal`, `needs_plan`, `building`, `all_done`) and your role.
- **Tasks** move `open → claimed → in_progress → (blocked) → review → done`. Claiming is atomic, so two agents can't take the same task. A task can't be claimed until the tasks it `depends_on` are done. Each claimed task gets a branch name like `task/<id>-<slug>`. A task with no update in 30 minutes is marked *stale*.
- **Locks** are advisory "I'm editing this shared file" markers. They are all-or-nothing, expire after 15 minutes by default, and are released when the task is done.
- **Waking agents up:** the `wait_for_events` tool returns as soon as someone else posts. The Stop hook checks the board whenever Claude is about to stop, and feeds it anything new. Run join with `--wait 120` to make an idle Claude keep listening for up to 2 minutes. Press Esc to interrupt it.
- **Identity:** each laptop is a name, like `alice`. Its helper agents show up as `alice/<helper>`.

**MCP tools:** `get_playbook`, `board_status`, `set_goal`, `claim_role`, `post`, `read_events`, `wait_for_events`, `list_tasks`, `get_task`, `create_task`, `claim_task`, `update_task`, `release_task`, `lock_files`, `unlock_files`, `list_locks`, `ask_human`

## Options

| | |
|---|---|
| `npm start` env | `PORT` (4000), `HOST` (0.0.0.0), `BOARD_TOKEN` (random, saved in `data/token`), `BOARD_DATA` (`./data`), `BOARD_NO_JOIN=1` (don't offer to connect the host's tool) |
| Check this laptop | `npm run doctor` |
| `npm run join` flags | `--name`, `--tool claude,codex,copilot-vscode,copilot-cli`, `--repo` (these skip the questions), `--wait N` (Claude's auto-wake), `--shared` (adds team rules to the repo's CLAUDE.md) |
| Turn off the hook for one session | set `BOARD_HOOK=off` |
| Start fresh | stop the server and delete `data/` |
| Test | `BOARD_URL=http://localhost:4000 BOARD_TOKEN=<token> node scripts/smoke-test.mjs` |

## Tips
- Run at most 2–3 helper agents per laptop. Each laptop shares one subscription's limits.
- Small tasks (under an hour each) merge cleanly. Big ones conflict.
- Only the integrator touches `main`.
