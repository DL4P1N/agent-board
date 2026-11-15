# Port plan: demo ideas into the real board

Source: the UI/UX review of the `office/` demo (carry / leave-behind list) and a read of what
`public/index.html` and the server already do. Written 2026-11-14. Status: slices 1-8 below are all done (each has its own suite in `tests/ui/`), and so are the 3D presenter and the 3D office view on the board.

## What the real board already has

Several "carry" items are already in the real board, often in better shape than in the demo:

| Review item | Real board today |
|---|---|
| "Needs you" + inline answers | `renderNow()` ranks what holds agents up; `renderQuestions()` has inline Answer boxes (`POST /api/questions/:id/answer`); `.needs` header badges |
| Who's doing what, per person | `renderPeople()` groups agents under their person, with tool chips, "N active", last seen, doing |
| Tool chips for mixed fleets | `toolChip()` from the MCP `client` string; `tests/ui/multi-tool.mjs` |
| Keyboard / screen readers | Skip links, one Tab stop per column with arrows, `#announcer` / `#activity-live`, `patch()` keeps focus and typed text |
| Night/Day pair | Auto via `prefers-color-scheme`, plus `prefers-contrast` and reduced motion |
| Task editor | `<dialog id=task-dlg>`: title, description, P1–P3, size, status, reserve, assignee, delete with confirm |

So the port is smaller than the carry list suggests. Don't rebuild these; extend them.

## Slices, in order (all done)

Each slice is one commit, client-only unless it says otherwise, with a test in `tests/ui/` and
existing ids/classes/text kept stable (tests assert on `#filter`, `.qcard`, `.card`, the clock wording).

1. **Deadline verdict.** *Done* (`tests/ui/verdict.mjs`). Biggest gap: the board shows a countdown but never says whether we'll make it.
   - Compute on the client from data already in `/api/state`: open tasks by `size` × `stats.minutes`
     (median per size) ÷ busy-able agent slots from `presence`, against time to freeze from `time`.
   - Show "On track", "Tight" or "Behind by ~N tasks" in the clock pill, with the countdown as detail.
     Until `stats` exists (fewer than 3 done) say "Not enough finished tasks to estimate yet".
   - When behind, add a "What to do now" item: "N P3 tasks probably won't make it", linking to them.
     No auto-cut: the human moves or deletes them.
   - Port the logic from `office/src/ui/attention.ts` `outlook()`, keeping the "cut at most half" cap.
2. **More "needs you" signals** *(done, `tests/ui/verdict.mjs`)* in `renderNow()`: agents at their usage limit (`limited`),
   review backlog (4+ in review), tasks rejected twice or more (count rejects from task history).
   Header badge click scrolls to the panel.
3. **Task text filter + table view.** *Done (`tests/ui/tasks-view.mjs`).* Search box next to `#filter` (title, id, assignee).
   A "Columns | Table" toggle; the table is sortable by status, priority, size, assignee, age.
   Kanban stays the default; choice saved in `localStorage`.
4. **Activity filters.** *Done (`tests/ui/tasks-view.mjs`).* Add "Problems" (blocked, rejected, usage limit, conflicts) and
   "Merges and reviews" next to All / Chat / @me. Derived from `kind` + `data.status` on
   `task_updated` events; no server change.
5. **Cancel in the task editor** (small server change). *Done (`tests/ui/cancel.mjs`).* `board.cancelTask` exists but is MCP-only.
   Add a human-only `POST /api/tasks/:id/cancel {reason}` and a "Cancel task" button with a reason,
   distinct from Delete (cancel keeps history and notifies the assignee).
6. **Theme switch + contrast.** *Done (`tests/ui/palette-theme.mjs`).* Auto / Light / Dark via `html[data-theme]`, saved per browser.
   Run the demo's contrast check over both themes; everything 4.5:1 or better.
7. **Tool colour dots.** *Done (`tests/ui/cancel.mjs`).* Give `toolChip()` a fixed colour per known client
   (Claude Code, Codex, Copilot, Gemini CLI, Cursor, other), using the demo's palette in
   `office/src/providers.ts`, including the day variants. A dot only, so it never competes with
   the per-person hue.
8. **Ctrl+K palette.** *Done (`tests/ui/palette-theme.mjs`).* Jump to task or person, new task, answer the oldest question, set the deadline,
   switch filter or view. Commands map to existing UI actions only. Keep the existing `N`, `?`, `/`
   shortcuts (all guarded while typing); add no new single-key ones.

## Needs a decision first (needs new data from agents)

- **Cost per task / rework waste.** The server records no tokens or cost. It would need an
  optional usage report from agents (an MCP tool or a field on `update_task`), and most clients
  can't report it reliably. Recommendation: skip unless you want it for the event.
- **Per-agent model, context gauge, skills.** Same problem: none of it is recorded.
  `model` could come from the agent at join time cheaply; context usage can't.
- **Difficulty and skills on tasks.** Not in the schema. `size` already covers most of difficulty.
- **3D office as a presenter screen.** Done: `public/present.html` is the 3D office over `/api/state`
  (built by `npm run build:present` from `office/present.html` + `office/src/live/`, committed, CI-checked), with the
  2D page kept as `public/present-classic.html` for browsers without WebGL. Later the same scene became a second view on the board itself (`public/office/embed.js`, see `office/README.md`).

## Leave behind

The demo control room (scenarios, sliders, sim clock, Restart/Reset), its four fixed palettes (the board got its own theme set instead),
floating draggable windows and minimised chips, single-key shortcuts beyond the existing three,
the room-code invite (keep link + `/board`), 8–10 px uppercase
monospace body text, illustrative pricing.
