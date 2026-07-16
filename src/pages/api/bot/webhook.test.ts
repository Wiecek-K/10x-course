import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above imports. vi.hoisted creates values available inside factory closures.
const mockEnv = vi.hoisted((): { TELEGRAM_WEBHOOK_SECRET: string | undefined } => ({
  TELEGRAM_WEBHOOK_SECRET: "test-secret",
}));

vi.mock("astro:env/server", () => ({
  get TELEGRAM_WEBHOOK_SECRET() {
    return mockEnv.TELEGRAM_WEBHOOK_SECRET;
  },
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-key",
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/telegram", () => ({
  sendMessage: vi.fn(),
  constantTimeEqual: (a: string, b: string) => a === b,
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    LINK_QUEUE: { send: vi.fn() },
  },
}));

import { createAdminClient } from "@/lib/supabase-admin";
import { POST } from "@/pages/api/bot/webhook";

// ---------- helpers ----------

function makeRequest(body: unknown, secretHeader?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secretHeader !== undefined) {
    headers["X-Telegram-Bot-Api-Secret-Token"] = secretHeader;
  }
  return new Request("https://example.com/api/bot/webhook", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function makeContext(request: Request): Parameters<typeof POST>[0] {
  return { request } as Parameters<typeof POST>[0];
}

const URL_PAYLOAD = {
  message: {
    from: { id: 999 },
    chat: { id: 999 },
    text: "https://example.com/article",
  },
};

function makeCaptureFake(opts: {
  telegramLinkData: { user_id: string } | null;
  telegramLinkError?: unknown;
  linkInsertData?: { id: string } | null;
  linkInsertError?: unknown;
}) {
  const insertSpy = vi.fn();
  const admin = {
    from: (table: string) => {
      if (table === "telegram_links") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: opts.telegramLinkData,
                  error: opts.telegramLinkError ?? null,
                }),
            }),
          }),
        };
      }
      if (table === "links") {
        return {
          insert: (data: unknown) => {
            insertSpy(data);
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: opts.linkInsertData ?? { id: "new-link-id" },
                    error: opts.linkInsertError ?? null,
                  }),
              }),
            };
          },
        };
      }
      return {};
    },
  };
  return { admin, insertSpy };
}

// ---------- tests ----------

beforeEach(() => {
  vi.resetAllMocks();
  mockEnv.TELEGRAM_WEBHOOK_SECRET = "test-secret";
});

describe("POST /api/bot/webhook", () => {
  describe("secret gate", () => {
    it("returns 401 when X-Telegram-Bot-Api-Secret-Token header is missing", async () => {
      const res = await POST(makeContext(makeRequest(URL_PAYLOAD)));
      expect(res.status).toBe(401);
    });

    it("returns 401 when secret header is wrong", async () => {
      const res = await POST(makeContext(makeRequest(URL_PAYLOAD, "forged-secret")));
      expect(res.status).toBe(401);
    });

    it("returns 401 when TELEGRAM_WEBHOOK_SECRET is unset (fails closed)", async () => {
      mockEnv.TELEGRAM_WEBHOOK_SECRET = undefined;
      const res = await POST(makeContext(makeRequest(URL_PAYLOAD, "test-secret")));
      expect(res.status).toBe(401);
    });

    it("does not call createAdminClient before the secret gate passes", async () => {
      await POST(makeContext(makeRequest(URL_PAYLOAD, "forged-secret")));
      expect(vi.mocked(createAdminClient)).not.toHaveBeenCalled();
    });
  });

  describe("user_id provenance — capture branch", () => {
    it("inserts with user_id from telegram_links lookup, not from request payload", async () => {
      const mappedUserId = "mapped-user-from-db";
      const { admin, insertSpy } = makeCaptureFake({
        telegramLinkData: { user_id: mappedUserId },
      });
      vi.mocked(createAdminClient).mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

      await POST(makeContext(makeRequest(URL_PAYLOAD, "test-secret")));

      expect(insertSpy).toHaveBeenCalledOnce();
      const insertedData = insertSpy.mock.calls[0][0] as { user_id: string };
      expect(insertedData.user_id).toBe(mappedUserId);
    });

    it("TelegramUpdate payload has no user_id field — insert user_id can only come from trusted lookup", () => {
      expect(URL_PAYLOAD).not.toHaveProperty("user_id");
      expect(URL_PAYLOAD.message).not.toHaveProperty("user_id");
      expect(URL_PAYLOAD.message.from).not.toHaveProperty("user_id");
    });
  });
});
