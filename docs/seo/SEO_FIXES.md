# OpenOrbia SEO fixes

What changed on the `fix/seo-technical-audit` branch, why, how it was tested, and how to undo it. The findings and their
evidence are in `SEO_AUDIT.md`.

Nothing here changes Cloudflare settings, the database, secrets, security headers (other than adding `X-Robots-Tag` on
pages.dev hosts), rate limits, crawler permissions or any tool's facts. No dependency, paid service or tracking was added.

## Changes

### 1. Crawl hygiene (commit "Crawl hygiene: ...")

- **Trailing slash:** `lib/security-headers.js` (the middleware every `functions/` folder already uses) sends a 301 from a page
  address without its slash to the canonical one, keeping the query: `/faq` to `/faq/`, `/tool/ollama` to `/tool/ollama/`.
  Only GET and HEAD, and only for the page routes listed in `SLASH_PAGES`. `/api/`, `/go/`, `/unsubscribe` and form posts are
  never redirected.
- **pages.dev noindex:** `X-Robots-Tag: noindex` on `https://:project.pages.dev/*` and `https://:version.:project.pages.dev/*`
  in `public/_headers` (patterns from the Cloudflare Pages headers docs), and from the middleware for Functions responses on any
  `*.pages.dev` host. `openorbia.com` and `www` are not affected.

### 2. Category pages (commit "Category pages for ...")

- `/category/productivity/`, `/category/automation-and-ai/`, `/category/careers/`, `/category/security/`, rendered by
  `lib/categories.js` through `functions/category/[slug].js`.
- **One category system.** Topics and search words stay in `CATEGORY_LINKS` (`lib/footer.js`). A tool is listed under a
  topic when that same Launch List search finds it, limited to the Launch List audiences the topic takes tools from:

  | Category | Audiences | Notes |
  | --- | --- | --- |
  | Productivity | biz | Keeps garak and NeMo Guardrails (security tools whose text mentions "chat") out |
  | Automation & AI | biz, sec | "Chatbots & AI apps" takes biz only; AI agents and workflow automation include security tools |
  | Careers | job | Plus any other job tool, under "More career tools" |
  | Security | sec | Plus any other security tool, under "More security tools" |

  Every one of the 45 tools is on at least one category page (a test checks this).
- Each page shows what is free for every tool, labels tools that need a paid service, and says how many can optionally use a
  paid AI service. Topics with no tool are left off the page rather than shown empty.
- Each topic links to its existing Launch List search (`/launch-list/?q=...`), so every filtered listing that was linked
  before still is.
- **Sitemap:** the four category pages, and `<lastmod>` on tool pages from each tool's `lastChecked` date. Other pages have no
  `lastmod` rather than an invented one.
- **Tool pages:** a "Use cases" row linking to the tool's category pages. The audience row is now labeled "For".
- **JSON-LD:** BreadcrumbList on tool and category pages (matching the visible breadcrumb), ItemList of the tools on each
  category page. No ratings, reviews, prices or authors. `jsonLdTag()` in `lib/layout.js` escapes `<`, so no data can close
  the script tag.

### 3. Positioning (commit "Positioning: ...")

- **Homepage:** title and headline stay "Where free AI tools take off" (the founder's choice, after trying the suggested
  "Find free AI tools for what you want to do"); lede "Discover free and open-source AI tools for productivity, automation, careers, cybersecurity and
  more. See what is actually free, what needs a paid API and how each tool works."
- **Explore AI tools by category:** four cards (tool count, short description, link to the category page, and each topic as
  its existing Launch List search). The three audience cards follow under "Or browse by who you are", and the six task links
  stay. `build:home` writes the cards between `<!-- categories:start -->` and `<!-- categories:end -->`.
- **Tools menu:** Find my free setup on top, then By category, By audience and By setup, then "All tools" and "How we check
  tools". Every link that was there before is still there. Under 820px the panel is full width, as before. Between 821 and
  960px it hangs from the header's right edge, so it never runs off the window. Measured: inside the window and under the
  Tools link at 821, 900, 960, 961, 1100, 1280 and 1440px; 662px tall on a 375x812 phone.
- **Launch List:** category links under the headline; description and intro name the four categories.
- **Organization description** (homepage meta, og:description, JSON-LD): "A weekly launch platform for free and open-source AI
  tools for productivity, automation, careers and security, with the catch shown up front."
