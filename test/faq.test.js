import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { FAQ, renderFaq, faqJsonLd, faqResponse } from '../lib/faq.js';
import { STATIC_PATHS } from '../lib/seo.js';
import { RECHECK_POLICY } from '../lib/how-we-check.js';
import { CONTACT_EMAIL } from '../lib/footer.js';

const html = renderFaq();
const LD = '<script type="application/ld+json">';
const ldOf = page => { const start = page.indexOf(LD) + LD.length; return JSON.parse(page.slice(start, page.indexOf('</script>', start))); };

test('/faq/ answers every question in its own open-and-close item, and is in the sitemap', async () => {
  assert.ok(FAQ.length >= 10);
  assert.equal(html.split('<details class="faq-q"').length - 1, FAQ.length);
  for (const [q] of FAQ) assert.ok(html.includes(`<summary>${q.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}</summary>`), q);
  assert.ok(html.includes('<title>FAQ | OpenOrbia</title>') && html.includes('<link rel="canonical" href="https://openorbia.com/faq/">'));
  assert.ok(STATIC_PATHS.includes('/faq/'));
  assert.ok(existsSync(new URL('../functions/faq/index.js', import.meta.url)));
  const res = faqResponse();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
});

test('the FAQ structured data is valid JSON with every question and a plain-text answer', () => {
  const ld = ldOf(html);
  assert.equal(ld['@type'], 'FAQPage');
  assert.deepEqual(ld, faqJsonLd());
  assert.deepEqual(ld.mainEntity.map(q => q.name), FAQ.map(([q]) => q));
  for (const q of ld.mainEntity) assert.ok(q.acceptedAnswer.text.length > 20 && !q.acceptedAnswer.text.includes('<'), q.name);
});

test('the answers match the site rules: free, no paid placement, the recheck policy, the founder rule and both emails', () => {
  const text = JSON.stringify(faqJsonLd());
  assert.ok(text.includes('There is no paid placement'));
  assert.ok(text.includes(RECHECK_POLICY));
  assert.ok(text.includes('kept off the Launch Week leaderboard'));
  assert.ok(text.includes('Needs paid service') && text.includes('Runs free'));
  assert.ok(html.includes(`href="mailto:${CONTACT_EMAIL}"`) && html.includes('href="mailto:launch@openorbia.com"'));
});

test('every link in the answers goes to a real page or one of the two email addresses', () => {
  const pages = { '/how-we-check/': 'functions/how-we-check/index.js', '/launch-list/': 'public/launch-list/index.html', '/how-voting-works/': 'functions/how-voting-works/index.js', '/submit/': 'functions/submit/index.js', '/makers/': 'functions/makers/index.js' };
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  for (const [, href] of main.matchAll(/href="([^"]+)"/g)) {
    if (href.startsWith('mailto:')) { assert.ok([`mailto:${CONTACT_EMAIL}`, 'mailto:launch@openorbia.com'].includes(href), href); continue; }
    assert.ok(pages[href] && existsSync(new URL(`../${pages[href]}`, import.meta.url)), href);
  }
});
