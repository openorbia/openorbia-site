// lib/voting-window.js: the one source for when voting opens and closes, and for every word the site uses about it
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vw from '../lib/voting-window.js';
import { launchOpensAt, launchClosesAt, LAUNCH_ZONE } from '../lib/time.js';
import { handleVote } from '../lib/vote.js';
import { launchLockHead } from '../lib/layout.js';
import { FIRST_LAUNCH_WEEK } from '../lib/site.js';
import { weekIntroText } from '../scripts/build-home.mjs';
import { createDb, addLaunch } from './helpers/d1.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const file = p => readFileSync(join(root, p), 'utf8');
// the clock the labels claim, read independently of lib/voting-window.js
const onClock = (ms, opts) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', ...opts }).format(ms).replace(/\s+/g, ' ');

// Mondays across a year, including the two weeks with a daylight saving change (spring forward Sun Mar 14, 2027; fall back Sun Nov 1, 2026)
const MONDAYS = ['2026-11-23', '2026-10-26', '2027-03-08', '2027-01-04', '2027-07-05', '2027-11-01'];

test('the zone is Central (the founder confirmed it on 2026-11-25), the IANA name, shared with the enforcement in lib/time.js', () => {
  assert.equal(vw.VOTING_ZONE, 'America/Chicago');
  assert.equal(vw.VOTING_ZONE, LAUNCH_ZONE);
  assert.equal(vw.zoneLabel(), 'Central');
});

test('the instants are exactly the ones lib/vote.js enforces, for every week', () => {
  for (const d of MONDAYS) {
    assert.equal(vw.opensAt(d), launchOpensAt(d), d);
    assert.equal(vw.closesAt(d), launchClosesAt(d), d);
  }
  assert.ok(Number.isNaN(vw.opensAt('2026-02-30')) && Number.isNaN(vw.closesAt('nope')));
});

test('the label and the enforced time can never disagree: each label is the enforced instant read on the launch clock', () => {
  for (const d of MONDAYS) {
    assert.equal(vw.opensText(d), `${onClock(launchOpensAt(d), { hour: 'numeric', minute: '2-digit', hour12: true })} Central`, d);
    assert.equal(vw.closesText(d), `${onClock(launchClosesAt(d), { hour: 'numeric', minute: '2-digit', hour12: true })} Central`, d);
    assert.equal(vw.opensDay(d), onClock(launchOpensAt(d), { weekday: 'long' }), d);
    assert.equal(vw.closesDay(d), onClock(launchClosesAt(d), { weekday: 'long' }), d);
    assert.equal(vw.opensText(d), '12:00 AM Central');
    assert.equal(vw.closesPhrase(d), 'Sunday at 11:59 PM Central');
  }
  assert.equal(vw.windowRange(), 'Monday 12:00 AM to Sunday 11:59 PM Central');
  assert.equal(vw.windowSentence(), 'Voting opens Monday at 12:00 AM Central and closes Sunday at 11:59 PM Central.');
});

test('DST-safe: the week with spring forward closes an hour earlier in UTC, the fall-back week an hour later, both at 11:59 PM Central', () => {
  const iso = ms => new Date(ms).toISOString();
  assert.equal(iso(vw.opensAt('2027-03-08')), '2027-03-08T06:00:00.000Z');    // CST
  assert.equal(iso(vw.closesAt('2027-03-08')), '2027-03-15T04:59:00.000Z');   // CDT after the change
  assert.equal(iso(vw.opensAt('2026-10-26')), '2026-10-26T05:00:00.000Z');    // CDT
  assert.equal(iso(vw.closesAt('2026-10-26')), '2026-11-02T05:59:00.000Z');   // CST after the change
  for (const d of ['2027-03-08', '2026-10-26']) assert.equal(vw.closesText(d), '11:59 PM Central');
});

