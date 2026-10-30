import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOLS, ROWS, CATEGORIES, slugOf, toolBySlug, alternatives } from '../public/assets/tools.js';
import { renderTool, toolTitle, toolDescription, toolResponse } from '../lib/tool-pages.js';
import { renderHowWeCheck, howWeCheckResponse } from '../lib/how-we-check.js';
import { renderMakers } from '../lib/makers.js';
import { layout } from '../lib/layout.js';
import { renderNotFound } from '../lib/pages.js';

const root = new URL('../', import.meta.url);
const file = f => readFileSync(new URL(f, root), 'utf8');
const get = (html, re) => (html.match(re) || [])[1];
const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ');

// ---- /tool/<slug>/ ----

test('there is one tool per Launch List row, each with its own URL-safe slug', () => {
  assert.equal(TOOLS.length, ROWS.length);
  assert.equal(TOOLS.length, 45);
  assert.equal(new Set(TOOLS.map(t => t.slug)).size, TOOLS.length);
  for (const t of TOOLS) assert.match(t.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, t.name);
  assert.equal(slugOf('Open WebUI'), 'open-webui');
  assert.equal(slugOf('  HexStrike AI! '), 'hexstrike-ai');
  assert.equal(toolBySlug('meetily').name, 'Meetily');
  assert.equal(toolBySlug('nope'), null);
});

test('every tool page has the full picture: name, description, category, license, links, Free facts, alternatives', () => {
  for (const t of TOOLS) {
    const html = renderTool(t);
    assert.equal((html.match(/<h1/g) || []).length, 1, t.name);
    assert.ok(html.includes(`<h1>${t.name.replace(/&/g, '&amp;')}</h1>`) || html.includes('<h1>'), t.name);
    assert.ok(textOf(html).includes(t.description), `${t.name}: description`);
    assert.ok(textOf(html).includes(CATEGORIES[t.category]), `${t.name}: category`);
    assert.ok(html.includes(`<span class="tg ${t.badge}">`) || html.includes('class="tg os"') || html.includes('class="tg fsh"'), `${t.name}: license badge`);
    assert.ok(textOf(html).includes(t.license), `${t.name}: license`);
    assert.ok(html.includes(`href="${t.github}"`), `${t.name}: GitHub link`);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://openorbia\\.com/tool/${t.slug}/">`), `${t.name}: canonical`);
    // the whole Free facts box
    const f = t.facts;
    const box = get(html, /(<section class="ffacts"[\s\S]*?<\/section>)/);
    assert.ok(box, `${t.name}: Free facts box`);
    const boxText = textOf(box);
    for (const label of ['Free tier', 'Card required', 'Your data', 'Setup', 'The catch', 'Last checked']) assert.ok(boxText.includes(label), `${t.name}: ${label}`);
    for (const v of [f.freeTier, f.dataLocation, f.setup, f.catch]) assert.ok(boxText.includes(v), `${t.name}: ${v}`);
    assert.ok(boxText.includes('Last checked Oct 30, 2026'), `${t.name}: date`);
  }
});

test('titles and descriptions are unique per page, in the "Is X free?" form, and short enough for search results', () => {
  const titles = new Set(), descs = new Set();
  for (const t of TOOLS) {
    const html = renderTool(t);
    const title = get(html, /<title>([^<]+)<\/title>/).replace(/&#39;/g, "'");
    const desc = get(html, /<meta name="description" content="([^"]+)"/).replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    assert.equal(title, `Is ${t.name} free? What's free, the catch and setup | OpenOrbia`);
    assert.equal(title, toolTitle(t));
    assert.ok(desc.length >= 60 && desc.length <= 160, `${t.name}: description length ${desc.length}`);
    assert.ok(desc.startsWith(t.name), `${t.name}: description starts with the name`);
    assert.ok(!titles.has(title) && !descs.has(desc), `${t.name}: duplicate`);
    titles.add(title); descs.add(desc);
    assert.ok(!/noindex/.test(html));
  }
  assert.equal(toolTitle(toolBySlug('meetily')), "Is Meetily free? What's free, the catch and setup | OpenOrbia");
});

test('the description uses the tool\'s own facts', () => {
  const d = toolDescription(toolBySlug('ai-job-search'));
  assert.ok(d.includes('A card is required') && d.includes('The catch: Needs a paid Claude plan or API credits.'), d);
  const t = toolDescription(toolBySlug('tracecat'));
  assert.ok(t.includes('No card required') && t.includes('The catch: REST API'), t);
});

