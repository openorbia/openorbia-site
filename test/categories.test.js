// The four main category pages (lib/categories.js) and the links and structured data that point to them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAIN_CATEGORIES, CATEGORY_PATHS, categoryTopics, categoryTools, emptyTopics, categoriesForTool, renderCategory, categoryResponse, categoryJsonLd } from '../lib/categories.js';
import { CATEGORY_LINKS } from '../lib/footer.js';
import { renderTool, toolJsonLd } from '../lib/tool-pages.js';
import { TOOLS, toolBySlug } from '../public/assets/tools.js';
import { needsPaidService, NEEDS_PAID_LABEL } from '../public/assets/facts.js';

const meta = (html, re) => (html.match(re) || [])[1];
const ld = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const types = data => (data['@graph'] || [data]).map(x => x['@type']);

test('the four category pages are the four headings of the footer site map, in the same order: one category system', () => {
  assert.deepEqual(MAIN_CATEGORIES.map(c => c.key), Object.keys(CATEGORY_LINKS));
  assert.deepEqual(CATEGORY_PATHS, ['/category/productivity/', '/category/automation-and-ai/', '/category/careers/', '/category/security/']);
});

test('every category page has its own title, description and canonical, one h1, and indexable content', () => {
  const titles = new Set(), descs = new Set();
  for (const cat of MAIN_CATEGORIES) {
    const html = renderCategory(cat), path = `/category/${cat.slug}/`;
    const title = meta(html, /<title>([^<]+)<\/title>/), desc = meta(html, /<meta name="description" content="([^"]+)"/);
    assert.ok(title && !titles.has(title), `${path}: unique title`); titles.add(title);
    assert.ok(desc && !descs.has(desc) && desc.length <= 170, `${path}: unique description, short enough for results`); descs.add(desc);
    assert.equal(meta(html, /<link rel="canonical" href="([^"]+)"/), `https://openorbia.com${path}`);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${path}: one h1`);
    assert.doesNotMatch(html, /noindex/);
    assert.match(html, /<meta property="og:title"/);
  }
});

test('no empty topics or filler: every topic lists checked tools, and every tool link is a real tool page', () => {
  const slugs = new Set(TOOLS.map(t => t.slug));
  for (const cat of MAIN_CATEGORIES) {
    assert.deepEqual(emptyTopics(cat), [], `${cat.key}: a topic with no tools is a content gap, not a page section`);
    for (const t of categoryTopics(cat)) assert.ok(t.tools.length > 0, `${cat.key} / ${t.label}`);
    const html = renderCategory(cat);
    for (const [, slug] of html.matchAll(/href="\/tool\/([^/"]+)\/"/g)) assert.ok(slugs.has(slug), `${cat.key}: /tool/${slug}/`);
  }
});

test('tools are placed by audience: no security or career tool under Productivity, every job tool under Careers, every security tool under Security', () => {
  const by = Object.fromEntries(MAIN_CATEGORIES.map(c => [c.slug, categoryTools(c)]));
  assert.ok(by.productivity.every(t => t.category === 'biz'), 'Productivity takes only Small businesses tools');
  assert.ok(!by.productivity.some(t => t.slug === 'garak'), 'a scanner that mentions chatbots is not a productivity tool');
  assert.deepEqual(by.careers.map(t => t.slug).sort(), TOOLS.filter(t => t.category === 'job').map(t => t.slug).sort());
  assert.deepEqual(by.security.map(t => t.slug).sort(), TOOLS.filter(t => t.category === 'sec').map(t => t.slug).sort());
  assert.ok(by['automation-and-ai'].some(t => t.slug === 'n8n'));
});

test('a tool that needs a paid service is labeled on the category page, and the page says how many', () => {
  for (const cat of MAIN_CATEGORIES) {
    const html = renderCategory(cat);
    for (const t of categoryTools(cat).filter(x => needsPaidService(x.facts))) {
      const li = html.slice(html.indexOf(`href="/tool/${t.slug}/"`)); assert.ok(li.slice(0, li.indexOf('</li>')).includes(NEEDS_PAID_LABEL), `${cat.key}: ${t.name}`);
    }
  }
  assert.match(renderCategory(MAIN_CATEGORIES[2]), /1 tool needs a paid service|\d+ tools need a paid service/);
});

test('the topic links keep the existing Launch List searches, so the old filtered listings stay linked', () => {
  const html = renderCategory(MAIN_CATEGORIES[3]);
  assert.ok(html.includes('href="/launch-list/?q=red-team"'));
  assert.ok(html.includes('href="/launch-list/?for=sec"'));
});

test('structured data: BreadcrumbList and an ItemList of the tools on the page, valid JSON, no ratings or prices', () => {
  for (const cat of MAIN_CATEGORIES) {
    const [data] = ld(renderCategory(cat));
    assert.deepEqual(types(data), ['BreadcrumbList', 'ItemList']);
    const list = data['@graph'][1];
    assert.equal(list.numberOfItems, categoryTools(cat).length);
    assert.deepEqual(list.itemListElement.map(i => i.position), categoryTools(cat).map((_, i) => i + 1));
    assert.doesNotMatch(JSON.stringify(categoryJsonLd(cat)), /aggregateRating|review|offers|price/i);
  }
});

test('a JSON-LD block cannot close its own script tag', async () => {
  const { jsonLdTag } = await import('../lib/layout.js');
  assert.equal(jsonLdTag({ x: '</script><script>alert(1)</script>' }).match(/<\/script>/g).length, 1);
});

test('an unknown category is a noindex 404; a known one is a 200 page', async () => {
  const miss = categoryResponse({ params: { slug: 'nope' } });
  assert.equal(miss.status, 404);
  assert.match(await miss.text(), /noindex/);
  assert.equal(categoryResponse({ params: { slug: 'careers' } }).status, 200);
});

test('a tool page links to the categories it is listed in and marks up its breadcrumb', () => {
  const html = renderTool(toolBySlug('n8n'));
  for (const c of categoriesForTool(toolBySlug('n8n'))) assert.ok(html.includes(`href="/category/${c.slug}/"`), c.slug);
  assert.deepEqual(types(ld(html)[0]), ['BreadcrumbList']);
  assert.deepEqual(toolJsonLd(toolBySlug('n8n')).itemListElement.map(i => i.name), ['Launch List', 'Small businesses', 'n8n']);
  assert.deepEqual(TOOLS.filter(t => !categoriesForTool(t).length).map(t => t.slug), [], 'every tool is on at least one category page');
});

test('the four category pages are in the sitemap source', () => {
  assert.match(readFileSync(new URL('../lib/seo.js', import.meta.url), 'utf8'), /CATEGORY_PATHS/);
});
