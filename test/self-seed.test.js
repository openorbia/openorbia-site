import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDb } from './helpers/d1.js';
import { selfSeeder, launchesToLoad, loadLaunches } from '../lib/self-seed.js';
import { listWeek, currentWeek, getLaunch } from '../lib/launches.js';

const file = JSON.parse(readFileSync(new URL('../data/launches.json', import.meta.url), 'utf8'));
const real = launchesToLoad(file);
const count = async db => (await db.prepare('SELECT COUNT(*) AS n FROM launches').first()).n;

test('an empty database gets every real launch from data/launches.json, readable by the site', async () => {
  const db = createDb();
  assert.ok(real.length >= 1);
  await selfSeeder(real)(db);
  assert.equal(await count(db), real.length);
  const week = await listWeek(db, real[0].launch_week);
  assert.equal(week.length, real.filter(l => l.launch_week === real[0].launch_week).length);
  const one = await getLaunch(db, real[0].slug);
  assert.equal(one.name, real[0].name);
  assert.deepEqual(one.screenshots, real[0].screenshots);
  assert.deepEqual(one.facts, real[0].facts);
});

test('voting opens once loaded: the week is open on launch day', async () => {
  const db = createDb();
  await selfSeeder(real)(db);
  const day = Date.parse(`${real[0].launch_date}T18:00:00Z`);
  const w = await currentWeek(db, day);
  assert.equal(w.week, real[0].launch_week);
  assert.equal(w.open, true);
  assert.equal(w.closed, false);
});

test('launches already in the database and their votes are never changed; only missing ones are added', async () => {
  const db = createDb();
  const [first, ...rest] = real;
  await selfSeeder([first])(db);
  await db.prepare('UPDATE launches SET tagline = ? WHERE slug = ?').bind('Edited by a later seed', first.slug).run();
  await db.prepare('INSERT INTO votes (launch_slug, voter_hash) VALUES (?, ?)').bind(first.slug, 'v1').run();
  await selfSeeder(real)(db);
  assert.equal(await count(db), 1 + rest.length);
  assert.equal((await getLaunch(db, first.slug)).tagline, 'Edited by a later seed');
  assert.equal((await getLaunch(db, first.slug)).votes, 1);
});

test('samples are never loaded, and a file that fails the checks loads nothing', async () => {
  const sample = { ...file.launches[0], slug: 'sample-only', sample: true };
  const withSample = launchesToLoad({ launches: [...file.launches, sample] });
  assert.ok(!withSample.some(l => l.slug === 'sample-only'));
  assert.deepEqual(launchesToLoad({ launches: [{ slug: 'Bad Slug' }] }), []);
  assert.deepEqual(launchesToLoad({}), []);
});

test('runs once per isolate, never throws, and retries a failure after a minute', async () => {
  let selects = 0;
  const db = createDb();
  const counting = { ...db, prepare: sql => { if (/^SELECT slug FROM launches/.test(sql)) selects++; return db.prepare(sql); } };
  const ensure = selfSeeder(real);
  await Promise.all([ensure(counting), ensure(counting)]);
  await ensure(counting);
  assert.equal(selects, 1, 'one check, shared by concurrent requests, then nothing');

  let tries = 0;
  const broken = { prepare: () => { tries++; throw new Error('D1 down'); } };
  const flaky = selfSeeder(real);
  await assert.doesNotReject(flaky(broken, 1000));
  await flaky(broken, 30_000);
  assert.equal(tries, 1, 'no retry within a minute');
  await flaky(broken, 70_000);
  assert.equal(tries, 2);
});

test('middleware: loads, then hands over to the next handler; no database still serves the page', async () => {
  const res = await loadLaunches({ env: {}, next: async () => new Response('ok') });
  assert.equal(await res.text(), 'ok');
});
