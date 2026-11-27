// GitHub stars of the Launch List tools, for the line "<tools> tools across <n> categories · <stars> GitHub stars between them, as of <date>" on the homepage and
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

// the homepage, under the hero buttons: one line, every number from data. `cats` (lib/categories.js categoryStats()) explains why
// the category cards add up to more than the tools; the stars carry the date they were counted.
// "47 tools across 4 categories (9 in more than one) · 1.8M+ GitHub stars between them, as of Nov 19, 2026 · every one checked"
export function homeStarsHtml(s, cats = null) {
  const across = cats ? ` across ${cats.categories} categories${cats.shared ? ` (${cats.shared} in more than one)` : ''}` : '';
  const asOf = s.checked ? `, as of ${esc(s.checked)}` : '';
  return `<p class="proof"><span class="proof-main">${s.tools} tools${across} · ${s.label} GitHub stars between them${asOf} · every one <a href="/how-we-check/">checked</a></span></p>`;
}

// the Launch List, under its intro
export const listStarsHtml = s => `<p class="stars-line">Home to free AI tools with ${s.label} GitHub stars <span>· counted on GitHub, ${esc(s.checked)}</span></p>`;
