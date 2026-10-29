import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { launchResponse, leaderboardResponse, launchesApiResponse, renderLaunch, renderLeaderboard } from '../lib/pages.js';
import { currentWeek } from '../lib/launches.js';
import { videoEmbed, esc, paragraphs, isOpenLicense } from '../lib/html.js';
import { handleVote } from '../lib/vote.js';
import { launchOpensAt } from '../lib/time.js';
import { FIRST_LAUNCH_WEEK, MAKERS_CONFIRMED } from '../lib/site.js';
import { createDb, addLaunch } from './helpers/d1.js';

const SECRET = 'test-secret-0123456789abcdef';
const OPENS = launchOpensAt('2026-11-23');
const BEFORE = OPENS - 3 * 24 * 3600 * 1000;       // Friday Nov 20
const AFTER = OPENS + 2 * 24 * 3600 * 1000;        // Wednesday Nov 25

let db, env;
beforeEach(() => {
  db = createDb();
  env = { DB: db, VOTE_SECRET: SECRET };
});

const req = (path, headers = {}) => new Request(`https://openorbia.com${path}`, { headers });
const page = async (res) => ({ status: res.status, html: await res.text(), headers: res.headers });
const seedThree = () => {
  addLaunch(db, { slug: 'zeta-tool', name: 'Zeta Tool', category: 'sec', license: 'AGPL-3.0', launch_date: '2026-11-23' });
  addLaunch(db, { slug: 'alpha-tool', name: 'Alpha Tool', category: 'job', launch_date: '2026-11-23' });
  addLaunch(db, { slug: 'mid-tool', name: 'Mid Tool', category: 'biz', launch_date: '2026-11-23' });
};
async function castVote(slug, who, now = AFTER) {
  const request = new Request('https://openorbia.com/api/vote', {
    method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': who, 'user-agent': `UA-${who}` }, body: JSON.stringify({ slug }),
  });
  const res = await handleVote({ request, env, now });
  assert.equal(res.status, 200);
}

// ---- /launch/<slug>/ ----

test('a launch page shows everything: logo, tagline, screenshots, description, licence, links, maker story as the first comment', async () => {
  addLaunch(db, {
    slug: 'full-tool', name: 'Full Tool', tagline: 'Does everything', description: 'First paragraph.\n\nSecond paragraph.', category: 'job',
    repo_url: 'https://github.com/example/full-tool', website_url: 'https://full.example', logo_url: '/launches/full-tool/logo.png',
    screenshots: JSON.stringify([{ src: '/launches/full-tool/a.png', alt: 'The editor' }, { src: '/launches/full-tool/b.png', alt: 'The report' }]),
    maker_name: 'Mia Maker', maker_links: JSON.stringify([{ label: 'Mastodon', url: 'https://social.example/@mia' }]),
    maker_story: 'I built this for my sister.\n\nIt is free.', license: 'Apache-2.0', launch_date: '2026-11-23',
  });
  const { status, html } = await page(await launchResponse({ request: req('/launch/full-tool/'), env, params: { slug: 'full-tool' }, now: AFTER }));
  assert.equal(status, 200);
  for (const text of ['<h1>Full Tool</h1>', 'Does everything', 'First paragraph.', 'Second paragraph.', 'Apache-2.0', 'Job Seekers', 'Mia Maker',
    'I built this for my sister.', 'It is free.', 'The editor', 'The report', 'Visit website', 'View on GitHub']) {
    assert.ok(html.includes(text), `missing: ${text}`);
  }
  assert.match(html, /<img class="logo" src="\/launches\/full-tool\/logo\.png"/);
  assert.match(html, /<a href="https:\/\/social\.example\/@mia"[^>]*>Mastodon<\/a>/);
  assert.match(html, /class="pill">Maker</);
  assert.ok(html.indexOf('<h2 id="c-h">Discussion</h2>') > html.indexOf('About Full Tool'), 'the maker story comes after the description, as the first comment');
  assert.match(html, /<link rel="canonical" href="https:\/\/openorbia\.com\/launch\/full-tool\/">/);
  assert.match(html, /<title>Full Tool: Does everything \| OpenOrbia<\/title>/);
  assert.match(html, /property="og:image" content="https:\/\/openorbia\.com\/launches\/full-tool\/a\.png"/);
  assert.match(html, /<script src="\/assets\/launch\.js" defer><\/script>/);
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1/);
});

