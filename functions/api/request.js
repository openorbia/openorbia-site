// Cloudflare Pages Function: POST /api/request ("Find me a free tool"). Needs DB, VOTE_SECRET and TURNSTILE_SECRET_KEY; the logic is in lib/forms.js.

import { handleRequest } from '../../lib/forms.js';

export const onRequestPost = ctx => handleRequest({ request: ctx.request, env: ctx.env, waitUntil: p => ctx.waitUntil(p) });

export const onRequest = () =>
  new Response(JSON.stringify({ ok: false, code: 'method_not_allowed', error: 'Use POST.' }), {
    status: 405,
    headers: { allow: 'POST', 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
