// HACKATHON window: countdown, demo readiness, milestones, checklist, deploy, pitch, contributions and the project-brief editor. Key: H.
import { DEFAULT_SETTINGS, type ChecklistItem, type HackState, type Milestone, type SimState, type Ticket } from '../types';
import type { Panel, UICtx } from './ctx';
import { copyText, flash, h, section, segmented, setAttr, setHidden, setStyle, setText, sliderRow, toggleClass, type Section } from './dom';
import { hudWindow, type HudWin } from './hud';
import { icon } from './icons';
import { SAMPLE_BRIEFS } from '../sim/briefs';
import { cmd, mmss } from './interact';
import './comms.css';
import './hackathon.css';

export interface HackPanel extends Panel {
  win: HudWin;
  open(): void;
  toggle(): void;
  /** Expand the window and focus the project-brief textarea. */
  focusBrief(): void;
}

const DEFAULT_HACK: HackState = {
  active: false, project: '', brief: '', stage: 'idle', startedAt: 0, endsAt: 0, milestones: [], checklist: [],
  demoReadiness: 0, deployUrl: null, deployStatus: 'none', pitch: '', scopeCuts: 0,
};
const STAGES = ['kickoff', 'build', 'polish', 'demo', 'submitted'] as const;
const DEPLOY_LABEL: Record<HackState['deployStatus'], string> = { none: 'No deploy yet', building: 'Building...', live: 'Live', failed: 'Deploy failed' };

interface Row { el: HTMLElement }
function keyed<T, R extends Row>(parent: HTMLElement, rows: Map<string, R>, items: T[], keyOf: (t: T) => string, make: (t: T) => R, upd: (r: R, t: T) => void): void {
  const seen = new Set<string>();
  items.forEach((it, i) => {
    const k = keyOf(it);
    seen.add(k);
    let r = rows.get(k);
    if (!r) { r = make(it); rows.set(k, r); }
    upd(r, it);
    if (parent.children[i] !== r.el) parent.insertBefore(r.el, parent.children[i] ?? null);
  });
  for (const [k, r] of rows) if (!seen.has(k)) { r.el.remove(); rows.delete(k); }
}

function bar(label: string, cls = ''): { el: HTMLElement; fill: HTMLElement } {
  const fill = h('i');
  const el = h('div', { class: `bar ${cls}`.trim(), role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, fill);
  return { el, fill };
}
function setBar(b: { el: HTMLElement; fill: HTMLElement }, frac: number): void {
  const p = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0)) * 100;
  setStyle(b.fill, 'width', `${p.toFixed(1)}%`);
  setAttr(b.el, 'aria-valuenow', String(Math.round(p)));
}
function ticks(host: HTMLElement, fracs: { f: number; title: string }[]): void {
  const sig = fracs.map((t) => `${t.f.toFixed(3)}${t.title}`).join('|');
  if (host.dataset.ticks === sig) return;
  host.dataset.ticks = sig;
  host.querySelectorAll('.tick').forEach((t) => t.remove());
  for (const t of fracs) host.appendChild(h('i', { class: 'tick', style: `left:${(Math.max(0, Math.min(1, t.f)) * 100).toFixed(1)}%`, title: t.title }));
}

