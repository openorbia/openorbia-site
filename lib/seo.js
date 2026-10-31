// /sitemap.xml: the fixed pages plus one entry for every launch in the database, so new launches show up without a deploy.

import { esc } from './html.js';
import { TOOLS } from '../public/assets/tools.js';

const SITE = 'https://openorbia.com';

// Indexable pages that are not in the database (the 404 page is noindex and left out)
export const STATIC_PATHS = ['/', '/launches/', '/launch-list/', '/makers/', '/how-we-check/', '/how-voting-works/', '/submit/', '/request/'];

// One page per Launch List tool (public/assets/tools.js), so these never need a database
export const TOOL_PATHS = TOOLS.map(t => `/tool/${t.slug}/`);

export function sitemapXml(slugs = []) {
  const paths = [...STATIC_PATHS, ...TOOL_PATHS, ...slugs.map(s => `/launch/${encodeURIComponent(s)}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map(p => `  <url><loc>${esc(SITE + p)}</loc></url>`).join('\n')}
</urlset>
`;
}

export async function sitemapResponse({ env }) {
  let slugs = [];
  try {
    const { results } = await env.DB.prepare('SELECT slug FROM launches ORDER BY launch_week, name COLLATE NOCASE').all();
    slugs = results.map(r => r.slug);
  } catch { /* no database: the fixed pages are still worth listing */ }
  return new Response(sitemapXml(slugs), {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
