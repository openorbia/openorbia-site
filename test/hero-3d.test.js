// The hero planet is 3D with CSS only (no library, no inline script): decorative, still for reduced motion, tilted by home.js only
// for a mouse pointer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const home = file('public/index.html');
const css = home.slice(home.indexOf('<style'), home.indexOf('</style>'));

test('the hero planet is decorative markup with three orbits and one moon each', () => {
  const orb = home.slice(home.indexOf('<div class="orb orb3d"'), home.indexOf('</section>', home.indexOf('<div class="orb orb3d"')));
  assert.ok(orb.startsWith('<div class="orb orb3d" aria-hidden="true"><div class="o3-scene" id="o3"><div class="o3-planet"></div>'));
  for (const n of [1, 2, 3]) assert.ok(orb.includes(`<div class="o3-ring o3-r${n}"><div class="o3-spin"><div class="o3-face"><i class="o3-moon"></i></div></div></div>`), `orbit ${n}`);
  assert.ok(!/<script(?![^>]*\b(src=|type="application\/ld\+json"))/.test(home), 'no inline scripts (JSON-LD data aside)');
});

test('motion runs only without a reduced-motion preference, and nothing flattens the 3D', () => {
  const still = css.slice(css.indexOf('@media (prefers-reduced-motion:no-preference){\n.orb3d'));
  for (const a of ['.o3-spin{animation:o3spin', '.o3-face{animation:o3spin', '.orb3d{animation:float']) {
    assert.ok(still.includes(a), a);
    assert.equal(css.split(a).length, 2, `${a} appears only in the no-preference block`);
  }
  assert.ok(css.includes('.o3-scene{position:absolute;inset:0;transform-style:preserve-3d;'));
  assert.ok(!/\.(orb3d|o3-scene|o3-ring|o3-spin|o3-face)\{[^}]*filter/.test(css), 'a filter would flatten preserve-3d');
});

test('home.js tilts the planet and cards only for a mouse pointer without reduced motion', () => {
  const js = file('public/assets/home.js');
  assert.ok(js.includes("matchMedia('(pointer:fine) and (prefers-reduced-motion:no-preference)').matches"));
  assert.ok(js.includes("o3.style.setProperty('--ry'") && js.includes("c.style.setProperty('--tx'"));
  assert.ok(js.indexOf("getElementById('o3')") < js.indexOf("getElementById('wl')"), 'runs before the form code');
});

test('the hero has stars at three depths behind it, decorative, shifted by the pointer and still for reduced motion', () => {
  assert.ok(home.includes('<section class="hero">\n    <div class="hero-sky" aria-hidden="true"><b></b><i class="s1"></i><i class="s2"></i><i class="s3"></i></div>'));
  assert.ok(css.includes('.hero-sky{position:absolute;inset:-24px -16px;z-index:-1;pointer-events:none;overflow:hidden;'));
  for (const [n, px] of [[1, 8], [2, 20], [3, 40]]) assert.ok(css.includes(`.hero-sky .s${n}{`) && css.includes(`transform:translate3d(calc(var(--px,0)*-${px}px)`), `layer ${n}`);
  assert.ok(css.includes('@media (prefers-reduced-motion:reduce){.o3-scene,.cat,.hero-sky i{transition:none}}'));
  assert.equal(css.split('animation:twinkle').length, 3, 'twinkle only in the no-preference block');
  const js = file('public/assets/home.js');
  assert.ok(js.includes("hero.style.setProperty('--px',x.toFixed(3))") && js.includes("hero.style.removeProperty('--px')"));
});

test('the launch pad: a decorative grid floor in its own clipped layer, moving only without a reduced-motion preference', () => {
  assert.ok(home.includes('<div class="hero-pad" aria-hidden="true"><span class="floor"></span></div>'));
  assert.ok(css.includes('.hero-pad{position:absolute;inset:0 -16px;z-index:-1;pointer-events:none;overflow:hidden}'));
  assert.ok(css.includes('@keyframes o3floor{to{background-position:50% var(--g)}}'), 'moves exactly one grid cell, so the loop is seamless');
  assert.equal(css.split('animation:o3floor').length, 2);
  assert.ok(css.indexOf('animation:o3floor') > css.indexOf('@media (prefers-reduced-motion:no-preference){'));
});

// Run launch.js's homepage part against a fake page with three moons and a fake /api/launches answer
function runMoons(launches) {
  const moons = [0, 1, 2].map(() => ({ kids: [], classes: new Set(), classList: { add(c) { this.owner.classes.add(c); } }, replaceChildren(...k) { this.kids = k; } }));
  for (const m of moons) m.classList.owner = m;
  const el = () => { const n = { listeners: {}, append() {}, setAttribute() {}, dataset: {}, addEventListener(t, f) { n.listeners[t] = f; } }; return n; };
  const root = { querySelector: () => null, replaceChildren() {} };
  const ctx = {
    document: { getElementById: id => (id === 'week-live' ? root : null), addEventListener() {}, querySelectorAll: s => (s === '#o3 .o3-moon' ? moons : []), querySelector: () => null, createElement: el },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, week: 1, open: true, total: launches.length, label: 'Monday, Nov 23, 2026', now: 0, launches }) }),
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, navigator: {}, getSelection: () => ({}), WeakMap, Date, Number, String, Math, JSON, URL, Intl, Set, console, location: { pathname: '/' },
  };
  ctx.window = ctx;
  vm.runInNewContext(file('public/assets/launch.js'), ctx);
  return new Promise(r => setTimeout(() => r(moons), 20));
}

test('the moons carry the logos of the top launches in leaderboard order, skipping launches without a logo, shown once loaded', async () => {
  const moons = await runMoons([
    { slug: 'a', name: 'A', logo_url: '/launches/a/logo.png' }, { slug: 'b', name: 'B' },
    { slug: 'c', name: 'C', logo_url: '/launches/c/logo.png' }, { slug: 'd', name: 'D', logo_url: '/launches/d/logo.png' }, { slug: 'e', name: 'E', logo_url: '/launches/e/logo.png' },
  ]);
  assert.deepEqual(moons.map(m => m.kids[0] && m.kids[0].src), ['/launches/a/logo.png', '/launches/c/logo.png', '/launches/d/logo.png']);
  assert.ok(moons.every(m => m.kids[0].alt === ''), 'decorative');
  assert.ok(moons.every(m => !m.classes.has('has-logo')), 'not shown before the image loads');
  moons[0].kids[0].listeners.load();
  assert.ok(moons[0].classes.has('has-logo'));
  const none = await runMoons([{ slug: 'b', name: 'B' }]);
  assert.ok(none.every(m => m.kids.length === 0), 'no logo: the moon keeps its color');
  assert.ok(css.includes('.o3-moon.has-logo img{opacity:1}') && css.includes('.o3-moon img{display:block;width:100%;height:100%;border-radius:50%;object-fit:cover;opacity:0;'));
});
