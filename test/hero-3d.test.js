// The hero planet is 3D with CSS only (no library, no inline script): decorative, still for reduced motion, tilted by home.js only
// for a mouse pointer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
