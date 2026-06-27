import { handle } from "@astrojs/cloudflare/handler";
import { queue } from "@/lib/queue-consumer";
import type { QueueMessage } from "@/types";

export default {
  fetch: handle,
  queue,
} satisfies ExportedHandler<Env, QueueMessage>;
