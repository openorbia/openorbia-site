import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { handleClick } from '../lib/click.js';
import { goResponse } from '../lib/go.js';
import { layout } from '../lib/layout.js';
import { renderTool } from '../lib/tool-pages.js';
import { renderLaunch } from '../lib/pages.js';
import { TOOLS, toolHref } from '../public/assets/tools.js';
import { createDb } from './helpers/d1.js';

const root = new URL('../', import.meta.url);
const file = f => readFileSync(new URL(f, root), 'utf8');
const NOV23_EVENING = Date.UTC(2026, 10, 24, 7, 30);   // 11:30 PM Pacific on Nov 23
const NOV24_MORNING = Date.UTC(2026, 10, 24, 8, 30);   // 12:30 AM Pacific on Nov 24

let db, env;
beforeEach(() => { db = createDb(); env = { DB: db }; });
const rows = () => db.rows('SELECT slug, day, count FROM clicks ORDER BY slug, day').map(r => ({ ...r }));
const click = (body, { headers = {}, now = NOV23_EVENING, e = env, type = 'application/json' } = {}) => handleClick({
  env: e, now,
  request: new Request('https://openorbia.com/api/click', { method: 'POST', headers: { 'content-type': type, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }),
});

// ---- POST /api/click: the same table and upsert as /go/ ----

test('POST /api/click {slug} adds one to the tool\'s count for the day (same upsert as /go/) and answers 204', async () => {
  const res = await click({ slug: 'ai-job-search' });
  assert.equal(res.status, 204);
  assert.equal(await res.text(), '');
  assert.deepEqual(rows(), [{ slug: 'ai-job-search', day: '2026-11-23', count: 1 }]);
  await click({ slug: 'ai-job-search' });
  await click({ slug: 'meetily' });
  await click({ slug: 'ai-job-search' }, { now: NOV24_MORNING });
  assert.deepEqual(rows(), [
    { slug: 'ai-job-search', day: '2026-11-23', count: 2 }, { slug: 'ai-job-search', day: '2026-11-24', count: 1 },
    { slug: 'meetily', day: '2026-11-23', count: 1 },
  ], 'one row per tool per Pacific day');
});

test('the beacon and /go/ write to the same row: a tool\'s count is the sum of both paths', async () => {
  await click({ slug: 'vigil' });
  const go = await goResponse({ request: new Request('https://openorbia.com/go/vigil'), env, params: { slug: 'vigil' }, now: NOV23_EVENING });
  assert.equal(go.status, 302);
  await click({ slug: 'vigil' });
  assert.deepEqual(rows(), [{ slug: 'vigil', day: '2026-11-23', count: 3 }]);
});

test('every tool on the Launch List can be counted', async () => {
  for (const t of TOOLS) assert.equal((await click({ slug: t.slug })).status, 204, t.slug);
  assert.equal(rows().length, TOOLS.length);
});

test('an unknown slug is a 404 and counts nothing', async () => {
  for (const slug of ['nope', 'MEETILY', '../etc/passwd', 'a'.repeat(100), '', 'sample-business-tool', "x'; DROP TABLE clicks;--", 'meetily/', ' meetily']) {
    const res = await click({ slug });
    assert.equal(res.status, 404, JSON.stringify(slug));
    assert.deepEqual(await res.json(), { ok: false, code: 'not_found', error: 'That tool is not on the Launch List.' });
  }
  assert.deepEqual(rows(), []);
});

test('bad requests are refused and count nothing', async () => {
  for (const body of ['', 'not json', '{', 'null', '[]', '"meetily"', '42', JSON.stringify({}), JSON.stringify({ slug: 5 }), JSON.stringify({ slug: ['meetily'] }), JSON.stringify({ slug: { a: 1 } })]) {
    assert.equal((await click(body)).status, 400, body);
  }
  assert.equal((await click(JSON.stringify({ slug: 'meetily', pad: 'x'.repeat(2000) }))).status, 400, 'too large');
  assert.deepEqual(rows(), []);
});

test('sendBeacon content types are accepted (JSON Blob, plain text string); other types are refused', async () => {
  assert.equal((await click({ slug: 'meetily' }, { type: 'application/json' })).status, 204);
  assert.equal((await click({ slug: 'meetily' }, { type: 'application/json; charset=utf-8' })).status, 204);
  assert.equal((await click({ slug: 'meetily' }, { type: 'text/plain;charset=UTF-8' })).status, 204);
  assert.equal((await click('slug=meetily', { type: 'application/x-www-form-urlencoded' })).status, 415);
  assert.equal((await click({ slug: 'meetily' }, { type: 'text/html' })).status, 415);
  assert.equal(rows()[0].count, 3);
});

test('only our own pages can count a click', async () => {
  const cross = await click({ slug: 'meetily' }, { headers: { origin: 'https://evil.example' } });
  assert.equal(cross.status, 403);
  assert.equal((await cross.json()).code, 'forbidden_origin');
  assert.equal((await click({ slug: 'meetily' }, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await click({ slug: 'meetily' }, { headers: { origin: 'https://openorbia.com', 'sec-fetch-site': 'same-origin' } })).status, 204);
  assert.equal((await click({ slug: 'meetily' })).status, 204, 'no Origin header (older browsers) is fine');
  assert.equal(rows()[0].count, 2);
});

test('no IP, user agent, referrer or cookie is read or kept, and the response sets no cookie', async () => {
  const res = await click({ slug: 'vigil' }, { headers: {
    'cf-connecting-ip': '203.0.113.77', 'user-agent': 'Mozilla/5.0 SecretBrowser/1.0', referer: 'https://elsewhere.example/page', cookie: 'sid=abc123', 'accept-language': 'xx-YY',
  } });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('set-cookie'), null);
  assert.ok(![...res.headers.keys()].some(k => /cookie|vary/i.test(k)));
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(db.rows("SELECT name FROM pragma_table_info('clicks') ORDER BY cid").map(r => r.name), ['slug', 'day', 'count']);
  const stored = JSON.stringify(db.rows('SELECT * FROM clicks'));
  for (const secret of ['203.0.113.77', 'SecretBrowser', 'elsewhere.example', 'abc123', 'xx-YY']) assert.ok(!stored.includes(secret), secret);
  const source = file('lib/click.js');
  assert.ok(!/CF-Connecting-IP|User-Agent|Referer|\bcookie/i.test(source.replace(/^\/\/.*$/gm, '')), 'the handler never reads them');
});

test('no database or a failing one is reported, not hidden (there is no redirect to protect)', async () => {
  assert.equal((await click({ slug: 'meetily' }, { e: {} })).status, 503);
  assert.equal((await click({ slug: 'meetily' }, { e: { DB: { prepare() { throw new Error('D1 is down'); } } } })).status, 500);
});

test('the Pages Function takes POST and answers other methods with 405', async () => {
  const fn = await import('../functions/api/click.js');
  const post = await fn.onRequestPost({ env, request: new Request('https://openorbia.com/api/click', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: 'ollama' }) }) });
  assert.equal(post.status, 204);
  assert.equal(rows().length, 1);
  const get = await fn.onRequest({ request: new Request('https://openorbia.com/api/click'), env });
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST');
  assert.equal(rows()[0].count, 1, 'a GET counts nothing');
});

