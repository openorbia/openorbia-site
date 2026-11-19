import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS } from '../public/assets/tools.js';
import { SEC_NOTICE } from '../lib/tool-pages.js';
import * as pages from '../lib/tool-pages.js';

const render = pages.renderTool;

test('the notice says where security tools may be used', () => {
  assert.match(SEC_NOTICE, /systems you own or have written permission to test/);
});

test('every Security tool page carries the notice, and no other tool page does', () => {
  for (const tool of TOOLS) {
    const out = render(tool);
    const html = typeof out === 'string' ? out : JSON.stringify(out);
    assert.equal(html.includes('written permission to test'), tool.category === 'sec', tool.name);
  }
});
