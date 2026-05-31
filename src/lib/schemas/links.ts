import { z } from "zod";

export const CreateLinkSchema = z.object({
  url: z.url(),
});

export const ListLinksQuerySchema = z.object({
  in_library: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});