- `build:home` now also writes the shared header into the three static pages, like the footer.

### 4. Launch List cards in the HTML (commit "Launch List: ...")

`build:home` writes the default view's 43 cards and count into `public/launch-list/index.html` between
`<!-- cards:start -->` and `<!-- cards:end -->`, using `card()` exported from `public/assets/launch-list.js`. The browser's first
render puts back the same markup: identical DOM after parsing, layout shift 0. Filtered URLs render as before.

## Decisions to confirm

- **Headline and title: decided.** The suggested "Find free AI tools for what you want to do." was live briefly; the founder
  chose to keep "Where free AI tools take off." for the headline, page title and og:title (2026-11-19). The lede under it and
  the "Explore AI tools by category" section carry the four-category positioning.
- **AI crawler access: unchanged.** `robots.txt` allows every crawler except `/go/`. Tradeoffs, for a decision later:
  - *Allowing* (current): AI assistants and AI search can read and cite the free-facts pages, which suits a site whose value is
    accurate, citable facts. It also means the text can be used to train models.
  - *Blocking training crawlers* (for example `GPTBot`, `CCBot`, `Google-Extended`) while allowing search crawlers keeps the text
    out of some training sets. Some AI search products use separate user agents, so this needs a per-crawler list.
  - Cloudflare also has dashboard settings for AI bots that can override `robots.txt`; check them (checklist).
- **Category URL scheme** `/category/<slug>/` is new. It does not replace any existing URL.

## Tests

| Check | Result |
| --- | --- |
| `npm test` | 528 tests, 528 pass (508 before; 20 new) |
| `npm run seed:check`, `npm run launch:check -- --ci` | Run in CI on the pull request |
| New tests | `test/seo-crawl.test.js`, `test/categories.test.js`, `test/positioning.test.js` |
| Updated tests | Seven tests that pinned the old headline, lede, Organization description, menu links or sitemap list. Each change is commented with the date and reason. |
| Browser checks | Homepage, Tools menu, a category page and the Launch List at 375, 900, 1280 and 1400px: no horizontal overflow, menus inside the window, CLS 0 on the Launch List, filters still work (`?for=sec&setup=selfhost` shows 14 tools with the right buttons pressed). |
| Not run locally | `wrangler pages dev` (not installed here) and the real Cloudflare redirects and headers. The pull request's preview deployment is where to check them; see "After the preview deploys". |

There is no linter or type checker in this repository (plain JavaScript, no build step), so none was run.

### After the preview deploys

On `https://pr-<number>.openorbia.pages.dev`:

```
curl -sI https://pr-<number>.openorbia.pages.dev/tool/ollama        # 301, location /tool/ollama/, x-robots-tag: noindex
curl -sI https://pr-<number>.openorbia.pages.dev/                   # 200, x-robots-tag: noindex
curl -s  https://pr-<number>.openorbia.pages.dev/sitemap.xml        # category pages listed, tool pages with <lastmod>
curl -s  https://pr-<number>.openorbia.pages.dev/category/careers/  # 200, BreadcrumbList + ItemList JSON-LD
```

Then paste a category page and a tool page into Google's Rich Results Test and the Schema.org validator.

## Risks and rollback

- **Risk: the redirect list misses a route.** Only the listed page routes redirect; anything else behaves as before. A missed
  route just keeps answering 200 with its canonical tag, as today.
- **Risk: category placement is word-based.** Placements come from the existing search words plus an audience scope.
  "Something misplaced? Tell us" is on every category page, and borderline cases are in `SEO_AUDIT.md`.
- **Risk: a stale Launch List.** If `public/assets/tools.js` changes without `npm run build:home`, a test fails in CI, so the
  HTML cannot fall behind silently.
- **Rollback:** each change is one commit. `git revert <commit>` on a branch, then a pull request, undoes it. Nothing touches
  the database, secrets or Cloudflare settings, so there is nothing to undo outside the repository.

## Owner tasks (outside the repository)

1. Cloudflare: redirect `www.openorbia.com` to `openorbia.com` (301). Steps in `SEARCH_CONSOLE_CHECKLIST.md`.
2. Update the LinkedIn, X and GitHub bios to the new Organization description, word for word, so they match the site.
3. Search Console and Bing Webmaster Tools: the checks in `SEARCH_CONSOLE_CHECKLIST.md`.
4. Review the backlink report in `BACKLINK_REVIEW.md`. No disavow file is recommended at this time.
