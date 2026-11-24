// Limits so one runaway client can't slow the board down for everyone: board calls per agent and per network
// address, and how many slow requests may be open. In memory only: the counters are in src/limits.js.
import net from 'node:net';
import { normName } from './board.js';
import { RateLimiter, Slots, envLimit } from './limits.js';

// Board calls per agent and per network address (token buckets: a minute's worth at once, refilling steadily),
// and how many slow requests (wait_for_events, long-polls, live streams) may be open per agent or person, per network
// address and per board. Generous on purpose: a normal day, the tests and the rehearsal never get near them. 0 turns one off.
const LIMITS = {
  agentPerMinute: envLimit('BOARD_RATE_AGENT', 600),
  ipPerMinute: envLimit('BOARD_RATE_IP', 3000),
  waitsPerAgent: envLimit('BOARD_WAITS_AGENT', 20),
  waitsPerIp: envLimit('BOARD_WAITS_IP', 100),
  waitsTotal: envLimit('BOARD_WAITS_TOTAL', 1000),
};
// Of a board's open-wait total, this many are kept for the human and viewer tokens (live pages, the presenter): one
// agent token making up names can't lock people out of the board. A tenth, at least 1 and at most 100.
export const HUMAN_RESERVE = LIMITS.waitsTotal ? Math.max(1, Math.min(100, Math.floor(LIMITS.waitsTotal / 10))) : 0;
const agentRate = new RateLimiter(LIMITS.agentPerMinute);
const ipRate = new RateLimiter(LIMITS.ipPerMinute);
// Per network address, across boards (one laptop or script is the same load on any board).
const ipSlots = new Slots(LIMITS.waitsPerIp, 0);
setInterval(() => { agentRate.sweep(); ipRate.sweep(); }, 60e3).unref();
// Who's calling. Behind `npm run tunnel` every request comes from cloudflared on this machine, so Cloudflare's
// header names the real address (trusted only from this machine itself).
export function clientIp(req) {
  const peer = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  const cf = String(req.get('cf-connecting-ip') || '').trim();
  if (cf && (peer === '127.0.0.1' || peer === '::1') && net.isIP(cf)) return cf;
  return peer || 'unknown';
}
// 429 with Retry-After and a message the agent can act on. MCP gets a JSON-RPC error (MCP clients show its text).
export function tooMany(req, res, retryAfter, error, mcp) {
  res.status(429).set('Retry-After', String(retryAfter));
  if (mcp) return res.json({ jsonrpc: '2.0', error: { code: -32000, message: error, data: { reason: 'rate_limited', retry_after: retryAfter } }, id: req.body?.id ?? null });
  return res.json({ error, reason: 'rate_limited', retry_after: retryAfter });
}
const rateText = (who, r, per) => `Too many board calls from ${who}: the limit is ${per} a minute. Wait ${r.retryAfter} s, then carry on. If you're checking the board in a loop, call wait_for_events instead: it returns as soon as something happens.`;
const slotText = (who, full) => (full.full === 'key'
  ? `${who} already has ${full.open} waits open (wait_for_events, the Stop hook or live pages), the most one agent may have. Let one of them return before starting another: they wake up as soon as something happens.`
  : full.reserved ? `The board has ${full.open} waits open from agents, as many as agents may hold (the rest are kept for people's live pages). Try again in a few seconds.`
    : `The board has ${full.open} waits and live streams open, as many as it allows. Try again in a few seconds.`);
const ipSlotText = (ip, full) => `This address (${ip}) already has ${full.open} waits and live pages open, the most one address may have. Let one of them return before starting another.`;

// The limit checks of one board. Agent and slot keys carry its slug, so boards don't share those counts; the
// per-address count is one for the whole server (an address calling in a loop is the same load on any board).
export function createRequestLimits(slug) {
  // Open waits of this board: per agent or person, and in all (each board its own total).
  const slowSlots = new Slots(LIMITS.waitsPerAgent, LIMITS.waitsTotal);
  // Board calls per network address, whatever the token or board. (Per agent: agentLimit, once we know the name.)
  const ipLimit = (mcp) => (req, res, next) => {
    const r = ipRate.take(clientIp(req));
    return r.ok ? next() : tooMany(req, res, r.retryAfter, rateText(`this address (${clientIp(req)})`, r, ipRate.perMinute), mcp);
  };
  const agentKey = (name) => `${slug}|${normName(name).split('/')[0] || 'anonymous'}`;
  const agentLimit = (req, res, name, mcp) => {
    const r = agentRate.take(agentKey(name));
    if (!r.ok) tooMany(req, res, r.retryAfter, rateText(normName(name).split('/')[0] || 'this agent', r, agentRate.perMinute), mcp);
    return r.ok;
  };
  // A slow request (a wait or a live stream) holds a slot until its connection closes: one of its address's and one of
  // the board's (an agent token's waits leave the board's last HUMAN_RESERVE slots free). false = refused (429 sent).
  const holdSlot = (req, res, key, who, mcp) => {
    const ip = clientIp(req);
    const byIp = ipSlots.acquire(ip);
    if (typeof byIp !== 'function') { tooMany(req, res, 5, ipSlotText(ip, byIp), mcp); return false; }
    const got = slowSlots.acquire(`${slug}|${key}`, { reserve: req.role === 'agent' ? HUMAN_RESERVE : 0 });
    if (typeof got !== 'function') { byIp(); tooMany(req, res, 5, slotText(who, got), mcp); return false; }
    res.on('close', () => { got(); byIp(); });
    return true;
  };
  return { ipLimit, agentLimit, holdSlot };
}
