// Paper planes: the help-request feed (inside Comms).
import type { AgentState, HelpRequest, SimState } from '../types';
import type { UICtx } from './ctx';
import { fillSelect, h, setHidden, setText, toggleClass, fmtClock } from './dom';
import { providerName } from '../providers';
import { icon } from './icons';
import { cmd, dot, EMPTY, nameOf, agentOf } from './interact';
import './comms.css';

const STATUS_TONE: Record<HelpRequest['status'], string> = { open: 'warn', answered: 'ok', timeout: 'bad' };

interface HelpRow { el: HTMLElement; update(req: HelpRequest, state: SimState): void }

function endpoint(state: SimState, id: string): HTMLElement {
  const a = agentOf(state, id);
  return h('span', { class: 'who-tag', title: a ? `${a.name} (${providerName(a.provider)})` : id },
    a ? dot(a.provider, a.ownerColor) : null, h('span', { class: 'wt-name' }, nameOf(state, id)));
}

/** One help request as a compact row. Built once per request id and then diffed. */
function createHelpRow(req: HelpRequest, state: SimState): HelpRow {
  const route = h('span', { class: 'hr-route' });
  const ticket = h('span', { class: 'chip info hr-ticket' });
  const human = h('span', { class: 'chip violet', title: 'A human asked for this' }, 'human');
  const status = h('span', { class: 'chip' });
  const q = h('div', { class: 'hr-q' });
  const a = h('div', { class: 'hr-a' });
  const el = h('li', { class: 'help-row' },
    h('div', { class: 'hr-top' }, h('span', { class: 'hr-plane', 'aria-hidden': 'true' }, icon('plane')), route, ticket, h('span', { class: 'grow' }), human, status),
    q, a);
  let routeSig = '';
  const update = (r: HelpRequest, s: SimState): void => {
    const sig = `${r.fromAgent}>${r.toAgent}|${nameOf(s, r.fromAgent)}|${nameOf(s, r.toAgent)}`;
    if (sig !== routeSig) {
      routeSig = sig;
      route.replaceChildren(endpoint(s, r.fromAgent), h('span', { class: 'hr-arrow', 'aria-label': 'asks' }, '->'), endpoint(s, r.toAgent));
    }
    setHidden(ticket, !r.ticketId); setText(ticket, r.ticketId ?? '');
    setHidden(human, !r.byHuman);
    const open = r.status === 'open';
    setText(status, open ? `open ${fmtClock(s.time - r.t0)}` : r.status);
    const tip = open ? 'unanswered: time since the plane was thrown' : r.status;
    if (status.title !== tip) status.title = tip;
    const cls = `chip ${STATUS_TONE[r.status] ?? 'mute'}`;
    if (status.className !== cls) status.className = cls;
    setText(q, r.question ? r.question : '(no question given)');
    toggleClass(q, 'dim', !r.question);
    setHidden(a, !r.answer);
    if (r.answer) setText(a, r.answer);
    toggleClass(el, 'is-open', open);
  };
  update(req, state);
  return { el, update };
}

export interface HelpFeed { el: HTMLElement; update(state: SimState, visible?: boolean): void }

