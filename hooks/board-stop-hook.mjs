#!/usr/bin/env node
// Claude Code Stop hook: when Claude is about to end its turn, check the board.
// If teammates posted anything new, block the stop and feed the events back in,
// so the orchestrator reacts without a human typing. If nothing new arrived but the
// board has work for this agent (a task it may claim, a review, proposals to decide…),
// nudge it once, at most every few minutes, so a refused claim can't loop forever.
// When Claude is already continuing because of this hook (stop_hook_active), it neither waits
// nor nudges: it only reports new activity, so the human gets the terminal back after one round.
//
// Config (env vars override ~/.claude-board.json written by `npm run join`):
//   BOARD_URL, BOARD_TOKEN, BOARD_AGENT
//   BOARD_HOOK_WAIT  seconds to long-poll for new events before letting Claude stop (0 = don't wait)
//   BOARD_HOOK=off   disable the hook
//
// Exits by returning (process.exitCode), never process.exit(): exiting while fetch sockets close
// crashes Node on Windows, and Claude Code ignores a hook that exits abnormally.
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
  const boardKey = Buffer.from(url).toString('base64url').slice(-16);
  const cursorFile = path.join(os.tmpdir(), `claude-board-cursor-${agent.replace(/[^\w.-]/g, '_')}-${boardKey}`);
  const get = async (p) => {
    const r = await fetch(url + p, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout((wait + 15) * 1000) });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return r.json();
  };

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
