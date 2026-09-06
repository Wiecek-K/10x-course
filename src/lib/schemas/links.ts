import { z } from "zod";

export const CreateLinkSchema = z.object({
  url: z.url().refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
    message: "URL must use the http(s) scheme",
  }),
});

export const UpdateLinkSchema = z
  .object({
    url: z
      .url()
      .refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
        message: "URL must use the http(s) scheme",
      })
      .optional(),
    micro_description: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    in_library: z.boolean().optional(),
    visited: z.literal(true).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  });

export const ListLinksQuerySchema = z.object({
  in_library: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});
