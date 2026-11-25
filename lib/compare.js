// /compare/<a>-vs-<b>/: side-by-side pages for Launch List tools that do the same job, built only from the facts already on each
// tool (public/assets/tools.js), so a comparison never says anything a tool page does not. No winner is picked: the page shows
// each checked fact next to the other, lists where they differ and where they are the same, and links the official sources.
//
// The pairs are hand-picked from the tools people already search for by name (Search Console queries, docs/seo/
// SEO_AUDIT_2026-11-20.md: "librechat", "open webui", "anythingllm", "pyrit", "is n8n free", "pentagi", "pentestgpt", "strix").
// Every tool in a comparison must be in the same audience and share a job (TOPICS), which test/compare.test.js checks.

import { esc, categoryName } from './html.js';
import { layout } from './layout.js';
import { SEC_NOTICE } from './tool-pages.js';
import { TOOLS, toolBySlug, TOPICS } from '../public/assets/tools.js';
import { factRows, paidSummary, formatChecked, isTested } from '../public/assets/facts.js';

const SITE = 'https://openorbia.com';

// [tool slugs, the job they share, in a few words]
export const COMPARISONS = [
  [['open-webui', 'librechat'], 'self-hosted AI chat apps'],
  [['anythingllm', 'open-webui'], 'chat with local AI and your documents'],
  [['ollama', 'jan'], 'running AI models on your own computer'],
  [['n8n', 'activepieces'], 'automating tasks between apps'],
  [['garak', 'promptfoo', 'pyrit'], 'testing AI apps for jailbreaks and other weaknesses'],
  [['pentagi', 'pentestgpt', 'strix'], 'AI-assisted penetration testing'],
].map(([slugs, job]) => {
  const tools = slugs.map(s => toolBySlug(s));
  return { slug: slugs.join('-vs-'), slugs, job, tools, name: tools.map(t => t && t.name).join(' vs ') };
});

export const comparisonBySlug = slug => COMPARISONS.find(c => c.slug === slug) || null;
export const compareHref = c => `/compare/${c.slug}/`;
export const COMPARE_PATHS = COMPARISONS.map(compareHref);
export const comparisonsFor = tool => COMPARISONS.filter(c => c.slugs.includes(tool.slug));

export const compareTitle = c => `${c.name}: what's free and the catch | OpenOrbia`;
export const compareDescription = c =>
  `${c.name}, side by side from their official docs: free tier, card, where your data goes, setup, paid parts and the catch.`;

// The facts each column shows, in one fixed order. Each value is exactly what the tool page shows; a missing one says "Not confirmed".
const NOT_CONFIRMED = 'Not confirmed';
export function compareRows(tool) {
  const f = tool.facts, shown = Object.fromEntries(factRows(f).map(r => [r.key, r.value]));
  return [
    ['Free tier', shown.freeTier],
    ['Card required', shown.cardRequired],
    ['Your data', shown.dataLocation],
    ['Setup', shown.setup],
    ['Paid service', paidSummary(f)],
    ['License', tool.license],
    ['Local AI', tool.localAI ? 'Works with local AI' : 'Not listed'],
    ['The catch', shown.catch],
  ].map(([label, value]) => [label, value || NOT_CONFIRMED]);
}

// Where the tools differ and where they agree, on the short facts only (the free tier and the catch are free text, so they are
// shown side by side but never called "the same"). "Your data" is compared on its base value, without the note in brackets.
const SHORT = ['Card required', 'Your data', 'Setup', 'Paid service', 'License', 'Local AI'];
const base = (label, v) => label === 'Your data' ? v.replace(/ \(.*\)$/, '') : label === 'Paid service' ? v.replace(/:.*$/, '') : v;
export function compareSummary(c) {
  const cols = c.tools.map(t => Object.fromEntries(compareRows(t)));
  const same = [], differ = [];
  for (const label of SHORT) {
    const vals = cols.map(col => base(label, col[label]));
    if (vals.includes(NOT_CONFIRMED)) continue;
    (new Set(vals).size === 1 ? same : differ).push({ label, values: vals });
  }
  return { same, differ };
}

export function compareJsonLd(c) {
  const url = SITE + compareHref(c);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Launch List', item: `${SITE}/launch-list/` },
        { '@type': 'ListItem', position: 2, name: c.name, item: url },
      ] },
      { '@type': 'ItemList', name: c.name, url, numberOfItems: c.tools.length,
        itemListElement: c.tools.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `${SITE}/tool/${t.slug}/` })) },
    ],
  };
}

