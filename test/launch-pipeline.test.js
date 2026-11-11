// Launch Week 1 pipeline: a maker's email or /submit/ row becomes a draft entry, the preflight wants real images with alt text,
// samples never reach the live database, and the lineup shows exactly the launches that are seeded, however few.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseEmail, draftEntry, fromSubmission, withDraft, weekDate, makerLinks, slugFor } from '../lib/launch-draft.js';
import { validateLaunches, forTarget, PRODUCTION_DB } from '../lib/launch-data.js';
import { checkLaunches } from '../lib/launch-check.js';
import { leaderboardResponse, launchesApiResponse } from '../lib/pages.js';
import { launchOpensAt } from '../lib/time.js';
import { createDb, addLaunch } from './helpers/d1.js';

const root = new URL('../', import.meta.url);
const EMAIL = `Hi Khaja, we're in for Nov 23!

Tool: Mock Scanner
Tagline: Finds prompt injection in your AI app before users do
Description: Mock Scanner tests your chatbot for prompt injection and data leaks.
It runs on your laptop with a local model.
Website: https://mockscanner.example.com
Source code: https://github.com/example/mock-scanner
Your name: Mia Maker
Handles: https://x.com/miamaker, https://github.com/miamaker @mia
Category: Security teams
License: MIT
Maker story: I built it after a client's bot leaked its prompt.

Thanks, Mia
mia@example.com
`;

// ---- drafting ----

test('a maker email in the checklist layout becomes a draft entry for Launch Week 1, without the maker\'s email address', () => {
  const { entry, todo } = draftEntry(parseEmail(EMAIL));
  assert.equal(entry.slug, 'mock-scanner');
  assert.equal(entry.name, 'Mock Scanner');
  assert.equal(entry.tagline, 'Finds prompt injection in your AI app before users do');
  assert.equal(entry.description, 'Mock Scanner tests your chatbot for prompt injection and data leaks.\nIt runs on your laptop with a local model.');
  assert.equal(entry.category, 'sec');
  assert.equal(entry.repo_url, 'https://github.com/example/mock-scanner');
  assert.equal(entry.website_url, 'https://mockscanner.example.com/');
  assert.equal(entry.maker_name, 'Mia Maker');
  assert.deepEqual(entry.maker_links, [{ label: 'X', url: 'https://x.com/miamaker' }, { label: 'GitHub', url: 'https://github.com/miamaker' }]);
  assert.equal(entry.maker_story, 'I built it after a client\'s bot leaked its prompt.');
  assert.equal(entry.launch_week, 1);
  assert.equal(entry.launch_date, '2026-11-23');
  assert.ok(!JSON.stringify(entry).includes('@example.com'), 'no email address in the draft');
  assert.ok(!('sample' in entry));
  assert.ok(todo.some(t => t.startsWith('maker_links:') && t.includes('@mia')), 'bare handles are left for review');
  assert.ok(todo.some(t => t.startsWith('logo:')) && todo.some(t => t.startsWith('screenshots:')));
  assert.deepEqual(validateLaunches({ launches: [entry] }).errors, [], 'the draft is valid JSON for data/launches.json');
});

test('a /submit/ row becomes a draft: the email column is dropped, facts stay unchecked, and a github.com link is the source', () => {
  const row = { id: 7, tool_name: 'Sub Tool', url: 'https://github.com/example/sub-tool', maker_name: 'Sam', email: 'sam@private.example',
    category: 'job', license: 'Apache-2.0', free_tier: 'Free and open source', card_required: 'no', setup: 'selfhost', paid_level: 'none', paid_deps: '', assets_link: '' };
  const fields = fromSubmission(row);
  assert.ok(!Object.values(fields).includes(row.email));
  const { entry, todo } = draftEntry(fields, { week: 2 });
  assert.equal(entry.repo_url, 'https://github.com/example/sub-tool');
  assert.equal(entry.website_url, null);
  assert.equal(entry.freeTier, 'Free and open source');
  assert.equal(entry.cardRequired, 'no');
  assert.equal(entry.setup, 'Install & self-host');
  assert.ok(!('lastChecked' in entry), 'facts get a lastChecked only once they are checked against the docs');
  assert.ok(todo.some(t => t.startsWith('facts: confirm them')));
  assert.equal(entry.launch_week, 2);
  assert.equal(entry.launch_date, '2026-11-30');
  assert.ok(!JSON.stringify(entry).includes('sam@private.example'));
  // "unknown" card answers are left out, as the preflight wants
  assert.ok(!('cardRequired' in draftEntry(fromSubmission({ ...row, card_required: 'unknown' })).entry));
});

