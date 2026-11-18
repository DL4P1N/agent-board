// Webhook safety (src/webhook.js): the private-address list, including IPv6 forms that carry an IPv4
// address inside them, and DNS pinning: a name is resolved once, checked, and the request connects to that
// checked address, even if the name answers differently a moment later (DNS rebinding).
// No board needed. Run all suites with: npm test
import http from 'node:http';
import dnsCb from 'node:dns';
import { finish } from './helpers.mjs';
import { isPrivateAddress, checkNotifyUrl, resolveNotifyTarget, postTo, sendWebhook } from '../src/webhook.js';

const R = [];
const check = (n, ok, x = '') => R.push(`${ok ? 'PASS' : 'FAIL'} ${n}${x !== '' && !ok ? ' — ' + x : ''}`);
const throwsWith = async (fn, re) => { try { await fn(); return false; } catch (e) { return re.test(String(e.message)); } };

// ---- localhost: only when the host turns it on (BOARD_WEBHOOK_LOCALHOST=1) ----
delete process.env.BOARD_WEBHOOK_LOCALHOST;
for (const url of ['http://localhost:9/x', 'http://127.0.0.1:4000/api', 'https://[::1]:22/x']) {
  check(`localhost is refused without BOARD_WEBHOOK_LOCALHOST: ${url}`, await throwsWith(() => checkNotifyUrl(url), /this computer/));
}
// The rest of this file talks to webhooks on 127.0.0.1.
process.env.BOARD_WEBHOOK_LOCALHOST = '1';
check('localhost is allowed with BOARD_WEBHOOK_LOCALHOST=1', checkNotifyUrl('http://localhost:9/x') === 'http://localhost:9/x');

// ---- the address list ----
const privateOnes = [
  '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '198.18.0.1',
  '::1', '::', '[::1]', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'FE80::1%eth0', 'ff02::1', 'fec0::1',
  '::ffff:127.0.0.1', '::ffff:7f00:1', '::FFFF:7F00:0001', '::ffff:a00:5', '::ffff:a9fe:a9fe', '0:0:0:0:0:ffff:7f00:1',
  '64:ff9b::7f00:1', '64:ff9b::127.0.0.1', '64:ff9b::a9fe:a9fe', '64:ff9b:1::8.8.8.8',
  '2002:7f00:1::', '2002:a00:1::1', '2002:c0a8:101::1', '2002:a9fe:a9fe::',
  '::127.0.0.1', '2001:0:4136:e378:8000:63bf:3fff:fdd2', '2001:db8::1',
];
const publicOnes = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111', '2a00:1450:4001::200e', '::ffff:808:808', '64:ff9b::808:808', '2002:808:808::1'];
const wrongPrivate = privateOnes.filter((a) => !isPrivateAddress(a));
check('private, loopback, link-local and reserved addresses are refused (IPv4 and IPv6)', !wrongPrivate.length, wrongPrivate.join(', '));
const wrongPublic = publicOnes.filter((a) => isPrivateAddress(a));
check('public addresses pass, also inside IPv4-mapped, NAT64 and 6to4 forms', !wrongPublic.length, wrongPublic.join(', '));
check('not an address at all is not "private" (a host name is checked after DNS)', !isPrivateAddress('hooks.slack.com'));

// The URL parser rewrites [::ffff:127.0.0.1] to [::ffff:7f00:1]: the hex form must be caught too.
for (const url of ['https://[::ffff:127.0.0.1]/hook', 'https://[::ffff:7f00:1]/hook', 'https://[64:ff9b::a9fe:a9fe]/latest', 'https://[2002:a9fe:a9fe::]/x', 'https://2852039166/latest', 'https://0xa9.0xfe.0xa9.0xfe/latest', 'https://012.1/hook']) {
  check(`a webhook URL ${url} is refused as private`, await throwsWith(() => checkNotifyUrl(url), /private network/));
}
check('http is refused for anything but localhost', await throwsWith(() => checkNotifyUrl('http://hooks.example.com/x'), /https/));
check('a public https URL is fine', checkNotifyUrl('https://hooks.slack.com/services/T/B/x') === 'https://hooks.slack.com/services/T/B/x');

