// What `npm run email:lineup` does (scripts/send-lineup.mjs is only the command line around it). Kept here, with the database, the
// network, the clock and the log passed in, so test/lineup-email.test.js can run every mode without sending anything.
//
//   (default) --dry-run        count the recipients and write one sample email to a local file; sends nothing
//   --test <address>           send one copy marked "[Test]", with a sample unsubscribe link, to that address
//   --send --yes               send to the whole waitlist, in small batches through Brevo
//   --week <n>                 which launch week (default: the first, lib/site.js)
//
// Sending (--test or --send) refuses without POSTAL_ADDRESS (CAN-SPAM) and BREVO_API_KEY; --send also needs UNSUBSCRIBE_SECRET, the same
// secret the site uses to check unsubscribe links, and checks it against the live site first. Every email carries that signup's own
// unsubscribe link and the one-click headers. Before each batch the script asks the database which of those signups are still there:
// unsubscribing deletes the row, so anyone who unsubscribed since the start is skipped. The ids already sent are kept in a local file
// (outside the repository's history), so a run that stops can be started again without sending anyone a second copy.
// The log shows counts only: never an address, the key or the secret.

import { lineupEmail, cleanPostal, unsubscribeHeaders } from './lineup-email.js';
import { unsubscribeUrl } from './unsubscribe.js';
import { BREVO_URL, SENDER } from './email.js';
import { FIRST_LAUNCH_WEEK } from './site.js';

export const BATCH_SIZE = 20;
export const BATCH_PAUSE_MS = 1500;
export const SAMPLE_UNSUBSCRIBE = `https://openorbia.com/unsubscribe/?id=0&t=${'0'.repeat(32)}`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseArgs(argv) {
  const a = [...argv];
  const has = f => a.includes(f);
  const val = f => (has(f) ? a[a.indexOf(f) + 1] : undefined);
  const week = has('--week') ? Number(val('--week')) : FIRST_LAUNCH_WEEK.week;
  const mode = has('--send') ? 'send' : has('--test') ? 'test' : 'dry-run';
  if ([has('--send'), has('--test'), has('--dry-run')].filter(Boolean).length > 1) return { error: 'Choose one of --dry-run, --test <address> or --send.' };
  if (!Number.isInteger(week) || week < 1 || week > 999) return { error: '--week must be a launch week number, like 1.' };
  return { mode, week, yes: has('--yes'), to: val('--test'), out: val('--out') };
}

// Brevo's error, minus anything private
const reason = (text, secrets) => {
  let s = String(text || '');
  try { const j = JSON.parse(s); s = `${j.code ? `code=${j.code} ` : ''}${j.message || ''}`; } catch { /* plain text */ }
  for (const x of secrets) if (x) s = s.split(x).join('[hidden]');
  return s.replace(/[^\s@]+@[^\s@]+/g, '[address]').replace(/\s+/g, ' ').slice(0, 200);
};

async function brevo({ fetchImpl, apiKey, to, email, url, subjectPrefix = '' }) {
  return fetchImpl(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: SENDER, to: [{ email: to }], replyTo: { email: SENDER.email }, subject: subjectPrefix + email.subject,
      htmlContent: email.html, textContent: email.text, headers: unsubscribeHeaders(url),
    }),
    signal: AbortSignal.timeout(15000),
  });
}

