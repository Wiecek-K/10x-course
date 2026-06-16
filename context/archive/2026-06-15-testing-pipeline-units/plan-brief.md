# Testing Pipeline Units (Phase 1) — Plan Brief

> Full plan: `context/changes/testing-pipeline-units/plan.md`
> Frame brief: `context/changes/testing-pipeline-units/frame.md`
> Research: `context/changes/testing-pipeline-units/research.md`

## What & Why

Stand up a unit-test runner for the project and prove the genuinely unit-level
slice of the link-processing pipeline: the pure functions (URL extraction, link
schema, YouTube detection) and the vendor null-vs-throw classification inside the
two HTTP-edge services. The frame reframed test-plan §3 Phase 1 against the code:
the real Phase-1 unit surface is pure functions + vendor classification run in
plain Vitest/node; consumer orchestration is Phase 2.

## Starting Point

No test runner exists — `package.json` has only lint/format/build. The pipeline
code is already written and stable (auto-description-pipeline merged): pure
functions in `src/lib/`, two `fetch`-bounded vendor classifiers
(`firecrawl.ts`, `describe.ts`) implementing `null`=miss / `throw`=transient.

## Desired End State

`bun run test` runs a green Vitest suite over the three pure functions and the
two vendor classifiers (every documented null/throw branch). CI fails on any unit
failure. The test-plan's wrong "LLM fallback marker" wording and the Phase 1 row
label are corrected; cookbook §6.1 documents the unit pattern.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Phase 1 unit scope | Pure fns + vendor null-vs-throw only | Consumer orchestration needs workerd + admin mocks; low marginal signal over Phase 2 | Frame |
| Runtime | Vitest standalone (node) | Unit surface only touches pure fns + global `fetch`; workerd deferred to Phase 2 | Frame |
| "describe fallback" deliverable | Dropped (phantom) | No such string exists; only fallback string is the YouTube placeholder | Frame |
| Vitest config | Plain `vitest.config.ts` + `vi.mock` | No Astro plugin pipeline needed; per-test control of `astro:env/server` | Plan |
| CI wiring | Wire unit-test job into `ci.yml` now | test-plan §5 makes unit a required gate after Phase 1 | Plan |
| Test location | Colocated `*.test.ts` | Vitest default, easy discovery | Plan |

## Scope

**In scope:** Vitest runner + config; tests for `extractFirstUrl`,
`CreateLinkSchema`, `isYouTubeUrl`, `scrapeFirecrawl`, `describeContent`; CI test
step; test-plan doc fixes (Risk #1 wording, Phase 1 label, cookbook §6.1).

**Out of scope:** `worker.ts` orchestration + `null→failed` terminal assertion
(Phase 2); `vitest-pool-workers`/workerd; URL pre-flight; exact LLM text;
third-party engine behavior; coverage thresholds.

## Architecture / Approach

Plain standalone `vitest.config.ts` (node env, colocated glob). Pure-function
tests need no mocks. Vendor tests mock only the HTTP/env/key boundary: stub
global `fetch`, `vi.mock("astro:env/server")`, `vi.mock("@/lib/llm-key")`. `?raw`
fixtures handled natively by Vitest's Vite transform. Build outward: runner →
pure fns → vendor classifiers → CI gate.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Runner bootstrap | Vitest installed, config, scripts, smoke test green | `astro:env/server` resolution in node |
| 2. Pure-function units | url / schema / youtube full branch coverage | over-testing trivial cases |
| 3. Vendor classification units | firecrawl + describe null-vs-throw, mocked | over-mocking past the HTTP boundary |
| 4. CI gate + doc fixes | test step in ci.yml; test-plan corrections | CI bun/astro-sync ordering |

**Prerequisites:** Pipeline code merged (done); bun + CI already configured.
**Estimated effort:** ~1-2 sessions across 4 small phases.

## Open Risks & Assumptions

- `astro:env/server` may need a `resolve.alias` stub fallback if `vi.mock`
  hoisting doesn't intercept the static import — prove the approach in Phase 1/3.
- Vitest–Vite compatibility verified against the npm registry (2026-06-15): both
  Vitest 3.2.6 (`vite ^5||^6||^7.0.0-0`) and Vitest 4.1.9 (`vite ^6||^7||^8`)
  accept the pinned `vite ^7.3.2`. Plan adopts **Vitest 4.x** (current latest);
  pin `@vitest/coverage-v8` to the same version (exact peer).

## Success Criteria (Summary)

- `bun run test` green over all three pure fns + both vendor classifiers.
- CI fails on a failing unit test (verified on a real PR).
- test-plan no longer claims an LLM fallback marker; Phase 1 reads `complete`.
