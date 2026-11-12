// Orchestrator plan card + Skill library card (both collapsible overlay chips).
import { SKILLS, SKILL_SLOTS, type Skill, type SkillCategory } from '../skills';
import type { SimState } from '../types';
import type { Panel, UICtx } from './ctx';
import { h, setHidden, setText, toggleClass } from './dom';
import { icon } from './icons';
import { hudWindow, type HudWin } from './hud';
import { skillChip, skillById } from './chips';

export function createPlan(ctx: UICtx): Panel & { win: HudWin } {
  const win = hudWindow(ctx, 'plan', 'Plan', true, 'plan-win', { zone: 'top', minSize: { w: 14, h: 6 } });
  const name = h('h3', { class: 'plan-name' });
  const note = h('p', { class: 'plan-note' });
  const meta = h('div', { class: 'plan-meta' });
  const epics = h('div', { class: 'epics' });
  win.body.append(name, note, meta, epics);
  let epicSig = '';
  const update = (state: SimState): void => {
    const p = state.plan;
    setText(name, p.name); setText(note, p.note ? `"${p.note}"` : 'The orchestrator is thinking...');
    setText(meta, `${p.totalTickets} tickets - deadline ${p.deadlineMinutes} min`);
    win.setChip(p.name || 'no plan yet');
    const sig = p.epics.join('|');
    if (sig !== epicSig) { epicSig = sig; epics.replaceChildren(...p.epics.map((e) => h('span', { class: 'chip violet' }, e))); }
  };
  return { el: win.el, update, win };
}

const CATS: SkillCategory[] = ['frontend', 'backend', 'testing', 'devops', 'security', 'data', 'docs', 'quality'];
const CAT_LABEL: Record<SkillCategory, string> = { frontend: 'Frontend', backend: 'Backend', testing: 'Testing', devops: 'DevOps', security: 'Security', data: 'Data', docs: 'Docs', quality: 'Quality' };
const SWATCHES = ['#38bdf8', '#818cf8', '#34d399', '#a3e635', '#fbbf24', '#fb923c', '#ef4444', '#f472b6', '#c084fc', '#22d3ee', '#94a3b8', '#e2e8f0'];

