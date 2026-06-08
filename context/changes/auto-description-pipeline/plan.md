# Auto-description Pipeline Implementation Plan

## Overview

Replace the no-op queue consumer (`src/worker.ts:7-13`) with a real processing pipeline: for each enqueued link, scrape its content (Firecrawl for pages — pages it can't reach are marked unsupported/`failed`; YouTube links receive a "coming soon" placeholder at MVP — transcript tier deferred post-dogfooding), generate a 1-2 sentence micro-description with gpt-4o-mini (few-shot house-style prompt), and write the result back to the `links` row via the service-role admin client. The inbox island updates live as status transitions and descriptions land.

This reproduces the cheap, MVP-ideal data-acquisition flow from the bot-dancer talk (`references/bot-dancer.md`), adapted to the codebase's Markdown-native, zero-HTML-parsing constraint. See `scraping-flow-comparison.md` for the talk-vs-research collision that grounds these choices.

## Current State Analysis

- **Consumer is a verified no-op** (`src/worker.ts:7-13`): iterates batch, logs, acks. `ExportedHandler<Env, QueueMessage>` already typed correctly; `msg.body` resolves to `{ type, v, linkId, userId }`.
- **DB ready**: `links` table has `micro_description` (text, nullable) and `processing_status` (text + CHECK enum, default `'pending'`). RLS scoped `auth.uid() = user_id` on all four ops. `updated_at` trigger auto-fires. Realtime publication already includes `links`.
- **Admin client exists** (`src/lib/supabase-admin.ts`): `createAdminClient()` returns service-role client or `null`. Header comment says "import ONLY from the bot webhook endpoint" — the consumer is the second legitimate importer; comment must be updated.
- **Enqueue wired at both capture paths**: `POST /api/links` and the bot webhook both call `enqueueLink(id, userId)`. Every `pending` row was enqueued at insert — no backfill needed.
- **Frontend gaps** (`useLinks.ts`, `InboxList.tsx`): subscription is INSERT-only; badge renders only `pending`; `micro_description` rendered nowhere.
- **Config**: `wrangler.jsonc` consumer is `max_batch_size: 10`, `max_batch_timeout: 30`. No `LLM_API_KEY` or `FIRECRAWL_API_KEY` in `astro.config.mjs` env schema.

## Desired End State

A user sends a link (desktop or bot). It appears in the inbox as `pending`, transitions to `processing`, then to `done` with a 1-2 sentence micro-description rendered beneath the URL — all live, no reload. Pages Firecrawl can't reach are marked unsupported (`failed` badge — the full Wayback/paid-proxy fallback flow is deferred post-MVP); YouTube links show a "coming soon" placeholder (transcript tier deferred to post-MVP). Links Firecrawl can't process show a `failed` badge and remain in the list (never lost). MVP runs at ~$0 (Firecrawl free plan 1,000 pages/month, gpt-4o-mini cents).

Verify: send an article URL, a YouTube URL, and a known-paywalled URL through the bot; watch the inbox transition each to its terminal state — article gets a description, YouTube shows a "coming soon" placeholder, paywalled is marked unsupported (`failed`) — with no manual refresh.

### Key Discoveries:

- `astro:env/server` resolves in `queue()` context — adapter patches the env getter at module load (`research.md` Gap 1). No env-resolution refactor of `supabase-admin.ts` needed. `llm-key.ts` is still created in Phase 1, but purely as the future-BYOK abstraction point (`change.md` decision) — not to make env resolve.
- Scrapers (Jina live-tested: 41k chars, no transcript; Firecrawl markdown likewise yields page chrome, not captions) return **only title + nav chrome** for YouTube — YouTube MUST branch before the page scrape.
- Queue `max_retries: 3` absorbs transient failures before status reaches `failed` — **but only if services surface transients as thrown exceptions, not `null`**. The error taxonomy is deliberate: a service returns `null` for a *definitive* no-content result (HTTP 404, empty body, no captions) and **throws** on a *transient* fault (HTTP 429/5xx, network error). The consumer maps `null` → terminal `failed` + `ack()`, and a thrown error → `msg.retry()` so `max_retries` actually fires. A null-on-everything design would make this absorption claim false (a transient 429 would terminal-fail on first hit), so the throw-vs-null split is load-bearing, not cosmetic. With it in place, manual retry is unnecessary at MVP.
- Realtime delivers service-role UPDATEs to the owning user via the subscriber's SELECT RLS policy (`lessons.md`) — no special trick beyond adding an UPDATE handler.

## What We're NOT Doing

- **No multi-tier scraping at MVP** — Firecrawl is the only page tier. The full 3-tier flow (Wayback archive fallback + paid proxy) is deferred post-MVP (roadmap §Parked); a Firecrawl miss → `failed`. No `wayback.ts` / `paid-proxy.ts` at MVP.
- **No manual retry button** and **no stale-`processing` cron reset** — deferred to a later slice; queue auto-retry covers transients.
- **No per-user style corpus / BYOK** — few-shot examples are hardcoded house style for MVP; per-user is future (`getLlmApiKey` direction).
- **No in-Worker HTML parsing** (no cheerio/jsdom/HTMLRewriter) — every tier returns Markdown/text.
- **No QueueMessage shape change**, no new migrations (schema already supports everything).
- **No language-preference ladder beyond what RapidAPI returns** — accept the transcript the API gives.
- **No YouTube transcript at MVP** — YouTube URLs get `processing_status: 'done'` with a hardcoded placeholder; `scrapeYouTubeTranscript` and `RAPIDAPI_KEY` are deferred. Provider research complete (Supadata vs TranscriptAPI.com — see `doc-youtube-transcripts.md`, `doc-transcriptapi.md`); implementation parked post-dogfooding.

## Implementation Approach

Five phases, bottom-up: config/secrets first (so later phases build green), then the leaf scraping + LLM services (pure functions, independently testable), then the consumer that orchestrates them, then the frontend that surfaces the results. Each service is a `(...)=> Promise<string | null>` so the orchestrator composes them with `??` (single Firecrawl tier at MVP; the `??` cascade returns post-MVP) and the consumer only ever sees a string or null.

## Critical Implementation Details

**LLM_API_KEY env access** — must be declared `access: "secret"` in `astro.config.mjs` (not `public`), or build-time inlining strips the runtime guard (`lessons.md`). The key is read only through `getLlmApiKey(userId)` (`src/lib/llm-key.ts`), never `env.LLM_API_KEY` directly in consumer logic (`change.md` decision).

**YouTube detection ordering** — `isYouTubeUrl()` must run before the page scrape; a scraper on a YouTube URL returns nav chrome, not transcript, so a scrape-first design would produce garbage descriptions for every video.

**Status-before-work write** — consumer sets `processing_status = 'processing'` before scraping so a Worker crash leaves a visible non-terminal state (`research.md` state machine). On total scrape/LLM failure, set `'failed'` with `micro_description` left null.

## Phase 1: Config & Key Plumbing

### Overview

Add the LLM key to the env schema and runtime config, create the key-access helper, and switch the queue consumer config to per-link processing.

### Changes Required:

#### 1. Env schema

**File**: `astro.config.mjs`

**Intent**: Declare `LLM_API_KEY` so `astro:env/server` resolves it at runtime in the queue context.

**Contract**: Add both to the `env.schema` object alongside the existing secrets:
- `LLM_API_KEY: envField.string({ context: "server", access: "secret", optional: true })`
- `FIRECRAWL_API_KEY: envField.string({ context: "server", access: "secret", optional: true })`

#### 2. Local + deploy secrets

**File**: `.dev.vars`, `.env.example`

**Intent**: Make the key available to `wrangler dev` and document it for contributors.

**Contract**: Add real values to `.dev.vars` (never `###` placeholder — wrangler treats `#` as a comment) and documented placeholder entries to `.env.example`. Production keys set via `wrangler secret put`:
- `LLM_API_KEY=<value>` — OpenAI key for Phase 3
- `FIRECRAWL_API_KEY=<fc-...value>` — Firecrawl key (free plan, obtain at firecrawl.dev/app/api-keys)

> ⚠️ **Worktree gotcha**: `.dev.vars` is gitignored, so a **git worktree does not inherit it** — it lives only in the main checkout (`/mnt/global/Projects/10x-course/.dev.vars`). When developing this change in a worktree (e.g. `.claude/worktrees/s-02`), first **copy `.dev.vars` from the main checkout into the worktree root**, then add the new keys there — otherwise `wrangler dev` (cwd = worktree root) reads no `.dev.vars` and every secret resolves `undefined`. The current `.dev.vars` does **not** yet contain `LLM_API_KEY` or `FIRECRAWL_API_KEY` — both are added in this change (Phase 1).

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

The Firecrawl page scraper, a YouTube URL detector, and a thin single-entry orchestrator. MVP is single-tier (Firecrawl only) — a page Firecrawl can't reach is marked unsupported (`failed`); the full 3-tier flow (Wayback archive + paid proxy) is deferred post-MVP (roadmap §Parked). All return Markdown/text or null.

### Changes Required:

#### 1. Firecrawl tier

**File**: `src/lib/services/firecrawl.ts` (new)

**Intent**: Primary page scraper — fetch clean Markdown for a URL via Firecrawl cloud API.

**Contract**: `scrapeFirecrawl(url: string): Promise<string | null>` — `POST https://api.firecrawl.dev/v2/scrape` with body `{ url, formats: ["markdown"] }` and header `Authorization: Bearer <FIRECRAWL_API_KEY>`. Resolves key from `astro:env/server` (`FIRECRAWL_API_KEY`); returns `null` if key unset. **Error taxonomy** (shared by all scrape/describe services, see Key Discoveries): return `null` on a *definitive* miss (HTTP 402 insufficient credits, or response `data.data.markdown` empty/null — nothing to retry); **throw** on a *transient* fault (HTTP 429/5xx or a network/`fetch` rejection) so the consumer's `msg.retry()` path engages. Return `data.data.markdown` string on success (note double nesting in Firecrawl envelope). Free plan: 1,000 pages/month, 10 RPM — sufficient for MVP dogfooding.

#### 2. YouTube URL detection

**File**: `src/lib/services/youtube.ts` (new)

**Intent**: Detect YouTube URLs so the consumer can short-circuit the scrape pipeline and write a placeholder instead.

> ℹ️ **Transcript tier deferred to post-MVP.** YouTube links receive `processing_status: 'done'` + hardcoded `micro_description: 'YouTube video — transcript coming soon.'` — no scraping, no LLM call, no external key needed. Provider research is complete (Supadata vs TranscriptAPI.com — see `doc-youtube-transcripts.md`, `doc-transcriptapi.md`); implementation parked until post-dogfooding. Tracked in roadmap §Parked.

**Contract**:

- `isYouTubeUrl(url: string): boolean` — matches `youtube.com/watch`, `youtube.com/shorts/`, and `youtu.be/` URL forms.

No `RAPIDAPI_KEY` env wiring in this phase — not needed until the transcript tier ships.

#### 3. Scrape orchestrator

**File**: `src/lib/services/scrape.ts` (new)

**Intent**: Single entry the consumer calls for page URLs. MVP is single-tier (Firecrawl only); this thin wrapper is the seam where the future multi-tier cascade plugs in without touching the consumer.

**Contract**: `scrapeContent(url: string): Promise<string | null>`. MVP logic: `return scrapeFirecrawl(url)` — a Firecrawl miss (`null`) means the page is unsupported and the consumer marks it `failed`. Post-MVP this becomes `(await scrapeFirecrawl(url)) ?? (await scrapeWayback(url)) ?? (await scrapePaidProxy(url))` (full 3-tier flow, roadmap §Parked). YouTube branch is handled in the consumer before `scrapeContent` is called (see Phase 4) — this function handles page URLs only.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `bun run build`
- Linting passes: `bun run lint`

#### Manual Verification:

- Scratch-invoke `scrapeContent()` against an article URL → non-empty Markdown; a nonexistent domain → `null`. (YouTube URLs are **not** routed through `scrapeContent` — the consumer detects them via `isYouTubeUrl()` and early-exits before the cascade, Phase 4. Verify `isYouTubeUrl()` alone returns `true` for `watch`/`shorts`/`youtu.be` forms, `false` otherwise.)

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: LLM Micro-description Service

### Overview

Turn scraped content into a 1-2 sentence micro-description via gpt-4o-mini using a few-shot house-style prompt.

### Changes Required:

#### 1. Describe service

**File**: `src/lib/services/describe.ts` (new)

**Intent**: Generate the micro-description, matching a consistent house style via few-shot examples (the talk's proven quality lever, adapted to hardcoded examples since no per-user corpus exists yet).

**Contract**: `describeContent(content: string, userId: string): Promise<string | null>`. Resolves the key via `getLlmApiKey(userId)` (returns `null` if no key). POSTs to `https://api.openai.com/v1/chat/completions` with `model: "gpt-4o-mini"`, `max_tokens: ~120`. The system/user messages embed 2-3 hardcoded example micro-descriptions as the style template, then the scraped content. **Input cap (MVP, locked):** truncate scraped content to **~6,000 characters (~1,500 tokens)** before the call — bounds per-link cost and the ~11s latency claim; revisit under the parked roadmap task below. **Few-shot examples (MVP):** ship 2-3 `TODO`-marked placeholder micro-descriptions written in-plan/in-code before Phase 3 starts — placeholder house style for MVP, deliberately not researched yet. Returns the trimmed completion text. **Error taxonomy** (same split as the scrape services): return `null` only for definitive non-retryable cases (no key from `getLlmApiKey`, or an empty/blank completion); **throw** on a transient OpenAI fault (HTTP 429/5xx, network error) so the consumer retries. Do not collapse a transient 429 into `null` — that would permanently fail a link whose content scraped fine.

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

**Post-implementation note (required)**: After this phase lands, append a short findings note to the parked roadmap task **"Micro-description prompt-quality research"** — capture first-pass conclusions: did the ~6k-char cap feel right (truncating useful content? too generous on cost?), did the placeholder few-shot examples produce a consistent style, and what to test in the dedicated research/experiment pass. This closes the loop between the MVP guess and the future tuning task.

---

## Phase 4: Queue Consumer

### Overview

Wire the consumer to orchestrate scrape → describe → write, with status transitions and per-link retry.

### Changes Required:

#### 1. Consumer body

**File**: `src/worker.ts`

**Intent**: Replace the log+ack stub with the real pipeline for one message per invocation.

**Contract**: `queue(batch)` takes `const [msg] = batch.messages` (batch size is 1). Build `createAdminClient()`; if `null`, `msg.retry()` and return. Fetch the link's `url` by `msg.body.linkId`. **YouTube early-exit:** if `isYouTubeUrl(url)`, update `{ micro_description: 'YouTube video — transcript coming soon.', processing_status: 'done' }` then `msg.ack()` and return — no scrape, no LLM, no retry path. Then for page URLs: update the link to `processing_status: 'processing'`; `content = await scrapeContent(url)`; if content, `desc = await describeContent(content, msg.body.userId)`; on success update `{ micro_description: desc, processing_status: 'done' }`. **Terminal vs retryable** (the F1 taxonomy): a `null` returned by `scrapeContent` or `describeContent` is a *definitive* miss → update `{ processing_status: 'failed' }` then `msg.ack()`. A *thrown* error from any service (transient 429/5xx/network) propagates out of the `try` → do **not** write `failed`, instead `msg.retry()` so the queue's `max_retries: 3` re-attempts; leave status at `processing` between attempts. Admin client `null` is also `msg.retry()` (infra). Wrap the pipeline so thrown errors reach `msg.retry()` rather than crashing the batch. The link's `url` is fetched via the admin client by `msg.body.linkId` (the message carries no URL). Cast Supabase reads to the `Link` type at the query boundary.

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
2. Send a YouTube URL → expect `done` with "YouTube video — transcript coming soon." placeholder, no `failed` badge.
3. Send a paywalled/blocked URL → expect `failed` (unsupported; no fallback at MVP).
4. Send a dead/nonexistent URL → expect `failed` badge, link retained.

## Performance Considerations

Per-link ~11s wall-clock, <1ms CPU (pure I/O) — safe on free and paid Workers tiers. Throughput scales via concurrent Worker invocations across messages, not batch size (`research.md` Gap 2) — but the Firecrawl free plan (10 RPM / 2 concurrent browsers) is the real burst ceiling: a large simultaneous paste can hit HTTP 429, which the error taxonomy retries (`max_retries: 3`). Acceptable at single-user MVP dogfooding volume; revisit if bursts grow. Truncate scraped content before the LLM call to bound token cost/latency.

## Migration Notes

No DB migrations. Config changes: `astro.config.mjs` env schema (`LLM_API_KEY` only — `RAPIDAPI_KEY` deferred with transcript tier), `wrangler.jsonc` consumer batch settings, `.dev.vars`/`.env.example`. Rollback = revert these files and restore the no-op `queue()` body. Re-run `bunx wrangler types` after any binding change (no new bindings here, only consumer tuning + secrets).

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

- [x] 1.1 Type checking passes (`bun run build`) — 8646130
- [x] 1.2 Linting passes (`bun run lint`) — 8646130
- [x] 1.3 `wrangler.jsonc` parses (`bunx wrangler types --check`) — 8646130

#### Manual

- [ ] 1.4 `bun run dev` boots without env errors; `getLlmApiKey` returns configured key

### Phase 2: Scraping Services

#### Automated

- [ ] 2.1 Type checking passes (`bun run build`)
- [ ] 2.2 Linting passes (`bun run lint`)

#### Manual

- [ ] 2.3 `scrapeContent()` returns Markdown for article, null for dead domain; `isYouTubeUrl()` returns true for watch/shorts/youtu.be, false otherwise

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
