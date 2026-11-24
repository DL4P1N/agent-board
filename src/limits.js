// In-memory limits that keep one runaway client (an agent stuck in a loop, a script gone wrong) from
// slowing the board down for everyone else. Nothing is stored: a restart forgets every count.
//   RateLimiter: calls per minute per key (an agent, an IP address), as a token bucket: up to a minute's
//                worth at once, refilling steadily.
//   Slots:       how many slow requests (wait_for_events, long-polls, live streams) may be open at once,
//                per key and in total.

// `perMinute` <= 0 turns the limit off.
export class RateLimiter {
  constructor(perMinute) {
    this.perMinute = Math.max(0, Number(perMinute) || 0);
    this.buckets = new Map(); // key -> { tokens, at }
  }

  // One call for `key`. Returns { ok: true } or { ok: false, retryAfter } (whole seconds until the next call is allowed).
  take(key, now = Date.now()) {
    if (!this.perMinute) return { ok: true };
    const rate = this.perMinute / 60e3; // tokens per ms
    const b = this.buckets.get(key) || { tokens: this.perMinute, at: now };
    b.tokens = Math.min(this.perMinute, b.tokens + (now - b.at) * rate);
    b.at = now;
    this.buckets.set(key, b);
    if (b.tokens >= 1) { b.tokens -= 1; return { ok: true }; }
    return { ok: false, retryAfter: Math.max(1, Math.ceil((1 - b.tokens) / rate / 1000)) };
  }

  // Forgets keys that have been quiet long enough to be full again.
  sweep(now = Date.now()) {
    for (const [k, b] of this.buckets) if (now - b.at > 60e3) this.buckets.delete(k);
  }
}

// `perKey` / `total` <= 0 turn that cap off.
export class Slots {
  constructor(perKey, total) {
    this.perKey = Math.max(0, Number(perKey) || 0);
    this.total = Math.max(0, Number(total) || 0);
    this.open = new Map(); // key -> count
    this.count = 0;
  }

  // Takes a slot for `key`. Returns a release function (safe to call twice), or { full: 'key' | 'total', open }.
  // `reserve`: this caller may not take the last `reserve` slots of the total (they are kept for others).
  acquire(key, { reserve = 0 } = {}) {
    const n = this.open.get(key) || 0;
    if (this.perKey && n >= this.perKey) return { full: 'key', open: n };
    if (this.total && this.count >= this.total - reserve) return { full: 'total', open: this.count, reserved: reserve > 0 && this.count < this.total };
    this.open.set(key, n + 1);
    this.count++;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.count--;
      const left = (this.open.get(key) || 1) - 1;
      if (left > 0) this.open.set(key, left); else this.open.delete(key);
    };
  }
}

// A number from the environment, or the default when it's unset or not a number. 0 is allowed (off).
export function envLimit(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v.trim() === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}
