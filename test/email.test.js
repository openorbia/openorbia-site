import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { welcomeEmail, sendWelcome, BREVO_URL, SENDER, EMAIL_ART } from '../lib/email.js';
import { unsubscribeUrl } from '../lib/unsubscribe.js';
import { existsSync } from 'node:fs';
import { handleWaitlist } from '../functions/api/waitlist.js';
import { createDb } from './helpers/d1.js';
import { SITEVERIFY_URL } from '../lib/turnstile.js';

const KEY = 'xkeysib-test-key-never-real';
let db, env, calls;
beforeEach(() => { db = createDb(); env = { DB: db, BREVO_API_KEY: KEY, TURNSTILE_SECRET_KEY: 'ts-secret' }; calls = []; });

// A stand-in for Brevo: records every request, answers with the given status (or throws)
// Turnstile's check is answered here too (as passed) and is not recorded, so `calls` holds only the Brevo requests.
const brevo = (status = 201, { throws = false } = {}) => async (url, init) => {
  if (url === SITEVERIFY_URL) return new Response(JSON.stringify({ success: true }), { status: 200 });
  calls.push({ url, init, body: JSON.parse(init.body) });
  if (throws) throw new Error('network down');
  return new Response(JSON.stringify({ messageId: 'x' }), { status });
};
// Requests as the homepage sends them: from our own origin, with a Turnstile token in the JSON (none on the no-JS form)
const asJson = body => new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://openorbia.com' }, body: JSON.stringify({ turnstile: 'token-ok', ...body }) });
const asForm = body => new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://openorbia.com' }, body: new URLSearchParams(body).toString() });
test('the welcome email: subject, preview text, and every section in both the HTML and the plain text', () => {
  const e = welcomeEmail('reader', { unsubscribeUrl: 'https://openorbia.com/unsubscribe/?id=7&t=0123456789abcdef0123456789abcdef' });
  assert.equal(e.subject, 'You’re in. OpenOrbia launches Nov 23');
  assert.equal(e.preview, 'Free AI tools, with the catch spelled out.');
  assert.match(e.html, /<div style="display:none;[^"]*">Free AI tools, with the catch spelled out\./, 'the preview text is the first thing in the body');
  for (const s of ['You’re on the list.', 'Launch Week 1 · Monday, Nov 23, 2026', 'What’s free', 'What it needs', 'The catch', 'What happens next',
    'The week before Nov 23: the Launch Week 1 lineup.', 'After that: at most one email a week with new free tools.',
    'Building a free AI tool?', 'Khaja, founder of OpenOrbia', 'P.S.']) {
    assert.ok(e.html.includes(s), `html: ${s}`);
    assert.ok(e.text.includes(s), `text: ${s}`);
  }
  assert.ok(e.html.includes('<a href="https://openorbia.com/" style="display:inline-block;padding:14px 28px;') && e.html.includes('>Browse the tools</a>'));
  assert.ok(e.html.includes('<a href="https://openorbia.com/makers/"') && e.text.includes('https://openorbia.com/makers/'));
  assert.ok(e.html.includes('<a href="https://openorbia.com/unsubscribe/?id=7&amp;t=0123456789abcdef0123456789abcdef"') && e.html.includes('>Unsubscribe</a>'));
  assert.ok(e.text.includes('Unsubscribe: https://openorbia.com/unsubscribe/?id=7&t=0123456789abcdef0123456789abcdef'));
});

