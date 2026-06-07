---
date: 2026-06-07T03:00:00+02:00
researcher: claude-sonnet-4-6
git_commit: f143518210e310ee1c47b92c32c90e53afd30234
branch: auto-description-pipeline
repository: 10x-course
topic: "S-02 auto-description-pipeline — codebase state, scraping vendors, LLM feasibility"
tags: [research, s-02, queue, scraping, llm, realtime, inbox]
status: complete
last_updated: 2026-06-07
last_updated_by: claude-sonnet-4-6
last_updated_note: "Added follow-up research: Gap 3 — HTML stripping for Wayback fallback (resolved: not needed)"
---

# Research: S-02 auto-description-pipeline

**Date**: 2026-06-07  
**Git Commit**: f143518210e310ee1c47b92c32c90e53afd30234  
**Branch**: auto-description-pipeline  

## Research Question

What is the current codebase state relevant to S-02, which scraping vendors are feasible, and which LLM provider should be used for micro-description generation?

## Summary

S-02 inherits a solid scaffold from F-02 and S-01. The queue consumer in `src/worker.ts` is a verified no-op ready to be replaced with real processing logic. The DB schema already has `micro_description` (nullable) and `processing_status` (4-state enum). The critical gap in the frontend: `useLinks.ts` subscribes only to INSERT events — UPDATE events (status transitions + description writes) won't reach the browser without adding an UPDATE subscription. Scraping tier 1 (Jina Reader) requires zero config and covers ~80% of pages; tier 2 (paid proxy) and tier 3 (Wayback Machine) are clear fallbacks. gpt-4o-mini is the LLM recommendation by cost/quality ratio.

---

## Detailed Findings

### Queue Consumer Scaffold (`src/worker.ts`)

Current consumer at `src/worker.ts:7-12`:

```typescript
queue(batch) {
  for (const msg of batch.messages) {
    console.log(`[queue] consumed ${msg.body.type} v${msg.body.v} for link ${msg.body.linkId}`);
    msg.ack();
  }
}
```

- Typed as `ExportedHandler<Env, QueueMessage>` — second type param already correct
- `msg.body` resolves to `QueueMessage` with `{ type, v, linkId, userId }` — `userId` present, critical for sessionless DB writes and for the `getLlmApiKey(userId)` abstraction
- S-02 replaces the log+ack body with: fetch link → update status to `'processing'` → scrape → call LLM → update `micro_description` + `'done'`/`'failed'`
- `msg.ack()` stays in place; on failure: `msg.retry()` or let batch auto-retry (up to 3 retries per `wrangler.jsonc` consumer config)

### Queue Message Contract (`src/lib/queue.ts:4-5`, `src/types.ts:11-18`)

```typescript
// src/types.ts:11-18
export type JobType = "describe";

export interface QueueMessage {
  type: JobType;
  v: 1;
  linkId: string;
  userId: string;  // ← already present; enqueueLink passes context.locals.user.id
}
```

No shape change needed for S-02. `userId` was deliberately included in F-02 for exactly this use case.

### Links Schema (migration `20260529120000_create_links.sql`)

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid | gen_random_uuid() | PK |
| `user_id` | uuid | — | FK auth.users, ON DELETE CASCADE |
| `url` | text | — | NOT NULL |
| `micro_description` | text | NULL | S-02 writes here |
| `processing_status` | text | `'pending'` | CHECK enum; S-02 drives transitions |
| `in_library` | boolean | false | — |
| `last_visited` | timestamptz | NULL | — |
| `created_at` | timestamptz | now() | NOT NULL |
| `updated_at` | timestamptz | now() | auto-updated by trigger |

`ProcessingStatus` union in `src/types.ts:20`: `"pending" | "processing" | "done" | "failed"`

RLS: all four operations (SELECT/INSERT/UPDATE/DELETE) scoped `(select auth.uid()) = user_id`. Consumer writes via `createAdminClient()` (service-role, bypasses RLS) — same pattern as S-01 bot webhook. `updated_at` trigger fires automatically on every UPDATE, no need to set it manually.

