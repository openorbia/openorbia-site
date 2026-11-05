# Security policy

This is the same text as https://openorbia.com/security/ (built from `lib/security.js`); a test keeps the two in step.

OpenOrbia (https://openorbia.com) is a small, independent site. We take security reports seriously and will credit you if you want.

## Reporting a problem
Please report security issues privately, not in a public issue:
- First choice: GitHub private vulnerability reporting. On our repository, open Security, then Report a vulnerability. (Direct link: https://github.com/openorbia/openorbia-site/security/advisories/new)
- Or email hello@openorbia.com with "Security" in the subject.

Include what you found, where (URL or file), and how to reproduce it. We aim to reply within 7 days.

## Scope
- In scope: openorbia.com, its preview deployments on openorbia.pages.dev, and the code in our GitHub repository.
- Out of scope: the third-party tools we list (report those to their makers), and denial-of-service or spam testing against the live site.

## What we protect
- We don’t set cookies.
- Votes and rate limits use a salted hash, never a raw IP address or user agent.
- Forms check that they come from our own pages, are rate limited, and use Cloudflare Turnstile.
- A Content Security Policy forbids inline and third-party scripts, except Cloudflare’s.
- Secrets live in Cloudflare, never in our repository; CI scans every change for leaked secrets.

## Contact details for tools
Our contact details are also in machine-readable form at https://openorbia.com/.well-known/security.txt.
