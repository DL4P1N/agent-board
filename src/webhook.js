// Sending webhook notifications without making the board a way into the host's network.
// A webhook URL is checked when it's saved and again before every delivery: it must be https (http only
// for localhost), and its name must not resolve to a private address. The request then connects to the
// address that was checked (its DNS answer is pinned), so a name that answers "public" to the check and
// "127.0.0.1" a moment later can't slip past it. Redirects are never followed.
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';

export const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];
const bare = (host) => String(host).replace(/^\[|\]$/g, '');

// An IPv6 address as 8 numbers (16-bit groups), or null. Handles "::", and a dotted IPv4 tail.
function ipv6Groups(ip) {
  let s = ip.toLowerCase().replace(/%.*$/, '');
  const tail = s.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number);
    s = s.slice(0, -tail[0].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const part = (x) => (x ? x.split(':') : []);
  const head = part(halves[0]); const rest = halves.length === 2 ? part(halves[1]) : [];
  const fill = 8 - head.length - rest.length;
  if (halves.length === 1 ? fill !== 0 : fill < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill('0'), ...rest].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}
const v4From = (hi, lo) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

// Private, loopback, link-local, multicast and other non-public addresses: a webhook must not reach the
// host's network (cloud metadata, other services). IPv6 forms that carry an IPv4 address inside them
// (IPv4-mapped ::ffff:7f00:1, NAT64 64:ff9b::/96, 6to4 2002::/16) are judged by that IPv4 address.
export function isPrivateAddress(ip) {
  ip = bare(ip);
  if (net.isIPv4(ip)) {
    const [a, b, c] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT (and Tailscale)
      || (a === 192 && b === 0 && (c === 0 || c === 2)) // IETF protocol assignments, documentation
      || (a === 198 && (b === 18 || b === 19)) // benchmarking
      || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) // documentation
      || a >= 224; // multicast, reserved, broadcast
  }
  if (!net.isIPv6(ip)) return false;
  const g = ipv6Groups(ip);
  if (!g) return true; // net says IPv6 but it didn't parse: don't take the chance
  const zeros = (n) => g.slice(0, n).every((x) => x === 0);
  if (zeros(8)) return true; // ::
  if (zeros(7) && g[7] === 1) return true; // ::1
  if (zeros(5) && g[5] === 0xffff) return isPrivateAddress(v4From(g[6], g[7])); // IPv4-mapped ::ffff:a.b.c.d
  if (zeros(6)) return true; // IPv4-compatible ::a.b.c.d (deprecated, never a real public address)
  if (zeros(4) && g[4] === 0xffff && g[5] === 0) return true; // IPv4-translated ::ffff:0:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) {
    // NAT64: the well-known prefix 64:ff9b::/96 embeds an IPv4 address; 64:ff9b:1::/48 is for local use.
    if (g[2] === 1) return true;
    return g.slice(2, 6).every((x) => x === 0) ? isPrivateAddress(v4From(g[6], g[7])) : true;
  }
  if (g[0] === 0x2002) return isPrivateAddress(v4From(g[1], g[2])); // 6to4 embeds an IPv4 address
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo (tunnels to a hidden IPv4 address)
  if (g[0] === 0x2001 && g[1] === 0xdb8) return true; // documentation
  if (g[0] === 0x100 && zeros(4)) return true; // discard-only 100::/64
  // Unique local fc00::/7, link-local fe80::/10, old site-local fec0::/10, multicast ff00::/8.
  return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0 || (g[0] & 0xff00) === 0xff00;
}

// Webhooks to this computer (a relay on the host) only when the host turns them on with BOARD_WEBHOOK_LOCALHOST=1:
// otherwise anyone with the board token could probe the host's local ports through "Send a test".
const localAllowed = () => process.env.BOARD_WEBHOOK_LOCALHOST === '1';

// The URL's shape: https (http only for localhost), and not a private address written out as an IP.
export function checkNotifyUrl(url) {
  let u; try { u = new URL(url); } catch { throw new Error('That isn\'t a valid URL. Paste the webhook URL from Slack, Discord or ntfy.'); }
  const local = LOCAL_HOSTS.includes(u.hostname);
  if (local && !localAllowed()) throw new Error('The webhook URL points at this computer (localhost). Use the public webhook URL from Slack, Discord or ntfy.');
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) throw new Error('The webhook URL must start with https:// (http only for localhost).');
  if (!local && isPrivateAddress(u.hostname)) throw new Error('The webhook URL points at a private network address. Use the public webhook URL from Slack, Discord or ntfy.');
  return u.toString();
}

// Resolves a webhook's host name once and checks every address it gives. Returns the address to connect
// to ({address, family}), or null for localhost and IP literals (nothing to resolve). `lookup` is for tests.
export async function resolveNotifyTarget(url, { lookup = (host, o) => dns.lookup(host, o) } = {}) {
  const u = new URL(checkNotifyUrl(url));
  if (LOCAL_HOSTS.includes(u.hostname) || net.isIP(bare(u.hostname))) return null;
  const addrs = await lookup(u.hostname, { all: true, verbatim: true });
  if (!addrs?.length) throw new Error(`${u.hostname} doesn't resolve to any address; not sending.`);
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new Error(`${u.hostname} resolves to a private network address; not sending.`);
  return { address: addrs[0].address, family: addrs[0].family || (net.isIPv6(addrs[0].address) ? 6 : 4) };
}

// A `lookup` for http(s).request that always answers with the checked address, so the connection can't be
// re-resolved somewhere else. (Called with {all: true} when Node tries IPv4 and IPv6 side by side.)
export const pinnedLookup = ({ address, family }) => (_host, opts, cb) => {
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  if (opts?.all) cb(null, [{ address, family }]);
  else cb(null, address, family);
};

// POSTs a body to a URL, connecting to `pin` (from resolveNotifyTarget) when given. Never follows a redirect.
// TLS still checks the certificate against the URL's host name. Resolves to {status, ok}.
export function postTo(url, { headers = {}, body = '' } = {}, { pin = null, timeoutMs = 5000 } = {}) {
  const u = new URL(url);
  const mod = u.protocol === 'https:' ? https : http;
  const data = Buffer.from(String(body));
  return new Promise((resolve, reject) => {
    const req = mod.request(u, {
      method: 'POST',
      headers: { ...headers, 'Content-Length': data.length },
      signal: AbortSignal.timeout(timeoutMs),
      agent: false,
      ...(pin ? { lookup: pinnedLookup(pin) } : {}),
    }, (res) => {
      res.resume();
      resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300 });
    });
    req.on('error', reject);
    req.end(data);
  });
}

// Check, resolve once, and send to the address that was checked.
export async function sendWebhook(url, init, opts = {}) {
  const pin = await resolveNotifyTarget(url, opts);
  return postTo(url, init, { ...opts, pin });
}
