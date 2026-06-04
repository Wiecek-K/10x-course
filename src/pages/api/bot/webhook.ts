import type { APIRoute } from "astro";
import { TELEGRAM_WEBHOOK_SECRET } from "astro:env/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendMessage, constantTimeEqual } from "@/lib/telegram";

export const prerender = false;

interface TelegramUpdate {
  message?: {
    from?: { id: number };
    chat: { id: number };
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
  const chatId = message.chat.id;
  const text = message.text ?? "";

  if (!telegramId) return new Response(null, { status: 200 });

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

    const { data: code } = await admin
      .from("pairing_codes")
      .select("user_id")
      .eq("token", token)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

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
      await sendMessage(chatId, "Server error — try again later.");
      return new Response(null, { status: 200 });
    }

    await admin.from("pairing_codes").update({ used_at: new Date().toISOString() }).eq("token", token);

    await sendMessage(chatId, "Connected ✅ Send me any link to save it to your inbox.");
    return new Response(null, { status: 200 });
  }

  // Phase 3 will handle plain-message capture; no-op for now.
  return new Response(null, { status: 200 });
};
