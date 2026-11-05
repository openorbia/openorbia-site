// /unsubscribe/: the link at the bottom of every waitlist email. Unsubscribing deletes the signup from the waitlist (the founder's
// choice, 2026-11-03), the same as asking by email.
//
// Each link names the waitlist row and carries a token: an HMAC of "unsubscribe:<id>" keyed with the server secret VOTE_SECRET, so a
// link can't be guessed or changed to remove someone else, and no email address is ever in a URL.
//   GET  /unsubscribe/?id=&t=   shows a confirm button and changes nothing, so mail scanners that open links can't unsubscribe anyone
//   POST /unsubscribe/          the button, or a mail app's own "Unsubscribe" (one-click, RFC 8058: the email's List-Unsubscribe-Post
//                               header makes the app POST "List-Unsubscribe=One-Click" to the link itself). The token is the authority,
//                               so a POST from another site (the mail app) is fine; nothing is shown for a wrong token but an error.

import { esc } from './html.js';
import { layout } from './layout.js';
import { hmacHex } from './visitor.js';
import { CONTACT_EMAIL } from './footer.js';

const SITE = 'https://openorbia.com';
const ID_RE = /^[1-9]\d{0,11}$/;
const TOKEN_RE = /^[0-9a-f]{32}$/;

export const tokenFor = async (secret, id) => (await hmacHex(secret, `unsubscribe:${id}`)).slice(0, 32);
export async function unsubscribeUrl(secret, id) {
  return `${SITE}/unsubscribe/?id=${encodeURIComponent(String(id))}&t=${await tokenFor(secret, id)}`;
}

// compare without stopping at the first difference
const sameText = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
async function isValid(env, id, t) {
  if (!env || typeof env.VOTE_SECRET !== 'string' || !env.VOTE_SECRET || !ID_RE.test(id) || !TOKEN_RE.test(t)) return false;
  return sameText(t, await tokenFor(env.VOTE_SECRET, id));
}

const page = (status, heading, body) => new Response(layout({
  title: 'Unsubscribe | OpenOrbia', description: 'Stop emails from OpenOrbia.', path: '/unsubscribe/', noindex: true,
  body: `<div class="hwc">\n  <section aria-labelledby="un-h">\n    <span class="badge"><i></i>Emails</span>\n    <h1 id="un-h">${heading}</h1>\n    ${body}\n  </section>\n</div>`,
}), { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });

const contact = `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`;
const invalid = () => page(400, 'This link <em>doesn’t work</em>.', `<p class="hwc-sub">It may be incomplete or changed. Use the link from the email itself, or write to ${contact} and we’ll take you off the list.</p>`);
const failed = () => page(503, 'Something <em>went wrong</em>.', `<p class="hwc-sub">Nothing was changed. Please try again later, or write to ${contact}.</p>`);

export async function unsubscribeResponse({ request, env }) {
  const url = new URL(request.url);
  let id = url.searchParams.get('id') || '', t = url.searchParams.get('t') || '';

  if (request.method === 'POST') {
    // the button sends id and t in the form; a mail app's one-click posts to the link, so they are in the URL
    try {
      const form = await request.formData();
      if (form.get('id')) id = String(form.get('id'));
      if (form.get('t')) t = String(form.get('t'));
    } catch { /* no form body: use the URL */ }
    if (!(await isValid(env, id, t))) return invalid();
    if (!env.DB) return failed();
    try {
      await env.DB.prepare('DELETE FROM waitlist WHERE id = ?').bind(Number(id)).run();
    } catch {
      return failed();
    }
    // already gone (clicked twice) is fine: the answer is the same
    return page(200, 'You’re <em>unsubscribed</em>.', `<p class="hwc-sub">Your email is off the OpenOrbia waitlist, and you won’t get these emails any more. Changed your mind? You can join again on <a href="/">openorbia.com</a>.</p>`);
  }

  if (!(await isValid(env, id, t))) return invalid();
  return page(200, 'Stop <em>these emails</em>?', `<p class="hwc-sub">This removes your email from the OpenOrbia waitlist.</p>
    <form method="post" action="/unsubscribe/">
      <input type="hidden" name="id" value="${esc(id)}">
      <input type="hidden" name="t" value="${esc(t)}">
      <button class="btn pri" type="submit">Unsubscribe</button>
    </form>`);
}
