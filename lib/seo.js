// /sitemap.xml: the fixed pages plus one entry for every launch in the database, so new launches show up without a deploy.

import { esc } from './html.js';
import { TOOLS } from '../public/assets/tools.js';
import { lineupAnnouncedAt } from './time.js';
import { CATEGORY_PATHS } from './categories.js';
import { COLLECTION_PATHS } from './collections.js';

const SITE = 'https://openorbia.com';

// Indexable pages that are not in the database (the 404 page is noindex and left out)
export const STATIC_PATHS = ['/', '/launches/', '/launch-list/', '/makers/', '/how-we-check/', '/how-voting-works/', '/faq/', '/privacy/', '/security/', '/contact/', '/submit/', '/request/', '/free-ai-apis/', '/feeds/'];

// The four main category pages (lib/categories.js), built from the Launch List, so they need no database either
export { CATEGORY_PATHS };

// Collection pages (lib/collections.js, e.g. /collection/self-hosted/), also built from the Launch List
export { COLLECTION_PATHS };

// One page per Launch List tool (public/assets/tools.js), so these never need a database
export const TOOL_PATHS = TOOLS.map(t => `/tool/${t.slug}/`);

// <lastmod> only where the date is real: a tool page changes when its facts are re-checked, so its lastChecked date (YYYY-MM-DD) is
// used. The other pages leave it out rather than guess; search engines ignore a lastmod that is not accurate.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const TOOL_LASTMOD = Object.fromEntries(TOOLS.filter(t => ISO_DATE.test(t.facts.lastChecked || '')).map(t => [`/tool/${t.slug}/`, t.facts.lastChecked]));

export function sitemapXml(slugs = []) {
  const paths = [...STATIC_PATHS, ...CATEGORY_PATHS, ...COLLECTION_PATHS, ...TOOL_PATHS, ...slugs.map(s => `/launch/${encodeURIComponent(s)}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map(p => `  <url><loc>${esc(SITE + p)}</loc>${TOOL_LASTMOD[p] ? `<lastmod>${TOOL_LASTMOD[p]}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}

export async function sitemapResponse({ env, now = Date.now() }) {
  let slugs = [];
  try {
    const { results } = await env.DB.prepare('SELECT slug, launch_date FROM launches ORDER BY launch_week, name COLLATE NOCASE').all();
    // a launch page is listed only once its week's lineup is announced (the Wednesday before launch day, lib/time.js)
    slugs = results.filter(r => now >= lineupAnnouncedAt(r.launch_date)).map(r => r.slug);
  } catch { /* no database: the fixed pages are still worth listing */ }
  return new Response(sitemapXml(slugs), {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
