// A fixed-window rate limit per visitor, in the rate_limits table. The key is an HMAC of the IP address and user agent (see
// lib/visitor.js), salted with the window and the scope, so a raw IP or user agent is never stored, and each scope (votes, clicks) has
// its own budget. Rows expire with their window.

import { hmacHex } from './visitor.js';

// Clicks counted by /api/click and /go/<slug>: 30 per minute per visitor, shared by both
export const CLICK_LIMIT = { max: 30, windowSeconds: 60 };

// Counts this request against the visitor's budget for `scope`.
// -> null when it is within the limit, or { wait: seconds until the window ends, count } when it is over
export async function rateLimit(db, secret, { scope, max, windowSeconds }, who, now) {
  const nowSec = Math.floor(now / 1000);
  const windowStart = Math.floor(nowSec / windowSeconds) * windowSeconds;
  const key = await hmacHex(secret, `${scope}\n${windowStart}\n${who.ip}\n${who.ua}`);
  const hit = await db.prepare(
    'INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count'
  ).bind(key, windowStart + windowSeconds + 60).first();
  const count = hit?.count ?? 1;
  if (count === 1) await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(nowSec).run();   // tidy up old windows
  return count > max ? { wait: Math.max(1, windowStart + windowSeconds - nowSec), count } : null;
}
