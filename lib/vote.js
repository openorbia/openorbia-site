// POST /api/vote {slug}: one upvote per visitor and launch for the whole launch week.
//
// Who counts as one visitor: an HMAC-SHA256 of the IP address and user agent, keyed with the server secret VOTE_SECRET and
// salted with the launch week of the launch being voted on. The IP and user agent are never stored and there are no cookies.
// Because the salt is the launch week (not the calendar day), the same person gets the same hash all week, so a duplicate is
// ignored whenever they come back, and a new launch week starts fresh.

import { launchOpensAt, dayLabel } from './time.js';
import { SLUG_RE } from './launch-data.js';

// Vote requests per visitor per window, counting every POST (including bad ones)
export const RATE_LIMIT = { max: 20, windowSeconds: 600 };

const MAX_BODY_CHARS = 1024;
const enc = new TextEncoder();

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function expandV6(s) {
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const fill = halves.length === 2 ? 8 - left.length - right.length : 0;
  if (fill < 0) return null;
  const groups = [...left, ...Array(fill).fill('0'), ...right];
  if (groups.length !== 8 || groups.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map(g => g.padStart(4, '0'));
}

// IPv4 as is. IPv6 reduced to its /64 so hopping between addresses of one network is still the same visitor.
export function normalizeIp(ip) {
  const s = String(ip || '').trim().toLowerCase();
  if (!s) return 'unknown';
  if (!s.includes(':')) return s;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (mapped) return mapped[1];
  const groups = expandV6(s);
  return groups ? `${groups.slice(0, 4).join(':')}::/64` : s;
}

export function visitor(request) {
  return {
    ip: normalizeIp(request.headers.get('CF-Connecting-IP')),
    ua: (request.headers.get('User-Agent') || '').slice(0, 300),
  };
}

export const voterHash = (secret, week, v) => hmacHex(secret, `vote\n${week}\n${v.ip}\n${v.ua}`);

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const reply = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });
const fail = (status, code, error, extra) => reply(status, { ok: false, code, error }, extra);

export async function handleVote({ request, env, now = Date.now() }) {
  // Only our own pages may vote: no cross-site posts, and JSON only (a plain HTML form cannot send it)
  const origin = request.headers.get('Origin');
  const site = request.headers.get('Sec-Fetch-Site');
  if ((origin && origin !== new URL(request.url).origin) || (site && site !== 'same-origin')) {
    return fail(403, 'forbidden_origin', 'Votes can only be cast from openorbia.com.');
  }
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return fail(415, 'unsupported_media_type', 'Send the vote as JSON.');
  }

  const db = env.DB;
  const secret = env.VOTE_SECRET;
  if (!db || typeof secret !== 'string' || !secret) return fail(503, 'not_configured', 'Voting is not available right now.');

  try {
    const who = visitor(request);

    // Rate limit: fixed window per visitor, keyed by an HMAC so no raw IP is kept
    const nowSec = Math.floor(now / 1000);
    const windowStart = Math.floor(nowSec / RATE_LIMIT.windowSeconds) * RATE_LIMIT.windowSeconds;
    const rateKey = await hmacHex(secret, `rate\n${windowStart}\n${who.ip}\n${who.ua}`);
    const hit = await db.prepare(
      'INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count'
    ).bind(rateKey, windowStart + RATE_LIMIT.windowSeconds + 60).first();
    if ((hit?.count ?? 1) === 1) {
      await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(nowSec).run(); // tidy up old windows
    }
    if ((hit?.count ?? 1) > RATE_LIMIT.max) {
      const wait = Math.max(1, windowStart + RATE_LIMIT.windowSeconds - nowSec);
      return fail(429, 'rate_limited', 'You are voting too fast. Please try again in a few minutes.', { 'retry-after': String(wait) });
    }

    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return fail(400, 'bad_request', 'That request is too large.');
    let body;
    try { body = JSON.parse(text); } catch { return fail(400, 'bad_request', 'That request could not be read.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'bad_request', 'That request could not be read.');

    const slug = body.slug;
    if (typeof slug !== 'string' || slug.length > 64 || !SLUG_RE.test(slug)) return fail(400, 'bad_slug', 'That launch link is not valid.');

    const launch = await db.prepare('SELECT slug, launch_week, launch_date FROM launches WHERE slug = ?').bind(slug).first();
    if (!launch) return fail(404, 'not_found', 'That launch does not exist.');

    const opensAt = launchOpensAt(launch.launch_date);
    if (!(now >= opensAt)) {
      const when = Number.isNaN(opensAt) ? 'soon' : `${dayLabel(opensAt)} at 12:01 AM Pacific`;
      return fail(403, 'voting_closed', `Voting opens ${when}.`);
    }

    const voter = await voterHash(secret, launch.launch_week, who);
    const [insert, count] = await db.batch([
      db.prepare('INSERT OR IGNORE INTO votes (launch_slug, voter_hash, created_at) VALUES (?, ?, ?)').bind(slug, voter, new Date(now).toISOString()),
      db.prepare('SELECT COUNT(*) AS n FROM votes WHERE launch_slug = ?').bind(slug),
    ]);
    return reply(200, { ok: true, slug, count: Number(count.results[0].n), voted: true, already: insert.meta.changes === 0 });
  } catch {
    return fail(500, 'server_error', 'Something went wrong. Please try again.');
  }
}

// Which of these launches (all in one launch week) has this visitor already upvoted? Used to draw the button state.
export async function votedSlugs(env, request, week, slugs) {
  if (!env.DB || !env.VOTE_SECRET || !slugs.length) return new Set();
  try {
    const voter = await voterHash(env.VOTE_SECRET, week, visitor(request));
    const marks = slugs.map(() => '?').join(', ');
    const { results } = await env.DB.prepare(`SELECT launch_slug FROM votes WHERE voter_hash = ? AND launch_slug IN (${marks})`)
      .bind(voter, ...slugs).all();
    return new Set(results.map(r => r.launch_slug));
  } catch {
    return new Set();
  }
}
