import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SECURITY_HEADERS, CSP, onRequest } from '../lib/security-headers.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const file = f => readFileSync(join(root, f), 'utf8');
const walk = dir => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

test('public/_headers sends exactly the headers in lib/security-headers.js to every static file', () => {
  const lines = file('public/_headers').split('\n').filter(l => l.trim() && !l.startsWith('#'));
  // the file is rules: a URL pattern at the start of a line, then its indented headers
  const rules = {};
  let current;
  for (const l of lines) {
    if (!/^\s/.test(l)) { current = l.trim(); rules[current] = {}; continue; }
    const i = l.indexOf(':');
    rules[current][l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim();
  }
  assert.deepEqual(rules['/*'], SECURITY_HEADERS);
  assert.equal(rules['/assets/*']['cache-control'], 'public, max-age=0, must-revalidate', 'the asset cache rule is kept');
  for (const l of lines) assert.ok(l.length <= 2000, 'Cloudflare limits a _headers line to 2,000 characters');
});

test('every folder in functions/ adds the headers, and there is no root middleware (it would route every static file through Functions)', async () => {
  assert.ok(!existsSync(join(root, 'functions', '_middleware.js')));
  const dirs = readdirSync(join(root, 'functions')).filter(n => statSync(join(root, 'functions', n)).isDirectory());
  assert.ok(dirs.length >= 10);
  for (const d of dirs) {
    const mw = join(root, 'functions', d, '_middleware.js');
    assert.ok(existsSync(mw), `functions/${d}/_middleware.js`);
    assert.equal((await import(pathToFileURL(mw).href)).onRequest, onRequest, d);
  }
  const loose = readdirSync(join(root, 'functions')).filter(n => n.endsWith('.js'));
  assert.deepEqual(loose, ['sitemap.xml.js'], 'a new top-level function needs its own headers');
});

test('the middleware adds every header, replaces a shorter policy, and keeps the status, body and other headers', async () => {
  const page = await onRequest({ next: async () => new Response('<p>hi</p>', { status: 404, headers: { 'content-type': 'text/html', 'content-security-policy': "frame-ancestors 'none'", 'referrer-policy': 'no-referrer' } }) });
  assert.equal(page.status, 404);
  assert.equal(await page.text(), '<p>hi</p>');
  assert.equal(page.headers.get('content-type'), 'text/html');
  assert.equal(page.headers.get('content-security-policy'), CSP);
  assert.equal(page.headers.get('referrer-policy'), 'no-referrer', 'a header the route chose is kept');
  for (const name of ['strict-transport-security', 'x-content-type-options', 'x-frame-options', 'permissions-policy', 'cross-origin-opener-policy']) assert.equal(page.headers.get(name), SECURITY_HEADERS[name], name);
  const redirect = await onRequest({ next: async () => new Response(null, { status: 302, headers: { location: 'https://github.com/x/y' } }) });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), 'https://github.com/x/y');
});

test('no page has an inline script or inline event handler, so the policy can forbid them', () => {
  const sources = [...walk(join(root, 'public')).filter(f => f.endsWith('.html')), ...walk(join(root, 'lib')).filter(f => f.endsWith('.js') && !f.endsWith('email.js'))];
  for (const f of sources) {
    const text = readFileSync(f, 'utf8');
    for (const tag of text.match(/<script\b[^>]*>/g) || []) {
      if (/type="application\/(ld\+)?json"/.test(tag)) continue;   // data, never run
      assert.match(tag, /\bsrc=/, `${f}: inline <script>`);
    }
    assert.doesNotMatch(text, /<[a-z][^>]*\son(click|load|error|submit|change|input|mouseover)=/i, `${f}: inline event handler`);
  }
});

test('every external script, stylesheet and font the pages load is allowed by the policy', () => {
  const allowed = { script: CSP.match(/script-src ([^;]+)/)[1].split(' '), style: CSP.match(/style-src ([^;]+)/)[1].split(' ') };
  const sources = [...walk(join(root, 'public')).filter(f => f.endsWith('.html')), ...walk(join(root, 'lib')).filter(f => f.endsWith('.js'))];
  for (const f of sources) {
    const text = readFileSync(f, 'utf8');
    for (const [, src] of text.matchAll(/<script[^>]*\bsrc="(https:\/\/[^"/]+)/g)) assert.ok(allowed.script.includes(src), `${f}: script from ${src}`);
    for (const [, href] of text.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="(https:\/\/[^"/]+)/g)) assert.ok(allowed.style.includes(href), `${f}: stylesheet from ${href}`);
  }
  assert.ok(CSP.includes("frame-ancestors 'none'") && CSP.includes("object-src 'none'") && CSP.includes("base-uri 'self'"));
  assert.ok(!/script-src[^;]*'unsafe-(inline|eval)'/.test(CSP), 'scripts never allow inline or eval');
});
