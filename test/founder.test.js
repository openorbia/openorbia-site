import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layout } from '../lib/layout.js';
import { renderMakers } from '../lib/makers.js';
import { renderTool } from '../lib/tool-pages.js';
import { renderHowWeCheck } from '../lib/how-we-check.js';
import { renderSubmit } from '../lib/form-pages.js';
import { TOOLS, toolBySlug } from '../public/assets/tools.js';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const CREDIT = '<span>© ' + new Date().getFullYear() + ' OpenOrbia · Founder: Khaja Syed</span>';
const LABEL = "Built by Khaja Syed, OpenOrbia's founder";
const OLD_LABEL = "Built by OpenOrbia's founder";

test('every page has "Founder: Khaja Syed" in its footer as plain text, with no link to a personal profile', () => {
  const pages = {
    layout: layout({ title: 't', description: 'd', path: '/', body: '' }), makers: renderMakers(), howWeCheck: renderHowWeCheck(), submit: renderSubmit(), tool: renderTool(toolBySlug('meetily')),
    home: file('public/index.html'), list: file('public/launch-list/index.html'), notFound: file('public/404.html'),
  };
  for (const [name, html] of Object.entries(pages)) {
    const footer = html.slice(html.indexOf('<footer>'), html.indexOf('</footer>'));
    assert.ok(footer.includes('Founder: Khaja Syed') && !footer.includes('Built by Khaja Syed') && !footer.includes('linkedin.com/in/'), name);
    assert.ok(footer.replace('<span id="yr">2026</span>', String(new Date().getFullYear())).includes(CREDIT), `${name}: credit`);
  }
});

test('/makers/ says who to ask: Khaja, the founder, at hello@openorbia.com', () => {
  const html = renderMakers();
  assert.ok(html.includes('Questions? Email Khaja, OpenOrbia\'s founder, at <a href="mailto:hello@openorbia.com">hello@openorbia.com</a>.'));
});

test('the founder label names Khaja Syed everywhere it appears, and the old wording is gone', () => {
  const founder = TOOLS.filter(t => t.founder);
  assert.deepEqual(founder.map(t => t.name), ['SOC Range']);
  const tool = renderTool(founder[0]).replace(/&#39;/g, "'");
  assert.ok(tool.includes(`<span class="tg fnd">${LABEL}</span>`));
  assert.ok(file('public/launch-list/index.html').includes(LABEL));
  assert.ok(renderHowWeCheck().replace(/&#39;/g, "'").includes(`labeled "${LABEL}"`) || renderHowWeCheck().replace(/&#39;/g, "'").includes(`labeled &quot;${LABEL}&quot;`));
  for (const f of ['lib/tool-pages.js', 'lib/how-we-check.js', 'public/launch-list/index.html', 'public/index.html', 'lib/makers.js', 'lib/pages.js']) assert.ok(!file(f).includes(OLD_LABEL), `${f}: old label`);
  // no other tool carries the label
  for (const t of TOOLS.filter(x => !x.founder)) assert.ok(!renderTool(t).includes('Khaja Syed, OpenOrbia'), t.name);
});

test('the Launch List intro holds only its own sentence and the How we check link; the other links live in the footer', () => {
  const html = file('public/launch-list/index.html');
  assert.ok(html.includes('No trials, no paywalls. <a href="/how-we-check/">How we check tools</a>.</p>'));
  const footer = html.slice(html.indexOf('<footer>'), html.indexOf('</footer>'));
  for (const href of ['/how-we-check/', '/how-voting-works/', '/makers/', '/request/']) assert.ok(footer.includes(`href="${href}"`), href);
});
