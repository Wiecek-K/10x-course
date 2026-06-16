# Testing Pipeline Units (Phase 1) Implementation Plan

## Overview

Stand up a unit-test runner (Vitest, standalone) for this project and prove the
genuinely-unit-level slice of the link-processing pipeline in plain Node: the
**pure functions** (URL extraction, link-schema validation, YouTube detection)
and the **vendor null-vs-throw classification** inside the two HTTP-edge services
(`firecrawl.ts`, `describe.ts`). Wire the suite into CI as a required gate.

This is the Phase 1 rollout from `context/foundation/test-plan.md` §3, reframed
against the code by `context/changes/testing-pipeline-units/frame.md`: two of the
three originally-stated deliverables ("consumer retry taxonomy", "describe
fallback") are consumer orchestration that belongs to Phase 2 integration, not
Phase 1 units.

## Current State Analysis

- **No test runner is configured.** `package.json` has lint/format/build scripts
  only; no `vitest`/`test` script, no `vitest.config.ts`. (`package.json:5-15`)
- **Vite is pinned `^7.3.2`** via `overrides` (`package.json:60-62`). Compatibility
  verified against the npm registry (2026-06-15): Vitest bundles `vite` as a
  direct dependency — Vitest 3.2.6 accepts `vite ^5||^6||^7.0.0-0` and Vitest
  4.1.9 (current latest) accepts `vite ^6||^7||^8`; both satisfy `^7.3.2`. Plan
  adopts **Vitest 4.x**; `@vitest/coverage-v8` peers Vitest exactly, so pin both
  to the same version if coverage is added.
- **The unit surface exists and is pure or fetch-bounded:**
  - `extractFirstUrl(text)` — regex match + trailing-punctuation strip, returns
    `string | null`. Pure. (`src/lib/url.ts:1-6`)
  - `CreateLinkSchema` — `z.url()` + `.refine()` http/https scheme check. Pure.
    (`src/lib/schemas/links.ts:3-7`)
  - `isYouTubeUrl(url)` — `new URL()` parse, host normalized (`www.` stripped),
    `youtu.be` OR `youtube.com` + `/watch`|`/shorts/`; malformed URL → `false`
    via try/catch. Pure. (`src/lib/services/youtube.ts:1-13`)
  - `scrapeFirecrawl(url)` — null-vs-throw classifier over `fetch`:
    mock-mode→fixture; no key→null; network throw→**throw**; 402→null; 429/5xx→**throw**;
    other non-2xx→null; 2xx no-markdown→null; 2xx markdown→string.
    (`src/lib/services/firecrawl.ts:11-45`)
  - `describeContent(content, userId)` — same contract over OpenAI `fetch`:
    mock-mode→fixture; no key→null; network throw→**throw**; 429/5xx→**throw**;
    non-2xx→null; no content→null; `JSON.parse(...).description.trim()` →
    string or null. Note: `JSON.parse` at `:83` is **not** wrapped — malformed
    JSON throws (transient-classified). (`src/lib/services/describe.ts:37-85`)
- **Vite-isms to handle in tests:**
  - `astro:env/server` virtual module — imported by `firecrawl.ts:1`,
    `mock.ts:1`, and transitively by `describe.ts` (via `llm-key.ts`). Must be
    intercepted with `vi.mock`.
  - `?raw` fixture imports — `firecrawl.ts:2`, `describe.ts:1`. Handled natively
    by Vitest's built-in Vite transform.
- **CI** (`.github/workflows/ci.yml`) runs on bun: `format:check` → `lint` →
  `build`, after `bunx astro sync`. No test step.
- **`scrapeContent` is a pure passthrough** to `scrapeFirecrawl`
  (`src/lib/services/scrape.ts:4-6`) — tests target `scrapeFirecrawl` directly.

### Key Discoveries:

- The null-vs-throw contract is the load-bearing seam: `null` = definitive miss
  (no retry), `throw` = transient (queue retries). Frame + research both
  identify the **vendor classification** as the real unit-layer "retry
  taxonomy"; the consumer merely reacts. (`firecrawl.ts:33-44`,
  `describe.ts:72-84`)
