// POST /api/submit (a maker submits a tool) and POST /api/request ("Find me a free tool"). Both take JSON and answer JSON.
//
// Order of checks: our own pages only (lib/origin.js) -> configured -> rate limit (HMAC-keyed, no raw IP, every post counts) -> read the
// body -> hidden field -> field checks -> Turnstile -> save -> confirmation email. Nothing about the visitor is stored (no IP, user agent or
// referrer): the IP and user agent are only hashed for the rate limit. The confirmation email is sent only when an address was given and
// BREVO_API_KEY is set; it can never change the answer.

import { requestIsOurs } from './origin.js';
import { rateLimit } from './ratelimit.js';
import { visitor } from './visitor.js';
import { verifyTurnstile } from './turnstile.js';
import { sendFormConfirmation } from './email.js';

export const FORM_LIMIT = { max: 5, windowSeconds: 3600 };      // 5 posts an hour per visitor on each form
const MAX_BODY_CHARS = 8192;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

export const CATEGORIES = { biz: 'Small business', job: 'Job seekers', sec: 'Security', other: 'Something else' };
export const SETUPS = { browser: 'In the browser, nothing to install', desktop: 'Desktop app', selfhost: 'Install or self-host', other: 'Something else' };
export const CARD = { no: 'No card needed', yes: 'Card required', unknown: 'Not sure' };
export const PAID = { none: 'None', optional: 'Optional', required: 'Required' };
export const AUDIENCES = { biz: 'A small business', job: 'A job seeker', sec: 'A security team', other: 'Someone else' };

// Field limits shared with the pages (maxlength on the inputs)
export const LIMITS = { tool_name: 80, url: 300, maker_name: 80, email: 254, license: 60, free_tier: 300, paid_deps: 300, assets_link: 300, task: 300 };

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, 'content-type': 'application/json; charset=utf-8', ...extra } });
const fail = (status, code, error, extra) => json(status, { ok: false, code, error }, extra);

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
const text = v => (typeof v === 'string' ? v.replace(CONTROL, '').trim() : '');
const own = (table, key) => typeof key === 'string' && Object.hasOwn(table, key);

function httpsUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname.includes('.') ? u.toString() : null; } catch { return null; }
}

// Each check returns { value } or { error: 'field', message }. The messages say what to fix.
function need(body, field, label, max) {
  const v = text(body[field]);
  if (!v) return { error: field, message: `${label} is required.` };
  if (v.length > max) return { error: field, message: `${label} must be ${max} characters or fewer (it is ${v.length}).` };
  return { value: v };
}

export function checkSubmission(body) {
  const out = {};
  for (const [field, label] of [['tool_name', 'Tool name'], ['maker_name', 'Your name'], ['license', 'License'], ['free_tier', "What's free"]]) {
    const r = need(body, field, label, LIMITS[field]);
    if (r.error) return r;
    out[field] = r.value;
  }
  const url = need(body, 'url', 'The repo or website', LIMITS.url);
  if (url.error) return url;
  if (!httpsUrl(url.value)) return { error: 'url', message: 'The repo or website must be a full link starting with https://.' };
  out.url = httpsUrl(url.value);
  const email = need(body, 'email', 'Your email', LIMITS.email);
  if (email.error) return email;
  if (!EMAIL_RE.test(email.value)) return { error: 'email', message: 'Enter a valid email address.' };
  out.email = email.value.toLowerCase();
  for (const [field, table, label] of [['category', CATEGORIES, 'a category'], ['card_required', CARD, 'whether a card is required'], ['setup', SETUPS, 'how it is set up'], ['paid_level', PAID, 'whether it needs a paid service']]) {
    if (!own(table, body[field])) return { error: field, message: `Choose ${label}.` };
    out[field] = body[field];
  }
  const deps = text(body.paid_deps);
  if (deps.length > LIMITS.paid_deps) return { error: 'paid_deps', message: `Paid dependencies must be ${LIMITS.paid_deps} characters or fewer (it is ${deps.length}).` };
  if (out.paid_level !== 'none' && !deps) return { error: 'paid_deps', message: 'Say which paid service it needs, or choose "None".' };
  out.paid_deps = deps;
  const assets = text(body.assets_link);
  if (assets && (assets.length > LIMITS.assets_link || !httpsUrl(assets))) return { error: 'assets_link', message: 'The assets link must be a full link starting with https:// (or leave it empty).' };
  out.assets_link = assets ? httpsUrl(assets) : '';
  return { value: out };
}

