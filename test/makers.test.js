import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderMakers, makersResponse } from '../lib/makers.js';
import { renderNotFound } from '../lib/pages.js';
import { layout, MARK } from '../lib/layout.js';
import { headerHtml } from '../lib/header.js';

const root = new URL('../', import.meta.url);
const html = renderMakers();
const text = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ');

test('/makers/ covers what makers get, the rules, the free facts, the checklist and Launch Week 1', () => {
  for (const t of ['A launch page', 'Community upvotes', 'A feature', 'LinkedIn and X', 'newsletter', 'All of it free',
    'open-source license, or a real free plan', 'No trials and no credit card', 'Updated in the last 6 months', 'AI is a core part',
    "What's free", 'Card required', 'Where your data goes', 'Setup', 'The catch', 'Last checked',
    'Logo, 512px square', 'Tagline, up to 60 characters', 'Description, 2 to 3 sentences', '3 to 5 screenshots', '60-second video or GIF', 'Links: website and source code', 'Your name and handles', 'Your maker story',
    'Launch Week 1', 'Monday, Nov 23', '12:01 AM Pacific']) assert.ok(text.includes(t), t);
});

test('/makers/ says every launch is featured from its launch day, and points to the maker kit for the badge', () => {
  assert.ok(text.includes('Featured on OpenOrbia badge Every launch is featured on OpenOrbia from its launch day. Show it off: your maker kit has the badge ready to paste. Paste a badge into your README or website.'));
  assert.ok(!text.includes('Once your tool is featured'));
});

test('/makers/ has the two buttons and the address as text with a copy button', () => {
  assert.match(html, /<a class="btn pri" href="https:\/\/github\.com\/openorbia\/openorbia-site\/issues\/new\?template=submit-a-tool\.yml"[^>]*>Submit via GitHub<\/a>/);
  assert.match(html, /<a class="btn ghost" href="mailto:launch@openorbia\.com">Email launch@openorbia\.com<\/a>/);
  assert.match(html, /<code id="mk-mail">launch@openorbia\.com<\/code><button class="copy" type="button" data-copy="launch@openorbia\.com"/);
  assert.match(readFileSync(new URL('public/assets/launch.js', root), 'utf8'), /\[data-copy\]/);
});

test('/makers/ is a normal page: one h1, skip link, canonical, 200 HTML', async () => {
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.ok(html.includes('class="skip"') && html.includes('id="main"'));
  assert.match(html, /<link rel="canonical" href="https:\/\/openorbia\.com\/makers\/">/);
  const res = makersResponse();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
});

test('every page has the same nav (Tools, Launches, Makers, Submit a tool), and the homepage points to it too', () => {
  const file = f => readFileSync(new URL(f, root), 'utf8');
  const NAV = headerHtml(MARK);
  for (const [name, h] of Object.entries({ layout: layout({ title: 't', description: 'd', path: '/', body: '' }), notFound: renderNotFound(), home: file('public/index.html'), list: file('public/launch-list/index.html'), notFoundStatic: file('public/404.html') })) {
    assert.ok(h.includes(NAV), name + ': nav');
  }
  assert.ok(NAV.includes('<a class="mm-top" href="/makers/">Makers</a>'), 'the nav names For makers');
  assert.ok(file('public/index.html').includes('<a href="/makers/">see how launching works</a>'));
});
