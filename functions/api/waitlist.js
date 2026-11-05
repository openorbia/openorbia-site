// Cloudflare Pages Function: POST /api/waitlist
// Needs a D1 binding named DB (see README.md)
//
// Two kinds of caller: the page's script posts JSON and gets JSON back; the plain HTML form (no JavaScript) posts form data and is
// redirected to /#<message id>, a message already in the page and shown with :target. The email never goes in a URL.
//
// Abuse protection, in order: our own pages only (lib/origin.js) -> rate limit (HMAC-keyed, no raw IP; needs VOTE_SECRET) -> hidden
// field -> field checks -> save. The welcome email is sent only when the Turnstile check passes, so a bot cannot use this form to send
// email to anyone. Without JavaScript there is no Turnstile token: the signup is still saved, but no welcome email goes out.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });

import { sendWelcome } from "../../lib/email.js";
import { requestIsOurs } from "../../lib/origin.js";
import { rateLimit } from "../../lib/ratelimit.js";
import { visitor } from "../../lib/visitor.js";
import { verifyTurnstile } from "../../lib/turnstile.js";
import { unsubscribeUrl } from "../../lib/unsubscribe.js";

// 5 signups an hour per visitor
export const WAITLIST_LIMIT = { max: 5, windowSeconds: 3600 };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Result of a signup: { status, message } on success, { status, error } on failure; `page` is the id of the message shown after a form post
const MESSAGES = {
  ok_maker: { page: "wl-ok", message: "You're on the list. We'll email you before launch week to feature your tool." },
  ok_reader: { page: "wl-ok", message: "You're on the list. We'll email you when the first launch goes live." },
  already: { page: "wl-already", message: "You're already on the list. We'll be in touch." },
  bot: { page: "wl-ok", message: "You're on the list. Welcome to orbit." },
  bad_email: { page: "wl-bad-email", status: 400, error: "Please enter a valid email." },
  bad_link: { page: "wl-bad-link", status: 400, error: "Tool link must start with https://" },
  bad_request: { page: "wl-error", status: 400, error: "Invalid request." },
  forbidden: { page: "wl-error", status: 403, error: "This form can only be sent from openorbia.com." },
  rate_limited: { page: "wl-error", status: 429, error: "Too many signups from here in the last hour. Please try again later." },
  not_connected: { page: "wl-error", status: 500, error: "Waitlist is not connected yet. Email launch@openorbia.com." },
  failed: { page: "wl-error", status: 500, error: "Something went wrong. Email launch@openorbia.com." },
};

async function signup(body, request, env) {
  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  const role = body.role === "reader" ? "reader" : "maker";
  let tool = String(body.tool || "").trim().slice(0, 300);
  const honeypot = String(body.company || "").trim();

  // Bots fill the hidden field; pretend success so they move on.
  if (honeypot) return MESSAGES.bot;

  if (!EMAIL_RE.test(email)) return MESSAGES.bad_email;

  if (role === "maker" && tool) {
    try {
      const u = new URL(tool);
      if (u.protocol !== "https:") throw new Error();
      tool = u.toString();
    } catch {
      return MESSAGES.bad_link;
    }
  } else {
    tool = null;
  }

  if (!env.DB) return MESSAGES.not_connected;

  const country = request.cf?.country || null;

  try {
    const res = await env.DB.prepare(
      "INSERT OR IGNORE INTO waitlist (email, role, tool_url, country) VALUES (?1, ?2, ?3, ?4)"
    ).bind(email, role, tool, country).run();

    if (res.meta && res.meta.changes === 0) return MESSAGES.already;
    // a new signup: tell the caller who to welcome (never sent for duplicates or bots), and which row, for its unsubscribe link
    return { ...(role === "maker" ? MESSAGES.ok_maker : MESSAGES.ok_reader), welcome: { to: email, role, id: res.meta && res.meta.last_row_id } };
  } catch (e) {
    return MESSAGES.failed;
  }
}

