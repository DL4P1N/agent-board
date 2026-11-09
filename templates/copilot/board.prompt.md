---
name: board
description: Join the team board as this laptop's orchestrator. The board tells you what to do next.
agent: agent
argument-hint: "[optional: anything the team should know]"
---
<!-- claude-board -->

Join the team board: call the `board` MCP server's `get_playbook` tool and follow that playbook exactly. You are GitHub Copilot, so use the "Codex, GitHub Copilot, or any agent without background subagents" notes in it: do one task at a time yourself.

Keep looping (board_status → work → wait_for_events) until the playbook says there is nothing left. Don't stop after a single step.
