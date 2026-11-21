// Rate and concurrency limits: an agent (or a script) calling the board in a loop gets 429 with Retry-After
// and a message it can act on, while everyone else stays served; open waits are capped per agent and in total.
// The board here runs with low limits (BOARD_RATE_AGENT, BOARD_RATE_IP, BOARD_WAITS_AGENT, BOARD_WAITS_TOTAL);
// the defaults are far higher. Run all suites with: npm test
import { startBoard, finish, agent } from './helpers.mjs';
import { agentTokenFor } from '../src/tokens.js';
import { RateLimiter } from '../src/limits.js';
import { clientIp } from '../src/request-limits.js';

const board = await startBoard({ env: { BOARD_RATE_AGENT: '30', BOARD_RATE_IP: '100', BOARD_WAITS_AGENT: '2', BOARD_WAITS_TOTAL: '5' } });
const AG = agentTokenFor(board.token);
const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + x : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (p, { who, token = AG, ip, signal } = {}) => fetch(`${board.base}/api${p}`, {
  headers: { Authorization: `Bearer ${token}`, ...(who ? { 'X-Agent': who } : {}), ...(ip ? { 'CF-Connecting-IP': ip } : {}) }, signal,
});
const mcpRaw = (name, method, params, id = 1, ip) => fetch(`${board.base}/mcp?agent=${name}&token=${AG}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(ip ? { 'CF-Connecting-IP': ip } : {}) },
  body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
});

// The bucket refills while a loop runs (perMinute / 60 calls a second): how many calls a loop over the network gets
// served depends on how long it took. At most the limit, plus what refilled meanwhile, plus one for rounding.
const servedAtMost = (limit, ms) => limit + Math.floor((ms * limit) / 60e3) + 1;

try {
  // ---- the token bucket itself, on a fake clock ----
  {
    const t = 1_000_000;
    const rl = new RateLimiter(60);
    let n = 0;
    while (n < 100 && rl.take('a', t).ok) n++;
    const no = rl.take('a', t);
    check('RateLimiter: a full minute\'s calls at once, then refused with Retry-After 1s', n === 60 && !no.ok && no.retryAfter === 1, JSON.stringify({ n, no }));
    check('RateLimiter: one more call a second later (perMinute / 60 a second), then refused again', rl.take('a', t + 1000).ok && !rl.take('a', t + 1000).ok);
    const r6 = new RateLimiter(6);
    for (let i = 0; i < 6; i++) r6.take('x', t);
    check('RateLimiter: Retry-After is the whole seconds until the next call (6 a minute: 10s)', r6.take('x', t).retryAfter === 10 && r6.take('x', t + 5000).retryAfter === 5 && r6.take('x', t + 10e3).ok);
    check('RateLimiter: each key has its own bucket', rl.take('b', t).ok);
    let k = 0;
    while (k < 200 && rl.take('a', t + 3600e3).ok) k++;
    check('RateLimiter: a quiet key refills to the limit, not past it', k === 60, String(k));
    const off = new RateLimiter(0);
    check('RateLimiter: 0 turns the limit off', Array.from({ length: 1000 }, () => off.take('a', t).ok).every(Boolean));
  }

  // ---- which address a request counts against (clientIp) ----
  // Only cloudflared on this machine may name the caller (CF-Connecting-IP); anyone else is their socket's address,
  // whatever headers they send, so a client can't pick a fresh address per call to dodge the per-address limit.
  {
    const req = (peer, headers = {}) => {
      const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
      return { socket: { remoteAddress: peer }, headers: h, get: (k) => h[k.toLowerCase()] };
    };
    const spoof = { 'CF-Connecting-IP': '198.51.100.9', 'X-Forwarded-For': '198.51.100.10', 'X-Real-IP': '198.51.100.11', Forwarded: 'for=198.51.100.12' };
    const cases = [
      ['a remote caller sending CF-Connecting-IP, X-Forwarded-For, X-Real-IP and Forwarded is its own address', req('203.0.113.5', spoof), '203.0.113.5'],
      ['…also as an IPv4-mapped IPv6 peer', req('::ffff:203.0.113.5', spoof), '203.0.113.5'],
      ['…and a LAN caller too', req('192.168.1.20', spoof), '192.168.1.20'],
      ['X-Forwarded-For is never trusted, not even from this machine', req('127.0.0.1', { 'X-Forwarded-For': '198.51.100.10' }), '127.0.0.1'],
      ['CF-Connecting-IP from this machine (cloudflared) names the caller', req('127.0.0.1', { 'CF-Connecting-IP': '198.51.100.9' }), '198.51.100.9'],
      ['…from ::1 and ::ffff:127.0.0.1 as well', req('::1', { 'CF-Connecting-IP': '2001:db8::5' }), '2001:db8::5'],
      ['…(mapped loopback)', req('::ffff:127.0.0.1', { 'CF-Connecting-IP': '198.51.100.9' }), '198.51.100.9'],
      ['a CF-Connecting-IP that isn\'t one address is ignored', req('127.0.0.1', { 'CF-Connecting-IP': '198.51.100.9, 198.51.100.10' }), '127.0.0.1'],
      ['…nor is a name', req('127.0.0.1', { 'CF-Connecting-IP': 'evil.example' }), '127.0.0.1'],
      ['no socket address: "unknown"', req(undefined, spoof), 'unknown'],
    ];
    const wrong = cases.filter(([, r, want]) => clientIp(r) !== want).map(([n, r, want]) => `${n}: ${clientIp(r)} (want ${want})`);
    check('clientIp: headers name the caller only when cloudflared on this machine sends CF-Connecting-IP', !wrong.length, wrong.join('; '));
  }

  // ---- one agent in a loop (REST, like a broken Stop hook) ----
  const statuses = [];
  let first429 = null;
  const t0 = Date.now();
  for (let i = 0; i < 45; i++) {
    const r = await get('/next', { who: 'loop-claude', ip: '198.51.100.1' });
    statuses.push(r.status);
    if (r.status === 429 && !first429) first429 = { retry: r.headers.get('retry-after'), body: await r.json() };
    else await r.body?.cancel();
  }
  const ok = statuses.filter((s) => s === 200).length;
  const loopMs = Date.now() - t0;
  check('a looping agent is served up to its limit, then gets 429', ok >= 30 && ok <= servedAtMost(30, loopMs) && statuses.at(-1) === 429, `${loopMs}ms: ${statuses.join(',')}`);
  check('the 429 says when to come back (Retry-After) and what to do instead', !!first429 && Number(first429.retry) >= 1 && first429.body.reason === 'rate_limited' && first429.body.retry_after === Number(first429.retry)
    && /loop-claude/.test(first429.body.error) && /wait_for_events/.test(first429.body.error) && /30 a minute/.test(first429.body.error), JSON.stringify(first429));
  check('another agent on the same address is still served', (await get('/next', { who: 'calm-codex', ip: '198.51.100.1' })).status === 200);
  const calm = await agent(board, 'calm-gemini');
  const st = await calm('board_status');
  check('and other agents\' MCP calls work as usual', typeof st === 'object' && !!st.next_action, String(st).slice(0, 200));
  check('humans on the web board are not held up by the agent limit', (await get('/state', { token: board.token, who: 'dana', ip: '198.51.100.1' })).status === 200);
  await sleep(Number(first429?.retry || 2) * 1000 + 200);
  check('after Retry-After the agent is served again', (await get('/next', { who: 'loop-claude', ip: '198.51.100.1' })).status === 200);

  // ---- the same over MCP ----
  let mcp429 = null; let mcpOk = 0;
  for (let i = 0; i < 40 && !mcp429; i++) {
    const r = await mcpRaw('mcp-loop', 'tools/call', { name: 'board_status', arguments: {} }, i + 1, '198.51.100.2');
    if (r.status === 429) mcp429 = { retry: r.headers.get('retry-after'), body: await r.json(), i };
    else { mcpOk++; await r.body?.cancel(); }
  }
  check('an MCP agent in a loop gets 429 with Retry-After and a JSON-RPC error naming the fix', !!mcp429 && Number(mcp429.retry) >= 1 && mcp429.body.jsonrpc === '2.0' && mcp429.body.id === mcp429.i + 1
    && /Too many board calls from mcp-loop/.test(mcp429.body.error?.message) && /wait_for_events/.test(mcp429.body.error.message), JSON.stringify(mcp429));
  // What an MCP client shows the agent: the SDK puts the body's text in its error.
  const sdk = await agent(board, 'sdk-loop').catch((e) => e);
  let sdkErr = null;
  if (typeof sdk === 'function') { for (let i = 0; i < 40 && !sdkErr; i++) { try { await sdk('list_tasks'); } catch (e) { sdkErr = e; } } }
  check('an MCP client sees the message (not just "HTTP 429")', !!sdkErr && /Too many board calls/.test(String(sdkErr.message)) && /Wait \d+ s/.test(String(sdkErr.message)), String(sdkErr?.message || sdk?.message || 'no error'));

  // ---- one address in a loop (many agent names, so only the address limit applies) ----
  const ipStatuses = [];
  let ip429 = null;
  const t1 = Date.now();
  for (let i = 0; i < 115; i++) {
    const r = await get('/next', { who: `bot${i % 10}`, ip: '203.0.113.7' });
    ipStatuses.push(r.status);
    if (r.status === 429 && !ip429) ip429 = await r.json(); else await r.body?.cancel();
  }
  const ipOk = ipStatuses.filter((s) => s === 200).length;
  const ipMs = Date.now() - t1;
  check('one address calling in a loop gets 429 past its limit', ipOk >= 95 && ipOk <= servedAtMost(100, ipMs) && ipStatuses.at(-1) === 429 && /203\.0\.113\.7/.test(ip429?.error || ''), `${ipOk} ok in ${ipMs}ms; ${JSON.stringify(ip429)}`);
  check('other addresses are still served', (await get('/next', { who: 'bot1', ip: '203.0.113.8' })).status === 200 && (await get('/state', { token: board.token, who: 'dana', ip: '203.0.113.9' })).status === 200);

  // ---- open waits: per agent and in total ----
  const ac = new AbortController();
  const wait = (who) => get('/events?since=999999&wait=30', { who, signal: ac.signal }).catch(() => null);
  const held = [wait('waiter'), wait('waiter')];
  await sleep(300);
  let r = await get('/events?since=999999&wait=30', { who: 'waiter' });
  const third = r.status === 429 ? await r.json() : null;
  check('a third wait from one agent is refused (2 open is its limit here), saying why', r.status === 429 && !!r.headers.get('retry-after') && /waiter already has 2 waits open/.test(third?.error || ''), `${r.status} ${JSON.stringify(third)}`);
  const mcpWait = await mcpRaw('waiter', 'tools/call', { name: 'wait_for_events', arguments: { since: 999999, timeout_s: 5 } }, 7);
  check('wait_for_events over MCP counts toward the same limit', mcpWait.status === 429 && /already has 2 waits open/.test((await mcpWait.json()).error?.message || ''));
  held.push(wait('w1'), wait('w2'), wait('w3'));
  await sleep(300);
  r = await get('/events?since=999999&wait=30', { who: 'w4' });
  check('past the total, any new wait is refused', r.status === 429 && /The board has 5 waits and live streams open/.test((await r.json()).error || ''));
  check('plain calls still work while every wait slot is taken', (await get('/next', { who: 'w4' })).status === 200);
  ac.abort();
  await Promise.all(held);
  await sleep(300);
  const quick = await get('/events?since=0&wait=1', { who: 'waiter' });
  check('closed waits free their slots', quick.status === 200, String(quick.status));
} catch (e) {
  R.push(`CRASH ${e.stack || e}`);
}
await finish(R, { board });
