// One form for the audience labels everywhere (the ?for= URLs stay biz, job, sec); Meetily's first result and Reactive
// Resume's free tier say what their docs say; the homepage week intro gives the launch time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORIES, toolBySlug } from '../public/assets/tools.js';
import { CATEGORIES as LAUNCH_CATEGORIES } from '../lib/launch-data.js';
import { CATEGORIES as FORM_CATEGORIES, AUDIENCES } from '../lib/forms.js';
import { MENUS } from '../lib/header.js';
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
  for (const k of Object.keys(LABELS)) assert.ok(MENUS.tools.includes(`href="/launch-list/?for=${k}">${LABELS[k].replace('&', '&amp;')}</a>`), k);
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

test('the homepage week intro gives the day and time', () => {
  assert.ok(file('public/index.html').includes('<p class="week-intro" data-week-intro>The first launch week goes live Monday, Nov 23, 2026 at 12:01 AM Pacific.</p>'));
});
