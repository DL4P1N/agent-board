// Per-board timer bookkeeping: every timer a board starts is remembered, so closing the board stops them all.
export function createTimers() {
  const timers = [];
  const every = (fn, ms) => { const t = setInterval(fn, ms); t.unref?.(); timers.push(t); return t; };
  // A fired timeout leaves the list, so it doesn't grow with every one-off timer.
  const later = (fn, ms) => {
    const t = setTimeout(() => { forget(t); fn(); }, ms);
    t.unref?.(); timers.push(t); return t;
  };
  const forget = (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); };
  const clearAll = () => { for (const t of timers) { clearInterval(t); clearTimeout(t); } };
  return { every, later, forget, clearAll };
}
