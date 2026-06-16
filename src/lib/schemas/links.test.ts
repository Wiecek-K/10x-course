import { describe, it, expect } from "vitest";
import { CreateLinkSchema, ListLinksQuerySchema } from "@/lib/schemas/links";

describe("CreateLinkSchema", () => {
  it("accepts a valid https URL", () => {
    const result = CreateLinkSchema.safeParse({ url: "https://example.com" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid http URL", () => {
    const result = CreateLinkSchema.safeParse({ url: "http://example.com/path" });
    expect(result.success).toBe(true);
  });

  it("accepts https URL with path, query, and fragment", () => {
    const result = CreateLinkSchema.safeParse({ url: "https://example.com/path?q=1#section" });
    expect(result.success).toBe(true);
  });

  it("rejects ftp:// URL with the http(s) message", () => {
    const result = CreateLinkSchema.safeParse({ url: "ftp://example.com" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("URL must use the http(s) scheme");
    }
  });

  it("rejects javascript: URL", () => {
    const result = CreateLinkSchema.safeParse({ url: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });

  it("rejects a plain string that is not a URL", () => {
    const result = CreateLinkSchema.safeParse({ url: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = CreateLinkSchema.safeParse({ url: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing url field", () => {
    const result = CreateLinkSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("ListLinksQuerySchema", () => {
  it("transforms 'true' string to boolean true", () => {
    const result = ListLinksQuerySchema.safeParse({ in_library: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.in_library).toBe(true);
    }
  });

  it("transforms 'false' string to boolean false", () => {
    const result = ListLinksQuerySchema.safeParse({ in_library: "false" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.in_library).toBe(false);
    }
  });

  it("leaves in_library as undefined when omitted", () => {
    const result = ListLinksQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.in_library).toBeUndefined();
    }
  });
});
