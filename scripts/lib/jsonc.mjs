// JSON as editors write it (VS Code's mcp.json, Gemini's settings.json): a leading BOM, // and /* */
// comments and trailing commas are allowed. Strings are kept exactly (a "//" inside a URL is not a comment).
// Throws like JSON.parse when the text isn't valid even then.
export function parseJsonc(text) {
  const s = String(text).replace(/^﻿/, '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== '"') j += s[j] === '\\' ? 2 : 1;
      out += s.slice(i, j + 1);
      i = j;
    } else if (c === '/' && s[i + 1] === '/') {
      while (i < s.length && s[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      if (end < 0) throw new SyntaxError('Unterminated comment in JSON');
      out += ' ';
      i = end + 1;
    } else out += c;
  }
  // A comma whose next non-blank character closes the object or array (strings were copied as they are, so
  // only commas outside them can match: a string ending in ",]" is followed by its quote first).
  return JSON.parse(out.replace(/("(?:[^"\\]|\\.)*")|,(\s*[}\]])/g, (m, str, close) => str ?? close));
}

// True when the text is plain JSON (no BOM, comments or trailing commas): rewriting it loses nothing.
export function isPlainJson(text) {
  try { JSON.parse(text); return true; } catch { return false; }
}
