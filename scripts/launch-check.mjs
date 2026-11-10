#!/usr/bin/env node
// Launch preflight: checks data/launches.json before seeding and prints a pass/fail table per launch (lib/launch-check.js says what).
// Read-only: it reads the file, the images under public/launches/ and the Launch List, and changes nothing.
//
//   npm run launch:check                    exit 1 if any real launch fails
//   npm run launch:check -- --ci            the same, except a launch day that has passed is a warning (CI keeps passing after launch)
//   npm run launch:check -- --file <path>   check another file (the tests use this with their fixtures)

import { readFileSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLaunches, formatReport } from '../lib/launch-check.js';
import { TOOLS } from '../public/assets/tools.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const file = args.includes('--file') ? resolve(args[args.indexOf('--file') + 1] || '') : resolve(root, 'data/launches.json');
// image paths are looked up next to the file's own public/ and test/fixtures/ folders (the repo root for data/launches.json)
const base = args.includes('--root') ? resolve(args[args.indexOf('--root') + 1] || '') : root;

let data;
try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.error(`Could not read ${file}: ${e.message}`); process.exit(1); }

const readFile = p => {
  const full = resolve(base, p);
  const rel = relative(base, full);
  if (rel.startsWith('..') || isAbsolute(rel)) return null; // never outside the folder
  try { return new Uint8Array(readFileSync(full)); } catch { return null; }
};

const result = checkLaunches(data, { now: Date.now(), readFile, tools: TOOLS, ci: args.includes('--ci') });
console.log(formatReport(result));
process.exitCode = result.ok ? 0 : 1;
