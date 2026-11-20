// /free-ai-apis/: hosted AI APIs you can call without paying, checked against each provider's own pricing, limits or docs page.
// The same rule as the Launch List: only what the official page says. A fact the page does not state is "Not confirmed", never a
// guess. Re-check every row before changing CHECKED, and move a provider to NO_LONGER_FREE when its own docs say the free API ended.

import { esc } from './html.js';
import { layout } from './layout.js';

const SITE = 'https://openorbia.com';
export const CHECKED = '2026-11-20';
const CHECKED_LABEL = 'Nov 20, 2026';
export const NOT_CONFIRMED = 'Not confirmed';

// card: 'no' | 'yes' | null (the official pages do not say). data: what the official page says about free-tier inputs, or null.
export const FREE_APIS = [
  { name: 'Google Gemini API', kind: 'Free tier', url: 'https://aistudio.google.com/docs/pricing',
    free: 'Free input and output tokens, with limited access to some models', card: null,
    catch: 'Free-tier content is used to improve Google’s products', data: 'Used to improve Google’s products (paid tier: not used)' },
  { name: 'Groq', kind: 'Free plan', url: 'https://console.groq.com/docs/rate-limits',
    free: 'Rate-limited Free plan; a payment method is needed only to upgrade', card: null,
    catch: 'Lower rate limits than the paid plans', data: null },
  { name: 'OpenRouter', kind: 'Free models', url: 'https://openrouter.ai/docs/api-reference/limits',
    free: '“:free” models: 20 requests a minute, 50 a day', card: null,
    catch: '50 requests a day, or 1,000 a day after buying at least 10 credits', data: null },
  { name: 'Cloudflare Workers AI', kind: 'Daily allocation', url: 'https://developers.cloudflare.com/workers-ai/platform/pricing/',
    free: '10,000 Neurons a day at no charge', card: null,
    catch: 'On the Workers Free plan, more than 10,000 Neurons a day needs Workers Paid', data: null },
  { name: 'Cohere', kind: 'Trial key', url: 'https://docs.cohere.com/docs/rate-limits',
    free: 'Free trial key: 1,000 API calls a month, chat at 20 requests a minute', card: null,
    catch: 'Trial keys are rate-limited; production use is on paid production keys', data: null },
  { name: 'Cerebras Inference', kind: 'Free trial', url: 'https://inference-docs.cerebras.ai/support/rate-limits',
    free: '$5 in trial credits, which expire 30 days after they are granted', card: 'yes',
    catch: 'The API stays inactive until a verified payment method is added', data: null },
];

export const NO_LONGER_FREE = [
  { name: 'GitHub Models', url: 'https://docs.github.com/en/github-models', note: 'GitHub’s docs say GitHub Models has been retired.' },
  { name: 'Hugging Face Inference Providers', url: 'https://huggingface.co/docs/inference-providers/pricing', note: 'Free accounts get no included monthly credits; they can buy credits or upgrade to PRO.' },
  { name: 'Mistral AI', url: 'https://docs.mistral.ai/admin/billing-usage/usage-limits', note: 'Mistral’s usage-limits docs say API keys need billing activation and pay-as-you-go.' },
];

const cardText = c => (c === 'no' ? 'No' : c === 'yes' ? 'Yes' : NOT_CONFIRMED);

export function freeApisJsonLd() {
  const url = `${SITE}/free-ai-apis/`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Launch List', item: `${SITE}/launch-list/` },
        { '@type': 'ListItem', position: 2, name: 'Free AI APIs', item: url },
      ] },
      { '@type': 'ItemList', name: 'Free AI APIs, checked', url, numberOfItems: FREE_APIS.length,
        itemListElement: FREE_APIS.map((a, i) => ({ '@type': 'ListItem', position: i + 1, name: a.name, url: a.url })) },
    ],
  };
}

export function renderFreeApis() {
  const rows = FREE_APIS.map(a => `<li><div class="alt api-row"><span><b>${esc(a.name)}</b> <span class="tg cat">${esc(a.kind)}</span>
  <span class="cat-free"><span>Free:</span> ${esc(a.free)}</span>
  <span class="alt-d"><span class="api-k">Card needed:</span> ${esc(cardText(a.card))}${a.card ? '' : ' (the official page does not say)'}</span>
  <span class="alt-d"><span class="api-k">The catch:</span> ${esc(a.catch)}</span>
  <span class="alt-d"><span class="api-k">Your prompts:</span> ${esc(a.data || `${NOT_CONFIRMED} on the official page`)}</span>
  <a class="api-src" href="${esc(a.url)}" target="_blank" rel="noopener">Official page ↗</a></span></div></li>`).join('');
  const gone = NO_LONGER_FREE.map(g => `<li><b>${esc(g.name)}</b>: ${esc(g.note)} <a href="${esc(g.url)}" target="_blank" rel="noopener">Source ↗</a></li>`).join('');
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/launch-list/">Launch List</a><span aria-hidden="true">/</span><span>Free AI APIs</span></nav>
<section class="lboard-hero cat-hero">
  <span class="badge"><i></i>${FREE_APIS.length} providers · checked ${esc(CHECKED_LABEL)}</span>
  <h1>Free AI APIs, <em>checked</em></h1>
  <p>Hosted AI APIs you can call without paying, and what each free tier really gives you. Every row comes from the provider’s own pricing, limits or docs page, linked on the row. Where that page does not say something, we say “${NOT_CONFIRMED}” instead of guessing.</p>
  <p class="cat-how">Free tiers change often. Check the official page before you build on one, and <a href="/contact/">tell us</a> if a row is out of date.</p>
</section>
<section class="alts cat-topic" aria-labelledby="apis-h">
  <h2 id="apis-h">Free tiers and trials</h2>
  <ul class="alt-list">${rows}</ul>
</section>
<section class="alts cat-topic" aria-labelledby="local-h">
  <h2 id="local-h">Free with no limits: run the model yourself</h2>
  <p>A local model has no API quota and nothing leaves your computer. <a href="/tool/ollama/">Ollama</a> serves models on your own machine with an API that many apps can call, and the <a href="/collection/self-hosted/">self-hosted tools</a> run on your own server. You pay only for your own hardware.</p>
</section>
<section class="about cat-more" aria-labelledby="gone-h">
  <h2 id="gone-h">No longer free</h2>
  <ul>${gone}</ul>
  <p class="tool-note">Checked ${esc(CHECKED_LABEL)} against each provider’s own pages. <a href="/how-we-check/">How we check</a> · <a href="/launch-list/">Free AI tools on the Launch List</a></p>
</section>`;
  return layout({
    title: 'Free AI APIs in 2026: what each free tier gives you | OpenOrbia',
    description: `Free AI APIs checked ${CHECKED_LABEL}: Gemini, Groq, OpenRouter, Cloudflare Workers AI, Cohere and Cerebras. Limits, card, catch and source.`,
    path: '/free-ai-apis/',
    body,
    jsonLd: freeApisJsonLd(),
  });
}

export const freeApisResponse = () => new Response(renderFreeApis(), {
  status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
});
