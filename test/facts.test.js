import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROWS } from '../public/assets/tools.js';
import { DatabaseSync } from 'node:sqlite';
import { launchResponse } from '../lib/pages.js';
import { validateLaunches, toSql } from '../lib/launch-data.js';
import { factRows, formatChecked, isTested, CARD_REQUIRED, DATA_LOCATIONS, SETUPS, PAID_LEVELS, FACT_LEVELS, CATCH_MAX, isDataLocation, DATA_LOCATION_NOTE_MAX } from '../public/assets/facts.js';
import { MIGRATIONS } from '../lib/migrations.js';
import { launchOpensAt } from '../lib/time.js';
import { createDb, addLaunch } from './helpers/d1.js';

const AFTER = launchOpensAt('2026-11-23') + 2 * 24 * 3600 * 1000;
const FULL = { freeTier: 'Free forever', cardRequired: 'no', dataLocation: 'Your server', setup: 'Desktop app', catch: 'Team features are paid.', lastChecked: '2026-10-20' };
const root = new URL('../', import.meta.url);

let db, env;
beforeEach(() => { db = createDb(); env = { DB: db, VOTE_SECRET: 'test-secret-0123456789abcdef' }; });

const render = async (facts) => {
  db = createDb(); env.DB = db;
  addLaunch(db, { slug: 't', name: 'T', launch_date: '2026-11-23', ...(facts === undefined ? {} : { facts: JSON.stringify(facts) }) });
  const res = await launchResponse({ request: new Request('https://openorbia.com/launch/t/'), env, params: { slug: 't' }, now: AFTER });
  return res.text();
};
const good = (over = {}) => ({
  slug: 'my-tool', name: 'My Tool', tagline: 'x', description: 'y', category: 'job', repo_url: 'https://github.com/e/m',
  maker_name: 'M', license: 'MIT', launch_week: 1, launch_date: '2026-11-23', ...over,
});
const errs = over => validateLaunches({ launches: [good(over)] }).errors;

test('full facts: every row, in order, above the description, with the checked date', async () => {
  const html = await render(FULL);
  const box = html.slice(html.indexOf('class="ffacts"'), html.indexOf('</section>', html.indexOf('class="ffacts"')));
  for (const t of ['Free forever', 'Your server', 'Desktop app', 'Team features are paid.', 'Last checked Oct 20, 2026']) assert.ok(box.includes(t), t);
  assert.match(box, /Card required<\/dt><dd>No</);
  const order = ['Free tier', 'Card required', 'Your data', 'Setup', 'The catch'].map(l => box.indexOf(l));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.ok(html.indexOf('class="ffacts"') < html.indexOf('About T'));
});

test('partial facts: only the known rows show', async () => {
  const html = await render({ freeTier: 'Free', lastChecked: '2026-10-20' });
  assert.ok(html.includes('Free tier'));
  for (const l of ['Card required', 'Your data', 'Setup', 'The catch']) assert.ok(!html.includes(`<dt>${l}</dt>`), l);
});

test('no facts, or only a date: no box at all', async () => {
  assert.ok(!(await render(undefined)).includes('ffacts'));
  assert.ok(!(await render({ lastChecked: '2026-10-20' })).includes('ffacts'));
});

test('facts are escaped', async () => {
  const html = await render({ catch: '<img src=x onerror=alert(1)>' });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img'));
});

test('"Tested by OpenOrbia" shows only for testedBy exactly OpenOrbia, apart from the vote button', async () => {
  const yes = await render({ ...FULL, testedBy: 'OpenOrbia' });
  assert.ok(yes.includes('Tested by OpenOrbia'));
  assert.ok(!(await render(FULL)).includes('Tested by'));
  assert.ok(!(await render({ ...FULL, testedBy: 'openorbia' })).includes('Tested by'));
  assert.ok(isTested({ testedBy: 'OpenOrbia' }) && !isTested({}) && !isTested(null) && !isTested({ testedBy: 'Someone' }));
});

test('factRows and formatChecked', () => {
  assert.deepEqual(factRows({}), []);
  assert.deepEqual(factRows(null), []);
  assert.equal(factRows({ cardRequired: 'yes' })[0].value, 'Yes');
  assert.equal(factRows({ cardRequired: 'unknown' })[0].value, 'Not confirmed');
  assert.deepEqual(factRows({ cardRequired: 'maybe' }), [], 'anything else has no row');
  assert.equal(formatChecked('2026-11-10'), 'Nov 10, 2026');
  assert.equal(formatChecked(''), '');
  assert.equal(formatChecked('nope'), '');
});

