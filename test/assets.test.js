import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { VERSIONS, asset } from '../lib/asset-versions.js';
import { layout } from '../lib/layout.js';
import { renderSubmit, renderRequest } from '../lib/form-pages.js';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex').slice(0, 10);
const NAMES = readdirSync(new URL('../public/assets/', import.meta.url)).filter(f => /\.(css|js)$/.test(f)).sort();
const STATIC = ['public/index.html', 'public/launch-list/index.html', 'public/404.html'];
const STALE = 'run npm run stamp';

test('every CSS and JS file in public/assets/ has a version, and it matches the file as it is now', () => {
  assert.deepEqual(Object.keys(VERSIONS).sort(), NAMES);
  for (const name of NAMES) assert.equal(VERSIONS[name], hash(file(`public/assets/${name}`)), `${name}: ${STALE}`);
  assert.equal(asset('launch.css'), `/assets/launch.css?v=${VERSIONS['launch.css']}`);
});

test('the imports between modules carry the current version of what they import', () => {
  for (const name of NAMES.filter(n => n.endsWith('.js'))) {
    for (const [, dep, v] of file(`public/assets/${name}`).matchAll(/from\s*["']\.\/([a-z0-9-]+\.js)(?:\?v=([0-9a-f]+))?["']/g)) {
      assert.equal(v, VERSIONS[dep], `${name} imports ${dep}: ${STALE}`);
    }
  }
});

test('every page links to /assets/ with the current version, and never without one', () => {
  const pages = {
    ...Object.fromEntries(STATIC.map(f => [f, file(f)])),
    layout: layout({ title: 't', description: 'd', path: '/', body: '' }),
    submit: renderSubmit({ siteKey: 'k' }), request: renderRequest({ siteKey: 'k' }),
  };
  for (const [name, html] of Object.entries(pages)) {
    const links = [...html.matchAll(/["']\/assets\/([a-z0-9-]+\.(?:css|js))(\?v=[0-9a-f]+)?["']/g)];
    assert.ok(links.length >= 1, `${name} links to assets`);
    for (const [, f, v] of links) assert.equal(v, `?v=${VERSIONS[f]}`, `${name}: /assets/${f} ${STALE}`);
  }
});

test('npm run deploy stamps the assets and runs the tests before it uploads anything', () => {
  const { scripts } = JSON.parse(file('package.json'));
  assert.equal(scripts.stamp, 'node scripts/stamp-assets.mjs');
  for (const name of ['deploy', 'deploy:preview']) {
    assert.match(scripts[name], /^npm run stamp && npm test && npx wrangler pages deploy --project-name openorbia --branch (main|launch-day)$/, name);
  }
});
