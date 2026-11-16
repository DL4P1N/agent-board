# Testing

```
npm test                 # everything (about 2 minutes)
npm test -- journey      # only suites whose file name contains "journey"
```

- Each suite starts its own throwaway board on a free port with an empty data folder, so nothing needs to be running and your real board is never touched.
- `GH_POLL_MS` makes the board poll `gh` faster and `BOARD_BACKUP_SECONDS` backs up every few seconds. The tests use them.

## Browser suites

The browser suites drive a real **Chrome or Edge** in the background through `puppeteer-core`, which is installed automatically on the first `npm test`.

- If your browser is somewhere unusual, set `BROWSER_PATH=/path/to/chrome`.
- Chrome is preferred.
- If the tests fall back to Edge on Windows, its background pages show up in Alt+Tab as "Agent Board" entries while the tests run. That's harmless; to hide them, go to Settings → System → Multitasking and stop showing app tabs in Alt+Tab.

Screenshots of every step land in `tests/ui/shots/`, which git ignores. Look at them after changing the page: they show layout problems the checks can't.

## Suites

### Agent side and server

| File | What it covers |
|---|---|
| `tests/smoke.mjs` | Agent side, over MCP. Atomic claims, dependencies, locks, task ownership, `wait_for_events`, `ask_human`. Point it at a running board with `BOARD_URL=… BOARD_TOKEN=… node tests/smoke.mjs`. |
| `tests/features.mjs` | Proposals, planner reservations and extra subagents, both integrator modes, busy vs idle, task-limit overrides, the usage-limit mark, PR links, case-insensitive names, `/api/next`. |
| `tests/capacity.mjs` | Agent-side rules: plan capacity, fair sharing, reservations, sizes, stale takeover, freeze exceptions, ownership, input checks, lock coverage, agent-token limits. |
| `tests/guidance.mjs` | `next_action` and refusal texts: the planner brief, blocked tasks and slots, reviews, the planner's slot count, a self-reported usage limit, sizes, claim refusals. |
| `tests/helpers-subagents.mjs` | Subagents (passing `as`): recorded on their first call, own model, `subagent_done`, the idle window, `presence[].helpers` in `/api/state`. |
| `tests/agents.mjs` | Usage limits reported by agents (tool, REST, and the Stop hook reading a transcript), planning stats. |
| `tests/name-clash.mjs` | One agent name on two laptops, and join's name check and reservation. |
| `tests/rehearsal.mjs` | A whole day of work in a few seconds, modelled on the Kubecon board: planning, proposals, reviews that bounce, agents going offline or out of usage, role handovers, the freeze and the deadline, with invariants checked after every phase. |
| `tests/gh.mjs` | The `gh`-backed parts, with a fake `gh`: PR checks and reviewer feedback to the author, main's CI going red and green, the retro report, QR codes. |
| `tests/ops.mjs` | Webhook notifications (Slack, Discord, ntfy, generic), backups and `npm run restore`, token rotation. |
| `tests/retro.mjs` | Retro, summary and the freeze webhook: still-blocked time, review credit, plurals, readable statuses, the freeze announced when its time changes. |
| `tests/token-deadline.mjs` | Token rotation errors (MCP and REST say why), the demo time (no past times; passing it wakes waiting agents), the startup banner and the host-join prompt. |
| `tests/boards.mjs` | Several boards on one server: separate data and tokens, `/b/<board>/` links, the admin API, archive/restore/default/delete, `npm run boards`. |
| `tests/themes.mjs` | The generated theme blocks are current on every page, each theme has a room, base colours pass 4.5:1. |

### Join, doctor and tunnel

