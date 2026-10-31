// The footer shared by every page. The server-rendered pages get it from layout.js; the static pages (public/index.html, public/404.html,
// public/launch-list/index.html) carry a copy with <span id="yr">2026</span> for the year, and test/footer.test.js fails when a copy drifts.
// FOOTER_CSS is the same block in public/assets/launch.css and in the inline styles of the homepage and the Launch List.

export const LINKEDIN_PERSONAL = 'https://www.linkedin.com/in/khaja-syed-185a03234/';
export const CONTACT_EMAIL = 'hello@openorbia.com';
export const SOCIAL = {
  x: { href: 'https://x.com/OpenOrbia', label: 'OpenOrbia on X' },
  linkedin: { href: 'https://www.linkedin.com/company/openorbia', label: 'OpenOrbia on LinkedIn' },
};

const X_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="22" height="22"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
const LINKEDIN_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="22" height="22"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z"/></svg>';

// `year` is markup: the number itself on the server, or <span id="yr">2026</span> on the static pages
export const footerHtml = year => `<footer><div class="wrap sf">
  <div class="sf-l"><span>© ${year} OpenOrbia</span><a href="${LINKEDIN_PERSONAL}" target="_blank" rel="noopener">Built by Khaja Syed, founder</a></div>
  <nav class="sf-m" aria-label="Footer"><a href="/launch-list/">Tools</a><a href="/launches/">Launches</a><a href="/submit/">Submit a tool</a><a href="/how-we-check/">How we check tools</a><a href="/how-voting-works/">How voting works</a><a href="mailto:${CONTACT_EMAIL}">Contact: ${CONTACT_EMAIL}</a></nav>
  <div class="sf-r"><a href="${SOCIAL.x.href}" aria-label="${SOCIAL.x.label}" rel="me noopener" target="_blank">${X_ICON}</a><a href="${SOCIAL.linkedin.href}" aria-label="${SOCIAL.linkedin.label}" rel="me noopener" target="_blank">${LINKEDIN_ICON}</a></div>
</div></footer>`;

export const FOOTER_CSS = [
  'footer{border-top:1px solid var(--line);color:var(--muted);font-size:13.5px;padding-block:22px calc(22px + env(safe-area-inset-bottom));margin-top:20px}',
  '.sf{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:14px 28px;align-items:center}',
  '.sf a{color:var(--muted);text-decoration:none}',
  '.sf a:hover{color:var(--ink)}',
  '.sf-l{display:grid;gap:2px;justify-items:start}',
  '.sf-m{display:flex;flex-wrap:wrap;justify-content:center;gap:2px 18px;max-width:560px}',
  '.sf-m a,.sf-l a{display:inline-flex;align-items:center;min-height:32px}',
  '.sf-r{display:flex;justify-content:flex-end;gap:6px}',
  '.sf-r a{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px}',
  '.sf svg{width:22px;height:22px;fill:currentColor;flex:none}',
  '@media (max-width:820px){.sf{grid-template-columns:minmax(0,1fr);justify-items:center;text-align:center}.sf-l{justify-items:center}.sf-r{justify-content:center}}',
].join('\n');
