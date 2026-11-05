// Weekly source check (see lib/source-check.js). Fetches every official page cited in
// data/free-facts.json, compares it with the last saved snapshots and prints a Markdown report.
//
//   node scripts/check-sources.mjs                    check all, save new snapshots, print the report
//   node scripts/check-sources.mjs --dry-run          check all, save nothing
//   node scripts/check-sources.mjs --only ollama      only sources of tools whose name or repo contains "ollama"
//   node scripts/check-sources.mjs --report out.md    also write the full report to a file
//   node scripts/check-sources.mjs --issue-body b.md  also write the report cut to fit in a GitHub issue
//   node scripts/check-sources.mjs --snapshots f.json where the snapshots are kept (default .ops-cache/source-snapshots.json,
//                                                     gitignored; in GitHub Actions it is kept in the Actions cache)
//
// Polite by design: robots.txt is read once per host and disallowed pages are skipped (and listed); each host gets one
// request at a time; and a run within 6 days of the last saved one fetches nothing.
// In GitHub Actions it also sets the step outputs `needs_look` (true/false), `skipped` (true/false) and `summary`.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceTargets, pageText, snapshotOf, compare, buildReport, capReport, needsLook, robotsPolicy, robotsAllows, tooSoon, byHost, USER_AGENT, MIN_DAYS_BETWEEN_RUNS } from '../lib/source-check.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const FACTS = `${root}data/free-facts.json`;

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dryRun = flag('--dry-run');
const only = value('--only')?.toLowerCase();
const reportFile = value('--report');
const issueFile = value('--issue-body');
const SNAPSHOTS = resolve(root, value('--snapshots') || '.ops-cache/source-snapshots.json');
const concurrency = Number(value('--concurrency') || 6);

const outputs = values => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(values).map(([k, v]) => `${k}=${v}\n`).join('')); };
const writeReports = report => {
  if (reportFile) writeFileSync(reportFile, report);
  if (issueFile) writeFileSync(issueFile, capReport(report));
  console.log(report);
};

// read in one step (no exists-then-read check); no file yet = the first run
const readStore = () => { try { return JSON.parse(readFileSync(SNAPSHOTS, 'utf8')); } catch { return { pages: {} }; } };
const store = readStore();
store.pages ||= {};

if (tooSoon(store.checkedAt)) {
  writeReports(`# Source check skipped\n\nThe last check saved was ${store.checkedAt}, under ${MIN_DAYS_BETWEEN_RUNS} days ago, so no page was fetched. Each page is read at most once a week.\n`);
  outputs({ needs_look: false, skipped: true, summary: 'skipped' });
  process.exit(0);
}

const facts = JSON.parse(readFileSync(FACTS, 'utf8'));
const chosen = only ? facts.filter(t => `${t.name} ${t.repo}`.toLowerCase().includes(only)) : facts;
if (!chosen.length) { console.error(`No tool matches "${only}".`); process.exit(1); }
const targets = sourceTargets(chosen);

async function get(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/plain,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    return { ok: res.ok, httpStatus: res.status, res };
  } catch (e) {
    return { ok: false, error: e.name === 'TimeoutError' ? 'timed out after 20s' : e.message };
  }
}

async function read(target) {
  const r = await get(target.fetchUrl);
  if (!r.ok) return { ok: false, httpStatus: r.httpStatus, error: r.error };
  try {
    const text = pageText(await r.res.text(), r.res.headers.get('content-type') || '');
    if (text.length < 40) return { ok: false, httpStatus: r.httpStatus, error: 'page came back almost empty (likely needs JavaScript or blocked a bot)' };
    return { ok: true, httpStatus: r.httpStatus, snapshot: snapshotOf(text) };
  } catch (e) {
    return { ok: false, httpStatus: r.httpStatus, error: e.message };
  }
}

async function robotsFor(host) {
  const r = await get(`https://${host}/robots.txt`);
  let text = '';
  if (r.ok) { try { text = await r.res.text(); } catch { return robotsPolicy({ ok: false }); } }
  return robotsPolicy({ ok: r.ok, httpStatus: r.httpStatus, text });
}

const results = new Map();
// one host at a time per worker: robots.txt first, then that host's pages one after another
async function checkHost({ host, targets: list }) {
  const policy = await robotsFor(host);
  for (const t of list) {
    const u = new URL(t.fetchUrl);
    let result;
    if (policy.blocked) result = { status: 'robots', detail: policy.blocked };
    else if (!robotsAllows(policy.rules, u.pathname + u.search)) result = { status: 'robots', detail: `disallowed by ${host}/robots.txt` };
    else {
      const now = await read(t);
      result = compare(store.pages[t.url], now);
      // A page that could not be read keeps its last good snapshot, so next week compares against it.
      if (now.ok) store.pages[t.url] = { tools: t.tools, ...now.snapshot };
    }
    results.set(t.url, { url: t.url, tools: t.tools, ...result });
    process.stderr.write(`${result.status.padEnd(9)} ${t.url}\n`);
  }
}

const queue = byHost(targets);
async function worker() {
  while (queue.length) {
    const group = queue.shift();
    try { await checkHost(group); } catch (e) {
      // never let one host stop the run
      for (const t of group.targets) if (!results.has(t.url)) results.set(t.url, { url: t.url, tools: t.tools, status: 'error', detail: e.message });
    }
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));

const ordered = targets.map(t => results.get(t.url));
const report = buildReport(ordered, new Date().toISOString().slice(0, 10));
if (!dryRun) {
  // a partial run (--only) saves its pages but doesn't count as the weekly run
  if (!only) store.checkedAt = new Date().toISOString();
  store.pages = Object.fromEntries(Object.entries(store.pages).sort(([a], [b]) => a.localeCompare(b)));
  mkdirSync(dirname(SNAPSHOTS), { recursive: true });
  writeFileSync(SNAPSHOTS, JSON.stringify(store, null, 2) + '\n');
}
writeReports(report);

const count = s => ordered.filter(r => r.status === s).length;
outputs({ needs_look: needsLook(ordered), skipped: false, summary: `${count('pricing')} pricing changes, ${count('broken')} broken links` });
