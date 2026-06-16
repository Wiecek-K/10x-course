import { describe, it, expect } from "vitest";
import { isYouTubeUrl } from "@/lib/services/youtube";

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
