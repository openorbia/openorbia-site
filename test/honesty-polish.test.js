// Wording that says only what is true: the homepage lineup box, how launching works, the Small businesses card, the waitlist
// default and the hero badge; Jan's tagline; and the tool page labels (Skill level, Steps checked, Facts checked).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { launchOpensAt, dayLabel } from '../lib/time.js';
import { FIRST_LAUNCH_WEEK } from '../lib/site.js';
import { toolBySlug, TOOLS } from '../public/assets/tools.js';
import { renderTool } from '../lib/tool-pages.js';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const home = file('public/index.html');

test('no lineup yet: the box offers it by email, with the date it is announced (the week before launch, from lib/time.js)', () => {
  const announced = dayLabel(launchOpensAt(FIRST_LAUNCH_WEEK.date) - 7 * 864e5);
  assert.equal(announced, 'Monday, Nov 16, 2026');
  assert.ok(home.includes(`<p class="week-lineup" data-lineup-date>Lineup announced ${announced}</p>`));
  assert.ok(home.includes('<a class="btn ghost" href="#join" data-lineup-cta>Get the lineup by email</a>'));
  assert.ok(home.includes('<section class="join" id="join"'), 'the link goes to the waitlist');
  assert.ok(!home.includes('>See the lineup →<'), 'no lineup link before there is a lineup');
});

// Run launch.js's homepage part against a fake page and a fake /api/launches answer
function runWeek(apiAnswer) {
  const cta = { href: '#join', textContent: 'Get the lineup by email' };
  let dateRemoved = false;
  const nodes = { '[data-lineup-cta]': cta, '[data-lineup-date]': { remove: () => { dateRemoved = true; } } };
  const root = { querySelector: s => nodes[s] || null, replaceChildren() {} };
  const ctx = {
    document: { getElementById: id => (id === 'week-live' ? root : null), addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ append() {}, setAttribute() {}, dataset: {} }) },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(apiAnswer) }), setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    navigator: {}, getSelection: () => ({}), WeakMap, Date, Number, String, Math, JSON, URL, Intl, Set, console, location: { pathname: '/' },
  };
  ctx.window = ctx;
  vm.runInNewContext(file('public/assets/launch.js'), ctx);
  return new Promise(r => setTimeout(() => r({ cta, dateRemoved }), 20));
}

test('once the week has launches, the box shows "See the lineup" again; with none it keeps the email offer', async () => {
  const withLineup = await runWeek({ ok: true, week: 1, open: false, total: 12, label: 'Monday, Nov 23, 2026', now: 0 });
  assert.equal(withLineup.cta.textContent, 'See the lineup →');
  assert.equal(withLineup.cta.href, '/launches/');
  assert.ok(withLineup.dateRemoved);
  const none = await runWeek({ ok: true, week: 1, open: false, total: 0, label: 'Monday, Nov 23, 2026', now: 0 });
  assert.equal(none.cta.textContent, 'Get the lineup by email');
  assert.ok(!none.dateRemoved);
});

test('homepage copy says only what is true', () => {
  assert.ok(home.includes("The community ranks each week's launches. Every launch gets a badge. The week's top three lead the results."));
  assert.ok(!home.includes('The top three earn a badge.'));
  assert.ok(home.includes('<p>Free AI for private chat, automation, transcription and images.</p>'));
  assert.ok(!/replaces paid software/i.test(home));
});

test('the waitlist is for readers by default; "Your tool\'s website" shows only for makers, with or without JavaScript', () => {
  assert.ok(home.includes('<label><input type="radio" name="role" value="reader" checked> Here for free AI tools</label>'));
  assert.ok(!/value="maker" checked/.test(home));
  assert.ok(home.includes('@supports selector(:has(*)){.wl:not(:has(input[name="role"][value="maker"]:checked)) #toolRow{display:none}}'));
  const js = file('public/assets/home.js');
  assert.ok(js.includes("const syncTool=()=>{toolRow.hidden=form.role.value!=='maker';};") && js.includes('form.reset();syncTool();'));
});

test('hero: one badge with the date, short enough for one line; the week box keeps its heading but no second pill', () => {
  assert.ok(home.includes('<span class="badge"><i></i>Launch Week 1 · Nov 23</span>'));
  assert.ok(home.includes('<h2 id="week-h">Launch Week 1 is coming</h2>'));
  assert.ok(!home.includes('id="week-badge"'));
});

test('no tagline makes a claim the facts do not back (approved rewrites, 2026-11-06)', () => {
  const CLAIMS = /\b(zero setup|fully private|fully autonomous|nothing leaves|replaces?|best|no limits|privacy-first|friendly|modern|any AI model|verified against intel|private ChatGPT)\b|100%/i;
  assert.deepEqual(TOOLS.filter(t => CLAIMS.test(t.description)).map(t => `${t.name}: ${t.description}`), []);
  assert.equal(toolBySlug('ollama').description, 'Run open AI models on your own computer or server.');
  assert.equal(toolBySlug('pentagi').description, 'Self-hosted multi-agent system for automated pentests on systems you are authorized to test.');
});

test('Jan\'s tagline is factual, and tool pages label the skill level and both dates plainly', () => {
  const jan = toolBySlug('jan');
  assert.equal(jan.description, 'Offline desktop app for chatting with local AI models');
  const html = renderTool(jan);
  assert.ok(html.includes('<div><dt>Skill level</dt><dd>Basic</dd></div>'));
  assert.ok(html.indexOf('<dt>Skill level</dt>') > html.indexOf('id="side-h"'), 'in At a glance');
  assert.ok(!html.slice(html.indexOf('id="docs-h"'), html.indexOf('</section>', html.indexOf('id="docs-h"'))).includes('Level'), 'not under Paid parts');
  assert.match(html, /· Steps checked [A-Z][a-z]{2} \d{1,2}, \d{4}<\/p>/);
  assert.match(html, /<p class="ff-checked">Facts checked [A-Z][a-z]{2} \d{1,2}, \d{4}<\/p>/);
  assert.ok(!html.includes('Last checked'));
});
