#!/usr/bin/env node
// The "Launch Week <n> lineup" email to the waitlist. What each mode does is in lib/lineup-send.js; this file only connects it to the
// live database (through wrangler), the network, the console and two local files in .ops-cache/ (ignored by git).
//
// It runs in GitHub Actions: the manual workflow "Send lineup email" (.github/workflows/send-lineup.yml), in the production
// environment, so every run waits for Khaja's approval and the secrets live only there. Not from a laptop.
//
//   npm run email:lineup                                   dry run: count the signups, write a sample to .ops-cache/; sends nothing
//   npm run email:lineup -- --test you@example.com         send one "[Test]" copy (needs POSTAL_ADDRESS and BREVO_API_KEY)
//   npm run email:lineup -- --send --yes                   send to the waitlist (also needs UNSUBSCRIBE_SECRET)
//   options: --week <n> (default 1), --db <name> (default openorbia-db), --out <folder> (default .ops-cache)
//
// POSTAL_ADDRESS, BREVO_API_KEY and UNSUBSCRIBE_SECRET come from the production environment's secrets; nothing here prints or saves them.
// WRANGLER_VERSION pins wrangler (the workflow sets the same version as deploy.yml).

import { dirname, join, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runLineup, parseArgs } from '../lib/lineup-send.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const dbName = argv.includes('--db') ? argv[argv.indexOf('--db') + 1] : 'openorbia-db';
if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(dbName))) { console.error('--db must be a database name like openorbia-db'); process.exit(2); }
const outDir = resolve(root, (parseArgs(argv).out) || '.ops-cache');

// `npx wrangler d1 execute <db> --remote --json --command <sql>` without a shell (see scripts/migrate.mjs). The output is never printed:
// for the waitlist it holds the addresses.
function query(sql) {
  const npxCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  const pkg = /^\d+\.\d+\.\d+$/.test(process.env.WRANGLER_VERSION || '') ? `wrangler@${process.env.WRANGLER_VERSION}` : 'wrangler';
  const wrangler = ['--yes', pkg, 'd1', 'execute', dbName, '--remote', '--json', '--command', sql, '--yes'];
  const [cmd, cmdArgs] = process.platform === 'win32' && existsSync(npxCli) ? [process.execPath, [npxCli, ...wrangler]] : ['npx', wrangler];
  const r = spawnSync(cmd, cmdArgs, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('wrangler failed');
  return JSON.parse(r.stdout.slice(r.stdout.indexOf('[')))[0].results;
}
const ints = ids => ids.map(Number).filter(n => Number.isSafeInteger(n) && n > 0);

const db = {
  launches: async week => query(`SELECT slug, name, tagline, category, launch_week, launch_date FROM launches WHERE launch_week = ${Number(week)} ORDER BY name COLLATE NOCASE`),
  recipients: async () => query('SELECT id, email FROM waitlist ORDER BY id'),
  stillSubscribed: async ids => new Set(ints(ids).length ? query(`SELECT id FROM waitlist WHERE id IN (${ints(ids).join(',')})`).map(r => r.id) : []),
};

// The ids already sent, per week, so a stopped run can continue without sending anyone a second copy (ids only, no addresses)
const ledgerFile = week => join(outDir, `lineup-week-${week}-sent.json`);
const ledger = {
  read: week => { try { return new Set(JSON.parse(readFileSync(ledgerFile(week), 'utf8'))); } catch { return new Set(); } },
  add: (week, ids) => {
    if (!ids.length) return;
    mkdirSync(outDir, { recursive: true });
    const all = [...new Set([...ledger.read(week), ...ids])].sort((a, b) => a - b);
    writeFileSync(ledgerFile(week), JSON.stringify(all));
  },
};
const out = { write: (name, text) => { mkdirSync(outDir, { recursive: true }); const p = join(outDir, name); writeFileSync(p, text); return p; } };

process.exitCode = await runLineup({ argv, env: process.env, db, fetchImpl: fetch, ledger, out, log: m => console.log(m), err: m => console.error(m) });
