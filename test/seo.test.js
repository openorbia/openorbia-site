import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sitemapXml, sitemapResponse, STATIC_PATHS } from '../lib/seo.js';
import { launchResponse, leaderboardResponse, renderNotFound } from '../lib/pages.js';
import { launchOpensAt } from '../lib/time.js';
import { renderMakers } from '../lib/makers.js';
import { createDb, addLaunch } from './helpers/d1.js';

const root = new URL('../', import.meta.url);
const AFTER = launchOpensAt('2026-11-23') + 2 * 24 * 3600 * 1000;
let db, env;
beforeEach(() => { db = createDb(); env = { DB: db, VOTE_SECRET: 'test-secret-0123456789abcdef' }; });

test('robots.txt allows everything and links to the sitemap', () => {
  const t = readFileSync(new URL('public/robots.txt', root), 'utf8');
  assert.match(t, /^User-agent: \*$/m);
  assert.match(t, /^Allow: \/$/m);
  assert.match(t, /^Sitemap: https:\/\/openorbia\.com\/sitemap\.xml$/m);
  assert.ok(!/^Disallow:\s*\S/m.test(t));
});

test('the sitemap lists the fixed pages and every launch, and nothing else', async () => {
  addLaunch(db, { slug: 'zeta-tool', name: 'Zeta Tool', launch_date: '2026-11-23' });
  addLaunch(db, { slug: 'alpha-tool', name: 'Alpha Tool', launch_date: '2026-11-23' });
  const res = await sitemapResponse({ env });
  assert.match(res.headers.get('content-type'), /application\/xml/);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.ok(locs.includes('https://openorbia.com/makers/'));
  assert.deepEqual(locs, [...STATIC_PATHS, '/launch/alpha-tool/', '/launch/zeta-tool/'].map(p => `https://openorbia.com${p}`));
  assert.ok(!xml.includes('404'));
});

test('the sitemap still lists the fixed pages when the database is unavailable', async () => {
  const xml = await (await sitemapResponse({ env: {} })).text();
  assert.equal([...xml.matchAll(/<loc>/g)].length, STATIC_PATHS.length);
  assert.equal(sitemapXml(['a&b']).includes('a%26b'), true);
});

// ---- titles, descriptions and canonicals ----

const meta = (html, re) => (html.match(re) || [])[1];
const pages = async () => {
  addLaunch(db, { slug: 't', name: 'Tool T', launch_date: '2026-11-23' });
  const get = path => new Request(`https://openorbia.com${path}`);
  const launch = await (await launchResponse({ request: get('/launch/t/'), env, params: { slug: 't' }, now: AFTER })).text();
  const board = await (await leaderboardResponse({ request: get('/launches/'), env, now: AFTER })).text();
  const file = f => readFileSync(new URL(f, root), 'utf8');
  return { '/': file('public/index.html'), '/launch-list/': file('public/launch-list/index.html'), '/launches/': board, '/launch/t/': launch, '/makers/': renderMakers() };
};

test('every indexable page has its own title, description and a canonical URL for itself', async () => {
  const all = await pages();
  const titles = new Set(), descs = new Set();
  for (const [path, html] of Object.entries(all)) {
    const title = meta(html, /<title>([^<]+)<\/title>/), desc = meta(html, /<meta name="description" content="([^"]+)"/);
    assert.ok(title && desc, `${path}: title and description`);
    assert.equal(meta(html, /<link rel="canonical" href="([^"]+)"/), `https://openorbia.com${path}`, `${path}: canonical`);
    assert.ok(!titles.has(title), `${path}: duplicate title`); titles.add(title);
    assert.ok(!descs.has(desc), `${path}: duplicate description`); descs.add(desc);
    assert.ok(!/noindex/.test(html), `${path}: indexable`);
  }
});

test('the 404 page is not indexed', () => {
  assert.match(readFileSync(new URL('public/404.html', root), 'utf8'), /<meta name="robots" content="noindex">/);
  assert.match(renderNotFound(), /noindex/);
});
