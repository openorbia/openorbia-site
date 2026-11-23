// The podium over the launches leaderboard: the top three (upvoted, rank 3 or better) while voting runs, 1st standing in the
// middle; and launch.js moving rows, ranks, medal colors and the podium after an upvote, the way the server orders them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { podiumHtml, podiumHeading, renderLeaderboard } from '../lib/pages.js';
import { rankInfo } from '../lib/results.js';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const L = (slug, votes) => ({ slug, name: slug.toUpperCase(), tagline: 't', category: 'biz', votes });

test('the podium shows the upvoted top three in rank order; equal upvotes share a rank and its color', () => {
  const launches = [L('a', 5), L('b', 3), L('c', 3), L('d', 1)];
  const html = podiumHtml(launches, rankInfo(launches));
  assert.deepEqual([...html.matchAll(/<li class="pstep (place-\d) (p-\d)"><a class="pwho" href="\/launch\/(\w)\/">/g)].map(m => m.slice(1)),
    [['place-1', 'p-1', 'a'], ['place-2', 'p-2', 'b'], ['place-3', 'p-2', 'c']]);
  assert.deepEqual([1, 2, 3].map(podiumHeading), ['In the lead', 'Top two so far', 'Top three so far']);
  assert.ok(html.startsWith('<section class="podium" aria-labelledby="podium-h"><h2 id="podium-h" class="podium-h">Top three so far</h2><ol class="podium-steps">'));
  assert.ok(html.includes('<span class="pvotes">5 upvotes</span>') && html.includes('<span class="pblock" aria-hidden="true"><span class="pnum">1</span></span>'));
  assert.ok(html.includes('<span class="pnum">=2</span>'), 'a shared rank reads =2');
  assert.ok(podiumHtml([L('a', 1)], rankInfo([L('a', 1)])).includes('<span class="pvotes">1 upvote</span>'), 'singular');
  assert.equal(podiumHtml([L('a', 0), L('b', 0)], rankInfo([L('a', 0), L('b', 0)])), '', 'no upvotes yet: no podium');
  const three = [L('a', 2), L('b', 1), L('c', 1), L('d', 1)];
  assert.equal((podiumHtml(three, rankInfo(three)).match(/class="pstep/g) || []).length, 1, 'three tied for 2nd do not all fit in places 2 and 3: only 1st stands');
  assert.ok(podiumHtml(three, rankInfo(three)).includes('<h2 id="podium-h" class="podium-h">In the lead</h2>'), 'the heading counts who stands on it');
  const two = [L('a', 3), L('b', 3), L('c', 1), L('d', 1)];
  assert.ok(podiumHtml(two, rankInfo(two)).includes('>Top two so far</h2>'));
  const allFirst = [L('a', 4), L('b', 4), L('c', 4)];
  assert.deepEqual([...podiumHtml(allFirst, rankInfo(allFirst)).matchAll(/class="pstep (place-\d p-\d)"/g)].map(m => m[1]), ['place-1 p-1', 'place-2 p-1', 'place-3 p-1']);
});

test('the leaderboard carries the podium only while voting runs', () => {
  const now = Date.now();
  const page = (open, closed) => renderLeaderboard({ week: { week: 1, open, closed, opensAt: now - 864e5, closesAt: now + 864e5 }, launches: [L('a', 2), L('b', 1)], now });
  assert.ok(page(true, false).includes('<section class="podium"'));
  assert.ok(page(true, false).indexOf('<section class="podium"') < page(true, false).indexOf('<ol class="lboard"'), 'above the list');
  assert.ok(!page(true, true).includes('<section class="podium"'), 'final results: the ranked list only');
});

test('the podium CSS: 1st stands in the middle, motion only without a reduced-motion preference, no lingering animation layers', () => {
  const css = file('public/assets/launch.css');
  assert.ok(css.includes('.pstep.place-1{order:2;--h:104px}.pstep.place-2{order:1;--h:76px}.pstep.place-3{order:3;--h:56px}'));
  const motion = css.slice(css.indexOf('@media (prefers-reduced-motion:no-preference){\n  .pblock'));
  assert.ok(motion.includes('.pblock{animation:prise .7s cubic-bezier(.2,.8,.2,1) backwards}') && motion.includes('.pwho{animation:pfade .6s ease-out backwards}'));
  assert.equal(css.split('animation:prise').length, 2);
  assert.ok(!/\.podium::before/.test(css), 'a large gradient over the fixed page background showed as a dark box');
});

// A small fake DOM for launch.js: leaderboard rows with a rank, a vote button, a name, a link and a logo; and a podium list
function fakeBoard(rows) {
  const node = (props = {}) => ({ classList: null, attrs: {}, children: [], style: { setProperty() {} }, ...props,
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, append(...k) { this.children.push(...k); },
    replaceChildren(...k) { this.children = k; }, cloneNode() { return node({ tagName: 'IMG', className: 'logo' }); } });
  const classes = set => ({ contains: c => set.has(c), add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)), set });
  const board = node({ children: [] });
  board.append = (...k) => { board.children = [...k]; };
  const buttons = [];
  for (const [slug, votes, rank] of rows) {
    const r = node(); r.cls = new Set(['lrow']); r.classList = classes(r.cls);
    const parts = { '.rank': node({ textContent: String(rank) }), '[data-count]': node({ textContent: String(votes) }), '.lrow-text b': node({ textContent: slug }),
      '.lrow-main': node({ attrs: { href: `/launch/${slug}/` } }), '.logo': node({ tagName: 'IMG' }) };
    r.querySelector = s => parts[s] || null; r.parts = parts; r.slug = slug;
    r.getBoundingClientRect = () => ({ top: board.children.indexOf(r) * 100 });
    const b = node({ dataset: { slug, state: 'ready' }, disabled: false, querySelector: s => parts[s] || null, closest: s => (s === 'button.vote' ? b : null) });
    buttons.push(b); board.children.push(r);
  }
  const podium = node();
  const created = [];
  const ctx = {
    document: {
      getElementById: () => null, addEventListener(t, f) { if (t === 'click') ctx.clicks.push(f); }, querySelector: s => (s === 'ol.lboard' ? board : s === '.podium-steps' ? podium : null),
      querySelectorAll: s => (s === 'button.vote' ? buttons : []), createElement: t => { const n = node({ tagName: t.toUpperCase() }); created.push(n); return n; }, body: { append() {} },
    },
    clicks: [], fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, count: 0 }) }),
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, matchMedia: () => ({ matches: true }), navigator: {}, getSelection: () => ({}),
    WeakMap, Map, Date, Number, String, Math, JSON, URL, Intl, Set, console, location: { pathname: '/launches/' },
  };
  ctx.window = ctx;
  vm.runInNewContext(file('public/assets/launch.js'), ctx);
  const vote = async (slug, count) => {
    ctx.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, count }) });
    const b = buttons.find(x => x.dataset.slug === slug);
    for (const f of ctx.clicks) await f({ target: b });
    await new Promise(r => setTimeout(r, 10));
  };
  return { board, podium, vote };
}

