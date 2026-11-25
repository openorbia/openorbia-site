// /compare/<a>-vs-<b>/ (lib/compare.js): side-by-side pages built only from the facts already on each tool
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPARISONS, COMPARE_PATHS, compareResponse, compareRows, compareSummary, compareTitle, compareDescription, comparisonIsValid, comparisonsFor } from '../lib/compare.js';
import { toolResponse } from '../lib/tool-pages.js';
import { sitemapXml } from '../lib/seo.js';
import { canonicalRedirect } from '../lib/security-headers.js';
import { esc } from '../lib/html.js';

test('every comparison is 2 or 3 real tools from one audience that share a job, with a slug made of their slugs, each once', () => {
  assert.ok(COMPARISONS.length >= 5);
  for (const c of COMPARISONS) {
    assert.ok(comparisonIsValid(c), c.slug);
    assert.equal(c.slug, c.slugs.join('-vs-'));
    assert.match(c.slug, /^[a-z0-9-]+$/);
  }
  assert.equal(new Set(COMPARISONS.map(c => c.slug)).size, COMPARISONS.length);
  assert.equal(new Set(COMPARISONS.map(c => [...c.slugs].sort().join('+'))).size, COMPARISONS.length, 'no pair twice in another order');
});

test('titles and descriptions fit search results and are different on every page', () => {
  for (const c of COMPARISONS) {
    assert.ok(compareTitle(c).length <= 70, `${compareTitle(c)} (${compareTitle(c).length})`);
    assert.ok(compareDescription(c).length <= 158, `${c.slug}: ${compareDescription(c).length}`);
  }
  assert.equal(new Set(COMPARISONS.map(compareTitle)).size, COMPARISONS.length);
  assert.equal(new Set(COMPARISONS.map(compareDescription)).size, COMPARISONS.length);
});

test('each column says exactly what the tool page says, and "Not confirmed" where a fact is missing, never a guess', () => {
  for (const c of COMPARISONS) for (const t of c.tools) {
    const rows = Object.fromEntries(compareRows(t));
    assert.equal(rows['Free tier'], t.facts.freeTier || 'Not confirmed', t.slug);
    assert.equal(rows['The catch'], t.facts.catch || 'Not confirmed', t.slug);
    assert.equal(rows.License, t.license);
    assert.equal(rows['Local AI'], t.localAI ? 'Works with local AI' : 'Not listed');
  }
  const fake = { name: 'X', license: 'MIT', localAI: false, facts: {} };
  assert.ok(compareRows(fake).filter(([l]) => l !== 'License' && l !== 'Local AI').every(([, v]) => v === 'Not confirmed'));
});

test('"In short" puts each short fact under differ or same, never both, and skips one that is not confirmed', () => {
  for (const c of COMPARISONS) {
    const { same, differ } = compareSummary(c);
    const labels = [...same, ...differ].map(x => x.label);
    assert.equal(new Set(labels).size, labels.length, c.slug);
    for (const x of same) assert.equal(new Set(x.values).size, 1, `${c.slug} ${x.label}`);
    for (const x of differ) assert.ok(new Set(x.values).size > 1, `${c.slug} ${x.label}`);
    assert.ok(!labels.includes('Free tier') && !labels.includes('The catch'), 'free text is never called the same');
  }
});

test('each page: 200, canonical, breadcrumb and ItemList JSON-LD, every fact and source, links to each tool, in the sitemap', async () => {
  for (const c of COMPARISONS) {
    const res = compareResponse({ params: { slug: c.slug } });
    assert.equal(res.status, 200, c.slug);
    const html = await res.text();
    assert.ok(html.includes(`<link rel="canonical" href="https://openorbia.com/compare/${c.slug}/">`), c.slug);
    assert.ok(html.includes('"@type":"BreadcrumbList"') && html.includes('"@type":"ItemList"'), c.slug);
    for (const t of c.tools) {
      assert.ok(html.includes(`href="/tool/${t.slug}/"`), `${c.slug} -> ${t.slug}`);
      for (const [, v] of compareRows(t)) assert.ok(html.includes(esc(v)), `${c.slug}: ${t.slug} ${v}`);
      for (const u of (t.facts.sources || []).filter(s => s.startsWith('https://'))) assert.ok(html.includes(`href="${esc(u)}"`), u);
    }
    assert.ok(!/is the winner|best choice|we recommend|is better than/i.test(html), 'no winner is picked');
    assert.ok(html.includes("We don't pick a winner"));
    if (c.tools[0].category === 'sec') assert.ok(html.includes('Use it only where you are allowed to'), c.slug);
    assert.ok(sitemapXml().includes(`<loc>https://openorbia.com/compare/${c.slug}/</loc>`), c.slug);
  }
  assert.deepEqual(COMPARE_PATHS, COMPARISONS.map(c => `/compare/${c.slug}/`));
});

test('an unknown comparison is a noindex 404, and the address without a slash redirects', async () => {
  const res = compareResponse({ params: { slug: 'ollama-vs-nothing' } });
  assert.equal(res.status, 404);
  assert.ok((await res.text()).includes('noindex'));
  const r = canonicalRedirect(new Request('https://openorbia.com/compare/open-webui-vs-librechat'));
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), '/compare/open-webui-vs-librechat/');
});

test('every compared tool page links to each comparison it is in', async () => {
  for (const c of COMPARISONS) for (const t of c.tools) {
    assert.ok(comparisonsFor(t).includes(c));
    const html = await toolResponse({ params: { slug: t.slug } }).text();
    assert.ok(html.includes(`href="/compare/${c.slug}/"`), `${t.slug} -> ${c.slug}`);
  }
});
