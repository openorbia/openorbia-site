import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFilters, filterQuery, matchesRow, emptyFilters, setupKey, SETUP_FILTERS } from '../public/assets/launch-filters.js';
import { needsPaidService, paidSummary, NEEDS_PAID_LABEL, PAID_LEVELS } from '../public/assets/facts.js';
import { ROWS, TOOLS } from '../public/assets/tools.js';
import { renderTool } from '../lib/tool-pages.js';

const root = new URL('../', import.meta.url);
const file = f => readFileSync(new URL(f, root), 'utf8');
const data = JSON.parse(file('data/free-facts.json'));
const run = state => ROWS.filter(r => matchesRow(r, { ...emptyFilters(), ...state }));

// ---- the address bar ----

test('filters are read from and written to the URL: /launch-list/?for=job&setup=browser', () => {
  const s = parseFilters('?for=job&setup=browser');
  assert.deepEqual(s, { ...emptyFilters(), for: 'job', setup: 'browser' });
  assert.equal(filterQuery(s), '?for=job&setup=browser');
  assert.equal(filterQuery(emptyFilters()), '');
  const all = { for: 'sec', setup: 'selfhost', free: true, os: true, local: true, q: 'red team' };
  assert.equal(filterQuery(all), '?for=sec&setup=selfhost&free=1&os=1&local=1&q=red+team');
  assert.deepEqual(parseFilters(filterQuery(all)), all, 'what is written can be read back');
});

test('nothing unknown gets through: bad values are ignored, search text is trimmed and capped', () => {
  assert.deepEqual(parseFilters('?for=hacker&setup=anything&free=yes&os=0&local=true'), emptyFilters());
  assert.deepEqual(parseFilters('?for=__proto__&setup=constructor'), emptyFilters());
  assert.deepEqual(parseFilters('?for=toString&setup=hasOwnProperty', '#constructor'), emptyFilters());
  assert.equal(filterQuery({ ...emptyFilters(), for: '__proto__', setup: 'constructor' }), '');
  assert.equal(setupKey({ setup: 'constructor' }), '');
  assert.equal(setupKey({ setup: '__proto__' }), '');
  assert.equal(parseFilters('?q=%20%20hello%20%20').q, 'hello');
  assert.equal(parseFilters(`?q=${'x'.repeat(500)}`).q.length, 80);
  assert.equal(filterQuery({ ...emptyFilters(), for: 'nope', setup: 'nope' }), '');
  assert.equal(filterQuery({ ...emptyFilters(), q: '   ' }), '');
  assert.equal(filterQuery({ ...emptyFilters(), q: 'a&b=c' }), '?q=a%26b%3Dc', 'search text is encoded');
});

test('the older #biz / #job / #sec links (they are in public posts) still work, and ?for= wins over the hash', () => {
  for (const cat of ['biz', 'job', 'sec']) assert.equal(parseFilters('', `#${cat}`).for, cat);
  assert.equal(parseFilters('', '#nonsense').for, 'all');
  assert.equal(parseFilters('?for=sec', '#job').for, 'sec');
  assert.equal(parseFilters('?setup=desktop', '#biz').for, 'biz', 'other filters do not hide the hash');
  assert.equal(parseFilters('?for=bogus', '#job').for, 'all', 'a broken ?for= is not silently replaced');
});

// ---- the filters ----

test('Setup: every tool is in exactly one of No install / Desktop app / Self-host', () => {
  assert.deepEqual(Object.values(SETUP_FILTERS), ['No install', 'Desktop app', 'Self-host']);
  assert.equal(setupKey({ setup: 'Browser, ready to use' }), 'browser');
  assert.equal(setupKey({ setup: 'Desktop app' }), 'desktop');
  assert.equal(setupKey({ setup: 'Install & self-host' }), 'selfhost');
  assert.equal(setupKey({}), '');
  const counts = Object.keys(SETUP_FILTERS).map(k => run({ setup: k }).length);
  assert.equal(counts.reduce((a, b) => a + b, 0), ROWS.length, 'the three groups add up to every tool');
  for (const row of ROWS) assert.equal(Object.keys(SETUP_FILTERS).filter(k => matchesRow(row, { ...emptyFilters(), setup: k })).length, 1, row[0]);
});

test('Runs free hides exactly the tools that need a paid service', () => {
  const required = data.filter(e => e.paidDeps.level === 'required').map(e => e.name).sort();
  const hidden = ROWS.filter(r => !matchesRow(r, { ...emptyFilters(), free: true })).map(r => r[0]).sort();
  assert.deepEqual(hidden, required);
  assert.ok(required.length >= 1);
  assert.equal(run({ free: true }).length, ROWS.length - required.length);
  // a tool that only has an optional paid service, or none, stays
  for (const r of ROWS) if (['none', 'optional'].includes(r[8].paidDeps.level)) assert.ok(matchesRow(r, { ...emptyFilters(), free: true }), r[0]);
});