test('after an upvote, rows move to their new place, ranks and medal colors follow the server\'s rules, and the podium is rebuilt', async () => {
  const { board, podium, vote } = fakeBoard([['pentagi', 3, 1], ['activepieces', 2, 2], ['agentic', 2, 2], ['jan', 2, 2], ['n8n', 0, 5]]);
  await vote('jan', 3);
  // equal upvotes ordered by name, case-insensitive (the server's ORDER BY votes DESC, name COLLATE NOCASE)
  assert.deepEqual(board.children.map(r => `${r.parts['.rank'].textContent} ${r.slug} ${r.parts['[data-count]'].textContent}`),
    ['=1 jan 3', '=1 pentagi 3', '=3 activepieces 2', '=3 agentic 2', '5 n8n 0']);
  assert.deepEqual(board.children.map(r => [...r.cls].filter(c => c.startsWith('top-')).join()), ['top-1', 'top-1', '', '', ''], 'two tied for 3rd do not fit inside places 1 to 3: no bronze (rankInfo)');
  assert.equal(board.children[0].parts['.rank'].attrs['aria-label'], 'Tied for rank 1');
  assert.equal(board.children[4].parts['.rank'].attrs['aria-label'], 'Rank 5');
  assert.deepEqual(podium.children.map(li => li.className), ['pstep place-1 p-1', 'pstep place-2 p-1']);
  assert.deepEqual(podium.children.map(li => li.children[0].href), ['/launch/jan/', '/launch/pentagi/']);
  assert.equal(podium.children[0].children[1].children[0].textContent, '=1');
  assert.equal(podium.children[0].children[0].children[2].textContent, '3 upvotes');
});
