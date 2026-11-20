import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { unsubscribeResponse, unsubscribeUrl, tokenFor, LEGACY_VOTE_LINKS_UNTIL } from '../lib/unsubscribe.js';
import * as route from '../functions/unsubscribe/index.js';
import { createDb } from './helpers/d1.js';

const SECRET = 'unsub-test-secret';
let db, env;
beforeEach(async () => {
  db = createDb(); env = { DB: db, UNSUBSCRIBE_SECRET: SECRET };
  for (const e of ['one@example.com', 'two@example.com']) await db.prepare("INSERT INTO waitlist (email, role) VALUES (?, 'reader')").bind(e).run();
});
const rows = async () => (await db.prepare('SELECT id, email FROM waitlist ORDER BY id').all()).results;
const get = url => unsubscribeResponse({ request: new Request(url), env });
const post = (url, body, type = 'application/x-www-form-urlencoded') => unsubscribeResponse({ request: new Request(url, { method: 'POST', headers: { 'content-type': type }, body }), env });

test('the link from an email shows a confirm button and changes nothing (mail scanners open links)', async () => {
  const [first] = await rows();
  const url = await unsubscribeUrl(SECRET, first.id);
  assert.match(url, /^https:\/\/openorbia\.com\/unsubscribe\/\?id=\d+&t=[0-9a-f]{32}$/);
  assert.ok(!url.includes('@'), 'no email address in the link');
  const res = await get(url);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const html = await res.text();
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
  assert.ok(html.includes('<form method="post" action="/unsubscribe/">') && html.includes('<button class="btn pri" type="submit">Unsubscribe</button>'));
  assert.ok(!/<script(?![^>]*\bsrc=)/i.test(html), 'no inline script (the CSP forbids them)');
  assert.equal((await rows()).length, 2, 'opening the link removes nobody');
});

test('pressing the button deletes that one signup, and pressing it again still says unsubscribed', async () => {
  const [first, second] = await rows();
  const t = await tokenFor(SECRET, first.id);
  const res = await post('https://openorbia.com/unsubscribe/', new URLSearchParams({ id: String(first.id), t }).toString());
  assert.equal(res.status, 200);
  assert.match(await res.text(), /You’re <em>unsubscribed<\/em>/);
  assert.deepEqual((await rows()).map(r => r.email), [second.email], 'only that signup is gone');
  assert.equal((await post('https://openorbia.com/unsubscribe/', new URLSearchParams({ id: String(first.id), t }).toString())).status, 200);
});

test('a mail app\'s one-click unsubscribe (RFC 8058) works: it POSTs "List-Unsubscribe=One-Click" to the link itself', async () => {
  const [, second] = await rows();
  const res = await post(await unsubscribeUrl(SECRET, second.id), 'List-Unsubscribe=One-Click');
  assert.equal(res.status, 200);
  assert.deepEqual((await rows()).map(r => r.email), ['one@example.com']);
});

test('a wrong, changed or missing token deletes nothing', async () => {
  const [first, second] = await rows();
  const good = await tokenFor(SECRET, first.id);
  for (const [id, t] of [[first.id, '0'.repeat(32)], [second.id, good], [first.id, good.slice(0, 31)], [first.id, ''], ['', good], ['1 OR 1=1', good]]) {
    assert.equal((await post('https://openorbia.com/unsubscribe/', new URLSearchParams({ id: String(id), t }).toString())).status, 400, `${id}/${t}`);
    assert.equal((await get(`https://openorbia.com/unsubscribe/?id=${encodeURIComponent(id)}&t=${t}`)).status, 400);
  }
  assert.equal((await rows()).length, 2);
});

test('without the server secret no link is valid; without the database nothing is deleted and the page says so', async () => {
  const [first] = await rows();
  const t = await tokenFor(SECRET, first.id);
  env = { DB: db };
  assert.equal((await post('https://openorbia.com/unsubscribe/', new URLSearchParams({ id: String(first.id), t }).toString())).status, 400);
  env = { UNSUBSCRIBE_SECRET: SECRET };
  assert.equal((await post('https://openorbia.com/unsubscribe/', new URLSearchParams({ id: String(first.id), t }).toString())).status, 503);
  assert.equal((await rows()).length, 2);
});

test('the route answers GET and POST and has the security-header middleware', () => {
  assert.equal(typeof route.onRequestGet, 'function');
  assert.equal(typeof route.onRequestPost, 'function');
  assert.ok(existsSync(new URL('../functions/unsubscribe/_middleware.js', import.meta.url)));
});

