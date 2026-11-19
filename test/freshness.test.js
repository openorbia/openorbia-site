// PR 9: the data freshness sprint of Nov 14, 2026. Every listed tool was re-checked that day (license and last activity on GitHub,
// facts against the README and the official pages), confidence is "high" only where at least two official sources agree, and the
// three catches that had gone stale say what the docs say now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOLS } from '../public/assets/tools.js';
import { listChecked, withListChecked } from '../scripts/build-home.mjs';

const data = JSON.parse(readFileSync(new URL('../data/free-facts.json', import.meta.url), 'utf8'));
const RECHECKED = '2026-11-14';
const by = repo => data.find(e => e.repo === repo);

test('the Launch List note gives the month of the oldest check, written by build:home from the data', () => {
  const list = readFileSync(new URL('../public/launch-list/index.html', import.meta.url), 'utf8');
  assert.equal(withListChecked(list), list, 'run npm run build:home');
  assert.equal(listChecked(), 'November 2026');
  assert.ok(list.includes('Listed by OpenOrbia from public GitHub repositories, checked November 2026.'));
  assert.equal(listChecked([{ facts: { lastChecked: '2026-11-14' } }, { facts: { lastChecked: '2026-09-02' } }]), 'September 2026', 'the oldest row decides');
  assert.throws(() => withListChecked('<p></p>'), /expected one/);
});

test('every row was checked on or after the Nov 14 re-check, in the data file and on the Launch List', () => {
  assert.equal(data.length, 47);   // Twenty removed (#30); 3 tools added 2026-11-19, checked that day
  for (const e of data) assert.ok(e.lastChecked >= RECHECKED, e.name);
  for (const t of TOOLS) assert.ok(t.facts.lastChecked >= RECHECKED, t.name);
  for (const t of TOOLS) assert.equal(t.facts.lastChecked, data.find(e => e.repo === t.repo).lastChecked, `${t.name}: same date in both`);
});

test('confidence is high only where at least two official sources back it', () => {
  for (const e of data) {
    assert.ok(['high', 'medium'].includes(e.confidence), e.name);
    if (e.confidence === 'high') assert.ok(e.sources.length >= 2, `${e.name}: high on ${e.sources.length} source`);
  }
  // raised: two official sources agree; lowered: only the README states the setup and AI needs
  for (const repo of ['n8n-io/n8n', 'activepieces/activepieces', 'langgenius/dify', 'gitroomhq/postiz-app', 'TracecatHQ/tracecat', 'Zackriya-Solutions/meetily', 'LibreChat-AI/LibreChat', 'janhq/jan'])
    assert.equal(by(repo).confidence, 'high', repo);
  for (const repo of ['NVIDIA/garak', 'ItzCrazyKns/Vane']) assert.equal(by(repo).confidence, 'medium', repo);
});

test('the stale catches follow the docs: Meetily ships Linux installers, Inbox Zero needs Google OAuth, career-ops drops "32B+"', () => {
  const meetily = by('Zackriya-Solutions/meetily');
  assert.ok(!/no linux installer/i.test(meetily.catch));
  assert.ok(meetily.catch.startsWith('Speaker identification, integrations and advanced exports are in paid PRO'));
  assert.deepEqual(meetily.sources, ['https://github.com/Zackriya-Solutions/meetily#readme', 'https://meetily.ai/pricing', 'https://github.com/Zackriya-Solutions/meetily/releases/tag/v0.5.0']);
  const inbox = by('elie222/inbox-zero');
  assert.ok(inbox.catch.startsWith('Self-hosting needs your own Google OAuth app (Microsoft is optional)'));
  assert.deepEqual(inbox.sources, ['https://github.com/elie222/inbox-zero#readme', 'https://docs.getinboxzero.com/hosting/environment-variables']);
  assert.ok(!/32B/.test(by('career-ops-hq/career-ops').catch));
  // and the Launch List rows carry the same text
  for (const repo of ['Zackriya-Solutions/meetily', 'elie222/inbox-zero', 'career-ops-hq/career-ops'])
    assert.equal(TOOLS.find(t => t.repo === repo).facts.catch, by(repo).catch, repo);
});
