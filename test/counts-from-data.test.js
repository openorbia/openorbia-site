// Every public count on the homepage comes from data (PR C): the tools in the hero, the categories, how many tools are on more than
// one category page, the GitHub stars with their date, and each category card's "N tools".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOLS } from '../public/assets/tools.js';
import { MAIN_CATEGORIES, categoryTools, categoryStats, homeCategoriesHtml } from '../lib/categories.js';
import { starStats, homeStarsHtml } from '../lib/stars.js';

const file = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stars = JSON.parse(file('data/stars.json'));
const home = file('public/index.html');

test('the category cards add up to more than the tools only because some tools are on two pages, and every tool is on one', () => {
  const per = MAIN_CATEGORIES.map(c => categoryTools(c).map(t => t.slug));
  const all = per.flat();
  const unique = new Set(all);
  const s = categoryStats();
  assert.equal(s.categories, MAIN_CATEGORIES.length);
  assert.equal(s.listings, all.length);
  assert.equal(unique.size, TOOLS.length, 'every listed tool is on at least one category page');
  assert.equal(s.shared, [...unique].filter(slug => all.filter(x => x === slug).length > 1).length);
  assert.equal(s.listings, TOOLS.length + s.shared, 'with each tool on at most two pages, the cards add up to the tools plus the shared ones');
});

test('the homepage hero says exactly the counts in the data, with the stars date on the page', () => {
  const st = starStats(TOOLS, stars), c = categoryStats();
  const line = home.match(/<span class="proof-main">([\s\S]*?)<\/span><\/p>/)[1].replace(/<[^>]+>/g, '');
  assert.equal(line, `${TOOLS.length} tools across ${c.categories} categories (${c.shared} in more than one) · ${st.label} GitHub stars between them, as of ${st.checked} · every one checked`);
  assert.ok(!home.includes('title="Stars counted on GitHub'), 'the date is no longer only in a tooltip');
});

test('each category card shows its own count from data, and they add up to categoryStats().listings', () => {
  const shown = [...home.matchAll(/href="\/category\/([a-z-]+)\/"><span class="k">(\d+) tools?<\/span>/g)].map(m => [m[1], Number(m[2])]);
  assert.deepEqual(shown, MAIN_CATEGORIES.map(c => [c.slug, categoryTools(c).length]));
  assert.equal(shown.reduce((a, [, n]) => a + n, 0), categoryStats().listings);
  assert.ok(home.includes(homeCategoriesHtml()), 'run npm run build:home');
});

test('the stars never round up, and the total is the sum of the data', () => {
  const st = starStats(TOOLS, stars);
  assert.equal(st.total, TOOLS.reduce((a, t) => a + (stars.stars[t.repo] || 0), 0));
  const [, whole, tenth] = /^(\d+)(?:\.(\d))?M\+$/.exec(st.label) || [];
  assert.ok(whole, st.label);
  assert.ok(Number(`${whole}.${tenth || 0}`) * 1e6 <= st.total, `${st.label} is not more than ${st.total}`);
});

test('adding a tool to the data changes the hero count and the stars with no other edit', () => {
  const extra = { name: 'New Tool', repo: 'new/tool', slug: 'new-tool', category: 'biz', facts: {} };
  const before = starStats(TOOLS, stars), after = starStats([...TOOLS, extra], { ...stars, stars: { ...stars.stars, 'new/tool': 250000 } });
  assert.equal(after.tools, before.tools + 1);
  assert.equal(after.total, before.total + 250000);
  const c = categoryStats();
  assert.ok(homeStarsHtml(after, c).startsWith(`<p class="proof"><span class="proof-main">${TOOLS.length + 1} tools across`));
  assert.notEqual(homeStarsHtml(after, c), homeStarsHtml(before, c));
});

test('no hand-typed tool, star or maker count is left in the homepage source outside the generated blocks', () => {
  const outside = home
    .replace(/<!-- (featured|first-results|categories|stars|list-jsonld|cards):start -->[\s\S]*?<!-- \1:end -->/g, '')
    .replace(/<p class="proof">[\s\S]*?<\/p>/g, '');
  const hits = outside.split('\n').filter(l => /\b\d[\d,.]*\s*[KkMm]?\+?\s+(?:tools?|makers?|subscribers?|stars?|readers?)\b/.test(l));
  assert.deepEqual(hits, []);
});
