import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROWS } from '../public/assets/tools.js';
import { CATCH_MAX } from '../public/assets/facts.js';

// The catches the official docs contradicted or did not confirm, and what each one says now. Each correction cites the page that states it.
const root = new URL('../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('data/free-facts.json', root), 'utf8'));
const entry = repo => data.find(e => e.repo.toLowerCase() === repo.toLowerCase());
const row = repo => ROWS.find(r => r[1].toLowerCase() === repo.toLowerCase());

// repo -> [what the catch must say now, the page that says it, claims that must be gone]
const CORRECTIONS = {
  'IvanIsCoding/ResuLLMe': ['self-hosted model such as Ollama', 'https://github.com/IvanIsCoding/ResuLLMe/blob/main/src/pages/03_FAQ.py', [/no local-model/i]],
  'infiniflow/ragflow': ['Ollama or vLLM', 'https://github.com/infiniflow/ragflow/blob/main/docs/guides/models/deploy_local_llm.mdx', [/x86/i, /needs a 16 GB/i, /plus your own AI model key/i]],
  'elie222/inbox-zero': ['Ollama (free) or your own key', 'https://docs.getinboxzero.com/hosting/environment-variables', [/and an AI key/i, /license terms/i]],
  'career-ops-hq/career-ops': ['rate limited', 'https://github.com/career-ops-hq/career-ops/blob/main/docs/RUNNING_ON_A_BUDGET.md', [/needs an AI coding CLI/i]],
  'activepieces/activepieces': ['SSO is on the paid Team plan', 'https://www.activepieces.com/pricing', [/SSO, audit logs and role controls are enterprise-only/i]],
  'TracecatHQ/tracecat': ['Free plan includes SSO and audit logs', 'https://tracecat.com/pricing', []],
  'mayank-glitch-cpu/JobSync-Service': ['supports MCP', 'https://github.com/mayank-glitch-cpu/JobSync-Service#readme', [/paid Anthropic/i, /Airtable account/i]],
  'saeedkolivand/ai-job-hunter-app': ['Sentry by default', 'https://github.com/saeedkolivand/ai-job-hunter-app#readme', [/beta/i]],
  'DaKheera47/job-ops': ['anonymous usage analytics', 'https://github.com/DaKheera47/job-ops#readme', [/analytics on by default/i]],
  'NVIDIA-NeMo/Guardrails': ['DO_NOT_TRACK=1', 'https://github.com/NVIDIA-NeMo/Guardrails/blob/develop/docs/telemetry.mdx', [/on by default/i]],
  'twentyhq/twenty': ['paid Organization key', 'https://github.com/twentyhq/twenty/blob/main/packages/twenty-docs/user-guide/billing/capabilities/pricing-plans.mdx', [/are paid-only/i]],
  'langgenius/dify': ['multi-workspace', 'https://github.com/langgenius/dify/blob/main/LICENSE', [/Self-host is one workspace/i, /can't be removed/i, /needs your own AI model keys/i]],
  'gitroomhq/postiz-app': ['developer app on each social network', 'https://docs.postiz.com/self-host/providers/overview.md', [/weeks/i]],
  'vxcontrol/pentagi': ['EULA applies', 'https://github.com/vxcontrol/pentagi/blob/master/EULA.md', [/large local model/i]],
};

test('each corrected catch says what the docs say, cites the page that says it, and no longer carries the old claim', () => {
  assert.equal(Object.keys(CORRECTIONS).length, 14);
  for (const [repo, [says, source, gone]] of Object.entries(CORRECTIONS)) {
    const e = entry(repo);
    assert.ok(e, repo);
    assert.ok(e.catch.includes(says), `${e.name}: "${e.catch}" should say "${says}"`);
    assert.ok(e.sources.includes(source), `${e.name}: sources should include ${source}`);
    assert.ok(e.sources.length >= 1 && e.sources.length <= 3, `${e.name}: 1 to 3 sources`);
    for (const re of gone) assert.ok(!re.test(e.catch), `${e.name}: the old claim ${re} is gone`);
    assert.ok(e.catch.length <= CATCH_MAX, `${e.name}: catch length ${e.catch.length}`);
    assert.equal(e.lastChecked, '2026-10-30', `${e.name}: lastChecked updated`);
    // the Launch List row carries exactly the same catch, sources and date
    const r = row(repo);
    assert.equal(r[8].catch, e.catch, `${e.name}: row catch`);
    assert.deepEqual([...r[8].sources], e.sources, `${e.name}: row sources`);
    assert.equal(r[8].lastChecked, e.lastChecked, `${e.name}: row date`);
  }
});

test('no unverified claim is kept: nothing on the Launch List says "on by default", "weeks" or "beta" about a tool', () => {
  for (const r of ROWS) {
    const catchLine = r[8].catch;
    assert.ok(!/on by default/i.test(catchLine), `${r[0]}: ${catchLine}`);
    assert.ok(!/\bweeks\b/i.test(catchLine) && !/\bbeta\b/i.test(catchLine), `${r[0]}: ${catchLine}`);
  }
});

test('yourspeakreps is gone from the data file, and the three tools the founder checked have their new confidence', () => {
  assert.ok(!data.some(e => /yourspeakreps/i.test(JSON.stringify(e))));
  assert.equal(data.length, ROWS.length);
  const confidence = name => data.find(e => e.name === name).confidence;
  assert.deepEqual([confidence('Interview Coach'), confidence('JobSync-Service'), confidence('HexStrike AI')], ['high', 'medium', 'medium']);
  assert.deepEqual(data.filter(e => e.confidence === 'low').map(e => e.name), [], 'nothing is left at low');
});

test('tools that were not corrected keep their catch, their sources and their date', () => {
  const untouched = data.filter(e => !Object.keys(CORRECTIONS).some(k => k.toLowerCase() === e.repo.toLowerCase()));
  assert.equal(untouched.length, data.length - 14);
  for (const e of untouched) assert.equal(row(e.repo)[8].catch, e.catch, e.name);
});
