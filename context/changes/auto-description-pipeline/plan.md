# Auto-description Pipeline Implementation Plan

## Overview

Replace the no-op queue consumer (`src/worker.ts:7-13`) with a real processing pipeline: for each enqueued link, scrape its content (Jina Reader → Wayback fallback for pages; RapidAPI transcript for YouTube), generate a 1-2 sentence micro-description with gpt-4o-mini (few-shot house-style prompt), and write the result back to the `links` row via the service-role admin client. The inbox island updates live as status transitions and descriptions land.

This reproduces the cheap, MVP-ideal data-acquisition flow from the bot-dancer talk (`references/bot-dancer.md`), adapted to the codebase's Markdown-native, zero-HTML-parsing constraint. See `scraping-flow-comparison.md` for the talk-vs-research collision that grounds these choices.

## Current State Analysis

- **Consumer is a verified no-op** (`src/worker.ts:7-13`): iterates batch, logs, acks. `ExportedHandler<Env, QueueMessage>` already typed correctly; `msg.body` resolves to `{ type, v, linkId, userId }`.
- **DB ready**: `links` table has `micro_description` (text, nullable) and `processing_status` (text + CHECK enum, default `'pending'`). RLS scoped `auth.uid() = user_id` on all four ops. `updated_at` trigger auto-fires. Realtime publication already includes `links`.
- **Admin client exists** (`src/lib/supabase-admin.ts`): `createAdminClient()` returns service-role client or `null`. Header comment says "import ONLY from the bot webhook endpoint" — the consumer is the second legitimate importer; comment must be updated.
- **Enqueue wired at both capture paths**: `POST /api/links` and the bot webhook both call `enqueueLink(id, userId)`. Every `pending` row was enqueued at insert — no backfill needed.
- **Frontend gaps** (`useLinks.ts`, `InboxList.tsx`): subscription is INSERT-only; badge renders only `pending`; `micro_description` rendered nowhere.
- **Config**: `wrangler.jsonc` consumer is `max_batch_size: 10`, `max_batch_timeout: 30`. No `LLM_API_KEY` in `astro.config.mjs` env schema.

## Desired End State

A user sends a link (desktop or bot). It appears in the inbox as `pending`, transitions to `processing`, then to `done` with a 1-2 sentence micro-description rendered beneath the URL — all live, no reload. Pages Jina can't reach fall back to Wayback; YouTube links are summarized from their transcript. Links that exhaust every tier show a `failed` badge and remain in the list (never lost). MVP runs at ~$0 (Jina free, Wayback free, RapidAPI YouTube free tier, gpt-4o-mini cents).

Verify: send an article URL, a YouTube URL, and a known-paywalled URL through the bot; watch the inbox transition each to its terminal state with appropriate content/badge, with no manual refresh.

### Key Discoveries:

- `astro:env/server` resolves in `queue()` context — adapter patches the env getter at module load (`research.md` Gap 1). No refactor of `supabase-admin.ts` or new `llm-key.ts` needed.
- Jina returns **only title + nav chrome** for YouTube (live test: 41k chars, no transcript) — YouTube MUST branch before the cascade.
- Queue `max_retries: 3` already absorbs transient failures before status reaches `failed` — manual retry is unnecessary at MVP.
- Realtime delivers service-role UPDATEs to the owning user via the subscriber's SELECT RLS policy (`lessons.md`) — no special trick beyond adding an UPDATE handler.

## What We're NOT Doing

- **No paid proxy vendor** — tier wired as a stub returning `null`; vendor chosen later from dogfooding data.
- **No manual retry button** and **no stale-`processing` cron reset** — deferred to a later slice; queue auto-retry covers transients.
- **No per-user style corpus / BYOK** — few-shot examples are hardcoded house style for MVP; per-user is future (`getLlmApiKey` direction).
- **No in-Worker HTML parsing** (no cheerio/jsdom/HTMLRewriter) — every tier returns Markdown/text.
- **No QueueMessage shape change**, no new migrations (schema already supports everything).
- **No language-preference ladder beyond what RapidAPI returns** — accept the transcript the API gives.

## Implementation Approach

Five phases, bottom-up: config/secrets first (so later phases build green), then the leaf scraping + LLM services (pure functions, independently testable), then the consumer that orchestrates them, then the frontend that surfaces the results. Each service is a `(...)=> Promise<string | null>` so the orchestrator composes them with `??` and the consumer only ever sees a string or null.

## Critical Implementation Details

