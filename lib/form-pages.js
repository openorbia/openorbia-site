// /submit/ (submit a tool) and /request/ ("Find me a free tool"). Server-rendered so the Turnstile site key comes from the environment
// (TURNSTILE_SITE_KEY, a public value). public/assets/forms.js sends the form as JSON to /api/submit or /api/request.

import { esc } from './html.js';
import { layout } from './layout.js';
import { CATEGORIES, SETUPS, CARD, PAID, AUDIENCES, LIMITS } from './forms.js';

const ISSUE_FORM = 'https://github.com/openorbia/openorbia-site/issues/new?template=submit-a-tool.yml';
const EMAIL = 'launch@openorbia.com';

const field = (id, label, control, hint = '') =>
  `<div class="ff"><label for="${id}">${esc(label)}</label>${control}${hint ? `<p class="ff-hint" id="${id}-hint">${esc(hint)}</p>` : ''}<p class="ff-err" id="${id}-err" role="alert" hidden></p></div>`;
const input = (id, { type = 'text', max, required = true, placeholder = '', autocomplete = '', hint = false } = {}) =>
  `<input id="${id}" name="${id}" type="${type}"${max ? ` maxlength="${max}"` : ''}${required ? ' required' : ''}${placeholder ? ` placeholder="${esc(placeholder)}"` : ''}${autocomplete ? ` autocomplete="${autocomplete}"` : ''}${hint ? ` aria-describedby="${id}-hint"` : ''}>`;
const textarea = (id, max, rows = 3, required = true) => `<textarea id="${id}" name="${id}" rows="${rows}" maxlength="${max}"${required ? ' required' : ''}></textarea>`;
const select = (id, table, { placeholder = 'Choose one' } = {}) =>
  `<select id="${id}" name="${id}" required><option value="">${esc(placeholder)}</option>${Object.entries(table).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>`;

const turnstile = siteKey => siteKey
  ? `<div class="cf-turnstile" data-sitekey="${esc(siteKey)}" data-theme="dark"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
  : '';

function shell({ kind, siteKey, title, intro, fields, button, alt }) {
  const ready = !!siteKey;
  return `<div class="hwc">
  <header class="hwc-head"><span class="badge"><i></i>${esc(kind === 'submit' ? 'For makers' : 'Free tool finder')}</span>
  <h1>${title}</h1>
  <p class="hwc-sub">${intro}</p></header>
  ${ready ? `<form class="form" id="form" data-kind="${kind}" action="/api/${kind}" method="post" novalidate>
    ${fields}
    <div class="hp" aria-hidden="true"><label>Leave this empty<input name="company" tabindex="-1" autocomplete="off"></label></div>
    ${turnstile(siteKey)}
    <div class="form-actions"><button class="btn pri" type="submit" id="form-btn">${esc(button)}</button>${alt}</div>
    <p class="form-msg" id="form-msg" role="status" aria-live="polite"></p>
    <noscript><p class="form-msg err">This form needs JavaScript for its spam check. You can email ${esc(EMAIL)} instead.</p></noscript>
  </form>` : `<p class="form-msg err">This form is not switched on yet. Please email <a href="mailto:${EMAIL}">${EMAIL}</a>${kind === 'submit' ? ` or use the <a href="${ISSUE_FORM}" target="_blank" rel="noopener">GitHub form</a>` : ''}.</p>`}
  <p class="fine">We store only what you type here. No IP address, no cookies.</p>
