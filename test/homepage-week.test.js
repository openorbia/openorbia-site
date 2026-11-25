// The homepage "This week's launches" cards (public/assets/launch.js, #week-live), rendered against a small fake DOM and a fake
// /api/launches answer: up to 6 real launches as cards with a logo, name, tagline, vote count and the existing Vote button, a
// "Voting closes in" countdown from the API's closes_at, and the static text left alone when there is nothing to show.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const file = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ---- a fake DOM: just enough elements, text and selectors for launch.js ----
const camel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
class El {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this.className = ''; this.dataset = {}; this.attrs = {}; this._text = ''; this.id = ''; this.disabled = false; this.style = {}; }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._text; }
  set textContent(v) { this.children = []; this._text = String(v); }
  append(...nodes) { for (const n of nodes) { n.parent = this; this.children.push(n); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  before(n) { const sib = this.parent.children; n.parent = this.parent; sib.splice(sib.indexOf(this), 0, n); }
  addEventListener() {}
  matches(sel) {
    return sel.split(',').some(one => {
      one = one.trim();
      const m = /^([a-z]*)((?:\.[\w-]+)*)(?:\[([\w-]+)(?:="([^"]*)")?\])?(?:#([\w-]+))?$/.exec(one);
      if (!m) throw new Error(`fake DOM: unsupported selector ${one}`);
      const [, tag, classes, attr, value, id] = m;
      if (tag && this.tagName !== tag.toUpperCase()) return false;
      const mine = this.className.split(/\s+/);
      if (classes && !classes.split('.').filter(Boolean).every(c => mine.includes(c))) return false;
      if (id && this.id !== id) return false;
      if (attr) {
        const v = attr.startsWith('data-') ? this.dataset[camel(attr.slice(5))] : this.attrs[attr];
        if (v === undefined || (value !== undefined && String(v) !== value)) return false;
      }
      return true;
    });
  }
  // "#a .b": the last part must match, and an ancestor the part before it (enough for launch.js)
  matchesPath(parts) {
    if (!this.matches(parts[parts.length - 1])) return false;
    if (parts.length === 1) return true;
    for (let a = this.parent; a; a = a.parent) if (a.matches && a.matchesPath(parts.slice(0, -1))) return true;
    return false;
  }
  querySelectorAll(sel) {
    const parts = sel.trim().split(/\s+/), out = [];
    const walk = n => n.children.forEach(c => { if (c.matchesPath(parts)) out.push(c); walk(c); });
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

// The homepage's static week block (public/index.html), then launch.js run on it with `answer` from /api/launches
async function runWeek(answer) {
  const body = new El('body');
  const week = new El('section'); week.id = 'week';
  const h = new El('h2'); h.id = 'week-h'; h.textContent = "This week's launches";
  const root = new El('div'); root.id = 'week-live';
  const intro = new El('p'); intro.className = 'week-intro'; intro.dataset.weekIntro = ''; intro.textContent = 'STATIC INTRO';
  const cta = new El('a'); cta.dataset.lineupCta = ''; cta.textContent = 'See this week\'s launches →';
  const ctaBox = new El('div'); ctaBox.append(cta);
  root.append(intro, ctaBox); week.append(h, root); body.append(week);
  const intervals = [];
  const fetched = [];
  const document = {
    body, getElementById: id => (body.querySelectorAll(`#${id}`)[0] || null), querySelector: s => body.querySelector(s), querySelectorAll: s => body.querySelectorAll(s),
    createElement: t => new El(t), addEventListener() {}, dispatchEvent() {},
  };
  const ctx = {
    document, fetch: url => { fetched.push(url); return Promise.resolve({ ok: true, json: () => Promise.resolve(answer) }); },
    setTimeout, clearTimeout, setInterval: fn => { intervals.push(fn); return intervals.length; }, clearInterval() {},
    navigator: {}, getSelection: () => ({}), WeakMap, Date, Number, String, Math, JSON, URL, Intl, Set, Event: class {}, console, location: { pathname: '/' },
  };
  ctx.window = ctx;
  vm.runInNewContext(file('public/assets/launch.js'), ctx);
  await new Promise(r => setTimeout(r, 20));
  return { root, heading: h, fetched, intervals };
}

const NOW = Date.parse('2026-11-25T18:00:00Z');
const CLOSES = '2026-11-30T05:59:00.000Z';
const launch = (i, over = {}) => ({ slug: `tool-${i}`, name: `Tool ${i}`, tagline: `Tagline ${i}`, category: 'biz', category_name: 'Small businesses',
  logo_url: `/launches/tool-${i}/logo.png`, votes: 10 - i, rank: i + 1, tied: false, signal: 'Runs free · Desktop app', ...over });
const openWeek = (launches, over = {}) => ({ ok: true, now: NOW, week: 1, open: true, closed: false, closes_at: CLOSES, opens_at: '2026-11-23T06:00:00.000Z',
  label: 'Monday, Nov 23, 2026', opens_text: '12:00 AM Central', closes_text: 'Sunday at 11:59 PM Central', total: launches.length, voted: [], launches, ...over });
const cards = root => root.querySelectorAll('li');

test('asks the API for 6 and shows every real launch up to 6: 1, 3 and 6 launches, never padded', async () => {
  for (const n of [1, 3, 6]) {
    const { root, fetched } = await runWeek(openWeek(Array.from({ length: n }, (_, i) => launch(i))));
    assert.equal(fetched[0], '/api/launches?limit=6');
    assert.equal(cards(root).length, n, `${n} launches`);
    assert.equal(root.querySelector('a.btn').textContent, `See all ${n} launch${n === 1 ? '' : 'es'} →`);
  }
  const { root } = await runWeek(openWeek(Array.from({ length: 6 }, (_, i) => launch(i)), { total: 26 }));
  assert.equal(cards(root).length, 6, 'the API sends 6 of 26');
  assert.equal(root.querySelector('a.btn').textContent, 'See all 26 launches →');
});

test('with 0 launches the static "next lineup" text stays: nothing is replaced and no countdown appears', async () => {
  const { root, heading } = await runWeek(openWeek([]));
  assert.equal(root.querySelector('[data-week-intro]').textContent, 'STATIC INTRO');
  assert.ok(root.querySelector('[data-lineup-cta]'));
  assert.equal(root.querySelectorAll('[data-countdown]').length, 0);
  assert.equal(heading.textContent, "This week's launches");
});

test('each card: logo, name, tagline and the link to the launch page, and the existing Vote button with its count', async () => {
  const { root } = await runWeek(openWeek([launch(0, { votes: 1234 })]));
  const li = cards(root)[0];
  const link = li.querySelector('a.mini-text');
  assert.equal(link.href, '/launch/tool-0/');
  assert.equal(link.querySelector('b').textContent, 'Tool 0');
  assert.ok(link.textContent.includes('Tagline 0'));
  assert.equal(li.querySelector('img.mini-logo').src, '/launches/tool-0/logo.png');
  const btn = li.querySelector('button.vote');
  assert.equal(btn.dataset.slug, 'tool-0', 'the shared click handler posts this slug to /api/vote');
  assert.equal(btn.querySelector('[data-count]').textContent, '1,234');
  assert.equal(btn.querySelector('[data-sr]').textContent, 'Upvote Tool 0. 1,234 upvotes');
});

test('a missing logo shows the first letter instead, hidden from screen readers; a long name stays whole in the text', async () => {
  const long = 'A Very Long Launch Name That Goes On And On For Testing Purposes Only';
  const { root } = await runWeek(openWeek([launch(0, { logo_url: null, name: long })]));
  const li = cards(root)[0];
  assert.equal(li.querySelector('img'), null);
  const initial = li.querySelector('span.mini-initial');
  assert.equal(initial.textContent, 'A');
  assert.equal(initial.getAttribute('aria-hidden'), 'true');
  assert.equal(li.querySelector('a.mini-text b').textContent, long);
  assert.ok(li.querySelector('[data-sr]').textContent.includes(long), 'screen readers get the whole name');
});

test('vote button states: ready, voted (from the API), ended (disabled after the close)', async () => {
  const open = await runWeek(openWeek([launch(0), launch(1)], { voted: ['tool-1'] }));
  const [a, b] = cards(open.root).map(li => li.querySelector('button.vote'));
  assert.equal(a.dataset.state, 'ready'); assert.equal(a.getAttribute('aria-pressed'), 'false'); assert.equal(a.disabled, false);
  assert.equal(b.dataset.state, 'voted'); assert.equal(b.getAttribute('aria-pressed'), 'true');
  assert.ok(b.querySelector('[data-sr]').textContent.endsWith(', you have upvoted'));
  const ended = await runWeek(openWeek([launch(0)], { closed: true }));
  const c = cards(ended.root)[0].querySelector('button.vote');
  assert.equal(c.dataset.state, 'ended'); assert.equal(c.disabled, true);
  assert.equal(ended.heading.textContent, 'Launch Week 1 results');
});

test('while voting runs: the closing time from the API and a "Voting closes in" countdown to closes_at; none once it is over', async () => {
  const { root, intervals } = await runWeek(openWeek([launch(0)]));
  assert.equal(root.querySelector('p.week-note').textContent, 'Voting closes Sunday at 11:59 PM Central');
  const clock = root.querySelector('[data-countdown]');
  assert.equal(clock.dataset.countdown, CLOSES);
  assert.equal(clock.dataset.now, String(NOW), 'follows the server clock');
  assert.equal(clock.getAttribute('role'), 'timer');
  assert.equal(clock.getAttribute('aria-label'), 'Time until voting closes');
  assert.deepEqual(clock.querySelectorAll('b').map(b => b.dataset.unit), ['d', 'h', 'm', 's']);
  assert.equal(clock.querySelector('[data-unit="d"]').textContent, '4', 'started: about 4 days 12 hours left');
  assert.ok(intervals.length >= 1, 'it ticks');
  const ended = await runWeek(openWeek([launch(0)], { closed: true }));
  assert.equal(ended.root.querySelectorAll('[data-countdown]').length, 0);
  assert.equal(ended.root.querySelector('p.week-note').textContent, 'Voting closed. Final results.');
});

test('no new vote logic and no inline script: the cards use the shared button handler, and the homepage loads launch.js as a file', () => {
  const js = file('public/assets/launch.js');
  assert.equal((js.match(/fetch\('\/api\/vote'/g) || []).length, 1, 'one place posts votes, as before');
  const home = file('public/index.html');
  assert.ok(!/<script>(?!\s*<\/script>)/.test(home.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')), 'no inline script');
});

test('320px: cards and long names shrink and wrap instead of widening the page', () => {
  const home = file('public/index.html');
  assert.ok(home.includes('.mini-text{flex:1;min-width:0;display:grid}'), 'the text column may shrink below its content');
  assert.ok(/\.countdown\{[^}]*width:min\(100%,360px\)/.test(home), 'the countdown never exceeds the column');
  assert.ok(home.includes('.mini>li{min-width:0}'), 'a card can be narrower than its longest tagline (it overflowed by 5px at 320 before)');
  assert.ok(home.includes('.mini-text b{overflow-wrap:anywhere}'), 'a long launch name wraps instead of running under the vote button');
});
