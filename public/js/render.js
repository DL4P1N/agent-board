// render(): the one pass that redraws the whole page from state and ui. It runs on every live event and keeps
// focus and half-typed text (patch, in helpers.js). It reads the page's layout first (where the feed is scrolled)
// and only then writes, so a pass that changes nothing doesn't make the browser lay the page out again and again.

import './derived.js';
import { $, BASE, me, SLUG, state, ui } from './state.js';
import { announce, setText } from './helpers.js';
import { inPass, openQuestions, setupInfo, unreadMentions } from './derived.js';
import { renderNeeds, renderNow, renderQuestions } from './needs.js';
import { checkNotify, renderBell, renderClock, renderTopbar } from './topbar.js';
import { renderSetup } from './setup.js';
import { fadeAgents, officeState, renderAgents } from './agents.js';
import { renderBoard, renderBoardEmpty, renderBoardNote, renderCi, renderFilter } from './tasks.js';
import { announceActivity, dmUnreadCount, feedPlace, markDmSeen, renderFeed, renderLocks } from './activity.js';
import { markMentionsSeen } from './actions.js';
import { renderDialogLive } from './task-dialog.js';
import { boardView, office } from './office.js';
import { renderDocks, renderOffice } from './panels.js';

// ---------- render ----------
let prevQIds = null;
function render() { return inPass(renderPass); }
function renderPass() {
  const feedAt = feedPlace(); // a read, before anything is written
  setText($('me'), me); $('me-btn').setAttribute('aria-label', `You: ${me}. Change your name`);
  // Presenter view opens with the read-only viewer token, never the board token; hidden until the server gives one.
  { const vt = state.setup?.viewer_token; const pl = $('present-link'); pl.hidden = !vt; $('present-row').hidden = !vt; if (vt) { const h = BASE + '/present.html?token=' + encodeURIComponent(vt); if (pl.getAttribute('href') !== h) pl.href = h; } }
  const { qOpen, unread } = renderTitle();
  if (ui.tab === 'me' && unread.length) { markMentionsSeen(); return render(); }
  // The open thread is read while it's on screen.
  if (ui.tab === 'direct' && ui.dm && document.visibilityState === 'visible' && markDmSeen(ui.dm)) renderTitle();
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
  renderFeed(unread.length, feedAt);
  renderLocks();
  renderDocks(qOpen);
  if ($('task-dlg').open) renderDialogLive();
  checkNotify(); announceActivity();
  if (boardView === 'office') { office.mod?.update(officeState()); if (!ui.dragging) renderOffice(); }
}
// The tab's title counts what waits for you; a new question is said once to screen readers.
function renderTitle() {
  const qOpen = openQuestions();
  // Screen readers: one polite announcement when a new question arrives (not on every refresh).
  if (prevQIds) {
    const fresh = qOpen.filter((q) => !prevQIds.has(q.id));
    if (fresh.length && qOpen.length > prevQIds.size) announce(fresh.length > 1 ? `${fresh.length} new questions for the humans` : `New question from ${fresh[0].asker}`);
  }
  prevQIds = new Set(qOpen.map((q) => q.id));
  const unread = unreadMentions();
  const dmN = dmUnreadCount();
  const title = (qOpen.length + unread.length + dmN ? `(${qOpen.length + unread.length + dmN}) ` : '') + (SLUG ? `${state.board?.name || SLUG} · ` : '') + 'Agent Board';
  if (document.title !== title) document.title = title;
  return { qOpen, unread };
}
// A tab in the background: only what shows or speaks from there (the title, desktop notifications, announcements).
// The rest is drawn when the tab is shown again (data.js).
function renderQuiet() { return inPass(() => { renderTitle(); checkNotify(); announceActivity(); }); }

export { render, renderQuiet };
