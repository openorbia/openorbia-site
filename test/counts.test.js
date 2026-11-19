// PR 1 part e: every public count comes from the data. The homepage makers line comes from lib/site.js, and the Launch List's
// counts from the Launch List, all written by npm run build:home; the pages must match what it writes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOLS } from '../public/assets/tools.js';
import { needsPaidService } from '../public/assets/facts.js';
import { listCounts, withListCounts } from '../scripts/build-home.mjs';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('the Launch List counts on the page are the ones build:home writes from the data', () => {
  const list = file('public/launch-list/index.html');
  assert.equal(withListCounts(list), list, 'run npm run build:home');
  const { free, paid } = listCounts();
  assert.equal(free + paid, TOOLS.length);
  assert.equal(paid, TOOLS.filter(t => needsPaidService(t.facts)).length);
  assert.ok(list.includes(`<h1>${free} AI tools that run free,`));
  assert.ok(list.includes(`<p class="note">${paid} more tool${paid === 1 ? ' needs' : 's need'} a paid service`));
});

test('withListCounts rewrites every count, with the right singular or plural', () => {
  const list = file('public/launch-list/index.html');
  const out = withListCounts(list, { free: 7, paid: 1 });
  for (const s of ['<title>Launch List: 7 AI tools that run free', 'content="7 free and open-source AI tools that run without a paid service',
    'The OpenOrbia Launch List: 7 AI tools that run free', '<h1>7 AI tools that run free,', '<p class="note">1 more tool needs a paid service']) assert.ok(out.includes(s), s);
  assert.throws(() => withListCounts('<html></html>'), /expected one/, 'a page without the counts stops the build');
});

// removed 2026-11-19: the founder took the "3 makers confirmed · 26 invited" line off the site (test/homepage.test.js checks it is gone)

test('no page states a reader, subscriber or user count, or an old makers number', () => {
  const pages = ['public/index.html', 'public/launch-list/index.html', 'public/404.html'].map(file).join('\n');
  assert.ok(!/\b\d[\d,]*\+? (subscribers|readers|users|members|signups)\b/i.test(pages));
  assert.ok(!/\b23 makers\b/.test(pages));
});