- Mock env vars (`USE_FIRECRAWL_MOCK`, `USE_LLM_MOCK`) are dev tooling, **not**
  the test mechanism. Tests use `vi.mock` / per-test `fetch` stubs to control
  behavior. (research §"Mock System", `mock.ts:3-4`)
- `astro:env/server` is the only resolution blocker for node-runtime tests; a
  `vi.mock("astro:env/server", ...)` factory intercepts it before resolution.

## Desired End State

`bun run test` runs a green Vitest suite covering the three pure functions and
the two vendor classifiers (every documented null/throw branch). CI fails if any
unit test fails. The test-plan's factually-wrong Risk #1 "LLM fallback marker"
wording is corrected, the Phase 1 row label reflects the real deliverable, and
cookbook §6.1 documents the unit-test pattern.

Verify: `bun run test` exits 0 with all spec files reporting passing cases; a
deliberately-broken assertion makes it exit non-zero; a pushed PR shows the test
job running in CI.

## What We're NOT Doing

- **`worker.ts` consumer orchestration** — state-machine status writes,
  `null → failed` terminal assertion, `ack`/`retry` decisions, admin-client
  mocks. → Phase 2 integration (`vitest-pool-workers`).
- **`vitest-pool-workers` / workerd runtime** — not needed for the Node-runnable
  unit surface. → Phase 2.
- **A "describe fallback" string test** — phantom deliverable; no such string
  exists (the only fallback string is the YouTube placeholder in `worker.ts`).
- **URL pre-flight reachability checks** — parked feature; do not test it.
- **Exact LLM output text** — assert structure/null-vs-throw, not wording.
- **Third-party engines** — do not test that Firecrawl/OpenAI work; test our
  classification of their responses against mocked `fetch`.
- **Coverage thresholds / enforced %** — report only if cheap; no gate this phase.

## Implementation Approach

Plain `vitest.config.ts` (no Astro `getViteConfig` wrapper — these modules need
no React/Tailwind pipeline). Tests are **colocated** as `*.test.ts` next to the
source. Phases build outward from zero-setup (runner + pure fns) to mock-heavy
(vendor `fetch`/env mocks), then close with CI wiring + doc corrections so the
gate guards real tests rather than an empty runner.

## Critical Implementation Details

- **`astro:env/server` interception.** A static `import { FIRECRAWL_API_KEY }
  from "astro:env/server"` cannot resolve in node Vitest without help. Use a
  `vi.mock("astro:env/server", () => ({ ... }))` factory in the vendor test
  files (and any test that transitively imports it via `mock.ts`/`llm-key.ts`),
  returning the env names the modules read. If a module resolves the id before
  `vi.mock` hoisting bites, fall back to a `resolve.alias` entry in
  `vitest.config.ts` pointing `astro:env/server` at a tiny stub module. Prove
  the working approach in Phase 1's smoke/first-vendor test before scaling it.
- **CI must `astro sync` before tests.** `astro:env` type generation depends on
  `bunx astro sync` (already in `ci.yml:16`); keep the test step after it.

## Phase 1: Test runner bootstrap

### Overview

Install Vitest, add a plain config that handles the project's Vite-isms, add run
scripts, and land one trivially-green smoke test to prove the runner executes.

### Changes Required:

#### 1. Vitest dependency

**File**: `package.json`

**Intent**: Add Vitest (and `@vitest/coverage-v8` only if coverage is wanted
cheaply) as a devDependency, compatible with the pinned `vite ^7.3.2`.

**Contract**: `devDependencies.vitest` at the Vitest 4.x major (current latest,
registry-verified vite-7 compatible). If coverage is added, `@vitest/coverage-v8`
pinned to the identical Vitest version (exact peer). No change to the `vite`
override.

