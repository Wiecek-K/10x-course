import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock calls are hoisted above imports by Vitest.
// All virtual-module and local-module mocks must appear before the SUT import.

vi.mock("astro:env/server", () => ({
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/services/scrape", () => ({
  scrapeContent: vi.fn(),
}));

vi.mock("@/lib/services/describe", () => ({
  describeContent: vi.fn(),
}));

vi.mock("@/lib/services/youtube", () => ({
  isYouTubeUrl: vi.fn(),
  fetchYouTubeMetadata: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase-admin";
import { scrapeContent } from "@/lib/services/scrape";
import { describeContent } from "@/lib/services/describe";
import { isYouTubeUrl, fetchYouTubeMetadata } from "@/lib/services/youtube";
import { queue } from "@/lib/queue-consumer";
import type { QueueMessage } from "@/types";

// ---------- test helpers ----------

function makeFakeAdmin(lookupResult: { data: { url: string } | null; error: unknown }) {
  const updateSpy = vi.fn();
  const makeSelectChain = (): unknown => ({
    eq: () => makeSelectChain(),
    maybeSingle: () => Promise.resolve(lookupResult),
  });
  return {
    admin: {
      from: vi.fn().mockReturnValue({
        select: () => makeSelectChain(),
        update: (data: unknown) => {
          updateSpy(data);
          return { eq: () => Promise.resolve({}) };
        },
      }),
    },
    updateSpy,
  };
}

function makeBatch(overrides?: Partial<QueueMessage>) {
  const ack = vi.fn();
  const retry = vi.fn();
  const body: QueueMessage = { type: "describe", v: 1, linkId: "link-123", userId: "user-456", ...overrides };
  const batch = { messages: [{ body, ack, retry }] } as unknown as MessageBatch<QueueMessage>;
  return { batch, ack, retry };
}

// ---------- tests ----------

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isYouTubeUrl).mockReturnValue(false);
});

