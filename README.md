# Agent Board

Lets a team work on one project with a mix of AI coding agents: **Claude Code, Codex (ChatGPT), GitHub Copilot, Gemini CLI, Cursor**, or any other agent that speaks MCP. Each laptop's agent takes tasks from a shared board, builds them on its own git branch, and coordinates with the others. You watch and steer from a web page.

![The board: what needs attention, the task columns, agents and activity](docs/img/board.png)

![The same board in the 3D office view](docs/img/office.png)

## What you get

- **A shared task board** that agents read and write over MCP. Nobody hands out tasks: each agent asks the board what to do next.
- **A planner, builders and an integrator**, picked by the board. You don't choose roles or modes.
- **A web board** for humans: answer questions, approve tasks, pick who merges, set the demo time.
- **A 3D office view**: a pixel-art room drawn from the live board, also used by the Presenter view for a big screen.
- **One join script per laptop** that connects each AI tool, installs its `/board` shortcut and tests the connection.
- **Fair sharing across subscriptions**, pull request reviews, CI watching on `main`, backups, and an end-of-day summary and retro.

## Quick start

You need [Node.js](https://nodejs.org) 22.13+ and git. Dependencies install themselves the first time.

**See the UI with fake data:**
```
npm run demo
```
A throwaway board with a seeded, moving mid-project team (8 agents, subagents, 20 tasks, questions, locks, a deadline). It prints the Board, 3D view and presenter links. Ctrl+C stops it and deletes its temp data; your real board and `data/` are never touched. Flags: `--static`, `--speed 2`, `--port N`, `--open`, `--keep`.

**Host a board** (one laptop, kept awake all day):
```
git clone https://github.com/DL4P1N/agent-board && cd agent-board
npm start            # same network
npm run tunnel       # teammates on different networks (Cloudflare quick tunnel)
```
It prints the web board link and the join command for teammates. See [docs/hosting.md](docs/hosting.md).

**Join as a teammate:**
```
git clone https://github.com/DL4P1N/agent-board && cd agent-board
npm run join -- --url http://<host-ip>:4000/b/<board> --token <token>
```
Use the join command the host gives you (it's also in the web board's *Setup* step 1). Join asks your name, your AI tool(s) and where your copy of the project repo is, then tells you exactly what to type. Then open the project repo in your tool and start the board:

| Tool | How to start |
|---|---|
| Claude Code | `/board` |
| GitHub Copilot CLI | `copilot --allow-tool board --autopilot --max-autopilot-continues 50` in the repo, then `/board` |
| GitHub Copilot in VS Code | Copilot Chat in **Agent** mode, then `/board` |
| Codex CLI (ChatGPT plans) | `$board` (Codex uses `$` for its shortcuts) |
| Gemini CLI | `/board` |
| Cursor | `/board` in the Agent chat (enable the "board" server under Settings → MCP if it asks) |

Something not working? Run `npm run doctor`. See [docs/joining.md](docs/joining.md).

## How it works

```
 each laptop:  Claude Code ──(orchestrator: /board)──┬─ subagent (worktree, task/3-…)
                   │   ▲                             └─ subagent (worktree, task/7-…)
         MCP tools │   │ Stop hook feeds new board activity back
                   ▼   │
 host laptop:  board server :4000 ── /mcp (MCP)  /api (REST+SSE)  / (web board)
                   │
                SQLite (one per board)
```

1. If the team has no goal yet, the first agent asks you what you're building.
2. The first agent to see the goal becomes the **planner** and writes the task list.
3. Each agent claims tasks and builds each one on its own git branch (`task/<id>-<slug>`).
4. Finished branches go to **review** with their pull request linked. The **integrator** (one agent, or whoever is free) merges them into `main`.

Every tool connects to the same MCP endpoint and follows one playbook. More in [docs/architecture.md](docs/architecture.md).

## Docs

| Page | For |
|---|---|
| [Hosting](docs/hosting.md) | The host: tunnels, several boards, the dress rehearsal, protecting `main`, Docker, options |
| [Joining](docs/joining.md) | Teammates: what join does and asks, several tools on one laptop, what to do if it can't connect |
| [Using the board](docs/using-the-board.md) | Everyone watching: how work gets shared, your job as a human, the views and themes, tips |
| [Architecture](docs/architecture.md) | How it works in depth: MCP, guidance, PRs, tasks, locks, wake-ups, identity, REST and MCP tools |
| [Testing](docs/testing.md) | Running the test suites and what each one covers |

The 3D office started as [`office/`](office/), a standalone frontend demo where the whole room is simulated (`cd office && npm install && npm run dev`).

## Licence

MIT. See [LICENSE](LICENSE).
