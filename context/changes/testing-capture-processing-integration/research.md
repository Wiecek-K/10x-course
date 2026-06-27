---
date: 2026-06-27T06:43:36+0200
researcher: Claude (Opus 4.8)
git_commit: 90a0ff7326dc541dd76ce3c330a06c7f2b825882
branch: testing-capture-processing-integration
repository: 10x-course
topic: "Ground rollout Phase 2 (Capture + processing integration tests): risks #1, #3, #5"
tags: [research, codebase, testing, queue-consumer, webhook, enqueue, vitest]
status: complete
last_updated: 2026-06-27
last_updated_by: Claude (Opus 4.8)
---

# Research: Capture + processing integration tests (Phase 2 — risks #1, #3, #5)

**Date**: 2026-06-27T06:43:36+0200
**Researcher**: Claude (Opus 4.8)
**Git Commit**: 90a0ff7326dc541dd76ce3c330a06c7f2b825882
**Branch**: testing-capture-processing-integration
**Repository**: 10x-course

## Research Question

Ground rollout Phase 2 of `context/foundation/test-plan.md` ("Capture + processing
integration") in real code. Verify (not blindly accept) the Risk Response Guidance
for risks #1 (consumer terminal state), #3 (webhook trust boundary), #5 (enqueue
parity). For each: find the real failure path, the cheapest test layer that gives
signal, existing tests, and flag speculative risks / misleading hot-spot evidence.

## Summary

All three risks are **integration-testable in the existing Vitest node environment**
using the established `vi.mock` pattern from `src/lib/services/firecrawl.test.ts`.
**`@cloudflare/vitest-pool-workers` is NOT required** — every Worker binding is reached
through a mockable virtual-module import (`astro:env/server`, `cloudflare:workers`),
not through `context.locals.runtime.env`. The §4 "candidate: vitest-pool-workers"
note should be downgraded.

Key correction to the risk map: **two of the three risks describe safeguards that
already exist** (webhook user_id provenance #3, enqueue parity #5) — their tests are
**regression guards**, not bug hunts. The one risk with a **real, live gap** is #1:
a transient-error path that exhausts retries leaves a row **permanently stuck in
`scraping`/`describing`** because nothing writes `failed` on retry-exhaustion and
there is no DLQ consumer / reaper. The §2 #1 "must challenge" framing (`ack()` after
a failed terminal write) points at the wrong seam — that path is correct; the stuck
state comes from the throw→retry→DLQ path that writes no terminal status.

## Detailed Findings

### Risk #1 — Consumer state machine + retry taxonomy

**Status enum** (`src/types.ts:20`):
```ts
export type ProcessingStatus = "pending" | "scraping" | "describing" | "done" | "failed";
```
- Intermediate: `scraping`, `describing`. Terminal: `done`, `failed`. `pending` set at insert; the consumer never writes it.
- `QueueMessage` (`src/types.ts:13-18`): `{ type: "describe"; v: 1; linkId; userId }`.

**Transitions in `src/worker.ts` queue handler** (writes via RLS-bypassing `createAdminClient()`):
- Lookup: `worker.ts:24-28` (select url); `lookupError` → `msg.retry()` (`:32`); missing row → `msg.ack()` (`:38`).
- YouTube branch → `done` directly (`:55-57`), never touches `scraping`/`describing`; null oEmbed → `youtube_oembed_miss` log + fallback string, still `done`.
- → `scraping` (`:60`, before try) → scrape `null` → `failed` + `msg.ack()` (`:64-67`).
- → `describing` (`:70`) → describe `null` → `failed` + `msg.ack()` (`:73-76`).
- full success → `done` + `msg.ack()` (`:79-83`).
- `catch` → `msg.retry()` (`:84-88`) — **no status write**.

**Null-vs-throw contract** — decided in the vendor layer, mapped by the consumer:
- `firecrawl.ts:32-40`: `402 → null` (definitive miss, no retry); `429 || >=500 → throw` (transient); other `!ok → null`; network error wrapped+thrown (`:28-30`).
- `describe.ts:72-76` same shape; malformed model JSON `JSON.parse` throws (`describe.ts:83`, covered by `describe.test.ts:90`) → becomes a transient retry even though arguably deterministic.
- Consumer: `null` → `failed`+`ack`; any throw → `retry()` catch-all.

