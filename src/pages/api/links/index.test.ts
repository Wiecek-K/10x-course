import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted creates values available inside vi.mock factory closures.
const linkQueueSend = vi.hoisted(() => vi.fn());

vi.mock("astro:env/server", () => ({
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_KEY: "test-anon-key",
}));

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    LINK_QUEUE: { send: linkQueueSend },
  },
}));

import { createClient } from "@/lib/supabase";
import { POST } from "@/pages/api/links/index";

// ---------- helpers ----------

function makeContext(opts: { userId?: string; url?: string } = {}): Parameters<typeof POST>[0] {
  const { userId = "test-user-id", url = "https://example.com/article" } = opts;
  return {
    locals: { user: { id: userId } },
    request: new Request("https://app.example.com/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }),
    cookies: {},
  } as unknown as Parameters<typeof POST>[0];
}

function makeSupabaseFake(linkId = "test-link-id") {
  return {
    from: () => ({
      insert: vi.fn().mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({ data: { id: linkId }, error: null }),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------- tests ----------

describe("POST /api/links", () => {
  describe("enqueue parity (#5)", () => {
    it("calls LINK_QUEUE.send with correct payload after successful insert", async () => {
      const userId = "user-abc";
      const linkId = "link-xyz";
      vi.mocked(createClient).mockReturnValue(makeSupabaseFake(linkId) as unknown as ReturnType<typeof createClient>);

      await POST(makeContext({ userId }));

      expect(linkQueueSend).toHaveBeenCalledOnce();
      expect(linkQueueSend).toHaveBeenCalledWith({ type: "describe", v: 1, linkId, userId });
    });

    it("returns 201 even when LINK_QUEUE.send throws (enqueue is non-fatal)", async () => {
      vi.mocked(createClient).mockReturnValue(makeSupabaseFake() as unknown as ReturnType<typeof createClient>);
      linkQueueSend.mockRejectedValueOnce(new Error("queue unavailable"));

      const res = await POST(makeContext());

      expect(res.status).toBe(201);
    });
  });
});
