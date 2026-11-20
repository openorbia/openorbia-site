// /makers/: what makers get, the listing rules, the launch checklist and how to submit. Same shell as the other server-rendered pages.

import { esc } from './html.js';
import { layout } from './layout.js';
import { FIRST_LAUNCH_WEEK } from './site.js';
import { launchOpensAt, dayLabelLong, weekdayLabel, lineupAnnouncedAt, assetDeadlineAt } from './time.js';

const SUBMIT_URL = 'https://github.com/openorbia/openorbia-site/issues/new?template=submit-a-tool.yml';
const EMAIL = 'launch@openorbia.com';

const list = items => `<ul class="mk-list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;

// The "Featured on OpenOrbia" badge: two looks (static files in public/badge/), each with Markdown and HTML to paste
const BADGE_SITE = 'https://openorbia.com';
export const BADGES = [
  { key: 'dark', title: 'Dark badge', file: 'featured-dark.svg', panel: 'mk-panel-dark' },
  { key: 'light', title: 'Light badge', file: 'featured-light.svg', panel: 'mk-panel-light' },
].map(b => ({
  ...b,
  markdown: `[![Featured on OpenOrbia](${BADGE_SITE}/badge/${b.file})](${BADGE_SITE}/)`,
  html: `<a href="${BADGE_SITE}/"><img src="${BADGE_SITE}/badge/${b.file}" alt="Featured on OpenOrbia" width="193" height="56"></a>`,
}));

const snippet = (label, text) => `<div class="mk-snip"><span class="mk-snip-l">${esc(label)}</span><pre class="mk-code"><code>${esc(text)}</code></pre><button class="copy" type="button" data-copy="${esc(text)}" data-copied="Copied">Copy</button></div>`;
const badgeCard = b => `<li class="mk-badge"><h3>${esc(b.title)}</h3><div class="${b.panel}"><img src="/badge/${esc(b.file)}" alt="Featured on OpenOrbia badge, ${esc(b.key)} version" width="193" height="56"></div>${snippet('Markdown', b.markdown)}${snippet('HTML', b.html)}</li>`;

export function renderMakers() {
  const opensAt = launchOpensAt(FIRST_LAUNCH_WEEK.date);
  const day = Number.isNaN(opensAt) ? '' : dayLabelLong(opensAt); // e.g. "Monday, Nov 23"
  const get = [
    ['A launch page', 'Your own page with your logo, screenshots, description, free facts and your story.'],
    ['Community upvotes', 'People vote for their favorites during launch week. One upvote per launch for the whole week.'],
    ['A feature', 'Launches are shared on LinkedIn and X and in our newsletter.'],
    ['All of it free', 'No fees, no paid placement, no trial. Ever.'],
  ];
  const rules = [
    'An open-source license, or a real free plan. No trials and no credit card. A tool that only works with a paid service, such as a paid AI plan, is labeled “Needs paid service” and hidden while Runs free is on.',
    'Updated in the last 6 months.',
    'AI is a core part of the tool, not a side feature.',
  ];
  const facts = [
    ["What's free", 'what you can use at no cost, and the limits'],
    ['Card required', 'yes or no'],
    ['Where your data goes', 'your computer, your server, or the vendor cloud'],
    ['Setup', 'in the browser, a desktop app, or install and self-host'],
    ['The catch', 'one short, honest line'],
    ['Last checked', 'the date we last checked it'],
  ];
  // Launch Week dates, all worked out from the launch date (lib/time.js)
  const when = (ms, fallback) => (Number.isNaN(ms) ? fallback : weekdayLabel(ms));
  // Week 1 has its own asset deadline (FIRST_LAUNCH_WEEK.assetsDue); a lineup date that falls before it is left out, so the
  // dates never read out of order
  const assetsDue = FIRST_LAUNCH_WEEK.assetsDue ? launchOpensAt(FIRST_LAUNCH_WEEK.assetsDue) : assetDeadlineAt(FIRST_LAUNCH_WEEK.date);
  const lineup = lineupAnnouncedAt(FIRST_LAUNCH_WEEK.date);
  const dates = [
    ['Assets due', `${when(assetsDue, 'to be announced')}: logo, screenshots, description and your story`],
    ...(Number.isNaN(assetsDue) || !(lineup < assetsDue) ? [['Lineup announced', when(lineup, 'to be announced')]] : []),
    ['Voting', 'Monday 12:00 AM to Sunday 11:59 PM Central'],
  ];
  const after = [
    'We check your tool against its official docs: license, free plan, card, data and recent activity.',
    'We confirm you are the maker, one of three ways: you submit from a GitHub account that owns or maintains the repository, you write from an email address on the tool’s own domain, or the tool’s website or README links to its OpenOrbia page. A team can name one person to launch for it, confirmed the same way.',
    'We reply within 2 days with a decision or any questions.',
    'Once it is accepted, send your launch assets by the deadline below, and we set up your launch page for your launch week.',
  ];
  const checklist = [
    'Logo, 512px square',
    'Tagline, up to 60 characters',
    'Description, 2 to 3 sentences',
    '3 to 5 screenshots',
    'Optional: a 60-second video or GIF',
    'Links: website and source code',
    'Your name and handles',
    'Your maker story: why you built it',
  ];
  const body = `<div class="mk">
  <section class="mk-hero" aria-labelledby="mk-h">
    <span class="badge"><i></i>For makers</span>
    <h1 id="mk-h">Launch your free AI tool, <em>for free</em>.</h1>
    <p class="mk-sub">OpenOrbia is a weekly launch platform for free and open-source AI tools. Here is what you get, what we look for, and how to submit.</p>
    <div class="lw-actions"><a class="btn pri" href="${esc(SUBMIT_URL)}" target="_blank" rel="noopener">Submit via GitHub</a><a class="btn ghost" href="mailto:${EMAIL}">Email ${EMAIL}</a></div>
  </section>

  <section class="mk-sec" aria-labelledby="get-h">
    <h2 id="get-h">What makers get</h2>
    <ul class="mk-cards">${get.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ul>
  </section>

  <section class="mk-sec" aria-labelledby="rules-h">
    <h2 id="rules-h">Listing rules</h2>
    ${list(rules.map(esc))}
    <p class="mk-note"><a href="/how-we-check/">How we check tools</a> explains every rule and every fact in detail.</p>
  </section>

  <section class="mk-sec" aria-labelledby="facts-h">
    <h2 id="facts-h">Free facts we show</h2>
    <p class="mk-note">Every launch page shows a short box of facts, so people see exactly what they get.</p>
    <dl class="mk-facts">${facts.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>
  </section>

  <section class="mk-sec" aria-labelledby="check-h">
    <h2 id="check-h">Launch checklist</h2>
    ${list(checklist.map(esc))}
  </section>

  <section class="mk-sec" aria-labelledby="badge-h">
    <h2 id="badge-h">Featured on OpenOrbia badge</h2>
    <p class="mk-note">Every launch is featured on OpenOrbia from its launch day. Show it off: your maker kit has the badge ready to paste. Paste a badge into your README or website. It links to openorbia.com.</p>
    <ul class="mk-badges">${BADGES.map(badgeCard).join('')}</ul>
  </section>

  <section class="mk-sec" aria-labelledby="next-h">
    <h2 id="next-h">After you submit</h2>
    ${list(after.map(esc))}
    <p class="mk-note mk-fair">No paid queue-skipping, no premium spots: every launch gets the same treatment.</p>
    <p class="pledge">No ads. No paid placement. No affiliate links.</p>
  </section>

  <section class="mk-sec" aria-labelledby="kit-h">
    <h2 id="kit-h">Your maker kit</h2>
    <p class="mk-note">A page just for your launch, with your launch link, ready-to-post text for X and LinkedIn, the "Featured on OpenOrbia" badge and the key dates. You get it as soon as your launch page is set up from your assets, before launch day: it is linked from your launch page as "Maker kit".</p>
  </section>

  <section class="mk-sec mk-week" aria-labelledby="week-h">
    <h2 id="week-h">Launch Week ${esc(FIRST_LAUNCH_WEEK.week)}</h2>
    <p class="mk-when">${day ? esc(day) : 'Coming soon'}</p>
    <dl class="mk-dates">${dates.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>
    <p class="mk-note">Launch-week makers in security and AI are featured in Khaja's Cyber Chronicle newsletter.</p>
  </section>

  <section class="cta" aria-labelledby="mk-cta-h">
    <div>
      <h2 id="mk-cta-h">Ready to <span class="grad">launch</span>?</h2>
      <p>Submit your tool on GitHub, or write to us.</p>
      <div class="contact"><code id="mk-mail">${EMAIL}</code><button class="copy" type="button" data-copy="${EMAIL}" data-copied="Copied">Copy</button></div>
      <p class="mk-ask">Questions? Email Khaja, OpenOrbia's founder, at <a href="mailto:hello@openorbia.com">hello@openorbia.com</a>.</p>
    </div>
    <div class="lw-actions"><a class="btn pri" href="${esc(SUBMIT_URL)}" target="_blank" rel="noopener">Submit via GitHub</a><a class="btn ghost" href="mailto:${EMAIL}">Email ${EMAIL}</a></div>
  </section>
</div>`;
  return layout({
    title: 'For makers: launch your free AI tool | OpenOrbia',
    description: `What makers get on OpenOrbia, the listing rules, the launch checklist and how to submit. Launch Week 1 is ${day || 'coming soon'}.`,
    path: '/makers/',
    body,
  });
}

export const makersResponse = () => new Response(renderMakers(), {
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
});
