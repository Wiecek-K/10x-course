# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-15 (Phase 1 change opened: testing-pipeline-units)

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
| #1 | Scrape miss → terminal `failed` state + visual flag (never stuck); any error → link preserved, never lost; LLM failure → fallback marker present | "`ack()` after a failed terminal write = success" — a stuck row still looks acked | consumer state machine in `worker.ts`; status enum in `src/types.ts`; describe fallback string | unit (state transitions + retry taxonomy) + integration (mocked vendors) | asserting exact LLM output text; over-mocking the consumer's own logic |
| #2 | List/read endpoints return only the caller's rows; a not-yours single-resource fetch → 404, never 403 | "logged in ⇒ only my data" — verify the query is user-scoped, not merely authenticated | `api/links` query shape; RLS `SELECT` policy; `api-conventions.md` 404 rule | integration (two users, real RLS) | relying on RLS silent-empty result as the assertion oracle |
| #3 | Forged webhook (bad shared secret) → 401; `user_id` resolved only from the trusted `telegram_id → user_id` mapping, never from the payload | "valid JSON ⇒ trusted sender"; honoring a payload-claimed user id | webhook secret-token check; the trusted mapping lookup; admin-client surface | integration (forged vs authentic request) | testing that the Supabase RLS engine works (vendor); skipping the secret-check branch |
| #4 | Bad credentials → error redirect; success → session + redirect; protected route while anonymous → redirect to sign-in | "auth works ⇒ my endpoints work" — test your handlers + middleware, not `@supabase/ssr` | signin/signup/signout handlers; middleware `PROTECTED_ROUTES` | integration | snapshotting auth UI markup; testing the library's session restore |
| #5 | A link captured through any channel ends up enqueued for processing | "insert row = job done" — the endpoint does more than insert (it enqueues) | the `enqueueLink` call site; every capture write path | integration | testing only the happy desktop path and ignoring bot/extension parity |
| #6 | Malformed/unsupported URL handled cleanly; definitive miss (`null`) → `failed` with no retry; transient error (throw) → retry | "pre-flight rejects dead URLs" — **that feature is parked, do not test it** | `url.ts` validation rules; consumer's null-vs-throw branch | unit | testing a non-existent pre-flight feature; asserting an infinite-retry guard that isn't there |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Bootstrap + pipeline unit logic | Stand up the runner; prove URL validation, consumer retry taxonomy, and describe fallback in isolation | #6, #1 (partial) | unit | researched | context/changes/testing-pipeline-units/ |
| 2 | Capture + processing integration | Webhook trust boundary, enqueue parity, consumer reaches a terminal state and never sticks (vendors mocked) | #1, #3, #5 | integration | not started | — |
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
| Worker integration | none yet — see §3 Phase 2 | — | candidate: `unstable_startWorker` / `vitest-pool-workers` for queue-consumer + API tests; confirm via Context7 |
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

- TBD — see §3 Phase 1 (URL validation + consumer retry taxonomy + describe fallback pattern).

### 6.2 Adding an integration test

- TBD — see §3 Phase 2 (capture/webhook + queue-consumer-with-mocked-vendors pattern).

### 6.3 Adding an e2e test

- TBD — see §3 Phase 4 (Playwright signup → capture → Realtime-visible pattern; bootstrap from `context/foundation/e2e-testing.md`).

### 6.4 Adding a test for a new API endpoint

- TBD — see §3 Phase 3 (user-scoped read + 404-not-403 ownership pattern).

### 6.5 Adding a test for the queue consumer

- TBD — see §3 Phase 2 (terminal-state-never-stuck + null-vs-throw retry pattern).

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

- Strategy (§1–§5) last reviewed: 2026-06-15
- Stack versions last verified: 2026-06-15
- AI-native tool references last verified: 2026-06-14

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
