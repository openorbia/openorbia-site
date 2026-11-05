// The emails OpenOrbia sends through Brevo's transactional email API (https://developers.brevo.com): the waitlist welcome email and
// the /submit/ and /request/ confirmations.
// Needs the Pages secret BREVO_API_KEY and a verified sender launch@openorbia.com in Brevo. Sending never throws:
// a failed email is logged (without the address) and the signup still succeeds.

import { esc } from './html.js';
import { FIRST_LAUNCH_WEEK } from './site.js';
import { launchOpensAt, dayLabelLong } from './time.js';

export const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
export const SENDER = { name: 'OpenOrbia', email: 'launch@openorbia.com' };
// ---- the waitlist welcome email ----
//
// Email-safe on purpose: tables, inline styles, system fonts, no scripts and no web fonts. The header's stars and orbit are one hosted
// PNG (public/email/header.png, made by scripts/build-email-art.mjs) over a solid navy cell, so it still reads when images are blocked.
// The purple-to-cyan line is a solid purple cell with the gradient on top for the clients that draw it. The three cards are table
// cells that stack on phones (the media query), and the dark-mode rules keep the body readable in clients that honour them; clients
// that invert colours themselves (Gmail's apps) keep the navy header and footer dark and the text dark-on-light or light-on-dark.

const SITE = 'https://openorbia.com';
export const WELCOME_SUBJECT = 'You’re in. OpenOrbia launches Nov 23';
export const WELCOME_PREVIEW = 'Free AI tools, with the catch spelled out.';
export const EMAIL_ART = `${SITE}/email/header.png`;
const LOGO = `${SITE}/icon-512.png`;
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const NAVY = '#0b1026', PURPLE = '#6d28d9', VIOLET = '#8b5cf6', CYAN = '#22d3ee', INK = '#1f2433', MUTED = '#5b6280';

// The three things every listing shows, and what the next emails are (the founder's plan, 2026-11-03)
const CARDS = [
  ['What’s free', 'The real free limits, not the marketing line.'],
  ['What it needs', 'Accounts, hardware, models or paid keys it depends on.'],
  ['The catch', 'The biggest limit or trade-off, stated up front.'],
];
const nextSteps = launch => [
  `The week before ${launch.short}: the Launch Week ${launch.week} lineup.`,
  `${launch.long}: launch day. Vote for the tools you like; voting closes that Sunday at 11:59 PM Pacific.`,
  'After that: at most one email a week with new free tools.',
];

function launchDates() {
  const ms = launchOpensAt(FIRST_LAUNCH_WEEK.date);
  const long = Number.isNaN(ms) ? 'Launch day' : dayLabelLong(ms);                 // "Monday, Nov 23, 2026"
  return { week: FIRST_LAUNCH_WEEK.week, long, short: long.split(', ')[1] || long, badge: `Launch Week ${FIRST_LAUNCH_WEEK.week} · ${long}` };
}

