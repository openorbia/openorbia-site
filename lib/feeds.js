// /feeds/: Atom and JSON Feed versions of two lists, so people can follow OpenOrbia in a feed reader, Slack or Discord.
//
//   /feeds/launches.xml  /feeds/launches.json   every announced Launch Week tool, newest first (from D1), ?for=biz|job|sec
//   /feeds/tools.xml     /feeds/tools.json      the Launch List, newest facts check first (public/assets/tools.js), with the
//                                               same filters as /launch-list/ (?for=, setup=, os=1, local=1, free=0, q=)
//   /feeds/                                     a page that lists them
//
// A feed says nothing a page doesn't: each item is the tool's name, its one-line description and its checked Free facts, linking
// to its page. A launch appears once its lineup is announced (the same rule as the sitemap). A Launch List item is dated by its
// last facts check, so a re-checked tool comes back to the top of a reader: the date is real and on the tool page.

import { esc } from './html.js';
import { layout } from './layout.js';
import { ROWS, TOOLS, CATEGORIES } from '../public/assets/tools.js';
import { factRows, formatChecked } from '../public/assets/facts.js';
import { parseFilters, filterQuery, matchesRow, SETUP_FILTERS } from '../public/assets/launch-filters.js';
import { lineupAnnouncedAt } from './time.js';

