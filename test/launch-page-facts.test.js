// Launch pages: the Free facts block (never invented), the screenshot gallery, "Ask in Community"; the leaderboard and the homepage
// rank ties like the results page and show logo, category and a free-signal line; the preview checks three screen widths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { renderLaunch, renderLeaderboard, launchFactsBox, freeSignal, NOT_CONFIRMED_YET } from '../lib/pages.js';
import { tieRanks, rankByCategory } from '../lib/results.js';
import { validateLaunches } from '../lib/launch-data.js';
import { COMMUNITY } from '../lib/footer.js';
import { SCREENS } from '../scripts/check-width.mjs';

const root = new URL('../', import.meta.url);
const file = f => readFileSync(new URL(f, root), 'utf8');
const NOW = Date.UTC(2026, 10, 24, 12);   // launch week 1 is open
const launch = over => ({
  slug: 't', name: 'T', tagline: 'A tool', description: 'Does things.', category: 'biz', repo_url: 'https://github.com/x/t', website_url: null,
  logo_url: null, screenshots: [], video_url: null, maker_name: 'Maker', maker_links: [], maker_story: 'Hello.', license: 'MIT',
  launch_week: 1, launch_date: '2026-11-23', facts: {}, votes: 0, ...over,
});
const FULL = { freeTier: 'Free forever', cardRequired: 'no', setup: 'Desktop app', dataLocation: 'Runs on your computer', paidDeps: { level: 'optional', what: 'Your own AI key' }, catch: 'No sync.', lastChecked: '2026-11-06' };

// ---- 1. Free facts ----