describe("queue consumer", () => {
  describe("admin client unavailable", () => {
    it("retries when createAdminClient returns null", async () => {
      vi.mocked(createAdminClient).mockReturnValue(null);
      const { batch, ack, retry } = makeBatch();
      await queue(batch);
      expect(retry).toHaveBeenCalledOnce();
      expect(ack).not.toHaveBeenCalled();
    });
  });

  describe("link lookup", () => {
    it("retries on DB lookup error", async () => {
      const { admin, updateSpy } = makeFakeAdmin({ data: null, error: new Error("db error") });
      vi.mocked(createAdminClient).mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);
      const { batch, ack, retry } = makeBatch();
      await queue(batch);
      expect(retry).toHaveBeenCalledOnce();
      expect(ack).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("acks without any status write when link not found", async () => {
      const { admin, updateSpy } = makeFakeAdmin({ data: null, error: null });
      vi.mocked(createAdminClient).mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);
      const { batch, ack, retry } = makeBatch();
      await queue(batch);
      expect(ack).toHaveBeenCalledOnce();
      expect(retry).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  describe("YouTube branch", () => {
    beforeEach(() => {
      vi.mocked(isYouTubeUrl).mockReturnValue(true);
    });

    it("writes done with formatted title+channel when oEmbed succeeds", async () => {
      const { admin, updateSpy } = makeFakeAdmin({ data: { url: "https://youtube.com/watch?v=abc" }, error: null });
      vi.mocked(createAdminClient).mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);
      vi.mocked(fetchYouTubeMetadata).mockResolvedValue({ title: "My Video", channel: "My Channel" });
      const { batch, ack, retry } = makeBatch();
      await queue(batch);
      expect(updateSpy).toHaveBeenCalledOnce();
      expect(updateSpy).toHaveBeenCalledWith({
        micro_description: "▶ My Video — My Channel · transcript coming soon",
        processing_status: "done",
      });
      expect(ack).toHaveBeenCalledOnce();
      expect(retry).not.toHaveBeenCalled();
    });

    it('writes done with fallback "YouTube video — transcript coming soon." when oEmbed returns null', async () => {
      const { admin, updateSpy } = makeFakeAdmin({ data: { url: "https://youtube.com/watch?v=abc" }, error: null });
      vi.mocked(createAdminClient).mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);
      vi.mocked(fetchYouTubeMetadata).mockResolvedValue(null);
      const { batch, ack } = makeBatch();
      await queue(batch);
      expect(updateSpy).toHaveBeenCalledWith({
        micro_description: "YouTube video — transcript coming soon.",
        processing_status: "done",
      });
      expect(ack).toHaveBeenCalledOnce();
    });

    it("never writes scraping or describing status", async () => {
      const { admin, updateSpy } = makeFakeAdmin({ data: { url: "https://youtube.com/watch?v=abc" }, error: null });
      vi.mocked(createAdminClient).mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);
      vi.mocked(fetchYouTubeMetadata).mockResolvedValue({ title: "T", channel: "C" });
      const { batch } = makeBatch();
      await queue(batch);
      const statuses = updateSpy.mock.calls.map((c) => (c[0] as { processing_status?: string }).processing_status);
      expect(statuses).not.toContain("scraping");
      expect(statuses).not.toContain("describing");
    });
  });

  describe("scrape/describe pipeline", () => {
    it("writes scraping → describing → done in order on full success", async () => {
      const { admin, updateSpy } = makeFakeAdmin({ data: { url: "https://example.com" }, error: null });
      vi.mocked(createAdminClient).mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);
      vi.mocked(scrapeContent).mockResolvedValue("page content");
      vi.mocked(describeContent).mockResolvedValue("ai summary");
      const { batch, ack, retry } = makeBatch();
      await queue(batch);
      expect(updateSpy.mock.calls).toEqual([
        [{ processing_status: "scraping" }],
        [{ processing_status: "describing" }],
        [{ micro_description: "ai summary", processing_status: "done" }],
      ]);
      expect(ack).toHaveBeenCalledOnce();
      expect(retry).not.toHaveBeenCalled();
    });

    it("writes scraping → failed and acks on scrape definitive miss (null)", async () => {
      const { admin, updateSpy } = makeFakeAdmin({ data: { url: "https://example.com" }, error: null });
      vi.mocked(createAdminClient).mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);
      vi.mocked(scrapeContent).mockResolvedValue(null);
      const { batch, ack, retry } = makeBatch();
      await queue(batch);
      expect(updateSpy.mock.calls).toEqual([[{ processing_status: "scraping" }], [{ processing_status: "failed" }]]);
      expect(ack).toHaveBeenCalledOnce();
      expect(retry).not.toHaveBeenCalled();
    });

    it("writes scraping → describing → failed and acks on describe definitive miss (null)", async () => {
      const { admin, updateSpy } = makeFakeAdmin({ data: { url: "https://example.com" }, error: null });
      vi.mocked(createAdminClient).mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);
      vi.mocked(scrapeContent).mockResolvedValue("content");
      vi.mocked(describeContent).mockResolvedValue(null);
      const { batch, ack, retry } = makeBatch();
      await queue(batch);
      expect(updateSpy.mock.calls).toEqual([
        [{ processing_status: "scraping" }],
        [{ processing_status: "describing" }],
        [{ processing_status: "failed" }],
      ]);
      expect(ack).toHaveBeenCalledOnce();
      expect(retry).not.toHaveBeenCalled();
    });

    it("retries on transient throw with no terminal status write", async () => {
      const { admin, updateSpy } = makeFakeAdmin({ data: { url: "https://example.com" }, error: null });
      vi.mocked(createAdminClient).mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);
      vi.mocked(scrapeContent).mockRejectedValue(new Error("network timeout"));
      const { batch, ack, retry } = makeBatch();
      await queue(batch);
      expect(retry).toHaveBeenCalledOnce();
      expect(ack).not.toHaveBeenCalled();
      // scraping is written before the try block; no terminal write follows — this is the documented gap:
      // after max_retries: 3 (wrangler.jsonc) the message lands in the DLQ and nothing writes "failed".
      // The row is stuck in "scraping"/"describing" indefinitely. No DLQ consumer/reaper exists.
      // Closing this gap is a separate feature change, not this phase.
      const terminalStatuses = updateSpy.mock.calls
        .map((c) => (c[0] as { processing_status?: string }).processing_status)
        .filter((s) => s === "done" || s === "failed");
      expect(terminalStatuses).toHaveLength(0);
    });
  });
});
