# Prompt: polish the Agent Board web UI

Polish Agent Board's web UI until it feels crafted, calm and clear: one consistent design system, careful typography,
quiet motion, and screens that explain themselves. Keep every feature and behaviour.

## Use the design skills

Read these skills from the Kubecon repo (`DL4P1N/Kubecon-2026`, `.claude/skills/`) before changing anything, and
follow them:

- **design-taste-frontend:** one system rather than one-off styles, plain copy in a consistent voice, equal edges,
  one or two deliberate moments per page rather than effects everywhere, quiet micro-interactions, and its checker and
  finish gate. Run its checks in a real browser before calling the work done.
- **apple-design:**
  - feedback for every action, spatial consistency and restraint
  - motion that can be interrupted and feels physical
  - typography: optical sizes, tracking, leading
  - depth used sparingly, and proper reduced-motion behaviour
- **stageshow:** read it only for how it makes small UI read clearly at a glance.

## Scope

- **`public/index.html`**, the main board:
  - the header and the needs badges
  - the "What to do now" strip and *Start here* setup steps
  - the People panel, the task columns and cards
  - the activity feed and message box, the file locks
  - the task and help dialogs, toasts, empty states, and the sign-in screen
- **`public/present.html`**, the presenter view for a big screen in the room.

## What "polished" means here

- **One system:**
  - tokens on `:root` for colour, type scale, spacing scale, radius, elevation and motion timing
  - a dark theme and a light theme, from `prefers-color-scheme`
  - no stray one-off values
- **Typography:** a clear hierarchy for page, section, card and metadata text, and consistent numerals for counts and
  times.
- **Layout:**
  - aligned edges and consistent gutters
  - no layout shift when live updates arrive
  - works at 1440×900 and 1366×768, and at phone width (390 px) without horizontal scrolling
- **Colour:**
  - restrained, with one accent
  - status colours (open, in progress, blocked, review, done) that read at a glance in both themes
  - person colours that stay distinct for a team of 3–6 people
- **Motion:**
  - short, interruptible transitions for state changes (cards moving columns, toasts, dialogs, expanding rows)
  - a little feedback on claim, move, answer, send and merge
  - nothing loops or flashes
  - reduced motion turns it off
- **Copy:**
  - plain, short and consistent
  - empty states and errors say what happened and what to do next
- **Accessibility:**
  - AA contrast in both themes, visible focus rings, logical tab order
  - keyboard paths for everything
  - correct roles and labels; don't remove existing ARIA
- **Performance:** the board re-renders on every live event, so changes must not add jank or slow down rendering with
  dozens of tasks and agents.

## Constraints

- Plain HTML, CSS and JavaScript as now: no framework, no build step, no new runtime dependencies.
- **Keep behaviour and test hooks:** every feature, `id`, `data-*` attribute and accessibility semantic that the code and
  tests rely on (see `tests/ui/`) stays.
- **Wording changes:** if you improve wording that a test checks, update that test minimally and list each change with
  the reason.
- **Leave everything else alone:** don't change the server (`src/`), the agent-facing behaviour, or the REST/MCP APIs.

## How to work

1. Take "before" screenshots of the main board and the presenter view at 1440 and 390 px wide, in both themes. Use a
   realistic board: seed one with `tests/helpers.mjs` (`startBoard`, `seed`), or use a copy of the Kubecon `data/`.
2. Write down the design system (tokens, type scale, spacing) at the top of the stylesheet, then apply it section by
   section.
3. After each section, take new screenshots, compare them against the skills' checklists, and iterate.
4. Run every suite (`npm test`) and keep it green.

## Done when

- The before and after screenshots show a clearly more coherent, calmer and clearer UI in both themes and at both
  widths.
- design-taste-frontend's finish checks pass.
- `npm test` passes, and any test changes are listed with reasons.
- A short summary lists the design system and the main changes per area.
