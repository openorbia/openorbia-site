#!/usr/bin/env node
// Writes the featured tools into public/index.html, between <!-- featured:start --> and <!-- featured:end -->.
// Run it after changing data/free-facts.json or the Launch List:  node scripts/build-home.mjs   (npm run build:home)
// A test fails when the page does not match what this would write.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TOOLS } from '../public/assets/tools.js';
import { pickFeatured, renderFeatured } from '../lib/featured.js';

const root = new URL('../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('data/free-facts.json', root), 'utf8'));
export const confidenceByRepo = Object.fromEntries(data.map(e => [e.repo, e.confidence]));

export function featuredHtml() { return renderFeatured(pickFeatured(TOOLS, confidenceByRepo)); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = new URL('public/index.html', root);
  let html = readFileSync(file, 'utf8');
  const start = html.indexOf('<!-- featured:start -->');
  const end = html.indexOf('<!-- featured:end -->');
  if (start < 0 || end < start) { console.error('public/index.html has no featured:start / featured:end markers'); process.exit(1); }
  html = `${html.slice(0, start)}<!-- featured:start -->\n    ${featuredHtml()}\n    ${html.slice(end)}`;
  writeFileSync(file, html);
  console.log('Featured tools written to public/index.html');
}
