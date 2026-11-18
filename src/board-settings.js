// A board's hidden settings: underscore keys in its settings table (the webhook URL, "already announced"
// flags, the last CI result). getSettings hides them, so agents never see them.

export function hiddenSettings(board) {
  const rawSetting = (k) => board.db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value ?? null;
  const putSetting = (k, v) => board.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);
  const announced = { has: (k) => !!board.db.prepare('SELECT 1 FROM settings WHERE key = ?').get(k), add: (k) => board.db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, '1')").run(k) };
  return { rawSetting, putSetting, announced };
}
