// The footer shared by every page. The server-rendered pages get it from layout.js; the static pages (public/index.html, public/404.html,
// public/launch-list/index.html) carry a copy with <span id="yr">2026</span> for the year, and test/footer.test.js fails when a copy drifts.
// FOOTER_CSS is the same block in public/assets/launch.css and in the inline styles of the homepage and the Launch List.

// The address for questions, ideas and anything that is not a launch or a correction (those go to launch@openorbia.com)
export const CONTACT_EMAIL = 'hello@openorbia.com';

export const SOCIAL = {
  x: { href: 'https://x.com/OpenOrbia', label: 'OpenOrbia on X' },
  linkedin: { href: 'https://www.linkedin.com/company/openorbia', label: 'OpenOrbia on LinkedIn' },
  github: { href: 'https://github.com/openorbia/openorbia-site', label: 'OpenOrbia on GitHub' },
};

// Community: GitHub Discussions on the site's repository (turned on 2026-11-04). Q&A is for install help (a reply can be marked as
// the answer); Show and tell is for sharing a free setup. Posts are public and need a GitHub account.
const DISCUSSIONS = 'https://github.com/openorbia/openorbia-site/discussions';
export const COMMUNITY = { href: DISCUSSIONS, qa: `${DISCUSSIONS}/categories/q-a`, setups: `${DISCUSSIONS}/categories/show-and-tell` };

// The bottom bar's middle links: the privacy page, how to report a security problem, and how to reach us
export const SECURITY_POLICY = '/security/';

const X_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="22" height="22"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
const GITHUB_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="22" height="22"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>';
const LINKEDIN_ICON = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="22" height="22"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z"/></svg>';

// The site map above the bottom row: what the free and open-source tools on the Launch List help with, by kind of work, each a
// Launch List search or filter (test/footer.test.js checks every one finds tools), then the setup filters and OpenOrbia's own
// pages. No tool names: a category stays right when the list changes. Add a category here once a tool for it is listed.
export const CATEGORY_LINKS = {
  Productivity: [['AI chat assistants', 'chat'], ['Knowledge bases', 'documents'], ['Meeting notes', 'meeting'], ['Email & inbox', 'inbox'], ['AI search', 'search the web'], ['CRM & sales', 'CRM'], ['Social media', 'social media']],
  'Automation & AI': [['Workflow automation', 'automat'], ['AI agents', 'agents'], ['Chatbots & AI apps', 'chatbot']],
  Careers: [['Resumes & CVs', 'resume'], ['Cover letters', 'cover letter'], ['Job search & tracking', 'applications'], ['Interview practice', 'interview'], ['LinkedIn profile', 'LinkedIn']],
  Security: [['AI red teaming', 'red-team'], ['Jailbreak testing', 'jailbreak'], ['AI guardrails', 'guardrails'], ['Penetration testing', 'pentest'], ['SOC & alert triage', 'triage'], ['Security automation', 'SOAR'], ['Threat detection', 'threats'], ['CTF practice', 'capture-the-flag']],
};
const search = q => `/launch-list/?q=${encodeURIComponent(q).replace(/%20/g, '+')}`;

const col = (heading, links) => `<div class="sf-col"><p class="sf-h">${heading}</p><ul>${links.map(([href, label, cls]) =>
  `<li><a${cls ? ` class="${cls}"` : ''} href="${href}">${label}</a></li>`).join('')}</ul></div>`;

const siteMap = () => `<div class="sf-top">
  <div class="sf-about"><a class="brand sf-word" href="/" aria-label="OpenOrbia home">Open<span class="grad">Orbia</span></a><p>Free and open-source AI tools, checked against their official docs. New launches every Monday, free to enter, no paid placement.</p><p class="sf-contact">Questions? <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p></div>
  <nav class="sf-map" aria-label="Site map">
    ${Object.entries(CATEGORY_LINKS).map(([heading, items]) => col(heading.replace(/&/g, '&amp;'), items.map(([label, q]) => [search(q), label.replace(/&/g, '&amp;')]))).join('\n    ')}
    ${col('Browse', [['/launch-list/?for=biz', 'Small Business'], ['/launch-list/?for=job', 'Job Seekers'], ['/launch-list/?for=sec', 'Cybersecurity &amp; SOC'], ['/launch-list/?setup=browser', 'No install'], ['/launch-list/?local=1', 'Works with local AI'], ['/launch-list/?os=1', 'Open source only'], ['/launch-list/', 'All tools →', 'sf-all']])}
    ${col('OpenOrbia', [['/launches/', 'This week’s launches'], ['/submit/', 'Submit a tool'], ['/makers/', 'For makers'], ['/how-we-check/', 'How we check tools'], ['/how-voting-works/', 'How voting works'], ['/faq/', 'FAQ'], [COMMUNITY.href, 'Community'], ['/request/', 'Find my free setup'], ['/contact/', 'Contact us']])}
  </nav>
</div>`;