test('the welcome email is email-safe: tables and inline styles, system fonts, no scripts, a solid fallback under every colour effect', () => {
  const { html } = welcomeEmail('reader');
  assert.ok(!/<script|@import|fonts\.googleapis|<link /i.test(html), 'no scripts, no web fonts, no external CSS');
  assert.ok(html.includes("-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"));
  assert.ok(html.includes('role="presentation"') && html.includes('width="600"'));
  // the header: navy behind the hosted art, so it reads with images blocked
  assert.ok(html.includes(`bgcolor="#0b1026" background="${EMAIL_ART}"`) && html.includes(`background:#0b1026 url('${EMAIL_ART}')`));
  assert.ok(existsSync(new URL('../public/email/header.png', import.meta.url)), 'the art is published with the site');
  // the line: solid purple, with the gradient on top where it is drawn
  assert.ok(html.includes('bgcolor="#8b5cf6" style="height:4px;line-height:4px;font-size:0;background:#8b5cf6;background-image:linear-gradient(90deg,#8b5cf6,#22d3ee)"'));
  assert.ok(html.includes('bgcolor="#6d28d9"'), 'the purple button');
  // phones: the cards stack; dark mode: the body and cards change where the client honours it
  assert.match(html, /@media \(max-width:620px\)\{[\s\S]*\.oo-card\{display:block!important;width:100%!important/);
  assert.match(html, /@media \(prefers-color-scheme:dark\)\{[\s\S]*\.oo-body\{background:#11162e!important\}/);
  assert.ok(html.includes('<meta name="color-scheme" content="light dark">'));
  // three cards in one row, one cell each, so they share a height; the two spacers between them hide on phones
  assert.equal((html.match(/<td class="oo-card oo-card-bg"/g) || []).length, 3);
  assert.equal((html.match(/<td class="oo-gap"/g) || []).length, 2);
  assert.match(html, /\.oo-gap\{display:none!important\}/);
});

test('without an unsubscribe link (no server secret) the email asks for a reply instead, and never shows a broken link', () => {
  const e = welcomeEmail('maker');
  assert.ok(e.text.includes('To unsubscribe, reply to this email.') && e.html.includes('To unsubscribe, reply to this email.'));
  assert.ok(!e.html.includes('/unsubscribe/'));
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
  assert.equal(body.subject, 'You’re in. OpenOrbia launches Nov 23');
  assert.ok(body.textContent.includes('You’re on the list.') && body.htmlContent.includes('You’re on the list.'));
  assert.ok(!init.body.includes(KEY), 'the key is never in the body');
});

test('with the server secret, each welcome email carries its own unsubscribe link and the one-click List-Unsubscribe headers', async () => {
  env.VOTE_SECRET = 'test-secret';
  await handleWaitlist({ request: asJson({ email: 'a@example.com', role: 'reader' }), env, fetchImpl: brevo() });
  await handleWaitlist({ request: asJson({ email: 'b@example.com', role: 'reader' }), env, fetchImpl: brevo() });
  assert.equal(calls.length, 2);
  const links = calls.map(c => c.body.headers['List-Unsubscribe'].slice(1, -1));
  for (const [i, c] of calls.entries()) {
    assert.match(links[i], /^https:\/\/openorbia\.com\/unsubscribe\/\?id=\d+&t=[0-9a-f]{32}$/);
    assert.equal(c.body.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.ok(c.body.textContent.includes(`Unsubscribe: ${links[i]}`));
  }
  assert.notEqual(links[0], links[1], 'every signup has its own link');
  assert.equal(links[0], await unsubscribeUrl('test-secret', new URL(links[0]).searchParams.get('id')));
});

test('makers and readers get the same email, with the card that invites makers to launch', async () => {
  for (const role of ['maker', 'reader']) assert.ok(welcomeEmail(role).html.includes('Launch it on OpenOrbia, free'), role);
});

test('the no-JS form path saves the signup and redirects, but sends no email (there is no Turnstile token without JavaScript)', async () => {
  const res = await handleWaitlist({ request: asForm({ email: 'f@example.com', role: 'reader' }), env, fetchImpl: brevo() });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/#wl-ok');
  assert.deepEqual(db.rows('SELECT email FROM waitlist').map(r => r.email), ['f@example.com']);
  assert.equal(calls.length, 0);
});

test('no welcome email without a passed Turnstile check: missing token, failed token, or no secret configured', async () => {
  const failing = async (url, init) => {
    if (url === SITEVERIFY_URL) return new Response(JSON.stringify({ success: false }), { status: 200 });
    calls.push({ url, init }); return new Response('{}', { status: 201 });
  };
  const noToken = new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://openorbia.com' }, body: JSON.stringify({ email: 'n1@example.com', role: 'reader' }) });
  assert.equal((await handleWaitlist({ request: noToken, env, fetchImpl: brevo() })).status, 200);
  assert.equal((await handleWaitlist({ request: asJson({ email: 'n2@example.com', role: 'reader' }), env, fetchImpl: failing })).status, 200);
  assert.equal((await handleWaitlist({ request: asJson({ email: 'n3@example.com', role: 'reader' }), env: { DB: db, BREVO_API_KEY: KEY }, fetchImpl: brevo() })).status, 200);
  assert.equal(calls.length, 0, 'no email went out');
  assert.equal(db.rows('SELECT email FROM waitlist').length, 3, 'all three signups were still saved');
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
  const slow = async (url, init) => { if (url === SITEVERIFY_URL) return new Response(JSON.stringify({ success: true }), { status: 200 }); calls.push({ url, init }); await new Promise(r => { finish = r; }); return new Response('{}', { status: 201 }); };
  const res = await handleWaitlist({ request: asJson({ email: 'w@example.com', role: 'reader' }), env, fetchImpl: slow, waitUntil: p => { held = p; } });
  assert.equal(res.status, 200, 'answered while the email is still in flight');
  assert.ok(held instanceof Promise);
  while (!finish) await new Promise(r => setTimeout(r, 1));   // the background task reaches Brevo after the Turnstile check
  finish(); await held;
  assert.equal(calls.length, 1);
});

test('sender constants', () => assert.deepEqual(SENDER, { name: 'OpenOrbia', email: 'launch@openorbia.com' }));

test('rejections are logged with Brevo\'s status, code and message, minus the address and the key', async (t) => {
  const logged = [];
  t.mock.method(console, 'error', (...a) => logged.push(a.join(' ')));
  t.mock.method(console, 'log', () => {});
  const reject = async () => new Response(JSON.stringify({ code: 'invalid_parameter', message: `Sender launch@openorbia.com is not valid. Recipient sender-test@example.com. Key ${KEY}` }), { status: 400 });
  const ok = await sendWelcome({ apiKey: KEY, to: 'sender-test@example.com', role: 'reader', fetchImpl: reject });
  assert.equal(ok, false);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /HTTP 400 code=invalid_parameter message="Sender launch@openorbia\.com is not valid\./);
  assert.ok(!logged[0].includes('sender-test@example.com') && !logged[0].includes(KEY), logged[0]);
  assert.ok(logged[0].includes('[recipient]') && logged[0].includes('[key]'));
});

test('success and a missing key are logged too, so a tail shows which path ran', async (t) => {
  const lines = [];
  t.mock.method(console, 'log', (...a) => lines.push(a.join(' ')));
  t.mock.method(console, 'error', (...a) => lines.push(a.join(' ')));
  await sendWelcome({ apiKey: KEY, to: 'a@example.com', role: 'reader', fetchImpl: brevo(201) });
  await sendWelcome({ apiKey: undefined, to: 'a@example.com', role: 'reader', fetchImpl: brevo() });
  assert.ok(lines.some(l => /sending to Brevo \(role=reader\)/.test(l)));
  assert.ok(lines.some(l => /accepted by Brevo: HTTP 201/.test(l)));
  assert.ok(lines.some(l => /skipped: BREVO_API_KEY is not set/.test(l)));
  assert.ok(lines.every(l => !l.includes('a@example.com') && !l.includes(KEY)));
});

test('the Pages handler passes waitUntil bound to the context', async () => {
  const { onRequestPost } = await import('../functions/api/waitlist.js');
  let bound = false, held;
  const ctx = { request: asJson({ email: 'ctx@example.com', role: 'reader' }), env, waitUntil(p) { bound = this === ctx; held = p; return p; } };
  const realFetch = globalThis.fetch; globalThis.fetch = brevo();
  try { const res = await onRequestPost(ctx); assert.equal(res.status, 200); await held; } finally { globalThis.fetch = realFetch; }
  assert.ok(bound, 'waitUntil was called on the context, not detached');
  assert.equal(calls.length, 1);
});
