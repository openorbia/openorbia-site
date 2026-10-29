// Reading launches from D1.

import { launchOpensAt } from './time.js';

const COLUMNS = ['slug', 'name', 'tagline', 'description', 'category', 'repo_url', 'website_url', 'logo_url', 'screenshots', 'video_url',
  'maker_name', 'maker_links', 'maker_story', 'license', 'launch_week', 'launch_date'].map(c => `l.${c}`).join(', ');
const WITH_VOTES = `${COLUMNS}, (SELECT COUNT(*) FROM votes v WHERE v.launch_slug = l.slug) AS votes`;

const parseList = s => {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
};

const shape = row => ({
  ...row,
  screenshots: parseList(row.screenshots),
  maker_links: parseList(row.maker_links),
  votes: Number(row.votes || 0),
});

export async function getLaunch(db, slug) {
  const row = await db.prepare(`SELECT ${WITH_VOTES} FROM launches l WHERE l.slug = ?`).bind(slug).first();
  return row ? shape(row) : null;
}

// One launch week, most upvoted first; ties are broken by name so the order never jumps around
export async function listWeek(db, week) {
  const { results } = await db.prepare(
    `SELECT ${WITH_VOTES} FROM launches l WHERE l.launch_week = ? ORDER BY votes DESC, l.name COLLATE NOCASE ASC`
  ).bind(week).all();
  return results.map(shape);
}

// The launch week to show: the latest one that has opened, or else the first upcoming one.
// -> { week, launchDate, opensAt (ms), open } or null when nothing is seeded yet
export async function currentWeek(db, now) {
  const { results } = await db.prepare(
    'SELECT launch_week AS week, MIN(launch_date) AS launch_date FROM launches GROUP BY launch_week ORDER BY launch_week'
  ).all();
  if (!results.length) return null;
  const weeks = results.map(r => ({ week: r.week, launchDate: r.launch_date, opensAt: launchOpensAt(r.launch_date) }));
  const started = weeks.filter(w => now >= w.opensAt);
  const pick = started.length ? started[started.length - 1] : weeks[0];
  return { ...pick, open: now >= pick.opensAt };
}
