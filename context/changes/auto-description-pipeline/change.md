---
change_id: auto-description-pipeline
title: Auto-description pipeline for saved links
status: impl_reviewed
created: 2026-06-07
updated: 2026-06-09

archived_at: null
---

## Notes

### Decision: LLM API key storage (2026-06-07)

**MVP: global ops-key** — single `LLM_API_KEY` Cloudflare secret, set via `wrangler secret put`. No user settings table, no UI. Sufficient for internal testers only.

**Future migration path: per-user BYOK** — abstraction layer is the key. Consumer must call `getLlmApiKey(userId)` helper (in `src/lib/llm-key.ts`) rather than reading `env.LLM_API_KEY` directly. MVP implementation of that helper returns the global key; future implementation reads from `user_settings` table with fallback to env. Migration cost stays in one function + new schema + settings UI.

**Implementation rule**: never reference `env.LLM_API_KEY` directly in consumer logic — always go through `getLlmApiKey(userId)`.

---

### Research gaps — unresolved before planning (2026-06-07)

#### Gap 1: `astro:env/server` in queue consumer context — RESOLVED, NOT A BLOCKER

`@astrojs/cloudflare/handler` calls `setGetEnv(createGetEnv(globalEnv))` at module-level (line 19 of `handler.js`) using the CF Workers global `env` from `cloudflare:workers`. Because `src/worker.ts` imports `@astrojs/cloudflare/handler`, this patch fires at Worker startup — before any `fetch()` or `queue()` call. All `astro:env/server` imports (including `supabase-admin.ts`) resolve correctly from queue context. No refactor needed. `getLlmApiKey()` in `src/lib/llm-key.ts` can also use `astro:env/server`. See `research.md` follow-up section 2026-06-07T12:07.

#### Gap 2: Consumer execution time + batch size — RESOLVED, LOCKED

**Decision: `max_batch_size: 1`, `max_batch_timeout: 5`** (change from 10/30 in `wrangler.jsonc`).

**Rationale:**
- All processing is I/O-bound (Jina fetch ~8s + LLM call ~3s ≈ 11s wall-clock, <1ms CPU). CPU time is what CF charges against limits (10ms free, 30s paid) — so the architecture is safe on both tiers.
- Serial batch=10 hits ~110s wall-clock — fails regardless of plan.
- `Promise.all` batch=10 fixes wall-clock (~11s) but gives per-batch retry granularity: one failed link retries all 10. More complex error handling, no benefit at MVP scale.
- `max_batch_size: 1` gives per-link retry granularity (the natural unit of work), simplest consumer implementation, and CF handles throughput by invoking the handler concurrently across separate Worker instances for different messages.
- `max_batch_timeout: 5` (down from 30) — with batch=1, CF delivers as soon as 1 message arrives; 5s timeout is cleaner than 30s for a batch that fills immediately.

**Implementation rule**: consumer processes exactly one `QueueMessage` per invocation; no batching logic needed.

#### Gap 3: HTML stripping without Node.js (Wayback Machine fallback) — RESOLVED, NOT NEEDED

**Decision: every scraping tier returns Markdown/text natively. No in-Worker HTML parsing at any tier.**

**MVP scope (2026-06-08): single tier — Firecrawl only.** A Firecrawl miss marks the page unsupported (`failed`); no fallback. The full multi-tier flow is deferred post-MVP (roadmap §Parked) so dogfooding reveals what Firecrawl actually misses before fallback code is written.

- **MVP — Tier 1:** Firecrawl `POST /v2/scrape` `{ formats: ["markdown"] }` → Markdown at `data.data.markdown`
- **Deferred — Tier 2 (Wayback):** `https://r.jina.ai/<wayback-snapshot-url>` + `X-Remove-Selector: #wm-ipp-base` header → Markdown (keyless Jina sub-call, no Firecrawl credit)
- **Deferred — Tier 3:** paid proxy (vendor TBD post-dogfooding)
- **YouTube:** detected via `isYouTubeUrl()`, short-circuited to placeholder — transcript tier deferred post-MVP (roadmap §Parked)

**Why the deferred Wayback tier works (kept for the future build):** Wayback snapshot URL passed to Jina — Jina fetches the static archive HTML, runs Readability, and returns clean content. The Wayback toolbar (`div#wm-ipp-base`) is low-density nav content excluded by Readability. `X-Remove-Selector: #wm-ipp-base` header provides deterministic removal before Readability runs. Wayback is static HTML (no JS, no paywall, no bot detection) — Jina performs *better* on it than on the original dynamic page.

**HTMLRewriter and regex rejected:** zero in-Worker parsing code needed. HTMLRewriter noted as available CF-native API for future use if a raw-HTML tier is ever added.

**Implementation rule:** every scraping tier must return a string (Markdown or plain text) to the caller. The consumer never parses HTML.
