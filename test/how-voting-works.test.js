import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderHowVotingWorks, howVotingWorksResponse, VOTING_SECTIONS, VOTING_EMAIL } from '../lib/how-voting-works.js';
import { launchClosesAt } from '../lib/time.js';
import * as route from '../functions/how-voting-works/index.js';

const html = renderHowVotingWorks();
const text = html.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the page has the eight rule sections in the founder\'s order, then the contact, under one h1', () => {
  assert.deepEqual(VOTING_SECTIONS.map(s => s[0]), ['When', 'One vote per launch', 'How we count', 'Ties', 'Fair play', 'Unusual activity', "Founder's tools", 'What winning means']);
  assert.equal((html.match(/<h1/g) || []).length, 1);
  const headings = [...html.matchAll(/<h2 id="[^"]+">([^<]+)<\/h2>/g)].map(m => m[1].replace(/&#39;/g, "'"));
  assert.deepEqual(headings, [...VOTING_SECTIONS.map(s => s[0]), 'Questions or concerns']);
  assert.ok(html.includes(`<a href="mailto:${VOTING_EMAIL}">${VOTING_EMAIL}</a>`));
});

test('the key promises are on the page in the founder\'s words', () => {
  for (const s of [
    'Voting opens Monday at 12:01 AM Pacific and closes Sunday at 11:59 PM Pacific.',
    'You can upvote each launch once per week. No sign-in needed.',
    'We never store your IP address.',
    'This is an estimate, not proof of one person',
    'Launches with the same vote count share a rank and are listed alphabetically.',
    'so we never remove votes automatically',
    "Tools built by OpenOrbia's founder are labeled and never ranked.",
    'There\'s no prize or paid placement.',
  ]) assert.ok(text.includes(s), s);
});

test('what the page says about timing, ties and the founder\'s tools matches how voting is built', () => {
  assert.equal(new Date(launchClosesAt('2026-11-23')).toISOString(), '2026-11-30T07:59:00.000Z', 'closes Sunday 11:59 PM Pacific (the Monday 07:59 UTC)');
  const results = file('lib/results.js');
  assert.match(results, /alphabet|localeCompare|name/i);
});

test('it is a normal page: 200 HTML, canonical, linked from the footer of every page, and has a route', async () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/openorbia\.com\/how-voting-works\/">/);
  const res = howVotingWorksResponse();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(typeof route.onRequestGet, 'function');
  for (const f of ['lib/layout.js', 'public/index.html', 'public/launch-list/index.html', 'public/404.html']) assert.ok(file(f).includes('<a href="/how-voting-works/">How voting works</a>'), f);
});

test('the page claims only what the site does: results appear when voting closes, removals are announced in the newsletter, #1 is on the results page', () => {
  for (const s of [
    "Final results appear on the results page when voting closes, and we share them in Monday's newsletter.",
    "If we ever remove votes, we'll say how many and why in that week's newsletter.",
    "The top launch in each category is shown as #1 on that week's results page. There's no prize or paid placement.",
  ]) assert.ok(text.includes(s), s);
  for (const gone of ['posted on Monday with the next launches', 'the results page says how many and why', '#1 of the week', 'badge']) assert.ok(!text.includes(gone), gone);
  assert.ok(text.includes('hello@openorbia.com'));
});

test('the sitemap lists /how-voting-works/, /submit/ and /request/', async () => {
  const { sitemapXml, STATIC_PATHS } = await import('../lib/seo.js');
  for (const p of ['/how-voting-works/', '/submit/', '/request/']) {
    assert.ok(STATIC_PATHS.includes(p), p);
    assert.ok(sitemapXml().includes(`<loc>https://openorbia.com${p}</loc>`), p);
  }
});

test('a "How voting works" link sits by the vote buttons on the launch page, the leaderboard and the homepage launch section', async () => {
  const { renderLaunch, renderLeaderboard } = await import('../lib/pages.js');
  const launch = { slug: 'a-tool', name: 'A Tool', tagline: 't', description: 'd', category: 'sec', repo_url: 'https://example.com/r', website_url: null, logo_url: null, screenshots: [], video_url: null,
    maker_name: 'M', maker_links: [], maker_story: 's', license: 'MIT', launch_week: 1, launch_date: '2026-11-23', votes: 0, facts: {} };
  const LINK = '<a href="/how-voting-works/">How voting works</a>';
  const OPEN = Date.parse('2026-11-24T20:00:00Z'), BEFORE = Date.parse('2026-11-20T20:00:00Z');
  for (const now of [BEFORE, OPEN]) assert.ok(renderLaunch({ launch, now }).includes(LINK), `launch page at ${now}`);
  const board = renderLeaderboard({ week: { week: 1, open: true, closed: false, opensAt: Date.parse('2026-11-23T08:01:00Z'), closesAt: Date.parse('2026-11-30T07:59:00Z') }, launches: [launch], now: OPEN });
  assert.ok(board.includes(LINK), 'leaderboard');
  const js = readFileSync(new URL('../public/assets/launch.js', import.meta.url), 'utf8');
  assert.ok(js.includes("howLink.href = '/how-voting-works/'") && js.includes("'How voting works'"), 'homepage launch section');
});