test('external links open safely, and only https links are rendered', async () => {
  addLaunch(db, { slug: 'links-tool', repo_url: 'javascript:alert(1)', website_url: 'http://insecure.example', maker_story: '',
    maker_links: JSON.stringify([{ label: 'Bad', url: 'javascript:alert(2)' }, { label: 'Good', url: 'https://good.example' }]) });
  const { html } = await page(await launchResponse({ request: req('/x'), env, params: { slug: 'links-tool' }, now: AFTER }));
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('insecure.example'));
  assert.ok(!html.includes('Visit website'));
  for (const m of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) assert.match(m[0], /rel="noopener"/, m[0]);
  assert.ok(!html.includes('Discussion'), 'no maker story, no discussion section');
});

test('everything from the database is escaped (no script injection)', async () => {
  const evil = '<script>alert(1)</script>"><img src=x onerror=alert(2)>';
  addLaunch(db, {
    slug: 'evil-tool', name: evil, tagline: evil, description: evil, maker_name: evil, maker_story: evil, license: evil,
    logo_url: `"><script>alert(3)</script>`, screenshots: JSON.stringify([{ src: '/launches/evil-tool/a.png', alt: evil }, { src: '"><script>', alt: 'x' }]),
    maker_links: JSON.stringify([{ label: evil, url: 'https://ok.example' }]),
  });
  const { html } = await page(await launchResponse({ request: req('/x'), env, params: { slug: 'evil-tool' }, now: AFTER }));
  assert.ok(!html.includes('<script>alert'), 'raw script tag in output');
  // look at the tags with their quoted attribute values removed: escaped text inside a value is harmless, a real handler is not
  assert.ok(!/<[a-z]+[^>]*\son\w+=/i.test(html.replace(/="[^"]*"/g, '=""')), 'an event handler attribute in the output');
  assert.ok(!html.includes('"><script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.equal([...html.matchAll(/<script\b/g)].length, 1, 'only the site script tag');
});

test('the upvote button: closed before launch day, ready after, voted once this visitor has voted', async () => {
  addLaunch(db, { slug: 'vote-tool', name: 'Vote Tool', launch_date: '2026-11-23' });
  const render = async (now, headers) => (await page(await launchResponse({ request: req('/launch/vote-tool/', headers), env, params: { slug: 'vote-tool' }, now }))).html;

  const closed = await render(BEFORE);
  assert.match(closed, /<button class="vote vote-lg" type="button" data-slug="vote-tool" data-state="closed" aria-pressed="false" disabled>/);
  assert.match(closed, />Soon</);
  assert.match(closed, /Voting opens Monday Nov 23 at 12:01 AM Pacific\./);

  const who = { 'cf-connecting-ip': '198.51.100.20', 'user-agent': 'Reader/1.0' };
  const ready = await render(AFTER, who);
  assert.match(ready, /data-state="ready" aria-pressed="false">/);
  assert.match(ready, /data-count>0</);

  await handleVote({ request: new Request('https://openorbia.com/api/vote', { method: 'POST', headers: { 'content-type': 'application/json', ...who }, body: '{"slug":"vote-tool"}' }), env, now: AFTER });
  const voted = await render(AFTER, who);
  assert.match(voted, /data-state="voted" aria-pressed="true">/);
  assert.match(voted, /data-count>1</);
  assert.match(voted, /You upvoted this launch\./);
  assert.match(await render(AFTER, { ...who, 'user-agent': 'Someone-else/1.0' }), /data-state="ready"/);
});

test('unknown or malformed slugs give a 404 page that search engines skip; a missing database gives 503', async () => {
  for (const slug of ['nope', 'Bad Slug', '../etc', 'x'.repeat(70), '', undefined]) {
    const { status, html } = await page(await launchResponse({ request: req('/x'), env, params: { slug }, now: AFTER }));
    assert.equal(status, 404, String(slug));
    assert.match(html, /<meta name="robots" content="noindex">/);
    assert.match(html, /That launch/);
  }
  assert.equal((await launchResponse({ request: req('/x'), env: {}, params: { slug: 'Bad Slug' }, now: AFTER })).status, 404); // a malformed slug never needs the database
  assert.equal((await launchResponse({ request: req('/x'), env: {}, params: { slug: 'nope' }, now: AFTER })).status, 503);     // a well-formed one does
  addLaunch(db, { slug: 'there' });
  assert.equal((await launchResponse({ request: req('/x'), env: {}, params: { slug: 'there' }, now: AFTER })).status, 503);
});

test('a trailing slash in the slug parameter is tolerated', async () => {
  addLaunch(db, { slug: 'slashy' });
  assert.equal((await launchResponse({ request: req('/x'), env, params: { slug: 'slashy/' }, now: AFTER })).status, 200);
});

test('pages are private (the button state is per visitor), set no cookies, and carry basic security headers', async () => {
  seedThree();
  for (const res of [
    await launchResponse({ request: req('/x'), env, params: { slug: 'mid-tool' }, now: AFTER }),
    await leaderboardResponse({ request: req('/launches/'), env, now: AFTER }),
    await launchesApiResponse({ request: req('/api/launches'), env, now: AFTER }),
  ]) {
    assert.equal(res.headers.get('set-cookie'), null);
    assert.match(res.headers.get('cache-control'), /no-store/);
    assert.equal(res.status, 200);
  }
  const h = (await launchResponse({ request: req('/x'), env, params: { slug: 'mid-tool' }, now: AFTER })).headers;
  assert.equal(h.get('x-content-type-options'), 'nosniff');
  assert.equal(h.get('content-security-policy'), "frame-ancestors 'none'");
  assert.match(h.get('content-type'), /^text\/html; charset=utf-8/);
});

// ---- video ----

test('video embeds: YouTube without cookies, Vimeo, a local file, or a plain link', () => {
  assert.deepEqual(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), { kind: 'iframe', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
  assert.deepEqual(videoEmbed('https://youtu.be/dQw4w9WgXcQ'), { kind: 'iframe', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
  assert.deepEqual(videoEmbed('https://www.youtube.com/shorts/dQw4w9WgXcQ'), { kind: 'iframe', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
  assert.deepEqual(videoEmbed('https://vimeo.com/123456'), { kind: 'iframe', src: 'https://player.vimeo.com/video/123456' });
  assert.deepEqual(videoEmbed('/launches/x/demo.mp4'), { kind: 'file', src: '/launches/x/demo.mp4' });
  assert.deepEqual(videoEmbed('https://example.com/demo'), { kind: 'link', href: 'https://example.com/demo' });
  assert.deepEqual(videoEmbed('https://www.youtube.com/watch?v=short'), { kind: 'link', href: 'https://www.youtube.com/watch?v=short' }); // not a real id: no embed
  for (const none of [null, undefined, '', 'javascript:alert(1)', 'http://youtu.be/dQw4w9WgXcQ', '/launches/x/demo.exe']) assert.equal(videoEmbed(none), null, String(none));
});

test('a video shows on the launch page as a sandboxed embed, or not at all', async () => {
  addLaunch(db, { slug: 'vid-tool', video_url: 'https://youtu.be/dQw4w9WgXcQ' });
  addLaunch(db, { slug: 'novid-tool' });
  const withVideo = (await page(await launchResponse({ request: req('/x'), env, params: { slug: 'vid-tool' }, now: AFTER }))).html;
  assert.match(withVideo, /<iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ"[^>]*sandbox="allow-scripts allow-same-origin allow-presentation"/);
  const without = (await page(await launchResponse({ request: req('/x'), env, params: { slug: 'novid-tool' }, now: AFTER }))).html;
  assert.ok(!without.includes('<iframe') && !without.includes('<video'));
});

// ---- /launches/ ----

test('before launch day the leaderboard shows the countdown and the lineup, with no ranks and closed buttons', async () => {
  seedThree();
  const { status, html } = await page(await leaderboardResponse({ request: req('/launches/'), env, now: BEFORE }));
  assert.equal(status, 200);
  assert.match(html, /Coming Monday Nov 23/);
  assert.match(html, /data-countdown="2026-11-23T08:01:00\.000Z"/);
  assert.match(html, /data-on-zero="reload"/);
  assert.match(html, new RegExp(`data-now="${BEFORE}"`));
  assert.match(html, /3 free AI tools launch on Monday Nov 23\. Voting opens at 12:01 AM Pacific\./);
  assert.match(html, /<b data-unit="d">3<\/b>/); // three days to go
  assert.equal([...html.matchAll(/class="rank"/g)].length, 0);
  assert.equal([...html.matchAll(/data-state="closed"/g)].length, 3);
  assert.deepEqual([...html.matchAll(/<span class="lrow-text"><b>([^<]+)<\/b>/g)].map(m => m[1]), ['Alpha Tool', 'Mid Tool', 'Zeta Tool']); // alphabetical
});

test('once launch day has opened the leaderboard is ranked by votes, ties by name, with the top three marked', async () => {
  seedThree();
  addLaunch(db, { slug: 'late-tool', name: 'Late Tool', launch_date: '2026-11-23' });
  for (const who of ['1.1.1.1', '1.1.1.2', '1.1.1.3']) await castVote('zeta-tool', who);
  for (const who of ['1.1.1.1', '1.1.1.2']) await castVote('mid-tool', who);
  await castVote('alpha-tool', '1.1.1.1');
  await castVote('late-tool', '1.1.1.1');

  const { html } = await page(await leaderboardResponse({ request: req('/launches/'), env, now: AFTER }));
  assert.ok(!html.includes('data-countdown'));
  assert.deepEqual([...html.matchAll(/<span class="lrow-text"><b>([^<]+)<\/b>/g)].map(m => m[1]), ['Zeta Tool', 'Mid Tool', 'Alpha Tool', 'Late Tool']);
  assert.deepEqual([...html.matchAll(/data-count>(\d+)</g)].map(m => m[1]), ['3', '2', '1', '1']);
  assert.deepEqual([...html.matchAll(/class="rank" aria-label="Rank (\d)"/g)].map(m => m[1]), ['1', '2', '3', '4']);
  assert.equal([...html.matchAll(/class="lrow top top-\d"/g)].length, 3);
  assert.match(html, /class="lrow top top-1"/);
  assert.ok(!/lrow top top-4/.test(html));
  assert.match(html, /Ranked by upvotes\. You get one upvote for each launch for the whole week\./);
});

const plain = html => html.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
const attr = (html, name) => (new RegExp(`${name}="([^"]*)"`).exec(html) || [])[1];

test('nothing scheduled yet, before launch day: the Launch Week 1 intro', async () => {
  const { status, html } = await page(await leaderboardResponse({ request: req('/launches/'), env, now: BEFORE }));
  assert.equal(status, 200);
  const text = plain(html);
  assert.match(html, /<h1 id="lw-h">Launch Week <em>1<\/em><\/h1>/);
  assert.ok(text.includes('Coming Monday, Nov 23. Voting opens 12:01 AM Pacific.'));
  assert.ok(text.includes('How it works'));
  const steps = [...html.matchAll(/<li><span class="n">0(\d)<\/span><b>([^<]+)<\/b><\/li>/g)].map(m => `${m[1]} ${m[2].replace('&#39;', "'")}`);
  assert.deepEqual(steps, ['1 Makers launch free AI tools', '2 The community upvotes', "3 The week's top tools get featured"]);
  assert.ok(text.includes(`Makers confirmed: ${MAKERS_CONFIRMED}`));
  assert.match(html, /<a class="btn ghost" href="\/launch-list\/">Browse the Launch List<\/a>/);
  assert.match(html, /<a class="btn pri" href="\/#join">Launch your tool<\/a>/);
  assert.match(html, /<title>Launch Week 1 \| OpenOrbia<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/openorbia\.com\/launches\/">/);
  assert.ok(!text.includes('Nothing has been scheduled'));
  assert.ok(!html.includes('lrow'), 'no launch cards, and no maker names, are shown');
  assert.equal(html.match(/Makers confirmed/g).length, 1);
});

test('the intro uses the same countdown as the homepage', async () => {
  const { html } = await page(await leaderboardResponse({ request: req('/launches/'), env, now: BEFORE }));
  const home = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.equal(attr(html, 'data-countdown'), attr(home, 'data-countdown'));
  assert.equal(attr(html, 'data-countdown'), new Date(launchOpensAt(FIRST_LAUNCH_WEEK.date)).toISOString());
  assert.equal(attr(html, 'data-on-zero'), 'reload');
  const units = h => [...h.matchAll(/<b data-unit="(\w)">[^<]*<\/b><span>(\w+)<\/span>/g)].map(m => `${m[1]}:${m[2]}`);
  assert.deepEqual(units(html), ['d:days', 'h:hours', 'm:min', 's:sec']);
  assert.deepEqual(units(html), units(home));
  assert.match(html, /<b data-unit="d">3<\/b>/); // three days to go from BEFORE
});

test('past the opening time with nothing scheduled: no countdown, an honest message, the rest stays', async () => {
  const { status, html } = await page(await leaderboardResponse({ request: req('/launches/'), env, now: AFTER }));
  assert.equal(status, 200);
  const text = plain(html);
  assert.ok(text.includes('Launch Week 1 is open. The first launches are being added, so check back soon.'));
  assert.ok(!text.includes('Coming Monday'));
  assert.ok(!html.includes('data-countdown'));
  assert.ok(text.includes('How it works') && text.includes(`Makers confirmed: ${MAKERS_CONFIRMED}`));
  assert.ok(html.includes('href="/launch-list/"') && html.includes('href="/#join"'));
});

test('once launches exist, /launches/ keeps its normal behaviour instead of the intro', async () => {
  seedThree();
  for (const now of [BEFORE, AFTER]) {
    const { html } = await page(await leaderboardResponse({ request: req('/launches/'), env, now }));
    assert.ok(!html.includes('class="lw"'), 'the empty-state intro is not shown');
    assert.ok(!html.includes('Makers confirmed'));
    assert.equal([...html.matchAll(/<li class="lrow/g)].length, 3);
  }
});

test('the voted state on the leaderboard follows the visitor', async () => {
  seedThree();
  await castVote('mid-tool', '9.9.9.9');
  const who = { 'cf-connecting-ip': '9.9.9.9', 'user-agent': 'UA-9.9.9.9' };
  const { html } = await page(await leaderboardResponse({ request: req('/launches/', who), env, now: AFTER }));
  assert.deepEqual([...html.matchAll(/data-slug="([^"]+)" data-state="(\w+)"/g)].map(m => `${m[1]}:${m[2]}`).sort(),
    ['alpha-tool:ready', 'mid-tool:voted', 'zeta-tool:ready']);
});

// ---- which week is "this week" ----

test('this week is the latest week that has opened, or the first upcoming one', async () => {
  addLaunch(db, { slug: 'w1', launch_week: 1, launch_date: '2026-11-23' });
  addLaunch(db, { slug: 'w2', launch_week: 2, launch_date: '2026-11-30' });
  const W2 = launchOpensAt('2026-11-30');
  let w = await currentWeek(db, BEFORE);
  assert.deepEqual([w.week, w.open], [1, false]);
  w = await currentWeek(db, OPENS);
  assert.deepEqual([w.week, w.open], [1, true]);
  w = await currentWeek(db, W2 - 1);
  assert.deepEqual([w.week, w.open], [1, true]);
  w = await currentWeek(db, W2);
  assert.deepEqual([w.week, w.open], [2, true]);
  assert.equal(await currentWeek(createDb(), AFTER), null);
});

// ---- /api/launches ----

test('the API hides vote counts before launch day and lists the top launches after', async () => {
  seedThree();
  const before = await (await launchesApiResponse({ request: req('/api/launches'), env, now: BEFORE })).json();
  assert.equal(before.open, false);
  assert.equal(before.opens_at, '2026-11-23T08:01:00.000Z');
  assert.equal(before.label, 'Monday Nov 23');
  assert.equal(before.total, 3);
  assert.equal(before.now, BEFORE);
  assert.ok(before.launches.every(l => l.votes === null));

  await castVote('zeta-tool', '2.2.2.1'); await castVote('zeta-tool', '2.2.2.2'); await castVote('mid-tool', '2.2.2.1');
  const after = await (await launchesApiResponse({ request: req('/api/launches?limit=2'), env, now: AFTER })).json();
  assert.equal(after.open, true);
  assert.deepEqual(after.launches.map(l => [l.slug, l.votes]), [['zeta-tool', 2], ['mid-tool', 1]]);
  assert.deepEqual(Object.keys(after.launches[0]).sort(), ['category', 'logo_url', 'name', 'slug', 'tagline', 'votes']);
});

test('the API limit is clamped, and an empty database and a missing database are handled', async () => {
  seedThree();
  const n = async q => (await (await launchesApiResponse({ request: req(`/api/launches${q}`), env, now: AFTER })).json()).launches.length;
  assert.equal(await n(''), 3);
  assert.equal(await n('?limit=1'), 1);
  assert.equal(await n('?limit=0'), 3);
  assert.equal(await n('?limit=-4'), 1);
  assert.equal(await n('?limit=abc'), 3);
  assert.equal(await n('?limit=500'), 3);
  const empty = await (await launchesApiResponse({ request: req('/api/launches'), env: { DB: createDb() }, now: AFTER })).json();
  assert.deepEqual([empty.ok, empty.week, empty.total, empty.launches], [true, null, 0, []]);
  assert.equal((await launchesApiResponse({ request: req('/api/launches'), env: {}, now: AFTER })).status, 503);
});

// ---- the homepage section ----

test('the homepage section is wired up and its fallback date matches the launch time', () => {
  const home = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(home, /<section class="week" id="week"/);
  assert.match(home, /id="week-live"/);
  assert.match(home, /Coming Monday Nov 23/);
  assert.match(home, new RegExp(`data-countdown="${new Date(OPENS).toISOString()}"`));
  assert.match(home, /<script src="\/assets\/launch\.js" defer><\/script>/);
  assert.match(home, /href="\/launches\/"/);
});

// ---- small helpers ----

test('esc, paragraphs and isOpenLicense', () => {
  assert.equal(esc(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(esc(null), '');
  assert.equal(paragraphs('One\nline\n\nSecond'), '<p>One<br>line</p><p>Second</p>');
  assert.equal(paragraphs('<b>'), '<p>&lt;b&gt;</p>');
  assert.equal(paragraphs(''), '');
  assert.ok(isOpenLicense('MIT') && isOpenLicense('Apache-2.0') && isOpenLicense('AGPL-3.0') && isOpenLicense('BSD-2-Clause'));
  assert.ok(!isOpenLicense('Sustainable Use') && !isOpenLicense('Proprietary'));
});

test('renderLaunch and renderLeaderboard are pure: same input, same output', () => {
  const launch = { slug: 's', name: 'S', tagline: 't', description: 'd', category: 'sec', repo_url: 'https://github.com/a/b', website_url: null, logo_url: null,
    screenshots: [], video_url: null, maker_name: 'M', maker_links: [], maker_story: '', license: 'MIT', launch_week: 1, launch_date: '2026-11-23', votes: 0 };
  assert.equal(renderLaunch({ launch, now: AFTER }), renderLaunch({ launch, now: AFTER }));
  const week = { week: 1, launchDate: '2026-11-23', opensAt: OPENS, open: true };
  assert.equal(renderLeaderboard({ week, launches: [launch], now: AFTER }), renderLeaderboard({ week, launches: [launch], now: AFTER }));
  assert.match(renderLaunch({ launch, now: AFTER }), /logo-initial/); // no logo: the initial on a gradient, like the Launch List
});
