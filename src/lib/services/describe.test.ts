import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getLlmApiKey } from "@/lib/llm-key";

vi.mock("astro:env/server", () => ({
  USE_LLM_MOCK: "false",
  USE_FIRECRAWL_MOCK: "false",
}));

vi.mock("@/lib/llm-key", () => ({
  getLlmApiKey: vi.fn(),
}));

import { describeContent } from "./describe";

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

function openAiBody(content: string | null) {
  return { choices: [{ message: { content } }] };
}

beforeEach(() => {
  vi.mocked(getLlmApiKey).mockReturnValue("sk-test");
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("describeContent", () => {
  it("returns null when API key is absent", async () => {
    vi.mocked(getLlmApiKey).mockReturnValue(null);
    expect(await describeContent("some content", "user-1")).toBeNull();
  });

  it("throws on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
    await expect(describeContent("some content", "user-1")).rejects.toThrow(/network error/i);
  });

  it("throws for 429 (rate limit — transient)", async () => {
    stubFetch(429);
    await expect(describeContent("some content", "user-1")).rejects.toThrow(/transient/i);
  });

  it("throws for 500 (server error — transient)", async () => {
    stubFetch(500);
    await expect(describeContent("some content", "user-1")).rejects.toThrow(/transient/i);
  });

  it("returns null for other non-2xx (e.g. 403 — definitive miss)", async () => {
    stubFetch(403);
    expect(await describeContent("some content", "user-1")).toBeNull();
  });

  it("returns null when response content is null", async () => {
    stubFetch(200, openAiBody(null));
    expect(await describeContent("some content", "user-1")).toBeNull();
  });

  it("returns null when response content is empty string", async () => {
    stubFetch(200, openAiBody(""));
    expect(await describeContent("some content", "user-1")).toBeNull();
  });

  it("returns description string on success", async () => {
    stubFetch(200, openAiBody(JSON.stringify({ description: "A great article about testing" })));
    expect(await describeContent("some content", "user-1")).toBe("A great article about testing");
  });

  it("returns null when description is only whitespace", async () => {
    stubFetch(200, openAiBody(JSON.stringify({ description: "   " })));
    expect(await describeContent("some content", "user-1")).toBeNull();
  });

  it("throws on malformed JSON in response content (transient classification)", async () => {
    stubFetch(200, openAiBody("not-valid-json"));
    await expect(describeContent("some content", "user-1")).rejects.toThrow();
  });
});
