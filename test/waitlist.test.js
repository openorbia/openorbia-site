import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { handleWaitlist } from '../functions/api/waitlist.js';
import { launchResponse } from '../lib/pages.js';
import { createDb, addLaunch } from './helpers/d1.js';

const root = new URL('../', import.meta.url);
let db, env;
beforeEach(() => { db = createDb(); env = { DB: db }; });

const asJson = body => new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://openorbia.com' }, body: JSON.stringify(body) });
const asForm = body => new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://openorbia.com' }, body: new URLSearchParams(body).toString() });
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
  const badJson = new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://openorbia.com' }, body: '{' });
  assert.equal((await handleWaitlist({ request: badJson, env })).status, 400);
});

test('a signup from another site is refused, and nothing is saved', async () => {
  for (const origin of ['https://evil.example', 'null']) {
    const req = new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ email: 'x@example.com', role: 'reader' }) });
    assert.equal((await handleWaitlist({ request: req, env })).status, 403, origin);
  }
  const noOrigin = new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'y@example.com', role: 'reader' }) });
  assert.equal((await handleWaitlist({ request: noOrigin, env })).status, 403);
  assert.deepEqual(rows(), []);
});

test('signups are rate limited per visitor: 5 an hour, then 429 for JSON and the error message for a form', async () => {
  const e = { DB: db, VOTE_SECRET: 'v'.repeat(32) };
  const now = Date.UTC(2026, 10, 2, 12, 0, 0);
  for (let i = 0; i < 5; i++) assert.equal((await handleWaitlist({ request: asJson({ email: `r${i}@example.com`, role: 'reader' }), env: e, now })).status, 200, `signup ${i + 1}`);
  const sixth = await handleWaitlist({ request: asJson({ email: 'r5@example.com', role: 'reader' }), env: e, now });
  assert.equal(sixth.status, 429);
  assert.ok(Number(sixth.headers.get('retry-after')) > 0);
  assert.equal((await handleWaitlist({ request: asForm({ email: 'r6@example.com', role: 'reader' }), env: e, now })).headers.get('location'), '/#wl-error');
  assert.equal(rows().length, 5);
  assert.equal((await handleWaitlist({ request: asJson({ email: 'r7@example.com', role: 'reader' }), env: e, now: now + 3600 * 1000 })).status, 200, 'the next hour is a new budget');
});

test('a very large signup body is refused before it is read', async () => {
  const req = new Request('https://openorbia.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://openorbia.com', 'content-length': '20000' }, body: JSON.stringify({ email: 'big@example.com', pad: 'x'.repeat(19000) }) });
  assert.equal((await handleWaitlist({ request: req, env })).status, 400);
  assert.deepEqual(rows(), []);
});

test('the homepage waitlist has the Turnstile widget with the same public site key as wrangler.toml, and sends its token', () => {
  const html = readFileSync(new URL('public/index.html', root), 'utf8');
  const key = readFileSync(new URL('wrangler.toml', root), 'utf8').match(/^\[vars\][\s\S]*?TURNSTILE_SITE_KEY = "([^"]+)"/m)[1];
  assert.ok(html.includes(`<div class="cf-turnstile" data-sitekey="${key}"`), 'widget with the production key');
  assert.ok(html.includes('<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>'));
  assert.match(readFileSync(new URL('public/assets/home.js', root), 'utf8'), /turnstile:check\(\)/);
});

test('the homepage form posts without JavaScript and every message it can be sent to exists', () => {
  const html = readFileSync(new URL('public/index.html', root), 'utf8');
  assert.match(html, /<form id="wl" class="wl" method="post" action="\/api\/waitlist"/);
  for (const id of ['wl-ok', 'wl-already', 'wl-bad-email', 'wl-bad-link', 'wl-error']) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /\.nojs-msg:target\{display:block\}/);
});

// The one description of OpenOrbia, word for word the same on the site and in its LinkedIn, X and GitHub profiles, so search
// engines connect them as one organization. The launch date is on the page itself (badge, countdown), not in the description.
const ORG_DESCRIPTION = 'A weekly launch platform for free and open-source AI tools, with the catch shown up front, for small businesses, job seekers and security teams.';

