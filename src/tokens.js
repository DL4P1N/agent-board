// The agent token: derived from the board token, so join can compute it without asking the server.
// It works for MCP and read-only API calls, but not for human-only actions (see server.js `humanOnly`).
import crypto from 'node:crypto';

export function agentTokenFor(boardToken) {
  return 'agent-' + crypto.createHash('sha256').update(`${boardToken}:agent`).digest('base64url').slice(0, 24);
}