test('images found in the launch folder are used: logo.* as the logo, the rest as screenshots with alt to write', () => {
  const { entry, todo } = draftEntry({ name: 'Pics Tool' }, { files: ['shot-2.png', 'logo.png', 'shot-1.png', 'notes.txt', 'shot-3.webp'] });
  assert.equal(entry.logo_url, '/launches/pics-tool/logo.png');
  assert.deepEqual(entry.screenshots.map(s => s.src), ['/launches/pics-tool/shot-1.png', '/launches/pics-tool/shot-2.png', '/launches/pics-tool/shot-3.webp']);
  assert.ok(entry.screenshots.every(s => s.alt === ''));
  assert.ok(todo.includes('screenshots: write each "alt" (what the screenshot shows)'));
});

test('helpers: week dates, slugs, maker links and adding a draft', () => {
  assert.deepEqual([1, 2, 3].map(w => weekDate(w)), ['2026-11-23', '2026-11-30', '2026-12-07']);
  assert.equal(slugFor('Résumé Pro 2!'), 'resume-pro-2');
  assert.deepEqual(makerLinks('https://bsky.app/profile/x, ftp://no @bare').links, [{ label: 'Bluesky', url: 'https://bsky.app/profile/x' }]);
  const data = { _readme: ['x'], launches: [{ slug: 'a' }, { slug: 'b', tagline: 'old' }] };
  assert.deepEqual(withDraft(data, { slug: 'b', tagline: 'new' }).launches, [{ slug: 'a' }, { slug: 'b', tagline: 'new' }]);
  assert.deepEqual(withDraft(data, { slug: 'b' })._readme, ['x']);
});

test('the draft CLI writes drafts outside data/, and --add refuses a sample or an invalid draft', () => {
  const dir = mkdtempSync(join(tmpdir(), 'draft-'));
  try {
    const before = readFileSync(new URL('data/launches.json', root), 'utf8');
    writeFileSync(join(dir, 'email.txt'), EMAIL);
    const run = args => spawnSync(process.execPath, ['scripts/draft-launch.mjs', ...args], { cwd: root, encoding: 'utf8' });
    const r = run(['--email', join(dir, 'email.txt'), '--slug', 'zz-test-draft']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Draft written to \.ops-cache[\\/]launch-drafts[\\/]zz-test-draft\.json/);
    assert.ok(!r.stdout.includes('@example.com'));
    writeFileSync(join(dir, 'sample.json'), JSON.stringify({ slug: 'x', sample: true }));
    assert.equal(run(['--add', join(dir, 'sample.json')]).status, 2);
    writeFileSync(join(dir, 'bad.json'), JSON.stringify({ slug: 'bad-one', name: 'Bad' }));
    const bad = run(['--add', join(dir, 'bad.json')]);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /Not added: the draft is not valid yet/);
    assert.equal(readFileSync(new URL('data/launches.json', root), 'utf8'), before, 'data/launches.json untouched');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(new URL('.ops-cache/launch-drafts/zz-test-draft.json', root), { force: true });
  }
});

// ---- the preflight's image checks ----

// A PNG header of the given size, padded to `bytes`
const png = (w, h, bytes = 4096) => {
  const b = new Uint8Array(bytes);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h);
  return b;
};
const jpeg = () => { const b = new Uint8Array(4096); b.set([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 2, 0x58, 3, 0x20]); return b; };
const real = (over = {}) => ({
  slug: 'img-tool', name: 'Img Tool', tagline: 'Checks images', description: 'A tool.', category: 'sec', repo_url: 'https://github.com/example/img-tool',
  maker_name: 'Ivy', license: 'MIT', launch_week: 1, launch_date: '2026-11-23', logo_url: '/launches/img-tool/logo.png',
  screenshots: [1, 2, 3].map(n => ({ src: `/launches/img-tool/shot-${n}.png`, alt: `The scan report, page ${n}` })), ...over,
});
const files = { 'public/launches/img-tool/logo.png': png(512, 512, 2048), 'public/launches/img-tool/shot-1.png': png(1280, 800),
  'public/launches/img-tool/shot-2.png': png(1280, 800), 'public/launches/img-tool/shot-3.png': png(1280, 800), 'public/launches/img-tool/shot-4.jpg': jpeg() };
const imagesOf = entry => {
  const row = checkLaunches({ launches: [entry] }, { now: launchOpensAt('2026-11-16'), readFile: p => files[p] || null }).rows[0];
  return { col: row.cols.images, msgs: row.problems.filter(p => p.col === 'images').map(p => p.msg) };
};

