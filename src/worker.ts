import { handle } from "@astrojs/cloudflare/handler";
import type { QueueMessage } from "@/types";

export default {
  fetch: handle,

  queue(batch) {
    for (const msg of batch.messages) {
      // eslint-disable-next-line no-console -- queue consumer log for Workers observability
      console.log(`[queue] consumed ${msg.body.type} v${msg.body.v} for link ${msg.body.linkId}`);
      msg.ack();
    }
  },
} satisfies ExportedHandler<Env, QueueMessage>;
