#!/usr/bin/env node
// Claude Code Stop hook: when Claude is about to end its turn, check the board.
// If teammates posted anything new, block the stop and feed the events back in,
// so the orchestrator reacts without a human typing. If nothing new arrived but the
// board has work for this agent (a task it may claim, a review, proposals to decide…),
// nudge it once, at most every few minutes, so a refused claim can't loop forever.
// When Claude is already continuing because of this hook (stop_hook_active), it neither waits
// nor nudges: it only reports new activity, so the human gets the terminal back after one round.
// If the turn ended with Claude Code's own usage-limit notice (the last assistant entry of the session
// transcript), the hook tells the board (the agent is marked out of usage, so teammates take its tasks
// over) and lets it stop.
//
// Config (env vars override ~/.claude-board.json written by `npm run join`):
//   BOARD_URL, BOARD_TOKEN, BOARD_AGENT
//   BOARD_HOOK_WAIT  seconds to long-poll for new events before letting Claude stop (0 = don't wait)
//   BOARD_HOOK=off   disable the hook
//
// Exits by returning (process.exitCode), never process.exit(): exiting while fetch sockets close
// crashes Node on Windows, and Claude Code ignores a hook that exits abnormally.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RECENT_MS = 15 * 60e3;
// At most one "the board has work for you" nudge per agent in this window.
const NUDGE_EVERY_MS = 3 * 60e3;

async function main() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude-board.json'), 'utf8')); } catch {}
  const url = (process.env.BOARD_URL || cfg.url || '').replace(/\/$/, '');
  const token = process.env.BOARD_TOKEN || cfg.token;
  // Board names are case-insensitive (the server stores them lowercase).
  const agent = String(process.env.BOARD_AGENT || cfg.agent || '').toLowerCase();
  if (process.env.BOARD_HOOK === 'off' || !url || !token || !agent) return; // allow the stop

  // Hook input (JSON on stdin). stop_hook_active: Claude is already continuing because a Stop hook
  // blocked its last stop. Then don't wait and don't nudge, so it can't keep the terminal forever.
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}') || {}; } catch {}
  const continuing = input.stop_hook_active === true;
  const wait = continuing ? 0 : Number(process.env.BOARD_HOOK_WAIT ?? cfg.hook_wait ?? 0);

  // One cursor per board + agent, so a different (or freshly wiped) board doesn't inherit an old position.
  // A hash of the whole URL, path included: two boards on one host (/b/<a>, /b/<b>) never share a cursor.
  const boardKey = crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
  const cursorFile = path.join(os.tmpdir(), `claude-board-cursor-${agent.replace(/[^\w.-]/g, '_')}-${boardKey}`);
  const get = async (p) => {
    const r = await fetch(url + p, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout((wait + 15) * 1000) });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return r.json();
  };

  // Stopped because of a usage limit? Tell the board once, then let Claude stop: no nudging.
  if (await reportUsageLimit({ input, url, token, agent, markFile: cursorFile + '-limit' })) return;

  let since;
  try { since = Number(fs.readFileSync(cursorFile, 'utf8')); } catch {}
  const { cursor: latest } = await get('/api/cursor');
  // First run, or the board was started fresh (our position is past its newest event):
  // look at the last ~50 events but only react to the last 15 minutes, so the first turn isn't missed.
  const fresh = !Number.isFinite(since) || since > latest;
  if (fresh) since = Math.max(0, latest - 50);

  const { events, cursor } = await get(`/api/events?since=${since}&exclude=${encodeURIComponent(agent)}&wait=${wait}`);
  fs.writeFileSync(cursorFile, String(cursor));

  const relevant = events.filter((e) => !['lock', 'unlock'].includes(e.kind) && (!fresh || Date.now() - e.ts < RECENT_MS));
  if (!relevant.length) return continuing ? undefined : nudgeIfWork({ get, agent, nudgeFile: cursorFile + '-nudge' }); // else allow the stop

  const mentionsMe = (e) => (e.data?.mentions || []).map((m) => String(m).toLowerCase()).some((m) => m === agent || m.startsWith(agent + '/') || m === 'all' || m === 'everyone');
  const lines = relevant.slice(-40).map((e) => {
    const tag = mentionsMe(e) ? ' [MENTIONS YOU]' : '';
    const task = e.task_id ? ` #${e.task_id}` : '';
    return `- (${e.id}) [${e.channel}/${e.kind}${task}] ${e.author}: ${e.text}${tag}`;
  });
  const reason =
    `New activity on the team board since you last checked (cursor now ${cursor}):\n` +
    lines.join('\n') +
    `\n\nReact if any of this affects you (mentions, answers to your questions, tasks you depend on, review requests). ` +
    `If nothing needs action, continue your current plan or pick up the next open task. Use the board MCP tools to respond.`;
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