export function createHackathon(ctx: UICtx): HackPanel {
  const win = hudWindow(ctx, 'hack', 'Hack', true, 'hack-win', {
    zone: 'top', defaultSize: { w: 26, h: 34 }, minSize: { w: 19, h: 12 },
    place: (l, size) => { const y = l.topY + l.rem * 2.6; return { x: l.leftX, y, w: size.w, h: Math.min(size.h, l.bottomY - l.stripH - l.gap - y) }; }, // below the plan/skills chip row
  });
  win.extras.append(h('span', { class: 'key-hint', title: 'Press H to toggle' }, 'H'));
  const st = (): typeof ctx.sim.settings => ctx.sim.settings;
  const sec = (id: string, title: string, open: boolean, ...kids: (Node | null)[]): Section =>
    section(title, null, ctx.prefs.open[`hk-${id}`] ?? open, (o) => { ctx.prefs.open[`hk-${id}`] = o; ctx.savePrefs(); }, ...kids);

  // ----------------------------------------------------------------- header + stages
  const project = h('h3', { class: 'hk-project' });
  const stageChips = STAGES.map((s) => h('span', { class: 'chip mute hk-stage', dataset: { stage: s } }, s));
  const stageRow = h('div', { class: 'hk-stages', role: 'list', 'aria-label': 'Hackathon stage' }, ...stageChips);
  stageChips.forEach((c) => c.setAttribute('role', 'listitem'));

  // ----------------------------------------------------------------- countdown
  const count = h('div', { class: 'hk-count', dataset: { tone: 'idle' }, role: 'timer', 'aria-label': 'Time left' }, '--:--');
  const countSub = h('div', { class: 'hk-count-sub dim' });
  const timeBar = bar('Elapsed time', 'hk-timebar');
  const timeNote = h('div', { class: 'hk-note dim' });
  const countBlock = h('div', { class: 'hk-countblock' }, count, countSub, timeBar.el, timeNote);

  // ----------------------------------------------------------------- readiness
  const readyPct = h('b', { class: 'hk-ready-pct' });
  const readyBar = bar('Demo readiness', 'hk-readybar');
  const readyBlock = h('div', { class: 'hk-ready' },
    h('div', { class: 'hk-ready-head' }, h('span', { class: 'm-sub' }, 'Demo readiness'), readyPct), readyBar.el);

  // ----------------------------------------------------------------- milestones
  const msList = h('ul', { class: 'ms-list', 'aria-label': 'Milestones' });
  const msEmpty = h('p', { class: 'note' }, 'No milestones yet. They appear once the orchestrator plans from a brief.');
  const msRows = new Map<string, Row & { check: HTMLElement; title: HTMLElement; bar: ReturnType<typeof bar>; n: HTMLElement; due: HTMLElement; badge: HTMLElement }>();
  const milestones = sec('ms', 'Milestones', true, msList, msEmpty);

  // ----------------------------------------------------------------- checklist
  const ckList = h('ul', { class: 'ck-list', 'aria-label': 'Submission checklist' });
  const ckEmpty = h('p', { class: 'note' }, 'The checklist fills in when a hackathon starts.');
  const ckRows = new Map<string, Row & { btn: HTMLButtonElement; label: HTMLElement; auto: HTMLElement; item: ChecklistItem | null }>();
  const checklist = sec('ck', 'Checklist', true, ckList, ckEmpty);

  // ----------------------------------------------------------------- deploy + pitch + scope
  const depDot = h('i', { class: 'dep-dot', 'aria-hidden': 'true' });
  const depText = h('b', { class: 'dep-text' });
  const depUrl = h('code', { class: 'hk-url', tabIndex: 0, title: 'Mock preview URL (select to copy)' });
  const depCopy = h('button', { type: 'button', class: 'btn tiny', title: 'Copy the deploy URL' }, 'Copy');
  depCopy.addEventListener('click', async () => { const u = depUrl.dataset.url; if (u) flash(depCopy, (await copyText(u)) ? 'Copied' : 'Copy failed'); });
  const deploy = h('div', { class: 'card hk-card' }, h('div', { class: 'card-h' }, 'Deploy'),
    h('div', { class: 'dep-line' }, depDot, depText), h('div', { class: 'dep-url' }, depUrl, depCopy));
  const pitchText = h('p', { class: 'hk-pitch' });
  const pitchCopy = h('button', { type: 'button', class: 'btn tiny', title: 'Copy the pitch' }, 'Copy');
  pitchCopy.addEventListener('click', async () => { const t = pitchText.dataset.text; if (t) flash(pitchCopy, (await copyText(t)) ? 'Copied' : 'Copy failed'); });
  const pitch = h('div', { class: 'card hk-card' }, h('div', { class: 'card-h' }, 'Pitch'), h('div', { class: 'pitch-line' }, pitchText, pitchCopy));
  const cuts = h('b', { class: 'hk-cuts' });
  const cutBtn = h('button', { type: 'button', class: 'btn tiny', title: 'Ask the orchestrator to descope two tickets' }, 'Cut scope by 2');
  cutBtn.addEventListener('click', () => { cmd(ctx, 'say', 'orch', 'cut scope by 2'); flash(cutBtn, 'Asked'); ctx.refresh(); });
  const scope = h('div', { class: 'hk-scope' }, h('span', { class: 'dim' }, 'Scope cuts'), cuts, h('span', { class: 'grow' }), cutBtn);
  const ship = sec('ship', 'Ship it', true, deploy, pitch, scope);

  // ----------------------------------------------------------------- contributions
  const contribBar = h('div', { class: 'stack hk-contrib', role: 'img' });
  const contribLegend = h('div', { class: 'stack-legend hk-legend' });
  const contrib = sec('contrib', 'Contributions', true, contribBar, contribLegend);
  let contribSig = '';

  // ----------------------------------------------------------------- brief editor + settings
  const nameIn = h('input', { type: 'text', class: 'fld', id: 'hk-name', maxLength: 60, placeholder: 'Project name', 'aria-label': 'Project name' }) as HTMLInputElement;
  const briefIn = h('textarea', { class: 'fld hk-brief', id: 'hk-brief', rows: 4, maxLength: 800, placeholder: 'What are we building? Who is it for? What must the demo show?', 'aria-label': 'Project brief: what are we building?' }) as HTMLTextAreaElement;
  const sample = h('select', { class: 'sel', 'aria-label': 'Load a sample brief' }, h('option', { value: '' }, 'Sample briefs...'),
    ...SAMPLE_BRIEFS.map((b, i) => h('option', { value: String(i) }, b.project))) as HTMLSelectElement;
  const kick = h('button', { type: 'button', class: 'btn accent', disabled: true }, icon('flag'), ' Kick off') as HTMLButtonElement;
  const kickNote = h('p', { class: 'note' }, 'Orchestrator will replan and file tickets as the team frees up.');
  let touched = false;
  const syncKick = (): void => { kick.disabled = !briefIn.value.trim(); };
  nameIn.addEventListener('input', () => { touched = true; });
  briefIn.addEventListener('input', () => { touched = true; syncKick(); });
  sample.addEventListener('change', () => {
    const b = SAMPLE_BRIEFS[Number(sample.value)];
    sample.value = '';
    if (!b) return;
    nameIn.value = b.project; briefIn.value = b.brief; touched = true; syncKick();
    briefIn.focus();
  });
  kick.addEventListener('click', () => {
    const brief = briefIn.value.trim();
    if (!brief) return;
    const name = nameIn.value.trim() || 'Untitled project';
    // setBrief updates projectName/brief/mode itself and replans once; the empty patch below only persists + refreshes
    cmd(ctx, 'setBrief', name, brief);
    ctx.setSettings({});
    touched = false;
    flash(kick, 'Kicked off!');
    ctx.refresh();
  });
  const mode = segmented<'sprint' | 'hackathon'>([{ value: 'hackathon', label: 'Hackathon', title: 'Finite scope from a brief with milestones and a demo deadline' }, { value: 'sprint', label: 'Sprint', title: 'Endless rolling sprints' }],
    st().mode, (v) => ctx.setSettings({ mode: v }), 'Mode');
  const length = sliderRow({
    label: 'Hack length (sim min)', min: 5, max: 120, step: 1, value: st().deadlineMinutes, def: DEFAULT_SETTINGS.deadlineMinutes, idPrefix: 'hklen', unit: 'min',
    hint: 'How long the team has, in simulated minutes.', onInput: (v) => ctx.setSettings({ deadlineMinutes: v }),
  });
  const brief = sec('brief', 'Project brief', true,
    h('label', { class: 'hk-lbl', htmlFor: 'hk-name' }, 'Project'), nameIn,
    h('label', { class: 'hk-lbl', htmlFor: 'hk-brief' }, 'What are we building?'), briefIn,
    h('div', { class: 'hk-brief-row' }, sample, kick), kickNote,
    h('div', { class: 'se-row hk-mode' }, h('span', { class: 'se-label' }, 'Mode'), mode.el), length.el);

  // ----------------------------------------------------------------- assemble
  const root = h('div', { class: 'hk' }, h('div', { class: 'hk-top' }, project, stageRow), countBlock, readyBlock,
    milestones.el, checklist.el, ship.el, contrib.el, brief.el);
  win.body.classList.add('hack-body');
  win.body.append(root);

  // ----------------------------------------------------------------- update
  let lastChip = '';
  let msSig = '';
  let idleState: boolean | null = null;

  const mergedOf = (m: Milestone, tickets: Ticket[], byId: Map<string, Ticket>): { merged: number; total: number } => {
    const ids = new Set<string>(m.ticketIds);
    for (const t of tickets) if (t.milestone === m.id) ids.add(t.id);
    let merged = 0, total = 0;
    for (const id of ids) {
      const t = byId.get(id);
      if (t && t.status === 'cancelled') continue;
      total++;
      if (t && t.status === 'merged') merged++;
    }
    return { merged, total };
  };

  const update = (state: SimState): void => {
    const hk = state.hack ?? DEFAULT_HACK;
    const idle = !hk.active || hk.stage === 'idle';
    const submitted = hk.stage === 'submitted';
    const total = Math.max(1, hk.endsAt - hk.startedAt);
    const remaining = Math.max(0, hk.endsAt - state.time);
    const elapsed = Math.max(0, Math.min(total, state.time - hk.startedAt));
    const tone = idle ? 'idle' : submitted ? 'done' : remaining < 120 ? 'bad' : remaining < 300 ? 'warn' : 'ok';
    const pctReady = Math.round((hk.demoReadiness || 0) * 100);

    // chip (always)
    let chip: string;
    if (idle) chip = 'no project - press K to kick off';
    else if (submitted) chip = `SUBMITTED - ${pctReady}%`;
    else {
      const tail = hk.deployStatus === 'live' ? 'LIVE' : hk.deployStatus === 'building' ? 'BUILDING' : hk.deployStatus === 'failed' ? 'DEPLOY FAILED' : hk.stage.toUpperCase();
      chip = `${mmss(remaining)} left - ${pctReady}% - ${tail}`;
    }
    if (chip !== lastChip) { lastChip = chip; win.setChip(chip); }
    toggleClass(win.el, 'hk-warn', tone === 'warn');
    toggleClass(win.el, 'hk-bad', tone === 'bad');

    if (win.isMin()) return;

    if (idleState !== idle) { idleState = idle; toggleClass(root, 'idle', idle); }
    setText(project, hk.project || st().projectName || 'No project yet');
    const cur = STAGES.indexOf(hk.stage as typeof STAGES[number]);
    stageChips.forEach((c, i) => {
      const cls = idle ? 'chip mute hk-stage' : i === cur ? 'chip gold hk-stage on' : i < cur ? 'chip ok hk-stage past' : 'chip mute hk-stage';
      if (c.className !== cls) c.className = cls;
      setAttr(c, 'aria-current', !idle && i === cur ? 'step' : null);
    });

    // countdown
    setText(count, idle ? '--:--' : submitted ? 'SUBMITTED' : mmss(remaining));
    setAttr(count, 'data-tone', tone);
    setText(countSub, idle ? 'No hackathon running. Write a brief below and kick off.' : submitted ? 'The team shipped. Time to demo.' : 'left until submission');
    setBar(timeBar, idle ? 0 : elapsed / total);
    setText(timeNote, idle ? '' : `elapsed ${mmss(elapsed)} of ${mmss(total)}`);
    toggleClass(timeBar.el, 'warn', tone === 'warn'); toggleClass(timeBar.el, 'bad', tone === 'bad');
    ticks(timeBar.el, idle ? [] : hk.milestones.map((m) => ({ f: (m.dueMin * 60) / total, title: `${m.title} due ${m.dueMin}:00` })));

    // readiness
    setText(readyPct, `${pctReady}%`);
    setBar(readyBar, hk.demoReadiness || 0);
    const byId = new Map(state.tickets.map((t) => [t.id, t]));
    const counts = hk.milestones.map((m) => mergedOf(m, state.tickets, byId));
    const sumTotal = counts.reduce((a, c) => a + c.total, 0);
    let cum = 0;
    ticks(readyBar.el, hk.milestones.map((m, i) => { cum += sumTotal ? counts[i].total : 1; return { f: sumTotal ? cum / sumTotal : (i + 1) / hk.milestones.length, title: m.title }; }).slice(0, -1));

    // milestones
    const nowMin = (state.time - hk.startedAt) / 60;
    const sig = hk.milestones.map((m) => m.id).join(',');
    if (sig !== msSig) msSig = sig;
    setHidden(msEmpty, hk.milestones.length > 0); setHidden(msList, hk.milestones.length === 0);
    keyed(msList, msRows, hk.milestones.map((m, i) => ({ m, c: counts[i] })), (x) => x.m.id, () => {
      const check = h('span', { class: 'ms-check', 'aria-hidden': 'true' }, icon('check'));
      const title = h('span', { class: 'ms-title' });
      const b = bar('Milestone progress', 'thin');
      const n = h('span', { class: 'ms-n' });
      const due = h('span', { class: 'ms-due dim' });
      const badge = h('span', { class: 'chip' });
      return { el: h('li', { class: 'ms-row' }, check, title, b.el, n, due, badge), check, title, bar: b, n, due, badge };
    }, (r, x) => {
      const done = x.m.done || (x.c.total > 0 && x.c.merged >= x.c.total);
      const late = !done && !idle && nowMin > x.m.dueMin;
      toggleClass(r.el, 'done', done);
      setText(r.title, x.m.title);
      setBar(r.bar, x.c.total ? x.c.merged / x.c.total : 0);
      setText(r.n, `${x.c.merged}/${x.c.total}`);
      setText(r.due, `due ${mmss(x.m.dueMin * 60)}`);
      setText(r.badge, late ? 'LATE' : 'OK');
      const cls = `chip ${late ? 'bad' : done ? 'ok' : 'mute'}`;
      if (r.badge.className !== cls) r.badge.className = cls;
    });

    // checklist
    setHidden(ckEmpty, hk.checklist.length > 0); setHidden(ckList, hk.checklist.length === 0);
    keyed(ckList, ckRows, hk.checklist, (c) => c.id, (c) => {
      const label = h('span', { class: 'ck-label' });
      const auto = h('span', { class: 'chip mute', title: 'Updated automatically by the team' }, 'auto');
      const btn = h('button', { type: 'button', class: 'ck-row', role: 'checkbox', 'aria-checked': 'false' }, h('span', { class: 'ck-box', 'aria-hidden': 'true' }, icon('check')), label, auto) as HTMLButtonElement;
      const row: Row & { btn: HTMLButtonElement; label: HTMLElement; auto: HTMLElement; item: ChecklistItem | null } = { el: h('li', {}, btn), btn, label, auto, item: c };
      btn.addEventListener('click', () => {
        const it = row.item;
        if (!it || it.auto) return;
        const sim = ctx.sim as unknown as { setChecklistItem?: (id: string, done: boolean) => void };
        if (typeof sim.setChecklistItem === 'function') sim.setChecklistItem(it.id, !it.done);
        else it.done = !it.done; // sim state is mutated in place and re-read every tick
        ctx.refresh();
      });
      return row;
    }, (r, c) => {
      r.item = c;
      setText(r.label, c.label);
      toggleClass(r.btn, 'done', c.done);
      setAttr(r.btn, 'aria-checked', String(c.done));
      setAttr(r.btn, 'aria-disabled', c.auto ? 'true' : null);
      toggleClass(r.btn, 'locked', c.auto);
      setHidden(r.auto, !c.auto);
      setAttr(r.btn, 'title', c.auto ? 'Updated automatically' : 'Click to toggle');
    });

    // deploy / pitch / scope
    const dcls = `dep-dot ${hk.deployStatus}`;
    if (depDot.className !== dcls) depDot.className = dcls;
    setText(depText, DEPLOY_LABEL[hk.deployStatus] ?? hk.deployStatus);
    setText(depUrl, hk.deployUrl ?? '(no URL yet)');
    depUrl.dataset.url = hk.deployUrl ?? '';
    toggleClass(depUrl, 'none', !hk.deployUrl);
    depCopy.disabled = !hk.deployUrl;
    pitchText.dataset.text = hk.pitch;
    setText(pitchText, hk.pitch || 'The orchestrator drafts a one-line pitch once the plan exists.');
    toggleClass(pitchText, 'none', !hk.pitch);
    pitchCopy.disabled = !hk.pitch;
    setText(cuts, String(hk.scopeCuts));

    // contributions by owner colour (merged tickets)
    const by = new Map<string, { color: string; merged: number; agents: number }>();
    for (const a of state.agents) {
      if (a.role !== 'worker') continue;
      const e = by.get(a.owner) ?? { color: a.ownerColor, merged: 0, agents: 0 };
      e.merged += a.stats?.merged ?? 0; e.agents++;
      by.set(a.owner, e);
    }
    const entries = [...by.entries()].sort((a, b) => b[1].merged - a[1].merged);
    const csig = entries.map(([o, e]) => `${o}|${e.color}|${e.merged}`).join(';');
    if (csig !== contribSig) {
      contribSig = csig;
      const sum = entries.reduce((a, [, e]) => a + e.merged, 0);
      contribBar.replaceChildren(...(sum ? entries.filter(([, e]) => e.merged).map(([o, e]) => h('i', { style: `width:${(e.merged / sum) * 100}%;background:${e.color}`, title: `${o}: ${e.merged} merged` })) : []));
      contribBar.setAttribute('aria-label', sum ? entries.map(([o, e]) => `${o} ${e.merged}`).join(', ') : 'No merges yet');
      contribLegend.replaceChildren(...(entries.length ? entries.map(([o, e]) => h('span', { class: 'lg' }, h('i', { style: `background:${e.color}` }), `${o} ${e.merged}`)) : [h('span', {}, 'No contributors yet')]),
        ...(sum ? [] : [h('span', { class: 'dim' }, ' - no merges yet')]));
    }

    // brief editor mirrors the settings unless the user is typing
    const s = st();
    if (!touched) {
      if (document.activeElement !== nameIn && nameIn.value !== s.projectName) nameIn.value = s.projectName;
      if (document.activeElement !== briefIn && briefIn.value !== s.brief) { briefIn.value = s.brief; syncKick(); }
    }
    mode.set(s.mode);
    length.set(s.deadlineMinutes);
  };

  // initial field values
  nameIn.value = st().projectName; briefIn.value = st().brief; syncKick();

  const focusBrief = (): void => { win.setMin(false); window.setTimeout(() => { brief.setOpen(true); briefIn.focus(); briefIn.scrollIntoView({ block: 'nearest' }); }, 0); };
  return { el: win.el, win, update, open: () => win.setMin(false), toggle: () => win.toggle(), focusBrief };
}