// ---- the page script: a beacon when a tool link is followed ----

function runBeaconScript({ sendBeacon = true, beaconAccepts = true } = {}) {
  const listeners = {}; const sent = []; const fetched = [];
  const context = {
    document: { addEventListener: (type, fn) => { listeners[type] = fn; } },
    navigator: sendBeacon ? { sendBeacon: (url, body) => { sent.push({ url, body }); return beaconAccepts; } } : {},
    Blob, fetch: (url, init) => { fetched.push({ url, init }); return Promise.resolve(); },
  };
  vm.runInNewContext(file('public/assets/click-beacon.js'), context);
  const link = tool => ({ dataset: { tool }, closest: sel => (sel === 'a[data-tool]' ? { dataset: { tool } } : null) });
  const fire = (type, target, extra = {}) => listeners[type]({ type, button: 0, target, ...extra });
  return { listeners, sent, fetched, link, fire };
}

test('the script listens for click and auxclick and posts {slug} with navigator.sendBeacon to /api/click', async () => {
  const src = file('public/assets/click-beacon.js');
  assert.ok(src.includes("navigator.sendBeacon('/api/click'") && src.includes('a[data-tool]'));
  const page = runBeaconScript();
  assert.deepEqual(Object.keys(page.listeners).sort(), ['auxclick', 'click']);
  page.fire('click', page.link('meetily'));
  assert.equal(page.sent.length, 1);
  assert.equal(page.sent[0].url, '/api/click');
  assert.equal(page.sent[0].body.type, 'application/json');
  assert.deepEqual(JSON.parse(await page.sent[0].body.text()), { slug: 'meetily' }, 'the slug and nothing else');
});

