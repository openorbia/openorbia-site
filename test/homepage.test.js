import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOLS, ROWS, canFeature, toolBySlug } from '../public/assets/tools.js';
import { matchesRow, parseFilters } from '../public/assets/launch-filters.js';
import { pickFeatured, renderFeatured, PINNED_SEC } from '../lib/featured.js';
import { MAKERS_CONFIRMED } from '../lib/site.js';
import { confidenceByRepo, featuredHtml } from '../scripts/build-home.mjs';

const root = new URL('../', import.meta.url);
const file = f => readFileSync(new URL(f, root), 'utf8');
const home = file('public/index.html');
const data = JSON.parse(file('data/free-facts.json'));

test('the featured tools on the page are exactly what lib/featured.js picks (run npm run build:home after changing the data)', () => {
  const block = home.slice(home.indexOf('<!-- featured:start -->') + '<!-- featured:start -->'.length, home.indexOf('<!-- featured:end -->')).trim();
  assert.equal(block, featuredHtml());
});

test('five existing tools are featured: 2 security, 1 job seekers, 1 small business, 1 local AI, all different, none ruled out', () => {
  const picks = pickFeatured(TOOLS, confidenceByRepo);
  assert.equal(picks.length, 5);
  const roles = picks.map(p => p.role).sort();
  assert.deepEqual(roles, ['biz', 'job', 'local', 'sec', 'sec']);
  assert.equal(new Set(picks.map(p => p.tool.slug)).size, 5);
  for (const { tool, role } of picks) {
    assert.ok(canFeature(tool), tool.name);
    assert.ok(toolBySlug(tool.slug), 'an existing tool');
    if (role === 'sec') assert.equal(tool.category, 'sec');
    if (role === 'job') assert.equal(tool.category, 'job');
    if (role === 'biz') assert.equal(tool.category, 'biz');
    if (role === 'local') assert.ok(tool.localAI);
  }
  assert.ok(!picks.some(p => p.tool.slug === 'hexstrike-ai'), 'HexStrike AI is never featured');
});

test('picks prefer confidence high with no paid dependency, then no paid dependency, then high confidence', () => {
  const mk = (slug, category, level, localAI = false) => ({ slug, name: slug, repo: `o/${slug}`, category, localAI, facts: { paidDeps: { level }, task: 't', freeTier: 'f', setup: 's', catch: 'c' } });
  const tools = [mk('a', 'sec', 'optional'), mk('b', 'sec', 'none'), mk('c', 'sec', 'optional'), mk('d', 'sec', 'none'), mk('e', 'job', 'optional'), mk('f', 'biz', 'none'), mk('g', 'biz', 'none', true)];
  const conf = { 'o/a': 'high', 'o/b': 'medium', 'o/c': 'medium', 'o/d': 'high', 'o/e': 'medium', 'o/f': 'medium', 'o/g': 'medium' };
  const picks = pickFeatured(tools, conf);
  assert.deepEqual(picks.filter(p => p.role === 'sec').map(p => p.tool.slug).sort(), ['b', 'd'], 'none-paid beats high-but-optional; high+none comes first');
  assert.equal(pickFeatured(tools, { ...conf, 'o/a': 'high', 'o/c': 'high', 'o/b': 'medium', 'o/d': 'medium' }).filter(p => p.role === 'sec').map(p => p.tool.slug).sort().join(), 'b,d');
  // a ruled-out tool is skipped even when it would win
  const ruled = tools.map(t => (t.slug === 'd' ? { ...t, facts: { ...t.facts, featureOnHomepage: false } } : t));
  assert.ok(!pickFeatured(ruled, conf).some(p => p.tool.slug === 'd'));
});

