// GitHub stars of the Launch List tools, for the lines "47 tools · 1.8M+ GitHub stars between them" on the homepage and
// "Home to free AI tools with 1.8M+ GitHub stars" on the Launch List. The stars are the tools' own, counted on GitHub
// (data/stars.json, written by scripts/fetch-stars.mjs); the wording always says so and never presents them as
// OpenOrbia's users. build:home writes the lines into the pages, and a test fails when they fall behind the data.

import { formatChecked } from '../public/assets/facts.js';

// 1,830,038 -> "1.8M+", 263,001 -> "263k+": always rounded down, so the line never claims more than the count
export function starLabel(n) {
  if (n >= 1e6) return `${Math.floor(n / 1e5) / 10}M+`;
  if (n >= 1e3) return `${Math.floor(n / 1e3)}k+`;
  return String(n);
}

// tools: the Launch List (public/assets/tools.js TOOLS); data: { checked: 'YYYY-MM-DD', stars: { 'owner/repo': n } }
export function starStats(tools, data) {
  const stars = (data && data.stars) || {};
  const counted = tools.filter(t => Number.isInteger(stars[t.repo]) && stars[t.repo] >= 0);
  const total = counted.reduce((sum, t) => sum + stars[t.repo], 0);
  const top = [...counted].sort((a, b) => stars[b.repo] - stars[a.repo]).slice(0, 2).map(t => t.name);
  return { tools: tools.length, counted: counted.length, total, label: starLabel(total), top, checked: formatChecked(data && data.checked) };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// the homepage, under the hero buttons: one line; the count date is in its tooltip (the Launch List line shows it)
export const homeStarsHtml = s => `<p class="proof" title="Stars counted on GitHub, ${esc(s.checked)}"><span class="proof-main">${s.tools} tools · ${s.label} GitHub stars between them · every one <a href="/how-we-check/">checked</a></span></p>`;

// the Launch List, under its intro
export const listStarsHtml = s => `<p class="stars-line">Home to free AI tools with ${s.label} GitHub stars <span>· counted on GitHub, ${esc(s.checked)}</span></p>`;
