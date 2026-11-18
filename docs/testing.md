# Testing

```
npm test                 # everything (about 10 minutes on a laptop, 7-8 on CI)
npm test -- journey      # only suites whose file name contains "journey"
```

- Each suite starts its own throwaway board on a free port with an empty data folder, so nothing needs to be running and your real board is never touched. A board counts as started only when its `/health` answers with its own process id, so two test runs at once don't mix up their boards.
- Each suite runs in its own temp folder. A suite fails if it leaves anything there (a data folder, a browser profile, a hook's cursor file), or if it runs longer than `SUITE_TIMEOUT_MS` (8 minutes by default; then it is stopped with everything it started). A suite that crashes still stops its boards and browsers and deletes its temp folders, and is reported as `CRASH`.
- `GH_POLL_MS` makes the board poll `gh` faster and `BOARD_BACKUP_SECONDS` backs up every few seconds. The tests use them.

## Browser suites

The browser suites drive a real **Chrome or Edge** in the background through `puppeteer-core`, which is installed automatically on the first `npm test`.

- If your browser is somewhere unusual, set `BROWSER_PATH=/path/to/chrome`.
- Chrome is preferred.
- If the tests fall back to Edge on Windows, its background pages show up in Alt+Tab as "Agent Board" entries while the tests run. That's harmless; to hide them, go to Settings → System → Multitasking and stop showing app tabs in Alt+Tab.
- The browser always has a mouse, as on CI (`(pointer: fine)` and `(hover: hover)`), also on a laptop with a touch screen, so the size checks bite the same everywhere. `launchBrowser` makes sure of that (Chrome would otherwise report the machine's own pointer after any `setViewport`). A suite tests touch with `setViewport({ …, hasTouch: true })`: `tests/ui/a11y.mjs` does, on a phone and on a desktop-sized touch screen.
- Wait for what the page shows (`page.waitForFunction`, an `until` helper) rather than a fixed sleep: a busy machine or CI runner is slower than yours.

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
| `tests/direct.mjs` | Direct messages: hidden from other agents (`read_events`, `wait_for_events`, `/api/events`, the stream, the presenter), replies with `post(to)`, `next_action` and the Stop hook, the planner thread before and after there is a planner, `@planner` / `@merger`, summary, export, never to webhooks. |
| `tests/agents.mjs` | Usage limits reported by agents (tool, REST, and the Stop hook reading a transcript), planning stats. |
| `tests/name-clash.mjs` | One agent name on two laptops, and join's name check and reservation. |
| `tests/race.mjs` | Concurrency: 24 agents on their own MCP connections claim one task at the same moment (8 rounds: exactly one winner, the board agrees, the others are told who has it), race for a pool of 10 tasks (no task with two holders, nobody over its limit), the planner role and one file lock. `tests/smoke.mjs` has the two-agent version. |
| `tests/rehearsal.mjs` | A whole day of work in a few seconds, modelled on the Kubecon board: planning, proposals, reviews that bounce, agents going offline or out of usage, role handovers, the freeze and the deadline, with invariants checked after every phase. |
| `tests/gh.mjs` | The `gh`-backed parts, with a fake `gh`: PR checks and reviewer feedback to the author, main's CI going red and green, the retro report, QR codes. |
| `tests/ops.mjs` | Webhook notifications (Slack, Discord, ntfy, generic), backups and `npm run restore`, token rotation. |
| `tests/limits.mjs` | Rate and concurrency limits: the token bucket on a fake clock (refill, `Retry-After`, the cap, 0 for off), and over the network: an agent or an address calling in a loop gets 429 with `Retry-After` and a message it can act on (REST and MCP), while other agents and humans stay served; open waits capped per agent and in total, and freed when they close. |
| `tests/webhook.mjs` | Webhook safety without a board: private addresses (also IPv4-mapped, NAT64 and 6to4 forms), each name resolved once and checked, the request pinned to the checked address when DNS answers differently later, redirects not followed. |
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
| `tests/ui/flows.mjs` | Everyday use on a realistic board. Answering questions, mentions, chat, tasks, Done opening (the other cards glide), drag and drop and Move… (also in the 3D Tasks window), locks, filters, typing that survives live updates, escaping of user text. |
| `tests/ui/multi-tool.mjs` | Claude Code, Codex and Copilot on one board, with one person's several tools grouped together. |
| `tests/ui/verdict.mjs` | The deadline verdict in the top bar's Demo chip and the extra *Needs attention* signals (P3 tasks that won't make it, review backlog, sent back twice). |
| `tests/ui/tasks-view.mjs` | Task search and the Columns / Table view. |
| `tests/ui/layout.mjs` | Layout on the demo board with a mouse, in both views: three columns and the 3D switch from 1280px, the Tasks panel and its columns in the same place with 3D on and off, the docked height (up to 65% of the room), every agent on one line, Activity's four filters, the feed above the composer, chip and title bar heights, popover gaps, inset focus rings, high contrast and Light's raised rows. |
| `tests/ui/live.mjs` | What a live event does to the page (a chat message drawn from its stream event without loading the board, the feed's lines kept, a late older load not overwriting a newer one, nothing drawn while the tab is hidden), sending once on a double Enter, typing kept while sending, the task dialog's #refs and Escape, Undo after an agent took the task, Reject and its Escape, focus after Undo, Reject, a folded title bar and the 3D switch, Ctrl+K's count and focus, Skip to tasks in the Table view, a second tab following the folds, the feed's words and links, headings and roles. |
| `tests/ui/cancel.mjs` | Cancelling a task from its dialog (human-only), and the tool colour dots. |
| `tests/ui/delete.mjs` | Deleting a task from the task dialog, and what happens to tasks that depended on it. |
| `tests/ui/capacity-ui.mjs` | Capacity on the web board: plans and slots, team capacity, task size, reservations, stale tasks, server errors shown inline. |
| `tests/ui/deadline.mjs` | Demo time and feature freeze, plan approval, desktop notifications, the write-up and backup export. |
| `tests/ui/direct.mjs` | The *Direct* tab in both views: the thread list, an agent's *Message* button, sending, unread replies, drafts kept apart from the chat, the planner thread, contrast in every theme. |
| `tests/ui/feed.mjs` | The feed and composer: board actions as status lines, *Load earlier activity*, long posts clamped, mentions, "someone saved over you", the webhook field, the invite and QR code. |
| `tests/ui/header.mjs` | The header, connection state, *Needs attention*, *Setup* and the online count. |
| `tests/ui/people.mjs` | The Agents panel: stable person colours, one row per agent by its own name, its state in words, *Belongs to*, availability in the Reserve-for and Assign-to lists. |
| `tests/ui/palette-theme.mjs` | The themes and the theme chooser (keyboard grid, Auto by the OS, old saved values, a new theme in one frame, the chooser's fade), a contrast scan of every visible text in every theme, and the Ctrl+K command palette. |
| `tests/ui/usability.mjs` | The usability-review fixes. Guidance states, the invite message, the busy-board layout at 1366×768, contrast, keyboard Tab stops, accessibility. |
| `tests/ui/hostile.mjs` | Hostile text: HTML, script tags, attribute breakouts and `javascript:` links in every field an agent controls (titles, descriptions, notes, branch, PR link, chat and channel, questions, activity, tool and model, subagent names, locks, limits, the goal). Nothing runs or renders as HTML in the plain board, the 3D office, the classic and the 3D presenter. The security headers (CSP). |
| `tests/ui/a11y.mjs` | Accessibility and phone checks: live announcements, one Tab stop per column, 12px minimum text, no header badge row on a phone, the header's Chat button on a phone, 32px touch targets on a phone and on a desktop-sized touch screen (the touch pass: every other suite has a mouse). |
| `tests/ui/boards.mjs` | The Boards page and a board served under `/b/<board>/` in a real browser. |

### Presenter and 3D office (browser)

| File | What it covers |
|---|---|
| `tests/ui/present.mjs` | The classic (2D) presenter view. |
| `tests/ui/office-present.mjs` | The 3D presenter view: live overlay and adapted office state, live updates, themes, reduced motion, the WebGL fallback. |
| `tests/ui/office-toggle.mjs` | The live 3D office behind the board and the header's 3D switch: on by default with the task board docked (also when the switch turns it on), the top bar at the top between the side columns, the switch moving nothing (one Tasks panel, its columns in the same place in both views, one `--edge` and one `--gutter` in both views, both side columns ending at the same height, Setup with the panels' title bar), the top bar's popovers as glass, Tab through them, Shift+Tab back to the chip and closing when focus leaves them (and at once with reduced motion), focus rings inside scrolling lists, `/` with Activity folded, Columns and Table both Tab stops, the slide down to expanded and back (one board, no copy; Ctrl+K's expand and dock; expanded remembered across a reload), File locks taking its room from Activity, not Agents, in both views (on a board with a full team), Setup staying open across the switch, folded title bars (every panel folding and opening as one motion, the others in its column in step, no snap at the end, a click on the title opens it, instant with reduced motion), the switch's one-frame change (no fade), frame rates, no drawing while the tab is hidden, live state in the scene, answering from it, the agent card, 3D off (nothing loaded), the saved choice and `?view=`, reduced motion, phones and windows under 1280px wide (the plain board in two columns, the saved choice kept), no WebGL (on CI, where Chrome has SwiftShader, missing WebGL fails the suite instead of skipping the 3D checks), the header staying one row. Other suites open pages with 3D off (the test helper's default; `launchBrowser({ office: true })` keeps it on). |

## Writing tests

Helpers for new tests are in `tests/helpers.mjs`: `startBoard`, `seed`, `agent`, `rest`, `launchBrowser`, `finish`.

## CI

GitHub Actions runs `npm test` on every push to `main` and on every pull request ([.github/workflows/test.yml](../.github/workflows/test.yml)), and keeps the screenshots as a downloadable artifact.

It also builds and simulates `office/`, and fails if the committed presenter build (`public/present.html`, `public/office/`) differs from a fresh `npm run build:present`.