Realtime already enabled on `links` table (migration `20260603130000_enable_realtime_links.sql`).

### Admin Client Pattern (`src/lib/supabase-admin.ts`)

```typescript
export function createAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

Same null-check contract as `createClient`. Import only in the consumer — never in SSR routes. `SUPABASE_SERVICE_ROLE_KEY` already declared in `astro.config.mjs` env schema (added in S-01).

### `POST /api/links` — enqueue already wired (`src/pages/api/links/index.ts:42-47`)

Desktop links enqueue via `enqueueLink(data.id, context.locals.user.id)` after insert, wrapped in non-fatal try/catch. Bot webhook (S-01) does the same. S-02 consumer can assume every `links` row with `processing_status = 'pending'` was enqueued at insert time — no backfill mechanism needed.

### Frontend — Critical Gap: UPDATE subscription missing

**`src/components/hooks/useLinks.ts:27-29`** — subscription is INSERT-only:

```typescript
.on("postgres_changes", { event: "INSERT", schema: "public", table: "links", filter: `user_id=eq.${userId}` }, ...)
```

S-02's consumer writes UPDATE events (`processing_status` transitions + `micro_description`). Without adding an UPDATE subscription, the inbox won't show description text or status changes live — user would need to reload.

Fix: add a second `.on("postgres_changes", { event: "UPDATE", ... })` handler in `useLinks.ts` that merges the updated row into state by `id` (not append).

**`src/components/InboxList.tsx:59-67`** — badge logic handles only `"pending"`:

```typescript
{link.processing_status === "pending" && (
  <span className="... text-yellow-300">pending</span>
)}
```

S-02 needs additional badge variants: `"processing"` (blue/amber, animated?), `"failed"` (red), `"done"` (hidden or no badge). `micro_description` is not rendered anywhere in `InboxList.tsx` — needs a new display element.

**`src/pages/dashboard.astro:35-41`** — SSR seeds `initialLinks` prop to island. No change needed here; Realtime handles live updates.

---

## Code References

- `src/worker.ts:7-12` — no-op consumer body to replace
- `src/lib/queue.ts:4-5` — `enqueueLink` signature
- `src/types.ts:11-24` — `JobType`, `QueueMessage`, `ProcessingStatus`, `Link`
- `src/lib/supabase-admin.ts` — admin client pattern for sessionless writes
- `src/pages/api/links/index.ts:42-47` — enqueue call (non-fatal pattern)
- `src/components/hooks/useLinks.ts:27-29` — INSERT-only subscription (needs UPDATE)
- `src/components/InboxList.tsx:59-67` — badge logic (needs "processing"/"failed"/"done")
- `supabase/migrations/20260529120000_create_links.sql` — links schema
- `supabase/migrations/20260603121000_fix_links_rls_init_plan.sql` — RLS perf-fix form (reuse pattern for any new UPDATE policies)

---

## Architecture Insights

### Processing status state machine

```
[insert] → pending → processing → done
                              ↘ failed
