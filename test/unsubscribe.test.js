import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { unsubscribeResponse, unsubscribeUrl, tokenFor } from '../lib/unsubscribe.js';
import * as route from '../functions/unsubscribe/index.js';
import { createDb } from './helpers/d1.js';

const SECRET = 'unsub-test-secret';
let db, env;
beforeEach(async () => {
  db = createDb(); env = { DB: db, VOTE_SECRET: SECRET };
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
  env = { VOTE_SECRET: SECRET };
  assert.equal((await post('https://openorbia.com/unsubscribe/', new URLSearchParams({ id: String(first.id), t }).toString())).status, 503);
  assert.equal((await rows()).length, 2);
});

test('the route answers GET and POST and has the security-header middleware', () => {
  assert.equal(typeof route.onRequestGet, 'function');
  assert.equal(typeof route.onRequestPost, 'function');
  assert.ok(existsSync(new URL('../functions/unsubscribe/_middleware.js', import.meta.url)));
});
