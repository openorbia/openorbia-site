// /category/<slug>/: one page for each of the four main categories in the footer site map (Productivity, Automation & AI, Careers,
// Security). No second category system: the topics and their search words are CATEGORY_LINKS in lib/footer.js, and a tool is listed
// under a topic when that same Launch List search finds it (matchesRow in public/assets/launch-filters.js). Each topic also says which
// Launch List audiences (biz, job, sec) it takes tools from, so a security scanner whose description mentions "chat" is not listed
// under Productivity. Tools that need a paid service are listed too, with the label, because these pages describe a kind of work rather
// than the runs-free default view.
//
// Small businesses, Job seekers and Security teams stay what they are: audience filters on the Launch List (?for=biz|job|sec).

import { esc } from './html.js';
import { layout } from './layout.js';
import { logo } from './pages.js';
import { CATEGORY_LINKS } from './footer.js';
import { SEC_NOTICE } from './tool-pages.js';
import { ROWS, TOOLS } from '../public/assets/tools.js';
import { matchesRow, emptyFilters } from '../public/assets/launch-filters.js';
import { needsPaidService, NEEDS_PAID_LABEL } from '../public/assets/facts.js';

const SITE = 'https://openorbia.com';
export const searchHref = q => `/launch-list/?q=${encodeURIComponent(q).replace(/%20/g, '+')}`;

// key = the heading in CATEGORY_LINKS. audiences = where a topic's tools come from (a topic can narrow it in `topics`);
// more = an audience whose remaining tools are listed at the end, so every Job seekers or Security teams tool is on a category page.
export const MAIN_CATEGORIES = [
  {
    slug: 'productivity', key: 'Productivity', audiences: ['biz'],
    title: 'Free AI productivity tools: chat, documents, meetings and email | OpenOrbia',
    h1: 'Free AI tools for <em>productivity</em>.',
    description: 'Free and open-source AI tools for private AI chat, your documents, meeting notes, email, AI search, CRM and social media, with the catch shown up front.',
    intro: 'AI assistants you can run privately, tools that answer questions from your own documents, and open-source apps for meetings, email, web search, sales and social media.',
  },
  {
    slug: 'automation-and-ai', key: 'Automation & AI', audiences: ['biz', 'sec'], topics: { 'Chatbots & AI apps': ['biz'] },
    title: 'Free AI automation tools: workflows, AI agents and chatbots | OpenOrbia',
    h1: 'Free AI tools for <em>automation</em>.',
    description: 'Free and open-source workflow automation, AI agents and chatbot builders, with what is free, what needs a paid API key and where your data goes shown up front.',
    intro: 'Workflow builders that connect your apps, AI agents that carry out multi-step work, and tools for building your own chatbots and AI apps. Some of the agents here are built for security teams.',
  },
  {
    slug: 'careers', key: 'Careers', audiences: ['job'], more: 'job', moreLabel: 'More career tools',
    title: 'Free AI career tools: resumes, cover letters and interviews | OpenOrbia',
    h1: 'Free AI tools for your <em>career</em>.',
    description: 'Free and open-source AI tools for resumes and CVs, cover letters, job search tracking, interview practice and LinkedIn profiles, with the catch shown first.',
    intro: 'Open-source tools for tailoring a resume, writing cover letters, tracking applications, practising interviews and improving a LinkedIn profile. Several run on your own computer, so your resume stays with you.',
  },
  {
    slug: 'security', key: 'Security', audiences: ['sec'], more: 'sec', moreLabel: 'More security tools',
    title: 'Free AI security tools: red teaming, pentesting and SOC | OpenOrbia',
    h1: 'Free AI tools for <em>security</em>.',
    description: 'Free and open-source AI tools for AI red teaming, jailbreak testing, guardrails, penetration testing, SOC alert triage and threat detection, checked against docs.',
    intro: 'Tools for testing AI models and apps for jailbreaks and prompt injection, adding guardrails, running AI-assisted penetration tests on systems you are allowed to test, and triaging alerts in a SOC.',
  },
];

export const CATEGORY_PATHS = MAIN_CATEGORIES.map(c => `/category/${c.slug}/`);
export const categoryBySlug = slug => MAIN_CATEGORIES.find(c => c.slug === slug) || null;
export const categoryHref = cat => `/category/${cat.slug}/`;

const rowsFor = (q, audiences) => ROWS.filter(r => audiences.includes(r[3]) && matchesRow(r, { ...emptyFilters(), free: false, q }));
const toolOf = row => TOOLS.find(t => t.name === row[0]);

// -> [{ label, q, tools }] for each topic that lists at least one tool, then the `more` group. A tool can be under several topics.
export function categoryTopics(cat) {
  const topics = CATEGORY_LINKS[cat.key].map(([label, q]) => ({ label, q, tools: rowsFor(q, cat.topics?.[label] || cat.audiences).map(toolOf) }));
  const listed = new Set(topics.flatMap(t => t.tools.map(x => x.slug)));
  const out = topics.filter(t => t.tools.length);
  if (cat.more) {
    const rest = TOOLS.filter(t => t.category === cat.more && !listed.has(t.slug));
    if (rest.length) out.push({ label: cat.moreLabel, q: '', tools: rest });
  }
  return out;
}

// topics that find no tool in the category's audiences: a content gap to fill with checked tools, never filler (docs/seo/SEO_AUDIT.md)
export const emptyTopics = cat => CATEGORY_LINKS[cat.key].filter(([label, q]) => !rowsFor(q, cat.topics?.[label] || cat.audiences).length).map(([label]) => label);