test('each featured card has the task line, free line, setup, catch and a link to the tool page, taken from the data file', () => {
  for (const { tool } of pickFeatured(TOOLS, confidenceByRepo)) {
    const e = data.find(x => x.repo === tool.repo);
    const card = home.slice(home.indexOf(`data-tool-slug="${tool.slug}"`));
    const one = card.slice(0, card.indexOf('</article>'));
    for (const text of [e.task, e.freeTier, e.setup, e.catch]) assert.ok(one.includes(text.replace(/&/g, '&amp;')), `${tool.name}: ${text}`);
    assert.equal((one.match(new RegExp(`href="/tool/${tool.slug}/"`, 'g')) || []).length, 2, 'name and "See the facts" both link to the tool page');
  }
  assert.equal((home.match(/class="ft" data-tool-slug/g) || []).length, 5);
});

test('the three audience cards link to the filtered Launch List', () => {
  for (const c of ['biz', 'job', 'sec']) assert.ok(home.includes(`<a class="cat" href="/launch-list/?for=${c}">`), c);
});

test('the six task links are filtered or search URLs that each return results', () => {
  const links = [...home.matchAll(/<li><a href="(\/launch-list\/\?[^"]+)">([^<]+)<\/a><\/li>/g)].map(m => [m[1].replace(/&amp;/g, '&'), m[2]]);
  assert.deepEqual(links.map(l => l[1]), ['Transcribe meetings', 'Tailor a resume', 'Chat with documents', 'Automate small-business tasks', 'Triage security alerts', 'Test AI for vulnerabilities']);
  for (const [href, label] of links) {
    const state = parseFilters(new URL(href, 'https://openorbia.com').search);
    const hits = ROWS.filter(r => matchesRow(r, state));
    assert.ok(hits.length >= 1, `${label} returns results (${hits.length})`);
    assert.ok(state.q || state.for !== 'all', `${label} is filtered`);
  }
});

test('the search also matches the plain-language task line', () => {
  assert.ok(ROWS.some(r => matchesRow(r, { ...parseFilters(''), q: 'transcribe' })));
  assert.ok(!ROWS.some(r => matchesRow(r, { ...parseFilters(''), q: 'zzzz-no-such-task' })));
});

