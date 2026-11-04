// Cloudflare Pages Function: GET and POST /unsubscribe/ (see lib/unsubscribe.js)

import { unsubscribeResponse } from '../../lib/unsubscribe.js';

export const onRequestGet = ctx => unsubscribeResponse(ctx);
export const onRequestPost = ctx => unsubscribeResponse(ctx);
