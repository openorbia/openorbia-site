// Crawl hygiene (docs/seo/SEO_FIXES.md): one address per page, and Cloudflare's pages.dev copies kept out of search results.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest, canonicalRedirect, isPagesDev, SLASH_PAGES } from '../lib/security-headers.js';

const ok = () => new Response('<p>page</p>', { status: 200, headers: { 'content-type': 'text/html' } });
const run = (url, method = 'GET') => onRequest({ request: new Request(url, { method }), next: async () => ok() });

test('a page address without its trailing slash gets a permanent redirect to the canonical address, query kept', async () => {
  for (const [from, to] of [
    ['https://openorbia.com/faq', '/faq/'],
    ['https://openorbia.com/tool/ollama', '/tool/ollama/'],
    ['https://openorbia.com/launches', '/launches/'],
    ['https://openorbia.com/category/careers', '/category/careers/'],
    ['https://openorbia.com/launch/some-tool/kit', '/launch/some-tool/kit/'],
    ['https://openorbia.com/contact?tool=ollama', '/contact/?tool=ollama'],
  ]) {
    const res = await run(from);
    assert.equal(res.status, 301, from);
    assert.equal(res.headers.get('location'), to, from);
    assert.ok(res.headers.get('content-security-policy'), `${from}: the redirect still carries the security headers`);
  }
  assert.equal((await run('https://openorbia.com/tool/ollama', 'HEAD')).status, 301);
});

test('the redirect leaves alone the canonical addresses, form posts, the API, outbound links and files', async () => {
  for (const url of ['https://openorbia.com/faq/', 'https://openorbia.com/tool/ollama/', 'https://openorbia.com/api/vote', 'https://openorbia.com/api/launches',
    'https://openorbia.com/go/ollama', 'https://openorbia.com/sitemap.xml', 'https://openorbia.com/launches/2026-11-23/results', 'https://openorbia.com/unsubscribe']) {
    assert.equal(canonicalRedirect(new Request(url)), null, url);
  }
  assert.equal(canonicalRedirect(new Request('https://openorbia.com/submit', { method: 'POST', body: 'x' })), null, 'a POST is never redirected');
  assert.equal(canonicalRedirect(undefined), null);
  assert.ok(!SLASH_PAGES.test('/api'), 'never the API');
});

test('pages.dev and preview copies say noindex; openorbia.com does not', async () => {
  assert.equal((await run('https://openorbia.pages.dev/tool/ollama/')).headers.get('x-robots-tag'), 'noindex');
  assert.equal((await run('https://launch-day.openorbia.pages.dev/faq/')).headers.get('x-robots-tag'), 'noindex');
  assert.equal((await run('https://openorbia.com/tool/ollama/')).headers.get('x-robots-tag'), null);
  assert.equal((await run('https://www.openorbia.com/faq/')).headers.get('x-robots-tag'), null, 'www is handled by a redirect rule in Cloudflare, not noindex');
  assert.ok(isPagesDev('openorbia.pages.dev') && !isPagesDev('openorbia.com') && !isPagesDev('notpages.dev.example.com'));
});

test('public/_headers sends noindex for the static files on pages.dev, using the patterns from the Cloudflare docs', () => {
  const t = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.match(t, /^https:\/\/:project\.pages\.dev\/\*\n  X-Robots-Tag: noindex$/m);
  assert.match(t, /^https:\/\/:version\.:project\.pages\.dev\/\*\n  X-Robots-Tag: noindex$/m);
  assert.doesNotMatch(t, /^\/\*\n(?:  .*\n)*  X-Robots-Tag/m, 'never noindex for every host');
});

test('the Launch List HTML carries the default tool cards, with a link to every tool page, as build:home writes them', async () => {
  const { defaultCardsHtml, defaultRows } = await import('../public/assets/launch-list.js');
  const html = readFileSync(new URL('../public/launch-list/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes(`<!-- cards:start -->${defaultCardsHtml()}<!-- cards:end -->`), 'run npm run build:home after changing the Launch List');
  assert.ok(html.includes(`<span class="count" id="count">${defaultRows().length} TOOLS</span>`));
  const linked = new Set([...html.matchAll(/href="\/tool\/([a-z0-9-]+)\/"/g)].map(m => m[1]));
  assert.equal(linked.size, defaultRows().length, 'one crawlable link per tool in the default view');
});
