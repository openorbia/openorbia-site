// The five tools featured on the homepage: 2 security, 1 job seekers, 1 small business, 1 local AI (existing tools from the Launch List).
// A tool ruled out for featured spots (featureOnHomepage: false, see canFeature) is never picked. Within a slot the best is the one with
// confidence "high" and no paid dependency, then no paid dependency, then confidence "high", then the rest; ties go to the order of the list.
// The picks are written into public/index.html by scripts/build-home.mjs, and a test fails when the page and this file disagree.

import { esc } from './html.js';
import { canFeature, CATEGORIES } from '../public/assets/tools.js';

const tier = (tool, confidence) => {
  const high = confidence === 'high';
  const free = tool.facts.paidDeps && tool.facts.paidDeps.level === 'none';
  return high && free ? 0 : free ? 1 : high ? 2 : 3;
};

// tools: the Launch List tools; confidenceByRepo: { 'owner/repo': 'high' | 'medium' | 'low' } (it lives in data/free-facts.json, not on the page)
// -> [{ tool, role }] in the order they are shown
export function pickFeatured(tools, confidenceByRepo) {
  const taken = new Set();
  const best = (role, ok) => {
    const pool = tools.filter(t => canFeature(t) && !taken.has(t.slug) && ok(t));
    const winner = pool.map((t, i) => ({ t, i, k: tier(t, confidenceByRepo[t.repo]) })).sort((a, b) => a.k - b.k || a.i - b.i)[0];
    if (!winner) return null;
    taken.add(winner.t.slug);
    return { tool: winner.t, role };
  };
  // the narrow slots first, so the broad ones (local AI) cannot take their tool
  const pinned = PINNED_SEC.find(slug => tools.some(t => t.slug === slug && canFeature(t)));
  const sec1 = best('sec', t => t.category === 'sec' && (!pinned || t.slug === pinned));
  const sec2 = best('sec', t => t.category === 'sec');
  const job = best('job', t => t.category === 'job');
  const biz = best('biz', t => t.category === 'biz' && !t.localAI);
  const local = best('local', t => t.localAI);
  return [biz, job, sec1, sec2, local].filter(Boolean);
}

// The founder picks the first security tool: the first of these that can be featured (a tool that fails canFeature is skipped)
export const PINNED_SEC = ['garak', 'promptfoo'];

const ROLE_LABEL = { biz: CATEGORIES.biz, job: CATEGORIES.job, sec: CATEGORIES.sec, local: 'Works with local AI' };

export function renderFeatured(picks) {
  const card = ({ tool, role }) => {
    const f = tool.facts;
    const href = `/tool/${esc(tool.slug)}/`;
    return `<article class="ft" data-tool-slug="${esc(tool.slug)}"><span class="k">${esc(ROLE_LABEL[role])}</span>` +
      `<h3><a href="${href}">${esc(tool.name)}</a></h3>` +
      `<p class="ft-task">${esc(f.task)}</p>` +
      `<dl class="ft-facts"><div><dt>Free</dt><dd>${esc(f.freeTier)}</dd></div><div><dt>Setup</dt><dd>${esc(f.setup)}</dd></div><div><dt>The catch</dt><dd>${esc(f.catch)}</dd></div></dl>` +
      `<a class="ft-more" href="${href}">See the facts <span aria-hidden="true">→</span></a></article>`;
  };
  return picks.map(card).join('\n    ');
}
