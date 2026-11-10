// The agent token: derived from the board token, so join can compute it without asking the server.
// It works for MCP and read-only API calls, but not for human-only actions (see server.js `humanOnly`).
import crypto from 'node:crypto';

// The viewer token: read-only (the presenter view on a projector laptop). It can read the board state,
// without anything secret, and follow live updates; nothing else.
export function viewerTokenFor(boardToken) {
  return 'view-' + crypto.createHash('sha256').update(`${boardToken}:view`).digest('base64url').slice(0, 24);
}

export function agentTokenFor(boardToken) {
  return 'agent-' + crypto.createHash('sha256').update(`${boardToken}:agent`).digest('base64url').slice(0, 24);
}
