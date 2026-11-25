// Cloudflare Pages Function: GET /compare/<slug>/ (see lib/compare.js)

import { compareResponse } from '../../lib/compare.js';

export const onRequestGet = ctx => compareResponse(ctx);
export const onRequestHead = ctx => compareResponse(ctx);
