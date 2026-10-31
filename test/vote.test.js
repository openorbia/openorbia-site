import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleVote, normalizeIp, RATE_LIMIT, hmacHex } from '../lib/vote.js';
import { launchOpensAt } from '../lib/time.js';
import { onRequestPost, onRequest } from '../functions/api/vote.js';
import { createDb, addLaunch } from './helpers/d1.js';

const SECRET = 'test-secret-0123456789abcdef';
const OPENS = launchOpensAt('2026-11-23');          // Monday, Nov 23, 2026, 2026, 12:01 AM Pacific
const NOW = OPENS + 24 * 3600 * 1000;               // a day into launch week 1

let db, env;
beforeEach(() => {
  db = createDb();
  addLaunch(db, { slug: 'alpha-tool', name: 'Alpha Tool', launch_week: 1, launch_date: '2026-11-23' });
  addLaunch(db, { slug: 'beta-tool', name: 'Beta Tool', launch_week: 1, launch_date: '2026-11-23' });
  addLaunch(db, { slug: 'week-two-tool', name: 'Week Two Tool', launch_week: 2, launch_date: '2026-11-30' });
  addLaunch(db, { slug: 'future-tool', name: 'Future Tool', launch_week: 9, launch_date: '2999-01-01' });
  env = { DB: db, VOTE_SECRET: SECRET };
});

async function vote(body, { ip = '198.51.100.7', ua = 'TestBrowser/1.0', now = NOW, contentType = 'application/json', headers = {}, env: e = env, raw } = {}) {
  const h = new Headers({ 'content-type': contentType, 'user-agent': ua, ...headers });
  if (ip) h.set('cf-connecting-ip', ip);
  const request = new Request('https://openorbia.com/api/vote', { method: 'POST', headers: h, body: raw ?? JSON.stringify(body) });
  const res = await handleVote({ request, env: e, now });
  return { res, status: res.status, json: await res.json() };
}

const votesFor = slug => db.rows('SELECT COUNT(*) AS n FROM votes WHERE launch_slug = ?', slug)[0].n;

// ---- the happy path and duplicates ----

test('a first vote is counted and the new count is returned', async () => {
  const { status, json } = await vote({ slug: 'alpha-tool' });
  assert.equal(status, 200);
  assert.deepEqual(json, { ok: true, slug: 'alpha-tool', count: 1, voted: true, already: false });
  assert.equal(votesFor('alpha-tool'), 1);
  const second = await vote({ slug: 'alpha-tool' }, { ip: '198.51.100.8' });
  assert.equal(second.json.count, 2);
});

test('a duplicate vote from the same visitor is ignored and returns the unchanged count', async () => {
  await vote({ slug: 'alpha-tool' });
  const again = await vote({ slug: 'alpha-tool' });
  assert.equal(again.status, 200);
  assert.deepEqual(again.json, { ok: true, slug: 'alpha-tool', count: 1, voted: true, already: true });
  assert.equal(votesFor('alpha-tool'), 1);
});

test('one visitor can still vote once for each launch', async () => {
  await vote({ slug: 'alpha-tool' });
  const other = await vote({ slug: 'beta-tool' });
  assert.equal(other.json.already, false);
  assert.equal(other.json.count, 1);
});

test('a different IP or a different user agent is a different visitor', async () => {
  await vote({ slug: 'alpha-tool' });
  await vote({ slug: 'alpha-tool' }, { ip: '198.51.100.99' });
  await vote({ slug: 'alpha-tool' }, { ua: 'OtherBrowser/2.0' });
  assert.equal(votesFor('alpha-tool'), 3);
});

test('the salt is the launch week: coming back days later in the same week is still a duplicate', async () => {
  await vote({ slug: 'alpha-tool' }, { now: OPENS + 1000 });
  for (const days of [1, 3, 6]) {
    const later = await vote({ slug: 'alpha-tool' }, { now: OPENS + days * 24 * 3600 * 1000 });
    assert.equal(later.json.already, true, `day ${days}`);
  }
  assert.equal(votesFor('alpha-tool'), 1);
});

test('a new launch week starts fresh: the same visitor gets a different hash and can vote', async () => {
  await vote({ slug: 'alpha-tool' });
  const w2 = await vote({ slug: 'week-two-tool' }, { now: launchOpensAt('2026-11-30') + 1000 });
  assert.equal(w2.json.already, false);
  const hashes = db.rows('SELECT voter_hash FROM votes').map(r => r.voter_hash);
  assert.equal(hashes.length, 2);
  assert.notEqual(hashes[0], hashes[1]);
});

test('IPv6 addresses in one /64 are one visitor; another /64, or IPv4-mapped IPv6, behave as expected', async () => {
  await vote({ slug: 'alpha-tool' }, { ip: '2001:db8:1:2::1' });
  const same = await vote({ slug: 'alpha-tool' }, { ip: '2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd' });
  assert.equal(same.json.already, true);
  const other = await vote({ slug: 'alpha-tool' }, { ip: '2001:db8:1:3::1' });
  assert.equal(other.json.already, false);
  await vote({ slug: 'beta-tool' }, { ip: '203.0.113.5' });
  assert.equal((await vote({ slug: 'beta-tool' }, { ip: '::ffff:203.0.113.5' })).json.already, true);
});

