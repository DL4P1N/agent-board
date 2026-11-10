// The boards registry: which boards exist in the data folder, which one is the default, and which are
// archived. One server can serve several live boards at once (/b/<slug>/…); the default board is also
// served at the root (/, /api, /mcp), so links and joins made before there were several boards keep working.
//
// <root>/boards.json    {default, boards: [{slug, name, dir, status: 'live'|'archived', created, archived_at?}]}
// <root>/boards/<slug>/ a board's data (board.db, token, backups); `dir` is stored relative to <root>
// <root>               the original single board (slug 'main', dir '.'), so existing data isn't moved
// <root>/trash/         deleted boards, moved here (never removed outright)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const RESERVED = ['boards', 'api', 'b', 'trash', 'mcp', 'health', 'admin'];

export function checkSlug(slug) {
  const s = String(slug ?? '').trim();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(s)) throw new Error('A board name for links must be 1–40 characters: lowercase letters, digits and dashes (not at the start or end).');
  if (RESERVED.includes(s)) throw new Error(`"${s}" is reserved; pick another name.`);
  return s;
}

// "KubeCon 2026!" -> "kubecon-2026"
export function slugify(name) {
  return String(name ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'board';
}

export class Registry {
  constructor(root) {
    this.root = path.resolve(root);
    fs.mkdirSync(this.root, { recursive: true });
    this.file = path.join(this.root, 'boards.json');
    this.load();
  }

  load() {
    let raw = null;
    try { raw = fs.readFileSync(this.file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    let data = null;
    if (raw !== null) {
      // A registry that exists but doesn't parse is never replaced: that would forget every board but "main".
      try { data = JSON.parse(raw); } catch (e) {
        throw new Error(`${this.file} is not valid JSON: ${e.message}. Fix it, or restore ${this.file}.bak (the version before the last change).`);
      }
      if (!data || typeof data !== 'object' || !Array.isArray(data.boards)) {
        throw new Error(`${this.file} doesn't look like a boards list (no "boards" array). Fix it, or restore ${this.file}.bak.`);
      }
    }
    if (!data || !data.boards.length) {
      // First run, or a data folder from before there were several boards: it is the board "main".
      data = { default: 'main', boards: [{ slug: 'main', name: 'Main board', dir: '.', status: 'live', created: new Date().toISOString() }] };
      this.data = data;
      this.save();
    }
    this.data = data;
    // Entries are checked before anything acts on their folder: a hand-edited "dir": "../../x" would
    // otherwise let delete/restore move or overwrite folders outside the data folder.
    this.invalid = new Map();
    for (const b of this.data.boards) {
      let why = '';
      try { checkSlug(b.slug); } catch (e) { why = e.message; }
      if (!why && b.dir !== '.' && String(b.dir).split('\\').join('/') !== `boards/${b.slug}`) why = `its folder "${b.dir}" isn't "boards/${b.slug}" (or "." for the original board)`;
      if (why) this.invalid.set(b.slug, why);
    }
    if (!this.data.boards.some((b) => b.slug === this.data.default && b.status === 'live')) {
      const live = this.data.boards.find((b) => b.status === 'live');
      if (live) { this.data.default = live.slug; this.save(); }
    }
    return this.data;
  }

  // Written to a temp file, then renamed: a crash mid-write never leaves a half-written registry.
  // The previous version is kept as boards.json.bak.
  save() {
    try { if (fs.existsSync(this.file)) fs.copyFileSync(this.file, `${this.file}.bak`); } catch {}
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2) + '\n');
    fs.renameSync(tmp, this.file);
  }

  list() { return this.data.boards.map((b) => ({ ...b })); }
  get(slug) { return this.data.boards.find((b) => b.slug === slug) || null; }
  get defaultSlug() { return this.data.default; }
  // Why an entry can't be used (bad slug or folder), or ''.
  problem(slug) { return this.invalid?.get(slug) || ''; }
  dirOf(b) {
    const why = this.problem(b.slug);
    if (why) throw new Error(`Board "${b.slug}" can't be used: ${why}.`);
    return path.resolve(this.root, b.dir);
  }

  // The board BOARD_TOKEN belongs to. Fixed, never "whichever is the default right now": the original
  // board in the data folder itself if there is one, else the board that was the default the first time
  // BOARD_TOKEN was used (remembered in boards.json).
  envTokenSlug() {
    const legacy = this.data.boards.find((b) => b.dir === '.');
    if (legacy) return legacy.slug;
    if (!this.data.env_token_slug || !this.get(this.data.env_token_slug)) { this.data.env_token_slug = this.data.default; this.save(); }
    return this.data.env_token_slug;
  }

  create(name, slug) {
    name = String(name ?? '').trim().slice(0, 80);
    if (!name) throw new Error('Give the board a name, e.g. "KubeCon 2026".');
    slug = checkSlug(slug ? String(slug).trim().toLowerCase() : slugify(name));
    if (this.get(slug)) throw new Error(`There is already a board called "${slug}". Pick another name.`);
    const rel = path.join('boards', slug);
    const dir = path.resolve(this.root, rel);
    if (fs.existsSync(path.join(dir, 'board.db'))) throw new Error(`${dir} already holds a board. Use import, or pick another name.`);
    fs.mkdirSync(dir, { recursive: true });
    const b = { slug, name, dir: rel.replace(/\\/g, '/'), status: 'live', created: new Date().toISOString() };
    this.data.boards.push(b);
    this.save();
    return { ...b };
  }

  archive(slug) {
    const b = this.must(slug);
    if (slug === this.data.default) throw new Error('This is the default board: make another board the default first.');
    if (b.status === 'archived') return { ...b };
    b.status = 'archived'; b.archived_at = new Date().toISOString();
    this.save();
    return { ...b };
  }

  restore(slug) {
    const b = this.must(slug);
    b.status = 'live'; delete b.archived_at;
    this.save();
    return { ...b };
  }

  setDefault(slug) {
    const b = this.must(slug);
    if (b.status !== 'live') throw new Error(`"${slug}" is archived: restore it first.`);
    this.data.default = slug;
    this.save();
    return { ...b };
  }

  // Archived boards only. The folder is moved to <root>/trash/<slug>-<time>/, never deleted.
  remove(slug) {
    const b = this.must(slug);
    if (b.status !== 'archived') throw new Error(`Archive "${slug}" first; only archived boards can be deleted.`);
    if (b.dir === '.' || path.resolve(this.root, b.dir) === this.root) throw new Error(`"${slug}" lives in the data folder itself and can't be moved to the trash. Archive it and leave it.`);
    const trash = path.join(this.root, 'trash');
    fs.mkdirSync(trash, { recursive: true });
    const src = this.dirOf(b);
    // Milliseconds in the name, so two deletes of the same name in one second don't collide.
    const dest = path.join(trash, `${slug}-${new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').replace('.', '').slice(0, 18)}`);
    let moved = null;
    if (fs.existsSync(src)) { fs.renameSync(src, dest); moved = dest; }
    this.data.boards = this.data.boards.filter((x) => x.slug !== slug);
    this.save();
    return { slug, moved_to: moved };
  }

  must(slug) {
    const b = this.get(slug);
    if (!b) throw new Error(`No board called "${slug}".`);
    return b;
  }
}

// A board's human token: its `token` file, created on first use.
export function boardToken(dir) {
  const f = path.join(dir, 'token');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  fs.mkdirSync(dir, { recursive: true });
  const t = crypto.randomBytes(12).toString('base64url');
  fs.writeFileSync(f, t);
  return t;
}

// The host's admin token (manage boards): BOARD_ADMIN_TOKEN, else <root>/admin-token, created on first use.
export function adminToken(root) {
  if (process.env.BOARD_ADMIN_TOKEN) return process.env.BOARD_ADMIN_TOKEN;
  const f = path.join(root, 'admin-token');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  const t = 'admin-' + crypto.randomBytes(15).toString('base64url');
  fs.writeFileSync(f, t);
  return t;
}
