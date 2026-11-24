// Setup: the step-by-step guide (invite, goal, demo time, start, backlog, integrator), the webhook and token rotation
// boxes, and the write-up and backup export.

import './topbar.js';
import { $, ANYONE, BASE, me, setToken, state, store, token, ui } from './state.js';
import { agentRoot, ago, canMove, cmdBox, esc, hs, motion, nameTag, patch, plural, root, toast, when, youTag } from './helpers.js';
import { api, connect, load, showGate, tokenChange, tokenError, unavailableStatus } from './data.js';
import { agentState, approvalWait, capText, clientOf, copilotLaunch, dlSkipped, notStartedText, setupShown, startCmd,
  stepOpen, teamCapacity, timeNow } from './derived.js';
import { render } from './render.js';
import { ciPill } from './tasks.js';
import { copyText } from './actions.js';

// ---------- export: write-up + backup ----------
async function fetchExport(kind) {
  let r;
  try { r = await fetch(BASE + '/api/' + (kind === 'json' ? 'export' : kind === 'retro' ? 'retro' : 'summary'), { cache: 'no-store', headers: { Authorization: 'Bearer ' + token } }); }
  catch { throw new Error('Cannot reach the board server. Is it still running?'); }
  const body = await r.clone().json().catch(() => ({}));
  if (unavailableStatus(r.status, body)) throw new Error('Token rejected');
  if (r.status === 401) { showGate(tokenError(body)); throw new Error('Token rejected'); }
  if (!r.ok) throw new Error(`Could not get the ${kind === 'json' ? 'backup' : kind === 'retro' ? 'retro' : 'summary'} (${r.status})`);
  return r.text();
}
async function exportFile(kind, btn) {
  if (btn) btn.disabled = true;
  try {
    const text = await fetchExport(kind);
    if (kind === 'copy') return copyText(text, btn, 'Summary copied (markdown). Paste it into your submission.');
    const day = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: kind === 'json' ? 'application/json' : 'text/markdown' }));
    a.download = kind === 'json' ? `agent-board-backup-${day}.json` : kind === 'retro' ? `agent-board-retro-${day}.md` : `agent-board-summary-${day}.md`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast(kind === 'json' ? 'Backup downloaded (JSON).' : kind === 'retro' ? 'Retro downloaded (markdown): what took long, review bounces, where it got stuck.' : 'Summary downloaded (markdown).');
  } catch (e) { if (e.message !== 'Token rejected') toast(e.message, true); }
  finally { if (btn) { btn.disabled = false; btn.focus({ preventScroll: true }); } }
}
const exportBtns = (k) => `<button type="button" data-act="export-md" data-fk="${k}-md">Download summary (.md)</button><button type="button" class="ghost" data-act="export-copy" data-fk="${k}-cp">Copy summary</button><button type="button" class="ghost" data-act="export-retro" data-fk="${k}-rt" title="For the team: time per task, review bounces, where work got stuck">Download retro (.md)</button><button type="button" class="ghost" data-act="export-json" data-fk="${k}-js">Download backup (JSON)</button>`;
function renderSetup(si) {
  const el = $('setup');
  el.hidden = !setupShown(si);
  // Closed, it's emptied once it has faded out (3D on: it closes like the top bar's other popovers).
  if (el.hidden) { clearTimeout(el._empty); if (!el._html || !canMove()) return patch(el, ''); el._empty = setTimeout(() => { if (el.hidden) patch(el, ''); }, motion().fast + 20); return; }
  const body = { invite: stepInvite, goal: stepGoal, start: stepStart, backlog: stepBacklog, integrator: () => stepIntegrator() };
  const all = si.doneCount >= si.steps.length;
  // The panels' title bar: its name, how far along it is, then x (closes it, focus back on the Setup chip). Once every
  // step is done, the intro and "steps tick off by themselves" go.
  const sub = `${si.doneCount} of ${si.steps.length} done${all ? '' : ' · steps tick off by themselves'}`;
  patch(el, `<div class="o-head"><h2 id="setup-h">Setup</h2><span class="o-sub" title="${sub}">${sub}</span><button type="button" class="o-ib" data-act="setup-close" data-fk="s-x" aria-label="Close Setup" title="Close Setup">×</button></div>
    <div class="o-body">${all ? '' : `<p class="intro">This board coordinates your team's AI coding agents: Claude Code, Codex, GitHub Copilot, Gemini CLI or Cursor (or any MCP tool), mixed however you like. They split the goal into small tasks, claim them, build each one in its own git branch, and ask you here when they need a decision.</p>`}
    <ol class="steps">${si.steps.map((s, i) => {
      const open = stepOpen(s.key, si.cur);
      const tick = s.done;
      return `<li class="step ${tick ? 'done' : ''} ${s.key === si.cur ? 'cur' : ''}" id="step-${s.key}">
        <button type="button" class="step-h" data-step="${s.key}" data-fk="sh-${s.key}" aria-expanded="${open}" aria-controls="sb-${s.key}">
          <span class="mk" aria-hidden="true">${tick ? '✓' : i + 1}</span><span class="step-t">${esc(s.title)}${tick ? '<span class="vh"> (done)</span>' : ''}</span><span class="step-s">${esc(s.sum)}</span></button>
        ${open ? `<div class="step-b" id="sb-${s.key}">${body[s.key](si)}</div>` : ''}</li>`;
    }).join('')}</ol>
    <div class="boardsec" id="board-sec">${securityBox()}</div></div>`);
}
// "Team can run 7 tasks at once · 4 running", and a warning when idle agents outnumber the ready tasks.
function teamCapHtml() {
  const c = teamCapacity(); if (!c.agents.length) return '';
  const tip = `Started, online agents: ${c.agents.map((a) => `${a.name} (${[a.client, a.plan].filter(Boolean).join(', ') || 'agent'}: ${capText(a)})`).join('; ')}. ${plural(c.ready, 'open task is', 'open tasks are')} ready to claim.`;
  const low = c.short && state.tasks.length && state.phase === 'building';
  return `<p class="capline${low ? ' low' : ''}" title="${esc(tip)}"><b>Team capacity:</b> ${plural(c.slots, 'task')} at once across ${plural(c.agents.length, 'started agent')} · ${c.running} running · ${plural(c.ready, 'open task', 'open tasks')} ready${low ? `. ${plural(c.idle.length, 'agent has', 'agents have')} nothing to do: add tasks, or ask the planner for more.` : ''}</p>`;
}
function chips(si, laptops = false) {
  return `<div class="chips${laptops ? ' lines' : ''}">${si.ros.filter((r) => r.agent || (!laptops && r.humanOnline)).map((r) => {
    const bits = r.agents.map((a) => { const st = agentState(a); return `${a.plan || a.client || 'agent'} ${st === 'waiting' ? notStartedText(a) : st === 'online' ? `online · ${capText(a)} tasks` : st}`; });
    if (r.humanOnline) bits.push(r.name === me ? 'you' : 'watching');
    const tip = (r.agent ? r.agents.map((a) => { const st = agentState(a); const nm = `${a.name}${a.client ? ` (${a.client})` : ''}`;
      return st === 'online' ? `${nm} is running on the board.` : st === 'waiting' ? `${nm} is connected, but nobody started it: type ${startCmd(a.client)} in it.` : `${nm} was last seen ${ago(a.last)}.`; }).join(' ') + ' ' : 'No agent connected under this name. ') + (r.humanOnline ? 'Has this page open.' : '');
    return `<span class="chip" title="${esc(tip)}"><span class="on ${r.working || r.humanOnline ? 'y' : r.waiting ? 'w' : ''}"></span><span class="pc" ${hs(r.name)}>${esc(r.name)}</span><span class="muted">${esc(bits.join(' · '))}</span></span>`;
  }).join('')}</div>`;
}
// Friendlier wording for the server's address labels; the adapter name stays in the tooltip.
const addrText = (a) => a.ip === 'localhost' ? 'Only works on this laptop' : /^same wifi/i.test(a.label) ? 'Works for teammates on the same wifi' : /^Tailscale/i.test(a.label) ? 'Works across networks (Tailscale)' : /^Cloudflare/i.test(a.label) ? 'Works from any network (Cloudflare tunnel)' : /^virtual/i.test(a.label) ? 'Virtual adapter: probably not reachable' : a.label;
function boardLink() {
  const best = state.setup?.join_commands?.[0];
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return local && best && best.ip !== 'localhost' ? best.web_url : `${location.origin}${BASE}/?token=${encodeURIComponent(token)}`;
}
// The repo setting as one shell word, safe to paste into a terminal: as it is when it holds only characters a
// shell reads literally (the server accepts no others), else single-quoted, without control characters.
const shellArg = (v) => {
  const s = String(v).replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
  return /^[A-Za-z0-9._~:/@%+=-]+$/.test(s) ? s : "'" + s.replace(/'/g, "'\\''") + "'";
};
// One ready-to-paste message for the team chat.
function inviteText() {
  const su = state.setup || {}; const best = su.join_commands?.[0]; const S = state.settings;
  const join = best?.command || 'npm run join -- --url <board address> --token <token>  (ask the host)';
  const L = ['Join our team board (Agent Board). On your laptop:', ''];
  let n = 1;
  L.push(`${n++}. First time only, get the board tool:`, `   ${su.clone_command || 'git clone https://github.com/DL4P1N/agent-board && cd agent-board'}`, '   (already have an agent-board folder, or an older claude-board one? run git pull in it)');
  L.push(`${n++}. In the agent-board folder, connect your laptop (it asks your name, AI tool and project folder):`, `   ${join}`);
  if (S.repo) L.push(`${n++}. Get the project repo (if you don't have it yet):`, `   git clone ${shellArg(S.repo)}`);
  L.push(`${n++}. Then open your AI tool in the project repo and type /board`, `   (Codex: $board · Copilot CLI: start it with  ${copilotLaunch()}  then type /board)`);
  L.push('   (Gemini CLI: /board · Cursor: /board in the Agent chat)');
  L.push('', `Just watching? Open ${boardLink()}`);
  return L.join('\n');
}
// A QR code image for some text, drawn by the board server (works offline: no outside service).
const qrSrc = (text) => `${BASE}/api/qr.svg?token=${encodeURIComponent(token)}&text=${encodeURIComponent(text)}`;
function stepInvite(si) {
  const su = state.setup;
  if (!su || !su.join_commands?.length) return '<p>Ask the host for the join command printed by <code>npm start</code>.</p>' + chips(si);
  const [best, ...rest] = su.join_commands;
  const onlyLocal = best.ip === 'localhost';
  return `<p>Everyone who'll run an AI agent (you too) connects their laptop once, in a terminal. It takes about a minute.</p>
    <div class="inl mt-2"><button type="button" class="ghost" data-act="copy-invite" data-fk="s-invite">Copy invite message</button><span class="muted t-meta">One message for your team chat with every step below${state.settings.repo ? ' and the project repo' : ''}.</span></div>
    <div class="sub"><b>First time on this laptop?</b> Get the board tool first. Skip this if you already have an <code>agent-board</code> folder (or an older <code>claude-board</code> one: then run <code>git pull</code> in it, so it's up to date).</div>${cmdBox(su.clone_command, 'clone', 'download command')}
    <div class="sub"><b>Connect to this board:</b> run it inside the <code>agent-board</code> folder. It asks your name, which AI tool(s) you use and where your project is, then tests the connection.</div>${cmdBox(best.command, 'join', 'join command')}
    ${onlyLocal ? '<p class="note">No network address found, so teammates can\'t reach this laptop yet. Join the same wifi, start Tailscale, or restart the board with <code>npm run tunnel</code>.</p>' : `<p class="hint" title="${esc(best.label)}">${esc(addrText(best))}.</p>`}
    ${rest.length ? `<button type="button" class="link muted t-meta mt-1" data-act="addrs" data-fk="addrs" aria-expanded="${ui.addrs}"><span class="chev" aria-hidden="true">▾</span> Other addresses (if that one doesn't connect)</button>
      ${ui.addrs ? rest.map((a, i) => `<div class="sub" title="${esc(a.label)}">${esc(addrText(a))}</div>${cmdBox(a.command, 'alt' + i, 'join command: ' + addrText(a))}`).join('') : ''}` : ''}
    <div class="sub">Just want to watch? Send them this page's link</div>${cmdBox(best.web_url, 'web', 'board link')}
    <button type="button" class="link muted t-meta mt-1" data-act="qr" data-fk="qr-tog" aria-expanded="${!!ui.qr}" aria-controls="qr-codes"><span class="chev" aria-hidden="true">▾</span> ${ui.qr ? 'Hide QR code' : 'Show QR code (scan with a phone)'}</button>
    ${ui.qr ? `<div class="qrs" id="qr-codes">
      <figure><img src="${esc(qrSrc(best.web_url))}" alt="QR code for this board's link, ${esc(best.web_url)}" width="180" height="180"><figcaption>Board link: open it on a phone to watch. To connect a laptop, copy the join command above or send the invite message.</figcaption></figure></div>` : ''}
    ${si.ros.some((r) => r.agent) ? `<div class="sub">Laptops connected</div>${chips(si, true)}` : ''}
    ${(() => { const w = si.ros.filter((r) => r.humanOnline && !r.agent); return w.length ? `<p class="muted t-meta mt-1">Watching this page: ${w.map((r) => `${nameTag(r.name)}${youTag(r.name)}`).join(', ')}</p>` : ''; })()}
    ${notifyBox()}`;
}

// ---------- notifications to a team chat or phone (webhook) ----------
// Keys as the server names them (src/server.js NOTIFY_EVENTS).
const NOTIFY_EVENTS = [['questions', 'Questions for humans'], ['main', 'main is failing'], ['blocked', 'Blocked tasks'], ['conflict', 'Same name on two laptops'], ['freeze', 'Feature freeze'], ['limit', 'Usage limits']];
const NOTIFY_KIND = { slack: 'Slack', discord: 'Discord', ntfy: 'ntfy (phone push)', generic: 'a plain webhook (JSON POST)', other: 'a plain webhook (JSON POST)' };
// The server may send events as a list of keys or as {key: true}.
const nfEvents = (ev) => new Set(Array.isArray(ev) ? ev : typeof ev === 'string' ? ev.split(',').filter(Boolean) : ev && typeof ev === 'object' ? Object.keys(ev).filter((k) => ev[k]) : NOTIFY_EVENTS.map(([k]) => k));
async function loadNotify() {
  if (ui.nf.loading) return; ui.nf.loading = true;
  try {
    const r = await api('/notify');
    Object.assign(ui.nf, { loaded: true, url: r.url || '', kind: r.kind || null, events: nfEvents(r.events), err: '' });
  } catch (e) { Object.assign(ui.nf, { loaded: true, err: e.message, events: ui.nf.events || nfEvents(null) }); }
  ui.nf.loading = false; render();
}
function notifyBox() {
  const n = ui.nf;
  const tog = `<button type="button" class="link muted t-meta mt-2" data-act="nf-tog" data-fk="nf-tog" aria-expanded="${n.open}" aria-controls="nf-box"><span class="chev" aria-hidden="true">▾</span> Notifications when you're away${n.url ? ` <span class="pill ok">on · ${esc(NOTIFY_KIND[n.kind] || 'webhook')}</span>` : ''}</button>`;
  if (!n.open) return tog;
  if (!n.loaded) { if (!n.loading) setTimeout(loadNotify, 0); return `${tog}<p class="muted" id="nf-box">Loading…</p>`; }
  const ev = n.events || nfEvents(null);
  return `${tog}<form class="nf" id="nf-box" data-notifyform>
    <p class="hint m0">Gets questions to you when you're away from the laptop: the board posts to your team chat or phone.</p>
    ${n.url && !n.change ? `<div class="sub">Webhook</div>
    <p class="m0" id="nf-saved">Sending to ${esc(NOTIFY_KIND[n.kind] || 'a webhook')}: <code>${esc(n.url)}</code></p>
    <div class="inl m0"><button type="button" class="ghost" data-act="nf-change" data-fk="nf-change">Edit</button><button type="button" class="ghost" data-act="nf-off" data-fk="nf-off">Remove</button></div>`
    : `<label for="nf-url">${n.url ? 'New webhook URL' : 'Webhook URL: Slack, Discord, ntfy, or any URL that accepts a POST'}</label>
    <input type="url" id="nf-url" data-keep="nf-url" autocomplete="off" spellcheck="false" placeholder="https://hooks.slack.com/services/… or https://ntfy.sh/your-topic" aria-describedby="nf-hint nf-err">
    <p class="hint m0" id="nf-hint">${n.url ? 'Replaces the saved one when you press Save. ' : ''}For a phone: install the ntfy app, subscribe to a hard-to-guess topic, and paste <code>https://ntfy.sh/&lt;topic&gt;</code> here.</p>`}
    <fieldset><legend>Send</legend>${NOTIFY_EVENTS.map(([k, l]) => `<label><input type="checkbox" data-nev="${k}" data-fk="nev-${k}" ${ev.has(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>
    <div class="inl m0"><button type="submit" data-fk="nf-save">Save</button>
      <button type="button" class="ghost" data-act="nf-test" data-fk="nf-test" ${n.url ? '' : 'disabled title="Save a webhook URL first"'}>Send test</button>
      ${n.url && n.change ? '<button type="button" class="ghost" data-act="nf-keep" data-fk="nf-keep">Keep the saved one</button>' : ''}</div>
    <div class="err" id="nf-err" role="alert">${esc(n.err || '')}</div></form>`;
}
// ---------- rotate the board token (a link leaked) ----------
function securityBox() {
  return `<div class="sub">Board security: if a link leaked</div>
    <p class="hint m0">The board token is in every join command and board link. Rotating it locks out everyone who has the old one.</p>
    ${ui.rotateArm ? `<div class="rot note" role="alert"><span><b>Everyone will have to re-run join</b> with the new command (and reopen the board). Agents connected now lose access until they do.</span>
      <button type="button" class="danger" data-act="rotate-yes" data-fk="rot-yes">Rotate now</button><button type="button" class="ghost" data-act="rotate-no" data-fk="rot-no">Keep the token</button></div>`
      : '<div class="rot"><button type="button" class="ghost" data-act="rotate" data-fk="rot">Rotate token…</button></div>'}`;
}
// One rotation at a time: a second click would send the token the first one just retired (a 401 locks the page out).
let rotating = false;
async function rotateToken() {
  if (rotating) return;
  rotating = true;
  try {
    // Requests sent with the old token meanwhile wait for the new one (tokenChange), then go again with it.
    const turn = (async () => {
      // Bounded like a state load: a rotation whose answer stalls gives up after 15s instead of holding requests forever.
      const x = await api('/token/rotate', { method: 'POST', body: '{}', once: true, signal: AbortSignal.timeout(15000) });
      if (!x?.token) throw new Error('The server didn\'t return a new token.');
      setToken(x.token); store.set('board-token', token);
      return x;
    })();
    tokenChange(turn);
    const r = await turn;
    if (r.setup) state.setup = r.setup;
    ui.rotateArm = false; ui.steps.invite = true;
    connect(); await load();
    toast('Token rotated: send everyone the new join command.');
    document.querySelector('[data-fk="s-invite"]')?.focus({ preventScroll: true });
  } catch (e) { ui.rotateArm = false; render(); toast(`Couldn't rotate the token: ${e.message}`, true); }
  finally { rotating = false; }
}
// How long tasks took so far (per size) and how often reviews sent them back, from the server's stats.
function statsLine() {
  const s = state.stats; if (!s || typeof s !== 'object') return '';
  const sizes = (s.minutes && typeof s.minutes === 'object' && s.minutes) || (s.sizes && typeof s.sizes === 'object' && s.sizes) || s;
  const med = (v) => (typeof v === 'number' ? v : v && typeof v === 'object' ? v.median ?? v.median_min ?? v.minutes ?? null : null);
  const parts = ['S', 'M', 'L'].map((k) => [k, med(sizes[k])]).filter(([, m]) => Number.isFinite(m)).map(([k, m]) => `${k} ≈ ${Math.round(m)} min`);
  let br = s.bounce_rate ?? s.bounceRate;
  if (Number.isFinite(br)) { if (br <= 1) br *= 100; parts.push(`${Math.round(br)}% came back from review at least once`); }
  const rw = med(s.review_wait_min ?? s.review_wait ?? s.reviewWait);
  if (Number.isFinite(rw)) parts.push(`reviews waited ≈ ${Math.round(rw)} min`);
  return parts.length ? `<p class="hint" title="Median time from claim to done, per task size, on this board so far. The planner sees these too.">So far${Number.isFinite(s.done) ? ` (${s.done} done)` : ''}: ${esc(parts.join(' · '))}</p>` : '';
}
// Step 2: the goal, the project repo and the demo time, saved together with one Save (one form, one button), or shown
// with one Edit once the goal is set. Without a demo time yet the form suggests one; "No demo time" leaves it out.
function stepGoal() {
  const S = state.settings; const t = timeNow();
  if (S.goal && !ui.editGoal) {
    return `<p class="goaltext">${esc(S.goal)}</p>
      ${S.repo ? `<div class="repo"><span class="muted">Project repo:</span> <code>${esc(S.repo)}</code></div>` : ''}
      ${t.deadline ? `<div class="repo"><span class="muted">Demo:</span> <b>${esc(when(t.deadline))}</b><span class="muted" aria-hidden="true">·</span><span>${t.fm ? `feature freeze ${esc(when(t.freezeAt))} <span class="muted">(${t.fm} min before)</span>` : 'no feature freeze'}</span></div>`
        : `<div class="repo"><span class="muted">Demo:</span> <span>no demo time${dlSkipped() ? '' : ' yet'}</span></div>`}
      <div class="inl mt-2"><button type="button" class="ghost sm" data-act="goal-edit" data-fk="goal-edit">Edit</button></div>`;
  }
  const fm = S.freeze_minutes === '' || S.freeze_minutes == null ? '60' : S.freeze_minutes;
  const dl = t.deadline || (dlSkipped() ? 0 : defaultDeadline());
  return `<p>In 1–3 sentences: what are you building, and what should the demo show? The agents plan their tasks from this. Your agent may also ask you for the goal in its terminal — either works.</p>
    <form class="stepform" data-goalform novalidate>
      <label class="vh" for="goal-in">Project goal</label>
      <textarea id="goal-in" data-keep="goal" data-draft rows="2" maxlength="1000" title="Enter saves · Shift+Enter adds a new line" aria-describedby="goal-err" ${ui.goalErr ? 'aria-invalid="true"' : ''} placeholder="e.g. A web app where teams submit their project and everyone votes. The demo shows submitting, voting and a live leaderboard.">${esc(S.goal)}</textarea>
      <div class="err m0" id="goal-err" role="alert">${esc(ui.goalErr || '')}</div>
      <div class="repo m0"><label for="repo-in">Project repo URL <span class="muted fw-normal">(optional)</span></label>
        <input id="repo-in" data-keep="repo" data-draft value="${esc(S.repo)}" placeholder="https://github.com/your-team/project" autocomplete="off" spellcheck="false" aria-describedby="repo-hint repo-err" ${ui.repoErr ? 'aria-invalid="true"' : ''}>
        <p class="hint row m0" id="repo-hint">The git repo you're all building in. It goes into the invite message, and agents see it too.</p></div>
      <div class="err m0" id="repo-err" role="alert">${esc(ui.repoErr || '')}</div>
      <div class="repo dlform m0"><label for="dl-in">Demo time <span class="muted fw-normal">(optional)</span></label>
        <input id="dl-in" type="datetime-local" data-keep="dl" data-draft value="${dl ? esc(localInput(dl)) : ''}" step="60" aria-describedby="dl-hint dl-err" ${ui.dlErr ? 'aria-invalid="true"' : ''}>
        <label for="fz-in">Feature freeze</label><input id="fz-in" type="number" data-keep="fz" data-draft value="${esc(fm)}" min="0" max="600" step="5" inputmode="numeric" aria-describedby="fz-u dl-hint"><span class="u" id="fz-u">min before</span></div>
      <p class="hint m0" id="dl-hint">${t.deadline ? '' : dl ? '<b>Not set yet:</b> the time shown is a suggestion, saved with the goal (or press No demo time). ' : ''}When the demo starts. The header counts down to it. At the feature freeze agents stop taking new tasks (except priority-1 bug fixes) and get what they have merged, so main works for the demo.</p>
      <div class="err m0" id="dl-err" role="alert">${esc(ui.dlErr || '')}</div>
      <div class="inl m0"><button type="submit" data-fk="goal-save">Save</button>${!t.deadline && dl ? '<button type="button" class="ghost" data-act="dl-skip" data-fk="dl-skip">No demo time</button>' : ''}${t.deadline ? '<button type="button" class="ghost" data-act="dl-clear" data-fk="dl-clear">Remove the demo time</button>' : ''}${S.goal ? '<button type="button" class="ghost" data-act="goal-cancel" data-fk="goal-cancel">Cancel</button>' : ''}</div>
    </form>`;
}
// "2026-11-09T17:00" in local time, for <input type="datetime-local">.
const localInput = (ts) => { const d = new Date(ts); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
// Default demo time: today 17:00, or 3 hours from now (on the hour) if 17:00 is close or past.
function defaultDeadline() {
  const d = new Date(); d.setHours(17, 0, 0, 0);
  if (d.getTime() - Date.now() < 2 * 3600e3) { const x = new Date(Date.now() + 3 * 3600e3); x.setMinutes(0, 0, 0); return x.getTime(); }
  return d.getTime();
}
// The tool each connected agent reported (its client, as the server names it) -> its entry in state.setup.agent_tools.
const TOOL_OF = { 'Claude Code': 'claude', Codex: 'codex', 'Copilot (VS Code)': 'copilot-vscode', 'Copilot CLI': 'copilot-cli', 'Gemini CLI': 'gemini', Cursor: 'cursor' };
function stepStart(si) {
  const tools = state.setup?.agent_tools?.length ? state.setup.agent_tools : [{ id: 'claude', name: 'Claude Code', start: '/board', where: 'Type it in Claude Code, opened in the project repo.' }];
  const label = (a) => { const d = [a.client, a.plan].filter(Boolean).join(' · '); return `${nameTag(a.name)}${d ? ` <span class="muted">(${esc(d)}${a.started ? `, ${a.slots} at once` : ''})</span>` : ''}`; };
  // The tools of the laptops connected so far; the others behind "Other tools" (all of them while none is connected).
  const used = new Set(si.ros.flatMap((r) => r.agents).map((a) => TOOL_OF[a.client]).filter(Boolean));
  const shown = used.size ? tools.filter((t) => used.has(t.id)) : tools; const others = used.size ? tools.filter((t) => !used.has(t.id)) : [];
  const toolRow = (t) => {
    // Copilot CLI needs launching with the board tool allowed first: two commands.
    const launch = t.launch;
    const cmds = launch
      ? `<div class="cmds"><div class="sub">1. Launch it with the board allowed:</div>${cmdBox(launch, 'start-' + t.id + '-launch', 'launch command for ' + t.name)}<div class="sub">2. Then type:</div>${cmdBox(t.start, 'start-' + t.id, 'start command for ' + t.name)}</div>`
      : cmdBox(t.start, 'start-' + t.id, `start command for ${t.name}`);
    return `<li class="tool-r"><span class="tn">${esc(t.name)}</span>${cmds}<span class="tw">${esc(launch ? 'Run both in the project repo.' : t.where || '')}</span></li>`;
  };
  return `<p>On each laptop, open your AI tool in the project folder and start the board. ${used.size ? `The ${shown.length > 1 ? 'tools' : 'tool'} your team connected:` : 'Find your tool below:'}</p>
    <ul class="tools">${shown.map(toolRow).join('')}</ul>
    ${others.length ? `<button type="button" class="link muted t-meta" data-act="other-tools" data-fk="other-tools" aria-expanded="${!!ui.otherTools}"${ui.otherTools ? ' aria-controls="other-tools"' : ''}><span class="chev" aria-hidden="true">▾</span> Other tools (${others.length})</button>${ui.otherTools ? `<ul class="tools" id="other-tools">${others.map(toolRow).join('')}</ul>` : ''}` : ''}
    <p class="hint">Two tools on one laptop? Start each one in the folder join printed for it.</p>
    <p class="muted">That session becomes the laptop's <b>main agent</b> (the "orchestrator"): it takes tasks from this board and builds each one in its own git branch. Claude Code can also hand tasks to several subagents at once; the other tools work one task at a time. If the tool doesn't know the command or can't see the board, run <code>npm run doctor</code> in the agent-board folder: it checks the connection and says what to fix.</p>
    <p>${si.startedA.length ? `Started: ${si.startedA.map(label).join(', ')}` : 'No agent started yet. It shows up here a few seconds after someone types the start command.'}</p>
    ${teamCapHtml()}
    ${si.waitingA.length ? `<p class="ns-txt">Connected but not started: ${si.waitingA.map((a) => `${label(a)} — type <code>${esc(startCmd(a.client))}</code> in it`).join('; ')}</p>` : ''}`;
}
function approvalBox() {
  const S = state.settings;
  return `<label class="keys"><input type="checkbox" id="appr-on" data-fk="appr" ${S.require_approval ? 'checked' : ''} aria-describedby="appr-hint"> Review the task list before agents start</label>
    <p class="hint" id="appr-hint">${approvalWait() ? 'Agents are waiting. Edit or add tasks, then approve.'
      : S.require_approval && S.plan_approved ? '<span class="appr-done">Plan approved ✓</span> Agents are working through it.'
      : S.require_approval ? 'After the planner writes the tasks, agents wait until someone here presses Approve plan &amp; start.'
      : 'Off: agents start on tasks as soon as the planner writes them.'}</p>
    ${approvalWait() ? '<div class="inl"><button type="button" data-act="approve" data-fk="s-appr">Approve plan &amp; start</button></div>' : ''}`;
}
// Individual agents, not people: with two tools on one laptop only ONE of them should plan or merge.
function agentNames(extra = []) {
  const agentNames = (state.presence || []).filter((p) => p.kind === 'agent').map((p) => String(p.name).toLowerCase());
  const assignees = state.tasks.map((t) => t.assignee && agentRoot(t.assignee));
  return [...new Set([...agentNames, ...assignees, ...extra].filter((n) => n && n !== ANYONE))].sort();
}
// The planner's choice: label, select, the extra tasks it may take, one hint. In its own popover (labelledBy: the
// popover's heading) there is no label: the heading names the select.
function plannerBox(pre = '', labelledBy = '') {
  const S = state.settings; const names = agentNames([S.planner]);
  const ex = Math.max(0, Math.min(5, Number(S.planner_extra ?? 2) || 0));
  return `<div class="inl">${labelledBy ? '' : `<label for="${pre}plan-sel" class="m0">Planner</label>`}
      <select id="${pre}plan-sel" data-fk="${pre}plan-sel" class="w-auto"${labelledBy ? ` aria-labelledby="${labelledBy}"` : ''}><option value="">The first agent that starts</option>${names.map((n) => `<option value="${esc(n)}" ${n === S.planner ? 'selected' : ''}>${esc(n)}${root(n) === root(me) ? ' (yours)' : ''}</option>`).join('')}</select></div>
    <div class="inl"><label for="${pre}pex-sel" class="m0 fw-normal">When nobody else is free, the planner may take up to</label>
      <select id="${pre}pex-sel" data-fk="${pre}pex" class="w-auto">${[0, 1, 2, 3, 4, 5].map((i) => `<option value="${i}" ${i === ex ? 'selected' : ''}>${i}</option>`).join('')}</select>
      <span class="muted t-meta">extra small/medium tasks with subagents</span></div>
    <p class="hint">Other agents' new tasks wait as <b>proposed</b> until the planner (or you) approves them.</p>`;
}
function stepBacklog() {
  const S = state.settings; const n = state.tasks.length;
  // Who plans is chosen in Roles (or Planner) in the top bar: one line here, pointing there.
  const planner = `<p class="inl"><span><span class="muted">Planner:</span> ${S.planner ? nameTag(S.planner) : 'the first agent that starts'}</span><button type="button" class="ghost sm" data-act="pick-planner" data-fk="s-planner">Change…</button></p>`;
  const add = '<div class="inl"><span class="muted">You can always add tasks yourself:</span><button type="button" class="ghost sm" data-act="new-task" data-fk="s-new">+ New task</button></div>' + planner + approvalBox();
  if (n && approvalWait()) return `<p>${plural(n, 'task')} on the board${S.planner ? `, written by the planner, ${nameTag(S.planner)}` : ''}. Check them on the task board: open a card to edit it, or add what's missing. Agents start claiming once you approve.</p>${add}`;
  if (n) return `<p>${plural(n, 'task')} on the board${S.planner ? `, written by the planner, ${nameTag(S.planner)}` : ''}. Agents claim them on their own, highest priority first.</p>${statsLine()}${add}`;
  if (!S.goal) return `<p>Write the goal first (step 2). Then the first agent that starts on the board (step 3) becomes the <b>planner</b> and writes the task list from it automatically.</p>${add}`;
  if (S.planner) { const c = clientOf(S.planner); const on = setupInfo().plannerOn; return `<p>${nameTag(S.planner)}${c ? ` (${esc(c)})` : ''} is the <b>planner</b> and ${on ? 'is writing the task list now' : 'has not started yet'}<span class="dots"></span>${on ? ' Cards appear on the task board as it goes.' : ''}</p>${add}`; }
  return `<p>The first agent that starts on the board (step 3) becomes the <b>planner</b> and writes the task list from the goal automatically.</p>${add}`;
}
// Who merges to main, in the same order as the planner's: label, select (with main's CI), one hint. Setup's step 5,
// the Roles popover, and the Merges popover (no label there: its heading names the select).
function stepIntegrator(sel = 'integ-sel', labelledBy = '') {
  const S = state.settings;
  const review = state.tasks.filter((t) => t.status === 'review').length;
  const names = agentNames([S.integrator]);
  return `<div class="inl">${labelledBy ? '' : `<label for="${sel}" class="m0">Merges to main</label>`}
      <select id="${sel}" data-fk="${sel.replace(/-sel$/, '')}"${labelledBy ? ` aria-labelledby="${labelledBy}"` : ''}><option value="">Let the first agent with finished work do it</option><option value="${ANYONE}" ${S.integrator === ANYONE ? 'selected' : ''}>Whoever is free (any agent with room merges)</option>${names.map((n) => `<option value="${esc(n)}" ${n === S.integrator ? 'selected' : ''}>${esc(n)}${youTag(n)}</option>`).join('')}</select>${ciPill()}</div>
    <p class="hint">One agent merges at a time and runs the tests first; whoever is free never merges its own work.</p>
    ${review && !S.integrator ? `<p class="note">${plural(review, 'finished task is', 'finished tasks are')} waiting to be merged.</p>` : ''}`;
}

export { defaultDeadline, exportBtns, exportFile, fetchExport, inviteText, localInput, nfEvents, NOTIFY_KIND,
  plannerBox, renderSetup, rotateToken, stepIntegrator };
