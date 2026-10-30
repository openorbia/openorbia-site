import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { renderMakers, BADGES } from '../lib/makers.js';
import { layout } from '../lib/layout.js';

const root = new URL('../', import.meta.url);
const file = f => readFileSync(new URL(f, root), 'utf8');

// ---- the Featured on OpenOrbia badges ----

const BADGE_FILES = ['featured.svg', 'featured-dark.svg', 'featured-light.svg'];
const svgOf = f => file(`public/badge/${f}`);

// The right-most x of a text path: absolute (M L Q C Z) and relative (m l q c z) commands, control points included
function rightmost(d) {
  let x = 0, y = 0, sx = 0, sy = 0, max = -Infinity;
  for (const [, cmd, args] of d.matchAll(/([MmLlQqCcZz])([^MmLlQqCcZz]*)/g)) {
    const n = (args.match(/-?\d*\.?\d+/g) || []).map(Number);
    const abs = cmd === cmd.toUpperCase();
    if (cmd === 'Z' || cmd === 'z') { x = sx; y = sy; continue; }
    const per = { M: 2, L: 2, Q: 4, C: 6 }[cmd.toUpperCase()];
    for (let i = 0; i < n.length; i += per) {
      let ex = x, ey = y;
      for (let j = 0; j < per; j += 2) {
        const px = abs ? n[i + j] : x + n[i + j], py = abs ? n[i + j + 1] : y + n[i + j + 1];
        max = Math.max(max, px); ex = px; ey = py;
      }
      x = ex; y = ey;
      if (cmd.toUpperCase() === 'M') { sx = x; sy = y; }
    }
  }
  return max;
}
const lum = h => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrastOnWhite = h => 1.05 / (lum(h) + 0.05);

