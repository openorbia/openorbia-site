// /go/<slug>: a counted link for places where JavaScript does not run: the newsletter and email. (The Launch List and the tool pages link
// straight to the tool and count with a beacon instead: see lib/click.js.) It adds one to that tool's count for the day and answers 302
// to the tool's repo (or its website, once we record one).
//
// What is stored: a row per tool per day with a count. Nothing about the visitor: no IP address, no user agent, no referrer, no
// cookie (the response sets none). Counting never gets in the way of the link: if the database is missing or fails, the visitor is
// still sent on. HEAD requests (link checkers, previews) are sent on without being counted.
//
// Counting has the same rate limit as /api/click: 30 per minute per visitor (an HMAC of the IP and user agent, never stored), one budget
// shared by both. Over the limit, or with no VOTE_SECRET to key it, the visitor is still sent on; the click is simply not counted. There is
// no same-origin rule here, because email and newsletter links arrive from other places and often with no Referer.

import { toolBySlug, toolHref } from '../public/assets/tools.js';
import { renderToolNotFound } from './tool-pages.js';
import { pacificDay } from './time.js';
import { rateLimit, CLICK_LIMIT } from './ratelimit.js';
import { visitor } from './visitor.js';

const SLUG_OK = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// where a tool's link leads: its website once there is one, otherwise its GitHub repo
export const destination = toolHref;

export async function recordClick(db, slug, now) {
  await db.prepare('INSERT INTO clicks (slug, day, count) VALUES (?, ?, 1) ON CONFLICT(slug, day) DO UPDATE SET count = count + 1')
    .bind(slug, pacificDay(now)).run();
}

export async function goResponse({ request, env, params, now = Date.now() }) {
  const slug = String(params?.slug ?? '').replace(/\/+$/, '');
  const tool = slug.length <= 64 && SLUG_OK.test(slug) ? toolBySlug(slug) : null;
  if (!tool) {
    return new Response(renderToolNotFound(), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
    });
  }
  if (request.method === 'GET' && env.DB && typeof env.VOTE_SECRET === 'string' && env.VOTE_SECRET) {
    try {
      const limited = await rateLimit(env.DB, env.VOTE_SECRET, { scope: 'click', ...CLICK_LIMIT }, visitor(request), now);
      if (!limited) await recordClick(env.DB, tool.slug, now);
    } catch { /* the count is lost, the link still works */ }
  }
  return new Response(null, {
    status: 302,
    headers: { location: destination(tool), 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
  });
}
