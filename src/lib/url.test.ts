import { describe, it, expect } from "vitest";
import { extractFirstUrl } from "./url";

describe("extractFirstUrl", () => {
  it("returns the URL from a plain URL string", () => {
    expect(extractFirstUrl("https://example.com")).toBe("https://example.com");
  });
});