**LLM_API_KEY env access** — must be declared `access: "secret"` in `astro.config.mjs` (not `public`), or build-time inlining strips the runtime guard (`lessons.md`). The key is read only through `getLlmApiKey(userId)` (`src/lib/llm-key.ts`), never `env.LLM_API_KEY` directly in consumer logic (`change.md` decision).

**YouTube detection ordering** — `isYouTubeUrl()` must run before the Jina cascade; Jina on a YouTube URL returns nav chrome, not transcript, so a cascade-first design would produce garbage descriptions for every video.

**Status-before-work write** — consumer sets `processing_status = 'processing'` before scraping so a Worker crash leaves a visible non-terminal state (`research.md` state machine). On total scrape/LLM failure, set `'failed'` with `micro_description` left null.

## Phase 1: Config & Key Plumbing

### Overview

Add the LLM key to the env schema and runtime config, create the key-access helper, and switch the queue consumer config to per-link processing.

### Changes Required:

#### 1. Env schema

**File**: `astro.config.mjs`

**Intent**: Declare `LLM_API_KEY` so `astro:env/server` resolves it at runtime in the queue context.

**Contract**: Add `LLM_API_KEY: envField.string({ context: "server", access: "secret", optional: true })` to the `env.schema` object alongside the existing secrets.

#### 2. Local + deploy secrets

**File**: `.dev.vars`, `.env.example`

**Intent**: Make the key available to `wrangler dev` and document it for contributors.

**Contract**: Add a real `LLM_API_KEY=<value>` line to `.dev.vars` (never `###` placeholder — wrangler treats `#` as a comment) and a documented placeholder entry to `.env.example`. Production key set via `wrangler secret put LLM_API_KEY`.

#### 3. Key-access helper

**File**: `src/lib/llm-key.ts` (new)

**Intent**: Single abstraction point for the LLM key so a future per-user BYOK migration touches one function.

**Contract**: `export function getLlmApiKey(userId: string): string | null` — MVP ignores `userId`, returns `LLM_API_KEY` from `astro:env/server` (or `null` if unset). Imports from `astro:env/server`.

#### 4. Queue consumer config

**File**: `wrangler.jsonc`

**Intent**: Per-link processing with granular retry (`research.md` Gap 2, locked).

**Contract**: In the consumer object, `max_batch_size: 1`, `max_batch_timeout: 5`. Leave `max_retries: 3`, `retry_delay: 300`, DLQ unchanged.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `bun run build` (or `bunx astro check`)
- Linting passes: `bun run lint`
- `wrangler.jsonc` parses: `bunx wrangler types --check` succeeds

#### Manual Verification:

- `bun run dev` boots without env errors; `getLlmApiKey("x")` returns the configured key in a scratch log.

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Scraping Services

### Overview

Leaf scraping functions plus an orchestrator that selects the YouTube branch or runs the page cascade. All return Markdown/text or null.

### Changes Required:

#### 1. Jina Reader tier

**File**: `src/lib/services/jina.ts` (new)

**Intent**: Primary page scraper — fetch clean Markdown for a URL.

**Contract**: `scrapeJina(url: string): Promise<string | null>` — `GET https://r.jina.ai/<url>`; on non-2xx or empty body return `null`, else the Markdown text. No API key required at MVP volume.

#### 2. Wayback tier

**File**: `src/lib/services/wayback.ts` (new)

**Intent**: Free fallback for pages Jina can't reach — fetch an archived snapshot's content via Jina.

**Contract**: `scrapeWayback(url: string): Promise<string | null>` — query `https://archive.org/wayback/available?url=<url>`; if a closest snapshot exists, run it back through Jina (`r.jina.ai/<snapshot-url>` with `X-Remove-Selector: #wm-ipp-base` header) and return Markdown; else `null`.

#### 3. Paid proxy stub

**File**: `src/lib/services/paid-proxy.ts` (new)

**Intent**: Reserve the cascade slot; no vendor at MVP.

**Contract**: `scrapePaidProxy(_url: string): Promise<string | null>` — returns `null`. Header comment notes vendor selection deferred to post-dogfooding.

#### 4. YouTube transcript tier

**File**: `src/lib/services/youtube.ts` (new)

**Intent**: Detect YouTube URLs and fetch their transcript from the RapidAPI micro-API.

**Contract**: Two exports — `isYouTubeUrl(url: string): boolean` (matches `youtube.com/watch` and `youtu.be/`) and `scrapeYouTubeTranscript(url: string): Promise<string | null>` (GET the RapidAPI transcript endpoint with `X-RapidAPI-Key` header; join the returned `{ text }[]` segments into one string; `null` on failure or no captions). Reads the RapidAPI key from `astro:env/server` — add `RAPIDAPI_KEY` to the env schema and `.dev.vars` in this phase (same `access: "secret"` form as Phase 1).

