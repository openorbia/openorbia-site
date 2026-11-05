#!/usr/bin/env node
// Researcher helper: the public metadata and source-link status of Launch List tools, and what changed since the last check.
//
//   node ops/scripts/tool-facts.mjs garak pentestgpt ollama     (names or slugs from public/assets/tools.js; at most 5)
//   node ops/scripts/tool-facts.mjs --all-stale                  (every listed tool whose lastChecked is over 90 days old, at most 5)
//
// For each tool: the listing's current Free facts (data/free-facts.json), GitHub metadata through `gh api` (license, archived,
// last push, latest release, README fingerprint), and the HTTP status of every source URL. It compares the GitHub part with the
// last run, saved in .ops-cache/tool-facts.json (gitignored), and prints a "changed" list, so unchanged tools need no re-reading.
// It only reads public metadata: it never clones, installs or runs a project's code.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAX = 5;
const facts = JSON.parse(readFileSync(join(root, 'data', 'free-facts.json'), 'utf8'));
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const cacheFile = join(root, '.ops-cache', 'tool-facts.json');
// read the cache in one step (no exists-then-read check), an empty cache when there is none yet
const readCache = () => { try { return JSON.parse(readFileSync(cacheFile, 'utf8')); } catch { return {}; } };
const cache = readCache();

const args = process.argv.slice(2);
let picks;
if (args.includes('--all-stale')) {
  const cutoff = Date.now() - 90 * 864e5;
  picks = facts.filter(f => Date.parse(f.lastChecked) < cutoff);
} else {
  picks = args.map(a => facts.find(f => slug(f.name) === slug(a) || f.repo.toLowerCase() === a.toLowerCase()));
  const missing = args.filter((a, i) => !picks[i]);
  if (missing.length) { console.error(`Not on the Launch List: ${missing.join(', ')}`); process.exit(2); }
}
if (!picks.length) { console.error('Nothing to check.'); process.exit(2); }
if (picks.length > MAX) { console.error(`At most ${MAX} tools per run (asked for ${picks.length}).`); process.exit(2); }

// `gh api` as the logged-in account, without a shell; null when the call fails
const gh = path => { try { return JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { return null; } };

// Only the listing's own https source links are checked, and only through a URL rebuilt from its parts.
const safeUrl = raw => { try { const u = new URL(raw); return u.protocol === 'https:' && !u.username && !u.password ? `https://${u.host}${u.pathname}${u.search}` : null; } catch { return null; } };

async function status(raw) {
  const url = safeUrl(raw);
  if (!url) return 'not an https link';
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'openorbia-ops tool-facts' } });
      if (method === 'HEAD' && [403, 405].includes(r.status)) continue;
      return r.status;
    } catch (e) { if (method === 'GET') return `error: ${e.name}`; }
  }
  return 'error';
}

const out = [];
for (const f of picks) {
  const repo = gh(`repos/${f.repo}`);
  const release = gh(`repos/${f.repo}/releases/latest`);
  const readme = gh(`repos/${f.repo}/readme`);
  const github = repo ? {
    license: repo.license?.spdx_id || 'none', archived: repo.archived, pushedAt: repo.pushed_at?.slice(0, 10),
    latestRelease: release ? `${release.tag_name} (${release.published_at?.slice(0, 10)})` : 'none',
    readme: readme ? createHash('sha256').update(readme.content || '').digest('hex').slice(0, 12) : 'none',
  } : { error: 'GitHub lookup failed' };
  const sources = {};
  for (const u of f.sources || []) sources[u] = await status(u);
  const before = cache[f.repo]?.github;
  const changed = before ? Object.keys(github).filter(k => before[k] !== github[k]) : ['first check'];
  const monthsSincePush = github.pushedAt ? Math.round((Date.now() - Date.parse(github.pushedAt)) / (30 * 864e5)) : null;
  out.push({
    name: f.name, repo: f.repo, checked: new Date().toISOString().slice(0, 10),
    listing: { freeTier: f.freeTier, cardRequired: f.cardRequired, dataLocation: f.dataLocation, setup: f.setup, catch: f.catch, paidDeps: f.paidDeps, level: f.level, confidence: f.confidence, lastChecked: f.lastChecked },
    github, sources, changedSinceLastRun: changed,
    flags: [
      github.archived && 'archived',
      monthsSincePush !== null && monthsSincePush > 6 && `no push for ${monthsSincePush} months (rule: updated in the last 6)`,
      ...Object.entries(sources).filter(([, s]) => s !== 200).map(([u, s]) => `source ${u} answered ${s}`),
    ].filter(Boolean),
  });
  cache[f.repo] = { github, at: new Date().toISOString() };
}
mkdirSync(dirname(cacheFile), { recursive: true });
// written in one step; a concurrent run at worst overwrites the cache, which only holds public metadata
writeFileSync(cacheFile, JSON.stringify(cache, null, 2), { flag: 'w' });
console.log(JSON.stringify(out, null, 2));
