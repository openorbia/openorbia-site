// Guards for what gets deployed: everything in public/ is uploaded by `wrangler pages deploy`, so placeholder content must
// never be in there.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test('no sample or placeholder file is in public/, so none can be deployed', () => {
  const files = walk(join(root, 'public')).map(p => p.slice(root.length).replaceAll('\\', '/'));
  assert.ok(files.length > 5, 'public/ should hold the site');
  assert.deepEqual(files.filter(f => /sample|placeholder/i.test(f)), []);
  const launches = join(root, 'public', 'launches');
  if (existsSync(launches)) assert.deepEqual(readdirSync(launches).filter(n => n.startsWith('sample-')), []);
});

test('public/404.html exists: without it Cloudflare Pages answers every unknown URL with the homepage and a 200', () => {
  const html = readFileSync(join(root, 'public', '404.html'), 'utf8');
  assert.match(html, /<title>Page not found \| OpenOrbia<\/title>/);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /href="\/assets\/launch\.css"/);
  assert.ok(!html.includes('rel="canonical"'), 'a 404 page has no canonical URL');
  for (const link of ['href="/"', 'href="/launches/"', 'href="/launch-list/"']) assert.ok(html.includes(link), link);
});

test('the sample images live in test/fixtures/launches/ instead', () => {
  const dirs = readdirSync(join(root, 'test', 'fixtures', 'launches'));
  assert.deepEqual(dirs.sort(), ['sample-business-tool', 'sample-job-tool', 'sample-security-tool']);
  for (const d of dirs) assert.ok(existsSync(join(root, 'test', 'fixtures', 'launches', d, 'logo.svg')), d);
});

test('the local preview adds the samples to a copy, and never touches public/', () => {
  const before = walk(join(root, 'public')).length;
  const out = execFileSync(process.execPath, [join(root, 'scripts', 'dev.mjs'), '--prepare-only'], { cwd: root, encoding: 'utf8' });
  assert.match(out, /Prepared \.wrangler\/dev-public/);
  const dev = join(root, '.wrangler', 'dev-public');
  assert.ok(existsSync(join(dev, 'index.html')), 'the site is in the preview copy');
  assert.ok(existsSync(join(dev, 'launches', 'sample-business-tool', 'logo.svg')), 'the sample images are in the preview copy');
  assert.equal(walk(join(root, 'public')).length, before, 'public/ is unchanged');
  assert.ok(!existsSync(join(root, 'public', 'launches', 'sample-business-tool')));
});

test('the seed script accepts sample entries whose images are only in test/fixtures, and the live seed skips them', () => {
  const run = args => execFileSync(process.execPath, [join(root, 'scripts', 'seed-launches.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  assert.match(run(['--dry-run']), /3 launches \(3 sample, 0 real\)/);
  assert.match(run(['--remote']), /Skipping 3 sample entries[\s\S]*Nothing to load/); // remote with only samples loads nothing, without touching wrangler
  assert.ok(readFileSync(join(root, 'data', 'launches.json'), 'utf8').includes('test/fixtures/launches/<slug>/'));
});
