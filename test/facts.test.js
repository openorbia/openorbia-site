import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { launchResponse } from '../lib/pages.js';
import { validateLaunches, toSql } from '../lib/launch-data.js';
import { factRows, formatChecked, isTested } from '../public/assets/facts.js';
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
  assert.equal(formatChecked('2026-11-10'), 'Nov 10, 2026');
  assert.equal(formatChecked(''), '');
  assert.equal(formatChecked('nope'), '');
});

test('validation: enums, lengths, dates and testedBy', () => {
  assert.deepEqual(errs({ ...FULL, testedBy: 'OpenOrbia' }), []);
  assert.deepEqual(errs({}), []);
  for (const bad of [{ cardRequired: 'maybe' }, { dataLocation: 'Mars' }, { setup: 'Magic' }, { lastChecked: '2026-02-31' }, { lastChecked: 'yesterday' },
    { testedBy: 'Me' }, { freeTier: 'x'.repeat(81) }, { catch: 'x'.repeat(141) }]) {
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

test('Launch List: 45 rows, facts only where known from research', () => {
  const html = readFileSync(new URL('public/launch-list/index.html', root), 'utf8');
  const src = html.match(/const T=(\[[\s\S]*?\n\]);/)[1];
  const rows = vm.runInNewContext(src);
  assert.equal(rows.length, 45);
  for (const r of rows) {
    const f = r[8];
    assert.ok(f && f.freeTier, r[0]);
    assert.deepEqual(Object.keys(f), ['freeTier'], `${r[0]}: only the free tier is known; dataLocation stays empty until verified per tool`);
    assert.equal(f.freeTier, `${r[4] === 'os' ? 'Open source' : 'Free to self-host'} (${r[5]})`);
  }
});
