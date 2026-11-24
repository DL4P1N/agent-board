// The project repo setting is what goes after `git clone` on every teammate's laptop (join offers to clone it, the
// invite text tells people to paste it into a terminal), so only a plain git address is accepted: never an option
// ("--upload-pack=…" would run a command on the laptop that clones it), and only characters that mean nothing to a
// shell (no spaces, quotes, $, ;, &, |, backticks, brackets or control characters). Shared by the server and join.

// Letters, digits and the characters git addresses use, nothing a shell or git reads specially.
const SAFE = /^[A-Za-z0-9._~:/@%+=-]+$/;
const FORMS = [
  /^(?:https?|ssh|git):\/\/(?:[\w.~%+-]+@)?[A-Za-z0-9]/i, // https://github.com/team/project, ssh://git@host:22/x
  /^[A-Za-z0-9][\w.-]*@[A-Za-z0-9][\w.-]*:[^-]/, // git@github.com:team/project.git
  /^file:/i, // a local folder (a rehearsal)
  /^[\w.][\w.-]*\/[\w.-]+$/, // team/project
];

// '' (no repo) or a git address join may clone; anything else is refused.
export function isRepoUrl(v) {
  const s = String(v ?? '');
  if (!s) return true;
  return s.length <= 500 && !s.startsWith('-') && SAFE.test(s) && FORMS.some((re) => re.test(s));
}

// For printing a value that came from the server: control characters (a fake line, terminal escapes) are dropped.
export const printable = (v) => String(v ?? '').replace(/[\0-\x1f\x7f-\x9f]/g, '');
