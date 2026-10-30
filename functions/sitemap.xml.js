// Cloudflare Pages Function: GET /sitemap.xml (see lib/seo.js)

import { sitemapResponse } from '../lib/seo.js';

export const onRequestGet = ctx => sitemapResponse(ctx);
export const onRequestHead = ctx => sitemapResponse(ctx);
