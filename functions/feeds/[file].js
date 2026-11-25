// Cloudflare Pages Function: GET /feeds/launches.xml|json and /feeds/tools.xml|json (see lib/feeds.js)

import { feedResponse } from '../../lib/feeds.js';

export const onRequestGet = ctx => feedResponse(ctx);
export const onRequestHead = ctx => feedResponse(ctx);
