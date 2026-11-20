// Launch timing. A launch goes live at 12:00 AM Central time (America/Chicago) on its launch_date (YYYY-MM-DD), and voting
// closes at 11:59 PM Central on the Sunday of that week, whatever the daylight saving offset is, so the UTC instants are computed
// rather than hard-coded. Changed from 12:01 AM Pacific on 2026-11-19 (the founder's choice: launch at midnight Central).

export const LAUNCH_ZONE = 'America/Chicago';
// The words the pages use for those two moments
export const OPENS_AT_TEXT = '12:00 AM Central';
export const CLOSES_AT_TEXT = '11:59 PM Central';

const zoneClock = zone => new Intl.DateTimeFormat('en-US', {
  timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});
const clock = zoneClock(LAUNCH_ZONE);
const pacificClock = zoneClock('America/Los_Angeles');

function parts(fmt, ms) {
  const p = {};
  for (const { type, value } of fmt.formatToParts(ms)) p[type] = value;
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
const launchParts = ms => parts(clock, ms);

// The Pacific calendar day of a UTC instant, as YYYY-MM-DD. Only for the daily click counts (lib/go.js, lib/click.js), which
// have always been grouped by Pacific day; launch times use the Central clock above.
export const pacificDay = ms => parts(pacificClock, ms).slice(0, 10);

// The launch-clock (Central) calendar day of a UTC instant, as YYYY-MM-DD
export const launchDay = ms => launchParts(ms).slice(0, 10);

// UTC milliseconds of 00:00 Central on `date`, or NaN if `date` is not a real YYYY-MM-DD calendar date.
export function launchOpensAt(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date));
  if (!m) return NaN;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // 00:00 is 06:00 UTC in winter (CST, UTC-6) and 05:00 UTC in summer (CDT, UTC-5): keep the one that reads 00:00 Central.
  for (const hour of [6, 5]) {
    const t = Date.UTC(y, mo - 1, d, hour, 0);
    if (launchParts(t) === `${m[1]}-${m[2]}-${m[3]} 00:00`) return t;
  }
  return NaN;
}

// UTC milliseconds of 23:59 Central on the Sunday that ends the launch week: the launch date (a Monday) plus 6 days. Voting is open
// from launchOpensAt(date) until this instant. The "+ 6 days" is calendar arithmetic, never a number of hours, so a week that
// contains a daylight saving change still closes at 11:59 PM on the clock; NaN if `date` is not a real YYYY-MM-DD calendar date.
export function launchClosesAt(date) {
  if (Number.isNaN(launchOpensAt(date))) return NaN;
  const [y, mo, d] = String(date).split('-').map(Number);
  const end = new Date(Date.UTC(y, mo - 1, d + 6));
  const [ey, em, ed] = [end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()];
  const pad = n => String(n).padStart(2, '0');
  // 23:59 is 05:59 UTC the next day in winter (CST, UTC-6) and 04:59 UTC in summer (CDT, UTC-5): keep the one that reads 23:59 Central
  for (const hour of [5, 4]) {
    const t = Date.UTC(ey, em - 1, ed + 1, hour, 59);
    if (launchParts(t) === `${ey}-${pad(em)}-${pad(ed)} 23:59`) return t;
  }
  return NaN;
}

const label = new Intl.DateTimeFormat('en-US', { timeZone: LAUNCH_ZONE, weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

// "Monday, Nov 23, 2026" for a UTC instant, as read on the Central launch clock
export function dayLabel(ms) {
  const p = {};
  for (const { type, value } of label.formatToParts(ms)) p[type] = value;
  return `${p.weekday}, ${p.month} ${p.day}, ${p.year}`;
}

// "Monday, Nov 23, 2026" (the same, for headings and sentences)
export function dayLabelLong(ms) {
  const p = {};
  for (const { type, value } of label.formatToParts(ms)) p[type] = value;
  return `${p.weekday}, ${p.month} ${p.day}, ${p.year}`;
}

// "Coming Monday, Nov 23, 2026"
export const comingLabel = ms => `Coming ${dayLabel(ms)}`;

// The lineup is announced 5 days before launch day (the Wednesday before a Monday launch), which leaves time after the makers'
// deadline the Monday before. Calendar arithmetic, like launchClosesAt, so a daylight saving change can't shift the day.
export const LINEUP_DAYS_BEFORE = 5;
// 12:00 AM Central, `days` calendar days before the launch date
function daysBefore(date, days) {
  if (Number.isNaN(launchOpensAt(date))) return NaN;
  const [y, mo, d] = String(date).split('-').map(Number);
  const day = new Date(Date.UTC(y, mo - 1, d - days));
  const pad = n => String(n).padStart(2, '0');
  return launchOpensAt(`${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`);
}
export const lineupAnnouncedAt = date => daysBefore(date, LINEUP_DAYS_BEFORE);

// Makers send their launch assets (logo, screenshots, story) by the Monday a week before launch day
export const ASSET_DAYS_BEFORE = 7;
export const assetDeadlineAt = date => daysBefore(date, ASSET_DAYS_BEFORE);

// "Wednesday, Nov 18" (no year), for the homepage lineup line
export function weekdayLabel(ms) {
  const p = {};
  for (const { type, value } of label.formatToParts(ms)) p[type] = value;
  return `${p.weekday}, ${p.month} ${p.day}`;
}
