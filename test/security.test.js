// /security/ (lib/security.js), SECURITY.md and public/.well-known/security.txt
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { renderSecurity, securityResponse, SECURITY_SECTIONS, REPORT_URL } from '../lib/security.js';
import { renderPrivacy, COOKIE_LINE } from '../lib/privacy.js';
import { STATIC_PATHS } from '../lib/seo.js';
import { footerHtml, CONTACT_EMAIL } from '../lib/footer.js';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const html = renderSecurity();
// The visible text of our own rendered HTML, for comparing sentences: drops everything between < and > with a plain loop (not a
// regex replace, which CodeQL reads as an incomplete sanitizer), then decodes the few entities esc() makes.
const text = h => {
  let out = '', inTag = false;
  for (const ch of h) {
    if (ch === '<') inTag = true;
    else if (ch === '>') inTag = false;
    else if (!inTag) out += ch;
  }
  return out.split('&quot;').join('"').split('&#39;').join("'").split('&lt;').join('<').split('&gt;').join('>').split('&amp;').join('&').replace(/\s+/g, ' ');
};
const md = file('SECURITY.md');
const sentences = SECURITY_SECTIONS.flatMap(s => [...(s.p || []), ...(s.li || []), ...(s.after || [])]);

test('/security/ is a normal page: 200 HTML, title and canonical, its own route with security headers, in the sitemap', () => {
  const res = securityResponse();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.ok(html.includes('<title>Security | OpenOrbia</title>') && html.includes('<link rel="canonical" href="https://openorbia.com/security/">'));
  for (const f of ['functions/security/index.js', 'functions/security/_middleware.js']) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
  assert.ok(file('functions/security/_middleware.js').includes("export { onRequest } from '../../lib/security-headers.js';"));
  assert.ok(STATIC_PATHS.includes('/security/'));
});

test('the footer links Security to /security/ in the same tab, on every page', () => {
  const f = footerHtml(2026);
  assert.ok(f.includes('<a href="/security/">Security</a>'));
  assert.ok(!f.includes('security/policy'), 'not the GitHub policy page any more');
  for (const p of ['public/index.html', 'public/launch-list/index.html', 'public/404.html']) assert.ok(file(p).includes('<a href="/security/">Security</a>'), p);
});

test('SECURITY.md and /security/ say the same things: every sentence on the page is in SECURITY.md, word for word', () => {
  assert.ok(sentences.length >= 10);
  for (const s of sentences) {
    assert.ok(md.includes(s), `SECURITY.md is missing: ${s}`);
    assert.ok(text(html).includes(s), `/security/ is missing: ${s}`);
  }
  for (const s of SECURITY_SECTIONS.filter(s => s.h)) assert.ok(md.includes(`## ${s.h}\n`), `SECURITY.md heading: ${s.h}`);
});

test('the wording: a small, independent site; hello@openorbia.com; GitHub private reporting first; the cookie line as on /privacy/', () => {
  for (const t of [md, text(html)]) {
    assert.ok(t.includes('is a small, independent site.') && !/volunteer/i.test(t));
    assert.ok(t.includes('hello@openorbia.com') && !t.includes('launch@openorbia.com'));
    const gh = t.indexOf('GitHub private vulnerability reporting'), mail = t.indexOf('Or email hello@openorbia.com');
    assert.ok(gh > 0 && mail > gh, 'GitHub reporting comes first');
  }
  assert.equal(CONTACT_EMAIL, 'hello@openorbia.com');
  assert.ok(html.includes(`<a href="${REPORT_URL}" rel="noopener">GitHub private vulnerability reporting</a>`));
  assert.ok(html.includes('<a href="mailto:hello@openorbia.com">hello@openorbia.com</a>'));
  assert.ok(html.includes(`<li>${COOKIE_LINE}</li>`) && renderPrivacy().includes(`<li>${COOKIE_LINE}</li>`), 'the same cookie line on both pages');
  assert.ok(md.includes(`- ${COOKIE_LINE}\n`));
  assert.ok(html.includes('<a href="/.well-known/security.txt">https://openorbia.com/.well-known/security.txt</a>'));
});

test('security.txt has the six fields, points at our policy and itself, and expires in under a year (renew it before then)', () => {
  const txt = file('public/.well-known/security.txt');
  assert.equal(txt, [
    'Contact: mailto:hello@openorbia.com',
    'Contact: https://github.com/openorbia/openorbia-site/security/advisories/new',
    'Expires: 2027-11-04T00:00:00.000Z',
    'Preferred-Languages: en',
    'Policy: https://openorbia.com/security/',
    'Canonical: https://openorbia.com/.well-known/security.txt',
  ].join('\n') + '\n');
  const expires = Date.parse(txt.match(/^Expires: (.+)$/m)[1]);
  const left = expires - Date.now();
  assert.ok(left > 0, 'security.txt has expired: set a new Expires date');
  assert.ok(left < 365 * 24 * 3600 * 1000, 'Expires should be less than a year away (RFC 9116)');
  assert.ok(txt.includes(`Contact: ${REPORT_URL}`) && txt.includes(`Contact: mailto:${CONTACT_EMAIL}`));
});
