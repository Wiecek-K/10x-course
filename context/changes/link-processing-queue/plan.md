# link-processing-queue Implementation Plan

## Overview

Wire Cloudflare Queue `tabzero-link-processing` as a plumbing-only foundation. No scraping, no LLM calls — those belong to S-02. Delivers: queue + DLQ provisioned, producer helper importable from `src/lib/queue.ts`, no-op consumer in `src/worker.ts` that logs and acks. Unblocks S-02 (auto-description pipeline) and S-06 (category routing).

## Current State Analysis

- `wrangler.jsonc` exists; `"main"` points at `@astrojs/cloudflare/entrypoints/server` (adapter built-in).
- No `"queues"` section in `wrangler.jsonc`.
- `src/types.ts` exists (populated by F-01 with `Link`, `ProcessingStatus`, `LinkInsert`, etc.) — F-02 **appends** `QueueMessage`, must not overwrite it.
- `src/env.d.ts` declares only `App.Locals` — no Worker `Env` interface.
- No `src/worker.ts` exists.
- CF secrets accessed via `astro:env/server`; CF bindings (non-secrets) accessed via `import { env } from 'cloudflare:workers'` — consistent with how the adapter's own `handler.js` works.
- F-01 will be complete before F-02 begins — its link-creation endpoint exists and can import the producer helper.

## Desired End State

- Queue `tabzero-link-processing` and DLQ `tabzero-link-processing-dlq` provisioned on Cloudflare.
- `wrangler.jsonc` declares producer binding (`LINK_QUEUE`) and consumer config (batch, retry, DLQ).
- `src/worker.ts` is the Worker entrypoint — exports `fetch` (→ Astro via `handle`) and `queue()` (→ no-op consumer with structured log).
- `src/lib/queue.ts` exports `enqueueLink(linkId, userId)` — wired into F-01's link-creation endpoint.
- `src/types.ts` exports `QueueMessage` — the contract S-02 and S-06 will consume.
- Verification: `bunx wrangler dev`, save a link, observe `[queue] consumed describe v1 for link <id>` in terminal.

### Key Discoveries

- `@astrojs/cloudflare@13.5.0` exports `@astrojs/cloudflare/handler` with `handle()` — confirmed in `node_modules/@astrojs/cloudflare/package.json` exports map. This is the officially documented pattern for adding `queue()` alongside Astro's `fetch`.
- `wrangler.jsonc` (not `.toml`) — infrastructure.md snippets use TOML syntax but this project uses JSON with comments.
- `bun run dev` runs `astro dev`, which does not trigger queue consumers. Queue verification requires `bunx wrangler dev`.

## What We're NOT Doing

- No scraping or LLM logic (S-02).
- No writes to `processing_status` column — consumer is no-op; those transitions belong to S-02.
- No category routing (S-06).
- No temporary test endpoint for queue verification — F-01's endpoint is the real producer.
- No upgrade of `@astrojs/cloudflare` — 13.5.0 already supports the required pattern.

## Critical Implementation Details

**F-01 schema dependency:** F-01's `links` table must include `processing_status text not null default 'pending'` before S-02 lands. A self-contained amendment spec lives at `context/changes/domain-data-foundation/schema-amendment-processing-status.md` — F-01's agent can apply it without reading this plan. F-02's consumer does not read or write this column.

**Queue consumer verification requires `wrangler dev`:** `bun run dev` (astro dev / miniflare) does not trigger queue consumers. Phase 4 verification must use `bunx wrangler dev`.

---

## Phase 1: Queue provisioning + wrangler config

### Overview

Create the two queue resources on Cloudflare and declare all queue bindings and consumer settings in `wrangler.jsonc`. Change `main` to point at the custom Worker entrypoint.

### Changes Required

#### 1. Cloudflare queue resources

**Action:** Run once via CLI (not code — these create cloud resources):

```
bunx wrangler queues create tabzero-link-processing
bunx wrangler queues create tabzero-link-processing-dlq
```

#### 2. wrangler.jsonc — queues config

**File:** `wrangler.jsonc`

**Intent:** Declare the queue producer binding and consumer config so wrangler wires `LINK_QUEUE` into the Worker env at runtime. Leave `"main"` unchanged at this phase — it moves to Phase 2 when `src/worker.ts` is created.

**Contract:** Add a `"queues"` key with:
- `producers`: `[{ "queue": "tabzero-link-processing", "binding": "LINK_QUEUE" }]`
- `consumers`: `[{ "queue": "tabzero-link-processing", "max_batch_size": 10, "max_batch_timeout": 30, "max_retries": 3, "retry_delay": 300, "dead_letter_queue": "tabzero-link-processing-dlq" }]`

#### 3. Generate and commit runtime types

**Action:** Run after the `"queues"` block is in place:

```
bunx wrangler types
```

