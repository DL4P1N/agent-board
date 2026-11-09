#!/usr/bin/env node
// End-to-end check against a running board: two MCP clients act as different agents.
//   BOARD_URL=http://localhost:4000 BOARD_TOKEN=... node scripts/smoke-test.mjs
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import assert from 'node:assert/strict';

const URL_ = (process.env.BOARD_URL || 'http://localhost:4000').replace(/\/$/, '');
const TOKEN = process.env.BOARD_TOKEN;
if (!TOKEN) { console.error('set BOARD_TOKEN'); process.exit(1); }
const tag = Date.now().toString(36);

async function agent(name) {
  const c = new Client({ name: `smoke-${name}`, version: '1.0.0' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${URL_}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${TOKEN}`, 'X-Agent': name } },
  }));
  const call = async (tool, args = {}) => {
    const r = await c.callTool({ name: tool, arguments: args });
    const text = r.content[0].text;
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { error: !!r.isError, body };
  };
  return { c, call };
}

const a = await agent(`alice${tag}`);
const b = await agent(`bob${tag}`);

const tools = (await a.c.listTools()).tools.map((t) => t.name);
console.log('tools:', tools.join(', '));
assert.ok(tools.includes('wait_for_events'));

const st = await a.call('board_status');
const cursor0 = st.body.cursor;

const t1 = (await a.call('create_task', { title: `Schema ${tag}`, priority: 1 })).body;
const t2 = (await a.call('create_task', { title: `API ${tag}`, depends_on: [t1.id] })).body;

// dependency enforced
const dep = await b.call('claim_task', { id: t2.id });
assert.ok(dep.error && /depends on/.test(dep.body), 'dependency should block claim');

// claim race: only one wins
const [r1, r2] = await Promise.all([a.call('claim_task', { id: t1.id, as: 'db-worker' }), b.call('claim_task', { id: t1.id })]);
assert.equal([r1, r2].filter((r) => !r.error).length, 1, 'exactly one claim succeeds');
const winner = r1.error ? b : a;
const loser = r1.error ? a : b;
console.log('claim winner:', (r1.error ? r2 : r1).body.assignee, 'branch:', (r1.error ? r2 : r1).body.branch);

// locks: winner locks, loser conflicts, winner's teammate can renew
assert.ok((await winner.call('lock_files', { paths: ['db/schema.sql'], task_id: t1.id })).body.ok);
const conflict = (await loser.call('lock_files', { paths: ['db/schema.sql', 'x.js'] })).body;
assert.equal(conflict.ok, false);
assert.equal(conflict.conflicts[0].path, 'db/schema.sql');

// other agent can't change winner's task status
assert.ok((await loser.call('update_task', { id: t1.id, status: 'done' })).error);

// wait_for_events wakes on another agent's post, ignores own
const t0 = Date.now();
const latest = (await a.call('board_status')).body.cursor;
const waitReal = loser.call('wait_for_events', { since: latest, timeout_s: 10 });
await new Promise((r) => setTimeout(r, 400));
await loser.call('post', { text: 'own post, should be ignored' });
await winner.call('post', { text: `@everyone schema lands soon ${tag}`, channel: 'general' });
const woke = (await waitReal).body;
console.log(`wait_for_events woke after ${Date.now() - t0}ms with ${woke.events.length} event(s)`);
assert.ok(woke.events.length >= 1 && woke.events.every((e) => !e.author.startsWith(loser === a ? `alice${tag}` : `bob${tag}`)));
assert.ok(woke.events.some((e) => e.data?.mentions?.includes('everyone')));
void cursor0;

// done releases locks and unblocks dependent
await winner.call('update_task', { id: t1.id, status: 'done', note: 'merged' });
const locks = (await a.call('list_locks')).body;
assert.ok(!locks.some((l) => l.path === 'db/schema.sql'), 'locks released on done');
assert.ok(!(await loser.call('claim_task', { id: t2.id })).error, 'dependent claimable after done');

// ask_human
const q = (await loser.call('ask_human', { question: `Dark mode? ${tag}` })).body;
assert.ok(q.question_id);

console.log('\nALL SMOKE TESTS PASSED');
await a.c.close(); await b.c.close();
