#!/usr/bin/env node
// Load data/launches.json into the D1 database.
//
//   node scripts/seed-launches.mjs --dry-run          validate and print the SQL, change nothing
//   node scripts/seed-launches.mjs --local            load into the local database used by `wrangler pages dev`
//   node scripts/seed-launches.mjs --remote           load into the live openorbia-db (sample entries are skipped)
//
// Options: --file <path>  --db <name>  --include-samples  --prune  --yes  --sample-date <this-week|last-week|YYYY-MM-DD>  --no-images
//
// For the preview database (npm run seed:preview): --sample-date moves the SAMPLE entries (only) to a launch week that is open today
// (this-week: the Monday of the current Pacific week, so voting works until Sunday 11:59 PM) or already closed (last-week: so the
// final results page can be tried); --no-images drops the samples' images, which are not deployed (they live in test/fixtures).
// Entries marked "sample": true are placeholders: they are loaded locally, but only go to the live database with
// --include-samples. Re-running updates entries in place and never touches votes; --prune also deletes launches (and their
// votes) that are no longer in the file.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateLaunches, toSql, forTarget } from '../lib/launch-data.js';
import { launchOpensAt, pacificDay } from '../lib/time.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const o = { mode: 'local', file: 'data/launches.json', db: 'openorbia-db', samples: false, prune: false, dryRun: false, yes: false, sampleDate: null, noImages: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--local') o.mode = 'local';
    else if (a === '--remote') o.mode = 'remote';
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--include-samples') o.samples = true;
    else if (a === '--prune') o.prune = true;
    else if (a === '--yes' || a === '-y') o.yes = true;
    else if (a === '--file') o.file = argv[++i];
    else if (a === '--db') o.db = argv[++i];
    else if (a === '--sample-date') o.sampleDate = argv[++i];
    else if (a === '--no-images') o.noImages = true;
    else { console.error(`Unknown option: ${a}`); process.exit(2); }
  }
  // The name is passed to wrangler (through cmd.exe on Windows), so accept only a plain database name
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(o.db))) { console.error('--db must be a database name like openorbia-db'); process.exit(2); }
  return o;
}

// Run `npx wrangler <args>` without a shell. On Windows npx is a .cmd file, which cannot be started without one, so run npm's
// own npx script with the current Node instead.
function wrangler(args) {
  const npxCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  const [cmd, cmdArgs] = process.platform === 'win32' && existsSync(npxCli)
    ? [process.execPath, [npxCli, 'wrangler', ...args]]
    : ['npx', ['wrangler', ...args]];
  const r = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit' });
  if (r.error) console.error(`Could not run wrangler: ${r.error.message}`);
  return r.status === 0;
}

const opts = parseArgs(process.argv.slice(2));
const file = resolve(root, opts.file);

let data;
try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (e) {
  console.error(`Could not read ${opts.file}: ${e.message}`);
  process.exit(1);
}

const { launches, errors } = validateLaunches(data);

// Preview helpers. They only ever touch entries marked "sample": true, never a real launch.
function sampleDate(spec) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(spec)) return spec;
  if (spec !== 'this-week' && spec !== 'last-week') { console.error('--sample-date must be this-week, last-week or a date like 2026-11-23'); process.exit(2); }
  const [y, m, d] = pacificDay(Date.now()).split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7) - (spec === 'last-week' ? 7 : 0));   // back to the Monday
  return day.toISOString().slice(0, 10);
}
if (opts.sampleDate) {
  const date = sampleDate(opts.sampleDate);
  if (Number.isNaN(launchOpensAt(date))) { console.error(`--sample-date ${opts.sampleDate} is not a real date`); process.exit(2); }
  for (const l of launches.filter(x => x.sample)) l.launch_date = date;
}
if (opts.noImages) for (const l of launches.filter(x => x.sample)) { l.logo_url = null; l.screenshots = []; l.video_url = null; }
// Images must exist in public/ (that is what gets deployed). The images of sample entries live in test/fixtures/ instead,
// so placeholders are never published.
const localPaths = l => [l.logo_url, l.video_url, ...l.screenshots.map(s => s.src)].filter(p => p && p.startsWith('/'));
for (const l of launches) {
  for (const f of localPaths(l)) {
    const found = existsSync(join(root, 'public', f)) || (l.sample && existsSync(join(root, 'test', 'fixtures', f)));
    if (!found) errors.push(`${l.slug}: image or video not found: public${f}${l.sample ? ' (or test/fixtures)' : ''}`);
  }
}
if (errors.length) {
  console.error(`${opts.file} has ${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const samples = launches.filter(l => l.sample);
const toLoad = forTarget(launches, { remote: opts.mode === 'remote', includeSamples: opts.samples });
console.log(`${opts.file}: ${launches.length} launch${launches.length === 1 ? '' : 'es'} (${samples.length} sample, ${launches.length - samples.length} real)`);
if (toLoad.length !== launches.length) {
  console.log(`Skipping ${launches.length - toLoad.length} sample entr${launches.length - toLoad.length === 1 ? 'y' : 'ies'} for the live database (add --include-samples to load them).`);
}
for (const l of toLoad) console.log(`  - ${l.slug}  [${l.category}]  week ${l.launch_week}  ${l.launch_date}${l.sample ? '  (sample)' : ''}`);

if (opts.prune && toLoad.length === 0) {
  console.error('Refusing --prune: there is nothing to keep, so it would delete every launch and all votes.');
  process.exit(1);
}
const sql = toSql(toLoad, { prune: opts.prune });
if (opts.dryRun) {
  console.log('\n-- SQL that would run --\n' + sql);
  process.exit(0);
}
if (toLoad.length === 0 && !opts.prune) {
  console.log('Nothing to load.');
  process.exit(0);
}

const out = join(root, '.wrangler', 'tmp', 'seed-launches.sql');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, sql, 'utf8');
const target = opts.mode === 'remote' ? '--remote' : '--local';
console.log(`\nLoading into ${opts.db} (${opts.mode})${opts.prune ? ' with --prune' : ''}...`);
const args = ['d1', 'execute', opts.db, target, `--file=${join('.wrangler', 'tmp', 'seed-launches.sql')}`];
if (opts.yes) args.push('--yes');
if (!wrangler(args)) {
  console.error(`\nThe load failed. If the tables are missing, run: npm run db:schema:${opts.mode}`);
  process.exit(1);
}
console.log(`Done. ${toLoad.length} launch${toLoad.length === 1 ? '' : 'es'} loaded.`);
