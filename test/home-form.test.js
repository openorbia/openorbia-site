// The homepage waitlist form (public/assets/home.js), run against a small stand-in for the page: it must wait for the Turnstile token
// before it posts, because a post without one saves the signup but sends no welcome email.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/assets/home.js', import.meta.url), 'utf8');

function page({ tokenAfterPolls = 0, never = false } = {}) {
  const el = () => ({ textContent: '', className: '', hidden: false, disabled: false, value: '', addEventListener() {}, focus() {} });
  const handlers = {};
  const form = { ...el(), email: { value: 'me@example.com', focus() {} }, tool: { value: '' }, role: { value: 'reader' }, company: { value: '' },
    reset() {}, addEventListener: (type, fn) => { handlers[type] = fn; } };
  const els = { yr: el(), copyBtn: el(), wl: form, 'wl-msg': el(), 'wl-btn': el(), toolRow: el(), mail: el() };
  const tokenInput = { value: '' };
  let polls = 0;
  const posts = [];
  const ctx = {
    document: {
      getElementById: id => els[id],
      // each read of the hidden token field counts as one poll; the token "arrives" after the given number of polls
      querySelector: () => { if (polls++ >= tokenAfterPolls && !never) tokenInput.value = 'cf-token'; return tokenInput; },
    },
    navigator: {}, getSelection: () => ({}),
    setTimeout: fn => setImmediate(fn),
    fetch: async (url, init) => { posts.push({ url, body: JSON.parse(init.body), pollsSoFar: polls }); return { ok: true, json: async () => ({ message: "You're on the list." }) }; },
  };
  ctx.window = ctx;
  vm.runInNewContext(source, ctx);
  const submit = () => handlers.submit({ preventDefault() {} });
  return { submit, posts, msg: els['wl-msg'], btn: els['wl-btn'] };
}

test('a visitor who presses Join before the check has finished: the form waits, then posts with the token', async () => {
  const p = page({ tokenAfterPolls: 5 });
  await p.submit();
  assert.equal(p.posts.length, 1);
  assert.equal(p.posts[0].url, '/api/waitlist');
  assert.equal(p.posts[0].body.turnstile, 'cf-token', 'the post carries the token, not an empty string');
  assert.ok(p.posts[0].pollsSoFar > 5, 'the post went out only after the token appeared');
  assert.equal(p.msg.textContent, "You're on the list.");
  assert.equal(p.btn.disabled, false);
});

test('when the token is already there, the form posts straight away', async () => {
  const p = page({ tokenAfterPolls: 0 });
  await p.submit();
  assert.equal(p.posts[0].body.turnstile, 'cf-token');
  assert.equal(p.posts[0].pollsSoFar, 1);
});

test('if the check never runs (blocked script), the signup is still saved after the wait, and the visitor is told no email is coming', async () => {
  const p = page({ never: true });
  await p.submit();
  assert.equal(p.posts.length, 1, 'the signup is not lost');
  assert.equal(p.posts[0].body.turnstile, '');
  assert.ok(p.posts[0].pollsSoFar >= 75, 'it waited the full time first');
  assert.match(p.msg.textContent, /no welcome email this time/);
});
