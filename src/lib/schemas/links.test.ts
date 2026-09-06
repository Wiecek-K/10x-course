import { describe, it, expect } from "vitest";
import { CreateLinkSchema, ListLinksQuerySchema, UpdateLinkSchema } from "@/lib/schemas/links";

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

describe("UpdateLinkSchema", () => {
  it("accepts a single field (url)", () => {
    const result = UpdateLinkSchema.safeParse({ url: "https://example.com" });
    expect(result.success).toBe(true);
  });

  it("accepts a single field (in_library)", () => {
    const result = UpdateLinkSchema.safeParse({ in_library: true });
    expect(result.success).toBe(true);
  });

  it("accepts a single field (note)", () => {
    const result = UpdateLinkSchema.safeParse({ note: "my note" });
    expect(result.success).toBe(true);
  });

  it("accepts a single field (micro_description)", () => {
    const result = UpdateLinkSchema.safeParse({ micro_description: "desc" });
    expect(result.success).toBe(true);
  });

  it("accepts a single field (visited: true)", () => {
    const result = UpdateLinkSchema.safeParse({ visited: true });
    expect(result.success).toBe(true);
  });

  it("rejects an empty object", () => {
    const result = UpdateLinkSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a bad URL", () => {
    const result = UpdateLinkSchema.safeParse({ url: "ftp://example.com" });
    expect(result.success).toBe(false);
  });

  it("accepts null for note", () => {
    const result = UpdateLinkSchema.safeParse({ note: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBeNull();
    }
  });

  it("accepts null for micro_description", () => {
    const result = UpdateLinkSchema.safeParse({ micro_description: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.micro_description).toBeNull();
    }
  });

  it("rejects visited: false", () => {
    const result = UpdateLinkSchema.safeParse({ visited: false });
    expect(result.success).toBe(false);
  });

  it("accepts multiple fields together", () => {
    const result = UpdateLinkSchema.safeParse({
      url: "https://example.com/new",
      note: "updated note",
      in_library: true,
    });
    expect(result.success).toBe(true);
  });
});
