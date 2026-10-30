// Cloudflare Pages Function: POST /api/click {slug} : count a follow of a tool's link (see lib/click.js)

import { handleClick } from '../../lib/click.js';

export const onRequestPost = ctx => handleClick(ctx);

export const onRequest = () => new Response(JSON.stringify({ ok: false, code: 'method_not_allowed', error: 'Use POST.' }), {
  status: 405, headers: { allow: 'POST', 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