test('validation: enums, lengths, dates and testedBy', () => {
  assert.deepEqual(errs({ ...FULL, testedBy: 'OpenOrbia' }), []);
  assert.deepEqual(errs({}), []);
  for (const bad of [{ cardRequired: 'maybe' }, { dataLocation: 'Mars' }, { setup: 'Magic' }, { lastChecked: '2026-02-31' }, { lastChecked: 'yesterday' },
    { testedBy: 'Me' }, { freeTier: 'x'.repeat(81) }, { catch: 'x'.repeat(CATCH_MAX + 1) }, { dataLocation: 'Runs on your computer ()' }, { dataLocation: 'Your server (a (b))' }, { dataLocation: `Vendor cloud (${'x'.repeat(DATA_LOCATION_NOTE_MAX + 1)})` }, { dataLocation: 'Runs on your computer, mostly' }]) {
    assert.ok(errs(bad).length >= 1, JSON.stringify(bad));
  }
});

test('facts survive the seed SQL round trip', () => {
  const { launches } = validateLaunches({ launches: [good(FULL)] });
  db.sql(toSql(launches));
  assert.equal(JSON.parse(db.rows('SELECT facts FROM launches WHERE slug = ?', 'my-tool')[0].facts).freeTier, 'Free forever');
});

test('migration adds facts to an older launches table, once', () => {
  const sqlite = new DatabaseSync(':memory:');
  const schema = readFileSync(new URL('schema.sql', root), 'utf8');
  const older = schema.split('\n').filter(l => !/^\s*facts\s/.test(l)).join('\n').replace(/(launch_date\s+TEXT NOT NULL),/, '$1'); // the table as it was before facts
  sqlite.exec(older);
  const m = MIGRATIONS[0];
  assert.equal(sqlite.prepare(m.applied).get().n, 0);
  sqlite.exec(m.sql);
  assert.equal(sqlite.prepare(m.applied).get().n, 1);
});

const listRows = () => {
  const html = readFileSync(new URL('public/launch-list/index.html', root), 'utf8');
  return { html, rows: ROWS };
};
const factsFile = JSON.parse(readFileSync(new URL('data/free-facts.json', root), 'utf8'));

test('Launch List: every row has valid Free facts (allowed values only, no testedBy)', () => {
  const { rows } = listRows();
  assert.equal(rows.length, 45);
  const allowed = ['freeTier', 'cardRequired', 'dataLocation', 'setup', 'catch', 'lastChecked', 'paidDeps', 'sources', 'task', 'level', 'featureOnHomepage'];
  for (const r of rows) {
    const f = r[8];
    assert.ok(f && typeof f === 'object', r[0]);
    assert.deepEqual(Object.keys(f).filter(k => !allowed.includes(k)), [], `${r[0]}: only the known fields (no confidence, no testedBy)`);
    assert.ok(f.freeTier && f.freeTier.length <= 80, `${r[0]}: freeTier`);
    if ('cardRequired' in f) assert.ok(CARD_REQUIRED.includes(f.cardRequired), `${r[0]}: cardRequired`);
    if ('dataLocation' in f) assert.ok(isDataLocation(f.dataLocation), `${r[0]}: dataLocation "${f.dataLocation}"`);
    if ('setup' in f) assert.ok(SETUPS.includes(f.setup), `${r[0]}: setup`);
    if ('catch' in f) assert.ok(f.catch.length > 0 && f.catch.length <= CATCH_MAX, `${r[0]}: catch`);
    assert.match(f.lastChecked, /^\d{4}-\d{2}-\d{2}$/, `${r[0]}: lastChecked`);
    assert.ok(formatChecked(f.lastChecked), `${r[0]}: lastChecked is a real date`);
    // read from the official docs
    assert.ok(f.paidDeps && PAID_LEVELS.includes(f.paidDeps.level), `${r[0]}: paidDeps.level`);
    assert.ok(f.paidDeps.what && f.paidDeps.what.length <= 90, `${r[0]}: paidDeps.what`);
    assert.ok(f.task && f.task.length <= 80, `${r[0]}: task`);
    assert.ok(FACT_LEVELS.includes(f.level), `${r[0]}: level`);
    assert.ok(f.sources.length >= 1 && f.sources.length <= 3 && f.sources.every(u => u.startsWith('https://')), `${r[0]}: sources`);
  }
});

