// The upcoming lineup: from the Wednesday before launch day (lib/time.js lineupAnnouncedAt) the homepage and /launches/ show next
// Monday's seeded launches; before that, nothing names them (not the API, /launches/ or the sitemap).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { leaderboardResponse, launchesApiResponse } from '../lib/pages.js';
import { currentWeek } from '../lib/launches.js';
import { lineupAnnouncedAt } from '../lib/time.js';
import { createDb, addLaunch } from './helpers/d1.js';

const ANNOUNCE = lineupAnnouncedAt('2026-11-23');   // Wednesday, Nov 18, 12:00 AM Central
const BEFORE = ANNOUNCE - 3600 * 1000, AFTER = ANNOUNCE + 3600 * 1000;
const req = path => new Request(`https://openorbia.com${path}`);
let db, env;
beforeEach(() => {
  db = createDb(); env = { DB: db, VOTE_SECRET: 'test-secret-0123456789abcdef' };
  addLaunch(db, { slug: 'alpha-tool', name: 'Alpha Tool', launch_date: '2026-11-23' });
  addLaunch(db, { slug: 'beta-tool', name: 'Beta Tool', launch_date: '2026-11-23' });
});

test('the lineup is announced on the Wednesday before launch day', async () => {
  assert.equal(new Date(ANNOUNCE).toISOString(), '2026-11-18T06:00:00.000Z');
  assert.equal((await currentWeek(db, BEFORE)).announced, false);
  assert.equal((await currentWeek(db, AFTER)).announced, true);
});

test('before the announcement the API names no launch and /launches/ shows the intro with the lineup date', async () => {
  const api = await (await launchesApiResponse({ request: req('/api/launches?limit=6'), env, now: BEFORE })).json();
  assert.equal(api.week, 1);
  assert.equal(api.total, 0);
  assert.deepEqual(api.launches, []);
  assert.equal(api.lineup_at, '2026-11-18T06:00:00.000Z');
  const html = await (await leaderboardResponse({ request: req('/launches/'), env, now: BEFORE })).text();
  assert.ok(!html.includes('Alpha Tool') && !html.includes('Beta Tool'), 'no launch named');
  assert.ok(html.includes('<p class="lw-lineup">Lineup announced Wednesday, Nov 18</p>'));
});

test('from the announcement the API and /launches/ show the lineup, nothing padded', async () => {
  const api = await (await launchesApiResponse({ request: req('/api/launches?limit=6'), env, now: AFTER })).json();
  assert.equal(api.total, 2);
  assert.deepEqual(api.launches.map(l => l.slug), ['alpha-tool', 'beta-tool']);
  assert.ok(api.launches.every(l => l.votes === null && l.rank === null), 'no votes or ranks before voting opens');
  const html = await (await leaderboardResponse({ request: req('/launches/'), env, now: AFTER })).text();
  assert.ok(html.includes('Alpha Tool') && html.includes('Beta Tool'));
  assert.ok(!html.includes('lw-lineup'));
});

// The homepage week box with a small fake DOM
function homepage(api) {
  const made = [];
  const node = tag => { const n = { tag, className: '', textContent: '', children: [], attrs: {}, dataset: {}, append(...c) { n.children.push(...c); }, setAttribute(k, v) { n.attrs[k] = v; } }; made.push(n); return n; };
  let inserted = null, dateRemoved = false;
  const cta = { href: '#join', textContent: 'Get the lineup by email', parentElement: { before: n => { inserted = n; } } };
  const nodes = { '[data-lineup-cta]': cta, '[data-lineup-date]': { remove: () => { dateRemoved = true; } } };
  const root = { querySelector: s => nodes[s] || null, replaceChildren() {} };
  const ctx = {
    document: { getElementById: id => (id === 'week-live' ? root : null), addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, createElement: node },
    fetch: url => { ctx.asked = url; return Promise.resolve({ ok: true, json: () => Promise.resolve(api) }); }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    navigator: {}, getSelection: () => ({}), WeakMap, Date, Number, String, Math, JSON, URL, Intl, Set, console, location: { pathname: '/' },
  };
  ctx.window = ctx;
  vm.runInNewContext(readFileSync(new URL('../public/assets/launch.js', import.meta.url), 'utf8'), ctx);
  return new Promise(r => setTimeout(() => r({ cta, inserted, dateRemoved, made, asked: ctx.asked }), 20));
}

test('homepage: once announced, next Monday\'s lineup is listed (up to 6) above the button; before, the email offer stays', async () => {
  const launches = Array.from({ length: 6 }, (_, i) => ({ slug: `t${i}`, name: `Tool ${i}`, tagline: 'x', category_name: 'Small businesses', logo_url: null, signal: i === 0 ? 'Runs free · Desktop app' : null }));
  const after = await homepage({ ok: true, week: 1, open: false, total: 8, label: 'Monday, Nov 23, 2026', now: AFTER, launches });
  assert.ok(after.asked.includes('limit=6'));
  assert.ok(after.inserted, 'the list is placed before the button');
  assert.equal(after.inserted.className, 'mini mini-lineup');
  assert.equal(after.inserted.attrs['aria-label'], 'Launching Monday, Nov 23, 2026');
  assert.equal(after.inserted.children.length, 6);
  assert.deepEqual(after.made.filter(n => n.tag === 'b').map(n => n.textContent), launches.map(l => l.name));
  assert.ok(!after.made.some(n => n.className === 'vote' || n.className === 'mini-rank'), 'no votes or ranks before voting opens');
  assert.ok(after.made.some(n => n.className === 'mini-signal' && n.textContent === 'Runs free · Desktop app'));
  assert.equal(after.cta.textContent, 'See all 8 launches →');
  assert.ok(after.dateRemoved);
  // two launches: both listed, the button says "See the lineup", nothing padded
  const two = await homepage({ ok: true, week: 1, open: false, total: 2, label: 'Monday, Nov 23, 2026', now: AFTER, launches: launches.slice(0, 2) });
  assert.equal(two.inserted.children.length, 2);
  assert.equal(two.cta.textContent, 'See the lineup →');
  // before the announcement the API sends no launches: the email offer and the date line stay
  const before = await homepage({ ok: true, week: 1, open: false, total: 0, label: 'Monday, Nov 23, 2026', now: BEFORE, launches: [], lineup_at: '2026-11-18T06:00:00.000Z' });
  assert.equal(before.inserted, null);
  assert.equal(before.cta.textContent, 'Get the lineup by email');
  assert.ok(!before.dateRemoved);
});
