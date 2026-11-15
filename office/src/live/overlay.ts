/**
 * The calm overlay around the 3D office: goal, deadline verdict and countdown on top; done count, questions waiting
 * and who is stuck below. Read-only, large type for a screen across the room, in the board's Dusk / Day look.
 */
import { agentRoot, countdown, hueOf, outlook, personOf, plain, plural, timeNow, type BoardState } from './board';

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const MARK = '<svg class="mark" viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" fill="var(--accent)"/><rect x="3" y="4" width="2.6" height="8" fill="var(--accent-ink)"/><rect x="6.7" y="4" width="2.6" height="5" fill="var(--accent-ink)"/><rect x="10.4" y="4" width="2.6" height="6.5" fill="var(--accent-ink)"/></svg>';
const BLOCKED_MAX = 3;

export interface OverlayEls { top: HTMLElement; bottom: HTMLElement; msg: HTMLElement; root: HTMLElement }

export class Overlay {
  private state: BoardState | null = null;
  private live = false;
  private note = '';
  private message: string | null = 'Loading the board…';
  private html = { top: '', bottom: '', msg: '' };

  constructor(private els: OverlayEls, private simpleHref: () => string, private slug: string) { this.render(); }

  setState(s: BoardState): void { this.state = s; this.render(); }
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

  private put(k: 'top' | 'bottom' | 'msg', html: string): boolean {
    if (this.html[k] === html) return false;
    this.html[k] = html; this.els[k].innerHTML = html;
    return true;
  }

  /** Re-renders what changed; true when the layout may have changed size. */
  render(): boolean {
    const s = this.state;
    const simple = `<a class="simple" href="${esc(this.simpleHref())}" title="The classic presenter: big text, no 3D">Simple view</a>`;
    const status = `<span class="status"><span class="dot${this.live ? ' on' : ''}" aria-hidden="true"></span>${this.live ? 'Live' : this.note ? esc(this.note) : 'Connecting…'}</span>`;
    const brand = `<div class="brand-row"><span class="brand">${MARK}Claude Board</span>${status}<span class="sp"></span>${simple}</div>`;
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
    const goal = plain(s.settings?.goal);
    const t = timeNow(s, now);
    // The verdict and the clock's kind (no time / counting / finished) are part of the layout; the digits are not.
    const cd = countdown(s, now);
    const ol = outlook(s, t, now);
    const vd = ol?.label ? `<span class="pill ${ol.verdict === 'ok' ? 'ok' : ol.verdict === 'tight' ? 'warn' : 'bad'}" id="verdict" title="${esc(ol.why)}.">${esc(ol.label)}</span>` : '';
    const top = `${brand}
      <div class="head">
        <h1 class="goal${goal ? '' : ' unset'}" id="goal" title="${esc(goal)}">${esc(goal || 'No goal set yet')}</h1>
        <section class="card time ${cd.cls === 'none' ? 'quiet' : ''}" aria-label="Time to the demo">
          ${vd}<div class="clock" id="clock"></div><div class="sub" id="clock-sub"></div>
        </section>
      </div>`;

    const n = { done, review: by('review'), blocked: by('blocked'), doing: by('in_progress'), claimed: by('claimed'), open: by('open') };
    const seg = (k: keyof typeof n) => (n[k] ? `<span class="s-${k}" style="width:${(n[k] / total) * 100}%"></span>` : '');
    const key = (k: keyof typeof n, label: string) => `<span><i class="s-${k}" aria-hidden="true"></i>${label} <b>${n[k]}</b></span>`;
    // Who needs a human: open questions (and who asked), then the stuck tasks with their person.
    const qs = (s.questions || []).filter((q) => !q.answer);
    const askers = [...new Set(qs.map((q) => personOf(q.asker, s.presence || [])))];
    const blocked = tasks.filter((x) => x.status === 'blocked').sort((a, b) => a.priority - b.priority || a.id - b.id);
    const who = (name: string | null) => (name ? `<span class="who" style="--h:${hueOf(name, s.presence || [])}">${esc(personOf(name, s.presence || []))}</span>` : '<span class="who none">nobody</span>');
    const needs = [
      qs.length ? `<li class="q"><span class="tag warn">${plural(qs.length, 'question')} waiting</span><span class="what">${askers.length ? `from ${askers.map((a) => `<span class="who" style="--h:${hueOf(a, s.presence || [])}">${esc(a)}</span>`).join(', ')}` : 'for a human'}</span></li>` : '',
      ...blocked.slice(0, BLOCKED_MAX).map((x) => `<li class="b"><span class="tag bad">Stuck</span>${who(x.assignee ? agentRoot(x.assignee) : null)}<span class="what">#${x.id} ${esc(x.title)}</span></li>`),
      blocked.length > BLOCKED_MAX ? `<li class="more">and ${blocked.length - BLOCKED_MAX} more stuck</li>` : '',
    ].filter(Boolean);
    const bottom = `
      <section class="card prog" aria-labelledby="h-prog"><h2 id="h-prog">Progress</h2>
        <div class="count" id="done-count">${done} of ${total} done</div>
        <div class="bar" role="progressbar" aria-label="Tasks done" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}">${total ? (['done', 'review', 'blocked', 'doing', 'claimed'] as const).map(seg).join('') : ''}</div>
        <div class="cols">${key('open', 'Open')}${key('claimed', 'Claimed')}${key('doing', 'In progress')}${key('blocked', 'Blocked')}${key('review', 'Review')}</div>
      </section>
      <section class="card needs" aria-labelledby="h-needs"><h2 id="h-needs">Needs a human</h2>
        ${needs.length ? `<ul class="list" id="needs">${needs.join('')}</ul>` : '<p class="empty" id="needs">Nothing is waiting on a human, and nobody is stuck.</p>'}
      </section>`;
    const a = this.put('top', top);
    const b = this.put('bottom', bottom);
    if (a) this.paintClock();
    const name = this.slug ? `${this.slug} · ` : '';
    document.title = total ? `${done}/${total} done · ${name}Board presenter` : `${name}Board presenter`;
    return a || b;
  }
}