```

Consumer sets `processing_status = 'processing'` before starting work so that a Worker crash leaves a visible stale-processing state (can be detected and retried by a future cron job). If all scraping tiers fail, set `processing_status = 'failed'` and leave `micro_description = null`. Roadmap FR-005: failed links are visually marked but never lost.

### Sessionless write pattern (from lessons.md)

Consumer is a Cloudflare Queue handler — no HTTP request, no cookie session. `auth.uid()` is NULL. Must use `createAdminClient()`. `userId` comes from `msg.body.userId` (trusted, set at enqueue time by authenticated API endpoint or verified bot webhook). Never trust anything from the scraped page for `user_id`.

### Realtime UPDATE path (from lessons.md)

`links` is in the `supabase_realtime` publication. Service-role UPDATE by consumer → WAL → broadcast → browser subscriber (whose JWT is evaluated by RLS `SELECT` policy). The authenticated browser client already set up in S-01 inbox island will receive the UPDATE events once `useLinks.ts` subscribes to them.

Auth before subscribe rule applies (lesson: `getSession()` then `setAuth()` before `.subscribe()`). The S-01 `useLinks.ts` already implements this correctly — adding UPDATE subscription follows the same pattern.

---

## Scraping Vendors Feasibility

### Tier 1: Jina Reader — PRIMARY (recommended)

- **Endpoint**: `GET https://r.jina.ai/<target-url>` — no body, no SDK
- **Auth**: No API key required for basic use; free account key → 500 RPM + 10M free tokens/month
- **Response**: Markdown by default (clean, LLM-ready). JSON via `Accept: application/json` → `{ url, title, content, timestamp }`
- **Free tier**: 20 RPM keyless; free account key: 500 RPM
- **Works from Cloudflare Worker**: YES — pure `fetch()`
- **Assessment**: Zero config. Handles JS-rendered pages via headless pipeline. Best fit for MVP primary tier. Average latency ~8s.

### Tier 2: ScrapingBee (or equivalent paid proxy) — FALLBACK

- **Endpoint**: `GET https://app.scrapingbee.com/api/v1?api_key=KEY&url=TARGET&return_page_markdown=true`
- **Auth**: API key required; no free recurring tier (1,000 one-time trial credits)
- **Paid**: ~$49/month standard plan
- **Works from Cloudflare Worker**: YES — plain `fetch()`
- **Assessment**: Reliable against paywalls and heavily JS-rendered pages Jina fails on. Expensive for MVP volume. Treat as exception path — fire only when Jina returns empty content. Note: bot-dancer.md reference mentions a ~$2/month proxy; an alternative cheaper vendor may exist (e.g., ZenRows starter ~$19/month, or a RapidAPI proxy plan). **Vendor selection for tier 2 deferred to planning** — architecture is stable regardless.

### Tier 3: Wayback Machine — LAST RESORT

- **Step 1**: `GET https://archive.org/wayback/available?url=<target-url>` → `{ archived_snapshots: { closest: { url, available, status } } }`
- **Step 2**: `fetch(snapshot.url)` → raw HTML, parse for text
- **Auth**: None — completely free
- **Rate limits**: None documented; fine for on-demand single-URL lookups
- **Works from Cloudflare Worker**: YES — pure `fetch()`
- **Assessment**: Content may be stale. Useful for pages that return 403/paywall — archived copy often accessible. Two-round-trip cost.

### YouTube: RapidAPI Transcript API

- **Endpoint**: `GET https://<host>.p.rapidapi.com/transcript?url=<youtube-url>` with `X-RapidAPI-Key` header
- **Auth**: RapidAPI account + API key required
- **Free tier**: ~100 req/month (some legacy plans 500/day)
- **Response**: JSON array of `{ text, start, duration }` segments
- **Works from Cloudflare Worker**: YES — standard REST headers
- **Assessment**: Viable for MVP. Only works on videos with captions (auto-generated sufficient for summarization, per bot-dancer.md). Detection: check if URL matches `youtube.com/watch` or `youtu.be/` pattern before attempting.

### Scraping decision logic (pseudo-code)

```
if isYouTubeUrl(url):
  transcript = fetchRapidApiTranscript(url)
  return transcript ?? null

content = await jinaReader(url)        # tier 1
if !content:
  content = await waybackMachine(url)  # tier 2 (free fallback)
if !content:
  content = await scrapingBeeOrEquiv(url)  # tier 3 (paid, expensive — last)

return content ?? null  # null → processing_status = 'failed'
```

Note: Wayback before paid proxy keeps cost near-zero at MVP scale. Reorder if quality data suggests paid proxy has better hit rate than Wayback.

---

## LLM Provider Feasibility

### Cost comparison (1,000 input tokens + 100 output tokens)

