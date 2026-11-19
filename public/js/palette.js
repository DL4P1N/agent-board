// The command palette (Ctrl+K). Every command runs something that already exists in the page.

import './panels.js';
import { $, BASE, LABEL, me, smooth, state, ui } from './state.js';
import { esc, youTag } from './helpers.js';
import { openQuestions, people, setupShown } from './derived.js';
import { doAct, goQuestion, helpDlg, openHelp, setFilter } from './actions.js';
import { openTask, setDlgBackTo } from './task-dialog.js';
import { setTheme, THEME_LIST, themePref } from './theme.js';
import { boardView, officeAllowed, setBoardView } from './office.js';
import { oExpand, oGoal, oMax, oMaxLabel, oShow, oTasksOff, pickAgent } from './panels.js';
import { tv } from './tasks.js';

// ---------- command palette (Ctrl+K) ----------
// Every command runs something that already exists in the page: it never does anything new by itself.
const palDlg = $('pal-dlg'), palIn = $('pal-in'), palList = $('pal-list');
let palItems = [], palSel = 0, palPrev = null, palNext = null, palSay = 0;
const PAL_MAX = 40;
function palCommands() {
  const cmds = [];
  const add = (kind, label, run, extra = '') => cmds.push({ kind, label, run, hay: (label + ' ' + extra).toLowerCase() });
  const oq = openQuestions()[0];
  if (oq) add('Action', `Answer the oldest question (from ${oq.asker})`, () => goQuestion(oq.id), 'reply ' + oq.question);
  add('Action', 'New task', () => openTask(null), 'add create');
  if (officeAllowed()) add('View', boardView === 'office' ? 'Turn the 3D office off' : 'Turn the 3D office on', () => setBoardView(boardView === 'office' ? 'board' : 'office'), 'view office 3d scene characters background performance power');
  if (boardView === 'office' && !oTasksOff()) add('View', oMaxLabel(), () => oExpand(!oMax()), 'view office board tasks expand dock show the office slide');
  const vt = state.setup?.viewer_token;
  if (vt) add('Action', 'Open the presenter view (new tab)', () => window.open(BASE + '/present.html?token=' + encodeURIComponent(vt), '_blank', 'noopener'), 'projector big screen present 3d office');
  if (vt) add('Action', 'Open the session recap (new tab)', () => window.open(BASE + '/recap.html?token=' + encodeURIComponent(vt), '_blank', 'noopener'), 'recap retro summary report after session stats print');
  add('Action', state.settings?.deadline ? 'Edit the demo time' : 'Set the demo time', () => doAct('clock'), 'deadline clock countdown freeze');
  // The top bar's chips and the task bar's switch, in the words their own buttons use.
  add('Action', state.settings?.goal ? 'Edit the goal' : 'Set the goal', () => oGoal(true, { edit: true }), 'goal building demo');
  add('Action', setupShown() ? 'Close Setup' : 'Open Setup', () => doAct(setupShown() ? 'setup-close' : 'setup-open'), 'setup steps invite connect laptop join');
  const roles = matchMedia('(max-width: 1599px)').matches;
  add('Action', roles ? 'Choose the planner and who merges' : 'Choose the planner', () => doAct(roles ? 'roles' : 'planner'), 'planner roles');
  if (!roles) add('Action', 'Choose who merges', () => doAct('merge'), 'merges to main merger integrator roles');
  if (state.tasks.length) add('View', tv.view === 'table' ? 'Show Columns' : 'Show Table', () => { const b = $('viewtog').querySelector(`[data-view="${tv.view === 'table' ? 'columns' : 'table'}"]`); b.click(); return b; }, 'tasks view columns table list');
  add('Action', 'Write a message in chat', () => { oShow('act'); $('msg').scrollIntoView({ behavior: smooth(), block: 'center' }); $('msg').focus({ preventScroll: true }); }, 'focus chat');
  add('Action', 'Open help', openHelp, 'what everything means keyboard');
  const others = people().map((p) => p.name).filter((n) => n !== me);
  add('Filter', 'Show tasks for everyone', () => setFilter(''), 'filter show');
  add('Filter', `Show tasks for my team (${me})`, () => setFilter('me'), 'filter show mine');
  for (const n of others) add('Filter', `Show tasks for ${n}`, () => setFilter(n), 'filter show');
  for (const [v, l, d] of THEME_LIST) add('Theme', `Theme: ${l}${v === themePref ? ' ✓' : ''}`, () => setTheme(v), `switch colour mode palette ${d} ${v}${v === 'auto' ? ' follow the device' : ''}${v === themePref ? ' current' : ''}`);
  for (const p of people()) add('Person', `Go to ${p.name}${youTag(p.name)} in Agents`, () => {

    // Their first agent, selected (what it holds and its controls), or their row when they have none.
    oShow('right'); const a = p.r.agents?.[0];
    if (a && ui.picked !== a.name) pickAgent(a.name, true);
    const el = document.querySelector(a ? `[data-fk="oa-${CSS.escape(a.name)}"]` : `[data-person-row="${CSS.escape(p.name)}"] button`) || document.querySelector(`[data-person-row="${CSS.escape(p.name)}"]`);
    if (el && !el.matches('button')) el.tabIndex = -1;
    el?.scrollIntoView({ behavior: smooth(), block: 'center' }); el?.focus({ preventScroll: true });
  }, p.name + ' person agent people');
  for (const t of state.tasks) add('Task', `#${t.id} ${t.title}`, () => { openTask(t.id); setDlgBackTo(t.id); }, `${LABEL[t.status] || t.status} ${t.assignee || ''}`);
  return cmds;
}
function palFilter(q) {
  const all = palCommands(); const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return all.filter((c) => c.kind === 'Action' || c.kind === 'View' || c.kind === 'Theme').slice(0, PAL_MAX);
  const idm = /^#?(\d+)$/.exec(q.trim());
  const rank = (c) => (idm && c.kind === 'Task' && c.label.startsWith('#' + idm[1] + ' ') ? 0 : c.kind === 'Task' ? 3 : c.kind === 'Person' ? 2 : 1);
  return all.filter((c) => words.every((w) => c.hay.includes(w))).map((c, i) => [c, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]).slice(0, PAL_MAX);
}
function palRender() {
  palItems = palFilter(palIn.value);
  palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
  // The kind only where the label doesn't say it: actions and themes ("Theme: Dusk") go without.
  palList.innerHTML = palItems.map((c, i) => `<li role="option" id="pal-o-${i}" data-i="${i}" aria-selected="${i === palSel}"><span class="pl">${esc(c.label)}</span>${c.kind === 'Action' || c.kind === 'Theme' ? '' : `<span class="pk">${c.kind}</span>`}</li>`).join('');

  $('pal-empty').hidden = palItems.length > 0;
  palIn.setAttribute('aria-activedescendant', palItems.length ? 'pal-o-' + palSel : '');
  // Said inside the dialog (a modal hides the page's own announcer from screen readers), once the typing settles.
  clearTimeout(palSay); palSay = setTimeout(() => { $('pal-count').textContent = palItems.length ? `${palItems.length} result${palItems.length === 1 ? '' : 's'}` : 'Nothing matches'; }, 250);
}
function palSelect(i) {
  if (!palItems.length) return;
  palSel = (i + palItems.length) % palItems.length;
  for (const li of palList.children) li.setAttribute('aria-selected', String(Number(li.dataset.i) === palSel));
  palIn.setAttribute('aria-activedescendant', 'pal-o-' + palSel);
  $('pal-o-' + palSel)?.scrollIntoView({ block: 'nearest' });
}
function openPalette() {
  if ($('app').hidden || $('task-dlg').open || palDlg.open) return;
  palPrev = document.activeElement; palSel = 0; palIn.value = ''; $('pal-count').textContent = '';
  if (helpDlg.open) helpDlg.close();
  palDlg.showModal(); palRender(); palIn.focus();
}
function togglePalette() { if (palDlg.open) palDlg.close(); else openPalette(); }
function palRun(i) {
  const c = palItems[i]; if (!c) return;
  // The command runs once the palette has closed and handed focus back, so the focus it sets is where you land.
  palNext = c.run; palDlg.close();
}
// Closed: focus goes back where it was first, so a command that opens something (help, a task) hands focus back there.
palDlg.addEventListener('close', () => {
  const run = palNext; palNext = null;
  if (palPrev?.isConnected) palPrev.focus({ preventScroll: true });
  palPrev = null;
  // ...and once it has faded out: a command that redraws the whole page (the 3D switch, a theme) would freeze its fade.
  // A command that hid what had focus (Show Table from a card): focus goes to the control it used, or what it opened.
  const go = run && (() => { const used = run(); if (document.activeElement === document.body || !document.activeElement?.offsetParent) (used instanceof Element && used.offsetParent ? used : null)?.focus({ preventScroll: true }); });
  if (go) { const fade = palDlg.getAnimations(); if (fade.length) Promise.all(fade.map((a) => a.finished.catch(() => {}))).then(go); else setTimeout(go); }
});
palIn.addEventListener('input', () => { palSel = 0; palRender(); });
palIn.addEventListener('keydown', (ev) => {
  if (ev.key === 'ArrowDown') { ev.preventDefault(); palSelect(palSel + 1); }
  else if (ev.key === 'ArrowUp') { ev.preventDefault(); palSelect(palSel - 1); }
  else if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); palRun(palSel); }
});
palList.addEventListener('click', (ev) => { const li = ev.target.closest('li'); if (li) palRun(Number(li.dataset.i)); });
palList.addEventListener('mousemove', (ev) => { const li = ev.target.closest('li'); if (li && Number(li.dataset.i) !== palSel) palSelect(Number(li.dataset.i)); });
palDlg.addEventListener('click', (ev) => { if (ev.target === palDlg) palDlg.close(); }); // the backdrop

export { togglePalette };
