import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ISSUES } from '../lib/newsletter-issues.js';
import { renderNewsletter, renderIssue, issueResponse, newsletterResponse, publishedIssues, issuePaths } from '../lib/newsletter.js';
import { STATIC_PATHS, sitemapXml } from '../lib/seo.js';
import { ROWS, slugOf } from '../public/assets/tools.js';

const slugs = new Set(ROWS.map(r => slugOf(r[0])));

test('/newsletter/ renders, is in the sitemap and has its Pages Functions', async () => {
  const html = renderNewsletter();
  assert.ok(html.includes('<title>Orbia Weekly | OpenOrbia</title>') && html.includes('<link rel="canonical" href="https://openorbia.com/newsletter/">'));
  assert.ok(STATIC_PATHS.includes('/newsletter/'));
  for (const f of ['index.js', '[slug].js', '_middleware.js']) assert.ok(existsSync(new URL(`../functions/newsletter/${f}`, import.meta.url)), f);
  assert.equal(newsletterResponse().status, 200);
});

test('a draft issue is never shown, has no page and is not in the sitemap', async () => {
  const draft = { ...ISSUES[0], slug: 'draft-x', title: 'Draft Only Title', published: false };
  const all = [...ISSUES, draft];
  assert.ok(!renderNewsletter(all).includes(draft.title));
  assert.equal(issueResponse(draft.slug, all).status, 404);
  assert.ok(!issuePaths(all).includes('/newsletter/draft-x/'));
});

test('every published issue has https sources, real Launch List picks and its own page', async () => {
  for (const i of publishedIssues()) {
    for (const n of i.news) assert.match(n.source.url ?? '', /^https:\/\//, `${i.slug}: ${n.headline}`);
    for (const p of i.picks) assert.ok(slugs.has(p.slug), `${i.slug}: ${p.slug}`);
    assert.equal(issueResponse(i.slug).status, 200);
    assert.ok(renderIssue(i).includes(i.title.replace(/&/g, '&amp;')));
    assert.ok(sitemapXml().includes(`/newsletter/${i.slug}/`));
  }
  assert.deepEqual(issuePaths(), publishedIssues().map(i => `/newsletter/${i.slug}/`));
});

test('every issue, draft or not, picks real tools, never claims to be tested, and has unique slugs', () => {
  assert.equal(new Set(ISSUES.map(i => i.slug)).size, ISSUES.length);
  for (const i of ISSUES) {
    for (const p of i.picks) assert.ok(slugs.has(p.slug), `${i.slug}: ${p.slug}`);
    assert.ok(!JSON.stringify(i).includes('Tested by OpenOrbia'));
  }
});

test('issue text is escaped', () => {
  const html = renderIssue({ slug: 'x', date: '2026-01-05', title: '<b>T</b>', summary: 's', news: [{ headline: '<i>h</i>', text: 't', source: { label: 'S', url: 'javascript:alert(1)' } }], picks: [], catch: 'c' });
  assert.ok(!html.includes('<b>T</b>') && !html.includes('<i>h</i>') && !html.includes('javascript:'));
});
