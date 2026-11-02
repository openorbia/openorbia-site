#!/usr/bin/env node
// Writes the featured tools (between <!-- featured:start --> and <!-- featured:end -->) and the numbers under the hero
// (between <!-- stats:start --> and <!-- stats:end -->) into public/index.html.
// Run it after changing data/free-facts.json or the Launch List:  node scripts/build-home.mjs   (npm run build:home)
// A test fails when the page does not match what this would write.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TOOLS } from '../public/assets/tools.js';
import { pickFeatured, renderFeatured, renderStats } from '../lib/featured.js';

const root = new URL('../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('data/free-facts.json', root), 'utf8'));
export const confidenceByRepo = Object.fromEntries(data.map(e => [e.repo, e.confidence]));

export function featuredHtml() { return renderFeatured(pickFeatured(TOOLS, confidenceByRepo)); }
export function statsHtml() { return renderStats(TOOLS); }

// html with what is between <!-- name:start --> and <!-- name:end --> replaced by `inner`
function fill(html, name, inner) {
  const start = html.indexOf(`<!-- ${name}:start -->`);
  const end = html.indexOf(`<!-- ${name}:end -->`);
  if (start < 0 || end < start) { console.error(`public/index.html has no ${name}:start / ${name}:end markers`); process.exit(1); }
  return `${html.slice(0, start)}<!-- ${name}:start -->\n    ${inner}\n    ${html.slice(end)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = new URL('public/index.html', root);
  const html = fill(fill(readFileSync(file, 'utf8'), 'featured', featuredHtml()), 'stats', statsHtml());
  writeFileSync(file, html);
  console.log('Featured tools and the numbers under the hero written to public/index.html');
}
