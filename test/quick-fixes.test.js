// Accessibility and weight fixes from the live-site audit: the Launch List fits a phone, small favicons, a visible search focus
// ring, readable email addresses (Cloudflare Email Obfuscation off for page content), and an announced result for copy buttons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { layout } from '../lib/layout.js';
import { HEADER_CSS } from '../lib/header.js';

const root = new URL('../', import.meta.url);
const file = f => readFileSync(new URL(f, root), 'utf8');
const STATIC = ['public/index.html', 'public/launch-list/index.html', 'public/404.html'];
const PAGES = [...STATIC.map(f => [f, file(f)]), ['layout()', layout({ title: 'T', description: 'D', path: '/x/', body: '<p>Write to <a href="mailto:hello@openorbia.com">hello@openorbia.com</a></p>' })]];
const pngSize = f => { const b = readFileSync(new URL(f, root)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('the Launch List filter bar can shrink to a phone screen (its grid column no longer grows to fit every tab)', () => {
  assert.match(file('public/launch-list/index.html'), /\.bar\{[^}]*display:grid;grid-template-columns:minmax\(0,1fr\)/);
  const wf = file('.github/workflows/deploy.yml');
  assert.ok(wf.includes('node scripts/check-width.mjs "$PREVIEW_URL"'), 'every preview is checked at 375px');
  assert.ok(!JSON.parse(file('package.json')).devDependencies?.playwright && !JSON.parse(file('package.json')).dependencies?.playwright, 'Playwright stays out of package.json');
});

test('favicons: a 32px PNG and the 180px Apple touch icon; the 512px icon is only for structured data and emails', () => {
  assert.deepEqual(pngSize('public/favicon-32.png'), [32, 32]);
  assert.ok(statSync(new URL('public/favicon-32.png', root)).size < 8 * 1024);
  assert.deepEqual(pngSize('public/apple-touch-icon.png'), [180, 180]);
  for (const [name, html] of PAGES) {
    assert.ok(html.includes('<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">'), `${name}: 32px icon`);
    assert.ok(html.includes('<link rel="apple-touch-icon" href="/apple-touch-icon.png">'), `${name}: touch icon`);
    assert.ok(!/<link[^>]+icon-512\.png/.test(html), `${name}: the 512px file is not a page icon`);
  }
});

test('the header search box keeps the standard focus ring', () => {
  assert.ok(!/\.nsearch input:focus\{[^}]*outline:none/.test(HEADER_CSS));
  for (const f of ['public/assets/launch.css', ...STATIC]) assert.ok(!/\.nsearch input:focus\{[^}]*outline:none/.test(file(f)), f);
  assert.match(file('public/assets/launch.css'), /:focus-visible\{outline:2px solid var\(--blue-l\)/);
});

test('email addresses on every page sit inside <!--email_off-->, so Cloudflare leaves them readable', () => {
  for (const [name, html] of PAGES) {
    const body = html.slice(html.indexOf('<body'));
    assert.match(body, /^<body[^>]*>\n<!--email_off-->\n/, `${name}: opens right after <body>`);
    assert.match(body, /\n<!--\/email_off-->\n<\/body>/, `${name}: closes right before </body>`);
    const outside = body.replace(/<!--email_off-->[\s\S]*<!--\/email_off-->/, '');
    assert.ok(!/@openorbia\.com/.test(outside), `${name}: no address outside the markers`);
  }
});

test('copy buttons share one hidden status line that says what happened', () => {
  const js = file('public/assets/launch.js');
  assert.ok(js.includes("setAttribute('role', 'status')") && js.includes("announce('Copied to clipboard')") && js.includes("announce('Selected')"));
  assert.ok(js.includes("clipPath: 'inset(50%)'"), 'visually hidden, still read out');
  assert.ok(/if \(document\.querySelector\('\[data-copy\]'\)\)/.test(js), 'created once, before any click, only where there is a copy button');
  // the homepage button uses the shared handler too
  assert.ok(file('public/index.html').includes('<button class="copy" id="copyBtn" type="button" data-copy="launch@openorbia.com" data-copied="Copied">Copy</button>'));
  assert.ok(!file('public/assets/home.js').includes('clipboard'), 'no second copy handler on the homepage');
});
