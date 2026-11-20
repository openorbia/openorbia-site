// Platform positioning (2026-11-19): OpenOrbia covers four main categories equally (Productivity, Automation & AI, Careers, Security);
// Small businesses, Job seekers and Security teams stay as audience filters, never the whole scope.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MENUS } from '../lib/header.js';
import { MAIN_CATEGORIES, homeCategoriesHtml } from '../lib/categories.js';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const home = file('public/index.html'), list = file('public/launch-list/index.html');
const THREE_AUDIENCES_AS_SCOPE = /for small businesses, job seekers and security teams/i;

test('the homepage head, hero and Launch List describe all four categories, not three audiences', () => {
  for (const [name, html] of [['homepage', home], ['Launch List', list]]) {
    const head = html.slice(0, html.indexOf('</head>'));
    assert.doesNotMatch(head, THREE_AUDIENCES_AS_SCOPE, `${name} head`);
    for (const word of ['productivity', 'automation', 'careers', 'security']) assert.match(head.toLowerCase(), new RegExp(word), `${name} head: ${word}`);
  }
  const hero = home.slice(home.indexOf('<section class="hero">'), home.indexOf('</section>', home.indexOf('<section class="hero">')));
  assert.match(hero, /productivity, automation, careers, cybersecurity/);
  assert.match(hero, /what needs a paid API/, 'the hero does not claim every tool is free to run');
});

test('the homepage shows the four categories first, each linking to its page and its topics, and keeps the three audience cards after them', () => {
  const cats = home.slice(home.indexOf('<section class="cats"'), home.indexOf('</section>', home.indexOf('<section class="cats"')));
  assert.ok(cats.includes('Explore AI tools by category'));
  assert.ok(cats.includes(homeCategoriesHtml()), 'the cards are what build:home writes (npm run build:home)');
  for (const c of MAIN_CATEGORIES) assert.ok(cats.includes(`<a class="cat-link" href="/category/${c.slug}/">`), c.slug);
  assert.equal((cats.match(/<ul class="cat-subs"/g) || []).length, 4);
  for (const c of ['biz', 'job', 'sec']) assert.ok(cats.indexOf(`href="/launch-list/?for=${c}"`) > cats.indexOf('/category/security/'), `${c}: audiences come second`);
});

test('the Tools menu offers category, audience and setup, plus all tools, and still fits a phone (full width under 820px)', () => {
  const heads = [...MENUS.tools.matchAll(/<p class="mm-h">([^<]+)<\/p>/g)].map(m => m[1]);
  assert.deepEqual(heads, ['By category', 'By audience', 'By setup']);
  for (const c of MAIN_CATEGORIES) assert.ok(MENUS.tools.includes(`href="/category/${c.slug}/"`), c.slug);
  for (const h of ['/launch-list/?for=biz', '/launch-list/?for=job', '/launch-list/?for=sec', '/launch-list/?setup=browser', '/launch-list/?setup=desktop', '/collection/self-hosted/', '/launch-list/?local=1', '/launch-list/?os=1', '/launch-list/']) {
    assert.ok(MENUS.tools.includes(`href="${h.replace(/&/g, '&amp;')}"`), `${h} kept`);
  }
  assert.ok(MENUS.tools.includes('<b>Find my free setup</b>'), 'Find my free setup stays at the top');
  assert.match(file('lib/header.js'), /@media \(max-width:820px\)\{[^']*#mm-tools\{left:0;right:0;width:auto/);
});

test('the Launch List links to the four category pages and keeps its audience tabs', () => {
  for (const c of MAIN_CATEGORIES) assert.ok(list.includes(`href="/category/${c.slug}/"`), c.slug);
  for (const c of ['biz', 'job', 'sec']) assert.ok(list.includes(`data-c="${c}"`), c);
});
