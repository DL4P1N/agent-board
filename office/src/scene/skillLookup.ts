import type { Skill } from '../skills';

export interface SkillLike { id: string; name: string; color: string; glyph: string; category: string; custom?: boolean }
export type SkillFn = (id: string) => SkillLike;

const FALLBACK_COLOR = '#9aa4c0';

/** Lookup over the runtime catalog (state.skills) with a safe fallback for unknown ids. */
export class SkillIndex {
  private map = new Map<string, SkillLike>();
  sig = '';
  fn: SkillFn = (id) => this.map.get(id) ?? { id, name: id, color: FALLBACK_COLOR, glyph: (id.slice(0, 2) || '??').toUpperCase(), category: 'quality' };
  /** Rebuild when the catalog changed (cheap signature check). */
  sync(skills: readonly Skill[] | undefined): void {
    const list = skills ?? [];
    let sig = String(list.length);
    for (let i = 0; i < list.length; i++) sig += '|' + list[i].id + list[i].color + list[i].glyph + (list[i].custom ? 'c' : '');
    if (sig === this.sig) return;
    this.sig = sig;
    this.map.clear();
    for (const s of list) this.map.set(s.id, s);
  }
}
