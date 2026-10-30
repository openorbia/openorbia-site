// Cloudflare Pages Function: GET /submit/ (see lib/form-pages.js)

import { submitResponse } from '../../lib/form-pages.js';

export const onRequestGet = ctx => submitResponse(ctx.env);
export const onRequestHead = ctx => submitResponse(ctx.env);
