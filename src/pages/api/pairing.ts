import type { APIRoute } from "astro";
import { TELEGRAM_BOT_USERNAME } from "astro:env/server";
import { createClient } from "@/lib/supabase";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase || !TELEGRAM_BOT_USERNAME) {
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  // Generate a cryptographically random token (32 bytes → 43-char base64url, no padding).
  // Must match Telegram's /start deep-link constraint: [A-Za-z0-9_-], ≤64 chars.
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...raw))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await supabase.from("pairing_codes").insert({
    user_id: context.locals.user.id,
    token,
    expires_at: expiresAt,
  });

  if (error) {
    // eslint-disable-next-line no-console -- server-side error logging for Workers observability
    console.error("POST /api/pairing insert failed:", error.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const deepLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`;
  return Response.json({ deepLink, expiresAt }, { status: 201 });
};