test('what the vote API says matches what it enforces: the opening message before, the closing message from the close on', async () => {
  const db = createDb(), env = { DB: db, VOTE_SECRET: 'test-secret-0123456789abcdef' };
  addLaunch(db, { slug: 'spring', name: 'Spring', launch_week: 1, launch_date: '2027-03-08' });
  const vote = async now => {
    const res = await handleVote({ env, now, request: new Request('https://openorbia.com/api/vote', { method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.7', 'user-agent': `t${now}` }, body: JSON.stringify({ slug: 'spring' }) }) });
    return { status: res.status, json: await res.json() };
  };
  const before = await vote(vw.opensAt('2027-03-08') - 1);
  assert.equal(before.status, 403);
  assert.ok(before.json.error.endsWith(`at ${vw.opensText('2027-03-08')}.`));
  assert.equal((await vote(vw.closesAt('2027-03-08') - 1)).status, 200);
  const after = await vote(vw.closesAt('2027-03-08'));
  assert.equal(after.status, 403);
  assert.equal(after.json.error, `Voting closed ${vw.closesPhrase('2027-03-08')}.`);
  assert.equal(after.json.error, 'Voting closed Sunday at 11:59 PM Central.', 'the same words as before this change');
});

test('the launch meta values derive from the same source, on server pages and in the static pages', () => {
  assert.equal(vw.launchMetaContent(), new Date(launchOpensAt(FIRST_LAUNCH_WEEK.date)).toISOString());
  assert.equal(vw.launchMetaContent(), '2026-11-23T06:00:00.000Z');
  const head = launchLockHead();
  assert.ok(head.includes(`<meta name="openorbia-launch" content="${vw.launchMetaContent()}">`));
  assert.ok(head.includes(`<meta name="openorbia-launch-time" content="${vw.opensText()}">`));
  assert.ok(head.includes(`<meta name="openorbia-launch-zone" content="${vw.VOTING_ZONE}">`));
  for (const p of ['public/index.html', 'public/launch-list/index.html', 'public/404.html']) {
    assert.ok(file(p).includes(head), `${p}: run npm run build:home`);
  }
  assert.ok(file('public/index.html').includes(`<p class="week-intro" data-week-intro>${weekIntroText()}</p>`), 'run npm run build:home');
});

// ---- no other place writes a time zone ----

const ZONE_WORDS = /\b(?:Central|Pacific|Eastern|Mountain|CT|PT|ET|PST|PDT|CST|CDT|EST|EDT)\b/;
const walk = dir => readdirSync(join(root, dir)).flatMap(n => {
  const p = `${dir}/${n}`;
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});
// a line's code, without a trailing // comment and without lines that are comments
const codeOf = line => {
  const t = line.trim();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return '';
  return line.replace(/\s\/\/.*$/, '');
};

test('no page code writes a time zone itself: only lib/voting-window.js words it (comments aside)', () => {
  const files = [...walk('lib'), ...walk('functions'), ...walk('public/assets')]
    .filter(p => /\.(js|mjs)$/.test(p) && p !== 'lib/voting-window.js');
  const hits = [];
  for (const p of files) {
    file(p).split('\n').forEach((line, i) => { if (ZONE_WORDS.test(codeOf(line))) hits.push(`${p}:${i + 1}: ${line.trim().slice(0, 120)}`); });
  }
  assert.deepEqual(hits, []);
  // and no browser script names an IANA zone: they read it from <meta name="openorbia-launch-zone">
  const named = walk('public/assets').filter(p => p.endsWith('.js') && /timeZone:\s*['"]/.test(file(p)));
  assert.deepEqual(named, []);
});

test('the static pages say a time zone only where build:home writes it from lib/voting-window.js', () => {
  for (const p of ['public/index.html', 'public/launch-list/index.html', 'public/404.html']) {
    const generated = [launchLockHead(), weekIntroText()];
    let html = file(p);
    for (const g of generated) html = html.split(g).join('');
    const hits = html.split('\n').filter(l => ZONE_WORDS.test(l));
    assert.deepEqual(hits, [], p);
  }
});
