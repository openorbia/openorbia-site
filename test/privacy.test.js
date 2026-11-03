import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { renderPrivacy, privacyResponse, LAST_UPDATED } from '../lib/privacy.js';
import { STATIC_PATHS } from '../lib/seo.js';
import { footerHtml, CONTACT_EMAIL } from '../lib/footer.js';
import { headerHtml } from '../lib/header.js';
import { MARK } from '../lib/layout.js';
import { renderRequest } from '../lib/form-pages.js';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const html = renderPrivacy();
const text = html.replace(/<[^>]+>/g, ' ').replace(/&#39;|’/g, "'").replace(/\s+/g, ' ');

// ---- /privacy/ ----

test('/privacy/ is a normal page: 200 HTML, its own title and canonical, a route with security headers, in the sitemap, linked from every footer', () => {
  const res = privacyResponse();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.ok(html.includes('<title>Privacy | OpenOrbia</title>') && html.includes('<link rel="canonical" href="https://openorbia.com/privacy/">'));
  for (const f of ['functions/privacy/index.js', 'functions/privacy/_middleware.js']) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
  assert.ok(STATIC_PATHS.includes('/privacy/'));
  assert.ok(footerHtml(2026).includes('<a href="/privacy/">Privacy</a>'));
  for (const f of ['public/index.html', 'public/launch-list/index.html', 'public/404.html']) assert.ok(file(f).includes('<a href="/privacy/">Privacy</a>'), f);
});

test('the privacy text says what the waitlist keeps, and the schema keeps exactly that', () => {
  const cols = file('schema.sql').match(/CREATE TABLE IF NOT EXISTS waitlist \(([\s\S]*?)\);/)[1];
  for (const c of ['email', 'role', 'tool_url', 'country']) assert.match(cols, new RegExp(`\\b${c}\\b`), c);
  assert.match(file('functions/api/waitlist.js'), /request\.cf\?\.country/, 'the country is Cloudflare\'s, not looked up from a stored IP');
  for (const s of ['Your email', 'maker or here for free AI tools', "your tool's website", 'the country Cloudflare reports for your connection']) assert.ok(text.includes(s), s);
});

test('the "no cookies, no IP addresses" claims match the code', () => {
  assert.ok(text.includes("We don't set cookies."));
  assert.ok(text.includes('We never store your IP address or your browser details'));
  for (const f of ['lib/vote.js', 'lib/ratelimit.js', 'lib/click.js', 'lib/forms.js', 'functions/api/waitlist.js', 'public/assets/forms.js', 'public/assets/home.js', 'public/assets/launch.js', 'public/assets/click-beacon.js']) {
    assert.ok(!/set-cookie|document\.cookie/i.test(file(f)), `${f}: no cookies`);
  }
  assert.ok(!/remoteip/i.test(file('lib/turnstile.js').replace(/\/\/.*$/gm, '')), 'Turnstile gets the token only, not the IP');
  assert.ok(text.includes("We don't send your IP address to the spam check"));
  // the stored tables have no IP or user-agent column
  assert.ok(!/\b(ip|ip_address|user_agent|useragent)\b\s+TEXT/i.test(file('schema.sql')));
});

test('the services named are the ones the code calls: Cloudflare (hosting, Turnstile, Web Analytics if on) and Brevo for email', () => {
  assert.match(file('lib/email.js'), /https:\/\/api\.brevo\.com\/v3\/smtp\/email/);
  assert.match(file('lib/turnstile.js'), /challenges\.cloudflare\.com\/turnstile/);
  for (const s of ['Cloudflare hosts the site and its database', 'Turnstile spam check', 'Cloudflare Web Analytics counts page visits when it is turned on', 'Brevo sends the welcome and confirmation emails']) assert.ok(text.includes(s), s);
});

test('it says how to have data deleted, when it was last updated, and carries the review note for Khaja', () => {
  assert.ok(html.includes(`<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`) && text.includes('we will delete it'));
  assert.match(LAST_UPDATED, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(text, /Last updated [A-Z][a-z]+ \d{1,2}, \d{4}\./);
  assert.match(file('lib/privacy.js'), /REVIEW BEFORE MERGING: Khaja must read and approve this text/);
});

// ---- "Find my free setup" ----

test('"Find my free setup" is the name visitors see everywhere; the URL and the API stay /request/ and /api/request', () => {
  const pages = {
    header: headerHtml(MARK), footer: footerHtml(2026), request: renderRequest({ siteKey: 'k' }),
    home: file('public/index.html'), list: file('public/launch-list/index.html'), notFound: file('public/404.html'),
    forms: file('lib/forms.js'),
  };
  for (const [name, h] of Object.entries(pages)) {
    const visible = h.replace(/\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
    assert.ok(!/Find me a free tool/i.test(visible), `${name}: old name`);
  }
  assert.ok(pages.header.includes('<b>Find my free setup</b>'));
  assert.ok(pages.footer.includes('<a href="/request/">Find my free setup</a>'));
  assert.ok(pages.request.includes('<title>Find my free setup | OpenOrbia</title>') && pages.request.includes('Find my <em>free setup</em>.'));
  assert.ok(pages.request.includes('action="/api/request"') && pages.request.includes('<link rel="canonical" href="https://openorbia.com/request/">'));
  assert.ok(pages.forms.includes("'Thanks, we got your request. We look for a free setup that fits, and write back if you left an email.'"));
});
