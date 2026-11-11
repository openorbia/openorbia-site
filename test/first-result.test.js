// "First useful result" (lib/first-result.js): the data's shape, the labels, and the section on /tool/<slug>/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOLS, toolBySlug } from '../public/assets/tools.js';
import { firstResultProblems, renderFirstResult, FIRST_RESULT_LABELS, stepHtml, renderFirstResultStrip, toolsWithFirstResult } from '../lib/first-result.js';
import { firstResultsHtml } from '../scripts/build-home.mjs';
import { renderTool } from '../lib/tool-pages.js';

const data = JSON.parse(readFileSync(new URL('../data/free-facts.json', import.meta.url), 'utf8'));
const withResult = TOOLS.filter(t => t.facts.firstResult);
const SLUGS = ['anythingllm', 'meetily', 'resume-matcher', 'garak', 'jan'];

test('exactly the five chosen tools have a first result, in both data files, and they match', () => {
  assert.deepEqual(withResult.map(t => t.slug).sort(), [...SLUGS].sort());
  const inJson = data.filter(x => x.firstResult);
  assert.equal(inJson.length, 5);
  for (const x of inJson) {
    const t = TOOLS.find(t => t.repo.toLowerCase() === x.repo.toLowerCase());
    assert.deepEqual(JSON.parse(JSON.stringify(t.facts.firstResult)), x.firstResult, x.name);
  }
});

test('every first result has a valid shape: one-line fields, 3 to 6 steps, https sources, a real date', () => {
  for (const t of withResult) assert.deepEqual(firstResultProblems(t.facts.firstResult), [], t.name);
  for (const x of data.filter(x => x.firstResult)) assert.deepEqual(firstResultProblems(x.firstResult), [], x.name);
});

test('the label is only "docs" or "tested", and no tool claims "tested" (nobody has run these yet)', () => {
  assert.deepEqual(Object.keys(FIRST_RESULT_LABELS), ['docs', 'tested']);
  for (const t of withResult) assert.equal(t.facts.firstResult.label, 'docs', t.name);
  const base = withResult[0].facts.firstResult;
  assert.deepEqual(firstResultProblems({ ...base, label: 'verified' }), ['label: "docs" or "tested"']);
  assert.deepEqual(firstResultProblems({ ...base, label: undefined }), ['label: "docs" or "tested"']);
});

test('every source is an https URL; http, other schemes or junk are refused', () => {
  for (const t of withResult) assert.ok(t.facts.firstResult.sources.every(u => u.startsWith('https://')), t.name);
  const base = withResult[0].facts.firstResult;
  for (const bad of [['http://example.com'], ['javascript:alert(1)'], ['https://a b'], [], 'https://x.com'])
    assert.ok(firstResultProblems({ ...base, sources: bad }).some(p => p.startsWith('sources')), JSON.stringify(bad));
});

test('the shape check refuses missing fields, too few or too many steps, unknown fields and fake dates', () => {
  const base = withResult[0].facts.firstResult;
  assert.ok(firstResultProblems({ ...base, canFinish: '' }).length);
  assert.ok(firstResultProblems({ ...base, steps: ['one', 'two'] }).length);
  assert.ok(firstResultProblems({ ...base, steps: Array(7).fill('step') }).length);
  assert.ok(firstResultProblems({ ...base, needs: [] }).length);
  assert.ok(firstResultProblems({ ...base, testedBy: 'OpenOrbia' }).length);
  assert.ok(firstResultProblems({ ...base, lastChecked: '2026-02-30' }).length);
  assert.deepEqual(firstResultProblems(null), ['not an object']);
});

test('the Resume Matcher and garak free paths use a local model, not a paid API', () => {
  const rm = toolBySlug('resume-matcher').facts.firstResult;
  assert.match(rm.canFinish, /local Ollama model/);
  assert.ok(rm.steps.some(s => /ollama pull/.test(s)) && rm.steps.some(s => /choose Ollama/.test(s)));
  assert.ok(!/API key/.test(rm.steps.join(' ')), 'no API key step');
  const g = toolBySlug('garak').facts.firstResult;
  assert.ok(g.steps.some(s => s.includes('--target_type huggingface --target_name gpt2')));
  assert.ok(!/openai|OPENAI_API_KEY/i.test(g.steps.join(' ')), 'no paid target in the steps');
});

