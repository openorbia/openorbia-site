// /feeds/ (lib/feeds.js): Atom and JSON Feed versions of Launch Week and the Launch List
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedResponse, feedsPageResponse, toolItems, launchItems, FEED_LIMIT, FEED_EXAMPLES } from '../lib/feeds.js';
import { TOOLS, ROWS } from '../public/assets/tools.js';
import { parseFilters, matchesRow } from '../public/assets/launch-filters.js';
import { needsPaidService } from '../public/assets/facts.js';
import { layout } from '../lib/layout.js';
import { sitemapXml } from '../lib/seo.js';
import { canonicalRedirect } from '../lib/security-headers.js';
import { createDb, addLaunch } from './helpers/d1.js';

const get = (path, env = {}, now) => feedResponse({ params: { file: path.split('/').pop().split('?')[0] }, request: new Request(`https://openorbia.com/feeds/${path}`), env, now });

test('the Launch List feed has the same tools as the Launch List with the same filters, newest check first, every one dated', () => {
  for (const q of ['', '?for=sec', '?local=1', '?os=1', '?for=job&setup=browser', '?free=0', '?q=resume']) {
    const want = ROWS.filter(r => matchesRow(r, parseFilters(q))).length;
    const items = toolItems(q);
    assert.equal(items.length, Math.min(want, FEED_LIMIT), q);
    assert.ok(items.every((x, i) => i === 0 || items[i - 1].date >= x.date), `${q}: newest first`);
    assert.ok(items.every(x => /^\d{4}-\d{2}-\d{2}T00:00:00Z$/.test(x.date)));
  }
  const all = toolItems('');
  assert.ok(!all.some(x => needsPaidService(TOOLS.find(t => `https://openorbia.com/tool/${t.slug}/` === x.url).facts)), 'runs-free view by default');
  assert.ok(toolItems('?free=0').length > all.length);
});

test('a Launch List item says only what the tool page says: description, free tier, card, catch and the check date', () => {
  const t = TOOLS.find(x => x.slug === 'ollama');
  const item = toolItems('?q=ollama').find(x => x.title === 'Ollama');
  assert.equal(item.url, 'https://openorbia.com/tool/ollama/');
  assert.ok(item.summary.startsWith(t.description));
  assert.ok(item.summary.includes(`Free tier: ${t.facts.freeTier}`) && item.summary.includes(`The catch: ${t.facts.catch}`));
  assert.ok(item.summary.includes('Card required: No'));
  assert.equal(item.date, `${t.facts.lastChecked}T00:00:00Z`);
});

