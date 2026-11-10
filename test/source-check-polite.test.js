// The weekly source check is polite and only reports: robots.txt, one request at a time per host, at most once a week,
// a plain user agent, safe issue text, and a workflow that reads the repository and can only open issues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { robotsRules, robotsAllows, robotsPolicy, tooSoon, byHost, codeSpan, capReport, buildReport, ISSUE_BODY_MAX, USER_AGENT } from '../lib/source-check.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const WORKFLOW = readFileSync(join(root, '.github/workflows/source-check.yml'), 'utf8');

test('robots.txt: our own group wins over "*", the longest rule wins, Allow wins a tie, * and $ work', () => {
  const txt = [
    '# comment', 'User-agent: *', 'Disallow: /', '',
    'User-agent: SomeBot', 'User-agent: OpenOrbiaSourceCheck', 'Disallow: /private', 'Allow: /private/pricing', 'Disallow: /*.pdf$', 'Disallow:',
  ].join('\n');
  const rules = robotsRules(txt);
  assert.equal(robotsAllows(rules, '/pricing'), true, 'our group replaces "*"');
  assert.equal(robotsAllows(rules, '/private/team'), false);
  assert.equal(robotsAllows(rules, '/private/pricing'), true, 'the longer Allow wins');
  assert.equal(robotsAllows(rules, '/docs/plan.pdf'), false);
  assert.equal(robotsAllows(rules, '/docs/plan.pdf?x=1'), true, '$ anchors the end');
  assert.equal(robotsAllows(robotsRules('User-agent: *\nDisallow: /a\nAllow: /a'), '/a'), true, 'Allow wins a tie');
  const star = robotsRules('User-agent: *\nDisallow: /');
  assert.equal(robotsAllows(star, '/anything'), false, 'with no group of ours, "*" applies');
  assert.equal(robotsAllows(star, '/robots.txt'), true);
  assert.equal(robotsAllows(robotsRules('User-agent: *\nDisallow: /a$b'), '/a$b'), false, 'a "$" inside a rule is literal');
  assert.deepEqual(robotsRules('User-agent: *\nDisallow:'), [], 'an empty Disallow allows everything');
});

test('robots.txt answers: missing (4xx) allows everything; a server error or no answer skips the whole site', () => {
  assert.deepEqual(robotsPolicy({ ok: false, httpStatus: 404 }), { rules: [] });
  assert.match(robotsPolicy({ ok: false, httpStatus: 503 }).blocked, /HTTP 503/);
  assert.match(robotsPolicy({ ok: false }).blocked, /could not be read/);
  assert.equal(robotsAllows(robotsPolicy({ ok: true, httpStatus: 200, text: 'User-agent: *\nDisallow: /x' }).rules, '/x'), false);
});

test('at most once a week: a run within 6 days of the last saved one is skipped', () => {
  const now = Date.parse('2026-11-09T15:00:00Z');
  assert.equal(tooSoon('2026-11-05T15:00:00Z', now), true);
  assert.equal(tooSoon('2026-11-03T15:00:01Z', now), true);
  assert.equal(tooSoon('2026-11-02T15:00:00Z', now), false);
  assert.equal(tooSoon(undefined, now), false, 'first run');
  assert.equal(tooSoon('not a date', now), false);
});

