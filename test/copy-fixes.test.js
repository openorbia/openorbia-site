// The "Find my free setup" line says the tools were checked against their docs, in every copy; the Launch List badge drops "Preview".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MENUS } from '../lib/header.js';
import { renderContact } from '../lib/contact.js';

const file = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const NEW = "We reply with a free setup from tools we've checked against their docs.";
const STATIC = ['public/index.html', 'public/launch-list/index.html', 'public/404.html'];

test('the Find my free setup line reads the new copy in the header menu, the static pages and /contact/', () => {
  assert.ok(MENUS.tools.includes(`Tell us the task. ${NEW}`));
  for (const page of STATIC) {
    const html = file(page);
    assert.ok(html.includes(`Tell us the task. ${NEW}`), page);
    assert.ok(!html.includes('a free setup we have checked'), page);
  }
  const contact = renderContact();
  assert.ok(contact.includes("we reply with a free setup from tools we've checked against their docs."));
  assert.ok(!contact.includes('a free setup we have checked'));
});

test('the Launch List badge says Launch List, without Preview', () => {
  const html = file('public/launch-list/index.html');
  assert.ok(html.includes('<span class="badge"><i></i>Launch List</span>'));
  assert.ok(!html.includes('Launch List · Preview'));
});