export function createSkillLibrary(ctx: UICtx): Panel & { win: HudWin } {
  const win = hudWindow(ctx, 'skills', 'Skill library', true, 'skills-win', { zone: 'top', minSize: { w: 17, h: 12 }, defaultSize: { w: 27, h: 30 } });
  const cmd = ctx.cmd;
  let selected: string | null = null;
  let confirmId: string | null = null;

  // ---- toolbar + add form
  const msg = h('p', { class: 'note sk-msg', role: 'status' });
  const addToggle = h('button', { type: 'button', class: 'btn tiny accent', 'aria-expanded': 'false', onClick: () => { form.hidden = !form.hidden; addToggle.setAttribute('aria-expanded', String(!form.hidden)); if (!form.hidden) fName.focus(); } }, icon('plus'), ' Add skill');
  const resetBtn = h('button', { type: 'button', class: 'btn tiny', title: 'Re-add any of the default skills that are missing', onClick: () => resetCatalog() }, icon('undo'), ' Reset catalog');
  const toolbar = h('div', { class: 'sk-toolbar' }, addToggle, resetBtn, h('span', { class: 'dim sk-count' }));
  const countEl = toolbar.querySelector('.sk-count') as HTMLElement;

  const fName = h('input', { type: 'text', class: 'sel', id: 'sk-name', maxlength: '28', placeholder: 'e.g. GraphQL' }) as HTMLInputElement;
  const fGlyph = h('input', { type: 'text', class: 'sel sk-glyph-in', id: 'sk-glyph', maxlength: '2', placeholder: 'GQ' }) as HTMLInputElement;
  const fColor = h('input', { type: 'color', class: 'sk-color', id: 'sk-color', value: SWATCHES[0], 'aria-label': 'Custom colour' }) as HTMLInputElement;
  const fCat = h('select', { class: 'sel', id: 'sk-cat' }, ...CATS.map((c) => h('option', { value: c }, CAT_LABEL[c]))) as HTMLSelectElement;
  const fBlurb = h('input', { type: 'text', class: 'sel', id: 'sk-blurb', maxlength: '70', placeholder: 'One line: what it teaches the agent' }) as HTMLInputElement;
  const fSecret = h('input', { type: 'text', class: 'sel', id: 'sk-secret', maxlength: '40', placeholder: 'optional, e.g. GRAPHQL_TOKEN' }) as HTMLInputElement;
  const swatchBtns = SWATCHES.map((c) => h('button', { type: 'button', class: 'sw-btn', style: `background:${c}`, title: c, 'aria-label': `Colour ${c}`, onClick: () => { fColor.value = c; markSwatch(); } }));
  const markSwatch = (): void => swatchBtns.forEach((b, i) => toggleClass(b, 'on', SWATCHES[i] === fColor.value));
  fColor.addEventListener('input', markSwatch);
  markSwatch();
  const preview = h('span', { class: 'sk-preview' });
  const updatePreview = (): void => {
    const glyph = (fGlyph.value || fName.value.slice(0, 2)).toUpperCase().slice(0, 2) || '??';
    preview.replaceChildren(h('span', { class: 'skill-chip', style: `--c:${fColor.value}` }, glyph));
  };
  [fName, fGlyph, fColor].forEach((i) => i.addEventListener('input', updatePreview));
  updatePreview();
  const fld = (label: string, id: string, ...k: Node[]): HTMLElement => h('div', { class: 'dr-field' }, h('label', { class: 'dr-label', htmlFor: id }, label), ...k);
  const form = h('form', { class: 'sk-form', onSubmit: (e: Event) => { e.preventDefault(); doAdd(); } },
    fld('Name', 'sk-name', fName),
    h('div', { class: 'sk-row2' }, fld('Glyph (2 chars)', 'sk-glyph', fGlyph), fld('Category', 'sk-cat', fCat)),
    h('div', { class: 'dr-field' }, h('span', { class: 'dr-label' }, 'Colour'), h('div', { class: 'sk-swatches' }, ...swatchBtns, fColor, preview)),
    fld('Blurb', 'sk-blurb', fBlurb), fld('Needs secret (optional)', 'sk-secret', fSecret),
    h('div', { class: 'btn-row' }, h('button', { type: 'submit', class: 'btn accent' }, icon('plus'), ' Add to library'), h('button', { type: 'button', class: 'btn', onClick: () => { form.hidden = true; addToggle.setAttribute('aria-expanded', 'false'); } }, 'Close')));
  form.hidden = true;

  function doAdd(): void {
    const name = fName.value.trim();
    if (!name) { setText(msg, 'Give the skill a name.'); fName.focus(); return; }
    if (typeof cmd.addSkill !== 'function') { setText(msg, 'The simulation does not support adding skills yet.'); return; }
    const sk = cmd.addSkill({ name, glyph: (fGlyph.value || name.slice(0, 2)).toUpperCase().slice(0, 2), color: fColor.value, category: fCat.value as SkillCategory, blurb: fBlurb.value.trim() || 'Custom skill', needsSecret: fSecret.value.trim() || undefined, loadTokens: 2000 });
    setText(msg, `Added "${name}".`);
    fName.value = fGlyph.value = fBlurb.value = fSecret.value = ''; updatePreview();
    form.hidden = true; addToggle.setAttribute('aria-expanded', 'false');
    if (sk && sk.id) selected = sk.id;
    sig = ''; ctx.refresh();
  }
  function resetCatalog(): void {
    if (typeof cmd.addSkill !== 'function') { setText(msg, 'The simulation does not support adding skills yet.'); return; }
    const have = new Set((ctx.state.skills ?? []).map((s) => s.id));
    const missing = SKILLS.filter((s) => !have.has(s.id));
    for (const s of missing) cmd.addSkill({ ...s, custom: false });
    setText(msg, missing.length ? `Restored ${missing.length} default skill${missing.length > 1 ? 's' : ''}.` : 'All default skills are already in the library.');
    sig = ''; ctx.refresh();
  }

  // ---- detail panel for the selected skill
  const detail = h('div', { class: 'sk-detail card' });
  detail.hidden = true;
  const equipSel = h('select', { class: 'sel', 'aria-label': 'Agent to equip' }) as HTMLSelectElement;
  const equipBtn = h('button', { type: 'button', class: 'btn tiny accent', onClick: () => { if (selected && equipSel.value) { cmd.equipSkill?.(equipSel.value, selected); ctx.refresh(); } } }, 'Equip');
  const dTitle = h('div', { class: 'card-h sk-d-title' });
  const dClose = h('button', { type: 'button', class: 'ibtn', title: 'Close details', 'aria-label': 'Close skill details', onClick: () => { selected = null; sig = ''; ctx.refresh(); } }, icon('close'));
  const dHave = h('div', { class: 'sk-d-list' });
  const dNeed = h('div', { class: 'sk-d-list' });
  detail.append(h('div', { class: 'sk-d-head' }, dTitle, dClose),
    h('div', { class: 'dr-label' }, 'Equipped by'), dHave,
    h('div', { class: 'dr-label' }, 'Open tickets that need it'), dNeed,
    h('div', { class: 'dr-label' }, 'Equip on an agent'),
    h('div', { class: 'sk-equip' }, equipSel, equipBtn),
    h('p', { class: 'note' }, `Agents keep ${SKILL_SLOTS} skills at once; the least recently used is swapped out.`));

  // ---- catalog grid
  const grid = h('div', { class: 'sk-cats' });
  win.body.append(h('p', { class: 'sec-desc' }, 'Skills are packaged instructions an agent fetches from the library shelves for a ticket. Harder tickets are tagged with more of them. Click one for details.'), toolbar, form, msg, detail, grid);
  win.body.classList.add('skills-body');

  const cardRefs = new Map<string, { row: HTMLElement; n: HTMLElement; confirm: HTMLElement }>();
  let sig = '';
  const rebuild = (skills: Skill[]): void => {
    cardRefs.clear();
    const cats = new Map<string, Skill[]>();
    for (const s of skills) { const a = cats.get(s.category) ?? []; a.push(s); cats.set(s.category, a); }
    const order = [...CATS, ...[...cats.keys()].filter((k) => !CATS.includes(k as SkillCategory))];
    grid.replaceChildren(...order.filter((c) => cats.has(c)).map((c) => h('div', { class: 'skill-cat' },
      h('div', { class: 'm-sub' }, CAT_LABEL[c as SkillCategory] ?? c),
      h('div', { class: 'sk-grid' }, ...cats.get(c)!.map((s) => {
        const n = h('b', { class: 'sk-n', title: 'agents with this skill equipped' });
        const main = h('button', { type: 'button', class: 'sk-main', 'aria-pressed': String(selected === s.id), title: `${s.name}: ${s.blurb}${s.needsSecret ? ` (needs ${s.needsSecret})` : ''}`, onClick: () => { selected = selected === s.id ? null : s.id; sig = ''; confirmId = null; ctx.refresh(); } },
          skillChip(s.id), h('span', { class: 'sk-text' }, h('span', { class: 'sk-name' }, s.name), h('span', { class: 'sk-blurb' }, s.blurb)));
        const x = h('button', { type: 'button', class: 'ibtn sk-x', title: `Remove ${s.name}`, 'aria-label': `Remove skill ${s.name}`, onClick: () => { confirmId = s.id; sig = ''; ctx.refresh(); } }, icon('close'));
        const yes = h('button', { type: 'button', class: 'btn tiny warn', onClick: () => { cmd.removeSkill?.(s.id); if (selected === s.id) selected = null; confirmId = null; sig = ''; ctx.refresh(); } }, 'Remove');
        const no = h('button', { type: 'button', class: 'btn tiny', onClick: () => { confirmId = null; sig = ''; ctx.refresh(); } }, 'Keep');
        const confirm = h('div', { class: 'sk-confirm', role: 'alert' }, h('span', {}, `Remove "${s.name}"?`), yes, no);
        confirm.hidden = confirmId !== s.id;
        const row = h('div', { class: `skill-row-lib${selected === s.id ? ' sel' : ''}${s.custom ? ' custom' : ''}` }, main, s.needsSecret ? h('span', { class: 'chip warn sk-key', title: `needs secret ${s.needsSecret}` }, 'KEY') : null, n, x, confirm);
        cardRefs.set(s.id, { row, n, confirm });
        return row;
      })))));
  };

  const update = (state: SimState): void => {
    const skills = state.skills ?? SKILLS;
    win.setChip(`${skills.length} skills`);
    if (win.isMin()) return;
    const per: Record<string, number> = {};
    for (const a of state.agents) for (const id of a.skills ?? []) per[id] = (per[id] ?? 0) + 1;
    const nextSig = skills.map((s) => s.id + s.color + s.glyph + s.name + s.blurb + (s.needsSecret ?? '')).join(';') + '|' + selected + '|' + confirmId;
    if (nextSig !== sig) { sig = nextSig; rebuild(skills); }
    let total = 0;
    const stock = state.libraryStock;
    for (const s of skills) {
      const c = cardRefs.get(s.id); if (!c) continue;
      const k = per[s.id] ?? 0; total += k;
      setText(c.n, k ? `x${k}` : '');
      toggleClass(c.row, 'out', !!stock && !stock.includes(s.id));
      toggleClass(c.row, 'used', k > 0);
    }
    setText(countEl, `${skills.length} skills - ${total} equipped`);
    win.setChip(`${skills.length} skills - ${total} equipped`);

    // detail
    const sk = selected ? skills.find((s) => s.id === selected) : undefined;
    setHidden(detail, !sk);
    if (!sk) { if (selected) selected = null; return; }
    const holders = state.agents.filter((a) => (a.skills ?? []).includes(sk.id));
    const needers = state.tickets.filter((t) => t.status !== 'merged' && t.status !== 'cancelled' && (t.skills ?? []).includes(sk.id));
    const dsig = sk.id + '|' + holders.map((a) => a.id).join(',') + '|' + needers.map((t) => t.id).join(',') + '|' + state.agents.map((a) => a.id).join(',');
    if (detail.dataset.sig !== dsig) {
      detail.dataset.sig = dsig;
      dTitle.replaceChildren(skillChip(sk.id), h('b', {}, sk.name), h('span', { class: 'dim' }, `${CAT_LABEL[sk.category as SkillCategory] ?? sk.category}${sk.needsSecret ? ` - needs ${sk.needsSecret}` : ''}`));
      dHave.replaceChildren(...(holders.length ? holders.map((a) => h('span', { class: 'sk-who' },
        h('i', { class: `pdot ${a.provider}` }), h('span', { class: 'sk-who-name' }, a.name),
        h('button', { type: 'button', class: 'btn tiny', 'aria-label': `Unequip ${sk.name} from ${a.name}`, onClick: () => { cmd.unequipSkill?.(a.id, sk.id); ctx.refresh(); } }, 'Unequip'))) : [h('span', { class: 'dim' }, 'nobody')]));
      dNeed.replaceChildren(...(needers.length ? needers.map((t) => h('span', { class: 'sk-need', title: t.title }, h('b', {}, t.id), ` ${t.title}`)) : [h('span', { class: 'dim' }, 'none right now')]));
      const cands = state.agents.filter((a) => a.role === 'worker' && !(a.skills ?? []).includes(sk.id));
      equipSel.replaceChildren(...cands.map((a) => h('option', { value: a.id }, `${a.name} (${(a.skills ?? []).length}/${SKILL_SLOTS})`)));
      equipSel.disabled = equipBtn.disabled = cands.length === 0;
    }
    void skillById;
  };
  return { el: win.el, update, win };
}
