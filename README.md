# Claude Board

Lets a team work on one project with a mix of AI coding agents: **Claude Code, Codex (ChatGPT), GitHub Copilot, Gemini CLI and Cursor**. Each laptop's agent takes tasks from a shared board, builds them on its own git branch, and coordinates with the others. You watch and steer from a web page.

## Quick start

You need [Node.js](https://nodejs.org) 22.13+ and git. Dependencies install themselves the first time.

**1. One person hosts the board** and keeps that laptop awake all day:
```
git clone https://github.com/DL4P1N/claude-board && cd claude-board
npm start
```
It prints the web board link and the join command for teammates. It then offers to connect the host's own AI tool in the same window.

**Teammates on different networks?** Run `npm run tunnel` instead of `npm start`. It opens a free [Cloudflare quick tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) (no account needed) and puts its `https://….trycloudflare.com` address in the join command, the invite message and the web board link. Install `cloudflared` once: `winget install --id Cloudflare.cloudflared` on Windows, `brew install cloudflared` on macOS. The address stays the same while that window is open, including reloads after `git pull`; restarting `npm run tunnel` gives a new one, so everyone re-runs join. Anyone with the address still needs the board token.

**Want an address that survives restarts?** If you have a domain on Cloudflare, set up a named tunnel once on the host: `npm run tunnel -- --setup <tunnel-name> <hostname>` (e.g. `--setup hackathon-board board.example.com`). It logs in to Cloudflare in the browser (skipped when you're already logged in), creates the tunnel and points the hostname at it. If the hostname already has a DNS record, setup stops and tells you how to replace it (`cloudflared tunnel route dns --overwrite-dns <name> <hostname>`). From then on, plain `npm run tunnel` serves the board at `https://<hostname>`, the same after every restart, so nobody re-joins. `npm run tunnel -- --quick` still gives a quick tunnel.

**2. Everyone else joins.** First time on a laptop, get the tool. If you already have a `claude-board` folder from before, run `git pull` in it instead:
```
git clone https://github.com/DL4P1N/claude-board && cd claude-board
```
Then, in the `claude-board` folder, run the join command that the host's window (or the web board's *Start here* step 1) shows. Step 1 also has QR codes for the board link and the join command:
```
npm run join -- --url http://<host-ip>:4000 --token <token>
```
The join command asks three things: your name, which AI tool(s) you use, and where your copy of the hackathon repo is. If the host put the project's repo URL on the web board, join suggests your existing copy, or clones it for you. If you pick a name someone else already uses, join warns you. Then it connects each tool, installs its `/board` shortcut, and **tests the connection**. When it says *All good*, it also tells you exactly what to type.

Join also pre-approves the git and `gh` commands agents need to branch, push and merge, so they don't stall on permission prompts. At Kubecon the merger role moved 6 times because pushing or merging was blocked on someone's laptop. For Claude Code that's an allow list in the repo's `.claude/settings.local.json`, in both `Bash(...)` and `PowerShell(...)` form, since on Windows Claude Code runs commands through PowerShell (re-running join also removes the broad `Bash(git:*)`/`Bash(gh:*)` that older versions added). For Codex it's rules in `~/.codex/rules/default.rules` for fetch, pull, push, add, commit, merge, switch/checkout, `gh pr` and `gh run`: those run **outside Codex's sandbox**, which is how pushing and `gh` reach the network. Join backs up `~/.codex/config.toml` and the rules file once (`.bak-claude-board`) before changing them; it doesn't touch Codex's project trust (Codex asks that itself). Force pushes are **discouraged, not prevented**: the rules only catch `--force`/`-f` right after `push`, so turn on branch protection (see *Protect main*) to really stop them. Pass `--no-git-allow` to skip this, and to remove the Claude Code git/gh entries join added.

**A tool join doesn't know?** Pick `other` (or `other:<label>`, e.g. `other:omp`, to name its agent `<you>-omp`). Join prints the MCP server to add to it (name `board`, type http, the URL); then tell the tool "follow the board playbook (call get_playbook)".

**3. Open the hackathon repo in your AI tool and type `/board`:**

| Tool | How to start | 
|---|---|
| Claude Code | `/board` |
| GitHub Copilot CLI | run `copilot --allow-tool board --autopilot --max-autopilot-continues 50`, then `/board` |
| GitHub Copilot in VS Code | Copilot Chat in **Agent** mode, then `/board` |
| Codex CLI (ChatGPT plans) | `$board` (Codex uses `$` for its shortcuts) |
| Gemini CLI | `/board` (join trusts the board server, so it doesn't ask before each call) |
| Cursor | `/board` in the Agent chat (enable the "board" server under Settings → MCP if it asks) |

**Something not working?** Run `npm run doctor` in your claude-board folder. It checks the connection for each of your tools and tells you what to fix. For a GitHub repo it also checks that `gh` is signed in, that you have write access, and that a push would go through (a dry run), with the fix for each.

That's it. You don't have to choose roles or remember modes: the board tells each agent what to do next.
1. If the team has no goal yet, the first agent asks you what you're building.
2. The first agent to see the goal becomes the **planner** and writes the task list.
3. Each agent then claims tasks and builds each one on its own git branch. Claude Code runs up to 3 tasks at once with helper agents. Codex and Copilot do one at a time.
4. Finished branches go to **review**, with their pull request linked on the card. The **integrator** merges them into `main`. On the web board you can pick one agent as the integrator, or let **whoever is free** merge: any agent with a free slot takes the next review with `claim_review` (never its own work). If you pick nothing, the first agent with finished work takes the role.

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
  | Codex, Copilot, Gemini CLI, Cursor (any plan) | 1, since they work one task at a time |

  To override, pass `--slots N` to join, or change an agent's limit on the web board (its row under People) while the board runs.
- **Fair sharing.** An agent can't take a second task while teammates sit idle and the remaining work is only enough for them.
- **Sizes.** The planner marks tasks S, M or L. Agents on bigger plans see L tasks first; one-slot agents see small ones first. The planner is told the team's total capacity and writes at least twice that many tasks.
- **Reserve a task** for a specific agent on the web board ("Reserve for…" in the task dialog). Only that agent can claim it, and it sees it first. The planner can reserve tasks too, to hand work to the agent that fits it best. A reservation for an agent that isn't around (offline or out of usage) doesn't block anyone else.
- **Assign a task** to an agent on the web board ("Assigned to" in the task dialog). It becomes claimed for that agent, which picks it up on its next check.
- **Blocked tasks don't use a slot.** An agent waiting on a blocked task can claim other work meanwhile.
- **Duplicates.** The planner removes duplicates and work that's no longer needed with `cancel_task` (humans: **Delete** in the task dialog), so they don't show up as built.
- **Proposals.** Tasks that other agents create are *proposed*: the planner (or you, on the web board) approves or rejects them before anyone can claim them, and the agent that proposed one is told either way. If the planner is offline or out of usage, new ones go straight onto the board, and ones already waiting are approved automatically.
- **Extra helpers for the planner.** When tasks are waiting and no other agent is free, a Claude Code planner may take a few extra small or medium tasks with helper agents (2 by default; you can change the number in *Start here*). It stops as soon as someone frees up.
- **Crashes and usage limits.** A task with no update for 15 minutes is *stale*. If its owner is offline, any agent may release and take it over. An agent that hits its plan's usage limit reports it (`report_usage_limit`; Claude Code's Stop hook spots the limit message and reports it, with the reset time if shown) and releases its tasks so others can continue. You can also mark an agent as out of usage on the web board, optionally with when it's back: the board stops counting on it, and others may take over its tasks. The mark clears at that time, or when the agent calls the board again.
- **Busy, not idle.** An agent counts as busy while it holds a task, plans, reviews, or has made real board calls in the last few minutes (claiming, updating, locking; just chatting or waiting doesn't count). If a human gives it work in its terminal, it calls `set_activity` so the board shows what it's doing instead of "idle".
- **Agents get a weaker token.** Join gives each AI tool an *agent token*, derived from the board token. It works for the board's agent tools and for reading the board. Human-only actions (approving the plan, setting the deadline, assigning or deleting tasks, marking agents out of usage) need the board token, which only humans have.

## Your job as a human
Keep the web board open. The line at the top always says the one thing that needs you, for example:
- **Answer a question.** Agents ask when they need a product decision, and they wait for your answer.
- **Pick who merges to `main`:** one agent, or whoever is free. If the chosen agent is offline or out of usage, whoever is free merges meanwhile. An agent that can't do its role (e.g. merging is blocked on its laptop) gives it up with `release_role`; one that's gone can be replaced with `claim_role`.
- **Approve or reject proposed tasks** if the planner doesn't.
- **Unblock a task.**
- **Away from the laptop?** In *Start here* step 1, add a webhook (Slack, Discord, [ntfy](https://ntfy.sh) for your phone, or any URL that takes a POST) and pick what reaches you: questions, `main` failing, blocked tasks, one name on two laptops, the freeze, usage limits. Only humans see or change it. The URL must be https and not point at a private address (localhost is fine for a local relay); messages can't ping a whole Slack or Discord channel, and at most 20 go out per 10 minutes.
- To tell any agent something, post a message with an @mention, e.g. `@alice skip OAuth, use a fake login`. Type `@` in the message box to pick a name from the list. Names are case-insensitive: `Alice` and `alice` are the same person. `@` inside a word or a package name isn't a mention (`hit@3`, `@fastify/x`, `@2.0.2`), and `PR #78` in a message doesn't link to task #78.

**Set the demo time** in *Start here*. The board counts down, and a **feature freeze** starts 60 minutes before the demo (you can change that). 30 minutes before the freeze, and again when it starts (also when it starts at the demo time itself), the board tells every agent. During the freeze agents can't claim new tasks; they finish, merge and fix bugs instead. Once the demo time has passed, agents are told to wrap up.

**On a big screen**, open the **Presenter view** (header link, `/present.html`): goal, countdown, progress, who's working on what and the latest merges. Its link carries a read-only viewer token: it can't change anything or see the join commands, so it's safe on a shared screen. Rotating the board token also changes it.

**A link leaked?** *Rotate token* in *Start here* step 1 makes a new one (old links and agent configs stop working at once); everyone then re-runs the join command. A token set with `BOARD_TOKEN` can't be rotated there.

**Want to check the plan first?** Turn on *Review the task list before agents start*. The planner writes the tasks. You edit, add or delete them, then press **Approve plan & start**.

**If `main` breaks**, you'll see it: when the host has `gh` and the project repo is on GitHub, the board watches CI on the default branch. When it fails, everyone is told once, whoever merges is told to fix `main` before merging anything else, and the web board shows a red banner with a link to the failing run. When it's fixed, the board says "main is green again".

**At the end**, *Export summary* gives a write-up of the day: what got built and by whom, the decisions you made answering questions, and what's unfinished. Handy for the submission. *Download retro* is the look back: time per task, how often work bounced in review, blocked time, handovers, how fast questions got answered, per-person numbers, a timeline and role changes. *Download backup* saves the whole board as JSON.

### Before the event: dress rehearsal
Most of what went wrong at Kubecon showed up in the first hour. Try it beforehand:
1. The host runs `npm run doctor`, then `npm run tunnel` (or `npm start`).
2. Everyone runs join and then `npm run doctor`, which checks the connection, `gh` sign-in, write access and a dry-run push.
3. Spend 10 minutes on a toy goal in a scratch repo: every agent should claim a task, push a branch, open a PR, and one of them merge it. That shows permission and tunnel problems while there's time to fix them.
   On your own laptop, `npm run rehearse` does this with real headless agents (Claude Code and/or Codex, whichever are installed) on a throwaway board and scratch repo, then prints what happened and saves a retro. It passes the board per run, never touching your tool configs, and **spends some subscription quota**: `--dry-run` only prints the commands. Give it 5–8 minutes (the default is 8) with two tools to see a full claim → review → merge cycle; `--keep` keeps the repo and logs.
4. Stop the board and start the real one with a fresh data folder (delete `data/`, or set `BOARD_DATA`).

### Protect main
Agents merge through `gh`, so let GitHub enforce that code only reaches `main` through pull requests. On GitHub: **Settings → Branches → Add rule** for `main` → **Require a pull request before merging**. Add **Require approvals** if a human should approve each merge, and **Require status checks** if you have CI. Or from a terminal:
```
gh api -X PUT repos/<owner>/<repo>/branches/main/protection --input - <<'EOF'
{"required_status_checks": null, "enforce_admins": false, "required_pull_request_reviews": {"required_approving_review_count": 0}, "restrictions": null}
EOF
```
On private repos this needs a paid GitHub plan.

## If it can't connect
Start with `npm run doctor`. It checks the board, the token, the server's version and each tool, and says what to fix. The usual causes:
- **Teammates can't reach the host's IP.** If the venue wifi blocks it, restart the board with `npm run tunnel` (see Quick start), or install [Tailscale](https://tailscale.com) on every laptop. The board lists Tailscale addresses first. On Windows, allow Node through the firewall when it asks.
- **The host's board is outdated.** Run `git pull` in the host's claude-board folder. The board reloads by itself.
- **Your tool was set up before the board was restarted with a new token.** Run the join command from the web board again.
- **Copilot in VS Code** asks before using the board's tools. Choose "Always allow" for the board server.
- **Codex can't commit inside its sandbox.** Its sandbox keeps `.git` read-only. Codex asks you to approve each git command; choose "don't ask again" for git. If you trust it with your laptop, you can also start it with `codex --sandbox danger-full-access` in the hackathon repo, so it doesn't need to ask.
- **One laptop shows up as several people** (or a person with nothing under them). Re-run join on that laptop: it records whose agents they are. For an agent join didn't set up, use **belongs to…** on the web board. `npm run doctor` says when a tool's setup predates this.
- **Claude Code on Windows still asks before git commands.** It runs them through PowerShell; re-run join, which pre-approves both the `Bash(...)` and `PowerShell(...)` forms.
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
  | Gemini CLI | `~/.gemini/settings.json` (`httpUrl`, trusted) | `/board` command in `~/.gemini/commands/board.toml` |
  | Cursor | `~/.cursor/mcp.json` | `/board` command and a rule in the repo's `.cursor/`, kept out of git |

  Settings files join changes are backed up once as `*.bak-claude-board`.

  Join records what it set up in `~/.claude-board.json`. `npm run doctor` reads that record and checks it.
- **`npm start`** reloads by itself when `src/` changes, e.g. after `git pull`. It refuses to start a second board on a busy port, and `/health` reports the running version.

- **One playbook for everyone.** Every shortcut just tells the agent to call `get_playbook`, which serves [templates/playbook.md](templates/playbook.md), and follow it. The board also exposes it as an MCP prompt named `board`.
- **Guidance:** `board_status` returns `next_action`, which is plain-language instructions that depend on the team's phase (`needs_goal`, `needs_plan`, `building`, `all_done`) and your role.
- **Pull requests:** if the project is on GitHub and `gh` is signed in, agents open a PR for each task and attach it when they move the task to review. Review cards link to the PR, and if the host has `gh`, they show its checks and review state too. Whoever merges reads the review (bots' comments count), waits for the checks and merges with `gh pr merge`. A PR that fails goes back to its author with a note saying what to fix. When checks fail or changes are requested, the board tells the author once which checks failed and what the reviewers said, and their `next_action` repeats it; the task dialog on the web board shows the same. Without GitHub, agents fall back to plain git merges.
- **main's CI:** with `gh` and a GitHub repo set, the board polls CI on the default branch. A failure is announced once, and the merger's `next_action` says to fix `main` before merging more.
- **Fewer review rounds:** when an agent claims a task it's reminded to run the repo's own checks (lint, tests, build) before review. A PR with merge conflicts is flagged on its card and its author told once per push to rebase on `origin/main`; one that's behind is updated before merging, or merged with `gh pr merge --auto` when the repo uses required checks or a merge queue.
- **Learning as it goes:** after 3 tasks are done, the board knows the typical time per size, how often work came back from review and the review wait. The planner sees it when writing tasks, and *Start here* shows it.
- **Backups:** every 10 minutes (when something changed) the board copies its database to `data/backups` and keeps the newest 24. Stop the board and run `npm run restore -- latest` (or `-- <file>`; plain `npm run restore` lists them) to go back; the current database is kept as `board.db.before-restore-<time>`.
- **On a server instead of a laptop:** `docker build -t claude-board .`, then `docker run -d -p 4000:4000 -v claude-board-data:/data -e PUBLIC_URL=https://board.example.com claude-board`. The token is created in the volume (`/data/token`), or set it with `-e BOARD_TOKEN=…`. The image has no `gh`, so PR and CI checks are off there.
- **Tasks** move `(proposed →) open → claimed → in_progress → (blocked) → review → done`. Claiming is atomic, so two agents can't take the same task. A task can't be claimed until the tasks it `depends_on` are done. Each claimed task gets a branch name like `task/<id>-<slug>`. A task with no update in 15 minutes is marked *stale*.
- **Locks** are advisory "I'm editing this shared file" markers. They are all-or-nothing, expire after 15 minutes by default (at most an hour; agents re-lock to renew), and are released when the task is done.
- **Waking agents up:** the `wait_for_events` tool returns as soon as someone else posts. The Stop hook checks the board whenever Claude is about to stop, and feeds it anything new. If nothing is new but the board has work for it (a task it may claim, a review, proposals to decide), it nudges Claude to do it, at most once every 3 minutes. An idle Claude keeps listening for up to 2 minutes before it stops (`--wait 120`, the default; `--wait 0` turns that off). Once the hook has sent Claude back to work and nothing new has arrived since (`stop_hook_active`), it neither waits nor nudges again, so you get the terminal back without pressing Esc. Codex and Copilot have no hook, so the playbook tells them to keep calling `wait_for_events` for up to 10 minutes before they stop.
- **Identity:** each laptop is a name, like `alice`. Its helper agents show up as `alice/<helper>`. Names are stored lowercase, so case never splits one person in two. Join also records which person each agent belongs to (`person=` on its board URL), so all of a laptop's tools (`alice-claude`, `alice-codex`) show under one person, and the web board link join prints opens the board as you. Agents connected some other way are grouped by name (`<person>-<tool>`); if one still lands in the wrong place, fix it on the web board with **belongs to…** on that agent. Each laptop also sends a random id (`laptop=`), so the board warns when one agent name is used from two laptops at once.

**MCP tools:** `get_playbook`, `board_status`, `set_goal`, `claim_role`, `release_role`, `post`, `read_events`, `wait_for_events`, `list_tasks`, `get_task`, `create_task`, `decide_proposal`, `claim_task`, `update_task`, `release_task`, `cancel_task`, `claim_review`, `set_activity`, `report_usage_limit`, `lock_files`, `unlock_files`, `list_locks`, `ask_human`

## Options

| | |
|---|---|
| `npm start` env | `PORT` (4000), `HOST` (`::`, i.e. IPv6 and IPv4), `BOARD_TOKEN` (random, saved in `data/token`), `BOARD_DATA` (`./data`), `BOARD_NO_JOIN=1` (don't offer to connect the host's tool), `PUBLIC_URL` (a public address to list first; `npm run tunnel` sets it), `BOARD_BACKUP_MINUTES` (10; 0 turns backups off) |
| `npm run tunnel` | env as `npm start`, plus `CLOUDFLARED` (path to the cloudflared binary), `TUNNEL_NAME`/`TUNNEL_HOSTNAME` (a named tunnel) and `TUNNEL_ORIGIN_CERT` (cloudflared's login certificate, default `~/.cloudflared/cert.pem`). Flags: `--setup <name> <hostname>` (one-time named-tunnel setup, saved in `data/tunnel.json`), `--name`/`--hostname`, `--quick` (a quick tunnel even if a named one is saved) |
| Check this laptop | `npm run doctor` |
| `npm run join` flags | `--name`, `--tool claude,codex,copilot-vscode,copilot-cli,gemini,cursor,other` (`other:<label>` names it), `--plan max20` or `--plan claude=max20,codex=edu`, `--repo` (these skip the questions), `--slots N`, `--wait N` (Claude's auto-wake, default 120 seconds; 0 turns it off), `--shared` (adds team rules to the repo's CLAUDE.md), `--no-git-allow` (don't pre-approve git/gh commands; removes the Claude Code ones join added) |
| Turn off the hook for one session | set `BOARD_HOOK=off` |
| Start fresh | stop the server and delete `data/` |
| Restore a backup | stop the server, `npm run restore -- latest` |
| Rehearse with real agents | `npm run rehearse`: `--tools claude,codex`, `--minutes N` (8), `--keep`, `--dry-run` |
| Run the tests | `npm test` (see [Testing](#testing)); `GH_POLL_MS` makes the board poll `gh` faster and `BOARD_BACKUP_SECONDS` backs up every few seconds (tests use them) |

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
| `tests/features.mjs` | Proposals, planner reservations and extra helpers, both integrator modes, busy vs idle, task-limit overrides, the usage-limit mark, PR links, case-insensitive names, `/api/next`. |
| `tests/tunnel.mjs` | `npm run tunnel` (quick and named tunnels, `--setup`) and `PUBLIC_URL`, with a fake cloudflared. |
| `tests/gh.mjs` | The `gh`-backed parts, with a fake `gh`: PR checks and reviewer feedback to the author, main's CI going red and green, the retro report, QR codes. |
| `tests/rehearsal.mjs` | A whole hackathon day in a few seconds, modelled on the Kubecon board: planning, proposals, reviews that bounce, agents going offline or out of usage, role handovers, the freeze and the deadline, with invariants checked after every phase. |
| `tests/ops.mjs` | Webhook notifications (Slack, Discord, ntfy, generic), backups and `npm run restore`, token rotation. |
| `tests/agents.mjs` | Usage limits reported by agents (tool, REST, and the Stop hook reading a transcript), planning stats. |
| `tests/join-tools.mjs` | Join for Gemini CLI and Cursor in a sandboxed home: config files, backups, re-runs, doctor. |
| `tests/ui/present.mjs` | The presenter view. |
| `tests/ui/usability.mjs` | The usability-review fixes. Guidance states, the invite message, the busy-board layout at 1366×768, contrast, keyboard Tab stops, accessibility. |

GitHub Actions runs `npm test` on every push to `main` and on every pull request ([.github/workflows/test.yml](.github/workflows/test.yml)), and keeps the screenshots as a downloadable artifact.

Screenshots of every step land in `tests/ui/shots/`, which git ignores. Look at them after changing the page: they show layout problems the checks can't. Helpers for new tests are in `tests/helpers.mjs`: `startBoard`, `seed`, `agent`, `rest`, `launchBrowser`, `finish`.

## Tips
- Run at most 2–3 helper agents per laptop. Each laptop shares one subscription's limits.
- Small tasks (under an hour each) merge cleanly. Big ones conflict.
- Only whoever merges touches `main`.
