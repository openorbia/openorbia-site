#!/usr/bin/env node
// Researcher and maker-coordinator helper: is a candidate tool already listed, launching, or already in the maker tracker?
//
//   node ops/scripts/dedupe.mjs "Open WebUI" some-org/some-repo https://github.com/x/y
//   node ops/scripts/dedupe.mjs --makers <export.json> "Tool name" ...
//
// Checks each candidate (a name, owner/repo or GitHub URL) against the Launch List (public/assets/tools.js), the Free facts
// (data/free-facts.json) and the launches (data/launches.json). With --makers it also checks a JSON export of the private
// maker tracker (an array of {name, tool, ...}); keep that export outside the repository and delete it after use.
// Prints one line per candidate: "new" or where it already appears. Exit code 1 when any candidate is a duplicate.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { ROWS } = await import(pathToFileURL(join(root, 'public', 'assets', 'tools.js')).href);
const facts = JSON.parse(readFileSync(join(root, 'data', 'free-facts.json'), 'utf8'));
const launches = JSON.parse(readFileSync(join(root, 'data', 'launches.json'), 'utf8')).launches || [];

const args = process.argv.slice(2);
let makers = [];
const m = args.indexOf('--makers');
if (m >= 0) { makers = JSON.parse(readFileSync(args[m + 1], 'utf8')); args.splice(m, 2); }
if (!args.length) { console.error('Give at least one tool name, owner/repo or GitHub URL.'); process.exit(2); }

// "Open WebUI", "open-webui/open-webui" and "https://github.com/open-webui/open-webui" all become comparable keys
const norm = s => String(s || '').toLowerCase().replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\.git$|\/+$/g, '').replace(/[^a-z0-9/]+/g, '');
const keysOf = (...vals) => vals.flatMap(v => { const n = norm(v); return n.includes('/') ? [n, n.split('/')[1]] : [n]; }).filter(Boolean);

const index = [
  ...ROWS.map(([name, repo]) => ({ where: 'Launch List', label: name, keys: keysOf(name, repo) })),
  ...facts.map(f => ({ where: 'Free facts', label: f.name, keys: keysOf(f.name, f.repo) })),
  ...launches.map(l => ({ where: `launches.json${l.sample ? ' (sample)' : ''}`, label: l.name, keys: keysOf(l.name, l.repo_url) })),
  ...makers.map(x => ({ where: 'maker tracker', label: x.tool || x.name, keys: keysOf(x.tool, x.repo_url, x.website_url) })),
];

let dupes = 0;
for (const c of args) {
  const k = keysOf(c);
  const hits = [...new Set(index.filter(e => e.keys.some(x => k.includes(x))).map(e => `${e.where}: ${e.label}`))];
  if (hits.length) dupes++;
  console.log(`${c} -> ${hits.length ? hits.join('; ') : 'new'}`);
}
process.exit(dupes ? 1 : 0);