// `year` is markup: the number itself on the server, or <span id="yr">2026</span> on the static pages
export const footerHtml = year => `<footer><div class="wrap">
${siteMap()}
<div class="sf">
  <div class="sf-l"><span>© ${year} OpenOrbia. All rights reserved.</span><span>Founded by Khaja Syed</span></div>
  <nav class="sf-m" aria-label="Footer"><a href="/privacy/">Privacy</a><a href="${SECURITY_POLICY}">Security</a><a href="/contact/">Contact</a></nav>
  <div class="sf-r"><a href="${SOCIAL.x.href}" aria-label="${SOCIAL.x.label}" rel="me noopener" target="_blank">${X_ICON}</a><a href="${SOCIAL.linkedin.href}" aria-label="${SOCIAL.linkedin.label}" rel="me noopener" target="_blank">${LINKEDIN_ICON}</a><a href="${SOCIAL.github.href}" aria-label="${SOCIAL.github.label}" rel="me noopener" target="_blank">${GITHUB_ICON}</a></div>
</div>
</div></footer>`;

export const FOOTER_CSS = [
  'footer{border-top:1px solid var(--line);color:var(--muted);font-size:13.5px;padding-block:22px calc(22px + env(safe-area-inset-bottom));margin-top:20px}',
  '.sf-top{display:grid;gap:26px;padding-block:24px 32px;border-bottom:1px solid rgba(143,166,255,.28);margin-bottom:20px}',
  '.sf-about{display:flex;flex-wrap:wrap;gap:8px 28px;align-items:baseline}',
  '.sf-word{justify-self:start;gap:0}',
  '.sf-about p{margin:0;font-size:14px;line-height:1.55;max-width:62ch}',
  '.sf-contact{margin-left:auto!important}',
  '.sf-contact a{color:var(--blue-l);text-decoration:none}',
  '.sf-contact a:hover{text-decoration:underline}',
  '.sf-map{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:28px}',
  '.sf-col{min-width:0}',
  '.sf-h{margin:0 0 10px;font:500 11.5px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--blue-l)}',
  '.sf-col ul{list-style:none;margin:0;padding:0;display:grid;gap:2px}',
  '.sf-col a{display:inline-block;padding-block:5px;color:#c9d2ee;text-decoration:none;font-size:14px;line-height:1.3}',
  '.sf-col a:hover{color:var(--ink)}',
  '.sf-col a.sf-all{color:var(--blue-l)}',
  '@media (max-width:980px){.sf-map{grid-template-columns:repeat(3,minmax(0,1fr))}.sf-contact{margin-left:0!important}}',
  '@media (max-width:600px){.sf-map{grid-template-columns:repeat(2,minmax(0,1fr))}.sf-col a{padding-block:8px}}',
  '.sf{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px 28px;align-items:center}',
  '.sf a{color:var(--muted);text-decoration:none}',
  '.sf a:hover{color:var(--ink)}',
  '.sf-l{display:grid;gap:2px;justify-items:start;white-space:nowrap;line-height:1.5}',
  '.sf-m{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:2px 0}',
  '.sf-m a+a::before{content:"·";margin-inline:12px;color:var(--muted);opacity:.7}',
  '.sf-m a,.sf-l a{display:inline-flex;align-items:center;min-height:32px}',
  '.sf-r{display:flex;justify-content:flex-end;gap:6px}',
  '.sf-r a{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px}',
  '.sf svg{width:22px;height:22px;fill:currentColor;flex:none}',
  '@media (max-width:820px){.sf{grid-template-columns:minmax(0,1fr);justify-items:center;text-align:center}.sf-l{justify-items:center;white-space:normal}.sf-r{justify-content:center}}',
].join('\n');
