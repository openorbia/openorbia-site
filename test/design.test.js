import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asset } from '../lib/asset-versions.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { LOGOS } from '../public/assets/logos.js';
import { TOOLS, ROWS } from '../public/assets/tools.js';
import { renderTool } from '../lib/tool-pages.js';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const logoDir = new URL('../public/logos/', import.meta.url);

// ---- logos ----

test('every logo in logos.js is a real image file in public/logos/ for a listed tool, and nothing else is in the folder', () => {
  const slugs = new Set(TOOLS.map(t => t.slug));
  const files = readdirSync(logoDir);
  assert.ok(Object.keys(LOGOS).length >= 1);
  for (const [slug, path] of Object.entries(LOGOS)) {
    assert.ok(slugs.has(slug), `${slug} is a tool`);
    assert.match(path, new RegExp(`^/logos/${slug}\\.(png|jpg|webp)$`), `${slug}: path`);
    const name = path.slice('/logos/'.length);
    assert.ok(files.includes(name), `${name} exists`);
    assert.ok(statSync(new URL(name, logoDir)).size < 200_000, `${name} is small`);
  }
  assert.deepEqual(files.filter(f => !Object.values(LOGOS).includes(`/logos/${f}`)), [], 'no stray files');
  assert.ok(!files.some(f => /\.svg$/i.test(f)), 'never SVG');
});

test('a tool with a logo shows it on its page; a tool without one keeps the letter tile', () => {
  const withLogo = TOOLS.find(t => t.logo), without = TOOLS.find(t => !t.logo);
  assert.ok(withLogo && without);
  // the top of the page (the alternatives further down have their own logos)
  const hero = html => html.slice(html.indexOf('<section class="lhero">'), html.indexOf('</section>', html.indexOf('<section class="lhero">')));
  assert.ok(hero(renderTool(withLogo)).includes(`<img class="logo" src="${withLogo.logo}" alt=""`));
  assert.ok(!hero(renderTool(without)).includes('<img class="logo"') && hero(renderTool(without)).includes('logo-initial'));
});

test('the founder\'s own tools and tools owned by a person never get a logo (a profile photo is not a tool logo)', () => {
  for (const t of TOOLS.filter(x => x.founder)) assert.equal(t.logo, '', t.name);
});

// ---- the Launch List cards ----

test('Launch List cards: logo or letter tile, the name\'s link covers the card, the description is two lines, and the facts are short', () => {
  const html = (file('public/launch-list/index.html') + file('public/assets/launch-list.js'));
  assert.ok(html.includes(`import{LOGOS}from"${asset('logos.js').replace('/assets/', './')}"`));
  assert.ok(html.includes('<div class="top">${logo(name,a,b)}<div><h2>'));
  assert.ok(html.includes('.card h2 a::after{content:"";position:absolute;inset:0'), 'the whole card opens the tool page');
  assert.ok(html.includes('.foot{position:relative;z-index:1;'), 'the GitHub and claim links still work on top of it');
  assert.match(html, /\.card>p\{[^}]*-webkit-line-clamp:2/);
  assert.ok(html.includes('<ul class="fcs" aria-label="Free facts">'), 'card, your data and setup as chips');
  // the chips drop a trailing "(note)" and nothing else
  const src = html.match(/const short=v=>String\(v\)\.replace\((\/.*\/),""\);/)[1];
  const short = v => String(v).replace(new Function(`return ${src}`)(), '');
  assert.equal(short('Runs on your computer (cloud AI only if you pick one)'), 'Runs on your computer');
  assert.equal(short('Install & self-host'), 'Install & self-host');
  assert.ok(html.includes('Checked against docs'), 'the date says what kind of check it was');
});

