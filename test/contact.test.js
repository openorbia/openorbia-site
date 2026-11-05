// /contact/ (lib/contact.js) and the footer links to it
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { renderContact, contactResponse, CORRECTION_MAILTO } from '../lib/contact.js';
import { renderPrivacy } from '../lib/privacy.js';
import { STATIC_PATHS } from '../lib/seo.js';
import { footerHtml } from '../lib/footer.js';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const html = renderContact();

test('/contact/ is a normal page: 200 HTML, title and canonical, its own route with security headers, in the sitemap', () => {
  const res = contactResponse();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.ok(html.includes('<title>Contact | OpenOrbia</title>') && html.includes('<link rel="canonical" href="https://openorbia.com/contact/">'));
  for (const f of ['functions/contact/index.js', 'functions/contact/_middleware.js']) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
  assert.ok(file('functions/contact/_middleware.js').includes("export { onRequest } from '../../lib/security-headers.js';"));
  assert.ok(STATIC_PATHS.includes('/contact/'));
});

test('the address is plain text in the page (readable and selectable without JavaScript), with a Copy button and a mailto link', () => {
  assert.ok(html.includes('<code id="ct-mail">hello@openorbia.com</code>'), 'the address is in the HTML itself');
  assert.ok(html.includes('<button class="copy" type="button" data-copy="hello@openorbia.com" data-copied="Copied"'));
  assert.ok(html.includes('<a class="btn ghost" href="mailto:hello@openorbia.com">Open in your email app</a>'));
  assert.ok(html.includes('<p>We aim to reply within 7 days.</p>'));
  assert.match(file('public/assets/launch.css'), /\.contact code\{[^}]*user-select:all/, 'one click selects the whole address');
  // no inline script: only the shared scripts from /assets/ (the CSP forbids inline ones)
  for (const m of html.matchAll(/<script\b[^>]*>/gi)) assert.match(m[0], /src="\/assets\/[a-z-]+\.js\?v=[0-9a-f]{10}"/, m[0]);
  assert.ok(html.includes('<script src="/assets/launch.js?v='), 'the shared copy handler is loaded');
});

test('the Copy button (public/assets/launch.js) copies the address, shows "Copied" for 2 seconds, then puts the label back', async () => {
  const handlers = [], timers = [], copied = [];
  const button = { dataset: { copy: 'hello@openorbia.com', copied: 'Copied' }, textContent: 'Copy', parentElement: { querySelector: () => null } };
  button.closest = sel => (sel === '[data-copy]' ? button : null);
  const ctx = {
    document: { addEventListener: (type, fn) => handlers.push([type, fn]), querySelectorAll: () => [], querySelector: () => null, getElementById: () => null },
    navigator: { clipboard: { writeText: async t => { copied.push(t); } } },
    setTimeout: (fn, ms) => { timers.push([fn, ms]); return 0; }, setInterval: () => 0, clearInterval: () => {},
    getSelection: () => ({ removeAllRanges() {}, addRange() {} }), WeakMap, Date, Number, String, Math, JSON, URL, console,
    fetch: async () => ({ ok: false, json: async () => ({}) }), location: { pathname: '/contact/' },
  };
  ctx.window = ctx;
  vm.runInNewContext(file('public/assets/launch.js'), ctx);
  const click = handlers.find(([t]) => t === 'click')[1];
  await click({ target: button });
  assert.deepEqual(copied, ['hello@openorbia.com']);
  assert.equal(button.textContent, 'Copied');
  const back = timers.find(([, ms]) => ms === 2000);
  assert.ok(back, 'resets after 2 seconds');
  back[0]();
  assert.equal(button.textContent, 'Copy');
});

test('"Looking for something specific?" lists the four requests, each going to the right place', () => {
  assert.ok(html.includes('<h2 id="ct-list-h">Looking for something specific?</h2>'));
  assert.ok(html.includes('<li><a href="/submit/">Submit a tool</a>'));
  assert.ok(html.includes('<li><a href="/request/">Find my free setup</a>'));
  assert.ok(html.includes('<li><a href="/security/">Report a security issue</a>'));
  assert.equal(CORRECTION_MAILTO, 'mailto:launch@openorbia.com?subject=Correction%3A%20');
  assert.ok(html.includes(`email <a href="${CORRECTION_MAILTO}">launch@openorbia.com</a> with the tool’s name in the subject.`));
  for (const f of ['functions/submit/index.js', 'functions/request/index.js', 'functions/security/index.js']) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
});

test('the footer: "Contact" in the bottom bar and "Contact us" in the OpenOrbia column both go to /contact/, on every page', () => {
  const f = footerHtml(2026);
  assert.ok(f.includes('<a href="/contact/">Contact</a></nav>'));
  assert.ok(f.includes('<a href="/contact/">Contact us</a>'));
  for (const p of ['public/index.html', 'public/launch-list/index.html', 'public/404.html']) {
    const h = file(p);
    assert.ok(h.includes('<a href="/contact/">Contact</a></nav>') && h.includes('<a href="/contact/">Contact us</a>'), p);
  }
});

test('/privacy/: Cloudflare\'s own privacy policy is named for the spam check, right after the Turnstile sentence', () => {
  const p = renderPrivacy();
  assert.ok(p.includes('it runs in your browser and connects to Cloudflare directly. Cloudflare’s own privacy policy applies to the spam check.'));
});
