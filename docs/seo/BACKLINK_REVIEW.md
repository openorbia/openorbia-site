# OpenOrbia backlink review

Review date: 2026-11-19. Input: the owner's Ahrefs summary (Domain Rating 0, 202 backlinks, 198 linking websites) and five
referring domains the owner flagged as suspicious. No Ahrefs export or Search Console access was available to this review, so
it covers those five domains, with HTTP checks made on 2026-11-19, and says what the owner should check next.

**Bottom line:** the five domains are link-marketing spam that redirects to SEO-services sellers. Nothing shows they were built
or paid for by OpenOrbia, and nothing shows they caused a penalty. No disavow file is recommended now. External links cannot
be removed by changing this repository.

## The five domains

Each was requested once with a plain HTTP client (no JavaScript, nothing downloaded or run); only the status, redirect target
and page title were recorded.

| Domain | Response | Redirects to | Mentions OpenOrbia on its home page | Classification |
| --- | --- | --- | --- | --- |
| `654334233.xyz` | 302 | `https://skylinkseo.com/` | No | Link-marketing spam (redirect to an SEO seller) |
| `87628158.xyz` | 302 | `https://rankzly.com/` | No | Link-marketing spam (redirect to an SEO seller) |
| `87628107.xyz` | 302 | `https://skylinkseo.com/` | No | Link-marketing spam (redirect to an SEO seller) |
| `high-dr-links.shop` | 301 | `https://itxoft.com/pricing` | No | Link-marketing spam (redirect to an SEO pricing page) |
| `12341710.xyz` | 301 | `https://siteopitimizer.com/` | No | Link-marketing spam (redirect to an SEO seller) |

The evidence for the classification:

- Numeric throwaway `.xyz` names and a name that advertises "high DR links".
- Every one forwards visitors to a company selling SEO or backlink services, two of them to the same seller.
- The owner reports that the anchor text is unrelated SEO wording that presents OpenOrbia as a backlink seller.

This matches a common pattern: spam domains link to many new sites (often ones that recently appeared in public lists such as
certificate logs or launch directories) so that the site owner sees the links in a backlink tool and goes looking for help.
That is an inference from the pattern, not something these responses prove.

## What this does and does not mean

- **No penalty is shown.** Google states that its systems recognize and ignore most spammy links. Only Search Console's Manual
  actions report can show a manual action; check it (`SEARCH_CONSOLE_CHECKLIST.md`).
- **Domain Rating 0 is expected.** DR is Ahrefs' own metric for a domain's link profile. A three-week-old site with mostly spam
  referring domains will read 0 to low single digits whatever Google thinks. DR is not used by Google.
- **The 202 backlinks / 198 domains count is inflated** by spam like this. The useful number is genuine referring domains
  (see the measurement plan in `30_DAY_GROWTH_PLAN.md`).

## Disavow: not recommended now

Google's guidance ("Disavow links to your site", Search Console Help) is to use the disavow tool only when there are many
spammy, artificial or low-quality links to the site and they have caused, or are likely to cause, a manual action. Neither is
shown here, and OpenOrbia did not create or pay for these links.

Recommend disavow only if one of these becomes true:

1. Search Console shows a manual action for unnatural links to the site.
2. Evidence appears of a link scheme built in OpenOrbia's name (for example, paid links someone bought "for" the site).

If that happens, build the file from a full Search Console "Links" export plus Ahrefs, using `domain:` lines for whole domains,
and have the owner review and upload it. This repository should never generate or submit one automatically.

## What to do instead

1. Do not contact or pay these sellers, and do not reply to "we can fix your toxic links" offers.
2. Check Search Console Manual actions and Security issues once now and then monthly.
3. Export Search Console Links, "Top linking sites", monthly, and compare it with Ahrefs' referring domains. Note new domains
   that are real: makers, newsletters, communities. Those are the ones to measure (`30_DAY_GROWTH_PLAN.md`).
4. Keep the site's wording as it is. Nothing on OpenOrbia should be changed to match the spam anchor text.

## Owner checklist for the full Ahrefs list

For the other referring domains in Ahrefs (Site Explorer, Referring domains, export):

- Sort by first-seen date and DR. Flag a domain as spam when most of these hold: numeric or random name, no real content, it
  redirects to an SEO seller, anchor text unrelated to AI tools, or thousands of outbound links on one page.
- Flag a domain as genuine when it is a real project, newsletter, directory with editorial review, or community that mentions
  OpenOrbia or a launch in context.
- Keep the list in the private store (`ops/README.md`), not in this public repository, if it includes anyone's contact details.
