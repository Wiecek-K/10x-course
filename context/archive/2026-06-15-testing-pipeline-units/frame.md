# Frame Brief: Phase 1 unit-test scope (testing-pipeline-units)

> Framing step before /10x-plan. Separates what Phase 1 *actually* unit-tests
> from what the test-plan row assumed, after grounding against the code.

## Reported Observation

Test-plan §3 Phase 1 ("Bootstrap + pipeline unit logic") goal, verbatim:
*"Stand up the runner; prove URL validation, consumer retry taxonomy, and
describe fallback in isolation."* Risks covered: #6, #1 (partial). Test type:
unit.

## Initial Framing (preserved)

- **User's stated cause or approach**: All three deliverables — URL validation,
  consumer retry taxonomy, describe fallback — are unit-testable in isolation at
  the Phase-1 layer.
- **User's proposed direction**: Hand to /10x-plan and write unit tests for the
  three.
- **Pre-dispatch narrowing**: User confirmed (a) "describe fallback" meant the
  `null → failed` terminal path (graceful degradation), not an LLM marker
  string; (b) consumer P1/P2 split — "decide for me"; (c) runtime —
  "recommend".

## Dimension Map

Where Phase 1's "unit" surface could actually land:

1. **Pure functions (no I/O)** — `extractFirstUrl` (`src/lib/url.ts:1`),
   `CreateLinkSchema` (`src/lib/schemas/links.ts:3`), `isYouTubeUrl`
   (`src/lib/services/youtube.ts:1`). No runtime, no mocks.
2. **Vendor classification (fetch boundary)** — null-vs-throw logic inside
   `firecrawl.ts` and `describe.ts`. Unit-testable with `fetch` +
   `astro:env/server` + `?raw` mocked, in plain node. ← *this is the real
   "retry taxonomy"; the decision is made here.*  ← initial framing put this in
   the consumer.
3. **Consumer orchestration** — `worker.ts queue()` state machine: status
   writes, `null → failed` terminal, `ack/retry`. Depends on
   `createAdminClient()` + `msg.ack/retry`; needs workerd/admin-client mocks.
   ← initial framing's "consumer retry taxonomy" + "describe fallback" landed
   here as P1.
4. **Describe fallback *string*** — does not exist. Phantom deliverable.

## Hypothesis Investigation

(Evidence from direct file reads — no sub-agent round needed; all conclusive.)

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Pure fns belong in P1 unit | `url.ts:1`, `links.ts:3`, `youtube.ts:1` — all pure, no I/O | STRONG |
| Vendor null-vs-throw is the real P1 "retry taxonomy" | `firecrawl.ts:11–44`, `describe.ts:37–84` classify miss(null) vs transient(throw); consumer merely reacts (`worker.ts:56–80`) | STRONG |
| "consumer retry taxonomy" is a P1 unit | `worker.ts:16,24,45,53,58,63,67,72` — needs `createAdminClient()` query-chain mock + `ack/retry` spies + CF handler import | WEAK (belongs to Phase 2 integration) |
| "describe fallback" marker exists | `describe.ts:43,76,81,84` all return `null`; `worker.ts:66–69` writes `failed`; only marker string is YouTube placeholder `worker.ts:47` | NONE (phantom) |
| Runtime must be vitest-pool-workers for P1 | P1 scope (dims 1–2) only touches pure fns + global `fetch`; `astro:env/server` + `?raw` are Vite-isms Vitest mocks natively. workerd only needed for `worker.ts` (dim 3) = P2 | NONE (node/Vitest suffices) |

## Narrowing Signals

- User: "describe fallback" = `null → failed`, **not** a marker string →
  confirms dim 4 is phantom; the assertion is a *consumer* behavior (dim 3),
  not a *describe-service* unit.
- `worker.ts:65–70`: describe `null` → `processing_status: "failed"`, no string
  written. The only fallback string in the pipeline is `worker.ts:47` (YouTube).
- `firecrawl.ts:1`, `llm-key.ts:1`: both import `astro:env/server` — a setup
  detail to mock, not a runtime blocker.

## Cross-System Convention

Test-plan §1 principle: *cheapest test that gives a real signal wins.* Risk #1's
own "likely cheapest layer" already reads *"unit (state transitions + retry
taxonomy) + integration (mocked vendors)"*, and §3 Phase 2 already owns
*"consumer reaches a terminal state and never sticks (vendors mocked)."* The
convention itself allocates consumer-reaches-terminal to Phase 2. The reframe
aligns Phase 1 to the part of "retry taxonomy" that is genuinely a unit: the
vendor classification, not the orchestrator.

## Reframed Problem Statement

> **The actual Phase-1 unit surface is: the pure functions (URL validation +
> YouTube detection) and the vendor null-vs-throw classification — run in plain
> Vitest/node. The consumer orchestration (worker.ts state machine, including
> the `null → failed` path the user called "describe fallback") is Phase 2
> integration, not Phase 1.**

Two of the three stated deliverables were misframed against the code:
"describe fallback" names a marker string that does not exist (the real behavior
is `null → failed`, which is a *consumer* assertion), and "consumer retry
taxonomy" is orchestration that needs the Workers runtime + admin-client mocks —
heavy setup, low marginal signal over the Phase-2 integration test that already
covers it. The unit-layer essence of "retry taxonomy" is the null-vs-throw
*classification* inside the two vendor services; that stays in Phase 1.

Doc correction surfaced: test-plan Risk #1 "what would prove protection" line
*"LLM failure → fallback marker present"* is factually wrong — there is no LLM
marker. It should read: *LLM failure (null) → terminal `failed`, link preserved,
never stuck; the only fallback string is the YouTube placeholder.*

## Confidence

**HIGH** — strong direct-read evidence on every dimension, matches the
test-plan's own cost×signal convention and Phase-2 allocation, and the decisive
narrowing signal (describe `null → failed`, no marker) is confirmed in source.

## What Changes for /10x-plan

Plan Phase 1 around **two unit clusters in Vitest/node**: (1) pure functions —
`extractFirstUrl`, `CreateLinkSchema`, `isYouTubeUrl`; (2) vendor null-vs-throw
classification — `firecrawl.ts`, `describe.ts` with `fetch`, `astro:env/server`,
and `?raw` fixtures mocked. **Exclude** `worker.ts` orchestration and the
`null → failed` terminal assertion — those move to Phase 2 integration
(vitest-pool-workers). Adopt **Vitest standalone**; defer vitest-pool-workers to
Phase 2. Also: fix the test-plan Risk #1 wording and the Phase 1 row's "describe
fallback" → "vendor null-vs-throw classification."

## References

- Source: `src/worker.ts:44–81`, `src/lib/services/firecrawl.ts:1–44`,
  `src/lib/services/describe.ts:37–84`, `src/lib/llm-key.ts:1`,
  `src/lib/services/scrape.ts:4`, `src/lib/services/youtube.ts:1`,
  `src/lib/url.ts:1`, `src/lib/schemas/links.ts:3`
- Research: `context/changes/testing-pipeline-units/research.md`
- Test plan: `context/foundation/test-plan.md` §2 Risk #1/#6, §3 Phase 1/2, §4
- Investigation: direct reads (no TaskCreate round — evidence conclusive)
