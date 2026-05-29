# link-processing-queue — Plan Brief

> Full plan: `context/changes/link-processing-queue/plan.md`
> Roadmap entry: `context/foundation/roadmap.md` §F-02

## What & Why

Wire Cloudflare Queue `tabzero-link-processing` as a plumbing-only foundation — no scraping, no LLM. The PRD requires link capture confirmation in ≤2s; processing a description takes 10–30s. The queue decouples the two: the API responds immediately, the Worker processes in the background. Without this foundation S-02 (auto-description) and S-06 (category routing) have nowhere to run.

## Starting Point

`wrangler.jsonc` exists with the Astro adapter as `main` but no queue bindings. `src/types.ts` is empty. No `src/worker.ts`. F-01 (`domain-data-foundation`) will be complete before F-02 begins — its link-creation endpoint is the real producer.

## Desired End State

A developer saves a link through the app, and within 30s the terminal shows `[queue] consumed describe v1 for link <id>`. The queue and DLQ are provisioned on Cloudflare, the producer helper is wired into F-01's endpoint, and the consumer acks every job. No scraping happens yet — the pipeline just proves it can receive and acknowledge work.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Consumer topology | Single Worker via `@astrojs/cloudflare/handler` | Official documented pattern, works on installed 13.5.0, one deploy | Plan |
| Message schema | `{type, v, linkId, userId}` — reference only | Consumer re-reads fresh row; deleted links → clean ack-and-skip, no wasted paid scraping calls | Plan |
| Job type field | `type: 'describe'` + `v: 1` in envelope | S-06 adds `type: 'categorize'` as additive change; roadmap says it rides same queue | Plan |
| Retry / DLQ | `max_retries: 3`, `retry_delay: 300s`, DLQ wired now | NFR "never lose a link"; S-02 writes handler logic only, not failure infra | Plan |
| Producer wiring | Helper `enqueueLink()` in `src/lib/queue.ts`, wired to F-01 endpoint | F-01 done first; no temporary test endpoint needed | Plan |
| Verification | `bunx wrangler dev` + consumer log in terminal | `bun run dev` (astro dev) does not trigger queue consumers | Plan |
| Consumer behavior | Structured log + `msg.ack()` | Visible proof loop closes; ready observability hook for S-02 | Plan |

## Scope

**In scope:**
- Queue + DLQ provisioning on Cloudflare
- `wrangler.jsonc` queues config + `main` change
- `src/worker.ts` custom entrypoint (fetch → Astro, queue → no-op consumer)
- `src/types.ts` `QueueMessage` type — shared contract for S-02 and S-06
- `src/lib/queue.ts` `enqueueLink()` producer helper
- Wiring `enqueueLink` into F-01's link-creation endpoint
- Local end-to-end verification via `bunx wrangler dev`

**Out of scope:**
- Scraping, LLM calls (S-02)
- Writing `processing_status` to DB (S-02)
- Category routing (S-06)
- Temporary test endpoint

## Architecture / Approach

Producer (F-01 API endpoint) calls `enqueueLink(linkId, userId)` after inserting a link. This sends `{ type: 'describe', v: 1, linkId, userId }` to Cloudflare Queue. The Worker in `src/worker.ts` — the new `main` — handles both HTTP (via `handle()` from `@astrojs/cloudflare/handler`) and queue messages (via `queue()` handler). The consumer does nothing except log and ack. DLQ catches any hypothetical exhausted retries. Types shared via `src/types.ts`.

```
[F-01 endpoint]
   │ enqueueLink(linkId, userId)
   ▼
[src/lib/queue.ts]
   │ env.LINK_QUEUE.send({ type:'describe', v:1, linkId, userId })
   ▼
[Cloudflare Queue: tabzero-link-processing]
   │ batch (max 10, max 30s)
   ▼
[src/worker.ts → queue()]
   │ log + msg.ack()
   ▼
[tabzero-link-processing-dlq]  ← only on exhausted retries
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Queue provisioning | Queue + DLQ on CF; wrangler.jsonc updated | JSON syntax error in wrangler.jsonc silently breaks build |
| 2. Worker entrypoint | `src/worker.ts` with fetch + queue(); Env types | Virtual module resolution (mitigated: `handle` from `/handler`, not `/entrypoints/server`) |
| 3. Producer + types | `QueueMessage` contract; `enqueueLink()` wired to F-01 | F-01 endpoint path unknown until F-01 plan exists |
| 4. Verification | Full local loop confirmed in terminal | Using `bun run dev` instead of `bunx wrangler dev` — consumers won't fire |

**Prerequisites:** F-01 (`domain-data-foundation`) complete, including `processing_status` column (see `context/changes/domain-data-foundation/schema-amendment-processing-status.md`).
**Estimated effort:** ~1 session across 4 phases. Phases 1–3 are mostly config and small files; Phase 4 is verification only.

## Open Risks & Assumptions

- F-01's link-creation endpoint path is unknown until F-01 is planned — Phase 3 wiring is a stub until then.
- `bunx wrangler dev` Queue simulation is not 100% identical to production (retry_delay is shortened locally) — acceptable for plumbing verification.
- Free tier limit: 10k ops/day ≈ 3300 links/day (3 ops per link). Sufficient for MVP.

## Success Criteria (Summary)

- `bunx wrangler dev` + save a link → `[queue] consumed describe v1 for link <id>` appears in terminal.
- `bun run build` passes cleanly.
- `QueueMessage` type is the sole definition of the message contract — S-02 imports it, not redeclares it.
