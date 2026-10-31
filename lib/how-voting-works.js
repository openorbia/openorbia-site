// /how-voting-works/: the voting rules, in the founder's words (when voting opens and closes, one vote per launch, how votes are counted
// without accounts or cookies, ties, fair play, unusual activity, the founder's tools, what winning means).

import { esc } from './html.js';
import { layout } from './layout.js';

export const VOTING_EMAIL = 'hello@openorbia.com';

// [heading, paragraph] in the order they are shown. The text is the founder's.
export const VOTING_SECTIONS = [
  ['When', "Voting opens Monday at 12:01 AM Pacific and closes Sunday at 11:59 PM Pacific. Final results appear on the results page when voting closes, and we share them in Monday's newsletter."],
  ['One vote per launch', 'You can upvote each launch once per week. No sign-in needed.'],
  ['How we count', "To stop repeat votes without accounts or cookies, we combine your network address and browser into a scrambled code that can't be turned back into either. We never store your IP address. This is an estimate, not proof of one person: people on the same network (an office, a school) may share a code, and someone determined can get around it. We'd rather keep voting open and private than demand sign-ups."],
  ['Ties', 'Launches with the same vote count share a rank and are listed alphabetically.'],
  ['Fair play', "Makers are welcome to share their launch and ask for support. Offering rewards, payment or anything else in exchange for votes is not allowed and removes the launch from that week's ranking."],
  ['Unusual activity', "If we see a pattern that looks automated, we review it by hand before results are final. A sudden rush of votes alone isn't proof of cheating (it often means a maker shared their launch), so we never remove votes automatically. If we ever remove votes, we'll say how many and why in that week's newsletter."],
  ["Founder's tools", "Tools built by OpenOrbia's founder are labeled and never ranked."],
  ['What winning means', "The top launch in each category is shown as #1 on that week's results page. There's no prize or paid placement."],
];

const slug = heading => heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function renderHowVotingWorks() {
  const sections = VOTING_SECTIONS.map(([h, p]) =>
    `<section class="hwc-sec" aria-labelledby="${slug(h)}-h">\n    <h2 id="${slug(h)}-h">${esc(h)}</h2>\n    <p>${esc(p)}</p>\n  </section>`).join('\n\n  ');
  const body = `<div class="hwc">
  <section aria-labelledby="hvw-h">
    <span class="badge"><i></i>Launch Week</span>
    <h1 id="hvw-h">How <em>voting</em> works.</h1>
    <p class="hwc-sub">One upvote per launch, no accounts, no cookies. Here is exactly how it works and what we do to keep it fair.</p>
  </section>

  ${sections}

  <section class="hwc-sec" aria-labelledby="questions-h">
    <h2 id="questions-h">Questions or concerns</h2>
    <p><a href="mailto:${VOTING_EMAIL}">${VOTING_EMAIL}</a></p>
  </section>

  <p class="back"><a href="/launches/">← This week's launches</a> · <a href="/how-we-check/">How we check tools</a></p>
</div>`;
  return layout({
    title: 'How voting works | OpenOrbia',
    description: 'How OpenOrbia launch week voting works: when it opens and closes, one vote per launch, how votes are counted without accounts, ties and fair play.',
    path: '/how-voting-works/',
    body,
  });
}

export const howVotingWorksResponse = () => new Response(renderHowVotingWorks(), {
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
});
