// Where teammates can reach this server and how each AI tool starts the orchestrator (shown on the web board).
import os from 'node:os';
import { PORT, PUBLIC_URL, VERSION } from './config.js';

// How to start the orchestrator in each supported tool (shown on the web board).
export const AGENT_TOOLS = [
  { id: 'claude', name: 'Claude Code', start: '/board', where: 'Type it in Claude Code, opened in the project repo.' },
  { id: 'codex', name: 'Codex (ChatGPT)', start: '$board', where: 'Type it in the Codex CLI, opened in the project repo.' },
  { id: 'copilot-vscode', name: 'GitHub Copilot in VS Code', start: '/board', where: 'Open the project repo in VS Code, switch Copilot Chat to Agent mode, then type it.' },
  { id: 'copilot-cli', name: 'GitHub Copilot CLI', start: '/board', launch: 'copilot --allow-tool board --autopilot --max-autopilot-continues 50', where: 'Start it with  copilot --allow-tool board --autopilot --max-autopilot-continues 50  in the project repo, then type it. (--autopilot keeps it working without you typing "continue".)' },
  { id: 'gemini', name: 'Gemini CLI', start: '/board', where: 'Type it in Gemini CLI, opened in the project repo.' },
  { id: 'cursor', name: 'Cursor', start: '/board', where: 'In Cursor\'s Agent chat, opened in the project repo.' },
];

// Where teammates can reach this server, best first: the public tunnel (if any), then network addresses.
export function serverAddresses() {
  const lan = reachableAddresses().map((a) => ({ ...a, base: `http://${a.ip}:${PORT}` }));
  if (!PUBLIC_URL) return lan;
  return [{ ip: new URL(PUBLIC_URL).hostname, base: PUBLIC_URL, label: 'Cloudflare tunnel (works from any network)' }, ...lan];
}

// Non-internal IPv4 addresses, most useful first: Tailscale, then private LAN, then anything else.
function reachableAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family !== 'IPv4' || i.internal || i.address.startsWith('169.254.')) continue;
      const tailscale = /tailscale/i.test(name) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(i.address);
      const lan = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address);
      const virtual = /vEthernet|WSL|VirtualBox|VMware|Hyper-V|docker|br-/i.test(name);
      const rank = tailscale ? 0 : virtual ? 3 : lan ? 1 : 2;
      const label = tailscale ? `Tailscale (works across networks) — ${name}` : virtual ? `virtual adapter, probably NOT reachable — ${name}` : `same wifi/LAN — ${name}`;
      out.push({ ip: i.address, label, rank });
    }
  }
  return out.sort((a, b) => a.rank - b.rank);
}
export const bestBase = () => serverAddresses()[0]?.base || `http://localhost:${PORT}`;

// The setup info of one board: join commands and web links for the "invite teammates" step (they hold the board token).
export function makeSetupInfo({ slug, registry, isDefault, prefix, tokens }) {
  // Copy-paste join commands + web links, for the web board's "invite teammates" step. They carry the
  // board's canonical /b/<slug> path, so they keep working when another board becomes the default.
  return function setupInfo() {
    const p = prefix();
    const list = [...serverAddresses(), { ip: 'localhost', base: `http://localhost:${PORT}`, label: 'this machine only' }];
    return {
      port: PORT,
      version: VERSION,
      board: { slug, name: registry.get(slug)?.name || slug, default: isDefault(), path: p },
      agent_tools: AGENT_TOOLS,
      clone_command: 'git clone https://github.com/DL4P1N/agent-board && cd agent-board',
      join_commands: list.map((a) => ({
        label: a.label,
        ip: a.ip,
        command: `npm run join -- --url ${a.base}${p} --token ${tokens.token}`,
        web_url: `${a.base}${p}/?token=${tokens.token}`,
      })),
    };
  };
}