// ---- resolving: every address in the answer is checked; one private one is enough to refuse ----
const fakeDns = (...answers) => {
  const f = async () => { f.calls++; return answers[Math.min(f.calls, answers.length) - 1]; };
  f.calls = 0;
  return f;
};
let lk = fakeDns([{ address: '93.184.216.34', family: 4 }, { address: '::ffff:7f00:1', family: 6 }]);
check('a name with any private address in its answer is refused', await throwsWith(() => resolveNotifyTarget('https://mixed.test/h', { lookup: lk }), /private network/));
lk = fakeDns([{ address: '64:ff9b::a9fe:a9fe', family: 6 }]);
check('a name resolving to NAT64 cloud metadata is refused', await throwsWith(() => resolveNotifyTarget('https://nat64.test/h', { lookup: lk }), /private network/));
lk = fakeDns([]);
check('a name with no addresses is refused', await throwsWith(() => resolveNotifyTarget('https://empty.test/h', { lookup: lk }), /doesn't resolve/));
lk = fakeDns([{ address: '93.184.216.34', family: 4 }], [{ address: '127.0.0.1', family: 4 }]);
const pin = await resolveNotifyTarget('https://rebind.test/h', { lookup: lk });
check('a public answer is pinned: {address, family} from the one lookup', pin?.address === '93.184.216.34' && pin.family === 4 && lk.calls === 1, JSON.stringify(pin));
check('localhost and IP literals need no lookup', (await resolveNotifyTarget('http://localhost:9/x', { lookup: lk })) === null && (await resolveNotifyTarget('https://8.8.8.8/x', { lookup: lk })) === null && lk.calls === 1);
lk = fakeDns([{ address: '10.0.0.7', family: 4 }]);
let sent = false;
const sink = http.createServer((req, res) => { sent = true; res.end('ok'); });
await new Promise((r) => sink.listen(0, '127.0.0.1', r));
check('sendWebhook refuses before connecting when the name resolves privately', await throwsWith(() => sendWebhook('https://internal.test/h', { body: '{}' }, { lookup: lk }), /private network/) && !sent);

// ---- pinning: the connection goes to the checked address, whatever DNS says by then ----
// The system resolver (what Node's sockets use) is swapped for one that answers "rebind.test" with a
// different address than the check saw: 127.0.0.2, where nothing listens.
const got = [];
const hook = http.createServer((req, res) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { got.push({ url: req.url, host: req.headers.host, body: b }); res.writeHead(204); res.end(); }); });
await new Promise((r) => hook.listen(0, '127.0.0.1', r));
const port = hook.address().port;
const realLookup = dnsCb.lookup;
let systemCalls = 0;
dnsCb.lookup = (host, opts, cb) => {
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  if (host !== 'rebind.test') return realLookup(host, opts, cb);
  systemCalls++;
  return opts?.all ? cb(null, [{ address: '127.0.0.2', family: 4 }]) : cb(null, '127.0.0.2', 4);
};
try {
  const r = await postTo(`http://rebind.test:${port}/pinned`, { headers: { 'Content-Type': 'application/json' }, body: '{"text":"hi"}' }, { pin: { address: '127.0.0.1', family: 4 } });
  check('with a pin, the request reaches the checked address and DNS is not asked again', r.status === 204 && r.ok && got.some((g) => g.url === '/pinned' && g.body === '{"text":"hi"}') && systemCalls === 0, JSON.stringify({ r, got, systemCalls }));
  check('the Host header still names the webhook\'s host (TLS SNI and certificates use it too)', got.at(-1)?.host === `rebind.test:${port}`, got.at(-1)?.host);
  let unpinned = null;
  try { unpinned = await postTo(`http://rebind.test:${port}/unpinned`, { body: 'x' }, { timeoutMs: 3000 }); } catch (e) { unpinned = e; }
  check('without a pin the request would follow the new DNS answer (so the pin is what protects it)', systemCalls >= 1 && !got.some((g) => g.url === '/unpinned'), String(unpinned?.message || JSON.stringify(unpinned)));
} finally { dnsCb.lookup = realLookup; }

// Redirects are reported, not followed.
const redir = http.createServer((req, res) => { res.writeHead(307, { Location: 'http://127.0.0.1:1/internal' }); res.end(); });
await new Promise((r) => redir.listen(0, '127.0.0.1', r));
const rr = await sendWebhook(`http://localhost:${redir.address().port}/x`, { body: '{}' });
check('a redirect comes back as its status, not followed', rr.status === 307 && !rr.ok, JSON.stringify(rr));

for (const s of [hook, sink, redir]) s.close();
await finish(R);