// -> { subject, preview, text, html }. `unsubscribeUrl` is this signup's own link (lib/unsubscribe.js); without one (no server
// secret, for example in local development) the footer asks the reader to reply instead.
export function welcomeEmail(role, { unsubscribeUrl = '' } = {}) {
  const launch = launchDates();
  const steps = nextSteps(launch);
  const intro = 'Thanks for joining. OpenOrbia lists free and open-source AI tools, and checks each one against its official docs, so you know three things before you install anything:';
  const unsub = unsubscribeUrl
    ? { text: `Unsubscribe: ${unsubscribeUrl}`, html: `<a href="${esc(unsubscribeUrl)}" style="color:${CYAN};text-decoration:underline">Unsubscribe</a>` }
    : { text: 'To unsubscribe, reply to this email.', html: 'To unsubscribe, reply to this email.' };

  const text = [
    'You’re on the list.',
    launch.badge,
    '',
    intro,
    '',
    ...CARDS.map(([t, d]) => `* ${t}: ${d}`),
    '',
    'What happens next',
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    `Browse the tools: ${SITE}/`,
    '',
    `Building a free AI tool? Launch it on OpenOrbia, free: ${SITE}/makers/`,
    '',
    'Khaja, founder of OpenOrbia',
    '',
    'P.S. Hit reply and tell me which task you want a free AI tool for. Your answer shapes the next launches.',
    '',
    '--',
    'You’re getting this because you joined the OpenOrbia waitlist at openorbia.com.',
    unsub.text,
    '',
  ].join('\n');

  const p = (s, extra = '') => `<p class="oo-text" style="margin:0 0 16px;font:16px/26px ${FONT};color:${INK};${extra}">${s}</p>`;
  // each card is a table cell, so the three share one height; spacer cells between them hide on phones, where the cards stack
  const card = ([t, d]) => `<td class="oo-card oo-card-bg" valign="top" width="32%" bgcolor="#f4f2fe" style="background:#f4f2fe;border:1px solid #e4defc;border-radius:12px;padding:14px 14px 16px">
          <p class="oo-text" style="margin:0 0 6px;font:700 15px/20px ${FONT};color:${INK}">${esc(t)}</p>
          <p class="oo-muted" style="margin:0;font:14px/20px ${FONT};color:${MUTED}">${esc(d)}</p>
        </td>`;
  const gap = '<td class="oo-gap" width="2%" style="font-size:0;line-height:0">&nbsp;</td>';
  const step = (s, i) => `<tr>
            <td valign="top" width="34" style="padding:0 12px 14px 0"><div style="width:28px;height:28px;border-radius:14px;background:${VIOLET};color:#ffffff;font:700 14px/28px ${FONT};text-align:center">${i + 1}</div></td>
            <td valign="top" class="oo-text" style="padding:3px 0 14px;font:16px/24px ${FONT};color:${INK}">${esc(s)}</td>
          </tr>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(WELCOME_SUBJECT)}</title>
<style>
  body{margin:0;padding:0;width:100%;-webkit-text-size-adjust:100%}
  @media (max-width:620px){
    .oo-wrap{width:100%!important}
    .oo-px{padding-left:22px!important;padding-right:22px!important}
    .oo-h1{font-size:32px!important;line-height:38px!important}
    .oo-card{display:block!important;width:100%!important;box-sizing:border-box;margin:0 0 10px!important}
    .oo-gap{display:none!important}
  }
  @media (prefers-color-scheme:dark){
    .oo-page{background:#060918!important}
    .oo-body{background:#11162e!important}
    .oo-text{color:#e8ebf7!important}
    .oo-muted{color:#b3bad4!important}
    .oo-card-bg{background:#1a2042!important;border-color:#2c3466!important}
  }
</style>
</head>
<body class="oo-page" style="margin:0;padding:0;background:#eef0f7">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${esc(WELCOME_PREVIEW)}${'&#8199;&#65279;&#847; '.repeat(40)}</div>
<table role="presentation" class="oo-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef0f7" style="background:#eef0f7">
  <tr><td align="center" style="padding:24px 12px">
    <table role="presentation" class="oo-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">
      <tr><td class="oo-px" bgcolor="${NAVY}" background="${EMAIL_ART}" style="background:${NAVY} url('${EMAIL_ART}') center top / cover no-repeat;border-radius:16px 16px 0 0;padding:28px 36px 34px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle" style="padding-right:10px"><img src="${LOGO}" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px"></td>
          <td valign="middle" style="font:800 20px/24px ${FONT};color:#ffffff;letter-spacing:-0.3px">OpenOrbia</td>
        </tr></table>
        <h1 class="oo-h1" style="margin:30px 0 18px;font:800 40px/46px ${FONT};color:#ffffff;letter-spacing:-0.5px">You’re on the list.</h1>
        <span style="display:inline-block;padding:7px 13px;border:1px solid ${CYAN};border-radius:999px;background:#0d2633;font:600 12px/16px ${MONO};letter-spacing:0.6px;text-transform:uppercase;color:${CYAN}">${esc(launch.badge)}</span>
      </td></tr>
      <tr><td height="4" bgcolor="${VIOLET}" style="height:4px;line-height:4px;font-size:0;background:${VIOLET};background-image:linear-gradient(90deg,${VIOLET},${CYAN})">&nbsp;</td></tr>
      <tr><td class="oo-px oo-body" bgcolor="#ffffff" style="background:#ffffff;padding:32px 36px 28px">
        ${p(esc(intro))}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 14px"><tr>
        ${CARDS.map(card).join(`\n        ${gap}\n        `)}
        </tr></table>
        <p class="oo-text" style="margin:8px 0 14px;font:700 18px/24px ${FONT};color:${INK}">What happens next</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${steps.map(step).join('\n          ')}
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 26px"><tr><td bgcolor="${PURPLE}" style="border-radius:10px;background:${PURPLE}">
          <a href="${SITE}/" style="display:inline-block;padding:14px 28px;font:700 16px/20px ${FONT};color:#ffffff;text-decoration:none;border-radius:10px">Browse the tools</a>
        </td></tr></table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px"><tr><td bgcolor="${NAVY}" style="background:${NAVY};border-radius:12px;padding:18px 20px">
          <a href="${SITE}/makers/" style="font:15px/22px ${FONT};color:#ffffff;text-decoration:none"><b>Building a free AI tool?</b> Launch it on OpenOrbia, free <span style="color:${CYAN}">&rarr;</span></a>
        </td></tr></table>
        ${p('Khaja, founder of OpenOrbia', 'margin:0 0 18px;font-weight:600')}
        ${p('<b>P.S.</b> Hit reply and tell me which task you want a free AI tool for. Your answer shapes the next launches.', `margin:0;color:${MUTED}`)}
      </td></tr>
      <tr><td class="oo-px" bgcolor="${NAVY}" style="background:${NAVY};border-radius:0 0 16px 16px;padding:22px 36px 24px;font:12px/19px ${FONT};color:#a9b2d4">
        You’re getting this because you joined the OpenOrbia waitlist at <a href="${SITE}/" style="color:#ffffff;text-decoration:none">openorbia.com</a>.<br>
        ${unsub.html}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`;
  return { subject: WELCOME_SUBJECT, preview: WELCOME_PREVIEW, text, html };
}

// Brevo's error body is JSON like {"code":"invalid_parameter","message":"..."}; keep the code and message, minus anything private
function brevoReason(text, { apiKey, to }) {
  let code = '', message = text;
  try { const j = JSON.parse(text); code = j.code || ''; message = j.message || ''; } catch { /* not JSON: use the text */ }
  const clean = String(message).split(to).join('[recipient]').split(apiKey).join('[key]').replace(/\s+/g, ' ').slice(0, 300);
  return `${code ? `code=${code} ` : ''}message="${clean}"`;
}

// -> true when Brevo accepted the email; false otherwise (never throws). Every outcome is logged, never the key or the address.
export async function sendWelcome({ apiKey, to, role, unsubscribeUrl = '', fetchImpl = fetch }) {
  if (!apiKey) { console.error('Welcome email skipped: BREVO_API_KEY is not set for this deployment'); return false; }
  try {
    const { subject, text, html } = welcomeEmail(role, { unsubscribeUrl });
    const headers = unsubscribeUrl ? { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined;
    console.log(`Welcome email: sending to Brevo (role=${role})`);
    const res = await fetchImpl(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: SENDER, to: [{ email: to }], replyTo: { email: SENDER.email }, subject, htmlContent: html, textContent: text, ...(headers ? { headers } : {}) }),
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
