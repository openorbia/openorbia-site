# OpenOrbia SEO audit

Audit date: 2026-11-19. Scope: the `openorbia-site` repository at `main` (commit `0330043`, the merge of #44) and the live site
at https://openorbia.com. Every finding below was checked against the repository or a live HTTP response; nothing is assumed.
Where something could not be checked (Search Console, Cloudflare dashboard settings, field Core Web Vitals), it says so.

This audit covers both assignments as one project: technical SEO, and the broader positioning across the four main
categories (Productivity, Automation & AI, Careers, Security), with Small businesses, Job seekers and Security teams kept as
audience filters.

## Summary

The site was already in good technical shape. Every page in the sitemap returned 200 with its own title, description and
self-referencing canonical, one `h1`, Open Graph and Twitter tags and `lang="en"`. `robots.txt` allowed all crawlers except
`/go/`, and the sitemap was valid. No internal link was broken. Performance was good.

No P0 issue was found. The real gaps were duplicate hosts and URL variants (P1), tool links that existed only in JavaScript
(P1), the four main categories having no pages of their own (P1), and positioning copy that described three audiences as the
whole platform (P1).

| ID | Priority | Finding | Status |
| --- | --- | --- | --- |
| A1 | P1 | `www.openorbia.com` serves a full copy of the site (200) instead of redirecting | Owner action in Cloudflare (see `SEARCH_CONSOLE_CHECKLIST.md`) |
| A2 | P1 | `openorbia.pages.dev` and preview deployments are indexable copies | Fixed |
| A3 | P1 | Launch List HTML had no tool links; all 43 cards were drawn by JavaScript | Fixed |
| A4 | P1 | The four main categories existed only as `?q=` searches, canonicalized to `/launch-list/` | Fixed: four category pages |
| A5 | P1 | Homepage, Launch List and Organization descriptions presented three audiences as the whole scope | Fixed |
| A6 | P2 | Server-rendered pages answered 200 without the trailing slash (`/faq`, `/tool/ollama`) | Fixed: 301 |
| A7 | P2 | Tool pages had a visible breadcrumb but no BreadcrumbList markup | Fixed |
| A8 | P2 | Sitemap had no `<lastmod>` | Fixed for tool pages (real dates only) |
| A9 | P2 | Tools menu offered only audience and setup filters | Fixed: By category / By audience / By setup |
| A10 | P2 | Content gaps: 12 topics have one tool; 0 tools hands-on tested; 1 unconfirmed fact | Content-review queue below |
| A11 | P3 | No `llms.txt` | Evaluated; not added (see below) |
| A12 | P3 | Organization description must match the LinkedIn, X and GitHub bios | Owner action |

## 1. Stack, routing and existing SEO

- **Framework:** none. Static HTML in `public/` plus Cloudflare Pages Functions in `functions/` (server-rendered pages built by
  `lib/*.js`), and a D1 database for launches, votes and signups. No bundler; `npm test` uses Node's built-in test runner.
- **Hosting:** Cloudflare Pages, free plan. There is deliberately no root `functions/_middleware.js`, because that would route
  every static file through Functions and count against the daily request limit. Each folder in `functions/` has its own
  middleware for security headers (`lib/security-headers.js`), mirrored for static files in `public/_headers`.
- **Rendering:** content is server-rendered (Functions) or static HTML, except the Launch List cards (A3).
- **Existing SEO code:** `lib/seo.js` (sitemap from fixed paths, Launch List tools and announced launches), `lib/layout.js`
  (title, description, canonical, robots, Open Graph, Twitter card), `public/robots.txt`, Organization + WebSite JSON-LD on the
  homepage, FAQPage JSON-LD on `/faq/`, noindex on the 404 pages. `test/seo.test.js` checks unique titles, descriptions and
  canonicals.
- **CI:** `.github/workflows/ci.yml` runs `npm test`, `seed:check`, `launch:check` and Gitleaks on every pull request. CodeQL
  runs too. Pull requests get a preview deployment on pages.dev; production deploys need the founder's approval in GitHub.

## 2. Routes and indexing intent

| Route | Source | Index? | Notes |
| --- | --- | --- | --- |
| `/` | `public/index.html` | Yes | Organization + WebSite JSON-LD |
| `/launch-list/` | `public/launch-list/index.html` | Yes | Filters in `?for=`, `?setup=`, `?q=`; the canonical drops them |
| `/category/<slug>/` (new) | `functions/category/[slug].js` | Yes | Productivity, Automation & AI, Careers, Security |
| `/tool/<slug>/` | `functions/tool/[slug].js` | Yes | One per Launch List tool; unknown slug is a noindex 404 |
| `/launches/`, `/launch/<slug>/` | Functions + D1 | Yes | Launch pages enter the sitemap when the lineup is announced |
| `/launches/<week>/results` | Functions + D1 | Yes | Weekly results |
| `/launch/<slug>/kit/` | Functions | Yes | Maker kit |
| `/makers/`, `/how-we-check/`, `/how-voting-works/`, `/faq/`, `/privacy/`, `/security/`, `/contact/`, `/submit/`, `/request/` | Functions | Yes | In the sitemap |
| `/unsubscribe/` | Functions | No (not in sitemap) | Token links from emails |
| `/go/<slug>` | Functions | No | Outbound redirects; `Disallow: /go/` in robots.txt |
| `/api/*` | Functions | No | JSON; votes, forms, clicks |
| `/404.html` | static | No | `noindex` |

## 3. Evidence for each finding

### A1. www host (P1, owner action)

```
https://www.openorbia.com/   -> 200 (full page)
http://www.openorbia.com/    -> 301 -> https://www.openorbia.com/
http://openorbia.com/        -> 301 -> https://openorbia.com/
```

Every page's canonical tag points to `https://openorbia.com/...`, which limits the harm, but a redirect is the stronger signal
and consolidates any links to `www`. A host redirect cannot be done in `_redirects` (it matches paths, not hosts), and doing it
in Functions would need the root middleware the repository deliberately avoids. It is a Cloudflare dashboard setting: see
`SEARCH_CONSOLE_CHECKLIST.md`, section "Cloudflare".

### A2. pages.dev copies (P1, fixed)

`https://openorbia.pages.dev/` returned 200 with no `X-Robots-Tag`. Previews (`<branch>.openorbia.pages.dev`) are the same.
Fixed with the patterns from the Cloudflare Pages headers documentation in `public/_headers`, and in the Functions middleware,
because Cloudflare does not apply `_headers` to Functions responses.

### A3. Launch List tool links only in JavaScript (P1, fixed)

The raw HTML of `/launch-list/` contained 0 links to `/tool/` pages; `public/assets/launch-list.js` filled `#grid` at runtime.
Google renders JavaScript, but Bing and most AI crawlers often do not, and the Launch List is the main hub linking to every
tool page. Tool pages were reachable through the sitemap, 10 homepage links and "Alternatives" chains only.

### A4. No category pages (P1, fixed)

The footer's four headings (Productivity, Automation & AI, Careers, Security) and their 23 topics were links such as
`/launch-list/?q=automat`. Those URLs canonicalize to `/launch-list/`, so nothing could rank for "free AI tools for careers".

A plain search was not good enough to build a page from: the "chat" search finds garak (a vulnerability scanner) and NeMo
Guardrails, which would have put security tools under Productivity. The category pages keep the same topics and search words
(`CATEGORY_LINKS` in `lib/footer.js`) and add an audience scope per topic. See `SEO_FIXES.md`.

### A5. Positioning copy (P1, fixed)

Before: homepage meta description, Open Graph description and Organization JSON-LD all read "...for small businesses, job
seekers and security teams." The Launch List description, og:description and intro said the same. The homepage section
"Find tools for your work" offered only the three audience cards, and the hero said "Where free AI tools take off."

### A6. Trailing-slash variants (P2, fixed)

```
https://openorbia.com/launch-list  -> 308 -> /launch-list/   (static: Cloudflare handles it)
https://openorbia.com/tool/ollama  -> 200                     (Function: second copy)
https://openorbia.com/launches     -> 200
https://openorbia.com/faq          -> 200
https://openorbia.com/makers       -> 200
```

The canonical tags already pointed at the slash versions. Query parameters on `/launch-list/` (`?for=sec`) answer 200 with the
canonical `/launch-list/`, which is the intended behavior for filter URLs.

### A7 and A8. Structured data and lastmod (P2, fixed)

Live JSON-LD before: homepage Organization + WebSite, `/faq/` FAQPage, nothing else. Tool pages showed "Launch List / Small
businesses / Ollama" but had no markup for it. The sitemap listed 57 URLs with `<loc>` only.

### Crawler access (verified, no change)

Requests to `/`, `/tool/ollama/` and `/robots.txt` with the user agents of Googlebot, Bingbot, GPTBot, ClaudeBot,
PerplexityBot and CCBot all returned 200, and `robots.txt` matches the repository file (no Cloudflare-managed rules prepended).
This only spoofs the user agent: Cloudflare's bot settings act on verified bots by IP, so the dashboard still needs a look
(checklist). AI crawler permissions were not changed; see the tradeoffs in `SEO_FIXES.md`.

## 4. Performance (lab measurements, 2026-11-19)

Measured in a desktop Chromium on the live site, with the Performance API:

| Page | TTFB | DOMContentLoaded | CLS | Requests | Transfer | JavaScript |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 113 ms | 450 ms | 0 | 16 | 142 KB | 9 KB (5 files) |
| `/launch-list/` | 38 ms | n/a | 0 | 18 | 31 KB | module scripts, cached |

Fonts are self-hosted WOFF2 with preloads; images have width and height; there are no third-party scripts beyond Cloudflare
Turnstile and the optional Web Analytics beacon. No performance work was needed, and none was done beyond making sure the new
Launch List HTML causes no layout shift (measured CLS 0 after the change). Field data (Chrome UX Report) is not available to
this audit; the Search Console Core Web Vitals report is the place to watch it.

## 5. Content-review queue

These are gaps to fill with checked facts. Nothing here was filled in with guesses.

| Item | What is missing | Why it matters | Who |
| --- | --- | --- | --- |
| Reactive Resume | `cardRequired: unknown` ("Not confirmed" on the page) | A free-facts row without an answer | Researcher re-check against the docs |
| All 45 tools | Hands-on testing (`testedBy` with a hand-set `testedOn`) | Pages say "Not hands-on tested yet" | Founder only, per CLAUDE.md |
| 40 of 45 tools | First useful result | The strongest original content on a tool page | Researcher, from official docs |
| promptfoo | Listed under "AI agents" because its description says it tests agents | Placement is by search words | Founder decision: keep, or narrow the topic |
| HexStrike AI, PurpleLlama | Under "More security tools": no security topic's search word matches them | Category page grouping | Add a topic word, or leave as is |
| JobSync-Service | Under "More career tools" for the same reason | Same | Same |

### Content gaps by topic

Topics with one listed tool: Meeting notes (Meetily), Email & inbox (Inbox Zero), AI search (Vane), CRM & sales (Twenty),
Social media (Postiz), Chatbots & AI apps (Dify), LinkedIn profile (ElevateLI), Jailbreak testing (garak), AI guardrails (NeMo
Guardrails), Security automation (Tracecat), Threat detection (AiSOC), CTF practice (PentestGPT).

Open pull request #30 removes Twenty. After it merges, "CRM & sales" will have no tool: its category-page section disappears
automatically, and `test/footer.test.js` will ask for the footer link to be removed. These gaps are where new Launch Week
listings help most; they are not reasons to add unchecked tools or filler text.

## 6. Evaluated and not done

- **llms.txt:** no search engine documents it as a ranking or retrieval signal, and the pages it would point to are already
  crawlable, in the sitemap and server-rendered. Not added. It can be revisited if a major AI search product documents support
  for it.
- **SoftwareApplication markup on tool pages:** Google's software app rich result requires `offers.price` and either
  `aggregateRating` or `review` (Google Search Central, "Software app structured data"). OpenOrbia has no ratings or reviews,
  and stating `price: 0` would flatten the free-tier nuance the site exists to explain (paid parts, optional
  paid APIs). Adding it without those would only produce warnings in Search Console. Not added.
- **Subcategory pages for the 23 topics:** 12 topics have a single tool, so separate pages would be thin. Topics stay as
  sections on the category pages and as the existing Launch List searches.
- **Performance changes:** none needed (section 4).
- **Search Console and Ahrefs:** not accessible to this audit. See `SEARCH_CONSOLE_CHECKLIST.md` and `BACKLINK_REVIEW.md`.
