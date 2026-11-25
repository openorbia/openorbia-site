// scripts/audit-wording.mjs: the read-only wording audit (npm run audit:wording)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { audit, report, listFiles, PATTERNS, SKIP_DIRS } from '../scripts/audit-wording.mjs';

const sample = {
  'a.html': [
    'Voting closes Sunday at 11:59 PM Central.',
    'Opens 12:01 AM PT, or 3:01 AM ET.',
    'A free and open-source AI tool. Also: free and open source.',
    'Join the waitlist',
    'Every tool is checked by hand against its docs.',
    'We store nothing about you.',
    '47 tools, 1.8M+ stars, 12 makers, 3 subscribers, 1,200 readers',
    '<meta name="openorbia-launch" content="x">',
    'Nothing here: a party, the centrality of CPT codes, script, PTSD.',
  ].join('\n'),
};

test('each pattern finds its lines, with file and line number', () => {
  const h = audit(sample);
  assert.deepEqual(h['time-zone'].map(x => x.line), [1, 2]);
  assert.deepEqual(h['free-and-open-source'].map(x => x.line), [3]);
  assert.deepEqual(h.waitlist.map(x => x.line), [4]);
  assert.deepEqual(h['checked-by-hand'].map(x => x.line), [5]);
  assert.deepEqual(h['nothing-about-you'].map(x => x.line), [6]);
  assert.deepEqual(h['hardcoded-count'].map(x => x.line), [7]);
  assert.deepEqual(h['openorbia-launch'].map(x => x.line), [8]);
  assert.equal(h['time-zone'][0].file, 'a.html');
});

test('abbreviations are whole words, so ordinary words never match', () => {
  const h = audit({ 'b.txt': 'script, PTSD, CPT, ACTS, centrally, pacifically, CSTR, eastern seaboard' });
  assert.equal(h['time-zone'].length, 0);
});

test('the report groups by pattern, in a fixed order, with counts', () => {
  const r = report(audit(sample));
  const heads = r.split('\n').filter(l => l.startsWith('## '));
  assert.equal(heads.length, PATTERNS.length);
  assert.ok(heads[0].startsWith('## Time zone words') && heads[0].endsWith(': 2 line(s)'));
  assert.ok(r.includes('a.html:7  47 tools, 1.8M+ stars'));
});

test('the walk skips node_modules, .git and .wrangler, and binary files', () => {
  assert.deepEqual([...SKIP_DIRS].sort(), ['.git', '.wrangler', 'node_modules']);
  const files = listFiles(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  assert.ok(files.includes('lib/time.js') && files.includes('package.json'));
  assert.ok(!files.some(f => /^(node_modules|\.git|\.wrangler)\//.test(f)));
  assert.ok(!files.some(f => /\.(png|webp|woff2|ico)$/.test(f)));
  assert.ok(!files.includes('scripts/audit-wording.mjs') && !files.includes('test/audit-wording.test.js'), 'not its own files');
});

test('npm run audit:wording is wired, and the script never writes files', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['audit:wording'], 'node scripts/audit-wording.mjs');
  const src = readFileSync(new URL('../scripts/audit-wording.mjs', import.meta.url), 'utf8');
  assert.ok(!/writeFile|appendFile|unlink|rmSync|mkdir/.test(src), 'read-only');
});