| Model | Cost/call | Cost/1k calls | Notes |
|-------|-----------|---------------|-------|
| **gpt-4o-mini** | $0.00021 | $0.21 | Recommended |
| gpt-4o | $0.0035 | $3.50 | 17× more expensive |
| claude-haiku-4-5 | $0.0015 | $1.50 | 7× more expensive than gpt-4o-mini |
| claude-sonnet-4-6 | $0.0045 | $4.50 | Overkill for summarization |

### API pattern from Cloudflare Worker

Both providers are plain HTTPS REST — no SDK, no Node.js:

```typescript
// OpenAI
const res = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "gpt-4o-mini", messages: [...], max_tokens: 150 }),
});

// Anthropic
const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
  body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 150, messages: [...] }),
});
```

### Recommendation

**gpt-4o-mini.** 7× cheaper than Haiku 4.5, quality gap negligible for 1-2 sentence summarization. New accounts get $5 free API credit. Single ops-key as `LLM_API_KEY` Cloudflare secret.

Provider abstracted behind `getLlmApiKey(userId)` helper (see decision in `change.md`). Env var name: `LLM_API_KEY`. Helper lives in `src/lib/llm-key.ts`.

---

## Historical Context

- `context/archive/2026-05-29-link-processing-queue/plan.md` — F-02 scaffold: consumer no-op, `QueueMessage` shape, `enqueueLink` pattern; notes that S-02 inherits the contract
- `context/archive/2026-06-03-bot-capture-to-inbox/plan.md` — S-01: `createAdminClient()` pattern, sessionless write lesson, Realtime auth-before-subscribe pattern, enqueue in webhook (Phase 3)
- `context/foundation/lessons.md` — "Sessionless endpoints can't use cookie client" (applies to consumer), "Supabase Realtime SUBSCRIBED does not mean events will flow — JWT must be verified" (applies to UPDATE subscription), "A write path that bypasses canonical API also bypasses side effects" (already solved in S-01 — bot webhook calls `enqueueLink`)
- `context/foundation/infrastructure.md` — scraping 3-tier pattern confirmed (free scraper → paid proxy → Web Archive), YouTube transcript via RapidAPI

---

## Open Questions

1. **Tier 2 paid proxy vendor** — ScrapingBee at $49/month is expensive for MVP. Evaluate cheaper alternatives: ZenRows (~$19/month), Apify, or a RapidAPI proxy plan. Block: no — architecture unchanged. Decide at planning.
2. **RapidAPI YouTube account** — requires signup. Confirm which specific API listing to use (multiple providers on RapidHub). Block: no — can select at implementation.
3. **gpt-4o-mini prompt design** — exact prompt for 1-2 sentence micro-description is not researched here. Block: no — straightforward at planning.
4. **`processing_status = 'processing'` stale detection** — if consumer crashes after setting 'processing' but before finishing, row stays 'processing' indefinitely. MVP: acceptable (manual reset if needed). Post-MVP: cron job to reset stale 'processing' rows older than X minutes. Tracked: note for plan.
5. **Scraping tier order** — current proposal: Jina → Wayback → paid proxy (to minimize cost). If Wayback hit rate is low, swap to Jina → paid proxy → Wayback. Data needed after first week of dogfooding.

---

## Follow-up Research 2026-06-07T12:07+02:00 — Gap 1: `astro:env/server` in queue consumer context

### Question

