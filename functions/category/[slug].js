// Cloudflare Pages Function: GET /category/<slug>/ (see lib/categories.js)

import { categoryResponse } from '../../lib/categories.js';

export const onRequestGet = ctx => categoryResponse(ctx);
export const onRequestHead = ctx => categoryResponse(ctx);
