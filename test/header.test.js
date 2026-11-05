import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asset } from '../lib/asset-versions.js';
import { readFileSync, existsSync } from 'node:fs';
import { headerHtml, HEADER_CSS, MENUS } from '../lib/header.js';
import { layout, MARK } from '../lib/layout.js';
import { renderMakers } from '../lib/makers.js';
import { renderTool } from '../lib/tool-pages.js';
import { renderHowWeCheck } from '../lib/how-we-check.js';
import { renderHowVotingWorks } from '../lib/how-voting-works.js';
import { renderSubmit, renderRequest } from '../lib/form-pages.js';
import { toolBySlug, ROWS } from '../public/assets/tools.js';
import { parseFilters, matchesRow } from '../public/assets/launch-filters.js';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const STATIC = ['public/index.html', 'public/launch-list/index.html', 'public/404.html'];
const headerOf = html => html.slice(html.indexOf('<header class="wrap">'), html.indexOf('</header>') + '</header>'.length);
const HEADER = headerHtml(MARK);

test('the static pages carry exactly the shared header, and the server-rendered pages use it', () => {
  for (const f of STATIC) assert.equal(headerOf(file(f)), HEADER, f);
  const server = {
    layout: layout({ title: 't', description: 'd', path: '/', body: '' }), makers: renderMakers(), howWeCheck: renderHowWeCheck(), howVoting: renderHowVotingWorks(),
    submit: renderSubmit(), request: renderRequest(), tool: renderTool(toolBySlug('meetily')),
  };
  for (const [name, html] of Object.entries(server)) {
    assert.equal(headerOf(html), HEADER, name);
    assert.ok(html.includes(`<script src="${asset('nav.js')}" defer></script>`), `${name}: nav.js`);
  }
  for (const f of STATIC) assert.ok(file(f).includes(`<script src="${asset('nav.js')}" defer></script>`), `${f}: nav.js`);
  assert.ok(existsSync(new URL('../public/assets/nav.js', import.meta.url)));
});

test('the header styles are the same block in launch.css, on the homepage and on the Launch List', () => {
  for (const f of ['public/assets/launch.css', 'public/index.html', 'public/launch-list/index.html']) assert.ok(file(f).includes(HEADER_CSS), f);
});

test('without JavaScript nothing is lost: each menu name is a link, the search is a GET form to the Launch List, and Submit a tool stays a button', () => {
  assert.deepEqual([...HEADER.matchAll(/<a class="mm-top" href="([^"]+)">([^<]+)<\/a>/g)].map(m => [m[1], m[2]]), [['/launch-list/', 'Tools'], ['/launches/', 'Launches'], ['/makers/', 'Makers']]);
  assert.ok(HEADER.includes('<form class="nsearch" action="/launch-list/" method="get" role="search"><input id="nav-q" name="q" type="search"'));
  assert.ok(HEADER.includes('<a class="btn ghost" href="/submit/">Submit a tool</a>'));
  // each arrow says which panel it opens and starts closed
  for (const id of ['tools', 'launches', 'makers']) assert.ok(HEADER.includes(`aria-expanded="false" aria-controls="mm-${id}"`) && HEADER.includes(`id="mm-${id}"`), id);
  assert.match(HEADER_CSS, /html:not\(\.nav-js\) \.mm:focus-within>\.mm-panel\{display:block\}/, 'keyboard users without the script still open a menu');
});

test('every link in the menus goes to a real page, and every Launch List filter link shows tools', () => {
  const pages = { '/launch-list/': 'public/launch-list/index.html', '/launches/': 'functions/launches/index.js', '/makers/': 'functions/makers/index.js',
    '/submit/': 'functions/submit/index.js', '/request/': 'functions/request/index.js', '/how-we-check/': 'functions/how-we-check/index.js', '/how-voting-works/': 'functions/how-voting-works/index.js' };
  const hrefs = [...new Set([...Object.values(MENUS).join('').matchAll(/href="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&')))];
  for (const h of hrefs) {
    const url = new URL(h, 'https://openorbia.com');
    assert.ok(pages[url.pathname] && existsSync(new URL(`../${pages[url.pathname]}`, import.meta.url)), `${h}: page exists`);
    if (url.pathname === '/launch-list/') assert.ok(ROWS.filter(r => matchesRow(r, parseFilters(url.search))).length > 0, `${h}: shows tools`);
  }
  assert.ok(hrefs.length >= 12);
});

test('the menus keep the site rules: free launches, no paid placement, and no Advertise link', () => {
  assert.ok(MENUS.makers.includes('Free launches, no paid placement.'));
  assert.ok(!/advertis|sponsor|promoted/i.test(HEADER));
});
