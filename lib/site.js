// Facts about Launch Week 1 that are not in the database yet, used by the /launches/ page while nothing is scheduled.
// Change them here and redeploy.

// Launches go live at 12:01 AM Pacific on this date
export const FIRST_LAUNCH_WEEK = { week: 1, date: '2026-11-23' };

// Makers who have confirmed they will launch: shown as a count only, never with names
export const MAKERS_CONFIRMED = 3;

// Makers we have invited to launch, confirmed or not: also a count only
export const MAKERS_INVITED = 26;

// "3 makers confirmed · 26 invited": the line on the homepage week box and on /launches/
export const makersLine = () => `${MAKERS_CONFIRMED} makers confirmed · ${MAKERS_INVITED} invited`;