Does `astro:env/server` resolve correctly inside the Cloudflare Workers `queue()` handler (outside Astro request pipeline)? Will `supabase-admin.ts` — which imports `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `astro:env/server` — work when called from `queue()` in `src/worker.ts`?

### Verdict: NOT a blocker. `astro:env/server` works correctly in queue context.

### How `astro:env/server` is implemented

`astro:env/server` is a Vite virtual module generated at build time by `astro/dist/env/vite-plugin-env.js`. For `access: "secret"` fields the generated code is:

```js
export let SUPABASE_URL = _internalGetSecret("SUPABASE_URL");
```

`_internalGetSecret` delegates to `getEnv(key)` from `astro/env/runtime`:

```js
// astro/dist/env/runtime.js:4-8
let _getEnv = (key) => process.env[key]; // default — overrideable
function setGetEnv(fn) { _getEnv = fn; }
function getEnv(...args) { return _getEnv(...args); }
```

Default reads `process.env[key]`. In a CF Worker, `process.env` is an empty object (injected via banner: `globalThis.process ??= {}; globalThis.process.env ??= {};`). Without override, all secrets would be `undefined`.

### How the adapter patches the getter (module-level, not per-request)

`node_modules/@astrojs/cloudflare/dist/utils/handler.js:1,8-9,19`:

```js
import { env as globalEnv } from "cloudflare:workers";   // line 1 — CF global env
import { setGetEnv } from "astro/env/setup";              // line 8
import { createGetEnv } from "../utils/env.js";           // line 9
setGetEnv(createGetEnv(globalEnv));                       // line 19 — MODULE-LEVEL call
```

`createGetEnv` from `node_modules/@astrojs/cloudflare/dist/utils/env.js`:

```js
const createGetEnv = (env) => (key) => {
  const v = env[key];
  if (typeof v === "undefined" || typeof v === "string") return v;
  if (typeof v === "boolean" || typeof v === "number") return v.toString();
  return void 0;
};
```

After `setGetEnv` runs, every `astro:env/server` import resolves via `globalEnv[key]` — the CF Workers env binding object — not `process.env`.

### Why this works in `queue()`

`src/worker.ts:1` imports `@astrojs/cloudflare/handler`:

```ts
import { handle } from "@astrojs/cloudflare/handler";
```

This triggers `handler.js` module evaluation **at Worker startup** — before any `fetch()` or `queue()` call. JS modules are cached; the patch persists for the entire Worker lifetime. The `queue()` handler runs after module init — `astro:env/server` is already wired.

### Current codebase env access patterns

`astro:env/server` importers (7 files):
- `src/lib/supabase-admin.ts:5` — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ← critical for queue consumer
- `src/lib/supabase.ts:3` — `SUPABASE_URL`, `SUPABASE_KEY`
- `src/lib/telegram.ts:1` — `TELEGRAM_BOT_TOKEN`
- `src/lib/config-status.ts:1` — `SUPABASE_URL`, `SUPABASE_KEY`
- `src/pages/api/pairing.ts:2` — `TELEGRAM_BOT_USERNAME`
- `src/pages/api/bot/webhook.ts:2` — `TELEGRAM_WEBHOOK_SECRET`
- `src/pages/dashboard.astro:6` — `SUPABASE_URL`, `SUPABASE_KEY`

`cloudflare:workers` env importers (1 file):
- `src/lib/queue.ts:1` — `env.LINK_QUEUE.send(...)` — queue *binding* object, not a string secret; correct to use CF env directly

### Implication for planning

- `supabase-admin.ts` needs no refactor
- Planned `getLlmApiKey(userId)` in `src/lib/llm-key.ts` can safely import from `astro:env/server`
- `LLM_API_KEY` must be added to `env.schema` in `astro.config.mjs` as `context: "server", access: "secret", optional: true` (per lessons.md rule)
- `wrangler.jsonc` / `.dev.vars` must also declare `LLM_API_KEY`

---

## Follow-up Research 2026-06-07T12:29+02:00 — Gap 2: queue consumer batch size and execution time limits

### Question

What is the safe batch size and execution model for the queue consumer given Jina Reader (~8s) + LLM (~3s) latencies and CF Workers execution limits?

### Verdict: LOCKED. `max_batch_size: 1`, `max_batch_timeout: 5`. Per-link processing, no batching logic.

### Key facts gathered

**Current `wrangler.jsonc` consumer config** (`wrangler.jsonc:19-27`):
```jsonc
{
  "queue": "tabzero-link-processing",
  "max_batch_size": 10,
  "max_batch_timeout": 30,
  "max_retries": 3,
  "retry_delay": 300,
  "dead_letter_queue": "tabzero-link-processing-dlq"
}
```

**Current consumer** (`src/worker.ts:7-13`): stub no-op, iterates batch and calls `msg.ack()`. No real work yet.

**CF Workers execution limits:**
- Free tier: 10ms **CPU time** per invocation (not wall-clock)
- Paid tier: 30s **CPU time** per invocation
- CPU time = JS execution time only; time spent waiting on `fetch()` I/O is NOT counted against CPU

**Timing math for S-02 work:**
- Jina Reader fetch: ~8s (pure I/O, zero CPU)
- LLM call: ~3s (pure I/O, zero CPU)
- Per-link total: ~11s wall-clock, <1ms CPU
- Serial batch=10: ~110s wall-clock → fails on any plan
- `Promise.all` batch=10: ~11s wall-clock, <1ms CPU → fits within limits
- Single message (batch=1): ~11s wall-clock, <1ms CPU → fits on all plans

### Options comparison

| Approach | Wall-clock | CPU | Retry unit | Impl complexity |
|---|---|---|---|---|
| Serial, `max_batch_size: 10` | ~110s | <1ms | batch of 10 | low — but exceeds limits |
| `Promise.all`, `max_batch_size: 10` | ~11s | <1ms | batch of 10 | medium — error aggregation |
| **`max_batch_size: 1` (chosen)** | ~11s | <1ms | per link | lowest |

### Why `Promise.all` rejected

`Promise.all` with batch=10 solves the time limit but introduces per-batch retry semantics: if 1 of 10 links fails (e.g., Jina 429), all 10 messages get retried. With `max_retries: 3` and `retry_delay: 300s`, a transient error on one URL causes 9 successful links to be reprocessed twice more and delays their final state by 10+ minutes. Not acceptable when the natural work unit is one link.

### Why `max_batch_size: 1` wins

1. **Retry granularity**: one failure = one retry, one DLQ entry. Other links unaffected.
2. **Simplest consumer**: no `Promise.all`, no partial-failure aggregation, no `batch.ackAll()` vs `msg.retry()` bookkeeping.
3. **Throughput not limited**: CF Queue infrastructure invokes the consumer concurrently across Worker instances for different messages — throughput scales with queue depth, not batch size.
4. **Safe on free + paid plans**: <1ms CPU per invocation, well under any limit.

### `max_batch_timeout` change: 30 → 5

With `max_batch_size: 1`, CF delivers a message as soon as 1 message is available — the batch is "full" with a single item. The timeout only triggers if the queue is empty and CF is waiting to flush a partial batch. With batch=1, a partial batch of 0 messages (empty queue) never triggers a dispatch. Reducing timeout to 5s is cleaner semantics and eliminates any potential 30s delivery latency spike.

### Config change required in `wrangler.jsonc`

```diff
- "max_batch_size": 10,
- "max_batch_timeout": 30,
+ "max_batch_size": 1,
+ "max_batch_timeout": 5,
```

`max_retries: 3` and `retry_delay: 300` unchanged — appropriate for per-link granular retries.

### Consumer implementation rule

Consumer loop processes exactly one message per invocation. No outer loop over `batch.messages` needed (batch always has exactly 1). Implementation:

```typescript
queue(batch) {
  const [msg] = batch.messages;
  // ... process msg.body (one link)
}
```

---

## Follow-up Research 2026-06-07T12:29+02:00 — Gap 3: HTML stripping for Wayback Machine fallback

### Question

Wayback Machine returns raw HTML. `cheerio`/`jsdom` require Node.js (unavailable in V8 isolate). Three options: `HTMLRewriter` (CF-native), simple regex strip, or delegate Wayback URLs to Jina Reader. Which approach?

### Verdict: NOT NEEDED. All scraping tiers produce Markdown/text natively. Zero in-Worker HTML parsing.

### Scraping tier output formats (final)

| Tier | Input | Output format | HTML parsing needed? |
|---|---|---|---|
| Tier 1 | `r.jina.ai/<original-url>` | Markdown (Readability) | No |
| Tier 2 | `r.jina.ai/<wayback-url>` + `X-Remove-Selector` header | Markdown (Readability) | No |
| Tier 3 | ScrapingBee `?return_page_markdown=true` | Markdown | No |
| YouTube | RapidAPI transcript endpoint | `{ text, start, duration }[]` | No |

### Why Jina works for Wayback URLs

Jina Reader endpoint accepts any URL: `https://r.jina.ai/<target>`. Internally it fetches the URL and runs Mozilla Readability to extract main content. Wayback Machine snapshot URLs follow the pattern `https://web.archive.org/web/<timestamp>/<original-url>` — these are valid HTTPS URLs; no special encoding required.

