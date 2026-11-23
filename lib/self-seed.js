// Launch Week data loads itself. The first request under /launches/, /launch/ or /api/ in each Worker isolate checks the
// database and inserts every real launch from data/launches.json that it does not have yet, through the site's own D1
// binding, so going live needs no separate seed step and no Cloudflare login.
//
// Same rules as `npm run seed:remote` (scripts/seed-launches.mjs): the file must pass validateLaunches, samples are never
// loaded, nothing is ever deleted, and votes are never touched. Launches already in the database are left exactly as they
// are, so later edits to an existing launch still go through the Seed launches workflow.

import data from '../data/launches.json' with { type: 'json' };
import { validateLaunches, upsertStatements } from './launch-data.js';

const RETRY_MS = 60_000; // after a failure, try again at most once a minute per isolate

// -> async (db, now) => void. Never throws: a page must still render if loading fails.
export function selfSeeder(launches) {
  let done = launches.length === 0;
  let running = null;
  let failedAt = -Infinity;
  return function ensure(db, now = Date.now()) {
    if (done || !db) return Promise.resolve();
    if (running) return running;
    if (now - failedAt < RETRY_MS) return Promise.resolve();
    const attempt = (async () => {
      try {
        const { results } = await db.prepare('SELECT slug FROM launches').all();
        const have = new Set(results.map(r => r.slug));
        const missing = launches.filter(l => !have.has(l.slug));
        if (missing.length) await db.batch(upsertStatements(db, missing));
        done = true;
      } catch (e) {
        failedAt = now;
        console.error(`Launch self-load failed: ${e && e.message}`);
      }
    })();
    // cleared after the attempt settles (a .finally callback always runs later), even when it failed synchronously
    running = attempt.finally(() => { running = null; });
    return running;
  };
}

// Real launches only, and only when the whole file passes the same checks as the seed script
export function launchesToLoad(file) {
  const { launches, errors } = validateLaunches(file);
  if (errors.length) {
    console.error(`data/launches.json failed its checks, so nothing is loaded: ${errors[0]}`);
    return [];
  }
  return launches.filter(l => !l.sample);
}

export const ensureLaunches = selfSeeder(launchesToLoad(data));

// Pages middleware: load first, then the next handler (the security headers)
export async function loadLaunches(ctx) {
  await ensureLaunches(ctx.env && ctx.env.DB);
  return ctx.next();
}
