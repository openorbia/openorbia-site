#!/usr/bin/env node
// Works out the metric-matched fallback @font-face rules in lib/fonts.js: a local system font (Arial, Arial Bold or Courier New)
// scaled so text is the same width, and sits on the same baseline, as it is in each self-hosted web font (public/assets/fonts/).
// With them, text wraps the same before and after a web font loads, so nothing jumps when it swaps in.
//
//   npm install --no-save --prefix /tmp/fk fontkit playwright && /tmp/fk/node_modules/.bin/playwright install chromium
//   TOOLS_DIR=/tmp/fk node scripts/font-fallback.mjs        (on a computer with Arial and Courier New, e.g. Windows or macOS)
//
// size-adjust is fitted to real text of the site (the samples below; update them if the copy changes a lot), measured in Chromium at
// each weight (fontkit cannot read a weight's advances from these variable WOFF2 files). ascent / descent / line-gap overrides are the
// web font's own vertical metrics (read with fontkit) divided by size-adjust, because size-adjust also scales the metrics.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const need = createRequire(resolve(process.env.TOOLS_DIR || '.', 'package.json'));
const fontkit = need('fontkit');
const { chromium } = need('playwright');
const FONTS = fileURLToPath(new URL('../public/assets/fonts/', import.meta.url));

const HEADINGS = [
  'Where free AI tools take off.', 'Small businesses', 'Job seekers', 'Security teams', 'Launch Week 1 is coming', 'Get in before the first launch.',
  '44 free AI tools, checked before they launch.', 'Launch your free AI tool, for free.', 'What makers get', 'A launch page', 'Community upvotes',
  'Launch Week 1', 'Makers launch free AI tools', 'The community upvotes', "The week's top tools get featured", 'Page not found.',
  'Ready to launch?', 'Dark badge', 'Light badge', 'Launching weekly.',
];
const BODY = [
  'Open-source and free AI tools for small businesses, job seekers and security teams.',
  'Every tool here has an open license or a real free plan, was updated in the last 6 months, and uses AI as a core feature.',
  'No trials, no paywalls. How we check tools. Runs on your computer. Install & self-host. Browser, ready to use.',
  'Free launches every week. No paid placement, ever. Makers launch free AI tools and the community upvotes them.',
];
const MONO = ['LAUNCH LIST · PREVIEW', 'ollama run llama3.2', 'docker compose up -d', '43 TOOLS', 'RUNS FREE'];

// Sora's wide letters make a pure width fit wrap one word early on headlines that fit Sora by a hair (the /makers/ headline at 375px).
// Tested against Sora blocked at 1280 / 390 / 375 / 360 px, a fit 3% narrower matched every headline break.
const NARROWER = { Sora: 0.97 };

const ARIAL = w => (w >= 600 ? ['Arial Bold', 'Arial-BoldMT', 'Arial'] : ['Arial', 'ArialMT']);
const FAMILIES = [
  { family: 'Sora', file: 'sora-v17-latin.woff2', weights: [700, 800], local: ARIAL, system: 'Arial', text: HEADINGS },
  { family: 'IBM Plex Sans', file: 'ibm-plex-sans-v23-latin.woff2', weights: [400, 500, 600], local: ARIAL, system: 'Arial', text: BODY },
  { family: 'JetBrains Mono', file: 'jetbrains-mono-v24-latin.woff2', weights: [500], local: () => ['Courier New', 'CourierNewPSMT'], system: 'Courier New', text: MONO },
  { family: 'Bricolage Grotesque', file: 'bricolage-grotesque-v9-wordmark.woff2', weights: [800], local: ARIAL, system: 'Arial', text: ['OpenOrbia'] },
];

const pct = n => `${Math.round(n * 10000) / 100}%`;

// The sample text's width at 100px in a real browser: the web font (from its file) at the given weight, divided by the system face
// the fallback uses (Arial Bold from 600 up, else the regular face).
const browser = await chromium.launch();
const page = await browser.newPage();
const ratio = (file, family, system, weight, texts) => page.evaluate(async ({ bytes, family, system, weight, texts }) => {
  const face = new FontFace(`M-${family}`, new Uint8Array(bytes), { weight: '100 900' });
  await face.load();
  document.fonts.add(face);
  const ctx = new OffscreenCanvas(10, 10).getContext('2d');
  const total = font => texts.reduce((sum, t) => { ctx.font = font; return sum + ctx.measureText(t).width; }, 0);
  return total(`${weight} 100px "M-${family}"`) / total(`${weight >= 600 ? 700 : 400} 100px "${system}"`);
}, { bytes: [...readFileSync(file)], family, system, weight, texts });

for (const f of FAMILIES) {
  const file = join(FONTS, f.file), web = fontkit.openSync(file);
  for (const w of f.weights) {
    const adjust = await ratio(file, f.family, f.system, w, f.text) * (NARROWER[f.family] || 1);
    console.log(`@font-face{font-family:"${f.family} Fallback";src:${f.local(w).map(n => `local("${n}")`).join(',')};font-weight:${w};` +
      `size-adjust:${pct(adjust)};ascent-override:${pct(web.ascent / web.unitsPerEm / adjust)};descent-override:${pct(-web.descent / web.unitsPerEm / adjust)};` +
      `line-gap-override:${pct(web.lineGap / web.unitsPerEm / adjust)}}`);
  }
}
await browser.close();