#### 5. Scrape orchestrator

**File**: `src/lib/services/scrape.ts` (new)

**Intent**: Single entry the consumer calls; routes YouTube vs page cascade.

**Contract**: `scrapeContent(url: string): Promise<string | null>`. Logic: if `isYouTubeUrl(url)` return `scrapeYouTubeTranscript(url)`; else `(await scrapeJina(url)) ?? (await scrapeWayback(url)) ?? (await scrapePaidProxy(url))`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `bun run build`
- Linting passes: `bun run lint`

#### Manual Verification:

- Scratch-invoke `scrapeContent()` against an article URL → non-empty Markdown; a YouTube URL → transcript text; a nonexistent domain → `null`.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: LLM Micro-description Service

### Overview

Turn scraped content into a 1-2 sentence micro-description via gpt-4o-mini using a few-shot house-style prompt.

### Changes Required:

#### 1. Describe service

**File**: `src/lib/services/describe.ts` (new)

**Intent**: Generate the micro-description, matching a consistent house style via few-shot examples (the talk's proven quality lever, adapted to hardcoded examples since no per-user corpus exists yet).

**Contract**: `describeContent(content: string, userId: string): Promise<string | null>`. Resolves the key via `getLlmApiKey(userId)` (returns `null` if no key). POSTs to `https://api.openai.com/v1/chat/completions` with `model: "gpt-4o-mini"`, `max_tokens: ~120`. The system/user messages embed 2-3 hardcoded example micro-descriptions as the style template, then the scraped content (truncated to a sane token budget). Returns the trimmed completion text, or `null` on API error.

The few-shot framing is the non-obvious part — shape it like:

```
System: You write one-to-two sentence micro-descriptions of saved links in a
consistent house style. Match the structure, length, and tone of these examples:
  - "<example 1>"
  - "<example 2>"
  - "<example 3>"
User: Summarize the following content in that same style:
<scraped content>
```

### Success Criteria:

#### Automated Verification:

- Type checking passes: `bun run build`
- Linting passes: `bun run lint`

#### Manual Verification:

- Scratch-invoke `describeContent(sampleMarkdown, userId)` → a 1-2 sentence description matching the example style; with no key → `null` (no throw).

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Queue Consumer

### Overview

Wire the consumer to orchestrate scrape → describe → write, with status transitions and per-link retry.

### Changes Required:

#### 1. Consumer body

**File**: `src/worker.ts`

**Intent**: Replace the log+ack stub with the real pipeline for one message per invocation.

**Contract**: `queue(batch)` takes `const [msg] = batch.messages` (batch size is 1). Build `createAdminClient()`; if `null`, `msg.retry()` and return. Then: update the link to `processing_status: 'processing'`; `content = await scrapeContent(url)`; if content, `desc = await describeContent(content, msg.body.userId)`; on success update `{ micro_description: desc, processing_status: 'done' }`; on scrape/LLM failure update `{ processing_status: 'failed' }`. `msg.ack()` on a completed terminal write; `msg.retry()` only on infrastructure errors (admin client null, thrown exception) so the queue's `max_retries` applies. The link's `url` is fetched via the admin client by `msg.body.linkId` (the message carries no URL). Cast Supabase reads to the `Link` type at the query boundary.

#### 2. Admin client comment

**File**: `src/lib/supabase-admin.ts`

**Intent**: Comment currently says "import ONLY from the bot webhook endpoint" — now also the consumer.

**Contract**: Update the header comment to name both importers (bot webhook + queue consumer).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `bun run build`
- Linting passes: `bun run lint`

#### Manual Verification:

- With `bun run dev` and a real LLM key, enqueue a link (send via bot or POST /api/links) → DB row transitions pending → processing → done with a non-null `micro_description`.
- A guaranteed-fail URL → row ends `failed`, `micro_description` null.
- Confirm only one message processed per invocation (log shows single linkId per `queue()` call).

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Frontend Live Updates

### Overview

Surface status transitions and descriptions live in the inbox.

### Changes Required:

#### 1. UPDATE subscription

**File**: `src/components/hooks/useLinks.ts`

**Intent**: Receive consumer-written UPDATE events and merge them into state.

**Contract**: Add a second `.on("postgres_changes", { event: "UPDATE", schema: "public", table: "links", filter: \`user_id=eq.${userId}\` }, ...)` handler on the existing channel before `.subscribe()`. The handler replaces the matching row by `id` (map over `prev`, swap on `id === payload.new.id`) — not prepend. Keep the auth-before-subscribe ordering intact.

#### 2. Badges + description rendering

**File**: `src/components/InboxList.tsx`

**Intent**: Show `processing`/`failed` badges and render the micro-description.

**Contract**: Extend the badge block to cover `processing` (blue/amber) and `failed` (red); `done` shows no badge. Render `link.micro_description` (when present) as a line beneath the URL. Use `cn()` for class composition.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `bun run build`
- Linting passes: `bun run lint`

#### Manual Verification:

- With the app open, send a link → inbox shows pending → processing → done with description appearing live, no reload.
- A failed link shows the red `failed` badge live.
- Hard-refresh preserves the same rendered state (SSR seed matches Realtime state).

**Implementation Note**: Final phase — confirm the full E2E flow manually.

---

## Testing Strategy

### Unit Tests:

No runner configured yet — services are written as pure `(...) => Promise<string|null>` so they're unit-testable when a runner is added. Manual scratch-invocation covers MVP.

### Integration Tests:

End-to-end via the running app (bot/desktop capture → inbox), per each phase's Manual Verification.

### Manual Testing Steps:

1. Send a normal article URL via bot → expect `done` + description live.
2. Send a YouTube URL → expect `done` + transcript-based description.
3. Send a paywalled/blocked URL → expect Wayback fallback or `failed`.
4. Send a dead/nonexistent URL → expect `failed` badge, link retained.

## Performance Considerations

Per-link ~11s wall-clock, <1ms CPU (pure I/O) — safe on free and paid Workers tiers. Throughput scales via concurrent Worker invocations across messages, not batch size (`research.md` Gap 2). Truncate scraped content before the LLM call to bound token cost/latency.

## Migration Notes

No DB migrations. Config changes: `astro.config.mjs` env schema (`LLM_API_KEY`, `RAPIDAPI_KEY`), `wrangler.jsonc` consumer batch settings, `.dev.vars`/`.env.example`. Rollback = revert these files and restore the no-op `queue()` body. Re-run `bunx wrangler types` after any binding change (no new bindings here, only consumer tuning + secrets).

## References

- Research: `context/changes/auto-description-pipeline/research.md`
- Change identity + locked decisions: `context/changes/auto-description-pipeline/change.md`
- Talk-vs-research collision: `context/changes/auto-description-pipeline/scraping-flow-comparison.md`
- Talk transcript: `references/bot-dancer.md`
- Consumer scaffold: `src/worker.ts:7-13`
- Admin client pattern: `src/lib/supabase-admin.ts`
- INSERT-only subscription to extend: `src/components/hooks/useLinks.ts:25-34`
- Badge logic to extend: `src/components/InboxList.tsx:59-67`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Config & Key Plumbing

#### Automated

- [ ] 1.1 Type checking passes (`bun run build`)
- [ ] 1.2 Linting passes (`bun run lint`)
- [ ] 1.3 `wrangler.jsonc` parses (`bunx wrangler types --check`)

#### Manual

- [ ] 1.4 `bun run dev` boots without env errors; `getLlmApiKey` returns configured key

### Phase 2: Scraping Services

#### Automated

- [ ] 2.1 Type checking passes (`bun run build`)
- [ ] 2.2 Linting passes (`bun run lint`)

#### Manual

- [ ] 2.3 `scrapeContent()` returns Markdown for article, transcript for YouTube, null for dead domain

### Phase 3: LLM Micro-description Service

#### Automated

- [ ] 3.1 Type checking passes (`bun run build`)
- [ ] 3.2 Linting passes (`bun run lint`)

#### Manual

- [ ] 3.3 `describeContent()` returns styled 1-2 sentence description; null without key (no throw)

### Phase 4: Queue Consumer

#### Automated

- [ ] 4.1 Type checking passes (`bun run build`)
- [ ] 4.2 Linting passes (`bun run lint`)

#### Manual

- [ ] 4.3 Enqueued link transitions pending → processing → done with micro_description
- [ ] 4.4 Guaranteed-fail URL ends `failed`, micro_description null
- [ ] 4.5 One message processed per invocation

### Phase 5: Frontend Live Updates

#### Automated

- [ ] 5.1 Type checking passes (`bun run build`)
- [ ] 5.2 Linting passes (`bun run lint`)

#### Manual

- [ ] 5.3 Link transitions render live (pending → processing → done + description), no reload
- [ ] 5.4 Failed link shows red badge live
- [ ] 5.5 Hard-refresh preserves rendered state