test('Free facts: all six rows in order, the paid service from the facts, and "Facts checked <date>"', () => {
  const box = launchFactsBox(FULL);
  const rows = [...box.matchAll(/<dt>([^<]+)<\/dt><dd>([^<]+)<\/dd>/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(rows, [['Free tier', 'Free forever'], ['Card required', 'No'], ['Setup', 'Desktop app'], ['Your data', 'Runs on your computer'], ['Paid service', 'Optional: Your own AI key'], ['The catch', 'No sync.']]);
  assert.ok(box.includes('<p class="ff-checked">Facts checked Nov 6, 2026</p>'));
});

test('Free facts: unknown fields say "Not confirmed yet"; no facts at all say they are being checked; values are escaped', () => {
  const some = launchFactsBox({ freeTier: 'Free plan', cardRequired: 'unknown' });
  assert.ok(some.includes('<dt>Free tier</dt><dd>Free plan</dd>'));
  for (const l of ['Card required', 'Setup', 'Your data', 'Paid service', 'The catch']) assert.ok(some.includes(`<dt>${l}</dt><dd>${NOT_CONFIRMED_YET}</dd>`), l);
  assert.ok(!some.includes('ff-checked'), 'no date, no "Facts checked"');
  for (const none of [undefined, {}, { lastChecked: '2026-11-06' }, { testedBy: 'OpenOrbia' }]) {
    const box = launchFactsBox(none);
    assert.ok(box.includes('Free facts are being checked.') && !box.includes('<dl>'), JSON.stringify(none));
  }
  assert.ok(launchFactsBox({ catch: '<script>x</script>' }).includes('&lt;script&gt;'));
  assert.ok(renderLaunch({ launch: launch({ facts: FULL }), now: NOW }).includes('<dt>Paid service</dt><dd>Optional: Your own AI key</dd>'));
});

test('paidDeps is a valid launch fact (none, optional or required), checked like the Launch List', () => {
  const entry = facts => ({ launches: [{ slug: 'x-tool', name: 'X', tagline: 't', description: 'd', category: 'biz', repo_url: 'https://github.com/a/b', maker_name: 'M', license: 'MIT', launch_week: 1, launch_date: '2026-11-23', ...facts }] });
  for (const level of ['none', 'optional', 'required']) assert.deepEqual(validateLaunches(entry({ paidDeps: { level, what: 'x' } })).errors, [], level);
  assert.match(validateLaunches(entry({ paidDeps: { level: 'maybe' } })).errors.join('\n'), /paidDeps\.level/);
  assert.match(validateLaunches(entry({ paidDeps: { level: 'optional', what: 'x'.repeat(121) } })).errors.join('\n'), /too long/);
});

// ---- 5. the free-signal line ----

test('free signal: "Runs free · <setup>" without a required paid service, "Needs paid service" with one, nothing until checked', () => {
  assert.equal(freeSignal(FULL), 'Runs free · Desktop app');
  assert.equal(freeSignal({ ...FULL, paidDeps: { level: 'none' } }), 'Runs free · Desktop app');
  assert.equal(freeSignal({ ...FULL, setup: undefined }), 'Runs free');
  assert.equal(freeSignal({ ...FULL, paidDeps: { level: 'required', what: 'API key' } }), 'Needs paid service');
  assert.equal(freeSignal({ ...FULL, lastChecked: undefined }), '', 'not checked yet');
  assert.equal(freeSignal({ ...FULL, paidDeps: undefined }), '', 'paid service not known');
  assert.equal(freeSignal(undefined), '');
});

// ---- 2. screenshots ----

test('the gallery: images from the launch folder, lazy-loaded, with width and height, at most 5, named for screen readers', () => {
  const shots = Array.from({ length: 6 }, (_, i) => ({ src: `/launches/t/shot-${i + 1}.png`, alt: `Screen ${i + 1}` }));
  const html = renderLaunch({ launch: launch({ screenshots: [...shots, { src: 'https://evil.example/x.png', alt: 'x' }] }), now: NOW });
  const imgs = [...html.matchAll(/<img src="(\/launches\/t\/shot-\d\.png)" alt="([^"]+)" width="1280" height="800" loading="lazy" decoding="async">/g)];
  assert.equal(imgs.length, 5, 'at most 5');
  assert.ok(!html.includes('evil.example'));
  assert.ok(html.includes('<section class="shots" aria-labelledby="shots-h"><h2 id="shots-h" class="sr">Screenshots</h2>'));
  assert.ok(html.includes('<span class="sr"> (screenshot 1 of 5, opens full size in a new tab)</span>'));
  assert.ok(!renderLaunch({ launch: launch(), now: NOW }).includes('class="shots"'), 'no screenshots, no gallery');
  // the strip scrolls inside its own box, so it never widens a 375px page; the links hold their hidden screen-reader text, which
  // would otherwise escape the strip (position:absolute) and make the page 661px wide
  const css = file('public/assets/launch.css');
  assert.match(css, /\.shots ul\{display:flex;[^}]*overflow-x:auto/);
  assert.match(css, /\.shots a\{position:relative;/);
});

test('a sample launch has 3 screenshots for the preview; its images exist and only previews get them', () => {
  const data = JSON.parse(file('data/launches.json'));
  const biz = data.launches.find(l => l.slug === 'sample-business-tool');
  assert.equal(biz.sample, true);
  assert.equal(biz.screenshots.length, 3);
  for (const s of biz.screenshots) assert.ok(existsSync(new URL(`test/fixtures${s.src}`, root)), s.src);
  assert.ok(!existsSync(new URL('public/launches/sample-business-tool', root)), 'never in public/ (production)');
});

// ---- 3. Ask in Community ----

test('Discussion ends with "Questions for the maker? Ask in Community", with or without a maker story', () => {
  const line = `<p class="tool-note ask-maker">Questions for the maker? <a href="${COMMUNITY.qa}">Ask in Community</a></p>`;
  for (const story of ['Hello.', '']) {
    const html = renderLaunch({ launch: launch({ maker_story: story }), now: NOW });
    assert.ok(html.includes('<h2 id="c-h">Discussion</h2>') && html.includes(line), `story: ${JSON.stringify(story)}`);
    assert.equal(html.includes('class="comment"'), !!story);
  }
});

// ---- 4. ties ----

test('ties share a rank, the next rank skips (1, 1, 3), the same on the results page, the leaderboard and the homepage', () => {
  assert.deepEqual(tieRanks([{ votes: 9 }, { votes: 5 }, { votes: 5 }, { votes: 2 }]), [1, 2, 2, 4]);
  assert.deepEqual(tieRanks([{ votes: 4 }, { votes: 4 }, { votes: 1 }]), [1, 1, 3]);
  assert.deepEqual(tieRanks([]), []);
  const launches = [launch({ slug: 'a', name: 'A', votes: 4 }), launch({ slug: 'b', name: 'B', votes: 4 }), launch({ slug: 'c', name: 'C', votes: 1 })];
  assert.deepEqual(rankByCategory(launches)[0].entries.map(e => e.rank), [1, 1, 3]);
  const week = { week: 1, opensAt: Date.UTC(2026, 10, 23, 8, 1), open: true, closed: false };
  const html = renderLeaderboard({ week, launches, now: NOW });
  assert.deepEqual([...html.matchAll(/class="rank" aria-label="Rank (\d)">(\d)</g)].map(m => [m[1], m[2]]), [['1', '1'], ['1', '1'], ['3', '3']]);
  assert.equal([...html.matchAll(/class="lrow top top-1"/g)].length, 2, 'both first places are marked first');
});

// ---- 5. rows ----

test('leaderboard rows: logo, category chip and the free-signal line (or none)', () => {
  const week = { week: 1, opensAt: Date.UTC(2026, 10, 23, 8, 1), open: true, closed: false };
  const html = renderLeaderboard({ week, now: NOW, launches: [
    launch({ slug: 'a', name: 'A', votes: 2, facts: FULL, logo_url: '/launches/a/logo.png' }),
    launch({ slug: 'b', name: 'B', votes: 1, facts: { ...FULL, paidDeps: { level: 'required' } } }),
    launch({ slug: 'c', name: 'C', votes: 0, facts: {} }),
  ] });
  assert.ok(html.includes('<img class="logo" src="/launches/a/logo.png"'));
  assert.equal([...html.matchAll(/<span class="tg cat">Small Business<\/span>/g)].length, 3);
  assert.ok(html.includes('<span class="free-signal">Runs free · Desktop app</span>'));
  assert.ok(html.includes('<span class="free-signal paid">Needs paid service</span>'));
  assert.equal([...html.matchAll(/class="free-signal/g)].length, 2, 'nothing for unchecked facts');
});

// A small fake DOM for the homepage part of launch.js
function homepageRows(api) {
  const made = [];
  const node = tag => {
    const n = { tag, className: '', textContent: '', children: [], attrs: {}, dataset: {}, append(...c) { n.children.push(...c); }, setAttribute(k, v) { n.attrs[k] = v; } };
    made.push(n);
    return n;
  };
  const root = { querySelector: () => null, replaceChildren() {} };
  const ctx = {
    document: { getElementById: id => (id === 'week-live' ? root : null), addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, createElement: node },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(api) }), setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    navigator: {}, getSelection: () => ({}), WeakMap, Date, Number, String, Math, JSON, URL, Intl, Set, console, location: { pathname: '/' },
  };
  ctx.window = ctx;
  vm.runInNewContext(file('public/assets/launch.js'), ctx);
  return new Promise(r => setTimeout(() => r(made), 20));
}

test('homepage rows: the shared rank, the logo (or an initial), the category chip and the free-signal line', async () => {
  const api = { ok: true, week: 1, open: true, closed: false, total: 3, voted: [], launches: [
    { slug: 'a', name: 'Alpha', tagline: 't', category: 'biz', category_name: 'Small Business', logo_url: '/launches/a/logo.png', votes: 4, rank: 1, signal: 'Runs free · Desktop app' },
    { slug: 'b', name: 'Beta', tagline: 't', category: 'job', category_name: 'Job Seekers', logo_url: null, votes: 4, rank: 1, signal: 'Needs paid service' },
    { slug: 'c', name: 'Gamma', tagline: 't', category: 'sec', category_name: 'Cybersecurity & SOC', logo_url: null, votes: 1, rank: 3, signal: null },
  ] };
  const made = await homepageRows(api);
  assert.deepEqual(made.filter(n => n.className === 'mini-rank').map(n => n.textContent), ['1', '1', '3']);
  assert.ok(made.some(n => n.tag === 'img' && n.className === 'mini-logo' && n.src === '/launches/a/logo.png' && n.alt === ''));
  assert.deepEqual(made.filter(n => n.className === 'mini-logo mini-initial').map(n => n.textContent), ['B', 'G']);
  assert.deepEqual(made.filter(n => n.className === 'mini-cat').map(n => n.textContent), ['Small Business', 'Job Seekers', 'Cybersecurity & SOC']);
  assert.deepEqual(made.filter(n => n.className.startsWith('mini-signal')).map(n => [n.className, n.textContent]),
    [['mini-signal', 'Runs free · Desktop app'], ['mini-signal paid', 'Needs paid service']]);
});

// ---- 6. widths ----

test('the Preview job checks every audited page at 375px, 1280px and 1366px', () => {
  assert.deepEqual(SCREENS.map(s => s.width), [375, 1280, 1366]);
  assert.ok(file('.github/workflows/deploy.yml').includes('node scripts/check-width.mjs "$PREVIEW_URL"'));
});
