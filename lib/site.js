// Facts about Launch Week 1 that are not in the database yet, used by the /launches/ page while nothing is scheduled.
// Change them here and redeploy.

// Launches go live at 12:00 AM Central on this date
export const FIRST_LAUNCH_WEEK = { week: 1, date: '2026-11-23' };

// Makers who have confirmed they will launch: a count only, never with names. Not shown on the site since 2026-11-19
// (the founder removed the line); scripts/launch-check.mjs compares it with the real launches.
export const MAKERS_CONFIRMED = 3;

// Makers we have invited to launch, confirmed or not: also a count only, not shown on the site
export const MAKERS_INVITED = 26;

