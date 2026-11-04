// "First useful result" (lib/first-result.js): the data's shape, the labels, and the section on /tool/<slug>/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOLS, toolBySlug } from '../public/assets/tools.js';
import { firstResultProblems, renderFirstResult, FIRST_RESULT_LABELS } from '../lib/first-result.js';
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
    'Facts checked against docs</span> · Last checked Nov 4, 2026', 'Sources: <a href="https://docs.jan.ai/desktop/quickstart"'];
  for (let i = 0; i < order.length; i++) assert.ok(at(order[i]) > (i ? at(order[i - 1]) : -1), `${order[i]} in order`);
  assert.ok(at('<h2 id="fr-h">') < at('class="ffacts'), 'before the Free facts');
  assert.equal((html.match(/<ol class="fr-steps">/g) || []).length, 1);
  assert.equal((html.match(/<ol class="fr-steps">([\s\S]*?)<\/ol>/)[1].match(/<li>/g) || []).length, toolBySlug('jan').facts.firstResult.steps.length);
  assert.ok(!html.includes('Hands-on tested</span>'), 'never labelled tested');
});

test('tools without a first result show no section at all', () => {
  const others = TOOLS.filter(t => !t.facts.firstResult);
  assert.ok(others.length >= 40);
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
