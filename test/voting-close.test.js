import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { launchOpensAt, launchClosesAt } from '../lib/time.js';
import { handleVote } from '../lib/vote.js';
import { launchResponse, leaderboardResponse, launchesApiResponse } from '../lib/pages.js';
import { rankByCategory, resultsResponse } from '../lib/results.js';
import { createDb, addLaunch } from './helpers/d1.js';

const SECRET = 'test-secret-0123456789abcdef';
let db, env;
beforeEach(() => { db = createDb(); env = { DB: db, VOTE_SECRET: SECRET }; });

const iso = ms => new Date(ms).toISOString();
const pacific = ms => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long', hour: 'numeric', minute: '2-digit', hourCycle: 'h12' }).format(ms);
let who = 0;
const vote = (slug, now) => handleVote({ env, now, request: new Request('https://openorbia.com/api/vote', {
  method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': `198.51.100.${(who++ % 250) + 1}`, 'user-agent': `T${who}` }, body: JSON.stringify({ slug }),
}) });
const addVotes = (slug, n) => { for (let i = 0; i < n; i++) db.sql(`INSERT INTO votes (launch_slug, voter_hash, created_at) VALUES ('${slug}', 'v${slug}${i}', 'x')`); };
const page = async res => ({ status: res.status, html: await res.text(), headers: res.headers });

// ---- when a launch week closes ----

test('a launch week closes on the Sunday at 11:59 PM Pacific: the launch date plus 6 days', () => {
  assert.equal(iso(launchClosesAt('2026-11-23')), '2026-11-30T07:59:00.000Z');   // Sunday Nov 29, PST (UTC-8)
  assert.equal(pacific(launchClosesAt('2026-11-23')), 'Sunday 11:59 PM');
  assert.equal(iso(launchClosesAt('2026-07-06')), '2026-07-13T06:59:00.000Z');   // Sunday Jul 12, PDT (UTC-7)
  assert.equal(pacific(launchClosesAt('2026-07-06')), 'Sunday 11:59 PM');
});

test('every Monday launch of a whole year closes at Sunday 11:59 PM on the Pacific clock, through both daylight saving changes', () => {
  let day = Date.UTC(2027, 0, 4);                                                // Monday Jan 4, 2027
  for (let i = 0; i < 52; i++, day += 7 * 24 * 3600 * 1000) {
    const date = new Date(day).toISOString().slice(0, 10);
    assert.equal(pacific(launchOpensAt(date)), 'Monday 12:01 AM', `${date} opens`);
    assert.equal(pacific(launchClosesAt(date)), 'Sunday 11:59 PM', `${date} closes`);
  }
});

test('DST edges: the week that loses an hour and the week that gains one', () => {
  // spring forward: Sunday 14 March 2027 has 23 hours, so the week is an hour shorter in real time
  const springOpen = launchOpensAt('2027-03-08'), springClose = launchClosesAt('2027-03-08');
  assert.equal(iso(springOpen), '2027-03-08T08:01:00.000Z');                     // PST
  assert.equal(iso(springClose), '2027-03-15T06:59:00.000Z');                    // PDT: 06:59 UTC, not 07:59
  assert.equal(springClose - springOpen, (6 * 24 + 22) * 3600 * 1000 + 58 * 60 * 1000);
  // fall back: Sunday 1 November 2026 has 25 hours
  const fallOpen = launchOpensAt('2026-10-26'), fallClose = launchClosesAt('2026-10-26');
  assert.equal(iso(fallOpen), '2026-10-26T07:01:00.000Z');                       // PDT
  assert.equal(iso(fallClose), '2026-11-02T07:59:00.000Z');                      // PST
  assert.equal(fallClose - fallOpen, (7 * 24 * 60 + 58) * 60 * 1000);          // 6 days 23:58 on the clock, plus the extra hour of the 25-hour Sunday
  // across a month, a year and a leap day
  assert.equal(iso(launchClosesAt('2026-12-28')), '2027-01-04T07:59:00.000Z');
  assert.equal(iso(launchClosesAt('2028-02-28')), '2028-03-06T07:59:00.000Z');   // Feb 29 exists in 2028
  assert.ok(Number.isNaN(launchClosesAt('2026-02-31')) && Number.isNaN(launchClosesAt('soon')) && Number.isNaN(launchClosesAt('')));
});

// ---- the vote API ----

