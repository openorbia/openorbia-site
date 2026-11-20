// /collection/self-hosted/ (lib/collections.js) and /free-ai-apis/ (lib/free-apis.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS } from '../public/assets/tools.js';
import { COLLECTIONS, COLLECTION_PATHS, collectionTools, collectionGroups, collectionResponse, isSelfHosted } from '../lib/collections.js';
import { FREE_APIS, NO_LONGER_FREE, NOT_CONFIRMED, CHECKED, freeApisResponse } from '../lib/free-apis.js';
import { sitemapXml } from '../lib/seo.js';
import { canonicalRedirect } from '../lib/security-headers.js';

const selfHosted = COLLECTIONS.find(c => c.slug === 'self-hosted');

test('self-hosted lists exactly the tools whose checked setup is self-host, or desktop apps with local AI, each once', () => {
  const want = TOOLS.filter(t => t.facts.setup === 'Install & self-host' || (t.facts.setup === 'Desktop app' && t.localAI)).map(t => t.slug).sort();
  const got = collectionTools(selfHosted).map(t => t.slug);
  assert.deepEqual([...got].sort(), want);
  assert.equal(new Set(got).size, got.length, 'no tool twice');
  assert.ok(!collectionTools(selfHosted).some(t => t.facts.setup === 'Browser, ready to use'));
  assert.ok(collectionGroups(selfHosted).every(g => g.tools.length > 0));
  assert.ok(TOOLS.filter(isSelfHosted).length >= 20, 'a real list, not a thin page');
});

test('the self-hosted page: 200, canonical, breadcrumb and ItemList JSON-LD, a link to every tool, in the sitemap; unknown collections 404', async () => {
  const res = collectionResponse({ params: { slug: 'self-hosted' } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('<link rel="canonical" href="https://openorbia.com/collection/self-hosted/">'));
  assert.ok(html.includes('"@type":"BreadcrumbList"') && html.includes('"@type":"ItemList"'));
  for (const t of collectionTools(selfHosted)) assert.ok(html.includes(`href="/tool/${t.slug}/"`), t.slug);
  assert.match(html, /<title>[^<]{20,65}<\/title>/);
  assert.ok(sitemapXml().includes('<loc>https://openorbia.com/collection/self-hosted/</loc>'));
  assert.deepEqual(COLLECTION_PATHS, ['/collection/self-hosted/']);
  assert.equal(collectionResponse({ params: { slug: 'nope' } }).status, 404);
  const r = canonicalRedirect(new Request('https://openorbia.com/collection/self-hosted'));
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), '/collection/self-hosted/');
});

test('free AI APIs: every row is sourced on the provider’s own https page, short enough, and never guesses the card or data use', () => {
  assert.match(CHECKED, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(FREE_APIS.length >= 5);
  for (const a of [...FREE_APIS, ...NO_LONGER_FREE]) assert.match(a.url, /^https:\/\/[a-z0-9.-]+\//, a.name);
  for (const a of FREE_APIS) {
    assert.ok(a.free.length <= 80 && a.catch.length <= 90, a.name);
    assert.ok([null, 'yes', 'no'].includes(a.card), a.name);
  }
});

test('the free AI APIs page: 200, canonical, says Not confirmed where the source is silent, links every source, in the sitemap', async () => {
  const res = freeApisResponse();
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('<link rel="canonical" href="https://openorbia.com/free-ai-apis/">'));
  assert.ok(html.includes(NOT_CONFIRMED));
  for (const a of [...FREE_APIS, ...NO_LONGER_FREE]) assert.ok(html.includes(`href="${a.url}"`), a.name);
  assert.ok(html.includes('href="/tool/ollama/"') && html.includes('href="/collection/self-hosted/"'));
  assert.ok(sitemapXml().includes('<loc>https://openorbia.com/free-ai-apis/</loc>'));
  assert.equal(canonicalRedirect(new Request('https://openorbia.com/free-ai-apis')).headers.get('location'), '/free-ai-apis/');
});