test('the Atom feed is well formed, self-linked with only the filters it understood, and escapes text', async () => {
  const res = await get('tools.xml?for=sec&junk=%3Cx%3E');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/atom\+xml/);
  const xml = await res.text();
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">'));
  assert.ok(xml.includes('<link rel="self" type="application/atom+xml" href="https://openorbia.com/feeds/tools.xml?for=sec"/>'));
  assert.ok(xml.includes('<title>OpenOrbia Launch List: Security teams</title>'));
  assert.ok(!xml.includes('<x>') && !xml.includes('junk'));
  assert.equal((xml.match(/<entry>/g) || []).length, toolItems('?for=sec').length);
  assert.equal((xml.match(/<entry>/g) || []).length, (xml.match(/<\/entry>/g) || []).length);
  assert.ok(xml.includes('&amp;') || !TOOLS.some(t => t.category === 'sec' && /[&<>]/.test(t.description + t.facts.catch)));
  for (const m of xml.matchAll(/<(title|summary)>([^<]*)<\/\1>/g)) assert.ok(!/&(?!amp;|lt;|gt;|quot;|#39;)/.test(m[2]), m[2]);
});

test('the JSON feed is JSON Feed 1.1 with the same items as the Atom feed', async () => {
  const res = await get('tools.json?local=1');
  assert.match(res.headers.get('content-type'), /^application\/feed\+json/);
  const f = JSON.parse(await res.text());
  assert.equal(f.version, 'https://jsonfeed.org/version/1.1');
  assert.equal(f.feed_url, 'https://openorbia.com/feeds/tools.json?local=1');
  assert.equal(f.home_page_url, 'https://openorbia.com/launch-list/?local=1');
  assert.deepEqual(f.items.map(i => i.url), toolItems('?local=1').map(i => i.url));
  assert.ok(f.items.every(i => i.id && i.title && i.content_text && i.date_modified));
});

test('the Launch Week feed lists a launch only once its lineup is announced, newest first, filtered by audience', async () => {
  const db = createDb();
  addLaunch(db, { slug: 'old-tool', name: 'Old Tool', launch_date: '2026-11-23', category: 'sec' });
  addLaunch(db, { slug: 'job-tool', name: 'Job Tool', launch_date: '2026-11-23', category: 'job' });
  addLaunch(db, { slug: 'next-tool', name: 'Next Tool', launch_date: '2026-11-30', category: 'sec', launch_week: 2 });
  const now = Date.parse('2026-11-25T12:00:00Z');   // Nov 30's lineup is announced on Wednesday Nov 25 (lib/time.js)
  const before = JSON.parse(await (await get('launches.json', { DB: db }, Date.parse('2026-11-18T05:00:00Z'))).text());
  assert.deepEqual(before.items, [], 'nothing before the first lineup is announced');
  const f = JSON.parse(await (await get('launches.json', { DB: db }, now)).text());
  assert.deepEqual(f.items.map(i => i.title), ['Next Tool', 'Job Tool', 'Old Tool']);
  assert.equal(f.items[0].url, 'https://openorbia.com/launch/next-tool/');
  const sec = JSON.parse(await (await get('launches.json?for=sec', { DB: db }, now)).text());
  assert.deepEqual(sec.items.map(i => i.title), ['Next Tool', 'Old Tool']);
  assert.equal(sec.feed_url, 'https://openorbia.com/feeds/launches.json?for=sec');
  assert.deepEqual(launchItems([{ slug: 'x', name: 'X', launch_date: 'not a date' }], now), []);
});

test('without a database the Launch Week feed is still a valid, empty feed; unknown feed files are 404', async () => {
  const res = await get('launches.xml', {});
  assert.equal(res.status, 200);
  const xml = await res.text();
  assert.ok(xml.includes('<feed xmlns="http://www.w3.org/2005/Atom">') && !xml.includes('<entry>'));
  assert.ok(xml.includes('<updated>2026-01-01T00:00:00Z</updated>'));
  for (const f of ['tools.rss', 'secrets.json', '..%2Ftools.xml', 'tools.xml.bak']) {
    assert.equal((await feedResponse({ params: { file: f }, request: new Request('https://openorbia.com/feeds/x'), env: {} })).status, 404, f);
  }
});

test('the /feeds/ page links every example feed, is in the sitemap and the footer, and every page points feed readers to the feeds', async () => {
  const html = await feedsPageResponse().text();
  assert.ok(html.includes('<link rel="canonical" href="https://openorbia.com/feeds/">'));
  for (const [, name, q] of FEED_EXAMPLES) for (const kind of ['xml', 'json']) assert.ok(html.includes(`href="/feeds/${name}.${kind}${q.replace(/&/g, '&amp;')}"`), `${name}.${kind}${q}`);
  assert.ok(sitemapXml().includes('<loc>https://openorbia.com/feeds/</loc>'));
  assert.ok(html.includes('<a href="/feeds/">RSS feeds</a>'), 'footer link');
  const page = layout({ title: 't', description: 'd', path: '/faq/', body: '' });
  assert.ok(page.includes('<link rel="alternate" type="application/atom+xml" title="OpenOrbia Launch Week" href="/feeds/launches.xml">'));
  assert.ok(page.includes('<link rel="alternate" type="application/atom+xml" title="OpenOrbia Launch List" href="/feeds/tools.xml">'));
  assert.equal(canonicalRedirect(new Request('https://openorbia.com/feeds')).headers.get('location'), '/feeds/');
  assert.equal(canonicalRedirect(new Request('https://openorbia.com/feeds/tools.xml')), null, 'feed files are never redirected');
});