test('filters combine: for + setup, free + for, the older Open source and local AI chips, and search', () => {
  const jobBrowser = run({ for: 'job', setup: 'browser' });
  assert.ok(jobBrowser.every(r => r[3] === 'job' && setupKey(r[8]) === 'browser'));
  assert.ok(jobBrowser.length <= run({ for: 'job' }).length && jobBrowser.length <= run({ setup: 'browser' }).length);
  const jobFree = run({ for: 'job', free: true });
  assert.ok(jobFree.every(r => !needsPaidService(r[8])) && jobFree.length < run({ for: 'job' }).length, 'a Job Seekers tool needs a paid service');
  assert.ok(run({ os: true }).every(r => r[4] === 'os') && run({ local: true }).every(r => r[6]));
  assert.deepEqual(run({ q: 'ollama' }).map(r => r[0]).includes('Ollama'), true);
  assert.equal(run({ for: 'sec', q: 'zzz-not-a-tool' }).length, 0);
  assert.equal(run({}).length, ROWS.length);
});

// ---- the "Needs paid service" label ----

test('the label is for tools whose paidDeps level is "required", and for no others', () => {
  assert.equal(NEEDS_PAID_LABEL, 'Needs paid service');
  assert.deepEqual(PAID_LEVELS, ['none', 'optional', 'required']);
  assert.equal(needsPaidService({ paidDeps: { level: 'required' } }), true);
  for (const f of [{ paidDeps: { level: 'optional' } }, { paidDeps: { level: 'none' } }, { paidDeps: {} }, {}, null, undefined, 'required']) assert.equal(needsPaidService(f), false);
  const labelled = ROWS.filter(r => needsPaidService(r[8])).map(r => r[0]).sort();
  assert.deepEqual(labelled, data.filter(e => e.paidDeps.level === 'required').map(e => e.name).sort());
});

test('paidSummary reads the level and what it is', () => {
  assert.equal(paidSummary({ paidDeps: { level: 'none', what: 'None' } }), 'None');
  assert.equal(paidSummary({ paidDeps: { level: 'optional', what: 'Ollama (free) or your own OpenAI key' } }), 'Optional: Ollama (free) or your own OpenAI key');
  assert.equal(paidSummary({ paidDeps: { level: 'required', what: 'Paid Claude plan' } }), 'Required: Paid Claude plan');
  assert.equal(paidSummary({ paidDeps: { level: 'weird', what: 'x' } }), '');
  assert.equal(paidSummary({}), '');
  assert.equal(paidSummary(null), '');
});

test('the data file has the docs facts for all 45 listed tools, with sources', () => {
  assert.equal(data.length, 45);
  for (const e of data) {
    assert.ok(PAID_LEVELS.includes(e.paidDeps.level) && e.paidDeps.what, e.name);
    assert.equal(e.level, 'basic', e.name);
    assert.ok(e.task && e.task.length <= 80, e.name);
    assert.ok(e.sources.length >= 1 && e.sources.length <= 3 && e.sources.every(u => u.startsWith('https://')), e.name);
    assert.ok(['high', 'medium', 'low'].includes(e.confidence), e.name);
  }
});

// ---- the Launch List page ----

test('the Launch List page has the Setup and Runs free controls, keeps the filters in the URL, and shows the label', () => {
  const html = file('public/launch-list/index.html');
  for (const [key, label] of Object.entries(SETUP_FILTERS)) assert.ok(html.includes(`<button class="chip" data-setup="${key}" aria-pressed="false">${label}</button>`), label);
  assert.ok(html.includes('<button class="chip" data-f="free" aria-pressed="false">Runs free</button>'));
  assert.ok(html.includes('<div class="chips" role="group" aria-label="Setup">'));
  assert.ok(html.includes('from"/assets/launch-filters.js"') && html.includes('parseFilters(location.search,location.hash)'), 'the state starts from the URL');
  assert.ok(html.includes('history.replaceState(null,"",location.pathname+filterQuery(st))'), 'and is written back to it');
  assert.ok(html.includes('matchesRow(t,st)'));
  assert.ok(html.includes('needsPaidService(facts)?`<span class="tg paid">${NEEDS_PAID_LABEL}</span>`'), 'the label on the card');
  assert.ok(file('public/assets/launch.css').includes('.tg.paid{') && html.includes('.tg.paid{'));
});

// ---- the tool pages ----

test('tool pages: the label only where a paid service is required, and "Free facts from docs" with level, paid service, task and sources', () => {
  for (const t of TOOLS) {
    const html = renderTool(t), f = t.facts;
    assert.equal(html.includes('<span class="tg paid">Needs paid service</span>'), f.paidDeps.level === 'required', `${t.name}: label`);
    assert.ok(html.includes('<h2 id="docs-h">Free facts from docs</h2>'), `${t.name}: heading`);
    assert.ok(html.includes('<dt>Level</dt><dd>Basic</dd>'), `${t.name}: level`);
    const text = html.replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    assert.ok(text.includes(`<dt>Paid service</dt><dd>${paidSummary(f)}</dd>`), `${t.name}: paid service`);
    assert.ok(text.includes(f.task), `${t.name}: task`);
    for (const url of f.sources) assert.ok(html.includes(`href="${url}"`), `${t.name}: source ${url}`);
    assert.ok(html.includes('href="/launch-list/?for='), `${t.name}: category links use ?for=`);
    assert.ok(!html.includes('/launch-list/#'), `${t.name}: no old #category links`);
  }
});
