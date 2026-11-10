#!/usr/bin/env node
// Checks that no audited page is wider than a 375px phone screen (no sideways scrolling), in a real browser.
//
//   PLAYWRIGHT_DIR=/tmp/pw node scripts/check-width.mjs https://pr-12.openorbia.pages.dev
//
// Playwright is not a dependency of this repository: CI installs it into a temporary folder (PLAYWRIGHT_DIR, with
// `npm install --no-save --prefix`) and runs this after deploying a pull request's preview. Exit 1 when a page is too wide.

import { createRequire } from 'node:module';
import { resolve } from 'node:path';

export const PAGES = ['/', '/launch-list/', '/tool/jan/', '/launches/', '/submit/', '/request/', '/contact/', '/privacy/', '/faq/'];
export const WIDTH = 375;

const base = (process.argv[2] || '').replace(/\/$/, '');
if (!/^https:\/\/[a-z0-9.-]+$/i.test(base)) { console.error('Usage: node scripts/check-width.mjs https://<host>'); process.exit(2); }
const { chromium } = createRequire(resolve(process.env.PLAYWRIGHT_DIR || '.', 'package.json'))('playwright');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: WIDTH, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'OpenOrbiaWidthCheck/1.0' });
let failed = 0;
for (const path of PAGES) {
  const page = await context.newPage();
  let res = null;
  for (let attempt = 1; attempt <= 3 && !(res && res.ok()); attempt++) {
    res = await page.goto(base + path, { waitUntil: 'load', timeout: 60000 }).catch(() => null);
    if (!(res && res.ok())) await page.waitForTimeout(5000 * attempt); // a fresh preview can take a moment to answer
  }
  if (!(res && res.ok())) { console.log(`FAIL ${path}: HTTP ${res ? res.status() : 'no answer'}`); failed++; await page.close(); continue; }
  await page.waitForTimeout(1500);
  const r = await page.evaluate(w => {
    // On a phone, content wider than the screen widens the layout viewport itself, so measure against the phone width
    const wide = [];
    for (const el of document.querySelectorAll('body *')) {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.right > w + 1 && getComputedStyle(el).position !== 'fixed') wide.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''} (right edge ${Math.round(b.right)}px)`);
    }
    return { width: document.documentElement.scrollWidth, wide: wide.slice(0, 5) };
  }, WIDTH);
  const ok = r.width <= WIDTH + 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${path}: ${r.width}px wide${ok ? '' : `; too wide: ${r.wide.join(', ')}`}`);
  if (!ok) failed++;
  await page.close();
}
await browser.close();
console.log(failed ? `${failed} page(s) wider than ${WIDTH}px` : `Every page fits a ${WIDTH}px screen`);
process.exit(failed ? 1 : 0);
