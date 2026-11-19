# 30-day growth plan

A plan for earning genuine search visibility and links over the next 30 days with free, honest methods. It promises no
rankings and no Domain Rating number: both depend on things outside OpenOrbia's control. What it does promise is a
measurable baseline and a small number of useful, checkable pieces of work each week.

Ground rules (from the assignment and `CLAUDE.md`): no bought links, no link networks, no spam profiles, no automated posting or
comments, no mass directory submissions, no invented tool facts. Messages to makers are drafted by agents and sent by hand by
the founder. Contact details stay in the private store.

## Baseline (record on day 1, then weekly)

| Metric | Where | Day 1 | Day 7 | Day 14 | Day 21 | Day 30 |
| --- | --- | --- | --- | --- | --- | --- |
| Impressions, last 28 days | Search Console, Performance | | | | | |
| Clicks, last 28 days | Search Console, Performance | | | | | |
| Indexed pages | Search Console, Pages | | | | | |
| Pages not indexed, by reason | Search Console, Pages | | | | | |
| Top 20 queries | Search Console, Performance, Queries (export) | | | | | |
| Genuine referring domains | Search Console Links plus Ahrefs, spam removed by hand (`BACKLINK_REVIEW.md`) | | | | | |
| Ahrefs Domain Rating | Ahrefs Site Explorer | 0 | | | | |
| Core Web Vitals (mobile, desktop) | Search Console, Core Web Vitals | | | | | |
| Bing indexed pages | Bing Webmaster Tools | | | | | |

How to read them:

- **Impressions** move first, usually weeks before clicks. Category pages are new URLs; expect them to take a few weeks.
- **Genuine referring domains** is the number that matters for links. Count a domain once, only if a person would recognize it
  as a real site that chose to link.
- **DR** will lag and is affected by spam links; record it, don't steer by it.
- **Core Web Vitals** may say "Not enough usage data" for a while. The lab numbers in `SEO_AUDIT.md` are the reference until then.

## Week 1: ship and verify

- Merge and deploy this branch after review. Check the preview first (`SEO_FIXES.md`, "After the preview deploys").
- Owner tasks: www redirect in Cloudflare, Search Console sitemap and URL inspection for the four category pages, Bing import,
  update the LinkedIn, X and GitHub bios to the new description (`SEARCH_CONSOLE_CHECKLIST.md`).
- Record the baseline.

## Week 2: maker links (the most natural links OpenOrbia can earn)

Launch Week 1 makers already get a launch page and a badge (`/launch/<slug>/kit/`).

- In each maker's launch email (drafted, sent by hand), mention the kit and badge once, as an option, never a condition.
  Launching stays free with no paid placement, whatever a maker does.
- For tools already on the Launch List, check whether the README has a "featured on" or "as seen on" section. Where it does, a
  short, honest note about the tool page is reasonable. Where it doesn't, don't ask.
- Count the README and website links that appear (they are genuine referring domains).

## Week 3: one piece of original research

OpenOrbia has data no one else has published: free facts checked by hand against official docs for 45 tools. A short,
sourced write-up on the site (a new page, with method and limits stated) could be:

> **What "free" means for 45 open-source AI tools.** Of 45 tools checked against their official docs in November 2026: 2 need
> a paid service to work, 33 can optionally use one (usually a paid AI API), and 10 need nothing paid. 37 install and
> self-host; 7 are desktop apps; 1 runs in the browser. 34 work with local AI models, and 44 keep your data on your own
> computer or server.

Before publishing, recount every figure from `public/assets/tools.js` on the day, link the method (`/how-we-check/`), and state
the limits: one point in time, checked against docs, not hands-on tested. Share it once, where the topic fits (below).

## Week 4: community and editorial mentions

- **GitHub Discussions** (already live): answer install questions and post "free setup" write-ups. Each one is a real page about
  a real task.
- **Relevant communities**, one post each and only where self-promotion rules allow it: share the research piece or a category
  page, written by hand for that community. No cross-posting the same text.
- **Curated lists:** pick at most two or three hand-curated "awesome" lists that are about free or open-source AI tools, read
  their contribution rules, and open one pull request each where OpenOrbia genuinely fits. That is not mass submission.
- **Newsletters:** send a short note with the research piece to two or three newsletters that cover open-source AI. Drafted by
  an agent, sent by the founder.
- **Makers' own announcements:** when a Launch Week maker posts about their launch, that is a natural link; don't script it.

## Content work across all 30 days (from the content-review queue)

- Re-check Reactive Resume's "card required" against its docs.
- Add first useful results to more tools, starting with categories that have one-tool topics (Security: jailbreak testing,
  guardrails, threat detection, CTF practice; Productivity: meeting notes, email, AI search, social media; Careers: LinkedIn).
- Launch Week listings that fill those topics do the most for the category pages. Do not add unchecked tools to fill them.

## Day 30 review

Compare the table with day 1 and write down what changed and which actions plausibly caused it. Decide what to keep for the
next 30 days. If impressions or indexed pages did not move, check the Pages report reasons before changing anything else.
