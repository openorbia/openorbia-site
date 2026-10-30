import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleSubmit, handleRequest, FORM_LIMIT } from '../lib/forms.js';
import { verifyTurnstile, SITEVERIFY_URL } from '../lib/turnstile.js';
import { renderSubmit, renderRequest, submitResponse } from '../lib/form-pages.js';
import { confirmationEmail, BREVO_URL } from '../lib/email.js';
import { MIGRATIONS } from '../lib/migrations.js';
import { createDb } from './helpers/d1.js';

const NOW = Date.parse('2026-11-01T18:00:00Z');
const ORIGIN = 'https://openorbia.com';

// a stand-in for fetch: Turnstile accepts the token "good", Brevo accepts everything; every call is recorded
function stubFetch({ turnstile = 'ok' } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url) === SITEVERIFY_URL) {
      if (turnstile === 'down') throw new Error('network');
      if (turnstile === 'bad-status') return new Response('no', { status: 500 });
      const token = new URLSearchParams(init.body).get('response');
      return new Response(JSON.stringify({ success: token === 'good' && turnstile === 'ok' }), { status: 200 });
    }
    return new Response('{}', { status: 201 });
  };
  return { fetchImpl, calls };
}

const submission = (over = {}) => ({
  tool_name: 'Orbit Notes', url: 'https://github.com/example/orbit-notes', maker_name: 'Sam Maker', email: 'Sam@Example.com', category: 'biz',
  license: 'MIT', free_tier: 'Everything is free when self-hosted', card_required: 'no', setup: 'selfhost', paid_level: 'none', paid_deps: '', assets_link: '', turnstile: 'good', ...over,
});
const question = (over = {}) => ({ task: 'Transcribe my team meetings', audience: 'biz', no_install: true, no_card: true, runs_locally: false, email: '', publish_ok: 'yes', turnstile: 'good', ...over });

const post = (path, body, { origin = ORIGIN, ip = '1.1.1.1', type = 'application/json', raw } = {}) => new Request(`https://openorbia.com${path}`, {
  method: 'POST', body: raw ?? JSON.stringify(body),
  headers: { 'content-type': type, ...(origin ? { origin } : {}), 'cf-connecting-ip': ip, 'user-agent': `UA-${ip}` },
});

const FORMS = [
  { name: 'submit', path: '/api/submit', handler: handleSubmit, valid: submission, table: 'submissions' },
  { name: 'request', path: '/api/request', handler: handleRequest, valid: question, table: 'requests' },
];

function setup() {
  const db = createDb();
  const env = { DB: db, VOTE_SECRET: 'test-secret', TURNSTILE_SECRET_KEY: 'ts-secret' };
  const rows = t => db.rows(`SELECT * FROM ${t}`);
  return { db, env, rows };
}