test('Launch List: rows carry exactly the facts in the data file, matched by repo, and confidence stays in the data', () => {
  const { html, rows } = listRows();
  const byRepo = new Map(factsFile.map(x => [x.repo.toLowerCase(), x]));
  for (const r of rows) {
    const x = byRepo.get(r[1].toLowerCase());
    assert.ok(x, `${r[0]}: no entry for ${r[1]} in the data file`);
    const f = r[8];
    assert.equal(f.freeTier, x.freeTier, `${r[0]}: freeTier`);
    assert.equal(f.dataLocation, x.dataLocation, `${r[0]}: dataLocation`);
    assert.equal(f.setup, x.setup, `${r[0]}: setup`);
    assert.equal(f.catch, x.catch, `${r[0]}: catch`);
    assert.equal(f.lastChecked, x.lastChecked, `${r[0]}: lastChecked`);
    assert.equal(f.cardRequired, x.cardRequired, `${r[0]}: cardRequired`);
    assert.deepEqual({ ...f.paidDeps }, x.paidDeps, `${r[0]}: paidDeps`);
    assert.deepEqual([...f.sources], x.sources, `${r[0]}: sources`);
    assert.equal(f.task, x.task, `${r[0]}: task`);
    assert.equal(f.level, x.level, `${r[0]}: level`);
  }
  assert.ok(factsFile.every(x => ['high', 'medium', 'low'].includes(x.confidence)), 'every data entry has a confidence');
  assert.ok(!/confidence/i.test(html), 'confidence is never on the page');
  // every data entry is a tool on the Launch List (yourspeakreps has no open license and is in neither)
  const listed = new Set(rows.map(r => r[1].toLowerCase()));
  assert.equal(factsFile.length, rows.length);
  assert.deepEqual(factsFile.filter(x => !listed.has(x.repo.toLowerCase())).map(x => x.name), []);
  assert.ok(!/yourspeakreps/i.test(html) && !/yourspeakreps/i.test(JSON.stringify(factsFile)), 'yourspeakreps (no open license) is nowhere');
});

test('Launch List: the counts in the title, meta, headline and og:title match the number of rows', () => {
  const { html, rows } = listRows();
  const n = rows.length;
  assert.match(html, new RegExp(`<title>Launch List: ${n} free AI tools \\| OpenOrbia</title>`));
  assert.match(html, new RegExp(`<meta name="description" content="${n} free and open-source AI tools`));
  assert.match(html, new RegExp(`<meta property="og:title" content="The OpenOrbia Launch List: ${n} free AI tools"`));
  assert.match(html, new RegExp(`<h1>${n} free AI tools,`));
  const stated = [...html.matchAll(/(\d+) free (?:and open-source )?AI tools/g)].map(m => Number(m[1]));
  assert.ok(stated.length >= 4 && stated.every(x => x === n), `every stated count is ${n}: ${stated}`);
});

test('Launch List: the cards show the facts, with Card required and the catch where known', () => {
  const { html } = listRows();
  assert.match(html, /function ff\(facts\)/);
  const rows = factRows({ freeTier: 'x', cardRequired: 'yes', catch: 'Needs a paid plan' });
  assert.deepEqual(rows.map(r => r.label), ['Free tier', 'Card required', 'The catch']);
  assert.equal(rows[1].value, 'Yes');
});

test('Launch List: the local-AI tag and filter chip say "Works with local AI", never "Runs locally"', () => {
  const html = readFileSync(new URL('public/launch-list/index.html', root), 'utf8');
  assert.ok(!/>Runs locally</i.test(html), 'no tag or chip says Runs locally (a fact like "runs locally with Docker" is fine)');
  assert.match(html, /data-f="loc"[^>]*>Works with local AI</);
  assert.match(html, /<span class="tg[^"]*">Works with local AI<\/span>/);
});

test('cardRequired "unknown" is valid and shows as "Not confirmed" on launch pages and the Launch List', async () => {
  assert.deepEqual(errs({ freeTier: 'x', cardRequired: 'unknown' }), []);
  assert.deepEqual(errs({ freeTier: 'x', cardRequired: 'Unknown' }), [], 'case is normalized like yes/no');
  const html = await render({ freeTier: 'Free', cardRequired: 'unknown' });
  assert.ok(html.includes('Card required</dt><dd>Not confirmed</dd>'));
  const { rows } = listRows();
  const unknown = rows.filter(r => r[8].cardRequired === 'unknown').map(r => r[0]).sort();
  assert.deepEqual([...unknown], ['Reactive Resume']);
});

test('Launch List: AI Job Hunter is a Job Seekers row with the exact facts, also in the data file', () => {
  const { rows } = listRows();
  const r = rows.find(x => x[1] === 'saeedkolivand/ai-job-hunter-app');
  assert.ok(r, 'row exists');
  assert.deepEqual([r[0], r[3], r[4], r[5], r[6], r[7]], ['AI Job Hunter', 'job', 'os', 'Apache-2.0', 1, 0]);
  assert.equal(r[2], 'Desktop app that finds jobs, scores them against your résumé and writes tailored cover letters and résumés');
  const { freeTier, cardRequired, dataLocation, setup, lastChecked } = r[8];
  assert.deepEqual({ freeTier, cardRequired, dataLocation, setup, catch: r[8].catch, lastChecked }, {
    freeTier: 'Free and open source; runs offline with Ollama or uses your own API key', cardRequired: 'no', dataLocation: 'Runs on your computer', setup: 'Desktop app',
    catch: 'Large, fast-changing app; crash reports go to Sentry by default (can turn off)', lastChecked: '2026-10-30',
  });
  const x = factsFile.find(e => e.repo === 'saeedkolivand/ai-job-hunter-app');
  assert.ok(x && x.confidence === 'high' && x.category === 'job');
  assert.equal(new Set(rows.map(row => row[1].toLowerCase())).size, rows.length, 'no repo is listed twice');
});
