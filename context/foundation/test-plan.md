# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-07-16 (Phase 2 complete: testing-capture-processing-integration)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/` (excludes archive,
docs, generated files, build output).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | A captured link gets stuck in an intermediate processing state (`scraping`/`describing`) forever, or is silently lost — scrape/LLM fails for specific URLs and there is no terminal state and no operator signal | High | High | interview Q1, Q3; roadmap §Parked "Odporność zapisu stanu końcowego w konsumerze", "URL pre-flight validation"; hot-spot dir `src/lib/services/` (11 commits/30d), `src/` (`worker.ts`, 3 commits/30d); PRD FR-005 |
| 2 | One user's links become reachable by another user through the links API (RLS silent-filter treated as the API contract) | High | Medium | interview Q1; PRD NFR "Izolacja danych" + Guardrails; lessons "cross-user → 404", "RLS policy coverage" |
| 3 | A privileged service-role write trusts the inbound payload for `user_id`, or a forged webhook is accepted → cross-user write through the RLS-bypassing path | High | Medium | lessons "sessionless writes", "webhook 401 vs 200"; hot-spot dir `src/lib/` (13 commits/30d, incl. `supabase-admin.ts`), `src/pages/api/bot/` (3 commits/30d); abuse lens: IDOR + untrusted input |
| 4 | Registration / sign-in / session handling regresses and a user cannot get into the product | High | Medium | interview Q1; auth handlers under `src/pages/api/auth/` |
| 5 | A capture path (bot now, browser extension S-05 later) bypasses the canonical endpoint and skips enqueue → the link never enters the processing pipeline | High | Medium | lessons "write path that bypasses the canonical endpoint"; roadmap S-05 `proposed`; hot-spot dir `src/pages/api/links/` (3 commits/30d) |
| 6 | A malformed/unsupported URL is mishandled, or a transient error is retried forever → wasted Firecrawl/LLM credits with no signal | Medium | Medium | interview Q1 (cost, no visibility); roadmap §Parked "URL pre-flight validation"; hot-spot dir `src/lib/` (13 commits/30d, incl. `url.ts`) |

