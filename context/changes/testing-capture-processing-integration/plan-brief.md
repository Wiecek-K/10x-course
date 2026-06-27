# Capture + Processing Integration Tests — Plan Brief

> Full plan: `context/changes/testing-capture-processing-integration/plan.md`
> Research: `context/changes/testing-capture-processing-integration/research.md`

## What & Why

Stand up the Phase 2 integration test layer for the capture → processing
pipeline, covering three test-plan risks: consumer terminal state (#1), webhook
trust boundary (#3), and enqueue parity (#5). #1 protects against links stuck
forever in an intermediate state; #3 and #5 are regression guards on safeguards
that already hold.

## Starting Point

The queue consumer lives inside `src/worker.ts` next to a top-level
`@astrojs/cloudflare/handler` import that makes it awkward to test in isolation.
The vendor layer already owns the null-vs-throw retry contract; the consumer is a
thin mapper. No tests exist for the consumer, the bot webhook, or enqueue parity.
Runner is Vitest (node env) with the `vi.mock` pattern from Phase 1.

## Desired End State

A committed integration suite runs green under `bun run test`: the consumer state
machine is extracted to its own module and fully branch-tested (with the
stuck-state gap flagged), the webhook's secret gate and `user_id` provenance are
guarded, and both capture paths are proven to enqueue. The test-plan cookbook is
backfilled and Phase 2 is marked complete.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Test runner / stack | Vitest node + `vi.mock`, no pool-workers | All bindings reached via mockable virtual-module imports | Research |
| Consumer test seam | Extract `src/lib/queue-consumer.ts` | Test imports only the consumer; better long-term testability | Plan |
| Stuck-state gap scope | Test current behavior, document the gap | Honest test that can't fake self-heal; reaper is a separate feature | Plan |
| Supabase mock | Hand-rolled chainable query-builder fake with spies | Only this lets the test assert ordered status writes (core #1 signal) | Plan |
| Enqueue assertion | Spy on `LINK_QUEUE.send` via `vi.mock("cloudflare:workers")` | Stronger than mocking `enqueueLink` itself | Research |

## Scope

**In scope:**

- Extract queue consumer into `src/lib/queue-consumer.ts` (behavior-preserving)
- Consumer integration tests (all existing branches + gap flag)
- Webhook trust-boundary tests (forged secret, `user_id` provenance)
- Enqueue parity tests (both capture paths)
- Cookbook §6.2 / §6.5 backfill; mark Phase 2 complete

**Out of scope:**

- Building a DLQ consumer / reaper / timeout sweep (separate feature change)
- Multi-message-batch test (config-guarded by `max_batch_size: 1`)
- Vendor internals, exact LLM text, UI components, auth handlers (Phase 3)
- Any production behavior change beyond the module extraction

## Architecture / Approach

Reuse the Phase 1 three-seam mock pattern (HTTP via `vi.stubGlobal("fetch")`, env
via `vi.mock("astro:env/server")`) and add two new seams: the Supabase admin
client (chainable fake whose `update` spy records call order) and
`cloudflare:workers` (`LINK_QUEUE.send` spy). The consumer extraction lets its
test import only `@/lib/queue-consumer`, never the Astro handler. API-handler
tests build a fake `context` with `new Request(...)` and call the route function
directly.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Extract consumer | `src/lib/queue-consumer.ts` + thin `worker.ts` | Behavioral drift during extraction |
| 2. Consumer tests (#1) | Branch coverage + gap flag | Faithfully asserting ordered writes |
| 3. Webhook tests (#3) | Secret gate + `user_id` provenance guard | Mocking the admin client surface |
| 4. Enqueue tests (#5) | `LINK_QUEUE.send` spy on both paths | Reaching the route's queue binding |
| 5. Cookbook update | §6.2/§6.5 filled, Phase 2 complete | None (docs) |

**Prerequisites:** Phase 1 extraction must land before the Phase 2 consumer test.
**Estimated effort:** ~2-3 sessions across 5 phases.

## Open Risks & Assumptions

- The extraction preserves the exact default-export shape Cloudflare expects
  (`{ fetch, queue }`); verified by `bun run build`.
- The chainable admin fake must reproduce enough of the PostgREST builder shape
  for the consumer and webhook to run unchanged — one-time boilerplate, then reused.

## Success Criteria (Summary)

- `bun run test` green with new consumer, webhook, and enqueue tests.
- Consumer test asserts the ordered `scraping`→`describing`→`done` write sequence
  and documents the transient-exhaust stuck-state gap.
- Both capture paths proven to enqueue `{type:"describe",v:1,linkId,userId}`.
