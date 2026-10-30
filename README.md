# openorbia-site

Source for https://openorbia.com: a static site in `public/`, Cloudflare Pages Functions in `functions/` (shared code in `lib/`) and a D1 database.

## Pages and API
- `/` homepage: waitlist form and the "This week's launches" section
- `/launch-list/` the Launch List
- `/launches/` this week's leaderboard (a countdown before launch day) and `/launch/<slug>/` one page per launch
- `/api/launches` (JSON for the homepage), `/api/vote` (upvotes), `/api/waitlist`

## Deploy
The site is **not** connected to Git: it is deployed with wrangler (direct upload) and needs `CLOUDFLARE_API_TOKEN`.

    npx wrangler pages deploy --project-name openorbia --branch main

- D1 database `openorbia-db`, bound as `DB` in `wrangler.toml`
- Secret `VOTE_SECRET` (any long random string; voting answers 503 without it):
  `npx wrangler pages secret put VOTE_SECRET --project-name openorbia`
- Secret `BREVO_API_KEY` (optional): a Brevo API key. With it, each new waitlist signup gets a welcome email from launch@openorbia.com (`lib/email.js`); without it signups still work and no email is sent. launch@openorbia.com must be a verified sender in Brevo:
  `npx wrangler pages secret put BREVO_API_KEY --project-name openorbia`
- First time on a database: `npm run db:schema:remote` (safe to re-run)

## Launch Week
1. Edit `data/launches.json` (one entry per tool) and put the maker's images in `public/launches/<slug>/` (images are static files, so adding them needs a deploy; the launch data itself does not).
2. `npm run seed:check` validates it, `npm run seed:local` / `npm run seed:remote` load it. Re-seeding updates entries in place and never touches votes; `--prune` also removes launches deleted from the file. Entries with `"sample": true` are placeholders: they are skipped for the live database unless you add `--include-samples`, and their images live in `test/fixtures/launches/<slug>/`, not in `public/`, so they are never deployed.

### Free facts
Each entry in `data/launches.json` (and each Launch List row) can carry optional facts: `freeTier` (short text), `cardRequired` (`"yes"`, `"no"` or `"unknown"`, shown as "Not confirmed"), `dataLocation` (`"Runs on your computer"`, `"Your server"`, `"Vendor cloud"`), `setup` (`"Browser, ready to use"`, `"Desktop app"`, `"Install & self-host"`), `catch` (one honest line) and `lastChecked` (`YYYY-MM-DD`). Missing fields are simply not shown; never fill one in unless it is known. `"testedBy": "OpenOrbia"` adds the "Tested by OpenOrbia" badge and must only be set for tools we really tested. Shared code is in `public/assets/facts.js`.

The `facts` column is new, and `schema.sql` only creates missing tables, so an existing database needs `npm run db:migrate:local` / `npm run db:migrate:remote` once, **before** deploying code that reads it.

While no launch is scheduled, `/launches/` shows the Launch Week intro (countdown, how it works, makers confirmed, two buttons). Its date and the "Makers confirmed" count are in `lib/site.js`: change them there and redeploy. Once launches are seeded the page switches to the lineup and then the leaderboard by itself.

Voting opens at 12:01 AM Pacific on each launch's `launch_date`. A visitor gets one upvote per launch for the whole launch week. Visitors are told apart by an HMAC of IP address and user agent, salted with the launch week and `VOTE_SECRET`: only that hash is stored, never the IP or user agent, and there are no cookies. Vote requests are rate limited (20 per 10 minutes per visitor), same-origin and JSON only.

## Local development
    cp .dev.vars.example .dev.vars
    npm run db:schema:local
    npm run seed:local
    npm run dev          # http://127.0.0.1:8788, serves public/ plus the sample images from test/fixtures/

`npm test` runs the tests (Node 22.5 or newer, no dependencies to install).

## See signups
D1 → openorbia-db → Console:
SELECT * FROM waitlist ORDER BY created_at DESC;