#### 2. Test scripts

**File**: `package.json`

**Intent**: Expose `test` (single run, CI-friendly) and `test:watch` (local dev).

**Contract**: `scripts.test` = `vitest run`; `scripts.test:watch` = `vitest`.

#### 3. Vitest config

**File**: `vitest.config.ts` (new, repo root)

**Intent**: Standalone Vitest config selecting the Node environment and the
colocated test glob; no Astro plugin pipeline. Carries the `astro:env/server`
fallback alias slot described in Critical Implementation Details if needed.

**Contract**: `defineConfig({ test: { environment: "node", include:
["src/**/*.test.ts"] } })`. `?raw` needs no config (native). Add
`resolve.alias` for `astro:env/server` only if the `vi.mock` factory proves
insufficient in Phase 3.

#### 4. Smoke test

**File**: `src/lib/url.test.ts` (new — first real test doubles as smoke)

**Intent**: One passing assertion that imports a real pure module so a green run
proves both the runner and module resolution work. (Expanded fully in Phase 2.)

**Contract**: A single `describe`/`it` asserting `extractFirstUrl` on one happy
URL returns the URL.

### Success Criteria:

#### Automated Verification:

- Vitest installed: `bun pm ls | grep vitest` (or `package.json` shows it)
- Smoke test passes: `bun run test`
- Type check still passes: `bunx astro sync && bunx tsc --noEmit` (or
  `bun run lint`)
- Format passes: `bun run format:check`

#### Manual Verification:

- `bun run test:watch` starts and reacts to a file save
- A deliberately-failed assertion makes `bun run test` exit non-zero (then revert)

**Implementation Note**: After automated verification passes, pause for manual
confirmation before Phase 2.

---

## Phase 2: Pure-function unit tests

### Overview

Exhaustive, mock-free tests for the three pure functions. Tests the contracts
that protect Risk #6 (malformed URL handling) at the cheapest layer.

### Changes Required:

#### 1. URL extraction tests

**File**: `src/lib/url.test.ts` (expand the Phase 1 smoke file)

**Intent**: Cover `extractFirstUrl` behavior: extracts first http(s) URL from
free text; strips trailing share-sheet punctuation; returns `null` on no-URL
text.

**Contract**: Cases — plain URL; URL embedded in text; trailing
`.,;:!?)]}>'"` stripped; `http://` and `https://` both matched; non-URL text →
`null`; first-of-many returned.

#### 2. Link schema tests

**File**: `src/lib/schemas/links.test.ts` (new)

**Intent**: Cover `CreateLinkSchema` accept/reject: valid http/https URLs pass;
non-http(s) scheme (e.g. `ftp://`, `javascript:`) rejected; malformed string
rejected. Optionally `ListLinksQuerySchema` `true/false`→boolean transform.

**Contract**: Use `safeParse`; assert `.success` true/false per case and the
http/https refine message on the reject path.

#### 3. YouTube detection tests

**File**: `src/lib/services/youtube.test.ts` (new)

**Intent**: Cover `isYouTubeUrl` host/path matrix and malformed-input guard.

**Contract**: `true` — `youtube.com/watch?v=…`, `www.youtube.com/watch?v=…`,
`youtube.com/shorts/ID`, `youtu.be/ID`. `false` — `music.youtube.com/...`
(host not normalized to `youtube.com`), `youtube.com/feed`, non-YouTube host,
malformed/non-URL string (try/catch → false).

### Success Criteria:

#### Automated Verification:

- All pure-function tests pass: `bun run test`
- Lint/format clean on new files: `bun run lint && bun run format:check`

#### Manual Verification:

- Spot-check one edge case (e.g. `music.youtube.com` → `false`) matches intended
  product behavior, not just current code behavior

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Vendor null-vs-throw classification tests

### Overview

