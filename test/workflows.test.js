// A one-line `run:` whose command has ": " in it is invalid YAML (it reads as a new key), and GitHub then rejects the whole
// workflow: it never runs and every push shows a failed run with no jobs. Such commands go in a `run: |` block.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../.github/workflows/', import.meta.url);

test('no workflow has a one-line run: with ": " in its command', () => {
  for (const name of readdirSync(dir).filter(f => /\.ya?ml$/.test(f))) {
    readFileSync(new URL(name, dir), 'utf8').split('\n').forEach((line, i) => {
      const m = line.match(/^\s*(?:-\s+)?run:\s+(?![|>'"])(.*)$/);
      assert.ok(!(m && /:\s/.test(m[1])), `${name}:${i + 1} needs run: | (its command has ": ")`);
    });
  }
});

test('the source check opens its issue from a run: | block', () => {
  const yml = readFileSync(new URL('source-check.yml', dir), 'utf8');
  assert.match(yml, /run: \|\n\s+gh issue create --title "Source check \$\(date -u \+%F\): \$SUMMARY"/);
});

test('Seed launches runs only by hand, on main, after the production approval, with pinned actions and prune off by default', () => {
  const y = readFileSync(new URL('seed.yml', dir), 'utf8');
  assert.match(y, /^on:\n  workflow_dispatch:/m, 'manual only: no push, schedule or pull request trigger');
  assert.doesNotMatch(y, /^\s+(push|pull_request|schedule):/m);
  assert.match(y, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(y, /environment:\n\s+name: production/, 'waits for the founder approval like a production deploy');
  assert.match(y, /^permissions:\n  contents: read$/m);
  for (const [, ref] of y.matchAll(/uses: [^@\s]+@(\S+)/g)) assert.match(ref, /^[0-9a-f]{40}$/, 'actions pinned to a full commit SHA');
  const prune = y.slice(y.indexOf('      prune:'), y.indexOf('      prune:') + 200);
  assert.ok(prune.includes('type: boolean') && prune.includes('default: false'), 'prune is off unless chosen');
  assert.match(y, /PRUNE: \$\{\{ inputs\.prune \}\}/, 'the input reaches the shell through env, never pasted into the command');
  assert.ok(y.includes('node scripts/seed-launches.mjs --remote --yes'));
  assert.ok(y.indexOf('npm run launch:check') < y.indexOf('seed-launches.mjs --remote'), 'the data is checked before it is loaded');
});
