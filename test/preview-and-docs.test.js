import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROWS, TOOLS, canFeature, featuredCandidates } from '../public/assets/tools.js';
import { isDataLocation, CATCH_MAX } from '../public/assets/facts.js';

const root = new URL('../', import.meta.url);
const file = f => readFileSync(new URL(f, root), 'utf8');
const data = JSON.parse(file('data/free-facts.json'));
const entry = name => data.find(e => e.name === name);
const row = name => ROWS.find(r => r[0] === name)[8];
const rowOf = e => ROWS.find(r => r[1].toLowerCase() === e.repo.toLowerCase())[8];   // by repo: the list says "Vane" where the data says "Vane (ex-Perplexica)"
const TODAY = '2026-10-30';

// ---- the three tools the founder checked ----

test('Interview Coach: facts kept, confidence high, and a data location with a note', () => {
  const e = entry('Interview Coach');
  assert.equal(e.confidence, 'high');
  assert.equal(e.dataLocation, 'Runs on your computer (cloud AI only if you pick one)');
  assert.equal(e.freeTier, 'Free command-line tool with a local web dashboard');
  assert.equal(e.catch, 'Use Ollama for offline use, or a cloud AI provider');
  assert.deepEqual(e.sources, ['https://github.com/J3rry320/interview-coach#readme']);
  assert.equal(e.lastChecked, TODAY);
  assert.equal(row('Interview Coach').dataLocation, e.dataLocation, 'and the card shows it');
});

test('JobSync-Service: the new catch, an optional MCP AI app, no card, confidence medium', () => {
  const e = entry('JobSync-Service');
  assert.equal(e.catch, "Needs an AI app that supports MCP (Claude Desktop, Claude Code, Cursor); that app's plan limits apply");
  assert.deepEqual(e.paidDeps, { level: 'optional', what: 'An MCP AI app; Airtable optional (local markdown file works)' });
  assert.equal(e.cardRequired, 'no');
  assert.equal(e.confidence, 'medium');
  assert.deepEqual(e.sources, ['https://github.com/mayank-glitch-cpu/JobSync-Service#readme']);
  assert.equal(e.lastChecked, TODAY);
  assert.equal(row('JobSync-Service').cardRequired, 'no');
  assert.equal(row('JobSync-Service').paidDeps.level, 'optional');
});

test('HexStrike AI: the new catch and paid dependencies, confidence medium, and never picked for homepage featured tools', () => {
  const e = entry('HexStrike AI');
  assert.equal(e.catch, "Needs an MCP AI app and the security tools installed; some optional tools are paid; run in an isolated VM on systems you're authorized to test");
  assert.ok(e.catch.length > 140 && e.catch.length <= CATCH_MAX, 'longer than the old 140-character limit, so the limit is now 160');
  assert.deepEqual(e.paidDeps, { level: 'optional', what: 'An MCP AI app; optional commercial tools such as Binary Ninja, Shodan, Censys' });
  assert.equal(e.confidence, 'medium');
  assert.deepEqual(e.sources, ['https://github.com/0x4m4/hexstrike-ai#readme']);
  assert.equal(e.lastChecked, TODAY);
  assert.equal(e.featureOnHomepage, false);
  assert.equal(row('HexStrike AI').featureOnHomepage, false);
});

test('only HexStrike AI (by the data) and the founder own tool are kept off the homepage, and anything that picks featured tools must use canFeature', () => {
  assert.deepEqual(data.filter(e => e.featureOnHomepage === false).map(e => e.name), ['HexStrike AI']);
  assert.deepEqual(TOOLS.filter(t => !canFeature(t)).map(t => t.name).sort(), ['HexStrike AI', 'SOC Range']);
  assert.equal(featuredCandidates().length, TOOLS.length - 2);
  assert.ok(!featuredCandidates().some(t => t.slug === 'hexstrike-ai'));
  assert.ok(file('public/assets/tools.js').includes('export const canFeature'));
});

