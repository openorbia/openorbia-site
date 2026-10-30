// Cloudflare Pages Function: POST /api/waitlist
// Needs a D1 binding named DB (see README.md)
//
// Two kinds of caller: the page's script posts JSON and gets JSON back; the plain HTML form (no JavaScript) posts form data and is
// redirected to /#<message id>, a message already in the page and shown with :target. The email never goes in a URL.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

import { sendWelcome } from "../../lib/email.js";

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
    // a new signup: tell the caller who to welcome (never sent for duplicates or bots)
    return { ...(role === "maker" ? MESSAGES.ok_maker : MESSAGES.ok_reader), welcome: { to: email, role } };
  } catch (e) {
    return MESSAGES.failed;
  }
}

export async function handleWaitlist({ request, env, waitUntil, fetchImpl }) {
  const type = (request.headers.get("content-type") || "").toLowerCase();
  const isForm = type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data");

  let body;
  try {
    body = isForm ? Object.fromEntries(await request.formData()) : await request.json();
  } catch {
    body = null;
  }
  const result = body && typeof body === "object" ? await signup(body, request, env) : MESSAGES.bad_request;

  // The welcome email goes out after the answer where the platform allows it; it can never change the answer
  if (result.welcome) {
    const task = sendWelcome({ apiKey: env.BREVO_API_KEY, ...result.welcome, fetchImpl });
    if (typeof waitUntil === "function") waitUntil(task); else await task;
  }

  if (isForm) {
    // 303 so the browser follows with a GET; no-store so a back/forward never replays it
    return new Response(null, { status: 303, headers: { location: `/#${result.page}`, "cache-control": "no-store" } });
  }
  return result.error ? json({ error: result.error }, result.status) : json({ message: result.message });
}

// waitUntil must be called on the context itself (a detached copy is rejected by the runtime), so pass a wrapper
export const onRequestPost = ctx => handleWaitlist({ request: ctx.request, env: ctx.env, waitUntil: p => ctx.waitUntil(p) });

export async function onRequest() {
  return json({ error: "Method not allowed." }, 405);
}