export function createHelpFeed(ctx: UICtx): HelpFeed {
  // ----- ask-for-help form
  const askerSel = h('select', { class: 'sel', 'aria-label': 'Who needs help' }) as HTMLSelectElement;
  const helperSel = h('select', { class: 'sel', 'aria-label': 'Who should help' }) as HTMLSelectElement;
  const question = h('input', { type: 'text', class: 'fld', placeholder: 'Question (optional)', 'aria-label': 'Question for the helper', maxLength: 200 }) as HTMLInputElement;
  const sendBtn = h('button', { type: 'submit', class: 'btn accent tiny' }, icon('plane'), ' Send plane');
  const formNote = h('span', { class: 'hf-note dim', role: 'status' });
  const form = h('form', { class: 'help-form', 'aria-label': 'Ask for help' },
    h('div', { class: 'hf-pair' }, askerSel, h('span', { class: 'hr-arrow dim', 'aria-hidden': 'true' }, '->'), helperSel),
    h('div', { class: 'hf-send' }, question, sendBtn), formNote);
  let noteTimer = 0;
  const validate = (): void => {
    const bad = !askerSel.value || !helperSel.value || askerSel.value === helperSel.value;
    sendBtn.disabled = bad;
    sendBtn.title = bad ? 'Pick two different agents' : 'Throw a paper plane';
  };
  askerSel.addEventListener('change', validate);
  helperSel.addEventListener('change', validate);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (sendBtn.disabled) return;
    cmd(ctx, 'requestHelp', askerSel.value, helperSel.value, question.value.trim() || undefined);
    question.value = '';
    setText(formNote, 'Plane sent');
    window.clearTimeout(noteTimer); noteTimer = window.setTimeout(() => setText(formNote, ''), 2000);
    ctx.refresh();
  });

  const summary = h('div', { class: 'hf-summary' });
  const empty = h('p', { class: 'hf-empty dim' }, 'No paper planes yet. Agents throw one when they get stuck - or send one yourself above.');
  const list = h('ul', { class: 'help-list', 'aria-label': 'Help requests, newest first' });
  const el = h('div', { class: 'help-feed' }, form, summary, empty, list);

  const rows = new Map<string, HelpRow>();
  let agentSig = '';
  const fill = (sel: HTMLSelectElement, opts: { value: string; label: string }[]): void => {
    const prev = sel.value;
    fillSelect(sel, opts);
    if (opts.some((o) => o.value === prev)) sel.value = prev;
  };
  const rebuildAgents = (agents: AgentState[]): void => {
    const sig = agents.map((a) => `${a.id}:${a.name}:${a.role}:${a.phase === 'offline' ? 0 : 1}`).join('|');
    if (sig === agentSig) return;
    agentSig = sig;
    const workers = agents.filter((a) => a.role === 'worker');
    const label = (a: AgentState): string => `${a.name}${a.phase === 'offline' ? ' (offline)' : ''}`;
    const askerPrev = askerSel.value, helperPrev = helperSel.value;
    fill(askerSel, workers.map((a) => ({ value: a.id, label: label(a) })));
    fill(helperSel, [...workers.map((a) => ({ value: a.id, label: label(a) })), ...agents.filter((a) => a.role === 'orchestrator').map((a) => ({ value: a.id, label: 'Orchestrator' }))]);
    // sensible defaults: first worker asks, second worker (or the orchestrator) helps
    if (!askerPrev && workers[0]) askerSel.value = workers[0].id;
    if (!helperPrev) helperSel.value = (workers[1] ?? agents.find((a) => a.role === 'orchestrator'))?.id ?? '';
    validate();
  };

  const update = (state: SimState, visible = true): void => {
    if (!visible) return;
    rebuildAgents(state.agents);
    const help = state.help ?? EMPTY;
    const m = state.metrics;
    const total = m?.helpTotal ?? help.length;
    const open = m?.helpOpen ?? help.filter((r) => r.status === 'open').length;
    setText(summary, `${total} request${total === 1 ? '' : 's'} - ${open} open`);
    setHidden(empty, help.length > 0);
    setHidden(list, help.length === 0);
    // reconcile rows (newest first)
    const seen = new Set<string>();
    let idx = 0;
    for (let i = help.length - 1; i >= 0; i--) {
      const r = help[i];
      seen.add(r.id);
      let row = rows.get(r.id);
      if (!row) { row = createHelpRow(r, state); rows.set(r.id, row); }
      else row.update(r, state);
      if (list.children[idx] !== row.el) list.insertBefore(row.el, list.children[idx] ?? null);
      idx++;
    }
    for (const [id, row] of rows) if (!seen.has(id)) { row.el.remove(); rows.delete(id); }
  };
  return { el, update };
}
