#!/usr/bin/env node
// Count the GitHub stars of every Launch List tool and save them in data/stars.json, for the star lines on the homepage
// and the Launch List (lib/stars.js). Reads only public repository data from the GitHub REST API. Without a token GitHub
// allows 60 requests an hour, enough for the list; set GITHUB_TOKEN to go past that.
//
//   node scripts/fetch-stars.mjs        (npm run fetch:stars)    then npm run build:home, and commit both
//
// A repository that cannot be read this time keeps its last saved count, and the script says which ones.

import { readFileSync, writeFileSync } from 'node:fs';
import { TOOLS } from '../public/assets/tools.js';

const file = new URL('../data/stars.json', import.meta.url);
let previous = {};
try { previous = JSON.parse(readFileSync(file, 'utf8')).stars || {}; } catch { /* first run */ }

const headers = { accept: 'application/vnd.github+json', 'user-agent': 'openorbia-site fetch-stars (+https://openorbia.com/how-we-check/)' };
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const stars = {}, kept = [];
for (const tool of TOOLS) {
  try {
    const res = await fetch(`https://api.github.com/repos/${tool.repo}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const n = (await res.json()).stargazers_count;
    if (!Number.isInteger(n)) throw new Error('no stargazers_count');
    stars[tool.repo] = n;
  } catch (e) {
    if (Number.isInteger(previous[tool.repo])) { stars[tool.repo] = previous[tool.repo]; kept.push(`${tool.repo} (${e.message})`); }
    else console.warn(`No count for ${tool.repo}: ${e.message}`);
  }
}

const checked = new Date().toISOString().slice(0, 10);
writeFileSync(file, `${JSON.stringify({ _readme: 'GitHub stars of the Launch List tools (scripts/fetch-stars.mjs). The tools\' own stars, never OpenOrbia\'s users.', checked, stars }, null, 2)}\n`);
const total = Object.values(stars).reduce((a, b) => a + b, 0);
console.log(`${Object.keys(stars).length} of ${TOOLS.length} tools, ${total.toLocaleString('en-US')} stars, checked ${checked}`);
if (kept.length) console.log(`Kept the last saved count for: ${kept.join(', ')}`);