test('voting is open from 12:01 AM Monday until 11:59 PM Sunday Pacific, and closed after', async () => {
  addLaunch(db, { slug: 'a-tool', name: 'A Tool', launch_week: 1, launch_date: '2026-11-23' });
  const opens = launchOpensAt('2026-11-23'), closes = launchClosesAt('2026-11-23');
  const before = await vote('a-tool', opens - 1000);
  assert.equal(before.status, 403);
  assert.match((await before.json()).error, /^Voting opens Monday, Nov 23, 2026 at 12:01 AM Pacific\.$/);
  assert.equal((await vote('a-tool', opens)).status, 200, 'open at the opening minute');
  assert.equal((await vote('a-tool', closes - 1000)).status, 200, 'still open one second before the close');
  for (const t of [closes, closes + 1000, closes + 3600 * 1000, closes + 30 * 24 * 3600 * 1000]) {
    const res = await vote('a-tool', t);
    assert.equal(res.status, 403, iso(t));
    assert.deepEqual(await res.json(), { ok: false, code: 'voting_closed', error: 'Voting closed Sunday at 11:59 PM Pacific.' });
  }
  assert.equal(db.rows('SELECT COUNT(*) AS n FROM votes')[0].n, 2, 'nothing was counted after the close');
});

test('the close follows the Pacific clock across DST: a fixed UTC-8 would keep the spring week open an hour too long', async () => {
  addLaunch(db, { slug: 'spring', name: 'Spring', launch_week: 1, launch_date: '2027-03-08' });
  addLaunch(db, { slug: 'fall', name: 'Fall', launch_week: 2, launch_date: '2026-10-26' });
  // spring week: closes 06:59 UTC. 07:30 UTC is 12:30 AM Monday PDT, so voting must already be closed
  assert.equal((await vote('spring', Date.parse('2027-03-15T06:58:59Z'))).status, 200);
  assert.equal((await vote('spring', Date.parse('2027-03-15T06:59:00Z'))).status, 403);
  assert.equal((await vote('spring', Date.parse('2027-03-15T07:30:00Z'))).status, 403);
  // fall week: closes 07:59 UTC (PST), and an hour earlier (06:59 UTC, which is 11:59 PM PDT of the same night) it is still open
  assert.equal((await vote('fall', Date.parse('2026-11-02T07:58:59Z'))).status, 200);
  assert.equal((await vote('fall', Date.parse('2026-11-02T07:59:00Z'))).status, 403);
});

// ---- the pages ----

test('a launch page says when voting closes while it is open, and "Final results" after', async () => {
  addLaunch(db, { slug: 'a-tool', name: 'A Tool', launch_week: 1, launch_date: '2026-11-23' });
  const req = new Request('https://openorbia.com/launch/a-tool/');
  const open = await page(await launchResponse({ request: req, env, params: { slug: 'a-tool' }, now: launchOpensAt('2026-11-23') + 3600 * 1000 }));
  assert.ok(open.html.includes('Voting closes Sunday 11:59 PM PT'));
  assert.ok(!open.html.includes('Final results'));
  assert.match(open.html, /data-state="ready"/);

  const closed = await page(await launchResponse({ request: req, env, params: { slug: 'a-tool' }, now: launchClosesAt('2026-11-23') }));
  assert.ok(closed.html.includes('Final results.'));
  assert.ok(!closed.html.includes('Voting closes Sunday'));
  assert.match(closed.html, /data-state="ended"[^>]* disabled/);
  assert.ok(closed.html.includes('href="/launches/week-1/results/"'), 'links to the final ranks');

  const notOpen = await page(await launchResponse({ request: req, env, params: { slug: 'a-tool' }, now: launchOpensAt('2026-11-23') - 1000 }));
  assert.ok(!notOpen.html.includes('Voting closes') && !notOpen.html.includes('Final results'));
});

test('the leaderboard and the homepage JSON know when a week is over', async () => {
  addLaunch(db, { slug: 'a-tool', name: 'A Tool', launch_week: 1, launch_date: '2026-11-23' });
  const req = new Request('https://openorbia.com/launches/');
  const open = await page(await leaderboardResponse({ request: req, env, now: launchOpensAt('2026-11-23') + 24 * 3600 * 1000 }));
  assert.ok(open.html.includes('Voting closes Sunday 11:59 PM PT'));
  assert.ok(!open.html.includes('Final results'));
  const done = await page(await leaderboardResponse({ request: req, env, now: launchClosesAt('2026-11-23') + 1000 }));
  assert.ok(done.html.includes('Final results') && done.html.includes('Voting is closed.'));
  assert.ok(done.html.includes('href="/launches/week-1/results/"'));
  assert.match(done.html, /data-state="ended"/);
  const json = await (await launchesApiResponse({ request: new Request('https://openorbia.com/api/launches'), env, now: launchClosesAt('2026-11-23') + 1000 })).json();
  assert.equal(json.closed, true);
  assert.equal(json.closes_at, '2026-11-30T07:59:00.000Z');
});

