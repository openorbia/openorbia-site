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
  assert.ok(file('lib/email.js').includes("export const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';"), 'Brevo sends the email');
  assert.ok(file('lib/turnstile.js').includes("export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';"), 'Cloudflare Turnstile checks the token');
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
    // code comments may keep the old name; what visitors see may not
    const visible = h.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
    assert.ok(!/Find me a free tool/i.test(visible), `${name}: old name`);
  }
  assert.ok(pages.header.includes('<b>Find my free setup</b>'));
  assert.ok(pages.footer.includes('<a href="/request/">Find my free setup</a>'));
  assert.ok(pages.request.includes('<title>Find my free setup | OpenOrbia</title>') && pages.request.includes('Find my <em>free setup</em>.'));
  assert.ok(pages.request.includes('action="/api/request"') && pages.request.includes('<link rel="canonical" href="https://openorbia.com/request/">'));
  assert.ok(pages.forms.includes("'Thanks, we got your request. We look for a free setup that fits, and write back if you left an email.'"));
});

// ---- added 2026-11-04: Google Fonts, Turnstile in the browser, GitHub issues, how long we keep it ----

test('Google Fonts is named, because every page loads its fonts from Google', () => {
  assert.ok(file('lib/layout.js').includes('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'), 'pages load Google Fonts');
  assert.ok(file('lib/security-headers.js').includes('font-src \'self\' https://fonts.gstatic.com'));
  assert.ok(text.includes("Google Fonts serves the site's fonts, so your browser connects to Google, which receives your IP address under Google's own privacy policy."));
});

test('Turnstile is described as running in the browser and connecting to Cloudflare directly; the widget script is Cloudflare\'s', () => {
  assert.ok(file('public/index.html').includes('<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>'));
  assert.ok(text.includes('it runs in your browser and connects to Cloudflare directly'));
});

test('"What we collect" covers submitting through GitHub: a public issue under GitHub\'s privacy policy', () => {
  assert.ok(file('public/index.html').includes('issues/new?template=submit-a-tool.yml'), 'the homepage links to the GitHub issue form');
  assert.ok(text.includes('Submitting through GitHub.') && text.includes('It is public, and GitHub\'s privacy policy applies.'));
});

test('"How long we keep it" matches the code: no automatic deletion of signups, submissions or requests; clicks are counts; vote codes per week; rate limits expire', () => {
  assert.ok(html.includes('<h2 id="keep-h">How long we keep it</h2>'));
  assert.ok(html.indexOf('id="keep-h"') > html.indexOf('id="dont-h"') && html.indexOf('id="keep-h"') < html.indexOf('id="services-h"'));
  // nothing in the code deletes these rows on a timer
  const code = ['lib/forms.js', 'lib/click.js', 'lib/vote.js', 'lib/ratelimit.js', 'functions/api/waitlist.js'].map(file).join('\n');
  assert.ok(!/DELETE FROM (waitlist|submissions|requests)\b/.test(code));
  assert.ok(text.includes('Waitlist signups, tool submissions and "Find my free setup" requests stay until you ask us to delete them.') ||
    text.includes('Waitlist signups, tool submissions and “Find my free setup” requests stay until you ask us to delete them.'));
  // clicks: one count per tool per day, no visitor column
  const clicks = file('schema.sql').match(/CREATE TABLE IF NOT EXISTS clicks \(([\s\S]*?)\);/)[1];
  assert.ok(!/\b(email|ip|visitor|voter|user_agent)\b/i.test(clicks), 'the clicks table has no personal data');
  assert.ok(text.includes('Daily click counts are one number per tool per day, with no personal data.'));
  // votes: salted with the launch week; rate limits: deleted once their window has passed
  assert.ok(file('lib/vote.js').includes('export const voterHash = (secret, week, v) => hmacHex(secret, `vote\\n${week}'), 'the vote code is salted with the launch week');
  assert.ok(file('lib/ratelimit.js').includes("DELETE FROM rate_limits WHERE expires_at < ?"));
  assert.ok(text.includes("Vote codes are made fresh for each launch week and kept with that launch's votes."));
  assert.ok(text.includes('Rate-limit codes expire when their time window ends and are then cleared out.'));
});

test('Last updated is Nov 4, 2026', () => {
  assert.equal(LAST_UPDATED, '2026-11-04');
  assert.ok(text.includes('Last updated November 4, 2026.'));
});
