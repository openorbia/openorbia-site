// Weekly source check (see lib/source-check.js). Fetches every official page cited in
// data/free-facts.json, compares it with data/source-snapshots.json and prints a Markdown report.
//
//   node scripts/check-sources.mjs                  check all, save new snapshots, print the report
//   node scripts/check-sources.mjs --dry-run        check all, save nothing
//   node scripts/check-sources.mjs --only ollama    only sources of tools whose name or repo contains "ollama"
//   node scripts/check-sources.mjs --report out.md  also write the report to a file
//
// In GitHub Actions it also sets the step outputs `needs_look` (true/false) and `summary`.

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sourceTargets, pageText, snapshotOf, compare, buildReport, needsLook } from '../lib/source-check.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const FACTS = `${root}data/free-facts.json`;
const SNAPSHOTS = `${root}data/source-snapshots.json`;
const UA = 'Mozilla/5.0 (compatible; OpenOrbiaSourceCheck/1.0; +https://openorbia.com/how-we-check/)';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dryRun = flag('--dry-run');
const only = value('--only')?.toLowerCase();
const reportFile = value('--report');
const concurrency = Number(value('--concurrency') || 6);

const facts = JSON.parse(readFileSync(FACTS, 'utf8'));
const chosen = only ? facts.filter(t => `${t.name} ${t.repo}`.toLowerCase().includes(only)) : facts;
if (!chosen.length) { console.error(`No tool matches "${only}".`); process.exit(1); }
const targets = sourceTargets(chosen);
const store = existsSync(SNAPSHOTS) ? JSON.parse(readFileSync(SNAPSHOTS, 'utf8')) : { pages: {} };

async function read(target) {
  try {
    const res = await fetch(target.fetchUrl, { headers: { 'user-agent': UA, accept: 'text/html,text/plain,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { ok: false, httpStatus: res.status };
    const text = pageText(await res.text(), res.headers.get('content-type') || '');
    if (text.length < 40) return { ok: false, httpStatus: res.status, error: 'page came back almost empty (likely needs JavaScript or blocked a bot)' };
    return { ok: true, httpStatus: res.status, snapshot: snapshotOf(text) };
  } catch (e) {
    return { ok: false, error: e.name === 'TimeoutError' ? 'timed out after 20s' : e.message };
  }
}

const results = new Array(targets.length);
let next = 0;
async function worker() {
  while (next < targets.length) {
    const i = next++, t = targets[i];
    const now = await read(t);
    const prev = store.pages[t.url];
    results[i] = { url: t.url, tools: t.tools, ...compare(prev, now) };
    // A page that could not be read keeps its last good snapshot, so next week compares against it.
    if (now.ok) store.pages[t.url] = { tools: t.tools, ...now.snapshot };
    process.stderr.write(`${results[i].status.padEnd(9)} ${t.url}\n`);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));

const date = new Date().toISOString().slice(0, 10);
const report = buildReport(results, date);
if (!dryRun) {
  store.checkedAt = date;
  store.pages = Object.fromEntries(Object.entries(store.pages).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(SNAPSHOTS, JSON.stringify(store, null, 2) + '\n');
}
if (reportFile) writeFileSync(reportFile, report);
console.log(report);

if (process.env.GITHUB_OUTPUT) {
  const count = s => results.filter(r => r.status === s).length;
  appendFileSync(process.env.GITHUB_OUTPUT, `needs_look=${needsLook(results)}\nsummary=${count('pricing')} pricing changes, ${count('broken')} broken links\n`);
}
