// Automatic backups of one board (the host laptop can crash or sleep).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BACKUP_MS = process.env.BOARD_BACKUP_SECONDS ? Number(process.env.BOARD_BACKUP_SECONDS) * 1000 : (process.env.BOARD_BACKUP_MINUTES !== undefined ? Number(process.env.BOARD_BACKUP_MINUTES) : 10) * 60e3;

export function startBackups({ board, dir, slug, every, later }) {
  // `VACUUM INTO` a consistent copy every 10 minutes (BOARD_BACKUP_MINUTES; 0 = off), keep the newest 24,
  // skip when nothing happened since the last one. Restore with `npm run restore`.
  const BACKUP_DIR = path.join(dir, 'backups');
  // What the board holds (events, tasks, settings), without presence, which changes all the time. Kept
  // in backups/.last, so a restart doesn't make a new backup when nothing changed.
  function boardFingerprint() {
    const t = board.db.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(updated_at), 0) AS u FROM tasks').get();
    const settings = board.db.prepare('SELECT key, value FROM settings ORDER BY key').all().map((r) => `${r.key}=${r.value}`).join('\n');
    const q = board.db.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(answered_at), 0) AS a FROM questions').get();
    return crypto.createHash('sha256').update(`${board.latestEventId()}|${t.n}|${t.u}|${q.n}|${q.a}|${settings}`).digest('hex').slice(0, 32);
  }
  function backup() {
    const fp = boardFingerprint();
    const lastFile = path.join(BACKUP_DIR, '.last');
    let last = ''; try { last = fs.readFileSync(lastFile, 'utf8').trim(); } catch {}
    if (fp === last) return null;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    // UTC time in the name (same board-YYYYMMDD-HHMMSS shape restore expects): sorting stays right
    // across daylight-saving changes.
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '').replace('T', '-'); // 20261110-153000
    const file = path.join(BACKUP_DIR, `board-${stamp}.db`);
    if (fs.existsSync(file)) return null;
    board.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    fs.writeFileSync(lastFile, fp);
    const all = fs.readdirSync(BACKUP_DIR).filter((f) => /^board-\d{8}-\d{6}\.db$/.test(f)).sort();
    for (const f of all.slice(0, Math.max(0, all.length - 24))) { try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch {} }
    return file;
  }
  if (BACKUP_MS > 0 && Number.isFinite(BACKUP_MS)) {
    const run = () => { try { backup(); } catch (e) { console.error(`backup failed (${slug}): ${e.message}`); } };
    later(run, Math.min(30e3, BACKUP_MS));
    every(run, Math.max(1000, BACKUP_MS));
  }
}
