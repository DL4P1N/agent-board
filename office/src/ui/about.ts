import { SKILL_SLOTS } from '../skills';
import { h, pips } from './dom';
import { icon } from './icons';
import { configForDifficulty } from './models';
import { PROVIDERS, PROVIDER_IDS } from '../providers';

export function createAbout(): { el: HTMLDialogElement; open(): void; close(): void; isOpen(): boolean } {
  const rows = [1, 2, 3, 4, 5].map((n) => {
    const c = configForDifficulty('claude', n);
    return h('tr', {}, h('td', {}, pips(n)), ...PROVIDER_IDS.map((id) => h('td', { class: 'tier-cell' }, configForDifficulty(id, n).tier)), h('td', {}, `${c.autocompactBuffer}%`), h('td', {}, String(c.subagents)), h('td', {}, c.effort));
  });
  const close = h('button', { type: 'button', class: 'btn' }, 'Got it');
  const el = h('dialog', { class: 'about', 'aria-labelledby': 'about-title' },
    h('div', { class: 'about-in' },
      h('header', { class: 'about-head' }, h('h2', { id: 'about-title' }, 'About this demo'), h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Close', onClick: () => el.close() }, icon('close'))),
      h('p', { class: 'mock-banner' }, 'This is a simulated frontend demo. There are no real agents, tasks or bills behind it yet.'),
      h('h3', {}, 'What you are looking at'),
      h('p', {}, 'A shared room: every coding agent (Claude Code, Codex, GitHub Copilot, Gemini CLI, Cursor or any MCP tool) gets a cubicle. They pick up task papers from the depot, fetch the skills a task needs from the Skill Library, work at their desk, and hand a pull request to the Integrator. A team joins with one prompt pasted into their agent, and everyone watches the same office.'),
      h('h3', {}, 'The three roles'),
      h('ul', {},
        h('li', {}, h('b', {}, 'Worker agents'), ': take one task at a time, implement it, open a PR, and rework it if it is sent back.'),
        h('li', {}, h('b', {}, 'Orchestrator'), ': manages scope. Plans epics, files tasks with difficulty, skills and a cost estimate, watches the deadline and the budget.'),
        h('li', {}, h('b', {}, 'Integrator'), ': reviews every PR, then merges to main or sends it back for changes.')),
      h('h3', {}, 'Difficulty drives the agent configuration'),
      h('p', {}, 'In auto mode each task picks the agent\'s model, how much context headroom to keep before auto-compaction (the autocompact buffer), and how many subagents it may spawn. Harder tasks also get tagged with more skills.'),
      h('table', { class: 'about-table' }, h('thead', {}, h('tr', {}, ...['Difficulty', ...PROVIDER_IDS.map((id) => PROVIDERS[id].short), 'Buffer', 'Subagents', 'Effort'].map((t) => h('th', {}, t)))), h('tbody', {}, ...rows)),
      h('p', { class: 'note' }, 'Model names for everything except Claude are placeholders: each tool just gets a cheap-to-strong ladder.'),
      h('h3', {}, 'Skills, owners and costs'),
      h('ul', {},
        h('li', {}, h('b', {}, 'Skills'), `: packaged instructions (like Claude Code skills). Each agent keeps up to ${SKILL_SLOTS} equipped and swaps them at the library when a task needs something it lacks.`),
        h('li', {}, h('b', {}, 'Owners'), ': the human who contributed the agent. The colour swatch next to a name is the owner\'s colour, also worn by the agent in the office.'),
        h('li', {}, h('b', {}, 'Costs'), ': every dollar shown is an ESTIMATE from an illustrative price table, never real billing.')),
      h('h3', {}, 'Keyboard'),
      h('p', { class: 'keys' }, ...['V switch 3D office / board view', 'Space pause', '[ ] slower/faster', 'T board', 'L log', 'M metrics', 'P hide panels', 'C comms (chat + paper planes)', 'H project panel', 'Ctrl+K command palette (or / or K)', 'Esc deselect'].flatMap((k) => [h('kbd', {}, k.split(' ')[0]), ` ${k.split(' ').slice(1).join(' ')}   `])),
      h('footer', {}, close)));
  close.addEventListener('click', () => el.close());
  el.addEventListener('click', (e) => { if (e.target === el) el.close(); });
  return { el, open: () => { if (!el.open) el.showModal(); }, close: () => el.close(), isOpen: () => el.open };
}
