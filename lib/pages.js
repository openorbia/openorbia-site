// Server-rendered launch pages (/launch/<slug>/ and /launches/) and the JSON for the homepage section.
// The render* functions are pure (data in, HTML out); the *Response functions read D1 and wrap them.

import { esc, paragraphs, initial, number, categoryName, isOpenLicense, videoEmbed, CATEGORY_COLORS } from './html.js';
import { layout } from './layout.js';
import { SLUG_RE, assetUrl, httpsUrl } from './launch-data.js';
import { launchOpensAt, dayLabel, comingLabel } from './time.js';
import { getLaunch, listWeek, currentWeek } from './launches.js';
import { votedSlugs } from './vote.js';

const SITE = 'https://openorbia.com';

// ---- small pieces ----

function logo(launch, size = 56) {
  const src = launch.logo_url && assetUrl(launch.logo_url, launch.slug);
  if (src) return `<img class="logo" src="${esc(src)}" alt="" width="${size}" height="${size}" style="--s:${size}px">`;
  const [a, b] = CATEGORY_COLORS[launch.category] || CATEGORY_COLORS.biz;
  return `<span class="logo logo-initial" aria-hidden="true" style="--s:${size}px;background:linear-gradient(135deg,${a},${b})">${esc(initial(launch.name))}</span>`;
}

function chips(launch) {
  return `<span class="tg cat">${esc(categoryName(launch.category))}</span>` +
    `<span class="tg ${isOpenLicense(launch.license) ? 'os' : 'fsh'}">${esc(launch.license)}</span>`;
}

function countdown(opensAt, now) {
  if (Number.isNaN(opensAt)) return '';
  const s = Math.max(0, Math.floor((opensAt - now) / 1000));
  const pad = n => String(n).padStart(2, '0');
  return `<div class="countdown" data-countdown="${new Date(opensAt).toISOString()}" data-now="${now}" data-on-zero="reload" role="timer" aria-label="Time until voting opens">` +
    `<div><b data-unit="d">${Math.floor(s / 86400)}</b><span>days</span></div>` +
    `<div><b data-unit="h">${pad(Math.floor((s % 86400) / 3600))}</b><span>hours</span></div>` +
    `<div><b data-unit="m">${pad(Math.floor((s % 3600) / 60))}</b><span>min</span></div>` +
    `<div><b data-unit="s">${pad(s % 60)}</b><span>sec</span></div></div>`;
}

// The upvote button. States: closed (voting not open yet), ready, voted. public/assets/launch.js does the posting.
function voteButton(launch, { open, voted, opensLabel, large = false }) {
  const state = !open ? 'closed' : voted ? 'voted' : 'ready';
  const text = state === 'closed' ? 'Soon' : number(launch.votes);
  const sr = state === 'closed' ? `Voting for ${launch.name} opens ${opensLabel}`
    : `Upvote ${launch.name}. ${number(launch.votes)} upvotes${voted ? ', you have upvoted' : ''}`;
  return `<button class="vote${large ? ' vote-lg' : ''}" type="button" data-slug="${esc(launch.slug)}" data-state="${state}" ` +
    `aria-pressed="${voted ? 'true' : 'false'}"${open ? '' : ' disabled'}>` +
    `<span class="arrow" aria-hidden="true">▲</span><span class="n" data-count>${text}</span><span class="sr" data-sr>${esc(sr)}</span></button>`;
}

// ---- /launch/<slug>/ ----

