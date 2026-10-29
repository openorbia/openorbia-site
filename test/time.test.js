import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchOpensAt, dayLabel, comingLabel } from '../lib/time.js';

test('launch day opens at 12:01 AM Pacific: 08:01 UTC in winter (PST)', () => {
  assert.equal(launchOpensAt('2026-11-23'), Date.UTC(2026, 10, 23, 8, 1));
  assert.equal(new Date(launchOpensAt('2026-11-23')).toISOString(), '2026-11-23T08:01:00.000Z');
});

test('...and 07:01 UTC in summer (PDT), so daylight saving is handled', () => {
  assert.equal(launchOpensAt('2026-07-06'), Date.UTC(2026, 6, 6, 7, 1));
  assert.equal(launchOpensAt('2026-10-12'), Date.UTC(2026, 9, 12, 7, 1));
});

test('the days the clocks change still open at 00:01 Pacific', () => {
  assert.equal(launchOpensAt('2026-03-08'), Date.UTC(2026, 2, 8, 8, 1));  // spring forward happens at 2 AM, after 00:01 PST
  assert.equal(launchOpensAt('2026-03-09'), Date.UTC(2026, 2, 9, 7, 1));  // the next day is PDT
  assert.equal(launchOpensAt('2026-11-01'), Date.UTC(2026, 10, 1, 7, 1)); // fall back happens at 2 AM, so 00:01 is still PDT
  assert.equal(launchOpensAt('2026-11-02'), Date.UTC(2026, 10, 2, 8, 1));
});

test('anything that is not a real YYYY-MM-DD date is NaN', () => {
  for (const bad of ['2026-02-30', '2026-13-01', '2026-00-10', 'soon', '', null, undefined, '2026-11-23T00:00', '23-11-2026', '2026-1-5', 20261123]) {
    assert.ok(Number.isNaN(launchOpensAt(bad)), String(bad));
  }
  assert.ok(!Number.isNaN(launchOpensAt('2028-02-29'))); // a real leap day
  assert.ok(Number.isNaN(launchOpensAt('2027-02-29')));
});

test('labels use the Pacific calendar, not UTC', () => {
  const opens = launchOpensAt('2026-11-23');
  assert.equal(dayLabel(opens), 'Monday Nov 23');
  assert.equal(comingLabel(opens), 'Coming Monday Nov 23');
  // two minutes earlier it is 11:59 PM Sunday in California, although the UTC clock already says Monday (07:59)
  assert.equal(new Date(opens - 2 * 60 * 1000).toISOString(), '2026-11-23T07:59:00.000Z');
  assert.equal(dayLabel(opens - 2 * 60 * 1000), 'Sunday Nov 22');
});
