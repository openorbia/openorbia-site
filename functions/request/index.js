// Cloudflare Pages Function: GET /request/ (see lib/form-pages.js)

import { requestResponse } from '../../lib/form-pages.js';

export const onRequestGet = ctx => requestResponse(ctx.env);
export const onRequestHead = ctx => requestResponse(ctx.env);