test('a data location is a base value with an optional short note in parentheses', () => {
  for (const e of data) assert.ok(isDataLocation(e.dataLocation), `${e.name}: ${e.dataLocation}`);
  assert.ok(isDataLocation('Runs on your computer (cloud AI only if you pick one)'));
  for (const bad of ['', 'Mars', 'Runs on your computer ()', 'Your server (a (b))', 'Runs on your computer, mostly', 5, null]) assert.equal(isDataLocation(bad), false, String(bad));
});

// ---- the docs-only pass over the remaining tools ----

test('docs-only pass: claims no official page states are gone from the catches and free tiers', () => {
  const said = (name, field) => entry(name)[field];
  assert.ok(!/pre-1\.0/i.test(said('Vigil', 'catch')), 'Vigil 1.0.0 was released on 2026-10-29');
  assert.ok(!/^free/i.test(said('Open WebUI', 'freeTier')), 'no official page calls Open WebUI free');
  for (const name of ['paperless-gpt', 'Vane (ex-Perplexica)', 'LibreChat']) assert.ok(!/unlimited/i.test(said(name, 'freeTier')), `${name}: "unlimited" is not stated`);
  assert.ok(!/RAM\/GPU/.test(said('Ollama', 'catch')), 'Ollama: speed depends on RAM/GPU is not stated');
  assert.ok(!/paid/i.test(said('MyResumo', 'catch')) && !/paid/i.test(said('garak', 'catch')), 'the READMEs do not say the keys cost money');
  assert.ok(!/AI steps need API keys/i.test(said('n8n', 'catch')));
  assert.ok(!/8–32/.test(said('Jan', 'catch')), 'Jan documents 8 GB minimum, 16 GB recommended');
  assert.ok(!/not OSI open source/i.test(said('PurpleLlama', 'catch')) && !/Redis and Kafka/.test(said('AiSOC', 'catch')));
  assert.ok(!/^Linux only/i.test(said('Nebula', 'catch')), 'Nebula documents Linux x86_64 preview installers');
});

test('docs-only pass: every row still has valid, sourced facts that match the data file', () => {
  assert.equal(data.length, 45);
  for (const e of data) {
    assert.ok(e.sources.length >= 1 && e.sources.length <= 3 && e.sources.every(u => u.startsWith('https://')), `${e.name}: sources`);
    assert.ok(e.freeTier.length <= 80 && e.catch.length <= CATCH_MAX, `${e.name}: lengths`);
    assert.equal(rowOf(e).catch, e.catch, `${e.name}: row catch`);
    assert.equal(rowOf(e).freeTier, e.freeTier, `${e.name}: row freeTier`);
    assert.equal(rowOf(e).dataLocation, e.dataLocation, `${e.name}: row dataLocation`);
    assert.deepEqual([...rowOf(e).sources], e.sources, `${e.name}: row sources`);
    assert.match(e.lastChecked, /^\d{4}-\d{2}-\d{2}$/);
  }
});

// ---- the preview environment has its own database ----

