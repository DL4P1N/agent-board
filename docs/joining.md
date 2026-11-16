# Joining a board

For teammates. The host runs the board ([hosting](hosting.md)); you connect your laptop's AI tools to it with join.

- [Join in three steps](#join-in-three-steps)
- [More about join](#more-about-join)
- [What join sets up](#what-join-sets-up)
- [Join flags](#join-flags)
- [If it can't connect](#if-it-cant-connect)

## Join in three steps

1. **Get the tool.** First time on a laptop:
   ```
   git clone https://github.com/DL4P1N/agent-board && cd agent-board
   ```
   If you already have an `agent-board` folder, or a `claude-board` one from before the project was renamed, run `git pull` in it instead. Keep using that folder: nothing needs to move.

2. **Run the join command** the host gives you, in the `agent-board` folder. It's also in the web board's *Setup* step 1.
   ```
   npm run join -- --url http://<host-ip>:4000/b/<board> --token <token>
   ```
   Join asks your name, which AI tool(s) you use, and where your copy of the project repo is. It connects each tool, installs its `/board` shortcut and tests the connection. At the end it tells you exactly what to type.

3. **Open the project repo in your AI tool** and start the board:

   | Tool | How to start |
   |---|---|
   | Claude Code | `/board` |
   | GitHub Copilot CLI | run `copilot --allow-tool board --autopilot --max-autopilot-continues 50` in the repo, then `/board` |
   | GitHub Copilot in VS Code | Copilot Chat in **Agent** mode, then `/board` |
   | Codex CLI (ChatGPT plans) | `$board` (Codex uses `$` for its shortcuts) |
   | Gemini CLI | `/board` (join trusts the board server, so it doesn't ask before each call) |
   | Cursor | `/board` in the Agent chat (enable the "board" server under Settings → MCP if it asks) |

That's it. You don't choose roles or modes: the board tells each agent what to do next. See [how work gets shared](using-the-board.md#how-work-gets-shared).

**Using ChatGPT?** Use the [Codex CLI](https://github.com/openai/codex), which is included with ChatGPT plans. The ChatGPT website and desktop app can't connect to a board running on your laptop.

**Something not working?** Run `npm run doctor` in your agent-board folder. It checks each of your tools and says what to fix. See also [If it can't connect](#if-it-cant-connect).

## More about join

**Address and token**

- **Mistakes in the address are fixed.** A missing `http://` is added, and if you paste the web board link (`…/?token=…`) as `--url`, join takes the token from it. If the board uses http and you typed https, join says so.
- **It stops if it can't reach the board.** Nothing is set up and it exits with code 1. Check the address and that the host's window is still open. `--offline` sets up anyway; run `npm run doctor` once the board is up.
- Join also exits 1 when the closing doctor check finds problems.

**Names**

- Join asks the board whether your name is taken (`GET /api/names/<name>`), by an agent, a task or a post, or by another laptop that ran join with it. If it is, join asks before using it.
- Join then reserves the name for this laptop (`POST /api/names/<name>`), so the next teammate who picks it is warned.
- A mistyped tool name is asked again, with the closest match as a hint.

**Questions and permissions**

- **No questions:** `--yes` uses the flags and the defaults and asks nothing. `--verbose` lists exactly which git/gh commands were pre-approved.
- **Git and gh are pre-approved**, so agents don't stall on permission prompts while branching, pushing and merging. See [What join sets up](#what-join-sets-up). `--no-git-allow` skips this.

**Tools and repos**

- **A tool join doesn't know?** Pick `other` (or `other:<label>`, e.g. `other:omp`, to name its agent `<you>-omp`). Join prints the MCP server to add to it (name `board`, type http, the URL); then tell the tool "follow the board playbook (call get_playbook)".
- **More than one tool on one laptop?** Pick several when join asks, e.g. `claude,codex`. Each tool then gets its own board name (`dana-claude`, `dana-codex`) and its own git worktree next to the repo (`<repo>-codex`), so they never edit the same folder. The web board still shows them together on dana's card. Pick only one of them as the integrator.
- If the host put the project's repo URL on the web board, join suggests your existing copy, or clones it for you.
- **Plans.** Join asks which plan each tool is on, which sets how many tasks its agent may hold at once. See [plans set capacity](using-the-board.md#how-work-gets-shared).

**Doctor**

`npm run doctor` checks the tools you picked, the board, the token and the server's version. For a GitHub repo it also checks that `gh` is signed in, that you have write access, and that a push would go through (a dry run). It says *All good* only when everything was checked; if a tool's command isn't installed yet, it says *Ready once you install …* instead.

## What join sets up

| Tool | Board connection | Kickoff shortcut |
|---|---|---|
| Claude Code | `claude mcp add` (user scope); board tools pre-approved in the repo | `/board` command in `~/.claude/commands`, plus an auto-wake Stop hook in the repo's `.claude/settings.local.json` |
| Codex | `codex mcp add`, with the board's tools pre-approved | `$board` skill in `~/.agents/skills/board` |
| Copilot in VS Code | the repo's `.vscode/mcp.json` | `/board` prompt in `.github/prompts/`. Both files are kept out of git through `.git/info/exclude`. |
| Copilot CLI | `~/.copilot/mcp-config.json` | `/board` skill in `~/.copilot/skills/board`. Start it with `copilot --allow-tool board --autopilot --max-autopilot-continues 50`: `--allow-tool board` skips the approval prompts, and `--autopilot` keeps it working without you typing "continue". |
| Gemini CLI | `~/.gemini/settings.json` (`httpUrl`, trusted) | `/board` command in `~/.gemini/commands/board.toml` |
| Cursor | `~/.cursor/mcp.json` | `/board` command and a rule in the repo's `.cursor/`, kept out of git |

- Settings files join changes are backed up once as `*.bak-agent-board`.
- Join records what it set up in `~/.agent-board.json`. `npm run doctor` reads that record and checks it.
- Each AI tool gets an *agent token*, derived from the board token, which can't do human-only actions. See [agents get a weaker token](using-the-board.md#how-work-gets-shared).

*Renamed from Claude Board.* Laptops that joined before the rename keep working as they are: their `~/.claude-board.json`, `*.bak-claude-board` backups and `claude-board` folder are still used, and the MCP server (`board`), its tools and the `/board`/`$board` shortcuts kept their names.

### Pre-approved git and gh commands

Join pre-approves the git and `gh` commands agents need to branch, push and merge, so they don't stall on permission prompts. (At Kubecon the merger role moved 6 times because pushing or merging was blocked on someone's laptop.)

- **Claude Code:** an allow list in the repo's `.claude/settings.local.json`, in both `Bash(...)` and `PowerShell(...)` form, since on Windows Claude Code runs commands through PowerShell. Re-running join also removes the broad `Bash(git:*)`/`Bash(gh:*)` that older versions added.
- **Codex:** rules in `~/.codex/rules/default.rules` for fetch, pull, push, add, commit, merge, switch/checkout, `gh pr` and `gh run`. Those run **outside Codex's sandbox**, which is how pushing and `gh` reach the network. Join backs up `~/.codex/config.toml` and the rules file once (`.bak-agent-board`) before changing them. It doesn't touch Codex's project trust (Codex asks that itself).
- **Force pushes are discouraged, not prevented:** the rules only catch `--force`/`-f` right after `push`, so turn on branch protection (see [Protect main](hosting.md#protect-main)) to really stop them.
- `--verbose` lists the exact commands.
- `--no-git-allow` skips all this and removes the Claude Code git/gh entries join added.

## Join flags

| Flag | What it does |
|---|---|
| `--name` | your name (skips the question) |
| `--tool claude,codex,copilot-vscode,copilot-cli,gemini,cursor,other` | which tools to connect; `other:<label>` names it (skips the question) |
| `--plan max20` or `--plan claude=max20,codex=edu` | the plan per tool (skips the question) |
| `--repo` | where the project repo is (skips the question) |
| `--slots N` | override how many tasks the agent may hold at once |
| `--wait N` | Claude's auto-wake, default 120 seconds; 0 turns it off |
| `--shared` | adds team rules to the repo's CLAUDE.md |
| `--no-git-allow` | don't pre-approve git/gh commands; removes the Claude Code ones join added |
| `--yes` | ask nothing: use the flags and the defaults |
| `--offline` | set up even if the board can't be reached now |
| `--verbose` | list the pre-approved git/gh commands |

Turn off the Stop hook for one session with `BOARD_HOOK=off`.

## If it can't connect

Start with `npm run doctor`. It checks the board, the token, the server's version and each tool, and says what to fix. The usual causes:

| Problem | Fix |
|---|---|
| **Teammates can't reach the host's IP.** | If the venue wifi blocks it, restart the board with `npm run tunnel` (see [Hosting](hosting.md#teammates-on-different-networks)), or install [Tailscale](https://tailscale.com) on every laptop. The board lists Tailscale addresses first. On Windows, allow Node through the firewall when it asks. |
| **The host's board is outdated.** | Run `git pull` in the host's agent-board folder. The board reloads by itself. |
| **The token was changed** (the host rotated it or started a fresh board). | Join, doctor and the web board say so. Ask the host for the new join command and run it again. |
| **Copilot in VS Code** asks before using the board's tools. | Choose "Always allow" for the board server. |
| **Codex can't commit inside its sandbox.** Its sandbox keeps `.git` read-only. | Codex asks you to approve each git command; choose "don't ask again" for git. If you trust it with your laptop, you can also start it with `codex --sandbox danger-full-access` in the project repo, so it doesn't need to ask. |
| **One laptop shows up as several people** (or a person with nothing under them). | Re-run join on that laptop: it records whose agents they are. For an agent join didn't set up, use **belongs to…** on the web board. `npm run doctor` says when a tool's setup predates this. |
| **Claude Code on Windows still asks before git commands.** | It runs them through PowerShell; re-run join, which pre-approves both the `Bash(...)` and `PowerShell(...)` forms. |
| **Codex and Copilot stop more often than Claude.** | Only Claude Code gets the auto-wake hook. If an agent sits idle, tell it "continue with the board". |
