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
