// /tool/<slug>/: one page per Launch List tool, built from public/assets/tools.js (no database).
// Pure render function plus a Response wrapper, like lib/pages.js.

import { esc, categoryName } from './html.js';
import { layout } from './layout.js';
import { logo, chips, factsBox } from './pages.js';
import { toolBySlug, alternatives, toolHref } from '../public/assets/tools.js';
import { renderFirstResult } from './first-result.js';
import { COMMUNITY } from './footer.js';
import { needsPaidService, paidSummary, NEEDS_PAID_LABEL, FACT_LEVEL_LABELS, formatChecked, isTested } from '../public/assets/facts.js';

const MAX_DESCRIPTION = 158;

export const toolTitle = tool => `Is ${tool.name} free? What's free, the catch and setup | OpenOrbia`;

// A description for search results that is different on every page: the tool's own free tier, card and catch. The check date
// is on the page; leaving it out here keeps room for the catch.
export function toolDescription(tool) {
  const f = tool.facts;
  const card = { yes: 'A card is required', no: 'No card required' }[f.cardRequired];
  const parts = [f.freeTier, card, f.catch ? `The catch: ${f.catch}` : ''].filter(Boolean);
  const text = `${tool.name}: ${parts.join('. ')}.`;
  if (text.length <= MAX_DESCRIPTION) return text;
  const cut = text.slice(0, MAX_DESCRIPTION - 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

// "Paid parts and sources": how deep the facts go, what (if anything) costs money, what it helps you do, and the official pages
// they came from. It sits right under the Free facts, which come from the same docs.
function docsFacts(tool) {
  const f = tool.facts, paid = paidSummary(f);
  if (!paid && !f.task && !(f.sources || []).length) return '';
  const source = url => { try { const u = new URL(url); return `${u.hostname.replace(/^www./, '')}${u.pathname === '/' ? '' : u.pathname}${u.hash}`; } catch { return url; } };
  const sources = (f.sources || []).filter(u => String(u).startsWith('https://'));
  return `<section class="about docs-facts" aria-labelledby="docs-h"><h2 id="docs-h">Paid parts and sources</h2>
  <dl class="facts">
    ${paid ? `<div><dt>Paid service</dt><dd>${esc(paid)}</dd></div>` : ''}
    ${f.task ? `<div class="wide"><dt>Helps you</dt><dd>${esc(f.task)}</dd></div>` : ''}
  </dl>
  ${sources.length ? `<p class="tool-note">Read from the official docs: ${sources.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(source(u))}</a>`).join(', ')}</p>` : ''}
</section>`;
}

// The "At a glance" panel beside the facts: the plain details, and how the facts were checked. "Checked against docs" and
// "Hands-on tested" are two separate lines on purpose: reading the docs is not the same as running the tool.
function glance(tool, link) {
  const f = tool.facts, category = categoryName(tool.category), checked = formatChecked(f.lastChecked);
  const level = FACT_LEVEL_LABELS[f.level] || '';
  const row = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;
  return `<aside class="tool-side" aria-labelledby="side-h"><h2 id="side-h">At a glance</h2>
    <dl class="side-dl">
      ${row('License', esc(tool.license))}
      ${row('Category', `<a href="/launch-list/?for=${esc(tool.category)}">${esc(category)}</a>`)}
      ${f.setup ? row('Setup', esc(f.setup)) : ''}
      ${level ? row('Skill level', esc(level)) : ''}
      ${row('Local AI', tool.localAI ? 'Works with local AI' : 'Not listed')}
      ${row('Source', `<a href="${esc(tool.github)}" data-tool="${esc(tool.slug)}" target="_blank" rel="noopener">${esc(tool.repo)}</a>`)}
    </dl>
    <div class="verify">
      <p class="vf ok"><span aria-hidden="true">✓</span><span>Facts checked by hand against the official docs${checked ? `, ${esc(checked)}` : ''}</span></p>
      ${isTested(f) ? '<p class="vf ok"><span aria-hidden="true">✓</span><span>Hands-on tested by OpenOrbia</span></p>' : '<p class="vf no"><span aria-hidden="true">○</span><span>Not hands-on tested yet</span></p>'}
      <a href="/how-we-check/">How we check tools</a>
    </div>
    ${link}
  </aside>`;
}

export const reportLine = tool => `<p class="tool-note tool-report">Something changed or didn't work? <a href="/contact/?tool=${encodeURIComponent(tool.slug)}">Report it</a></p>`;

const altCard = t => `<li><a class="alt" href="/tool/${esc(t.slug)}/">${logo(t, 40)}<span><b>${esc(t.name)}</b><span class="alt-d">${esc(t.description)}</span></span></a></li>`;

export function renderTool(tool) {
  const f = tool.facts;
  // links go straight to the tool, so it gets a real link; data-tool lets public/assets/click-beacon.js count the follow (a count per tool per day, nothing else)
  const links = [`<a class="btn pri" href="${esc(toolHref(tool))}" data-tool="${esc(tool.slug)}" target="_blank" rel="noopener">${tool.website ? 'Visit website' : 'View on GitHub'} ↗</a>`];

  const tags = chips(tool)
    + (tool.localAI ? '<span class="tg loc">Works with local AI</span>' : '')
    + (needsPaidService(f) ? `<span class="tg paid">${NEEDS_PAID_LABEL}</span>` : '')
    + (tool.founder ? '<span class="tg fnd">Built by Khaja Syed, OpenOrbia\'s founder</span>' : '');
  const notConfirmed = f.cardRequired === 'unknown'
    ? '<p class="tool-note">"Not confirmed" means we could not verify from the tool\'s public docs whether a card is needed. Check the tool\'s own site before you sign up.</p>' : '';
  const founderNote = tool.founder
    ? '<p class="tool-note">OpenOrbia\'s founder built this tool. It is labeled on every page and kept off the Launch Week leaderboard.</p>' : '';
  const category = categoryName(tool.category);
  const alts = alternatives(tool);
  // under the facts and under the First useful result: /contact/?tool=<slug> starts a correction email for this tool
  const report = reportLine(tool);
  const firstResult = renderFirstResult(f.firstResult);

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/launch-list/">Launch List</a><span aria-hidden="true">/</span><a href="/launch-list/?for=${esc(tool.category)}">${esc(category)}</a><span aria-hidden="true">/</span><span>${esc(tool.name)}</span></nav>
<section class="lhero">
  <div class="lhero-main">
    ${logo(tool, 84)}
    <div class="lhero-text">
      <div class="chips">${tags}</div>
      <h1>${esc(tool.name)}</h1>
      <p class="tagline">${esc(tool.description)}</p>
    </div>
  </div>
</section>
<div class="actions">${links.join('')}${alts.length ? '<a class="btn ghost" href="#alt-h">See alternatives</a>' : ''}</div>
<div class="tool-grid">
  <div class="tool-main">
    ${firstResult ? `${firstResult}\n    ${report}` : ''}
    ${factsBox(f)}
    ${report}
    ${notConfirmed}
    ${docsFacts(tool)}
    ${founderNote}
    <p class="tool-note tool-help">Stuck installing ${esc(tool.name)}? <a href="${COMMUNITY.qa}">Ask in Community Q&amp;A</a>, or <a href="${COMMUNITY.setups}">share your free setup</a>. Posts there are public, on GitHub.</p>
  </div>
  ${glance(tool, links[0])}
</div>
${alts.length ? `<section class="alts" aria-labelledby="alt-h"><h2 id="alt-h">Alternatives</h2>
  <ul class="alt-list">${alts.map(altCard).join('')}</ul>
</section>
` : ''}<p class="back"><a href="/launch-list/?for=${esc(tool.category)}">← All ${esc(category)} tools</a></p>`;

  return layout({ title: toolTitle(tool), description: toolDescription(tool), path: `/tool/${tool.slug}/`, body });
}

const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=300',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

export function renderToolNotFound() {
  return layout({
    title: 'Tool not found | OpenOrbia', description: 'This tool is not on the Launch List.', path: '/launch-list/', noindex: true,
    body: '<section class="lboard-hero"><span class="badge"><i></i>404</span><h1>That tool <em>is not here</em>.</h1>\n<p>The link may be wrong, or the tool is not on the list. <a href="/launch-list/">Browse the Launch List</a>.</p></section>',
  });
}

export function toolResponse({ params }) {
  const slug = String(params?.slug ?? '').replace(/\/+$/, '');
  const tool = toolBySlug(slug);
  return tool
    ? new Response(renderTool(tool), { status: 200, headers: HEADERS })
    : new Response(renderToolNotFound(), { status: 404, headers: { ...HEADERS, 'cache-control': 'no-store' } });
}
