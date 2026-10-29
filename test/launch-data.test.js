import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { validateLaunches, toSql, sqlStr, forTarget, assetUrl, httpsUrl } from '../lib/launch-data.js';
import { createDb } from './helpers/d1.js';

const root = new URL('../', import.meta.url);
const good = (over = {}) => ({
  slug: 'my-tool', name: 'My Tool', tagline: 'Does a thing', description: 'It does the thing.', category: 'job',
  repo_url: 'https://github.com/example/my-tool', maker_name: 'Maker', license: 'MIT', launch_week: 1, launch_date: '2026-11-23', ...over,
});
const check = (...launches) => validateLaunches({ launches });
const problems = over => check(good(over)).errors;

// ---- the shipped data/launches.json ----

test('data/launches.json is valid, its images exist, and it only holds clearly marked samples for now', () => {
  const data = JSON.parse(readFileSync(new URL('data/launches.json', root), 'utf8'));
  const { launches, errors } = validateLaunches(data);
  assert.deepEqual(errors, []);
  assert.ok(launches.length >= 1);
  // real entries keep their images in public/ (deployed); sample entries keep them in test/fixtures/ (never deployed)
  for (const l of launches) {
    const files = [l.logo_url, l.video_url, ...l.screenshots.map(s => s.src)].filter(p => p && p.startsWith('/'));
    assert.ok(files.length >= 1, `${l.slug} has no local images`);
    for (const f of files) assert.ok(existsSync(new URL(`${l.sample ? 'test/fixtures' : 'public'}${f}`, root)), `${l.slug}: missing ${f}`);
  }
  assert.ok(launches.every(l => l.sample), 'every shipped entry is a sample until the real launches are added');
});

test('sample entries never go to the live database unless asked', () => {
  const { launches } = check(good({ slug: 'real-one' }), good({ slug: 'sample-one', sample: true }));
  assert.deepEqual(forTarget(launches, { remote: true }).map(l => l.slug), ['real-one']);
  assert.deepEqual(forTarget(launches, { remote: true, includeSamples: true }).map(l => l.slug), ['real-one', 'sample-one']);
  assert.deepEqual(forTarget(launches, { remote: false }).map(l => l.slug), ['real-one', 'sample-one']);
  assert.deepEqual(forTarget(launches).map(l => l.slug), ['real-one', 'sample-one']);
});

// ---- validation ----

test('a good entry is accepted and normalised', () => {
  const { launches, errors } = check(good({
    name: '  My Tool  ', screenshots: ['/launches/my-tool/a.png', { src: 'https://example.com/b.png', alt: 'B' }],
    maker_links: [{ label: 'Site', url: 'https://example.com' }], logo_url: '/launches/my-tool/logo.svg',
  }));
  assert.deepEqual(errors, []);
  const [l] = launches;
  assert.equal(l.name, 'My Tool');
  assert.equal(l.sample, false);
  assert.deepEqual(l.screenshots, [{ src: '/launches/my-tool/a.png', alt: 'My Tool screenshot 1' }, { src: 'https://example.com/b.png', alt: 'B' }]);
  assert.equal(l.website_url, null);
  assert.equal(l.maker_story, '');
});

test('only a literal true marks a sample', () => {
  for (const v of ['true', 1, 'yes', null]) assert.equal(check(good({ sample: v })).launches[0].sample, false);
  assert.equal(check(good({ sample: true })).launches[0].sample, true);
});

test('bad slugs are rejected', () => {
  for (const slug of ['', 'Has Space', 'UPPER', 'a_b', 'a--b', '-a', 'a-', '../x', 'a/b', 'x'.repeat(65), 'ü', undefined, 7]) {
    assert.ok(problems({ slug }).some(e => /slug/.test(e)), JSON.stringify(slug));
  }
  assert.ok(check(good(), good()).errors.some(e => /duplicate slug/.test(e)));
});

test('required fields, lengths and enums are enforced', () => {
  for (const key of ['name', 'tagline', 'description', 'maker_name', 'license']) assert.ok(problems({ [key]: '' }).some(e => e.includes(`"${key}" is required`)), key);
  assert.ok(problems({ tagline: 'x'.repeat(141) }).some(e => /tagline.*too long/.test(e)));
  assert.ok(problems({ name: 'x'.repeat(81) }).some(e => /name.*too long/.test(e)));
  assert.ok(problems({ maker_story: 'x'.repeat(4001) }).some(e => /maker_story.*too long/.test(e)));
  for (const category of ['', 'other', 'SEC', undefined, 1]) assert.ok(problems({ category }).some(e => /category/.test(e)), String(category));
  for (const launch_week of [0, -1, 1.5, '1', null]) assert.ok(problems({ launch_week }).some(e => /launch_week/.test(e)), String(launch_week));
  for (const launch_date of ['', 'soon', '2026-02-30', '2026-11-23T08:00:00Z', undefined]) assert.ok(problems({ launch_date }).some(e => /launch_date/.test(e)), String(launch_date));
});

