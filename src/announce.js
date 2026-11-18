// Feature-freeze announcements for one board: the 30-minute warning, the freeze itself and the demo time.
import { timeInfo } from './board.js';

// Returns { clear }, which stops the extra checks scheduled for the deadline (close() calls it).
export function startAnnouncements({ board, announced, every, later, forget }) {
  // Announce the feature freeze (30 min warning, then the freeze itself) so waiting agents wake up.
  // Remembered in the board's data, so a restart (or `--watch` reload) doesn't announce twice;
  // a different freeze time (to the nearest 5 min) is announced again.
  const flagKey = (k, t) => `_announced_${k}_${Math.round(t.freezeAt / 300e3)}`;
  const announceTime = () => {
    if (board.closed) return;
    const t = timeInfo(board.getSettings());
    if (!t.deadline) return;
    const key = (k) => flagKey(k, t);
    const now = Date.now();
    if (!t.frozen && t.freezeAt - now <= 30 * 60e3 && !announced.has(key('warn'))) {
      announced.add(key('warn'));
      board.emit({ author: 'board', kind: 'message', channel: 'general', text: `@all Feature freeze in 30 minutes (${t.freezeLabel}); demo at ${t.deadlineLabel}. Don't start big tasks now. Aim to get what you have merged.` });
    }
    // A freeze "0 min before" starts at the deadline itself: still announce it (within a few minutes).
    if (t.frozen && (now < t.deadline || now - t.freezeAt < 5 * 60e3) && !announced.has(key('freeze'))) {
      announced.add(key('freeze'));
      board.emit({ author: 'board', kind: 'message', channel: 'general', text: `@all FEATURE FREEZE. Demo at ${t.deadlineLabel}. Don't claim new tasks. Finish, push and merge what you have; release anything that can't land in time.` });
    }
    // The demo time itself: wake waiting agents so they wrap up (not when the board starts long after it).
    const demoKey = `_announced_demo_${Math.round(t.deadline / 300e3)}`;
    if (t.past && now - t.deadline < 5 * 60e3 && !announced.has(demoKey)) {
      announced.add(demoKey);
      board.emit({ author: 'board', kind: 'message', channel: 'general', text: `@all Demo time (${t.deadlineLabel}). Wrap up: push and merge what's finished, release what isn't with a note, and post a short status in general.` });
    }
  };
  every(announceTime, 20e3);
  // Also check right at the warning, the freeze and the demo time, so nobody waits for the next tick.
  // Rescheduled only when the deadline or freeze time actually changes (other settings edits leave them
  // alone), with one set of handles: the old checks are cleared before new ones are scheduled.
  let announceTimers = [];
  let scheduledFor = null;
  const clearAnnounceTimers = () => {
    for (const t of announceTimers) { clearTimeout(t); forget(t); }
    announceTimers = [];
  };
  board.bus.on('event', (e) => {
    if (e?.kind !== 'settings') return;
    const t = timeInfo(board.getSettings());
    const key = t.deadline ? `${t.deadline}|${t.freezeAt}` : '';
    if (key === scheduledFor) return;
    scheduledFor = key;
    clearAnnounceTimers();
    // A new deadline or freeze time is checked at once: a short freeze could pass between two ticks.
    setImmediate(announceTime);
    if (!t.deadline) return;
    for (const at of [t.freezeAt - 30 * 60e3, t.freezeAt, t.deadline]) {
      const ms = at - Date.now() + 50;
      if (ms > 0 && ms < 2 ** 31 - 1) announceTimers.push(later(announceTime, ms));
    }
  });
  return { clear: clearAnnounceTimers };
}
