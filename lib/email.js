// The welcome email for new waitlist signups, sent through Brevo's transactional email API (https://developers.brevo.com).
// Needs the Pages secret BREVO_API_KEY and a verified sender launch@openorbia.com in Brevo. Sending never throws:
// a failed email is logged (without the address) and the signup still succeeds.

import { esc } from './html.js';
import { FIRST_LAUNCH_WEEK } from './site.js';
import { launchOpensAt, dayLabelLong } from './time.js';

export const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
export const SENDER = { name: 'OpenOrbia', email: 'launch@openorbia.com' };
const MAKERS_URL = 'https://openorbia.com/makers/';
const SUBJECT = "You're on the OpenOrbia waitlist";
const FOOTER = "You're getting this because you joined the waitlist at openorbia.com. Reply to this email if it wasn't you.";

// -> { subject, text, html } for a "maker" or a "reader"
export function welcomeEmail(role) {
  const ms = launchOpensAt(FIRST_LAUNCH_WEEK.date);
  const long = Number.isNaN(ms) ? 'soon' : dayLabelLong(ms);          // "Monday, Nov 23"
  const short = Number.isNaN(ms) ? 'soon' : long.split(', ')[1];      // "Nov 23"
  const week = `Launch Week ${FIRST_LAUNCH_WEEK.week}`;
  const lines = role === 'maker'
    ? [`You're on the OpenOrbia waitlist. ${week} is ${long}.`, `Want to launch your tool? Here's how: ${MAKERS_URL}`]
    : [`You're on the list. We'll email you when ${week} goes live on ${short}.`];
  const text = `${lines.join('\n\n')}\n\n-- \n${FOOTER}\n`;
  const htmlLines = lines.map(l => esc(l).replace(MAKERS_URL, `<a href="${MAKERS_URL}">${MAKERS_URL}</a>`));
  const html = `<p>${htmlLines.join('</p>\n<p>')}</p>\n<p style="color:#6b7280;font-size:13px">${esc(FOOTER)}</p>`;
  return { subject: SUBJECT, text, html };
}

// -> true when Brevo accepted the email; false otherwise (never throws)
export async function sendWelcome({ apiKey, to, role, fetchImpl = fetch }) {
  if (!apiKey) return false; // not configured yet: signups work, no email
  try {
    const { subject, text, html } = welcomeEmail(role);
    const res = await fetchImpl(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: SENDER, to: [{ email: to }], replyTo: { email: SENDER.email }, subject, htmlContent: html, textContent: text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.error(`Welcome email failed: Brevo answered ${res.status}`); return false; }
    return true;
  } catch (e) {
    console.error(`Welcome email failed: ${e && e.name ? e.name : 'error'}`); // no address, no key, no message text
    return false;
  }
}
