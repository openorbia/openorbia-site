// /go/<slug>: the link every tool on the Launch List and on the tool pages points to. It adds one to that tool's count for the day and
// answers 302 to the tool's repo (or its website, once we record one).
//
// What is stored: a row per tool per day with a count. Nothing about the visitor: no IP address, no user agent, no referrer, no
// cookie (the response sets none). Counting never gets in the way of the link: if the database is missing or fails, the visitor is
// still sent on. HEAD requests (link checkers, previews) are sent on without being counted.

import { toolBySlug } from '../public/assets/tools.js';
import { renderToolNotFound } from './tool-pages.js';
import { pacificDay } from './time.js';

const SLUG_OK = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// where a tool's link leads: its website once there is one, otherwise its GitHub repo
export const destination = tool => tool.website || tool.github;

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
  if (request.method === 'GET' && env.DB) {
    try { await recordClick(env.DB, tool.slug, now); } catch { /* the count is lost, the link still works */ }
  }
  return new Response(null, {
    status: 302,
    headers: { location: destination(tool), 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
  });
}
