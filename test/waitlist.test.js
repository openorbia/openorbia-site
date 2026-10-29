import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleWaitlist } from '../functions/api/waitlist.js';
import { launchResponse } from '../lib/pages.js';
import { createDb, addLaunch } from './helpers/d1.js';

const root = new URL('../', import.meta.url);
let db, env;
beforeEach(() => { db = createDb(); env = { DB: db }; });

const asJson = body => new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const asForm = body => new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
const rows = () => db.rows('SELECT email, role, tool_url FROM waitlist').map(r => ({ ...r }));

test('JSON signup still answers with JSON', async () => {
  const res = await handleWaitlist({ request: asJson({ email: 'A@Example.com', role: 'reader' }), env });
  assert.equal(res.status, 200);
  assert.match((await res.json()).message, /first launch goes live/);
  assert.deepEqual(rows().map(r => r.email), ['a@example.com']);
  const bad = await handleWaitlist({ request: asJson({ email: 'nope' }), env });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, 'Please enter a valid email.');
});

test('form post saves the signup and redirects back to a message in the page, with no email in the URL', async () => {
  const res = await handleWaitlist({ request: asForm({ email: 'maker@example.com', role: 'maker', tool: 'https://tool.example', company: '' }), env });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/#wl-ok');
  assert.ok(!res.headers.get('location').includes('example'));
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(rows(), [{ email: 'maker@example.com', role: 'maker', tool_url: 'https://tool.example/' }]);
});

test('form post: duplicates, bad email, bad link, honeypot and a missing database each land on the right message', async () => {
  const where = async (fields, e = env) => (await handleWaitlist({ request: asForm(fields), env: e })).headers.get('location');
  assert.equal(await where({ email: 'a@example.com', role: 'reader' }), '/#wl-ok');
  assert.equal(await where({ email: 'a@example.com', role: 'reader' }), '/#wl-already');
  assert.equal(await where({ email: 'nope', role: 'reader' }), '/#wl-bad-email');
  assert.equal(await where({ email: 'b@example.com', role: 'maker', tool: 'http://insecure.example' }), '/#wl-bad-link');
  assert.equal(await where({ email: 'c@example.com', role: 'reader', company: 'spam' }), '/#wl-ok');
  assert.equal(await where({ email: 'd@example.com', role: 'reader' }, {}), '/#wl-error');
  assert.deepEqual(rows().map(r => r.email), ['a@example.com'], 'only the one valid signup is stored');
});

test('an unreadable body is a 400 for JSON and the error message for a form', async () => {
  const badJson = new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
  assert.equal((await handleWaitlist({ request: badJson, env })).status, 400);
});

test('the homepage form posts without JavaScript and every message it can be sent to exists', () => {
  const html = readFileSync(new URL('public/index.html', root), 'utf8');
  assert.match(html, /<form id="wl" class="wl" method="post" action="\/api\/waitlist"/);
  for (const id of ['wl-ok', 'wl-already', 'wl-bad-email', 'wl-bad-link', 'wl-error']) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /\.nojs-msg:target\{display:block\}/);
});

test('homepage meta description and og:description are the same, with the launch date', () => {
  const html = readFileSync(new URL('public/index.html', root), 'utf8');
  const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.equal(html.match(/<meta property="og:description" content="([^"]*)"/)[1], desc);
  assert.ok(desc.includes('Launch Week 1: Monday, Nov 23.') && !/Launching soon/.test(desc));
});

test('every page has a skip link to a main that can take focus', async () => {
  for (const f of ['public/index.html', 'public/launch-list/index.html', 'public/404.html']) {
    const html = readFileSync(new URL(f, root), 'utf8');
    assert.ok(html.includes('<a class="skip" href="#main">Skip to content</a>'), f);
    assert.match(html, /<main [^>]*id="main" tabindex="-1"/, f);
  }
  addLaunch(db, { slug: 't', name: 'T', launch_date: '2026-11-23' });
  const res = await launchResponse({ request: new Request('https://openorbia.com/launch/t/'), env: { DB: db, VOTE_SECRET: 'x'.repeat(24) }, params: { slug: 't' }, now: Date.now() });
  const html = await res.text();
  assert.ok(html.includes('class="skip"') && /<main [^>]*id="main"/.test(html));
  assert.match(readFileSync(new URL('public/assets/launch.css', root), 'utf8'), /\.skip:focus\{top:12px\}/);
});