test('normalizeIp', () => {
  assert.equal(normalizeIp('203.0.113.5'), '203.0.113.5');
  assert.equal(normalizeIp('2001:db8:1:2:3:4:5:6'), '2001:0db8:0001:0002::/64');
  assert.equal(normalizeIp('2001:db8:1:2::1'), '2001:0db8:0001:0002::/64');
  assert.equal(normalizeIp('::1'), '0000:0000:0000:0000::/64');
  assert.equal(normalizeIp('::ffff:203.0.113.5'), '203.0.113.5');
  assert.equal(normalizeIp('ZZ::ZZ'), 'zz::zz');
  for (const v of ['', null, undefined, '   ']) assert.equal(normalizeIp(v), 'unknown');
});

// ---- bad input ----

test('bad slugs are rejected with 400 and nothing is stored', async () => {
  const bad = ['', 'Bad Slug', 'UPPER', 'a'.repeat(65), '../../etc/passwd', "x'; DROP TABLE votes;--", 'a--b', '-a', 'a-', 'a/b', 'a b', 'ü', '<script>', 123, null, [], {}, true];
  for (const slug of bad) {
    const { status, json } = await vote({ slug }, { ip: `192.0.2.${Math.floor(Math.random() * 200) + 1}`, ua: `agent-${String(slug).slice(0, 8)}` });
    assert.equal(status, 400, JSON.stringify(slug));
    assert.equal(json.code, 'bad_slug', JSON.stringify(slug));
  }
  assert.equal((await vote({})).json.code, 'bad_slug');
  assert.equal(db.rows('SELECT COUNT(*) AS n FROM votes')[0].n, 0);
  assert.equal(db.rows('SELECT COUNT(*) AS n FROM launches')[0].n, 4); // the tables are intact
});

test('an unknown but well-formed slug is a 404', async () => {
  const { status, json } = await vote({ slug: 'no-such-tool' });
  assert.equal(status, 404);
  assert.equal(json.code, 'not_found');
});

test('bodies that are not a JSON object are 400', async () => {
  for (const raw of ['not json', '', '[]', '"alpha-tool"', 'null', '42', '{"slug":']) {
    const { status, json } = await vote(null, { raw, ip: `192.0.2.${raw.length + 1}` });
    assert.equal(status, 400, raw);
    assert.equal(json.code, 'bad_request', raw);
  }
  const huge = await vote({ slug: 'alpha-tool', pad: 'x'.repeat(5000) });
  assert.equal(huge.status, 400);
});

test('only JSON is accepted', async () => {
  for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data', '']) {
    const { status, json } = await vote({ slug: 'alpha-tool' }, { contentType });
    assert.equal(status, 415, contentType);
    assert.equal(json.code, 'unsupported_media_type');
  }
  assert.equal((await vote({ slug: 'alpha-tool' }, { contentType: 'application/json; charset=utf-8' })).status, 200);
});