**Impact × Likelihood rubric.** High = user loses access/data/money or failure is publicly
visible / area changes weekly or already burned. Medium = feature degrades with a workaround /
touched occasionally. Low = cosmetic / stable code. Order by impact × likelihood; protect
High × High (Risk #1) first.

**Abuse / security lens.** Product has auth + accepts user input (URLs via bot and API), so the
map carries abuse scenarios: IDOR / ownership (#2, #3), untrusted input + forged webhook (#3),
resource abuse (#6). Secret/PII leakage (service-role key, vendor API keys in logs/error bodies)
is folded into #3's "must challenge" and the §7 boundary on testing vendor internals.

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | Vendor `null` (definitive miss) → terminal `failed` + `ack()`, link preserved, never stuck; full success → `done` + `ack()`; YouTube branch → `done` with the placeholder fallback string. (TESTABLE — these branches exist.) | The real stuck-state gap (research 2026-06-27): a **transient throw → `retry()` writes NO status**; after `max_retries` (3) the message hits the DLQ and **nothing ever writes `failed`** → row stuck in `scraping`/`describing` forever — **no DLQ consumer / reaper exists**. Do NOT challenge "ack after failed" — that path is correct. The integration test asserts the `null→failed→ack` branches and **documents** the transient-exhaust gap; it cannot assert self-heal (no recovery code to test). | consumer state machine `worker.ts:8-90`; status enum `src/types.ts:20`; null-vs-throw taxonomy `firecrawl.ts:32-40` / `describe.ts:72-83`; YouTube fallback `worker.ts:52-54` | integration (mocked vendors + mocked admin client; assert ordered `update` calls + ack/retry spies) | asserting exact LLM output text; over-mocking the consumer's own logic; writing a multi-message-batch test (config-guarded `max_batch_size: 1`) |
| #2 | List/read endpoints return only the caller's rows; a not-yours single-resource fetch → 404, never 403 | "logged in ⇒ only my data" — verify the query is user-scoped, not merely authenticated | `api/links` query shape; RLS `SELECT` policy; `api-conventions.md` 404 rule | integration (two users, real RLS) | relying on RLS silent-empty result as the assertion oracle |
| #3 | Forged webhook (bad shared secret) → 401; `user_id` resolved only from the trusted `telegram_id → user_id` mapping, never from the payload. **REGRESSION GUARD** — research 2026-06-27 verified the safeguard is present (constant-time secret check `webhook.ts:19-24`, fails-closed; `user_id` from `telegram_links` `:105-131`; payload type has no `user_id` field). Test protects against future erosion, not a live bug. | "valid JSON ⇒ trusted sender"; honoring a payload-claimed user id | webhook secret-token check; the trusted mapping lookup; admin-client surface | integration (forged vs authentic request; mock admin client + `astro:env/server` + `telegram.sendMessage` + `enqueueLink`) | testing that the Supabase RLS engine works (vendor — path bypasses RLS by design); skipping the secret-check branch |
| #4 | Bad credentials → error redirect; success → session + redirect; protected route while anonymous → redirect to sign-in | "auth works ⇒ my endpoints work" — test your handlers + middleware, not `@supabase/ssr` | signin/signup/signout handlers; middleware `PROTECTED_ROUTES` | integration | snapshotting auth UI markup; testing the library's session restore |
| #5 | A link captured through any channel ends up enqueued for processing. **REGRESSION GUARD** — research 2026-06-27 verified parity holds today (both `POST /api/links` `index.ts:30-47` and bot webhook `webhook.ts:129-147` insert-then-enqueue; no insert-without-enqueue path exists). Test protects against a future capture path (S-05 extension) or a dropped enqueue line. | "insert row = job done" — the endpoint does more than insert (it enqueues) | the `enqueueLink` call site; every capture write path | integration (assert `LINK_QUEUE.send` spy fired with `{type:"describe",v:1,linkId,userId}` after insert, via `vi.mock("cloudflare:workers")`) | testing only the happy desktop path and ignoring bot/extension parity |
| #6 | Malformed/unsupported URL handled cleanly; definitive miss (`null`) → `failed` with no retry; transient error (throw) → retry | "pre-flight rejects dead URLs" — **that feature is parked, do not test it** | `url.ts` validation rules; consumer's null-vs-throw branch | unit | testing a non-existent pre-flight feature; asserting an infinite-retry guard that isn't there |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Bootstrap + pipeline unit logic | Stand up the runner; prove URL validation, consumer retry taxonomy, and vendor null-vs-throw classification in isolation | #6, #1 (partial) | unit | complete | context/changes/testing-pipeline-units/ |
| 2 | Capture + processing integration | Webhook trust boundary, enqueue parity, consumer reaches a terminal state and never sticks (vendors mocked) | #1, #3, #5 | integration | complete | context/changes/testing-capture-processing-integration/ |
| 3 | API authorization + auth | Links API user-scoping (404-not-403), auth/registration handler behavior | #2, #4 | integration | not started | — |
| 4 | E2E critical path + CI gate | One Playwright flow signup → capture → link visible (Realtime JWT); wire the CI test gate | #4 (e2e), #1 (visible state) | e2e + CI gate | not started | — |

**Status vocabulary** (fixed — parser literals): `not started` → `change opened` →
`researched` → `planned` → `implementing` → `complete`.

## 4. Stack

The classic test base for this project. AI-native tools carry a `checked:`
date so future readers can see which lines need re-verification.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | none yet — see §3 Phase 1 | — | Vitest is the expected choice (Vite-native, Astro-compatible); confirm in Phase 1 research |
| Worker integration | Vitest (node env) + `vi.mock` | — | **`@cloudflare/vitest-pool-workers` NOT needed** (research 2026-06-27, testing-capture-processing-integration). All bindings reached via mockable virtual-module imports: `astro:env/server`, and `cloudflare:workers` (`env.LINK_QUEUE.send`). Mock `cloudflare:workers` for the queue-send spy; consumer + API handlers run as plain function calls. pool-workers only if real Queue delivery / RLS / workerd Request semantics are ever in scope |
| API / network mocking | none yet — see §3 Phase 2 | — | mock the HTTP edge only (Firecrawl, LLM, Telegram, Supabase) — never internal modules |
| e2e | Playwright (via MCP) | — | already used manually per `context/foundation/e2e-testing.md`; Phase 4 wires it as a committed test + CI gate |
| (optional) AI-native | Playwright MCP — checked: 2026-06-14 | n/a | use for the single browser critical-path flow only; do NOT layer vision on deterministic logic tests |

**Stack grounding tools (current session):**
- Docs: Context7 — available; will ground Vitest + `@cloudflare/vitest-pool-workers` + Playwright setup during Phase 1/2 research; checked: 2026-06-14
- Search: none available in current session; checked: 2026-06-14
- Runtime/browser: Playwright MCP — available; the Phase 4 e2e layer; checked: 2026-06-14
- Provider/platform: Supabase, GitHub, Linear — available; GitHub Actions (`ci.yml`) is the gate target for Phase 4; checked: 2026-06-14

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck | local + CI | required (already wired) | syntactic / type drift |
| format check | local + CI | required (already wired) | formatting drift |
| unit + integration | local + CI | required after §3 Phase 1 | logic regressions in pipeline + API |
| e2e on critical flow | CI on PR | required after §3 Phase 4 | broken signup → capture → visible path |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, it reads "TBD — see §3 Phase <N>."

### 6.1 Adding a unit test

**Runner:** Vitest 4.x (`bun run test` / `bun run test:watch`). Config: `vitest.config.ts` at repo root, `environment: "node"`, colocated `src/**/*.test.ts` glob.

**Colocate** test files next to source: `src/lib/foo.ts` → `src/lib/foo.test.ts`.

**Pure functions** (no I/O, no env): import and assert directly — no mocks needed.
```ts
import { describe, it, expect } from "vitest";
import { extractFirstUrl } from "./url";

describe("extractFirstUrl", () => {
  it("returns null when no URL in text", () => {
    expect(extractFirstUrl("no url here")).toBeNull();
  });
});
```

**Vendor/HTTP classifiers** (`scrapeFirecrawl`, `describeContent`): mock only the three boundaries — HTTP (`vi.stubGlobal("fetch", …)`), env (`vi.mock("astro:env/server", …)`), LLM key (`vi.mock("@/lib/llm-key", …)`). Never mock internal modules.

```ts
vi.mock("astro:env/server", () => ({
  get FIRECRAWL_API_KEY() { return mockFirecrawlApiKey; },
  USE_FIRECRAWL_MOCK: "false",
  USE_LLM_MOCK: "false",
}));

vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) }));
```

Use `beforeEach` to reset mutable mock state; `afterEach(() => vi.unstubAllGlobals())` to undo `stubGlobal`. Use `vi.mocked(fn).mockReturnValue(...)` for `vi.fn()`-based mocks.

**Null-vs-throw contract** (the load-bearing seam): `null` = definitive miss (no retry), `throw` = transient (queue retries). Assert both sides for every vendor branch:
```ts
await expect(scrapeFirecrawl(url)).rejects.toThrow(/transient/i); // 429/500/network
expect(await scrapeFirecrawl(url)).toBeNull();                     // 402/404/no-key
```

**`astro:env/server` resolution**: `vi.mock` factory approach works without `resolve.alias`. The factory is hoisted above imports and intercepts the virtual module before Node tries to resolve it.

### 6.2 Adding an integration test

For API route handlers (e.g. `POST /api/links`, `POST /api/bot/webhook`). Reference implementations: `src/pages/api/links/index.test.ts`, `src/pages/api/bot/webhook.test.ts`.

**Colocate** test next to route: `src/pages/api/foo/index.ts` → `src/pages/api/foo/index.test.ts`.

**Three mock seams** — all `vi.mock()` calls must appear before the SUT import (they are hoisted above imports by Vitest):

```ts
vi.mock("astro:env/server", () => ({ SUPABASE_URL: "...", SUPABASE_KEY: "..." }));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));  // or supabase-admin
vi.mock("cloudflare:workers", () => ({ env: { LINK_QUEUE: { send: linkQueueSend } } }));
```

For **mutable env state** that changes between tests (e.g. secret present vs. unset), use `vi.hoisted()`:

```ts
const mockSecret = vi.hoisted((): { value: string | undefined } => ({ value: "good-secret" }));
vi.mock("astro:env/server", () => ({ get MY_SECRET() { return mockSecret.value; } }));
// in a test: mockSecret.value = undefined;
```

For **spy references** that must be accessible inside both the factory closure and test expectations, also use `vi.hoisted()`:

```ts
const linkQueueSend = vi.hoisted(() => vi.fn());
vi.mock("cloudflare:workers", () => ({ env: { LINK_QUEUE: { send: linkQueueSend } } }));
// in a test: expect(linkQueueSend).toHaveBeenCalledWith({ type: "describe", v: 1, linkId, userId });
```

**Build the context** directly — no framework helper needed:

```ts
function makeContext(opts = {}): Parameters<typeof POST>[0] {
  return {
    locals: { user: { id: "user-id" } },
    request: new Request("https://app/api/foo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    }),
    cookies: {},
  } as unknown as Parameters<typeof POST>[0];
}
```

**Supabase fake** — hand-rolled chainable; `as unknown as ReturnType<typeof createClient>` silences the structural mismatch:

```ts
vi.mocked(createClient).mockReturnValue({
  from: () => ({
    insert: vi.fn().mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "link-id" }, error: null }) }),
    }),
  }),
} as unknown as ReturnType<typeof createClient>);
```

Use `vi.resetAllMocks()` in `beforeEach` to clear call counts; re-configure spies per test.

### 6.3 Adding an e2e test

- TBD — see §3 Phase 4 (Playwright signup → capture → Realtime-visible pattern; bootstrap from `context/foundation/e2e-testing.md`).

### 6.4 Adding a test for a new API endpoint

- TBD — see §3 Phase 3 (user-scoped read + 404-not-403 ownership pattern).

### 6.5 Adding a test for the queue consumer

Reference implementation: `src/lib/queue-consumer.test.ts`.

**Import from the extracted module**, not the Worker entrypoint (which pulls in the Astro SSR handler):

```ts
import { queue } from "@/lib/queue-consumer";  // NOT @/worker
```

**Build the batch** by hand — no CF Queues runtime needed:

```ts
const ack = vi.fn();
const retry = vi.fn();
const body: QueueMessage = { type: "describe", v: 1, linkId: "l-1", userId: "u-1" };
const batch = { messages: [{ body, ack, retry }] };
await queue(batch as MessageBatch<QueueMessage>);
```

**Ordered status write assertion** — the key signal for Risk #1. Track `update()` call arguments across invocations:

```ts
const updateSpy = vi.fn();
const admin = {
  from: vi.fn().mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { url }, error: null }) }) }),
    update: (data: unknown) => { updateSpy(data); return { eq: () => Promise.resolve({}) }; },
  }),
};
vi.mocked(createAdminClient).mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

// assert ordered writes, not just final state:
expect(updateSpy.mock.calls[0][0]).toMatchObject({ processing_status: "scraping" });
expect(updateSpy.mock.calls[1][0]).toMatchObject({ processing_status: "describing" });
expect(updateSpy.mock.calls[2][0]).toMatchObject({ processing_status: "done" });
expect(ack).toHaveBeenCalledOnce();
```

**Documented gap — transient throw path.** A transient throw → `retry()` with no terminal status write. After `max_retries: 3` (`wrangler.jsonc`) the message hits the DLQ and the row is stuck in `scraping`/`describing` forever (no DLQ consumer/reaper exists). Assert `retry()` was called and that no `failed` write occurred — makes the gap observable rather than silently untested:

```ts
// DOCUMENTED GAP: transient throw → retry() only; no terminal write → row stuck after DLQ
expect(retry).toHaveBeenCalledOnce();
expect(updateSpy).not.toHaveBeenCalledWith(expect.objectContaining({ processing_status: "failed" }));
```

**Null-vs-throw contract** — `null` from vendor = definitive miss → `failed` + `ack()`; `throw` = transient → `retry()` (no status write). Assert both sides for every vendor branch.

### 6.6 Per-rollout-phase notes

(Filled in as phases land.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Respect these
unless the underlying assumption changes.

- **UI components** — full redesign planned once core logic settles; component tests now would be thrown away. Re-evaluate after the redesign lands. (Source: Phase 2 interview Q5.)
- **Generated files** (`worker-configuration.d.ts`, `src/db/database.types.ts`) — the generator is the test; already excluded from lint/format. (Source: Phase 2 interview Q5.)
- **Third-party engines themselves** — do not test that Firecrawl scrapes, Supabase RLS filters, CF Queues deliver, or Telegram sends. Test the seam you own (your consumer, your policies, your webhook parsing) against mocks. Re-evaluate if a vendor integration becomes a recurring incident source. (Source: Phase 2 interview Q5, extended.)
- **Exact LLM output text** — non-deterministic; assert structure/constraints/fallback marker instead of wording. (Source: Phase 2 interview Q5, extended.)
- **Library internals** (`@supabase/ssr` session restore, Astro/CF runtime mechanics) — test your code's behavior given the library's output, not the library. (Source: Phase 2 interview Q5, extended.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-07-16 (§3 Phase 2 marked complete; §6.2, §6.5 cookbook filled in)
- Stack versions last verified: 2026-06-27 (Worker integration: pool-workers ruled out, node+vi.mock confirmed)
- AI-native tool references last verified: 2026-06-14

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