test('the badges have no <text>: the words are paths, so no web font is needed anywhere', () => {
  for (const f of BADGE_FILES) {
    assert.ok(existsSync(new URL(`public/badge/${f}`, root)), f);
    const svg = svgOf(f);
    assert.ok(!/<text|<tspan|font-family|<style|@font-face/i.test(svg), `${f}: no text elements, no fonts`);
    assert.ok((svg.match(/<path /g) || []).length >= 5, `${f}: the words are paths`);
    assert.ok(!/<script|href=|<image|url\(http|@import|onload/i.test(svg), `${f}: nothing external or active`);
    assert.ok(svg.includes('role="img"') && svg.includes('Featured on OpenOrbia</title>'), `${f}: accessible name`);
  }
});

test('each badge is under 8 KB', () => {
  for (const f of BADGE_FILES) assert.ok(Buffer.byteLength(svgOf(f)) < 8192, `${f}: ${Buffer.byteLength(svgOf(f))} bytes`);
});

test('the badge has equal left and right padding around its content', () => {
  for (const f of BADGE_FILES) {
    const svg = svgOf(f);
    const width = Number(svg.match(/<svg [^>]*width="([\d.]+)"/)[1]);
    assert.equal(Number(svg.match(/viewBox="0 0 ([\d.]+) 56"/)[1]), width, `${f}: viewBox matches width`);
    const left = Number(svg.match(/data-pad-left="([\d.]+)"/)[1]), right = Number(svg.match(/data-pad-right="([\d.]+)"/)[1]);
    assert.equal(left, right, `${f}: stated padding is equal`);
    // and the stated right padding is real: the right-most ink of the text paths sits that far from the edge
    const ink = Math.max(...[...svg.matchAll(/<path fill="[^"]+" d="([^"]+)"\/>/g)].map(m => rightmost(m[1])));
    assert.ok(Math.abs((width - ink) - right) < 0.7, `${f}: measured right padding ${(width - ink).toFixed(2)} vs stated ${right}`);
  }
});

test('"OpenOrbia" in the badge is the header wordmark: Open solid, Orbia in the wordmark gradient', () => {
  const dark = svgOf('featured-dark.svg'), light = svgOf('featured-light.svg'), def = svgOf('featured.svg');
  const stops = svg => [...svg.match(/<linearGradient id="[a-z]w"[\s\S]*?<\/linearGradient>/)[0].matchAll(/offset="([^"]+)" stop-color="([^"]+)"/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(stops(dark), [['0', '#9fb2ff'], ['.45', '#5b7cff'], ['1', '#a07bff']], 'the header gradient, same 0 / 45% / 100% stops');
  assert.ok(dark.includes('<path fill="#eef2ff"') && light.includes('<path fill="#0b1020"'), 'Open: #eef2ff on dark, #0b1020 on light');
  assert.ok(dark.includes('fill="#9aa6c8"') && light.includes('fill="#4a5578"'), 'Featured on is muted');
  // the light badge uses a deeper version of the same gradient, and every stop is readable on white
  const lightStops = stops(light);
  assert.deepEqual(lightStops.map(s => s[0]), ['0', '.45', '1']);
  for (const [, c] of lightStops) assert.ok(contrastOnWhite(c) >= 3, `${c} reads on white (${contrastOnWhite(c).toFixed(2)}:1)`);
  assert.notDeepEqual(lightStops.map(s => s[1]), stops(dark).map(s => s[1]), 'deeper than the dark badge');
  // featured.svg is the dark badge, with its own ids
  const body = s => s.match(/<rect[\s\S]*<\/svg>/)[0].replace(/[dfl](?=[ptrw]\b)/g, '_');
  assert.equal(body(def).replace(/\s+/g, ''), body(dark).replace(/\s+/g, ''), 'same drawing as the dark badge');
  const ids = BADGE_FILES.flatMap(f => [...svgOf(f).matchAll(/ id="([a-z]+[ptrw])"/g)].map(m => m[1]));
  assert.equal(new Set(ids).size, ids.length, 'gradient ids are unique across the three badges');
});

test('/makers/ shows both badges with copy-paste Markdown and HTML that link to openorbia.com', () => {
  const html = renderMakers();
  assert.ok(html.includes('<h2 id="badge-h">Featured on OpenOrbia badge</h2>'));
  assert.equal(BADGES.length, 2);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  for (const b of BADGES) {
    const width = Math.round(Number(svgOf(b.file).match(/<svg [^>]*width="([\d.]+)"/)[1]));
    assert.equal(b.markdown, `[![Featured on OpenOrbia](https://openorbia.com/badge/${b.file})](https://openorbia.com/)`);
    assert.equal(b.html, `<a href="https://openorbia.com/"><img src="https://openorbia.com/badge/${b.file}" alt="Featured on OpenOrbia" width="${width}" height="56"></a>`);
    assert.ok(html.includes(`<code>${esc(b.markdown)}</code>`) && html.includes(`<code>${esc(b.html)}</code>`), `${b.key}: snippets on the page`);
    assert.ok(html.includes(`data-copy="${esc(b.markdown)}"`) && html.includes(`data-copy="${esc(b.html)}"`), `${b.key}: copy buttons`);
    assert.ok(html.includes(`<img src="/badge/${b.file}" alt="Featured on OpenOrbia badge, ${b.key} version" width="${width}" height="56">`), `${b.key}: preview`);
  }
});

// ---- headings use the wordmark's font treatment ----

const PAGES = { home: 'public/index.html', list: 'public/launch-list/index.html', css: 'public/assets/launch.css' };
const rulesOf = text => text.split('\n').map(l => l.trim()).filter(l => /^[^{@]+\{.*\}$/.test(l));
const GRAD = 'linear-gradient(90deg,var(--blue-l),var(--blue) 45%,var(--violet))';
// The heading rules use the font shorthand (which resets font-variant-ligatures) and are more specific than a bare h1, so the rule that
// turns ligatures off names headings as "html [class] h1": it out-ranks every ".x h1" wherever it sits in the file.
const NO_LIGATURES = 'html h1,html h2,html h3,html .brand,html [class] h1,html [class] h2,html [class] h3{font-variant-ligatures:none}';

test('the wordmark is Bricolage Grotesque 800 at -0.03em, the same on every page', () => {
  const wordmark = 'font:800 22px/1 var(--display);letter-spacing:-.03em';
  for (const [name, f] of Object.entries(PAGES)) {
    const rule = rulesOf(file(f)).find(r => r.startsWith('.brand{'));
    assert.ok(rule && rule.includes(wordmark), `${name}: .brand rule`);
    const grad = rulesOf(file(f)).find(r => r.startsWith('.grad{'));
    assert.ok(grad && grad.includes(GRAD), `${name}: .grad is the wordmark gradient`);
  }
  assert.ok(file('public/404.html').includes('/assets/launch.css'), 'the 404 page shares the stylesheet');
});

test('every h1 uses the same font treatment as the wordmark: Bricolage 800, -0.03em, the wordmark gradient on highlighted words', () => {
  let seen = 0;
  for (const [name, f] of Object.entries(PAGES)) {
    for (const rule of rulesOf(file(f))) {
      const selector = rule.slice(0, rule.indexOf('{'));
      if (/(^|[ ,])h1$/.test(selector)) {
        seen++;
        assert.ok(/font:800 /.test(rule) && rule.includes('var(--display)'), `${name}: ${selector} is Bricolage 800`);
        assert.ok(rule.includes('letter-spacing:-.03em'), `${name}: ${selector} tracks at -0.03em`);
      }
      if (/h1 em$/.test(selector)) {
        seen++;
        assert.ok(rule.includes(GRAD), `${name}: ${selector} uses the wordmark gradient`);
        assert.ok(!/var\(--cyan\)/.test(rule), `${name}: ${selector} has no extra gradient stop`);
      }
    }
  }
  assert.equal(seen, 11, 'h1 and h1 em rules: home 2, Launch List 2, shared stylesheet 7');
});

test('ligatures are off on headings and the wordmark, and the "ff" workaround is gone', () => {
  for (const [name, f] of Object.entries(PAGES)) {
    assert.ok(file(f).includes(NO_LIGATURES), `${name}: ligatures off`);
    assert.ok(!/\.lig\b|class="lig"|common-ligatures/.test(file(f)), `${name}: no .lig workaround`);
  }
  const h1 = file('public/index.html').match(/<h1>([\s\S]*?)<\/h1>/)[1];
  assert.equal(h1.replace(/<[^>]+>/g, ''), 'Where free AI tools take off.', 'the headline still reads "take off" (a screen reader sees one word)');
});

test('the homepage headline has a little extra space after the first f of "off", and nowhere else', () => {
  const home = file('public/index.html');
  assert.ok(home.includes('<em>take o<span class="fsp">f</span>f</em>.</h1>'), 'only the first f is wrapped');
  // -0.03em (the heading tracking) + 0.04em = +0.01em after that f, so the two hooks no longer touch
  assert.ok(rulesOf(home).includes('.fsp{letter-spacing:.01em}'), 'the extra space is 0.04em on top of -0.03em');
  assert.equal((home.match(/class="fsp"/g) || []).length, 1, 'one use on the homepage');
  for (const f of ['public/launch-list/index.html', 'public/assets/launch.css', 'public/404.html', 'lib/layout.js', 'lib/makers.js', 'lib/pages.js']) {
    assert.ok(!file(f).includes('fsp'), `${f}: no extra spacing anywhere else`);
  }
  assert.ok(rulesOf(home).some(r => r.startsWith('h1{') && r.includes('letter-spacing:-.03em')), 'the h1 itself keeps -0.03em');
});

test('every page asks for Bricolage Grotesque 800 and IBM Plex Sans', () => {
  const link = 'family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400';
  for (const f of ['public/index.html', 'public/launch-list/index.html', 'public/404.html']) assert.ok(file(f).includes(link), f);
  assert.ok(layout({ title: 't', description: 'd', path: '/', body: '' }).includes(link), 'server-rendered pages');
});

// Specificity of a descendant selector as [classes and attributes, element names]; enough for the heading rules in these stylesheets
const spec = sel => {
  let classes = 0, elements = 0;
  for (const part of sel.trim().split(' ').filter(Boolean)) {
    classes += part.split('.').length - 1 + part.split('[').length - 1;
    if (part[0] !== '.' && part[0] !== '[') elements += 1;
  }
  return [classes, elements];
};
const outranks = (a, b) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);

test('the ligature rule out-ranks every heading rule (specificity), so it really applies', () => {
  const strongest = { h1: 'html [class] h1', h2: 'html [class] h2', h3: 'html [class] h3', brand: 'html .brand' };
  let checked = 0;
  for (const f of Object.values(PAGES)) {
    for (const rule of rulesOf(file(f))) {
      if (!rule.includes('font:') || rule.includes('font-variant-ligatures')) continue;   // only rules whose font shorthand resets ligatures
      for (const sel of rule.slice(0, rule.indexOf('{')).split(',')) {
        const last = sel.trim().split(' ').pop();
        const key = ['h1', 'h2', 'h3'].includes(last) ? last : last === '.brand' ? 'brand' : null;
        if (!key) continue;
        checked++;
        assert.ok(outranks(spec(strongest[key]), spec(sel)), `${sel.trim()} must be out-ranked by the ligature rule`);
      }
    }
  }
  assert.ok(checked >= 10, `checked ${checked} heading selectors`);
});

test('the header is the same height on every page, so the wordmark sits in the same place', () => {
  // the nav button decides the height of the header row: it must be the same size on the homepage, the Launch List and the shared pages
  for (const [name, f] of Object.entries(PAGES)) {
    const rule = rulesOf(file(f)).find(r => r.startsWith('.nav .btn{'));
    assert.ok(rule, `${name}: .nav .btn`);
    assert.ok(rule.includes('padding:9px 16px') && rule.includes('font-size:14px'), `${name}: same nav button padding and size`);
    if (name !== 'css') assert.ok(rule.includes('min-height:44px'), `${name}: nav button is 44px`);
  }
  assert.ok(rulesOf(file(PAGES.css)).some(r => r.startsWith('.btn{') && r.includes('min-height:44px')), 'the shared stylesheet gives every button 44px');
  // and the same links show on small screens: the homepage hides "Launch List" below 560px like the other pages do
  const home = file(PAGES.home);
  assert.ok(home.includes('<a class="hide-sm" href="/launch-list/">Launch List</a>'));
  assert.ok(home.includes('@media (max-width:560px){.nav .links .hide-sm{display:none}}'));
});
