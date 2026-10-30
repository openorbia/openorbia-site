// The page shell shared by the server-rendered launch pages: same head, header, logo and footer as the rest of the site.

import { esc } from './html.js';

const SITE = 'https://openorbia.com';

export const MARK = '<svg class="mark" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="96" height="96"><defs><linearGradient id="m0P" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fa6ff"/><stop offset=".55" stop-color="#5b7cff"/><stop offset="1" stop-color="#7a4dff"/></linearGradient><linearGradient id="m0R" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9f0ff"/><stop offset="1" stop-color="#7fe7ff"/></linearGradient><radialGradient id="m0S"><stop offset="0" stop-color="#fff6c2"/><stop offset=".6" stop-color="#ffd84d"/><stop offset="1" stop-color="#ffb21f"/></radialGradient><filter id="m0G" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter></defs><circle cx="58" cy="64" r="27" fill="#5b7cff" opacity=".55" filter="url(#m0G)"/><circle cx="98" cy="25" r="11" fill="#ffd84d" opacity=".7" filter="url(#m0G)"/><g transform="translate(58 64) rotate(-24)"><path d="M-52 0 A52 17 0 0 1 52 0" fill="none" stroke="url(#m0R)" stroke-width="6" stroke-linecap="round" stroke-dasharray="86 200"/><circle r="25" fill="url(#m0P)"/><path d="M-17 -15 A25 25 0 0 1 12 -22" fill="none" stroke="#ffffff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/><path d="M-52 0 A52 17 0 0 0 52 0" fill="none" stroke="url(#m0R)" stroke-width="6" stroke-linecap="round"/></g><path d="M85 39 L91 33" stroke="#ffd84d" stroke-opacity=".75" stroke-width="2.5" stroke-linecap="round"/><circle cx="98" cy="25" r="8" fill="url(#m0S)"/></svg>';

// -> a full HTML document string. `body` is trusted markup built with esc(); everything else is escaped here.
export function layout({ title, description, path, image = `${SITE}/og-image.png`, body, noindex = false }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(SITE + path)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icon-512.png" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#05070f">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(SITE + path)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500&family=Sora:wght@700;800&display=swap">
<link rel="stylesheet" href="/assets/launch.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="wrap"><div class="nav">
  <a class="brand" href="/" aria-label="OpenOrbia home">${MARK}<span>Open<span class="grad">Orbia</span></span></a>
  <nav class="links" aria-label="Main"><a href="/launch-list/">Tools</a><a href="/launches/">Launches</a><a class="btn ghost" href="/submit/">Submit a tool</a></nav>
</div></header>

<main class="wrap" id="main" tabindex="-1">
${body}
</main>

<footer><div class="wrap"><span>© ${new Date().getFullYear()} OpenOrbia</span><span>Where free AI tools take off. · <a href="/how-we-check/">How we check tools</a> · <a href="/makers/">For makers</a> · <a href="https://www.linkedin.com/company/openorbia" target="_blank" rel="noopener">LinkedIn</a></span></div></footer>
<script src="/assets/launch.js" defer></script>
<script src="/assets/click-beacon.js" defer></script>
</body>
</html>
`;
}
