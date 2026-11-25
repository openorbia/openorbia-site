// PR E: the homepage's featured cards never show a gap, and each shows its own tool's docs-checked date
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOLS, canFeature, toolBySlug } from '../public/assets/tools.js';
import { formatChecked } from '../public/assets/facts.js';
import { pickFeatured } from '../lib/featured.js';
import { confidenceByRepo } from '../scripts/build-home.mjs';

const home = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const cards = () => [...home.matchAll(/<article class="ft" data-tool-slug="([^"]+)">([\s\S]*?)<\/article>/g)].map(m => ({ slug: m[1], html: m[2] }));

test('the homepage shows exactly the five picks, and none of them has a Not confirmed card, free tier or catch', () => {
  const picks = pickFeatured(TOOLS, confidenceByRepo).map(p => p.tool.slug);
  assert.deepEqual(cards().map(c => c.slug), picks, 'run npm run build:home');
  assert.equal(picks.length, 5);
  for (const c of cards()) assert.ok(!c.html.includes('Not confirmed'), `${c.slug} shows a gap`);
});

test('a tool whose card fact is Not confirmed is never featured: Reactive Resume (not stated in its docs) gives way to Resume Matcher', () => {
  const rr = toolBySlug('reactive-resume');
  assert.equal(rr.facts.cardRequired, 'unknown', 'its README and docs say "no paid tier" but never mention a card (checked again 2026-11-25)');
  assert.equal(canFeature(rr), false);
  assert.ok(!cards().some(c => c.slug === 'reactive-resume'));
  assert.ok(cards().some(c => c.slug === 'resume-matcher'), 'the job seekers slot');
  for (const t of TOOLS.filter(canFeature)) assert.ok(['yes', 'no'].includes(t.facts.cardRequired), t.name);
});

test('each card\'s "Docs checked" date is that tool\'s own lastChecked, never another date', () => {
  for (const c of cards()) {
    const t = toolBySlug(c.slug);
    const want = formatChecked(t.facts.lastChecked);
    assert.ok(want, `${t.name} has a real lastChecked`);
    const shown = [...c.html.matchAll(/Docs checked ([A-Z][a-z]{2} \d{1,2}, \d{4})/g)].map(m => m[1]);
    assert.deepEqual(shown, [want], t.name);
  }
});

test('the founder\'s tools (SOC Range) and HexStrike AI are never featured', () => {
  for (const slug of ['soc-range', 'hexstrike-ai']) {
    assert.equal(canFeature(toolBySlug(slug)), false, slug);
    assert.ok(!cards().some(c => c.slug === slug), slug);
  }
  assert.ok(TOOLS.filter(t => t.founder).every(t => !canFeature(t)));
});
