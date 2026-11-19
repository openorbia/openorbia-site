// The launch curtain (public/assets/launch-lock.js): every page shows the countdown until launch time, except the pages makers
// need, and it takes itself away at launch time (12:00 AM Central, Monday Nov 23, 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { launchLockHead, layout } from '../lib/layout.js';
import { asset } from '../lib/asset-versions.js';
import { launchOpensAt } from '../lib/time.js';
import { FIRST_LAUNCH_WEEK } from '../lib/site.js';
import { renderTool } from '../lib/tool-pages.js';
import { toolBySlug } from '../public/assets/tools.js';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const OPENS = launchOpensAt(FIRST_LAUNCH_WEEK.date);
const LOCK = { ...(() => { const ctx = { window: {}, document: { querySelector: () => null }, location: { pathname: '/' } }; runInNewContext(file('public/assets/launch-lock.js'), ctx); return ctx.window.openorbiaLaunchLock; })() };

test('the launch instant is 12:00 AM Central on Monday, Nov 23, 2026 (06:00 UTC)', () => {
  assert.equal(new Date(OPENS).toISOString(), '2026-11-23T06:00:00.000Z');
  assert.ok(launchLockHead().includes('<meta name="openorbia-launch" content="2026-11-23T06:00:00.000Z">'));
});

test('every page carries the curtain in <head>, before any other script and without defer, so it never shows unlocked first', () => {
  const pages = { home: file('public/index.html'), list: file('public/launch-list/index.html'), notFound: file('public/404.html'),
    layout: layout({ title: 't', description: 'd', path: '/', body: '' }), tool: renderTool(toolBySlug('ollama')) };
  for (const [name, html] of Object.entries(pages)) {
    const head = html.slice(0, html.indexOf('</head>'));
    assert.ok(head.includes(launchLockHead()), `${name}: the same head block (npm run build:home for the static pages)`);
    const first = [...html.matchAll(/<script\b[^>]*>/g)].map(m => m[0]).find(tag => !/application\/ld\+json/.test(tag));
    assert.equal(first, `<script src="${asset('launch-lock.js')}">`, `${name}: first script, not deferred`);
  }
});

test('before launch: locked everywhere except the pages makers need, which get the countdown bar', () => {
  const before = OPENS - 1000;
  for (const path of ['/', '/index.html', '/launch-list/', '/launches/', '/category/careers/', '/faq/', '/request/', '/how-voting-works/', '/launch/some-tool/', '/nope/']) {
    assert.ok(LOCK.shouldLock(path, before, OPENS), `${path} locked`);
    assert.ok(!LOCK.shouldBar(path, before, OPENS), `${path} no bar`);
  }
  for (const path of ['/tool/ollama/', '/tool/ollama', '/makers/', '/submit/', '/privacy/', '/contact/', '/security/', '/how-we-check/', '/unsubscribe/', '/launch/some-tool/kit/']) {
    assert.ok(!LOCK.shouldLock(path, before, OPENS), `${path} open for makers`);
    assert.ok(LOCK.shouldBar(path, before, OPENS), `${path} shows the countdown bar`);
  }
});

test('at launch time and after, nothing is locked and there is no bar; a missing or broken date never locks', () => {
  for (const now of [OPENS, OPENS + 1, OPENS + 86400000]) {
    for (const path of ['/', '/launch-list/', '/tool/ollama/']) {
      assert.ok(!LOCK.shouldLock(path, now, OPENS) && !LOCK.shouldBar(path, now, OPENS), `${path} at ${now - OPENS}ms`);
    }
  }
  assert.ok(!LOCK.shouldLock('/', OPENS - 1000, NaN), 'no date: no lock');
});

test('the countdown splits the time left into days, hours, minutes and seconds', () => {
  assert.deepEqual({ ...LOCK.left(((3 * 24 + 4) * 3600 + 5 * 60 + 6) * 1000) }, { d: 3, h: 4, m: 5, s: 6 });
  assert.deepEqual({ ...LOCK.left(-5000) }, { d: 0, h: 0, m: 0, s: 0 });
});

test('the curtain says when OpenOrbia launches, keeps the waitlist and the maker link, and reloads into the live site at zero', () => {
  const js = file('public/assets/launch-lock.js');
  assert.match(js, /12:00 AM Central/);
  assert.match(js, /href="#join"|href="\/#join"/, 'the launch email signup stays reachable');
  assert.match(js, /href="\/makers\/"/);
  assert.match(js, /location\.reload\(\)/);
  assert.doesNotMatch(js, /\beval\(|new Function\(/);
});
