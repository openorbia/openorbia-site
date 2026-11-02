#!/usr/bin/env node
// Writes the featured tools into public/index.html (between <!-- featured:start --> and <!-- featured:end -->), and the shared
// footer, whose site map lists tools from the Launch List, into the three static pages.
// Run it after changing data/free-facts.json or the Launch List:  node scripts/build-home.mjs   (npm run build:home)
// A test fails when the page does not match what this would write.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TOOLS } from '../public/assets/tools.js';
import { pickFeatured, renderFeatured } from '../lib/featured.js';
import { footerHtml } from '../lib/footer.js';

const root = new URL('../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('data/free-facts.json', root), 'utf8'));
export const confidenceByRepo = Object.fromEntries(data.map(e => [e.repo, e.confidence]));

export function featuredHtml() { return renderFeatured(pickFeatured(TOOLS, confidenceByRepo)); }

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
  writeFileSync(home, fill(readFileSync(home, 'utf8'), 'featured', featuredHtml()));
  for (const page of STATIC_PAGES) {
    const file = new URL(page, root), html = readFileSync(file, 'utf8');
    const start = html.indexOf('<footer>'), end = html.indexOf('</footer>') + '</footer>'.length;
    if (start < 0 || end < start) { console.error(`${page} has no <footer>`); process.exit(1); }
    writeFileSync(file, html.slice(0, start) + staticFooter() + html.slice(end));
  }
  console.log('Featured tools written to public/index.html, and the footer to the static pages');
}
