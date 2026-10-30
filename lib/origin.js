// Is this request from one of our own pages? Used by POST /api/click, so that a page on another site cannot post clicks.
//
// "Ours" is openorbia.com (and www), the Pages preview hosts (launch-day.openorbia.pages.dev, <hash>.openorbia.pages.dev) and, for local
// development, localhost. The Origin header decides; a request without one is judged by its Referer; with neither it is refused (a
// browser always sends an Origin on a POST). The Referer is only read to check the host: it is never stored.

const PRODUCTION = new Set(['openorbia.com', 'www.openorbia.com']);
const PREVIEW = /^([a-z0-9-]+\.)?openorbia\.pages\.dev$/;
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isOurOrigin(value) {
  let u;
  try { u = new URL(String(value)); } catch { return false; }
  if (u.username || u.password) return false;
  if (u.protocol === 'https:') return PRODUCTION.has(u.hostname) || PREVIEW.test(u.hostname);
  return u.protocol === 'http:' && LOCAL.has(u.hostname);
}

export function requestIsOurs(request) {
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin') return false;                      // a cross-site or same-site-but-other-origin request
  const origin = request.headers.get('Origin');
  if (origin !== null) return isOurOrigin(origin);                       // "null" (sandboxed pages) and anything foreign fail here
  const referer = request.headers.get('Referer');
  return referer ? isOurOrigin(referer) : false;
}
