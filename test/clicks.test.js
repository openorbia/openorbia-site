import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { goResponse, recordClick, destination } from '../lib/go.js';
import { MIGRATIONS } from '../lib/migrations.js';
import { TOOLS, ROWS, slugOf, toolBySlug } from '../public/assets/tools.js';
import { renderTool } from '../lib/tool-pages.js';
import { createDb } from './helpers/d1.js';

const root = new URL('../', import.meta.url);
const file = f => readFileSync(new URL(f, root), 'utf8');
const NOV23_EVENING = Date.UTC(2026, 10, 24, 7, 30);   // 11:30 PM Pacific on Nov 23
const NOV24_MORNING = Date.UTC(2026, 10, 24, 8, 30);   // 12:30 AM Pacific on Nov 24 (the Pacific day changed, the UTC day did not)

let db, env;
const SECRET = 'test-secret-0123456789abcdef';
beforeEach(() => { db = createDb(); env = { DB: db, VOTE_SECRET: SECRET }; });
const rows = () => db.rows('SELECT slug, day, count FROM clicks ORDER BY slug, day').map(r => ({ ...r }));
const go = (slug, { method = 'GET', now = NOV23_EVENING, headers = {}, e = env } = {}) =>
  goResponse({ request: new Request(`https://openorbia.com/go/${slug}`, { method, headers }), env: e, params: { slug }, now });

// ---- counting ----

test('/go/<slug> adds one to the tool\'s count for the day and answers 302 to its repo', async () => {
  const res = await go('ai-job-search');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://github.com/ai-job-search-dev/ai-job-search');
  assert.deepEqual(rows(), [{ slug: 'ai-job-search', day: '2026-11-23', count: 1 }]);
  await go('ai-job-search'); await go('ai-job-search');
  assert.deepEqual(rows(), [{ slug: 'ai-job-search', day: '2026-11-23', count: 3 }], 'an upsert: one row, count up');
});

test('one row per tool per Pacific day', async () => {
  await go('meetily'); await go('meetily'); await go('ollama');
  await go('meetily', { now: NOV24_MORNING });                                     // after Pacific midnight: a new day
  assert.deepEqual(rows(), [
    { slug: 'meetily', day: '2026-11-23', count: 2 }, { slug: 'meetily', day: '2026-11-24', count: 1 },
    { slug: 'ollama', day: '2026-11-23', count: 1 },
  ]);
});

test('every tool has a /go/ target: its repo', async () => {
  for (const [i, t] of TOOLS.entries()) {
    const res = await go(t.slug, { headers: { 'cf-connecting-ip': `198.51.100.${i + 1}` } });   // a different visitor each time: one visitor is limited to 30 a minute
    assert.equal(res.status, 302, t.slug);
    assert.equal(res.headers.get('location'), `https://github.com/${t.repo}`, t.slug);
    assert.equal(destination(t), t.github);
  }
  assert.equal(rows().length, TOOLS.length);
  assert.ok(rows().every(r => r.count === 1));
  assert.equal(destination({ website: 'https://example.com', github: 'https://github.com/x/y' }), 'https://example.com', 'a website wins once there is one');
});

// ---- privacy ----

test('no IP, user agent, referrer or cookie: the table holds a slug, a day and a count, and the response sets no cookie', async () => {
  const res = await go('vigil', { headers: {
    'cf-connecting-ip': '203.0.113.77', 'user-agent': 'Mozilla/5.0 SecretBrowser/1.0', referer: 'https://elsewhere.example/page', cookie: 'sid=abc123', 'accept-language': 'xx-YY',
  } });
  assert.equal(res.headers.get('set-cookie'), null);
  assert.ok(![...res.headers.keys()].some(k => /cookie|vary/i.test(k)));
  assert.deepEqual(db.rows("SELECT name FROM pragma_table_info('clicks') ORDER BY cid").map(r => r.name), ['slug', 'day', 'count']);
  const stored = JSON.stringify(db.rows('SELECT * FROM clicks'));
  for (const secret of ['203.0.113.77', 'SecretBrowser', 'elsewhere.example', 'abc123', 'xx-YY']) assert.ok(!stored.includes(secret), secret);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(res.headers.get('x-robots-tag'), /noindex/);
});

// ---- what is not counted ----

test('an unknown or malformed slug is a 404 and counts nothing', async () => {
  for (const slug of ['nope', 'MEETILY', '../etc/passwd', 'meetily/../ollama', 'a'.repeat(100), '', 'meetily%00', "x'; DROP TABLE clicks;--", 'sample-business-tool']) {
    const res = await go(slug);
    assert.equal(res.status, 404, JSON.stringify(slug));
    assert.equal(res.headers.get('location'), null);
    assert.match(await res.text(), /noindex/);
  }
  assert.deepEqual(rows(), []);
  assert.equal(db.rows("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'clicks'")[0].n, 1, 'the table is still there');
});

