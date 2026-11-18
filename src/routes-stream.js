// The live stream (server-sent events) the web board and the presenter view listen to, and who is watching.
import { normName, DIRECT } from './board.js';
import { agentFrom } from './http-util.js';
import { clientIp } from './request-limits.js';

// Open streams are tracked so a token rotation (or archiving) can close them.
export function createStreams({ board, holdSlot, presence, isClosed }) {
  // Humans with the web board open (by name -> open SSE connection count).
  const humansOnline = new Map();
  const onlineHumans = () => new Set([...humansOnline].filter(([, n]) => n > 0).map(([k]) => k));
  const openStreams = new Set();
  const closeStreams = () => { for (const s of openStreams) { try { s.end(); } catch {} } openStreams.clear(); };

  // GET /stream on the board's API router.
  function mount(api) {
    api.get('/stream', (req, res) => {
      // Live pages count toward the open-slot limits too: per person (or per address for the presenter view).
      const viewer = req.role === 'human' ? normName(req.query.name).replace(/[^\w.-]/g, '').slice(0, 64) : '';
      if (!holdSlot(req, res, viewer ? `stream:${viewer}` : `stream:${req.role}:${clientIp(req)}`, viewer || 'this address', false)) return;
      res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.flushHeaders();
      openStreams.add(res);
      // Direct messages go to humans only (an agent's stream: its own threads; the presenter's: none).
      const send = (ev) => {
        if (ev?.channel === DIRECT && req.role !== 'human' && !(req.role === 'agent' && board.canSee(ev, agentFrom(req)))) return;
        res.write(`data: ${JSON.stringify(ev)}\n\n`);
      };
      const ping = setInterval(() => res.write(': ping\n\n'), 20000);
      board.bus.on('event', send);
      // ?name=<human> marks that person as watching the board.
      // Only the human token marks someone as watching (the viewer token is a projector, not a person).
      const human = req.role === 'human' ? normName(req.query.name).replace(/[^\w.-]/g, '').slice(0, 64) : '';
      if (human) {
        humansOnline.set(human, (humansOnline.get(human) || 0) + 1);
        board.touch(human, 'human');
        presence();
      }
      req.on('close', () => {
        openStreams.delete(res);
        clearInterval(ping);
        board.bus.off('event', send);
        if (human && !isClosed()) {
          humansOnline.set(human, Math.max(0, (humansOnline.get(human) || 1) - 1));
          board.touch(human, 'human');
          presence();
        }
      });
    });
  }

  return { onlineHumans, closeStreams, mount };
}
