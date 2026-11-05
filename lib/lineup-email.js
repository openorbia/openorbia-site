// The "Launch Week <n> lineup" email, sent to the waitlist the week before a launch week (scripts/send-lineup.mjs).
// Same design as the welcome email (emailShell in lib/email.js). Built only from the launches in the database, grouped by category;
// launch day and the voting close come from lib/time.js. Every copy carries that signup's own unsubscribe link (and the script sends the
// one-click headers with it), and the footer carries the postal address from POSTAL_ADDRESS (CAN-SPAM), so it can't be built without one.

import { esc, CATEGORY_COLORS } from './html.js';
import { CATEGORIES } from './launch-data.js';
import { launchOpensAt, launchClosesAt, dayLabelLong } from './time.js';
import { emailShell, emailP, EMAIL_STYLE } from './email.js';

const { FONT, PURPLE, CYAN, INK, MUTED, SITE } = EMAIL_STYLE;
export const POSTAL_MAX = 200;

export const launchLink = slug => `${SITE}/launch/${encodeURIComponent(slug)}/`;

// -> the postal address as one trimmed line ("123 Main St, City, ST 12345, USA"), or '' when it is missing or not a usable value
export function cleanPostal(v) {
  const t = String(v ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).join(', ').replace(/\s+/g, ' ').trim();
  return t.length >= 10 && t.length <= POSTAL_MAX ? t : '';
}

// The launch week's dates, from the launches' own launch_date (they share one; the earliest wins if not)
export function lineupDates(launches) {
  const date = launches.map(l => l.launch_date).sort()[0];
  const opens = launchOpensAt(date), closes = launchClosesAt(date);
  if (Number.isNaN(opens) || Number.isNaN(closes)) throw new Error('The launches have no valid launch_date.');
  const day = dayLabelLong(opens);                     // e.g. "Monday, <Mon> <d>, <yyyy>"
  return { week: launches[0].launch_week, date, day, short: day.split(', ')[1], closes: dayLabelLong(closes) };
}

// Launches by category, in the site's category order, each group sorted by name
export function groupByCategory(launches) {
  return Object.keys(CATEGORIES)
    .map(key => ({ key, name: CATEGORIES[key], items: launches.filter(l => l.category === key).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })) }))
    .filter(g => g.items.length);
}

// -> { subject, preview, text, html }. `unsubscribeUrl` is this signup's own link (required); `postalAddress` is required too.
export function lineupEmail(launches, { unsubscribeUrl, postalAddress }) {
  if (!Array.isArray(launches) || !launches.length) throw new Error('No launches to put in the lineup.');
  if (!/^https:\/\/openorbia\.com\/unsubscribe\/\?id=\d+&t=[0-9a-f]{32}$/.test(String(unsubscribeUrl))) throw new Error('Each lineup email needs its own unsubscribe link.');
  const postal = cleanPostal(postalAddress);
  if (!postal) throw new Error('POSTAL_ADDRESS is not set: every marketing email must carry a postal address (CAN-SPAM).');

  const d = lineupDates(launches);
  const groups = groupByCategory(launches);
  const n = launches.length;
  const tools = `${n} free AI tool${n === 1 ? '' : 's'}`;
  const subject = `Launch Week ${d.week} lineup: ${tools} on ${d.short}`;
  const preview = `What launches ${d.day}, by category. Voting closes ${d.closes} at 11:59 PM Pacific.`;
  const intro = `Launch Week ${d.week} starts ${d.day}, at 12:01 AM Pacific. Here are the ${tools} launching, by category. Each launch page shows what’s free, what it needs and the catch.`;
  const vote = `Upvote the tools you’d use, one upvote per launch. Voting closes ${d.closes}, at 11:59 PM Pacific, and the results go up after that.`;
  const footerLine = 'You’re getting this because you joined the OpenOrbia waitlist at openorbia.com.';

  const text = [
    `Launch Week ${d.week} lineup`,
    `Launch Week ${d.week} · ${d.day}`,
    '',
    intro,
    '',
    ...groups.flatMap(g => [g.name, ...g.items.map(l => `* ${l.name}: ${l.tagline}\n  ${launchLink(l.slug)}`), '']),
    vote,
    '',
    `See all the launches: ${SITE}/launches/`,
    '',
    'Khaja, founder of OpenOrbia',
    '',
    '--',
    footerLine,
    `Unsubscribe: ${unsubscribeUrl}`,
    `OpenOrbia, ${postal}`,
    '',
  ].join('\n');

  const item = l => `<tr><td style="padding:0 0 14px">
            <a href="${esc(launchLink(l.slug))}" style="font:700 16px/22px ${FONT};color:${PURPLE};text-decoration:none">${esc(l.name)}</a>
            <p class="oo-muted" style="margin:2px 0 0;font:15px/22px ${FONT};color:${MUTED}">${esc(l.tagline)}</p>
          </td></tr>`;
  const group = g => {
    const [c1] = CATEGORY_COLORS[g.key] || [PURPLE];
    return `<p class="oo-text" style="margin:18px 0 12px;font:700 13px/18px ${FONT};letter-spacing:0.6px;text-transform:uppercase;color:${INK}"><span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${c1};margin-right:8px"></span>${esc(g.name)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${g.items.map(item).join('\n          ')}
        </table>`;
  };

  const html = emailShell({
    title: subject, preview, heading: 'Here’s the lineup.', badge: `Launch Week ${d.week} · ${d.day}`,
    body: `        ${emailP(esc(intro))}
        ${groups.map(group).join('\n        ')}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 22px"><tr><td class="oo-card-bg" bgcolor="#f4f2fe" style="background:#f4f2fe;border:1px solid #e4defc;border-radius:12px;padding:14px 16px">
          <p class="oo-text" style="margin:0;font:15px/22px ${FONT};color:${INK}">${esc(vote)}</p>
        </td></tr></table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px"><tr><td bgcolor="${PURPLE}" style="border-radius:10px;background:${PURPLE}">
          <a href="${SITE}/launches/" style="display:inline-block;padding:14px 28px;font:700 16px/20px ${FONT};color:#ffffff;text-decoration:none;border-radius:10px">See all the launches</a>
        </td></tr></table>
        ${emailP('Khaja, founder of OpenOrbia', 'margin:0;font-weight:600')}
`,
    footer: `        ${esc(footerLine).replace('openorbia.com.', `<a href="${SITE}/" style="color:#ffffff;text-decoration:none">openorbia.com</a>.`)}<br>
        <a href="${esc(unsubscribeUrl)}" style="color:${CYAN};text-decoration:underline">Unsubscribe</a><br>
        OpenOrbia, ${esc(postal)}
`,
  });
  return { subject, preview, text, html };
}

// The one-click unsubscribe headers (RFC 8058), the same as the welcome email's
export const unsubscribeHeaders = url => ({ 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });

