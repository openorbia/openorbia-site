// The voting window: the one source of truth for when a launch week opens and closes, and for every word the site uses to say so.
//
// A launch week opens at 12:00 AM on its launch date (a Monday) and closes at 11:59 PM on the Sunday six days later, on the clock
// of VOTING_ZONE (an IANA zone, so daylight saving is handled by the time zone database, not by fixed offsets). The founder chose
// Central on 2026-11-19 (it was 12:01 AM Pacific before) and confirmed it on 2026-11-25.
//
// The instants are exactly what lib/vote.js enforces (lib/time.js computes them; this file reads them). Every label ("12:00 AM", "Sunday",
// "Central") is produced by formatting those same instants with Intl.DateTimeFormat in VOTING_ZONE, so the text on a page can
// never disagree with what is enforced. No dependencies.

import { FIRST_LAUNCH_WEEK } from './site.js';
// The enforcement itself stays in lib/time.js, unchanged (lib/vote.js calls launchOpensAt/launchClosesAt): this module only reads
// those instants and words them, so the wording and the enforcement come from the same calculation
import { LAUNCH_ZONE, launchOpensAt, launchClosesAt } from './time.js';

export const VOTING_ZONE = LAUNCH_ZONE;

// UTC milliseconds when voting opens and closes for the launch week starting on `monday` (YYYY-MM-DD); NaN for a bad date
export const opensAt = monday => launchOpensAt(monday);
export const closesAt = monday => launchClosesAt(monday);

// ---- labels, all read off the instants above ----

const clean = s => s.replace(/\s+/g, ' ').trim();   // some ICU versions put a narrow no-break space before AM/PM
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: VOTING_ZONE, hour: 'numeric', minute: '2-digit', hour12: true });
const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: VOTING_ZONE, weekday: 'long' });
const zoneFmt = new Intl.DateTimeFormat('en-US', { timeZone: VOTING_ZONE, timeZoneName: 'longGeneric' });

// "12:00 AM", "Monday", "Central" for an instant, on the launch clock
export const timeLabel = ms => clean(timeFmt.format(ms));
export const weekdayName = ms => dayFmt.format(ms);
export const zoneLabel = (ms = Date.UTC(2026, 0, 1)) =>
  clean(zoneFmt.formatToParts(ms).find(p => p.type === 'timeZoneName').value).replace(/ Time$/, '');

// Every week opens and closes at the same clock times, so the general wording is read off Launch Week 1
const REF = FIRST_LAUNCH_WEEK.date;

// "12:00 AM Central" and "11:59 PM Central"
export const opensText = (monday = REF) => `${timeLabel(opensAt(monday))} ${zoneLabel(opensAt(monday))}`;
export const closesText = (monday = REF) => `${timeLabel(closesAt(monday))} ${zoneLabel(closesAt(monday))}`;
// "Monday" and "Sunday"
export const opensDay = (monday = REF) => weekdayName(opensAt(monday));
export const closesDay = (monday = REF) => weekdayName(closesAt(monday));

// "Monday at 12:00 AM Central" / "Sunday at 11:59 PM Central"
export const opensPhrase = (monday = REF) => `${opensDay(monday)} at ${opensText(monday)}`;
export const closesPhrase = (monday = REF) => `${closesDay(monday)} at ${closesText(monday)}`;
// "Monday 12:00 AM to Sunday 11:59 PM Central"
export const windowRange = (monday = REF) =>
  `${opensDay(monday)} ${timeLabel(opensAt(monday))} to ${closesDay(monday)} ${timeLabel(closesAt(monday))} ${zoneLabel(closesAt(monday))}`;
// "Voting opens Monday at 12:00 AM Central and closes Sunday at 11:59 PM Central."
export const windowSentence = (monday = REF) => `Voting opens ${opensPhrase(monday)} and closes ${closesPhrase(monday)}.`;

// The launch curtain's meta value (lib/layout.js, the static pages through build:home): the opening instant of Launch Week 1
export const launchMetaContent = (monday = REF) => new Date(opensAt(monday)).toISOString();
