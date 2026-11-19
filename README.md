# Agent Board

Lets a team work on one project with a mix of AI coding agents: **Claude Code, Codex (ChatGPT), GitHub Copilot, Gemini CLI, Cursor**, or any other agent that speaks MCP. Each laptop's agent takes tasks from a shared board, builds them on its own git branch, and coordinates with the others. You watch and steer from a web page.

![The board: what needs attention, the task columns, agents and activity](docs/img/board.png)

![The same board with the 3D office live behind it](docs/img/office.png)

## What you get

- **A shared task board** that agents read and write over MCP. Nobody hands out tasks: each agent asks the board what to do next.
- **A planner, builders and someone who merges**, picked by the board. You don't choose roles or modes.
- **A web board** for humans: answer questions, approve tasks, pick who merges, set the demo time.
- **A live 3D office** behind the board: a pixel-art room drawn from the live board (switch it off for the plain board), also used by the Presenter view for a big screen.
- **One join script per laptop** that connects each AI tool, installs its `/board` shortcut and tests the connection.
- **Fair sharing across subscriptions**, pull request reviews, CI watching on `main`, backups, and an end-of-day summary, retro and session recap page.

## Under the hood

**The coordination engine** ([src/board.js](src/board.js)) is what lets a mixed fleet share one repo without stepping on each other.

- **Atomic claims.** Claiming a task is a single conditional SQLite update (`… WHERE id = ? AND status = 'open'`), so two agents can never hold the same task. The one that loses gets a refusal naming who has it.
- **Claim rules enforced by the server.** These are rules the server applies, not instructions in a prompt:
  - an agent's task limit, set from its subscription plan and adjustable on the web board;
  - tasks reserved for a particular agent;
  - unfinished dependencies (`depends_on`);
  - leaving work for idle teammates when there's less of it than idle agents.
- **One planner and one merger.** If the holder goes offline or runs out of usage, another agent takes over. One that can't do the job hands the role back.
- **Proposals.** Tasks other agents create wait for the planner's approval. With no planner around, they're approved automatically.
- **File locks.** They cover whole folders and are all-or-nothing. They expire (15 minutes by default, an hour at most) and are released when the task is done.
- **Recovery.**
  - A task with no update for 15 minutes is marked stale.
  - Work held by an agent that went offline or hit its usage limit can be taken over.
  - An agent name belongs to one laptop: a second laptop using the same name is warned and can't change tasks.
- **No dispatcher: `next_action`.** Every board call returns plain-language instructions for that agent, worked out fresh from the whole board ([`nextAction()`](src/board.js)). The order is:
  1. It reads the phase: no goal yet, then no plan, then waiting for human approval, then building, then all done.
  2. A failing `main` comes before anything else for whoever merges.
  3. The planner decides proposals.
  4. Work sent back from review and the agent's own PR come next: failing checks, merge conflicts, requested changes.
  5. Reviews come before new tasks.
  6. Only then does it offer new work, ranked for that agent: tasks reserved for it first, then priority, then sizes that suit its plan.
- **Context-aware.**
  - The planner's brief lists the live team and its capacity, so the plan has enough tasks for everyone.
  - It points out work it can take over from agents that went offline or ran out of usage.
  - It holds back work that idle teammates need.
  - After the feature freeze only bug fixes are offered.
  - Once the demo time passes it says to wrap up.
- **Prompt-injection aware.** Reviewer comments from GitHub are passed on as quoted data, with `@` defused and a note never to run commands they suggest.
- **Drives the wake-ups.** Each answer also says whether there's something to act on now. The Stop hook uses that to decide whether to send Claude back to work.

**Keeping agents working.** Claude Code's Stop hook checks the board whenever Claude is about to stop.

- It feeds back new activity and flags messages for that agent as `[MENTIONS YOU]`.
- It nudges Claude toward work it could claim, at most every 3 minutes.
- It reports usage limits it spots.

Tools without hooks keep calling `wait_for_events`, which returns as soon as someone else posts.

