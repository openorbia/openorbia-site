// Cloudflare Pages Function: POST /api/waitlist
// Needs a D1 binding named DB (see README.md)

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  const role = body.role === "reader" ? "reader" : "maker";
  let tool = String(body.tool || "").trim().slice(0, 300);
  const honeypot = String(body.company || "").trim();

  // Bots fill the hidden field; pretend success so they move on.
  if (honeypot) return json({ message: "You're on the list. Welcome to orbit." });

  if (!EMAIL_RE.test(email)) return json({ error: "Please enter a valid email." }, 400);

  if (role === "maker" && tool) {
    try {
      const u = new URL(tool);
      if (u.protocol !== "https:") throw new Error();
      tool = u.toString();
    } catch {
      return json({ error: "Tool link must start with https://" }, 400);
    }
  } else {
    tool = null;
  }

  if (!env.DB) return json({ error: "Waitlist is not connected yet. Email launch@openorbia.com." }, 500);

  const country = request.cf?.country || null;

  try {
    const res = await env.DB.prepare(
      "INSERT OR IGNORE INTO waitlist (email, role, tool_url, country) VALUES (?1, ?2, ?3, ?4)"
    ).bind(email, role, tool, country).run();

    if (res.meta && res.meta.changes === 0) {
      return json({ message: "You're already on the list. We'll be in touch." });
    }
    return json({
      message: role === "maker"
        ? "You're on the list. We'll email you before launch week to feature your tool."
        : "You're on the list. We'll email you when the first launch goes live.",
    });
  } catch (e) {
    return json({ error: "Something went wrong. Email launch@openorbia.com." }, 500);
  }
}

export async function onRequest() {
  return json({ error: "Method not allowed." }, 405);
}
