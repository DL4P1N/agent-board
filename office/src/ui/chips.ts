import { SKILL_BY_ID, SKILL_SLOTS, type Skill } from '../skills';
import { h, setAttr } from './dom';

let catalog = new Map<string, Skill>();
let catalogSig = '';
let catalogVersion = 0;
/** Feed the runtime catalog (state.skills) once per UI update; chips look skills up here, falling back to the static seed. */
export function setCatalog(skills: Skill[] | undefined): void {
  if (!skills) return;
  const sig = skills.map((s) => `${s.id}|${s.color}|${s.glyph}|${s.name}`).join(';');
  if (sig === catalogSig) return;
  catalogSig = sig; catalogVersion++;
  catalog = new Map(skills.map((s) => [s.id, s]));
}
export const skillById = (id: string): Skill | undefined => catalog.get(id) ?? SKILL_BY_ID[id];

export function skillChip(id: string, kind: 'plain' | 'have' | 'need' = 'plain'): HTMLElement {
  const s = skillById(id);
  const el = h('span', { class: `skill-chip ${kind}`, style: `--c:${s?.color ?? '#94a3b8'}` }, s?.glyph ?? id.slice(0, 2).toUpperCase());
  el.title = s ? `${s.name} - ${s.blurb}${kind === 'need' ? ' (assignee still has to fetch this)' : kind === 'have' ? ' (equipped)' : ''}` : id;
  return el;
}

/** Re-render a chip row only when its signature changes. `have` marks chips the assignee already has. */
export function setSkillChips(box: HTMLElement, ids: string[] | undefined, have: string[] | null): void {
  const list = ids ?? [];
  const sig = catalogVersion + ':' + list.map((id) => id + (have ? (have.includes(id) ? '+' : '-') : '')).join(',');
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  while (box.firstChild) box.removeChild(box.firstChild);
  for (const id of list) box.appendChild(skillChip(id, have ? (have.includes(id) ? 'have' : 'need') : 'plain'));
}

/** Fixed SKILL_SLOTS slots: equipped chips then dashed empty slots. */
export function setSkillSlots(box: HTMLElement, ids: string[] | undefined, size: 'sm' | 'md' = 'md'): void {
  const list = (ids ?? []).slice(0, SKILL_SLOTS);
  const sig = catalogVersion + size + list.join(',');
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  while (box.firstChild) box.removeChild(box.firstChild);
  for (let i = 0; i < SKILL_SLOTS; i++) {
    if (i < list.length) box.appendChild(skillChip(list[i]));
    else box.appendChild(h('span', { class: 'skill-chip empty', title: 'empty skill slot' }, ''));
  }
  setAttr(box, 'aria-label', `${list.length} of ${SKILL_SLOTS} skill slots equipped`);
}
