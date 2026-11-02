import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { LOGOS } from '../public/assets/logos.js';
import { TOOLS, ROWS } from '../public/assets/tools.js';
import { needsPaidService } from '../public/assets/facts.js';
import { renderTool } from '../lib/tool-pages.js';
import { renderStats } from '../lib/featured.js';
import { statsHtml } from '../scripts/build-home.mjs';

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
  const html = file('public/launch-list/index.html');
  assert.ok(html.includes('import{LOGOS}from"/assets/logos.js"'));
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

// ---- the numbers under the hero ----

test('the numbers under the homepage hero are counted from the Launch List, and the page matches npm run build:home', () => {
  const home = file('public/index.html');
  const block = home.slice(home.indexOf('<!-- stats:start -->') + '<!-- stats:start -->'.length, home.indexOf('<!-- stats:end -->')).trim();
  assert.equal(block, statsHtml());
  const html = renderStats(TOOLS);
  const free = TOOLS.filter(t => !needsPaidService(t.facts)).length;
  assert.ok(html.includes(`<li><b>${ROWS.length}</b><span>AI tools checked against their official docs</span></li>`));
  assert.ok(html.includes(`<li><b>${free}</b><span>run free, with no paid service needed</span></li>`));
  assert.ok(html.includes('<li><b>0</b><span>paid placements, ever</span></li>'));
  assert.ok(home.indexOf('<section class="facts-strip"') > home.indexOf('<section class="hero">') && home.indexOf('<section class="facts-strip"') < home.indexOf('<section class="week"'));
});
