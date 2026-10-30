// POST /api/click {slug}: counts one follow of a tool's link. The Launch List and the tool pages link straight to the tool (so the link is
// a real one), and a small script sends this beacon when the link is followed (public/assets/click-beacon.js).
//
// Same table and upsert as /go/<slug> (see lib/go.js): one row per tool per Pacific day with a count. Nothing about the visitor is read
// or kept: no IP address, no user agent, no referrer, no cookie (the response sets none). A slug that is not a tool on the Launch List
// is a 404 and counts nothing.

import { toolBySlug } from '../public/assets/tools.js';
import { recordClick } from './go.js';

const MAX_BODY_CHARS = 1024;
const HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const fail = (status, code, error, extra = {}) => new Response(JSON.stringify({ ok: false, code, error }), {
  status, headers: { ...HEADERS, 'content-type': 'application/json; charset=utf-8', ...extra },
});

export async function handleClick({ request, env, now = Date.now() }) {
  // Only our own pages may count a click: no cross-site posts
  const origin = request.headers.get('Origin');
  const site = request.headers.get('Sec-Fetch-Site');
  if ((origin && origin !== new URL(request.url).origin) || (site && site !== 'same-origin')) {
    return fail(403, 'forbidden_origin', 'Clicks can only be counted from openorbia.com.');
  }
  // sendBeacon sends application/json for a JSON Blob and text/plain for a string: accept both, nothing else
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (!type.startsWith('application/json') && !type.startsWith('text/plain')) return fail(415, 'unsupported_media_type', 'Send the click as JSON.');

  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return fail(400, 'bad_request', 'That request is too large.');
  let body;
  try { body = JSON.parse(text); } catch { return fail(400, 'bad_request', 'That request could not be read.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.slug !== 'string') return fail(400, 'bad_request', 'That request could not be read.');

  const tool = body.slug.length <= 64 ? toolBySlug(body.slug) : null;
  if (!tool) return fail(404, 'not_found', 'That tool is not on the Launch List.');
  if (!env.DB) return fail(503, 'not_configured', 'Click counting is not available right now.');
  try {
    await recordClick(env.DB, tool.slug, now);
  } catch {
    return fail(500, 'server_error', 'Something went wrong.');
  }
  return new Response(null, { status: 204, headers: HEADERS });
}