// ---- UNSUBSCRIBE_SECRET is its own secret: VOTE_SECRET never signs or checks an unsubscribe link, and voting keeps VOTE_SECRET ----

// The welcome emails sent before UNSUBSCRIBE_SECRET existed carry VOTE_SECRET-signed links; they keep working until the end of 2026-12-31
test('VOTE_SECRET-signed links (older welcome emails) work until the end of 2026-12-31 Pacific, and not one minute after', async () => {
  const [first, second] = await rows();
  const VOTE = 'the-voting-secret-0123456789';
  env = { DB: db, UNSUBSCRIBE_SECRET: SECRET, VOTE_SECRET: VOTE };
  const at = now => url => unsubscribeResponse({ request: new Request(url), env, now });
  const before = at(LEGACY_VOTE_LINKS_UNTIL - 60 * 1000), after = at(LEGACY_VOTE_LINKS_UNTIL);
  assert.equal(new Date(LEGACY_VOTE_LINKS_UNTIL).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }), '1/1/2027, 12:00:00 AM');
  assert.equal((await before(await unsubscribeUrl(VOTE, first.id))).status, 200, 'old link, Dec 31 11:59 PM Pacific');
  assert.equal((await after(await unsubscribeUrl(VOTE, first.id))).status, 400, 'old link, Jan 1 12:00 AM Pacific');
  assert.equal((await after(await unsubscribeUrl(SECRET, first.id))).status, 200, 'new links never expire');
  // an old link also works for the button / one-click POST before the date
  const t = await tokenFor(VOTE, second.id);
  const res = await unsubscribeResponse({ request: new Request(`https://openorbia.com/unsubscribe/?id=${second.id}&t=${t}`, { method: 'POST', body: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } }), env, now: LEGACY_VOTE_LINKS_UNTIL - 1 });
  assert.equal(res.status, 200);
  assert.deepEqual((await rows()).map(r => r.id), [first.id]);
  // a wrong token is still wrong
  assert.equal((await before(`https://openorbia.com/unsubscribe/?id=${first.id}&t=${'a'.repeat(32)}`)).status, 400);
});

test('nothing signs with VOTE_SECRET: the welcome email and the lineup sign with UNSUBSCRIBE_SECRET only', async () => {
  const { readFileSync } = await import('node:fs');
  const src = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  assert.ok(!/unsubscribeUrl\(\s*env\.VOTE_SECRET/.test(src('functions/api/waitlist.js')));
  assert.ok(!/unsubscribeUrl\([^)]*VOTE_SECRET/.test(src('lib/lineup-send.js')));
  // in lib/unsubscribe.js VOTE_SECRET appears only in the time-limited check
  const code = src('lib/unsubscribe.js').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(code.split('VOTE_SECRET').length - 1, 2, 'one check: secretOk(env.VOTE_SECRET) && tokenFor(env.VOTE_SECRET, id)');
  assert.ok(code.includes('now < LEGACY_VOTE_LINKS_UNTIL && secretOk(env.VOTE_SECRET)'));
});

// REMINDER: this test starts failing on 2027-01-01 Pacific. When it does, delete the VOTE_SECRET fallback in lib/unsubscribe.js
// (LEGACY_VOTE_LINKS_UNTIL and its check), the two tests above about it, and this test.
test('reminder: remove the VOTE_SECRET unsubscribe fallback after 2026-12-31', () => {
  assert.ok(Date.now() < LEGACY_VOTE_LINKS_UNTIL,
    'The VOTE_SECRET unsubscribe fallback has expired. Remove LEGACY_VOTE_LINKS_UNTIL and its check from lib/unsubscribe.js, and these tests.');
});

test('voting and the rate limits still use VOTE_SECRET, unchanged; the lineup code never reads it', async () => {
  const { readFileSync } = await import('node:fs');
  const src = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  assert.ok(src('lib/vote.js').includes('const secret = env.VOTE_SECRET;') && src('lib/vote.js').includes('voterHash(env.VOTE_SECRET'));
  for (const f of ['lib/lineup-send.js', 'lib/lineup-email.js', 'scripts/send-lineup.mjs'])
    assert.ok(!src(f).replace(/^\s*\/\/.*$/gm, '').includes('VOTE_SECRET'), f);
  assert.ok(src('functions/api/waitlist.js').includes('await unsubscribeUrl(env.UNSUBSCRIBE_SECRET, id)'));
});
