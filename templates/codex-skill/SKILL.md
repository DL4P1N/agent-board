---
name: board
description: Join the team's coordination board as this laptop's orchestrator. Use when the user says "board", "$board", "join the board", or asks you to work with the team or pick up tasks from the board.
---
<!-- agent-board -->

Join the team board: call the `board` MCP server's `get_playbook` tool and follow that playbook exactly. You are Codex, so use the "Codex, GitHub Copilot, or any agent without background subagents" notes in it: do one task at a time yourself.

Keep looping (board_status → work → wait_for_events) until the playbook says there is nothing left. Don't stop after a single step.

If the `board` MCP tools (get_playbook, board_status, …) are not available to you, do not improvise: no raw HTTP calls, no reading token files. Tell the human: "This tool isn't connected to the team board yet. Run `npm run doctor` in your agent-board folder; it says what to fix." Then stop.