// ---- final ranks ----

test('final ranks per category: ties share a rank and are ordered by name', () => {
  const l = (name, category, votes) => ({ slug: name.toLowerCase().replace(/ /g, '-'), name, category, votes, tagline: '' });
  const ranked = rankByCategory([
    l('Zulu', 'biz', 5), l('alpha', 'biz', 5), l('Mike', 'biz', 9), l('Echo', 'biz', 1), l('Delta', 'biz', 5),
    l('Solo', 'job', 0), l('Also', 'job', 0),
    l('Guard', 'sec', 3),
  ]);
  assert.deepEqual(ranked.map(r => r.category), ['biz', 'job', 'sec'], 'the site category order');
  const view = r => r.entries.map(e => `${e.rank} ${e.launch.name}`);
  assert.deepEqual(view(ranked[0]), ['1 Mike', '2 alpha', '2 Delta', '2 Zulu', '5 Echo'], 'three-way tie shares rank 2 (by name, ignoring case), then 5');
  assert.deepEqual(view(ranked[1]), ['1 Also', '1 Solo'], 'zero votes tie too');
  assert.deepEqual(view(ranked[2]), ['1 Guard']);
  assert.deepEqual(rankByCategory([]), []);
});

test('the results page lists the final ranks per category once voting is over', async () => {
  addLaunch(db, { slug: 'zeta', name: 'Zeta', category: 'biz', launch_week: 1, launch_date: '2026-11-23' });
  addLaunch(db, { slug: 'alpha', name: 'Alpha', category: 'biz', launch_week: 1, launch_date: '2026-11-23' });
  addLaunch(db, { slug: 'omega', name: 'Omega', category: 'biz', launch_week: 1, launch_date: '2026-11-23' });
  addLaunch(db, { slug: 'hire', name: 'Hire', category: 'job', launch_week: 1, launch_date: '2026-11-23' });
  addLaunch(db, { slug: 'next-week', name: 'Next Week', category: 'job', launch_week: 2, launch_date: '2026-11-30' });
  addVotes('zeta', 4); addVotes('alpha', 4); addVotes('omega', 1); addVotes('hire', 2); addVotes('next-week', 9);
  const res = await page(await resultsResponse({ env, params: { week: 'week-1' }, now: launchClosesAt('2026-11-23') + 1000 }));
  assert.equal(res.status, 200);
  assert.ok(res.html.includes('<title>Launch Week 1 final results | OpenOrbia</title>'));
  assert.ok(!res.html.includes('noindex'));
  const rows = [...res.html.matchAll(/res-rank" aria-label="Rank (\d+)">\d+<\/span>.*?<b>([^<]+)<\/b>.*?(\d+) upvotes?/g)].map(m => `${m[1]} ${m[2]} ${m[3]}`);
  assert.deepEqual(rows, ['1 Alpha 4', '1 Zeta 4', '3 Omega 1', '1 Hire 2'], 'ties share rank 1 ordered by name, then rank 3; other categories and weeks do not mix in');
  assert.ok(res.html.indexOf('Small Business') < res.html.indexOf('Job Seekers'));
  assert.ok(!res.html.includes('Next Week'));
});

test('before the week is final the results page shows no ranks and is not indexed; unknown weeks are 404', async () => {
  addLaunch(db, { slug: 'a-tool', name: 'A Tool', launch_week: 1, launch_date: '2026-11-23' });
  addVotes('a-tool', 3);
  const live = await page(await resultsResponse({ env, params: { week: 'week-1' }, now: launchClosesAt('2026-11-23') - 1000 }));
  assert.equal(live.status, 200);
  assert.ok(live.html.includes('not final yet') && live.html.includes('Sunday, Nov 29'));
  assert.ok(live.html.includes('noindex'));
  assert.ok(!live.html.includes('A Tool') && !live.html.includes('res-rank'));
  assert.equal(live.headers.get('cache-control'), 'no-store');
  for (const week of ['week-9', 'week-x', 'week-', '1', 'week-1; DROP', 'WEEK-1', 'week-12345']) {
    assert.equal((await resultsResponse({ env, params: { week }, now: Date.now() })).status, 404, week);
  }
});

test('in the fall week 06:59 UTC (11:59 PM PDT) is still an hour before the close', async () => {
  addLaunch(db, { slug: 'fall', name: 'Fall', launch_week: 2, launch_date: '2026-10-26' });
  assert.equal((await vote('fall', Date.parse('2026-11-02T06:59:00Z'))).status, 200);
});