test('the hero is compact: the same headline, "Explore free tools" to /launch-list/ and "Get launch updates" to the signup', () => {
  assert.ok(home.includes('<h1>Where free AI tools <em>take off</em>.</h1>'));
  assert.ok(home.includes('<a class="btn pri" href="/launch-list/">Explore free tools</a>'));
  assert.ok(home.includes('<a class="btn ghost" href="#join">Get launch updates</a>'));
  assert.match(home, /id="join"/);
  // the planet is small on phones
  assert.match(home, /@media \(max-width:820px\)\{\.hero\{[^}]*grid-template-columns:minmax\(0,1fr\) 68px/);
  assert.match(home, /\.hero\{padding-block:clamp\(16px,3vh,24px\) 12px/);
});

test('the sections come in order: hero, this week, featured tools, audiences and tasks, how launching works, signup last; none is empty', () => {
  const at = s => { const i = home.indexOf(s); assert.ok(i > 0, s); return i; };
  const order = [at('<section class="hero">'), at('<section class="week" id="week"'), at('<section class="featured"'), at('<section class="cats"'), at('<section class="how"'), at('<section class="join" id="join"')];
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.ok(home.indexOf('</section>', order[5]) > order[5] && home.indexOf('<section', order[5] + 10) < 0, 'the signup is the last section');
  for (const m of home.matchAll(/<section[^>]*>([\s\S]*?)<\/section>/g)) assert.ok(m[1].replace(/<[^>]+>/g, '').trim().length > 20, 'a section has text');
});

test('before launch the week block shows the countdown and the makers confirmed; after launch launch.js shows cards with vote buttons and the closing time', () => {
  assert.match(home, /Coming Monday Nov 23/);
  assert.match(home, /data-countdown="2026-11-23T08:01:00\.000Z"/);
  assert.ok(home.includes(`<p class="week-makers" data-makers>${MAKERS_CONFIRMED} makers confirmed</p>`));
  const js = file('public/assets/launch.js');
  assert.ok(js.includes("'Voting closes Sunday 11:59 PM PT'"));
  assert.ok(js.includes("el('button', 'vote')") && js.includes("btn.dataset.state = state"));
  assert.ok(js.includes('data.voted') && js.includes("'ended'"), 'the visitor\'s votes and the closed state are handled');
  assert.ok(js.includes("id = 'vote-status'"), 'a live region for the vote result');
  // the vote button and the shared script are on the homepage
  assert.match(home, /\.vote\{/);
  assert.match(home, /<script src="\/assets\/launch\.js" defer><\/script>/);
});

test('the homepage links to Find me a free tool, Submit a tool and the Launch List, and has no horizontal-overflow traps', () => {
  assert.ok(home.includes('href="/request/"') && home.includes('href="/submit/"') && home.includes('href="/launch-list/"'));
  assert.ok(!/min-width:\s*\d{3,}px/.test(home), 'no fixed minimum widths');
  assert.match(home, /\.feat\{display:grid;grid-template-columns:repeat\(auto-fill,minmax\(min\(100%,290px\),1fr\)\)/);
});

test('canFeature: the founder\'s own tools are never featured, nor a tool with featureOnHomepage: false', () => {
  const mk = (over = {}) => ({ slug: 'x', founder: false, facts: {}, ...over });
  assert.equal(canFeature(mk()), true);
  assert.equal(canFeature(mk({ founder: true })), false);
  assert.equal(canFeature(mk({ facts: { featureOnHomepage: false } })), false);
  assert.equal(canFeature(mk({ founder: true, facts: { featureOnHomepage: true } })), false, 'the founder rule cannot be switched off by the data');
  // every founder tool on the Launch List, and HexStrike AI, fail canFeature; nothing else does
  const founders = TOOLS.filter(t => t.founder);
  assert.deepEqual(founders.map(t => t.name), ['SOC Range']);
  assert.deepEqual(TOOLS.filter(t => !canFeature(t)).map(t => t.name).sort(), ['HexStrike AI', 'SOC Range']);
  // so none of them is on the homepage
  for (const t of [...founders, toolBySlug('hexstrike-ai')]) assert.ok(!home.includes(`data-tool-slug="${t.slug}"`), t.name);
});

test('garak is the first security pick; promptfoo takes its place only when garak cannot be featured; SOC Range is gone', () => {
  assert.deepEqual(PINNED_SEC, ['garak', 'promptfoo']);
  const picks = pickFeatured(TOOLS, confidenceByRepo);
  assert.deepEqual(picks.filter(p => p.role === 'sec').map(p => p.tool.slug), ['garak', 'purplellama']);
  assert.ok(home.includes('data-tool-slug="garak"') && !home.includes('data-tool-slug="soc-range"'));
  const without = slug => TOOLS.map(t => (t.slug === slug ? { ...t, facts: { ...t.facts, featureOnHomepage: false } } : t));
  assert.equal(pickFeatured(without('garak'), confidenceByRepo).filter(p => p.role === 'sec')[0].tool.slug, 'promptfoo');
  assert.ok(!pickFeatured(without('garak'), confidenceByRepo).some(p => p.tool.slug === 'garak'));
  const neither = TOOLS.map(t => (['garak', 'promptfoo'].includes(t.slug) ? { ...t, founder: true } : t));
  const secs = pickFeatured(neither, confidenceByRepo).filter(p => p.role === 'sec').map(p => p.tool.slug);
  assert.equal(secs.length, 2);
  assert.ok(!secs.includes('garak') && !secs.includes('promptfoo'));
});

test('MAKERS_CONFIRMED is 3 and the homepage shows it', () => {
  assert.equal(MAKERS_CONFIRMED, 3);
  assert.ok(home.includes('<p class="week-makers" data-makers>3 makers confirmed</p>'));
});