test('only followed tool links count: middle click yes, right click no, links without data-tool no', () => {
  const page = runBeaconScript();
  page.fire('auxclick', page.link('ollama'), { button: 1 });   // middle click opens a new tab
  assert.equal(page.sent.length, 1);
  page.fire('auxclick', page.link('ollama'), { button: 2 });   // right click does not follow the link
  page.fire('click', { closest: () => null });                 // anything else on the page
  page.fire('click', {});                                      // a target with no closest()
  assert.equal(page.sent.length, 1);
});

test('if sendBeacon is missing or refuses, a keepalive fetch carries the same JSON; nothing ever throws', () => {
  const noBeacon = runBeaconScript({ sendBeacon: false });
  noBeacon.fire('click', noBeacon.link('vigil'));
  assert.equal(noBeacon.fetched.length, 1);
  assert.equal(noBeacon.fetched[0].url, '/api/click');
  assert.equal(noBeacon.fetched[0].init.method, 'POST');
  assert.equal(noBeacon.fetched[0].init.keepalive, true);
  assert.deepEqual(JSON.parse(noBeacon.fetched[0].init.body), { slug: 'vigil' });
  const refused = runBeaconScript({ beaconAccepts: false });
  refused.fire('click', refused.link('vigil'));
  assert.equal(refused.fetched.length, 1);
  // a throwing sendBeacon and a rejecting fetch must not break the link
  const handlers = {};
  const ctx = { document: { addEventListener: (t, f) => { handlers[t] = f; } }, navigator: { sendBeacon() { throw new Error('boom'); } }, Blob, fetch: () => Promise.reject(new Error('x')) };
  vm.runInNewContext(file('public/assets/click-beacon.js'), ctx);
  assert.doesNotThrow(() => handlers.click({ type: 'click', button: 0, target: { closest: () => ({ dataset: { tool: 'vigil' } }) } }));
});

// ---- the links themselves are real ----

test('the Launch List and the tool pages link straight to the tool and carry data-tool; /go/ is not in any page', () => {
  const list = file('public/launch-list/index.html');
  assert.ok(list.includes('<a href="https://github.com/${repo}" data-tool="${slugOf(name)}" target="_blank" rel="noopener">View on GitHub ↗</a>'));
  assert.ok(list.includes('<script src="/assets/click-beacon.js" defer></script>'), 'the Launch List loads the beacon script');
  assert.ok(!list.includes('/go/'));
  for (const t of TOOLS) {
    const page = renderTool(t);
    const marked = [...page.matchAll(/<a [^>]*href="([^"]+)" data-tool="([^"]+)"/g)].map(m => [m[1], m[2]]);
    assert.ok(marked.length >= 2, `${t.name}: the button and the source link`);
    for (const [href, slug] of marked) { assert.equal(slug, t.slug); assert.ok(href === toolHref(t) || href === t.github, `${t.name}: ${href}`); }
    assert.ok(!page.includes('/go/'), `${t.name}: no /go/`);
    assert.ok(page.includes('<script src="/assets/click-beacon.js" defer></script>'), `${t.name}: the script is loaded`);
  }
  assert.ok(layout({ title: 't', description: 'd', path: '/', body: '' }).includes('<script src="/assets/click-beacon.js" defer></script>'));
});

test('launch pages keep their real addresses and are not counted: they have no data-tool', () => {
  const launch = { slug: 'real-launch', name: 'Real Launch', tagline: 't', description: 'd', category: 'job', repo_url: 'https://github.com/real/launch', website_url: 'https://real.example/', logo_url: null,
    screenshots: [], video_url: null, maker_name: 'M', maker_links: [], maker_story: '', license: 'MIT', launch_week: 1, launch_date: '2026-11-23', facts: {}, votes: 0 };
  const html = renderLaunch({ launch, now: Date.UTC(2026, 10, 25), voted: false });
  assert.ok(html.includes('href="https://real.example/"') && html.includes('href="https://github.com/real/launch"'));
  assert.ok(!html.includes('data-tool') && !html.includes('/go/'));
});

test('/go/ and /api/click are both documented, and crawlers are kept out of /go/ only', () => {
  const robots = file('public/robots.txt');
  assert.deepEqual(robots.split('\n').filter(l => l.startsWith('Disallow:')), ['Disallow: /go/']);
  assert.ok(robots.includes('Allow: /') && robots.includes('Sitemap: https://openorbia.com/sitemap.xml'));
  assert.ok(!robots.includes('/api/'), '/api/ is not listed');
});
