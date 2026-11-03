# Security policy

OpenOrbia (https://openorbia.com) is a small, volunteer-run site. We take security reports seriously and will credit you if you want.

## Reporting a problem
Please report security issues privately, not in a public issue:
- GitHub: **Security → Report a vulnerability** on this repository (private vulnerability reporting), or
- Email: launch@openorbia.com with "Security" in the subject.

Include what you found, where (URL or file), and how to reproduce it. We aim to reply within 7 days.

## Scope
In scope: openorbia.com, its preview deployments on openorbia.pages.dev, and the code in this repository.
Out of scope: the third-party tools we list (report those to their makers), and denial-of-service or spam testing against the live site.

## What we protect
- No cookies; voters and rate limits use a salted hash, never a raw IP address or user agent.
- Forms check that they come from our own pages, are rate limited, and use Cloudflare Turnstile.
- A Content Security Policy forbids inline and third-party scripts, except Cloudflare's.
- Secrets live in Cloudflare, never in this repository; CI scans every change for leaked secrets.
