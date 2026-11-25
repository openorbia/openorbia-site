// The weekly tool check keeps a dated snapshot on the tool-history branch (ops/scripts/save-history.mjs), never on main
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { snapshot, historyPath, BRANCH } from '../ops/scripts/save-history.mjs';

const root = new URL('../', import.meta.url);
const script = readFileSync(new URL('ops/scripts/save-history.mjs', root), 'utf8');
const workflow = readFileSync(new URL('.github/workflows/tool-check.yml', root), 'utf8');

const sample = [
  { name: 'Zed Tool', repo: 'zed/tool', checked: '2026-11-30', github: { license: 'MIT', archived: false, pushedAt: '2026-11-20', latestRelease: 'v1 (2026-11-01)', readme: 'abc123' },
    listing: { freeTier: 'Free', cardRequired: 'no', paidDeps: { level: 'none', what: 'None' }, catch: 'None', lastChecked: '2026-11-14' }, sources: { 'https://x.example/': 200 }, flags: [] },
  { name: 'Alpha', repo: 'alpha/a', github: { error: 'GitHub lookup failed' }, listing: {}, flags: ['GitHub lookup failed (repo deleted, private or renamed?)'] },
];

test('a snapshot keeps the facts worth tracking per tool, sorted by repo, and nothing else (no source statuses)', () => {
  const s = snapshot(sample, '2026-11-30');
  assert.equal(s.date, '2026-11-30');
  assert.deepEqual(s.tools.map(t => t.repo), ['alpha/a', 'zed/tool']);
  assert.deepEqual(s.tools[1], { name: 'Zed Tool', repo: 'zed/tool', license: 'MIT', archived: false, pushedAt: '2026-11-20', latestRelease: 'v1 (2026-11-01)',
    readme: 'abc123', error: null, freeTier: 'Free', cardRequired: 'no', paid: 'none', catch: 'None', lastChecked: '2026-11-14', flags: [] });
  assert.equal(s.tools[0].error, 'GitHub lookup failed');
  assert.ok(!JSON.stringify(s).includes('x.example'), 'source-link statuses stay in the weekly report');
  assert.equal(historyPath('2026-11-30'), 'history/2026-11-30.json');
});

test('--dry-run prints the snapshot and needs no token or network', () => {
  const dir = mkdtempSync(join(tmpdir(), 'oo-hist-'));
  const file = join(dir, 'tool-facts.json');
  writeFileSync(file, JSON.stringify(sample));
  const env = { ...process.env, GH_TOKEN: '', GH_REPO: '', PATH: '' };
  const out = execFileSync(process.execPath, [new URL('ops/scripts/save-history.mjs', root).pathname.replace(/^\/([A-Za-z]:)/, '$1'), file, '--dry-run'], { encoding: 'utf8', env });
  assert.equal(JSON.parse(out).tools.length, 2);
});

test('the script only ever writes to the tool-history branch, and the workflow says why it can write contents', () => {
  assert.equal(BRANCH, 'tool-history');
  assert.ok(!/heads\/main|branch: ['"]?main|ref=main/.test(script), 'never main');
  assert.match(workflow, /^permissions:\n  contents: write # only for the history snapshot on the tool-history branch/m);
  assert.match(workflow, /run: node ops\/scripts\/save-history\.mjs "\$RUNNER_TEMP\/tool-facts\.json"/);
  assert.ok(workflow.indexOf('save-history.mjs') > workflow.indexOf('tool-facts.mjs --all'), 'after the check');
  assert.match(workflow, /persist-credentials: false/, 'the checkout still keeps no token');
  for (const [, ref] of workflow.matchAll(/uses: [^@\s]+@(\S+)/g)) assert.match(ref, /^[0-9a-f]{40}$/);
});
