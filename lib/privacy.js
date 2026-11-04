// /privacy/: what OpenOrbia keeps, what it does not, which services see what, and how to have data deleted.
//
// REVIEW BEFORE MERGING: Khaja must read and approve this text. It was written only from what the code does (schema.sql,
// lib/visitor.js, lib/vote.js, lib/ratelimit.js, lib/email.js, lib/turnstile.js, lib/forms.js, lib/click.js, functions/api/*.js,
// lib/layout.js for Google Fonts).
// "We don't sell data or show ads" is the founder's policy, not something code can show. When the code changes what is stored or
// sent, change this page and LAST_UPDATED with it; test/privacy.test.js checks the facts it can.

import { esc } from './html.js';
import { layout } from './layout.js';
import { CONTACT_EMAIL } from './footer.js';

export const LAST_UPDATED = '2026-11-04';
const updated = new Date(`${LAST_UPDATED}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const list = items => `<ul class="mk-list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
const section = (id, heading, body) => `<section class="hwc-sec" aria-labelledby="${id}-h">\n    <h2 id="${id}-h">${heading}</h2>\n    ${body}\n  </section>`;

export function renderPrivacy() {
  const collect = list([
    '<b>Waitlist.</b> Your email, whether you are a maker or here for free AI tools, your tool’s website if you are a maker and give one, and the country Cloudflare reports for your connection (a country code, not your address). We use it to email you about launches, and to invite makers to launch. If the spam check passes, you get one welcome email.',
    '<b>Tool submissions</b> (<a href="/submit/">Submit a tool</a>). What you type in the form: the tool’s name and link, your name and email, its category and license, what is free, whether a card is needed, the setup, any paid dependencies and an optional link to your logo and screenshots. We use it to check and list your tool, and we send a confirmation to the email you gave.',
    '<b>“Find my free setup” requests</b> (<a href="/request/">Find my free setup</a>). The task you describe, who it is for, the boxes you tick (no install, no card, runs on your computer), your email only if you give one, and whether you agreed that we may publish the question without your email. If you gave an email, we send a confirmation and write back.',
    '<b>Link clicks.</b> When someone follows a link to a tool, we add one to that tool’s count for the day. Nothing about the person is kept.',
    '<b>Votes.</b> To allow one upvote per launch per week without accounts, we keep a scrambled code made from your network address and browser, mixed with a secret and the launch week. It cannot be turned back into either.',
    '<b>Submitting through GitHub.</b> If you use “Submit via GitHub” instead of our form, you open an issue on our GitHub repository. It is public, and GitHub’s privacy policy applies.',
  ]);
  const keep = list([
    'Waitlist signups, tool submissions and “Find my free setup” requests stay until you ask us to delete them.',
    'Daily click counts are one number per tool per day, with no personal data.',
    'Vote codes are made fresh for each launch week and kept with that launch’s votes. Rate-limit codes expire when their time window ends and are then cleared out.',
  ]);
  const dont = list([
    'We don’t set cookies.',
    'We never store your IP address or your browser details (the user agent). Votes and our rate limits only keep a scrambled code (a salted hash), and rate-limit entries expire when their time window ends.',
    'We don’t send your IP address to the spam check: only its one-time token.',
    'We don’t sell your data, and we don’t show ads.',
  ]);
  const services = list([
    '<b>Cloudflare</b> hosts the site and its database. Its Turnstile spam check runs on the forms: it runs in your browser and connects to Cloudflare directly. Cloudflare Web Analytics counts page visits when it is turned on.',
    '<b>Google Fonts</b> serves the site’s fonts, so your browser connects to Google, which receives your IP address under Google’s own privacy policy.',
    '<b>Brevo</b> sends the welcome and confirmation emails. It receives your email address and the email we send you.',
  ]);

  const body = `<div class="hwc">
  <section aria-labelledby="pv-h">
    <span class="badge"><i></i>Privacy</span>
    <h1 id="pv-h">Privacy, <em>in plain words</em>.</h1>
    <p class="hwc-sub">What OpenOrbia keeps, what it doesn’t, and how to have your data deleted.</p>
  </section>

  ${section('collect', 'What we collect, and why', collect)}

  ${section('dont', 'What we don’t do', dont)}

  ${section('keep', 'How long we keep it', keep)}

  ${section('services', 'Services we use', services)}

  ${section('delete', 'Getting your data deleted', `<p>Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> from the address you used, or tell us what you submitted, and we will delete it.</p>`)}

  <p class="fine">Last updated ${esc(updated)}.</p>
</div>`;
  return layout({
    title: 'Privacy | OpenOrbia',
    description: 'What OpenOrbia keeps and why, what it never stores (no cookies, no IP addresses), the services it uses, and how to have your data deleted.',
    path: '/privacy/',
    body,
  });
}

export const privacyResponse = () => new Response(renderPrivacy(), {
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
});
