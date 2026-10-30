// /tool/<slug>/: one page per Launch List tool, built from public/assets/tools.js (no database).
// Pure render function plus a Response wrapper, like lib/pages.js.

import { esc, categoryName } from './html.js';
import { layout } from './layout.js';
import { logo, chips, factsBox } from './pages.js';
import { toolBySlug, alternatives } from '../public/assets/tools.js';
import { needsPaidService, paidSummary, NEEDS_PAID_LABEL, FACT_LEVEL_LABELS } from '../public/assets/facts.js';

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

// "Free facts from docs": how deep the facts go, what (if anything) costs money, what it helps you do, and the official pages they came from
function docsFacts(tool) {
  const f = tool.facts, paid = paidSummary(f);
  if (!paid && !f.task && !(f.sources || []).length) return '';
  const level = FACT_LEVEL_LABELS[f.level] || '';
  const source = url => { try { const u = new URL(url); return `${u.hostname.replace(/^www./, '')}${u.pathname === '/' ? '' : u.pathname}${u.hash}`; } catch { return url; } };
  const sources = (f.sources || []).filter(u => String(u).startsWith('https://'));
  return `<section class="about docs-facts" aria-labelledby="docs-h"><h2 id="docs-h">Free facts from docs</h2>
  <dl class="facts">
    ${level ? `<div><dt>Level</dt><dd>${esc(level)}</dd></div>` : ''}
    ${paid ? `<div><dt>Paid service</dt><dd>${esc(paid)}</dd></div>` : ''}
    ${f.task ? `<div class="wide"><dt>Helps you</dt><dd>${esc(f.task)}</dd></div>` : ''}
  </dl>
  ${sources.length ? `<p class="tool-note">Read from the official docs: ${sources.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(source(u))}</a>`).join(', ')}</p>` : ''}
</section>`;
}

const altCard = t => `<li><a class="alt" href="/tool/${esc(t.slug)}/">${logo(t, 40)}<span><b>${esc(t.name)}</b><span class="alt-d">${esc(t.description)}</span></span></a></li>`;

export function renderTool(tool) {
  const f = tool.facts;
  // every link to the tool goes through /go/<slug>, which counts the click (no IP, no cookies) and redirects to the repo, or the site once we record one
  const go = `/go/${esc(tool.slug)}`;
  const links = [`<a class="btn pri" href="${go}" target="_blank" rel="noopener">${tool.website ? 'Visit website' : 'View on GitHub'} ↗</a>`];

  const tags = chips(tool)
    + (tool.localAI ? '<span class="tg loc">Works with local AI</span>' : '')
    + (needsPaidService(f) ? `<span class="tg paid">${NEEDS_PAID_LABEL}</span>` : '')
    + (tool.founder ? '<span class="tg fnd">Built by OpenOrbia\'s founder</span>' : '');
  const notConfirmed = f.cardRequired === 'unknown'
    ? '<p class="tool-note">"Not confirmed" means we could not verify from the tool\'s public docs whether a card is needed. Check the tool\'s own site before you sign up.</p>' : '';
  const founderNote = tool.founder
    ? '<p class="tool-note">OpenOrbia\'s founder built this tool. It is labeled on every page and kept off the Launch Week leaderboard.</p>' : '';
  const category = categoryName(tool.category);
  const alts = alternatives(tool);

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
<div class="actions">${links.join('')}</div>
${factsBox(f)}
${notConfirmed}
${docsFacts(tool)}
<section class="about" aria-labelledby="a-h"><h2 id="a-h">About ${esc(tool.name)}</h2><p>${esc(tool.description)}</p>
  <dl class="facts">
    <div><dt>License</dt><dd>${esc(tool.license)}</dd></div>
    <div><dt>Category</dt><dd>${esc(category)}</dd></div>
    <div><dt>Source</dt><dd><a href="${go}" target="_blank" rel="noopener">${esc(tool.repo)}</a></dd></div>
  </dl>
  ${founderNote}
  <p class="tool-note">Every fact on this page was checked by hand. <a href="/how-we-check/">How we check tools</a></p>
</section>
<section class="alts" aria-labelledby="alt-h"><h2 id="alt-h">Alternatives</h2>
  <ul class="alt-list">${alts.map(altCard).join('')}</ul>
</section>
<p class="back"><a href="/launch-list/?for=${esc(tool.category)}">← All ${esc(category)} tools</a></p>`;

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
