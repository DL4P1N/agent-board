// A board's tokens and who may do what with them (the check on every API and MCP call), including the
// rotation of the token from the web board and the retired tokens that answer "the token was changed".
// The agent and viewer tokens are derived from the board token: see tokens.js.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { agentTokenFor, viewerTokenFor, newBoardToken, writeTokenFile } from './tokens.js';
import { boardToken } from './boards.js';
import { tokenFrom, safeEq } from './http-util.js';

export const TOKEN_ROTATED = "The board's token was changed. Ask the host for the new link, then re-run the join command from the web board.";

// envToken: the token from BOARD_TOKEN when it belongs to this board (then it can't be rotated), else null.
export function createAuth({ dir, envToken }) {
  // `let`: humans can rotate the token from the web board (POST /api/token/rotate).
  let TOKEN = envToken || boardToken(dir);
  // Two keys: the board token (humans, the web board, join) can do everything; the agent token
  // (derived from it, written into each AI tool's config by join) can use MCP and read the API, but
  // can't do human-only things like approving the plan, setting the deadline or deleting tasks.
  let AGENT_TOKEN = agentTokenFor(TOKEN);
  // A third, read-only key for the presenter view and the recap page: GET /api/state (nothing secret), the live
  // stream and GET /api/recap only.
  let VIEW_TOKEN = viewerTokenFor(TOKEN);
  // Tokens retired by a rotation (hashed, kept in the board's folder), so an old link or agent config
  // gets "the token was changed" instead of a bare "bad token". reason: 'token_rotated' is for the web page.
  const retiredFile = path.join(dir, 'retired-tokens');
  const tokenHash = (t) => crypto.createHash('sha256').update(String(t)).digest('base64url');
  let retired = [];
  try { retired = JSON.parse(fs.readFileSync(retiredFile, 'utf8')).filter((x) => typeof x === 'string'); } catch {}

  function auth(req, res, next) {
    const t = tokenFrom(req);
    // No token never matches (a board token can't be empty either: see boardToken).
    if (!t || !TOKEN) return res.status(401).json({ error: 'bad or missing token' });
    if (safeEq(t, TOKEN)) req.role = 'human';
    else if (safeEq(t, AGENT_TOKEN)) req.role = 'agent';
    else if (safeEq(t, VIEW_TOKEN)) req.role = 'viewer';
    else if (t && retired.includes(tokenHash(t))) return res.status(401).json({ error: TOKEN_ROTATED, reason: 'token_rotated' });
    else return res.status(401).json({ error: 'bad or missing token' });
    next();
  }
  function viewerLimits(req, res, next) {
    if (req.role !== 'viewer') return next();
    if (req.method === 'GET' && (req.path === '/state' || req.path === '/stream' || req.path === '/recap')) return next();
    return res.status(403).json({ error: 'This is the read-only viewer token (presenter view).' });
  }
  function humanOnly(req, res, next) {
    // An agent may report its own usage limit (the Claude Stop hook does, with the agent token).
    if (req.method === 'POST' && req.role === 'agent' && /^\/agents\/[^/]+\/limit$/.test(req.path)) return next();
    // join reserves its agent names (POST /names/:name) with whichever token it was given.
    if (req.method === 'POST' && req.role === 'agent' && /^\/names\/[^/]+$/.test(req.path)) return next();
    if (req.method !== 'GET' && req.role !== 'human') return res.status(403).json({ error: 'This needs the board token (humans on the web board), not an agent token.' });
    next();
  }
  // Humans only, even for reading: the URL is a secret that lets anyone post to your channel.
  const humanToken = (req, res, next) => (req.role === 'human' ? next() : res.status(403).json({ error: 'This needs the board token (humans on the web board), not an agent token.' }));

  // The request's token is still one of this board's tokens (not retired by a rotation since it came in):
  // checked again after a long wait, so a wait opened with the old token never returns what came after.
  const current = (req) => { const t = tokenFrom(req); return !!t && [TOKEN, AGENT_TOKEN, VIEW_TOKEN].some((x) => safeEq(t, x)); };

  // A new board token (the old ones are retired). Returns it; the caller announces it and closes live streams.
  function rotate() {
    const t = newBoardToken();
    writeTokenFile(path.join(dir, 'token'), t);
    retired = [...retired, ...[TOKEN, AGENT_TOKEN, VIEW_TOKEN].map(tokenHash)].slice(-60);
    try { fs.writeFileSync(retiredFile, JSON.stringify(retired)); } catch {}
    TOKEN = t; AGENT_TOKEN = agentTokenFor(t); VIEW_TOKEN = viewerTokenFor(t);
    return t;
  }

  return {
    auth, viewerLimits, humanOnly, humanToken, rotate, current, envToken,
    get token() { return TOKEN; },
    get agentToken() { return AGENT_TOKEN; },
    get viewerToken() { return VIEW_TOKEN; },
  };
}
