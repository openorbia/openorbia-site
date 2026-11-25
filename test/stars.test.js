// The GitHub star lines (lib/stars.js): counted from data/stars.json, rounded down, credited to the tools, and the same
// on the pages as build:home writes them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { starLabel, starStats, homeStarsHtml, listStarsHtml } from '../lib/stars.js';
import { categoryStats } from '../lib/categories.js';
import { TOOLS } from '../public/assets/tools.js';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const data = JSON.parse(file('data/stars.json'));

test('star totals are rounded down, so a line never claims more than the count', () => {
  assert.equal(starLabel(1830052), '1.8M+');
  assert.equal(starLabel(1899999), '1.8M+');
  assert.equal(starLabel(2000000), '2M+');
  assert.equal(starLabel(263001), '263k+');
  assert.equal(starLabel(999), '999');
});

test('data/stars.json has a real date and a whole-number count for listed tools only', () => {
  assert.match(data.checked, /^\d{4}-\d{2}-\d{2}$/);
  const repos = new Set(TOOLS.map(t => t.repo));
  for (const [repo, n] of Object.entries(data.stars)) {
    assert.ok(repos.has(repo), `${repo} is on the Launch List`);
    assert.ok(Number.isInteger(n) && n >= 0, repo);
  }
  assert.ok(Object.keys(data.stars).length >= TOOLS.length - 2, 'most tools are counted (npm run fetch:stars)');
});

test('the stats add up the saved counts and name the two most-starred tools', () => {
  const s = starStats(TOOLS, data);
  assert.equal(s.total, Object.entries(data.stars).filter(([r]) => TOOLS.some(t => t.repo === r)).reduce((a, [, n]) => a + n, 0));
  assert.equal(s.tools, TOOLS.length);
  const top = [...TOOLS].filter(t => data.stars[t.repo] != null).sort((a, b) => data.stars[b.repo] - data.stars[a.repo]).slice(0, 2).map(t => t.name);
  assert.deepEqual(s.top, top);
  const fake = starStats([{ name: 'A', repo: 'a/a' }, { name: 'B', repo: 'b/b' }, { name: 'C', repo: 'c/c' }], { checked: '2026-11-19', stars: { 'a/a': 1500, 'b/b': 2500 } });
  assert.deepEqual([fake.total, fake.counted, fake.tools, fake.top], [4000, 2, 3, ['B', 'A']], 'an uncounted tool adds nothing');
});

test('the homepage and the Launch List carry the star lines exactly as build:home writes them', () => {
  const s = starStats(TOOLS, data);
  assert.ok(file('public/index.html').includes(`<!-- stars:start -->\n    ${homeStarsHtml(s, categoryStats())}\n    <!-- stars:end -->`), 'run npm run build:home');
  assert.ok(file('public/launch-list/index.html').includes(`<!-- stars:start -->\n    ${listStarsHtml(s)}\n    <!-- stars:end -->`), 'run npm run build:home');
});

test('the wording credits the stars to the tools on GitHub, with the date, and never as OpenOrbia users or a ranking', () => {
  const s = starStats(TOOLS, data);
  for (const html of [homeStarsHtml(s, categoryStats()), listStarsHtml(s)]) {
    assert.match(html, /GitHub stars/);
    // the count date is on the page itself (the homepage used to keep it in a tooltip)
    assert.match(html, /(?:counted on GitHub|GitHub stars between them, as of) [A-Z][a-z]{2} \d{1,2}, \d{4}|counted on GitHub, [A-Z][a-z]{2} \d{1,2}, \d{4}/i);
    assert.doesNotMatch(html, /title="/, 'not hidden in a tooltip');
    assert.doesNotMatch(html, /users|#1|number one|trusted by/i);
  }
  assert.match(homeStarsHtml(s), /between them/);
  assert.doesNotMatch(homeStarsHtml(s), /solo makers|proof-sub/, 'the homepage has one star line (the second line was removed 2026-11-19 at the founder\'s request)');
  assert.match(listStarsHtml(s), /Home to free AI tools with/);
});
