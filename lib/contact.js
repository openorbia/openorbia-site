// /contact/: the address to write to, a Copy button, an "Open in your email app" link, and where to go for the common requests.
// The address is plain text in the page, so it can be read and selected without JavaScript. The Copy button uses the shared handler in
// public/assets/launch.js ([data-copy]: "Copied" for 2 seconds, or selects the address if the clipboard is blocked); no inline script.

import { layout } from './layout.js';
import { CONTACT_EMAIL } from './footer.js';

// Corrections to a tool's facts go to the launch address, as /how-we-check/ and the FAQ say; the subject is started for you
export const CORRECTIONS_EMAIL = 'launch@openorbia.com';
export const CORRECTION_MAILTO = `mailto:${CORRECTIONS_EMAIL}?subject=${encodeURIComponent('Correction: ')}`;

export function renderContact() {
  const body = `<div class="hwc">
  <section aria-labelledby="ct-h">
    <span class="badge"><i></i>Contact</span>
    <h1 id="ct-h">Contact <em>OpenOrbia</em>.</h1>
    <p class="hwc-sub">Questions, ideas or anything else: write to us at this address.</p>
    <div class="contact ct-mail"><code id="ct-mail">${CONTACT_EMAIL}</code><button class="copy" type="button" data-copy="${CONTACT_EMAIL}" data-copied="Copied" aria-describedby="ct-mail">Copy</button></div>
    <p class="ct-open"><a class="btn ghost" href="mailto:${CONTACT_EMAIL}">Open in your email app</a></p>
    <p>We aim to reply within 7 days.</p>
  </section>

  <section class="hwc-sec" aria-labelledby="ct-list-h">
    <h2 id="ct-list-h">Looking for something specific?</h2>
    <ul class="mk-list">
      <li><a href="/submit/">Submit a tool</a>: list your free AI tool on OpenOrbia.</li>
      <li><a href="/request/">Find my free setup</a>: tell us the task, and we reply with a free setup we have checked.</li>
      <li><a href="/security/">Report a security issue</a>: privately, as our security page explains.</li>
      <li>A correction to a tool’s facts: email <a href="${CORRECTION_MAILTO}">${CORRECTIONS_EMAIL}</a> with the tool’s name in the subject.</li>
    </ul>
  </section>
</div>`;
  return layout({
    title: 'Contact | OpenOrbia',
    description: `Contact OpenOrbia at ${CONTACT_EMAIL}. We aim to reply within 7 days. Submit a tool, find a free setup, report a security issue or ask for a correction.`,
    path: '/contact/',
    body,
  });
}

export const contactResponse = () => new Response(renderContact(), {
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
});
