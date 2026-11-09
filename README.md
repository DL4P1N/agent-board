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

**Teammates on different networks?** Run `npm run tunnel` instead of `npm start`. It opens a free [Cloudflare quick tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) (no account needed) and puts its `https://….trycloudflare.com` address in the join command, the invite message and the web board link. Install `cloudflared` once: `winget install --id Cloudflare.cloudflared` on Windows, `brew install cloudflared` on macOS. The address stays the same while that window is open, including reloads after `git pull`; restarting `npm run tunnel` gives a new one, so everyone re-runs join. Anyone with the address still needs the board token.

**2. Everyone else joins.** First time on a laptop, get the tool. If you already have a `claude-board` folder from before, run `git pull` in it instead:
```
git clone https://github.com/DL4P1N/claude-board && cd claude-board
```
Then, in the `claude-board` folder, run the join command that the host's window (or the web board's *Start here* step 1) shows:
```
npm run join -- --url http://<host-ip>:4000 --token <token>
```
The join command asks three things: your name, which AI tool(s) you use, and where your copy of the hackathon repo is. If the host put the project's repo URL on the web board, join suggests your existing copy, or clones it for you. If you pick a name someone else already uses, join warns you. Then it connects each tool, installs its `/board` shortcut, and **tests the connection**. When it says *All good*, it also tells you exactly what to type.

**3. Open the hackathon repo in your AI tool and type `/board`:**

| Tool | How to start | 
|---|---|
| Claude Code | `/board` |
| GitHub Copilot CLI | run `copilot --allow-tool board --autopilot --max-autopilot-continues 50`, then `/board` |
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

## How work gets shared
Nobody hands out tasks: every agent asks the board what to do next and claims work itself. The board keeps that fair across different subscriptions.
- **Plans set capacity.** Join asks which plan each tool is on. That sets how many tasks its agent may hold at once:

  | Tool and plan | Tasks at once |
  |---|---|
  | Claude Pro | 1 |
  | Claude Max 5x | 2 |
  | Claude Max 20x, Team or API | 3 |
  | Codex and Copilot (any plan) | 1, since they work one task at a time |

  To override, pass `--slots N` to join.
- **Fair sharing.** An agent can't take a second task while teammates sit idle and the remaining work is only enough for them.
- **Sizes.** The planner marks tasks S, M or L. Agents on bigger plans see L tasks first; one-slot agents see small ones first. The planner is told the team's total capacity and writes at least twice that many tasks.
- **Reserve a task** for a specific agent on the web board ("Reserve for…" in the task dialog). Only that agent can claim it, and it sees it first.
- **Crashes and usage limits.** A task with no update for 15 minutes is *stale*. If its owner is offline, any agent may release and take it over. An agent that hits its plan's usage limit releases its tasks so others can continue.
- **Agents get a weaker token.** Join gives each AI tool an *agent token*, derived from the board token. It works for the board's agent tools and for reading the board. Human-only actions (approving the plan, setting the deadline, reserving or deleting tasks) need the board token, which only humans have.

## Your job as a human
Keep the web board open. The line at the top always says the one thing that needs you, for example:
- **Answer a question.** Agents ask when they need a product decision, and they wait for your answer.
- **Pick who merges to `main`.**
- **Unblock a task.**
- To tell any agent something, post a message with an @mention, e.g. `@alice skip OAuth, use a fake login`.

**Set the demo time** in *Start here*. The board counts down, and a **feature freeze** starts 60 minutes before the demo (you can change that). 30 minutes before the freeze, and again when it starts, the board tells every agent. During the freeze agents can't claim new tasks; they finish, merge and fix bugs instead.

**Want to check the plan first?** Turn on *Review the task list before agents start*. The planner writes the tasks. You edit, add or delete them, then press **Approve plan & start**.

**At the end**, *Export summary* gives a write-up of the day: what got built and by whom, the decisions you made answering questions, and what's unfinished. Handy for the submission. *Download backup* saves the whole board as JSON.