const SITE = 'https://openorbia.com';
export const FEED_LIMIT = 50;
export const FEEDS = {
  launches: { title: 'OpenOrbia Launch Week', about: 'New free AI tools (open source, or a real free plan with no trial and no card), as each Launch Week lineup is announced.' },
  tools: { title: 'OpenOrbia Launch List', about: 'Free AI tools on the Launch List (open source, or a real free plan with no trial and no card), newest facts check first.' },
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const dayIso = d => `${d}T00:00:00Z`;
const xml = s => esc(String(s ?? ''));

// One line of facts for a summary: "Free tier: … · Card required: No · The catch: …"
const factsLine = facts => factRows(facts).filter(r => ['freeTier', 'cardRequired', 'catch'].includes(r.key)).map(r => `${r.label}: ${r.value}`).join(' · ');

// ---- the items, shared by both formats: { id, url, title, summary, date (ISO), tags } ----

export function toolItems(search = '') {
  const state = parseFilters(search);
  return ROWS.map((row, i) => [row, TOOLS[i]])
    .filter(([row, t]) => matchesRow(row, state) && ISO_DATE.test(t.facts.lastChecked || ''))
    .map(([, t]) => ({
      id: `${SITE}/tool/${t.slug}/`, url: `${SITE}/tool/${t.slug}/`, title: t.name,
      summary: [t.description, factsLine(t.facts), `Facts checked ${formatChecked(t.facts.lastChecked)}.`].filter(Boolean).join(' '),
      date: dayIso(t.facts.lastChecked), tags: [CATEGORIES[t.category], t.license, t.localAI ? 'Works with local AI' : ''].filter(Boolean),
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title))
    .slice(0, FEED_LIMIT);
}

export const launchFor = search => { const v = new URLSearchParams(search).get('for'); return Object.hasOwn(CATEGORIES, v ?? '') ? v : ''; };

// rows: launches from D1 ({ slug, name, tagline, category, license, launch_date, facts (JSON text or object) })
export function launchItems(rows, now, search = '') {
  const cat = launchFor(search);
  const facts = f => { if (f && typeof f === 'object') return f; try { const v = JSON.parse(f); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
  return rows
    .filter(r => ISO_DATE.test(r.launch_date || '') && now >= lineupAnnouncedAt(r.launch_date) && (!cat || r.category === cat))
    .map(r => ({
      id: `${SITE}/launch/${encodeURIComponent(r.slug)}/`, url: `${SITE}/launch/${encodeURIComponent(r.slug)}/`, title: r.name,
      summary: [r.tagline, factsLine(facts(r.facts)), `Launches ${formatChecked(r.launch_date)}.`].filter(Boolean).join(' '),
      date: new Date(lineupAnnouncedAt(r.launch_date)).toISOString(), tags: [CATEGORIES[r.category], r.license].filter(Boolean),
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title))
    .slice(0, FEED_LIMIT);
}

// ---- the two formats ----

// The feed's own address keeps only the query it understood, so ?for=job&junk=1 and ?for=job are the same feed
export const feedQuery = (name, search) => name === 'tools' ? filterQuery(parseFilters(search)) : (launchFor(search) ? `?for=${launchFor(search)}` : '');
const feedTitle = (name, search) => {
  const cat = name === 'tools' ? parseFilters(search).for : launchFor(search);
  return `${FEEDS[name].title}${Object.hasOwn(CATEGORIES, cat) ? `: ${CATEGORIES[cat]}` : ''}`;
};
const pageFor = (name, query) => name === 'tools' ? `${SITE}/launch-list/${query}` : `${SITE}/launches/`;
const EPOCH = '2026-01-01T00:00:00Z';

export function atomFeed(name, items, search = '') {
  const q = feedQuery(name, search), self = `${SITE}/feeds/${name}.xml${q}`;
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xml(feedTitle(name, search))}</title>
  <subtitle>${xml(FEEDS[name].about)}</subtitle>
  <id>${xml(self)}</id>
  <link rel="self" type="application/atom+xml" href="${xml(self)}"/>
  <link rel="alternate" type="text/html" href="${xml(pageFor(name, q))}"/>
  <updated>${items[0]?.date || EPOCH}</updated>
  <author><name>OpenOrbia</name><uri>${SITE}/</uri></author>
${items.map(i => `  <entry>
    <title>${xml(i.title)}</title>
    <id>${xml(i.id)}</id>
    <link rel="alternate" type="text/html" href="${xml(i.url)}"/>
    <updated>${i.date}</updated>
    <summary>${xml(i.summary)}</summary>
${i.tags.map(t => `    <category term="${xml(t)}"/>`).join('\n')}
  </entry>`).join('\n')}
</feed>
`;
}

export function jsonFeed(name, items, search = '') {
  const q = feedQuery(name, search);
  return JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: feedTitle(name, search),
    description: FEEDS[name].about,
    home_page_url: pageFor(name, q),
    feed_url: `${SITE}/feeds/${name}.json${q}`,
    language: 'en',
    authors: [{ name: 'OpenOrbia', url: `${SITE}/` }],
    items: items.map(i => ({ id: i.id, url: i.url, title: i.title, content_text: i.summary, date_modified: i.date, tags: i.tags })),
  }, null, 2);
}

// ---- responses ----

const TYPES = { xml: 'application/atom+xml; charset=utf-8', json: 'application/feed+json; charset=utf-8' };
export const FEED_FILE = /^(launches|tools)\.(xml|json)$/;

export async function feedResponse({ params, request, env, now = Date.now() }) {
  const m = FEED_FILE.exec(String(params?.file ?? ''));
  if (!m) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  const [, name, kind] = m, search = request ? new URL(request.url).search : '';
  let items = [];
  if (name === 'tools') items = toolItems(search);
  else {
    try {
      const { results } = await env.DB.prepare('SELECT slug, name, tagline, category, license, launch_date, facts FROM launches').all();
      items = launchItems(results, now, search);
    } catch { /* no database: an empty feed is still a valid feed */ }
  }
  const body = kind === 'xml' ? atomFeed(name, items, search) : jsonFeed(name, items, search);
  return new Response(body, { status: 200, headers: { 'content-type': TYPES[kind], 'cache-control': 'public, max-age=900' } });
}

// ---- the /feeds/ page ----

export const FEED_EXAMPLES = [
  ['Every Launch Week tool', 'launches', ''],
  ['Launch Week, security tools only', 'launches', '?for=sec'],
  ['The whole Launch List', 'tools', ''],
  ['Works with local AI', 'tools', '?local=1'],
  ['Open source only', 'tools', '?os=1'],
  ['Self-host, security tools', 'tools', '?for=sec&setup=selfhost'],
  ['Job seekers, no install', 'tools', '?for=job&setup=browser'],
];

export function renderFeeds() {
  const link = (name, q, kind) => `<a href="/feeds/${name}.${kind}${esc(q)}">${kind === 'xml' ? 'Atom' : 'JSON'}</a>`;
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/launch-list/">Launch List</a><span aria-hidden="true">/</span><span>Feeds</span></nav>
<section class="lboard-hero cat-hero">
  <span class="badge"><i></i>Atom · JSON Feed</span>
  <h1>Follow OpenOrbia in <em>your feed reader</em></h1>
  <p>Get new launches and re-checked tools in Feedly, Slack, Discord or any reader, without an email. Each item is the tool's name, its description and its checked Free facts, with a link to its page.</p>
</section>
<section class="about cat-more" aria-labelledby="feeds-h">
  <h2 id="feeds-h">Feeds</h2>
  <ul>${FEED_EXAMPLES.map(([label, name, q]) => `<li><b>${esc(label)}</b>: ${link(name, q, 'xml')} · ${link(name, q, 'json')}</li>`).join('')}</ul>
  <h3>Make your own</h3>
  <p>The Launch List feed takes the same filters as the <a href="/launch-list/">Launch List</a> address: <code>for</code> (${Object.keys(CATEGORIES).map(esc).join(', ')}), <code>setup</code> (${Object.keys(SETUP_FILTERS).map(esc).join(', ')}), <code>os=1</code>, <code>local=1</code>, <code>free=0</code> (include tools that need a paid service) and <code>q</code> (search). Filter the Launch List, then put <code>/feeds/tools.xml</code> in front of the same <code>?…</code>. The Launch Week feed takes <code>for</code>.</p>
  <p class="tool-note">Launch Week items appear when a week's lineup is announced. A Launch List item is dated by its last facts check, so a re-checked tool shows up again. Up to ${FEED_LIMIT} items per feed. <a href="/how-we-check/">How we check tools</a></p>
</section>`;
  return layout({ title: 'RSS and JSON feeds of free AI tools | OpenOrbia', description: 'Atom and JSON feeds of new Launch Week tools and the Launch List, filterable by audience, setup, open source and local AI.', path: '/feeds/', body });
}

const HTML = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' };
export const feedsPageResponse = () => new Response(renderFeeds(), { status: 200, headers: HTML });