**Intent:** Generate `worker-configuration.d.ts` in the project root. This file contains the Cloudflare runtime globals (`Queue<T>`, `ExportedHandler<Env>`, `MessageBatch<Body>`, etc.) and the generated `Cloudflare.Env` namespace with `LINK_QUEUE: Queue<unknown>`. TypeScript picks it up automatically via `tsconfig "include": ["**/*"]`. Commit the generated file — re-run whenever `wrangler.jsonc` bindings change.

### Success Criteria

#### Automated Verification

- `bun run build` passes — no regressions from the new `"queues"` config block.
- `bunx wrangler deploy --dry-run` passes — config valid, queue bindings recognized.
- `worker-configuration.d.ts` exists in the project root and contains `interface Queue<Body`.

#### Manual Verification

- Queue `tabzero-link-processing` visible in Cloudflare dashboard → Queues.
- Queue `tabzero-link-processing-dlq` visible in Cloudflare dashboard → Queues.

**Implementation Note:** Pause here after manual verification passes before proceeding to Phase 2.

---

## Phase 2: Custom Worker entrypoint + consumer

### Overview

Create `src/worker.ts` and point `wrangler.jsonc "main"` at it. It delegates HTTP requests to Astro and handles queue messages with a structured log + ack. Add the `Env` Worker interface to type declarations.

### Changes Required

#### 1. wrangler.jsonc — update main

**File:** `wrangler.jsonc`

**Intent:** Switch the Worker entrypoint from the adapter's built-in server to the custom file created in this phase.

**Contract:** Change `"main"` from `"@astrojs/cloudflare/entrypoints/server"` to `"./src/worker.ts"`.

#### 2. src/worker.ts

**File:** `src/worker.ts` (new)

**Intent:** Single Worker export: `fetch` forwards to Astro's SSR handler; `queue` is the no-op consumer that proves the full plumbing loop works.

**Contract:** Default export satisfies `ExportedHandler<Env, QueueMessage>` — the second type parameter is required so `batch.messages[i].body` resolves to `QueueMessage` rather than `unknown` (with only `ExportedHandler<Env>`, `msg.body.type` raises "Object is of type 'unknown'" and the Phase 2 build gate fails). `fetch` calls `handle(request, env, ctx)` imported from `@astrojs/cloudflare/handler`. `queue` is typed `queue(batch: MessageBatch<QueueMessage>, env, ctx)`, iterates `batch.messages`, logs `[queue] consumed ${msg.body.type} v${msg.body.v} for link ${msg.body.linkId}`, calls `msg.ack()`. Imports `QueueMessage` from `@/types`.

#### 3. src/env.d.ts — Env interface

**File:** `src/env.d.ts`

**Intent:** Override the generated `LINK_QUEUE: Queue<unknown>` (from `worker-configuration.d.ts`) with a strongly-typed version so the compiler enforces the `QueueMessage` shape at every call site.

**Contract:** Add a `Cloudflare` namespace augmentation alongside the existing `App.Locals` declaration:

```ts
import type { QueueMessage } from '@/types';

declare namespace Cloudflare {
  interface Env {
    LINK_QUEUE: Queue<QueueMessage>;
  }
}
```

Do NOT use a top-level `interface Env { ... }` — the generated file already emits one, and TypeScript requires merging properties to be identical. Namespace augmentation overrides cleanly.

### Success Criteria

#### Automated Verification

- `bun run lint` passes on `src/worker.ts`.
- `bun run build` passes — no unresolved imports, no type errors on `handle`, `batch.messages`, `msg.ack()`.

#### Manual Verification

- No TypeScript errors in `src/worker.ts` or `src/env.d.ts`.

**Implementation Note:** Pause here after manual verification passes before proceeding to Phase 3.

---

## Phase 3: Producer helper + types + wiring

### Overview

Define `QueueMessage` (the shared contract), implement `enqueueLink()`, and wire it into F-01's link-creation endpoint.

### Changes Required

#### 1. src/types.ts — QueueMessage

**File:** `src/types.ts`

**Intent:** Define the canonical message shape that all queue producers and future consumers (S-02, S-06) share. Locking it here in F-02 means S-02 inherits the contract rather than inventing it under capacity pressure. **Append** to the existing F-01 domain types in this file — do not overwrite `Link`, `ProcessingStatus`, `LinkInsert`, etc.

**Contract:**

```ts
export type JobType = 'describe';

export interface QueueMessage {
  type: JobType;
  v: 1;
  linkId: string;
  userId: string;
}
```

`v` is the literal type `1` (not `number`) so the compiler catches version mismatches when a `v: 2` variant is introduced. `JobType` is a union — S-06 will extend it with `'categorize'` as an additive change.

#### 2. src/lib/queue.ts

**File:** `src/lib/queue.ts` (new)

