// /launches/week-<n>/results/: the final ranks of a launch week, per category.
//
// Ranking: most upvotes first. Launches with the same number of upvotes share a rank, and the next rank skips the places taken
// ("1, 1, 3"). Within a tie they are listed by name, so the page never reorders itself between visits.

import { esc, number, categoryName, CATEGORY_COLORS } from './html.js';
import { layout } from './layout.js';
import { weekInfo, listWeek } from './launches.js';
import { dayLabelLong } from './time.js';

const CATEGORY_ORDER = ['biz', 'job', 'sec'];
const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

// launches -> [{ category, entries: [{ rank, launch }] }] in the site's category order, empty categories left out
export function rankByCategory(launches) {
  const out = [];
  const categories = [...CATEGORY_ORDER, ...new Set(launches.map(l => l.category).filter(c => !CATEGORY_ORDER.includes(c)))];
  for (const category of categories) {
    const inCategory = launches.filter(l => l.category === category).sort((a, b) => (b.votes - a.votes) || byName(a, b));
    if (!inCategory.length) continue;
    let rank = 0, previous = null;
    const entries = inCategory.map((launch, i) => {
      if (launch.votes !== previous) { rank = i + 1; previous = launch.votes; }   // a new vote count starts a new rank at its position
      return { rank, launch };
    });
    out.push({ category, entries });
  }
  return out;
}

function logo(launch) {
  const [a, b] = CATEGORY_COLORS[launch.category] || CATEGORY_COLORS.biz;
  return `<span class="logo logo-initial" aria-hidden="true" style="--s:40px;background:linear-gradient(135deg,${a},${b})">${esc((launch.name.trim()[0] || '?').toUpperCase())}</span>`;
}

export function renderResults({ week, launches }) {
  const closesLabel = Number.isNaN(week.closesAt) ? 'Sunday' : dayLabelLong(week.closesAt);
  const title = `Launch Week ${week.week} final results | OpenOrbia`;
  if (!week.closed) {
    return layout({
      title: `Launch Week ${week.week} results | OpenOrbia`,
      description: `The final results of Launch Week ${week.week} appear when voting closes.`,
      path: `/launches/week-${week.week}/results/`,
      noindex: true,
      body: `<section class="lboard-hero"><span class="badge"><i></i>Launch Week ${esc(week.week)}</span><h1>Results are <em>not final yet</em>.</h1>
<p>Voting closes ${esc(closesLabel)} at 11:59 PM Pacific. <a href="/launches/">See the live leaderboard</a>.</p></section>`,
    });
  }
  const sections = rankByCategory(launches).map(({ category, entries }) => `<section class="res-sec" aria-labelledby="res-${esc(category)}">
  <h2 id="res-${esc(category)}">${esc(categoryName(category))}</h2>
  <ol class="res-list">${entries.map(({ rank, launch }) => `
    <li class="res-row"><span class="res-rank" aria-label="Rank ${rank}">${rank}</span>${logo(launch)}<a class="res-name" href="/launch/${esc(launch.slug)}/"><b>${esc(launch.name)}</b><span>${esc(launch.tagline)}</span></a><span class="res-votes">${number(launch.votes)} upvote${launch.votes === 1 ? '' : 's'}</span></li>`).join('')}
  </ol>
</section>`).join('\n');
  return layout({
    title,
    description: `The final ranks of Launch Week ${week.week} on OpenOrbia, by category: free and open-source AI tools ranked by community upvotes.`,
    path: `/launches/week-${week.week}/results/`,
    body: `<section class="lboard-hero"><span class="badge"><i></i>Launch Week ${esc(week.week)} · Final results</span><h1>Final <em>results</em></h1>
<p>Voting closed ${esc(closesLabel)} at 11:59 PM Pacific. Launches with the same number of upvotes share a rank.</p></section>
${sections || '<p class="empty">No launches this week.</p>'}
<p class="back"><a href="/launches/">← Launches</a></p>`,
  });
}

const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy': "frame-ancestors 'none'",
};
const notFound = () => new Response(layout({
  title: 'Results not found | OpenOrbia', description: 'There are no results for that launch week.', path: '/launches/', noindex: true,
  body: '<section class="lboard-hero"><span class="badge"><i></i>404</span><h1>No results <em>here</em>.</h1>\n<p>That launch week does not exist. <a href="/launches/">See this week\'s launches</a>.</p></section>',
}), { status: 404, headers: { ...HEADERS, 'cache-control': 'no-store' } });

export async function resultsResponse({ env, params, now = Date.now() }) {
  const m = /^week-(\d{1,4})$/.exec(String(params?.week ?? '').replace(/\/+$/, ''));
  if (!m) return notFound();
  if (!env.DB) return new Response('Results are unavailable right now.', { status: 503, headers: { ...HEADERS, 'cache-control': 'no-store' } });
  try {
    const week = await weekInfo(env.DB, Number(m[1]), now);
    if (!week) return notFound();
    const launches = week.closed ? await listWeek(env.DB, week.week) : [];
    // once voting is over the numbers never change, so the final page can be cached for a while
    return new Response(renderResults({ week, launches }), { status: 200, headers: { ...HEADERS, 'cache-control': week.closed ? 'public, max-age=300' : 'no-store' } });
  } catch {
    return new Response('Results are unavailable right now.', { status: 503, headers: { ...HEADERS, 'cache-control': 'no-store' } });
  }
}
