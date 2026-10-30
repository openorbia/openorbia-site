#!/usr/bin/env node
// Builds the "Featured on OpenOrbia" badges (public/badge/featured.svg, featured-dark.svg, featured-light.svg).
//
// The text is converted to SVG paths, so a badge looks the same everywhere (GitHub READMEs and <img> tags never load web fonts).
// "OpenOrbia" is the header wordmark exactly: Bricolage Grotesque 800 at 22px, letter-spacing -0.03em, "Open" solid and "Orbia" in the
// wordmark gradient. "Featured on" is IBM Plex Sans 500.
//
// It needs fontkit, which the site itself does not use, so install it without saving it, then run the script:
//   npm install --no-save fontkit
//   node scripts/build-badges.mjs
// (the fonts are downloaded from Google Fonts each time)

import { writeFileSync, mkdirSync } from 'node:fs';
import * as fontkit from 'fontkit';

const OUT = process.argv[2] || 'public/badge';
const UA_TTF = 'curl/8.7.1';   // Google Fonts answers an unknown user agent with plain TrueType files

// ---- fonts ----
const WORD_SIZE = 22;          // the header wordmark's size; the browser sets Bricolage's optical size to the font size
const pickUrl = css => { const m = css.match(/url\((https:[^)]+)\)/); if (!m) throw new Error('font file not found'); return m[1]; };
const fontFile = async cssUrl => {
  const css = await (await fetch(cssUrl, { headers: { 'user-agent': UA_TTF } })).text();
  return fontkit.create(Buffer.from(await (await fetch(pickUrl(css))).arrayBuffer()));
};
// Bricolage Grotesque is a variable font (optical size x weight): ask Google for the instance at exactly 22px and weight 800
const brick = await fontFile(`https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@${WORD_SIZE},800`);
const plex = await fontFile('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@500');

// ---- text -> path ----
// Lays the text out like the browser does (the font's own kerning), with letter-spacing added after every glyph.
// -> { parts: [{ d, from }] one per glyph (absolute path data, y down), ink: { left, right } }
const r2 = n => Math.round(n * 100) / 100;
const r1 = n => Math.round(n * 10) / 10;
const CMD = { moveTo: 'm', lineTo: 'l', quadraticCurveTo: 'q', bezierCurveTo: 'c', closePath: 'z' };
// compact numbers for path data: "0.5" -> ".5", "-0.5" -> "-.5", "2.0" -> "2"
const num = n => String(r1(n)).replace(/^(-?)0\./, '$1.');
const join = nums => nums.map(num).join(' ').replace(/ -/g, '-');
function textPath(font, text, { size, x, y, spacingEm = 0 }) {
  const run = font.layout(text);
  const k = size / font.unitsPerEm;
  let pen = x; const parts = []; const ink = { left: Infinity, right: -Infinity };
  run.glyphs.forEach((g, i) => {
    const kern = run.positions[i].xAdvance - g.advanceWidth;   // pair kerning from the font
    // relative commands at one decimal (a badge is ~190px wide, so 0.1px is invisible); the running point is the rounded one, so
    // the rounding never adds up along a glyph. The first move is absolute.
    let d = ''; let cx = 0, cy = 0, sx = 0, sy = 0, first = true;
    for (const c of g.path.commands) {
      if (c.command === 'closePath') { d += 'z'; cx = sx; cy = sy; continue; }
      const abs = c.args.map((v, j) => (j % 2 === 0 ? pen + v * k : y - v * k));
      if (first && c.command === 'moveTo') { d += 'M' + join([abs[0], abs[1]]); cx = r1(abs[0]); cy = r1(abs[1]); sx = cx; sy = cy; first = false; continue; }
      const rel = []; let px = cx, py = cy;
      for (let j = 0; j < abs.length; j += 2) { const ax = r1(abs[j]), ay = r1(abs[j + 1]); rel.push(r1(ax - cx), r1(ay - cy)); px = ax; py = ay; }
      d += CMD[c.command] + join(rel);
      cx = px; cy = py;
      if (c.command === 'moveTo') { sx = cx; sy = cy; }
    }
    if (g.path.commands.length) {
      ink.left = Math.min(ink.left, pen + g.bbox.minX * k);
      ink.right = Math.max(ink.right, pen + g.bbox.maxX * k);
    }
    parts.push({ d, from: pen });
    pen += (g.advanceWidth + kern) * k + spacingEm * size;
  });
  return { parts, ink };
}

// ---- colors ----
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const HEADER_GRADIENT = ['#9fb2ff', '#5b7cff', '#a07bff'];   // the .grad gradient used by the header wordmark
// slightly deeper for a white background: keep each stop's hue and saturation and lower the lightness, all stops by the same step,
// just until every stop reads at 3.2:1 or better (the wordmark is large text, which needs 3:1)
function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
function deeper(stops, bg, min = 3.2) {
  const hsl = stops.map(s => toHsl(hex(s)));
  for (let step = 0; step <= 0.5; step += 0.005) {
    const out = hsl.map(([h, s, l]) => fromHsl([h, s, Math.max(0, l - step)]));
    if (out.every(c => contrast(c, bg) >= min)) return out.map(toHex);
  }
  throw new Error('no deeper gradient found');
}

