import { createAdminClient } from "@/lib/supabase-admin";
import { scrapeContent } from "@/lib/services/scrape";
import { describeContent } from "@/lib/services/describe";
import { isYouTubeUrl, fetchYouTubeMetadata } from "@/lib/services/youtube";
import type { QueueMessage } from "@/types";

export async function queue(batch: MessageBatch<QueueMessage>): Promise<void> {
  const [msg] = batch.messages;
  // eslint-disable-next-line no-console -- queue consumer log for Workers observability
  console.log(`[queue] processing ${msg.body.type} v${msg.body.v} for link ${msg.body.linkId}`);

  const admin = createAdminClient();
  if (!admin) {
    // eslint-disable-next-line no-console -- transient infra failure
    console.error("[queue] admin client unavailable — retrying");
    msg.retry();
    return;
  }

  const { data: linkRow, error: lookupError } = await admin
    .from("links")
    .select("url")
    .eq("id", msg.body.linkId)
    .maybeSingle();
  if (lookupError) {
    // eslint-disable-next-line no-console -- transient DB read failure, queue will retry
    console.error(`[queue] link ${msg.body.linkId} lookup failed — retrying:`, lookupError);
    msg.retry();
    return;
  }
  if (!linkRow) {
    // eslint-disable-next-line no-console -- link deleted before processing
    console.error(`[queue] link ${msg.body.linkId} not found — acking`);
    msg.ack();
    return;
  }

  const { url } = linkRow;

  if (isYouTubeUrl(url)) {
    const meta = await fetchYouTubeMetadata(url);
    if (!meta) {
      // Best-effort miss: oEmbed returned nothing usable (403/404/network/bad JSON).
      // Stable tag `youtube_oembed_miss` so the degradation is countable in Workers Logs / Logpush.
      // eslint-disable-next-line no-console -- best-effort oEmbed miss; countable signal for Workers observability
      console.warn(`youtube_oembed_miss linkId=${msg.body.linkId} url=${url}`);
    }
    const micro_description = meta
      ? `▶ ${meta.title} — ${meta.channel} · transcript coming soon`
      : "YouTube video — transcript coming soon.";
    await admin.from("links").update({ micro_description, processing_status: "done" }).eq("id", msg.body.linkId);
    msg.ack();
    return;
  }

  await admin.from("links").update({ processing_status: "scraping" }).eq("id", msg.body.linkId);

  try {
    const content = await scrapeContent(url);
    if (!content) {
      await admin.from("links").update({ processing_status: "failed" }).eq("id", msg.body.linkId);
      msg.ack();
      return;
    }

    await admin.from("links").update({ processing_status: "describing" }).eq("id", msg.body.linkId);

    const description = await describeContent(content, msg.body.userId);
    if (!description) {
      await admin.from("links").update({ processing_status: "failed" }).eq("id", msg.body.linkId);
      msg.ack();
      return;
    }

    await admin
      .from("links")
      .update({ micro_description: description, processing_status: "done" })
      .eq("id", msg.body.linkId);
    msg.ack();
  } catch (err) {
    // eslint-disable-next-line no-console -- transient error, queue will retry
    console.error(`[queue] transient error for link ${msg.body.linkId}:`, err);
    msg.retry();
  }
}
