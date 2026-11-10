// The launch preflight, npm run launch:check (lib/launch-check.js, scripts/launch-check.mjs), with the good and bad fixtures in
// test/fixtures/launch-check/ (their images are real PNGs in public/launches/<slug>/ next to them).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkLaunches, formatReport, imageSize, COLUMNS } from '../lib/launch-check.js';
import { launchOpensAt } from '../lib/time.js';
import { FIRST_LAUNCH_WEEK, MAKERS_CONFIRMED } from '../lib/site.js';
import { TOOLS } from '../public/assets/tools.js';

const FIX = new URL('./fixtures/launch-check/', import.meta.url);
const json = name => JSON.parse(readFileSync(new URL(name, FIX), 'utf8'));
const fromFixtures = p => { try { return new Uint8Array(readFileSync(new URL(p, FIX))); } catch { return null; } };
const LOGO = fromFixtures('public/launches/good-tool/logo.png'), SHOT = fromFixtures('public/launches/good-tool/shot-1.png');
// every image exists and is good, so each bad entry fails only for its own reason
const goodImages = p => (/logo\./.test(p) ? LOGO : SHOT);
const BEFORE = launchOpensAt(FIRST_LAUNCH_WEEK.date) - 7 * 24 * 3600 * 1000;
const AFTER = launchOpensAt(FIRST_LAUNCH_WEEK.date) + 3600 * 1000;
const run = (data, opts = {}) => checkLaunches(data, { now: BEFORE, readFile: fromFixtures, tools: TOOLS, ...opts });
const row = (res, slug) => res.rows.find(r => r.slug === slug);
const msgs = r => r.problems.map(p => `[${p.col}] ${p.msg}`).join('\n');

test('the fixtures are dated for Launch Week 1 in lib/site.js', () => {
  for (const f of ['good.json', 'bad.json']) for (const l of json(f).launches.filter(x => x.slug !== 'not-monday' && x.slug !== 'wrong-week'))
    assert.equal(l.launch_date, FIRST_LAUNCH_WEEK.date, `${f}: ${l.slug}`);
});

test('the good fixture passes: every column PASS for a complete launch, the noted duplicate is only a warning, the sample is flagged', () => {
  const res = run(json('good.json'));
  assert.equal(res.ok, true, formatReport(res));
  assert.deepEqual(row(res, 'good-tool').cols, Object.fromEntries(COLUMNS.map(c => [c, 'PASS'])));
  assert.equal(row(res, 'good-tool').status, 'PASS');
  assert.equal(row(res, 'listed-with-note').cols.listing, 'WARN');
  assert.equal(row(res, 'listed-with-note').status, 'PASS');
  assert.equal(row(res, 'sample-thing').status, 'SAMPLE');
  assert.equal(res.real, 2, 'samples never count as real launches');
});

test('the bad fixture fails, and each entry fails for its own reason', () => {
  const res = run(json('bad.json'), { readFile: goodImages });
  assert.equal(res.ok, false);
  const expect = {
    'long-tagline': ['fields', '"tagline" is 72 characters; keep it to 60'],
    'http-link': ['links', '"website_url" must be an https:// link'],
    'too-many-shots': ['images', '6 screenshots; give 3 to 5'],
    'remote-logo': ['images', 'logo_url must be a file in public/launches/remote-logo/'],
    'not-monday': ['date', '2026-11-24 is not a Monday'],
    'wrong-week': ['date', '"launch_week" is 2; Launch Week 1 is the one being prepared'],
    'placeholder-facts': ['facts', '"freeTier" looks like a placeholder ("TBD")'],
    'tested-no-date': ['facts', '"testedBy" is set, but "testedOn" is missing'],
    'aisoc-again': ['listing', 'same tool as "AiSOC" on the Launch List (/tool/aisoc/); add a "duplicateNote"'],
    'missing-fields': ['fields', '"maker_name" is required'],
  };
  for (const [slug, [col, text]] of Object.entries(expect)) {
    const r = row(res, slug);
    assert.equal(r.status, 'FAIL', slug);
    assert.equal(r.cols[col], 'FAIL', `${slug}: ${col}`);
    assert.ok(msgs(r).includes(text), `${slug}:\n${msgs(r)}`);
    const others = COLUMNS.filter(c => c !== col && r.cols[c] === 'FAIL');
    assert.deepEqual(others, [], `${slug} fails only on ${col}`);
  }
  const pf = msgs(row(res, 'placeholder-facts'));
  assert.ok(pf.includes('"cardRequired" is "unknown"; leave it out') && pf.includes('free facts need a "lastChecked" date'));
  assert.ok(msgs(row(res, 'missing-fields')).includes('"description" is required'));
});

test('images: real files in the launch folder, a square logo, wide enough screenshots, and every file present', () => {
  const r = row(run(json('bad.json')), 'bad-images');
  const m = msgs(r);
  assert.ok(m.includes('logo is 600×300; it must be square'));
  assert.ok(m.includes('screenshots[0] is 320 pixels wide; expected 640 to 4000'));
  assert.ok(m.includes('screenshots[2]: public/launches/bad-images/shot-3.png does not exist'));
  assert.ok(!m.includes('screenshots[1]'), 'the good screenshot passes');
  // sizes in bytes
  const tiny = run({ launches: [json('good.json').launches[0]] }, { readFile: p => (/logo/.test(p) ? new Uint8Array(50) : SHOT) });
  assert.ok(msgs(tiny.rows[0]).includes('logo_url: public/launches/good-tool/logo.png is 0 KB; expected 100 bytes'));
  const huge = run({ launches: [json('good.json').launches[0]] }, { readFile: p => (/shot-1/.test(p) ? new Uint8Array(4 * 1024 * 1024) : /logo/.test(p) ? LOGO : SHOT) });
  assert.ok(msgs(huge.rows[0]).includes('screenshots[0]: public/launches/good-tool/shot-1.png is 4096 KB'));
  // the file reader is only ever asked for paths inside the launch's own folder
  const asked = [];
  run({ launches: [{ ...json('good.json').launches[0], logo_url: '/launches/good-tool/../../secret.png' }] }, { readFile: p => { asked.push(p); return null; } });
  assert.ok(asked.every(p => p.startsWith('public/launches/good-tool/') && !p.includes('..')), asked.join(', '));
});