test('pages are grouped by host, so each host gets one request at a time', () => {
  const groups = byHost([{ fetchUrl: 'https://a.test/1' }, { fetchUrl: 'https://b.test/1' }, { fetchUrl: 'https://a.test/2' }]);
  assert.deepEqual(groups.map(g => [g.host, g.targets.length]), [['a.test', 2], ['b.test', 1]]);
  const script = readFileSync(join(root, 'scripts/check-sources.mjs'), 'utf8');
  assert.ok(/for \(const t of list\) \{/.test(script) && /await read\(t\)/.test(script), 'a host\'s pages are fetched one after another');
});

test('the user agent names the check and its page, and no person', () => {
  assert.equal(USER_AGENT, 'OpenOrbiaSourceCheck/1.0 (+https://openorbia.com/how-we-check/)');
  assert.ok(!/Mozilla/.test(readFileSync(join(root, 'scripts/check-sources.mjs'), 'utf8')));
});

test('page text goes into the issue as code, so it cannot @mention anyone or add links', () => {
  assert.equal(codeSpan('Ask @someone'), '` Ask @someone `');
  assert.equal(codeSpan('use `npm` now'), '`` use `npm` now ``');
  assert.equal(codeSpan('a\nb'), '` a b `');
  const md = buildReport([
    { url: 'https://a.test/', tools: ['A'], status: 'pricing', added: ['Pro plan, ask @sales'], removed: [] },
    { url: 'https://b.test/x', tools: ['B'], status: 'robots', detail: 'disallowed by b.test/robots.txt' },
  ], '2026-11-09');
  assert.ok(md.includes('- ` Pro plan, ask @sales `'));
  assert.ok(md.includes('## Skipped: robots.txt does not allow it') && md.includes('**B**: https://b.test/x'));
  assert.match(md, /1 official pages checked\..* 1 skipped \(robots\.txt\)/);
});

test('the issue body stays below GitHub\'s 65,536-character limit and says where the rest is', () => {
  assert.ok(ISSUE_BODY_MAX < 65536);
  const long = Array.from({ length: 5000 }, (_, i) => `- line ${i} ${'x'.repeat(30)}`).join('\n');
  const cut = capReport(long);
  assert.ok(cut.length <= ISSUE_BODY_MAX && cut.length > ISSUE_BODY_MAX - 200, String(cut.length));
  assert.match(cut, /The full report is in the run summary/);
  assert.equal(capReport('short\n'), 'short\n');
});

test('the workflow reads the repo and can only open issues; snapshots live in the Actions cache, saved before the issue', () => {
  assert.match(WORKFLOW, /\npermissions:\n {2}contents: read\n {2}issues: write\n\n/);
  assert.ok(!/contents: write|git push|git commit/.test(WORKFLOW), 'never commits or pushes');
  const uses = WORKFLOW.match(/uses: \S+/g);
  assert.ok(uses.length >= 4 && uses.every(u => /@[0-9a-f]{40}$/.test(u)), uses.join(', '));
  for (const block of WORKFLOW.split(/\n {6}- /)) {
    const run = /\n? {8}run: (.*)/.exec(block);
    if (run) assert.ok(!run[1].includes('${{'), `no expression inside run: ${run[1]}`);
  }
  const save = WORKFLOW.indexOf('Save the new snapshots'), issue = WORKFLOW.indexOf('Open an issue');
  assert.ok(WORKFLOW.indexOf('actions/cache/restore@') < save && save < issue, 'saved before the issue step');
  assert.match(WORKFLOW, /path: \.ops-cache\/source-snapshots\.json/);
  assert.ok(!existsSync(join(root, 'data/source-snapshots.json')), 'no committed snapshots');
  assert.match(readFileSync(join(root, '.gitignore'), 'utf8'), /^\.ops-cache/m);
});

test('the script fetches nothing when the last saved run is under 6 days old, and says so in its outputs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'source-check-'));
  try {
    const snaps = join(dir, 'snaps.json'), out = join(dir, 'out.txt'), body = join(dir, 'issue.md');
    const saved = { checkedAt: new Date(Date.now() - 2 * 864e5).toISOString(), pages: { 'https://a.test/': { hash: 'x', pricing: [] } } };
    writeFileSync(snaps, JSON.stringify(saved));
    writeFileSync(out, '');
    const r = spawnSync(process.execPath, [join(root, 'scripts/check-sources.mjs'), '--snapshots', snaps, '--issue-body', body], { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: out } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Source check skipped/);
    assert.equal(r.stderr, '', 'no page was fetched');
    assert.match(readFileSync(out, 'utf8'), /needs_look=false\nskipped=true\n/);
    assert.deepEqual(JSON.parse(readFileSync(snaps, 'utf8')), saved, 'the saved snapshots are untouched');
    assert.match(readFileSync(body, 'utf8'), /skipped/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
