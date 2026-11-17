#!/usr/bin/env node
// Writes the featured tools into public/index.html (between <!-- featured:start --> and <!-- featured:end -->), the "Get a first
// result" strip (between <!-- first-results:start --> and <!-- first-results:end -->), and the shared
// footer, whose site map lists tools from the Launch List, into the three static pages.
// Run it after changing data/free-facts.json or the Launch List:  node scripts/build-home.mjs   (npm run build:home)
// A test fails when the page does not match what this would write.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TOOLS } from '../public/assets/tools.js';
import { pickFeatured, renderFeatured } from '../lib/featured.js';
import { footerHtml } from '../lib/footer.js';
import { renderFirstResultStrip } from '../lib/first-result.js';
import { lineupAnnouncedAt, weekdayLabel } from '../lib/time.js';
import { FIRST_LAUNCH_WEEK, makersLine } from '../lib/site.js';
import { needsPaidService } from '../public/assets/facts.js';

const root = new URL('../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('data/free-facts.json', root), 'utf8'));
export const confidenceByRepo = Object.fromEntries(data.map(e => [e.repo, e.confidence]));

export function featuredHtml() { return renderFeatured(pickFeatured(TOOLS, confidenceByRepo)); }

// the "Get a first result" strip: every tool with a first result (lib/first-result.js)
export const firstResultsHtml = () => renderFirstResultStrip(TOOLS);

// The homepage week box: "Lineup announced Wednesday, Nov 18", worked out from the first launch week (lib/time.js)
export const LINEUP_RE = /<p class="week-lineup" data-lineup-date>[^<]*<\/p>/;
export const lineupHtml = () => `<p class="week-lineup" data-lineup-date>Lineup announced ${weekdayLabel(lineupAnnouncedAt(FIRST_LAUNCH_WEEK.date))}</p>`;

// The homepage makers line ("3 makers confirmed · 26 invited"), from lib/site.js
export const MAKERS_RE = /<p class="week-makers" data-makers>[^<]*<\/p>/;
export const makersHtml = () => `<p class="week-makers" data-makers>${makersLine()}</p>`;

// The Launch List's counts, from the Launch List itself: the tools that run free (no required paid service) in the title,
// description, og:title and headline, and the ones that need a paid service in the note under it
export const listCounts = () => { const paid = TOOLS.filter(t => needsPaidService(t.facts)).length; return { free: TOOLS.length - paid, paid }; };
export function withListCounts(html, { free, paid } = listCounts()) {
  const swaps = [
    [/(<title>Launch List: )\d+( AI tools that run free)/, `$1${free}$2`],
    [/(<meta name="description" content=")\d+( free and open-source AI tools that run without a paid service)/, `$1${free}$2`],
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

// The static pages carry the footer with <span id="yr">2026</span>; a small script there puts in this year
export const STATIC_PAGES = ['public/index.html', 'public/launch-list/index.html', 'public/404.html'];
export const staticFooter = () => footerHtml('<span id="yr">2026</span>');

// html with what is between <!-- name:start --> and <!-- name:end --> replaced by `inner`
function fill(html, name, inner) {
  const start = html.indexOf(`<!-- ${name}:start -->`);
  const end = html.indexOf(`<!-- ${name}:end -->`);
  if (start < 0 || end < start) { console.error(`public/index.html has no ${name}:start / ${name}:end markers`); process.exit(1); }
  return `${html.slice(0, start)}<!-- ${name}:start -->\n    ${inner}\n    ${html.slice(end)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const home = new URL('public/index.html', root);
  const filled = fill(fill(readFileSync(home, 'utf8'), 'featured', featuredHtml()), 'first-results', firstResultsHtml());
  if (!LINEUP_RE.test(filled)) { console.error('public/index.html has no <p class="week-lineup" data-lineup-date>'); process.exit(1); }
  if (!MAKERS_RE.test(filled)) { console.error('public/index.html has no <p class="week-makers" data-makers>'); process.exit(1); }
  writeFileSync(home, filled.replace(LINEUP_RE, lineupHtml()).replace(MAKERS_RE, makersHtml()));
  const list = new URL('public/launch-list/index.html', root);
  writeFileSync(list, withListChecked(withListCounts(readFileSync(list, 'utf8'))));
  for (const page of STATIC_PAGES) {
    const file = new URL(page, root), html = readFileSync(file, 'utf8');
    const start = html.indexOf('<footer>'), end = html.indexOf('</footer>') + '</footer>'.length;
    if (start < 0 || end < start) { console.error(`${page} has no <footer>`); process.exit(1); }
    writeFileSync(file, html.slice(0, start) + staticFooter() + html.slice(end));
  }
  console.log('Featured tools written to public/index.html, and the footer to the static pages');
}
