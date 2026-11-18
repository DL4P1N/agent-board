// The live stream (server-sent events) the web board and the presenter view listen to, and who is watching.
import { normName, DIRECT } from './board.js';
import { agentFrom } from './http-util.js';
import { clientIp } from './request-limits.js';

// A client that stops reading (a laptop asleep on a half-open connection) would have every event buffered for it
// in the server's memory: once its writes have stayed backed up for STUCK_MS, or more than MAX_BUFFERED is waiting,
// it is dropped. A page that's really there reconnects by itself and reloads the board.
const STUCK_MS = 60e3;
const MAX_BUFFERED = 4 * 1024 * 1024;

// Open streams are tracked so a token rotation (or archiving) can close them.
export function createStreams({ board, holdSlot, presence, isClosed }) {
  // Humans with the web board open (by name -> open SSE connection count).
  const humansOnline = new Map();
  const onlineHumans = () => new Set([...humansOnline].filter(([, n]) => n > 0).map(([k]) => k));
  // Each open stream's stop(): its listener and pings stop before its response ends.
  const openStreams = new Set();
  const closeStreams = () => { for (const stop of [...openStreams]) stop(); };

  // GET /stream on the board's API router.
  function mount(api) {
    api.get('/stream', (req, res) => {
      // ?name=<human> marks that person as watching the board.
      // Only the human token marks someone as watching (the viewer token is a projector, not a person).
      const human = req.role === 'human' ? normName(req.query.name).replace(/[^\w.-]/g, '').slice(0, 64) : '';
      // Live pages count toward the open-slot limits too: per person (or per address for the presenter view).
      if (!holdSlot(req, res, human ? `stream:${human}` : `stream:${req.role}:${clientIp(req)}`, human || 'this address', false)) return;
      res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.flushHeaders();
      let backedUp = 0; // since when this client's writes have been waiting (0: they aren't)
      const write = (text) => {
        if (res.writableEnded || res.destroyed) return;
        res.write(text);
        if (!res.writableNeedDrain) { backedUp = 0; return; }
        backedUp ||= Date.now();
        if (res.writableLength > MAX_BUFFERED || Date.now() - backedUp > STUCK_MS) { stop(); res.destroy(); }
      };
      res.on('drain', () => { backedUp = 0; });
      // Direct messages go to humans only (an agent's stream: its own threads; the presenter's: none).
      const send = (ev) => {
        if (ev?.channel === DIRECT && req.role !== 'human' && !(req.role === 'agent' && board.canSee(ev, agentFrom(req)))) return;
        write(`data: ${JSON.stringify(ev)}\n\n`);
      };
      const ping = setInterval(() => write(': ping\n\n'), 20000);
      board.bus.on('event', send);
      const stop = () => {
        openStreams.delete(stop);
        clearInterval(ping);
        board.bus.off('event', send);
        try { res.end(); } catch {}
      };
      openStreams.add(stop);
      if (human) {
        humansOnline.set(human, (humansOnline.get(human) || 0) + 1);
        board.touch(human, 'human');
        presence();
      }
      req.on('close', () => {
        stop();
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