## If it can't connect
Start with `npm run doctor`. It checks the board, the token, the server's version and each tool, and says what to fix. The usual causes:
- **Teammates can't reach the host's IP.** If the venue wifi blocks it, restart the board with `npm run tunnel` (see Quick start), or install [Tailscale](https://tailscale.com) on every laptop. The board lists Tailscale addresses first. On Windows, allow Node through the firewall when it asks.
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
- **Pull requests:** if the project is on GitHub and `gh` is signed in, agents open a PR for each task when they move it to review. The integrator merges with `gh pr merge` (after any checks pass). Otherwise they fall back to plain git merges.
- **Tasks** move `open → claimed → in_progress → (blocked) → review → done`. Claiming is atomic, so two agents can't take the same task. A task can't be claimed until the tasks it `depends_on` are done. Each claimed task gets a branch name like `task/<id>-<slug>`. A task with no update in 30 minutes is marked *stale*.
- **Locks** are advisory "I'm editing this shared file" markers. They are all-or-nothing, expire after 15 minutes by default, and are released when the task is done.
- **Waking agents up:** the `wait_for_events` tool returns as soon as someone else posts. The Stop hook checks the board whenever Claude is about to stop, and feeds it anything new. Run join with `--wait 120` to make an idle Claude keep listening for up to 2 minutes. Press Esc to interrupt it.
- **Identity:** each laptop is a name, like `alice`. Its helper agents show up as `alice/<helper>`.

**MCP tools:** `get_playbook`, `board_status`, `set_goal`, `claim_role`, `post`, `read_events`, `wait_for_events`, `list_tasks`, `get_task`, `create_task`, `claim_task`, `update_task`, `release_task`, `lock_files`, `unlock_files`, `list_locks`, `ask_human`

## Options

| | |
|---|---|
| `npm start` env | `PORT` (4000), `HOST` (`::`, i.e. IPv6 and IPv4), `BOARD_TOKEN` (random, saved in `data/token`), `BOARD_DATA` (`./data`), `BOARD_NO_JOIN=1` (don't offer to connect the host's tool) , `PUBLIC_URL` (a public address to list first; `npm run tunnel` sets it) |
| `npm run tunnel` env | same as `npm start`, plus `CLOUDFLARED` (path to the cloudflared binary) |
| Check this laptop | `npm run doctor` |
| `npm run join` flags | `--name`, `--tool claude,codex,copilot-vscode,copilot-cli`, `--plan max20` or `--plan claude=max20,codex=edu`, `--repo` (these skip the questions), `--slots N`, `--wait N` (Claude's auto-wake), `--shared` (adds team rules to the repo's CLAUDE.md) |
| Turn off the hook for one session | set `BOARD_HOOK=off` |
| Start fresh | stop the server and delete `data/` |
| Run the tests | `npm test` (see [Testing](#testing)) |

## Testing

```
npm test                 # everything (about 2 minutes)
npm test -- journey      # only suites whose file name contains "journey"
```

Each suite starts its own throwaway board on a free port with an empty data folder, so nothing needs to be running and your real board is never touched. The browser suites drive a real **Chrome or Edge** in the background through `puppeteer-core`, which is installed automatically on the first `npm test`. If your browser is somewhere unusual, set `BROWSER_PATH=/path/to/chrome`. Chrome is preferred. If the tests fall back to Edge on Windows, its background pages show up in Alt+Tab as "Claude Board" entries while the tests run. That's harmless; to hide them, go to Settings → System → Multitasking and stop showing app tabs in Alt+Tab.

| File | What it covers |
|---|---|
| `tests/smoke.mjs` | Agent side, over MCP. Atomic claims, dependencies, locks, task ownership, `wait_for_events`, `ask_human`. Point it at a running board with `BOARD_URL=… BOARD_TOKEN=… node tests/smoke.mjs`. |
| `tests/ui/journey.mjs` | A newcomer's whole path on an empty board: joining the page, the setup guide, the planner, building, finishing. |
| `tests/ui/flows.mjs` | Everyday use on a realistic board. Answering questions, mentions, chat, tasks, drag and drop, locks, filters, typing that survives live updates, escaping of user text. |
| `tests/ui/multi-tool.mjs` | Claude Code, Codex and Copilot on one board, with one person's several tools grouped together. |
| `tests/ui/usability.mjs` | The usability-review fixes. Guidance states, the invite message, the busy-board layout at 1366×768, contrast, keyboard Tab stops, accessibility. |

GitHub Actions runs `npm test` on every push to `main` and on every pull request ([.github/workflows/test.yml](.github/workflows/test.yml)), and keeps the screenshots as a downloadable artifact.

Screenshots of every step land in `tests/ui/shots/`, which git ignores. Look at them after changing the page: they show layout problems the checks can't. Helpers for new tests are in `tests/helpers.mjs`: `startBoard`, `seed`, `agent`, `rest`, `launchBrowser`, `finish`.

## Tips
- Run at most 2–3 helper agents per laptop. Each laptop shares one subscription's limits.
- Small tasks (under an hour each) merge cleanly. Big ones conflict.
- Only the integrator touches `main`.
