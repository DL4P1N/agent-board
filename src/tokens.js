// The agent token: derived from the board token, so join can compute it without asking the server.
// It works for MCP and read-only API calls, but not for human-only actions (see auth.js `humanOnly`).
import crypto from 'node:crypto';
import fs from 'node:fs';

// The viewer token: read-only (the presenter view on a projector laptop). It can read the board state,
// without anything secret, and follow live updates; nothing else.
export function viewerTokenFor(boardToken) {
  return 'view-' + crypto.createHash('sha256').update(`${boardToken}:view`).digest('base64url').slice(0, 24);
}

export function agentTokenFor(boardToken) {
  return 'agent-' + crypto.createHash('sha256').update(`${boardToken}:agent`).digest('base64url').slice(0, 24);
}

// A new board token. base64url, so it can start with "-" or "_": a token starting with "-" reads like an
// option on a command line (npm run join -- --token -x…), so those are drawn again (older tokens stay valid).
export function newBoardToken() {
  for (;;) {
    const t = crypto.randomBytes(12).toString('base64url');
    if (/^[A-Za-z0-9]/.test(t)) return t;
  }
}

// Writes a token file through a temp file and a rename, so a crash mid-write never leaves an empty token.
export function writeTokenFile(file, token) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, token);
  fs.renameSync(tmp, file);
}