export function renderLaunch({ launch, now, voted = false }) {
  const opensAt = launchOpensAt(launch.launch_date);
  const open = now >= opensAt;
  const opensLabel = Number.isNaN(opensAt) ? 'soon' : dayLabel(opensAt);

  const links = [];
  const site = launch.website_url && httpsUrl(launch.website_url);
  const repo = launch.repo_url && httpsUrl(launch.repo_url);
  if (site) links.push(`<a class="btn pri" href="${esc(site)}" target="_blank" rel="noopener">Visit website ↗</a>`);
  if (repo) links.push(`<a class="btn ghost" href="${esc(repo)}" target="_blank" rel="noopener">${new URL(repo).hostname === 'github.com' ? 'View on GitHub' : 'Source code'} ↗</a>`);

  const shots = launch.screenshots.map(s => ({ src: s && assetUrl(s.src, launch.slug), alt: s && s.alt })).filter(s => s.src);
  const gallery = shots.length
    ? `<section class="shots" aria-label="Screenshots"><ul>${shots.map(s =>
      `<li><a href="${esc(s.src)}" target="_blank" rel="noopener"><img src="${esc(s.src)}" alt="${esc(s.alt || `${launch.name} screenshot`)}" loading="lazy" decoding="async"></a></li>`).join('')}</ul></section>`
    : '';

  const v = videoEmbed(launch.video_url && assetUrl(launch.video_url, launch.slug));
  const video = !v ? '' : v.kind === 'iframe'
    ? `<section class="video" aria-label="Video"><div class="frame"><iframe src="${esc(v.src)}" title="${esc(launch.name)} video" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation"></iframe></div></section>`
    : v.kind === 'file'
      ? `<section class="video" aria-label="Video"><div class="frame"><video src="${esc(v.src)}" controls preload="none" playsinline></video></div></section>`
      : `<section class="video"><a class="btn ghost" href="${esc(v.href)}" target="_blank" rel="noopener">Watch the video ↗</a></section>`;

  const makerLinks = launch.maker_links.map(l => ({ label: l && l.label, url: l && httpsUrl(l.url) })).filter(l => l.label && l.url)
    .map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('');
  const story = launch.maker_story
    ? `<section class="comments" aria-labelledby="c-h"><h2 id="c-h">Discussion</h2>
  <article class="comment">
    <span class="avatar" aria-hidden="true">${esc(initial(launch.maker_name))}</span>
    <div class="comment-body">
      <header><b>${esc(launch.maker_name)}</b><span class="pill">Maker</span>${makerLinks ? `<span class="mlinks">${makerLinks}</span>` : ''}</header>
      ${paragraphs(launch.maker_story)}
    </div>
  </article></section>`
    : '';

  const first = shots[0] && /\.(png|jpe?g|webp)$/i.test(shots[0].src) ? (shots[0].src.startsWith('/') ? SITE + shots[0].src : shots[0].src) : undefined;
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/launches/">Launch Week ${esc(launch.launch_week)}</a><span aria-hidden="true">/</span><span>${esc(launch.name)}</span></nav>
<section class="lhero">
  <div class="lhero-main">
    ${logo(launch, 84)}
    <div class="lhero-text">
      <div class="chips">${chips(launch)}</div>
      <h1>${esc(launch.name)}</h1>
      <p class="tagline">${esc(launch.tagline)}</p>
    </div>
  </div>
  <div class="lhero-vote">
    ${voteButton(launch, { open, voted, opensLabel, large: true })}
    <p class="vote-note" id="vote-status" role="status" aria-live="polite">${open ? (voted ? 'You upvoted this launch.' : 'Upvote if you would use it.') : `Voting opens ${esc(opensLabel)} at 12:01 AM Pacific.`}</p>
  </div>
</section>
${links.length ? `<div class="actions">${links.join('')}</div>` : ''}
${video}
${gallery}
<section class="about" aria-labelledby="a-h"><h2 id="a-h">About ${esc(launch.name)}</h2>${paragraphs(launch.description)}
  <dl class="facts">
    <div><dt>License</dt><dd>${esc(launch.license)}</dd></div>
    <div><dt>Category</dt><dd>${esc(categoryName(launch.category))}</dd></div>
    <div><dt>${open ? 'Launched' : 'Launches'}</dt><dd>${esc(opensLabel)}, Launch Week ${esc(launch.launch_week)}</dd></div>
  </dl>
</section>
${story}
<p class="back"><a href="/launches/">← All launches this week</a></p>`;

  return layout({
    title: `${launch.name}: ${launch.tagline} | OpenOrbia`,
    description: launch.tagline,
    path: `/launch/${launch.slug}/`,
    image: first,
    body,
  });
}

// ---- /launches/ ----

export function renderLeaderboard({ week, launches, now, voted = new Set() }) {
  let body;
  if (!week) {
    body = `<section class="lboard-hero"><span class="badge"><i></i>Launch Week</span><h1>This week's <em>launches</em></h1>
<p>Nothing has been scheduled yet. Check back soon, or <a href="/#join">join the waitlist</a> to hear first.</p></section>`;
  } else {
    const { opensAt, open } = week;
    const opensLabel = Number.isNaN(opensAt) ? 'soon' : dayLabel(opensAt);
    const intro = open
      ? 'Ranked by upvotes. You get one upvote for each launch for the whole week.'
      : `${launches.length} free AI tool${launches.length === 1 ? '' : 's'} launch on ${esc(opensLabel)}. Voting opens at 12:01 AM Pacific.`;
    const clock = open ? '' : `<div class="soon-panel"><p class="coming">${esc(Number.isNaN(opensAt) ? 'Coming soon' : comingLabel(opensAt))}</p>${countdown(opensAt, now)}</div>`;
    const rows = launches.map((l, i) => {
      const top = open && l.votes > 0 && i < 3;
      return `<li class="lrow${top ? ` top top-${i + 1}` : ''}">
  ${open ? `<span class="rank" aria-label="Rank ${i + 1}">${i + 1}</span>` : ''}
  <a class="lrow-main" href="/launch/${esc(l.slug)}/">${logo(l, 56)}<span class="lrow-text"><b>${esc(l.name)}</b><span class="lrow-tag">${esc(l.tagline)}</span><span class="chips">${chips(l)}</span></span></a>
  ${voteButton(l, { open, voted: voted.has(l.slug), opensLabel })}
</li>`;
    }).join('\n');
    body = `<section class="lboard-hero"><span class="badge"><i></i>Launch Week ${esc(week.week)}</span><h1>This week's <em>launches</em></h1><p>${intro}</p></section>
${clock}
<p class="vote-note center" id="vote-status" role="status" aria-live="polite"></p>
<ol class="lboard" aria-label="${open ? 'Launches ranked by upvotes' : 'This week\'s lineup'}">
${rows || '<li class="empty">No launches yet.</li>'}
</ol>
<section class="cta"><div><h2>Launching <span class="grad">weekly</span>.</h2><p>Makers launch, the community upvotes, the best free tools rise.</p></div><a class="btn pri" href="/#join">Launch your tool</a></section>`;
  }
  return layout({
    title: "This week's launches | OpenOrbia",
    description: 'The free and open-source AI tools launching on OpenOrbia this week, ranked by community upvotes.',
    path: '/launches/',
    body,
  });
}

export function renderNotFound() {
  return layout({
    title: 'Launch not found | OpenOrbia',
    description: 'This launch does not exist.',
    path: '/launches/',
    noindex: true,
    body: `<section class="lboard-hero"><span class="badge"><i></i>404</span><h1>That launch <em>is not here</em>.</h1>
<p>The link may be wrong, or the launch has not been added yet. <a href="/launches/">See this week's launches</a>.</p></section>`,
  });
}

