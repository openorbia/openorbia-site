import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { handleClick } from '../lib/click.js';
import { goResponse } from '../lib/go.js';
import { isOurOrigin, requestIsOurs } from '../lib/origin.js';
import { CLICK_LIMIT } from '../lib/ratelimit.js';
import { layout } from '../lib/layout.js';
import { renderTool } from '../lib/tool-pages.js';
import { renderLaunch } from '../lib/pages.js';
import { TOOLS, toolHref } from '../public/assets/tools.js';
import { createDb } from './helpers/d1.js';

const root = new URL('../', import.meta.url);
const file = f => readFileSync(new URL(f, root), 'utf8');
const SECRET = 'test-secret-0123456789abcdef';
const NOV23_EVENING = Date.UTC(2026, 10, 24, 7, 30);   // 11:30 PM Pacific on Nov 23
const NOV24_MORNING = Date.UTC(2026, 10, 24, 8, 30);   // 12:30 AM Pacific on Nov 24

let db, env, visitors;
beforeEach(() => { db = createDb(); env = { DB: db, VOTE_SECRET: SECRET }; visitors = 0; });
const rows = () => db.rows('SELECT slug, day, count FROM clicks ORDER BY slug, day').map(r => ({ ...r }));
// every request is a different visitor unless the test says otherwise (one visitor is limited to 30 clicks a minute)
const ip = () => `198.51.100.${(visitors++ % 250) + 1}`;
const click = (body, { headers = {}, now = NOV23_EVENING, e = env, type = 'application/json', visitor } = {}) => handleClick({
  env: e, now,
  request: new Request('https://openorbia.com/api/click', {
    method: 'POST',
    headers: { 'content-type': type, origin: 'https://openorbia.com', 'cf-connecting-ip': visitor || ip(), 'user-agent': 'TestBrowser/1.0', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }),
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
  const go = await goResponse({ request: new Request('https://openorbia.com/go/vigil', { headers: { 'cf-connecting-ip': ip() } }), env, params: { slug: 'vigil' }, now: NOV23_EVENING });
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

// ---- only our own pages ----

test('Origin must be openorbia.com or a preview host: no Origin and no Referer is refused, a Referer alone is enough', async () => {
  const noOrigin = await handleClick({ env, now: NOV23_EVENING, request: new Request('https://openorbia.com/api/click', {
    method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip() }, body: JSON.stringify({ slug: 'meetily' }) }) });
  assert.equal(noOrigin.status, 403);
  assert.equal((await noOrigin.json()).code, 'forbidden_origin');
  assert.equal((await click({ slug: 'meetily' }, { headers: { origin: '' } })).status, 403, 'an empty Origin is not an origin');
  for (const origin of ['https://openorbia.com', 'https://www.openorbia.com', 'https://launch-day.openorbia.pages.dev', 'https://71a3986a.openorbia.pages.dev', 'https://openorbia.pages.dev']) {
    assert.equal((await click({ slug: 'meetily' }, { headers: { origin } })).status, 204, origin);
  }
  for (const origin of ['https://evil.example', 'https://openorbia.com.evil.example', 'https://notopenorbia.com', 'https://evil-openorbia.pages.dev', 'http://openorbia.com', 'null', 'https://user@openorbia.com@evil.example']) {
    assert.equal((await click({ slug: 'meetily' }, { headers: { origin } })).status, 403, origin);
  }
  assert.equal((await click({ slug: 'meetily' }, { headers: { origin: 'https://evil.example', referer: 'https://openorbia.com/launch-list/' } })).status, 403, 'a bad Origin is not rescued by a good Referer');
  const refererOnly = await handleClick({ env, now: NOV23_EVENING, request: new Request('https://openorbia.com/api/click', {
    method: 'POST', headers: { 'content-type': 'application/json', referer: 'https://launch-day.openorbia.pages.dev/launch-list/?for=job', 'cf-connecting-ip': ip() }, body: JSON.stringify({ slug: 'meetily' }) }) });
  assert.equal(refererOnly.status, 204);
  assert.equal((await handleClick({ env, now: NOV23_EVENING, request: new Request('https://openorbia.com/api/click', {
    method: 'POST', headers: { 'content-type': 'application/json', referer: 'https://evil.example/https://openorbia.com/', 'cf-connecting-ip': ip() }, body: JSON.stringify({ slug: 'meetily' }) }) })).status, 403);
  assert.equal((await click({ slug: 'meetily' }, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await click({ slug: 'meetily' }, { headers: { 'sec-fetch-site': 'same-site' } })).status, 403, 'same-site but another origin is not ours');
  assert.equal((await click({ slug: 'meetily' }, { headers: { 'sec-fetch-site': 'same-origin' } })).status, 204);
  assert.equal(rows()[0].count, 5 + 1 + 1, 'only the accepted requests counted');
});

test('isOurOrigin: exact hosts and our preview hosts only; localhost over http for development', () => {
  for (const o of ['https://openorbia.com', 'https://www.openorbia.com/', 'https://launch-day.openorbia.pages.dev', 'http://localhost:8788', 'http://127.0.0.1:8788', 'https://openorbia.com/launch-list/']) assert.equal(isOurOrigin(o), true, o);
  for (const o of ['', 'null', 'openorbia.com', 'https://openorbia.com.evil.example', 'https://evil.example/openorbia.com', 'https://a.b.openorbia.pages.dev.evil.example', 'http://openorbia.com', 'https://localhost', 'ftp://openorbia.com', 'https://openorbia.com@evil.example', 'javascript:alert(1)', undefined, null]) assert.equal(isOurOrigin(o), false, String(o));
  assert.equal(requestIsOurs(new Request('https://x.test/', { headers: { origin: 'https://openorbia.com' } })), true);
  assert.equal(requestIsOurs(new Request('https://x.test/')), false);
});

// ---- the rate limit: 30 clicks a minute per visitor, keyed by an HMAC ----

test('a visitor is limited to 30 clicks a minute: the 31st is a 429 with Retry-After, counts nothing, and the window then resets', async () => {
  assert.deepEqual(CLICK_LIMIT, { max: 30, windowSeconds: 60 });
  const who = '203.0.113.9';
  for (let i = 0; i < 30; i++) assert.equal((await click({ slug: 'meetily' }, { visitor: who })).status, 204, `click ${i + 1}`);
  const over = await click({ slug: 'meetily' }, { visitor: who });
  assert.equal(over.status, 429);
  assert.equal((await over.json()).code, 'rate_limited');
  const wait = Number(over.headers.get('retry-after'));
  assert.ok(wait >= 1 && wait <= 60, `retry-after ${wait}`);
  assert.equal(rows()[0].count, 30, 'the 31st counted nothing');
  assert.equal((await click({ slug: 'meetily' }, { visitor: who })).status, 429, 'still limited in the same window');
  assert.equal((await click({ slug: 'meetily' }, { visitor: '203.0.113.10' })).status, 204, 'another visitor is not affected');
  assert.equal((await click({ slug: 'meetily' }, { visitor: who, now: NOV23_EVENING + 61 * 1000 })).status, 204, 'a new window starts');
});

test('bad requests count against the budget too, so junk cannot be used to get around it', async () => {
  const who = '203.0.113.20';
  for (let i = 0; i < 30; i++) await click('not json', { visitor: who });
  const res = await click({ slug: 'meetily' }, { visitor: who });
  assert.equal(res.status, 429);
  assert.deepEqual(rows(), []);
});

test('the limit is per visitor (IP and user agent), an IPv6 /64 is one visitor, and /go/ shares the same budget', async () => {
  const withUa = ua => click({ slug: 'meetily' }, { visitor: '203.0.113.30', headers: { 'user-agent': ua } });
  for (let i = 0; i < 30; i++) await withUa('A/1');
  assert.equal((await withUa('A/1')).status, 429);
  assert.equal((await withUa('B/2')).status, 204, 'another user agent is another visitor');
  for (let i = 0; i < 30; i++) await click({ slug: 'ollama' }, { visitor: `2001:db8:1:2:${i}::1` });
  assert.equal((await click({ slug: 'ollama' }, { visitor: '2001:db8:1:2:ffff::9' })).status, 429, 'the same /64');
  // /go/ draws on the same budget: after 28 beacons, two /go/ clicks count and the third does not
  const who = '203.0.113.40';
  for (let i = 0; i < 28; i++) await click({ slug: 'vigil' }, { visitor: who });
  const go = () => goResponse({ request: new Request('https://openorbia.com/go/vigil', { headers: { 'cf-connecting-ip': who, 'user-agent': 'TestBrowser/1.0' } }), env, params: { slug: 'vigil' }, now: NOV23_EVENING });
  for (let i = 0; i < 3; i++) assert.equal((await go()).status, 302, 'the visitor is always sent on');
  assert.equal(rows().find(r => r.slug === 'vigil').count, 30, 'but only 30 were counted');
});

test('/go/ over the limit, or with nothing to key the limit with, still redirects and just does not count', async () => {
  const who = '203.0.113.50';
  const go = (e = env) => goResponse({ request: new Request('https://openorbia.com/go/ollama', { headers: { 'cf-connecting-ip': who } }), env: e, params: { slug: 'ollama' }, now: NOV23_EVENING });
  for (let i = 0; i < 35; i++) assert.equal((await go()).status, 302);
  assert.equal(rows()[0].count, 30);
  assert.equal((await go({ DB: db })).status, 302, 'no VOTE_SECRET');
  assert.equal(rows()[0].count, 30, 'and nothing was counted without a way to limit it');
  const head = await goResponse({ request: new Request('https://openorbia.com/go/ollama', { method: 'HEAD', headers: { 'cf-connecting-ip': who } }), env, params: { slug: 'ollama' }, now: NOV23_EVENING + 120 * 1000 });
  assert.equal(head.status, 302);
  assert.equal(rows()[0].count, 30, 'HEAD is never counted');
});

test('/go/ has no same-origin rule: email and newsletter links arrive from elsewhere, often with no Referer', async () => {
  for (const headers of [{}, { referer: 'https://mail.google.com/' }, { origin: 'https://evil.example' }]) {
    const res = await goResponse({ request: new Request('https://openorbia.com/go/ollama', { headers: { 'cf-connecting-ip': ip(), ...headers } }), env, params: { slug: 'ollama' }, now: NOV23_EVENING });
    assert.equal(res.status, 302, JSON.stringify(headers));
  }
  assert.equal(rows()[0].count, 3);
});

test('only hashes are kept for the limit: no raw IP, user agent or referrer in any table, and no cookie', async () => {
  const res = await click({ slug: 'vigil' }, { visitor: '203.0.113.77', headers: {
    'user-agent': 'Mozilla/5.0 SecretBrowser/1.0', referer: 'https://openorbia.com/launch-list/', cookie: 'sid=abc123', 'accept-language': 'xx-YY',
  } });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('set-cookie'), null);
  assert.ok(![...res.headers.keys()].some(k => /cookie|vary/i.test(k)));
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(db.rows("SELECT name FROM pragma_table_info('clicks') ORDER BY cid").map(r => r.name), ['slug', 'day', 'count']);
  const limits = db.rows('SELECT key, count FROM rate_limits').map(r => ({ ...r }));
  assert.equal(limits.length, 1);
  assert.match(limits[0].key, /^[0-9a-f]{64}$/, 'the key is an HMAC');
  const stored = JSON.stringify([db.rows('SELECT * FROM clicks'), db.rows('SELECT * FROM rate_limits'), db.rows('SELECT * FROM votes'), db.rows('SELECT * FROM waitlist')]);
  for (const secret of ['203.0.113.77', 'SecretBrowser', 'launch-list', 'abc123', 'xx-YY', 'openorbia.com']) assert.ok(!stored.includes(secret), secret);
  assert.ok(!/cookie/i.test(file('lib/click.js').replace(/^\s*\/\/.*$/gm, '')), 'the handler never touches cookies');
});

test('no database or no secret is reported, not hidden (there is no redirect to protect); a failing database is a 500', async () => {
  assert.equal((await click({ slug: 'meetily' }, { e: {} })).status, 503);
  assert.equal((await click({ slug: 'meetily' }, { e: { DB: db } })).status, 503, 'no VOTE_SECRET: the limit cannot be keyed');
  assert.equal((await click({ slug: 'meetily' }, { e: { DB: { prepare() { throw new Error('D1 is down'); } }, VOTE_SECRET: SECRET } })).status, 500);
});

test('the Pages Function takes POST and answers other methods with 405', async () => {
  const fn = await import('../functions/api/click.js');
  const post = await fn.onRequestPost({ env, request: new Request('https://openorbia.com/api/click', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://openorbia.com', 'cf-connecting-ip': ip() }, body: JSON.stringify({ slug: 'ollama' }) }) });
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
