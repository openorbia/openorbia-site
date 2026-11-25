// /collection/<slug>/: cross-cutting lists of Launch List tools, built only from facts already on each tool (no new claims).
// The first one, /collection/self-hosted/, answers the searches Search Console shows most often ("self hosted ai platform",
// "self hosted ai"; docs/seo/SEO_AUDIT_2026-11-20.md). A tool is listed when its checked setup is "Install & self-host", or it is a
// desktop app that works with local AI (it runs on your own machine). Grouped by the four main categories, in their order.

import { esc } from './html.js';
import { layout } from './layout.js';
import { MAIN_CATEGORIES, categoryTools, categoryHref, categoryItem } from './categories.js';
import { TOOLS } from '../public/assets/tools.js';
import { needsPaidService } from '../public/assets/facts.js';

const SITE = 'https://openorbia.com';

export const isSelfHosted = t => t.facts.setup === 'Install & self-host' || (t.facts.setup === 'Desktop app' && !!t.localAI);

export const COLLECTIONS = [
  {
    slug: 'self-hosted',
    name: 'Self-hosted',
    match: isSelfHosted,
    title: 'Free self-hosted AI tools and platforms | OpenOrbia',
    description: 'Free, open-source AI platforms you run on your own server or computer: chat, agents, workflows, careers and security. Each one checked.',
    h1: 'Free <em>self-hosted</em> AI tools',
    intro: 'AI platforms you run yourself, on your own server, in Docker or as a desktop app, so your data stays with you. Every one is free (open source, or a real free plan with no trial and no card), and each tool page says what is free, whether a card or a paid API key is needed, and where your data goes.',
  },
];

export const COLLECTION_PATHS = COLLECTIONS.map(c => `/collection/${c.slug}/`);
export const collectionBySlug = slug => COLLECTIONS.find(c => c.slug === slug) || null;
export const collectionHref = c => `/collection/${c.slug}/`;

// -> [{ label, href, tools }]: each tool once, under the first main category that lists it; tools no category lists go last
export function collectionGroups(col) {
  const seen = new Set(), groups = [];
  for (const cat of MAIN_CATEGORIES) {
    const tools = categoryTools(cat).filter(t => col.match(t) && !seen.has(t.slug));
    tools.forEach(t => seen.add(t.slug));
    if (tools.length) groups.push({ label: cat.key, href: categoryHref(cat), tools });
  }
  const rest = TOOLS.filter(t => col.match(t) && !seen.has(t.slug));
  if (rest.length) groups.push({ label: 'More', href: '/launch-list/', tools: rest });
  return groups;
}

export const collectionTools = col => collectionGroups(col).flatMap(g => g.tools);

const groupId = label => `g-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

export function collectionJsonLd(col) {
  const url = SITE + collectionHref(col), tools = collectionTools(col);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Launch List', item: `${SITE}/launch-list/` },
        { '@type': 'ListItem', position: 2, name: col.name, item: url },
      ] },
      { '@type': 'ItemList', name: `Free ${col.name.toLowerCase()} AI tools`, url, numberOfItems: tools.length,
        itemListElement: tools.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `${SITE}/tool/${t.slug}/` })) },
    ],
  };
}

export function renderCollection(col) {
  const groups = collectionGroups(col), tools = groups.flatMap(g => g.tools);
  const paid = tools.filter(t => needsPaidService(t.facts)).length;
  const desktop = tools.filter(t => t.facts.setup === 'Desktop app').length;
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/launch-list/">Launch List</a><span aria-hidden="true">/</span><span>${esc(col.name)}</span></nav>
<section class="lboard-hero cat-hero">
  <span class="badge"><i></i>${tools.length} tools · ${groups.length} categories</span>
  <h1>${col.h1}</h1>
  <p>${esc(col.intro)}</p>
  <p class="cat-how">${tools.length - desktop} install on your own server (most with Docker) and ${desktop} ${desktop === 1 ? 'is a desktop app' : 'are desktop apps'} that ${desktop === 1 ? 'works' : 'work'} with local AI. ${paid ? `${paid} ${paid === 1 ? 'tool needs' : 'tools need'} a paid AI service and ${paid === 1 ? 'is' : 'are'} labeled.` : 'None of them needs a paid service to work.'}</p>
</section>
<nav class="cat-jump" aria-label="${esc(col.name)} by category"><ul>${groups.map(g => `<li><a href="#${groupId(g.label)}">${esc(g.label)}</a></li>`).join('')}</ul></nav>
${groups.map(g => `<section class="alts cat-topic" id="${groupId(g.label)}" aria-labelledby="${groupId(g.label)}-h">
  <h2 id="${groupId(g.label)}-h">${esc(g.label)}</h2>
  <ul class="alt-list">${g.tools.map(categoryItem).join('')}</ul>
  <p class="tool-note"><a href="${esc(g.href)}">All ${esc(g.label)} tools</a></p>
</section>`).join('\n')}
<section class="about cat-more" aria-labelledby="col-faq-h">
  <h2 id="col-faq-h">Self-hosted AI, briefly</h2>
  <h3>Is self-hosted AI free?</h3>
  <p>The software on this page is free: open source, or a real free plan with no trial and no card. Running it costs whatever your own computer or server costs, and some tools can also call a paid AI service if you choose to; those are labeled, and each tool page says which.</p>
  <h3>Do I need a powerful computer?</h3>
  <p>For the platforms themselves, usually not. Running AI models locally (for example with Ollama) needs more memory, and a graphics card helps. Each tool page lists what it needs to get started.</p>
  <p class="tool-note">Browse by category: ${MAIN_CATEGORIES.map(c => `<a href="${categoryHref(c)}">${esc(c.key)}</a>`).join(' · ')} · <a href="/launch-list/">All tools</a>. <a href="/how-we-check/">How we check tools</a>.</p>
</section>`;
  return layout({ title: col.title, description: col.description, path: collectionHref(col), body, jsonLd: collectionJsonLd(col) });
}

const HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' };

export function collectionResponse({ params }) {
  const col = collectionBySlug(String(params?.slug ?? '').replace(/\/+$/, ''));
  if (col) return new Response(renderCollection(col), { status: 200, headers: HEADERS });
  const body = layout({ title: 'Collection not found | OpenOrbia', description: 'This collection is not on OpenOrbia.', path: '/launch-list/', noindex: true,
    body: '<section class="lboard-hero"><span class="badge"><i></i>404</span><h1>That collection <em>is not here</em>.</h1>\n<p>Browse <a href="/launch-list/">all tools on the Launch List</a>.</p></section>' });
  return new Response(body, { status: 404, headers: { ...HEADERS, 'cache-control': 'no-store' } });
}
