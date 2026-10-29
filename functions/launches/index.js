// Cloudflare Pages Function: GET /launches/ : this week's leaderboard, or the countdown before launch day (see lib/pages.js)

import { leaderboardResponse } from '../../lib/pages.js';

export const onRequestGet = ctx => leaderboardResponse(ctx);
export const onRequestHead = ctx => leaderboardResponse(ctx);
