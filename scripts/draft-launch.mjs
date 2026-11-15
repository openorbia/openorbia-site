#!/usr/bin/env node
// Drafts a data/launches.json entry from a maker's email or a /submit/ row, checks it, and (after you review it) adds it.
// lib/launch-draft.js does the drafting; validateLaunches and the launch preflight (lib/launch-check.js) do the checking.
//
//   npm run launch:draft -- --email <file.txt>              an email pasted into a text file ("Tagline: ...", one label per line)
//   npm run launch:draft -- --submission <file.json>        a submissions row: one object, or `wrangler d1 execute --json` output
//                                [--id <n>]                 (pick that row when the file has several)
//   options: --slug <slug>  --week <n> (default 1)
//   npm run launch:draft -- --add <draft.json>              add a reviewed draft to data/launches.json (replaces the same slug)
//
// Drafts are written to .ops-cache/launch-drafts/<slug>.json (gitignored), never to data/. The maker's email address is never
// copied. Images are looked up in public/launches/<slug>/: put the maker's files there first (logo.png, shot-1.png, ...).
// Then: npm run launch:check and npm run seed:check, as the README's Launch Week checklist says.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEmail, fromSubmission, draftEntry, withDraft } from '../lib/launch-draft.js';
import { validateLaunches } from '../lib/launch-data.js';
import { checkLaunches, formatReport } from '../lib/launch-check.js';
import { TOOLS } from '../public/assets/tools.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const die = (msg, code = 2) => { console.error(msg); process.exit(code); };
const readJson = p => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { return die(`Could not read ${p}: ${e.message}`, 1); } };
const launchesFile = join(root, 'data', 'launches.json');
const readFile = p => { try { return new Uint8Array(readFileSync(join(root, p))); } catch { return null; } };

function report(entry) {
  const { errors } = validateLaunches({ launches: [entry] });
  const check = checkLaunches({ launches: [entry] }, { now: Date.now(), readFile, tools: TOOLS });
  return { errors, check };
}

// ---- --add: put a reviewed draft into data/launches.json ----
if (opt('--add')) {
  const entry = readJson(resolve(opt('--add')));
  if (entry.sample) die('A sample never goes into data/launches.json (samples are in data/launches.samples.json).');
  const { errors } = validateLaunches({ launches: [entry] });
  if (errors.length) die(`Not added: the draft is not valid yet:\n${errors.map(e => `  - ${e}`).join('\n')}`, 1);
  const next = withDraft(readJson(launchesFile), entry);
  writeFileSync(launchesFile, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Added ${entry.slug} to data/launches.json. Next: npm run launch:check, then npm run seed:check.`);
  process.exit(0);
}

// ---- draft from an email or a submission ----
let fields;
if (opt('--email')) fields = parseEmail(readFileSync(resolve(opt('--email')), 'utf8'));
else if (opt('--submission')) {
  const data = readJson(resolve(opt('--submission')));
  // wrangler's --json output is [{ results: [...] }]; a single row is an object
  const rows = Array.isArray(data) ? data.flatMap(d => (d && Array.isArray(d.results) ? d.results : [d])) : [data];
  const id = opt('--id');
  const row = id ? rows.find(r => String(r && r.id) === String(id)) : rows.length === 1 ? rows[0] : null;
  if (!row) die(id ? `No submission with id ${id} in the file.` : `The file has ${rows.length} rows; pick one with --id <n>.`);
  fields = fromSubmission(row);
} else die('Give --email <file>, --submission <file> or --add <draft.json>. See the top of scripts/draft-launch.mjs.');

const week = opt('--week') ? Number(opt('--week')) : undefined;
if (week !== undefined && !(Number.isInteger(week) && week >= 1)) die('--week must be a launch week number, like 1');
const slugArg = opt('--slug');
const probe = draftEntry(fields, { slug: slugArg, week });
const dir = join(root, 'public', 'launches', probe.entry.slug);
const files = probe.entry.slug && existsSync(dir) ? readdirSync(dir) : [];
const { entry, todo } = draftEntry(fields, { slug: slugArg, week, files });

const out = join(root, '.ops-cache', 'launch-drafts', `${entry.slug || 'draft'}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(entry, null, 2)}\n`);

const { errors, check } = report(entry);
console.log(`Draft written to ${out.slice(root.length + 1)} (not in data/launches.json yet).\n`);
console.log(JSON.stringify(entry, null, 2));
console.log(`\nStill to do (${todo.length}):\n${todo.map(t => `  - ${t}`).join('\n')}`);
console.log(errors.length ? `\nNot valid yet (${errors.length}):\n${errors.map(e => `  - ${e}`).join('\n')}` : '\nValid for data/launches.json.');
console.log(`\n${formatReport(check)}`);
console.log(`\nWhen it is right: npm run launch:draft -- --add ${out.slice(root.length + 1)}`);
