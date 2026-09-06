import type { Database } from "@/db/database.types";
import type { z } from "zod";
import type { CreateLinkSchema, ListLinksQuerySchema, UpdateLinkSchema } from "@/lib/schemas/links";

export type PairingCode = Database["public"]["Tables"]["pairing_codes"]["Row"];
export type PairingCodeInsert = Database["public"]["Tables"]["pairing_codes"]["Insert"];

export type TelegramLink = Database["public"]["Tables"]["telegram_links"]["Row"];
export type TelegramLinkInsert = Database["public"]["Tables"]["telegram_links"]["Insert"];

export type JobType = "describe";

export interface QueueMessage {
  type: JobType;
  v: 1;
  linkId: string;
  userId: string;
}

export type ProcessingStatus = "pending" | "scraping" | "describing" | "done" | "failed";

export type Link = Omit<Database["public"]["Tables"]["links"]["Row"], "processing_status"> & {
  processing_status: ProcessingStatus;
};

export type LinkInsert = Database["public"]["Tables"]["links"]["Insert"];

export type CreateLinkInput = z.infer<typeof CreateLinkSchema>;

export type ListLinksQuery = z.infer<typeof ListLinksQuerySchema>;

export type UpdateLinkInput = z.infer<typeof UpdateLinkSchema>;
