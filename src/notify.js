// Notifications to humans away from the laptop (Slack / Discord / ntfy / any webhook). The URL checks, the
// private-address list and the pinned delivery live in src/webhook.js; this is the glue: message formats per
// service, which board events are worth a buzz, de-duplication and the /api/notify routes.
import { DIRECT } from './board.js';
import { checkNotifyUrl, resolveNotifyTarget, sendWebhook } from './webhook.js';
import { bestBase } from './network.js';
import { h } from './http-util.js';
import { TOKEN_ROTATED } from './auth.js';

export const NOTIFY_EVENTS = ['questions', 'main', 'blocked', 'conflict', 'freeze', 'limit'];
function notifyKind(url) {
  if (!url) return null;
  let u; try { u = new URL(url); } catch { return null; }
  // ?kind=slack|discord|ntfy|generic forces a format (self-hosted relays, tests).
  const forced = u.searchParams.get('kind');
  if (['slack', 'discord', 'ntfy', 'generic'].includes(forced)) return forced;
  if (/(^|\.)hooks\.slack\.com$/i.test(u.hostname)) return 'slack';
  if (/(^|\.)(discord|discordapp)\.com$/i.test(u.hostname) && /\/api\/webhooks\//.test(u.pathname)) return 'discord';
  if (/ntfy/i.test(u.hostname) || u.searchParams.get('ntfy') === '1') return 'ntfy';
  return 'generic';
}
// "https://hooks.slack.com/…/abcd": enough to recognise it, not enough to use it.
function maskUrl(url) {
  if (!url) return null;
  try { const u = new URL(url); const tail = (u.pathname + u.search).replace(/\/+$/, '').slice(-4); return `${u.protocol}//${u.host}/…${tail ? '/' + tail : ''}`; } catch { return null; }
}
// The webhook URL checks, the private-address list and the pinned delivery live in src/webhook.js.
// Slack: escape &, <, > so agent text can't produce <!channel>/<!here> pings or links.
const slackEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// One board's notifications: the event listener and the /notify routes on its API router.
// `humanToken` is the middleware that lets only humans through (the URL is a secret); `tokenCurrent(req)`: the
// request's token is still valid (not retired by a rotation since it came in).
export function setupNotifications({ board, slug, api, prefix, humanToken, rawSetting, putSetting, tokenCurrent = () => true }) {
  // ---------- notifications to humans away from the laptop (Slack / Discord / ntfy / any webhook) ----------
  // At Kubecon a question waited 31 minutes for a human. Settings `_notify_url` / `_notify_events` are
  // underscore keys, so agents never see them (getSettings hides them).
  const notifyEvents = () => (rawSetting('_notify_events') ?? NOTIFY_EVENTS.join(',')).split(',').map((s) => s.trim()).filter((s) => NOTIFY_EVENTS.includes(s));
  const boardLinkNoToken = () => `${bestBase()}${prefix()}`;
  let notifyFailLogged = 0;
  async function deliver(text, kind = 'info', url = rawSetting('_notify_url')) {
    if (!url) return { ok: false, status: 0, error: 'No webhook set.' };
    const k = notifyKind(url); const link = boardLinkNoToken();
    const full = `${text}\n${link}`;
    let init;
    // Text written by agents goes into these messages: no channel-wide pings from it.
    if (k === 'slack') init = { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: slackEscape(full) }) };
    else if (k === 'discord') init = { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: full.slice(0, 1900), allowed_mentions: { parse: [] } }) };
    else if (k === 'ntfy') init = { headers: { 'Content-Type': 'text/plain; charset=utf-8', Title: 'Agent Board', Tags: kind === 'test' ? 'bell' : kind, Click: link }, body: text };
    // Generic webhook: board stays 'claude-board' (its value before the rename to Agent Board) so receivers that filter on it keep working.
    else init = { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, kind, board: 'claude-board', app: 'agent-board', url: link }) };
    try {
      // Checked again before every delivery (DNS can change after the URL was saved), and sent to the
      // address that was checked. No redirects: a public URL answering 307 to an internal address must not reach it.
      const r = await sendWebhook(url, init);
      if (r.status >= 300 && r.status < 400) throw Object.assign(new Error(`HTTP ${r.status}: the webhook redirects, which isn't allowed`), { status: r.status });
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
      return { ok: true, status: r.status };
    } catch (e) {
      if (Date.now() - notifyFailLogged > 60e3) { notifyFailLogged = Date.now(); console.error(`notify (${slug}): webhook failed (${e.message})`); }
      return { ok: false, status: e.status || 0, error: String(e.message || e) };
    }
  }
  // Identical texts within a minute are sent once, and at most NOTIFY_CAP messages go out per 10 minutes.
  const NOTIFY_CAP = 20;
  const recentNotes = new Map();
  let sentTimes = []; let capLogged = 0;
  function notify(kind, text) {
    if (!rawSetting('_notify_url') || !notifyEvents().includes(kind)) return;
    const now = Date.now();
    for (const [k, t] of recentNotes) if (now - t > 60e3) recentNotes.delete(k);
    if (recentNotes.has(text)) return;
    sentTimes = sentTimes.filter((t) => now - t < 10 * 60e3);
    if (sentTimes.length >= NOTIFY_CAP) {
      if (now - capLogged > 60e3) { capLogged = now; console.error(`notify (${slug}): more than ${NOTIFY_CAP} messages in 10 minutes; dropping the rest for now`); }
      return;
    }
    recentNotes.set(text, now); sentTimes.push(now);
    deliver(text, kind).catch(() => {});
  }
  // Which board events are worth a phone buzz.
  board.bus.on('event', (e) => {
    if (!e || !e.id) return;
    // Direct messages never leave the board.
    if (e.channel === DIRECT) return;
    const t = String(e.text || '');
    if (e.kind === 'question') return notify('questions', `${e.author} asks: ${t}`);
    if (e.kind === 'task_updated' && e.data?.status === 'blocked' && /→ blocked/.test(t)) {
      const note = t.replace(/^#\d+\s*/, '').replace(/^\w+ → blocked(\s+—\s+)?/, '').trim();
      return notify('blocked', `#${e.task_id} blocked${note ? `: ${note}` : ''} (${e.author})`);
    }
    if (e.kind !== 'message') return;
    if (e.author === 'board' && /^@all main is failing/.test(t)) return notify('main', t.replace(/^@all\s+/, ''));
    if (e.author === 'board' && /is being used from \d+ laptops/.test(t)) return notify('conflict', t.replace(/^@all\s+/, ''));
    if (e.author === 'board' && /^@all (FEATURE FREEZE|Feature freeze in 30 minutes|Demo time)/.test(t)) return notify('freeze', t.replace(/^@all\s+/, ''));
    // Only the board's own announcement: an agent writing "hit its usage limit" in chat isn't one.
    if (e.data?.notice === 'limit') return notify('limit', t.replace(/^@all\s+/, ''));
  });
  const notifyInfo = () => { const url = rawSetting('_notify_url'); return { url: maskUrl(url), kind: notifyKind(url), events: notifyEvents() }; };
  api.get('/notify', humanToken, h(() => notifyInfo()));
  // Moves on every save: a save that waited for DNS doesn't overwrite one made meanwhile (e.g. notifications off).
  let revision = 0;
  api.put('/notify', humanToken, h(async (req, res) => {
    const b = req.body || {};
    const rev = revision;
    if (b.url !== undefined) {
      const url = String(b.url || '').trim();
      if (url) {
        await resolveNotifyTarget(url);
        // The lookup can take a while. Meanwhile the board may have been archived, the token rotated (this
        // request's sender may no longer change anything), or the settings changed by someone else.
        if (board.closed) { res.status(410); throw new Error('This board is archived.'); }
        if (!tokenCurrent(req)) { res.status(401); throw new Error(TOKEN_ROTATED); }
        if (revision !== rev) { res.status(409); throw new Error('The notification settings were changed while this URL was being checked. Look at them again, then save.'); }
      }
      putSetting('_notify_url', url ? checkNotifyUrl(url) : '');
    }
    if (b.events !== undefined) {
      const list = (Array.isArray(b.events) ? b.events : String(b.events).split(',')).map((s) => String(s).trim()).filter((s) => NOTIFY_EVENTS.includes(s));
      putSetting('_notify_events', [...new Set(list)].join(','));
    }
    revision++;
    return notifyInfo();
  }));
  api.post('/notify/test', humanToken, h(async () => {
    if (!rawSetting('_notify_url')) return { ok: false, status: 0, error: 'Set a webhook URL first.' };
    return deliver('Test from Agent Board: notifications reach this channel.', 'test');
  }));

}
