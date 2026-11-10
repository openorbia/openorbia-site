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

// Pages Functions middleware: runs the route, then adds the headers. The full policy replaces the shorter one some pages set themselves;
// any other header a route already chose is kept.
export async function onRequest({ next }) {
  const res = await next();
  const out = new Response(res.body, res);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (name === 'content-security-policy' || !out.headers.has(name)) out.headers.set(name, value);
  }
  return out;
}