test('screenshots need alt text that says what they show; a file must be the format its name says', () => {
  assert.equal(imagesOf(real()).col, 'PASS');
  const missing = imagesOf(real({ screenshots: [{ src: '/launches/img-tool/shot-1.png' }, ...real().screenshots.slice(1)] }));
  assert.equal(missing.col, 'FAIL');
  assert.ok(missing.msgs.includes('screenshots[0] needs "alt" text saying what it shows'));
  const generic = imagesOf(real({ screenshots: real().screenshots.map((s, i) => (i === 1 ? { ...s, alt: 'Screenshot 2' } : s)) }));
  assert.ok(generic.msgs.some(m => m.startsWith('screenshots[1]: "alt" should say what the screenshot shows')));
  // a JPEG saved as .jpg passes the format check (its pixel width is 800 here, so only the format matters)
  const renamed = { ...files, 'public/launches/img-tool/shot-3.png': jpeg() };
  const row = checkLaunches({ launches: [real()] }, { now: launchOpensAt('2026-11-16'), readFile: p => renamed[p] || null }).rows[0];
  assert.ok(row.problems.some(p => p.msg.includes('shot-3.png is really a JPEG file; give it a .jpg name')));
});

// ---- samples ----

test('the live database never gets a sample, whatever the options say', () => {
  const { launches } = validateLaunches({ launches: [real(), { ...real({ slug: 'sam-ple' }), screenshots: [], logo_url: null, sample: true }] });
  assert.equal(PRODUCTION_DB, 'openorbia-db');
  assert.deepEqual(forTarget(launches, { remote: true, includeSamples: true, db: PRODUCTION_DB }).map(l => l.slug), ['img-tool']);
  assert.deepEqual(forTarget(launches, { remote: true, includeSamples: true, db: 'openorbia-db-preview' }).map(l => l.slug), ['img-tool', 'sam-ple']);
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')).scripts;
  assert.ok(!pkg['seed:remote'].includes('--include-samples'));
  assert.ok(pkg['seed:preview'].includes('--include-samples') && pkg['seed:preview'].includes('openorbia-db-preview'));
  assert.ok(pkg['seed:local'].includes('--include-samples'));
  assert.equal(pkg['launch:draft'], 'node scripts/draft-launch.mjs');
});

// ---- the lineup ----

const BEFORE = launchOpensAt('2026-11-23') - 5 * 24 * 3600 * 1000; // Wednesday Nov 18, the lineup announcement
for (const n of [1, 2]) {
  test(`with only ${n} real launch${n === 1 ? '' : 'es'} seeded, the lineup shows exactly ${n === 1 ? 'it' : 'them'}, with no padding`, async () => {
    const db = createDb();
    const env = { DB: db, VOTE_SECRET: 'test-secret-0123456789abcdef' };
    const names = ['Only Tool', 'Second Tool'].slice(0, n);
    names.forEach((name, i) => addLaunch(db, { slug: slugFor(name), name, tagline: `What ${name} does`, category: ['sec', 'job'][i], launch_date: '2026-11-23' }));
    const html = await (await leaderboardResponse({ request: new Request('https://openorbia.com/launches/'), env, now: BEFORE })).text();
    const list = (html.match(/<ol class="lboard"[\s\S]*?<\/ol>/) || [''])[0];
    const items = [...list.matchAll(/<li\b/g)].length;
    assert.equal(items, n, 'one row per seeded launch');
    for (const name of names) assert.ok(list.includes(name), name);
    assert.ok(!/sample/i.test(list), 'nothing made up');
    assert.match(html, new RegExp(`${n} free AI tool${n === 1 ? ' launches' : 's launch'} on Monday, Nov 23, 2026`));
    const api = await (await launchesApiResponse({ request: new Request('https://openorbia.com/api/launches'), env, now: BEFORE })).json();
    assert.equal(api.total, n);
  });
}

// ---- the README checklist ----

test('the README has the Launch Week checklist, in order', () => {
  const readme = readFileSync(new URL('README.md', root), 'utf8');
  const steps = ['Assets received', 'Entry drafted', 'Facts confirmed with the maker', 'Seeded on preview', 'Founder approves', 'Seeded live'];
  const at = steps.map(s => readme.indexOf(s));
  assert.ok(at.every(i => i > 0), `missing: ${steps.filter((s, i) => at[i] < 0).join(', ')}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in this order');
});