**Queue config** (`wrangler.jsonc:17-25`): `max_batch_size: 1`, `max_retries: 3`, `retry_delay: 300`, DLQ `tabzero-link-processing-dlq`.

**ack-after-failed is CORRECT** (both `failed` writes immediately `ack()`). There is **no explicit branch** that writes an intermediate status and then `ack()`s — so "acked while intermediate" is not reachable through normal control flow.

**The real, testable stuck-state bug**: a thrown (transient) error makes the catch call `msg.retry()` with **no status write**, so the row stays `scraping`/`describing` for the whole retry window. After 3 retries the message lands in the **DLQ and nothing ever writes `failed`** — the row is stuck forever. There is **no DLQ consumer, no reaper, no timeout sweep** anywhere in the repo to recover it.

**YouTube placeholder** (`worker.ts:52-54`): success `▶ {title} — {channel} · transcript coming soon`; no-metadata fallback verbatim: `YouTube video — transcript coming soon.`

**Latent batch-drop bug** (`worker.ts:12`): `const [msg] = batch.messages` processes only the first message. Safe today (`max_batch_size: 1`); would silently drop messages 2..N if batch size were raised. Config-guarded, not code-guarded.

### Risk #3 — Webhook trust boundary

- **Secret check** (`webhook.ts:19-24`): constant-time `constantTimeEqual` (`telegram.ts:18-27`) on header `X-Telegram-Bot-Api-Secret-Token`; forged/missing → **401**; **fails closed** when `TELEGRAM_WEBHOOK_SECRET` unset (`!expectedSecret` → 401). VERIFIED per the webhook lesson.
- **200 on every authentic dead-end** (`:30,:35,:41,:48,:74,:79,:92,:120,:126`), including DB insert failure (`:139`) — deliberate anti-redelivery.
- **user_id provenance** (`webhook.ts:105-131`): resolved from a trusted `telegram_links` lookup keyed on `telegram_id` (`:105-109`), insert uses `link.user_id` (`:129-131`). The payload type `TelegramUpdate` (`:10-16`) **does not even model a `user_id` field**. `telegramId` from `message.from.id` is only a lookup key behind the secret gate. Pairing path uses `code.user_id` from a single-use, session-bound token (`pairing.ts:19-31`, consumed `webhook.ts:61-68`). **No path lets the payload set `user_id`.**
- **Admin surface** (`supabase-admin.ts:8-18`): reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, returns `null` if missing. Webhook writes through it: `pairing_codes` UPDATE, `telegram_links` upsert/select, `links` INSERT (`:129-131`).
- **No existing tests** for this endpoint.

### Risk #5 — Enqueue parity

- `enqueueLink` (`queue.ts:1-6`): reads `env` from `cloudflare:workers`, calls `env.LINK_QUEUE.send({ type:"describe", v:1, linkId, userId })`.
- **Both** capture paths enqueue after insert: `POST /api/links` (`index.ts:30-47`) and bot webhook (`webhook.ts:129-147`). Both wrap enqueue in try/catch (non-fatal).
- **No insert-without-enqueue path exists.** Only three handlers touch `links`: `links/index.ts` (POST inserts+enqueues, GET selects), `webhook.ts` (inserts+enqueues), `worker.ts` (update/select only, never inserts). No `src/pages/api/links/[id].ts`.
- Observable assertion: mock `cloudflare:workers` → assert `LINK_QUEUE.send` spy called with the right payload (stronger than mocking `enqueueLink` itself).

### Test infrastructure (stack)

- `vitest.config.ts`: `environment: "node"`, `include: ["src/**/*.test.ts"]`, `@` alias. No globals, no setup files, no pool. **`@cloudflare/vitest-pool-workers` NOT installed** (`package.json` has only `vitest ^4`, `wrangler ^4.90`).
- Established mock style (`firecrawl.test.ts:4-33`): `vi.mock("astro:env/server", …)` with getters for mutable values; `vi.stubGlobal("fetch", …)`; teardown `vi.unstubAllGlobals()`; mock declared before SUT import (hoist-safe).
- **Verdict per target — node + vi.mock is sufficient for all:**
  - **API handlers** (`POST /api/links`, bot `webhook`): plain `APIRoute(context)` functions; build a fake `context` with `new Request(...)`; mock `astro:env/server`, `createAdminClient`, and `cloudflare:workers` (`LINK_QUEUE.send` spy). No `MessageBatch`, no `runtime.env`.
  - **Queue consumer** (`worker.ts` `queue()`): hand-roll `batch = { messages:[{ body, ack: vi.fn(), retry: vi.fn() }] }`, call the handler directly; assert ordered `admin.from("links").update(...)` calls + which of `ack`/`retry` fired. **Caveat**: `worker.ts:1` imports `@astrojs/cloudflare/handler` at top level — either `vi.mock("@astrojs/cloudflare/handler", …)` or refactor the `queue` handler into its own importable module (e.g. `src/lib/queue-consumer.ts`) so the test imports only the consumer.