**Toolbar exclusion via Readability:** The Wayback toolbar is injected as `<div id="wm-ipp-base">` — a low-content-density navigation div with timestamps, button labels, and nav links. Readability scores DOM subtrees by text/link density ratio; the toolbar scores low → excluded automatically from main content extraction.

**`X-Remove-Selector` header for deterministic removal:** Jina exposes a `X-Remove-Selector` request header that strips elements before Readability runs:
```
X-Remove-Selector: #wm-ipp-base
```
This ensures toolbar exclusion even if Readability changes scoring heuristics.

**Why Wayback is easier for Jina than the original page:** Original page may be a JS SPA (Jina failed), may have bot detection (Jina failed), may have a paywall. Wayback snapshot is static HTML served by archive.org — no JS execution required, no authentication, no anti-scraping. Jina succeeds on static HTML pages very reliably.

### HTMLRewriter — available but not chosen

`HTMLRewriter` is CF-native (available in workerd runtime, not in Node.js). It can perform streaming HTML text extraction:

```typescript
class Remover { element(el: Element) { el.remove(); } }
class TextCollector {
  private buf: string[] = [];
  text(chunk: Text) { this.buf.push(chunk.text); }
  result() { return this.buf.join('').replace(/\s+/g, ' ').trim(); }
}

async function extractPlainText(waybackRes: Response): Promise<string> {
  const collector = new TextCollector();
  const transformed = new HTMLRewriter()
    .on('div#wm-ipp-base', new Remover())  // Wayback toolbar
    .on('script', new Remover())
    .on('style', new Remover())
    .on('nav', new Remover())
    .on('header', new Remover())
    .on('footer', new Remover())
    .on('body', collector)
    .transform(waybackRes);
  await transformed.text(); // MUST consume stream to drive parsing
  return collector.result();
}
```

Key constraints:
- `.transform()` is lazy — must `await transformed.text()` to drive handler callbacks
- `text()` handler receives chunks (partial text nodes); accumulate with `buf.push()`
- `el.remove()` drops element AND all children — correct for script/style/toolbar
- Supports `E#id` selector form (`div#wm-ipp-base`) — toolbar exclusion works

**Rejected for MVP** because: Jina on Wayback URL achieves the same result with zero extra code. HTMLRewriter remains available as documented option if a raw-HTML-returning tier is ever added (e.g., a cheaper proxy without markdown mode).

### Simple regex — rejected

`/<[^>]+>/g` strips HTML tags but leaves text content between `<script>` and `<style>` tags (CSS rules, JS code) in the output. Wayback toolbar text (timestamps, button labels) also included verbatim. Even the enhanced pattern:
```typescript
html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim()
```
…still includes Wayback toolbar text at the top of output. Rejected — quality insufficient for LLM summarization input, and Jina option has zero cost overhead.

### Implementation rule

Every scraping tier function signature:
```typescript
async function scrapeXxx(url: string): Promise<string | null>
```
Returns Markdown string or `null` (failed). Consumer never receives or parses HTML.
