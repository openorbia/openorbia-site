#!/usr/bin/env node
// Send one test of the waitlist welcome email, exactly as signups get it (subject marked "[Test]"), or write it to files to look at.
//
//   BREVO_API_KEY=... npm run email:test -- you@example.com      send one test through Brevo
//   npm run email:test -- --preview <folder>                       write welcome.html and welcome.txt there; sends nothing
//
// Run it yourself, with the key in your own shell: this script never prints the key or saves it. The test's unsubscribe link is a
// sample (no real signup behind it), so following it shows "This link doesn't work"; real signups get a working link of their own.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { welcomeEmail, BREVO_URL, SENDER } from '../lib/email.js';

const SAMPLE_UNSUBSCRIBE = `https://openorbia.com/unsubscribe/?id=0&t=${'0'.repeat(32)}`;
const args = process.argv.slice(2);
const email = welcomeEmail('reader', { unsubscribeUrl: SAMPLE_UNSUBSCRIBE });

const p = args.indexOf('--preview');
if (p >= 0) {
  const dir = resolve(args[p + 1] || '.');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'welcome.html'), email.html);
  writeFileSync(join(dir, 'welcome.txt'), `Subject: ${email.subject}\nPreview: ${email.preview}\n\n${email.text}`);
  console.log(`Wrote welcome.html and welcome.txt to ${dir}. Nothing was sent.`);
  process.exit(0);
}

const to = args[0];
if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { console.error('Give the address to send the test to: npm run email:test -- you@example.com'); process.exit(2); }
const key = process.env.BREVO_API_KEY;
if (!key) { console.error('Set BREVO_API_KEY in your shell for this one command; it is not read from anywhere else.'); process.exit(2); }

const res = await fetch(BREVO_URL, {
  method: 'POST',
  headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({
    sender: SENDER, to: [{ email: to }], replyTo: { email: SENDER.email }, subject: `[Test] ${email.subject}`,
    htmlContent: email.html, textContent: email.text,
    headers: { 'List-Unsubscribe': `<${SAMPLE_UNSUBSCRIBE}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  }),
  signal: AbortSignal.timeout(15000),
}).catch(e => ({ ok: false, status: e.name, text: async () => '' }));
if (res.ok) {
  console.log(`Sent: Brevo accepted the test (HTTP ${res.status}). Check the inbox for "[Test] ${email.subject}".`);
} else {
  const detail = (await res.text().catch(() => '')).split(key).join('[key]').slice(0, 300);
  console.error(`Not sent: Brevo answered ${res.status}. ${detail}`);
  process.exit(1);
}
