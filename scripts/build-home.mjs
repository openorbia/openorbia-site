#!/usr/bin/env node
// Writes the featured tools into public/index.html (between <!-- featured:start --> and <!-- featured:end -->), the "Get a first
// result" strip (between <!-- first-results:start --> and <!-- first-results:end -->), the category cards (between
// <!-- categories:start --> and <!-- categories:end -->, from lib/categories.js), the shared header, and the shared
// footer, whose site map lists tools from the Launch List, into the three static pages.
// Run it after changing data/free-facts.json or the Launch List:  node scripts/build-home.mjs   (npm run build:home)
// A test fails when the page does not match what this would write.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TOOLS, slugOf } from '../public/assets/tools.js';
import { pickFeatured, renderFeatured } from '../lib/featured.js';
import { footerHtml } from '../lib/footer.js';
import { headerHtml } from '../lib/header.js';
import { MARK, launchLockHead, jsonLdTag } from '../lib/layout.js';
import { homeCategoriesHtml, categoryStats } from '../lib/categories.js';
import { starStats, homeStarsHtml, listStarsHtml } from '../lib/stars.js';
import { defaultCardsHtml, defaultRows } from '../public/assets/launch-list.js';
import { renderFirstResultStrip } from '../lib/first-result.js';
import { launchOpensAt, launchClosesAt, weekdayLabel } from '../lib/time.js';
import { FIRST_LAUNCH_WEEK } from '../lib/site.js';
import { needsPaidService } from '../public/assets/facts.js';
import { llmsTxt, llmsFullTxt } from '../lib/llms.js';
import { closesPhrase } from '../lib/voting-window.js';

