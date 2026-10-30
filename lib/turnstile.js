// Server-side check of a Cloudflare Turnstile token (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
// The widget in the page produces a one-time token; only this check, with the secret key, says whether it is real. The visitor's IP address
// is not sent along (it is optional for Cloudflare, and we do not keep IP addresses).

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// -> 'ok' | 'failed' (the token is missing, wrong, expired or already used) | 'unavailable' (Cloudflare could not be reached or answered badly)
export async function verifyTurnstile({ secret, token, fetchImpl = fetch }) {
  if (typeof token !== 'string' || !token || token.length > 2048) return 'failed';
  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return 'unavailable';
    const body = await res.json();
    return body && body.success === true ? 'ok' : 'failed';
  } catch {
    return 'unavailable';
  }
}
