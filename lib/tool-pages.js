// /tool/<slug>/: one page per Launch List tool, built from public/assets/tools.js (no database).
// Pure render function plus a Response wrapper, like lib/pages.js.

import { esc, categoryName } from './html.js';
import { layout } from './layout.js';
import { logo, chips, factsBox } from './pages.js';
import { toolBySlug, alternatives } from '../public/assets/tools.js';

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

const altCard = t => `<li><a class="alt" href="/tool/${esc(t.slug)}/">${logo(t, 40)}<span><b>${esc(t.name)}</b><span class="alt-d">${esc(t.description)}</span></span></a></li>`;

export function renderTool(tool) {
  const f = tool.facts;
  const links = [`<a class="btn pri" href="${esc(tool.github)}" target="_blank" rel="noopener">View on GitHub ↗</a>`];
  if (tool.website) links.push(`<a class="btn ghost" href="${esc(tool.website)}" target="_blank" rel="noopener">Visit website ↗</a>`);

  const tags = chips(tool)
    + (tool.localAI ? '<span class="tg loc">Works with local AI</span>' : '')
    + (tool.founder ? '<span class="tg fnd">Built by OpenOrbia\'s founder</span>' : '');
  const notConfirmed = f.cardRequired === 'unknown'
    ? '<p class="tool-note">"Not confirmed" means we could not verify from the tool\'s public docs whether a card is needed. Check the tool\'s own site before you sign up.</p>' : '';
  const founderNote = tool.founder
    ? '<p class="tool-note">OpenOrbia\'s founder built this tool. It is labeled on every page and kept off the Launch Week leaderboard.</p>' : '';
  const category = categoryName(tool.category);
  const alts = alternatives(tool);

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/launch-list/">Launch List</a><span aria-hidden="true">/</span><a href="/launch-list/#${esc(tool.category)}">${esc(category)}</a><span aria-hidden="true">/</span><span>${esc(tool.name)}</span></nav>
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
<section class="about" aria-labelledby="a-h"><h2 id="a-h">About ${esc(tool.name)}</h2><p>${esc(tool.description)}</p>
  <dl class="facts">
    <div><dt>License</dt><dd>${esc(tool.license)}</dd></div>
    <div><dt>Category</dt><dd>${esc(category)}</dd></div>
    <div><dt>Source</dt><dd><a href="${esc(tool.github)}" target="_blank" rel="noopener">${esc(tool.repo)}</a></dd></div>
  </dl>
  ${founderNote}
  <p class="tool-note">Every fact on this page was checked by hand. <a href="/how-we-check/">How we check tools</a></p>
</section>
<section class="alts" aria-labelledby="alt-h"><h2 id="alt-h">Alternatives</h2>
  <ul class="alt-list">${alts.map(altCard).join('')}</ul>
</section>
<p class="back"><a href="/launch-list/#${esc(tool.category)}">← All ${esc(category)} tools</a></p>`;

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
