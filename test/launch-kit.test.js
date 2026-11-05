// The maker kit at /launch/<slug>/kit/ (lib/launch-kit.js)
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { kitResponse, renderKit, xPost, linkedInPost, xShareUrl, linkedInShareUrl, readmeLine, badgeAllowed, X_MAX } from '../lib/launch-kit.js';
import { renderLaunch } from '../lib/pages.js';
import { sitemapXml, STATIC_PATHS } from '../lib/seo.js';
import { launchOpensAt, launchClosesAt, dayLabelLong } from '../lib/time.js';
import { esc } from '../lib/html.js';
import { createDb, addLaunch } from './helpers/d1.js';

const file = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const OPENS = launchOpensAt('2026-11-23');
const BEFORE = OPENS - 3 * 24 * 3600 * 1000;
const AFTER = OPENS + 2 * 24 * 3600 * 1000;
const ENDED = launchClosesAt('2026-11-23') + 60 * 1000;

const SAMPLE = {
  slug: 'sample-business-tool', name: 'Sample Business Tool', tagline: 'Placeholder entry for previewing a Small Business launch',
  description: 'Sample.', category: 'biz', license: 'MIT', launch_week: 1, launch_date: '2026-11-23',
  screenshots: [], maker_links: [], maker_name: 'Sam', maker_story: '', facts: { freeTier: 'Everything, self-hosted' },
};
const kit = (now, over = {}) => renderKit({ launch: { ...SAMPLE, ...over }, now });

let env;
beforeEach(() => { env = { DB: createDb() }; });

test('the kit renders for a sample launch from D1: noindex, the launch link with a Copy button, and every section', async () => {
  addLaunch(env.DB, { slug: 'sample-business-tool', name: 'Sample Business Tool', tagline: SAMPLE.tagline, category: 'biz', launch_date: '2026-11-23', facts: JSON.stringify(SAMPLE.facts) });
  const res = await kitResponse({ env, params: { slug: 'sample-business-tool' }, now: AFTER });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  const html = await res.text();
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
  assert.ok(html.includes('data-copy="https://openorbia.com/launch/sample-business-tool/"'));
  for (const h of ['Your launch link', 'Ready-to-post text', 'Badge', 'README snippet', 'Key dates']) assert.ok(html.includes(`>${h}</h2>`), h);
  assert.ok(html.includes('<a href="/launch/sample-business-tool/">Sample Business Tool</a>'), 'breadcrumb back to the launch');
});

test('an unknown or malformed slug is a 404, and no database is a 503', async () => {
  assert.equal((await kitResponse({ env, params: { slug: 'nope' }, now: AFTER })).status, 404);
  assert.equal((await kitResponse({ env, params: { slug: '../x' }, now: AFTER })).status, 404);
  assert.equal((await kitResponse({ env: {}, params: { slug: 'sample-business-tool' }, now: AFTER })).status, 503);
});

test('the X post fits in 280 characters with the link, even for a very long name and tagline, and says "launching today on OpenOrbia"', () => {
  for (const l of [SAMPLE, { ...SAMPLE, name: 'N'.repeat(120), tagline: 'word '.repeat(80), slug: 'a'.repeat(64) }]) {
    const x = xPost(l);
    assert.ok(x.length <= X_MAX, `${x.length}`);
    assert.ok(x.includes('Launching today on OpenOrbia. Check it out: https://openorbia.com/launch/'));
    assert.ok(x.endsWith(`https://openorbia.com/launch/${l.slug}/`));
  }
  assert.equal(xPost(SAMPLE), 'Sample Business Tool: Placeholder entry for previewing a Small Business launch.\n\nLaunching today on OpenOrbia. Check it out: https://openorbia.com/launch/sample-business-tool/');
});

test('the LinkedIn post is 3 to 5 short lines: what it does, what is free, launch day, the link', () => {
  const lines = linkedInPost(SAMPLE).split('\n\n');
  assert.ok(lines.length >= 3 && lines.length <= 5, String(lines.length));
  assert.deepEqual(lines, [
    'Sample Business Tool: Placeholder entry for previewing a Small Business launch.',
    'Free: Everything, self-hosted.',
    'It’s launching today on OpenOrbia.',
    'Try it and tell me what you think: https://openorbia.com/launch/sample-business-tool/',
  ]);
  assert.equal(linkedInPost({ ...SAMPLE, facts: {} }).split('\n\n').length, 3, 'no free tier listed: that line is left out');
});

