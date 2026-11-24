/**
 * The calm overlay around the 3D office: goal, deadline verdict and countdown on top; done count, questions waiting
 * and who is stuck below. Read-only, large type for a screen across the room, in the board's Dusk / Day look.
 */
import { agentRoot, clock, columnCounts, countdown, goalHead, hueOf, needsOf, outlook, personOf, plain, plural, timeNow, type BoardState } from './board';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
// The board's logo (three agents), in the board's accent (amber / burnt orange), not the presenter's blue.
const MARK = '<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><g transform="translate(-.5 3.5) scale(.53)"><rect x="12" y="0" width="2.6" height="6" rx="1.3" class="ma"/><circle cx="13.3" cy="1.6" r="2.4" class="ma"/><rect x="0" y="7" width="26" height="21" rx="8" class="ma"/><rect x="6" y="14" width="4" height="7" rx="2" class="me"/><rect x="16" y="14" width="4" height="7" rx="2" class="me"/></g><g transform="translate(18.7 3.5) scale(.53)"><rect x="12" y="0" width="2.6" height="6" rx="1.3" class="ma"/><circle cx="13.3" cy="1.6" r="2.4" class="ma"/><rect x="0" y="7" width="26" height="21" rx="8" class="ma"/><rect x="6" y="14" width="4" height="7" rx="2" class="me"/><rect x="16" y="14" width="4" height="7" rx="2" class="me"/></g><g transform="translate(6.1 6.8) scale(.76)"><rect x="12" y="0" width="2.6" height="6" rx="1.3" class="mi"/><circle cx="13.3" cy="1.6" r="2.4" class="ma"/><rect x="0" y="7" width="26" height="21" rx="8" class="mi"/><rect x="6" y="14" width="4" height="7" rx="2" class="me"/><rect x="16" y="14" width="4" height="7" rx="2" class="me"/></g></svg>';
const NEEDS_MAX = 4; // blocked rows under the questions line

export interface OverlayEls { top: HTMLElement; bottom: HTMLElement; msg: HTMLElement; root: HTMLElement }

export class Overlay {
  private state: BoardState | null = null;
  private live = false;
  private note = '';
  private updated = 0; // when the board last answered: what the page says it is showing while the board can't be reached
  private message: string | null = 'Loading the board…';
  private html = { top: '', bottom: '', msg: '' };

