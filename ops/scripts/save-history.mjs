#!/usr/bin/env node
// Keeps a dated snapshot of each weekly tool check, so license changes, archived repos and free-tier changes have a history (the
// Actions cache only keeps last week's run). The weekly workflow runs it after tool-facts.mjs --all:
//
//   node ops/scripts/save-history.mjs <tool-facts.json> [--dry-run]
//
// It writes history/<YYYY-MM-DD>.json to the `tool-history` branch through the GitHub API (gh), never to main, creating that branch
// as an orphan (no shared history with main) the first time. A run on the same day replaces that day's file. --dry-run prints
// the snapshot and touches nothing. Only public metadata is kept: no source code, no tokens, no contact details.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const BRANCH = 'tool-history';

// The facts worth tracking over time, one small record per tool (the full tool-facts output also has source-link statuses)
export function snapshot(tools, date) {
  return {
    date,
    tools: tools.map(t => ({
      name: t.name, repo: t.repo,
      license: t.github?.license ?? null, archived: t.github?.archived ?? null, pushedAt: t.github?.pushedAt ?? null,
      latestRelease: t.github?.latestRelease ?? null, readme: t.github?.readme ?? null, error: t.github?.error ?? null,
      freeTier: t.listing?.freeTier ?? null, cardRequired: t.listing?.cardRequired ?? null, paid: t.listing?.paidDeps?.level ?? null,
      catch: t.listing?.catch ?? null, lastChecked: t.listing?.lastChecked ?? null,
      flags: t.flags || [],
    })).sort((a, b) => a.repo.localeCompare(b.repo)),
  };
}

export const historyPath = date => `history/${date}.json`;

const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] });
const api = (path, fields = {}, method = 'GET') => {
  const args = ['api', '-X', method, path];
  for (const [k, v] of Object.entries(fields)) args.push('-f', `${k}=${v}`);
  return JSON.parse(gh(args) || '{}');
};

function save(repo, path, json, message) {
  const content = Buffer.from(json).toString('base64');
  let branchExists = true;
  try { api(`repos/${repo}/git/ref/heads/${BRANCH}`); } catch { branchExists = false; }
  if (!branchExists) {
    // first run: an orphan branch holding only the history folder
    const blob = api(`repos/${repo}/git/blobs`, { content, encoding: 'base64' }, 'POST');
    const tree = JSON.parse(gh(['api', '-X', 'POST', `repos/${repo}/git/trees`, '--input', '-'],
      JSON.stringify({ tree: [{ path, mode: '100644', type: 'blob', sha: blob.sha }] })));
    const commit = JSON.parse(gh(['api', '-X', 'POST', `repos/${repo}/git/commits`, '--input', '-'],
      JSON.stringify({ message, tree: tree.sha, parents: [] })));
    api(`repos/${repo}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: commit.sha }, 'POST');
    return;
  }
  let sha = '';
  try { sha = api(`repos/${repo}/contents/${path}?ref=${BRANCH}`).sha || ''; } catch { /* a new file */ }
  api(`repos/${repo}/contents/${path}`, { message, content, branch: BRANCH, ...(sha ? { sha } : {}) }, 'PUT');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, ...rest] = process.argv.slice(2);
  if (!file) { console.error('usage: node ops/scripts/save-history.mjs <tool-facts.json> [--dry-run]'); process.exit(2); }
  const date = new Date().toISOString().slice(0, 10);
  const snap = snapshot(JSON.parse(readFileSync(file, 'utf8')), date);
  const json = JSON.stringify(snap, null, 2) + '\n';
  if (rest.includes('--dry-run')) { console.log(json); process.exit(0); }
  const repo = process.env.GH_REPO;
  if (!repo) { console.error('GH_REPO is not set (owner/name)'); process.exit(2); }
  save(repo, historyPath(date), json, `Tool check snapshot ${date} (${snap.tools.length} tools)`);
  console.log(`Saved ${historyPath(date)} to ${BRANCH} (${snap.tools.length} tools)`);
}