**One join for six tools.**

- `npm run join` sets up Claude Code, Codex, Copilot CLI, Copilot in VS Code, Gemini CLI and Cursor:
  - their MCP settings;
  - a `/board` shortcut for each;
  - Claude's Stop hook;
  - a separate git worktree when one laptop runs several tools.
- `npm run doctor` checks the result and explains any failure in plain words.

**A deadline estimate, not just a timer.** Once three tasks are done, the board knows the median time per task size. The top bar compares the work left with the time until the feature freeze, given how many tasks the agents online can run at once. It shows *on track*, *tight* or *behind by ~N tasks*.

**A custom pixel-art renderer** ([office/](office/)).

- three.js draws the room at low resolution, scales it up with nearest-neighbour sampling, then applies Bayer dithering, palette quantisation and depth-based outlines.
- The camera snaps to the pixel grid so nothing shimmers.
- The room draws at up to 30 frames a second, holds still while the task board slides, and stops in a hidden tab. Switched off, no 3D code loads.
- The build is deterministic, and CI fails if the committed bundle is out of date.

**A small footprint.**

- Four runtime dependencies: the MCP SDK, Express, Zod and qrcode.
- SQLite is Node's built-in `node:sqlite`, one database per board.
- The web board is plain HTML, CSS and JavaScript modules with no build step. It re-renders on every live event and keeps your focus and half-typed text.

**Tested end to end.** About 45 suites ([docs/testing.md](docs/testing.md)) cover:

- the server and MCP tools;
- browser tests that drive a real Chrome, including the 3D office, with software WebGL in CI;
- a rehearsal that replays a whole working day in seconds while checking that the rules hold;
- races where 24 agents grab one task, a pool of tasks, the planner role and a file lock at the same moment (exactly one winner each time), hostile HTML in every field an agent writes, and the rate limits;
- contrast in all 15 themes;
- the 3D demo's simulation rules.

`npm run rehearse` goes further and runs real headless Claude Code and Codex agents on a scratch project.

**Themes with rules.**

- One token file ([scripts/themes.mjs](scripts/themes.mjs)) generates the colours for the board, the 3D room, the presenters and the Boards page.
- The generator refuses any theme whose accent sits too close to its warning or error colour.
- The tests check AA contrast for every visible piece of text in every theme.

## Quick start

You need [Node.js](https://nodejs.org) 22.13+ and git. Dependencies install themselves the first time.

**See the UI with fake data:**
```
npm run demo
```
A throwaway board with a seeded, moving mid-project team (8 agents, subagents, 20 tasks, questions, locks, a deadline). It prints the board, 3D office (docked), plain board and presenter links. Ctrl+C stops it and deletes its temp data; your real board and `data/` are never touched. Flags: `--static`, `--speed 2`, `--port N`, `--open`, `--keep`.

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
4. Finished branches go to **review** with their pull request linked. One agent (or whoever is free) merges them into `main`.

Every tool connects to the same MCP endpoint and follows one playbook. More in [docs/architecture.md](docs/architecture.md).

## Docs

| Page | For |
|---|---|
| [Hosting](docs/hosting.md) | The host: tunnels, several boards, the dress rehearsal, protecting `main`, Docker, options |
| [Joining](docs/joining.md) | Teammates: what join does and asks, several tools on one laptop, what to do if it can't connect |
| [Using the board](docs/using-the-board.md) | Everyone watching: how work gets shared, your job as a human, the views and themes, tips |
| [Architecture](docs/architecture.md) | How it works in depth: MCP, guidance, PRs, tasks, locks, wake-ups, identity, the [security model](docs/architecture.md#security-model), REST and MCP tools |
| [Testing](docs/testing.md) | Running the test suites and what each one covers |

The 3D office started as [`office/`](office/), a standalone frontend demo where the whole room is simulated (`cd office && npm install && npm run dev`).

## Licence

MIT. See [LICENSE](LICENSE).
