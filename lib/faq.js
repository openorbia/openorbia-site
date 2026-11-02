// /faq/: the questions people ask about OpenOrbia, answered in the same words as the pages that own each rule (how we check,
// how voting works, for makers), with FAQPage structured data so search engines can show them.

import { esc } from './html.js';
import { layout } from './layout.js';
import { FIRST_LAUNCH_WEEK } from './site.js';
import { RECHECK_POLICY } from './how-we-check.js';
import { CONTACT_EMAIL } from './footer.js';

const LAUNCH_EMAIL = 'launch@openorbia.com';
const SITE = 'https://openorbia.com';
const firstLaunch = new Date(`${FIRST_LAUNCH_WEEK.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

// [question, answer]. An answer is a list of paragraphs; [text, href] in a paragraph is a link.
export const FAQ = [
  ['What is OpenOrbia?', [
    ['A weekly launch platform for free and open-source AI tools, with the catch shown up front, for small businesses, job seekers and security teams.'],
    ['Every tool is checked against its official docs, and each listing shows what is free, the catch, the setup and where your data goes.'],
  ]],
  ['Is OpenOrbia free?', [
    ['Yes. Browsing is free and launching a tool is free. There is no paid placement: nobody can pay to be listed, ranked higher or featured.'],
  ]],
  ['Which tools can be listed?', [
    ['A tool needs an open-source license or a real free plan, with no trial and no credit card needed for the free part. It must have been updated in the last 6 months, and AI must be a core part of it, not a side feature. ', ['How we check tools', '/how-we-check/'], '.'],
  ]],
  ['Does open source mean free to run?', [
    ['Not always. Some open-source tools need a paid service to work, such as a paid AI API key. Those are labeled "Needs paid service" and kept out of the Runs free view, which is on by default on the ', ['Launch List', '/launch-list/'], '.'],
  ]],
  ['What is the difference between "checked against docs" and "Tested by OpenOrbia"?', [
    ['Every tool\'s facts are checked by hand against its official docs and pricing. "Tested by OpenOrbia" is a separate badge that appears only on a tool we have actually run ourselves, and most tools do not have it.'],
  ]],
  ['How often are the facts checked?', [
    [RECHECK_POLICY],
  ]],
  ['When are launches?', [
    [`Every week has a launch day on Monday. Voting opens Monday at 12:01 AM Pacific and closes Sunday at 11:59 PM Pacific. The first Launch Week starts ${firstLaunch}.`],
  ]],
  ['How does voting work?', [
    ['You can upvote each launch once per week, with no sign-in. To stop repeat votes without accounts or cookies, we combine your network address and browser into a scrambled code that cannot be turned back into either, and we never store your IP address. ', ['How voting works', '/how-voting-works/'], '.'],
  ]],
  ['How do I launch my tool?', [
    ['Use the ', ['Submit a tool', '/submit/'], ' form. We check your facts against your docs before anything is listed, then your tool gets its own page and a launch week. ', ['For makers', '/makers/'], ' has the checklist.'],
  ]],
  ['I found a wrong fact. How do I report it?', [
    ['Email ', [LAUNCH_EMAIL, `mailto:${LAUNCH_EMAIL}`], ' with the tool\'s name and what should change. A link to the tool\'s docs or pricing page helps. We update the page and its "Last checked" date once we have verified the change.'],
  ]],
  ['I make a tool on the list. Can I claim the listing?', [
    ['Yes. Use "Claim listing" on its card on the Launch List, or email ', [LAUNCH_EMAIL, `mailto:${LAUNCH_EMAIL}`], '.'],
  ]],
  ['Does OpenOrbia list its founder\'s own tools?', [
    ['Yes, under the same rules as every other tool. They are labeled "Built by Khaja Syed, OpenOrbia\'s founder" wherever they appear, and kept off the Launch Week leaderboard and the featured spots.'],
  ]],
  ['What data does OpenOrbia keep?', [
    ['No cookies, and never your IP address. The forms store only what you type in them. Votes are counted with the scrambled code described above, and following a tool link adds one to that tool\'s count for the day, with nothing about you.'],
  ]],
  ['How do I contact OpenOrbia?', [
    ['For questions and ideas: ', [CONTACT_EMAIL, `mailto:${CONTACT_EMAIL}`], '. For launches and corrections: ', [LAUNCH_EMAIL, `mailto:${LAUNCH_EMAIL}`], '.'],
  ]],
];

const html = part => (Array.isArray(part) ? `<a href="${esc(part[1])}">${esc(part[0])}</a>` : esc(part));
const text = part => (Array.isArray(part) ? part[0] : part);
const slug = q => q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

// FAQPage structured data: every question and its answer as plain text
export function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: `${SITE}/faq/`,
    mainEntity: FAQ.map(([q, paras]) => ({
      '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: paras.map(p => p.map(text).join('')).join(' ') },
    })),
  };
}

export function renderFaq() {
  const items = FAQ.map(([q, paras]) => `<details class="faq-q" id="${slug(q)}"><summary>${esc(q)}</summary><div class="faq-a">${paras.map(p => `<p>${p.map(html).join('')}</p>`).join('')}</div></details>`).join('\n    ');
  // < is escaped so nothing in an answer can close the script element
  const ld = JSON.stringify(faqJsonLd(), null, 2).replace(/</g, '\\u003c');
  const body = `<div class="hwc">
  <section aria-labelledby="faq-h">
    <span class="badge"><i></i>FAQ</span>
    <h1 id="faq-h">Questions, <em>answered</em>.</h1>
    <p class="hwc-sub">What OpenOrbia is, how tools are checked, how launches and voting work, and how to reach us.</p>
  </section>

  <section class="faq" aria-label="Questions">
    ${items}
  </section>

  <section class="faq-more" aria-labelledby="more-h">
    <h2 id="more-h">Still have a question?</h2>
    <p>Write to <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
  </section>
</div>
<script type="application/ld+json">
${ld}
</script>`;
  return layout({
    title: 'FAQ | OpenOrbia',
    description: 'Answers about OpenOrbia: what is free, which tools can be listed, how facts are checked, how launches and voting work, and how to contact us.',
    path: '/faq/',
    body,
  });
}

export const faqResponse = () => new Response(renderFaq(), {
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
});
