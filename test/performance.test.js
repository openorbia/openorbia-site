// Page weight and first paint: the fonts are served from openorbia.com (lib/fonts.js), with metric-matched fallbacks, and Cloudflare
// Turnstile loads only when someone starts using a form (public/assets/turnstile.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import vm from 'node:vm';
import { FONTS, FONT_CSS, FONT_PRELOADS, STACKS, fontUrl } from '../lib/fonts.js';
import { CSP } from '../lib/security-headers.js';
import { layout } from '../lib/layout.js';
import { renderSubmit, renderRequest } from '../lib/form-pages.js';

const root = new URL('../', import.meta.url);
const file = f => readFileSync(new URL(f, root), 'utf8');
const STYLESHEETS = ['public/assets/launch.css', 'public/index.html', 'public/launch-list/index.html'];
const PAGES = {
  home: file('public/index.html'), list: file('public/launch-list/index.html'), notFound: file('public/404.html'),
  layout: layout({ title: 't', description: 'd', path: '/', body: '' }),
  submit: layout({ title: 't', description: 'd', path: '/submit/', body: renderSubmit({ siteKey: '1x00000000000000000000AA' }) }),
  request: layout({ title: 't', description: 'd', path: '/request/', body: renderRequest({ siteKey: '1x00000000000000000000AA' }) }),
};

// ---- fonts ----

test('the four fonts are WOFF2 files in public/assets/fonts/, small, each with its SIL Open Font License', () => {
  const dir = new URL('public/assets/fonts/', root);
  for (const f of FONTS) {
    const bytes = readFileSync(new URL(f.file, dir));
    assert.equal(bytes.subarray(0, 4).toString('latin1'), 'wOF2', f.file);
    assert.ok(bytes.length < 60 * 1024, `${f.file}: ${bytes.length} bytes`);
  }
  assert.ok(statSync(new URL('bricolage-grotesque-v9-wordmark.woff2', dir)).size < 5 * 1024, 'the wordmark font holds only the letters of "OpenOrbia"');
  const licenses = readdirSync(dir).filter(f => f.startsWith('OFL-'));
  assert.deepEqual(licenses.sort(), ['OFL-Bricolage-Grotesque.txt', 'OFL-IBM-Plex-Sans.txt', 'OFL-JetBrains-Mono.txt', 'OFL-Sora.txt']);
  for (const l of licenses) assert.ok(readFileSync(new URL(l, dir), 'utf8').includes('SIL OPEN FONT LICENSE Version 1.1'), l);
});

test('every stylesheet has the same @font-face rules (lib/fonts.js) and font stacks: each web font, then its metric-matched fallback', () => {
  for (const f of STYLESHEETS) {
    const css = file(f);
    assert.ok(css.includes(FONT_CSS), `${f}: FONT_CSS`);
    for (const [name, stack] of Object.entries(STACKS)) assert.ok(css.includes(`--${name}:${stack};`), `${f}: --${name}`);
  }
  for (const f of FONTS) {
    assert.ok(FONT_CSS.includes(`font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:swap;src:url(${fontUrl(f.file)}) format("woff2")`), f.family);
    assert.ok(FONT_CSS.includes(`@font-face{font-family:"${f.family} Fallback";`), `${f.family}: has a fallback`);
  }
  for (const stack of Object.values(STACKS)) assert.match(stack, /^"([^"]+)","\1 Fallback",/);
  // every weight the site uses has a fallback face
  for (const [family, weights] of [['Sora', [700, 800]], ['IBM Plex Sans', [400, 500, 600]], ['JetBrains Mono', [500]], ['Bricolage Grotesque', [800]]]) {
    for (const w of weights) assert.ok(new RegExp(`font-family:"${family} Fallback";[^}]*font-weight:${w};size-adjust:\\d`).test(FONT_CSS), `${family} ${w}`);
  }
});

test('every page preloads the two fonts above the fold, Sora and IBM Plex Sans, and nothing else', () => {
  assert.equal(FONT_PRELOADS, [
    '<link rel="preload" href="/assets/fonts/sora-v17-latin.woff2" as="font" type="font/woff2" crossorigin>',
    '<link rel="preload" href="/assets/fonts/ibm-plex-sans-v23-latin.woff2" as="font" type="font/woff2" crossorigin>',
  ].join('\n'));
  for (const [name, html] of Object.entries(PAGES)) {
    const head = html.slice(0, html.indexOf('</head>'));
    assert.ok(head.includes(FONT_PRELOADS), `${name}: preloads`);
    assert.equal(head.split('rel="preload"').length - 1, 2, `${name}: two preloads`);
  }
});

