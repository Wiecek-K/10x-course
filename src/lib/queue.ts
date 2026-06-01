import { env } from "cloudflare:workers";
import type { QueueMessage } from "@/types";

export async function enqueueLink(linkId: string, userId: string): Promise<void> {
  await env.LINK_QUEUE.send({ type: "describe", v: 1, linkId, userId } satisfies QueueMessage);
}
