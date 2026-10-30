// /makers/: what makers get, the listing rules, the launch checklist and how to submit. Same shell as the other server-rendered pages.

import { esc } from './html.js';
import { layout } from './layout.js';
import { FIRST_LAUNCH_WEEK } from './site.js';
import { launchOpensAt, dayLabelLong } from './time.js';

const SUBMIT_URL = 'https://github.com/openorbia/openorbia-site/issues/new?template=submit-a-tool.yml';
const EMAIL = 'launch@openorbia.com';

const list = items => `<ul class="mk-list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;

export function renderMakers() {
  const opensAt = launchOpensAt(FIRST_LAUNCH_WEEK.date);
  const day = Number.isNaN(opensAt) ? '' : dayLabelLong(opensAt); // e.g. "Monday, Nov 23"
  const get = [
    ['A launch page', 'Your own page with your logo, screenshots, description, free facts and your story.'],
    ['Community upvotes', 'People vote for their favorites during launch week. One upvote per launch for the whole week.'],
    ['A feature', 'Launches are shared on LinkedIn and X and in our newsletter.'],
    ['All of it free', 'No fees, no paid placement, no trial. Ever.'],
  ];
  const rules = [
    'An open-source license, or a real free plan. No trials and no credit card.',
    'Updated in the last 6 months.',
    'AI is a core part of the tool, not a side feature.',
  ];
  const facts = [
    ["What's free", 'what you can use at no cost, and the limits'],
    ['Card required', 'yes or no'],
    ['Where your data goes', 'your computer, your server, or the vendor cloud'],
    ['Setup', 'in the browser, a desktop app, or install and self-host'],
    ['The catch', 'one short, honest line'],
    ['Last checked', 'the date we last checked it'],
  ];
  const checklist = [
    'Logo, 512px square',
    'Tagline, up to 60 characters',
    'Description, 2 to 3 sentences',
    '3 to 5 screenshots',
    'Optional: a 60-second video or GIF',
    'Links: website and source code',
    'Your name and handles',
    'Your maker story: why you built it',
  ];
  const body = `<div class="mk">
  <section class="mk-hero" aria-labelledby="mk-h">
    <span class="badge"><i></i>For makers</span>
    <h1 id="mk-h">Launch your free AI tool, <em>for free</em>.</h1>
    <p class="mk-sub">OpenOrbia is a weekly launch platform for free and open-source AI tools. Here is what you get, what we look for, and how to submit.</p>
    <div class="lw-actions"><a class="btn pri" href="${esc(SUBMIT_URL)}" target="_blank" rel="noopener">Submit via GitHub</a><a class="btn ghost" href="mailto:${EMAIL}">Email ${EMAIL}</a></div>
  </section>

  <section class="mk-sec" aria-labelledby="get-h">
    <h2 id="get-h">What makers get</h2>
    <ul class="mk-cards">${get.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ul>
  </section>

  <section class="mk-sec" aria-labelledby="rules-h">
    <h2 id="rules-h">Listing rules</h2>
    ${list(rules.map(esc))}
  </section>

  <section class="mk-sec" aria-labelledby="facts-h">
    <h2 id="facts-h">Free facts we show</h2>
    <p class="mk-note">Every launch page shows a short box of facts, so people see exactly what they get.</p>
    <dl class="mk-facts">${facts.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>
  </section>

  <section class="mk-sec" aria-labelledby="check-h">
    <h2 id="check-h">Launch checklist</h2>
    ${list(checklist.map(esc))}
  </section>

  <section class="mk-sec mk-week" aria-labelledby="week-h">
    <h2 id="week-h">Launch Week ${esc(FIRST_LAUNCH_WEEK.week)}</h2>
    <p class="mk-when">${day ? esc(day) : 'Coming soon'}</p>
    <p class="mk-note">Voting opens at 12:01 AM Pacific.</p>
  </section>

  <section class="cta" aria-labelledby="mk-cta-h">
    <div>
      <h2 id="mk-cta-h">Ready to <span class="grad">launch</span>?</h2>
      <p>Submit your tool on GitHub, or write to us.</p>
      <div class="contact"><code id="mk-mail">${EMAIL}</code><button class="copy" type="button" data-copy="${EMAIL}" data-copied="Copied">Copy</button></div>
    </div>
    <div class="lw-actions"><a class="btn pri" href="${esc(SUBMIT_URL)}" target="_blank" rel="noopener">Submit via GitHub</a><a class="btn ghost" href="mailto:${EMAIL}">Email ${EMAIL}</a></div>
  </section>
</div>`;
  return layout({
    title: 'For makers: launch your free AI tool | OpenOrbia',
    description: `What makers get on OpenOrbia, the listing rules, the launch checklist and how to submit. Launch Week 1 is ${day || 'coming soon'}.`,
    path: '/makers/',
    body,
  });
}

export const makersResponse = () => new Response(renderMakers(), {
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
});
