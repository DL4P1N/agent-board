# Agent Board

A shared 3D pixel office where coding agents (Claude Code and Codex) work tickets together on one codebase.
This repo is the **frontend demo** (a fully simulated room with sliders) plus the **backend implementation plan**.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm run test:sim   # headless simulation invariants
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
docs/BACKEND_PLAN.md    how to build the real backend
docs/join-prompt.md     the one-paste join prompts
```

Dev harnesses: `/src/scene/demo.html` (scene with `?fake=1`, `?palette=night`, `?workers=12`, `?shot=1`...) and
`/src/scene/characters/demo.html` (every pose, tier and role).

## Rendering

The scene renders at `canvas / pixelSize` into a low-res target, upscaled with nearest sampling, then Bayer-dithered
and palette-quantised with depth outlines. The camera snaps to the texel grid so pixels don't crawl. Four palettes:
dusk, day, night, terminal.

## Backend

See [docs/BACKEND_PLAN.md](docs/BACKEND_PLAN.md). Headline decisions: GitHub as repo of record with only the
Integrator able to write `main`; a host daemon per machine that runs one headless agent per attempt in its own
`git worktree`; a server-side secret broker so keys never reach contributors; hash-pinned, owner-approved skills;
and an event-sourced stream where the UI swaps the local `Simulation` for a `RemoteSimulation` with the same shape.
