#!/usr/bin/env node
// Draws the welcome email's header background, public/email/header.png: the site's navy with soft blue and violet glows, a field of
// stars and the orbit mark on the right, kept away from the left side where the logo, headline and badge sit. Email clients don't
// load web fonts or SVG reliably, so the decoration is one PNG; the email's header cell is solid navy underneath, so it still reads
// when images are blocked. No dependencies: the PNG is written with node:zlib. The drawing is fixed (seeded), so a rebuild gives
// the same file.
//
//   node scripts/build-email-art.mjs        (npm run build:email-art)

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(root, 'public', 'email', 'header.png');
const W = 1200, H = 440;                       // twice the 600px email width, so it stays sharp on phones
const px = new Float32Array(W * H * 3);

// the background: #0b1026 with two glows, as on the site
const NAVY = [11, 16, 38];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const glow = (cx, cy, r, c, a) => { const d = Math.hypot(x - cx, y - cy) / r; return d < 1 ? c.map(v => v * a * (1 - d) ** 2) : [0, 0, 0]; };
  const g1 = glow(980, 40, 620, [91, 124, 255], 0.42), g2 = glow(1180, 300, 480, [160, 123, 255], 0.28), g3 = glow(80, 460, 520, [127, 231, 255], 0.08);
  const i = (y * W + x) * 3;
  for (let k = 0; k < 3; k++) px[i + k] = NAVY[k] + g1[k] + g2[k] + g3[k];
}

// blend one pixel toward a colour
const plot = (x, y, c, a) => {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (Math.round(y) * W + Math.round(x)) * 3;
  for (let k = 0; k < 3; k++) px[i + k] = px[i + k] * (1 - a) + c[k] * a;
};
// a soft round dot
const dot = (cx, cy, r, c, a) => {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
    const d = Math.hypot(x - cx, y - cy);
    plot(x, y, c, a * Math.max(0, Math.min(1, r + 0.5 - d)));
  }
};

// stars: a seeded generator, so every build draws the same sky; fewer and fainter on the left, where the text is
let seed = 20261123;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
for (let n = 0; n < 230; n++) {
  const x = rand() * W, y = rand() * H, big = rand() < 0.12;
  const left = x < 620 ? 0.45 : 1;
  dot(x, y, big ? 1.8 : 0.9 + rand() * 0.6, [255, 255, 255], (0.25 + rand() * 0.55) * left);
}

// the orbit mark: a tilted ring around a planet, and a small sun, on the right
const P = { x: 1005, y: 190 }, tilt = -24 * Math.PI / 180;
const ring = (front) => {
  for (let t = 0; t < Math.PI * 2; t += 0.0015) {
    const ex = 190 * Math.cos(t), ey = 62 * Math.sin(t);
    const isFront = Math.sin(t) > 0;
    if (isFront !== front) continue;
    const x = P.x + ex * Math.cos(tilt) - ey * Math.sin(tilt), y = P.y + ex * Math.sin(tilt) + ey * Math.cos(tilt);
    const mix = (Math.cos(t) + 1) / 2;
    dot(x, y, 3.2, [233 * (1 - mix) + 127 * mix, 240 * (1 - mix) + 231 * mix, 255], front ? 0.9 : 0.45);
  }
};
ring(false);
for (let r = 88; r > 0; r -= 1) {                               // the planet: blue to violet, lighter at the top left
  const t = 1 - r / 88;
  dot(P.x - 18 * t, P.y - 18 * t, r, [91 + 70 * t, 124 + 60 * t, 255], r === 88 ? 1 : 0.06);
}
ring(true);
for (let r = 34; r > 15; r -= 1) dot(1128, 74, r, [255, 210, 90], 0.035);   // the sun's glow, built up in faint rings
dot(1128, 74, 14, [255, 222, 110], 1);

// write the PNG: 8-bit RGB, each row with the "Sub" filter, which suits smooth gradients
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  const o = y * (W * 3 + 1);
  raw[o] = 1;
  for (let x = 0; x < W * 3; x++) {
    const v = Math.max(0, Math.min(255, Math.round(px[y * W * 3 + x])));
    const left = x >= 3 ? Math.max(0, Math.min(255, Math.round(px[y * W * 3 + x - 3]))) : 0;
    raw[o + 1 + x] = (v - left) & 255;
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`Wrote ${OUT.slice(root.length + 1)}: ${W}x${H}, ${Math.round(png.length / 1024)} KB`);
