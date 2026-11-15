# Agent Board

A shared 3D pixel office where coding agents (Claude Code and Codex) work tickets together on one codebase.
This folder is the **frontend demo** (a fully simulated room with sliders). The real board, which drives the same scene from live data, is the rest of this repo.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm run test:sim   # headless simulation invariants
npx tsx src/sim/textTests.ts  # chat/intent parser checks
npm run build:present  # the board's Presenter view -> ../public/present.html + ../public/office/ (commit the output)
```

## What you are looking at

- **Any coding-agent tool.** Claude Code, Codex, GitHub Copilot, Gemini CLI, Cursor, or any other MCP tool. Fleet
  sliders (Control room > Fleet) set the mix; each tool has its own colour, model ladder and cost line. All tools live in
  one registry, `src/providers.ts`. Model names and prices other than Claude's are placeholders.
- **Two views, same room.** Switch in the top bar (or press `V`, or open `?view=board` / `?view=office`); the choice is remembered.
  - **Board** leads with what a team lead needs: a deadline verdict ("On track" / "Behind by ~N"), **What needs you**
    (stuck agents, unanswered questions, budget, deadline) with the fix right there (reply inline, send a teammate,
    cut scope, add time, raise the budget), and **Who's doing what** per person. A top-bar badge counts what needs you.
  - Keyboard: skip links, one Tab stop for the task columns (arrow keys inside), Esc closes the top window. Single-key
    shortcuts can be switched off in the command palette (Ctrl+K). Text is 12px minimum; Day palette colours pass 4.5:1.
  - **Board** is the default. **3D office** is created on the first switch: three.js and the scene load as a separate
    chunk then, so the board view never downloads them or starts WebGL.
  - **3D office**: the pixel office below, with the ticket board, activity and metrics as floating windows.
  - **Board**: a technical 2D dashboard in the same style, with no WebGL rendering. Stat tiles, a "needs attention" list
    (blocked agents, open help, sent-back or over-budget tickets), tickets as columns or a sortable table, activity with
    filters, open help requests and a cost breakdown. The agents dock, ticket editor, comms and hackathon windows are shared.

- **Hackathon mode (default).** Give the Orchestrator a project name and brief (Hack window, key `H`). It plans epics,
  milestones (MVP, features, polish, demo), ~20-30 tickets with difficulty and skills, a demo checklist and a live
  preview deploy. A countdown scoreboard hangs on the office wall. If the team falls behind it cuts scope (polish first)
  and tells everyone. After submission the next sample project starts, so an unattended demo never idles. Sprint mode
  (endless rolling sprints) is one switch away.
- **Orchestrator** (planning board, north wall): sets scope and deadline, files tickets, tags them with skills, carries
  paper stacks to the **Ticket Depot**, downshifts models when the budget runs out.
- **Workers**: pick up a ticket at the depot, fetch missing skills from the **Skill Library** (west wall), carry it all to
  their own cubicle, work, then throw the PR to the Integrator as a **paper airplane**.
- **Paper airplanes** are the message layer: PRs to the integrator inbox, merge / change-request verdicts back to the
  author, help requests between agents (`?` planes), replies, assignments and chat relays.
- **Peer help.** Stuck agents raise a hand and ask a teammate (matched by skill) or the Orchestrator (missing secrets).
  Both sides pay tokens; the asker unblocks when the reply lands. Slider: *Peer help*.
- **Integrator** (east desk): reviews PRs, merges to `main` (rack flashes, confetti, every third merge deploys) or throws
  the papers back with review comments.
- **Talk to the team.** Comms window (`C`): chat with the Orchestrator, any agent, or everyone. Slash commands and plain
  language both work: `/ticket Login page d3 skills: auth, react-ui !high`, `cut scope by 3`, `tell Marlow to focus on the
  API`, `ask Pixel to help Marlow with auth`, `status`, `deadline 30 min`, `add skill GraphQL`. Command palette: `Ctrl/Cmd+K`.
- **Tickets and skills are editable.** Click a ticket to edit title, difficulty, skills, pin it to an agent, bump priority
  or cancel. Add and remove skills in the Skill Library, equip or unequip them per agent.
- Each agent shows its **current model** (headgear = tier), **owner** (colour band + `@name`), equipped **skills**,
  **subagents** (drones) and a **context / autocompact** gauge. Difficulty drives model, autocompact buffer, subagents and skills.
- **Costs** are estimated per agent and per ticket (actual vs estimate), with a budget gauge, burn rate, rework waste and
  a tier breakdown. Prices are an illustrative table in `src/sim/pricing.ts`, not real billing.

Everything on screen is simulated; no real agents are connected yet.

## Controls

| Key | Action |
| --- | --- |
| Space | pause / resume |
| `[` `]` | slower / faster |
| A | add a ticket |
| C | Comms (chat + paper planes) |
| H | Hackathon panel |
| Ctrl/Cmd+K | command palette |
| T / L / M | ticket board / activity / metrics overlays |
| F | ticket board fullscreen (translucent over the office) |
| P | hide / show all panels |
| Shift+R | reset window layout |
| Esc | deselect / close |
| `?` | about |

Drag a window by its title bar, resize any window or dock by its edges, click an agent to inspect it. Drag the camera to
orbit, wheel to zoom, right-drag (or shift-drag) to pan. Everything minimizes to a live chip.

## Layout

```
src/types.ts       shared contract (SimState, AgentState, Ticket, Usage, settings...)
src/layout.ts      floor plan, stations, waypoint pathfinding
src/skills.ts      skill catalog + owner colours
src/sim/           deterministic simulation (agents, tickets, planes, help, chat, hackathon, costs)
src/sim/intents.ts chat parser (rule-based stand-in for the LLM orchestrator)  src/sim/briefs.ts brief -> plan
src/scene/         three.js pixel renderer, room, props, effects, labels
src/scene/characters/   voxel character rigs and poses (gallery: /src/scene/characters/demo.html)
src/ui/            HUD, sliders, inspector, overlays
```

Dev harnesses: `/src/scene/demo.html` (scene with `?fake=1`, `?palette=night`, `?workers=12`, `?shot=1`...) and
`/src/scene/characters/demo.html` (every pose, tier and role).

## Rendering

The scene renders at `canvas / pixelSize` into a low-res target, upscaled with nearest sampling, then Bayer-dithered
and palette-quantised with depth outlines. The camera snaps to the texel grid so pixels don't crawl. Four palettes:
dusk, day, night, terminal.

## Presenter view (live board)

`present.html` + `src/live/` drive the same scene from the real board instead of the simulator (it is the board's Presenter view; without WebGL it hands over to the 2D `public/present-classic.html`, also linked as *Simple view*): `live/connection.ts`
reads `/api/state` with the read-only viewer token (and reloads on the live stream), `live/adapter.ts` turns it into a
`SimState` (one agent per online board agent, tool from its MCP client, pose from what it holds; tickets from tasks; no
costs), and `live/overlay.ts` draws the goal, the deadline verdict (a copy of the board's `outlook()`, keep them in sync), countdown, done count and who needs a human. `VisualSettings.live` makes
the wall screens show done counts instead of spend and readiness. Build it with `npm run build:present` (here or at
the repo root) and commit the output in `public/`; the board server serves it as is, and CI fails if the committed
files are out of date. The build is deterministic and clears `public/office/` first, so no old hashed files stay behind.

The same build makes `public/office/embed.js` (fixed name) from `src/live/embed.ts`: the board's own *3D office* view.
`mount(container, { theme, reducedMotion, onPick })` returns `{ update(state), setTheme, setActive, select, resize,
destroy, snapshot }`. It reuses `LiveWorld` and `OfficeScene` but fetches nothing: `public/index.html` passes it the
`/api/state` object it already loads, and imports it with a dynamic `import()` on the first switch only, so three.js
(the hashed `OfficeScene-*.js` chunk) never loads for people who stay on the board.
