// The site's fonts, served from openorbia.com itself (public/assets/fonts/), so no page connects to Google. Each is the latin file
// Google Fonts serves for the weights the site uses (Bricolage Grotesque only for the letters of the "OpenOrbia" wordmark), under the
// SIL Open Font License 1.1; each license is next to its font. FONT_CSS goes at the top of public/assets/launch.css and of the inline
// stylesheets of the three static pages (test/fonts.test.js keeps them in step); FONT_PRELOADS goes in every page's <head>.
//
// Each family also gets a "<family> Fallback": a local font (Arial, Arial Bold or Courier New) scaled to the web font's widths and
// vertical metrics (numbers from scripts/font-fallback.mjs), so text wraps and sits the same before and after the web font swaps in.

const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const WORDMARK = 'U+4F,U+61-62,U+65,U+69,U+6E,U+70,U+72'; // O a b e i n p r: the letters of "OpenOrbia"

// weight: the range each variable file covers (Google serves the whole axis; the site uses Sora 700/800, Plex 400/500/600)
export const FONTS = [
  { family: 'Sora', file: 'sora-v17-latin.woff2', weight: '400 800', range: LATIN, preload: true },
  { family: 'IBM Plex Sans', file: 'ibm-plex-sans-v23-latin.woff2', weight: '100 700', range: LATIN, preload: true },
  { family: 'JetBrains Mono', file: 'jetbrains-mono-v24-latin.woff2', weight: '500', range: LATIN },
  { family: 'Bricolage Grotesque', file: 'bricolage-grotesque-v9-wordmark.woff2', weight: '800', range: WORDMARK },
];

const FALLBACKS = [
  '@font-face{font-family:"Sora Fallback";src:local("Arial Bold"),local("Arial-BoldMT"),local("Arial");font-weight:700;size-adjust:103.92%;ascent-override:93.34%;descent-override:27.91%;line-gap-override:0%}',
  '@font-face{font-family:"Sora Fallback";src:local("Arial Bold"),local("Arial-BoldMT"),local("Arial");font-weight:800;size-adjust:104.58%;ascent-override:92.75%;descent-override:27.73%;line-gap-override:0%}',
  '@font-face{font-family:"IBM Plex Sans Fallback";src:local("Arial"),local("ArialMT");font-weight:400;size-adjust:100.45%;ascent-override:102.04%;descent-override:27.38%;line-gap-override:0%}',
  '@font-face{font-family:"IBM Plex Sans Fallback";src:local("Arial"),local("ArialMT");font-weight:500;size-adjust:102.48%;ascent-override:100.02%;descent-override:26.83%;line-gap-override:0%}',
  '@font-face{font-family:"IBM Plex Sans Fallback";src:local("Arial Bold"),local("Arial-BoldMT"),local("Arial");font-weight:600;size-adjust:96.9%;ascent-override:105.78%;descent-override:28.38%;line-gap-override:0%}',
  '@font-face{font-family:"JetBrains Mono Fallback";src:local("Courier New"),local("CourierNewPSMT");font-weight:500;size-adjust:99.98%;ascent-override:102.02%;descent-override:30%;line-gap-override:0%}',
  '@font-face{font-family:"Bricolage Grotesque Fallback";src:local("Arial Bold"),local("Arial-BoldMT"),local("Arial");font-weight:800;size-adjust:92.04%;ascent-override:101.05%;descent-override:29.34%;line-gap-override:0%}',
];

export const fontUrl = file => `/assets/fonts/${file}`;

export const FONT_CSS = [
  '/* Fonts served from openorbia.com (lib/fonts.js; SIL Open Font License, licenses in /assets/fonts/), each with a metric-matched local fallback (scripts/font-fallback.mjs) */',
  ...FONTS.map(f => `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:swap;src:url(${fontUrl(f.file)}) format("woff2");unicode-range:${f.range}}`),
  ...FALLBACKS,
].join('\n');

// The two fonts above the fold on every page: Sora (headings) and IBM Plex Sans (body text)
export const FONT_PRELOADS = FONTS.filter(f => f.preload).map(f => `<link rel="preload" href="${fontUrl(f.file)}" as="font" type="font/woff2" crossorigin>`).join('\n');

// The font stacks: each web font, then its fallback, then the old system stack
export const STACKS = {
  display: '"Sora","Sora Fallback","Avenir Next","Segoe UI",system-ui,sans-serif',
  wordmark: '"Bricolage Grotesque","Bricolage Grotesque Fallback","Avenir Next","Segoe UI",system-ui,sans-serif',
  body: '"IBM Plex Sans","IBM Plex Sans Fallback","Segoe UI",system-ui,-apple-system,Roboto,sans-serif',
  mono: '"JetBrains Mono","JetBrains Mono Fallback",ui-monospace,Menlo,Consolas,monospace',
};