// every tool on the page once, in order of first appearance
export const categoryTools = cat => [...new Map(categoryTopics(cat).flatMap(t => t.tools).map(t => [t.slug, t])).values()];

// the main categories a tool is listed in (for the "Use cases" row on its page)
export const categoriesForTool = tool => MAIN_CATEGORIES.filter(c => categoryTools(c).some(t => t.slug === tool.slug));

const topicId = label => `t-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

const item = t => {
  const tags = [t.localAI ? '<span class="tg loc">Works with local AI</span>' : '', needsPaidService(t.facts) ? `<span class="tg paid">${NEEDS_PAID_LABEL}</span>` : ''].join('');
  return `<li><a class="alt" href="/tool/${esc(t.slug)}/">${logo(t, 40)}<span><b>${esc(t.name)}</b><span class="alt-d">${esc(t.description)}</span>`
    + `${t.facts.freeTier ? `<span class="cat-free"><span>Free:</span> ${esc(t.facts.freeTier)}</span>` : ''}${tags ? `<span class="chips cat-tags">${tags}</span>` : ''}</span></a></li>`;
};

// JSON-LD: the visible breadcrumb, and the tools on the page as a list of links (no ratings, prices or claims)
export function categoryJsonLd(cat) {
  const url = SITE + categoryHref(cat);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Launch List', item: `${SITE}/launch-list/` },
        { '@type': 'ListItem', position: 2, name: cat.key, item: url },
      ] },
      { '@type': 'ItemList', name: `Free AI tools for ${cat.key}`, url, numberOfItems: categoryTools(cat).length,
        itemListElement: categoryTools(cat).map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `${SITE}/tool/${t.slug}/` })) },
    ],
  };
}

export function renderCategory(cat) {
  const topics = categoryTopics(cat), tools = categoryTools(cat);
  const paid = tools.filter(t => needsPaidService(t.facts)).length;
  const others = MAIN_CATEGORIES.filter(c => c !== cat);
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/launch-list/">Launch List</a><span aria-hidden="true">/</span><span>${esc(cat.key)}</span></nav>
<section class="lboard-hero cat-hero">
  <span class="badge"><i></i>${tools.length} tools · ${topics.length} topics</span>
  <h1>${cat.h1}</h1>
  <p>${esc(cat.intro)}</p>
  <p class="cat-how">Every tool shows what is free, whether a card or a paid API key is needed, and where your data goes, checked by hand against its official docs. ${paid ? `${paid} ${paid === 1 ? 'tool needs' : 'tools need'} a paid service and ${paid === 1 ? 'is' : 'are'} labeled.` : 'None of them needs a paid service to work.'}</p>
</section>
<nav class="cat-jump" aria-label="${esc(cat.key)} topics"><ul>${topics.map(t => `<li><a href="#${topicId(t.label)}">${esc(t.label)}</a></li>`).join('')}</ul></nav>
${cat.slug === 'security' ? SEC_NOTICE : ''}
${topics.map(t => `<section class="alts cat-topic" id="${topicId(t.label)}" aria-labelledby="${topicId(t.label)}-h">
  <h2 id="${topicId(t.label)}-h">${esc(t.label)}</h2>
  <ul class="alt-list">${t.tools.map(item).join('')}</ul>
  ${t.q ? `<p class="tool-note"><a href="${esc(searchHref(t.q))}">Filter “${esc(t.label)}” on the Launch List</a></p>` : ''}
</section>`).join('\n')}
<section class="about cat-more" aria-labelledby="cat-more-h">
  <h2 id="cat-more-h">More ways to browse</h2>
  <p>${others.map(c => `<a href="${categoryHref(c)}">${esc(c.key)}</a>`).join(' · ')} · <a href="/launch-list/">All tools</a></p>
  <p>By who you are: <a href="/launch-list/?for=biz">Small businesses</a> · <a href="/launch-list/?for=job">Job seekers</a> · <a href="/launch-list/?for=sec">Security teams</a>. By setup: <a href="/launch-list/?setup=browser">No install</a> · <a href="/launch-list/?local=1">Works with local AI</a> · <a href="/launch-list/?os=1">Open source only</a>.</p>
  <p class="tool-note">How tools are grouped: a tool is listed under a topic when the Launch List search for that topic finds it, so a tool can be under more than one topic or category. Something misplaced? <a href="/contact/">Tell us</a>. <a href="/how-we-check/">How we check tools</a>.</p>
</section>`;
  return layout({ title: cat.title, description: cat.description, path: categoryHref(cat), body, jsonLd: categoryJsonLd(cat) });
}

const HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' };

export function categoryResponse({ params }) {
  const cat = categoryBySlug(String(params?.slug ?? '').replace(/\/+$/, ''));
  if (cat) return new Response(renderCategory(cat), { status: 200, headers: HEADERS });
  const body = layout({ title: 'Category not found | OpenOrbia', description: 'This category is not on OpenOrbia.', path: '/launch-list/', noindex: true,
    body: '<section class="lboard-hero"><span class="badge"><i></i>404</span><h1>That category <em>is not here</em>.</h1>\n<p>Browse <a href="/launch-list/">all tools on the Launch List</a>.</p></section>' });
  return new Response(body, { status: 404, headers: { ...HEADERS, 'cache-control': 'no-store' } });
}
