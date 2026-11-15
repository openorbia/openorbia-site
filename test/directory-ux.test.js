// PR 10A: directory UX. Every tool card (homepage featured tools and the Launch List) shows Free, Card and Catch, then
// "✓ Docs checked <date>", and "✓ Hands-on tested" only with testedBy and testedOn, both linking to /how-we-check/; the homepage has
// the Launch List search with its filters above the featured tools, and the signup right under the hero; "No ads. No paid
// placement. No affiliate links." is on the homepage, /how-we-check/ and /makers/, and the code has nothing that contradicts it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardRows, cardFactsHtml, HOW_WE_CHECK } from '../public/assets/facts.js';
import { TOOLS, CATEGORIES } from '../public/assets/tools.js';
import { parseFilters, emptyFilters, SETUP_FILTERS } from '../public/assets/launch-filters.js';
import { renderHowWeCheck } from '../lib/how-we-check.js';
import { renderMakers } from '../lib/makers.js';

const root = new URL('../', import.meta.url);
const file = f => readFileSync(new URL(f, root), 'utf8');
const home = file('public/index.html');
const PLEDGE = 'No ads. No paid placement. No affiliate links.';

test('a card shows three rows, Free, Card and Catch, and says "Not confirmed" for a missing fact', () => {
  assert.deepEqual(cardRows({ freeTier: 'All of it', cardRequired: 'no', catch: 'Needs Docker' }), [['Free', 'All of it'], ['Card', 'No'], ['Catch', 'Needs Docker']]);
  assert.deepEqual(cardRows({ cardRequired: 'yes' }).map(r => r[1]), ['Not confirmed', 'Yes', 'Not confirmed']);
  assert.deepEqual(cardRows({ cardRequired: 'unknown' })[1], ['Card', 'Not confirmed']);
  assert.deepEqual(cardRows(null).map(r => r[1]), ['Not confirmed', 'Not confirmed', 'Not confirmed']);
  assert.ok(cardFactsHtml({ freeTier: '<b>&"\'' }).includes('<dd>&lt;b&gt;&amp;&quot;&#39;</dd>'), 'escaped');
});

test('"Docs checked <date>" when the docs were checked, "Hands-on tested" only with testedBy and testedOn, both to /how-we-check/', () => {
  const base = { freeTier: 'x', cardRequired: 'no', catch: 'y', lastChecked: '2026-11-10' };
  const docs = `<a class="mark mark-docs" href="${HOW_WE_CHECK}"><span aria-hidden="true">✓</span> Docs checked Nov 10, 2026</a>`;
  const tested = `<a class="mark mark-tested" href="${HOW_WE_CHECK}"><span aria-hidden="true">✓</span> Hands-on tested</a>`;
  assert.equal(HOW_WE_CHECK, '/how-we-check/');
  assert.ok(cardFactsHtml(base).includes(docs));
  assert.ok(!cardFactsHtml(base).includes('Hands-on tested'));
  assert.ok(!cardFactsHtml({ ...base, testedBy: 'OpenOrbia' }).includes('Hands-on tested'), 'testedBy alone is not enough');
  assert.ok(!cardFactsHtml({ ...base, testedOn: '2026-11-01' }).includes('Hands-on tested'), 'testedOn alone is not enough');
  assert.ok(cardFactsHtml({ ...base, testedBy: 'OpenOrbia', testedOn: '2026-11-01' }).includes(tested));
  assert.ok(!cardFactsHtml({ freeTier: 'x' }).includes('Docs checked'), 'no date, no docs mark');
});

test('every tool on the Launch List gets all three rows and a docs-checked date, and none is hands-on tested yet', () => {
  for (const t of TOOLS) {
    const html = cardFactsHtml(t.facts);
    for (const k of ['Free', 'Card', 'Catch']) assert.ok(html.includes(`<dt>${k}</dt>`), `${t.slug}: ${k}`);
    assert.ok(html.includes('Docs checked '), `${t.slug}: docs checked`);
    assert.ok(!html.includes('Hands-on tested'), `${t.slug}: not hands-on tested`);
  }
});

test('the homepage search goes to the Launch List with the same filters, above the featured tools', () => {
  const s = home.slice(home.indexOf('<section class="hsearch"'), home.indexOf('<section class="featured"'));
  assert.ok(s.length > 0 && home.indexOf('<section class="hsearch"') < home.indexOf('<section class="featured"'));
  assert.ok(s.includes('<form class="hs" action="/launch-list/" method="get" role="search">'));
  assert.match(s, /<input id="hs-q" name="q" type="search"[^>]*aria-label="Search free AI tools"/);
  const opts = name => { const a = s.indexOf(`<select name="${name}">`); return [...s.slice(a, s.indexOf('</select>', a)).matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map(m => [m[1], m[2]]); };
  assert.deepEqual(opts('for').slice(1), Object.entries(CATEGORIES));
  assert.deepEqual(opts('setup').slice(1), Object.entries(SETUP_FILTERS));
  for (const c of ['name="os" value="1"', 'name="local" value="1"', 'name="free" value="1" checked']) assert.ok(s.includes(`<input type="checkbox" ${c}>`), c);
  assert.ok(s.indexOf('name="free" value="1" checked') < s.indexOf('<input type="hidden" name="free" value="0">'), 'the hidden free=0 comes after the box');
  // what the form sends, read by the Launch List: untouched it is the default view; unticking Runs free turns it off
  assert.deepEqual(parseFilters('?q=&for=&setup=&free=1&free=0'), emptyFilters());
  assert.deepEqual(parseFilters('?q=resume&for=job&setup=browser&os=1&free=0'), { ...emptyFilters(), q: 'resume', for: 'job', setup: 'browser', os: true, free: false });
});

test('the signup sits right under the hero, with the Monday line and no subscriber counts or "trusted by"', () => {
  const join = home.slice(home.indexOf('<section class="join" id="join"'), home.indexOf('<section class="week"'));
  assert.ok(join.includes('<p class="join-line">Free AI tools with the catch shown, every Monday.</p>'));
  assert.ok(!/trusted by|\d[\d,]*\+? (subscribers|readers)/i.test(home));
});

test('"No ads. No paid placement. No affiliate links." is on the homepage, /how-we-check/ and /makers/, with the sponsor rule', () => {
  assert.ok(home.includes(`<p class="pledge">${PLEDGE}</p>`));
  assert.ok(renderMakers().includes(`<p class="pledge">${PLEDGE}</p>`));
  const hwc = renderHowWeCheck();
  assert.ok(hwc.includes(`<p class="pledge">${PLEDGE}</p>`));
  assert.ok(hwc.includes('If OpenOrbia ever takes a sponsor, it will never appear in listings, the Finder, launches or rankings, and it will always be labelled Sponsor.'));
});

test('nothing in the site code contradicts it: no ad scripts, affiliate or referral parameters, or sponsored spots', () => {
  const files = [];
  const walk = dir => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(js|mjs|html|json|css)$/.test(n)) files.push(p); } };
  for (const d of ['lib/', 'functions/', 'public/', 'data/']) walk(fileURLToPath(new URL(d, root)));
  const bad = /adsbygoogle|googlesyndication|doubleclick|carbonads|ethicalads|affiliate|[?&](ref|aff|utm_[a-z]+)=/i;
  assert.deepEqual(files.filter(p => bad.test(readFileSync(p, 'utf8').replaceAll(PLEDGE, ''))), [], 'the pledge itself aside');
  const csp = file('public/_headers').match(/script-src ([^;]+)/)[1];
  assert.equal(csp, "'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com", 'only our own scripts, the spam check and Cloudflare Web Analytics');
});