test('cross-site votes are refused; same-origin ones pass', async () => {
  assert.equal((await vote({ slug: 'alpha-tool' }, { headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await vote({ slug: 'alpha-tool' }, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await vote({ slug: 'alpha-tool' }, { headers: { 'sec-fetch-site': 'same-site' } })).status, 403);
  assert.equal(votesFor('alpha-tool'), 0);
  const ok = await vote({ slug: 'alpha-tool' }, { headers: { origin: 'https://openorbia.com', 'sec-fetch-site': 'same-origin' } });
  assert.equal(ok.status, 200);
});

test('voting is not available without the database or the secret', async () => {
  for (const e of [{ DB: db }, { DB: db, VOTE_SECRET: '' }, { VOTE_SECRET: SECRET }, {}]) {
    const { status, json } = await vote({ slug: 'alpha-tool' }, { env: e });
    assert.equal(status, 503);
    assert.equal(json.code, 'not_configured');
  }
});

// ---- when voting opens ----

test('voting opens at 12:01 AM Pacific on the launch date, not a moment before', async () => {
  const before = await vote({ slug: 'alpha-tool' }, { now: OPENS - 1 });
  assert.equal(before.status, 403);
  assert.equal(before.json.code, 'voting_closed');
  assert.match(before.json.error, /Voting opens Monday, Nov 23, 2026 at 12:01 AM Pacific/);
  assert.equal(votesFor('alpha-tool'), 0);
  const exactly = await vote({ slug: 'alpha-tool' }, { now: OPENS });
  assert.equal(exactly.status, 200);
});

test('a launch dated far in the future is closed', async () => {
  const { status, json } = await vote({ slug: 'future-tool' });
  assert.equal(status, 403);
  assert.equal(json.code, 'voting_closed');
});

test('a launch with an unreadable date stays closed', async () => {
  db.sql("UPDATE launches SET launch_date = 'soon' WHERE slug = 'beta-tool'");
  const { status, json } = await vote({ slug: 'beta-tool' });
  assert.equal(status, 403);
  assert.match(json.error, /Voting opens soon/);
});

// ---- rate limiting ----

test('a visitor is limited to RATE_LIMIT.max requests per window, then gets 429 with Retry-After', async () => {
  const who = { ip: '198.51.100.50', ua: 'Spammy/1.0' };
  for (let i = 0; i < RATE_LIMIT.max; i++) assert.equal((await vote({ slug: 'alpha-tool' }, who)).status, 200, `request ${i + 1}`);
  const over = await vote({ slug: 'alpha-tool' }, who);
  assert.equal(over.status, 429);
  assert.equal(over.json.code, 'rate_limited');
  const wait = Number(over.res.headers.get('retry-after'));
  assert.ok(wait >= 1 && wait <= RATE_LIMIT.windowSeconds, `retry-after ${wait}`);
  assert.equal(votesFor('alpha-tool'), 1);

  // another visitor is not affected, and the limited one is free again after the window
  assert.equal((await vote({ slug: 'alpha-tool' }, { ip: '198.51.100.51' })).status, 200);
  const later = await vote({ slug: 'alpha-tool' }, { ...who, now: NOW + (RATE_LIMIT.windowSeconds + 1) * 1000 });
  assert.equal(later.status, 200);
});

test('bad requests count towards the limit too', async () => {
  const who = { ip: '198.51.100.60', ua: 'Prober/1.0' };
  for (let i = 0; i < RATE_LIMIT.max; i++) assert.equal((await vote({ slug: 'nope!' }, who)).status, 400);
  assert.equal((await vote({ slug: 'alpha-tool' }, who)).status, 429);
});

test('old rate-limit rows are cleaned up when a new window starts', async () => {
  await vote({ slug: 'alpha-tool' }, { ip: '198.51.100.61' });
  await vote({ slug: 'alpha-tool' }, { ip: '198.51.100.62' });
  assert.equal(db.rows('SELECT COUNT(*) AS n FROM rate_limits')[0].n, 2);
  await vote({ slug: 'alpha-tool' }, { ip: '198.51.100.63', now: NOW + 3600 * 1000 });
  assert.equal(db.rows('SELECT COUNT(*) AS n FROM rate_limits')[0].n, 1);
});

// ---- privacy ----

test('no raw IP address or user agent is stored anywhere', async () => {
  const ip = '203.0.113.99';
  const ua = 'PrivateBrowser/9.9 (secret-device)';
  await vote({ slug: 'alpha-tool' }, { ip, ua });
  const dump = JSON.stringify({
    votes: db.rows('SELECT * FROM votes'), rate: db.rows('SELECT * FROM rate_limits'), launches: db.rows('SELECT * FROM launches'),
  });
  assert.ok(!dump.includes(ip), 'IP found in the database');
  assert.ok(!dump.includes('PrivateBrowser'), 'user agent found in the database');
  const [row] = db.rows('SELECT * FROM votes');
  assert.deepEqual(Object.keys(row).sort(), ['created_at', 'launch_slug', 'voter_hash']);
  assert.match(row.voter_hash, /^[0-9a-f]{64}$/);
  assert.match(db.rows('SELECT key FROM rate_limits')[0].key, /^[0-9a-f]{64}$/);
});

test('the voter hash depends on the secret: it cannot be recomputed without it', async () => {
  await vote({ slug: 'alpha-tool' });
  const [row] = db.rows('SELECT voter_hash FROM votes');
  const guess = await hmacHex('a-different-secret', 'vote\n1\n198.51.100.7\nTestBrowser/1.0');
  const real = await hmacHex(SECRET, 'vote\n1\n198.51.100.7\nTestBrowser/1.0');
  assert.equal(row.voter_hash, real);
  assert.notEqual(row.voter_hash, guess);
});

// ---- the Pages Function wiring ----

test('the Pages Function handles POST with the real clock and answers other methods with 405', async (t) => {
  // the Function reads Date.now() itself, so mock the clock: Wednesday of Launch Week 1, then the Monday after it closed
  addLaunch(db, { slug: 'this-week', name: 'This Week', launch_week: 1, launch_date: '2026-11-23' });
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 25, 18, 0) });
  const post = who => onRequestPost({ env, request: new Request('https://openorbia.com/api/vote', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': who, 'user-agent': 'FnTest/1.0' },
    body: JSON.stringify({ slug: 'this-week' }),
  }) });
  const res = await post('198.51.100.70');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).count, 1);

  t.mock.timers.setTime(Date.UTC(2026, 11, 1, 8, 0));   // Tuesday Dec 1: the week closed on Sunday Nov 29 at 11:59 PM Pacific
  const late = await post('198.51.100.71');
  assert.equal(late.status, 403);
  assert.equal((await late.json()).code, 'voting_closed');

  const get = await onRequest({ request: new Request('https://openorbia.com/api/vote'), env });
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST');
});

test('responses are never cached', async () => {
  const { res } = await vote({ slug: 'alpha-tool' });
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(res.headers.get('content-type'), /^application\/json/);
});
