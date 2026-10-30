#!/usr/bin/env node
// Works out the numbers for the "Sora Fallback" @font-face in the three stylesheets (public/index.html, public/launch-list/index.html,
// public/assets/launch.css): Arial Bold scaled so a heading is the same width, and sits on the same baseline, as it is in Sora.
// With it, headings wrap the same before and after Sora loads, so nothing jumps when the font swaps in.
//
//   npm install --no-save fontkit
//   node scripts/font-fallback.mjs [path/to/arialbd.ttf]        (Windows: C:/Windows/Fonts/arialbd.ttf, the default)
//
// It fits size-adjust to the real heading text of the site (the strings in HEADINGS below, so update them if the headlines change) and
// prints the CSS. ascent / descent / line-gap overrides are Sora's own vertical metrics divided by size-adjust, because size-adjust
// also scales the font's metrics.

import * as fontkit from 'fontkit';

const ARIAL_BOLD = process.argv[2] || 'C:/Windows/Fonts/arialbd.ttf';
const HEADINGS = [
  'Where free AI tools take off.', 'Small businesses', 'Job seekers', 'Security teams', 'Launch Week 1 is coming', 'Get in before the first launch.',
  '44 free AI tools, checked before they launch.', 'Launch your free AI tool, for free.', 'What makers get', 'A launch page', 'Community upvotes',
  'Launch Week 1', 'Makers launch free AI tools', 'The community upvotes', "The week's top tools get featured", 'Page not found.',
  'Ready to launch?', 'Dark badge', 'Light badge', 'Launching weekly.',
];

// A pure width fit is not enough. Sora's wide letters ("Launch", "Where") make the fallback wrap one word earlier on a line that fits Sora
// by a hair (the /makers/ headline at 375px). Testing the fallback against Sora blocked, at 1280 / 390 / 375 / 360 px on the four page
// types, a fit 3% narrower matched every headline break; a fallback that is too wide wraps early, one that is a little narrow does not.
const NARROWER = 0.97;

const UA = 'curl/8.7.1';   // Google Fonts answers an unknown user agent with plain TrueType files
const sora = async weight => {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Sora:wght@${weight}`, { headers: { 'user-agent': UA } })).text();
  return fontkit.create(Buffer.from(await (await fetch(css.match(/url\((https:[^)]+)\)/)[1])).arrayBuffer()));
};
const width = (font, text) => font.layout(text).positions.reduce((sum, p) => sum + p.xAdvance, 0) / font.unitsPerEm;   // in em, kerning included
const arial = fontkit.openSync(ARIAL_BOLD);
const pct = n => `${(Math.round(n * 10000) / 100).toString()}%`;
const fit = (s, weight) => HEADINGS.reduce((a, t) => a + width(s, t), 0) / HEADINGS.reduce((a, t) => a + width(arial, t), 0) * NARROWER;

for (const weight of [700, 800]) {
  const s = await sora(weight);
  const adjust = fit(s, weight);
  console.log(`@font-face{font-family:"Sora Fallback";src:local("Arial Bold"),local("Arial-BoldMT"),local("Arial");font-weight:${weight};` +
    `size-adjust:${pct(adjust)};ascent-override:${pct(s.ascent / s.unitsPerEm / adjust)};descent-override:${pct(-s.descent / s.unitsPerEm / adjust)};` +
    `line-gap-override:${pct(s.lineGap / s.unitsPerEm / adjust)}}`);
}
