// Cloudflare Pages Function: GET /launch/<slug>/ : one launch page, rendered from D1 (see lib/pages.js)

import { launchResponse } from '../../lib/pages.js';

export const onRequestGet = ctx => launchResponse(ctx);
export const onRequestHead = ctx => launchResponse(ctx);
