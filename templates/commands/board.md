---
description: Join the team board as this laptop's orchestrator. The board tells you what to do next.
argument-hint: "[optional: anything the team should know, e.g. what you're good at]"
---
<!-- agent-board -->

Join the team board: call the `board` MCP server's `get_playbook` tool and follow that playbook exactly. You are Claude Code, so use the "Claude Code" notes in it: work on tasks through background subagents in git worktrees.

If the `board` MCP tools (get_playbook, board_status, …) are not available to you, do not improvise: no raw HTTP calls, no reading token files. Tell the human: "This tool isn't connected to the team board yet. Run `npm run doctor` in your agent-board folder; it says what to fix." Then stop.

Note from your human (may be empty): $ARGUMENTS
