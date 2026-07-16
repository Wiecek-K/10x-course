# Capture + Processing Integration Tests Implementation Plan

## Overview

Build the Phase 2 integration test layer for the capture → processing pipeline,
covering three risks from `context/foundation/test-plan.md`: consumer terminal
state (#1), webhook trust boundary (#3), and enqueue parity (#5). Vendors are
mocked at the HTTP edge; the Supabase admin client is mocked with a hand-rolled
chainable query-builder fake carrying spies. A small refactor extracts the queue
consumer into its own importable module so the consumer test never pulls in the
Astro Cloudflare handler.

## Current State Analysis

- The queue consumer lives inside `src/worker.ts` (`queue()` handler, `worker.ts:8-90`)
  alongside a top-level `import` of `@astrojs/cloudflare/handler` (`worker.ts:1`).
  Importing the consumer for a test therefore drags in the full Astro SSR
  entrypoint — undesirable in a node test.
- The consumer is a thin mapper over the vendor layer's null-vs-throw contract:
  `null` (definitive miss) → `failed` + `ack()`; any `throw` (transient) →
  `retry()` via the catch-all, **with no status write** (`worker.ts:84-88`).
- Status enum (`src/types.ts:20`): `pending | scraping | describing | done | failed`.
  Intermediate: `scraping`, `describing`. Terminal: `done`, `failed`.
- Webhook (`src/pages/api/bot/webhook.ts`): constant-time secret check
  (`:19-24`, fails closed when secret unset); `user_id` resolved only from a
  trusted `telegram_links` lookup (`:105-131`); payload type `TelegramUpdate`
  (`:10-16`) has no `user_id` field. No existing tests.
- Enqueue parity: both `POST /api/links` (`index.ts:30-47`) and the bot webhook
  (`webhook.ts:129-147`) insert-then-enqueue via `enqueueLink` (`queue.ts:1-6`),
  which reads `env` from `cloudflare:workers` and calls `env.LINK_QUEUE.send(...)`.
- Test runner: Vitest 4.x, `environment: "node"`, colocated `src/**/*.test.ts`,
  `@` alias. Established mock pattern in `src/lib/services/firecrawl.test.ts:4-33`
  (`vi.mock("astro:env/server", …)` with getters, `vi.stubGlobal("fetch", …)`,
  `vi.unstubAllGlobals()` teardown). `@cloudflare/vitest-pool-workers` not
  installed and not needed.

### Key Discoveries:

- **The real live gap (research 2026-06-27)**: a transient `throw` → `retry()`
  writes no status; after `max_retries: 3` (`wrangler.jsonc:17-25`) the message
  lands in the DLQ and **nothing ever writes `failed`** — the row is stuck in
  `scraping`/`describing` forever. There is **no DLQ consumer / reaper**. This is
  documented, not fixed, in this phase (per decision below).
- **ack-after-failed is correct** — do not challenge it. Both `failed` writes
  immediately `ack()` (`worker.ts:64-67`, `:73-76`).
- **#3 and #5 are regression guards**, not bug hunts — both safeguards already
  hold. Tests protect against future erosion.
- The whole pipeline reaches its bindings through **virtual-module imports**
  (`astro:env/server`, `cloudflare:workers`), not Astro `runtime` locals — which
  is why node + `vi.mock` is sufficient.

## Desired End State

A committed integration test suite that runs green under `bun run test`:

- `src/lib/queue-consumer.ts` exists and owns the queue state machine; `worker.ts`
  re-exports it; `bun run build` still succeeds (Worker entrypoint unchanged in
  behavior).
- `src/lib/queue-consumer.test.ts` asserts every existing consumer branch and
  flags the transient-exhaust stuck-state gap in a comment.
- `src/pages/api/bot/webhook.test.ts` asserts the forged-vs-authentic secret
  gate and `user_id` provenance.
- `src/pages/api/links/index.test.ts` (and the webhook test) assert
  `LINK_QUEUE.send` fired with the correct payload after insert.
- `context/foundation/test-plan.md` §6.2 and §6.5 cookbook sections are filled
  in; Phase 2 status is `complete`.

Verify: `bun run test` green, `bun run lint` clean, `bun run build` succeeds,
`bun run format:check` clean.

## What We're NOT Doing

- **Not building a DLQ consumer / reaper / timeout sweep.** The stuck-state gap
  is documented, not closed — that is a separate feature change.
- **Not testing self-heal of the transient-exhaust path** — no recovery code
  exists to test.
- **Not writing a multi-message-batch test** — `max_batch_size: 1` config-guards
  the latent batch-drop at `worker.ts:12`; such a test would fail against current
  code and is out of scope.
- **Not testing vendor internals** — that Firecrawl scrapes, Supabase RLS
  filters, CF Queues deliver, Telegram sends. Mock the seam we own.
- **Not asserting exact LLM output text** — assert structure / fallback marker.
- **Not testing UI components or auth handlers** — auth is Phase 3.
- **Not changing any production behavior.** The only prod-code change is a
  behavior-preserving module extraction (Phase 1).

## Implementation Approach

Reuse the Phase 1 mock pattern (`firecrawl.test.ts`) at three seams per test:
HTTP (`vi.stubGlobal("fetch")`), env (`vi.mock("astro:env/server")`), and — new
for this phase — the Supabase admin client and `cloudflare:workers`.

The Supabase admin client is mocked with a **hand-rolled chainable query-builder
fake**: `createAdminClient` returns an object whose `from()` yields a chainable
with `update`/`insert`/`select`/`eq`/`single` as spies. This is the only fake
that lets the consumer test assert the **ordered sequence** of status writes
(`scraping` → `describing` → `done`), which is the core signal for risk #1.

Phase 1 (extraction) is a prerequisite for Phase 2's consumer test and lands as
its own atomic, behavior-preserving commit. Phases 2–4 are ordered by risk
priority (#1 High×High first). Phase 5 backfills the cookbook.

## Critical Implementation Details

- **Mock hoisting**: `vi.mock` factories are hoisted above imports; declare every
  virtual-module mock (`astro:env/server`, `cloudflare:workers`, the admin
  client) before the SUT import, mirroring `firecrawl.test.ts:4-33`.
- **Ordered-update assertion**: the chainable fake must record call order across
  `from("links").update(...)` invocations so the test can assert
  `scraping` → `describing` → `done`. A single `update` spy plus argument capture
  is enough; reset it in `beforeEach`.
- **Consumer test seam**: after Phase 1, the consumer test imports only
  `@/lib/queue-consumer` — it must NOT import `@/worker` (which still pulls the
  handler).

## Phase 1: Extract queue consumer module

### Overview

Move the `queue()` handler logic out of `src/worker.ts` into a new importable
module `src/lib/queue-consumer.ts`, leaving `worker.ts` as a thin entrypoint that
re-exports it alongside the Astro fetch handler. Pure refactor — no behavior
change.

### Changes Required:

#### 1. New consumer module

**File**: `src/lib/queue-consumer.ts`

**Intent**: Hold the full queue state machine (batch message handling, status
transitions, ack/retry, YouTube branch, null-vs-throw mapping) as an exported
function the Worker entrypoint and tests can both import.

**Contract**: Export a function with the same signature the Worker `queue`
handler uses — `(batch: MessageBatch<QueueMessage>, env?) ` consistent with how
`worker.ts` currently invokes it. All imports it needs (`createAdminClient`,
the vendor services, `cloudflare:workers` for any env access) move with it. No
`@astrojs/cloudflare/handler` import in this module.

#### 2. Thin Worker entrypoint

**File**: `src/worker.ts`

**Intent**: Reduce to the Astro fetch handler plus a re-export of the extracted
`queue` consumer, preserving the default-export shape Cloudflare expects.

**Contract**: `export default { fetch: <astro handler fetch>, queue: <imported consumer> }`.
The exported `queue` must be behaviorally identical to the pre-refactor handler.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `bun run lint`
- [ ] Production build succeeds: `bun run build`
- [ ] Existing unit suite still green: `bun run test`
- [ ] Format clean: `bun run format:check`

#### Manual Verification:

- [ ] `worker.ts` default export still exposes both `fetch` and `queue`
- [ ] No behavioral diff in the consumer (transitions, ack/retry, YouTube branch
      unchanged by inspection)

**Implementation Note**: After completing this phase and all automated
verification passes, pause for human confirmation before proceeding.

---

## Phase 2: Consumer integration tests (#1)

### Overview

Assert every existing branch of the consumer state machine against mocked vendors
and a chainable admin-client fake, and flag the transient-exhaust stuck-state gap.

### Changes Required:

#### 1. Consumer test

**File**: `src/lib/queue-consumer.test.ts`

**Intent**: Drive the extracted consumer with a hand-rolled `batch`
(`{ messages: [{ body, ack: vi.fn(), retry: vi.fn() }] }`) across each branch and
assert the resulting status writes and ack/retry calls.

**Contract**: Cases to cover —
- Full success → ordered updates `scraping` → `describing` → `done`, then `ack()`.
- Scrape definitive miss (vendor `null`) → `failed` + `ack()`, no `describing`.
- Describe definitive miss (vendor `null`) → `scraping` then `failed` + `ack()`.
- Transient throw (vendor throws) → `retry()` called, **no terminal status write**
  — assert the missing write explicitly (this is the documented gap's observable).
- YouTube branch → `done` directly with placeholder; no-metadata fallback string
  verbatim `YouTube video — transcript coming soon.`; never touches
  `scraping`/`describing`.
- Missing row (lookup returns no row) → `ack()` without status write.
- Lookup error → `retry()`.

Mock seams: `vi.mock("astro:env/server")`, `vi.stubGlobal("fetch")` (or mock the
vendor services' fetch), and a `createAdminClient` fake returning a chainable
query builder whose `update` spy records call order. A flagged comment documents
the transient-exhaust → DLQ → stuck-forever gap (no reaper).

### Success Criteria:

#### Automated Verification:

- [ ] Consumer test passes: `bun run test`
- [ ] Lint clean: `bun run lint`
- [ ] Format clean: `bun run format:check`

#### Manual Verification:

- [ ] Test asserts ordered status writes (`scraping`→`describing`→`done`), not
      just final state
- [ ] Stuck-state gap is documented as a comment in the test and a note in this
      plan's References

**Implementation Note**: Pause for human confirmation after automated
verification passes before proceeding.

---

## Phase 3: Webhook trust boundary tests (#3)

### Overview

Regression-guard the bot webhook's secret gate and `user_id` provenance.

### Changes Required:

#### 1. Webhook test

**File**: `src/pages/api/bot/webhook.test.ts`

**Intent**: Call the `POST` `APIRoute` with a hand-built `context`
(`new Request(...)` carrying the `X-Telegram-Bot-Api-Secret-Token` header) and
assert the trust boundary.

**Contract**: Cases —
- Forged / missing secret → `401`.
- `TELEGRAM_WEBHOOK_SECRET` unset → `401` (fails closed).
- Authentic secret + known `telegram_id` → insert uses `link.user_id` from the
  `telegram_links` lookup; assert the inserted `user_id` is the mapped one and
  cannot be set by the payload (payload carries no `user_id`).

Mock seams: `vi.mock("astro:env/server")` (secret + Supabase env),
`createAdminClient` chainable fake (`telegram_links` select returns a mapped
`user_id`; `links` insert spy), `vi.mock` for `telegram.sendMessage` (no real
fetch), and `cloudflare:workers` (`LINK_QUEUE.send` spy — reused in Phase 4).

### Success Criteria:

#### Automated Verification:

- [ ] Webhook test passes: `bun run test`
- [ ] Lint clean: `bun run lint`
- [ ] Format clean: `bun run format:check`

#### Manual Verification:

- [ ] Forged-secret case asserts `401` before any DB call
- [ ] Inserted `user_id` provably comes from the trusted lookup, not the request
      body

**Implementation Note**: Pause for human confirmation after automated
verification passes before proceeding.

---

## Phase 4: Enqueue parity tests (#5)

### Overview

Regression-guard that every capture path enqueues after insert.

### Changes Required:

#### 1. Links API enqueue test

**File**: `src/pages/api/links/index.test.ts`

**Intent**: Call `POST /api/links` with an authenticated `context` and assert the
queue send fires after a successful insert.

**Contract**: Assert `LINK_QUEUE.send` spy called once with
`{ type: "describe", v: 1, linkId, userId }` after insert. Mock `cloudflare:workers`
(the spy), `astro:env/server`, and the Supabase client used by the route
(`context.locals` / admin fake as the route requires). Assert via the
`LINK_QUEUE.send` spy, not by mocking `enqueueLink` itself (stronger signal).

#### 2. Webhook enqueue assertion

**File**: `src/pages/api/bot/webhook.test.ts` (extend Phase 3 file)

**Intent**: Add a case asserting the bot path also enqueues after insert.

**Contract**: In the authentic-secret success case, assert `LINK_QUEUE.send`
fired with the same payload shape keyed to the inserted link.

### Success Criteria:

#### Automated Verification:

- [ ] Enqueue tests pass: `bun run test`
- [ ] Lint clean: `bun run lint`
- [ ] Format clean: `bun run format:check`

#### Manual Verification:

- [ ] Both capture paths (`POST /api/links` and bot webhook) assert enqueue
- [ ] Payload shape matches `{type:"describe",v:1,linkId,userId}`

**Implementation Note**: Pause for human confirmation after automated
verification passes before proceeding.

---

## Phase 5: Cookbook + test-plan update

### Overview

Backfill the test-plan cookbook with the patterns this phase established and mark
Phase 2 complete.

### Changes Required:

#### 1. Cookbook sections

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the `TBD` placeholders in §6.2 (integration test) and §6.5
(queue consumer test) with the concrete patterns used here; mark §3 Phase 2
`complete` and refresh §8 freshness ledger.

**Contract**: §6.2 documents the API-handler integration pattern (fake `context`,
mock `astro:env/server` + admin client + `cloudflare:workers`, `LINK_QUEUE.send`
spy). §6.5 documents the consumer pattern (hand-rolled `batch` with `ack`/`retry`
spies, chainable admin fake, ordered-update assertion, null-vs-throw mapping).
§3 Phase 2 Status → `complete`. §8 dates → today.

### Success Criteria:

#### Automated Verification:

- [ ] Format clean: `bun run format:check`

#### Manual Verification:

- [ ] §6.2 and §6.5 no longer read `TBD`
- [ ] §3 Phase 2 Status is `complete`

**Implementation Note**: Pause for human confirmation after automated
verification passes.

---

## Testing Strategy

### Unit Tests:

- N/A new — this phase is integration-level. Existing unit suite (Phase 1
  rollout) must stay green throughout.

### Integration Tests:

- Consumer state machine: ordered status writes + ack/retry per branch.
- Webhook trust boundary: forged vs authentic, `user_id` provenance.
- Enqueue parity: `LINK_QUEUE.send` spy fired for both capture paths.

### Manual Testing Steps:

1. Run `bun run test` — full suite green.
2. Run `bun run build` — Worker entrypoint builds after the extraction.
3. Inspect the consumer test's gap comment and confirm it matches the documented
   transient-exhaust behavior.

## Performance Considerations

None — test-only plus a behavior-preserving refactor.

## Migration Notes

The Phase 1 extraction changes the Worker entrypoint's internal structure only.
The default-export shape (`{ fetch, queue }`) is preserved, so no deployment or
wrangler config change is required.

## References

- Research: `context/changes/testing-capture-processing-integration/research.md`
- Test plan: `context/foundation/test-plan.md` (§2 risks #1/#3/#5, §4 stack, §6 cookbook)
- Mock pattern: `src/lib/services/firecrawl.test.ts:4-33`
- Consumer: `src/worker.ts:8-90`; status enum `src/types.ts:13-20`
- Webhook: `src/pages/api/bot/webhook.ts:19-24,105-147`
- Enqueue: `src/lib/queue.ts:1-6`; `src/pages/api/links/index.ts:30-47`
- **Documented gap**: transient throw → `retry()` writes no status; after
  `max_retries: 3` (`wrangler.jsonc:17-25`) message hits DLQ and nothing writes
  `failed` → row stuck forever. No DLQ consumer / reaper exists. Closing it is a
  separate feature change, not this phase.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Extract queue consumer module

#### Automated

- [x] 1.1 Type checking passes: `bun run lint` — 9319c68
- [x] 1.2 Production build succeeds: `bun run build` — 9319c68
- [x] 1.3 Existing unit suite still green: `bun run test` — 9319c68
- [x] 1.4 Format clean: `bun run format:check` — 9319c68

#### Manual

- [x] 1.5 `worker.ts` default export still exposes both `fetch` and `queue` — 9319c68
- [x] 1.6 No behavioral diff in the consumer — 9319c68

### Phase 2: Consumer integration tests (#1)

#### Automated

- [x] 2.1 Consumer test passes: `bun run test` — 617beb4
- [x] 2.2 Lint clean: `bun run lint` — 617beb4
- [x] 2.3 Format clean: `bun run format:check` — 617beb4

#### Manual

- [x] 2.4 Test asserts ordered status writes, not just final state — 617beb4
- [x] 2.5 Stuck-state gap documented in test comment + plan References — 617beb4

### Phase 3: Webhook trust boundary tests (#3)

#### Automated

- [x] 3.1 Webhook test passes: `bun run test` — ff2b81c
- [x] 3.2 Lint clean: `bun run lint` — ff2b81c
- [x] 3.3 Format clean: `bun run format:check` — ff2b81c

#### Manual

- [x] 3.4 Forged-secret case asserts 401 before any DB call — ff2b81c
- [x] 3.5 Inserted `user_id` provably from trusted lookup, not request body — ff2b81c

### Phase 4: Enqueue parity tests (#5)

#### Automated

- [x] 4.1 Enqueue tests pass: `bun run test` — 951cfee
- [x] 4.2 Lint clean: `bun run lint` — 951cfee
- [x] 4.3 Format clean: `bun run format:check` — 951cfee

#### Manual

- [x] 4.4 Both capture paths assert enqueue — 951cfee
- [x] 4.5 Payload shape matches `{type:"describe",v:1,linkId,userId}` — 951cfee

### Phase 5: Cookbook + test-plan update

#### Automated

- [x] 5.1 Format clean: `bun run format:check`

#### Manual

- [x] 5.2 §6.2 and §6.5 no longer read `TBD`
- [x] 5.3 §3 Phase 2 Status is `complete`