const source = url => { try { const u = new URL(url); return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`; } catch { return url; } };

export function renderCompare(c) {
  const cols = c.tools.map(t => ({ t, rows: compareRows(t) }));
  const labels = cols[0].rows.map(([label]) => label);
  const { same, differ } = compareSummary(c);
  const names = c.tools.map(t => esc(t.name));
  const list = items => items.map(({ label, values }) =>
    `<li><b>${esc(label)}:</b> ${new Set(values).size === 1 ? esc(values[0]) : c.tools.map((t, i) => `${esc(t.name)}: ${esc(values[i])}`).join(' · ')}</li>`).join('');
  const checked = c.tools.map(t => `${esc(t.name)} ${esc(formatChecked(t.facts.lastChecked) || NOT_CONFIRMED)}`).join(' · ');
  const tested = c.tools.filter(t => isTested(t.facts));
  const others = COMPARISONS.filter(o => o.slug !== c.slug && o.tools.some(t => t.category === c.tools[0].category));

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/launch-list/">Launch List</a><span aria-hidden="true">/</span><span>${esc(c.name)}</span></nav>
<section class="lboard-hero cat-hero">
  <span class="badge"><i></i>${c.tools.length} tools · ${esc(categoryName(c.tools[0].category))}</span>
  <h1>${names.join(' <em>vs</em> ')}</h1>
  <p>${c.tools.length === 2 ? 'Two' : 'Three'} free tools for ${esc(c.job)}, side by side. Every fact below is the one on each tool's own page, checked by hand against its official docs. We don't pick a winner: the right one depends on your setup.</p>
</section>
${c.tools[0].category === 'sec' ? SEC_NOTICE : ''}
${labels.map((label, i) => `<section class="about cmp-row" aria-labelledby="cmp-${i}-h"><h2 id="cmp-${i}-h">${esc(label)}</h2>
  <dl class="facts">${cols.map(({ t, rows }) => `<div><dt><a href="/tool/${esc(t.slug)}/">${esc(t.name)}</a></dt><dd>${esc(rows[i][1])}</dd></div>`).join('')}</dl>
</section>`).join('\n')}
<section class="about cmp-sum" aria-labelledby="cmp-sum-h">
  <h2 id="cmp-sum-h">In short</h2>
  ${differ.length ? `<h3>Where they differ</h3><ul>${list(differ)}</ul>` : ''}
  ${same.length ? `<h3>The same for ${c.tools.length === 2 ? 'both' : 'all three'}</h3><ul>${list(same)}</ul>` : ''}
  <p class="tool-note">Facts checked against the official docs: ${checked}. ${tested.length ? `Hands-on tested by OpenOrbia: ${tested.map(t => esc(t.name)).join(', ')}.` : 'None of these has been hands-on tested by OpenOrbia yet.'} <a href="/how-we-check/">How we check tools</a></p>
  ${cols.map(({ t }) => { const s = (t.facts.sources || []).filter(u => String(u).startsWith('https://'));
    return s.length ? `<p class="tool-note">${esc(t.name)} sources: ${s.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(source(u))}</a>`).join(', ')}</p>` : ''; }).join('\n  ')}
  <p class="tool-note">Full pages: ${c.tools.map(t => `<a href="/tool/${esc(t.slug)}/">${esc(t.name)}</a>`).join(' · ')}${others.length ? `. More comparisons: ${others.map(o => `<a href="${compareHref(o)}">${esc(o.name)}</a>`).join(' · ')}` : ''}.</p>
</section>`;
  return layout({ title: compareTitle(c), description: compareDescription(c), path: compareHref(c), body, jsonLd: compareJsonLd(c) });
}

const HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' };

export function compareResponse({ params }) {
  const c = comparisonBySlug(String(params?.slug ?? '').replace(/\/+$/, ''));
  if (c) return new Response(renderCompare(c), { status: 200, headers: HEADERS });
  const body = layout({ title: 'Comparison not found | OpenOrbia', description: 'This comparison is not on OpenOrbia.', path: '/launch-list/', noindex: true,
    body: '<section class="lboard-hero"><span class="badge"><i></i>404</span><h1>That comparison <em>is not here</em>.</h1>\n<p>Browse <a href="/launch-list/">all tools on the Launch List</a>.</p></section>' });
  return new Response(body, { status: 404, headers: { ...HEADERS, 'cache-control': 'no-store' } });
}

// Used by the tests: every tool exists, and shares the audience and at least one job with the others
export const comparisonIsValid = c => c.tools.every(Boolean) && c.tools.length >= 2 && c.tools.length <= 3
  && new Set(c.tools.map(t => t.category)).size === 1
  && (TOPICS[c.slugs[0]] || []).some(k => c.slugs.every(s => (TOPICS[s] || []).includes(k)))
  && c.tools.every(t => TOOLS.includes(t));
