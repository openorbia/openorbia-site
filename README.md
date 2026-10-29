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
- First time on a database: `npm run db:schema:remote` (safe to re-run)

## Launch Week
1. Edit `data/launches.json` (one entry per tool) and put the maker's images in `public/launches/<slug>/`.
2. `npm run seed:check` validates it, `npm run seed:local` / `npm run seed:remote` load it. Re-seeding updates entries in place and never touches votes; `--prune` also removes launches deleted from the file. Entries with `"sample": true` are placeholders: they are skipped for the live database unless you add `--include-samples`.

Voting opens at 12:01 AM Pacific on each launch's `launch_date`. A visitor gets one upvote per launch for the whole launch week. Visitors are told apart by an HMAC of IP address and user agent, salted with the launch week and `VOTE_SECRET`: only that hash is stored, never the IP or user agent, and there are no cookies. Vote requests are rate limited (20 per 10 minutes per visitor), same-origin and JSON only.

## Local development
    cp .dev.vars.example .dev.vars
    npm run db:schema:local
    npm run seed:local
    npm run dev          # http://127.0.0.1:8788

`npm test` runs the tests (Node 22.5 or newer, no dependencies to install).

## See signups
D1 → openorbia-db → Console:
SELECT * FROM waitlist ORDER BY created_at DESC;
