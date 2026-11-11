// /newsletter/ and /newsletter/<slug>/: Orbia Weekly, the Monday email, as pages. The index shows the newest published issue and
// the archive; each issue has its own page. Issues are in lib/newsletter-issues.js; drafts are never shown.

import { esc } from './html.js';
import { layout } from './layout.js';
import { ISSUES } from './newsletter-issues.js';
import { ROWS, slugOf } from '../public/assets/tools.js';
import { CONTACT_EMAIL } from './footer.js';

const NAMES = new Map(ROWS.map(r => [slugOf(r[0]), r[0]]));

export const publishedIssues = (issues = ISSUES) => issues.filter(i => i.published).sort((a, b) => b.date.localeCompare(a.date));
export const issuePaths = (issues = ISSUES) => publishedIssues(issues).map(i => `/newsletter/${i.slug}/`);

const dateText = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const httpsOnly = u => (/^https:\/\//.test(u || '') ? u : null);

const joinCta = `<section class="faq-more" aria-labelledby="nl-join-h">
    <h2 id="nl-join-h">Get Orbia Weekly in your inbox</h2>
    <p>This week's free AI launches in one Monday email. Every email has an unsubscribe link.</p>
    <p><a class="btn pri" href="/#join">Join the waitlist</a></p>
  </section>`;

// The ad line at the bottom of every newsletter page. Ads are labelled and never change which tools are listed or how they rank.
export const adLine = `<p class="nl-ad">Want your ad here? Contact <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. Ads are always labeled and never affect which tools we list or how they rank.</p>`;

function issueBody(issue, { heading = 'h1' } = {}) {
  const news = issue.news.map(n => {
    const url = httpsOnly(n.source && n.source.url);
    return `<article class="nl-item"><h3>${esc(n.headline)}</h3><p>${esc(n.text)}${url ? ` (<a href="${esc(url)}" rel="noopener">${esc(n.source.label)}</a>)` : ''}</p></article>`;
  }).join('\n    ');
  const picks = issue.picks.filter(p => NAMES.has(p.slug)).map(p => `<li><a href="/tool/${esc(p.slug)}/">${esc(NAMES.get(p.slug))}</a>: ${esc(p.line)}</li>`).join('');
  return `<${heading} id="nl-issue-h">${esc(issue.title)}</${heading}>
    <p class="hwc-sub">${esc(dateText(issue.date))}. ${esc(issue.summary)}</p>
    ${news}
    <h2>Free picks this week</h2>
    <p>Checked against each tool's docs. Not tested by OpenOrbia unless its page says so.</p>
    <ul class="nl-picks">${picks}</ul>
    <p><strong>The catch:</strong> ${esc(issue.catch)}</p>`;
}

export function renderNewsletter(issues = ISSUES) {
  const [latest, ...older] = publishedIssues(issues);
  const main = latest
    ? `<section aria-labelledby="nl-issue-h"><p class="badge"><i></i>Latest issue</p>
    ${issueBody(latest, { heading: 'h2' })}</section>`
    : `<section aria-labelledby="nl-h2"><h2 id="nl-h2">The first issue is coming soon</h2>
    <p>Join the waitlist and you will get it first.</p></section>`;
  const archive = older.length
    ? `<section aria-labelledby="nl-arch-h"><h2 id="nl-arch-h">Earlier issues</h2><ul class="nl-archive">${older.map(i => `<li><a href="/newsletter/${esc(i.slug)}/">${esc(i.title)}</a> <span>${esc(dateText(i.date))}</span></li>`).join('')}</ul></section>`
    : '';
  const body = `<div class="hwc">
  <section aria-labelledby="nl-h">
    <span class="badge"><i></i>Orbia Weekly</span>
    <h1 id="nl-h">The best free AI tools, <em>in your inbox</em>.</h1>
    <p class="hwc-sub">A short Monday email: what happened in AI, and free and open-source tools with the catch shown up front.</p>
  </section>
  ${main}
  ${archive}
  ${joinCta}
  ${adLine}
</div>`;
  return layout({
    title: 'Orbia Weekly | OpenOrbia',
    description: 'Orbia Weekly: a short Monday email with AI news and free and open-source AI tools, with the catch shown up front.',
    path: '/newsletter/',
    body,
  });
}

export function renderIssue(issue) {
  const body = `<div class="hwc">
  <section aria-labelledby="nl-issue-h"><span class="badge"><i></i>Orbia Weekly</span>
    ${issueBody(issue)}
  </section>
  ${joinCta}
  <p><a href="/newsletter/">All issues</a></p>
  ${adLine}
</div>`;
  return layout({ title: `${issue.title} | Orbia Weekly`, description: issue.summary, path: `/newsletter/${issue.slug}/`, body });
}

const HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' };
export const newsletterResponse = () => new Response(renderNewsletter(), { headers: HEADERS });
export function issueResponse(slug, issues = ISSUES) {
  const issue = publishedIssues(issues).find(i => i.slug === slug);
  return issue ? new Response(renderIssue(issue), { headers: HEADERS }) : new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