test('HEAD requests (link checkers, previews) are sent on without being counted', async () => {
  const res = await go('meetily', { method: 'HEAD' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://github.com/Zackriya-Solutions/meetily');
  assert.deepEqual(rows(), []);
});

test('counting never gets in the way of the link: no database, or a failing one, still redirects', async () => {
  const failing = { prepare() { throw new Error('D1 is down'); } };
  const failingWrite = { prepare: sql => (/rate_limits/.test(sql) ? db.prepare(sql) : { bind: () => ({ run: async () => { throw new Error('write failed'); } }) }) };
  for (const e of [{}, { DB: db }, { DB: failing, VOTE_SECRET: SECRET }, { DB: failingWrite, VOTE_SECRET: SECRET }]) {
    const res = await go('meetily', { e });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), 'https://github.com/Zackriya-Solutions/meetily');
  }
});

test('the Pages Function exports GET and HEAD', async () => {
  const fn = await import('../functions/go/[slug].js');
  env.VOTE_SECRET = SECRET;
  const res = await fn.onRequestGet({ request: new Request('https://openorbia.com/go/ollama'), env, params: { slug: 'ollama' } });
  assert.equal(res.status, 302);
  assert.equal(rows().length, 1);
  const head = await fn.onRequestHead({ request: new Request('https://openorbia.com/go/ollama', { method: 'HEAD' }), env, params: { slug: 'ollama' } });
  assert.equal(head.status, 302);
  assert.equal(rows()[0].count, 1, 'HEAD did not count');
});

// ---- the table and its migration ----

test('schema.sql creates clicks, and the migration adds it to a database that has not got it yet, once', () => {
  const schema = file('schema.sql');
  assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS clicks ('));
  const migration = MIGRATIONS.find(m => m.name.startsWith('clicks'));
  assert.ok(migration, 'a clicks migration exists');
  assert.equal(new Set(MIGRATIONS.map(m => m.name)).size, MIGRATIONS.length, 'migration names are unique');

  // a database from before this change: the schema without the clicks table
  const start = schema.indexOf('-- How many times each tool');
  assert.ok(start > 0);
  const old = new DatabaseSync(':memory:');
  old.exec(schema.slice(0, start));
  assert.equal(old.prepare(migration.applied).get().n, 0, 'not applied yet');
  old.exec(migration.sql);
  assert.equal(old.prepare(migration.applied).get().n, 1, 'applied');
  assert.deepEqual(old.prepare("SELECT name FROM pragma_table_info('clicks') ORDER BY cid").all().map(r => r.name), ['slug', 'day', 'count']);
  // the upsert works on the migrated table, and the primary key is (slug, day)
  const up = 'INSERT INTO clicks (slug, day, count) VALUES (?, ?, 1) ON CONFLICT(slug, day) DO UPDATE SET count = count + 1';
  old.prepare(up).run('a', '2026-11-23'); old.prepare(up).run('a', '2026-11-23'); old.prepare(up).run('a', '2026-11-24');
  assert.deepEqual(old.prepare('SELECT slug, day, count FROM clicks ORDER BY day').all().map(r => ({ ...r })), [{ slug: 'a', day: '2026-11-23', count: 2 }, { slug: 'a', day: '2026-11-24', count: 1 }]);
  assert.throws(() => old.exec(migration.sql), /already exists/, 'running the raw SQL twice would fail, which is why the migration checks first');
  assert.equal(old.prepare(migration.applied).get().n, 1, 'so the check says applied and scripts/migrate.mjs skips it');
});

test('recordClick is a plain upsert that can be used on its own', async () => {
  await recordClick(db, 'ollama', NOV23_EVENING); await recordClick(db, 'ollama', NOV23_EVENING);
  assert.deepEqual(rows(), [{ slug: 'ollama', day: '2026-11-23', count: 2 }]);
});

// ---- /go/ is for email and newsletters ----

test('/go/<slug> stays as the counted link for email and newsletters; the pages themselves link straight to the tool', () => {
  const html = file('public/launch-list/index.html');
  assert.ok(html.includes('<a href="https://github.com/${repo}" data-tool="${slugOf(name)}" target="_blank" rel="noopener">View on GitHub ↗</a>'), 'the card link is the real address');
  assert.ok(!html.includes('href="/go/'), 'no /go/ links on the Launch List');
  for (const row of ROWS) assert.ok(toolBySlug(slugOf(row[0])), `${row[0]} has a /go/ target for email`);
  for (const t of TOOLS) assert.ok(!renderTool(t).includes('/go/'), `${t.name}: no /go/ on the tool page`);
  assert.ok(file('public/robots.txt').includes('Disallow: /go/'), 'crawlers are asked to stay out of /go/');
});
