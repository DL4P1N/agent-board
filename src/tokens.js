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
  // Readable by this user only (on POSIX; Windows ignores the mode, the user's profile folder is private anyway).
  // A failed write or rename (e.g. Windows: the file held open by another program) doesn't leave the token behind in the temp file.
  try {
    fs.writeFileSync(tmp, token, { mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch {}
    throw e;
  }
}

// A data folder holds the tokens, the database and its backups: on POSIX, the folder is this user's only (0700) and
// its database files are readable by this user only (0600), whatever the umask made them. Windows ignores modes (the
// user's profile folder is private anyway). Best effort: a folder this user doesn't own is left as it is.
export function keepPrivate(dir) {
  if (process.platform === 'win32') return;
  try { fs.chmodSync(dir, 0o700); } catch {}
  let names = [];
  try { names = fs.readdirSync(dir); } catch {}
  for (const f of names) if (/^board\.db(-wal|-shm)?$/.test(f)) { try { fs.chmodSync(`${dir}/${f}`, 0o600); } catch {} }
}
