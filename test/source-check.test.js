import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourceTargets, toFetchUrl, pageText, pricingLines, snapshotOf, compare, buildReport, needsLook, robotsRules, robotsAllows, robotsPolicy, tooSoon, byHost, codeSpan, capReport, ISSUE_BODY_MAX, USER_AGENT } from '../lib/source-check.js';

test('GitHub README and blob links are fetched as raw files; other pages lose their #hash', () => {
  assert.equal(toFetchUrl('https://github.com/ollama/ollama#readme'), 'https://raw.githubusercontent.com/ollama/ollama/HEAD/README.md');
  assert.equal(toFetchUrl('https://github.com/twentyhq/twenty/blob/main/packages/docs/pricing.mdx'), 'https://raw.githubusercontent.com/twentyhq/twenty/main/packages/docs/pricing.mdx');
  assert.equal(toFetchUrl('https://ollama.com/pricing#plans'), 'https://ollama.com/pricing');
});

test('every source in free-facts.json becomes one target, shared sources list every tool', () => {
  const facts = JSON.parse(readFileSync(new URL('../data/free-facts.json', import.meta.url), 'utf8'));
  const targets = sourceTargets(facts);
  assert.equal(targets.length, new Set(facts.flatMap(t => t.sources || [])).size);
  for (const t of targets) { assert.ok(t.tools.length >= 1); new URL(t.fetchUrl); }
  assert.deepEqual(sourceTargets([{ name: 'A', sources: ['https://x.test/'] }, { name: 'B', sources: ['https://x.test/'] }])[0].tools, ['A', 'B']);
});

test('page text drops scripts and tags, keeps one line per block, decodes entities', () => {
  const html = '<!doctype html><html><head><title>x</title></head><body><script>var a=1</script><h1>Pricing</h1><p>Free &amp; open&nbsp;source</p><div>Pro: $20 <b>per month</b></div></body></html>';
  assert.equal(pageText(html, 'text/html'), 'Pricing\nFree & open source\nPro: $20 per month');
  assert.equal(pageText('# Title\n\n  Free   tier\n', 'text/plain'), '# Title\nFree tier');
});

test('pricing lines are the ones a free listing depends on', () => {
  const lines = pricingLines('Install with brew\nFree for personal use\nTeam plan $10 per seat\nNo credit card needed\nChangelog');
  assert.deepEqual(lines, ['Free for personal use', 'Team plan $10 per seat', 'No credit card needed']);
});

test('compare says what happened to a page', () => {
  const old = snapshotOf('Docs\nFree forever\nInstall');
  const ok = text => ({ ok: true, httpStatus: 200, snapshot: snapshotOf(text) });
  assert.equal(compare(undefined, ok('x y z')).status, 'new');
  assert.equal(compare(old, ok('Docs\nFree forever\nInstall')).status, 'unchanged');
  assert.equal(compare(old, ok('Docs\nFree forever\nInstall now')).status, 'changed');
  assert.deepEqual(compare(old, ok('Docs\nFree 14-day trial\nInstall')), { status: 'pricing', added: ['Free 14-day trial'], removed: ['Free forever'] });
  assert.equal(compare(old, { ok: false, httpStatus: 404 }).status, 'broken');
  assert.deepEqual(compare(old, { ok: false, error: 'timed out after 20s' }), { status: 'error', detail: 'timed out after 20s' });
});

test('the report leads with listings to check and asks for a look only when one is needed', () => {
  const results = [
    { url: 'https://a.test/pricing', tools: ['A'], status: 'pricing', added: ['Free 14-day trial'], removed: ['Free forever'] },
    { url: 'https://b.test/', tools: ['B'], status: 'broken', detail: 'HTTP 404' },
    { url: 'https://c.test/', tools: ['C'], status: 'unchanged' },
  ];
  const md = buildReport(results, '2026-11-09');
  assert.match(md, /^# Source check, 2026-11-09/);
  assert.match(md, /3 official pages checked\. 1 with pricing words changed, 1 broken/);
  assert.ok(md.indexOf('## Check these listings') < md.indexOf('## Broken source links'));
  assert.match(md, /Now says:\n {4}- ` Free 14-day trial `/);
  assert.match(md, /No longer says:\n {4}- ` Free forever `/);
  assert.equal(needsLook(results), true);
  assert.equal(needsLook([{ status: 'changed' }, { status: 'error' }, { status: 'unchanged' }]), false);
  assert.match(buildReport([{ url: 'https://c.test/', tools: ['C'], status: 'new' }], '2026-11-09'), /First run/);
});