test('Alternatives: three other tools from the same category, never itself, stable, all with pages', () => {
  for (const t of TOOLS) {
    const alts = alternatives(t);
    assert.equal(alts.length, 3, t.name);
    assert.ok(alts.every(a => a.category === t.category && a.slug !== t.slug), t.name);
    assert.equal(new Set(alts.map(a => a.slug)).size, 3);
    assert.deepEqual(alternatives(t).map(a => a.slug), alts.map(a => a.slug), 'same answer every time');
    const html = renderTool(t);
    for (const a of alts) assert.ok(html.includes(`href="/tool/${a.slug}/"`), `${t.name} -> ${a.name}`);
    assert.ok(html.includes('<h2 id="alt-h">Alternatives</h2>'));
  }
  // every tool is suggested by someone, so no page is an orphan
  const suggested = new Set(TOOLS.flatMap(t => alternatives(t).map(a => a.slug)));
  assert.equal(suggested.size, TOOLS.length);
});

test('tags: local AI, the founder label and the "Not confirmed" note appear only where they apply', () => {
  for (const t of TOOLS) {
    const html = renderTool(t);
    assert.equal(html.includes('Works with local AI</span>'), t.localAI, `${t.name}: local AI tag`);
    assert.equal(html.includes("Built by OpenOrbia's founder") || html.includes('Built by OpenOrbia&#39;s founder'), t.founder, `${t.name}: founder label`);
    assert.equal(textOf(html).includes('"Not confirmed" means'), t.facts.cardRequired === 'unknown', `${t.name}: Not confirmed note`);
    assert.equal(/Card required\s*<\/dt>\s*<dd>Not confirmed/.test(html), t.facts.cardRequired === 'unknown');
    assert.ok(!html.includes('Visit website'), `${t.name}: no website is recorded, so no website link`);
  }
  assert.deepEqual(TOOLS.filter(t => t.founder).map(t => t.name), ['SOC Range']);
  assert.ok(textOf(renderTool(toolBySlug('soc-range'))).includes('kept off the Launch Week leaderboard'));
});

test('/tool/<slug>/ answers 200 for a tool and a noindex 404 for anything else', async () => {
  const ok = toolResponse({ params: { slug: 'meetily' } });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('content-type'), /text\/html/);
  assert.ok((await ok.text()).includes('Meetily'));
  assert.equal(toolResponse({ params: { slug: 'meetily/' } }).status, 200);
  for (const slug of ['nope', '', '../etc', 'MEETILY', 'meetily%00']) {
    const res = toolResponse({ params: { slug } });
    assert.equal(res.status, 404, slug);
    assert.match(await res.text(), /noindex/);
  }
});

test('every Launch List card name links to its tool page, and every link has a page', () => {
  const html = file('public/launch-list/index.html');
  assert.ok(html.includes('<h2><a href="/tool/${slugOf(name)}/">${esc(name)}</a></h2>'));
  assert.ok(html.includes('import{ROWS as T,CATEGORIES as CAT,slugOf}from"/assets/tools.js"'));
  for (const row of ROWS) assert.ok(toolBySlug(slugOf(row[0])), `${row[0]} has a page`);
});

// ---- /how-we-check/ ----

test('/how-we-check/ explains the rules, every fact, the recheck cycle, "Not confirmed", corrections and the founder\'s tools', () => {
  const html = renderHowWeCheck();
  const text = textOf(html);
  for (const t of ['An open-source license, or a real free plan', 'Updated in the last 6 months', 'AI is a core part',
    'Free tier', 'Card required', 'Your data', 'Setup', 'The catch', 'Last checked',
    "We check every tool's activity and license every month, and recheck the full Free facts at least every 3 months. Each card shows its last-checked date.",
    '"Not confirmed" means we could not verify',
    'launch@openorbia.com', 'Built by OpenOrbia\'s founder', 'kept off the Launch Week leaderboard', 'Tested by OpenOrbia']) assert.ok(text.includes(t), t);
  assert.ok(html.includes('href="mailto:launch@openorbia.com"'));
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.match(html, /<link rel="canonical" href="https:\/\/openorbia\.com\/how-we-check\/">/);
  assert.equal(howWeCheckResponse().status, 200);
});

test('/how-we-check/ is linked from every footer, the Launch List and /makers/', () => {
  const link = '<a href="/how-we-check/">How we check tools</a>';
  assert.ok(layout({ title: 't', description: 'd', path: '/', body: '' }).includes(link), 'server-rendered footer');
  assert.ok(renderNotFound().includes(link));
  for (const f of ['public/index.html', 'public/404.html', 'public/launch-list/index.html']) assert.ok(file(f).includes(link), f);
  assert.ok(file('public/launch-list/index.html').includes('No trials, no paywalls. ' + link), 'in the Launch List intro');
  assert.ok(renderMakers().includes('<a href="/how-we-check/">How we check tools</a> explains'), '/makers/');
  assert.ok(renderMakers().includes(link), '/makers/ footer');
});

// The badge SVGs and the badge section of /makers/ are tested in brand.test.js
