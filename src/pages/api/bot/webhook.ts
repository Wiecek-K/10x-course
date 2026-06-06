import type { APIRoute } from "astro";
import { TELEGRAM_WEBHOOK_SECRET } from "astro:env/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendMessage, constantTimeEqual } from "@/lib/telegram";
import { extractFirstUrl } from "@/lib/url";
import { enqueueLink } from "@/lib/queue";

export const prerender = false;

interface TelegramUpdate {
  message?: {
    from?: { id: number };
    chat?: { id: number };
    text?: string;
  };
}

export const POST: APIRoute = async (context) => {
  const incomingSecret = context.request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  const expectedSecret = TELEGRAM_WEBHOOK_SECRET ?? "";

  if (!expectedSecret || !constantTimeEqual(incomingSecret, expectedSecret)) {
    return new Response(null, { status: 401 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response(null, { status: 200 });
  }
  const update = body as TelegramUpdate;

  const message = update.message;
  if (!message) return new Response(null, { status: 200 });

  const telegramId = message.from?.id;
  const chatId = message.chat?.id;
  const text = message.text ?? "";

  if (!telegramId || chatId === undefined) return new Response(null, { status: 200 });

  const startMatch = /^\/start(?:\s+(\S+))?/.exec(text);
  if (startMatch) {
    const token = startMatch[1];
    if (!token) {
      await sendMessage(chatId, "Open the app and click Connect Telegram to get your pairing link.");
      return new Response(null, { status: 200 });
    }

    const admin = createAdminClient();
    if (!admin) {
      await sendMessage(chatId, "Server error — try again later.");
      return new Response(null, { status: 200 });
    }

    // Atomic single-use consume: the conditional UPDATE burns the token and
    // returns user_id only if it was unused and unexpired. Two concurrent
    // /start calls can't both match (the second sees used_at already set),
    // closing the select-then-update TOCTOU window.
    const { data: code, error: codeError } = await admin
      .from("pairing_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("user_id")
      .maybeSingle();

    if (codeError) {
      // eslint-disable-next-line no-console -- server-side error logging for Workers observability
      console.error("webhook pairing_codes consume failed:", codeError.message);
      await sendMessage(chatId, "Server error — try again later.");
      return new Response(null, { status: 200 });
    }

    if (!code) {
      await sendMessage(chatId, "This link has expired or already been used. Generate a new one in the app.");
      return new Response(null, { status: 200 });
    }

    const { error: upsertError } = await admin
      .from("telegram_links")
      .upsert({ telegram_id: telegramId, user_id: code.user_id }, { onConflict: "telegram_id" });

    if (upsertError) {
      // eslint-disable-next-line no-console -- server-side error logging for Workers observability
      console.error("webhook upsert telegram_links failed:", upsertError.message);
      // Best-effort: re-open the consumed code so the user can retry pairing.
      await admin.from("pairing_codes").update({ used_at: null }).eq("token", token);
      await sendMessage(chatId, "Server error — try again later.");
      return new Response(null, { status: 200 });
    }

    await sendMessage(chatId, "Connected ✅ Send me any link to save it to your inbox.");
    return new Response(null, { status: 200 });
  }

  const admin = createAdminClient();
  if (!admin) {
    await sendMessage(chatId, "Server error — try again later.");
    return new Response(null, { status: 200 });
  }

  const { data: link, error: linkError } = await admin
    .from("telegram_links")
    .select("user_id")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (linkError) {
    // eslint-disable-next-line no-console -- server-side error logging for Workers observability
    console.error("webhook telegram_links lookup failed:", linkError.message);
    await sendMessage(chatId, "Server error — try again later.");
    return new Response(null, { status: 200 });
  }

  if (!link) {
    await sendMessage(chatId, "I don't know you yet — open the app, Connect Telegram, then come back.");
    return new Response(null, { status: 200 });
  }

  const url = extractFirstUrl(text);
  if (!url) {
    await sendMessage(chatId, "Send me a link to save.");
    return new Response(null, { status: 200 });
  }

  const { data: inserted, error: insertError } = await admin
    .from("links")
    .insert({ user_id: link.user_id, url })
    .select("id")
    .single();

  if (insertError) {
    // eslint-disable-next-line no-console -- server-side error logging for Workers observability
    console.error("webhook links insert failed:", insertError.message);
    await sendMessage(chatId, "Try again.");
    return new Response(null, { status: 200 });
  }

  try {
    await enqueueLink(inserted.id, link.user_id);
  } catch (err) {
    // eslint-disable-next-line no-console -- non-fatal: link saved, queue failed
    console.error("webhook enqueueLink failed:", err);
  }

  await sendMessage(chatId, "Saved ✅");
  return new Response(null, { status: 200 });
};
