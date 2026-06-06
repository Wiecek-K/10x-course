import { TELEGRAM_BOT_TOKEN } from "astro:env/server";

export async function sendMessage(chatId: number, text: string): Promise<void> {
  const token = TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console -- non-fatal: a failed reply must never fail the webhook (a 500 makes Telegram retry → duplicate insert)
    console.error("sendMessage failed:", err);
  }
}

export function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}