  // The room Needs attention has changes with the window, the top row (the clock card gaining or losing its countdown
  // and verdict) and the Progress card above it: its card is watched, and fitted again (once a frame) when its size
  // isn't the one it was fitted at.
  private fitted = '';
  private frame = 0;
  private ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => { if (this.needsSize() !== this.fitted) this.refit(); });
  });

  constructor(private els: OverlayEls, private simpleHref: () => string, private slug: string) { this.render(); }

  setState(s: BoardState): void { this.state = s; this.updated = Date.now(); this.render(); }
  setStatus(live: boolean, note: string): void { this.live = live; this.note = note; this.render(); }
  setMessage(html: string | null): void { this.message = html; this.render(); }
  /** Once a second: the countdown moves; the rest re-renders only when the verdict or a boundary changes. */
  tick(): boolean {
    if (!this.state || this.message) return false;
    const changed = this.render();
    this.paintClock();
    return changed;
  }

  private paintClock(): void {
    if (!this.state) return;
    const cd = countdown(this.state, Date.now());
    const c = document.getElementById('clock'); const sub = document.getElementById('clock-sub');
    if (c && c.textContent !== cd.big) c.textContent = cd.big;
    if (c && c.className !== 'clock ' + cd.cls) c.className = 'clock ' + cd.cls;
    if (sub && sub.textContent !== cd.sub) sub.textContent = cd.sub;
  }

  /** Its room changed: Needs attention is built again in full and fitted (rows it had no room for may fit now). */
  refit(): void { this.html.bottom = ''; this.render(); }

  /** A short screen: Needs attention keeps the rows that fit and counts the rest in its "and N more" line, so no row
   *  (and never that line) is cut off at the card's bottom edge. The questions line always stays: if even that doesn't
   *  fit, the card scrolls. */
  private fitNeeds(): void {
    const card = this.els.bottom.querySelector<HTMLElement>('.needs'); const ul = card?.querySelector('ul');
    this.ro?.disconnect();
    if (card) this.ro?.observe(card);
    this.fitted = this.needsSize();
    if (!card || !ul) return;
    let more = ul.querySelector<HTMLElement>('li.more');
    const rows = [...ul.querySelectorAll('li.b')];
    while (card.scrollHeight > card.clientHeight + 1 && rows.length) {
      rows.pop()!.remove();
      if (!more) { more = document.createElement('li'); more.className = 'more'; ul.append(more); }
      const n = Number(more.dataset.n || 0) + 1; more.dataset.n = String(n); more.textContent = `and ${n} more`;
    }
    card.classList.toggle('scroll', card.scrollHeight > card.clientHeight + 1);
  }

  // The card's outer size (a scrollbar of its own doesn't change it).
  private needsSize(): string {
    const card = this.els.bottom.querySelector<HTMLElement>('.needs');
    return card ? `${card.offsetWidth}x${card.offsetHeight}` : '';
  }

  private put(k: 'top' | 'bottom' | 'msg', html: string): boolean {
    if (this.html[k] === html) return false;
    this.html[k] = html; this.els[k].innerHTML = html;
    return true;
  }

  /** Re-renders what changed; true when the layout may have changed size. */
  render(): boolean {
    const s = this.state;
    const simple = `<a class="simple" href="${esc(this.simpleHref())}" title="The classic presenter: big text, no 3D">Simple view</a>`;
    // Not while a message stands in for the board (an expired link, an archived board...): it says what is going on.
    const status = this.message || !s ? '' : `<span class="status"><span class="dot${this.live ? ' on' : ''}" aria-hidden="true"></span>${this.live ? 'Live' : this.note ? esc(this.note) : 'Connecting…'}</span>`;
    const brand = `<div class="brand-row"><span class="brand">${MARK}Agent Board</span>${status}<span class="sp"></span>${simple}</div>`;
    this.els.root.classList.toggle('has-msg', !!this.message || !s);
    if (this.message || !s) {
      const a = this.put('msg', `<p>${this.message ?? 'Loading the board…'}</p>`);
      const b = this.put('top', brand);
      const c = this.put('bottom', '');
      return a || b || c;
    }
    this.put('msg', '');
    const now = Date.now();
    const tasks = (s.tasks || []).filter((t) => t.status !== 'proposed');
    const by = (st: string) => tasks.filter((t) => t.status === st).length;
    const done = by('done'); const total = tasks.length;
    // The heading is the goal's first line (or sentence); the whole goal is its tooltip.
    const goal = plain(s.settings?.goal); const head = goalHead(s.settings?.goal);
    const t = timeNow(s, now);
    // The verdict and the clock's kind (no time / counting / finished) are part of the layout; the digits are not.
    const cd = countdown(s, now);
    const ol = outlook(s, t, now);
    // Amber, not red, even when behind: the room (judges, other teams) sees it; it's a pace note for the team. None during
    // the feature freeze, as on the board (the clock says "Feature freeze"; "Behind" would only mean those tasks won't start).
    const vd = ol?.label && !t.frozen ? `<span class="pill ${ol.verdict === 'ok' ? 'ok' : 'warn'}" id="verdict" title="${esc(ol.why)}.">${esc(ol.label)}</span>` : '';
    // In the freeze nothing new starts (a P1 fix can): what is still open or waiting for a yes won't land.
    const proposed = (s.tasks || []).length - tasks.length;
    const wontOpen = (s.tasks || []).filter((x) => x.status === 'open' && x.priority !== 1).length;
    const wont = [wontOpen && plural(wontOpen, 'open task'), proposed && plural(proposed, 'proposal')].filter(Boolean).join(' and ');
    const freezeNote = t.frozen && !t.past && wont ? `<div class="freeze-note" id="freeze-note">${esc(wont)} won't land: nothing new starts in the freeze</div>` : '';
    // The board can't be reached (the last answer stays on screen): say so, and dim the clock card.
    const down = !this.live && !!this.note && this.updated > 0;
    const offline = down ? `<p class="offline" id="offline" role="status">Can't reach the board. <span>Showing it as of ${esc(clock(this.updated))}; checking again.</span></p>` : '';
    const top = `${brand}${offline}
      <div class="head">
        <h1 class="goal${goal ? '' : ' unset'}" id="goal" title="${esc(goal)}">${esc(head || 'No goal set yet')}</h1>
        <section class="card time ${cd.cls === 'none' ? 'quiet' : ''}${down ? ' stale' : ''}" aria-label="Time to the demo">
          ${vd}<div class="clock" id="clock"></div><div class="sub" id="clock-sub"></div>${freezeNote}
        </section>
      </div>`;

    // The board's column counts (proposals count in Open, as on the board).
    const c = columnCounts(s.tasks || []);
    // "x of y done" leaves proposals out, so the legend does too: they are their own entry, and the entries add up to y.
    const n = { done: c.done, review: c.review, blocked: c.blocked, doing: c.in_progress, open: c.open - proposed, proposed };
    const seg = (k: keyof typeof n) => (n[k] ? `<span class="s-${k}" style="width:${(n[k] / total) * 100}%"></span>` : '');
    const key = (k: keyof typeof n, label: string) => `<span><i class="s-${k}" aria-hidden="true"></i>${label} <b>${n[k]}</b></span>`;
    // What needs attention, by the board's rule: the questions (and who asked), then blocked tasks that don't wait on one of
    // those questions, each with its person. Stale tasks and out of usage aren't listed, as on the board (the room shows
    // out of usage over the agent).
    const nd = needsOf(s, now);
    const qs = nd.questions;
    const askers = [...new Set(qs.map((q) => personOf(q.asker, s.presence || [])))];
    const who = (name: string | null, label?: string) => (name ? `<span class="who" style="--h:${hueOf(name, s.presence || [])}">${esc(label ?? personOf(name, s.presence || []))}</span>` : '<span class="who none">nobody</span>');
    const rows = [
      ...nd.blocked.map((x) => `<li class="b"><span class="tag bad">Blocked</span>${who(x.assignee ? agentRoot(x.assignee) : null)}<span class="what">#${x.id} ${esc(x.title)}</span></li>`),
    ];
    const needs = [
      qs.length ? `<li class="q"><span class="tag warn">${plural(qs.length, 'question')} waiting</span><span class="what">${askers.length ? `from ${askers.map((a) => `<span class="who" style="--h:${hueOf(a, s.presence || [])}">${esc(a)}</span>`).join(', ')}` : 'for you'}</span></li>` : '',
      ...rows.slice(0, NEEDS_MAX),
      rows.length > NEEDS_MAX ? `<li class="more" data-n="${rows.length - NEEDS_MAX}">and ${rows.length - NEEDS_MAX} more</li>` : '',
    ].filter(Boolean);
    const bottom = `
      <section class="card prog" aria-labelledby="h-prog"><h2 id="h-prog">Progress</h2>
        <div class="count" id="done-count">${done} of ${total} done</div>
        <div class="bar" role="progressbar" aria-label="Tasks done" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}">${total ? (['done', 'review', 'blocked', 'doing'] as const).map(seg).join('') : ''}</div>
        <div class="cols">${key('done', 'Done')}${key('open', 'Open')}${key('doing', 'In progress')}${key('blocked', 'Blocked')}${key('review', 'Review')}${proposed ? key('proposed', 'Proposed') : ''}</div>
      </section>
      <section class="card needs" aria-labelledby="h-needs"><h2 id="h-needs">Needs attention</h2>
        ${needs.length ? `<ul class="list" id="needs">${needs.join('')}</ul>` : '<p class="empty" id="needs">Nothing needs attention, and nothing is blocked.</p>'}
      </section>`;
    const a = this.put('top', top);
    const b = this.put('bottom', bottom);
    if (b) this.fitNeeds();
    if (a) this.paintClock();
    const name = this.slug ? `${this.slug} · ` : '';
    document.title = total ? `${done}/${total} done · ${name}Board presenter` : `${name}Board presenter`;
    return a || b;
  }
}
