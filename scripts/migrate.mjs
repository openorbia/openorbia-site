#!/usr/bin/env node
// Apply the migrations in lib/migrations.js that a database is missing. Safe to run again: each one is skipped if applied.
//
//   node scripts/migrate.mjs --local     the local database used by `npm run dev`
//   node scripts/migrate.mjs --remote    the live openorbia-db
//
// Run it BEFORE deploying code that reads a new column (and after the schema is created with `npm run db:schema:*`).

import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { MIGRATIONS } from '../lib/migrations.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mode = args.includes('--remote') ? 'remote' : 'local';
const db = args.includes('--db') ? args[args.indexOf('--db') + 1] : 'openorbia-db';
if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(db))) { console.error('--db must be a database name like openorbia-db'); process.exit(2); }

// `npx wrangler d1 execute <db> --local|--remote --json --command <sql>` without a shell (see seed-launches.mjs)
function query(sql) {
  const npxCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  const wrangler = ['wrangler', 'd1', 'execute', db, `--${mode}`, '--json', '--command', sql, ...(mode === 'remote' ? ['--yes'] : [])];
  const [cmd, cmdArgs] = process.platform === 'win32' && existsSync(npxCli) ? [process.execPath, [npxCli, ...wrangler]] : ['npx', wrangler];
  const r = spawnSync(cmd, cmdArgs, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'wrangler failed').toString().slice(0, 600));
  const start = r.stdout.indexOf('[');
  return JSON.parse(r.stdout.slice(start))[0].results;
}

console.log(`Migrating ${db} (${mode})...`);
for (const m of MIGRATIONS) {
  const [{ n }] = query(m.applied);
  if (n > 0) { console.log(`  already applied: ${m.name}`); continue; }
  query(m.sql);
  console.log(`  applied: ${m.name}`);
}
console.log('Done.');
