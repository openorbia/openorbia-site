// Cloudflare Pages Function: GET /launch/<slug>/kit/ : the maker kit for one launch, rendered from D1 (see lib/launch-kit.js)

import { kitResponse } from '../../../../lib/launch-kit.js';

export const onRequestGet = ctx => kitResponse(ctx);
export const onRequestHead = ctx => kitResponse(ctx);
