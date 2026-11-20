// Cloudflare Pages Function: GET /collection/<slug>/ (see lib/collections.js)

import { collectionResponse } from '../../lib/collections.js';

export const onRequestGet = ctx => collectionResponse(ctx);
export const onRequestHead = ctx => collectionResponse(ctx);
