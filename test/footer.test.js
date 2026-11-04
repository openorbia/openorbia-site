import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { footerHtml, FOOTER_CSS, SOCIAL } from '../lib/footer.js';
import { layout } from '../lib/layout.js';
import { renderMakers } from '../lib/makers.js';
import { renderTool } from '../lib/tool-pages.js';
import { renderHowWeCheck } from '../lib/how-we-check.js';
import { renderHowVotingWorks } from '../lib/how-voting-works.js';
import { renderSubmit, renderRequest } from '../lib/form-pages.js';
import { toolBySlug } from '../public/assets/tools.js';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const STATIC = ['public/index.html', 'public/launch-list/index.html', 'public/404.html'];
const footerOf = html => html.slice(html.indexOf('<footer>'), html.indexOf('</footer>') + '</footer>'.length);

test('the static pages carry exactly the shared footer, and the server-rendered pages use it with the real year', () => {
  for (const f of STATIC) assert.equal(footerOf(file(f)), footerHtml('<span id="yr">2026</span>'), f);
  const server = {
    layout: layout({ title: 't', description: 'd', path: '/', body: '' }), makers: renderMakers(), howWeCheck: renderHowWeCheck(), howVoting: renderHowVotingWorks(),
    submit: renderSubmit(), request: renderRequest(), tool: renderTool(toolBySlug('meetily')),
  };
  for (const [name, html] of Object.entries(server)) assert.equal(footerOf(html), footerHtml(new Date().getFullYear()), name);
});

