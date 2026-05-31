import type { Database } from "@/db/database.types";
import type { z } from "zod";
import type { CreateLinkSchema, ListLinksQuerySchema } from "@/lib/schemas/links";

export type ProcessingStatus = "pending" | "processing" | "done" | "failed";

export type Link = Omit<Database["public"]["Tables"]["links"]["Row"], "processing_status"> & {
  processing_status: ProcessingStatus;
};

export type LinkInsert = Database["public"]["Tables"]["links"]["Insert"];

export type CreateLinkInput = z.infer<typeof CreateLinkSchema>;

export type ListLinksQuery = z.infer<typeof ListLinksQuerySchema>;
