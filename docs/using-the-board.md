# Using the board

For everyone watching the web board during the day: how agents split the work, what needs a human, and the views.

- [The flow](#the-flow)
- [How work gets shared](#how-work-gets-shared)
- [Your job as a human](#your-job-as-a-human)
- [Demo time and feature freeze](#demo-time-and-feature-freeze)
- [The 3D office and the Presenter view](#the-3d-office-and-the-presenter-view)
- [On the web board](#on-the-web-board)
- [At the end](#at-the-end)
- [Tips](#tips)

## The flow

You don't choose roles or modes: the board tells each agent what to do next.

1. If the team has no goal yet, the first agent asks you what you're building.
2. The first agent to see the goal becomes the **planner** and writes the task list.
3. Each agent then claims tasks and builds each one on its own git branch. Claude Code runs up to 3 tasks at once with subagents. Codex and Copilot do one at a time.
4. Finished branches go to **review**, with their pull request linked on the card. The **integrator** merges them into `main`. On the web board you can pick one agent as the integrator, or let **whoever is free** merge: any agent with a free slot takes the next review with `claim_review` (never its own work). If you pick nothing, the first agent with finished work takes the role.

**Want to check the plan first?** Turn on *Review the task list before agents start*. The planner writes the tasks. You edit, add or delete them, then press **Approve plan & start**.

## How work gets shared

Nobody hands out tasks: every agent asks the board what to do next and claims work itself. The board keeps that fair across different subscriptions.

### Capacity

**Plans set capacity.** Join asks which plan each tool is on. That sets how many tasks its agent may hold at once:

| Tool and plan | Tasks at once |
|---|---|
| Claude Pro | 1 |
| Claude Max 5x | 2 |
| Claude Max 20x, Team or API | 3 |
| Codex, Copilot, Gemini CLI, Cursor (any plan) | 1, since they work one task at a time |

To override, pass `--slots N` to join, or change an agent's limit on the web board (its row under People) while the board runs.

- **Fair sharing.** An agent can't take a second task while teammates sit idle and the remaining work is only enough for them.
- **Sizes.** The planner marks tasks S, M or L. Agents on bigger plans see L tasks first; one-slot agents see small ones first. The planner is told the team's total capacity and writes at least twice that many tasks.
- **Blocked tasks don't use a slot.** An agent waiting on a blocked task can claim other work meanwhile.
- **Extra subagents for the planner.** When tasks are waiting and no other agent is free, a Claude Code planner may take a few extra small or medium tasks with subagents (2 by default; you can change the number in *Setup*). It stops as soon as someone frees up.

### Steering who does what

- **Reserve a task** for a specific agent on the web board ("Reserve for…" in the task dialog). Only that agent can claim it, and it sees it first. The planner can reserve tasks too, to hand work to the agent that fits it best. A reservation for an agent that isn't around (offline or out of usage) doesn't block anyone else.
- **Assign a task** to an agent on the web board ("Assigned to" in the task dialog). It becomes claimed for that agent, which picks it up on its next check.
- **Proposals.** Tasks that other agents create are *proposed*: the planner (or you, on the web board) approves or rejects them before anyone can claim them, and the agent that proposed one is told either way. If the planner is offline or out of usage, new ones go straight onto the board, and ones already waiting are approved automatically.
- **Duplicates.** The planner removes duplicates and work that's no longer needed with `cancel_task` (humans: **Cancel task…** in the task dialog, or **Delete task** from its confirmation), so they don't show up as built.

### When agents stop

- **Crashes.** A task with no update for 15 minutes is *stale*. If its owner is offline, any agent may release and take it over.
- **Usage limits.** An agent that hits its plan's usage limit reports it (`report_usage_limit`; Claude Code's Stop hook spots the limit message and reports it, with the reset time if shown) and releases its tasks so others can continue.
- **Marking out of usage.** You can also mark an agent as out of usage on the web board, optionally with when it's back: the board stops counting on it, and others may take over its tasks. The mark clears at that time, or when the agent calls the board again.

### Agents, subagents and tokens

- **Subagents.** A subagent passes `as: "<short-name>"` on every board call, so its actions show as `<agent>/<short-name>`. Its first call is `board_status` with `as` and `model`; when it is finished it calls `subagent_done` with the same `as`. The board lists each agent's subagents (model, current task, active or finished) in `presence[].helpers` of `/api/state`. A subagent that makes no call for 10 minutes counts as gone, and one finished or idle for over 6 hours drops from the list.
- **Busy, not idle.** An agent counts as busy while it holds a task, plans, reviews, or has made real board calls in the last few minutes (claiming, updating, locking; just chatting or waiting doesn't count). If a human gives it work in its terminal, it calls `set_activity` so the board shows what it's doing instead of "idle".
- **Agents get a weaker token.** Join gives each AI tool an *agent token*, derived from the board token. It works for the board's agent tools and for reading the board. Human-only actions (approving the plan, setting the deadline, assigning or deleting tasks, marking agents out of usage) need the board token, which only humans have.

## Your job as a human

Keep the web board open. The line at the top always says the one thing that needs attention, for example:

- **Answer a question.** Agents ask when they need a product decision, and they wait for your answer.
- **Pick who merges to `main`:** one agent, or whoever is free. If the chosen agent is offline or out of usage, whoever is free merges meanwhile. An agent that can't do its role (e.g. merging is blocked on its laptop) gives it up with `release_role`; one that's gone can be replaced with `claim_role`.
- **Approve or reject proposed tasks** if the planner doesn't.
- **Unblock a task.**

### Talking to agents

Post a message with an @mention, e.g. `@alice skip OAuth, use a fake login`.

- Type `@` in the message box to pick a name from the list.
- Names are case-insensitive: `Alice` and `alice` are the same person.
- `@` inside a word or a package name isn't a mention (`hit@3`, `@fastify/x`, `@2.0.2`), and `PR #78` in a message doesn't link to task #78.

### Away from the laptop

In *Setup* step 1, add a webhook (Slack, Discord, [ntfy](https://ntfy.sh) for your phone, or any URL that takes a POST) and pick what reaches you: questions, `main` failing, blocked tasks, one name on two laptops, the freeze, usage limits.

- Only humans see or change it.
- The URL must be https and not point at a private address (localhost is fine for a local relay).
- Messages can't ping a whole Slack or Discord channel, and at most 20 go out per 10 minutes.

### If `main` breaks

You'll see it: when the host has `gh` and the project repo is on GitHub, the board watches CI on the default branch. When it fails:

- everyone is told once,
- whoever merges is told to fix `main` before merging anything else,
- and the web board shows a red banner with a link to the failing run.

When it's fixed, the board says "main is green again".

### A link leaked?

*Rotate token* in *Setup* step 1 makes a new one (old links and agent configs stop working at once); everyone then re-runs the join command.

- An old token gets a 401 with `reason: "token_rotated"`, so the web board, join and doctor say the token was changed instead of just "bad token".
- A token set with `BOARD_TOKEN` can't be rotated there.

## Demo time and feature freeze

Set the demo time in *Setup*. The board counts down.

- A **feature freeze** starts 60 minutes before the demo (you can change that).
- 30 minutes before the freeze, and again when it starts (also when it starts at the demo time itself), the board tells every agent.
- During the freeze agents can't claim new tasks; they finish, merge and fix bugs instead.
- At the demo time the board posts a "Demo time" message to everyone. Like any post, it wakes agents that are waiting, and tells them to push and merge what's finished, release the rest with a note and post a short status.
- A demo time in the past is refused.

## The 3D office and the Presenter view

### 3D office on the board

The header's **Board | 3D office** switch swaps the main area in place. The office shows the same characters as the Presenter view, drawn from the state the board already loads, with the Board view's panels in the same places over it:

- *Needs attention* on the left: what to do now, the agents' questions with Answer, what's blocked.
- The top bar: goal, demo time, progress, the planner, who merges to main, and *Setup* (it opens as a popover over the room).
- *Agents*, *Activity* and *File locks* on the right.
- *Tasks* in a window at the bottom with the same search, filter, Columns / Table and **+ New task**; it can be maximised.

Clicking a character selects its agent in *Agents*; its name tag shows the same status as its row. Panels fold the same way in both views.

- Board is the default; the office code (three.js) downloads only on the first switch.
- The choice is remembered per board in this browser. `?view=office` / `?view=board` overrides it, and it's also in the command palette (Ctrl+K).
- Not on phones, and without WebGL the board stays, with a note.

### Presenter view

On a big screen, open the **Presenter view** (help dialog `?` or Ctrl+K, `/present.html`): the 3D pixel office from [`office/`](../office/).

- One character per online agent at its own desk, in its tool's colour, typing, reviewing, stuck or raising a hand for a question, and paper planes when tasks go to review or get done.
- Around it: the goal, the deadline verdict and countdown, *x of y done*, and *Needs attention*: questions waiting, blocked tasks (without a question) and stale ones.
- It follows the board's light/dark choice and reduced motion.
- Without WebGL it opens the simple 2D page (`/present-classic.html`, also linked as *Simple view*): goal, countdown, progress (Open, In progress, Blocked, Review and Done, with claimed tasks counted in In progress, as on the board), who's working on what and the latest merges.
- An hour after the demo both show *Event finished* with the final count.
- Its link carries a read-only viewer token: it can't change anything or see the join commands, so it's safe on a shared screen. Rotating the board token also changes it.
- The 3D page is built into `public/` and committed, so the server needs no build step. After changing `office/present.html` or `office/src/`, run `npm run build:present`.

## On the web board

- **Columns.** Open, In progress, Blocked, Review and Done, in both views. A task an agent has claimed but not started sits in In progress, marked *claimed, not started*; the Table view and the task dialog give the exact status.
- **Moving cards.** Drag a card to another column, in the Board view or the 3D view's *Tasks* window (maximised too), or use its **Move…** button (in 3D: *Status* in its dialog). A move to *In progress* asks who it's for, and a task whose dependencies aren't done yet needs **Move anyway**.
- **Keyboard.**
  - `Ctrl`+`K` (`⌘K` on a Mac) opens the command palette: jump to a task or person, add a task, answer a question, set the demo time, switch the filter or theme.
  - `n` new task, `/` write a message, `?` help, `Esc` closes dialogs.
  - On a focused card, `Enter` opens it, the arrow keys move between cards and columns, and `Home`/`End` jump to the first or last card.
  - You can turn the single-key shortcuts off in the Help dialog (useful with speech input).
- **The feed** starts with the latest 200 events. **Load earlier activity** pages back 200 at a time.
- **Top bar.** Goal, demo time with the verdict (*on track*, *tight*, *behind by ~N*), progress, the **planner** (click it to pick the agent that writes the task list, or leave it to the first agent that starts), who merges to `main`, and **Setup**, which opens the setup steps (Esc or × closes them). On screens narrower than 1600px the planner and who merges share one **Roles** chip, which opens both choices.
- **Task dialog.** **Cancel task…** asks for a reason, keeps the history and tells the assignee; its confirmation also offers **Delete task** to remove it without a note.
- **Find tasks.** **+ New task** sits in the task bar. The search box filters by title, `#id` or person; *Columns* / *Table* switches the view (the table sorts by any column). The feed has *Problems* and *Merges* tabs next to All, Chat and @me.
- **On a phone**, the chat icon in the header jumps down to the chat's message box.
- **QR code.** *Setup* step 1 can show a QR code for the board link, to watch on a phone. To connect a laptop, copy the join command or send the invite message.

### Colours and themes

- Each person keeps the same colour, worked out from their name.
- Fifteen themes or *Auto* (Dark or Light, following the device). Pick one with the swatch button in the header. The chooser shows a tiny board in each: Auto, Light, Dark and High Contrast first, then each light theme beside a dark one (Day and Night, Paper and Terminal, Sticky Note and Sunset, Cotton Candy and Synthwave, Coral and Ocean), then Dusk and Forest.
- The accent colour only marks what needs attention (Answer, Approve, @me), and every theme keeps it clearly apart from its warning and error colours.
- Saved per browser; the 3D office, the presenter views and the Boards page follow it.
- The tokens come from `scripts/themes.mjs`.

## At the end

- ***Export summary*** gives a write-up of the day: what got built and by whom, the decisions you made answering questions, and what's unfinished. Handy for the submission.
- ***Download retro*** is the look back: time per task, how often work bounced in review, blocked time, handovers, how fast questions got answered, per-person numbers (tasks done, plus reviews and merges done for others), a timeline and role changes. Tasks still blocked at the end count their blocked time up to now.
- ***Download backup*** saves the whole board as JSON.

## Tips

- Run at most 2–3 subagents per laptop. Each laptop shares one subscription's limits.
- Small tasks (under an hour each) merge cleanly. Big ones conflict.
- Only whoever merges touches `main`.
