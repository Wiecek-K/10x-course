import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mutable so the "no key" test can set it falsy without affecting others.
let mockFirecrawlApiKey: string | undefined = "test-key";

vi.mock("astro:env/server", () => ({
  get FIRECRAWL_API_KEY() {
    return mockFirecrawlApiKey;
  },
  USE_FIRECRAWL_MOCK: "false",
  USE_LLM_MOCK: "false",
}));

import { scrapeFirecrawl } from "./firecrawl";

function stubFetch(status: number, body: unknown = {}): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

beforeEach(() => {
  mockFirecrawlApiKey = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scrapeFirecrawl", () => {
  it("returns null when API key is absent", async () => {
    mockFirecrawlApiKey = undefined;
    expect(await scrapeFirecrawl("https://example.com")).toBeNull();
  });

  it("throws on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
    await expect(scrapeFirecrawl("https://example.com")).rejects.toThrow(/network error/i);
  });

  it("returns null for 402 (insufficient credits — definitive miss)", async () => {
    stubFetch(402);
    expect(await scrapeFirecrawl("https://example.com")).toBeNull();
  });

  it("throws for 429 (rate limit — transient)", async () => {
    stubFetch(429);
    await expect(scrapeFirecrawl("https://example.com")).rejects.toThrow(/transient/i);
  });

  it("throws for 500 (server error — transient)", async () => {
    stubFetch(500);
    await expect(scrapeFirecrawl("https://example.com")).rejects.toThrow(/transient/i);
  });

  it("returns null for other non-2xx (e.g. 404 — definitive miss)", async () => {
    stubFetch(404);
    expect(await scrapeFirecrawl("https://example.com")).toBeNull();
  });

  it("returns null when 200 response has null markdown", async () => {
    stubFetch(200, { data: { markdown: null } });
    expect(await scrapeFirecrawl("https://example.com")).toBeNull();
  });

  it("returns null when 200 response has missing data field", async () => {
    stubFetch(200, {});
    expect(await scrapeFirecrawl("https://example.com")).toBeNull();
  });

  it("returns markdown string on success", async () => {
    stubFetch(200, { data: { markdown: "# Title\n\nContent here" } });
    expect(await scrapeFirecrawl("https://example.com")).toBe("# Title\n\nContent here");
  });
});
