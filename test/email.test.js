import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { welcomeEmail, sendWelcome, BREVO_URL, SENDER } from '../lib/email.js';
import { handleWaitlist } from '../functions/api/waitlist.js';
import { createDb } from './helpers/d1.js';

const KEY = 'xkeysib-test-key-never-real';
let db, env, calls;
beforeEach(() => { db = createDb(); env = { DB: db, BREVO_API_KEY: KEY }; calls = []; });

// A stand-in for Brevo: records every request, answers with the given status (or throws)
const brevo = (status = 201, { throws = false } = {}) => async (url, init) => {
  calls.push({ url, init, body: JSON.parse(init.body) });
  if (throws) throw new Error('network down');
  return new Response(JSON.stringify({ messageId: 'x' }), { status });
};
const asJson = body => new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const asForm = body => new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
const FOOTER = "You're getting this because you joined the waitlist at openorbia.com. Reply to this email if it wasn't you.";

test('maker and reader emails say what was asked, with the footer', () => {
  const m = welcomeEmail('maker');
  assert.equal(m.subject, "You're on the OpenOrbia waitlist");
  assert.ok(m.text.includes("You're on the OpenOrbia waitlist. Launch Week 1 is Monday, Nov 23."));
  assert.ok(m.text.includes("Want to launch your tool? Here's how: https://openorbia.com/makers/"));
  assert.ok(m.html.includes('<a href="https://openorbia.com/makers/">'));
  const r = welcomeEmail('reader');
  assert.ok(r.text.includes("You're on the list. We'll email you when Launch Week 1 goes live on Nov 23."));
  assert.ok(!r.text.includes('/makers/'));
  for (const e of [m, r]) { assert.ok(e.text.includes(FOOTER)); assert.ok(e.html.includes(FOOTER.replace(/'/g, '&#39;'))); }
});

test('a new signup sends one Brevo request: sender, reply-to, recipient, key in the header only', async () => {
  const res = await handleWaitlist({ request: asJson({ email: 'New@Example.com', role: 'maker' }), env, fetchImpl: brevo() });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  const { url, init, body } = calls[0];
  assert.equal(url, BREVO_URL);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['api-key'], KEY);
  assert.deepEqual(body.sender, { name: 'OpenOrbia', email: 'launch@openorbia.com' });
  assert.deepEqual(body.replyTo, { email: 'launch@openorbia.com' });
  assert.deepEqual(body.to, [{ email: 'new@example.com' }]);
  assert.ok(body.textContent.includes('Launch Week 1 is Monday, Nov 23.'));
  assert.ok(!init.body.includes(KEY), 'the key is never in the body');
});

test('readers get the reader text', async () => {
  await handleWaitlist({ request: asJson({ email: 'r@example.com', role: 'reader' }), env, fetchImpl: brevo() });
  assert.ok(calls[0].body.textContent.includes("We'll email you when Launch Week 1 goes live on Nov 23."));
});

test('the no-JS form path sends the email too, and still redirects', async () => {
  const res = await handleWaitlist({ request: asForm({ email: 'f@example.com', role: 'reader' }), env, fetchImpl: brevo() });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/#wl-ok');
  assert.equal(calls.length, 1);
});

test('no email for duplicates, bad addresses, bots or when the database is missing', async () => {
  const f = brevo();
  await handleWaitlist({ request: asJson({ email: 'a@example.com', role: 'reader' }), env, fetchImpl: f });
  assert.equal(calls.length, 1);
  await handleWaitlist({ request: asJson({ email: 'a@example.com', role: 'reader' }), env, fetchImpl: f });
  await handleWaitlist({ request: asJson({ email: 'nope', role: 'reader' }), env, fetchImpl: f });
  await handleWaitlist({ request: asJson({ email: 'b@example.com', role: 'reader', company: 'spam' }), env, fetchImpl: f });
  await handleWaitlist({ request: asJson({ email: 'c@example.com', role: 'maker', tool: 'http://insecure.example' }), env, fetchImpl: f });
  await handleWaitlist({ request: asJson({ email: 'd@example.com', role: 'reader' }), env: { BREVO_API_KEY: KEY }, fetchImpl: f });
  assert.equal(calls.length, 1, 'only the first, new signup got an email');
});

test('if Brevo fails (error status or network error) the signup still succeeds and nothing leaks', async (t) => {
  const logged = [];
  t.mock.method(console, 'error', (...a) => logged.push(a.join(' ')));
  for (const [i, f] of [brevo(401), brevo(500), brevo(201, { throws: true })].entries()) {
    const res = await handleWaitlist({ request: asJson({ email: `ok${i}@example.com`, role: 'maker' }), env, fetchImpl: f });
    assert.equal(res.status, 200, 'signup succeeded');
    assert.match((await res.json()).message, /on the list/);
  }
  assert.deepEqual(db.rows('SELECT email FROM waitlist ORDER BY email').map(r => r.email), ['ok0@example.com', 'ok1@example.com', 'ok2@example.com']);
  assert.equal(logged.length, 3, 'each failure is logged');
  for (const line of logged) assert.ok(!line.includes('example.com') && !line.includes(KEY) && !line.includes('network down'), line);
});

test('without BREVO_API_KEY signups work and no request is made', async () => {
  const res = await handleWaitlist({ request: asJson({ email: 'k@example.com', role: 'reader' }), env: { DB: db }, fetchImpl: brevo() });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
  assert.equal(await sendWelcome({ apiKey: '', to: 'x@example.com', role: 'reader', fetchImpl: brevo() }), false);
});

test('waitUntil takes the email so the answer does not wait for Brevo', async () => {
  let held;
  let finish;
  const slow = async (url, init) => { calls.push({ url, init }); await new Promise(r => { finish = r; }); return new Response('{}', { status: 201 }); };
  const res = await handleWaitlist({ request: asJson({ email: 'w@example.com', role: 'reader' }), env, fetchImpl: slow, waitUntil: p => { held = p; } });
  assert.equal(res.status, 200, 'answered while the email is still in flight');
  assert.ok(held instanceof Promise);
  finish(); await held;
  assert.equal(calls.length, 1);
});

test('sender constants', () => assert.deepEqual(SENDER, { name: 'OpenOrbia', email: 'launch@openorbia.com' }));
