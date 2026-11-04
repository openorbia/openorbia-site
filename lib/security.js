// /security/: how to report a security problem, what is in scope, and what the site does to protect people. The same text is in
// SECURITY.md at the root of the repository (GitHub shows it as the security policy); test/security.test.js checks that every
// sentence here is also there, so change both together. The cookie line is shared with /privacy/ (lib/privacy.js).

import { esc } from './html.js';
import { layout } from './layout.js';
import { CONTACT_EMAIL } from './footer.js';
import { COOKIE_LINE } from './privacy.js';

export const REPORT_URL = 'https://github.com/openorbia/openorbia-site/security/advisories/new';
export const SECURITY_TXT = '/.well-known/security.txt';

// Each section: a heading, then paragraphs (p) and/or a list (li). Plain sentences only, so SECURITY.md can carry them word for word;
// the links are added when the page is drawn (see LINKS).
export const SECURITY_SECTIONS = [
  { h: null, p: ['OpenOrbia (https://openorbia.com) is a small, independent site. We take security reports seriously and will credit you if you want.'] },
  {
    h: 'Reporting a problem',
    p: ['Please report security issues privately, not in a public issue:'],
    li: [
      'First choice: GitHub private vulnerability reporting. On our repository, open Security, then Report a vulnerability.',
      `Or email ${CONTACT_EMAIL} with "Security" in the subject.`,
    ],
    after: ['Include what you found, where (URL or file), and how to reproduce it. We aim to reply within 7 days.'],
  },
  {
    h: 'Scope',
    li: [
      'In scope: openorbia.com, its preview deployments on openorbia.pages.dev, and the code in our GitHub repository.',
      'Out of scope: the third-party tools we list (report those to their makers), and denial-of-service or spam testing against the live site.',
    ],
  },
  {
    h: 'What we protect',
    li: [
      COOKIE_LINE,
      'Votes and rate limits use a salted hash, never a raw IP address or user agent.',
      'Forms check that they come from our own pages, are rate limited, and use Cloudflare Turnstile.',
      'A Content Security Policy forbids inline and third-party scripts, except Cloudflare’s.',
      'Secrets live in Cloudflare, never in our repository; CI scans every change for leaked secrets.',
    ],
  },
  { h: 'Contact details for tools', p: ['Our contact details are also in machine-readable form at https://openorbia.com/.well-known/security.txt.'] },
];

// Text in the sentences that becomes a link on the page (after escaping)
const LINKS = [
  ['GitHub private vulnerability reporting', REPORT_URL],
  [CONTACT_EMAIL, `mailto:${CONTACT_EMAIL}`],
  ['https://openorbia.com/.well-known/security.txt', SECURITY_TXT],
  ['https://openorbia.com', '/'],
];
function linked(sentence) {
  let html = esc(sentence);
  const used = new Set();
  for (const [text, href] of LINKS) {
    const t = esc(text), i = html.indexOf(t);
    // first match only, and not inside a link already made (https://openorbia.com is part of the security.txt URL)
    if (i < 0 || [...used].some(([a, b]) => i >= a && i < b)) continue;
    const ext = href.startsWith('https://') ? ' rel="noopener"' : '';
    const a = `<a href="${esc(href)}"${ext}>${t}</a>`;
    html = html.slice(0, i) + a + html.slice(i + t.length);
    used.add([i, i + a.length]);
  }
  return html;
}

export function renderSecurity() {
  const parts = SECURITY_SECTIONS.map((s, n) => {
    const id = `sec${n}`;
    const paras = (s.p || []).map(x => `<p>${linked(x)}</p>`).join('\n    ');
    const list = s.li ? `<ul class="mk-list">${s.li.map(x => `<li>${linked(x)}</li>`).join('')}</ul>` : '';
    const after = (s.after || []).map(x => `<p>${linked(x)}</p>`).join('\n    ');
    if (!s.h) return `<section aria-label="About">\n    ${paras}\n  </section>`;
    return `<section class="hwc-sec" aria-labelledby="${id}-h">\n    <h2 id="${id}-h">${esc(s.h)}</h2>\n    ${[paras, list, after].filter(Boolean).join('\n    ')}\n  </section>`;
  });
  const body = `<div class="hwc">
  <section aria-labelledby="sc-h">
    <span class="badge"><i></i>Security</span>
    <h1 id="sc-h">Security, <em>and how to report a problem</em>.</h1>
    <p class="hwc-sub">Found a security problem on OpenOrbia? Tell us privately and we will fix it.</p>
  </section>

  ${parts.join('\n\n  ')}
</div>`;
  return layout({
    title: 'Security | OpenOrbia',
    description: 'How to report a security problem on OpenOrbia privately, what is in scope, and what the site does to protect visitors.',
    path: '/security/',
    body,
  });
}

export const securityResponse = () => new Response(renderSecurity(), {
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
});
