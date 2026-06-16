import { describe, it, expect } from "vitest";
import { extractFirstUrl } from "./url";

describe("extractFirstUrl", () => {
  it("returns a plain https URL", () => {
    expect(extractFirstUrl("https://example.com")).toBe("https://example.com");
  });

  it("returns a plain http URL", () => {
    expect(extractFirstUrl("http://example.com/path")).toBe("http://example.com/path");
  });

  it("extracts URL embedded in surrounding text", () => {
    expect(extractFirstUrl("Check this out: https://example.com/article great read")).toBe(
      "https://example.com/article",
    );
  });

  it("returns first URL when multiple are present", () => {
    expect(extractFirstUrl("https://first.com and https://second.com")).toBe("https://first.com");
  });

  it("strips trailing period", () => {
    expect(extractFirstUrl("https://example.com.")).toBe("https://example.com");
  });

  it("strips trailing comma", () => {
    expect(extractFirstUrl("see https://example.com,")).toBe("https://example.com");
  });

  it("strips trailing semicolon", () => {
    expect(extractFirstUrl("https://example.com;")).toBe("https://example.com");
  });

  it("strips trailing exclamation mark", () => {
    expect(extractFirstUrl("https://example.com!")).toBe("https://example.com");
  });

  it("strips trailing question mark", () => {
    expect(extractFirstUrl("https://example.com?")).toBe("https://example.com");
  });

  it("strips trailing closing paren", () => {
    expect(extractFirstUrl("(see https://example.com)")).toBe("https://example.com");
  });

  it("strips trailing closing bracket", () => {
    expect(extractFirstUrl("https://example.com]")).toBe("https://example.com");
  });

  it("strips trailing closing brace", () => {
    expect(extractFirstUrl("https://example.com}")).toBe("https://example.com");
  });

  it("strips trailing angle bracket", () => {
    expect(extractFirstUrl("https://example.com>")).toBe("https://example.com");
  });

  it("strips trailing single quote", () => {
    expect(extractFirstUrl("https://example.com'")).toBe("https://example.com");
  });

  it("strips trailing double quote", () => {
    expect(extractFirstUrl('https://example.com"')).toBe("https://example.com");
  });

  it("strips trailing colon", () => {
    expect(extractFirstUrl("https://example.com:")).toBe("https://example.com");
  });

  it("strips multiple trailing punctuation characters", () => {
    expect(extractFirstUrl("https://example.com.)")).toBe("https://example.com");
  });

  it("preserves query string and fragment", () => {
    expect(extractFirstUrl("https://example.com/path?q=1&r=2#section")).toBe(
      "https://example.com/path?q=1&r=2#section",
    );
  });

  it("returns null when text has no URL", () => {
    expect(extractFirstUrl("no url here")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractFirstUrl("")).toBeNull();
  });

  it("does not match bare domain without scheme", () => {
    expect(extractFirstUrl("example.com")).toBeNull();
  });
});