test('the posts use only the listed facts and never ask for votes', () => {
  const html = kit(AFTER);
  const posts = [xPost(SAMPLE), linkedInPost(SAMPLE)].join('\n');
  for (const bad of [/upvot/i, /\bvote/i, /support (me|us)/i, /\bbest\b/i, /#1\b/]) {
    assert.ok(!bad.test(posts), `posts: ${bad}`);
  }
  const visible = html.slice(html.indexOf('<div class="mk kit">'), html.indexOf('</main>') > 0 ? html.indexOf('</main>') : undefined);
  assert.ok(!/upvote me|vote for (me|us)|vote trad|upvote for upvote/i.test(visible));
  assert.ok(/check it out/i.test(posts) && /try it/i.test(posts));
});

test('every link in the kit is https or a path on this site, and the share links are plain links to X and LinkedIn', () => {
  const html = kit(AFTER);
  const body = html.slice(html.indexOf('<nav class="crumbs"'), html.indexOf('<footer>'));
  for (const [, href] of body.matchAll(/href="([^"]+)"/g)) assert.ok(href.startsWith('https://') || href.startsWith('/'), href);
  assert.ok(xShareUrl(SAMPLE).startsWith('https://twitter.com/intent/tweet?text='));
  assert.equal(decodeURIComponent(xShareUrl(SAMPLE).split('?text=')[1]), xPost(SAMPLE));
  assert.equal(linkedInShareUrl(SAMPLE), 'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fopenorbia.com%2Flaunch%2Fsample-business-tool%2F');
  assert.ok(html.includes(`href="${esc(xShareUrl(SAMPLE))}" target="_blank" rel="noopener">Share on X ↗</a>`));
  assert.ok(html.includes(`href="${esc(linkedInShareUrl(SAMPLE))}" target="_blank" rel="noopener">Share on LinkedIn ↗</a>`));
});

test('no inline scripts or event handlers, and no third-party scripts', () => {
  const html = kit(AFTER);
  // every <script tag is one of the site's own files: <script src="/assets/...
  let at = html.indexOf('<script'), n = 0;
  for (; at !== -1; at = html.indexOf('<script', at + 1), n++) assert.ok(html.startsWith('<script src="/assets/', at), html.slice(at, at + 60));
  assert.ok(n >= 1, 'the shared launch.js is loaded');
  for (const h of [' onclick=', ' onload=', ' onerror=', ' onmouseover=', ' onfocus=', 'javascript:']) assert.ok(!html.toLowerCase().includes(h), h);
});

test('everything from the launch is escaped', () => {
  const html = kit(AFTER, { name: '<img src=x onerror=alert(1)>', tagline: '"><script>alert(1)</script>', facts: { freeTier: '<b>x</b>' } });
  assert.ok(!html.includes('<img src=x') && !html.includes('<script>alert') && !html.includes('<b>x</b>'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('the badge follows the rule on /makers/: offered only once the launch is featured (from launch day), linking to the launch page', () => {
  assert.ok(file('lib/makers.js').includes('Every launch is featured on OpenOrbia from its launch day.'));
  assert.equal(badgeAllowed(SAMPLE, BEFORE), false);
  assert.equal(badgeAllowed(SAMPLE, OPENS), true);
  const before = kit(BEFORE), after = kit(AFTER);
  assert.ok(!before.includes('/badge/featured-dark.svg') && before.includes('Your badge snippets appear here then.'));
  for (const f of ['featured-dark.svg', 'featured-light.svg']) {
    assert.ok(existsSync(new URL(`../public/badge/${f}`, import.meta.url)), f);
    assert.ok(after.includes(esc(`[![Featured on OpenOrbia](https://openorbia.com/badge/${f})](https://openorbia.com/launch/sample-business-tool/)`)), `${f}: markdown`);
    assert.ok(after.includes(esc(`<a href="https://openorbia.com/launch/sample-business-tool/"><img src="https://openorbia.com/badge/${f}" alt="Featured on OpenOrbia" width="193" height="56"></a>`)), `${f}: html`);
  }
});

test('the README snippet is one line, with the badge in front once it is allowed', () => {
  assert.equal(readmeLine(SAMPLE, BEFORE), 'Sample Business Tool is on OpenOrbia: [see the launch](https://openorbia.com/launch/sample-business-tool/).');
  assert.ok(readmeLine(SAMPLE, AFTER).startsWith('[![Featured on OpenOrbia](https://openorbia.com/badge/featured-dark.svg)]'));
});

test('key dates come from lib/time.js: launch day, voting closes Sunday 11:59 PM Pacific, and the results page', () => {
  const html = kit(AFTER, { launch_date: '2027-03-08', launch_week: 16 });   // a week with a daylight saving change
  assert.ok(html.includes(`<b>Launch day:</b> ${dayLabelLong(launchOpensAt('2027-03-08'))}, 12:01 AM Pacific.`));
  assert.ok(html.includes(`<b>Voting closes:</b> ${dayLabelLong(launchClosesAt('2027-03-08'))}, 11:59 PM Pacific.`));
  assert.ok(dayLabelLong(launchClosesAt('2027-03-08')).startsWith('Sunday, Mar 14'));
  assert.ok(html.includes('<a href="https://openorbia.com/launches/week-16/results/">Launch Week 16 results</a> (the final ranks appear when voting closes).'));
  assert.ok(kit(ENDED).includes('Launch Week 1 results</a>.</li>'));
  assert.ok(!file('lib/launch-kit.js').includes('2026-11-'), 'no hard-coded dates');
});

test('the launch page links to its kit as "Maker kit"', () => {
  const html = renderLaunch({ launch: { ...SAMPLE, votes: 0 }, now: AFTER });
  assert.ok(html.includes('<a href="/launch/sample-business-tool/kit/">Maker kit</a>'));
});

test('the kit is not in the sitemap, and has its route and its own security-headers middleware', () => {
  const xml = sitemapXml(['sample-business-tool']);
  assert.ok(!xml.includes('/kit/'));
  assert.ok(!STATIC_PATHS.some(p => p.includes('kit')));
  assert.ok(file('functions/launch/[slug]/kit/index.js').includes("import { kitResponse } from '../../../../lib/launch-kit.js';"));
  assert.ok(file('functions/launch/[slug]/kit/_middleware.js').includes("export { onRequest } from '../../../../lib/security-headers.js';"));
});
