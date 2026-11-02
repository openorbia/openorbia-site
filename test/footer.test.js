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

test('the footer has three groups: © and the founder credit as plain text, the four links, and the two social icons', () => {
  const html = footerHtml(2026);
  const left = html.match(/<div class="sf-l">(.*?)<\/div>/s)[1];
  assert.equal(left, '<span>© 2026 OpenOrbia · Founder: Khaja Syed</span>');
  assert.ok(!left.includes('<a') && !html.includes('Built by Khaja Syed') && !html.includes('linkedin.com/in/'), 'plain text, no personal link');
  const middle = html.match(/<nav class="sf-m" aria-label="Footer">(.*?)<\/nav>/s)[1];
  const links = [...middle.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(links, [['/how-we-check/', 'How we check tools'], ['/how-voting-works/', 'How voting works'], ['/makers/', 'For makers'], ['/request/', 'Find me a free tool']]);
  const right = html.match(/<div class="sf-r">(.*?)<\/div>/s)[1];
  assert.ok(right.indexOf('OpenOrbia on X') < right.indexOf('OpenOrbia on LinkedIn'));
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

test('the footer site map: five columns, and each audience lists 5 tools that run free, never the founder\'s own', async () => {
  const { footerTools, FOOTER_TOOLS } = await import('../lib/footer.js');
  const { needsPaidService } = await import('../public/assets/facts.js');
  const html = footerHtml(2026);
  const heads = [...html.matchAll(/<p class="sf-h">([^<]+)<\/p>/g)].map(m => m[1]);
  assert.deepEqual(heads, ['Small Business', 'Job Seekers', 'Cybersecurity &amp; SOC', 'Find by setup', 'Launch']);
  for (const cat of ['biz', 'job', 'sec']) {
    const tools = footerTools(cat);
    assert.equal(tools.length, FOOTER_TOOLS, cat);
    for (const t of tools) {
      assert.ok(t.category === cat && !t.founder && !needsPaidService(t.facts), t.name);
      assert.ok(html.includes(`<a href="/tool/${t.slug}/">`), `${t.name} is linked`);
    }
    assert.ok(html.includes(`<a class="sf-all" href="/launch-list/?for=${cat}">`), `${cat}: all tools link`);
  }
});

test('every link in the footer site map goes to a real page', async () => {
  const { existsSync } = await import('node:fs');
  const pages = { '/launch-list/': 'public/launch-list/index.html', '/launches/': 'functions/launches/index.js', '/makers/': 'functions/makers/index.js',
    '/submit/': 'functions/submit/index.js', '/request/': 'functions/request/index.js', '/how-voting-works/': 'functions/how-voting-works/index.js' };
  const map = footerHtml(2026).match(/<nav class="sf-map"[\s\S]*?<\/nav>/)[0];
  for (const [, href] of map.matchAll(/href="([^"]+)"/g)) {
    const path = new URL(href, 'https://openorbia.com').pathname;
    if (path.startsWith('/tool/')) assert.ok(toolBySlug(path.split('/')[2]), href);
    else assert.ok(pages[path] && existsSync(new URL(`../${pages[path]}`, import.meta.url)), href);
  }
});

test('the homepage has no numbers strip (45 tools / 43 run free / 0 paid / newest check)', () => {
  const home = file('public/index.html');
  assert.ok(!home.includes('facts-strip') && !home.includes('class="stats"') && !home.includes('stats:start'));
});
