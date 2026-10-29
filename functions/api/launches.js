// Cloudflare Pages Function: GET /api/launches?limit=3 : JSON for the homepage "This week's launches" section

import { launchesApiResponse } from '../../lib/pages.js';

export const onRequestGet = ctx => launchesApiResponse(ctx);
