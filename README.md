# openorbia-site

Source for https://openorbia.com: a static site in `public/` plus a waitlist API in `functions/api/waitlist.js` (Cloudflare Pages Functions + D1).

## Deploy
- Cloudflare Pages, connected to this repo
- Build command: (none)
- Build output directory: `public`
- Binding: D1 database `openorbia-db` bound as `DB`
- Run `schema.sql` once in the D1 console

## See signups
D1 → openorbia-db → Console:
SELECT * FROM waitlist ORDER BY created_at DESC;
