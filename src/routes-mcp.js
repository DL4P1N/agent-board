// The MCP endpoint of a board (stateless streamable HTTP), at <board>/mcp.
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { callerLaptop } from './board.js';
import { buildMcpServer } from './mcp.js';
import { agentFrom } from './http-util.js';

// Friendly name for the AI tool behind an MCP connection (from initialize's clientInfo.name).
function clientLabel(info) {
  const n = String(info?.name || '').toLowerCase();
  if (!n) return null;
  if (n.includes('claude')) return 'Claude Code';
  if (n.includes('codex')) return 'Codex';
  if (n.includes('gemini')) return 'Gemini CLI';
  if (n.includes('cursor')) return 'Cursor';
  if (n.includes('visual studio code') || n.includes('vscode')) return 'Copilot (VS Code)';
  if (n.includes('copilot')) return 'Copilot CLI';
  return String(info.name).slice(0, 40);
}

export function mountMcp(router, { board, auth, agentLimit, holdSlot, presence }) {
  // ---------- MCP (stateless streamable HTTP) ----------
  router.post('/mcp', auth, async (req, res) => {
    if (req.role === 'viewer') return res.status(403).json({ jsonrpc: '2.0', error: { code: -32001, message: 'The viewer token is read-only.' }, id: null });
    if (!agentLimit(req, res, agentFrom(req), true)) return;
    if (req.body?.method === 'tools/call' && req.body?.params?.name === 'wait_for_events') {
      const who = agentFrom(req).split('/')[0];
      if (!holdSlot(req, res, `wait:${who}`, who, true)) return;
    }
    // An agent that just came online: nudge web boards to refresh (SSE {kind:'presence'}).
    // ?probe=1: a connection check (join/doctor), not a running agent, so it doesn't count as presence.
    const probe = req.query.probe === '1';
    const cameOnline = !probe && board.touch(agentFrom(req), 'agent');
    const clientChanged = !probe && req.body?.method === 'initialize' && board.setClient(agentFrom(req), clientLabel(req.body.params?.clientInfo));
    // The agent's subscription (join puts ?plan=…&slots=N in the URL): how many tasks it may hold at once.
    const planChanged = !probe && (req.query.plan || req.query.slots) && board.setPlan(agentFrom(req), req.query.plan, req.query.slots);
    // Which person this agent belongs to (join sends ?person=), and which laptop it runs on (?laptop=, from
    // join; older setups: the network address), to group a laptop's tools and spot one name on two laptops.
    const personChanged = !probe && req.query.person && board.setPerson(agentFrom(req), req.query.person, 'join');
    const laptop = String(req.query.laptop || '').replace(/[^\w-]/g, '').slice(0, 32)
      || `ip:${String(req.get('cf-connecting-ip') || req.socket.remoteAddress || '').slice(0, 64)}`;
    const laptopChanged = !probe && board.noteLaptop(agentFrom(req), laptop);
    // One name, one laptop: the first laptop whose agent is online under a name owns it; the second one is
    // told to stop and may not claim or change tasks (needs join's ?laptop=; network addresses vary).
    const laptopId = laptop.startsWith('ip:') ? null : laptop;
    if (!probe && laptopId) board.claimName(agentFrom(req), laptopId, req.query.person || null);
    if (cameOnline || clientChanged || planChanged || personChanged || laptopChanged) presence();
    const server = buildMcpServer(board, agentFrom(req));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    try {
      await callerLaptop.run(laptopId, async () => {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      });
    } catch (e) {
      console.error('mcp error', e);
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'internal error' }, id: null });
    }
  });
  const methodNotAllowed = (_req, res) =>
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed (stateless server)' }, id: null });
  router.get('/mcp', methodNotAllowed);
  router.delete('/mcp', methodNotAllowed);
}
