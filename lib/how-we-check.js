// /how-we-check/: the listing rules, what each Free fact means, how often we recheck, what "Not confirmed" means,
// how to ask for a correction, and how the founder's own tools are treated.

import { esc } from './html.js';
import { layout } from './layout.js';

const EMAIL = 'launch@openorbia.com';

// How often tools are checked again (the wording is the founder's)
export const RECHECK_POLICY = "We check every tool's activity and license every month, and recheck the full Free facts at least every 3 months. Each card shows its last-checked date.";

const list = items => `<ul class="mk-list">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;

export function renderHowWeCheck() {
  const rules = [
    'An open-source license, or a real free plan. No trials and no credit card needed for the free part.',
    'Updated in the last 6 months.',
    'AI is a core part of the tool, not a side feature.',
  ];
  const facts = [
    ['Free tier', 'What you can use at no cost, and the main limits.'],
    ['Card required', 'Whether you need a payment card to use the free part: Yes, No, or Not confirmed.'],
    ['Your data', 'Where your data goes: it runs on your computer, on your own server, or in the vendor\'s cloud.'],
    ['Setup', 'How you get started: in the browser and ready to use, as a desktop app, or by installing and self-hosting it.'],
    ['The catch', 'One short, honest line about the biggest limit or trade-off.'],
    ['Last checked', 'The date we last confirmed these facts.'],
  ];
  const defs = `<dl class="hwc-defs">${facts.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>`;

  const body = `<div class="hwc">
  <section aria-labelledby="hwc-h">
    <span class="badge"><i></i>Our method</span>
    <h1 id="hwc-h">How we <em>check</em> tools.</h1>
    <p class="hwc-sub">Every tool on OpenOrbia is checked by hand, and every page says when. Here is what we look for and what each fact means.</p>
  </section>

  <section class="hwc-sec" aria-labelledby="rules-h">
    <h2 id="rules-h">Listing rules</h2>
    ${list(rules)}
  </section>

  <section class="hwc-sec" aria-labelledby="how-h">
    <h2 id="how-h">How we check</h2>
    <p>We read the tool's license, its documentation and pricing, and its recent activity, then write down what a new user would actually get for free. If a repository is archived, has had no commits in 6 months, or has changed its license, the tool is reviewed and may be removed.</p>
    <p>A tool never pays to be listed.</p>
  </section>

  <section class="hwc-sec" aria-labelledby="facts-h">
    <h2 id="facts-h">What each fact means</h2>
    ${defs}
  </section>

  <section class="hwc-sec" aria-labelledby="often-h">
    <h2 id="often-h">How often we recheck</h2>
    <p>${esc(RECHECK_POLICY)}</p>
  </section>

  <section class="hwc-sec" aria-labelledby="nc-h">
    <h2 id="nc-h">What "Not confirmed" means</h2>
    <p>"Not confirmed" means we could not verify that fact from the tool's public documentation. It does not mean the answer is yes or no. Check the tool's own site before you sign up, and tell us if you know the answer.</p>
  </section>

  <section class="hwc-sec" aria-labelledby="fix-h">
    <h2 id="fix-h">Asking for a correction</h2>
    <p>If a fact is wrong or out of date, email <a href="mailto:${EMAIL}">${EMAIL}</a> with the tool's name and what should change. A link to the tool's docs or pricing page helps. We update the page and its "Last checked" date once we have verified the change. Makers can use the same address to claim their listing.</p>
  </section>

  <section class="hwc-sec" aria-labelledby="founder-h">
    <h2 id="founder-h">Tools built by our founder</h2>
    <p>OpenOrbia's founder has built a tool that is on the Launch List. It is labeled "Built by Khaja Syed, OpenOrbia's founder" wherever it appears, it follows the same rules as every other tool, and it is kept off the Launch Week leaderboard.</p>
  </section>

  <section class="hwc-sec" aria-labelledby="tested-h">
    <h2 id="tested-h">"Tested by OpenOrbia"</h2>
    <p>This badge appears only on a tool we have actually run ourselves. It is separate from upvotes, and most tools do not have it.</p>
  </section>

  <p class="back"><a href="/launch-list/">← Browse the Launch List</a> · <a href="/makers/">For makers</a></p>
</div>`;
  return layout({
    title: 'How we check tools | OpenOrbia',
    description: 'How OpenOrbia checks free AI tools: the listing rules, what each Free fact means, how often we recheck, and how to ask for a correction.',
    path: '/how-we-check/',
    body,
  });
}

export const howWeCheckResponse = () => new Response(renderHowWeCheck(), {
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
});
