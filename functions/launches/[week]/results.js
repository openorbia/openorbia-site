// Cloudflare Pages Function: GET /launches/week-<n>/results/ : the final ranks of a launch week (see lib/results.js)

import { resultsResponse } from '../../../lib/results.js';

export const onRequestGet = ctx => resultsResponse(ctx);
export const onRequestHead = ctx => resultsResponse(ctx);
