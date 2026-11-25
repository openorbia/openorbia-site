// One form for the audience labels everywhere (the ?for= URLs stay biz, job, sec); Meetily's first result and Reactive
// Resume's free tier say what their docs say; the homepage week intro gives the launch time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORIES, toolBySlug } from '../public/assets/tools.js';
import { CATEGORIES as LAUNCH_CATEGORIES } from '../lib/launch-data.js';
import { CATEGORIES as FORM_CATEGORIES, AUDIENCES } from '../lib/forms.js';
import { MENUS } from '../lib/header.js';
import { esc } from '../lib/html.js';
import { staticFooter } from '../scripts/build-home.mjs';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const LABELS = { biz: 'Small businesses', job: 'Job seekers', sec: 'Security teams' };
const OLD = ['Small Business', 'Job Seekers', 'Cybersecurity &amp; SOC', 'Cybersecurity & SOC', 'A small business', 'A job seeker', 'A security team'];
const PAGES = ['public/index.html', 'public/launch-list/index.html', 'public/404.html', '.github/ISSUE_TEMPLATE/submit-a-tool.yml'];

test('the three audience labels are the same in every list of them', () => {
  assert.deepEqual(CATEGORIES, LABELS);
  assert.deepEqual(LAUNCH_CATEGORIES, LABELS);
  for (const [k, v] of Object.entries(LABELS)) {
    assert.equal(FORM_CATEGORIES[k], v);
    assert.equal(AUDIENCES[k], v);
  }
});

test('no page, menu, footer or form uses an old audience label, and the ?for= links are unchanged', () => {
  for (const [name, text] of [...PAGES.map(p => [p, file(p)]), ['header menu', MENUS.tools], ['footer', staticFooter()]]) {
    for (const old of OLD) assert.ok(!text.includes(old), `${name}: ${old}`);
  }
  for (const k of Object.keys(LABELS)) assert.ok(MENUS.tools.includes(`href="/launch-list/?for=${k}">${esc(LABELS[k])}</a>`), k);
});

test('Meetily\'s first result and Reactive Resume\'s free tier follow their docs', () => {
  const meetily = toolBySlug('meetily').facts.firstResult.canFinish;
  assert.equal(meetily, 'Record a meeting on your own computer and get a transcript and an AI summary, with transcription on your own computer (summaries stay local with Ollama).');
  const rr = toolBySlug('reactive-resume').facts;
  assert.equal(rr.freeTier, 'All resume features free at rxresu.me; MIT self-host too');
  assert.equal(rr.catch, 'AI writing help needs your own key or Ollama');
  const data = JSON.parse(file('data/free-facts.json'));
  assert.equal(data.find(e => e.repo === 'Zackriya-Solutions/meetily').firstResult.canFinish, meetily);
  assert.equal(data.find(e => e.repo === 'reactive-resume/reactive-resume').freeTier, rr.freeTier);
  assert.ok(!file('public/index.html').includes('audio never leaving your device'));
});

test('the homepage week intro says when launches happen and when voting closes, in Central time', () => {
  assert.ok(file('public/index.html').includes('<p class="week-intro" data-week-intro>New free AI tools launch every Monday. Upvote the ones you\'d use until Sunday at 11:59 PM Central.</p>'));
});

test('the homepage signup box speaks of Launch Week 1 as live and sends visitors to vote', () => {
  const home = file('public/index.html');
  const join = home.slice(home.indexOf('<section class="join"'), home.indexOf('<form id="wl"'));
  assert.ok(join.includes('Launch Week 1 is live'));
  // "Launch Week 1 is live" once (the badge); the next line sends visitors to vote without saying it again
  assert.ok(join.includes('<p><a href="/launches/">Vote for this week\'s free AI tools</a> now.</p>'));
  assert.equal(join.split('Launch Week 1 is').length - 1, 1, 'once');
  assert.ok(join.includes('a coming launch week'));
  for (const stale of ['Get in before the first launch', 'our first launch week']) assert.ok(!join.includes(stale), stale);
});

test('the one-day birthday line is hidden in the HTML and shown by home.js only on its date (Central time)', () => {
  assert.ok(file('public/index.html').includes('<p class="bday" id="bday" data-only-on="2026-11-23" hidden>Happy birthday, Zara! 🎂 Love, Dad</p>'));
  const js = file('public/assets/home.js');
  // the zone comes from <meta name="openorbia-launch-zone"> (lib/voting-window.js), which every page carries
  assert.ok(js.includes('meta[name="openorbia-launch-zone"]') && js.includes('timeZone:launchZone') && js.includes('===oneDay.dataset.onlyOn)oneDay.hidden=false'));
  assert.ok(file('public/index.html').includes('<meta name="openorbia-launch-zone" content="America/Chicago">'));
  const dayInCentral = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date(iso));
  assert.equal(dayInCentral('2026-11-23T06:00:00Z'), '2026-11-23'); // 12:00 AM Central: shown
  assert.equal(dayInCentral('2026-11-24T05:59:00Z'), '2026-11-23'); // 11:59 PM Central: still shown
  assert.equal(dayInCentral('2026-11-24T06:00:00Z'), '2026-11-24'); // the next day: hidden
});
