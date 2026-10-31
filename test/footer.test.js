import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { footerHtml, FOOTER_CSS, SOCIAL, LINKEDIN_PERSONAL, CONTACT_EMAIL } from '../lib/footer.js';
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

test('the footer has three groups: © and the founder credit, the links with the contact, and the two social icons', () => {
  const html = footerHtml(2026);
  const left = html.match(/<div class="sf-l">(.*?)<\/div>/s)[1];
  assert.ok(left.includes('© 2026 OpenOrbia') && left.includes(`<a href="${LINKEDIN_PERSONAL}" target="_blank" rel="noopener">Built by Khaja Syed, founder</a>`));
  const middle = html.match(/<nav class="sf-m" aria-label="Footer">(.*?)<\/nav>/s)[1];
  const links = [...middle.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(links, [['/launch-list/', 'Tools'], ['/launches/', 'Launches'], ['/submit/', 'Submit a tool'], ['/how-we-check/', 'How we check tools'], ['/how-voting-works/', 'How voting works'],
    [`mailto:${CONTACT_EMAIL}`, `Contact: ${CONTACT_EMAIL}`]]);
  assert.equal(CONTACT_EMAIL, 'hello@openorbia.com');
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