export function checkRequest(body) {
  const out = {};
  const task = need(body, 'task', 'What you want to do', LIMITS.task);
  if (task.error) return task;
  out.task = task.value;
  if (!own(AUDIENCES, body.audience)) return { error: 'audience', message: 'Choose who it is for.' };
  out.audience = body.audience;
  for (const f of ['no_install', 'no_card', 'runs_locally']) out[f] = body[f] === true || body[f] === 'on' || body[f] === '1' ? 1 : 0;
  const email = text(body.email);
  if (email && (email.length > LIMITS.email || !EMAIL_RE.test(email))) return { error: 'email', message: 'Enter a valid email address, or leave it empty.' };
  out.email = email.toLowerCase();
  if (body.publish_ok !== 'yes' && body.publish_ok !== 'no') return { error: 'publish_ok', message: 'Say whether we may publish your question.' };
  out.publish_ok = body.publish_ok === 'yes' ? 1 : 0;
  return { value: out };
}

// kind: 'submit' | 'request'. `save(db, values)` inserts the row. -> Response
async function handleForm({ kind, request, env, now = Date.now(), fetchImpl = fetch, waitUntil, check, save }) {
  if (!requestIsOurs(request)) return fail(403, 'forbidden_origin', 'This form can only be sent from openorbia.com.');
  const secret = env.VOTE_SECRET;
  if (!env.DB || typeof secret !== 'string' || !secret || typeof env.TURNSTILE_SECRET_KEY !== 'string' || !env.TURNSTILE_SECRET_KEY) {
    return fail(503, 'not_configured', 'This form is not available right now. Please try again later, or email launch@openorbia.com.');
  }
  try {
    const limited = await rateLimit(env.DB, secret, { scope: kind, ...FORM_LIMIT }, visitor(request), now);
    if (limited) return fail(429, 'rate_limited', 'You have sent this form several times in the last hour. Please try again later.', { 'retry-after': String(limited.wait) });

    const type = (request.headers.get('content-type') || '').toLowerCase();
    if (!type.startsWith('application/json')) return fail(415, 'unsupported_media_type', 'Send the form as JSON.');
    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) return fail(400, 'bad_request', 'That request is too large.');
    let body;
    try { body = JSON.parse(raw); } catch { return fail(400, 'bad_request', 'That request could not be read.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'bad_request', 'That request could not be read.');

    // Bots fill the hidden field: say thanks and save nothing
    if (text(body.company)) return json(200, { ok: true, message: 'Thanks, we got it.' });

    const checked = check(body);
    if (checked.error) return json(400, { ok: false, code: 'invalid', field: checked.error, error: checked.message }, {});

    const human = await verifyTurnstile({ secret: env.TURNSTILE_SECRET_KEY, token: body.turnstile, fetchImpl });
    if (human === 'failed') return fail(400, 'turnstile_failed', "We couldn't confirm you're human. Please run the check again and send the form once more.");
    if (human === 'unavailable') return fail(503, 'turnstile_unavailable', "We couldn't reach the verification service. Please try again in a minute.");

    await save(env.DB, checked.value);
    const to = checked.value.email;
    if (to) {
      const task = sendFormConfirmation({ apiKey: env.BREVO_API_KEY, to, kind, name: kind === 'submit' ? checked.value.tool_name : checked.value.task, fetchImpl });
      if (typeof waitUntil === 'function') waitUntil(task); else await task;
    }
    return json(200, {
      ok: true,
      message: kind === 'submit'
        ? 'Thanks, we got your tool. We check every tool by hand against its docs, and we will write to the email you gave.'
        : 'Thanks, we got your question.',
    });
  } catch {
    return fail(500, 'server_error', 'Something went wrong on our side. Please try again, or email launch@openorbia.com.');
  }
}

export const handleSubmit = ctx => handleForm({
  ...ctx, kind: 'submit', check: checkSubmission,
  save: (db, v) => db.prepare(
    'INSERT INTO submissions (tool_name, url, maker_name, email, category, license, free_tier, card_required, setup, paid_level, paid_deps, assets_link, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(v.tool_name, v.url, v.maker_name, v.email, v.category, v.license, v.free_tier, v.card_required, v.setup, v.paid_level, v.paid_deps, v.assets_link, 'new').run(),
});

export const handleRequest = ctx => handleForm({
  ...ctx, kind: 'request', check: checkRequest,
  save: (db, v) => db.prepare(
    'INSERT INTO requests (task, audience, no_install, no_card, runs_locally, email, publish_ok, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(v.task, v.audience, v.no_install, v.no_card, v.runs_locally, v.email, v.publish_ok, 'new').run(),
});