</div>
<script src="/assets/forms.js" defer></script>`;
}

export function renderSubmit({ siteKey = '' } = {}) {
  const paidNote = 'Say which paid service it needs, if any. Leave empty if none.';
  const fields = [
    field('tool_name', 'Tool name', input('tool_name', { max: LIMITS.tool_name })),
    field('url', 'Repo or website', input('url', { type: 'url', max: LIMITS.url, placeholder: 'https://github.com/you/your-tool' })),
    field('maker_name', 'Your name', input('maker_name', { max: LIMITS.maker_name, autocomplete: 'name' })),
    field('email', 'Your email', input('email', { type: 'email', max: LIMITS.email, autocomplete: 'email', hint: true }), "We write to this address about your submission. It is never shown on the site."),
    field('category', 'Category', select('category', CATEGORIES)),
    field('license', 'License', input('license', { max: LIMITS.license, placeholder: 'MIT, Apache-2.0, or the name of your free plan', hint: true }), 'An open-source license, or a real free plan.'),
    field('free_tier', "What's free", textarea('free_tier', LIMITS.free_tier), 'What people can use at no cost, and the main limits.'),
    field('card_required', 'Card required for the free part?', select('card_required', CARD)),
    field('setup', 'Setup', select('setup', SETUPS)),
    field('paid_level', 'Needs a paid service?', select('paid_level', PAID)),
    field('paid_deps', 'Paid dependencies', textarea('paid_deps', LIMITS.paid_deps, 2, false), paidNote),
    field('assets_link', 'Assets link (optional)', input('assets_link', { type: 'url', max: LIMITS.assets_link, required: false, placeholder: 'https://', hint: true }), 'A link to your logo and screenshots, for the launch page.'),
  ].join('\n    ');
  const body = shell({
    kind: 'submit', siteKey, title: 'Submit a <em>tool</em>.',
    intro: 'Free and open-source AI tools only, with a real free part. Tell us the facts and we check each one by hand against your docs before it is listed.',
    fields, button: 'Submit tool',
    alt: `<a class="btn ghost" href="${ISSUE_FORM}" target="_blank" rel="noopener">Use the GitHub form instead</a>`,
  });
  return layout({
    title: 'Submit a tool | OpenOrbia', path: '/submit/', body,
    description: 'Submit a free or open-source AI tool to OpenOrbia. We check every listing by hand against its own docs.',
  });
}

export function renderRequest({ siteKey = '' } = {}) {
  const constraint = (id, label) => `<label class="check"><input type="checkbox" name="${id}" id="${id}"> ${esc(label)}</label>`;
  const fields = [
    field('task', 'What do you want to do?', textarea('task', LIMITS.task, 3), 'For example: transcribe my team meetings without sending audio to the cloud.'),
    field('audience', 'Who is it for?', select('audience', AUDIENCES)),
    `<fieldset class="ff"><legend>It must be</legend><div class="checks">${constraint('no_install', 'No install (works in the browser)')}${constraint('no_card', 'No credit card')}${constraint('runs_locally', 'Runs on my own computer')}</div></fieldset>`,
    field('email', 'Your email (optional)', input('email', { type: 'email', max: LIMITS.email, required: false, autocomplete: 'email', hint: true }), 'Only if you want us to write back. We never publish it.'),
    `<fieldset class="ff"><legend>May we publish your question, without your email, to help others?</legend><p class="ff-err" id="publish_ok-err" role="alert" hidden></p><div class="checks">` +
      `<label class="check"><input type="radio" name="publish_ok" value="yes" required> Yes</label><label class="check"><input type="radio" name="publish_ok" value="no"> No</label></div></fieldset>`,
  ].join('\n    ');
  const body = shell({
    kind: 'request', siteKey, title: 'Find me a <em>free tool</em>.',
    intro: 'Tell us what you need to get done. We look through the Launch List for free tools that fit, and write back if you leave an email.',
    fields, button: 'Send my question',
    alt: '<a class="btn ghost" href="/launch-list/">Browse the Launch List</a>',
  });
  return layout({
    title: 'Find me a free tool | OpenOrbia', path: '/request/', body,
    description: 'Tell OpenOrbia what you need to get done and we will look for a free AI tool that fits.',
  });
}

const page = html => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
export const submitResponse = env => page(renderSubmit({ siteKey: env && env.TURNSTILE_SITE_KEY }));
export const requestResponse = env => page(renderRequest({ siteKey: env && env.TURNSTILE_SITE_KEY }));