const THEMES = {
  dark: { id: 'd', bg: '#0b1020', stroke: '#3a4678', sub: '#9aa6c8', open: '#eef2ff', grad: HEADER_GRADIENT, ring: ['#9fb2ff', '#7fe7ff'] },
  light: { id: 'l', bg: '#ffffff', stroke: '#c3cdee', sub: '#4a5578', open: '#0b1020', grad: deeper(HEADER_GRADIENT, [255, 255, 255]), ring: ['#4258d8', '#5fb6d4'] },
};

// ---- layout (all numbers in px; the badge is 56 high) ----
const H = 56, PAD = 16, GAP = 12;
const WORD = { size: WORD_SIZE, spacingEm: -0.03 };          // the header wordmark: 22px, 800, -0.03em
const SUB = { size: 11, spacingEm: 0.05 };

// the planet (same drawing as the logo, smaller): ring ellipse tilted -24 degrees, orb, and the small sun
const RING = { rx: 20, ry: 7, tilt: -24, sw: 2.6, orb: 10, sun: { dx: 15, dy: -15, r: 3.4 } };
function planetBounds() {
  const t = RING.tilt * Math.PI / 180; let minX = Infinity, maxX = -Infinity;
  for (let a = 0; a < 360; a += 1) {
    const th = a * Math.PI / 180, px = RING.rx * Math.cos(th), py = RING.ry * Math.sin(th);
    const x = px * Math.cos(t) - py * Math.sin(t);
    minX = Math.min(minX, x - RING.sw / 2); maxX = Math.max(maxX, x + RING.sw / 2);
  }
  return { minX, maxX };
}

function build(theme) {
  const pb = planetBounds();
  const cx = PAD - pb.minX;                         // planet centre so that its left edge sits exactly PAD from the badge edge
  const cy = 29;
  const textX = cx + pb.maxX + GAP;
  const word = textPath(brick, 'OpenOrbia', { ...WORD, x: textX, y: 44 });
  const sub = textPath(plex, 'Featured on', { ...SUB, x: textX, y: 23 });
  const orbiaFrom = word.parts[4].from;             // "Orbia" starts at the fifth glyph
  const open = word.parts.slice(0, 4).map(p => p.d).join('');
  const orbia = word.parts.slice(4).map(p => p.d).join('');
  const inkLeft = cx + pb.minX;                     // = PAD
  const inkRight = Math.max(word.ink.right, sub.ink.right);
  const width = r2(inkRight + PAD);                 // so the right padding equals the left one
  const { id, bg, stroke, sub: subColor, open: openColor, grad, ring } = theme;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="img" aria-labelledby="${id}t" data-pad-left="${r2(inkLeft)}" data-pad-right="${r2(width - inkRight)}">
<title id="${id}t">Featured on OpenOrbia</title>
<defs>
<linearGradient id="${id}p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fa6ff"/><stop offset=".55" stop-color="#5b7cff"/><stop offset="1" stop-color="#7a4dff"/></linearGradient>
<linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${ring[0]}"/><stop offset="1" stop-color="${ring[1]}"/></linearGradient>
<linearGradient id="${id}w" gradientUnits="userSpaceOnUse" x1="${r2(orbiaFrom)}" y1="0" x2="${r2(word.ink.right)}" y2="0"><stop offset="0" stop-color="${grad[0]}"/><stop offset=".45" stop-color="${grad[1]}"/><stop offset="1" stop-color="${grad[2]}"/></linearGradient>
</defs>
<rect x=".75" y=".75" width="${r2(width - 1.5)}" height="${H - 1.5}" rx="14" fill="${bg}" stroke="${stroke}" stroke-width="1.5"/>
<g transform="translate(${r2(cx)} ${cy}) rotate(${RING.tilt})"><path d="M${-RING.rx} 0A${RING.rx} ${RING.ry} 0 0 1 ${RING.rx} 0" fill="none" stroke="url(#${id}r)" stroke-width="${RING.sw}" stroke-linecap="round" stroke-dasharray="34 80"/><circle r="${RING.orb}" fill="url(#${id}p)"/><path d="M${-RING.rx} 0A${RING.rx} ${RING.ry} 0 0 0 ${RING.rx} 0" fill="none" stroke="url(#${id}r)" stroke-width="${RING.sw}" stroke-linecap="round"/></g>
<circle cx="${r2(cx + RING.sun.dx)}" cy="${cy + RING.sun.dy}" r="${RING.sun.r}" fill="#ffd84d"/>
<path fill="${subColor}" d="${sub.parts.map(p => p.d).join('')}"/>
<path fill="${openColor}" d="${open}"/>
<path fill="url(#${id}w)" d="${orbia}"/>
</svg>
`;
  return { svg, width, padLeft: r2(inkLeft), padRight: r2(width - inkRight) };
}

mkdirSync(OUT, { recursive: true });
// featured.svg is the default: the dark badge (own ids, so inlining several badges in one page never clashes)
for (const [file, theme] of [['featured-dark.svg', THEMES.dark], ['featured.svg', { ...THEMES.dark, id: 'f' }], ['featured-light.svg', THEMES.light]]) {
  const b = build(theme);
  writeFileSync(`${OUT}/${file}`, b.svg);
  console.log(`${file}: ${b.width} x ${H}, ${Buffer.byteLength(b.svg)} bytes, padding ${b.padLeft} / ${b.padRight}, Orbia gradient ${theme.grad.join(' ')}`);
}