Test the load-bearing seam: each vendor service correctly returns `null`
(definitive miss) vs `throw` (transient) per HTTP outcome, with `fetch`,
`astro:env/server`, and `getLlmApiKey` mocked. Protects Risk #1 (partial) and
Risk #6's transient-vs-definitive branch at the unit layer.

### Changes Required:

#### 1. Firecrawl classification tests

**File**: `src/lib/services/firecrawl.test.ts` (new)

**Intent**: Drive `scrapeFirecrawl` through every documented branch by stubbing
the global `fetch` and mocking `astro:env/server` (key present) and
`isFirecrawlMockMode` (off).

**Contract**: `vi.mock("astro:env/server", ...)` provides `FIRECRAWL_API_KEY`;
`vi.stubGlobal("fetch", …)` or `vi.spyOn(globalThis, "fetch")` per case. Cases →
expected: no key (mock env → falsy) → `null`; `fetch` rejects → **throws**
`/network error/`; status 402 → `null`; 429 → **throws** `/transient/`; 500 →
**throws**; 404/other non-2xx → `null`; 200 + `{data:{markdown:null}}` → `null`;
200 + `{data:{markdown:"# x"}}` → `"# x"`. Reset mocks per test
(`afterEach(vi.restoreAllMocks)`).

#### 2. Describe (LLM) classification tests

**File**: `src/lib/services/describe.test.ts` (new)

**Intent**: Drive `describeContent` through every branch by stubbing `fetch`,
mocking `getLlmApiKey` (key present), and `isLlmMockMode` (off).

**Contract**: `vi.mock("@/lib/llm-key", () => ({ getLlmApiKey: () => "sk-test" }))`;
`vi.mock` the mock-mode flag off; stub `fetch` per case. Cases → expected:
no key (mock returns falsy) → `null`; `fetch` rejects → **throws** `/network
error/`; 429/500 → **throws** `/transient/`; 403/other non-2xx → `null`;
200 + empty content → `null`; 200 + valid JSON `{"description":"hi"}` → `"hi"`;
200 + JSON `{"description":"   "}` (whitespace) → `null`. (Malformed-JSON throw
at `:83` is documented; assert it throws only if cheap — it's a known transient
classification.)

### Success Criteria:

#### Automated Verification:

- All vendor classification tests pass: `bun run test`
- No internal modules mocked beyond the HTTP/env/key boundary (review diff)
- Lint/format clean: `bun run lint && bun run format:check`

#### Manual Verification:

- Confirm the `astro:env/server` interception approach works cleanly (no
  unresolved-module warnings); if an alias fallback was needed, confirm it's
  documented in `vitest.config.ts`

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: CI gate + doc fixes

### Overview

Wire the suite into CI as a required gate and correct the test-plan
inaccuracies the frame surfaced.

### Changes Required:

#### 1. CI test step

**File**: `.github/workflows/ci.yml`

**Intent**: Run the unit suite in CI after `astro sync`, before or alongside
build, so a failing unit test fails the pipeline.

**Contract**: Add `- run: bun run test` step after `bunx astro sync`
(`ci.yml:16`). No new secrets needed (units mock all I/O).

