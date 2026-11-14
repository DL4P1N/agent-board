// COMMS window: chat with the Orchestrator / any agent / everyone + the paper-plane help feed. Key: C.
import { providerName } from '../providers';
import type { AgentState, ChatMessage, SimState } from '../types';
import type { Panel, UICtx } from './ctx';
import { fmtClock, h, setHidden, setText, toggleClass, setAttr } from './dom';
import { hudWindow, type HudWin } from './hud';
import { icon } from './icons';
import { agentOf, cmd, dot, EMPTY, CHAT_HELP, CHAT_SUGGESTIONS, fuzzy, nameOf, ROLE_ICON, snippet, type ChatHelpEntry } from './interact';
import { createHelpFeed } from './helpFeed';
import './comms.css';

export interface CommsPanel extends Panel {
  win: HudWin;
  /** Open the window (optionally pre-selecting a recipient) and focus the input. */
  open(to?: string): void;
  toggle(): void;
  focusInput(): void;
  setRecipient(id: string): void;
}

const MAX_ROWS = 200;
const MAX_CHARS = 600;
let slashSeq = 0;

export function createComms(ctx: UICtx): CommsPanel {
  const win = hudWindow(ctx, 'comms', 'Comms', true, 'comms-win', {
    zone: 'bottom', defaultSize: { w: 23, h: 26 }, minSize: { w: 17, h: 15 },
    // floats above the bottom strip, against the right dock
    place: (l, size) => { const hh = Math.min(size.h, l.bottomY - l.stripH - l.gap - l.topY); return { x: l.rightX - size.w, y: l.bottomY - l.stripH - l.gap - hh, w: size.w, h: hh }; },
  });
  win.body.classList.add('comms-body');
  win.extras.append(h('span', { class: 'key-hint', title: 'Press C to toggle' }, 'C'));

  let tab: 'chat' | 'planes' = 'chat';
  let to = 'orch';

  // ---------------------------------------------------------------- tabs
  const chatBadge = h('b', { class: 'tab-badge', hidden: true });
  const planeBadge = h('b', { class: 'tab-badge warn', hidden: true });
  const chatTab = h('button', { type: 'button', class: 'ctab on', role: 'tab', id: 'comms-tab-chat', 'aria-selected': 'true', 'aria-controls': 'comms-pane-chat', onClick: () => setTab('chat') }, icon('chat'), 'Chat', chatBadge);
  const planeTab = h('button', { type: 'button', class: 'ctab', role: 'tab', id: 'comms-tab-planes', 'aria-selected': 'false', 'aria-controls': 'comms-pane-planes', tabIndex: -1, onClick: () => setTab('planes') }, icon('plane'), 'Paper planes', planeBadge);
  const tabs = h('div', { class: 'comms-tabs', role: 'tablist', 'aria-label': 'Comms' }, chatTab, planeTab);
  tabs.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setTab(tab === 'chat' ? 'planes' : 'chat'); (tab === 'chat' ? chatTab : planeTab).focus(); }
  });

  // ---------------------------------------------------------------- recipient picker
  const rcptDot = h('span', { class: 'rcpt-dot' });
  const rcptName = h('span', { class: 'rcpt-name' });
  const rcptBtn = h('button', { type: 'button', class: 'rcpt-btn', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': 'Choose who to talk to' },
    h('span', { class: 'dim' }, 'To'), rcptDot, rcptName, h('span', { class: 'rcpt-caret', 'aria-hidden': 'true' }, icon('chev')));
  const rcptList = h('div', { class: 'rcpt-list', role: 'listbox', 'aria-label': 'Recipients', hidden: true });
  const picker = h('div', { class: 'rcpt' }, rcptBtn, rcptList);
  const rcptBtns = new Map<string, HTMLButtonElement>();
  let rcptSig = '';

  const closePicker = (refocus = false): void => {
    if (rcptList.hidden) return;
    rcptList.hidden = true; rcptBtn.setAttribute('aria-expanded', 'false');
    if (refocus) rcptBtn.focus();
  };
  const openPicker = (): void => {
    rcptList.hidden = false; rcptBtn.setAttribute('aria-expanded', 'true');
    (rcptBtns.get(to) ?? rcptBtns.values().next().value)?.focus();
  };
  rcptBtn.addEventListener('click', () => (rcptList.hidden ? openPicker() : closePicker()));
  rcptBtn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' && rcptList.hidden) { e.preventDefault(); openPicker(); } });
  rcptList.addEventListener('keydown', (e) => {
    const opts = [...rcptBtns.values()];
    const i = opts.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); opts[Math.min(opts.length - 1, i + 1)]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); opts[Math.max(0, i - 1)]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); opts[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); opts[opts.length - 1]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(true); }
  });
  document.addEventListener('pointerdown', (e) => { if (!rcptList.hidden && !picker.contains(e.target as Node)) closePicker(); });

  const rcptLabel = (state: SimState, id: string): string => nameOf(state, id);
  const paintRcpt = (state: SimState): void => {
    const a = agentOf(state, to);
    rcptDot.replaceChildren(a ? dot(a.provider, a.ownerColor) : icon('users'));
    setText(rcptName, rcptLabel(state, to));
    for (const [id, b] of rcptBtns) { toggleClass(b, 'on', id === to); setAttr(b, 'aria-selected', String(id === to)); }
  };
  const rebuildRecipients = (state: SimState): void => {
    const agents = state.agents;
    const sig = agents.map((a) => `${a.id}:${a.name}:${a.provider}:${a.phase === 'offline' ? 0 : 1}`).join('|');
    if (sig === rcptSig) return;
    rcptSig = sig;
    rcptBtns.clear();
    const opt = (id: string, a: AgentState | undefined, sub: string): HTMLButtonElement => {
      const b = h('button', { type: 'button', class: 'rcpt-opt', role: 'option', tabIndex: -1, dataset: { id }, 'aria-selected': 'false' },
        a ? dot(a.provider, a.ownerColor) : icon('users'),
        h('span', { class: 'ro-ico dim' }, icon(a ? ROLE_ICON[a.role] ?? 'worker' : 'users')),
        h('span', { class: 'ro-name' }, a ? rcptLabel(state, a.id) : 'Everyone'),
        h('span', { class: 'ro-sub dim' }, sub),
        a?.phase === 'offline' ? h('span', { class: 'chip mute' }, 'offline') : null);
      b.addEventListener('click', () => { setRecipient(id); closePicker(true); focusInput(); });
      rcptBtns.set(id, b);
      return b;
    };
    const items: HTMLElement[] = [];
    const orch = agents.find((a) => a.role === 'orchestrator');
    if (orch) items.push(opt(orch.id, orch, 'plans + files tasks'));
    items.push(opt('all', undefined, 'whole team'));
    const integ = agents.find((a) => a.role === 'integrator');
    if (integ) items.push(opt(integ.id, integ, 'reviews PRs'));
    for (const a of agents.filter((x) => x.role === 'worker')) items.push(opt(a.id, a, `${providerName(a.provider)}${a.owner ? ` - ${a.owner}` : ''}`));
    rcptList.replaceChildren(...items);
    if (to !== 'all' && !agentOf(state, to)) to = orch?.id ?? 'orch';
    paintRcpt(state);
  };

  // ---------------------------------------------------------------- message list
  const empty = h('div', { class: 'chat-empty' }, h('p', {}, 'Talk to your team.'), h('p', { class: 'dim' }, 'Ask for status, file tasks, cut scope or send a note to one agent. Type / for commands.'));
  const list = h('div', { class: 'chat-list', role: 'log', 'aria-live': 'polite', 'aria-label': 'Chat transcript', tabIndex: 0 }, empty);
  const jump = h('button', { type: 'button', class: 'btn tiny log-jump', hidden: true, onClick: () => { list.scrollTop = list.scrollHeight; stick = true; jump.hidden = true; } }, 'Jump to latest');
  let stick = true;
  list.addEventListener('scroll', () => {
    stick = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
    if (jump.hidden !== stick) jump.hidden = stick;
  });

  const renderMsg = (m: ChatMessage, state: SimState): HTMLElement => {
    const time = h('time', { class: 'cm-time dim' }, fmtClock(m.t));
    if (m.kind === 'action') {
      return h('div', { class: 'cm action', dataset: { id: m.id } }, h('span', { class: 'cm-bolt', 'aria-hidden': 'true' }, icon('bolt')),
        h('span', { class: 'cm-atext' }, m.from !== 'you' && m.from !== 'orch' ? h('b', {}, `${nameOf(state, m.from)} `) : null, m.text), time);
    }
    if (m.kind === 'system') return h('div', { class: 'cm system', dataset: { id: m.id } }, h('span', {}, m.text), time);
    if (m.from === 'you') {
      return h('div', { class: 'cm you', dataset: { id: m.id } },
        h('div', { class: 'cm-bubble' }, m.text),
        h('div', { class: 'cm-meta dim' }, `to ${nameOf(state, m.to)}`, ' ', time));
    }
    const a = agentOf(state, m.from);
    const el = h('div', { class: `cm agent ${a?.provider ?? ''}`, dataset: { id: m.id } },
      h('div', { class: 'cm-who' }, dot(a?.provider, a?.ownerColor), h('b', { class: `who ${a?.provider ?? ''}` }, nameOf(state, m.from)),
        a?.owner ? h('span', { class: 'cm-owner dim' }, h('i', { class: 'swatch', style: `background:${a.ownerColor || 'var(--muted)'}` }), a.owner) : null,
        m.to !== 'you' ? h('span', { class: 'dim' }, `to ${nameOf(state, m.to)}`) : null, time),
      h('div', { class: 'cm-bubble' }, m.text));
    if (a?.ownerColor) el.style.setProperty('--oc', a.ownerColor);
    return el;
  };

  // ---------------------------------------------------------------- composer
  const typingName = h('span', { class: 'typing-name' });
  const typing = h('div', { class: 'typing', 'aria-live': 'polite', role: 'status' }, h('span', { class: 'typing-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), typingName);
  const input = h('textarea', { class: 'chat-input', rows: 1, placeholder: 'Message the Orchestrator...', title: 'Enter sends, Shift+Enter for a new line, / for commands', 'aria-label': 'Chat message', maxLength: MAX_CHARS, spellcheck: false,
    'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-haspopup': 'listbox' }) as HTMLTextAreaElement;
  const sendBtn = h('button', { type: 'button', class: 'btn accent send-btn', title: 'Send (Enter)', 'aria-label': 'Send message', disabled: true }, icon('plane'));
  const slashId = `slash-pop-${++slashSeq}`;
  const slash = h('div', { class: 'slash-pop', role: 'listbox', id: slashId, 'aria-label': 'Chat commands', hidden: true });
  input.setAttribute('aria-controls', slashId);
  const composer = h('div', { class: 'chat-in' }, slash, input, sendBtn);

  const suggestions = h('div', { class: 'chat-sugg', role: 'group', 'aria-label': 'Quick prompts' });
  const SUGG = CHAT_SUGGESTIONS;
  for (const s of SUGG) {
    suggestions.appendChild(h('button', {
      type: 'button', class: 'chat-chip', title: 'Click to send (Shift+click to edit first)',
      onClick: (e: MouseEvent) => { if (e.shiftKey) { input.value = s; onInput(); focusInput(); } else send(s); },
    }, s));
  }

  const chatPane = h('div', { class: 'comms-pane chat', id: 'comms-pane-chat', role: 'tabpanel', 'aria-labelledby': 'comms-tab-chat' },
    h('div', { class: 'chat-top' }, picker), h('div', { class: 'chat-main' }, list, jump), typing, suggestions, composer);

  const feed = createHelpFeed(ctx);
  const planesPane = h('div', { class: 'comms-pane planes', id: 'comms-pane-planes', role: 'tabpanel', 'aria-labelledby': 'comms-tab-planes', hidden: true }, feed.el);
  win.body.append(tabs, chatPane, planesPane);

  // ---------------------------------------------------------------- slash autocomplete
  let slashItems: ChatHelpEntry[] = [];
  let slashActive = 0;
  let slashDismissed = '';
  const slashOpen = (): boolean => !slash.hidden;
  const closeSlash = (): void => {
    if (slash.hidden) return;
    slash.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
  };
  const paintSlash = (): void => {
    slash.replaceChildren(...slashItems.map((c, i) => {
      const row = h('div', { class: `slash-opt${i === slashActive ? ' on' : ''}`, role: 'option', id: `${slashId}-${i}`, 'aria-selected': String(i === slashActive) },
        h('b', { class: 'so-cmd' }, c.cmd), h('span', { class: 'so-ex' }, c.example), h('span', { class: 'so-blurb dim' }, c.blurb));
      row.addEventListener('mousedown', (e) => { e.preventDefault(); pickSlash(i); });
      return row;
    }));
    input.setAttribute('aria-activedescendant', `${slashId}-${slashActive}`);
    (slash.children[slashActive] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  };
  const updateSlash = (): void => {
    const v = input.value;
    if (!v.startsWith('/') || v.includes('\n') || v === slashDismissed) { closeSlash(); return; }
    const q = v.slice(1).trim();
    const all = CHAT_HELP;
    const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    slashItems = q ? all.map((c) => ({ c, s: fuzzy(q, c.cmd) * 3 + fuzzy(q, c.example) })).filter((x) => { const hay = `${x.c.cmd} ${x.c.example} ${x.c.blurb}`.toLowerCase(); return toks.every((t) => hay.includes(t)) || fuzzy(q, x.c.cmd) >= 0; }).sort((a, b) => b.s - a.s).map((x) => x.c) : all.slice();
    if (!slashItems.length) { closeSlash(); return; }
    slashActive = Math.min(slashActive, slashItems.length - 1);
    slash.hidden = false; input.setAttribute('aria-expanded', 'true');
    paintSlash();
  };
  const pickSlash = (i: number): void => {
    const c = slashItems[i];
    if (!c) return;
    input.value = c.example;
    closeSlash(); autosize(); syncSend();
    input.focus();
    // select a trailing placeholder-ish token like T-12 so it is quick to overwrite
    const m = /T-\d+|Pixel|Marlow/.exec(c.example);
    if (m) input.setSelectionRange(m.index, m.index + m[0].length); else input.setSelectionRange(c.example.length, c.example.length);
  };

  // ---------------------------------------------------------------- sending
  let pending: { to: string; until: number; afterId: string | null } | null = null;
  const history: string[] = [];
  let histIdx = -1;
  const autosize = (): void => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 96)}px`;
  };
  const syncSend = (): void => { sendBtn.disabled = !input.value.trim(); };
  function onInput(): void {
    slashActive = 0; slashDismissed = '';
    autosize(); syncSend(); updateSlash();
  }
  function send(raw: string): void {
    const text = raw.trim().slice(0, MAX_CHARS); // keep the leading '/': parseChat understands slash commands
    if (!text) return;
    const chat = ctx.state.chat ?? EMPTY;
    cmd(ctx, 'say', to, text);
    history.push(text); histIdx = -1;
    input.value = ''; autosize(); syncSend(); closeSlash();
    pending = { to, until: performance.now() + 1000 + Math.random() * 2000, afterId: chat[chat.length - 1]?.id ?? null };
    stick = true;
    ctx.refresh();
  }
  input.addEventListener('input', onInput);
  sendBtn.addEventListener('click', () => { send(input.value); input.focus(); });
  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (slashOpen()) {
      if (e.key === 'ArrowDown') { e.preventDefault(); slashActive = (slashActive + 1) % slashItems.length; paintSlash(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); slashActive = (slashActive - 1 + slashItems.length) % slashItems.length; paintSlash(); return; }
      // Enter only accepts a suggestion while the user is still typing the command word; once there are arguments, Enter sends.
      const typingCmdWord = !/\s/.test(input.value.trim());
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && typingCmdWord)) { e.preventDefault(); pickSlash(slashActive); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); slashDismissed = input.value; closeSlash(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); input.blur(); return; }
    if (e.key === 'ArrowUp' && !input.value && history.length) { e.preventDefault(); histIdx = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1); input.value = history[histIdx]; autosize(); syncSend(); }
    else if (e.key === 'ArrowDown' && histIdx >= 0) { e.preventDefault(); histIdx++; input.value = histIdx >= history.length ? '' : history[histIdx]; if (histIdx >= history.length) histIdx = -1; autosize(); syncSend(); }
  });
  input.addEventListener('blur', () => { window.setTimeout(() => { if (document.activeElement !== input) closeSlash(); }, 120); });

  // ---------------------------------------------------------------- tab / recipient state
  function setTab(t: 'chat' | 'planes'): void {
    tab = t;
    for (const [b, id, pane] of [[chatTab, 'chat', chatPane], [planeTab, 'planes', planesPane]] as const) {
      toggleClass(b, 'on', t === id);
      b.setAttribute('aria-selected', String(t === id));
      b.tabIndex = t === id ? 0 : -1;
      pane.hidden = t !== id;
    }
    ctx.refresh();
  }
  function setRecipient(id: string): void {
    to = id;
    paintRcpt(ctx.state);
    input.placeholder = id === 'all' ? 'Message the whole team...' : `Message ${nameOf(ctx.state, id)}...`;
    pending = null;
  }
  function focusInput(): void { setTab('chat'); window.setTimeout(() => input.focus(), 0); }

  // ---------------------------------------------------------------- update
  let renderedLast: string | null = null;
  let seenId: string | null = null;
  let inited = false;
  let unread = 0;
  let lastChip = '';

  const update = (state: SimState): void => {
    const chat = state.chat ?? EMPTY;
    const last = chat[chat.length - 1];
    const viewing = !win.isMin() && tab === 'chat';

    if (!inited) { inited = true; seenId = last?.id ?? null; }
    if (viewing) seenId = last?.id ?? null;

    // unread = agent messages / actions after the last one the user has seen
    unread = 0;
    const from = seenId ? chat.findIndex((m) => m.id === seenId) : -1;
    for (let i = from + 1; i < chat.length && unread < 99; i++) if (chat[i].from !== 'you' && chat[i].kind !== 'system') unread++;

    const helpOpen = state.metrics?.helpOpen ?? (state.help ?? EMPTY).filter((r) => r.status === 'open').length;
    let chip: string;
    if (last) chip = `${unread ? `${unread} new - ` : ''}${last.from === 'you' ? 'You' : nameOf(state, last.from)}: ${snippet(last.text, 40)}`;
    else chip = 'say hi to the orchestrator';
    if (chip !== lastChip) { lastChip = chip; win.setChip(chip); }
    toggleClass(win.el, 'has-unread', unread > 0);
    setHidden(chatBadge, unread === 0 || viewing); setText(chatBadge, String(unread));
    setHidden(planeBadge, helpOpen === 0); setText(planeBadge, String(helpOpen));

    if (win.isMin()) return;
    rebuildRecipients(state);

    if (tab === 'planes') { feed.update(state, true); return; }

    // ----- incremental message render (ids are unique; the transcript is capped so find by id)
    if ((last?.id ?? null) !== renderedLast) {
      let start = 0;
      if (renderedLast !== null) {
        const idx = chat.findIndex((m) => m.id === renderedLast);
        if (idx >= 0) start = idx + 1;
        else { list.replaceChildren(); start = 0; }
      } else list.replaceChildren();
      if (chat.length) setHidden(empty, true);
      const frag = document.createDocumentFragment();
      for (let i = start; i < chat.length; i++) frag.appendChild(renderMsg(chat[i], state));
      if (!chat.length) list.replaceChildren(empty);
      list.appendChild(frag);
      while (list.children.length > MAX_ROWS) list.firstElementChild!.remove();
      renderedLast = last?.id ?? null;
      if (stick) list.scrollTop = list.scrollHeight;
    }

    // ----- typing indicator
    if (pending) {
      const replied = chat.slice(chat.findIndex((m) => m.id === pending!.afterId) + 1).some((m) => m.from !== 'you' && m.kind !== 'system');
      if (replied || performance.now() > pending.until) pending = null;
    }
    toggleClass(typing, 'on', !!pending);
    if (pending) setText(typingName, `${pending.to === 'all' ? 'The team' : nameOf(state, pending.to)} is typing...`);
  };

  return {
    el: win.el, win, update,
    open: (id?: string) => { win.setMin(false); if (id) setRecipient(id); focusInput(); ctx.refresh(); },
    toggle: () => { if (win.isMin()) { win.setMin(false); focusInput(); } else win.setMin(true); ctx.refresh(); },
    focusInput, setRecipient,
  };
}
