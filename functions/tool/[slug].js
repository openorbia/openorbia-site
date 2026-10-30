// Cloudflare Pages Function: GET /tool/<slug>/ (see lib/tool-pages.js)

import { toolResponse } from '../../lib/tool-pages.js';

export const onRequestGet = ctx => toolResponse(ctx);
export const onRequestHead = ctx => toolResponse(ctx);