for (const f of FORMS) {
  test(`${f.name}: a valid post is saved with status "new" and answers 200`, async () => {
    const { env, rows } = setup();
    const { fetchImpl } = stubFetch();
    const res = await f.handler({ request: post(f.path, f.valid()), env, now: NOW, fetchImpl });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
    const saved = rows(f.table);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].status, 'new');
  });

  test(`${f.name}: a failed Turnstile check saves nothing and says so honestly`, async () => {
    const { env, rows } = setup();
    const { fetchImpl } = stubFetch();
    const res = await f.handler({ request: post(f.path, f.valid({ turnstile: 'forged' })), env, now: NOW, fetchImpl });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'turnstile_failed');
    assert.match(body.error, /confirm you're human/);
    assert.equal(rows(f.table).length, 0);
  });

  test(`${f.name}: a missing Turnstile token fails without asking Cloudflare`, async () => {
    const { env, rows } = setup();
    const { fetchImpl, calls } = stubFetch();
    const res = await f.handler({ request: post(f.path, f.valid({ turnstile: '' })), env, now: NOW, fetchImpl });
    assert.equal((await res.json()).code, 'turnstile_failed');
    assert.equal(calls.length, 0);
    assert.equal(rows(f.table).length, 0);
  });

  test(`${f.name}: when Cloudflare cannot be reached the answer is 503, not "you are a bot", and nothing is saved`, async () => {
    for (const turnstile of ['down', 'bad-status']) {
      const { env, rows } = setup();
      const { fetchImpl } = stubFetch({ turnstile });
      const res = await f.handler({ request: post(f.path, f.valid()), env, now: NOW, fetchImpl });
      assert.equal(res.status, 503);
      assert.equal((await res.json()).code, 'turnstile_unavailable');
      assert.equal(rows(f.table).length, 0);
    }
  });

  test(`${f.name}: the Turnstile call sends the secret and the token, and no IP address`, async () => {
    const { env } = setup();
    const { fetchImpl, calls } = stubFetch();
    await f.handler({ request: post(f.path, f.valid(), { ip: '203.0.113.9' }), env, now: NOW, fetchImpl });
    const call = calls.find(c => c.url === SITEVERIFY_URL);
    const sent = new URLSearchParams(call.init.body);
    assert.deepEqual([...sent.keys()].sort(), ['response', 'secret']);
    assert.equal(sent.get('secret'), 'ts-secret');
    assert.ok(!call.init.body.includes('203.0.113.9'));
  });

  test(`${f.name}: the sixth post inside an hour is rate limited (429 with Retry-After), and the limit is per visitor`, async () => {
    const { env, rows } = setup();
    const { fetchImpl } = stubFetch();
    for (let i = 0; i < FORM_LIMIT.max; i++) {
      const res = await f.handler({ request: post(f.path, f.valid()), env, now: NOW + i, fetchImpl });
      assert.equal(res.status, 200, `post ${i + 1}`);
    }
    const res = await f.handler({ request: post(f.path, f.valid()), env, now: NOW + 10, fetchImpl });
    assert.equal(res.status, 429);
    assert.equal((await res.json()).code, 'rate_limited');
    assert.ok(Number(res.headers.get('retry-after')) > 0);
    assert.equal(rows(f.table).length, FORM_LIMIT.max);
    const other = await f.handler({ request: post(f.path, f.valid(), { ip: '9.9.9.9' }), env, now: NOW + 11, fetchImpl });
    assert.equal(other.status, 200);
    // a new hour is a new budget
    const later = await f.handler({ request: post(f.path, f.valid()), env, now: NOW + 3600 * 1000 + 20, fetchImpl });
    assert.equal(later.status, 200);
  });

  test(`${f.name}: only our own pages may post; the raw IP and user agent are never stored`, async () => {
    const { env, db, rows } = setup();
    const { fetchImpl } = stubFetch();
    for (const origin of ['https://evil.example', null]) {
      const res = await f.handler({ request: post(f.path, f.valid(), { origin }), env, now: NOW, fetchImpl });
      assert.equal(res.status, 403);
      assert.equal((await res.json()).code, 'forbidden_origin');
    }
    const ok = await f.handler({ request: post(f.path, f.valid(), { origin: 'https://launch-day.openorbia.pages.dev', ip: '198.51.100.77' }), env, now: NOW, fetchImpl });
    assert.equal(ok.status, 200);
    const everything = JSON.stringify([rows(f.table), db.rows('SELECT * FROM rate_limits')]);
    assert.ok(!everything.includes('198.51.100.77') && !everything.includes('UA-198.51.100.77'));
  });

  test(`${f.name}: not configured (no database, secret or Turnstile key) answers 503; wrong type or broken JSON answers 4xx`, async () => {
    const { env } = setup();
    const { fetchImpl } = stubFetch();
    for (const broken of [{}, { ...env, DB: undefined }, { ...env, VOTE_SECRET: '' }, { ...env, TURNSTILE_SECRET_KEY: undefined }]) {
      const res = await f.handler({ request: post(f.path, f.valid()), env: broken, now: NOW, fetchImpl });
      assert.equal(res.status, 503);
    }
    assert.equal((await f.handler({ request: post(f.path, null, { type: 'text/plain', raw: 'x' }), env, now: NOW, fetchImpl })).status, 415);
    assert.equal((await f.handler({ request: post(f.path, null, { raw: '{' }), env, now: NOW, fetchImpl })).status, 400);
    assert.equal((await f.handler({ request: post(f.path, null, { raw: '[]' }), env, now: NOW, fetchImpl })).status, 400);
    assert.equal((await f.handler({ request: post(f.path, null, { raw: JSON.stringify({ task: 'x'.repeat(9000) }) }), env, now: NOW, fetchImpl })).status, 400);
  });

  test(`${f.name}: the hidden field makes a bot look successful but saves nothing and calls nobody`, async () => {
    const { env, rows } = setup();
    const { fetchImpl, calls } = stubFetch();
    const res = await f.handler({ request: post(f.path, f.valid({ company: 'Acme' })), env, now: NOW, fetchImpl });
    assert.equal(res.status, 200);
    assert.equal(rows(f.table).length, 0);
    assert.equal(calls.length, 0);
  });
}

