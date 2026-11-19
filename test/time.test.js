import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchOpensAt, dayLabel, dayLabelLong, comingLabel } from '../lib/time.js';

// changed 2026-11-19: launches open at 12:00 AM Central (America/Chicago), not 12:01 AM Pacific
test('launch day opens at 12:00 AM Central: 06:00 UTC in winter (CST)', () => {
  assert.equal(launchOpensAt('2026-11-23'), Date.UTC(2026, 10, 23, 6, 0));
  assert.equal(new Date(launchOpensAt('2026-11-23')).toISOString(), '2026-11-23T06:00:00.000Z');
});

test('...and 05:00 UTC in summer (CDT), so daylight saving is handled', () => {
  assert.equal(launchOpensAt('2026-07-06'), Date.UTC(2026, 6, 6, 5, 0));
  assert.equal(launchOpensAt('2026-10-12'), Date.UTC(2026, 9, 12, 5, 0));
});

test('the days the clocks change still open at 00:00 Central', () => {
  assert.equal(launchOpensAt('2026-03-08'), Date.UTC(2026, 2, 8, 6, 0));  // spring forward happens at 2 AM, after 00:00 CST
  assert.equal(launchOpensAt('2026-03-09'), Date.UTC(2026, 2, 9, 5, 0));  // the next day is CDT
  assert.equal(launchOpensAt('2026-11-01'), Date.UTC(2026, 10, 1, 5, 0)); // fall back happens at 2 AM, so 00:00 is still CDT
  assert.equal(launchOpensAt('2026-11-02'), Date.UTC(2026, 10, 2, 6, 0));
});

test('anything that is not a real YYYY-MM-DD date is NaN', () => {
  for (const bad of ['2026-02-30', '2026-13-01', '2026-00-10', 'soon', '', null, undefined, '2026-11-23T00:00', '23-11-2026', '2026-1-5', 20261123]) {
    assert.ok(Number.isNaN(launchOpensAt(bad)), String(bad));
  }
  assert.ok(!Number.isNaN(launchOpensAt('2028-02-29'))); // a real leap day
  assert.ok(Number.isNaN(launchOpensAt('2027-02-29')));
});

test('labels use the Central launch calendar, not UTC', () => {
  const opens = launchOpensAt('2026-11-23');
  assert.equal(dayLabel(opens), 'Monday, Nov 23, 2026');
  assert.equal(dayLabelLong(opens), 'Monday, Nov 23, 2026');
  assert.equal(comingLabel(opens), 'Coming Monday, Nov 23, 2026');
  // two minutes earlier it is 11:58 PM Sunday in Chicago, although the UTC clock already says Monday (05:58)
  assert.equal(new Date(opens - 2 * 60 * 1000).toISOString(), '2026-11-23T05:58:00.000Z');
  assert.equal(dayLabel(opens - 2 * 60 * 1000), 'Sunday, Nov 22, 2026');
});