export async function handleWaitlist({ request, env, waitUntil, fetchImpl, turnstileFetch = fetchImpl, now = Date.now() }) {
  if (!requestIsOurs(request)) { console.log("Waitlist signup: outcome=forbidden turnstile=not_checked"); return json({ error: MESSAGES.forbidden.error }, 403); }

  if (env.DB && typeof env.VOTE_SECRET === "string" && env.VOTE_SECRET) {
    let limited = null;
    try { limited = await rateLimit(env.DB, env.VOTE_SECRET, { scope: "waitlist", ...WAITLIST_LIMIT }, visitor(request), now); } catch { /* never block a signup on the limiter */ }
    if (limited) { console.log("Waitlist signup: outcome=rate_limited turnstile=not_checked"); return reply(request, MESSAGES.rate_limited, { "retry-after": String(limited.wait) }); }
  }

  const type = (request.headers.get("content-type") || "").toLowerCase();
  const isForm = type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data");

  // A signup is a few hundred bytes; refuse anything far bigger before reading it
  if (Number(request.headers.get("content-length") || 0) > 8192) return reply(request, MESSAGES.bad_request);

  let body;
  try {
    body = isForm ? Object.fromEntries(await request.formData()) : await request.json();
  } catch {
    body = null;
  }
  const result = body && typeof body === "object" ? await signup(body, request, env) : MESSAGES.bad_request;

  // The welcome email goes out after the answer where the platform allows it; it can never change the answer. Only a visitor who passed
  // Turnstile gets one. The check runs in the same background task, so the visitor's answer never waits for it.
  // Every signup leaves one log line: what happened and the Turnstile result (no email address, no token). For a new signup the email
  // step then logs Brevo's answer (lib/email.js), so a missing welcome email can always be traced to one of the two.
  if (result.welcome) {
    const task = (async () => {
      const check = await turnstileResult(body, env, turnstileFetch);
      console.log(`Waitlist signup: outcome=new role=${result.welcome.role} turnstile=${check}${check === "passed" ? "" : " welcome_email=not_sent"}`);
      if (check !== "passed") return;
      const { to, role, id } = result.welcome;
      // this signup's own unsubscribe link (lib/unsubscribe.js); without the server secret the email asks for a reply instead
      const unsub = typeof env.VOTE_SECRET === "string" && env.VOTE_SECRET && id ? await unsubscribeUrl(env.VOTE_SECRET, id) : "";
      await sendWelcome({ apiKey: env.BREVO_API_KEY, to, role, unsubscribeUrl: unsub, fetchImpl });
    })();
    if (typeof waitUntil === "function") waitUntil(task); else await task;
  } else {
    console.log(`Waitlist signup: outcome=${outcomeName(result)} turnstile=not_checked`);
  }

  return reply(request, result);
}

// -> "passed" | "failed" (Cloudflare rejected the token: wrong, expired or used) | "no_token" | "unavailable" (Cloudflare not reachable)
//    | "not_configured" (TURNSTILE_SECRET_KEY is not set for this deployment)
export async function turnstileResult(body, env, fetchImpl) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (typeof secret !== "string" || !secret) return "not_configured";
  const token = body && body.turnstile;
  if (typeof token !== "string" || !token) return "no_token";
  const r = await verifyTurnstile({ secret, token, fetchImpl });
  return r === "ok" ? "passed" : r;
}

// the MESSAGES key of a result, for the log line (never the visitor's input)
const outcomeName = result => Object.keys(MESSAGES).find(k => MESSAGES[k] === result) || "unknown";

function isFormPost(request) {
  const type = (request.headers.get("content-type") || "").toLowerCase();
  return type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data");
}

function reply(request, result, extra = {}) {
  if (isFormPost(request)) {
    // 303 so the browser follows with a GET; no-store so a back/forward never replays it
    return new Response(null, { status: 303, headers: { location: `/#${result.page}`, "cache-control": "no-store", ...extra } });
  }
  const res = result.error ? json({ error: result.error }, result.status) : json({ message: result.message });
  for (const [k, v] of Object.entries(extra)) res.headers.set(k, v);
  return res;
}

// waitUntil must be called on the context itself (a detached copy is rejected by the runtime), so pass a wrapper
export const onRequestPost = ctx => handleWaitlist({ request: ctx.request, env: ctx.env, waitUntil: p => ctx.waitUntil(p) });

export async function onRequest() {
  return json({ error: "Method not allowed." }, 405);
}