test('the bottom bar has three parts: copyright and founder as plain text, Privacy / Security / Contact, and three icons', () => {
  const html = footerHtml(2026);
  const left = html.match(/<div class="sf-l">(.*?)<\/div>/s)[1];
  assert.equal(left, '<span>© 2026 OpenOrbia. All rights reserved.</span><span>Founded by Khaja Syed</span>');
  assert.ok(!left.includes('<a') && !html.includes('Built by Khaja Syed') && !html.includes('linkedin.com/in/'), 'plain text, no personal link');
  const middle = html.match(/<nav class="sf-m" aria-label="Footer">(.*?)<\/nav>/s)[1];
  const links = [...middle.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(links, [['/privacy/', 'Privacy'], ['/security/', 'Security'], ['/contact/', 'Contact']]);
  // the links the OpenOrbia column already has are not repeated in the bottom bar
  for (const dup of ['/how-we-check/', '/how-voting-works/', '/makers/', '/request/']) assert.ok(!middle.includes(dup), dup);
  const right = html.match(/<div class="sf-r">(.*?)<\/div>/s)[1];
  const icons = [...right.matchAll(/<a href="([^"]+)" aria-label="([^"]+)" rel="me noopener" target="_blank"><svg/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(icons, [['https://x.com/OpenOrbia', 'OpenOrbia on X'], ['https://www.linkedin.com/company/openorbia', 'OpenOrbia on LinkedIn'], ['https://github.com/openorbia/openorbia-site', 'OpenOrbia on GitHub']]);
  assert.match(FOOTER_CSS, /\.sf-r a\{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px\}/, '44px tap targets');
  assert.match(FOOTER_CSS, /@media \(max-width:820px\)\{\.sf\{grid-template-columns:minmax\(0,1fr\);justify-items:center;text-align:center\}/, 'stacked and centred on phones');
});

test('the social icons are inline 22px SVGs with an aria-label, rel="me noopener" and target="_blank", and point at the right profiles', () => {
  assert.equal(SOCIAL.x.href, 'https://x.com/OpenOrbia');
  assert.equal(SOCIAL.linkedin.href, 'https://www.linkedin.com/company/openorbia');
  const anchors = [...footerHtml(2026).matchAll(/<a href="(https:\/\/(?:x|www\.linkedin)\.com[^"]*)" aria-label="([^"]+)" rel="me noopener" target="_blank">(<svg.*?<\/svg>)<\/a>/gs)];
  assert.deepEqual(anchors.map(m => [m[1], m[2]]), [['https://x.com/OpenOrbia', 'OpenOrbia on X'], ['https://www.linkedin.com/company/openorbia', 'OpenOrbia on LinkedIn']]);
  for (const m of anchors) {
    assert.match(m[3], /width="22" height="22"/);
    assert.match(m[3], /aria-hidden="true"/);
    assert.ok(!/<img|<script|href=/.test(m[3]), 'inline, no external file');
  }
});

test('the footer styles are the same block everywhere: muted links, brighter on hover, stacked and centred on phones', () => {
  for (const f of ['public/assets/launch.css', 'public/index.html', 'public/launch-list/index.html']) assert.ok(file(f).includes(FOOTER_CSS), `${f}: footer css`);
  assert.match(FOOTER_CSS, /\.sf a\{color:var\(--muted\);text-decoration:none\}/);
  assert.match(FOOTER_CSS, /\.sf a:hover\{color:var\(--ink\)\}/);
  assert.match(FOOTER_CSS, /\.sf svg\{width:22px;height:22px;fill:currentColor/);
  assert.match(FOOTER_CSS, /@media \(max-width:820px\)\{\.sf\{grid-template-columns:minmax\(0,1fr\);justify-items:center;text-align:center\}/);
  // the old two-span footer rule is gone
  for (const f of ['public/assets/launch.css', 'public/index.html', 'public/launch-list/index.html']) assert.ok(!file(f).includes('footer .wrap{display:flex'), f);
});

// ---- the site map above the bottom row ----

// the <nav class="sf-map"> part of the footer, and the column headings in it
const mapOf = html => html.slice(html.indexOf('<nav class="sf-map"'), html.indexOf('</nav>', html.indexOf('<nav class="sf-map"')));
const headingsOf = html => html.split('<p class="sf-h">').slice(1).map(s => s.slice(0, s.indexOf('</p>')));

test("the footer site map: kinds of work, setup and OpenOrbia's pages, and no tool names", async () => {
  const { CATEGORY_LINKS } = await import('../lib/footer.js');
  const { TOOLS } = await import('../public/assets/tools.js');
  const html = footerHtml(2026);
  assert.deepEqual(headingsOf(html), ['Productivity', 'Automation &amp; AI', 'Careers', 'Security', 'Browse', 'OpenOrbia']);
  assert.ok(!html.includes('href="/tool/'), 'no links to single tools');
  const map = mapOf(html);
  for (const t of TOOLS) assert.ok(!map.includes(`>${t.name.replace(/&/g, '&amp;')}<`), `${t.name} is not named`);
  assert.ok(Object.values(CATEGORY_LINKS).flat().length >= 20, 'every kind of work the list covers');
});

test('every category in the footer is a Launch List search that finds tools that run free', async () => {
  const { CATEGORY_LINKS } = await import('../lib/footer.js');
  const { ROWS } = await import('../public/assets/tools.js');
  const { parseFilters, matchesRow } = await import('../public/assets/launch-filters.js');
  const html = footerHtml(2026);
  for (const [label, q] of Object.values(CATEGORY_LINKS).flat()) {
    const href = `/launch-list/?q=${encodeURIComponent(q).replace(/%20/g, '+')}`;
    assert.ok(html.includes(`<a href="${href}">${label.replace(/&/g, '&amp;')}</a>`), `${label} is linked`);
    const hits = ROWS.filter(r => matchesRow(r, parseFilters(new URL(href, 'https://openorbia.com').search)));
    assert.ok(hits.length >= 1, `${label} (${q}) finds tools`);
  }
});

test('every other link in the footer site map goes to a real page, and the contact email is in it', async () => {
  const { existsSync } = await import('node:fs');
  const { CONTACT_EMAIL } = await import('../lib/footer.js');
  const pages = { '/launch-list/': 'public/launch-list/index.html', '/launches/': 'functions/launches/index.js', '/makers/': 'functions/makers/index.js', '/faq/': 'functions/faq/index.js',
    '/submit/': 'functions/submit/index.js', '/request/': 'functions/request/index.js', '/how-we-check/': 'functions/how-we-check/index.js', '/how-voting-works/': 'functions/how-voting-works/index.js', '/contact/': 'functions/contact/index.js' };
  const html = footerHtml(2026);
  const map = mapOf(html);
  for (const [, href] of map.matchAll(/href="([^"]+)"/g)) {
    if (href.startsWith('mailto:')) { assert.equal(href, `mailto:${CONTACT_EMAIL}`); continue; }
    if (href === 'https://github.com/openorbia/openorbia-site/discussions') continue; // Community (test/community.test.js)
    const path = new URL(href, 'https://openorbia.com').pathname;
    assert.ok(pages[path] && existsSync(new URL(`../${pages[path]}`, import.meta.url)), href);
  }
  assert.equal(CONTACT_EMAIL, 'hello@openorbia.com');
  assert.ok(html.includes(`Questions? <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`));
  assert.ok(map.includes('<a href="/faq/">FAQ</a>') && map.includes('<a href="/contact/">Contact us</a>'));
});

test('the homepage has no numbers strip (45 tools / 43 run free / 0 paid / newest check)', () => {
  const home = file('public/index.html');
  assert.ok(!home.includes('facts-strip') && !home.includes('class="stats"') && !home.includes('stats:start'));
});
