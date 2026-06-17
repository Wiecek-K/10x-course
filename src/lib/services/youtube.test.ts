import { describe, it, expect, vi, afterEach } from "vitest";
import { isYouTubeUrl, fetchYouTubeMetadata } from "@/lib/services/youtube";

describe("isYouTubeUrl", () => {
  describe("returns true for", () => {
    it("youtube.com/watch URL", () => {
      expect(isYouTubeUrl("https://youtube.com/watch?v=abc123")).toBe(true);
    });

    it("www.youtube.com/watch URL (www. stripped)", () => {
      expect(isYouTubeUrl("https://www.youtube.com/watch?v=abc123")).toBe(true);
    });

    it("youtube.com/shorts URL", () => {
      expect(isYouTubeUrl("https://youtube.com/shorts/abc123")).toBe(true);
    });

    it("www.youtube.com/shorts URL", () => {
      expect(isYouTubeUrl("https://www.youtube.com/shorts/abc123")).toBe(true);
    });

    it("youtu.be short link", () => {
      expect(isYouTubeUrl("https://youtu.be/abc123")).toBe(true);
    });
  });

  describe("returns false for", () => {
    it("music.youtube.com (subdomain not normalized to youtube.com)", () => {
      expect(isYouTubeUrl("https://music.youtube.com/watch?v=abc123")).toBe(false);
    });

    it("youtube.com/feed (not /watch or /shorts/)", () => {
      expect(isYouTubeUrl("https://youtube.com/feed")).toBe(false);
    });

    it("youtube.com root path", () => {
      expect(isYouTubeUrl("https://youtube.com/")).toBe(false);
    });

    it("non-YouTube host", () => {
      expect(isYouTubeUrl("https://example.com/watch?v=abc123")).toBe(false);
    });

    it("malformed string (not a URL)", () => {
      expect(isYouTubeUrl("not-a-url")).toBe(false);
    });

    it("empty string", () => {
      expect(isYouTubeUrl("")).toBe(false);
    });
  });
});

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchYouTubeMetadata", () => {
  it("returns title and channel on successful oEmbed response", async () => {
    stubFetch(200, { title: "My Video", author_name: "My Channel" });
    const result = await fetchYouTubeMetadata("https://www.youtube.com/watch?v=abc12345678");
    expect(result).toEqual({ title: "My Video", channel: "My Channel" });
  });

  it("calls oEmbed with canonical watch URL for /shorts/ input", async () => {
    stubFetch(200, { title: "Short", author_name: "Channel" });
    await fetchYouTubeMetadata("https://youtube.com/shorts/abc12345678");
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("abc12345678"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("oembed"));
  });

  it("calls oEmbed with canonical watch URL for youtu.be input", async () => {
    stubFetch(200, { title: "Short", author_name: "Channel" });
    await fetchYouTubeMetadata("https://youtu.be/abc12345678");
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("abc12345678"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("oembed"));
  });

  it("returns null on non-2xx response", async () => {
    stubFetch(404);
    expect(await fetchYouTubeMetadata("https://www.youtube.com/watch?v=abc12345678")).toBeNull();
  });

  it("returns null on network error (does not throw)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failure")));
    await expect(fetchYouTubeMetadata("https://www.youtube.com/watch?v=abc12345678")).resolves.toBeNull();
  });

  it("returns null when JSON is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      }),
    );
    expect(await fetchYouTubeMetadata("https://www.youtube.com/watch?v=abc12345678")).toBeNull();
  });

  it("returns null when title is missing from oEmbed response", async () => {
    stubFetch(200, { author_name: "Channel" });
    expect(await fetchYouTubeMetadata("https://www.youtube.com/watch?v=abc12345678")).toBeNull();
  });

  it("returns null when author_name is missing from oEmbed response", async () => {
    stubFetch(200, { title: "My Video" });
    expect(await fetchYouTubeMetadata("https://www.youtube.com/watch?v=abc12345678")).toBeNull();
  });

  it("returns null and makes no fetch call when URL has no extractable video id", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await fetchYouTubeMetadata("https://youtube.com/feed")).toBeNull();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