// ---- field checks: each says which field and what to fix ----

async function rejects(f, body, field, pattern) {
  const { env, rows } = setup();
  const { fetchImpl, calls } = stubFetch();
  const res = await f.handler({ request: post(f.path, body), env, now: NOW, fetchImpl });
  assert.equal(res.status, 400, `${field}: status`);
  const out = await res.json();
  assert.deepEqual([out.code, out.field], ['invalid', field]);
  assert.match(out.error, pattern);
  assert.equal(rows(f.table).length, 0);
  assert.equal(calls.length, 0, 'a form with a mistake does not use up the Turnstile token');
}
const [SUBMIT, REQUEST] = FORMS;

test('submit: every required field is required, with a message that names it', async () => {
  for (const [field, pattern] of [['tool_name', /Tool name is required/], ['url', /repo or website is required/], ['maker_name', /Your name is required/], ['email', /Your email is required/],
    ['license', /License is required/], ['free_tier', /What's free is required/], ['category', /Choose a category/], ['card_required', /Choose whether a card/], ['setup', /Choose how it is set up/], ['paid_level', /Choose whether it needs a paid service/]]) {
    await rejects(SUBMIT, submission({ [field]: '' }), field, pattern);
  }
});

test('submit: links must be https, the email must look right, lengths are limited, and paid tools must name the paid service', async () => {
  await rejects(SUBMIT, submission({ url: 'http://example.com/tool' }), 'url', /starting with https/);
  await rejects(SUBMIT, submission({ url: 'javascript:alert(1)' }), 'url', /starting with https/);
  await rejects(SUBMIT, submission({ email: 'not-an-email' }), 'email', /valid email/);
  await rejects(SUBMIT, submission({ tool_name: 'x'.repeat(81) }), 'tool_name', /80 characters or fewer \(it is 81\)/);
  await rejects(SUBMIT, submission({ free_tier: 'x'.repeat(301) }), 'free_tier', /300 characters/);
  await rejects(SUBMIT, submission({ assets_link: 'ftp://files.example.com' }), 'assets_link', /https/);
  await rejects(SUBMIT, submission({ category: '__proto__' }), 'category', /Choose a category/);
  await rejects(SUBMIT, submission({ paid_level: 'required', paid_deps: '' }), 'paid_deps', /which paid service/);
});

test('submit: the saved row is cleaned: email lower-cased, links normalised, control characters dropped, optional fields empty', async () => {
  const { env, rows } = setup();
  const { fetchImpl } = stubFetch();
  await handleSubmit({ request: post('/api/submit', submission({ tool_name: '  Orbit\u0007 Notes  ', paid_level: 'optional', paid_deps: 'An AI key', assets_link: 'https://example.com/assets' })), env, now: NOW, fetchImpl });
  const [r] = rows('submissions');
  assert.equal(r.tool_name, 'Orbit Notes');
  assert.equal(r.email, 'sam@example.com');
  assert.deepEqual([r.category, r.card_required, r.setup, r.paid_level, r.paid_deps, r.assets_link], ['biz', 'no', 'selfhost', 'optional', 'An AI key', 'https://example.com/assets']);
  assert.ok(!('turnstile' in r) && !('company' in r));
});

test('request: task and audience are required, the publish choice must be made, a given email must be valid', async () => {
  await rejects(REQUEST, question({ task: '   ' }), 'task', /What you want to do is required/);
  await rejects(REQUEST, question({ task: 'x'.repeat(301) }), 'task', /300 characters/);
  await rejects(REQUEST, question({ audience: 'nobody' }), 'audience', /Choose who/);
  await rejects(REQUEST, question({ publish_ok: '' }), 'publish_ok', /whether we may publish/);
  await rejects(REQUEST, question({ publish_ok: true }), 'publish_ok', /whether we may publish/);
  await rejects(REQUEST, question({ email: 'nope' }), 'email', /valid email address, or leave it empty/);
});

test('request: the constraints and the publish consent are stored as 0 or 1, and the email is optional', async () => {
  const { env, rows } = setup();
  const { fetchImpl, calls } = stubFetch();
  await handleRequest({ request: post('/api/request', question({ runs_locally: true, no_install: false, publish_ok: 'no' })), env, now: NOW, fetchImpl });
  const [r] = rows('requests');
  assert.deepEqual([r.no_install, r.no_card, r.runs_locally, r.publish_ok, r.email, r.audience], [0, 1, 1, 0, '', 'biz']);
  assert.equal(calls.filter(c => c.url === BREVO_URL).length, 0, 'no email given, so none is sent');
});

// ---- confirmation email ----

for (const f of FORMS) {
  test(`${f.name}: with an email and a Brevo key a confirmation is sent after saving; the key is a header, and the text escapes what was typed`, async () => {
    const { env, rows } = setup();
    const { fetchImpl, calls } = stubFetch();
    const body = f.name === 'submit' ? submission({ tool_name: '<b>Orbit</b>' }) : question({ task: '<i>Find</i> me one', email: 'asker@example.com' });
    const res = await f.handler({ request: post(f.path, body), env: { ...env, BREVO_API_KEY: 'brevo-key' }, now: NOW, fetchImpl });
    assert.equal(res.status, 200);
    assert.equal(rows(f.table).length, 1);
    const mail = calls.find(c => c.url === BREVO_URL);
    assert.ok(mail, 'Brevo was called');
    assert.equal(mail.init.headers['api-key'], 'brevo-key');
    const sent = JSON.parse(mail.init.body);
    assert.equal(sent.to[0].email, f.name === 'submit' ? 'sam@example.com' : 'asker@example.com');
    assert.ok(!sent.htmlContent.includes('<b>') && !sent.htmlContent.includes('<i>'));
    assert.ok(!mail.init.body.includes('brevo-key'));
  });

  test(`${f.name}: without a Brevo key (the preview) the form still succeeds and nothing is logged with the address`, async () => {
    const { env, rows } = setup();
    const { fetchImpl, calls } = stubFetch();
    const logs = [];
    const orig = console.error; console.error = (...a) => logs.push(a.join(' '));
    try {
      const body = f.name === 'submit' ? submission() : question({ email: 'asker@example.com' });
      const res = await f.handler({ request: post(f.path, body), env, now: NOW, fetchImpl });
      assert.equal(res.status, 200);
    } finally { console.error = orig; }
    assert.equal(rows(f.table).length, 1);
    assert.equal(calls.filter(c => c.url === BREVO_URL).length, 0);
    assert.ok(logs.every(l => !/@example\.com/.test(l)));
  });

  test(`${f.name}: a Brevo failure never changes the answer`, async () => {
    const { env, rows } = setup();
    const orig = console.error; console.error = () => {};
    try {
      const fetchImpl = async url => (String(url) === SITEVERIFY_URL ? new Response(JSON.stringify({ success: true })) : new Response('boom', { status: 500 }));
      const body = f.name === 'submit' ? submission() : question({ email: 'asker@example.com' });
      const res = await f.handler({ request: post(f.path, body), env: { ...env, BREVO_API_KEY: 'k' }, now: NOW, fetchImpl });
      assert.equal(res.status, 200);
    } finally { console.error = orig; }
    assert.equal(rows(f.table).length, 1);
  });
}

test('confirmation emails say what was received and make no promise about timing', () => {
  const s = confirmationEmail('submit', 'Orbit Notes');
  assert.match(s.text, /We got your submission of Orbit Notes/);
  const r = confirmationEmail('request', 'Transcribe meetings');
  assert.match(r.text, /We got your question to OpenOrbia: Transcribe meetings/);
  for (const m of [s, r]) assert.ok(!/within \d|hours|days/i.test(m.text));
});

test('verifyTurnstile: ok, failed and unavailable', async () => {
  const answer = (status, body) => async () => new Response(JSON.stringify(body), { status });
  assert.equal(await verifyTurnstile({ secret: 's', token: 't', fetchImpl: answer(200, { success: true }) }), 'ok');
  assert.equal(await verifyTurnstile({ secret: 's', token: 't', fetchImpl: answer(200, { success: false, 'error-codes': ['invalid-input-response'] }) }), 'failed');
  assert.equal(await verifyTurnstile({ secret: 's', token: 't', fetchImpl: answer(500, {}) }), 'unavailable');
  assert.equal(await verifyTurnstile({ secret: 's', token: 't', fetchImpl: async () => { throw new Error('x'); } }), 'unavailable');
  assert.equal(await verifyTurnstile({ secret: 's', token: '', fetchImpl: answer(200, { success: true }) }), 'failed');
  assert.equal(await verifyTurnstile({ secret: 's', token: 'x'.repeat(3000), fetchImpl: answer(200, { success: true }) }), 'failed');
});

// ---- the pages ----

test('/submit/ has every field the maker form needs, the Turnstile widget, the GitHub alternative, and field limits', () => {
  const html = renderSubmit({ siteKey: 'site-key-123' });
  for (const name of ['tool_name', 'url', 'maker_name', 'email', 'category', 'license', 'free_tier', 'card_required', 'setup', 'paid_level', 'paid_deps', 'assets_link', 'company']) {
    assert.ok(html.includes(`name="${name}"`), name);
  }
  assert.ok(html.includes('class="cf-turnstile" data-sitekey="site-key-123"'));
  assert.ok(html.includes('https://challenges.cloudflare.com/turnstile/v0/api.js'));
  assert.ok(html.includes('https://github.com/openorbia/openorbia-site/issues/new?template=submit-a-tool.yml'));
  assert.ok(html.includes('maxlength="80"') && html.includes('maxlength="300"'));
  assert.ok(html.includes('<script src="/assets/forms.js" defer></script>'));
  assert.equal((html.match(/<h1/g) || []).length, 1);
});

test('/request/ has the task, audience, the three constraints, an optional email and the publish choice', () => {
  const html = renderRequest({ siteKey: 'site-key-123' });
  for (const name of ['task', 'audience', 'no_install', 'no_card', 'runs_locally', 'email', 'publish_ok', 'company']) assert.ok(html.includes(`name="${name}"`), name);
  assert.match(html, /name="email" type="email" maxlength="254" autocomplete="email"/);   // not required
  assert.ok(!/name="email"[^>]*required/.test(html));
  assert.ok(html.includes('value="yes"') && html.includes('value="no"'));
  assert.ok(html.includes('class="cf-turnstile"'));
});

test('without a site key the pages say the form is not on yet instead of showing a form that cannot work', async () => {
  for (const html of [renderSubmit(), renderRequest()]) {
    assert.ok(!html.includes('<form') && !html.includes('cf-turnstile'));
    assert.match(html, /not switched on yet/);
    assert.ok(html.includes('mailto:launch@openorbia.com'));
  }
  const res = submitResponse({ TURNSTILE_SITE_KEY: 'k' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(await res.text(), /data-sitekey="k"/);
});

test('the site key is escaped in the page', () => {
  assert.ok(renderSubmit({ siteKey: '"><script>x</script>' }).includes('data-sitekey="&quot;&gt;&lt;script&gt;x&lt;/script&gt;"'));
});

test('the migrations create submissions and requests with the same columns as schema.sql, and are safe to run twice', () => {
  const names = ['submissions', 'requests'];
  const db = createDb();
  for (const n of names) {
    const m = MIGRATIONS.find(x => x.name.startsWith(n));
    assert.ok(m, n);
    assert.match(m.applied, new RegExp(`name = '${n}'`));
    const fromSchema = db.rows(`SELECT name FROM pragma_table_info('${n}') ORDER BY cid`).map(r => r.name);
    const fresh = createDbWithout(n);
    fresh.sql(m.sql);
    assert.deepEqual(fresh.rows(`SELECT name FROM pragma_table_info('${n}') ORDER BY cid`).map(r => r.name), fromSchema, n);
  }
});

function createDbWithout(table) {
  const d = createDb();
  d.sql(`DROP TABLE ${table}`);
  return d;
}
