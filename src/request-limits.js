// Limits so one runaway client can't slow the board down for everyone: board calls per agent and per network
// address, and how many slow requests may be open. In memory only: the counters are in src/limits.js.
import net from 'node:net';
import { normName } from './board.js';
import { RateLimiter, Slots, envLimit } from './limits.js';

// Board calls per agent and per network address (token buckets: a minute's worth at once, refilling steadily),
// and how many slow requests (wait_for_events, long-polls, live streams) may be open per agent and in total.
// Generous on purpose: a normal day, the tests and the rehearsal never get near them. 0 turns one off.
const LIMITS = {
  agentPerMinute: envLimit('BOARD_RATE_AGENT', 600),
  ipPerMinute: envLimit('BOARD_RATE_IP', 3000),
  waitsPerAgent: envLimit('BOARD_WAITS_AGENT', 20),
  waitsTotal: envLimit('BOARD_WAITS_TOTAL', 1000),
};
const agentRate = new RateLimiter(LIMITS.agentPerMinute);
const ipRate = new RateLimiter(LIMITS.ipPerMinute);
const slowSlots = new Slots(LIMITS.waitsPerAgent, LIMITS.waitsTotal);
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
  : `The board has ${full.open} waits and live streams open, as many as it allows. Try again in a few seconds.`);

// The limit checks of one board. Agent and slot keys carry its slug, so boards don't share those counts; the
// per-address count is one for the whole server (an address calling in a loop is the same load on any board).
export function createRequestLimits(slug) {
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
  // A slow request (a wait or a live stream) holds a slot until its connection closes. false = refused (429 sent).
  const holdSlot = (req, res, key, who, mcp) => {
    const got = slowSlots.acquire(`${slug}|${key}`);
    if (typeof got !== 'function') { tooMany(req, res, 5, slotText(who, got), mcp); return false; }
    res.on('close', got);
    return true;
  };
  return { ipLimit, agentLimit, holdSlot };
}