const root = new URL('../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('data/free-facts.json', root), 'utf8'));
export const confidenceByRepo = Object.fromEntries(data.map(e => [e.repo, e.confidence]));

export function featuredHtml() { return renderFeatured(pickFeatured(TOOLS, confidenceByRepo)); }

// the "Get a first result" strip: every tool with a first result (lib/first-result.js)
export const firstResultsHtml = () => renderFirstResultStrip(TOOLS);

// The homepage week box's dates: "Launch Week 1: Monday, Nov 23 – Sunday, Nov 29, 2026", worked out from the first launch week
// (lib/time.js). It stays true after the week, so the static box (what crawlers and visitors without JavaScript see) never goes stale;
// launch.js replaces the whole box with the live launches as soon as it loads.
export const LINEUP_RE = /<p class="week-lineup" data-lineup-date>[^<]*<\/p>/;
export const lineupHtml = () => {
  const d = FIRST_LAUNCH_WEEK.date, year = d.slice(0, 4);
  return `<p class="week-lineup" data-lineup-date>Launch Week ${FIRST_LAUNCH_WEEK.week}: ${weekdayLabel(launchOpensAt(d))} – ${weekdayLabel(launchClosesAt(d))}, ${year}</p>`;
};


// The Launch List's counts, from the Launch List itself: the tools that run free (no required paid service) in the title,
// description, og:title and headline, and the ones that need a paid service in the note under it
export const listCounts = () => { const paid = TOOLS.filter(t => needsPaidService(t.facts)).length; return { free: TOOLS.length - paid, paid }; };
export function withListCounts(html, { free, paid } = listCounts()) {
  const swaps = [
    [/(<title>Launch List: )\d+( AI tools that run free)/, `$1${free}$2`],
    [/(<meta name="description" content=")\d+( free AI tools that run without a paid service)/, `$1${free}$2`],
    [/(<meta property="og:title" content="The OpenOrbia Launch List: )\d+( AI tools that run free)/, `$1${free}$2`],
    [/(<h1>)\d+( AI tools that run free,)/, `$1${free}$2`],
    [/(<p class="note">)\d+ more tools? needs? a paid service/, `$1${paid} more tool${paid === 1 ? ' needs' : 's need'} a paid service`],
  ];
  for (const [re, to] of swaps) {
    if ((html.match(new RegExp(re.source, 'g')) || []).length !== 1) throw new Error(`public/launch-list/index.html: expected one ${re}`);
    html = html.replace(re, to);
  }
  return html;
}

// The Launch List's "checked <Month Year>" note, from the oldest row-level lastChecked (so it never claims more than every row has)
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const listChecked = (tools = TOOLS) => {
  const oldest = tools.map(t => t.facts.lastChecked).sort()[0];
  const [y, m] = oldest.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};
const CHECKED_RE = /(Listed by OpenOrbia from public GitHub repositories, checked )[A-Z][a-z]+ \d{4}(\.)/;
export function withListChecked(html, when = listChecked()) {
  if ((html.match(new RegExp(CHECKED_RE.source, 'g')) || []).length !== 1) throw new Error(`public/launch-list/index.html: expected one ${CHECKED_RE}`);
  return html.replace(CHECKED_RE, `$1${when}$2`);
}

// The Launch List's default cards (no filters), written into the page so the tools are in the HTML for crawlers and visitors
// without JavaScript; the page script then renders the same markup (public/assets/launch-list.js), so nothing moves
const CARDS_RE = /<!-- cards:start -->[\s\S]*?<!-- cards:end -->/;
const COUNT_RE = /<span class="count" id="count">[^<]*<\/span>/;
export function withListCards(html, cards = defaultCardsHtml(), n = defaultRows().length) {
  for (const re of [CARDS_RE, COUNT_RE]) if ((html.match(new RegExp(re.source, 'g')) || []).length !== 1) throw new Error(`public/launch-list/index.html: expected one ${re}`);
  return html.replace(CARDS_RE, () => `<!-- cards:start -->${cards}<!-- cards:end -->`).replace(COUNT_RE, `<span class="count" id="count">${n} TOOLS</span>`);
}

// The Launch List's structured data: the page as a CollectionPage whose main entity is the default list of tools, in the same
// order as the cards above, so search engines can read the list without running the page script (docs/seo/SEO_AUDIT_2026-11-20.md)
const SITE = 'https://openorbia.com';
export const listJsonLd = (rows = defaultRows()) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'The OpenOrbia Launch List',
  url: `${SITE}/launch-list/`,
  mainEntity: { '@type': 'ItemList', numberOfItems: rows.length,
    itemListElement: rows.map(([name], i) => ({ '@type': 'ListItem', position: i + 1, name, url: `${SITE}/tool/${slugOf(name)}/` })) },
});
const LIST_LD_RE = /<!-- list-jsonld:start -->[\s\S]*?<!-- list-jsonld:end -->/;
export function withListJsonLd(html, data = listJsonLd()) {
  if ((html.match(new RegExp(LIST_LD_RE.source, 'g')) || []).length !== 1) throw new Error('public/launch-list/index.html: expected one list-jsonld block');
  return html.replace(LIST_LD_RE, () => `<!-- list-jsonld:start -->\n${jsonLdTag(data)}<!-- list-jsonld:end -->`);
}

// The static pages carry the footer with <span id="yr">2026</span>; a small script there puts in this year
export const STATIC_PAGES = ['public/index.html', 'public/launch-list/index.html', 'public/404.html'];
export const staticFooter = () => footerHtml('<span id="yr">2026</span>');
export const staticHeader = () => headerHtml(MARK);

// The launch curtain's head block (lib/layout.js launchLockHead) between <!-- launch-lock:start --> and <!-- launch-lock:end -->
const LOCK_RE = /<!-- launch-lock:start -->\n[\s\S]*?<!-- launch-lock:end -->/;
export function withLaunchLock(html, page = 'page') {
  if ((html.match(new RegExp(LOCK_RE.source, 'g')) || []).length !== 1) throw new Error(`${page}: expected one launch-lock block`);
  return html.replace(LOCK_RE, () => `<!-- launch-lock:start -->\n${launchLockHead()}<!-- launch-lock:end -->`);
}

// The homepage week intro's closing time (lib/voting-window.js), between <p class="week-intro" data-week-intro> and </p>
export const WEEK_INTRO_RE = /(<p class="week-intro" data-week-intro>)[^<]*(<\/p>)/;
export const weekIntroText = () => `New free AI tools launch every Monday. Upvote the ones you'd use until ${closesPhrase()}.`;
export function withWeekIntro(html) {
  if ((html.match(new RegExp(WEEK_INTRO_RE.source, 'g')) || []).length !== 1) throw new Error('public/index.html: expected one week-intro paragraph');
  return html.replace(WEEK_INTRO_RE, (_, open, close) => `${open}${weekIntroText()}${close}`);
}

// The GitHub star lines (lib/stars.js), from data/stars.json (npm run fetch:stars)
export const stats = () => starStats(TOOLS, JSON.parse(readFileSync(new URL('data/stars.json', root), 'utf8')));

// html with what is between <!-- name:start --> and <!-- name:end --> replaced by `inner`
function fill(html, name, inner, page = 'public/index.html') {
  const start = html.indexOf(`<!-- ${name}:start -->`);
  const end = html.indexOf(`<!-- ${name}:end -->`);
  if (start < 0 || end < start) { console.error(`${page} has no ${name}:start / ${name}:end markers`); process.exit(1); }
  return `${html.slice(0, start)}<!-- ${name}:start -->\n    ${inner}\n    ${html.slice(end)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const home = new URL('public/index.html', root);
  const filled = fill(fill(fill(fill(readFileSync(home, 'utf8'), 'featured', featuredHtml()), 'first-results', firstResultsHtml()), 'categories', homeCategoriesHtml()), 'stars', homeStarsHtml(stats(), categoryStats()));
  if (!LINEUP_RE.test(filled)) { console.error('public/index.html has no <p class="week-lineup" data-lineup-date>'); process.exit(1); }
  writeFileSync(home, withWeekIntro(filled.replace(LINEUP_RE, lineupHtml())));
  const list = new URL('public/launch-list/index.html', root);
  writeFileSync(list, fill(withListJsonLd(withListCards(withListChecked(withListCounts(readFileSync(list, 'utf8'))))), 'stars', listStarsHtml(stats()), 'public/launch-list/index.html'));
  for (const page of STATIC_PAGES) {
    const file = new URL(page, root), html = readFileSync(file, 'utf8');
    const start = html.indexOf('<footer>'), end = html.indexOf('</footer>') + '</footer>'.length;
    if (start < 0 || end < start) { console.error(`${page} has no <footer>`); process.exit(1); }
    writeFileSync(file, html.slice(0, start) + staticFooter() + html.slice(end));
  }
  // the launch curtain's head block (lib/layout.js), so the static pages lock and unlock at the same moment as the rest
  for (const page of STATIC_PAGES) {
    const file = new URL(page, root);
    writeFileSync(file, withLaunchLock(readFileSync(file, 'utf8'), page));
  }
  // the shared header (lib/header.js) too, so a menu change reaches the static pages without copying it by hand
  for (const page of STATIC_PAGES) {
    const file = new URL(page, root), html = readFileSync(file, 'utf8');
    const start = html.indexOf('<header class="wrap">'), end = html.indexOf('</header>') + '</header>'.length;
    if (start < 0 || end < start) { console.error(`${page} has no <header class="wrap">`); process.exit(1); }
    writeFileSync(file, html.slice(0, start) + staticHeader() + html.slice(end));
  }
  // /llms.txt and /llms-full.txt for AI assistants (lib/llms.js), from the same Launch List
  writeFileSync(new URL('public/llms.txt', root), llmsTxt());
  writeFileSync(new URL('public/llms-full.txt', root), llmsFullTxt());
  console.log('Featured tools written to public/index.html, the footer to the static pages, and public/llms.txt and llms-full.txt');
}
