// /llms.txt and /llms-full.txt (lib/llms.js), and the "not a security audit" line (lib/how-we-check.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { llmsTxt, llmsFullTxt } from '../lib/llms.js';
import { NOT_AN_AUDIT, NOT_AN_AUDIT_SHORT, renderHowWeCheck } from '../lib/how-we-check.js';
import { renderTool } from '../lib/tool-pages.js';
import { esc } from '../lib/html.js';
import { TOOLS } from '../public/assets/tools.js';
import { paidSummary } from '../public/assets/facts.js';

const file = p => readFileSync(new URL(`../public/${p}`, import.meta.url), 'utf8');

test('public/llms.txt and llms-full.txt are exactly what lib/llms.js writes (run npm run build:home after changing a tool)', () => {
  assert.equal(file('llms.txt'), llmsTxt());
  assert.equal(file('llms-full.txt'), llmsFullTxt());
});

test('llms.txt follows llmstxt.org: one H1, a blockquote summary, then H2 sections of Markdown links', () => {
  const t = llmsTxt();
  assert.ok(t.startsWith('# OpenOrbia\n\n> '));
  assert.equal((t.match(/^# /gm) || []).length, 1);
  assert.deepEqual((t.match(/^## .+$/gm) || []), ['## Small businesses', '## Job seekers', '## Security teams', '## Pages', '## Optional']);
  for (const line of t.split('\n').filter(l => l.startsWith('- ['))) assert.match(line, /^- \[[^\]]+\]\(https:\/\/openorbia\.com\/[a-z0-9\/-]*\)(: .+)?$/, line);
});

test('every tool is in both files once, with its own license, setup, free tier and catch; nothing is guessed', () => {
  const short = llmsTxt(), full = llmsFullTxt();
  for (const t of TOOLS) {
    const url = `https://openorbia.com/tool/${t.slug}/`;
    assert.equal(short.split(`(${url})`).length - 1, 1, t.slug);
    assert.equal(full.split(`- Page: ${url}\n`).length - 1, 1, t.slug);
    const line = short.split('\n').find(l => l.includes(`(${url})`));
    assert.ok(line.includes(`License: ${t.license}.`) && line.includes(`Setup: ${t.facts.setup || 'Not confirmed'}.`), t.slug);
    assert.ok(line.includes(`Free tier: ${t.facts.freeTier || 'Not confirmed'}.`) && line.includes(`The catch: ${t.facts.catch || 'Not confirmed'}`), t.slug);
    assert.ok(full.includes(`- Paid service: ${paidSummary(t.facts) || 'Not confirmed'}\n`), t.slug);
    for (const u of (t.facts.sources || []).filter(s => s.startsWith('https://'))) assert.ok(full.includes(u), u);
    assert.ok(full.includes(`- Hands-on tested by OpenOrbia: No\n`) || t.facts.testedBy, 'never claims hands-on testing without testedBy');
  }
  assert.ok(!short.includes('hands-on tested)') || TOOLS.some(t => t.facts.testedBy));
});

test('both files say what the checks cover and that they are not a security audit, and point to each other', () => {
  for (const t of [llmsTxt(), llmsFullTxt()]) {
    assert.ok(t.includes(NOT_AN_AUDIT));
    assert.ok(t.includes('No ads. No paid placement. No affiliate links.'));
  }
  assert.ok(llmsTxt().includes('https://openorbia.com/llms-full.txt') && llmsFullTxt().includes('https://openorbia.com/llms.txt'));
});

test('the How we check page has a "What our checks don\'t cover" section, and every tool page says it is not a security audit', () => {
  assert.match(NOT_AN_AUDIT, /not a security audit/);
  assert.ok(!/can't be bypassed|guarantee|fully secure|safe to run/i.test(NOT_AN_AUDIT + NOT_AN_AUDIT_SHORT), 'no safety promise');
  const page = renderHowWeCheck();
  assert.ok(page.includes('<h2 id="scope-h">What our checks don&#39;t cover</h2>') || page.includes('<h2 id="scope-h">What our checks don\'t cover</h2>'));
  assert.ok(page.includes(esc(NOT_AN_AUDIT)));
  for (const t of TOOLS) {
    const html = renderTool(t);
    assert.ok(html.includes(esc(NOT_AN_AUDIT_SHORT)) && html.includes('href="/how-we-check/#scope-h"'), t.slug);
  }
});