test('wrangler.toml: production keeps openorbia-db; the preview environment, and only it, is bound to openorbia-db-preview', () => {
  const toml = file('wrangler.toml');
  const blocks = toml.split(/^\[\[/m).slice(1).map(b => '[[' + b);
  const prod = blocks.find(b => b.startsWith('[[d1_databases]]'));
  const preview = blocks.find(b => b.startsWith('[[env.preview.d1_databases]]'));
  assert.ok(prod && preview);
  const val = (b, k) => b.match(new RegExp(`^${k} = "([^"]+)"`, 'm'))[1];
  assert.deepEqual([val(prod, 'binding'), val(prod, 'database_name'), val(prod, 'database_id')], ['DB', 'openorbia-db', '8f21ec5b-2650-46df-a41f-d5742a59e69b']);
  assert.deepEqual([val(preview, 'binding'), val(preview, 'database_name'), val(preview, 'database_id')], ['DB', 'openorbia-db-preview', 'a280dab0-fea9-4c09-9194-fba1017788d0']);
  assert.notEqual(val(prod, 'database_id'), val(preview, 'database_id'));
  assert.equal(blocks.length, 2, 'no other database is bound');
  assert.ok(!toml.includes('env.production'), 'production has no environment block of its own');
});

test('package scripts for the preview database never name the live one, and the live scripts never name the preview one', () => {
  const scripts = JSON.parse(file('package.json')).scripts;
  for (const name of ['db:schema:preview', 'db:migrate:preview', 'seed:preview']) {
    assert.ok(scripts[name], name);
    assert.ok(scripts[name].includes('openorbia-db-preview'), `${name} targets the preview database`);
    assert.ok(!/openorbia-db(?!-preview)/.test(scripts[name]), `${name} never names openorbia-db`);
  }
  assert.ok(scripts['seed:preview'].includes('--include-samples') && scripts['seed:preview'].includes('--no-images') && scripts['seed:preview'].includes('--sample-date this-week'));
  for (const name of ['db:schema:remote', 'db:migrate:remote', 'seed:remote']) assert.ok(!scripts[name].includes('preview'), name);
});

// ---- the seed options for the preview database ----

function seedDryRun(args, jsonFile) {
  const r = spawnSync(process.execPath, ['scripts/seed-launches.mjs', '--dry-run', ...(jsonFile ? ['--file', jsonFile] : []), ...args], { cwd: new URL('.', root).pathname.replace(/^\/([A-Za-z]:)/, '$1'), encoding: 'utf8' });
  return { status: r.status, out: r.stdout + r.stderr };
}
const pacificMonday = (backWeeks = 0) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(Date.now());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7 * backWeeks);
  return d.toISOString().slice(0, 10);
};

test('seed --sample-date moves only the samples to a Pacific Monday that is open now (this-week) or closed (last-week); --no-images drops their images', () => {
  const now = seedDryRun(['--include-samples', '--sample-date', 'this-week', '--no-images']);
  assert.equal(now.status, 0, now.out.slice(0, 300));
  const dates = [...now.out.matchAll(/week 1  (\d{4}-\d{2}-\d{2})  \(sample\)/g)].map(m => m[1]);
  assert.deepEqual(dates, Array(3).fill(pacificMonday(0)), 'all three samples are in this week');
  assert.ok(!now.out.includes('/launches/sample-'), 'no sample image is referenced');
  const last = seedDryRun(['--include-samples', '--sample-date', 'last-week']);
  assert.deepEqual([...last.out.matchAll(/week 1  (\d{4}-\d{2}-\d{2})  \(sample\)/g)].map(m => m[1]), Array(3).fill(pacificMonday(1)));
  assert.deepEqual([...seedDryRun(['--include-samples', '--sample-date', '2026-11-23']).out.matchAll(/week 1  (\d{4}-\d{2}-\d{2})/g)].map(m => m[1]), Array(3).fill('2026-11-23'));
  const bad = seedDryRun(['--include-samples', '--sample-date', 'someday']);
  assert.equal(bad.status, 2);
  assert.match(bad.out, /this-week, last-week or a date/);
});

test('seed --sample-date and --no-images never touch a real (non-sample) launch', () => {
  const dir = mkdtempSync(join(tmpdir(), 'seed-test-'));
  try {
    const real = { slug: 'real-tool', name: 'Real Tool', tagline: 'A real launch', description: 'It is real.', category: 'job', repo_url: 'https://github.com/real/tool', maker_name: 'Maker', license: 'MIT', launch_week: 2, launch_date: '2026-12-07' };
    const sample = { ...real, slug: 'sample-tool', name: 'Sample Tool', sample: true, launch_week: 1, launch_date: '2026-11-23' };
    writeFileSync(join(dir, 'launches.json'), JSON.stringify({ launches: [real, sample] }));
    const r = seedDryRun(['--include-samples', '--sample-date', 'this-week', '--no-images'], join(dir, 'launches.json'));
    assert.equal(r.status, 0, r.out.slice(0, 300));
    assert.match(r.out, /real-tool .*week 2  2026-12-07\n/, 'the real launch keeps its date');
    assert.ok(r.out.includes(`sample-tool  [job]  week 1  ${pacificMonday(0)}  (sample)`), 'the sample moved');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
