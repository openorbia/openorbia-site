// Cloudflare Pages Function: GET /go/<slug> : count the click, then 302 to the tool's repo (see lib/go.js)

import { goResponse } from '../../lib/go.js';

export const onRequestGet = ctx => goResponse(ctx);
export const onRequestHead = ctx => goResponse(ctx);
