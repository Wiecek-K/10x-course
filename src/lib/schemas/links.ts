import { z } from "zod";

export const CreateLinkSchema = z.object({
  url: z.url().refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
    message: "URL must use the http(s) scheme",
  }),
});

export const ListLinksQuerySchema = z.object({
  in_library: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});
