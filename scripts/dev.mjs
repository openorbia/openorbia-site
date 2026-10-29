#!/usr/bin/env node
// Local preview: `wrangler pages dev` on public/ plus the sample images from test/fixtures/. They are copied into
// .wrangler/dev-public (gitignored), so the samples never end up in public/ or in a deployment.
//
//   npm run dev                       start the preview on http://127.0.0.1:8788 (extra arguments go to wrangler)
//   node scripts/dev.mjs --prepare-only   just build .wrangler/dev-public and exit

import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.wrangler', 'dev-public');

rmSync(out, { recursive: true, force: true });
mkdirSync(dirname(out), { recursive: true });
cpSync(join(root, 'public'), out, { recursive: true });
const fixtures = join(root, 'test', 'fixtures', 'launches');
if (existsSync(fixtures)) cpSync(fixtures, join(out, 'launches'), { recursive: true });
console.log('Prepared .wrangler/dev-public (public/ plus the sample images from test/fixtures/).');

const args = process.argv.slice(2);
if (args.includes('--prepare-only')) process.exit(0);

// Run `npx wrangler pages dev` without a shell (on Windows npx is a .cmd file, so use npm's own npx script with this Node)
const npxCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
const wranglerArgs = ['wrangler', 'pages', 'dev', join('.wrangler', 'dev-public'), ...args];
const [cmd, cmdArgs] = process.platform === 'win32' && existsSync(npxCli)
  ? [process.execPath, [npxCli, ...wranglerArgs]]
  : ['npx', wranglerArgs];
const r = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit' });
process.exit(r.status ?? 1);