**Intent:** Encapsulate all queue send logic behind one importable function so no API endpoint touches `cloudflare:workers` or constructs `QueueMessage` directly.

**Contract:** Export `async function enqueueLink(linkId: string, userId: string): Promise<void>`. Import `env` from `cloudflare:workers`. Send `{ type: 'describe', v: 1, linkId, userId } satisfies QueueMessage` to `env.LINK_QUEUE`.

#### 3. F-01 link-creation endpoint — wire producer

**File:** `src/pages/api/links/index.ts` (F-01's POST handler).

**Intent:** After a successful Supabase insert, enqueue a background processing job so the queue loop is exercised on every real link save.

**Contract:** Import `enqueueLink` from `@/lib/queue`. After the insert returns (the inserted row is bound to `data`; the user id is `context.locals.user.id` — there is no separate `userId` variable), call `await enqueueLink(data.id, context.locals.user.id)`. No error thrown by `enqueueLink` should fail the HTTP response — wrap in try/catch and log if send fails, but return the existing `201 Created` success response regardless (do NOT change the status to 200; capture is more important than queueing; S-02 has its own resilience layer).

### Success Criteria

#### Automated Verification

- `bun run lint` passes on `src/lib/queue.ts` and the F-01 endpoint.
- `bun run build` passes — `QueueMessage` and `enqueueLink` resolve across all import sites.

#### Manual Verification

- `enqueueLink` importable in F-01's endpoint with no TypeScript errors.

**Implementation Note:** Pause here after manual verification passes before proceeding to Phase 4.

---

## Phase 4: End-to-end verification

### Overview

Run the full loop locally. No code changes — this phase is verification only.

### Changes Required

None.

### Success Criteria

#### Manual Verification

- `bunx wrangler dev` starts without errors (not `bun run dev`).
- Sign in, save a link via F-01's create-link flow (UI or curl with valid session cookie).
- Terminal shows `[queue] consumed describe v1 for link <linkId>` within 30s.
- No uncaught errors in wrangler dev output.
- `bun run build` passes as final clean build before merge.

**Implementation Note:** If the consumer log does not appear within 30s, check: (1) `wrangler.jsonc` queues config is syntactically valid JSON; (2) `LINK_QUEUE` binding name matches between `wrangler.jsonc` and `src/env.d.ts`; (3) `enqueueLink` is actually called in the F-01 endpoint (add a `console.log` before the send to confirm).

---

## Testing Strategy

### Automated

- `bun run lint` — ESLint on `src/worker.ts`, `src/lib/queue.ts`, `src/env.d.ts`, `src/types.ts`.
- `bun run build` — full adapter build; catches virtual-module issues and type errors across all new files.

### Manual

1. `bunx wrangler dev`
2. Authenticate, save a link through F-01's endpoint.
3. Observe `[queue] consumed describe v1 for link <id>` in terminal.
4. Confirm no errors in wrangler output.

## References

- Infrastructure decision: `context/foundation/infrastructure.md` §Getting Started step 5
- F-01 schema amendment: `context/changes/domain-data-foundation/schema-amendment-processing-status.md`
- Roadmap entry: `context/foundation/roadmap.md` §F-02

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Queue provisioning + wrangler config

#### Automated

- [x] 1.1 `bun run build` passes after wrangler.jsonc changes — 38bc0d2
- [x] 1.2 `bunx wrangler deploy --dry-run` passes — 38bc0d2
- [x] 1.3 `worker-configuration.d.ts` exists in project root and contains `interface Queue<Body` — 38bc0d2

#### Manual

- [ ] 1.4 Queue `tabzero-link-processing` visible in Cloudflare dashboard
- [ ] 1.5 Queue `tabzero-link-processing-dlq` visible in Cloudflare dashboard

### Phase 2: Custom Worker entrypoint + consumer

#### Automated

- [x] 2.1 `bun run lint` passes on `src/worker.ts` — 723efd0
- [x] 2.2 `bun run build` passes with `src/worker.ts` as main — 723efd0

#### Manual

- [x] 2.3 No TypeScript errors in `src/worker.ts` or `src/env.d.ts` — 723efd0

### Phase 3: Producer helper + types + wiring

#### Automated

- [x] 3.1 `bun run lint` passes on `src/lib/queue.ts` and F-01 endpoint — 52cf1c2
- [x] 3.2 `bun run build` passes — `QueueMessage` and `enqueueLink` resolve — 52cf1c2

#### Manual

- [x] 3.3 `enqueueLink` importable in F-01 endpoint with no TypeScript errors — 52cf1c2

### Phase 4: End-to-end verification

#### Manual

- [x] 4.1 `bunx wrangler dev` starts without errors
- [x] 4.2 Save a link → terminal shows `[queue] consumed describe v1 for link <id>`
- [x] 4.3 No uncaught errors in wrangler dev output
- [x] 4.4 `bun run build` passes as final clean build
