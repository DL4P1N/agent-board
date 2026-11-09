#!/usr/bin/env node
// Claude Code Stop hook: when Claude is about to end its turn, check the board.
// If teammates posted anything new, block the stop and feed the events back in,
// so the orchestrator reacts without a human typing.
//
// Config (env vars override ~/.claude-board.json written by `npm run join`):
//   BOARD_URL, BOARD_TOKEN, BOARD_AGENT
//   BOARD_HOOK_WAIT  seconds to long-poll for new events before letting Claude stop (0 = don't wait)
//   BOARD_HOOK=off   disable the hook
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const allowStop = () => process.exit(0);

let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude-board.json'), 'utf8')); } catch {}
const url = (process.env.BOARD_URL || cfg.url || '').replace(/\/$/, '');
const token = process.env.BOARD_TOKEN || cfg.token;
const agent = process.env.BOARD_AGENT || cfg.agent;
const wait = Number(process.env.BOARD_HOOK_WAIT ?? cfg.hook_wait ?? 0);
if (process.env.BOARD_HOOK === 'off' || !url || !token || !agent) allowStop();

// Drain stdin (hook input JSON); we don't need it but must not leave the pipe hanging.
try { fs.readFileSync(0); } catch {}

const cursorFile = path.join(os.tmpdir(), `claude-board-cursor-${agent.replace(/[^\w.-]/g, '_')}`);
const headers = { Authorization: `Bearer ${token}` };

async function get(p) {
  const r = await fetch(url + p, { headers, signal: AbortSignal.timeout((wait + 15) * 1000) });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

try {
  let since;
  try { since = Number(fs.readFileSync(cursorFile, 'utf8')); } catch {}
  if (!Number.isFinite(since)) {
    // First run: start from now, don't dump history.
    const { cursor } = await get('/api/cursor');
    fs.writeFileSync(cursorFile, String(cursor));
    allowStop();
  }

  const q = `/api/events?since=${since}&exclude=${encodeURIComponent(agent)}&wait=${wait}`;
  const { events, cursor } = await get(q);
  fs.writeFileSync(cursorFile, String(cursor));

  const relevant = events.filter((e) => !['lock', 'unlock'].includes(e.kind));
  if (!relevant.length) allowStop();

  const mentionsMe = (e) => (e.data?.mentions || []).some((m) => m === agent || m.startsWith(agent + '/') || m === 'all' || m === 'everyone');
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
  process.exit(0);
} catch (e) {
  process.stderr.write(`board hook: ${e.message}\n`);
  allowStop();
}
