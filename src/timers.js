// Per-board timer bookkeeping: every timer a board starts is remembered, so closing the board stops them all.
// A timer's error is logged, never thrown: an uncaught one would stop the whole server with every board on it.
export function createTimers() {
  const timers = [];
  const safe = (fn) => () => {
    try {
      const r = fn();
      if (r && typeof r.catch === 'function') r.catch((e) => console.error('board timer failed:', e));
    } catch (e) { console.error('board timer failed:', e); }
  };
  const every = (fn, ms) => { const t = setInterval(safe(fn), ms); t.unref?.(); timers.push(t); return t; };
  // A fired timeout leaves the list, so it doesn't grow with every one-off timer.
  const later = (fn, ms) => {
    const run = safe(fn);
    const t = setTimeout(() => { forget(t); run(); }, ms);
    t.unref?.(); timers.push(t); return t;
  };
  const forget = (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); };
  const clearAll = () => { for (const t of timers) { clearInterval(t); clearTimeout(t); } };
  return { every, later, forget, clearAll };
}