test('Launch List on phones: the filter chips are one row that scrolls sideways, and the count sits next to the search', () => {
  const html = file('public/launch-list/index.html');
  assert.ok(html.includes('<div class="fscroll">'));
  assert.match(html, /@media \(max-width:560px\)\{\.bar\{position:static\}\.tabs,\.fscroll\{flex-wrap:nowrap;overflow-x:auto/);
  assert.ok(html.indexOf('id="count"') < html.indexOf('<div class="fscroll">'));
});


// ---- tool pages ----

test('tool pages: the facts beside an "At a glance" panel that keeps "checked against docs" apart from "hands-on tested"', async () => {
  const { renderTool } = await import('../lib/tool-pages.js');
  for (const t of TOOLS) {
    const html = renderTool(t);
    assert.ok(html.includes('<div class="tool-grid">') && html.includes('<aside class="tool-side" aria-labelledby="side-h"><h2 id="side-h">At a glance</h2>'), t.name);
    assert.ok(html.indexOf('class="ffacts"') < html.indexOf('class="tool-side"'), `${t.name}: facts first`);
    assert.ok(html.includes('Facts checked by hand against the official docs'), `${t.name}: docs check`);
    assert.equal(html.includes('Not hands-on tested yet'), !t.facts.testedBy, `${t.name}: hands-on line`);
    assert.ok(html.includes(`<dt>License</dt><dd>${t.license.replace(/&/g, '&amp;')}</dd>`), `${t.name}: license`);
    assert.ok(!html.includes('<h2 id="a-h">'), `${t.name}: no "About" section repeating the tagline`);
  }
});

// ---- the form pages ----

test('Submit: the same fields in four groups, beside "What happens next"; Find me a free tool gets "How it works"', async () => {
  const { renderSubmit, renderRequest } = await import('../lib/form-pages.js');
  const html = renderSubmit({ siteKey: 'k' });
  const groups = [...html.matchAll(/<fieldset class="fgroup"><legend>([^<]+)<\/legend>/g)].map(m => m[1]);
  assert.deepEqual(groups, ['Your tool', 'What&#39;s free', 'About you', 'For your launch page']);
  for (const id of ['tool_name', 'url', 'category', 'license', 'free_tier', 'card_required', 'setup', 'paid_level', 'paid_deps', 'maker_name', 'email', 'assets_link']) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
  }
  assert.ok(html.includes('<h2 id="next-h">What happens next</h2>') && html.includes('Free to launch. No paid placement, ever.'));
  assert.ok(html.indexOf('<form class="form"') < html.indexOf('<aside class="form-side"'));
  const req = renderRequest({ siteKey: 'k' });
  assert.ok(req.includes('<h2 id="next-h">How it works</h2>') && req.includes(`We search ${TOOLS.length} checked tools`));
});

// ---- consistency ----

test('CSS and scripts are re-checked on every visit, so a new page never gets an old stylesheet from the browser cache', () => {
  const headers = file('public/_headers');
  assert.match(headers, /^\/assets\/\*\n {2}Cache-Control: public, max-age=0, must-revalidate$/m);
});

test('one button size, one field height and one large-panel radius across the site', () => {
  const css = file('public/assets/launch.css');
  for (const f of ['public/index.html', 'public/launch-list/index.html']) assert.ok(file(f).includes('.btn{display:inline-flex;align-items:center;gap:8px;padding:11px 20px'), `${f}: 48px buttons`);
  assert.ok(css.includes('.ff input[type=text],.ff input[type=url],.ff input[type=email],.ff select{height:48px;padding-block:0}'), 'text boxes and dropdowns match');
  for (const sel of ['.soon-panel', '.cta', '.mk-week']) assert.ok(css.includes(`${sel}{border:1px solid var(--line);border-radius:16px;`), sel);
  assert.ok(file('public/index.html').includes('.week{border:1px solid var(--line);border-radius:16px;'));
  // the only rounder shape left is the big upvote button, which is a button, not a panel
  assert.deepEqual([...css.matchAll(/([.a-z-]+)\{[^}]*border-radius:(?:18|20)px/g)].map(m => m[1]), ['.vote-lg']);
});

test('touch screens: the Launch List filters are at least 40px tall', () => {
  assert.ok(file('public/launch-list/index.html').includes('@media (pointer:coarse){.tab,.chip{min-height:40px}}'));
});
