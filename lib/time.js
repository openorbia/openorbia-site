// Launch timing. A launch goes live at 12:01 AM Pacific time on its launch_date (YYYY-MM-DD), whatever the daylight
// saving offset is that day, so the UTC instant is computed rather than hard-coded.

const ZONE = 'America/Los_Angeles';

const clock = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

function pacificParts(ms) {
  const p = {};
  for (const { type, value } of clock.formatToParts(ms)) p[type] = value;
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

// The Pacific calendar day of a UTC instant, as YYYY-MM-DD
export const pacificDay = ms => pacificParts(ms).slice(0, 10);

// UTC milliseconds of 00:01 Pacific on `date`, or NaN if `date` is not a real YYYY-MM-DD calendar date.
export function launchOpensAt(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date));
  if (!m) return NaN;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // 00:01 is 08:01 UTC in winter (PST, UTC-8) and 07:01 UTC in summer (PDT, UTC-7): keep the one that reads 00:01 Pacific.
  for (const hour of [8, 7]) {
    const t = Date.UTC(y, mo - 1, d, hour, 1);
    if (pacificParts(t) === `${m[1]}-${m[2]}-${m[3]} 00:01`) return t;
  }
  return NaN;
}

// UTC milliseconds of 23:59 Pacific on the Sunday that ends the launch week: the launch date (a Monday) plus 6 days. Voting is open
// from launchOpensAt(date) until this instant. The "+ 6 days" is calendar arithmetic, never a number of hours, so a week that
// contains a daylight saving change still closes at 11:59 PM on the clock; NaN if `date` is not a real YYYY-MM-DD calendar date.
export function launchClosesAt(date) {
  if (Number.isNaN(launchOpensAt(date))) return NaN;
  const [y, mo, d] = String(date).split('-').map(Number);
  const end = new Date(Date.UTC(y, mo - 1, d + 6));
  const [ey, em, ed] = [end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()];
  const pad = n => String(n).padStart(2, '0');
  // 23:59 is 07:59 UTC the next day in winter (PST, UTC-8) and 06:59 UTC in summer (PDT, UTC-7): keep the one that reads 23:59 Pacific
  for (const hour of [7, 6]) {
    const t = Date.UTC(ey, em - 1, ed + 1, hour, 59);
    if (pacificParts(t) === `${ey}-${pad(em)}-${pad(ed)} 23:59`) return t;
  }
  return NaN;
}

const label = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'long', month: 'short', day: 'numeric' });

// "Monday Nov 23" for a UTC instant, as read on the Pacific clock
export function dayLabel(ms) {
  const p = {};
  for (const { type, value } of label.formatToParts(ms)) p[type] = value;
  return `${p.weekday} ${p.month} ${p.day}`;
}

// "Monday, Nov 23" (with the comma, for headings and sentences)
export function dayLabelLong(ms) {
  const p = {};
  for (const { type, value } of label.formatToParts(ms)) p[type] = value;
  return `${p.weekday}, ${p.month} ${p.day}`;
}

// "Coming Monday Nov 23"
export const comingLabel = ms => `Coming ${dayLabel(ms)}`;