// -> exit code. `db` = { launches(week), recipients(), stillSubscribed(ids) -> Set of ids }; `ledger` = { read() -> Set, add(ids) };
// `out` = { write(name, text) -> path }; `log`/`err` print one line each.
export async function runLineup({ argv, env, db, fetchImpl, ledger, out, log, err, sleep = ms => new Promise(r => setTimeout(r, ms)) }) {
  const opts = parseArgs(argv);
  if (opts.error) { err(opts.error); return 2; }
  const postal = cleanPostal(env.POSTAL_ADDRESS);

  let launches;
  try { launches = await db.launches(opts.week); } catch { err('Could not read the launches from the database (is wrangler logged in?).'); return 1; }
  if (!launches.length) { err(`No launches in Launch Week ${opts.week} in the database, so there is no lineup to send.`); return 1; }

  // ---- dry run: count, and write one sample to a local file ----
  if (opts.mode === 'dry-run') {
    let recipients;
    try { recipients = await db.recipients(); } catch { err('Could not read the waitlist from the database (is wrangler logged in?).'); return 1; }
    const sample = lineupEmail(launches, { unsubscribeUrl: SAMPLE_UNSUBSCRIBE, postalAddress: postal || 'POSTAL_ADDRESS is not set: 123 Example Street, City' });
    const html = out.write(`lineup-week-${opts.week}-sample.html`, sample.html);
    out.write(`lineup-week-${opts.week}-sample.txt`, `Subject: ${sample.subject}\nPreview: ${sample.preview}\n\n${sample.text}`);
    const done = ledger.read(opts.week);
    log(`Dry run, Launch Week ${opts.week}: ${launches.length} launches; ${recipients.length} signups on the waitlist${done.size ? `, ${done.size} already sent in an earlier run` : ''}.`);
    log(`Subject: ${sample.subject}`);
    log(`Sample written to ${html} (and .txt). Nothing was sent.`);
    if (!postal) log('POSTAL_ADDRESS is not set: --test and --send will refuse until it is (CAN-SPAM). The sample shows a placeholder.');
    return 0;
  }

  // ---- everything below sends ----
  if (!postal) { err('Not sent: POSTAL_ADDRESS is not set. Every marketing email must carry a valid postal address (CAN-SPAM), so set POSTAL_ADDRESS first.'); return 2; }
  if (!env.BREVO_API_KEY) { err('Not sent: BREVO_API_KEY is not set.'); return 2; }
  const secrets = [env.BREVO_API_KEY, env.UNSUBSCRIBE_SECRET];

  if (opts.mode === 'test') {
    if (!opts.to || !EMAIL_RE.test(opts.to)) { err('Give the address for the test: npm run email:lineup -- --test you@example.com'); return 2; }
    const email = lineupEmail(launches, { unsubscribeUrl: SAMPLE_UNSUBSCRIBE, postalAddress: postal });
    const res = await brevo({ fetchImpl, apiKey: env.BREVO_API_KEY, to: opts.to, email, url: SAMPLE_UNSUBSCRIBE, subjectPrefix: '[Test] ' }).catch(e => ({ ok: false, status: e.name, text: async () => '' }));
    if (!res.ok) { err(`Test not sent: Brevo answered ${res.status}. ${reason(await res.text().catch(() => ''), secrets)}`); return 1; }
    log(`Test sent: Brevo accepted it (HTTP ${res.status}). Look for "[Test] ${email.subject}". Its unsubscribe link is a sample.`);
    return 0;
  }

  // --send
  if (!opts.yes) { err('Not sent: --send also needs --yes. Run the dry run first, then: npm run email:lineup -- --send --yes'); return 2; }
  if (!env.UNSUBSCRIBE_SECRET) { err('Not sent: UNSUBSCRIBE_SECRET is not set (the secret that signs unsubscribe links).'); return 2; }

  let recipients;
  try { recipients = await db.recipients(); } catch { err('Could not read the waitlist from the database (is wrangler logged in?).'); return 1; }
  const done = ledger.read(opts.week);
  const todo = recipients.filter(r => !done.has(r.id));
  log(`Launch Week ${opts.week}: ${launches.length} launches; ${recipients.length} signups; ${recipients.length - todo.length} already sent; ${todo.length} to send.`);
  if (!todo.length) { log('Nothing to send.'); return 0; }

  // The unsubscribe links must work: ask the live site about the first one. A GET only shows the confirm page; it changes nothing.
  const check = await fetchImpl(await unsubscribeUrl(env.UNSUBSCRIBE_SECRET, todo[0].id), { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15000) }).catch(() => ({ status: 0 }));
  if (check.status !== 200) { err(`Not sent: the live site did not accept an unsubscribe link made with this UNSUBSCRIBE_SECRET (HTTP ${check.status}). Check the secret.`); return 2; }

  const count = { sent: 0, failed: 0, unsubscribed: 0 };
  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);
    let still;
    try { still = await db.stillSubscribed(batch.map(r => r.id)); } catch { err('Stopped: could not re-check the waitlist. Run the same command again to continue.'); break; }
    const sentIds = [];
    for (const r of batch) {
      if (!still.has(r.id)) { count.unsubscribed++; continue; }
      const url = await unsubscribeUrl(env.UNSUBSCRIBE_SECRET, r.id);
      const email = lineupEmail(launches, { unsubscribeUrl: url, postalAddress: postal });
      const res = await brevo({ fetchImpl, apiKey: env.BREVO_API_KEY, to: r.email, email, url }).catch(e => ({ ok: false, status: e.name, text: async () => '' }));
      if (res.ok) { count.sent++; sentIds.push(r.id); continue; }
      count.failed++;
      const why = reason(await res.text().catch(() => ''), [...secrets, r.email]);
      if (res.status === 401 || res.status === 403) { ledger.add(opts.week, sentIds); err(`Stopped: Brevo refused the key (HTTP ${res.status}). ${why}`); log(`Sent ${count.sent}, failed ${count.failed}, skipped (unsubscribed) ${count.unsubscribed}.`); return 1; }
      err(`One email failed: Brevo answered ${res.status}. ${why}`);
    }
    ledger.add(opts.week, sentIds);
    log(`Batch ${i / BATCH_SIZE + 1}: sent ${count.sent} so far, failed ${count.failed}, skipped (unsubscribed) ${count.unsubscribed}.`);
    if (i + BATCH_SIZE < todo.length) await sleep(BATCH_PAUSE_MS);
  }
  log(`Done. Sent ${count.sent}, failed ${count.failed}, skipped (unsubscribed) ${count.unsubscribed}.`);
  return count.failed ? 1 : 0;
}