test('the section on a tool page: in order, numbered steps, label and date, sources, and before the facts', () => {
  const html = renderTool(toolBySlug('jan'));
  const at = s => html.indexOf(s);
  const order = ['<h2 id="fr-h">First useful result</h2>', '<h3>What you can finish for free</h3>', '<h3>What you need</h3>', '<h3>Steps</h3>', '<h3>Expected result</h3>', '<h3>The catch</h3>',
    'Facts checked against docs</span> · First result checked Nov 4, 2026', 'Sources: <a href="https://docs.jan.ai/desktop/quickstart"'];
  for (let i = 0; i < order.length; i++) assert.ok(at(order[i]) > (i ? at(order[i - 1]) : -1), `${order[i]} in order`);
  assert.ok(at('<h2 id="fr-h">') < at('class="ffacts'), 'before the Free facts');
  assert.equal((html.match(/<ol class="fr-steps">/g) || []).length, 1);
  assert.equal((html.match(/<ol class="fr-steps">([\s\S]*?)<\/ol>/)[1].match(/<li>/g) || []).length, toolBySlug('jan').facts.firstResult.steps.length);
  assert.ok(!html.includes('Hands-on tested</span>'), 'never labelled tested');
});

test('tools without a first result show no section at all', () => {
  const others = TOOLS.filter(t => !t.facts.firstResult);
  assert.ok(others.length >= 39);   // 44 tools since Twenty was removed (2026-11-11)
  for (const t of others) {
    const html = renderTool(t);
    assert.ok(!html.includes('First useful result') && !html.includes('fr-h'), t.name);
  }
});

test('everything in the section is escaped', () => {
  const base = withResult[0].facts.firstResult;
  const evil = '<img src=x onerror=alert(1)>"&';
  const html = renderFirstResult({ ...base, canFinish: evil, needs: [evil], steps: [evil, evil, evil], expected: evil, catch: evil,
    sources: ['https://example.com/?a="><script>x</script>'] });
  assert.ok(!html.includes('<img') && !html.includes('<script>'), 'no raw tags');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;&quot;&amp;'));
  assert.equal(renderFirstResult({ ...base, label: 'tested-ish' }), '', 'an invalid object renders nothing');
});

test('commands in steps: only `backtick` spans become <code>, and HTML inside them is still escaped', () => {
  assert.equal(stepHtml('Run `ollama pull gemma3:4b` first'), 'Run <code>ollama pull gemma3:4b</code> first');
  assert.equal(stepHtml('Two: `a` and `b`'), 'Two: <code>a</code> and <code>b</code>');
  assert.equal(stepHtml('No command here'), 'No command here');
  assert.equal(stepHtml('`<script>alert(1)</script>` & `"x" \'y\'`'),
    '<code>&lt;script&gt;alert(1)&lt;/script&gt;</code> &amp; <code>&quot;x&quot; &#39;y&#39;</code>');
  assert.equal(stepHtml('<b>bold</b> is text'), '&lt;b&gt;bold&lt;/b&gt; is text', 'only backticks make tags');
  // a whole section: the commands in the data render as code, with nothing unescaped
  const base = toolBySlug('garak').facts.firstResult;
  const html = renderFirstResult({ ...base, steps: ['Run `<img src=x onerror=alert(1)>`', ...base.steps.slice(1)] });
  assert.ok(html.includes('<li>Run <code>&lt;img src=x onerror=alert(1)&gt;</code></li>'));
  assert.ok(!html.includes('<img'));
});