## Code References

- `src/types.ts:13-20` — `QueueMessage`, `ProcessingStatus`
- `src/worker.ts:8-90` — queue consumer state machine, ack/retry, YouTube fallback
- `src/lib/services/firecrawl.ts:28-40`, `describe.ts:68-83` — null-vs-throw taxonomy
- `wrangler.jsonc:17-25` — queue retries + DLQ
- `src/pages/api/bot/webhook.ts:19-24,105-147` — secret check, user_id resolution, insert+enqueue
- `src/lib/telegram.ts:7,18-27` — `sendMessage` (real fetch), `constantTimeEqual`
- `src/pages/api/pairing.ts:19-31` — session-bound token mint
- `src/lib/supabase-admin.ts:5-18` — service-role client surface
- `src/lib/queue.ts:1-6` — `enqueueLink`
- `src/pages/api/links/index.ts:30-47` — canonical insert+enqueue
- `vitest.config.ts`, `src/lib/services/firecrawl.test.ts:4-33` — runner + mock pattern

## Architecture Insights

- The whole capture→process pipeline reaches its bindings through **virtual module imports**, not the Astro `runtime` locals. This is what makes the cheap node+`vi.mock` strategy viable and removes any need for a workerd test pool.
- The service layer owns the **retry taxonomy** (null vs throw); the consumer is a thin mapper. Tests should assert the taxonomy at the vendor seam (already done in unit tests) AND the consumer's mapping of it to status+ack/retry (the new integration layer).
- Service-role path **bypasses RLS by design** — so the app-level `user_id` derivation is the only safeguard for #3. Testing "RLS blocks cross-user" here would test the vendor and is moot (RLS isn't in effect on the admin client).

## Historical Context (from prior changes)

- `context/foundation/lessons.md` — "Sessionless writes" (service-role, user_id from trusted mapping never payload), "Webhook 401 forged / 200 authentic", "A write path that bypasses the canonical endpoint also bypasses its side effects" (the origin of Risk #5), "Astro server env vars must use access: secret". All three risks trace directly to these lessons.
- `context/archive/2026-06-15-testing-pipeline-units/plan.md` — Phase 1; established the Vitest node + `vi.mock("astro:env/server")` + `vi.stubGlobal("fetch")` pattern this phase reuses.

## Open Questions

1. **Refactor `worker.ts` queue handler into its own module?** Cleanest way to dodge the top-level `@astrojs/cloudflare/handler` import in the consumer test. Decide in planning: mock the handler import vs. extract `src/lib/queue-consumer.ts`. (Extraction also improves testability long-term.)
2. **Does Phase 2 scope include the stuck-state GAP, or only assert current behavior?** The test can prove `null → failed + ack` (exists) but cannot prove "transient-exhaust → failed" (does not exist — no reaper). Recommend: test documents the current behavior and flags the gap; building a DLQ consumer/reaper is a separate feature change, not a test.

## Speculative-risk flags (verified against code)

- **#3 "trusts inbound payload for user_id" / "forged webhook accepted" — DO NOT EXIST.** Both safeguards are in place. Tests are **regression guards**, not vulnerability fixes. Do not write tests asserting the Supabase RLS engine works (vendor; path bypasses RLS anyway).
- **#5 insert-without-enqueue path — DOES NOT EXIST today.** Both paths are at parity. Test is a **regression guard** against a future capture path or a dropped enqueue line.
- **#1 "stuck forever → terminal failed" self-heal — DOES NOT EXIST.** No DLQ consumer/reaper. Integration test can assert the `null → failed` branch and document the transient-exhaust gap; it cannot assert recovery without first building it.
- **#1 batch-drop** (`worker.ts:12`) is config-guarded (`max_batch_size: 1`); a multi-message test would fail against current code — out of scope.