// ---- responses ----

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'private, no-store', // the upvote button state is per visitor
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy': "frame-ancestors 'none'",
};
const html = (status, text) => new Response(text, { status, headers: HTML_HEADERS });
const unavailable = () => html(503, layout({
  title: 'Launches | OpenOrbia', description: 'Launches are temporarily unavailable.', path: '/launches/', noindex: true,
  body: '<section class="lboard-hero"><h1>Launches are <em>unavailable</em> right now.</h1><p>Please try again in a minute.</p></section>',
}));

export async function launchResponse({ request, env, params, now = Date.now() }) {
  const slug = String(params?.slug ?? '').replace(/\/+$/, '');
  if (!SLUG_RE.test(slug) || slug.length > 64) return html(404, renderNotFound());
  if (!env.DB) return unavailable();
  try {
    const launch = await getLaunch(env.DB, slug);
    if (!launch) return html(404, renderNotFound());
    const voted = (await votedSlugs(env, request, launch.launch_week, [slug])).has(slug);
    return html(200, renderLaunch({ launch, now, voted }));
  } catch {
    return unavailable();
  }
}

export async function leaderboardResponse({ request, env, now = Date.now() }) {
  if (!env.DB) return unavailable();
  try {
    const week = await currentWeek(env.DB, now);
    const launches = week ? await listWeek(env.DB, week.week) : [];
    const voted = week && week.open ? await votedSlugs(env, request, week.week, launches.map(l => l.slug)) : new Set();
    return html(200, renderLeaderboard({ week, launches, now, voted }));
  } catch {
    return unavailable();
  }
}

// GET /api/launches?limit=3 : what the homepage section needs
export async function launchesApiResponse({ request, env, now = Date.now() }) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  const send = (status, body) => new Response(JSON.stringify(body), { status, headers });
  if (!env.DB) return send(503, { ok: false, error: 'Launches are unavailable.' });
  try {
    const limit = Math.min(10, Math.max(1, Number.parseInt(new URL(request.url).searchParams.get('limit') ?? '3', 10) || 3));
    const week = await currentWeek(env.DB, now);
    if (!week) return send(200, { ok: true, now, week: null, open: false, opens_at: null, label: null, total: 0, launches: [] });
    const all = await listWeek(env.DB, week.week);
    return send(200, {
      ok: true,
      now,
      week: week.week,
      open: week.open,
      opens_at: Number.isNaN(week.opensAt) ? null : new Date(week.opensAt).toISOString(),
      label: Number.isNaN(week.opensAt) ? null : dayLabel(week.opensAt),
      total: all.length,
      launches: all.slice(0, limit).map(l => ({
        slug: l.slug, name: l.name, tagline: l.tagline, category: l.category, logo_url: l.logo_url, votes: week.open ? l.votes : null,
      })),
    });
  } catch {
    return send(500, { ok: false, error: 'Something went wrong.' });
  }
}
