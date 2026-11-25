// The project repo setting is what goes after `git clone` on every teammate's laptop (join offers to clone it, the
// invite text tells people to paste it into a terminal), so only a plain git address is accepted: never an option
// ("--upload-pack=…" would run a command on the laptop that clones it), and only characters that mean nothing to a
// shell (no spaces, quotes, $, ;, &, |, backticks, brackets or control characters). Shared by the server and join.

// Letters, digits and the characters git addresses use, nothing a shell or git reads specially. No %: cmd.exe expands
// %NAME% in the invite's clone line, and a git address never needs it.
const SAFE = /^[A-Za-z0-9._~:/@+=-]+$/;
// An ssh or https user name: plain and short (bounded, so a long value without "@" is refused at once).
const USER = String.raw`[A-Za-z0-9_][\w.~+-]{0,63}@`;
const FORMS = [
  new RegExp(String.raw`^(?:https?|ssh|git)://(?:${USER})?[A-Za-z0-9][A-Za-z0-9.-]*(?::\d{1,5})?(?:/|$)`, 'i'), // https://github.com/team/project, ssh://git@host:22/x
  /^[A-Za-z0-9_][\w.~+-]{0,63}@[A-Za-z0-9][\w.-]*:[^-]/, // git@github.com:team/project.git
  // A local folder (a rehearsal), with no host: file://host/share is a network (UNC) path on Windows, and git would
  // connect to that host and send it the login's NTLM hash.
  /^file:\/\/\//i,
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
