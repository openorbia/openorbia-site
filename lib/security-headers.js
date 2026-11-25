// Security headers for every response. Static files get them from public/_headers; Cloudflare does not apply that file to responses
// from Pages Functions, so each folder in functions/ has a _middleware.js that adds the same headers (lib/security-headers.js is the one
// list; a test keeps public/_headers in step with it). There is deliberately no functions/_middleware.js at the root: that would send
// every static file through Functions and count against the free plan's daily request limit.
//
// The Content Security Policy allows scripts only from this site and Cloudflare (Turnstile, and Web Analytics if it is turned on), so an
// injected script tag or inline event handler cannot run. That is why the pages have no inline scripts. Inline style attributes stay
// allowed: the pages use them for per-tool colors, and styles cannot run code.

export const CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com",
  'frame-src https://challenges.cloudflare.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

export const SECURITY_HEADERS = {
  'content-security-policy': CSP,
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'cross-origin-opener-policy': 'same-origin',
};

// The server-rendered pages whose address ends in a slash. /faq, /tool/ollama and the like also reach the same function, so a request
// without the slash gets a permanent redirect to the canonical address instead of a second copy of the page. Only these page routes:
// never /api/ (forms and votes post there) or /go/ (outbound links in emails).
export const SLASH_PAGES = /^\/(?:faq|makers|launches|privacy|security|contact|submit|request|how-we-check|how-voting-works|free-ai-apis|feeds|category\/[a-z0-9-]+|collection\/[a-z0-9-]+|tool\/[a-z0-9-]+|launch\/[a-z0-9-]+|launch\/[a-z0-9-]+\/kit)$/;

// A copy of the site on Cloudflare's own hosts (openorbia.pages.dev and every preview deployment) must stay out of search results;
// openorbia.com is the only address to index. public/_headers does the same for the static files.
export const isPagesDev = host => /(^|\.)pages\.dev$/i.test(String(host || ''));

export function canonicalRedirect(request) {
  if (!request || !['GET', 'HEAD'].includes(request.method)) return null;
  const url = new URL(request.url);
  if (!SLASH_PAGES.test(url.pathname)) return null;
  return new Response(null, { status: 301, headers: { location: `${url.pathname}/${url.search}` } });
}

// Pages Functions middleware: runs the route, then adds the headers. The full policy replaces the shorter one some pages set themselves;
// any other header a route already chose is kept.
export async function onRequest({ request, next }) {
  const res = canonicalRedirect(request) || await next();
  const out = new Response(res.body, res);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (name === 'content-security-policy' || !out.headers.has(name)) out.headers.set(name, value);
  }
  if (request && isPagesDev(new URL(request.url).hostname)) out.headers.set('x-robots-tag', 'noindex');
  return out;
}
