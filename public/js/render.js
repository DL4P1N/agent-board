// render(): the one pass that redraws the whole page from state and ui. It runs on every live event and keeps
// focus and half-typed text (patch, in helpers.js).

import './derived.js';
import { $, BASE, me, SLUG, state, ui } from './state.js';
import { announce } from './helpers.js';
import { openQuestions, setupInfo, unreadMentions } from './derived.js';
import { renderNeeds, renderNow, renderQuestions } from './needs.js';
import { checkNotify, renderBell, renderClock, renderTopbar } from './topbar.js';
import { renderSetup } from './setup.js';
import { fadeAgents, officeState, renderAgents } from './agents.js';
import { renderBoard, renderBoardEmpty, renderBoardNote, renderCi, renderFilter } from './tasks.js';
import { announceActivity, dmUnreadCount, markDmSeen, renderFeed, renderLocks } from './activity.js';
import { markMentionsSeen } from './actions.js';
import { renderDialogLive } from './task-dialog.js';
import { boardView, office, renderDocks, renderOffice } from './boot.js';

// ---------- render ----------
let prevQIds = null;
function render() {
  $('me').textContent = me; $('me-btn').setAttribute('aria-label', `You: ${me}. Change your name`);
  // Presenter view opens with the read-only viewer token, never the board token; hidden until the server gives one.
  { const vt = state.setup?.viewer_token; const pl = $('present-link'); pl.hidden = !vt; $('present-row').hidden = !vt; if (vt) pl.href = BASE + '/present.html?token=' + encodeURIComponent(vt); }
  const qOpen = openQuestions();
  // Screen readers: one polite announcement when a new question arrives (not on every refresh).
  if (prevQIds) {
    const fresh = qOpen.filter((q) => !prevQIds.has(q.id));
    if (fresh.length && qOpen.length > prevQIds.size) announce(fresh.length > 1 ? `${fresh.length} new questions for the humans` : `New question from ${fresh[0].asker}`);
  }
  prevQIds = new Set(qOpen.map((q) => q.id));
  const unread = unreadMentions();
  if (ui.tab === 'me' && unread.length) { markMentionsSeen(); return render(); }
  // The open thread is read while it's on screen.
  if (ui.tab === 'direct' && ui.dm && document.visibilityState === 'visible') markDmSeen(ui.dm);
  const dmN = dmUnreadCount();
  document.title = (qOpen.length + unread.length + dmN ? `(${qOpen.length + unread.length + dmN}) ` : '') + (SLUG ? `${state.board?.name || SLUG} · ` : '') + 'Agent Board';
  if (SLUG && state.board?.name) { const b = $('bname'); if (b.textContent !== state.board.name) { b.textContent = state.board.name; b.title = `Board "${state.board.name}" (/b/${SLUG}/) on this server`; } }
  renderNeeds(qOpen, unread);
  renderClock(); renderBell();
  const si = setupInfo();
  renderNow(qOpen, unread, si);
  renderTopbar(si);
  renderSetup(si);
  renderBoardEmpty(si);
  renderBoardNote(); renderCi();
  renderQuestions(qOpen);
  renderAgents(si, qOpen); requestAnimationFrame(fadeAgents);
  renderFilter();
  if (!ui.dragging) renderBoard();
  renderFeed(unread.length);
  renderLocks();
  renderDocks(qOpen, si);
  if ($('task-dlg').open) renderDialogLive();
  checkNotify(); announceActivity();
  if (boardView === 'office') { office.mod?.update(officeState()); if (!ui.dragging) renderOffice(); }
}

export { render };
