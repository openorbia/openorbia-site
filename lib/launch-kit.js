// /launch/<slug>/kit/: the maker kit for one launch. Built only from that launch's own row (launches.json, seeded into D1), so every
// future launch gets one with no extra work. Not indexed and not in the sitemap; linked from the launch page as "Maker kit".
//
// Wording rules for the ready-to-post text: invite people to "check it out" or "try it"; never ask for upvotes or trade votes, and say
// nothing about the tool beyond its listed name, tagline and free facts. test/launch-kit.test.js checks these.
// Copy buttons use the shared [data-copy] handler in public/assets/launch.js; there is no inline script.

import { esc } from './html.js';
import { layout } from './layout.js';
import { SLUG_RE } from './launch-data.js';
import { launchOpensAt, launchClosesAt, dayLabelLong } from './time.js';
import { getLaunch } from './launches.js';
import { BADGES } from './makers.js';

const SITE = 'https://openorbia.com';
export const X_MAX = 280;

export const launchUrl = slug => `${SITE}/launch/${encodeURIComponent(slug)}/`;
export const resultsUrl = week => `${SITE}/launches/week-${encodeURIComponent(week)}/results/`;

// Shorten to `max` characters on a word boundary, ending in "…"
const clip = (s, max) => {
  const t = String(s ?? '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1), sp = cut.lastIndexOf(' ');
  return `${(sp > max / 2 ? cut.slice(0, sp) : cut).replace(/[\s.,;:!?-]+$/, '')}…`;
};
const sentence = s => { const t = String(s ?? '').trim(); return !t || /[.!?…]$/.test(t) ? t : `${t}.`; };

// The X post: what the tool does (its tagline), "launching today on OpenOrbia", the link. Always at most 280 characters, counting the
// link in full (X itself counts any link as 23, so this leaves room).
export function xPost(launch) {
  const link = launchUrl(launch.slug);
  const tail = `\n\nLaunching today on OpenOrbia. Check it out: ${link}`;
  const room = X_MAX - tail.length;
  const head = clip(`${String(launch.name).trim()}: ${sentence(launch.tagline)}`, room);
  return head + tail;
}

// The LinkedIn post, 3 to 4 short lines: what it is for (the tagline), what is free (the listed free tier, when there is one),
// that it launches today, and the link
export function linkedInPost(launch) {
  const free = launch.facts && typeof launch.facts.freeTier === 'string' ? launch.facts.freeTier.trim() : '';
  return [
    `${String(launch.name).trim()}: ${sentence(launch.tagline)}`,
    free ? `Free: ${sentence(free)}` : '',
    'It’s launching today on OpenOrbia.',
    `Try it and tell me what you think: ${launchUrl(launch.slug)}`,
  ].filter(Boolean).join('\n\n');
}

// Plain share links, no third-party scripts. X's web intent (developer.x.com, "Web Intents": twitter.com/intent/tweet?text=) and
// LinkedIn's share URL (learn.microsoft.com, "Share on LinkedIn": linkedin.com/sharing/share-offsite/?url=), which takes only the link.
export const xShareUrl = launch => `https://twitter.com/intent/tweet?text=${encodeURIComponent(xPost(launch))}`;
export const linkedInShareUrl = launch => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(launchUrl(launch.slug))}`;

// The "Featured on OpenOrbia" badge. The rule on /makers/ is "Once your tool is featured, show it off", and a launch is featured from
// its launch day, so the badge is offered only once the launch has opened. It is the only badge there is; there is no separate
// "launched" badge. The snippets link to the launch page.
export const badgeAllowed = (launch, now) => now >= launchOpensAt(launch.launch_date);
export const badgeSnippets = launch => BADGES.map(b => ({
  ...b,
  markdown: `[![Featured on OpenOrbia](${SITE}/badge/${b.file})](${launchUrl(launch.slug)})`,
  html: `<a href="${launchUrl(launch.slug)}"><img src="${SITE}/badge/${b.file}" alt="Featured on OpenOrbia" width="193" height="56"></a>`,
}));

// One line for the maker's README, with the dark badge in front once the badge is allowed
export function readmeLine(launch, now) {
  const line = `${String(launch.name).trim()} is on OpenOrbia: [see the launch](${launchUrl(launch.slug)}).`;
  return badgeAllowed(launch, now) ? `${badgeSnippets(launch)[0].markdown}\n\n${line}` : line;
}

const snippet = (label, text, id) => `<div class="mk-snip kit-snip"><span class="mk-snip-l" id="${id}-l">${esc(label)}</span><pre class="mk-code kit-text"><code id="${id}">${esc(text)}</code></pre><button class="copy" type="button" data-copy="${esc(text)}" data-copied="Copied" aria-describedby="${id}-l">Copy</button></div>`;
const section = (id, heading, body) => `<section class="mk-sec" aria-labelledby="${id}-h"><h2 id="${id}-h">${heading}</h2>\n    ${body}\n  </section>`;

export function renderKit({ launch, now }) {
  const link = launchUrl(launch.slug);
  const opensAt = launchOpensAt(launch.launch_date), closesAt = launchClosesAt(launch.launch_date);
  const launchDay = Number.isNaN(opensAt) ? '' : dayLabelLong(opensAt);
  const closeDay = Number.isNaN(closesAt) ? '' : dayLabelLong(closesAt);
  const closed = !Number.isNaN(closesAt) && now >= closesAt;
  const allowed = badgeAllowed(launch, now);

  const badges = allowed
    ? `<p class="mk-note">Your launch is featured, so you can show it off. Each badge links to your launch page.</p>
    <ul class="mk-badges">${badgeSnippets(launch).map(b => `<li class="mk-badge"><h3>${esc(b.title)}</h3><div class="${b.panel}"><img src="/badge/${esc(b.file)}" alt="Featured on OpenOrbia badge, ${esc(b.key)} version" width="193" height="56"></div>${snippet('Markdown', b.markdown, `kit-b-${b.key}-md`)}${snippet('HTML', b.html, `kit-b-${b.key}-html`)}</li>`).join('')}</ul>`
    : `<p class="mk-note">The “Featured on OpenOrbia” badge is for tools that are featured, and your launch is featured from launch day${launchDay ? `, ${esc(launchDay)}` : ''}. Your badge snippets appear here then.</p>`;

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/launch/${esc(launch.slug)}/">${esc(launch.name)}</a><span aria-hidden="true">/</span><span>Maker kit</span></nav>
<div class="mk kit">
  <section class="mk-hero" aria-labelledby="kit-h">
    <span class="badge"><i></i>Maker kit</span>
    <h1 id="kit-h">Share <em>${esc(launch.name)}</em>.</h1>
    <p class="mk-note">Everything to share your launch: your link, posts you can copy, a badge and the key dates. Invite people to check it out; please don’t ask for upvotes.</p>
  </section>

  ${section('kit-link', 'Your launch link', snippet('Launch page', link, 'kit-link'))}

  ${section('kit-posts', 'Ready-to-post text', `<p class="mk-note">Post these on launch day. Edit them as you like; keep to what your tool really does.</p>
    ${snippet(`X post (${xPost(launch).length} of ${X_MAX} characters)`, xPost(launch), 'kit-x')}
    ${snippet('LinkedIn post', linkedInPost(launch), 'kit-li')}
    <p class="kit-share"><a class="btn ghost" href="${esc(xShareUrl(launch))}" target="_blank" rel="noopener">Share on X ↗</a><a class="btn ghost" href="${esc(linkedInShareUrl(launch))}" target="_blank" rel="noopener">Share on LinkedIn ↗</a></p>
    <p class="mk-note kit-fine">LinkedIn’s share link only takes your launch link, so paste the post text yourself.</p>`)}

  ${section('kit-badge', 'Badge', badges)}

  ${section('kit-readme', 'README snippet', `<p class="mk-note">One line for your README.</p>
    ${snippet('Markdown', readmeLine(launch, now), 'kit-readme-md')}`)}

  ${section('kit-dates', 'Key dates', `<ul class="mk-list">
      <li><b>Launch day:</b> ${launchDay ? `${esc(launchDay)}, 12:01 AM Pacific` : 'to be announced'}.</li>
      <li><b>Voting closes:</b> ${closeDay ? `${esc(closeDay)}, 11:59 PM Pacific` : 'Sunday 11:59 PM Pacific'}.</li>
      <li><b>Results:</b> <a href="${esc(resultsUrl(launch.launch_week))}">Launch Week ${esc(launch.launch_week)} results</a>${closed ? '' : ' (the final ranks appear when voting closes)'}.</li>
    </ul>`)}
</div>`;

  return layout({
    title: `Maker kit: ${launch.name} | OpenOrbia`,
    description: `Links, posts, badge and key dates for sharing the ${launch.name} launch on OpenOrbia.`,
    path: `/launch/${launch.slug}/kit/`,
    noindex: true,
    body,
  });
}

const HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-robots-tag': 'noindex' };
const notFound = () => new Response(layout({
  title: 'Maker kit not found | OpenOrbia', description: 'This launch does not exist.', path: '/launches/', noindex: true,
  body: '<section class="lboard-hero"><span class="badge"><i></i>404</span><h1>That launch <em>is not here</em>.</h1><p><a href="/launches/">See this week’s launches</a>.</p></section>',
}), { status: 404, headers: { ...HEADERS, 'cache-control': 'no-store' } });
const unavailable = () => new Response(layout({
  title: 'Maker kit | OpenOrbia', description: 'The maker kit is temporarily unavailable.', path: '/launches/', noindex: true,
  body: '<section class="lboard-hero"><h1>The maker kit is <em>unavailable</em> right now.</h1><p>Please try again in a minute.</p></section>',
}), { status: 503, headers: { ...HEADERS, 'cache-control': 'no-store' } });

export async function kitResponse({ env, params, now = Date.now() }) {
  const slug = String(params?.slug ?? '').replace(/\/+$/, '');
  if (!SLUG_RE.test(slug) || slug.length > 64) return notFound();
  if (!env.DB) return unavailable();
  try {
    const launch = await getLaunch(env.DB, slug);
    return launch ? new Response(renderKit({ launch, now }), { headers: HEADERS }) : notFound();
  } catch {
    return unavailable();
  }
}
