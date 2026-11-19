# Search Console, Bing and Cloudflare checklist

These checks need the owner's accounts, so this audit could not run them. Each item says where to click and what a good result
looks like. Record the date and the numbers in the baseline table in `30_DAY_GROWTH_PLAN.md`.

## Google Search Console

1. **Property.** Use a *Domain* property for `openorbia.com` (covers `www`, `http` and `https`). If it is not verified yet:
   Search Console, Add property, Domain, then add the TXT record it shows in Cloudflare DNS. Adding a DNS record is a settings
   change; only the owner does it.
2. **Manual actions** (Security & Manual Actions, Manual actions). Expected: "No issues detected". If there is an action for
   unnatural links, see `BACKLINK_REVIEW.md`, "Disavow".
3. **Security issues.** Expected: "No issues detected".
4. **Sitemaps.** Submit `https://openorbia.com/sitemap.xml` if it is not there. After this branch deploys, the "Discovered pages"
   count should rise by 4 (the category pages), to 61 plus any announced launch pages.
5. **Pages (Indexing).** Note "Indexed" and "Not indexed". For each "Not indexed" reason, open the examples:
   - "Alternate page with proper canonical tag" for `?for=`, `?q=` or `www` URLs is expected and fine.
   - "Page with redirect" for `/faq`-style addresses is expected after this change.
   - "Crawled, currently not indexed" or "Discovered, currently not indexed" for tool or category pages is worth watching for
     a few weeks; new sites start slow.
   - Any `openorbia.pages.dev` URL should drop out after the noindex header ships.
6. **URL Inspection.** Inspect `/`, `/launch-list/`, `/category/careers/` and one tool page, such as `/tool/ollama/`. Run "Test live
   URL", then "View tested page", then "HTML": the Launch List HTML should contain the tool cards. Request indexing for the four
   category pages once they are live.
7. **Core Web Vitals.** Mobile and Desktop. A new site often shows "Not enough usage data"; note it and check again monthly.
8. **Links.** Export "Top linking sites" and "Top linking text". Compare with Ahrefs (see `BACKLINK_REVIEW.md`).
9. **Performance (Search results).** Last 28 days: total clicks, total impressions, average position, and the top 20 queries and
   pages. This is the baseline.
10. **Enhancements.** After deploy: "Breadcrumbs" should list tool and category pages with no errors. The FAQ page's FAQ
    markup may not show as a rich result; Google limits FAQ rich results to a small set of sites, which is fine.

## Bing Webmaster Tools

1. Sign in and use "Import from Google Search Console" to add the site and its sitemap.
2. Check Site Explorer and URL Inspection for `/launch-list/` and a category page.
3. IndexNow is optional. It needs a key file in `public/` and a ping on each change; not added in this branch.

## Cloudflare (dashboard, owner only)

1. **www to apex redirect (finding A1).** Rules, Redirect Rules, Create rule. Use the template "Redirect from WWW to root", or:
   - When: Hostname equals `www.openorbia.com`
   - Then: Dynamic redirect, expression `concat("https://openorbia.com", http.request.uri.path)`, status 301, preserve query
     string on.

   Check: `curl -sI https://www.openorbia.com/faq/` should return `301` with `location: https://openorbia.com/faq/`. The DNS
   record for `www` must stay proxied (orange cloud), or the rule will not run.
2. **Bots.** Security, Bots: note whether "Block AI bots" or AI Crawl Control blocks any crawler, and whether "Manage robots.txt"
   is on. The audit saw OpenOrbia's own `robots.txt` served unchanged. Do not change these without deciding the AI-crawler
   question in `SEO_FIXES.md`.
3. **Always Use HTTPS** is on (`http://` already redirects with 301). No change.
4. **Web Analytics** (optional, free) gives page views without cookies; the Content Security Policy already allows its beacon.

## After each Launch Week

- Check that the new launch pages appear in `sitemap.xml` from the lineup announcement.
- URL-inspect one new launch page and request indexing.
- Note new genuine referring domains (makers linking to their launch page or badge).