// When the subscription's limit is hit, Claude Code ends the turn with its own notice: an assistant entry
// with isApiErrorMessage: true (error "rate_limit", model "<synthetic>") whose text is e.g.
// "You've hit your session limit · resets 6:50pm (America/Denver)" or "Claude AI usage limit reached|1754500000".
// Only the LAST assistant entry (the one that ended this turn) is looked at, and only Claude Code's notice
// formats count, so work text like "added rate limiting" or "usage limit banner" never marks an agent.
const NOTICE_RE = [
  /^Claude AI usage limit reached\|\d{10}/i,
  /^You['’]ve hit your (usage|session|weekly|5-hour|opus|sonnet|daily|monthly)\b[\w -]* limit\b/i,
  /^Your limit will reset at\b/i,
];
const FLAGGED_RE = /usage limit reached|hit your [\w -]*limit|limit will reset/i;
function limitNotice(transcriptPath) {
  if (!transcriptPath) return null;
  let lines;
  try { lines = fs.readFileSync(transcriptPath, 'utf8').trim().split(/\r?\n/).slice(-200); } catch { return null; }
  for (let i = lines.length - 1; i >= 0; i--) {
    let e; try { e = JSON.parse(lines[i]); } catch { continue; }
    if (e?.type !== 'assistant') continue;
    // This is the last assistant entry: decide on it alone.
    const ts = Date.parse(e.timestamp || '');
    if (Number.isFinite(ts) && Date.now() - ts > 10 * 60e3) return null; // an old turn, not this one
    const c = e.message?.content ?? e.content;
    const text = (typeof c === 'string' ? c : Array.isArray(c) ? c.filter((p) => p?.type === 'text').map((p) => p.text).join(' ') : '').trim();
    if (!text || text.length >= 400) return null;
    const flagged = e.isApiErrorMessage === true || e.message?.model === '<synthetic>' || e.error === 'rate_limit';
    if (!NOTICE_RE.some((re) => re.test(text)) && !(flagged && FLAGGED_RE.test(text))) return null;
    return { text, at: Number.isFinite(ts) ? ts : 0, until: resetTime(text) };
  }
  return null;
}

// The reset time as an absolute ISO timestamp, worked out here on the laptop (the board may run in another
// timezone, e.g. UTC in Docker). "…|1754500000" (epoch seconds), "resets 6:50pm (America/Denver)",
// "resets at 15:00", "resets in 2 hours". A time already past means "no time given".
function resetTime(text, now = Date.now()) {
  let at = null;
  const epoch = text.match(/\|(\d{10})\b/);
  const clock = text.match(/resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b(?:\s*\(([A-Za-z_]+(?:\/[A-Za-z_+-]+)+|UTC)\))?/i);
  const rel = text.match(/resets?\s+in\s+(\d+)\s*(h|hours?|m|min|minutes?)\b/i);
  if (epoch) at = Number(epoch[1]) * 1000;
  else if (clock && (clock[2] || clock[3])) {
    let h = Number(clock[1]); const m = Number(clock[2] || 0); const ampm = (clock[3] || '').toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    if (h < 24 && m < 60) at = nextWallClock(h, m, clock[4], now);
  } else if (rel) at = now + Number(rel[1]) * (/^h/i.test(rel[2]) ? 3600e3 : 60e3);
  return at && at > now ? new Date(at).toISOString() : null;
}
// The next time the clock reads h:m, in an IANA timezone if given (else this laptop's local time).
function nextWallClock(h, m, tz, now) {
  if (!tz) {
    const d = new Date(now); d.setHours(h, m, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  let fmt;
  try { fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }); }
  catch { return nextWallClock(h, m, null, now); } // unknown zone: fall back to local time
  const parts = (t) => Object.fromEntries(fmt.formatToParts(new Date(t)).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
  // The zone's offset at a given instant, in ms (wall time in the zone minus UTC).
  const offset = (t) => { const p = parts(t); return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute) - Math.floor(t / 60e3) * 60e3; };
  const today = parts(now);
  for (let add = 0; add < 2; add++) {
    const wall = Date.UTC(today.year, today.month - 1, today.day + add, h, m);
    let t = wall - offset(wall);
    t = wall - offset(t); // second pass settles DST edges
    if (t > now) return t;
  }
  return null;
}
async function reportUsageLimit({ input, url, token, agent, markFile }) {
  const notice = limitNotice(input.transcript_path);
  if (!notice) return false;
  const key = `${notice.at}|${notice.text.slice(0, 120)}`;
  let seen = '';
  try { seen = fs.readFileSync(markFile, 'utf8'); } catch {}
  if (seen === key) return true; // already reported this one: just let Claude stop
  try {
    const r = await fetch(`${url}/api/agents/${encodeURIComponent(agent)}/limit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Agent': agent, 'Content-Type': 'application/json' },
      body: JSON.stringify({ until: notice.until || undefined, note: `reported by its Stop hook: ${notice.text.slice(0, 120)}` }),
      signal: AbortSignal.timeout(10e3),
    });
    if (r.ok) fs.writeFileSync(markFile, key);
  } catch {}
  return true;
}

// Nothing new from teammates: ask the board whether this agent still has something to do right now.
// Older boards have no /api/next (404): then just allow the stop.
async function nudgeIfWork({ get, agent, nudgeFile }) {
  let last = 0;
  try { last = Number(fs.readFileSync(nudgeFile, 'utf8')) || 0; } catch {}
  if (Date.now() - last < NUDGE_EVERY_MS) return; // nudged recently: allow the stop
  let next;
  try { next = await get(`/api/next?agent=${encodeURIComponent(agent)}`); } catch { return; }
  if (!next?.actionable) return;
  fs.writeFileSync(nudgeFile, String(Date.now()));
  const reason =
    `The board has work for you${next.reason ? ` (${next.reason})` : ''}:\n${next.next_action || ''}\n\n` +
    'Do it now with the board MCP tools (call board_status if you need the details). ' +
    'If a claim is refused, follow the refusal\'s reason; if there is really nothing you can do, post a short status line in general and stop.';
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

try {
  await main();
} catch (e) {
  process.stderr.write(`board hook: ${e.message}\n`); // allow the stop
}
process.exitCode = 0;
// Keep-alive sockets can hold the process open; leave shortly after if they do.
setTimeout(() => process.exit(0), 1500).unref();