#### 2. Test-plan Risk #1 wording fix

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the factually-wrong "LLM failure → fallback marker present"
guidance (Risk #1 row, §2) — there is no LLM marker.

**Contract**: Risk #1 "What would prove protection" cell: change the LLM clause
to "LLM failure (`null`) → terminal `failed`, link preserved, never stuck; the
only fallback string is the YouTube placeholder." Mirror the correction wherever
"describe fallback string" appears in the Risk #1 "Context" cell.

#### 3. Test-plan Phase 1 row + cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Rename the Phase 1 deliverable from "describe fallback" to the real
unit deliverable, mark the phase `complete`, and fill cookbook §6.1.

**Contract**: §3 Phase 1 Goal cell: "consumer retry taxonomy, and describe
fallback" → "and vendor null-vs-throw classification"; Status → `complete`. §6.1:
replace the TBD with the established pattern (colocated `*.test.ts`, Vitest,
`vi.mock` the `astro:env/server`/`fetch`/key boundary, never internal modules).

### Success Criteria:

#### Automated Verification:

- CI workflow includes a test step: `grep "bun run test" .github/workflows/ci.yml`
- Full local gate passes: `bun run format:check && bun run lint && bun run test`
- Test-plan no longer contains "fallback marker present":
  `! grep -q "fallback marker present" context/foundation/test-plan.md`

#### Manual Verification:

- A pushed PR shows the test job executing in GitHub Actions and gating the merge
- Re-read the edited test-plan sections — wording is accurate and Phase 1 reads
  `complete`

**Implementation Note**: Final phase — confirm CI green on a real PR before
closing the change.

---

## Testing Strategy

### Unit Tests:

- Pure functions: `extractFirstUrl`, `CreateLinkSchema`, `isYouTubeUrl` — full
  branch + edge coverage, no mocks.
- Vendor classifiers: `scrapeFirecrawl`, `describeContent` — every documented
  null/throw branch, mocking only the HTTP/env/key boundary.

### Integration Tests:

- Out of scope this phase — `worker.ts` orchestration + terminal-state assertion
  are Phase 2 (`vitest-pool-workers`).

### Manual Testing Steps:

1. `bun run test` → all green.
2. Break one assertion → non-zero exit → revert.
3. Push a PR → confirm CI test job runs and gates.

## Performance Considerations

Negligible — pure functions and mocked `fetch`. Suite should run in well under a
second; no real network or runtime.

## Migration Notes

None. Net-new test infrastructure; no existing tests to migrate.

## References

- Frame brief: `context/changes/testing-pipeline-units/frame.md`
- Research: `context/changes/testing-pipeline-units/research.md`
- Test plan: `context/foundation/test-plan.md` §2 Risk #1/#6, §3 Phase 1/2, §5, §6.1
- Source: `src/lib/url.ts:1`, `src/lib/schemas/links.ts:3`,
  `src/lib/services/youtube.ts:1`, `src/lib/services/firecrawl.ts:11`,
  `src/lib/services/describe.ts:37`, `src/lib/services/scrape.ts:4`,
  `src/lib/services/mock.ts:3`, `.github/workflows/ci.yml`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test runner bootstrap

#### Automated

- [x] 1.1 Vitest installed — 4ddd1e2
- [x] 1.2 Smoke test passes (`bun run test`) — 4ddd1e2
- [x] 1.3 Type check passes — 4ddd1e2
- [x] 1.4 Format passes — 4ddd1e2

#### Manual

- [x] 1.5 `test:watch` reacts to file save — 4ddd1e2
- [x] 1.6 Failed assertion makes test exit non-zero — 4ddd1e2

### Phase 2: Pure-function unit tests

#### Automated

- [x] 2.1 Pure-function tests pass
- [x] 2.2 Lint/format clean on new files

#### Manual

- [ ] 2.3 Edge case (e.g. `music.youtube.com` → false) matches intended behavior

### Phase 3: Vendor null-vs-throw classification tests

#### Automated

- [ ] 3.1 Vendor classification tests pass
- [ ] 3.2 No internal modules mocked beyond HTTP/env/key boundary
- [ ] 3.3 Lint/format clean

#### Manual

- [ ] 3.4 `astro:env/server` interception works cleanly (alias fallback documented if used)

### Phase 4: CI gate + doc fixes

#### Automated

- [ ] 4.1 CI workflow includes test step
- [ ] 4.2 Full local gate passes
- [ ] 4.3 Test-plan no longer contains "fallback marker present"

#### Manual

- [ ] 4.4 PR shows test job executing + gating in GitHub Actions
- [ ] 4.5 Edited test-plan sections accurate; Phase 1 reads `complete`
