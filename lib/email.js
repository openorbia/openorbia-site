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

// Brevo's error body is JSON like {"code":"invalid_parameter","message":"..."}; keep the code and message, minus anything private
function brevoReason(text, { apiKey, to }) {
  let code = '', message = text;
  try { const j = JSON.parse(text); code = j.code || ''; message = j.message || ''; } catch { /* not JSON: use the text */ }
  const clean = String(message).split(to).join('[recipient]').split(apiKey).join('[key]').replace(/\s+/g, ' ').slice(0, 300);
  return `${code ? `code=${code} ` : ''}message="${clean}"`;
}

// -> true when Brevo accepted the email; false otherwise (never throws). Every outcome is logged, never the key or the address.
export async function sendWelcome({ apiKey, to, role, fetchImpl = fetch }) {
  if (!apiKey) { console.error('Welcome email skipped: BREVO_API_KEY is not set for this deployment'); return false; }
  try {
    const { subject, text, html } = welcomeEmail(role);
    console.log(`Welcome email: sending to Brevo (role=${role})`);
    const res = await fetchImpl(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: SENDER, to: [{ email: to }], replyTo: { email: SENDER.email }, subject, htmlContent: html, textContent: text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const reason = brevoReason(await res.text().catch(() => ''), { apiKey, to });
      console.error(`Welcome email failed: Brevo answered HTTP ${res.status} ${reason}`);
      return false;
    }
    console.log(`Welcome email accepted by Brevo: HTTP ${res.status}`);
    return true;
  } catch (e) {
    console.error(`Welcome email failed: ${e && e.name ? e.name : 'error'} while calling Brevo`); // no address, no key, no message text
    return false;
  }
}

// ---- confirmation for the /submit/ and /request/ forms ----

// -> { subject, text, html } for kind 'submit' (name = the tool) or 'request' (name = what they asked for). Plain, no promises about timing.
export function confirmationEmail(kind, name) {
  const what = kind === 'submit'
    ? [`We got your submission of ${name} to OpenOrbia.`, 'We check every tool by hand against its own docs before it is listed, and we will write to you at this address if we need anything.']
    : [`We got your question to OpenOrbia: ${name}`, 'We will look through the Launch List for a free tool that fits, and write to you at this address if we find one.'];
  const footer = "You're getting this because this address was entered on a form at openorbia.com. Reply to this email if it wasn't you.";
  const textBody = `${what.join('\n\n')}\n\n-- \n${footer}\n`;
  const html = `<p>${what.map(esc).join('</p>\n<p>')}</p>\n<p style="color:#6b7280;font-size:13px">${esc(footer)}</p>`;
  return { subject: kind === 'submit' ? 'We got your tool submission' : 'We got your question', text: textBody, html };
}

// -> true when Brevo accepted it; false otherwise (never throws, never logs the address, the key or what was typed).
// Without a BREVO_API_KEY (the preview has none) nothing is sent and nothing fails.
export async function sendFormConfirmation({ apiKey, to, kind, name, fetchImpl = fetch }) {
  if (!apiKey) { console.error(`Form confirmation skipped (${kind}): BREVO_API_KEY is not set for this deployment`); return false; }
  try {
    const { subject, text, html } = confirmationEmail(kind, name);
    const res = await fetchImpl(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: SENDER, to: [{ email: to }], replyTo: { email: SENDER.email }, subject, htmlContent: html, textContent: text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.error(`Form confirmation failed (${kind}): Brevo answered HTTP ${res.status}`); return false; }
    return true;
  } catch (e) {
    console.error(`Form confirmation failed (${kind}): ${e && e.name ? e.name : 'error'} while calling Brevo`);
    return false;
  }
}