test('the commands in the data are marked, render in <code> on the tool pages, and no step has a stray backtick', () => {
  const marked = {
    'resume-matcher': ['ollama pull gemma3:4b', 'git clone https://github.com/srbhr/Resume-Matcher.git', 'cd Resume-Matcher', 'docker compose up -d'],
    garak: ['python -m pip install -U garak', 'python3 -m garak --target_type huggingface --target_name gpt2 --spec probes.dan.Dan_11_0'],
  };
  for (const [slug, cmds] of Object.entries(marked)) {
    const html = renderTool(toolBySlug(slug));
    for (const c of cmds) assert.ok(html.includes(`<code>${c}</code>`), `${slug}: ${c}`);
    assert.ok(!/`/.test(html.match(/<ol class="fr-steps">[\s\S]*?<\/ol>/)[0]), `${slug}: no backticks left on the page`);
  }
  const base = withResult[0].facts.firstResult;
  assert.ok(firstResultProblems({ ...base, steps: ['Run `oops', 'two', 'three'] }).some(p => p.includes('backtick')));
});

// ---- the homepage strip, "Get a first result" ----

const home = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const stripBlock = () => home.slice(home.indexOf('<!-- first-results:start -->') + '<!-- first-results:start -->'.length, home.indexOf('<!-- first-results:end -->')).trim();

test('the homepage strip is exactly what the data gives (run npm run build:home after changing a first result)', () => {
  assert.equal(stripBlock(), firstResultsHtml());
});

test('the strip comes right after the featured tools and lists the five tools: name, what you can finish, a link to its tool page', () => {
  const at = s => home.indexOf(s);
  assert.ok(at('id="featured-h"') < at('<h2 class="sec-h" id="frs-h">Get a first result</h2>') && at('id="frs-h"') < at('id="cats-h"'), 'after featured, before the categories');
  assert.ok(home.indexOf('</section>', at('id="featured-h"')) < at('id="frs-h"'), 'its own section, not inside featured');
  const items = [...stripBlock().matchAll(/<li><a class="frs" href="\/tool\/([a-z0-9-]+)\/#fr-h"><b>([^<]+)<\/b><span>([^<]+)<\/span><\/a><\/li>/g)];
  assert.equal(items.length, 5);
  for (const [, slug, name, finish] of items) {
    const t = toolBySlug(slug);
    assert.ok(t && t.name === name, slug);
    assert.equal(finish.replace(/&#39;/g, "'").replace(/&amp;/g, '&'), t.facts.firstResult.canFinish, `${slug}: canFinish`);
    assert.ok(renderTool(t).includes('id="fr-h"'), `${slug}: the link's target exists`);
  }
  assert.deepEqual(items.map(i => i[1]).sort(), [...SLUGS].sort());
});

test('the strip escapes names and text, and skips tools whose first result is missing or invalid', () => {
  const base = withResult[0];
  const evil = { ...base, name: '<b>x</b>', facts: { ...base.facts, firstResult: { ...base.facts.firstResult, canFinish: '<img src=x onerror=alert(1)>' } } };
  const bad = { ...withResult[1], facts: { ...withResult[1].facts, firstResult: { ...withResult[1].facts.firstResult, label: 'tested-ish' } } };
  const html = renderFirstResultStrip([evil, bad, TOOLS.find(t => !t.facts.firstResult)]);
  assert.ok(!html.includes('<img') && html.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.equal((html.match(/<li>/g) || []).length, 1, 'only the valid one');
  assert.equal(toolsWithFirstResult(TOOLS).length, 5);
});

// Every command on a page is copied from the tool's official docs, never written by us. This pins each one to where it was copied
// from (checked 2026-11-04), so a change to a command has to be a deliberate change here too.
const COPIED_FROM_DOCS = {
  'resume-matcher': {
    'ollama pull gemma3:4b': 'SETUP.md, Option B: Local AI with Ollama (Free), Step 2',
    'git clone https://github.com/srbhr/Resume-Matcher.git': 'SETUP.md, 1. Clone the Repository',
    'cd Resume-Matcher': 'SETUP.md, 1. Clone the Repository',
    'docker compose up -d': 'SETUP.md, Docker Deployment, Quick Start with Docker Compose',
  },
  garak: {
    'python -m pip install -U garak': 'README, Install: Standard install with pip',
    'python3 -m garak --target_type huggingface --target_name gpt2 --spec probes.dan.Dan_11_0': 'README, Examples',
  },
};

test('every command in a step is one copied from the official docs (and listed here with where it came from)', () => {
  for (const t of withResult) {
    const cmds = t.facts.firstResult.steps.flatMap(s => [...s.matchAll(/`([^`]+)`/g)].map(m => m[1]));
    assert.deepEqual(cmds.sort(), Object.keys(COPIED_FROM_DOCS[t.slug] || {}).sort(), `${t.name}: commands`);
  }
});

test('Resume Matcher uses the documented Docker Compose method (bound to 127.0.0.1), not docker run -p, and says what Linux needs', () => {
  const fr = toolBySlug('resume-matcher').facts.firstResult;
  const all = JSON.stringify(fr);
  assert.ok(!/docker run|-p 3000:3000|0\.0\.0\.0/.test(all), 'nothing that publishes the app to the network');
  assert.ok(fr.steps.some(s => s.includes('`docker compose up -d`') && s.includes('127.0.0.1')));
  assert.ok(fr.needs.some(n => n.startsWith('Git and Docker')));
  assert.ok(fr.needs.some(n => n.startsWith('On Linux, Ollama must also listen beyond 127.0.0.1')));
  for (const anchor of ['#docker-deployment', '#using-ollama-with-docker', '#option-b-local-ai-with-ollama-free'])
    assert.ok(fr.sources.includes(`https://github.com/srbhr/Resume-Matcher/blob/main/SETUP.md${anchor}`), anchor);
});