test('homepage meta description, og:description and the Organization data all use the one OpenOrbia description', () => {
  const html = readFileSync(new URL('public/index.html', root), 'utf8');
  assert.equal(html.match(/<meta name="description" content="([^"]*)"/)[1], ORG_DESCRIPTION);
  assert.equal(html.match(/<meta property="og:description" content="([^"]*)"/)[1], ORG_DESCRIPTION);
  assert.ok(!/Launching soon/.test(html.match(/<meta name="description" content="([^"]*)"/)[1]));
});

test('the homepage head has valid JSON-LD: OpenOrbia as an Organization (logo, founder, profiles) and the WebSite', () => {
  const html = readFileSync(new URL('public/index.html', root), 'utf8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1);
  assert.ok(html.indexOf('application/ld+json') < html.indexOf('</head>'), 'in the head');
  const ld = JSON.parse(blocks[0][1]);   // throws if the JSON is not valid
  assert.equal(ld['@context'], 'https://schema.org');
  const org = ld['@graph'].find(x => x['@type'] === 'Organization'), site = ld['@graph'].find(x => x['@type'] === 'WebSite');
  assert.deepEqual(
    { name: org.name, url: org.url, logo: org.logo, description: org.description, founder: org.founder, foundingDate: org.foundingDate },
    { name: 'OpenOrbia', url: 'https://openorbia.com', logo: 'https://openorbia.com/icon-512.png', description: ORG_DESCRIPTION, founder: { '@type': 'Person', name: 'Khaja Syed' }, foundingDate: '2026' });
  assert.deepEqual(org.sameAs, ['https://www.linkedin.com/company/openorbia', 'https://x.com/OpenOrbia', 'https://github.com/openorbia']);
  assert.deepEqual({ name: site.name, url: site.url, publisher: site.publisher }, { name: 'OpenOrbia', url: 'https://openorbia.com', publisher: { '@id': org['@id'] } });
  assert.ok(existsSync(new URL('public/icon-512.png', root)), 'the logo file exists');
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

test('the "Submit a tool" issue form has every field and the homepage links to it next to the waitlist button', () => {
  const yml = readFileSync(new URL('.github/ISSUE_TEMPLATE/submit-a-tool.yml', root), 'utf8');
  assert.match(yml, /^name: Submit a tool$/m);
  for (const label of ['Tool name', 'Repo URL', 'Website', 'Category', 'License', "What's free", 'Card required', 'Where your data goes', 'Setup', 'Maker contact']) {
    assert.ok(yml.includes(`label: ${label}`), label);
  }
  for (const option of ['Small Business', 'Job Seekers', 'Cybersecurity & SOC', 'Runs on your computer', 'Your server', 'Vendor cloud', 'Browser, ready to use', 'Desktop app', 'Install & self-host']) {
    assert.ok(yml.includes(`- ${option}`), option);
  }
  assert.ok(yml.includes('This issue is public'), 'tells makers the contact details are public');
  const html = readFileSync(new URL('public/index.html', root), 'utf8');
  assert.match(html, /id="wl-btn">Join the waitlist<\/button>\s*<a class="btn ghost" href="https:\/\/github\.com\/openorbia\/openorbia-site\/issues\/new\?template=submit-a-tool\.yml"/);
});

test('the Submit a tool form applies the tool-submission label', () => {
  assert.match(readFileSync(new URL('.github/ISSUE_TEMPLATE/submit-a-tool.yml', root), 'utf8'), /^labels: \["tool-submission"\]$/m);
});

test('the Submit a tool dropdowns start empty: not required, "(required, please choose)", and "Not sure" kept', () => {
  const yml = readFileSync(new URL('.github/ISSUE_TEMPLATE/submit-a-tool.yml', root), 'utf8');
  const block = label => { const i = yml.indexOf(`label: ${label}`); const j = yml.indexOf('- type:', i); return yml.slice(i, j < 0 ? undefined : j); };
  for (const label of ['Category', 'Card required', 'Where your data goes', 'Setup']) {
    const b = block(label);
    assert.ok(b.includes('(required, please choose)'), `${label}: description`);
    assert.match(b, /required: false/, `${label}: not required, so it shows None by default`);
  }
  for (const label of ['Card required', 'Where your data goes', 'Setup']) assert.ok(block(label).includes('- Not sure'), `${label}: Not sure`);
  for (const label of ['Are you the maker?', 'How does it use AI?']) assert.ok(yml.includes(`label: ${label}`), label);
});