| File | What it covers |
|---|---|
| `tests/join-ux.mjs` | Join's questions and mistakes in a sandboxed home: an unreachable board, address typos, name clashes, tool typos, plan and repo questions, exit codes. |
| `tests/join-tools.mjs` | Join for Gemini CLI and Cursor in a sandboxed home: config files, backups, re-runs, doctor. |
| `tests/join-boards.mjs` | Join, doctor, the Stop hook and restore against a board that isn't the default. |
| `tests/doctor.mjs` | `npm run doctor` in a sandboxed home: it checks the tool you picked, re-shows the "other" address, says *All good* only when it is, and explains a rotated token. |
| `tests/tunnel.mjs` | `npm run tunnel` (quick and named tunnels, `--setup`) and `PUBLIC_URL`, with a fake cloudflared. |

### Web board (browser)

| File | What it covers |
|---|---|
| `tests/ui/journey.mjs` | A newcomer's whole path on an empty board: joining the page, the setup guide, the planner, building, finishing. |
| `tests/ui/flows.mjs` | Everyday use on a realistic board. Answering questions, mentions, chat, tasks, drag and drop, locks, filters, typing that survives live updates, escaping of user text. |
| `tests/ui/multi-tool.mjs` | Claude Code, Codex and Copilot on one board, with one person's several tools grouped together. |
| `tests/ui/verdict.mjs` | The deadline verdict in the top bar's Demo chip and the extra *Needs attention* signals (P3 tasks that won't make it, review backlog, sent back twice). |
| `tests/ui/tasks-view.mjs` | Task search, the Columns / Table view, and the Problems / Merges feed tabs. |
| `tests/ui/cancel.mjs` | Cancelling a task from its dialog (human-only), and the tool colour dots. |
| `tests/ui/delete.mjs` | Deleting a task from the task dialog, and what happens to tasks that depended on it. |
| `tests/ui/capacity-ui.mjs` | Capacity on the web board: plans and slots, team capacity, task size, reservations, stale tasks, server errors shown inline. |
| `tests/ui/deadline.mjs` | Demo time and feature freeze, plan approval, desktop notifications, the write-up and backup export. |
| `tests/ui/feed.mjs` | The feed and composer: board actions as status lines, *Load earlier activity*, long posts clamped, mentions, "someone saved over you", the webhook field, the invite and QR code. |
| `tests/ui/header.mjs` | The header, connection state, *Needs attention*, *Setup* and the online count. |
| `tests/ui/people.mjs` | The Agents panel: stable person colours, one row per agent by its own name, its state in words, *Belongs to*, availability in the Reserve-for and Assign-to lists. |
| `tests/ui/palette-theme.mjs` | The themes and the theme chooser (keyboard grid, Auto by the OS, old saved values), a contrast scan of every visible text in every theme, and the Ctrl+K command palette. |
| `tests/ui/usability.mjs` | The usability-review fixes. Guidance states, the invite message, the busy-board layout at 1366×768, contrast, keyboard Tab stops, accessibility. |
| `tests/ui/a11y.mjs` | Accessibility and phone checks: live announcements, one Tab stop per column, 12px minimum text, no header badge row on a phone, the header's Chat button on a phone, 32px touch targets. |
| `tests/ui/boards.mjs` | The Boards page and a board served under `/b/<board>/` in a real browser. |

### Presenter and 3D office (browser)

| File | What it covers |
|---|---|
| `tests/ui/present.mjs` | The classic (2D) presenter view. |
| `tests/ui/office-present.mjs` | The 3D presenter view: live overlay and adapted office state, live updates, themes, reduced motion, the WebGL fallback. |
| `tests/ui/office-toggle.mjs` | The board's Board / 3D office switch: Board by default with nothing 3D loaded, the office loading on first switch, live state in the scene, answering from it, the agent card, saved choice and `?view=`, phones, no WebGL, the header staying one row. |

## Writing tests

Helpers for new tests are in `tests/helpers.mjs`: `startBoard`, `seed`, `agent`, `rest`, `launchBrowser`, `finish`.

## CI

GitHub Actions runs `npm test` on every push to `main` and on every pull request ([.github/workflows/test.yml](../.github/workflows/test.yml)), and keeps the screenshots as a downloadable artifact.

It also builds and simulates `office/`, and fails if the committed presenter build (`public/present.html`, `public/office/`) differs from a fresh `npm run build:present`.