test('no page loads anything from Google, and the Content Security Policy no longer allows it', () => {
  const GOOGLE = /googleapis\.com|gstatic\.com|google-analytics|googletagmanager|fonts\.google/i;
  for (const [name, html] of Object.entries(PAGES)) assert.ok(!GOOGLE.test(html), name);
  const assets = readdirSync(new URL('public/assets/', root)).filter(f => /\.(css|js)$/.test(f));
  for (const f of assets) assert.ok(!GOOGLE.test(file(`public/assets/${f}`)), f);
  for (const f of readdirSync(new URL('lib/', root)).filter(f => f.endsWith('.js'))) assert.ok(!GOOGLE.test(file(`lib/${f}`)), `lib/${f}`);
  assert.ok(!/google|gstatic/.test(CSP));
  assert.ok(CSP.includes("style-src 'self' 'unsafe-inline';") && CSP.includes("font-src 'self';"));
  assert.ok(file('public/_headers').includes(CSP), 'public/_headers sends the same policy');
});

// ---- Turnstile ----

test('no page loads Turnstile up front: the homepage and the forms load public/assets/turnstile.js, which loads it on first use', () => {
  for (const [name, html] of Object.entries(PAGES)) assert.ok(!html.includes('challenges.cloudflare.com/turnstile/v0/api.js'), name);
  for (const name of ['home', 'submit', 'request']) assert.match(PAGES[name], /<script src="\/assets\/turnstile\.js\?v=[0-9a-f]{10}" defer><\/script>/, name);
  assert.ok(PAGES.home.includes('<div class="cf-turnstile" data-sitekey="0x4AAAAAAFs-XgBfIiYO5loz" data-theme="dark" data-appearance="interaction-only"></div>'), 'still interaction-only');
  const js = file('public/assets/turnstile.js');
  assert.ok(js.includes("'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=openorbiaTurnstileReady'"), 'explicit rendering');
  // the policy for Turnstile is unchanged
  assert.ok(CSP.includes("script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com") && CSP.includes('frame-src https://challenges.cloudflare.com'));
});

test('without JavaScript the forms still post to the server', () => {
  assert.match(PAGES.home, /<form id="wl" class="wl" method="post" action="\/api\/waitlist" novalidate>/);
  assert.match(PAGES.submit, /<form class="form" id="form" data-kind="submit" action="\/api\/submit" method="post" novalidate>/);
  assert.match(PAGES.request, /<form class="form" id="form" data-kind="request" action="\/api\/request" method="post" novalidate>/);
});

// A tiny DOM, enough for turnstile.js
function fakePage(boxes) {
  const listeners = [], appended = [];
  const form = { addEventListener: (type, fn, opts) => listeners.push({ type, fn, opts }) };
  const els = boxes.map(dataset => ({ dataset: { ...dataset }, closest: () => form }));
  const rendered = [];
  const window = {};
  const ctx = {
    window, document: { querySelectorAll: () => els, createElement: () => ({}), head: { append: s => appended.push(s) } },
  };
  window.turnstile = { render: (el, opts) => rendered.push(opts) };
  vm.runInNewContext(file('public/assets/turnstile.js'), ctx);
  return { listeners, appended, rendered, window };
}

test('turnstile.js fetches nothing until the first focus, typing or tap in the form, then loads the script once and renders each widget', () => {
  const p = fakePage([{ sitekey: 'k1', theme: 'dark', appearance: 'interaction-only' }]);
  assert.equal(p.appended.length, 0, 'nothing loaded with the page');
  assert.equal(p.listeners.map(l => l.type).join(), 'focusin,input,pointerdown');
  assert.ok(p.listeners.every(l => l.opts.once && l.opts.passive));
  p.listeners[0].fn();
  p.listeners[1].fn();
  p.window.openorbiaCheck();
  assert.equal(p.appended.length, 1, 'loaded once');
  assert.equal(p.appended[0].src, 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=openorbiaTurnstileReady');
  p.window.openorbiaTurnstileReady();
  p.window.openorbiaTurnstileReady();
  // JSON, because objects made inside the vm sandbox belong to another realm
  assert.equal(JSON.stringify(p.rendered), JSON.stringify([{ sitekey: 'k1', theme: 'dark', appearance: 'interaction-only' }]), 'rendered once, with the widget\'s own settings');
  // a page with no widget does nothing
  const none = fakePage([]);
  assert.equal(none.listeners.length + none.appended.length, 0);
  assert.equal(none.window.openorbiaCheck, undefined);
});

test('sending before the check started starts it and waits for the token ("Checking..."), on the homepage and on the forms', () => {
  const home = file('public/assets/home.js'), forms = file('public/assets/forms.js');
  assert.ok(home.includes("if(!token){if(window.openorbiaCheck)window.openorbiaCheck();btn.textContent='Checking...';token=await waitForCheck();}"));
  assert.ok(forms.includes("if (window.openorbiaCheck) window.openorbiaCheck();\n      btn.textContent = 'Checking...';\n      data.turnstile = await waitForToken();"));
});
