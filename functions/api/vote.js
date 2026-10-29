// Cloudflare Pages Function: POST /api/vote   body: { "slug": "<launch slug>" }
// Needs the D1 binding DB and the secret VOTE_SECRET (see README.md). The logic lives in lib/vote.js.

import { handleVote } from '../../lib/vote.js';

export const onRequestPost = ctx => handleVote(ctx);

export const onRequest = () =>
  new Response(JSON.stringify({ ok: false, code: 'method_not_allowed', error: 'Use POST.' }), {
    status: 405,
    headers: { allow: 'POST', 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