test('links must be https, and a launch needs a website or a repo', () => {
  for (const repo_url of ['http://example.com/x', 'javascript:alert(1)', 'ftp://example.com', 'data:text/html,hi', '//example.com', 'example.com', 'https://localhost']) {
    assert.ok(problems({ repo_url }).some(e => /repo_url/.test(e)), repo_url);
  }
  assert.ok(problems({ repo_url: null, website_url: null }).some(e => /at least one/.test(e)));
  assert.deepEqual(problems({ repo_url: null, website_url: 'https://example.com' }), []);
});

test('images and videos must be in the launch\'s own folder, or https', () => {
  assert.equal(assetUrl('/launches/my-tool/shot-1.png', 'my-tool'), '/launches/my-tool/shot-1.png');
  assert.equal(assetUrl('https://example.com/a.png', 'my-tool'), 'https://example.com/a.png');
  for (const bad of ['/launches/other-tool/a.png', '/launches/my-tool/../other/a.png', '/launches/my-tool/', '/launches/my-tool/a/b.png', '/etc/passwd',
    'javascript:alert(1)', 'http://example.com/a.png', '/launches/my-tool/a b.png', '', null, undefined]) {
    assert.equal(assetUrl(bad, 'my-tool'), null, String(bad));
  }
  assert.ok(problems({ logo_url: '/launches/other-tool/logo.png' }).some(e => /logo_url/.test(e)));
  assert.ok(problems({ screenshots: ['/launches/my-tool/../x.png'] }).some(e => /screenshots\[0\]/.test(e)));
  assert.ok(problems({ video_url: 'javascript:alert(1)' }).some(e => /video_url/.test(e)));
  assert.ok(problems({ screenshots: Array.from({ length: 9 }, (_, i) => `/launches/my-tool/${i}.png`) }).some(e => /at most/.test(e)));
  assert.ok(problems({ screenshots: 'a.png' }).some(e => /screenshots/.test(e)));
  assert.equal(httpsUrl('https://a.example/x?y=1'), 'https://a.example/x?y=1');
});

test('maker links need a label and an https url', () => {
  assert.ok(problems({ maker_links: [{ label: 'X', url: 'http://x.example' }] }).some(e => /maker_links\[0\]/.test(e)));
  assert.ok(problems({ maker_links: [{ label: '', url: 'https://x.example' }] }).some(e => /maker_links\[0\]/.test(e)));
  assert.ok(problems({ maker_links: 'x' }).some(e => /maker_links/.test(e)));
});

test('the file must have a launches list', () => {
  for (const bad of [null, {}, { launches: 'x' }, []]) assert.equal(validateLaunches(bad).errors.length, 1);
  assert.deepEqual(validateLaunches({ launches: [] }).errors, []);
  assert.ok(check(null).errors.length > 0);
});

// ---- SQL ----

test('sqlStr quotes safely', () => {
  assert.equal(sqlStr(null), 'NULL');
  assert.equal(sqlStr(undefined), 'NULL');
  assert.equal(sqlStr("it's"), "'it''s'");
  assert.throws(() => sqlStr('a\0b'));
});

test('quotes and SQL in the data are stored as plain text', () => {
  const nasty = `Robert'); DROP TABLE votes;-- "quoted" \\ backslash\nnew line`;
  const { launches } = check(good({ name: nasty, tagline: "O'Brien's tool", maker_story: nasty }));
  const db = createDb();
  db.sql(toSql(launches));
  const [row] = db.rows('SELECT name, tagline, maker_story FROM launches');
  assert.equal(row.name, nasty.slice(0, 80));
  assert.equal(row.tagline, "O'Brien's tool");
  assert.equal(row.maker_story, nasty);
  assert.equal(db.rows("SELECT name FROM sqlite_master WHERE name = 'votes'").length, 1); // the table is still there
});

test('re-seeding updates in place and never touches votes', () => {
  const db = createDb();
  db.sql(toSql(check(good()).launches));
  db.sql("INSERT INTO votes (launch_slug, voter_hash) VALUES ('my-tool', 'abc')");
  db.sql(toSql(check(good({ name: 'My Tool Renamed', tagline: 'New tagline' })).launches));
  assert.equal(db.rows('SELECT COUNT(*) AS n FROM launches')[0].n, 1);
  assert.equal(db.rows('SELECT name FROM launches')[0].name, 'My Tool Renamed');
  assert.equal(db.rows('SELECT COUNT(*) AS n FROM votes')[0].n, 1);
});

test('--prune removes launches that left the file, with their votes, and keeps the rest', () => {
  const db = createDb();
  const both = check(good({ slug: 'keep-me' }), good({ slug: 'drop-me' })).launches;
  db.sql(toSql(both));
  db.sql("INSERT INTO votes (launch_slug, voter_hash) VALUES ('keep-me', 'a'), ('drop-me', 'b'), ('drop-me', 'c')");
  db.sql(toSql(both.slice(0, 1))); // without prune nothing is deleted
  assert.equal(db.rows('SELECT COUNT(*) AS n FROM launches')[0].n, 2);
  db.sql(toSql(both.slice(0, 1), { prune: true }));
  assert.deepEqual(db.rows('SELECT slug FROM launches').map(r => r.slug), ['keep-me']);
  assert.deepEqual(db.rows('SELECT launch_slug FROM votes').map(r => r.launch_slug), ['keep-me']);
});