test('imageSize reads PNG, GIF, JPEG and WebP headers, and gives null for SVG', () => {
  assert.deepEqual(imageSize(LOGO), { type: 'png', width: 512, height: 512 });
  assert.deepEqual(imageSize(SHOT), { type: 'png', width: 1280, height: 800 });
  const gif = new Uint8Array(32); gif.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x03, 0x58, 0x02]);
  assert.deepEqual(imageSize(gif), { type: 'gif', width: 800, height: 600 });
  const jpg = new Uint8Array(40); jpg.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20]);
  assert.deepEqual(imageSize(jpg), { type: 'jpeg', width: 800, height: 600 });
  const webp = new Uint8Array(32); webp.set([...'RIFF'].map(c => c.charCodeAt(0)), 0); webp.set([...'WEBPVP8X'].map(c => c.charCodeAt(0)), 8); webp.set([0x1f, 0x03, 0x00, 0x57, 0x02, 0x00], 24);
  assert.deepEqual(imageSize(webp), { type: 'webp', width: 800, height: 600 });
  assert.equal(imageSize(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')), null);
});

test('dates: a launch day that has started fails before seeding, and is only a warning in CI', () => {
  const good = { launches: [json('good.json').launches[0]] };
  const local = run(good, { now: AFTER });
  assert.equal(local.ok, false);
  assert.ok(msgs(local.rows[0]).includes(`${FIRST_LAUNCH_WEEK.date} has already started`));
  const ci = run(good, { now: AFTER, ci: true });
  assert.equal(ci.ok, true);
  assert.equal(ci.rows[0].cols.date, 'WARN');
});

test('testedBy needs a hand-set testedOn date that is not in the future', () => {
  const base = json('good.json').launches[0];
  assert.equal(run({ launches: [{ ...base, testedBy: 'OpenOrbia', testedOn: '2026-11-02' }] }).rows[0].cols.facts, 'PASS');
  assert.ok(msgs(run({ launches: [{ ...base, testedBy: 'OpenOrbia', testedOn: '2027-01-02' }] }).rows[0]).includes('"testedOn" is in the future'));
  assert.equal(run({ launches: [{ ...base, testedBy: 'Me' }] }).rows[0].cols.facts, 'FAIL');
});

test('samples are flagged and listed but never fail the run; the real count is compared with MAKERS_CONFIRMED', () => {
  const res = run(json('good.json'));
  const report = formatReport(res);
  assert.ok(report.includes('sample-thing (sample: placeholder, never seeded to the live site; does not fail the check):'));
  assert.ok(report.includes(`Real launches: 2 of ${MAKERS_CONFIRMED} confirmed makers (MAKERS_CONFIRMED, lib/site.js): WARN (${MAKERS_CONFIRMED - 2} still to come)`));
  assert.ok(report.includes('Sample entries: 1 (flagged; delete them when the real launches are in)'));
  assert.ok(report.endsWith('Launch check: PASS'));
  const exact = checkLaunches(json('good.json'), { now: BEFORE, readFile: fromFixtures, tools: TOOLS, makersConfirmed: 2 });
  assert.equal(exact.countStatus, 'PASS');
});

test('the report is a table: one row per launch with every column, then the result', () => {
  const lines = formatReport(run(json('bad.json'))).split('\n');
  assert.match(lines[0], /^launch\s+fields\s+links\s+images\s+date\s+facts\s+listing\s+result$/);
  assert.equal(lines.filter(l => /\s(PASS|FAIL|SAMPLE)$/.test(l) && !l.startsWith('Launch check')).length, json('bad.json').launches.length);
  assert.equal(lines.at(-1), 'Launch check: FAIL');
});

// ---- the command ----

const cli = (...args) => spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/launch-check.mjs', import.meta.url)), ...args], { encoding: 'utf8' });

test('npm run launch:check: exit 0 for the good fixture (--ci), 1 for the bad one, and it changes no file', () => {
  const root = fileURLToPath(FIX);
  const before = readFileSync(new URL('bad.json', FIX), 'utf8');
  const good = cli('--file', fileURLToPath(new URL('good.json', FIX)), '--root', root, '--ci');
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.ok(good.stdout.includes('Launch check: PASS'));
  const bad = cli('--file', fileURLToPath(new URL('bad.json', FIX)), '--root', root, '--ci');
  assert.equal(bad.status, 1);
  assert.ok(bad.stdout.includes('Launch check: FAIL'));
  assert.equal(readFileSync(new URL('bad.json', FIX), 'utf8'), before);
});

test('the real data/launches.json passes in CI mode, and CI runs the check', () => {
  const r = cli('--ci');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['launch:check'], 'node scripts/launch-check.mjs');
  assert.ok(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8').includes('run: npm run launch:check -- --ci'));
});
